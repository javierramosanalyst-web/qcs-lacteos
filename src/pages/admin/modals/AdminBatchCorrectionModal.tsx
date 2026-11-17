import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../../../components/ui';
import {
  CambioVinculado,
  CampoCorregible,
  camposCorregibles,
  cambiosDeCorreccion,
  lotesUsados,
} from '../../../utils/camposCorreccion';

export interface BatchCorrectionPayload {
  path: string;
  stageLabel: string;
  label: string;
  oldValue: number | string;
  newValue: number | string;
  unit: string;
  /** Todos los datos que cambian (el campo y los que dependen de él). */
  cambios: CambioVinculado[];
  textoAnterior: string;
  textoNuevo: string;
  reasonCategory: string;
  justification: string;
}

interface AdminBatchCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: any;
  title: string;
  adminName: string;
  productId?: string;
  onApply: (payload: BatchCorrectionPayload) => Promise<string | null>;
}

const REASON_CATEGORIES = [
  'Error de lectura de instrumento / sensor descalibrado',
  'Corrección de muestra analizada en laboratorio de calidad',
  'Error de digitación o transcripción del operario',
  'Ajuste por tara o calibración de báscula de piso',
  'Desviación técnica justificada por Jefe de Turno',
  'Falla en sensor PT-100 / caudalímetro reemplazado',
  'Corte de energía o falla de la tableta: se registra la hora real',
];

