import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthScreenProps {
  onSuccess: () => void;
  onDemoMode: () => void;
  triggerToast: (msg: string, type?: 'ok' | 'err') => void;
  initialTab?: 'register' | 'login';
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess, onDemoMode, triggerToast, initialTab }) => {
  const [tab, setTab] = useState<'register' | 'login'>(initialTab || 'register');
  const [loading, setLoading] = useState(false);

  // Register fields
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [privacidad, setPrivacidad] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');

  const [esContador, setEsContador] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [fieldErr, setFieldErr] = useState<string>('');

  const clearErr = () => setFieldErr('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErr();

    if (!nombre.trim()) { setFieldErr('Ingresa tu nombre completo.'); return; }
    if (!email.trim()) { setFieldErr('Ingresa tu correo electrónico.'); return; }
    if (password.length < 6) { setFieldErr('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (password !== confirmPwd) { setFieldErr('Las contraseñas no coinciden.'); return; }
    if (!privacidad) { setFieldErr('Debes aceptar el Aviso de Privacidad para continuar.'); return; }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;
      const now = Date.now();

      const trialEndsAt = now + 14 * 24 * 60 * 60 * 1000; // 14 días

      await setDoc(doc(db, 'usuarios', uid), {
        uid,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        rol: esContador ? 'contador' : 'dueno',
        plan: 'trial',
        trial_ends_at: trialEndsAt,
        billing: { status: 'trial', trial_ends_at: trialEndsAt },
        negocios_gestionados: esContador ? [] : null,
        aviso_privacidad: true,
        aviso_privacidad_ts: now,
        created_at: now
      });

      triggerToast(`¡Bienvenido, ${nombre.trim().split(' ')[0]}! Cuenta creada.`);
      onSuccess();
    } catch (err: any) {
      const msg = mapFirebaseError(err.code);
      setFieldErr(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErr();
    if (!loginEmail.trim() || !loginPwd) { setFieldErr('Ingresa tu correo y contraseña.'); return; }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPwd);
      triggerToast('Sesión iniciada correctamente.');
      onSuccess();
    } catch (err: any) {
      setFieldErr(mapFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    onDemoMode();
  };

  const mapFirebaseError = (code: string): string => {
    console.error('[RoutePro Auth] Firebase error code:', code);
    const map: Record<string, string> = {
      'auth/email-already-in-use': 'Este correo ya tiene una cuenta. Inicia sesión.',
      'auth/invalid-email': 'El formato del correo no es válido.',
      'auth/weak-password': 'La contraseña es muy débil. Usa al menos 6 caracteres.',
      'auth/user-not-found': 'No existe cuenta con este correo.',
      'auth/wrong-password': 'Contraseña incorrecta.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
      'auth/network-request-failed': 'Sin conexión. Revisa tu red.',
      'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase. El administrador debe agregarlo en Firebase Console → Authentication → Authorized Domains.',
      'auth/operation-not-allowed': 'El registro con correo no está habilitado. Actívalo en Firebase Console → Authentication → Sign-in providers.',
      'auth/internal-error': 'Error interno de Firebase. Intenta de nuevo en unos segundos.',
      'auth/configuration-not-found': 'Configuración de Firebase incompleta. Contacta al soporte.',
    };
    return map[code] || `Error (${code}). Intenta de nuevo.`;
  };

  return (
    <div className="min-h-screen bg-[#06080C] flex flex-col items-center justify-center p-4 font-sans">
      {/* Logo header */}
      <div className="mb-8 text-center select-none">
        <div className="inline-flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-sm font-extrabold text-slate-950">R</span>
          </div>
          <span className="text-xl font-display font-extrabold text-white tracking-tight">RoutePro</span>
        </div>
        <p className="text-[10px] text-[#3E4A60] uppercase tracking-widest font-bold">Sistema de Distribución Elite</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-[#0B0E14] border border-white/8 rounded-2xl shadow-2xl overflow-hidden">

        {/* Tab switcher */}
        <div className="flex border-b border-white/5">
          <button
            onClick={() => { setTab('register'); clearErr(); }}
            className={`flex-1 py-3.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${tab === 'register' ? 'text-amber-400 border-b-2 border-amber-500 bg-amber-500/5' : 'text-[#3E4A60] hover:text-white'}`}
          >
            Crear Cuenta
          </button>
          <button
            onClick={() => { setTab('login'); clearErr(); }}
            className={`flex-1 py-3.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${tab === 'login' ? 'text-amber-400 border-b-2 border-amber-500 bg-amber-500/5' : 'text-[#3E4A60] hover:text-white'}`}
          >
            Iniciar Sesión
          </button>
        </div>

        <div className="p-6 space-y-4">

          {/* REGISTRATION FORM */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Nombre del dueño</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => { setNombre(e.target.value); clearErr(); }}
                  className="bg-[#111520] border border-white/5 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/60 placeholder-[#3E4A60]"
                  placeholder="Ej: Juan García Pérez"
                  autoComplete="name"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearErr(); }}
                  className="bg-[#111520] border border-white/5 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/60 placeholder-[#3E4A60]"
                  placeholder="correo@tunegocio.mx"
                  autoComplete="email"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearErr(); }}
                    className="bg-[#111520] border border-white/5 rounded-lg px-3.5 py-2.5 pr-9 text-xs text-white focus:outline-none focus:border-amber-500/60 placeholder-[#3E4A60] w-full"
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3E4A60] hover:text-white text-xs cursor-pointer">
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Confirmar contraseña</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={(e) => { setConfirmPwd(e.target.value); clearErr(); }}
                  className="bg-[#111520] border border-white/5 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/60 placeholder-[#3E4A60]"
                  placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                />
              </div>

              {/* Tipo de cuenta */}
              <div className="bg-[#111520] border border-white/5 rounded-xl p-3 space-y-2">
                <p className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Tipo de cuenta</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setEsContador(false); clearErr(); }}
                    className={`py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${!esContador ? 'bg-amber-500 text-slate-950' : 'bg-[#181D2B] text-[#8A93A8] border border-white/5'}`}
                  >
                    🏪 Dueño de negocio
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEsContador(true); clearErr(); }}
                    className={`py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${esContador ? 'bg-amber-500 text-slate-950' : 'bg-[#181D2B] text-[#8A93A8] border border-white/5'}`}
                  >
                    🧾 Contador / Admin
                  </button>
                </div>
                {esContador && (
                  <p className="text-[9px] text-amber-400/80 leading-relaxed">
                    Modo contador: gestiona múltiples negocios desde un solo panel.
                  </p>
                )}
              </div>

              {/* Aviso de Privacidad — LFPDPPP */}
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={privacidad}
                    onChange={(e) => { setPrivacidad(e.target.checked); clearErr(); }}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 rounded bg-[#111520] border border-white/10 peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all flex items-center justify-center">
                    {privacidad && <span className="text-[8px] text-slate-950 font-extrabold leading-none">✓</span>}
                  </div>
                </div>
                <span className="text-[10px] text-[#8A93A8] leading-relaxed group-hover:text-white transition-colors">
                  He leído y acepto el{' '}
                  <span className="text-amber-400 underline underline-offset-2">Aviso de Privacidad</span>
                  {' '}(LFPDPPP). Mis datos serán usados únicamente para la operación del servicio.
                </span>
              </label>

              {fieldErr && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-[10px] text-red-400 font-medium">
                  {fieldErr}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-97 disabled:opacity-50 text-[#06080C] font-extrabold text-xs tracking-wide rounded-xl cursor-pointer transition-all text-center"
              >
                {loading ? '⏳ Creando cuenta...' : '✓ Crear Mi Cuenta'}
              </button>
            </form>
          )}

          {/* LOGIN FORM */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Correo electrónico</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); clearErr(); }}
                  className="bg-[#111520] border border-white/5 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/60 placeholder-[#3E4A60]"
                  placeholder="correo@tunegocio.mx"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-mono text-[#3E4A60] uppercase tracking-wider font-bold">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={loginPwd}
                    onChange={(e) => { setLoginPwd(e.target.value); clearErr(); }}
                    className="bg-[#111520] border border-white/5 rounded-lg px-3.5 py-2.5 pr-9 text-xs text-white focus:outline-none focus:border-amber-500/60 placeholder-[#3E4A60] w-full"
                    placeholder="Tu contraseña"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3E4A60] hover:text-white text-xs cursor-pointer">
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {fieldErr && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-[10px] text-red-400 font-medium">
                  {fieldErr}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-97 disabled:opacity-50 text-[#06080C] font-extrabold text-xs tracking-wide rounded-xl cursor-pointer transition-all text-center"
              >
                {loading ? '⏳ Verificando...' : '→ Iniciar Sesión'}
              </button>
            </form>
          )}
        </div>

        {/* Demo footer — sin Firebase */}
        <div className="px-6 pb-5 text-center">
          <div className="border-t border-white/5 pt-4 space-y-1">
            <button
              onClick={handleGuest}
              className="text-[10px] text-[#3E4A60] hover:text-[#8A93A8] transition-colors cursor-pointer underline underline-offset-2"
            >
              Explorar demo interactiva (sin guardar datos)
            </button>
            <p className="text-[9px] text-[#1E2535]">Los datos del demo no se sincronizan ni almacenan.</p>
          </div>
        </div>
      </div>

      {/* Legal footer */}
      <p className="text-[9px] text-[#1E2535] mt-6 text-center max-w-xs leading-relaxed">
        Al crear una cuenta aceptas que RoutePro almacene tu información conforme a la LFPDPPP.
        No compartimos tus datos con terceros.
      </p>
    </div>
  );
};
