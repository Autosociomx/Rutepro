import React, { useState, useEffect } from 'react';
import { COLS } from '../data';
import { LogoGenerator } from './LogoGenerator';
import { Product, Seller, AppConfig } from '../types';

interface ConfigScreenProps {
  initialCfg: AppConfig;
  onSave: (newCfg: AppConfig) => void;
  onGoBack: () => void;
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({ initialCfg, onSave, onGoBack }) => {
  const [tab, setTab] = useState<'neg' | 'pro' | 'vnd'>('neg');
  const [nombre, setNombre] = useState(initialCfg.nombre || 'Mi Negocio');
  const [letra, setLetra] = useState(initialCfg.letra || 'M');
  const [subtitulo, setSubtitulo] = useState(initialCfg.subtitulo || 'App de ventas · RoutePro');
  const [colorPrincipal, setColorPrincipal] = useState(initialCfg.color_principal || '#C9822C');
  const [productos, setProductos] = useState<Product[]>(initialCfg.productos || []);
  const [vendedores, setVendedores] = useState<Seller[]>(initialCfg.vendedores || []);

  // Custom Logo and Palette Extractor states
  const [logoUrl, setLogoUrl] = useState(initialCfg.logo_url || '');
  const [logoTab, setLogoTab] = useState<'subir' | 'crear' | 'ia'>('subir');
  const [logoStyle, setLogoStyle] = useState<'modern' | 'shield' | 'retro' | 'minimal'>('modern');
  const [logoIcon, setLogoIcon] = useState('🏪');
  const [logoText, setLogoText] = useState(initialCfg.letra || 'M');

  // AI Setup Generator states
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMode, setAiMode] = useState<'descripcion' | 'sitio_web'>('descripcion');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Modal forms states
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProdIcon, setNewProdIcon] = useState('📦');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('pza');

  const [showVendedorModal, setShowVendedorModal] = useState(false);
  const [newVndName, setNewVndName] = useState('');
  const [newVndRole, setNewVndRole] = useState<'repartidor' | 'cajero' | 'ambos'>('repartidor');
  const [newVndRuta, setNewVndRuta] = useState('');

  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const triggerToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Extract dominant color from uploaded logo
  const extractDominantColor = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve('#C9822C');

          const size = 30;
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(img, 0, 0, size, size);

          const imgData = ctx.getImageData(0, 0, size, size).data;
          const colorCounts: { [key: string]: number } = {};

          for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i+1];
            const b = imgData[i+2];
            const a = imgData[i+3];

            // Ignore transparent, near-black, and white background colors
            if (a < 150) continue;
            if (r > 235 && g > 235 && b > 235) continue; // too white
            if (r < 30 && g < 30 && b < 30) continue; // too dark
            if (Math.abs(r - g) < 18 && Math.abs(g - b) < 18 && Math.abs(r - b) < 18) continue; // too grey

            const rgbKey = `${r},${g},${b}`;
            colorCounts[rgbKey] = (colorCounts[rgbKey] || 0) + 1;
          }

          let dominantRgb = '201,130,44';
          let maxCount = 0;

          Object.entries(colorCounts).forEach(([rgb, count]) => {
            if (count > maxCount) {
              maxCount = count;
              dominantRgb = rgb;
            }
          });

          const [dr, dg, dbColor] = dominantRgb.split(',').map(Number);
          const rgbToHex = (rVal: number, gVal: number, bVal: number) => 
            '#' + [rVal, gVal, bVal].map(x => {
              const hex = x.toString(16);
              return hex.length === 1 ? '0' + hex : hex;
            }).join('');

          resolve(rgbToHex(dr, dg, dbColor));
        } catch (err) {
          console.error(err);
          resolve('#C9822C');
        }
      };
      img.onerror = () => {
        resolve('#C9822C');
      };
    });
  };

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      triggerToast('La imagen supera el límite de 2MB', 'err');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (!base64) return;

      setLogoUrl(base64);
      triggerToast('✓ Logotipo corporativo cargado');

      const colExtracted = await extractDominantColor(base64);
      if (colExtracted) {
        setColorPrincipal(colExtracted);
        triggerToast(`✓ ¡Tema de color adaptado al logotipo! (${colExtracted})`);
      }
    };
    reader.readAsDataURL(file);
  };

  const generateLogoFromStamp = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = 300;
      const radius = 150;
      const col = colorPrincipal || '#C9822C';

      ctx.clearRect(0, 0, size, size);

      if (logoStyle === 'shield') {
        ctx.fillStyle = '#0F131E';
        ctx.strokeStyle = col;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(150, 20);
        ctx.quadraticCurveTo(260, 20, 260, 120);
        ctx.quadraticCurveTo(260, 240, 150, 285);
        ctx.quadraticCurveTo(40, 240, 40, 120);
        ctx.quadraticCurveTo(40, 20, 150, 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = `${col}45`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(150, 32);
        ctx.quadraticCurveTo(248, 32, 248, 120);
        ctx.quadraticCurveTo(248, 230, 150, 273);
        ctx.quadraticCurveTo(52, 230, 52, 120);
        ctx.quadraticCurveTo(52, 32, 150, 32);
        ctx.closePath();
        ctx.stroke();
      } else if (logoStyle === 'retro') {
        ctx.fillStyle = '#111520';
        ctx.fillRect(10, 10, 280, 280);
        
        ctx.strokeStyle = col;
        ctx.lineWidth = 8;
        ctx.strokeRect(20, 20, 260, 260);

        ctx.strokeStyle = '#EEF1F8';
        ctx.lineWidth = 2;
        ctx.strokeRect(26, 26, 248, 248);
      } else if (logoStyle === 'minimal') {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(radius, radius, 140, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#06080C';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(radius, radius, 140, 0, Math.PI * 2);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.shadowColor = col;
        ctx.shadowBlur = 15;
        
        ctx.fillStyle = '#0F131E';
        ctx.strokeStyle = col;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(radius, radius, 135, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;

        ctx.strokeStyle = `${col}40`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(radius, radius, 122, 0, Math.PI * 2);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.font = '76px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(logoIcon || '🏪', 150, logoText ? 110 : 150);

      if (logoText) {
        ctx.font = 'bold 52px Inter, system-ui, sans-serif';
        ctx.fillStyle = logoStyle === 'minimal' ? '#06080C' : '#EEF1F8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(logoText.toUpperCase(), 150, 195);

        ctx.font = '800 11px monospace';
        ctx.fillStyle = logoStyle === 'minimal' ? 'rgba(6, 8, 12, 0.6)' : `${col}cc`;
        ctx.fillText('ROUTEPRO ELITE', 150, 242);
        
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = logoStyle === 'minimal' ? 'rgba(6, 8, 12, 0.2)' : `${col}50`;
        ctx.beginPath();
        ctx.moveTo(80, 224);
        ctx.lineTo(220, 224);
        ctx.stroke();
      }

      const generatedDataUrl = canvas.toDataURL('image/png');
      setLogoUrl(generatedDataUrl);
      triggerToast('✓ ¡Logotipo insignia generado y guardado!');
    } catch (e) {
      console.error(e);
      triggerToast('Error renderizando logo', 'err');
    }
  };

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) {
      triggerToast('Ingresa una descripción de tu negocio', 'err');
      return;
    }
    setAiGenerating(true);
    triggerToast('🪄 Generando configuración con Gemini...');
    try {
      const response = await fetch('/api/generate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiPrompt })
      });
      if (!response.ok) {
        throw new Error('Error al conectar con el servidor configurador');
      }
      const data = await response.json();
      setNombre(data.nombre || 'Mi Negocio');
      setLetra(data.letra || (data.nombre ? data.nombre[0] : 'M'));
      setLogoText(data.letra || (data.nombre ? data.nombre[0] : 'M'));
      setSubtitulo(data.subtitulo || 'RoutePro App');
      setColorPrincipal(data.color_principal || '#00C896');
      setProductos(data.productos || []);
      setVendedores(data.vendedores || []);
      triggerToast('✓ Éxito: Configuración cargada con IA');
    } catch (e) {
      console.error(e);
      triggerToast('Error al autoconfigurar tu negocio con Gemini', 'err');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleLoadFromWebsiteUrl = async () => {
    let rawUrl = websiteUrl.trim();
    if (!rawUrl) {
      triggerToast('Por favor, ingresa una dirección de sitio web válida', 'err');
      return;
    }
    
    setAiGenerating(true);
    triggerToast('🔍 Investigando sitio web con Gemini Web Crawler...');
    
    // Clean preview domain name just for UI feedback
    let displayDomain = rawUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    
    try {
      const response = await fetch('/api/generate-config-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl })
      });
      if (!response.ok) {
        throw new Error('Error de conexión con el servicio de scraping');
      }
      const data = await response.json();
      
      setNombre(data.nombre || 'Demo Sabor');
      setLetra(data.letra || (data.nombre ? data.nombre[0].toUpperCase() : 'N'));
      setLogoText(data.letra || (data.nombre ? data.nombre[0].toUpperCase() : 'N'));
      setSubtitulo(data.subtitulo || `Tienda online / ${displayDomain}`);
      setColorPrincipal(data.color_principal || '#00C896');
      setProductos(data.productos || []);
      setVendedores(data.vendedores || []);
      
      triggerToast(`✓ ¡Demostración cargada para "${data.nombre}" de forma exitosa!`);
    } catch (e) {
      console.error(e);
      triggerToast('Error analizando la web. Cargando plantilla de respaldo.', 'err');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAddProduct = () => {
    if (!newProdName.trim()) {
      triggerToast('Escribe el nombre del producto', 'err');
      return;
    }
    const cents = parseInt(newProdPrice) || 0;
    if (cents <= 0) {
      triggerToast('Ingresa un precio válido en centavos (ej: 150 = $1.50)', 'err');
      return;
    }

    const newProd = {
      id: 'P' + Date.now(),
      icono: newProdIcon.trim() || '📦',
      nombre: newProdName.trim(),
      precio: cents,
      unidad: newProdUnit
    };

    setProductos([...productos, newProd]);
    setShowProductModal(false);
    setNewProdName('');
    setNewProdPrice('');
    setNewProdIcon('📦');
    triggerToast('✓ Producto agregado');
  };

  const handleDeleteProduct = (id: string) => {
    setProductos(productos.filter(p => p.id !== id));
    triggerToast('Producto removido');
  };

  const handleAddVendedor = () => {
    if (!newVndName.trim()) {
      triggerToast('Escribe el nombre del integrante', 'err');
      return;
    }

    const newVnd = {
      id: 'V' + Date.now(),
      nombre: newVndName.trim(),
      rol: newVndRole,
      ruta: newVndRuta.trim() || 'Ruta Libre'
    };

    setVendedores([...vendedores, newVnd]);
    setShowVendedorModal(false);
    setNewVndName('');
    setNewVndRuta('');
    triggerToast('✓ Integrante agregado');
  };

  const handleDeleteVendedor = (id: string) => {
    setVendedores(vendedores.filter(v => v.id !== id));
    triggerToast('Integrante removido');
  };

  const handleSaveAll = () => {
    if (!nombre.trim()) {
      triggerToast('El nombre de negocio no puede estar vacío', 'err');
      setTab('neg');
      return;
    }

    onSave({
      nombre: nombre.trim(),
      letra: letra.trim() || nombre[0].toUpperCase(),
      subtitulo: subtitulo.trim(),
      color_principal: colorPrincipal,
      productos,
      vendedores,
      logo_url: logoUrl
    });
  };

  return (
    <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] flex flex-col font-sans pb-10">
      {/* Configuration Header bar */}
      <div className="sticky top-0 z-50 h-14 bg-[#06080C]/94 backdrop-blur-md border-b border-white/5 px-4.5 flex items-center justify-between gap-3">
        <button 
          onClick={onGoBack} 
          className="w-9 h-9 rounded-lg bg-[#111520] border border-white/5 flex items-center justify-center text-[#8A93A8] hover:text-[#EEF1F8] transition-all cursor-pointer"
        >
          ←
        </button>
        <div className="flex-1 text-left font-display font-bold text-sm tracking-wide">
          Configuración Global
        </div>
        <button 
          onClick={handleSaveAll} 
          className="px-4.5 py-2 font-bold text-xs rounded-lg text-ink transition-all shadow-md cursor-pointer inline-flex items-center gap-1.5"
          style={{ backgroundColor: colorPrincipal, color: '#06080C' }}
        >
          💾 Guardar
        </button>
      </div>

      {/* Tabs list matching vanilla Design */}
      <div className="grid grid-cols-3 gap-1.5 bg-[#0B0E14] border-b border-white/5 p-2.5">
        <button 
          onClick={() => setTab('neg')} 
          className={`py-2 px-1 rounded-lg text-[9px] font-bold tracking-wider uppercase flex flex-col items-center gap-1 transition-all cursor-pointer ${tab === 'neg' ? 'bg-[#C9822A]/10 border border-[#C9822A]/20 text-[#E8B04A]' : 'text-[#3E4A60]'}`}
          style={tab === 'neg' ? { color: colorPrincipal, borderColor: `${colorPrincipal}35`, backgroundColor: `${colorPrincipal}10` } : {}}
        >
          <span>🏪</span> Negocio
        </button>
        <button 
          onClick={() => setTab('pro')} 
          className={`py-2 px-1 rounded-lg text-[9px] font-bold tracking-wider uppercase flex flex-col items-center gap-1 transition-all cursor-pointer ${tab === 'pro' ? 'bg-[#C9822A]/10 border border-[#C9822A]/20 text-[#E8B04A]' : 'text-[#3E4A60]'}`}
          style={tab === 'pro' ? { color: colorPrincipal, borderColor: `${colorPrincipal}35`, backgroundColor: `${colorPrincipal}10` } : {}}
        >
          <span>📦</span> Catálogo
        </button>
        <button 
          onClick={() => setTab('vnd')} 
          className={`py-2 px-1 rounded-lg text-[9px] font-bold tracking-wider uppercase flex flex-col items-center gap-1 transition-all cursor-pointer ${tab === 'vnd' ? 'bg-[#C9822A]/10 border border-[#C9822A]/20 text-[#E8B04A]' : 'text-[#3E4A60]'}`}
          style={tab === 'vnd' ? { color: colorPrincipal, borderColor: `${colorPrincipal}35`, backgroundColor: `${colorPrincipal}10` } : {}}
        >
          <span>🛣</span> Canales/Rutas
        </button>
      </div>

      {/* TAB 1: NEGOCIO */}
      {tab === 'neg' && (
        <div className="flex-1 p-5 space-y-6">
          <div className="bg-[#181D2B] border border-white/5 rounded-xl p-3.5 flex gap-3">
            <span className="text-xl shrink-0">💡</span>
            <div>
              <div className="text-xs font-bold text-gradient-gold">Personaliza tu Aplicación</div>
              <p className="text-[11px] text-[#8A93A8] leading-relaxed mt-1">El nombre, logotipo corporativo e identidad de color se sincronizarán en tiempo real para todos tus canales de distribución y ventas.</p>
            </div>
          </div>

          {/* AI Generator Card with direct client scraper support */}
          <div className="bg-[#140E20] border border-purple-500/20 rounded-xl p-4 space-y-3.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex gap-2 items-center">
              <span className="text-sm animate-pulse">🪄</span>
              <div className="text-xs font-bold text-purple-300">Asistente Configurador con IA (Gemini)</div>
            </div>

            {/* AI Custom Mode Chooser */}
            <div className="grid grid-cols-2 gap-1 bg-[#06080C]/80 border border-purple-500/10 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setAiMode('descripcion')}
                className={`py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${aiMode === 'descripcion' ? 'bg-purple-500/20 text-purple-200 border border-purple-500/20' : 'text-purple-300/40 hover:text-purple-300'}`}
              >
                📝 Por Categoría/Idea
              </button>
              <button
                type="button"
                onClick={() => setAiMode('sitio_web')}
                className={`py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${aiMode === 'sitio_web' ? 'bg-purple-500/20 text-purple-200 border border-purple-500/20' : 'text-purple-300/40 hover:text-purple-300'}`}
              >
                🌐 En base a Sitio Web / Link
              </button>
            </div>

            {aiMode === 'descripcion' ? (
              <div className="space-y-3.5">
                <p className="text-[10px] text-purple-200/70 leading-relaxed text-left">
                  Escribe qué vende tu negocio (ej: "Lácteos y quesos a domicilio", "Heladería", "Florería express") y Gemini creará tu catálogo, precios sugeridos, y rutas territoriales al instante.
                </p>
                <div className="flex gap-2 bg-[#0B0E14] border border-purple-500/10 rounded-lg p-1.5">
                  <input 
                    type="text" 
                    value={aiPrompt} 
                    onChange={(e) => setAiPrompt(e.target.value)} 
                    disabled={aiGenerating}
                    className="flex-1 bg-transparent p-1 px-1.5 text-xs focus:outline-none placeholder-purple-300/30 text-white disabled:opacity-50"
                    placeholder="Ej: Distribuidora de café gourmet y repostería..."
                  />
                  <button 
                    type="button"
                    onClick={handleGenerateWithAI} 
                    disabled={aiGenerating}
                    className="px-3 bg-purple-500 hover:bg-purple-400 font-bold hover:brightness-110 flex items-center justify-center shrink-0 active:scale-95 cursor-pointer text-white text-[10px] rounded-md transition-all py-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {aiGenerating ? 'Generando...' : '🪄 Crear'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <p className="text-[10px] text-purple-200/70 leading-relaxed text-left">
                  ¡Haz demostraciones de impacto! Pega la web de tu cliente prospecto (ej: <span className="text-purple-300 font-semibold">nayaritas.mx</span>) y Gemini buscará sus datos reales, catálogo estrella, precios locales y gama de marca para estructurar su app personalizada.
                </p>
                <div className="flex gap-2 bg-[#0B0E14] border border-purple-500/10 rounded-lg p-1.5">
                  <input 
                    type="text" 
                    value={websiteUrl} 
                    onChange={(e) => setWebsiteUrl(e.target.value)} 
                    disabled={aiGenerating}
                    className="flex-1 bg-transparent p-1 px-1.5 text-xs focus:outline-none placeholder-purple-300/30 text-white disabled:opacity-50"
                    placeholder="Ej: nayaritas.mx o restaurante.com"
                  />
                  <button 
                    type="button"
                    onClick={handleLoadFromWebsiteUrl} 
                    disabled={aiGenerating}
                    className="px-3 bg-indigo-500 hover:bg-indigo-400 font-bold hover:brightness-110 flex items-center justify-center shrink-0 active:scale-95 cursor-pointer text-white text-[10px] rounded-md transition-all py-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {aiGenerating ? 'Analizando...' : '🌐 Cargar Web'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Business Preview card */}
          <div className="border border-white/10 rounded-2xl p-4.5 flex items-center gap-3.5 bg-[#0B0E14] relative">
            <div className="absolute -top-2.5 -right-2 px-2.5 py-0.5 rounded-full bg-[#111520] border border-white/10 text-[9px] font-bold text-white/50 tracking-wider">
              VISTA PREVIA DE APP
            </div>
            {logoUrl ? (
              <img 
                src={logoUrl} 
                className="w-12 h-12 rounded-xl bg-[#111520] border border-white/10 object-contain p-0.5" 
                alt="Logo Empresa"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div 
                className="w-12 h-12 rounded-xl bg-[#111520] border border-white/10 flex items-center justify-center font-display font-extrabold text-lg"
                style={{ color: colorPrincipal }}
              >
                {letra || nombre[0]?.toUpperCase() || 'M'}
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <div className="font-display text-sm font-bold text-[#EEF1F8] truncate">{nombre || 'Mi Negocio'}</div>
              <div className="text-[11px] text-[#3E4A60] mt-0.5 truncate">{subtitulo || 'RoutePro App'}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <span className="text-[8px] font-mono text-[#8A93A8] bg-[#111520] border border-white/5 px-1.5 py-0.5 rounded">🛣 RUTA</span>
              <span className="text-[8px] font-mono text-[#8A93A8] bg-[#111520] border border-white/5 px-1.5 py-0.5 rounded">🛒 POS</span>
            </div>
          </div>

          {/* Edit Form */}
          <div className="space-y-5">
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Nombre del Negocio</label>
              <input 
                type="text" 
                value={nombre} 
                onChange={(e) => {
                  setNombre(e.target.value);
                  if (e.target.value && !letra) {
                    setLetra(e.target.value[0].toUpperCase());
                    setLogoText(e.target.value[0].toUpperCase());
                  }
                }} 
                className="bg-[#181D2B] border border-white/5 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                placeholder="Ej: Tostadas Nallarita"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Inicial/Abreviación</label>
                <input 
                  type="text" 
                  value={letra} 
                  onChange={(e) => {
                    setLetra(e.target.value);
                    setLogoText(e.target.value);
                  }} 
                  className="bg-[#181D2B] border border-white/5 rounded-lg px-3.5 py-2.5 text-xs text-center font-display font-bold text-white focus:outline-none focus:border-amber-500"
                  maxLength={3}
                  placeholder="Ej: TN"
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Slogan o Subtítulo</label>
                <input 
                  type="text" 
                  value={subtitulo} 
                  onChange={(e) => setSubtitulo(e.target.value)} 
                  className="bg-[#181D2B] border border-white/5 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  placeholder="Ej: Las tostadas más crujientes y deliciosas"
                />
              </div>
            </div>

            {/* DYNAMIC LOGOTIPE IDENTIFIER & GENERATOR PANEL */}
            <div className="bg-[#111520] border border-white/10 rounded-2xl p-4.5 space-y-4">
              <div className="text-left space-y-1">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  📁 Identidad Visual y Logotipo
                </div>
                <p className="text-[10px] text-[#8A93A8]">
                  Sube tu propio logotipo o genera un sello digital e inyecta sus colores automáticamente en toda la app.
                </p>
              </div>

              {/* Logo Tab Toggles */}
              <div className="grid grid-cols-3 gap-1 bg-[#06080C] p-1 rounded-lg">
                <button 
                  type="button" 
                  onClick={() => setLogoTab('subir')}
                  className={`py-1.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${logoTab === 'subir' ? 'bg-[#181D2B] text-white shadow-sm' : 'text-[#3E4A60]'}`}
                >
                  📤 Subir Logo
                </button>
                <button 
                  type="button" 
                  onClick={() => setLogoTab('crear')}
                  className={`py-1.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${logoTab === 'crear' ? 'bg-[#181D2B] text-white shadow-sm' : 'text-[#3E4A60]'}`}
                >
                  📐 Sello Stamp
                </button>
                <button 
                  type="button" 
                  onClick={() => setLogoTab('ia')}
                  className={`py-1.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${logoTab === 'ia' ? 'bg-[#181D2B] text-purple-300 shadow-sm border border-purple-500/20' : 'text-[#3E4A60]'}`}
                >
                  🪄 Logo con IA
                </button>
              </div>

              {/* RENDER ACTIVE TAB */}
              {logoTab === 'subir' ? (
                <div className="space-y-3">
                  <div className="border border-dashed border-white/10 rounded-xl p-5 text-center flex flex-col items-center justify-center hover:bg-white/[0.01] transition-all relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleUploadLogo} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span className="text-2xl mb-1.5">🖼️</span>
                    <span className="text-xs font-bold text-white">Haz clic o arrastra tu logotipo</span>
                    <span className="text-[9px] text-[#3E4A60] mt-1">Soporta PNG, JPG o SVG de hasta 2MB</span>
                  </div>

                  {logoUrl && (
                    <div className="p-3 bg-[#06080C] rounded-xl flex items-center justify-between gap-3 border border-white/5">
                      <div className="flex items-center gap-2">
                        <img src={logoUrl} className="w-10 h-10 object-contain rounded bg-[#111520] p-1" alt="Preview" referrerPolicy="no-referrer" />
                        <div className="text-left">
                          <div className="text-[10px] font-bold text-emerald-400">Logotipo Activo</div>
                          <div className="text-[9px] text-[#8A93A8]">Sincronizado en la nube</div>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setLogoUrl('')}
                        className="py-1 px-3 bg-red-400/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 font-bold rounded text-[9px] cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              ) : logoTab === 'crear' ? (
                <div className="space-y-4 text-left">
                  {/* Select Styles */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Estilo de Sello</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['modern', 'shield', 'retro', 'minimal'] as const).map((styleOpt) => (
                        <button 
                          key={styleOpt} 
                          type="button"
                          onClick={() => setLogoStyle(styleOpt)}
                          className={`py-1.5 text-[9px] font-bold rounded-lg border uppercase tracking-wider cursor-pointer capitalize transition-all ${logoStyle === styleOpt ? 'bg-purple-500/10 border-purple-500/50 text-purple-300' : 'bg-[#06080C] border-transparent text-[#3E4A60]'}`}
                        >
                          {styleOpt === 'modern' ? 'Neón' : styleOpt === 'shield' ? 'Escudo' : styleOpt === 'retro' ? 'Brutal' : 'Mínimo'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Select Icon / Emoji */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Icono Iconografía</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={logoIcon} 
                        onChange={(e) => setLogoIcon(e.target.value)}
                        className="w-11 bg-[#06080C] border border-white/5 rounded-lg text-center font-bold text-sm text-white focus:outline-none"
                      />
                      <div className="flex-1 flex flex-wrap gap-1.5 items-center justify-between bg-[#06080C] px-3 py-1.5 rounded-lg border border-white/5">
                        {['🍞', '💧', '🏪', '🌮', '📦', '🥐', '🥑', '🛒'].map((emo) => (
                          <button 
                            key={emo} 
                            type="button" 
                            onClick={() => setLogoIcon(emo)}
                            className="hover:scale-125 transition-all text-xs cursor-pointer"
                          >
                            {emo}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Monogram Text Input */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Texto Monograma (Iniciales)</label>
                    <input 
                      type="text" 
                      value={logoText} 
                      onChange={(e) => setLogoText(e.target.value)}
                      className="w-full bg-[#06080C] border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none uppercase font-bold font-display"
                      placeholder="Ej: TN"
                      maxLength={4}
                    />
                  </div>

                  <button 
                    type="button" 
                    onClick={generateLogoFromStamp}
                    className="w-full py-2 bg-purple-500 hover:bg-purple-600 active:scale-95 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    🎨 Generar Sello e Instalar
                  </button>
                </div>
              ) : (
                <LogoGenerator
                  businessName={nombre}
                  currentColor={colorPrincipal}
                  businessDescription={subtitulo}
                  onLogoSelected={(url) => setLogoUrl(url)}
                  triggerToast={(msg, type) => triggerToast(msg, type || 'ok')}
                />
              )}
            </div>

            {/* Custom Color Grid */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Color Corporativo de la Marca (Layout)</label>
              <div className="grid grid-cols-5 gap-2 pb-2">
                {COLS.map((c) => (
                  <button 
                    key={c}
                    type="button"
                    onClick={() => setColorPrincipal(c)}
                    className={`aspect-square rounded-lg border-2 cursor-pointer transition-all ${c === colorPrincipal ? 'border-white scale-105' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2.5 pt-1">
                <span className="text-[11px] text-[#8A93A8]">Color personalizado:</span>
                <input 
                  type="color" 
                  value={colorPrincipal} 
                  onChange={(e) => setColorPrincipal(e.target.value)}
                  className="w-10 h-7 rounded border border-white/5 bg-[#181D2B] p-0.5 cursor-pointer"
                />
                <span className="font-mono text-xs text-[#8A93A8]">{colorPrincipal}</span>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => setTab('pro')} 
            className="w-full py-3 bg-[#181D2B] border border-white/5 rounded-xl text-xs font-semibold hover:bg-[#1F2638] hover:text-white transition-all cursor-pointer text-center"
          >
            Siguiente: Catálogo de Productos →
          </button>
        </div>
      )}

      {/* TAB 2: PRODUCTOS */}
      {tab === 'pro' && (
        <div className="flex-1 p-5 space-y-4">
          <div className="bg-[#181D2B] border border-white/5 rounded-xl p-3.5 flex gap-3">
            <span className="text-xl shrink-0">📦</span>
            <div>
              <div className="text-xs font-bold text-[#EEF1F8]">Catálogo Central de Artículos</div>
              <p className="text-[11px] text-[#8A93A8] leading-relaxed mt-1">Configura los precios en centavos (ejemplo: $15.00 se escribe como 1500) y define la unidad de despacho para repartidores.</p>
            </div>
          </div>

          {/* List existing */}
          <div className="space-y-2">
            {productos.length === 0 ? (
              <div className="text-center py-8 border border-white/5 bg-[#181D2B]/20 rounded-xl">
                <div className="text-4xl opacity-30 mb-2">📦</div>
                <div className="text-xs font-bold text-[#3E4A60]">El catálogo de productos está vacío.</div>
              </div>
            ) : (
              productos.map((prod) => (
                <div key={prod.id} className="bg-[#181D2B] border border-white/5 rounded-xl p-3 flex items-center gap-3">
                  <div className="text-xl w-9 h-9 rounded-lg bg-[#0B0E14] border border-white/5 flex items-center justify-center shrink-0">
                    {prod.icono || '📦'}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-xs font-bold text-white truncate">{prod.nombre}</div>
                    <div className="text-[10px] text-[#8A93A8] mt-0.5">
                      ${(prod.precio / 100).toFixed(2)} / {prod.unidad}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteProduct(prod.id)}
                    className="w-8 h-8 rounded-lg bg-red-400/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <button 
            onClick={() => setShowProductModal(true)}
            className="w-full py-3 bg-[#181D2B] border border-dashed border-white/15 hover:border-white/30 rounded-xl text-xs text-[#8A93A8] hover:text-[#EEF1F8] transition-all cursor-pointer font-medium"
          >
            + Agregar nuevo producto
          </button>

          <button 
            type="button"
            onClick={() => setTab('vnd')} 
            className="w-full py-3 bg-[#181D2B] border border-white/5 rounded-xl text-xs font-semibold hover:bg-[#1F2638] hover:text-white transition-all cursor-pointer text-center"
          >
            Siguiente: Canales de Equipo →
          </button>
        </div>
      )}

      {/* TAB 3: EQUIPO / VENDEDORES */}
      {tab === 'vnd' && (
        <div className="flex-1 p-5 space-y-4">
          <div className="bg-[#181D2B] border border-white/5 rounded-xl p-3.5 flex gap-3">
            <span className="text-xl shrink-0">🛣</span>
            <div>
              <div className="text-xs font-bold text-[#EEF1F8]">Canales y Vendedores</div>
              <p className="text-[11px] text-[#8A93A8] leading-relaxed mt-1">Configura las rutas territoriales de los vehículos repartidores o cajeros de sucursal.</p>
            </div>
          </div>

          {/* List existing vendedores */}
          <div className="space-y-2">
            {vendedores.length === 0 ? (
              <div className="text-center py-8 border border-white/5 bg-[#181D2B]/20 rounded-xl">
                <div className="text-4xl opacity-30 mb-2">🛣</div>
                <div className="text-xs font-bold text-[#3E4A60]">No hay vendedores configurados todavía.</div>
              </div>
            ) : (
              vendedores.map((vnd) => (
                <div key={vnd.id} className="bg-[#181D2B] border border-white/5 rounded-xl p-3 flex items-center gap-3">
                  <div className="text-base w-9 h-9 rounded-lg bg-[#0B0E14] border border-white/5 flex items-center justify-center shrink-0">
                    {vnd.rol === 'repartidor' ? '🛣' : vnd.rol === 'cajero' ? '🛒' : '⚡'}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-xs font-bold text-white truncate">{vnd.nombre}</div>
                    <div className="text-[10px] text-[#8A93A8] mt-0.5">
                      Ruta: {vnd.ruta} · Rol: {vnd.rol === 'repartidor' ? 'Repartidor' : vnd.rol === 'cajero' ? 'Cajero de Sucursal' : 'Cajero / Repartidor'}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteVendedor(vnd.id)}
                    className="w-8 h-8 rounded-lg bg-red-400/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <button 
            onClick={() => setShowVendedorModal(true)}
            className="w-full py-3 bg-[#181D2B] border border-dashed border-white/15 hover:border-white/30 rounded-xl text-xs text-[#8A93A8] hover:text-[#EEF1F8] transition-all cursor-pointer font-medium"
          >
            + Agregar integrante de equipo
          </button>

          <div className="p-4 bg-[#00C896]/10 border border-[#00C896]/20 rounded-xl flex items-start gap-2.5">
            <span className="text-base">✅</span>
            <div className="text-xs text-[#00C896] leading-relaxed text-left">
              Para aplicar todos tus cambios, presiona el botón <strong>"💾 Guardar"</strong> del menú superior.
            </div>
          </div>
        </div>
      )}

      {/* TOAST PANEL */}
      {toast && (
        <div className={`fixed bottom-6 left-5 right-5 p-3.5 rounded-xl z-50 shadow-md text-xs font-bold flex items-center gap-2 justify-center animate-fade-in ${toast.type === 'err' ? 'bg-red-950/80 border border-red-500/20 text-red-400' : 'bg-emerald-950/80 border border-emerald-500/20 text-[#00C896]'}`}>
          <span>{toast.type === 'err' ? '⚠️' : '✓'}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* MODAL: ADD PRODUCT */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111520] border border-white/10 rounded-2xl p-5.5 max-w-sm w-full space-y-4 shadow-2xl text-left">
            <div className="font-display font-bold text-base text-white">Nuevo Producto</div>
            <div className="space-y-3.5">
              <div className="grid grid-cols-4 gap-2.5">
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Emoji</label>
                  <input 
                    type="text" 
                    value={newProdIcon} 
                    onChange={(e) => setNewProdIcon(e.target.value)} 
                    className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-center text-lg focus:outline-none focus:border-amber-500"
                    maxLength={2}
                    placeholder="📦"
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-3">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Nombre del Producto</label>
                  <input 
                    type="text" 
                    value={newProdName} 
                    onChange={(e) => setNewProdName(e.target.value)} 
                    className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    placeholder="Ej: Pan bolillo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Precio (centavos)</label>
                  <input 
                    type="number" 
                    value={newProdPrice} 
                    onChange={(e) => setNewProdPrice(e.target.value)} 
                    className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    placeholder="150"
                  />
                  <span className="text-[9px] text-[#3E4A60]">150 = $1.50</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Unidad</label>
                  <select 
                    value={newProdUnit} 
                    onChange={(e) => setNewProdUnit(e.target.value)}
                    className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="pza">pza (Pieza)</option>
                    <option value="kg">kg (Kilo)</option>
                    <option value="lt">lt (Litro)</option>
                    <option value="garrafón">garrafón</option>
                    <option value="botellón">botellón</option>
                    <option value="caja">caja</option>
                    <option value="pac">pac (Paquete)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1.5">
              <button 
                type="button"
                onClick={() => setShowProductModal(false)}
                className="flex-1 py-2.5 bg-[#181D2B] rounded-lg text-xs font-semibold text-[#8A93A8] hover:text-white cursor-pointer hover:bg-[#1F2638] active:scale-95 transition-all text-center"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleAddProduct}
                className="flex-1 py-2.5 rounded-lg text-xs font-bold text-ink cursor-pointer active:scale-95 transition-all text-center"
                style={{ backgroundColor: colorPrincipal, color: '#06080C' }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD VENDEDOR */}
      {showVendedorModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111520] border border-white/10 rounded-2xl p-5.5 max-w-sm w-full space-y-4 shadow-2xl text-left">
            <div className="font-display font-bold text-base text-white">Nuevo Integrante de Equipo</div>
            
            <div className="space-y-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Nombre del Integrante</label>
                <input 
                  type="text" 
                  value={newVndName} 
                  onChange={(e) => setNewVndName(e.target.value)} 
                  className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  placeholder="Ej: Carlos Martínez"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Rol de Trabajo</label>
                  <select 
                    value={newVndRole} 
                    onChange={(e: any) => setNewVndRole(e.target.value)}
                    className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="repartidor">🛣 Repartidor</option>
                    <option value="cajero">🛒 Cajero local</option>
                    <option value="ambos">⚡ Ambos</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Zona territorial / Ruta</label>
                  <input 
                    type="text" 
                    value={newVndRuta} 
                    onChange={(e) => setNewVndRuta(e.target.value)} 
                    className="bg-[#181D2B] border border-white/5 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    placeholder="Ej: Zona Norte / Centro"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1.5">
              <button 
                type="button"
                onClick={() => setShowVendedorModal(false)}
                className="flex-1 py-2.5 bg-[#181D2B] rounded-lg text-xs font-semibold text-[#8A93A8] hover:text-white cursor-pointer hover:bg-[#1F2638] active:scale-95 transition-all text-center"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleAddVendedor}
                className="flex-1 py-2.5 rounded-lg text-xs font-bold text-ink cursor-pointer active:scale-95 transition-all text-center"
                style={{ backgroundColor: colorPrincipal, color: '#06080C' }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
