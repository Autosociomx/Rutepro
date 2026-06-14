import React, { useState } from 'react';

interface PaywallScreenProps {
  ownerUid: string;
  ownerEmail?: string;
  ownerNombre?: string;
  trialEndedAt?: number;
  triggerToast: (msg: string, type?: 'ok' | 'err') => void;
}

interface OxxoPayment {
  reference: string;
  expires_at: number;
  barcode_url?: string;
  amount: number;
}

export const PaywallScreen: React.FC<PaywallScreenProps> = ({
  ownerUid,
  ownerEmail = '',
  ownerNombre = 'Cliente',
  trialEndedAt,
  triggerToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [oxxo, setOxxo] = useState<OxxoPayment | null>(null);
  const [copied, setCopied] = useState(false);

  const handlePagar = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: ownerUid, email: ownerEmail, nombre: ownerNombre }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        triggerToast(data.error || 'Error al generar referencia. Intenta más tarde.', 'err');
        return;
      }
      setOxxo({
        reference: data.reference,
        expires_at: data.expires_at,
        barcode_url: data.barcode_url,
        amount: data.amount ?? 299,
      });
    } catch {
      triggerToast('Sin conexión. Verifica tu red e intenta de nuevo.', 'err');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!oxxo?.reference) return;
    navigator.clipboard.writeText(oxxo.reference).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    triggerToast('Referencia copiada al portapapeles');
  };

  const endedDate = trialEndedAt
    ? new Date(trialEndedAt).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-[#06080C] flex flex-col items-center justify-center p-4 font-sans">
      {/* Logo */}
      <div className="mb-6 text-center select-none">
        <div className="inline-flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-sm font-extrabold text-slate-950">R</span>
          </div>
          <span className="text-xl font-display font-extrabold text-white tracking-tight">RoutePro</span>
        </div>
        <p className="text-[9px] text-[#3E4A60] uppercase tracking-widest font-bold">Sistema de Distribución Elite</p>
      </div>

      <div className="w-full max-w-sm space-y-3">

        {/* ── OXXO reference (post-payment) ── */}
        {oxxo ? (
          <div className="bg-[#0B0E14] border border-white/8 rounded-2xl p-6 space-y-5">
            <div className="text-center space-y-1">
              <div className="text-3xl">🏪</div>
              <h3 className="font-display font-extrabold text-white text-lg">Paga en OXXO</h3>
              <p className="text-xs text-[#8A93A8] leading-relaxed">
                Muestra esta referencia en cualquier tienda OXXO.<br />
                Tu cuenta se activará en minutos después del pago.
              </p>
            </div>

            {oxxo.barcode_url && (
              <div className="flex justify-center bg-white rounded-lg p-3">
                <img src={oxxo.barcode_url} alt="Código de barras OXXO" className="h-16 w-auto" />
              </div>
            )}

            <div className="bg-[#111520] border border-white/5 rounded-xl p-4 space-y-1.5">
              <p className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider">Referencia de pago</p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-base text-white tracking-widest select-all">{oxxo.reference}</span>
                <button
                  onClick={handleCopy}
                  className="shrink-0 text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer hover:bg-amber-500/20 transition-all"
                >
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                'Acude a cualquier tienda OXXO',
                'Di que quieres pagar un servicio',
                'Proporciona la referencia o muestra el código',
                'Tu cuenta se activa automáticamente en minutos',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-[#8A93A8]">
                  <span className="w-5 h-5 shrink-0 mt-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 text-[9px] font-extrabold">
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-center space-y-0.5">
              <p className="text-xs font-bold text-amber-400">Total a pagar: $299 MXN</p>
              {oxxo.expires_at > 0 && (
                <p className="text-[9px] text-[#3E4A60]">
                  Válido hasta{' '}
                  {new Date(oxxo.expires_at * 1000).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>

            <button
              onClick={() => setOxxo(null)}
              className="w-full py-2.5 text-[10px] text-[#3E4A60] hover:text-white border border-white/5 rounded-xl cursor-pointer transition-all"
            >
              ← Volver
            </button>
          </div>
        ) : (
          <>
            {/* ── Expired notice ── */}
            <div className="bg-[#0B0E14] border border-white/8 rounded-2xl p-6 text-center space-y-2">
              <div className="text-3xl">⏰</div>
              <h2 className="text-base font-display font-extrabold text-white">Tu período de prueba terminó</h2>
              {endedDate && (
                <p className="text-xs text-[#8A93A8]">Venció el {endedDate}</p>
              )}
              <p className="text-[11px] text-[#8A93A8] leading-relaxed">
                Activa tu plan para seguir usando RoutePro y conservar todos tus datos.
              </p>
            </div>

            {/* ── Plan card ── */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[9px] font-mono text-amber-500/60 uppercase tracking-widest font-bold">Plan Mensual</p>
                  <p className="text-3xl font-display font-extrabold text-white leading-tight">
                    $299{' '}
                    <span className="text-sm text-[#8A93A8] font-normal">MXN/mes</span>
                  </p>
                </div>
                <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
                  Todo incluido
                </span>
              </div>

              <ul className="space-y-2">
                {[
                  'Ventas y rutas ilimitadas',
                  'Panel admin en tiempo real',
                  'Reportes diarios por correo',
                  'Sincronización offline',
                  'Repartidores y mostrador',
                  'Mapas de ruta con GPS',
                ].map((b) => (
                  <li key={b} className="flex items-center gap-2 text-xs text-[#8A93A8]">
                    <span className="text-amber-500 text-[10px] font-bold">✓</span>
                    {b}
                  </li>
                ))}
              </ul>

              <button
                onClick={handlePagar}
                disabled={loading}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-97 disabled:opacity-60 text-[#06080C] font-extrabold text-sm rounded-xl cursor-pointer transition-all text-center"
              >
                {loading ? '⏳ Generando referencia...' : 'Pagar en OXXO — $299 MXN'}
              </button>

              <p className="text-[9px] text-[#3E4A60] text-center">
                Pago seguro vía OXXO · sin tarjeta requerida
              </p>
            </div>

            <p className="text-[9px] text-[#1E2535] text-center">
              ¿Problemas para pagar? Escríbenos a <span className="text-[#3E4A60]">hola@rutepro.mx</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
};
