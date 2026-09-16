import React, { useState } from 'react';
import { ROLE_VIEWS, RoleId } from '../roles';

interface RoleScopeNoticeProps {
  role: RoleId;
  /** Solo se muestra cuando el dueño está probando la pantalla de alguien más. */
  visible?: boolean;
}

/**
 * Aviso que le recuerda al dueño qué alcance tiene la pantalla que está viendo:
 * qué ve la persona de ese rol y, sobre todo, qué NO ve.
 * Se descarta por sesión para no estorbar en cada entrada.
 */
export const RoleScopeNotice: React.FC<RoleScopeNoticeProps> = ({ role, visible = true }) => {
  const info = ROLE_VIEWS[role];
  const storageKey = `rp_role_notice_${role}`;

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });
  const [expanded, setExpanded] = useState(false);

  if (!visible || dismissed) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* sin almacenamiento: se oculta solo en esta vista */
    }
    setDismissed(true);
  };

  const esDueno = role === 'dueno';

  return (
    <div
      className="mx-4.5 mt-3 rounded-xl border p-3 text-left shrink-0"
      style={{ borderColor: `${info.color}30`, backgroundColor: `${info.color}0D` }}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-base leading-none shrink-0 mt-0.5">{esDueno ? '🔒' : '👁'}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-white leading-snug">
            {esDueno
              ? 'Esta pantalla solo la ves tú (dueño)'
              : `Así ve la app tu ${info.nombre.toLowerCase()}`}
          </div>
          <p className="text-[10px] text-[#8A93A8] leading-relaxed mt-1">
            {esDueno
              ? 'Tu repartidor y tu mostrador nunca entran aquí: no ven el balance, ni la cobranza total, ni la configuración del negocio.'
              : `Tu ${info.nombre.toLowerCase()} solo ve esta pantalla: ${info.alcance}. Entra directo aquí y no puede cambiarse a otra vista.`}
          </p>

          {expanded && (
            <div className="mt-2.5 space-y-2 border-t border-white/5 pt-2.5">
              <div>
                <div className="text-[9px] font-mono uppercase tracking-widest font-bold text-emerald-400/80 mb-1">
                  Sí ve
                </div>
                <ul className="space-y-0.5">
                  {info.ve.map((item) => (
                    <li key={item} className="text-[10px] text-[#8A93A8] leading-relaxed flex gap-1.5">
                      <span className="text-emerald-400/70 shrink-0">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[9px] font-mono uppercase tracking-widest font-bold text-red-400/70 mb-1">
                  No ve
                </div>
                <ul className="space-y-0.5">
                  {info.noVe.map((item) => (
                    <li key={item} className="text-[10px] text-[#8A93A8] leading-relaxed flex gap-1.5">
                      <span className="text-red-400/60 shrink-0">✕</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[10px] text-[#8A93A8]/80 leading-relaxed italic">{info.comoEntra}</p>
            </div>
          )}

          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] font-bold cursor-pointer transition-all hover:brightness-125"
              style={{ color: info.color }}
            >
              {expanded ? 'Ocultar detalle' : (esDueno ? 'Ver detalle de roles' : '¿Qué no ve?')}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-[10px] font-bold text-[#3E4A60] hover:text-[#8A93A8] cursor-pointer transition-all uppercase tracking-wider"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
