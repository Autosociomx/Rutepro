/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerToast?: (msg: string, type?: 'ok' | 'err') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, triggerToast }) => {
  const { signIn, signUp, resetPassword, enterDemoMode, authError, clearAuthError } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'recovery'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setInfoMessage(null);

    if (!email.trim()) {
      triggerToast?.('Ingresa un correo electrónico válido.', 'err');
      return;
    }

    if (mode === 'recovery') {
      setLoading(true);
      const { error } = await resetPassword(email);
      setLoading(false);
      if (error) {
        triggerToast?.(error.message || 'Error al solicitar recuperación', 'err');
      } else {
        setInfoMessage('✓ Se ha enviado el enlace de recuperación a tu correo electrónico.');
        triggerToast?.('Enlace de recuperación enviado', 'ok');
      }
      return;
    }

    if (!password) {
      triggerToast?.('Ingresa tu contraseña.', 'err');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        triggerToast?.('La contraseña debe tener al menos 6 caracteres.', 'err');
        return;
      }
      if (password !== confirmPassword) {
        triggerToast?.('Las contraseñas no coinciden.', 'err');
        return;
      }

      setLoading(true);
      const { error } = await signUp(email, password);
      setLoading(false);
      if (error) {
        triggerToast?.(error.message || 'Error al registrar usuario', 'err');
      } else {
        setInfoMessage('✓ Registro completado. Revisa tu correo si la confirmación está activa.');
        triggerToast?.('Usuario registrado con éxito', 'ok');
        setMode('login');
      }
      return;
    }

    // Default: Login
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      triggerToast?.(error.message || 'Error de credenciales', 'err');
    } else {
      triggerToast?.('✓ Sesión iniciada correctamente', 'ok');
      onClose();
    }
  };

  const handleStartDemo = () => {
    enterDemoMode();
    triggerToast?.('✓ Modo DEMO activado (Aislado de la base real)', 'ok');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111520] border border-white/10 rounded-2xl w-full max-w-md p-6 text-[#EEF1F8] shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center transition-colors"
          title="Cerrar"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl mx-auto mb-3 text-amber-400">
            {mode === 'recovery' ? '🔑' : mode === 'signup' ? '📝' : '🛡️'}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {mode === 'recovery'
              ? 'Recuperar Contraseña'
              : mode === 'signup'
              ? 'Crear Cuenta en RoutePro'
              : 'Acceso a RoutePro'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {mode === 'recovery'
              ? 'Ingresa tu correo para recibir instrucciones de restablecimiento.'
              : mode === 'signup'
              ? 'Regístrate para gestionar tu negocio y rutas.'
              : 'Inicia sesión con tu cuenta corporativa.'}
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2">
            <span>ℹ️</span>
            <div>
              <strong>Supabase no configurado en entorno.</strong> Puedes explorar libremente en{' '}
              <button onClick={handleStartDemo} className="underline font-bold text-amber-300 cursor-pointer">
                Modo DEMO Aislado
              </button>
              .
            </div>
          </div>
        )}

        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/30 text-xs text-red-300">
            {authError}
          </div>
        )}

        {infoMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-300">
            {infoMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu-correo@empresa.com"
              className="w-full bg-[#181D2B] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 placeholder-gray-600"
            />
          </div>

          {mode !== 'recovery' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">
                  Contraseña
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recovery');
                      setInfoMessage(null);
                    }}
                    className="text-[10px] text-amber-400/80 hover:text-amber-300 underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#181D2B] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 placeholder-gray-600"
              />
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block mb-1">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#181D2B] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 placeholder-gray-600"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#E8B04A] hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50"
          >
            {loading
              ? 'Procesando...'
              : mode === 'recovery'
              ? 'Enviar Enlace de Recuperación'
              : mode === 'signup'
              ? 'Crear Cuenta'
              : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-white/5 flex flex-col gap-2.5 text-center text-xs">
          {mode === 'login' ? (
            <div className="text-gray-400">
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setInfoMessage(null);
                }}
                className="text-amber-400 font-semibold hover:underline"
              >
                Crear una cuenta
              </button>
            </div>
          ) : (
            <div className="text-gray-400">
              ¿Ya tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setInfoMessage(null);
                }}
                className="text-amber-400 font-semibold hover:underline"
              >
                Iniciar sesión
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleStartDemo}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold rounded-xl border border-white/10 transition-colors"
          >
            ⚡ Probar en Modo DEMO Aislado
          </button>
        </div>
      </div>
    </div>
  );
};
