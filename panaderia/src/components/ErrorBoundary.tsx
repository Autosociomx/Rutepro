/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Red de seguridad: si una pantalla truena, React desmonta todo y el usuario
 * ve una pantalla negra sin explicación. Con esto ve un mensaje claro y dos
 * botones para salir del problema — que en una demostración frente a un
 * cliente vale más que el error en sí.
 */

import React from 'react';

interface Props {
  children: React.ReactNode;
  /** En la demostración, permite borrar los datos de muestra y empezar limpio. */
  onReiniciar?: () => void;
}

interface Estado {
  fallo: boolean;
  mensaje: string;
}

export class ErrorBoundary extends React.Component<Props, Estado> {
  constructor(props: Props) {
    super(props);
    this.state = { fallo: false, mensaje: '' };
  }

  static getDerivedStateFromError(error: unknown): Estado {
    return {
      fallo: true,
      mensaje: error instanceof Error ? error.message : String(error)
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[RutePro] Pantalla con error:', error, info);
  }

  render() {
    if (!this.state.fallo) return this.props.children;

    return (
      <div className="min-h-screen bg-[#06080C] text-[#EEF1F8] flex items-center justify-center p-7 font-sans">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">🥖</div>
          <div className="font-display font-extrabold text-lg">Esta pantalla no abrió</div>
          <p className="text-xs text-[#8A93A8] leading-relaxed">
            El programa siguió funcionando; sólo esta pantalla falló. Puedes regresar y seguir
            trabajando: nada de lo que ya registraste se perdió.
          </p>

          <div className="space-y-2 pt-1">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3.5 rounded-xl bg-[#E8B04A] text-[#0B0E14] font-extrabold text-sm cursor-pointer active:scale-97 transition-all"
            >
              Volver a empezar
            </button>
            {this.props.onReiniciar && (
              <button
                onClick={() => {
                  try { this.props.onReiniciar?.(); } catch (e) { console.warn(e); }
                  window.location.reload();
                }}
                className="w-full py-3 rounded-xl bg-[#181D2B] border border-white/5 text-[#8A93A8] font-bold text-xs cursor-pointer"
              >
                Reiniciar con los datos de muestra
              </button>
            )}
          </div>

          <details className="text-left pt-2">
            <summary className="text-[10px] text-[#3E4A60] cursor-pointer">Detalle técnico</summary>
            <pre className="text-[9px] text-[#3E4A60] whitespace-pre-wrap break-words mt-2">
              {this.state.mensaje}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