export const AdminBatchCorrectionModal: React.FC<AdminBatchCorrectionModalProps> = ({
  isOpen,
  onClose,
  batch,
  title,
  adminName,
  productId,
  onApply,
}) => {
  const fields = useMemo(() => camposCorregibles(batch, productId ?? ''), [batch, productId]);
  const lotes = useMemo(() => lotesUsados(batch, productId ?? ''), [batch, productId]);

  const stageGroups = useMemo(() => {
    const map = new Map<string, CampoCorregible[]>();
    fields.forEach((f) => {
      if (!map.has(f.etapaLabel)) map.set(f.etapaLabel, []);
      map.get(f.etapaLabel)!.push(f);
    });
    return Array.from(map, ([label, items]) => ({ label, items }));
  }, [fields]);

  const [selectedId, setSelectedId] = useState('');
  const [newValueInput, setNewValueInput] = useState('');
  const [reasonCategory, setReasonCategory] = useState(REASON_CATEGORIES[0]);
  const [justification, setJustification] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const valueInputRef = useRef<HTMLInputElement>(null);

  const current = fields.find((f) => f.id === selectedId) ?? fields[0];

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(fields[0]?.id ?? '');
    setNewValueInput(fields[0] ? String(fields[0].valor) : '');
    setJustification('');
    setErrorMsg('');
  }, [isOpen, fields]);

  if (!isOpen) return null;

  const justificationValid = justification.trim().length >= 15;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const f = fields.find((x) => x.id === id);
    setNewValueInput(f ? String(f.valor) : '');
    setErrorMsg('');
    requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 1023px)').matches) {
        valueInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      valueInputRef.current?.focus({ preventScroll: true });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    let nuevo: number | string;
    let textoNuevo: string;
    if (current.tipo === 'numero') {
      const parsed = parseFloat(newValueInput.replace(',', '.'));
      if (isNaN(parsed)) {
        setErrorMsg('Ingresa un valor numérico válido.');
        return;
      }
      if (parsed === current.valor) {
        setErrorMsg('El nuevo valor debe ser diferente del valor registrado.');
        return;
      }
      nuevo = parsed;
      textoNuevo = `${parsed}${current.unidad && current.unidad !== 'unid' ? ` ${current.unidad}` : ''}`;
    } else {
      const h = newValueInput.length === 5 ? `${newValueInput}:00` : newValueInput;
      if (h === current.valor) {
        setErrorMsg('La nueva hora debe ser diferente de la registrada.');
        return;
      }
      nuevo = h;
      textoNuevo = h;
    }
    if (!justificationValid) {
      setErrorMsg('La justificación debe tener al menos 15 caracteres.');
      return;
    }
    const { cambios, error } = cambiosDeCorreccion(batch, productId ?? '', current, nuevo);
    if (error) {
      setErrorMsg(error);
      return;
    }
    const principal = cambios.find((c) => c.path === current.path);
    setSaving(true);
    const result = await onApply({
      path: current.path,
      stageLabel: current.etapaLabel,
      label: current.label,
      oldValue: current.valor,
      newValue: (principal?.value as number | string) ?? nuevo,
      unit: current.unidad,
      cambios,
      textoAnterior: current.texto,
      textoNuevo: current.tipo === 'hora' ? String(principal?.value ?? textoNuevo) : textoNuevo,
      reasonCategory,
      justification: justification.trim(),
    });
    setSaving(false);
    if (result) {
      setErrorMsg(result);
      return;
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="5xl"
      icon="admin_panel_settings"
      title="Corrección Justificada de Dato"
      subtitle={title}
      bodyClassName="p-0 overflow-y-auto lg:overflow-hidden lg:flex lg:flex-col min-h-0"
      badge={
        <span className="text-[10px] font-bold uppercase tracking-widest text-red-800 bg-red-100 px-2.5 py-0.5 rounded-full border border-red-300">
          Modo Auditoría · Administrador
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0">
        {fields.length === 0 ? (
          <div className="w-full p-5 sm:p-6 flex flex-col gap-4">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs font-bold text-amber-900">
              Este lote todavía no tiene datos registrados que se puedan corregir.
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D6DEEA]">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="lg:w-[54%] lg:min-w-0 lg:overflow-y-auto p-5 sm:p-6 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-gray-800">
                  1. ETAPA Y DATO A CORREGIR
                </label>
                <span className="text-[11px] font-bold text-[#1B4E9B]">
                  {stageGroups.length} etapa(s) · {fields.length} dato(s)
                </span>
              </div>
              <p className="text-[11px] text-gray-500 -mt-1">
                Cantidades, mediciones y horas que registró el operario. Al corregir una hora se recalculan
                solas las duraciones que dependen de ella.
              </p>
              {lotes.length > 0 && (
                <details className="p-3 rounded-2xl bg-[#F7F9FC] border border-[#D6DEEA]">
                  <summary className="text-xs font-black text-gray-800 cursor-pointer">
                    Lotes de insumos usados ({lotes.length}) · solo consulta
                  </summary>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {lotes.map((l) => (
                      <div key={`${l.label}-${l.codigo}`} className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E6EBF3]">
                        <span className="block text-[10px] uppercase font-bold text-gray-500 leading-tight">
                          {l.etapaLabel} › {l.label}
                        </span>
                        <span className="block text-xs font-black font-mono text-gray-800 break-all">{l.codigo}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <div className="space-y-3">
                {stageGroups.map((stage, idx) => (
                  <div key={stage.label} className="p-3 sm:p-4 bg-white rounded-2xl border border-[#D6DEEA]">
                    <h4 className="font-black text-gray-900 text-sm mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#1B4E9B] text-white text-[11px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span>{stage.label}</span>
                      </span>
                      <span className="text-[10px] font-bold uppercase text-gray-500">
                        {stage.items.length} dato(s)
                      </span>
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {stage.items.map((f) => {
                        const selected = current?.id === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleSelect(f.id)}
                            aria-pressed={selected}
                            className={`text-left rounded-xl px-2.5 py-2 border transition-all cursor-pointer ${
                              selected
                                ? 'border-red-500 bg-red-50 ring-1 ring-red-200'
                                : 'border-[#E6EBF3] bg-white hover:bg-gray-50'
                            }`}
                          >
                            <span className="block text-[10px] uppercase font-bold text-gray-500 leading-tight">
                              {f.tipo === 'hora' && (
                                <span className="material-symbols-outlined text-[12px] align-[-2px] mr-0.5">schedule</span>
                              )}
                              {f.label}
                            </span>
                            <span
                              className={`block text-sm font-black font-mono ${
                                selected ? 'text-red-800' : 'text-gray-800'
                              }`}
                            >
                              {f.texto}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="lg:w-[46%] lg:min-w-0 lg:overflow-y-auto border-t lg:border-t-0 lg:border-l border-[#D6DEEA] bg-[#FBFCFE] p-5 sm:p-6 flex flex-col gap-4 scroll-mt-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-800">2. RECTIFICACIÓN DEL DATO</span>
                <span className="text-[11px] font-bold text-red-800 break-words">
                  {current ? `${current.etapaLabel} › ${current.label}` : '—'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-300 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Valor actual registrado</span>
                  <span className="mt-2 text-3xl font-black font-mono text-gray-700">{current?.texto}</span>
                </div>
                <div className="p-4 rounded-2xl bg-red-50 border border-red-300 flex flex-col justify-between">
                  <label
                    htmlFor="batch-correction-new-value"
                    className="text-[10px] uppercase font-bold text-red-800"
                  >
                    {current?.tipo === 'hora'
                      ? 'Nueva hora'
                      : `Nuevo valor${current?.unidad && current.unidad !== 'unid' ? ` (${current.unidad})` : ''}`}
                  </label>
                  <input
                    id="batch-correction-new-value"
                    ref={valueInputRef}
                    type={current?.tipo === 'hora' ? 'time' : 'number'}
                    step={current?.tipo === 'hora' ? 1 : 'any'}
                    min={current?.tipo === 'hora' ? undefined : 0}
                    max={current?.esPh ? 14 : undefined}
                    value={newValueInput}
                    onChange={(e) => {
                      setNewValueInput(e.target.value);
                      setErrorMsg('');
                    }}
                    className="mt-2 w-full bg-white px-3 py-1.5 rounded-xl border border-red-300 text-2xl font-black font-mono text-red-900 outline-none focus:ring-2 focus:ring-red-400"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-800">3. CAUSAL DEL CAMBIO</label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-[#D6DEEA] text-xs font-medium text-gray-800 outline-none focus:border-red-600"
                >
                  {REASON_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-gray-800">4. JUSTIFICACIÓN TÉCNICA OBLIGATORIA</label>
                  <span className={`text-[11px] font-bold shrink-0 ${justificationValid ? 'text-emerald-700' : 'text-red-600'}`}>
                    {justification.trim().length} / 15
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={justification}
                  onChange={(e) => {
                    setJustification(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Explica el motivo técnico por el cual se rectifica este parámetro."
                  className="w-full p-3 rounded-xl bg-white border border-[#D6DEEA] text-xs text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 placeholder:text-gray-400"
                  required
                />
                <p className="text-[10px] text-gray-500">
                  Se almacenará de forma inmutable en el Audit Trail del lote con la firma de {adminName}.
                </p>
              </div>
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-100 border border-red-300 text-xs font-bold text-red-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-[#D6DEEA] sticky bottom-0 bg-[#FBFCFE]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!justificationValid || saving || fields.length === 0}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all ${
                    justificationValid && fields.length > 0
                      ? 'bg-red-700 hover:bg-red-800 text-white cursor-pointer active:scale-95'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>{saving ? 'Guardando...' : 'Confirmar Corrección y Registrar Auditoría'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};
