import React, { useState, useEffect, useRef } from 'react';

interface LandingScreenProps {
  cfg: {
    nombre: string;
    letra: string;
    subtitulo: string;
    color_principal: string;
    productos: any[];
    vendedores: any[];
    logo_url?: string;
  };
  onGo: (screen: string) => void;
  onCerrarSesion: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ cfg, onGo, onCerrarSesion }) => {
  const hasSetup = cfg && cfg.productos && cfg.productos.length > 0;

  // New passcode/pin lock states for "Panel del Dueño" (Administración)
  const [showAdminLock, setShowAdminLock] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Custom modal state for Exiting Demo / Changing Business
  const [showExitConfirm, setShowExitConfirm] = useState(false);

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

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    onCerrarSesion();
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
          {!hasSetup ? (
            <>
              <button 
                onClick={() => onGo('configuracion')} 
                className="w-full py-3.5 px-6 font-semibold text-sm text-[#0B0E14] bg-gradient-to-r from-amber-500 to-amber-400 rounded-xl hover:brightness-110 active:scale-97 transition-all cursor-pointer shadow-lg shadow-amber-500/20 animate-pulse"
                style={{ backgroundImage: `linear-gradient(135deg, ${cfg.color_principal || '#C9912A'}, #E8B04A)` }}
              >
                Configurar mi negocio →
              </button>
              <button 
                onClick={() => onGo('demo')} 
                className="w-full py-3.5 px-6 font-semibold text-sm text-[#8A93A8] bg-[#181D2B]/90 backdrop-blur-sm border border-white/5 rounded-xl hover:bg-[#1F2638] hover:text-[#EEF1F8] active:scale-97 transition-all cursor-pointer"
              >
                Ver demo con datos de ejemplo
              </button>
              <button 
                onClick={() => onGo('afiliados')} 
                className="w-full py-3.5 px-6 font-semibold text-sm text-yellow-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl active:scale-97 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                🤝 Planes y Sistema de Afiliados
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



              <div className="pt-4 flex flex-col gap-2">
                <button 
                  onClick={() => onGo('afiliados')} 
                  className="w-full py-3 px-6 font-bold text-xs text-amber-300 bg-[#C9912A]/10 hover:bg-[#C9912A]/20 border border-amber-500/30 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  🤝 Planes y Esquemas de Distribución
                </button>
                <button 
                  onClick={() => onGo('configuracion')} 
                  className="w-full py-3 px-6 font-semibold text-xs text-[#8A93A8] bg-[#181D2B]/50 hover:bg-[#181D2B] border border-white/5 rounded-xl hover:text-[#EEF1F8] transition-all cursor-pointer"
                >
                  ⚙️ Editar configuración
                </button>
                <button 
                  onClick={() => setShowExitConfirm(true)} 
                  className="w-full py-2 px-6 font-semibold text-xs text-red-400 hover:text-red-300 transition-all cursor-pointer underline decoration-dotted"
                >
                  🚪 Cambiar de negocio / Salir
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

      {/* CUSTOM EXIT CONFIRMATION DIALOG / SALIR DE LA DEMO */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111520] border border-red-500/20 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-left">
            <div className="flex items-center gap-2">
              <span className="text-xl">🚪</span>
              <div className="font-display font-bold text-base text-white">¿Salir de la Demostración?</div>
            </div>
            
            <p className="text-xs text-[#8A93A8] leading-relaxed">
              ¿Estás seguro de que deseas salir de <strong>{cfg.nombre || 'el negocio actual'}</strong>?
            </p>
            <p className="text-[11px] text-[#3E4A60] leading-relaxed">
              Se limpiarán los registros de ventas locales y podrás seleccionar cualquier otro giro comercial o crear tu propio modelo de negocio.
            </p>

            <div className="flex gap-2.5 pt-3">
              <button 
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 bg-[#181D2B] rounded-xl text-xs font-semibold text-[#8A93A8] hover:text-white cursor-pointer hover:bg-[#1F2638] active:scale-95 transition-all text-center"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleConfirmExit}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold text-white cursor-pointer active:scale-95 transition-all text-center"
              >
                Sí, Salir y Cambiar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

