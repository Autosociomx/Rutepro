/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { AppConfig, Product, Seller } from '../types';
import { RouteProRepository } from '../services/routeproRepository';

export interface Membership {
  id: string;
  user_id: string;
  negocio_id: string;
  rol: 'admin' | 'dueño' | 'repartidor' | 'cajero' | 'supervisor' | string;
  activo: boolean;
  created_at?: string;
  negocio?: {
    id: string;
    nombre: string;
    subtitulo?: string;
    color_principal?: string;
    logo_url?: string;
    config?: any;
  };
}

export interface BusinessData {
  id: string;
  nombre: string;
  letra: string;
  subtitulo: string;
  color_principal: string;
  logo_url?: string;
  productos: Product[];
  vendedores: Seller[];
}

export interface BusinessContextType {
  negocioId: string | null;
  rol: string | null;
  memberships: Membership[];
  currentMembership: Membership | null;
  business: BusinessData | null;
  cfg: AppConfig;
  loadingBusiness: boolean;
  businessError: string | null;
  selectMembership: (membershipId: string) => void;
  refreshBusiness: () => Promise<void>;
  crearNegocio: (nombre: string, subtitulo?: string, colorPrincipal?: string) => Promise<{ error: Error | null }>;
  updateConfigInMemory: (newCfg: AppConfig) => void;
  saveBusinessConfig: (newCfg: AppConfig) => Promise<{ error: Error | null }>;
}

const DEFAULT_CFG: AppConfig = {
  nombre: '',
  letra: 'R',
  subtitulo: 'Platform for Logistics & Distribution',
  color_principal: '#C9912A',
  productos: [],
  vendedores: [],
  logo_url: '',
};

/**
 * Mirrors the owner's catalog onto `rp_productos`.
 *
 * The config screen edits an in-memory product list, but sales validation,
 * stock-on-board and the transactional RPCs all key off real `rp_productos`
 * rows — so saving the config has to reconcile the two: upsert what the owner
 * kept, and deactivate (never hard-delete, the sales history references them)
 * what they removed.
 */
