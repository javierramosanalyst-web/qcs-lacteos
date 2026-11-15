import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SecurityEventRow, fetchSecurityEvents } from '../../api/client';

const card = 'bg-white rounded-2xl border border-[#D6DEEA] shadow-xs';
const selectClass =
  'h-9 px-2.5 rounded-xl border border-[#D6DEEA] bg-white text-xs font-bold text-gray-700 outline-none focus:border-[#1B4E9B]';

/** Nombre y color de cada evento de la bitácora. */
const EVENTOS: Record<string, { label: string; icon: string; cls: string }> = {
  INGRESO: { label: 'Inicio de sesión', icon: 'login', cls: 'bg-[#5FAF32]/10 text-[#3F7F1E] border-[#5FAF32]/40' },
  INGRESO_FALLIDO: { label: 'Intento fallido', icon: 'block', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  CUENTA_BLOQUEADA: { label: 'Cuenta bloqueada', icon: 'lock', cls: 'bg-red-50 text-red-700 border-red-300' },
  SALIDA: { label: 'Cierre de sesión', icon: 'logout', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
  USUARIO_CREADO: { label: 'Usuario creado', icon: 'person_add', cls: 'bg-[#1B4E9B]/10 text-[#1B4E9B] border-[#1B4E9B]/30' },
  USUARIO_EDITADO: { label: 'Usuario editado', icon: 'edit', cls: 'bg-[#1B4E9B]/10 text-[#1B4E9B] border-[#1B4E9B]/30' },
  USUARIO_BAJA: { label: 'Dado de baja', icon: 'person_remove', cls: 'bg-red-50 text-red-700 border-red-300' },
  USUARIO_REACTIVADO: { label: 'Reactivado', icon: 'restore', cls: 'bg-[#5FAF32]/10 text-[#3F7F1E] border-[#5FAF32]/40' },
  CLAVE_CAMBIADA: { label: 'Cambió su clave', icon: 'key', cls: 'bg-[#1B4E9B]/10 text-[#1B4E9B] border-[#1B4E9B]/30' },
  CLAVE_RESTABLECIDA: { label: 'Clave restablecida', icon: 'lock_reset', cls: 'bg-[#1B4E9B]/10 text-[#1B4E9B] border-[#1B4E9B]/30' },
  CLAVE_ACTUAL_INCORRECTA: { label: 'Clave actual incorrecta', icon: 'key_off', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
};

const PERIODOS = [
  { dias: 1, label: 'Últimas 24 h' },
  { dias: 7, label: 'Últimos 7 días' },
  { dias: 30, label: 'Últimos 30 días' },
  { dias: 90, label: 'Últimos 90 días' },
];

const fechaHora = (iso: string): string =>
  new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Bogota',
  });

/** Bitácora de accesos del superadmin: se llena sola desde el servidor; aquí solo se consulta. */
export const SecurityLog: React.FC = () => {
  const [dias, setDias] = useState(7);
  const [evento, setEvento] = useState('');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filas, setFilas] = useState<SecurityEventRow[]>([]);
  const [limite, setLimite] = useState(500);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetchSecurityEvents({ dias, evento: evento || undefined, q: busqueda || undefined });
      setFilas(r.eventos);
      setLimite(r.limite);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo consultar la bitácora.');
    } finally {
      setCargando(false);
    }
  }, [dias, evento, busqueda]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resumen = useMemo(() => {
    const cuenta = (k: string) => filas.filter((f) => f.evento === k).length;
    return [
      { label: 'Ingresos', valor: cuenta('INGRESO'), cls: 'text-[#3F7F1E]' },
      { label: 'Intentos fallidos', valor: cuenta('INGRESO_FALLIDO'), cls: 'text-amber-700' },
      { label: 'Bloqueos', valor: cuenta('CUENTA_BLOQUEADA'), cls: 'text-red-700' },
    ];
  }, [filas]);

  return (
    <div className={`${card} p-5 flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D6DEEA] pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">history_edu</span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900">Bitácora de accesos</h3>
            <p className="text-[10px] text-gray-500">
              Se registra sola: ingresos, intentos fallidos, bloqueos y cambios de usuarios y claves. Nunca guarda PIN ni
              contraseñas.
            </p>
          </div>
        </div>
        <button
          onClick={() => void cargar()}
          disabled={cargando}
          className="px-3 h-9 rounded-xl bg-white border border-[#D6DEEA] text-xs font-bold text-[#1B4E9B] hover:bg-[#F2F4F7] flex items-center gap-1 cursor-pointer disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-[16px] ${cargando ? 'animate-spin' : ''}`}>refresh</span>
          Actualizar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className={selectClass} aria-label="Periodo">
          {PERIODOS.map((p) => (
            <option key={p.dias} value={p.dias}>
              {p.label}
            </option>
          ))}
        </select>
        <select value={evento} onChange={(e) => setEvento(e.target.value)} className={selectClass} aria-label="Tipo de evento">
          <option value="">Todos los eventos</option>
          {Object.entries(EVENTOS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <form
          className="flex items-center gap-1 flex-1 min-w-[180px]"
          onSubmit={(e) => {
            e.preventDefault();
            setBusqueda(texto.trim());
          }}
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Código o nombre"
            aria-label="Buscar por código o nombre"
            className="h-9 px-3 rounded-xl border border-[#D6DEEA] text-xs flex-1 min-w-0 outline-none focus:border-[#1B4E9B]"
          />
          <button type="submit" className="h-9 px-3 rounded-xl bg-[#1B4E9B] text-white text-xs font-bold cursor-pointer">
            Buscar
          </button>
        </form>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {resumen.map((r) => (
          <div key={r.label} className="p-2.5 rounded-xl bg-[#F2F4F7] border border-[#D6DEEA]">
            <div className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-gray-500 truncate">{r.label}</div>
            <div className={`text-xl font-black font-mono ${r.cls}`}>{r.valor}</div>
          </div>
        ))}
      </div>

      {error && <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800">{error}</div>}

      {!error && filas.length === 0 && !cargando && (
        <div className="text-xs text-gray-500 py-4 text-center">No hay eventos en este periodo.</div>
      )}

      <div className="flex flex-col divide-y divide-[#E8EDF4] max-h-[480px] overflow-y-auto">
        {filas.map((f) => {
          const meta = EVENTOS[f.evento] ?? { label: f.evento, icon: 'info', cls: 'bg-gray-100 text-gray-600 border-gray-300' };
          const quien = f.nombre ? `${f.nombre} (${f.codigo ?? '—'})` : f.codigo ? `${f.codigo} · código no registrado` : '—';
          const porOtro = f.actor_codigo && f.actor_codigo !== f.codigo;
          return (
            <div key={f.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-xs">
              <span className="font-mono text-[11px] text-gray-500 shrink-0 sm:w-40">{fechaHora(f.registrado_at)}</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold shrink-0 w-fit sm:w-44 ${meta.cls}`}
              >
                <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
                {meta.label}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-gray-900 truncate">{quien}</div>
                <div className="text-[10px] text-gray-500 truncate">
                  {[f.detalle, porOtro ? `por ${f.actor_nombre ?? f.actor_codigo}` : null, f.ip ? `IP ${f.ip}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filas.length >= limite && (
        <div className="text-[10px] text-gray-500">
          Se muestran los {limite} eventos más recientes. Usa los filtros para acotar la búsqueda.
        </div>
      )}
    </div>
  );
};
