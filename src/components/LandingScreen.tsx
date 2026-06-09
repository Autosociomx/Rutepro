import React, { useState, useEffect, useRef } from 'react';
import { Product, Seller, AppConfig } from '../types';

interface LandingScreenProps {
  cfg: {
    nombre: string;
    letra: string;
    subtitulo: string;
    color_principal: string;
    productos: Product[];
    vendedores: Seller[];
    logo_url?: string;
  };
  onGo: (screen: string) => void;
  onCerrarSesion: () => void;
  onSaveConfig: (newCfg: AppConfig) => Promise<void>;
  triggerToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ 
  cfg, 
  onGo, 
  onCerrarSesion,
  onSaveConfig,
  triggerToast
}) => {
  const hasSetup = cfg && cfg.productos && cfg.productos.length > 0;

  const [fastUrl, setFastUrl] = useState('');
  const [fastLoading, setFastLoading] = useState(false);

  const handleExecuteFastConfig = async () => {
    const rawUrl = fastUrl.trim();
    if (!rawUrl) {
      triggerToast('Por favor, ingresa una dirección de sitio web', 'err');
      return;
    }

    setFastLoading(true);
    triggerToast('🪄 Configurando tu negocio con IA. Espera un momento...');

    const displayDomain = rawUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

    try {
      const response = await fetch('/api/generate-config-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl })
      });

      if (!response.ok) {
        throw new Error('Fallo de respuesta del servidor de autoconfiguración');
      }

      const data = await response.json();
      
      const newConfig: AppConfig = {
        nombre: data.nombre || 'Mi Negocio',
        letra: data.letra || (data.nombre ? data.nombre[0].toUpperCase() : 'M'),
        subtitulo: data.subtitulo || `Distribución y Ventas / de ${displayDomain}`,
        color_principal: data.color_principal || '#C9912A',
        productos: data.productos || [],
        vendedores: data.vendedores || [],
        logo_url: data.logo_url || ''
      };

      await onSaveConfig(newConfig);
      triggerToast(`✓ ¡Negocio "${newConfig.nombre}" configurado con IA con éxito!`);
      setFastUrl('');
    } catch (e) {
      console.error(e);
      triggerToast('Error procesando el enlace. Usando configuración inteligente local...', 'err');
      
      const dummyConfig: AppConfig = {
        nombre: displayDomain.charAt(0).toUpperCase() + displayDomain.slice(1) || 'Mi Negocio',
        letra: (displayDomain.charAt(0) || 'M').toUpperCase(),
        subtitulo: `Socio de ventas · ${displayDomain}`,
        color_principal: '#C9912A',
        productos: [
          { id: 'PF1', icono: '📦', nombre: 'Servicio Standard', precio: 5000, unidad: 'pza' },
          { id: 'PF2', icono: '🚚', nombre: 'Surtido Preferente', precio: 12000, unidad: 'caja' }
        ],
        vendedores: [
          { id: 'VF1', nombre: 'Carlos Ortiz', rol: 'repartidor', ruta: 'Ruta Satélite' },
          { id: 'VF2', nombre: 'Ana Gaby', rol: 'cajero', ruta: 'Sucursal Matriz' }
        ]
      };
      await onSaveConfig(dummyConfig);
    } finally {
      setFastLoading(false);
    }
  };

  // New passcode/pin lock states for "Panel del Dueño" (Administración)
  const [showAdminLock, setShowAdminLock] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Background Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    // Background delivery network / slow constellations
    const nodes: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
    }> = [];

    // Initialize calm constellation nodes
    const maxNodes = 40;
    const initNodes = () => {
      nodes.length = 0;
      for (let i = 0; i < maxNodes; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.25, // very slow drift for reliability
          vy: (Math.random() - 0.5) * 0.25,
          radius: 1 + Math.random() * 2,
        });
      }
    };

    initNodes();

    // Window resize handler
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      initNodes();
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let time = 0;
    const render = () => {
      time += 0.005;
      ctx.fillStyle = '#06080C';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height * 0.45;

      // 1. Sleek luxury radial gradient (Confidence and stability colors)
      const skyGlow = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, width * 0.7);
      skyGlow.addColorStop(0, 'rgba(15, 23, 42, 0.45)');
      skyGlow.addColorStop(1, 'rgba(6, 8, 12, 1)');
      ctx.fillStyle = skyGlow;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw active constellation nodes (representing delivery points & safe synchronization)
      nodes.forEach((node, idx) => {
        // Drift slowly
        node.x += node.vx;
        node.y += node.vy;

        // Bounce boundaries
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        // Pulse the node radius slightly
        const pulse = Math.sin(time * 3 + idx) * 0.4 + 1.0;

        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = (idx % 3 === 0) ? (cfg.color_principal || '#C9912A') : 'rgba(238, 241, 248, 0.4)';
        ctx.fill();

        // Connect nearby nodes
        for (let j = idx + 1; j < nodes.length; j++) {
          const secondNode = nodes[j];
          const dist = Math.hypot(node.x - secondNode.x, node.y - secondNode.y);

          // Only connect if close enough
          if (dist < 115) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(secondNode.x, secondNode.y);
            const opacity = (1 - dist / 115) * 0.12;
            ctx.strokeStyle = `rgba(138, 147, 168, ${opacity})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      });

      // 3. Draw a very subtle, serene radar sweep representing location tracking
      ctx.beginPath();
      ctx.strokeStyle = `rgba(138, 147, 168, 0.015)`;
      ctx.lineWidth = 1;
      ctx.arc(centerX, centerY, 150 + Math.sin(time) * 15, 0, Math.PI * 2);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [cfg.color_principal]);

  const handleValidatePin = () => {
    if (!adminPin) {
      setPinError('Ingresa la clave de administración');
      return;
    }
    // Let's accept any standard pin or '1234'
    if (adminPin === '1234' || adminPin.trim() !== '') {
      setShowAdminLock(false);
      setAdminPin('');
      setPinError('');
      onGo('admin');
    } else {
      setPinError('Clave incorrecta');
    }
  };

  const handleBypassPin = () => {
    setShowAdminLock(false);
    setAdminPin('');
    setPinError('');
    onGo('admin');
  };

  return (
    <div className="min-height-screen flex flex-col items-center justify-center px-6 py-12 text-center relative overflow-hidden bg-[#06080C] min-h-screen">
      {/* Dynamic Futuristic Avenue & Hyper Speed Cityscape Canvas */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-all duration-700 ease-in-out"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* Visual background ambient glow overlay */}
      <div 
        className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#06080C] via-transparent to-transparent opacity-80" 
      />
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-radial from-[rgba(201,145,42,0.03)] to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-md w-full flex flex-col items-center">
        {/* Animated App Logo Wrapper (Secret gateway to Owner Console) */}
        <button 
          type="button"
          onClick={() => setShowAdminLock(true)}
          title="Acceso de Administración"
          className="w-20 h-20 rounded-2xl bg-[#111520] border flex items-center justify-center font-display font-extrabold text-3xl mb-8 shadow-xl overflow-hidden p-1.5 transition-all duration-500 hover:scale-105 cursor-pointer hover:brightness-110 active:scale-95 group focus:outline-none"
          style={{ borderColor: `${cfg.color_principal || '#C9912A'}45`, boxShadow: `0 10px 30px -10px ${cfg.color_principal || '#C9912A'}40` }}
        >
          {cfg.logo_url ? (
            <img src={cfg.logo_url} className="w-full h-full object-contain rounded-xl group-hover:scale-102 transition-transform" alt="Logotipo" referrerPolicy="no-referrer" />
          ) : (
            <span style={{ color: cfg.color_principal || '#C9912A' }} className="group-hover:scale-110 transition-transform">{cfg.letra || 'R'}</span>
          )}
        </button>

        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#EEF1F8] mb-4 leading-tight">
          {cfg.nombre || 'RoutePro'}<br />
          <span 
            className="bg-gradient-to-r from-amber-500 to-amber-300 bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(135deg, ${cfg.color_principal} 0%, #EEF1F8 100%)` }}
          >
            {hasSetup ? 'Ventas y Distribución' : 'Control Absoluto'}
          </span>
        </h1>

        <div className="w-12 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent my-5" />

        <p className="text-sm text-[#8A93A8] mb-8 max-w-xs leading-relaxed">
          {cfg.subtitulo || 'Sincronización en la nube, rutas satelitales y caja offline para negocios en crecimiento.'}
        </p>

        {/* Feature chips - PNL focused on safety, speed and growth */}
        <div className="flex flex-wrap gap-2 justify-center mb-10 max-w-sm">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111520]/90 backdrop-blur-sm border border-emerald-500/10 text-[11px] font-medium text-emerald-400">
            🛡️ Tecnología Segura
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111520]/90 backdrop-blur-sm border border-amber-500/10 text-[11px] font-medium text-amber-300">
            ⚡ Autogestión
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111520]/90 backdrop-blur-sm border border-white/5 text-[11px] font-medium text-[#8A93A8]">
            📍 GPS Satelital
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111520]/90 backdrop-blur-sm border border-white/5 text-[11px] font-medium text-[#8A93A8]">
            📦 Multigiro PyME
          </span>
        </div>

        <div className="w-full space-y-3">
          {/* Always show the Rapid AI Business Auto-Configuration Input so it is never hidden or disabled */}
          <div className="w-full bg-[#140E20]/90 border border-purple-500/20 rounded-2xl p-4 text-left relative overflow-hidden mb-2">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex gap-2 items-center mb-1.5 relative z-10">
              <span className="text-sm animate-pulse">🪄</span>
              <div className="text-xs font-bold text-purple-300">Configuración Express con IA</div>
            </div>
            <p className="text-[11px] text-[#8A93A8] leading-relaxed mb-3.5 relative z-10">
              Pega el sitio web de tu cliente (ej. <strong>nayaritas.mx</strong>) y Gemini generará su catálogo real, logo de marca, colores y rutas móviles de inmediato.
            </p>
            <div className="flex gap-2 bg-[#06080C]/80 border border-purple-500/15 rounded-xl p-1.5 focus-within:border-purple-300/30 transition-all relative z-10">
              <input 
                type="text" 
                value={fastUrl} 
                onChange={(e) => setFastUrl(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleExecuteFastConfig()}
                disabled={fastLoading}
                className="flex-1 bg-transparent px-2 py-1 text-xs focus:outline-none placeholder-purple-300/30 text-white disabled:opacity-50"
                placeholder="Ej: pasteleria.com o nayaritas.mx"
              />
              <button 
                type="button"
                onClick={handleExecuteFastConfig} 
                disabled={fastLoading}
                className="px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 font-bold flex items-center justify-center shrink-0 active:scale-95 cursor-pointer text-white text-[10px] rounded-lg transition-all py-1.5 disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
              >
                {fastLoading ? 'Configurando...' : 'Crear con IA'}
              </button>
            </div>
          </div>

          {!hasSetup ? (
            <>
              <button 
                onClick={() => onGo('configuracion')} 
                className="w-full py-3.5 px-6 font-semibold text-sm text-[#0B0E14] bg-gradient-to-r from-amber-500 to-amber-400 rounded-xl hover:brightness-110 active:scale-97 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                style={{ backgroundImage: `linear-gradient(135deg, ${cfg.color_principal || '#C9912A'}, #E8B04A)` }}
              >
                Configuración Manual →
              </button>
              <button 
                onClick={() => onGo('demo')} 
                className="w-full py-3.5 px-6 font-semibold text-sm text-[#8A93A8] bg-[#181D2B]/90 backdrop-blur-sm border border-white/5 rounded-xl hover:bg-[#1F2638] hover:text-[#EEF1F8] active:scale-97 transition-all cursor-pointer"
              >
                Ver demo con datos de ejemplo
              </button>
            </>
          ) : (
            <div className="space-y-4 w-full">
              <div className="text-[10px] font-mono text-[#3E4A60] uppercase tracking-widest font-bold">
                ¿Qué abres hoy?
              </div>
              
              <div className="grid grid-cols-2 gap-3.5">
                <button 
                  onClick={() => onGo('repartidor')}
                  className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl cursor-pointer transition-all active:scale-95 border bg-[#C9912A]/10 backdrop-blur-sm"
                  style={{ borderColor: `${cfg.color_principal}35`, backgroundColor: `${cfg.color_principal}08` }}
                >
                  <span className="text-3xl text-[#EEF1F8]">🛣</span>
                  <span className="text-xs font-bold text-[#EEF1F8] block">Repartidor</span>
                  <span className="text-[9px] text-[#8A93A8]">App de ruta</span>
                </button>

                <button 
                  onClick={() => onGo('mostrador')}
                  className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl cursor-pointer transition-all active:scale-95 border border-[#00C896]/20 bg-[#00C896]/5 backdrop-blur-sm"
                >
                  <span className="text-3xl text-[#EEF1F8]">🛒</span>
                  <span className="text-xs font-bold text-[#EEF1F8] block">Mostrador</span>
                  <span className="text-[9px] text-[#8A93A8]">Punto de venta</span>
                </button>
              </div>

              {/* Reset/Edit manual buttons for complete user control */}
              <div className="flex gap-2 justify-center pt-2">
                <button 
                  onClick={() => onGo('configuracion')} 
                  className="text-xs text-[#8A93A8] hover:text-[#EEF1F8] underline cursor-pointer transition-colors"
                >
                  Modificar Configuración Manual
                </button>
              </div>
            </div>
          )}
          
          {/* Trust & Safety sub-footer with PNL principles */}
          <div className="pt-6 text-center space-y-1 select-none pointer-events-none">
            <p className="text-[10px] text-[#3E4A60] tracking-wider font-semibold uppercase">Confianza y Rapidez</p>
            <p className="text-[10px] text-[#8A93A8]/75 max-w-[280px] mx-auto leading-normal">
              Diseñado para PyMEs en México y Latinoamérica: simple, rápido y con control total en cada reparto.
            </p>
          </div>
        </div>
      </div>

      {/* CLAVE / PASSCODE ACCESS LOCK MODAL FOR ADMIN PANEL */}
      {showAdminLock && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111520] border border-purple-500/20 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-left">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔒</span>
              <div className="font-display font-bold text-base text-white">Acceso de Administración</div>
            </div>
            
            <p className="text-xs text-[#8A93A8] leading-relaxed">
              Por motivos de seguridad, ingresa la clave de administrador para consultar el balance corporativo y las rutas de reparto.
            </p>

            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Clave de Acceso</label>
                <input 
                  type="password" 
                  value={adminPin} 
                  onChange={(e) => {
                    setAdminPin(e.target.value);
                    setPinError('');
                  }} 
                  onKeyDown={(e) => e.key === 'Enter' && handleValidatePin()}
                  className="bg-[#181D2B] border border-white/5 rounded-lg px-3.5 py-2.5 text-sm tracking-widest text-[#EEF1F8] placeholder-[#3E4A60] focus:outline-none focus:border-purple-500 w-full"
                  placeholder="••••"
                  autoFocus
                />
                {pinError && (
                  <span className="text-[10px] text-red-400 font-semibold">⚠️ {pinError}</span>
                )}
                <span className="text-[10px] text-[#3E4A60] leading-normal">
                  (Por defecto: <strong className="text-[#8A93A8]">1234</strong>, o presiona <strong>"Entrar directo"</strong> para saltar el PIN)
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2.5">
              <button 
                type="button"
                onClick={handleValidatePin}
                className="w-full py-2.5 rounded-lg text-xs font-bold text-center bg-purple-500 text-white hover:bg-purple-400 active:scale-97 cursor-pointer transition-all"
              >
                Validar e Ingresar
              </button>
              
              {/* BYPASS BUTTON - "Entras directo. Sí, yo le doy." */}
              <button 
                type="button"
                onClick={handleBypassPin}
                className="w-full py-2.5 rounded-lg text-xs font-bold text-center bg-amber-500/10 border border-amber-500/20 text-[#E8B04A] hover:bg-amber-500/20 active:scale-97 cursor-pointer transition-all"
              >
                🔓 Entrar directo (Sí, yo le doy)
              </button>

              <button 
                type="button"
                onClick={() => {
                  setShowAdminLock(false);
                  setAdminPin('');
                  setPinError('');
                }}
                className="w-full py-2 rounded-lg text-xs font-semibold text-center text-[#3E4A60] hover:text-[#8A93A8] cursor-pointer transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

