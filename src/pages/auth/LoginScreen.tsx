import React, { useEffect, useState } from 'react';
import { UserProfile } from '../../types';
import { checkHealth, loginRequest } from '../../api/client';

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [userCode, setUserCode] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverUp, setServerUp] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const ping = () => checkHealth().then((ok) => alive && setServerUp(ok));
    ping();
    const id = setInterval(ping, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      setTimeStr(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!userCode.trim() || !password) {
      setErrorMsg('Ingresa tu código de usuario y tu contraseña o PIN.');
      return;
    }
    setLoading(true);
    try {
      const user = await loginRequest(userCode.trim(), password);
      onLogin(user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full pl-9 pr-3 py-3 rounded-xl border border-[#D6DEEA] text-sm font-bold text-gray-900 outline-none focus:border-[#1B4E9B] focus:ring-2 focus:ring-[#1B4E9B]/15';

  return (
    <div className="min-h-screen bg-[#F2F4F7] text-[#191c1e] flex flex-col justify-between">
      <header className="h-16 bg-[#1B4E9B] border-b-4 border-[#5FAF32] flex items-center justify-between px-4 lg:px-8 text-white">
        <img src="/brand/logo-texto.jpg" alt="Lácteos Colombia" className="h-11 object-contain" />
        <div className="flex items-center gap-4 text-xs font-mono">
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border font-bold text-[11px] ${
              serverUp ? 'bg-[#5FAF32]/20 text-white border-[#8CC63F]' : 'bg-red-500/20 text-white border-red-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full animate-pulse ${serverUp ? 'bg-[#8CC63F]' : 'bg-red-400'}`}></span>
            <span>{serverUp === null ? 'Verificando...' : serverUp ? 'Servidor en línea' : 'Servidor sin conexión'}</span>
          </div>
          <div className="font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-white/70">schedule</span>
            <span>{timeStr}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="max-w-4xl w-full bg-white rounded-3xl shadow-xl border border-[#D6DEEA] overflow-hidden grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-6 p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-4 bg-gradient-to-br from-[#1B4E9B] to-[#143A73] text-white">
            <img src="/brand/logo-color.jpg" alt="Lácteos Colombia" className="w-40 h-40 sm:w-48 sm:h-48 rounded-3xl object-cover shadow-lg ring-4 ring-white/20" />
            <div>
              <h2 className="text-2xl sm:text-3xl font-black leading-tight">Control de Producción</h2>
              <p className="text-xs sm:text-sm text-white/80 mt-2 leading-relaxed max-w-xs">
                Líneas de Pasta Hilada y Fermentados. Ingresa con tu código de empleado y tu PIN.
              </p>
            </div>
            <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
              <span className="px-2.5 py-1 rounded-full bg-[#5FAF32] text-white">Pasta Hilada</span>
              <span className="px-2.5 py-1 rounded-full bg-[#8CC63F] text-[#143A73]">Fermentados</span>
            </div>
          </div>

          <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between bg-white">
            <form onSubmit={handleManualLogin} className="flex flex-col gap-4">
              <div>
                <span className="text-[10px] font-bold text-[#5FAF32] uppercase tracking-wider block">Acceso a planta</span>
                <h3 className="text-xl font-black text-[#143A73] mt-0.5">Iniciar sesión</h3>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">Código de empleado</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-[18px] text-gray-400">person</span>
                  <input
                    type="text"
                    value={userCode}
                    autoComplete="username"
                    onChange={(e) => {
                      setUserCode(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="ej: OP-104"
                    className={`${inputClass} uppercase`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">Contraseña o PIN</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-[18px] text-gray-400">key</span>
                  <input
                    type="password"
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="••••"
                    className={inputClass}
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full disabled:opacity-60 py-3.5 rounded-2xl bg-[#1B4E9B] hover:bg-[#143A73] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 mt-2"
              >
                <span>{loading ? 'Verificando...' : 'Ingresar al sistema'}</span>
                <span className="material-symbols-outlined text-[18px]">login</span>
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-[#D6DEEA] flex items-center justify-between text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-[#5FAF32]">verified</span>
                <span>BPM · NTC-589 · NTC-805</span>
              </span>
              <span>La sesión se mantiene al recargar</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="h-12 bg-white border-t border-[#D6DEEA] flex items-center justify-between px-4 lg:px-8 text-[11px] text-gray-500">
        <div>Lácteos Colombia © {new Date().getFullYear()} · Control de Producción</div>
        <div className="hidden sm:inline">Pasta Hilada y Fermentados</div>
      </footer>
    </div>
  );
};