async function sincronizarCatalogo(
  negocioId: string,
  productos: Product[]
): Promise<{ error: Error | null }> {
  const { data: existentes, error: readError } = await RouteProRepository.getProductos(negocioId);
  if (readError) return { error: readError };

  const vigentes = new Set<string>();

  for (const p of productos) {
    const precio = Math.max(0, Math.round(Number(p.precio) || 0));
    // A product created in the config screen has a local id, not a UUID: match
    // it by legacy_id so re-saving updates the same row instead of duplicating.
    const match = (existentes || []).find(
      (e) => e.id === p.id || e.legacy_id === p.id || e.nombre.trim().toLowerCase() === p.nombre.trim().toLowerCase()
    );

    const { data: guardado, error } = await RouteProRepository.upsertProducto(negocioId, {
      ...(match ? { id: match.id } : {}),
      legacy_id: p.id,
      nombre: p.nombre,
      precio_centavos: precio,
      icono: p.icono || '📦',
      activo: true,
    });
    if (error) return { error };
    if (guardado?.id) vigentes.add(guardado.id);
  }

  for (const e of existentes || []) {
    if (!vigentes.has(e.id)) {
      const { error } = await RouteProRepository.deleteProducto(negocioId, e.id);
      if (error) return { error };
    }
  }

  return { error: null };
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isDemoMode } = useAuth();

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentMembership, setCurrentMembership] = useState<Membership | null>(null);
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [cfg, setCfg] = useState<AppConfig>(DEFAULT_CFG);
  const [loadingBusiness, setLoadingBusiness] = useState<boolean>(true);
  const [businessError, setBusinessError] = useState<string | null>(null);

  // Helper to sync CSS corporate color variables
  const applyThemeColor = (color: string) => {
    const root = document.documentElement;
    root.style.setProperty('--oro', color);
  };

  /**
   * Fetch memberships and business state strictly from Supabase rp_memberships
   * (Never from localStorage)
   */
  const loadBusinessFromSupabase = useCallback(async (userId: string) => {
    setLoadingBusiness(true);
    setBusinessError(null);

    if (!isSupabaseConfigured) {
      setLoadingBusiness(false);
      return;
    }

    try {
      // 1. Fetch active memberships for the authenticated user from rp_memberships
      const { data: memData, error: memError } = await supabase
        .from('rp_memberships')
        .select(`
          id,
          user_id,
          negocio_id,
          rol,
          activo,
          created_at
        `)
        .eq('user_id', userId)
        .eq('activo', true);

      if (memError) {
        console.error('[BusinessContext] Error querying rp_memberships:', memError.message);
        setBusinessError(`Error al consultar membresías: ${memError.message}`);
        setLoadingBusiness(false);
        return;
      }

      const activeMemberships = (memData || []) as Membership[];
      setMemberships(activeMemberships);

      if (activeMemberships.length === 0) {
        // User is logged in but has no assigned business membership
        setNegocioId(null);
        setRol(null);
        setCurrentMembership(null);
        setBusiness(null);
        setCfg(DEFAULT_CFG);
        setLoadingBusiness(false);
        return;
      }

      // Pick the primary or first membership
      const primaryMem = activeMemberships[0];
      setCurrentMembership(primaryMem);
      setNegocioId(primaryMem.negocio_id);
      setRol(primaryMem.rol);

      // 2. Fetch business profile / config from rp_negocios or negocios
      try {
        const { data: bizData, error: bizError } = await supabase
          .from('rp_negocios')
          .select('*')
          .eq('id', primaryMem.negocio_id)
          .maybeSingle();

        if (bizError) {
          console.warn('[BusinessContext] Warning querying rp_negocios:', bizError.message);
        }

        if (bizData) {
          // El catálogo vive en rp_productos (es lo que mueve stock y valida los
          // RPC de venta); rp_negocios.config solo guarda la plantilla de marca
          // y la lista de vendedores/rutas.
          const { data: productosDb } = await RouteProRepository.getProductos(primaryMem.negocio_id);
          const productos: Product[] = (productosDb || []).map((p) => ({
            id: p.id,
            nombre: p.nombre,
            precio: p.precio_centavos,
            icono: p.icono || '📦',
            unidad: (p as any).unidad || 'pza',
          }));

          const loadedBiz: BusinessData = {
            id: bizData.id,
            nombre: bizData.nombre || '',
            letra: bizData.letra || (bizData.nombre ? bizData.nombre[0].toUpperCase() : 'R'),
            subtitulo: bizData.subtitulo || '',
            color_principal: bizData.color_principal || '#C9912A',
            logo_url: bizData.logo_url || '',
            productos,
            vendedores: bizData.config?.vendedores || [],
          };

          setBusiness(loadedBiz);
          setCfg({
            nombre: loadedBiz.nombre,
            letra: loadedBiz.letra,
            subtitulo: loadedBiz.subtitulo,
            color_principal: loadedBiz.color_principal,
            productos: loadedBiz.productos,
            vendedores: loadedBiz.vendedores,
            logo_url: loadedBiz.logo_url,
          });

          if (loadedBiz.color_principal) {
            applyThemeColor(loadedBiz.color_principal);
          }
        } else {
          // If table row does not exist yet, fallback gracefully
          setBusiness({
            id: primaryMem.negocio_id,
            nombre: 'Mi Negocio',
            letra: 'M',
            subtitulo: 'Portal de Gestión',
            color_principal: '#C9912A',
            productos: [],
            vendedores: [],
          });
        }
      } catch (bizFetchErr: any) {
        console.warn('[BusinessContext] Non-fatal business fetch exception:', bizFetchErr);
      }
    } catch (e: any) {
      console.error('[BusinessContext] Fatal error loading business data:', e);
      setBusinessError(e.message || 'Error al cargar datos del negocio.');
    } finally {
      setLoadingBusiness(false);
    }
  }, []);

  // Synchronize whenever user auth state or demo mode changes
  useEffect(() => {
    if (isDemoMode) {
      // ISOLATED DEMO MODE: In-memory only, completely disconnected from real database
      setNegocioId('demo-isolated-negocio');
      setRol('dueño');
      setMemberships([
        {
          id: 'demo-membership',
          user_id: 'demo-user',
          negocio_id: 'demo-isolated-negocio',
          rol: 'dueño',
          activo: true,
        },
      ]);
      setBusinessError(null);
      setLoadingBusiness(false);
      return;
    }

    if (user) {
      loadBusinessFromSupabase(user.id);
    } else {
      // Anonymous / Logged out state
      setNegocioId(null);
      setRol(null);
      setMemberships([]);
      setCurrentMembership(null);
      setBusiness(null);
      setCfg(DEFAULT_CFG);
      setLoadingBusiness(false);
    }
  }, [user, isDemoMode, loadBusinessFromSupabase]);

  const selectMembership = (membershipId: string) => {
    const mem = memberships.find((m) => m.id === membershipId);
    if (mem) {
      setCurrentMembership(mem);
      setNegocioId(mem.negocio_id);
      setRol(mem.rol);
    }
  };

  const refreshBusiness = async () => {
    if (user && !isDemoMode) {
      await loadBusinessFromSupabase(user.id);
    }
  };

  /**
   * Creates the tenant for a brand-new account. Without this a paying customer
   * could sign up and land on an app with no business attached to it: the RPC
   * creates the `rp_negocios` row and the owner membership in one transaction.
   */
  const crearNegocio = async (
    nombre: string,
    subtitulo = '',
    colorPrincipal = '#C9912A'
  ): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error('Debes iniciar sesión para crear un negocio.') };
    if (!isSupabaseConfigured) return { error: new Error('Supabase no está configurado.') };

    const limpio = nombre.trim();
    if (!limpio) return { error: new Error('Escribe el nombre de tu negocio.') };

    setLoadingBusiness(true);
    try {
      const { error } = await RouteProRepository.crearNegocioConDueno(
        limpio,
        limpio[0].toUpperCase(),
        subtitulo.trim(),
        colorPrincipal
      );
      if (error) return { error };

      await loadBusinessFromSupabase(user.id);
      return { error: null };
    } catch (e: any) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    } finally {
      setLoadingBusiness(false);
    }
  };

  const updateConfigInMemory = (newCfg: AppConfig) => {
    setCfg(newCfg);
    if (newCfg.color_principal) {
      applyThemeColor(newCfg.color_principal);
    }
  };

  const saveBusinessConfig = async (newCfg: AppConfig): Promise<{ error: Error | null }> => {
    updateConfigInMemory(newCfg);

    if (isDemoMode) {
      // In demo mode, changes stay purely in-memory
      return { error: null };
    }

    if (!isSupabaseConfigured || !negocioId) {
      return { error: null };
    }

    try {
      const { error } = await supabase
        .from('rp_negocios')
        .update({
          nombre: newCfg.nombre,
          letra: newCfg.letra,
          subtitulo: newCfg.subtitulo,
          color_principal: newCfg.color_principal,
          logo_url: newCfg.logo_url,
          // Vendedores/rutas son etiquetas operativas, no usuarios de auth:
          // viven en el JSONB de configuración del negocio.
          config: { vendedores: newCfg.vendedores },
          updated_at: new Date().toISOString(),
        })
        .eq('id', negocioId);

      if (error) {
        console.warn('[BusinessContext] Error saving business config to Supabase:', error.message);
        return { error };
      }

      // El catálogo se persiste en rp_productos para que las ventas descuenten
      // inventario y los RPC puedan validar cada item contra el negocio.
      const { error: catalogError } = await sincronizarCatalogo(negocioId, newCfg.productos);
      if (catalogError) {
        console.warn('[BusinessContext] Error saving catalog:', catalogError.message);
        return { error: catalogError };
      }

      await loadBusinessFromSupabase(user!.id);
      return { error: null };
    } catch (e: any) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  };

  return (
    <BusinessContext.Provider
      value={{
        negocioId,
        rol,
        memberships,
        currentMembership,
        business,
        cfg,
        loadingBusiness,
        businessError,
        selectMembership,
        refreshBusiness,
        crearNegocio,
        updateConfigInMemory,
        saveBusinessConfig,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = (): BusinessContextType => {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
};
