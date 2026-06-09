import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Coins, 
  HelpCircle, 
  TrendingUp, 
  Users, 
  ArrowLeft, 
  Sparkles, 
  Share2, 
  FileText, 
  CheckCircle,
  PiggyBank,
  MapPin,
  Cpu,
  Globe,
  Milestone
} from 'lucide-react';

interface AffiliateScreenProps {
  cfg: {
    nombre: string;
    letra: string;
    subtitulo: string;
    color_principal: string;
    productos: any[];
    vendedores: any[];
    logo_url?: string;
  };
  onGoBack: () => void;
  triggerToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const AffiliateScreen: React.FC<AffiliateScreenProps> = ({ cfg, onGoBack, triggerToast }) => {
  // Navigation tabs inside the Affiliate Screen
  const [activeSubTab, setActiveSubTab] = useState<'comercializacion' | 'escalera' | 'calculadora' | 'cartera' | 'fundador'>('comercializacion');
  
  // Interactive Affiliate Calculator State (Represents Consolidated Team Sales)
  const [recommendedClients, setRecommendedClients] = useState<number>(5);
  const [affiliateName, setAffiliateName] = useState('MIGUEL_TEPIC');
  const [selectedPlanForLink, setSelectedPlanForLink] = useState<'inicial' | 'crecimiento' | 'corporativo'>('crecimiento');
  
  // SPEI / Wallet Bank destination state
  const [partnerCLABE, setPartnerCLABE] = useState('');
  const [partnerBank, setPartnerBank] = useState('BBVA Bancomer');
  const [isCLABESaved, setIsCLABESaved] = useState(false);

  // Owner Corporate bank details state
  const [ownerCLABE, setOwnerCLABE] = useState('');
  const [ownerBank, setOwnerBank] = useState('Citibanamex');
  const [isOwnerCLABESaved, setIsOwnerCLABESaved] = useState(false);

  // Active step for interactive cash flow visualization
  const [activeFlowStep, setActiveFlowStep] = useState<number>(1);

  // Custom generated affiliate link state
  const generatedRefLink = `https://mercadovivo.connectx.mx/join?ref=${affiliateName.trim().toUpperCase() || 'PARTNER'}&plan=${selectedPlanForLink}`;

  // Simulated list of referrals representing active licenses under this partner key with updated corporate plans
  const registeredReferrals = [
    {
      id: 'ref-1',
      negocio: 'Tortillería El Maizal de Tepic',
      propietario: 'Don Crescencio Gómez',
      talla: 'Plan Crecimiento (Hasta 3 Rutas)',
      fecha: '2026-06-02',
      instalacionTotal: 4000,
      comisionAcumulada: 600, // 15% of $4,000 setup
      statusInstalacion: 'Activo', // Color alert mapping
      statusPago: 'Transferido', // SPEI transfer completed
      referenciaSPEI: 'SPEI-82739420-BBVA',
    },
    {
      id: 'ref-2',
      negocio: 'Panificadora La Espiga Ruiz',
      propietario: 'Lic. Martha Delgado',
      talla: 'Plan Inicial (1 Ruta)',
      fecha: '2026-06-05',
      instalacionTotal: 2000,
      comisionAcumulada: 300, // 15% of $2,000 setup
      statusInstalacion: 'En Configuración',
      statusPago: 'Pendiente', // Waiting setup confirmation
      referenciaSPEI: 'Validando Depósito Inicial',
    }
  ];

  // Value Ladder Definitions - Officially denominated "Esquemas de Distribución y Valor"
  const valueLadderPlans = {
    inicial: {
      nombre: 'Plan Inicial (1 Ruta)',
      instalacion: 2000,
      mensualidad: 250, // Proportional
      anualidad: 3000,
      totalPrimerAno: 5000,
      comisionAfiliado: 300, // 15% direct reward
      limite: '1 Repartidor / 1 Ruta activa',
      desc: 'Ideado para tortillerías o panaderías locales pequeñas que inician su digitalización con un solo vehículo repartidor mediante un desembolso mínimo.'
    },
    crecimiento: {
      nombre: 'Plan Crecimiento (Hasta 3 Rutas)',
      instalacion: 4000,
      mensualidad: 500, // Proportional
      anualidad: 6000,
      totalPrimerAno: 10000,
      comisionAfiliado: 600, // 15% direct reward
      limite: 'Hasta 3 Repartidores en campo',
      desc: 'La opción empresarial predilecta para negocios locales en crecimiento (bebidas, botanas, carnes) con unidades coordinando distribución.'
    },
    corporativo: {
      nombre: 'Plan Corporativo (4 a 10 Rutas)',
      instalacion: 8000,
      mensualidad: 1000, // Proportional
      anualidad: 12000,
      totalPrimerAno: 20000,
      comisionAfiliado: 1200, // 15% direct reward
      limite: '4 a 10 Repartidores simultáneos',
      desc: 'Solución de alto nivel corporativo para bodegas mayoristas de abarrotes o distribuidoras de agua que requieren ruteo ilimitado.'
    }
  };

  const [selectedLadderPlan, setSelectedLadderPlan] = useState<'inicial' | 'crecimiento' | 'corporativo'>('crecimiento');

  // Math for Affiliate Earnings (Team Sales Model instead of a flat $3,000 MXN per individual client)
  // Direct reward is 15% of setup. Under a balanced mix, we estimate average direct reward is $450 pesos.
  const rawCommission = recommendedClients * 450;
  
  // Team Volume Multiplier to reward collective/organization growth
  const getAffiliateBonus = (clientsNum: number) => {
    if (clientsNum >= 25) return 20000; // Platino Team Bonus
    if (clientsNum >= 11) return 9000;  // Oro Team Bonus
    if (clientsNum >= 4) return 3500;   // Plata Team Bonus
    if (clientsNum >= 1) return 1000;   // Bronce Team Bonus
    return 0;
  };

  const bonusAmount = getAffiliateBonus(recommendedClients);
  const totalEarnings = rawCommission + bonusAmount;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedRefLink);
    triggerToast('✓ Enlace de afiliado copiado al portapapeles');
  };

  return (
    <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] flex flex-col font-sans pb-12">
      {/* Header */}
      <div className="sticky top-0 z-50 h-14 bg-[#06080C]/94 backdrop-blur-md border-b border-amber-500/20 px-4.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 text-left min-w-0">
          <div className="w-8.5 h-8.5 rounded-lg bg-[#111520] border border-amber-500/20 flex items-center justify-center font-display font-medium text-amber-500 shrink-0">
            🤝
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-white truncate">ConnectX Partner Core</h1>
            <p className="text-[10px] text-amber-400 tracking-wider">Planificador de Alianzas e Ingresos</p>
          </div>
        </div>
        <button 
          onClick={onGoBack} 
          className="w-9 h-9 rounded-lg bg-[#111520]/80 border border-white/5 flex items-center justify-center text-[#8A93A8] hover:text-white transition-all text-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex items-center gap-1 bg-[#010306] border-b border-white/5 p-1.5 sticky top-14 z-40 overflow-x-auto no-scrollbar scroll-smooth">
        <button 
          onClick={() => setActiveSubTab('comercializacion')}
          className={`py-2 px-3 text-[9px] font-bold uppercase tracking-wider rounded-lg select-none cursor-pointer text-center flex items-center justify-center gap-1 shrink-0 transition-all ${activeSubTab === 'comercializacion' ? 'bg-[#111520] text-amber-300 border border-amber-500/10' : 'text-[#3E4A60] hover:text-[#8A93A8]'}`}
        >
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>⚖️ Alianzas</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('escalera')}
          className={`py-2 px-3 text-[9px] font-bold uppercase tracking-wider rounded-lg select-none cursor-pointer text-center flex items-center justify-center gap-1 shrink-0 transition-all ${activeSubTab === 'escalera' ? 'bg-[#111520] text-amber-300 border border-amber-500/10' : 'text-[#3E4A60] hover:text-[#8A93A8]'}`}
        >
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span>🪜 Esquemas</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('calculadora')}
          className={`py-2 px-3 text-[9px] font-bold uppercase tracking-wider rounded-lg select-none cursor-pointer text-center flex items-center justify-center gap-1 shrink-0 transition-all ${activeSubTab === 'calculadora' ? 'bg-[#111520] text-amber-300 border border-amber-500/10' : 'text-[#3E4A60] hover:text-[#8A93A8]'}`}
        >
          <Coins className="w-3.5 h-3.5 shrink-0" />
          <span>🧮 Simular</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('cartera')}
          className={`py-2 px-3 text-[9px] font-bold uppercase tracking-wider rounded-lg select-none cursor-pointer text-center flex items-center justify-center gap-1 shrink-0 transition-all ${activeSubTab === 'cartera' ? 'bg-[#111520] text-amber-300 border border-amber-500/10' : 'text-[#3E4A60] hover:text-[#8A93A8]'}`}
        >
          <PiggyBank className="w-3.5 h-3.5 shrink-0" />
          <span>💼 Cartera</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('fundador')}
          className={`py-2 px-3 text-[9px] font-bold uppercase tracking-wider rounded-lg select-none cursor-pointer text-center flex items-center justify-center gap-1 shrink-0 transition-all ${activeSubTab === 'fundador' ? 'bg-gradient-to-r from-purple-950/40 to-indigo-950/40 text-purple-300 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.15)] animate-pulse' : 'text-[#3E4A60] hover:text-purple-400'}`}
        >
          <span className="text-xs shrink-0">👑</span>
          <span>Fundador</span>
        </button>
      </div>

      {/* Content wrapper */}
      <div className="p-4.5 space-y-5 flex-1 max-w-2xl mx-auto w-full text-left">
        
        {/* PARLAMENTO DEL ECOSISTEMA GLOBAL (Google, Gemini AI, Google Maps, ConnectX) */}
        <div className="bg-gradient-to-br from-slate-900 via-[#111520] to-[#06080C] border border-amber-500/20 rounded-2xl p-4.5 space-y-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Ecosistema Integrado
            </span>
            <span className="text-[10px] text-[#8A93A8] font-semibold font-mono">100% Real n-Tier</span>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>🌎</span> Alianza Estratégica Internacional
            </h2>
            <p className="text-[11px] text-[#8A93A8] leading-relaxed">
              La digitalización exitosa no se hace de manera aislada. Formamos un ecosistema mutuo de alto valor que impulsa la economía del micro-empresario y genera ingresos constantes para ti y para los gigantes mundiales de tecnología:
            </p>
          </div>

          {/* Core Partners Pillars List with neat badge accents */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="bg-[#0B0E14]/70 border border-white/5 rounded-xl p-3 flex flex-col gap-1 hover:border-amber-500/25 transition-all">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[11px] font-bold text-white">Google Maps</span>
              </div>
              <p className="text-[9.5px] text-[#8A93A8] leading-normal">
                Asegura el posicionamiento satelital de los clientes finales y optimiza dinámicamente las rutas de entrega más cortas.
              </p>
            </div>

            <div className="bg-[#0B0E14]/70 border border-white/5 rounded-xl p-3 flex flex-col gap-1 hover:border-amber-500/25 transition-all">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] font-bold text-white">Gemini AI</span>
              </div>
              <p className="text-[9.5px] text-[#8A93A8] leading-normal">
                Asistente inteligente local que interpreta hábitos de compra, audita las mermas registradas y sugiere rutas óptimas.
              </p>
            </div>

            <div className="bg-[#0B0E14]/70 border border-white/5 rounded-xl p-3 flex flex-col gap-1 hover:border-amber-500/25 transition-all">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold text-white">Google Cloud</span>
              </div>
              <p className="text-[9.5px] text-[#8A93A8] leading-normal">
                Servidores mundiales que garantizan que el sistema ConnectX ruede con un SLA de 99.9% y con base de datos en tiempo real.
              </p>
            </div>
          </div>

          <div className="text-[10px] text-amber-300 bg-amber-400/5 p-2.5 rounded-lg border border-amber-500/10 leading-normal text-center">
            <strong>¿Por qué es perfecto para Google y para ti?</strong> Porque cada licencia dada de alta consume infraestructura oficial de Google Cloud, posiciona más comercios locales en Google Maps y aumenta el volumen de consultas de IA, generando una <strong>repartición mutua y de total seguridad jurídica</strong>.
          </div>
        </div>

        {/* SUBTAB 1: MODELO DE COMERCIALIZACIÓN */}
        {activeSubTab === 'comercializacion' && (
          <div className="space-y-4 animate-fade-in">
            {/* Lead senior advisor message Card */}
            <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/0 border-l-4 border-amber-400 p-4 rounded-r-xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🗣️</span>
                <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">Concepto de Senior Manager</span>
              </div>
              <p className="text-[11px] text-[#EEF1F8]/90 leading-relaxed font-sans">
                "Como líderes de desarrollo de <strong className="text-amber-300">ConnectX</strong>, debemos aclararle esto a cada franquiciado o afiliado: <strong>no vendemos un link aislado, ni vendemos código estático</strong>. Ese es el gran error de la venta informal. Nosotros vendemos <strong>Licenciamiento de Acceso SaaS</strong> y <strong>Seguridad en la Nube</strong>. Un negocio que crece compra tranquilidad y control, no un archivo suelto."
              </p>
            </div>

            {/* Structured legal-commercial comparison */}
            <div className="text-xs font-bold text-[#3E4A60] uppercase tracking-wider font-mono">Diferenciación Clave de Negocio</div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Opción Incorrecta: Venta del Link */}
              <div className="bg-[#111520] border border-red-500/10 rounded-xl p-4 space-y-2.5 relative">
                <div className="absolute top-3 right-3 text-red-500 font-bold font-mono text-[9px] uppercase bg-red-950/20 px-2 py-0.5 rounded border border-red-500/20">
                  ⚠️ Error Común
                </div>
                <div className="text-xs font-bold text-red-400">La "Venta" del Link / Código</div>
                <p className="text-[11px] text-[#8A93A8] leading-relaxed">
                  Creer que se le entrega una copia del código o un link genérico al cliente y que ahí termina nuestra relación.
                </p>
                <div className="space-y-1.5 pt-1.5 text-[10px] text-red-200/80">
                  <div className="flex gap-2">
                    <span className="text-red-500 font-extrabold">✕</span>
                    <span>No capta ingresos recurrentes futuros.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-red-500 font-extrabold">✕</span>
                    <span>El cliente puede compartir tu link sin pagar más.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-red-500 font-extrabold">✕</span>
                    <span>No incluye base de datos aislada ni soporte dinámico.</span>
                  </div>
                </div>
              </div>

              {/* Opción Correcta: Acceso y Renta SaaS */}
              <div className="bg-[#111520] border border-emerald-500/25 rounded-xl p-4 space-y-2.5 relative">
                <div className="absolute top-3 right-3 text-emerald-400 font-bold font-mono text-[9px] uppercase bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-500/20">
                  🛡️ Modelo SaaS Real
                </div>
                <div className="text-xs font-bold text-emerald-400">Licencia de Acceso Autorizado (Anual)</div>
                <p className="text-[11px] text-[#8A93A8] leading-relaxed">
                  Comercializas el derecho de uso anual sincronizado para su marca, en su propio subdominio, respaldado por nuestros servidores.
                </p>
                <div className="space-y-1.5 pt-1.5 text-[10px] text-emerald-200/90">
                  <div className="flex gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Mantenimiento recurrente:</strong> Cobras cada año por soporte y almacenamiento de rutas.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Seguridad Hermética:</strong> Cada negocio tiene su tenant / base de datos propia.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Garantía de Franquicia:</strong> ConnectX se encarga de la infraestructura. Tu afiliado vende y cobra.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PNL Bullet point values section */}
            <div className="bg-[#0B0E14] border border-white/5 rounded-2xl p-4.5 space-y-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Estructura de la Propuesta (Programación Neurolingüística)</span>
              </h3>
              
              <div className="space-y-3.5 text-[11.5px] text-[#8A93A8] leading-relaxed">
                <div>
                  <strong className="text-[#EEF1F8] block">1. El Gancho (Configuración e Inicialización):</strong>
                  Enfoca los $8,000 pesos de instalación como una inversión única en la estructuración de su catálogo, mapeo satelital de zonas de reparto y capacitación de su personal. Esto les da sentido de propiedad.
                </div>
                <div>
                  <strong className="text-[#EEF1F8] block">2. La Estabilidad (Mantenimiento Anualizado):</strong>
                  Muestra la mensualidad adaptada a un plan de pago anual para que perciban que es extremadamente representativo y económico. "¿Qué son $6,000 al año para asegurar que tus choferes no pierdan un solo kilo de mercancía ni un billete cobrado?"
                </div>
                <div>
                  <strong className="text-[#EEF1F8] block">3. Cero Ficción:</strong>
                  Nosotros alojamos todo de manera transparente. El cliente final accede a su portal privado en la web de forma automática, sin requerir servidores locales.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: ESCALERA DE VALOR (ESQUEMAS DE DISTRIBUCIÓN) */}
        {activeSubTab === 'escalera' && (
          <div className="space-y-4.5 animate-fade-in">
            <div className="text-left">
              <span className="text-[10px] text-amber-500 font-mono font-bold tracking-widest block uppercase">
                Acuerdo de Licenciamiento ConnectX
              </span>
              <h2 className="text-sm font-bold text-white">Escalera de Valor de Distribución</h2>
              <p className="text-xs text-[#8A93A8] mt-1 leading-normal">
                Aquí fijamos firmemente las reglas de licenciamiento. El costo correspondiente se autogestiona según el esquema operativo del negocio en campo. El cliente paga un monto exacto sustentado en el beneficio de su logística.
              </p>
            </div>

            {/* Selector Buttons */}
            <div className="grid grid-cols-3 gap-2 bg-[#0B0E14] p-1.5 rounded-xl border border-white/5">
              {(['inicial', 'crecimiento', 'corporativo'] as const).map((pKey) => {
                let shortLabel = "Inicial";
                if (pKey === 'crecimiento') shortLabel = "Crecimiento";
                if (pKey === 'corporativo') shortLabel = "Corporativo";
                return (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => setSelectedLadderPlan(pKey)}
                    className={`py-2 px-1 text-[10px] font-bold rounded-lg cursor-pointer transition-all ${selectedLadderPlan === pKey ? 'bg-amber-500 text-[#0B0E14]' : 'text-[#8A93A8] hover:text-[#EEF1F8]'}`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Active Plan Detail Dashboard */}
            <div className="bg-[#111520] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-widest bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    Segmento de Licenciamiento
                  </span>
                  <h3 className="text-base font-bold text-white mt-1.5">{valueLadderPlans[selectedLadderPlan].nombre}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#3E4A60] uppercase block font-bold font-mono">Bono Directo</span>
                  <span className="text-xs font-bold text-[#00C896]">Ganas: ${valueLadderPlans[selectedLadderPlan].comisionAfiliado} MXN</span>
                </div>
              </div>

              <p className="text-[11px] text-[#8A93A8] leading-relaxed">
                {valueLadderPlans[selectedLadderPlan].desc}
              </p>

              <div className="h-[1px] bg-white/5" />

              {/* Ladder pricing metrics breakdown */}
              <div className="grid grid-cols-2 gap-3.5 pt-1 select-none">
                <div className="bg-[#0B0E14] border border-white/5 rounded-xl p-3 text-left">
                  <span className="text-[9px] text-[#3E4A60] font-bold uppercase tracking-wider block">1. Pago Inicial (Setup SaaS)</span>
                  <span className="text-lg font-bold text-amber-300 font-mono block mt-1">
                    ${valueLadderPlans[selectedLadderPlan].instalacion.toLocaleString('es-MX')} <span className="text-[9px] text-[#3E4A60] font-bold">MXN</span>
                  </span>
                  <span className="text-[8.5px] text-[#8A93A8] mt-1 block">Configuración y Mapeo Inicial</span>
                </div>

                <div className="bg-[#0B0E14] border border-white/5 rounded-xl p-3 text-left">
                  <span className="text-[9px] text-[#3E4A60] font-bold uppercase tracking-wider block">2. Licencia Anual</span>
                  <span className="text-lg font-bold text-white font-mono block mt-1">
                    ${valueLadderPlans[selectedLadderPlan].anualidad.toLocaleString('es-MX')} <span className="text-[9px] text-[#3E4A60] font-bold">MXN/año</span>
                  </span>
                  <span className="text-[8.5px] text-[#8A93A8] mt-1 block">(Equivale a ${valueLadderPlans[selectedLadderPlan].mensualidad} al mes)</span>
                </div>
              </div>

              {/* Sum Card */}
              <div className="bg-amber-400/5 border border-amber-400/10 rounded-xl p-3.5 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[#8A93A8] font-semibold block">Inversión Total Primer Año</span>
                  <span className="text-[9px] text-amber-300">Incluye soporte, capacitaciones y nube continua</span>
                </div>
                <div className="text-right font-mono font-bold text-amber-300 text-sm">
                  ${valueLadderPlans[selectedLadderPlan].totalPrimerAno.toLocaleString('es-MX')} MXN
                </div>
              </div>

              {/* Limits and inclusions panel */}
              <div className="pt-2">
                <div className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold mb-2">Características Incluidas</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-[#8A93A8]">
                  <div className="flex gap-1.5 items-center">
                    <CheckCircle className="w-3.5 h-3.5 text-[#00C896] shrink-0" />
                    <span>Rutas Soportadas: <strong>{valueLadderPlans[selectedLadderPlan].limite}</strong></span>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <CheckCircle className="w-3.5 h-3.5 text-[#00C896] shrink-0" />
                    <span>Funcionamiento offline garantizado en campo</span>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <CheckCircle className="w-3.5 h-3.5 text-[#00C896] shrink-0" />
                    <span>Sincronización en tiempo real con panel de administración</span>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <CheckCircle className="w-3.5 h-3.5 text-[#00C896] shrink-0" />
                    <span>Actualizaciones automáticas sin cargo adicional</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 3: CALCULADORA DE COMISIONES DEL AFILIADO */}
        {activeSubTab === 'calculadora' && (
          <div className="space-y-4.5 animate-fade-in">
            <div className="bg-[#111520] border border-white/5 rounded-2xl p-4.5 flex gap-3 text-left">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-white">Escalera de Valor: Ventas Colectivas por Equipo</h3>
                <p className="text-[11px] text-[#8A93A8] leading-relaxed mt-1">
                  ConnectX ha diseñado un plan de afiliación sustentable y cooperativo. En lugar de restar un margen excesivo por venta individual que penalice la infraestructura, premiamos la <strong>construcción de equipo y volumen regional</strong>. Obtienes un <strong>15% de comisión directa</strong> por cada setup inicial y desbloqueas bonos escalonados masivos a nivel grupal.
                </p>
              </div>
            </div>

            {/* Interactive Slider Widget */}
            <div className="bg-[#111520] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white">Licencias Activas en tu Equipo</span>
                <span className="text-lg font-mono font-bold text-amber-300">{recommendedClients}</span>
              </div>
              
              <input 
                type="range" 
                min="1" 
                max="30" 
                value={recommendedClients} 
                onChange={(e) => setRecommendedClients(parseInt(e.target.value))}
                className="w-full accent-amber-500 h-1 bg-[#181D2B] rounded-lg appearance-none cursor-pointer"
              />

              <div className="flex justify-between text-[9px] text-[#3E4A60] font-mono">
                <span>1 LICENCIA</span>
                <span>15 LICENCIAS</span>
                <span>30 LICENCIAS</span>
              </div>

              <div className="h-[1px] bg-white/5" />

              {/* Earnings Breakdown */}
              <div className="grid grid-cols-2 gap-3 pb-1.5 text-left">
                <div className="bg-[#0B0E14] border border-white/5 p-3 rounded-xl">
                  <span className="text-[9px] text-[#3E4A60] font-bold block uppercase bg-slate-900 px-1.5 py-0.5 rounded w-max">Honorario Directo</span>
                  <span className="text-base font-bold text-white font-mono block mt-1.5">
                    ${rawCommission.toLocaleString('es-MX')} MXN
                  </span>
                  <span className="text-[8px] text-[#8A93A8] mt-1 block">(${recommendedClients} x $450 base promedio de 15%)</span>
                </div>

                <div className="bg-[#0B0E14] border border-white/5 p-3 rounded-xl relative overflow-hidden">
                  <span className="text-[9px] text-amber-400 font-bold block uppercase bg-amber-400/10 px-1.5 py-0.5 rounded w-max border border-amber-500/10">
                    Bono del Equipo
                  </span>
                  <span className="text-base font-bold text-[#00C896] font-mono block mt-1.5">
                    +${bonusAmount.toLocaleString('es-MX')} MXN
                  </span>
                  <span className="text-[8px] text-[#8A93A8] mt-1 block">
                    {recommendedClients >= 25 ? 'Bono Master de Equipo (+25)' : recommendedClients >= 11 ? 'Bono Oro de Equipo (+11)' : recommendedClients >= 4 ? 'Bono Plata de Equipo (+4)' : 'Bono Bronce de Equipo (+1)'}
                  </span>
                </div>
              </div>

              {/* Total final yield callout */}
              <div className="bg-gradient-to-r from-emerald-500/15 to-indigo-500/5 border border-emerald-500/30 rounded-xl p-4 flex justify-between items-center text-left">
                <div className="flex items-center gap-2.5">
                  <PiggyBank className="w-5 h-5 text-emerald-400" />
                  <div>
                    <span className="text-white text-xs font-bold block">Retorno Mutuo de Equipo</span>
                    <span className="text-[9px] text-[#8A93A8]">Suma de honorario de base e incentivos de volumen activo</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-mono font-black text-emerald-400">
                    ${totalEarnings.toLocaleString('es-MX')} MXN
                  </span>
                </div>
              </div>
            </div>

            {/* Link generation tool representing "selling link / links access" */}
            <div className="bg-[#111520] border border-white/5 rounded-2xl p-5 space-y-3.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 text-left">
                <Share2 className="w-4 h-4 text-amber-400" />
                <span>Simulador de Enlace Patrocinado Empresarial</span>
              </div>
              
              <p className="text-[10px] text-[#8A93A8] leading-relaxed text-left">
                Asigna un código único a tu enlace. Cuando un comerciante local se registre con esta URL, el sistema registrará la licencia en la infraestructura unificada asignándole el beneficio correspondiente.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Tu ID / Código Socio</label>
                  <input 
                    type="text" 
                    value={affiliateName} 
                    onChange={(e) => setAffiliateName(e.target.value.replace(/\s+/g, ''))}
                    className="bg-[#0B0E14] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white uppercase focus:outline-none focus:border-amber-500 font-mono"
                    placeholder="MIGUEL3000"
                  />
                </div>
                
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Plan Recomendado</label>
                  <select 
                    value={selectedPlanForLink}
                    onChange={(e) => setSelectedPlanForLink(e.target.value as any)}
                    className="bg-[#0B0E14] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono cursor-pointer"
                  >
                    <option value="inicial">Inicial ($2,000 MXN Setup)</option>
                    <option value="crecimiento">Crecimiento ($4,000 MXN Setup)</option>
                    <option value="corporativo">Corporativo ($8,000 MXN Setup)</option>
                  </select>
                </div>
              </div>

              {/* URL Display */}
              <div className="flex bg-[#0B0E14] border border-white/5 rounded-lg p-1.5 items-center justify-between text-[11px] font-mono gap-2 overflow-hidden">
                <span className="text-amber-300 text-left truncate flex-1 pl-1">
                  {generatedRefLink}
                </span>
                <button 
                  onClick={handleCopyLink}
                  className="px-3 py-1 bg-amber-500 text-[#0B0E14] text-[9px] font-bold rounded hover:brightness-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  Copiar Link
                </button>
              </div>
            </div>
          </div>
        )}


        {/* SUBTAB 4: MI CARTERA, ORIGEN DE FONDOS Y HISTORIAL DE RETIRO */}
        {activeSubTab === 'cartera' && (
          <div className="space-y-4.5 animate-fade-in">
            {/* Financial explanation card */}
            <div className="bg-[#111520] border border-amber-500/15 rounded-2xl p-4.5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">🪙</span>
                <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-widest">¿De dónde viene el dinero?</span>
              </div>
              
              <div className="text-[11.5px] text-[#8A93A8] leading-relaxed space-y-2">
                <p>
                  El dinero de tus comisiones <strong>no proviene de un fondo ficticio</strong>. Se secuencia directamente de la <strong>Tasa Inicial de Instalación y Configuración</strong> que abona cada negocio en sus planes:
                </p>
                <ul className="space-y-1.5 pl-3 list-disc text-[11px]">
                  <li>Cuando un cliente paga su activación (ej. Plan Crecimiento de <strong>$4,000 MXN</strong>)...</li>
                  <li><strong>$600 MXN</strong> (15% de honorario directo) se reservan inmediatamente como tu comisión neta, acumulándose para los bonos de equipo.</li>
                  <li>Los <strong>$3,400 MXN</strong> restantes se destinan al aprovisionamiento de infraestructura de Google Cloud, ruteo geográfico avanzado de Google Maps y ganancia neta corporativa.</li>
                </ul>
              </div>
            </div>

            {/* Interactive Money Flow Simulator */}
            <div className="bg-[#111520] border border-purple-500/15 rounded-2xl p-4.5 space-y-4">
              <div className="flex flex-col gap-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔄</span>
                  <span className="text-[10px] font-mono font-bold text-purple-300 uppercase tracking-widest bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">PASO A PASO INTERACTIVO</span>
                </div>
                <h3 className="text-xs font-bold text-white mt-1">¿Cómo fluye el dinero del cliente hasta el dueño y afiliado?</h3>
                <p className="text-[10.5px] text-[#8A93A8] leading-relaxed">
                  Haz clic en cada paso para ver el viaje del capital: demostración, cobro por Stripe/Oxxo, depósito central, split automático de comisiones y pago SPEI.
                </p>
              </div>

              {/* Progress Stepper Selector */}
              <div className="grid grid-cols-5 gap-1 pt-1 select-none">
                {[1, 2, 3, 4, 5].map((step) => {
                  let stepTitle = "";
                  switch(step) {
                    case 1: stepTitle = "1. Venta"; break;
                    case 2: stepTitle = "2. Pago"; break;
                    case 3: stepTitle = "3. Destino"; break;
                    case 4: stepTitle = "4. Split"; break;
                    case 5: stepTitle = "5. SPEI"; break;
                  }
                  const isActive = activeFlowStep === step;
                  const isDone = activeFlowStep > step;
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setActiveFlowStep(step)}
                      className={`py-2 px-0.5 rounded-lg text-center font-bold text-[8.5px] uppercase tracking-wider transition-all cursor-pointer border ${
                        isActive 
                        ? 'bg-purple-500 text-white border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.3)] font-black'
                        : isDone 
                          ? 'bg-purple-950/20 text-purple-300 border-purple-500/30 font-medium'
                          : 'bg-[#0B0E14] text-[#3E4A60] border-white/5 hover:text-[#8A93A8]'
                      }`}
                    >
                      {stepTitle}
                    </button>
                  );
                })}
              </div>

              {/* Step Detail Card */}
              <div className="bg-[#0B0E14] border border-white/5 rounded-xl p-4 space-y-3.5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
                
                {activeFlowStep === 1 && (
                  <div className="space-y-3 text-left">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                      <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-300 flex items-center justify-center text-[10px] font-mono">1</span>
                      <span>Labor de Venta, Demostración y Enlace Patrocinado</span>
                    </div>
                    <div className="border border-white/5 bg-white/2 rounded-lg p-2.5 space-y-2 text-[10.5px] text-[#8A93A8] leading-relaxed">
                      <p>
                        <strong>El Afiliado de ConnectX</strong> contacta al cliente potencial (tortillería, carnicería, panificadora) y le realiza una <strong>Demostración en vivo</strong> de la app rute Pro, mostrando el ruteo avanzado con Google Maps y la auditoría automática con Gemini AI.
                      </p>
                      <p>
                        Una vez convencido, el cliente ingresa y se registra mediante el <strong>enlace de afiliado único</strong> (ej. <code className="text-amber-300 bg-white/5 px-1 py-0.5 rounded">join?ref=MIGUEL_TEPIC</code>). De esta manera, el sistema asocia de forma permanente en la base de datos de Google Cloud al cliente con dicho afiliado.
                      </p>
                    </div>
                    <div className="flex justify-between items-center bg-purple-500/5 border border-purple-500/10 p-2 rounded-lg text-[9px] text-[#3E4A60] font-mono">
                      <span>ACCION</span>
                      <span className="text-purple-400 font-bold">CLIENTE ASOCIADO EN BASE DE DATOS</span>
                    </div>
                  </div>
                )}

                {activeFlowStep === 2 && (
                  <div className="space-y-3 text-left">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                      <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-300 flex items-center justify-center text-[10px] font-mono">2</span>
                      <span>El Cliente realiza el Pago (Stripe o Efectivo Oxxo)</span>
                    </div>
                    <div className="border border-white/5 bg-white/2 rounded-lg p-2.5 space-y-2 text-[10.5px] text-[#8A93A8] leading-relaxed">
                      <p>
                        El sistema emite la orden de activación según el esquema del contrato (ejemplo: <strong>Plan Crecimiento por $4,000 MXN de Setup Inicial</strong>). El cliente puede abonarlo por dos métodos seguros:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-[10px]">
                        <li>
                          <strong className="text-white">Tarjeta de Crédito / Débito (Stripe):</strong> El cliente introduce sus datos bancarios desde la web y el pago se acredita <strong>al instante</strong>.
                        </li>
                        <li>
                          <strong className="text-white">Pago en Efectivo (Sucursales Oxxo):</strong> Se genera un código de barras de Stripe/STP. El cliente va al Oxxo, paga en caja y el webhook procesa la confirmación en menos de 1 a 2 horas hábiles.
                        </li>
                      </ul>
                    </div>
                    <div className="flex justify-between items-center bg-purple-500/5 border border-purple-500/10 p-2 rounded-lg text-[9px] text-[#3E4A60] font-mono">
                      <span>MÉTODO DE COBRO</span>
                      <span className="text-purple-400 font-bold">PASARELA STRIPE / DISPERSOR STP OXXO PAY</span>
                    </div>
                  </div>
                )}

                {activeFlowStep === 3 && (
                  <div className="space-y-3 text-left">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                      <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-300 flex items-center justify-center text-[10px] font-mono">3</span>
                      <span>¿A dónde entra primeramente ese dinero?</span>
                    </div>
                    <div className="border border-white/5 bg-white/2 rounded-lg p-2.5 space-y-2 text-[10.5px] text-[#8A93A8] leading-relaxed">
                      <p>
                        💼 <strong>Respuesta para ti como dueño de ConnectX y rute Pro:</strong>
                      </p>
                      <p>
                        El 100% de la cantidad del cobro inicial ($4,000.00 MXN) de Stripe u Oxxo entra <strong>directo a la Cuenta Banco General Concentradora de ConnectX y rute Pro (TI como dueño de la aplicación)</strong>.
                      </p>
                      <p>
                        <strong>El dinero NO va de forma directa del cliente al afiliado.</strong> Esto es un estándar obligatorio debido a:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-[10px]">
                        <li><strong>Contabilidad y Facturación:</strong> Tú como propietario de ConnectX necesitas conciliar los impuestos y emitir la factura fiscal mexicana completa por los $4,000.</li>
                        <li><strong>Reglas Antifraude de Stripe:</strong> Solo la cuenta comercial central (Stripe legal del propietario) puede acreditar cargos seguros, reduciendo de manera unánime el riesgo de contracargos.</li>
                      </ul>
                    </div>
                    <div className="flex justify-between items-center bg-purple-500/5 border border-purple-500/10 p-2 rounded-lg text-[9px] text-purple-300 font-mono">
                      <span>DESTINO GENERAL PRINCIPAL</span>
                      <span className="text-purple-400 font-bold">100% CUENTA BANCARIA CORPORATIVA DEL DUEÑO (TÚ)</span>
                    </div>
                  </div>
                )}

                {activeFlowStep === 4 && (
                  <div className="space-y-3 text-left">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                      <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-300 flex items-center justify-center text-[10px] font-mono">4</span>
                      <span>El Desglose Financiero y Descuento de Comisión (Split Engine)</span>
                    </div>
                    <div className="border border-white/5 bg-white/2 rounded-lg p-2.5 space-y-2 text-[10.5px] text-[#8A93A8] leading-relaxed">
                      <p>
                        Inmediatamente después de confirmarse la recepción de los $4,000 MXN en la pasarela corporativa, el <strong>Motor Automatizado de Conciliación</strong> realiza el desglose en sistema:
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2 text-[9.5px] mt-1 text-left">
                        <div className="bg-[#111520] p-2 rounded border border-amber-500/10">
                          <span className="text-[#3E4A60] font-mono block text-[8px] uppercase font-bold">COMISIÓN SOCIO (15%)</span>
                          <span className="text-amber-400 font-bold font-mono text-[11px]">$600.00 MXN</span>
                          <span className="text-[8px] block text-[#8A93A8] mt-0.5">Reservado para transferir al afiliado</span>
                        </div>
                        <div className="bg-[#111520] p-2 rounded border border-purple-500/10">
                          <span className="text-[#3E4A60] font-mono block text-[8px] uppercase font-bold">NETO PLENO DUEÑO</span>
                          <span className="text-purple-400 font-bold font-mono text-[11px]">$3,400.00 MXN</span>
                          <span className="text-[8px] block text-[#8A93A8] mt-0.5">Para TI como dueño, Google Cloud y ganancias</span>
                        </div>
                      </div>

                      <p className="mt-1 text-[10px]">
                        El sistema actualiza de forma instantánea el estatus de la cartera del afiliado en su panel a <span className="text-emerald-400 font-bold">Listo para Retiro</span>, vinculándola al ID de la transacción.
                      </p>
                    </div>
                    <div className="flex justify-between items-center bg-purple-500/5 border border-purple-500/10 p-2 rounded-lg text-[9px] text-[#3E4A60] font-mono">
                      <span>CÁLCULO</span>
                      <span className="text-purple-400 font-bold">RESERVADO NETO EN BASE DE DATOS</span>
                    </div>
                  </div>
                )}

                {activeFlowStep === 5 && (
                  <div className="space-y-3 text-left">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                      <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-300 flex items-center justify-center text-[10px] font-mono">5</span>
                      <span>La Dispersión SPEI Automatizada al Banco del Afiliado</span>
                    </div>
                    <div className="border border-white/5 bg-white/2 rounded-lg p-2.5 space-y-2 text-[10.5px] text-[#8A93A8] leading-relaxed">
                      <p>
                        Para consolidar el pago, el sistema de dispersión corporativa de ConnectX emite una <strong>transferencia interbancaria (SPEI)</strong> de forma automatizada (vía API STP, BBVA o Banorte) hacia la CLABE de 18 dígitos que guardó el afiliado.
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                        <li>La liquidación se consolida en un plazo máximo de <strong>24 horas hábiles</strong>.</li>
                        <li>El comisionista ve reflejado su honorario neto de **$600 MXN** (más bonificaciones acumuladas del trimestre) directamente en su celular de forma rápida e inmediata.</li>
                      </ul>
                    </div>
                    <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/15 p-2 rounded-lg text-[9px] text-[#00C896] font-mono">
                      <span>ESTADISTICA</span>
                      <span className="text-emerald-400 font-bold">SPEI COMPLETADO DESDE TU CUENTA BANCARIA DE DUEÑO</span>
                    </div>
                  </div>
                )}

                {/* Stepper Navigation */}
                <div className="flex items-center justify-between border-t border-white/5 pt-3 select-none">
                  <button 
                    type="button"
                    disabled={activeFlowStep === 1}
                    onClick={() => setActiveFlowStep(prev => Math.max(1, prev - 1))}
                    className="text-[10px] text-[#8A93A8] hover:text-white transition-all font-bold disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    ← Anterior
                  </button>
                  <span className="text-[9px] text-[#3E4A60] font-mono">Paso {activeFlowStep} de 5</span>
                  <button 
                    type="button"
                    disabled={activeFlowStep === 5}
                    onClick={() => setActiveFlowStep(prev => Math.min(5, prev + 1))}
                    className="text-[10px] text-[#8A93A8] hover:text-white transition-all font-bold disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            </div>

            {/* Quick balance widgets */}
            <div className="grid grid-cols-2 gap-3.5 select-none">
              <div className="bg-[#111520] border border-white/5 rounded-xl p-4">
                <span className="text-[9px] text-[#3E4A60] font-mono font-bold uppercase tracking-wider block">Saldo Disponible / Pendiente</span>
                <span className="text-xl font-bold text-amber-400 font-mono block mt-1.5">$300.00 MXN</span>
                <span className="text-[8.5px] text-[#8A93A8] mt-1 block">Asignado de "La Espiga Ruiz"</span>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/15 rounded-xl p-4">
                <span className="text-[9px] text-emerald-500 font-mono font-bold uppercase tracking-wider block">Honorarios Cobrados (Histórico)</span>
                <span className="text-xl font-bold text-[#00C896] font-mono block mt-1.5">$600.00 MXN</span>
                <span className="text-[8.5px] text-[#8A93A8] mt-1 block">Pagado vía SPEI a tu banco</span>
              </div>
            </div>

            {/* Withdraw Setup form representing "How does affiliate receive money" */}
            <div className="bg-[#111520] border border-white/5 rounded-2xl p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5 font-sans">
                  <span>🏦</span> Destino de Pagos (Transferencia SPEI)
                </h3>
                <span className="text-[9px] text-amber-400 font-mono uppercase bg-amber-400/5 px-2 py-0.5 rounded border border-amber-500/10">
                  México - 100% Seguro
                </span>
              </div>

              <p className="text-[10px] text-[#8A93A8] leading-relaxed">
                El afiliado recibe sus fondos de manera automática y directa en su cuenta bancaria mediante <strong>transferencia interbancaria (SPEI)</strong> dentro de las siguientes 24 horas hábiles a que el cliente activa su suscripción de ConnectX.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Banco Receptor</label>
                  <select 
                    value={partnerBank} 
                    onChange={(e) => setPartnerBank(e.target.value)}
                    disabled={isCLABESaved}
                    className="bg-[#0B0E14] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono cursor-pointer disabled:opacity-50"
                  >
                    <option value="BBVA Bancomer">BBVA Bancomer</option>
                    <option value="Santander">Santander</option>
                    <option value="Banorte">Banorte</option>
                    <option value="Citibanamex">Citibanamex</option>
                    <option value="Mercado Pago">Mercado Pago (STP)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">CLABE Interbancaria (18 dígitos)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      maxLength={18}
                      value={partnerCLABE}
                      disabled={isCLABESaved}
                      onChange={(e) => setPartnerCLABE(e.target.value.replace(/\D/g, ''))}
                      placeholder="012180012345678901"
                      className="bg-[#0B0E14] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono tracking-widest flex-1 disabled:opacity-50"
                    />
                    <button
                      onClick={() => {
                        if (!partnerCLABE || partnerCLABE.length < 18) {
                          triggerToast('La CLABE debe tener 18 dígitos numéricos', 'err');
                          return;
                        }
                        setIsCLABESaved(!isCLABESaved);
                        triggerToast(isCLABESaved ? 'Cuenta desvinculada' : '✓ Cuenta SPEI guardada con éxito', 'ok');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${isCLABESaved ? 'bg-red-950/40 text-red-400 border border-red-500/20' : 'bg-amber-500 text-[#0B0E14] hover:brightness-105'}`}
                    >
                      {isCLABESaved ? 'Cambiar' : 'Vincular'}
                    </button>
                  </div>
                </div>
              </div>
              
              {isCLABESaved && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 text-[10px] text-emerald-400 rounded-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Depósitos vinculados a {partnerBank} (CLABE terminación **{partnerCLABE.slice(-4)})</span>
                </div>
              )}
            </div>

            {/* List/Table of referrals representing "earnings per client and per commission" */}
            <div className="bg-[#111520] border border-white/5 rounded-2xl p-4.5 space-y-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>📋</span> Control de Clientes y Referidos Comisionados
              </h3>
              
              <div className="space-y-3">
                {registeredReferrals.map((ref) => (
                  <div key={ref.id} className="bg-[#0B0E14] border border-white/5 rounded-xl p-3 space-y-2 text-left">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-white">{ref.negocio}</h4>
                        <span className="text-[9px] text-[#8A93A8]">Atención: {ref.propietario} · Reg: {ref.fecha}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono ${ref.statusInstalacion === 'Activo' ? 'bg-emerald-500/10 text-[#00C896] border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
                        {ref.statusInstalacion}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 bg-white/2 py-1.5 px-2.5 rounded-lg text-[9.5px]">
                      <div>
                        <span className="text-[#3E4A60] block font-mono font-bold uppercase text-[8px]">Esquema de Flota</span>
                        <span className="text-white truncate block">{ref.talla.split(' ')[1]}</span>
                      </div>
                      <div className="border-l border-white/5 pl-2.5">
                        <span className="text-[#3E4A60] block font-mono font-bold uppercase text-[8px]">Pago Cliente</span>
                        <span className="text-white font-mono block">${ref.instalacionTotal.toLocaleString('es-MX')}</span>
                      </div>
                      <div className="border-l border-white/5 pl-2.5">
                        <span className="text-[#3E4A60] block font-mono font-bold uppercase text-[8px]">Bono Directo</span>
                        <span className="text-[#00C896] font-mono font-bold block">+${ref.comisionAcumulada.toLocaleString('es-MX')}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-0.5 text-[9.5px]">
                      <div className="flex items-center gap-1">
                        <span className="text-[#8A93A8]">Estado SPEI:</span>
                        <span className={`font-bold font-mono ${ref.statusPago === 'Transferido' ? 'text-emerald-400' : 'text-amber-500 animate-pulse'}`}>
                          {ref.statusPago === 'Transferido' ? '✓ Transferencia Realizada' : '⌛ En Validación de Setup'}
                        </span>
                      </div>
                      <span className="text-[9px] text-[#3E4A60] font-mono truncate max-w-[150px]">
                        Ref: {ref.referenciaSPEI}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 5: PANEL EXCLUSIVO DEL FUNDADOR / DUEÑO DE CONNECTX */}
        {activeSubTab === 'fundador' && (
          <div className="space-y-4.5 animate-fade-in text-left">
            {/* Header intro */}
            <div className="bg-gradient-to-r from-purple-900/40 via-purple-950/30 to-transparent border-l-4 border-purple-500 p-4.5 rounded-r-xl space-y-1.5 relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center gap-1.5">
                <span className="text-sm border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 rounded-full font-mono font-bold text-purple-300">👑 Dueño ConnectX</span>
                <span className="text-[10px] text-purple-400 font-mono tracking-widest font-bold">Consola Exclusiva del Fundador</span>
              </div>
              <h2 className="text-base font-bold text-white">Ecosistema Global de ConnectX, RoutePro y MercadoVivo</h2>
              <p className="text-xs text-[#8A93A8] leading-relaxed">
                Bienvenido, Fundador de la plataforma ConnectX y RoutePro. Como propietario intelectual y de código de esta marca, aquí puedes controlar y simular el origen real de tus ganancias, visualizar cómo se genera y distribuye el capital, y configurar la cuenta bancaria corporativa recaudadora de la plataforma.
              </p>
            </div>

            {/* FLOWCHART - WHERE IS THE MONEY ORIGINATED? */}
            <div className="bg-[#111520] border border-purple-500/20 rounded-2xl p-4.5 space-y-3.5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="text-purple-400">⚡</span>
                  <span>Ingeniería Financiera: ¿Dónde se origina y genera el dinero?</span>
                </h3>
                <span className="text-[9px] text-purple-300 font-mono bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  Modelo SaaS Multi-Tier (100% Real)
                </span>
              </div>

              <div className="space-y-4.5 text-[11px] leading-relaxed relative">
                <div className="relative pl-6 border-l-2 border-dashed border-purple-500/20 space-y-4.5 text-left">
                  <div className="relative">
                    <span className="absolute -left-[31px] top-0.5 w-[14px] h-[14px] rounded-full bg-purple-500 border border-[#06080C] text-[9px] font-bold text-white flex items-center justify-center">1</span>
                    <strong className="text-white block text-xs">Punto de Origen: La Activación del Cliente Local (Setup Inicial)</strong>
                    <p className="text-[#8A93A8] mt-0.5">
                      Un comercio local (como Tortillería o Panificadora) contrata el licenciamiento ConnectX y paga su Tasa de Instalación de acuerdo al esquema activo (ejemplo: <strong>Plan Crecimiento de $4,000 MXN</strong>). Este capital inicial se genera directamente del valor de digitalización de sus choferes.
                    </p>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[31px] top-0.5 w-[14px] h-[14px] rounded-full bg-amber-500 border border-[#06080C] text-[9px] font-bold text-[#0B0E14] flex items-center justify-center">2</span>
                    <strong className="text-amber-300 block text-xs">Alineación de Afiliados: El Desvío de Honorario Directo (15%)</strong>
                    <p className="text-[#8A93A8] mt-0.5">
                      Para reclutar un equipo masivo de ventas regional, del Setup de activación cobrado se reserva el <strong>15% de comisión estándar ($600 MXN en el plan crecimiento)</strong> para el socio que posicionó la marca localmente. Esto te da distribución infinita sin costos fijos de nómina.
                    </p>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[31px] top-0.5 w-[14px] h-[14px] rounded-full bg-purple-400 border border-[#06080C] text-[9px] font-bold text-[#0B0E14] flex items-center justify-center">3</span>
                    <strong className="text-purple-300 block text-xs">Tu Margen Neto de Código y Plataforma (85% o setup unificado)</strong>
                    <p className="text-[#8A93A8] mt-0.5">
                      El remanente restante de la activación (ejemplo <strong>$3,400 MXN</strong> en el Plan Crecimiento) ingresa íntegro y directo para TI como dueño por construir e integrar la tecnología. Este capital es depositado automáticamente en tu cuenta general.
                    </p>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[31px] top-0.5 w-[14px] h-[14px] rounded-full bg-emerald-500 border border-[#06080C] text-[9px] font-bold text-white flex items-center justify-center">4</span>
                    <strong className="text-[#00C896] block text-xs">El Negocio Real: La Renovación Anual Multicliente (100% Margen para TI)</strong>
                    <p className="text-[#8A93A8] mt-0.5">
                      Cada año sucesivo al inicio, el cliente abona su Licencia de Nube Anualizada. <strong>En las anualidades ya no se descuenta comisión de socio afiliado</strong>, por lo que todo este ingreso recurrente SaaS de mantenimiento te pertenece al 100%, autofinanciando Google Cloud y Google Maps.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* REALTIME PLATFORM DASHBOARD */}
            <div className="bg-[#111520] border border-white/5 rounded-2xl p-4.5 space-y-3.5">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                <span>📊</span> Balance Financiero Global - Console ConnectX
              </h3>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-[#0B0E14]/70 border border-white/5 p-3 rounded-xl text-left select-none">
                  <span className="text-[8px] text-[#3E4A60] font-mono font-bold uppercase block">Recaudado Bruto (Setup)</span>
                  <span className="text-base font-bold text-white font-mono block mt-1">$6,000.00 MXN</span>
                  <span className="text-[7.5px] text-[#8A93A8] mt-0.5">1 Inicial ($2k) + 1 Crecimiento ($4k)</span>
                </div>

                <div className="bg-[#0B0E14]/70 border border-white/5 p-3 rounded-xl text-left select-none">
                  <span className="text-[8px] text-amber-500 font-mono font-bold uppercase block">Deducido Afiliados</span>
                  <span className="text-base font-bold text-amber-400 font-mono block mt-1">-$900.00 MXN</span>
                  <span className="text-[7.5px] text-[#8A93A8] mt-0.5">Suma de 15% sobre setups</span>
                </div>

                <div className="bg-purple-950/20 border border-purple-500/20 p-3 rounded-xl text-left col-span-2 lg:col-span-1 select-none">
                  <span className="text-[8px] text-purple-400 font-mono font-bold uppercase block">Tus Ganancias ConnectX</span>
                  <span className="text-base font-bold text-purple-300 font-mono block mt-1">+$5,100.00 MXN</span>
                  <span className="text-[7.5px] text-purple-400 mt-0.5 font-mono">85% Neto General Plataforma</span>
                </div>
              </div>

              {/* RE-ESTIMATED ARR BOARD */}
              <div className="bg-emerald-950/20 border border-emerald-500/15 rounded-xl p-3 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 text-lg">⚙️</span>
                  <div className="text-left">
                    <span className="text-white font-bold block text-xs">Ingreso Anual SaaS Estimado (ARR)</span>
                    <span className="text-[8.5px] text-[#8A93A8]">Inicial ($3.6k) + Crecimiento ($6k) en el siguiente año</span>
                  </div>
                </div>
                <div className="text-right font-mono font-bold text-[#00C896] text-sm shrink-0 pl-1">
                  $9,600.00 MXN/año
                </div>
              </div>
            </div>

            {/* SECURE OWNER COBRANZA CONFIGURATION */}
            <div className="bg-[#111520] border border-purple-500/20 rounded-2xl p-4.5 space-y-3.5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                  <span>🏦</span> Destino de Fondos Corporativos (CLABE Dueño)
                </h3>
                <span className="text-[9px] text-purple-300 font-mono bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/25">
                  STP & Stripe Gateway
                </span>
              </div>

              <p className="text-[10.5px] text-[#8A93A8] leading-relaxed">
                Aquí, como propietario absoluto de ConnectX y RoutePro, configuras la cuenta CLABE donde el procesador de pagos (STP interbancario o pasarela Stripe) dispersará instantáneamente tus ganancias netas recolectadas de cada licencia activa.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Banco Depositario General</label>
                  <select 
                    value={ownerBank} 
                    onChange={(e) => setOwnerBank(e.target.value)}
                    disabled={isOwnerCLABESaved}
                    className="bg-[#0B0E14] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono cursor-pointer disabled:opacity-50"
                  >
                    <option value="Citibanamex">Citibanamex Corporativo</option>
                    <option value="BBVA Bancomer">BBVA Bancomer Empresa</option>
                    <option value="Banorte">Banorte Fideicomiso</option>
                    <option value="Santander">Santander PyME</option>
                    <option value="STP">STP - Sistema de Transferencias y Pagos</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">CLABE Recaudadora (18 dígitos)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      maxLength={18}
                      value={ownerCLABE}
                      disabled={isOwnerCLABESaved}
                      onChange={(e) => setOwnerCLABE(e.target.value.replace(/\D/g, ''))}
                      placeholder="002180012345678901"
                      className="bg-[#0B0E14] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono tracking-widest flex-1 disabled:opacity-50"
                    />
                    <button
                      onClick={() => {
                        if (!ownerCLABE || ownerCLABE.length < 18) {
                          triggerToast('La CLABE Corporativa debe tener exactamente 18 dígitos', 'err');
                          return;
                        }
                        setIsOwnerCLABESaved(!isOwnerCLABESaved);
                        triggerToast(isOwnerCLABESaved ? 'Cuenta desvinculada' : '✓ Cuenta Corporativa ConnectX y RoutePro guardada con éxito.', 'ok');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${isOwnerCLABESaved ? 'bg-red-950/40 text-red-400 border border-red-500/20' : 'bg-purple-500 text-white hover:bg-purple-600'}`}
                    >
                      {isOwnerCLABESaved ? 'Modificar' : 'Vincular'}
                    </button>
                  </div>
                </div>
              </div>
              
              {isOwnerCLABESaved && (
                <div className="bg-purple-500/10 border border-purple-500/20 p-2.5 text-[10px] text-purple-300 rounded-lg flex items-center justify-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
                  <span className="text-left leading-normal">Liquidaciones de ConnectX y ruteos activas. Recibiendo transferencias directas en <strong>{ownerBank}</strong> (CLABE: *{ownerCLABE.slice(-4)})</span>
                </div>
              )}
            </div>

            {/* THE ECOSYSTEM PARLAMENTO VALUES */}
            <div className="bg-[#111520] border border-white/5 rounded-2xl p-4.5 space-y-3.5">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                <span>🦾</span> Alianza Tecnológica de Alto Valor (Google, AI, ConnectX)
              </h3>
              <p className="text-[10px] text-[#8A93A8] leading-relaxed">
                El dinero no es ficción regulatoria. El negocio crece porque tu código de ConnectX optimiza de forma real el costo operativo de las flotillas:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[9.5px]">
                <div className="bg-[#0B0E14] border border-white/5 rounded-lg p-2.5 text-left">
                  <strong className="text-white block mb-0.5">🚀 Facturación Google Cloud</strong>
                  <span>Garantiza que la base de datos distribuida de rute Pro y MercadoVivo tenga SLA de 99.9% de uptime para todos tus clientes.</span>
                </div>

                <div className="bg-[#0B0E14] border border-white/5 rounded-lg p-2.5 text-left">
                  <strong className="text-white block mb-0.5">🧠 Reducción Inteligente Gemini AI</strong>
                  <span>Ayuda a predecir mermas y balanceos eficientemente para evitar fuga de capitales de tus clientes finales, respaldado con el modelo flash.</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
};
