import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui';
import { ActividadOperario, UserProfile } from '../../types';
import { codigoDeOperario, operarioLabel } from '../../utils/operariosActividad';
import { BatchRectificationRow, TiemposLote, fetchBatchRectifications, fetchBatchTimes } from '../../api/client';

export interface EtapaResumenItem {
  label: string;
  value: React.ReactNode;
}

export interface EtapaResumen {
  titulo: string;
  items: EtapaResumenItem[];
}

const TZ = 'America/Bogota';
const horaCorta = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }) : '';
const diaCorto = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', timeZone: TZ }) : '';
const duracionTexto = (seg: number | null): string => {
  if (seg === null || seg < 0) return '';
  if (seg < 60) return `${seg} s`;
  const min = Math.round(seg / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
};
const durSeg = (dur: number | null, inicio: string | null, fin: string | null): number | null => {
  if (dur !== null && dur > 0) return dur;
  if (inicio && fin) {
    const d = Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 1000);
    return d >= 0 ? d : null;
  }
  return dur;
};

/** Etapas (inicio, fin, duración, operario) y los pasos con hora que registró el operario. */
const TiemposDelProceso: React.FC<{ tiempos: TiemposLote }> = ({ tiempos }) => {
  const etapas = [...tiempos.etapas].sort((a, b) => a.orden - b.orden);
  if (!etapas.some((e) => e.inicio) && tiempos.pasos.length === 0) return null;
  const diaBase = diaCorto(etapas.find((e) => e.inicio)?.inicio ?? tiempos.pasos[0]?.inicio ?? null);
  const hora = (iso: string | null) => {
    if (!iso) return '--:--';
    const d = diaCorto(iso);
    return d && d !== diaBase ? `${horaCorta(iso)} (${d})` : horaCorta(iso);
  };
  return (
    <div className="p-4 bg-white rounded-2xl border border-[#D6DEEA]">
      <h4 className="font-black text-gray-900 text-sm mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">schedule</span>
        Tiempos del proceso
      </h4>
      <div className="flex flex-col gap-2.5">
        {etapas.map((e) => {
          const pasos = tiempos.pasos.filter((p) => p.orden === e.orden);
          const dur = e.estado === 'completada' ? durSeg(e.duracion_segundos, e.inicio, e.fin) : null;
          return (
            <div key={e.orden} className="border-l-2 border-[#1B4E9B]/30 pl-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-xs font-black text-gray-900">
                  {e.orden}. {e.etapa}
                </span>
                <span className="text-[11px] text-gray-600 font-mono">
                  {e.inicio ? hora(e.inicio) : 'Sin iniciar'}
                  {e.fin ? ` → ${hora(e.fin)}` : e.inicio ? ' → en proceso' : ''}
                  {dur !== null && dur > 0 ? ` · ${duracionTexto(dur)}` : ''}
                </span>
              </div>
              {e.operario && <div className="text-[10px] text-gray-500">Operario: {e.operario}</div>}
              {pasos.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {pasos.map((p) => {
                    const d = durSeg(p.duracion_segundos, p.inicio, p.fin);
                    return (
                      <li key={`${p.codigo_hito}-${p.inicio}`} className="text-[11px] text-gray-700 flex flex-wrap gap-x-2">
                        <span className="font-mono font-bold text-[#143A73] w-11 shrink-0">{horaCorta(p.inicio)}</span>
                        <span className="flex-1 min-w-0">
                          {p.paso}
                          {p.fin ? ` (hasta ${hora(p.fin)})` : ''}
                          {d !== null && d > 0 ? <span className="text-gray-500"> · {duracionTexto(d)}</span> : null}
                          {p.manual ? <span className="ml-1 text-[9px] font-bold text-amber-700 uppercase">manual</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export type SummaryTone = 'blue' | 'cyan' | 'emerald' | 'amber' | 'purple' | 'rose';

const TONES: Record<SummaryTone, { border: string; label: string; value: string; sub: string }> = {
  blue: { border: 'border-blue-200', label: 'text-blue-700', value: 'text-blue-950', sub: 'text-gray-500' },
  cyan: { border: 'border-cyan-200', label: 'text-cyan-700', value: 'text-cyan-950', sub: 'text-gray-500' },
  emerald: { border: 'border-emerald-200', label: 'text-emerald-700', value: 'text-emerald-950', sub: 'text-emerald-700' },
  amber: { border: 'border-amber-200', label: 'text-amber-700', value: 'text-amber-950', sub: 'text-gray-500' },
  purple: { border: 'border-purple-200', label: 'text-purple-700', value: 'text-purple-950', sub: 'text-gray-500' },
  rose: { border: 'border-rose-200', label: 'text-rose-700', value: 'text-rose-950', sub: 'text-gray-500' },
};

export const SummaryMetricCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: SummaryTone;
}> = ({ label, value, sub, tone = 'blue' }) => {
  const t = TONES[tone];
  return (
    <div className={`p-4 bg-white rounded-2xl border ${t.border} shadow-xs`}>
      <span className={`text-[10px] uppercase font-bold ${t.label} block`}>{label}</span>
      <span className={`text-2xl font-black ${t.value} mt-1 block`}>{value}</span>
      {sub && <span className={`text-[10px] ${t.sub} block mt-0.5`}>{sub}</span>}
    </div>
  );
};

export const SummaryMetricsRow: React.FC<{
  leche: { value: React.ReactNode; sub?: React.ReactNode; label?: string };
  producido: { value: React.ReactNode; sub?: React.ReactNode; label?: string };
  rendimiento: { value: React.ReactNode; sub?: React.ReactNode; label?: string };
}> = ({ leche, producido, rendimiento }) => (
  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
    <SummaryMetricCard label={leche.label || '1. Leche Base'} value={leche.value} sub={leche.sub} tone="blue" />
    <SummaryMetricCard label={producido.label || '2. Total Envasado'} value={producido.value} sub={producido.sub} tone="cyan" />
    <div className="col-span-2 lg:col-span-1">
      <SummaryMetricCard label={rendimiento.label || '3. Rendimiento'} value={rendimiento.value} sub={rendimiento.sub} tone="emerald" />
    </div>
  </div>
);

export const SummarySection: React.FC<{
  title: string;
  icon?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon = 'inventory_2', aside, children }) => (
  <div className="bg-white p-5 rounded-2xl border border-[#D6DEEA] shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
        <span className="material-symbols-outlined text-purple-700 text-[20px]">{icon}</span>
        <span>{title}</span>
      </h3>
      {aside}
    </div>
    {children}
  </div>
);

interface ProductionSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  /** Lote que se muestra (letras del día). batchId sigue siendo el código interno para consultas. */
  loteVisible?: string;
  productName: string;
  productBadge: string;
  standard: string;
  icon: string;
  status?: string;
  responsable: string;
  users?: UserProfile[];
  observaciones?: string;
  operariosIntervinientes?: string[];
  actividadOperarios?: ActividadOperario[];
  onFinalizeBatch?: () => void;
  /** Si trae un texto, el lote NO se puede cerrar (p. ej. 0 envases / moldes) y se muestra el motivo. */
  motivoNoCierre?: string | null;
  onChangeObservaciones?: (observaciones: string) => void;
  onChangeOperariosIntervinientes?: (operarios: string[]) => void;
  resumen: React.ReactNode;
  etapas: EtapaResumen[];
  observacionesPlaceholder?: string;
  constanciaTexto?: string;
}

export const ProductionSummaryModal: React.FC<ProductionSummaryModalProps> = ({
  isOpen,
  onClose,
  batchId,
  loteVisible,
  productName,
  productBadge,
  standard,
  icon,
  status,
  responsable,
  users = [],
  observaciones,
  operariosIntervinientes,
  actividadOperarios,
  onFinalizeBatch,
  motivoNoCierre = null,
  onChangeObservaciones,
  onChangeOperariosIntervinientes,
  resumen,
  etapas,
  observacionesPlaceholder = 'Registre cualquier novedad observada durante el proceso...',
  constanciaTexto = 'Todos los tiempos, temperaturas, insumos y balance de masas del lote',
}) => {
  const [activeTab, setActiveTab] = useState<'resumen' | 'detalle' | 'certificado'>('resumen');
  const [localObservaciones, setLocalObservaciones] = useState<string>(observaciones || '');
  const normalizarTexto = (valor: string) =>
    valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const buscarUsuario = (texto: string) => {
    const codigo = codigoDeOperario(texto);
    if (codigo) {
      const porCodigo = users.find((u) => u.code.toUpperCase() === codigo.toUpperCase());
      if (porCodigo) return porCodigo;
    }
    const nombre = normalizarTexto(texto.replace(/\s*\([^)]*\)\s*$/, ''));
    return users.find((u) => normalizarTexto(u.name) === nombre);
  };

  const normalizarLista = (lista: string[]): string[] => {
    const claves = new Set<string>();
    const resultado: string[] = [];
    for (const raw of lista) {
      const texto = raw.trim();
      if (!texto) continue;
      const usuario = buscarUsuario(texto);
      const etiqueta = usuario ? operarioLabel(usuario) : texto;
      const claveCodigo = usuario ? `c:${usuario.code.toUpperCase()}` : null;
      const claveNombre = `n:${normalizarTexto(
        usuario ? usuario.name : texto.replace(/\s*\([^)]*\)\s*$/, '')
      )}`;
      if ((claveCodigo && claves.has(claveCodigo)) || claves.has(claveNombre)) continue;
      if (claveCodigo) claves.add(claveCodigo);
      claves.add(claveNombre);
      resultado.push(etiqueta);
    }
    return resultado;
  };
  const inicialOperarios = () =>
    normalizarLista(
      operariosIntervinientes && operariosIntervinientes.length > 0
        ? operariosIntervinientes
        : [responsable].filter(Boolean)
    );
  const [operariosList, setOperariosList] = useState<string[]>(inicialOperarios);
  const [showConfirmAlert, setShowConfirmAlert] = useState<boolean>(false);
  const [rectificaciones, setRectificaciones] = useState<BatchRectificationRow[]>([]);
  const [tiempos, setTiempos] = useState<TiemposLote | null>(null);

  useEffect(() => {
    if (!isOpen || !batchId) {
      setTiempos(null);
      return;
    }
    let cancelado = false;
    fetchBatchTimes(batchId)
      .then((t) => {
        if (!cancelado) setTiempos(t && Array.isArray(t.etapas) ? t : null);
      })
      .catch(() => {
        if (!cancelado) setTiempos(null);
      });
    return () => {
      cancelado = true;
    };
  }, [isOpen, batchId]);

  useEffect(() => {
    if (!isOpen || !batchId) {
      setRectificaciones([]);
      return;
    }
    let cancelado = false;
    fetchBatchRectifications(batchId)
      .then((rows) => {
        if (!cancelado) setRectificaciones(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelado) setRectificaciones([]);
      });
    return () => {
      cancelado = true;
    };
  }, [isOpen, batchId]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('resumen');
      setShowConfirmAlert(false);
      setLocalObservaciones(observaciones || '');
      setOperariosList(inicialOperarios());
    }
  }, [isOpen, batchId]);

  useEffect(() => {
    if (!operariosIntervinientes || operariosIntervinientes.length === 0) return;
    setOperariosList((prev) => normalizarLista([...prev, ...operariosIntervinientes]));
  }, [operariosIntervinientes, users]);

  const operariosDisponibles = useMemo(
    () => users.filter((u) => u.role === 'operador').map(operarioLabel),
    [users]
  );
  const administradoresDisponibles = useMemo(
    () => users.filter((u) => u.role === 'administrador').map(operarioLabel),
    [users]
  );
  const operariosOpc = operariosDisponibles.filter((op) => !operariosList.includes(op));
  const adminsOpc = administradoresDisponibles.filter((op) => !operariosList.includes(op));
  const opcionesDisponibles = [...operariosOpc, ...adminsOpc];
  const actividad = actividadOperarios ?? [];
  const tieneActividad = (label: string) => {
    const code = codigoDeOperario(label);
    return actividad.some((a) => (code ? a.codigo === code : a.nombre === label));
  };
  const actividadPorFase = useMemo(
    () =>
      [...(actividadOperarios ?? [])].sort(
        (a, b) => a.fase.localeCompare(b.fase, 'es') || a.primeraAccion.localeCompare(b.primeraAccion)
      ),
    [actividadOperarios]
  );
  const formatMoment = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '--'
      : d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const normClave = (valor: string) =>
    valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const rectificacionesPorCampo = useMemo(() => {
    const mapa = new Map<string, BatchRectificationRow>();
    for (const r of rectificaciones) {
      const etiqueta = (r.campo_label || r.campo_modificado || '').split('›').pop() || '';
      const clave = normClave(etiqueta);
      if (!clave) continue;
      const previa = mapa.get(clave);
      if (!previa || new Date(r.registrado_at).getTime() > new Date(previa.registrado_at).getTime()) {
        mapa.set(clave, r);
      }
    }
    return mapa;
  }, [rectificaciones]);

  const rectificacionDeItem = (itemLabel: string): BatchRectificationRow | undefined => {
    const clave = normClave(itemLabel);
    if (!clave) return undefined;
    const directa = rectificacionesPorCampo.get(clave);
    if (directa) return directa;
    for (const [campo, rect] of rectificacionesPorCampo) {
      if (campo.length >= 4 && (campo.includes(clave) || clave.includes(campo))) return rect;
    }
    return undefined;
  };

  if (!isOpen) return null;

  const actualizarOperarios = (updated: string[]) => {
    setOperariosList(updated);
    onChangeOperariosIntervinientes?.(updated);
  };

  const handleAddOperator = (nameToAdd: string) => {
    const clean = nameToAdd.trim();
    if (!clean) return;
    const actualizada = normalizarLista([...operariosList, clean]);
    if (actualizada.length !== operariosList.length) actualizarOperarios(actualizada);
  };

  const handleRemoveOperator = (idx: number) => {
    if (operariosList.length <= 1 || tieneActividad(operariosList[idx])) return;
    const actualizada = operariosList.filter((_, i) => i !== idx);
    setOperariosList(actualizada);
    onChangeOperariosIntervinientes?.(actualizada);
  };

  const handleSaveObservaciones = () => onChangeObservaciones?.(localObservaciones);

  const loteMostrado = loteVisible || batchId;

  const handleConfirmFinalize = () => {
    if (motivoNoCierre) {
      setShowConfirmAlert(false);
      return;
    }
    handleSaveObservaciones();
    onChangeOperariosIntervinientes?.(operariosList);
    setShowConfirmAlert(false);
    onFinalizeBatch?.();
    onClose();
  };

  const tabClass = (tab: string) =>
    `py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
      activeTab === tab ? 'border-[#1B4E9B] text-[#1B4E9B]' : 'border-transparent text-gray-500 hover:text-gray-800'
    }`;

  const bloqueCorrecciones =
    rectificaciones.length > 0 ? (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-amber-900 uppercase tracking-wide flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-700 text-[20px]">history</span>
            <span>Correcciones auditadas de este lote ({rectificaciones.length})</span>
          </h3>
          <span className="px-2 py-0.5 bg-white text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-black uppercase">
            Certificado BPM
          </span>
        </div>
        <p className="text-[11px] text-amber-800 mt-1">
          El valor original queda tachado y el valor vigente es el rectificado.
        </p>
        <ul className="mt-3 space-y-2">
          {rectificaciones.map((r) => (
            <li key={r.id} className="bg-white rounded-xl border border-amber-200 p-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase text-amber-800">
                <span>{r.etapa_label || r.etapa_codigo || 'Lote'}</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-700 normal-case">{r.campo_label || r.campo_modificado}</span>
                <span className="ml-auto text-gray-500 normal-case font-semibold">
                  {formatMoment(r.registrado_at)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                <s className="text-rose-700 font-bold">
                  {r.valor_anterior ?? '—'}
                  {r.unidad ? ` ${r.unidad}` : ''}
                </s>
                <span className="material-symbols-outlined text-[14px] text-gray-400">arrow_forward</span>
                <strong className="text-emerald-800 font-black">
                  {r.valor_nuevo ?? '—'}
                  {r.unidad ? ` ${r.unidad}` : ''}
                </strong>
                <span className="px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[9px] font-black uppercase">
                  Corregido
                </span>
              </div>
              {r.categoria_motivo && <p className="text-[11px] text-gray-600 mt-1">{r.categoria_motivo}</p>}
              {r.justificacion_tecnica && (
                <p className="text-[11px] text-gray-500 italic mt-0.5 wrap-break-word">
                  "{r.justificacion_tecnica}"
                </p>
              )}
              <p className="text-[10px] text-gray-500 mt-1">
                Autorizado por: <strong className="text-gray-700">{r.autorizado_por_nombre || '—'}</strong>
              </p>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="5xl"
        icon={icon}
        title={`Resumen Final de Producción · ${productName}`}
        subtitle="Trazabilidad del lote y rendimiento final."
        badge={
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2.5 py-0.5 bg-cyan-100 text-cyan-900 border border-cyan-300 rounded-full text-[11px] font-black uppercase">
              {loteMostrado}
            </span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold">
              {standard}
            </span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-bold">
              {productBadge}
            </span>
            {rectificaciones.length > 0 && (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 rounded-full text-[10px] font-black">
                {rectificaciones.length} corrección(es)
              </span>
            )}
          </div>
        }
        tabs={
          <div className="flex px-6 gap-6 overflow-x-auto">
            <button onClick={() => setActiveTab('resumen')} className={tabClass('resumen')}>
              Balance y Métricas Clave
            </button>
            <button onClick={() => setActiveTab('detalle')} className={tabClass('detalle')}>
              Trazabilidad de Etapas ({etapas.length})
            </button>
            <button onClick={() => setActiveTab('certificado')} className={tabClass('certificado')}>
              Equipo y Constancia del Lote
            </button>
          </div>
        }
        footer={
          <div className="w-full flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              Lote: <strong className="text-gray-800">{loteMostrado}</strong> · Responsable:{' '}
              <strong className="text-gray-800">{responsable}</strong>
            </div>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                onClick={onClose}
                className="h-10 px-4 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                <span>Cerrar Resumen</span>
              </button>
              {onFinalizeBatch && status !== 'COMPLETADO' && motivoNoCierre && (
                <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  {motivoNoCierre}
                </span>
              )}
              {onFinalizeBatch && status !== 'COMPLETADO' && (
                <button
                  onClick={() => setShowConfirmAlert(true)}
                  disabled={Boolean(motivoNoCierre)}
                  title={motivoNoCierre ?? undefined}
                  className="h-10 px-5 bg-[#5FAF32] hover:bg-[#4E9628] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#5FAF32] disabled:active:scale-100"
                >
                  <span className="material-symbols-outlined text-[17px]">task_alt</span>
                  <span>Confirmar Proceso Terminado</span>
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {activeTab === 'resumen' && (
            <div className="space-y-6">
              {bloqueCorrecciones}
              {resumen}
            </div>
          )}

          {activeTab === 'detalle' && (
            <div className="space-y-4">
              {bloqueCorrecciones}
              {tiempos && <TiemposDelProceso tiempos={tiempos} />}
              {etapas.map((etapa) => (
                <div key={etapa.titulo} className="p-4 bg-white rounded-2xl border border-[#D6DEEA]">
                  <h4 className="font-black text-gray-900 text-sm mb-2 flex items-center justify-between gap-3">
                    <span>{etapa.titulo}</span>
                    <span className="text-xs text-emerald-700 font-bold shrink-0">✓ Completada</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
                    {etapa.items.map((item) => {
                      const rect = rectificacionDeItem(item.label);
                      return (
                        <div key={item.label}>
                          {item.label}:{' '}
                          {rect ? (
                            <span className="inline-flex flex-wrap items-baseline gap-1">
                              <s className="text-rose-700">{item.value}</s>
                              <strong className="text-emerald-800">
                                {rect.valor_nuevo}
                                {rect.unidad ? ` ${rect.unidad}` : ''}
                              </strong>
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[9px] font-black uppercase">
                                Corregido
                              </span>
                            </span>
                          ) : (
                            <strong>{item.value}</strong>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'certificado' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-[#D6DEEA] shadow-xs">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-700">group</span>
                  <span>Operarios y Responsables que Intervinieron</span>
                </h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {operariosList.map((op, idx) => (
                    <span
                      key={op}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-50 text-cyan-900 border border-cyan-200 rounded-full text-xs font-bold"
                    >
                      <span>{op}</span>
                      {operariosList.length > 1 && !tieneActividad(op) && (
                        <button
                          onClick={() => handleRemoveOperator(idx)}
                          className="hover:text-red-700 text-cyan-600 font-black cursor-pointer"
                          title="Quitar operario agregado manualmente"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handleAddOperator(e.target.value);
                    }}
                    disabled={opcionesDisponibles.length === 0}
                    className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-hidden"
                  >
                    <option value="">
                      {users.length === 0
                        ? 'No se pudo cargar la lista de usuarios activos'
                        : opcionesDisponibles.length === 0
                        ? 'Todos los usuarios activos ya están en el lote'
                        : '+ Agregar operario activo...'}
                    </option>
                    {operariosOpc.length > 0 && (
                      <optgroup label="Operarios activos">
                        {operariosOpc.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {adminsOpc.length > 0 && (
                      <optgroup label="Administradores activos">
                        {adminsOpc.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <span className="text-[11px] text-gray-500">
                    Quienes trabajan en el lote quedan registrados automáticamente; aquí solo agregas a quien apoyó sin iniciar sesión.
                  </span>
                </div>

                <div className="mt-5">
                  <h4 className="text-xs font-black text-gray-700 uppercase tracking-wide mb-2">
                    Registro por fase y operario
                  </h4>
                  {actividadPorFase.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      Aún no hay acciones registradas por fase para este lote.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#D6DEEA]/80">
                      <table className="w-full text-[11px]">
                        <thead className="bg-[#F2F4F7] text-[#4A5263] uppercase text-[9px]">
                          <tr>
                            <th className="text-left px-2.5 py-1.5">Fase</th>
                            <th className="text-left px-2.5 py-1.5">Operario</th>
                            <th className="text-left px-2.5 py-1.5">Rol</th>
                            <th className="text-left px-2.5 py-1.5">Primera acción</th>
                            <th className="text-left px-2.5 py-1.5">Última acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {actividadPorFase.map((a) => (
                            <tr key={`${a.etapa}-${a.codigo}`} className="border-t border-[#D6DEEA]/60">
                              <td className="px-2.5 py-1.5 font-bold text-gray-900">{a.fase}</td>
                              <td className="px-2.5 py-1.5">
                                {a.nombre} <span className="font-mono text-gray-500">({a.codigo})</span>
                              </td>
                              <td className="px-2.5 py-1.5">{a.rol}</td>
                              <td className="px-2.5 py-1.5 font-mono">{formatMoment(a.primeraAccion)}</td>
                              <td className="px-2.5 py-1.5 font-mono">{formatMoment(a.ultimaAccion)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#D6DEEA] shadow-xs">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-2">
                  Observaciones Técnicas y Liberación de Calidad
                </h3>
                <textarea
                  value={localObservaciones}
                  onChange={(e) => setLocalObservaciones(e.target.value)}
                  onBlur={handleSaveObservaciones}
                  rows={3}
                  placeholder={observacionesPlaceholder}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-hidden"
                />
              </div>

              <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                <span className="material-symbols-outlined text-emerald-700 text-[22px] shrink-0 mt-0.5">verified</span>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">Constancia Digital del Lote · Verificación en Pantalla</h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                    {constanciaTexto} <strong>{loteMostrado}</strong> quedan guardados directamente en la bitácora digital de planta.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {showConfirmAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl border-2 border-amber-300 shadow-2xl p-6 flex flex-col gap-5 animate-scaleUp">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[28px]">warning</span>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800">
                  Advertencia de Cierre Definitivo
                </span>
                <h3 className="text-base sm:text-lg font-black text-gray-900 leading-snug">¿Deseas finalizar el lote?</h3>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 font-bold leading-relaxed">
              Una vez terminado el proceso no se podrá modificar. ¿Deseas finalizar el lote?
            </div>
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-1.5 text-xs text-gray-600">
              <div className="flex justify-between items-center">
                <span className="font-bold">Lote:</span>
                <span className="font-mono font-black text-gray-900">{loteMostrado}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold">Producto:</span>
                <span className="font-semibold text-gray-800">{productName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold">Responsable:</span>
                <span className="font-semibold text-gray-800">{responsable}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
              <button
                type="button"
                className="h-10 px-4 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-all text-xs cursor-pointer"
                onClick={() => setShowConfirmAlert(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="h-10 px-5 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-md text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                onClick={handleConfirmFinalize}
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Aceptar / Finalizar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
