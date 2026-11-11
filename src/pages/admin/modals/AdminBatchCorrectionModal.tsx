import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../../../components/ui';

export interface BatchCorrectionPayload {
  path: string;
  stageLabel: string;
  label: string;
  oldValue: number;
  newValue: number;
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

interface FlatField {
  path: string;
  stageLabel: string;
  label: string;
  value: number;
}

const SKIP_KEY = /(timer|timestamp|fecha|hora|time|At$|Ms$|^id$|version|elapsed|segundos|startedAt|endedAt)/i;

const REASON_CATEGORIES = [
  'Error de lectura de instrumento / sensor descalibrado',
  'Corrección de muestra analizada en laboratorio de calidad',
  'Error de digitación o transcripción del operario',
  'Ajuste por tara o calibración de báscula de piso',
  'Desviación técnica justificada por Jefe de Turno',
  'Falla en sensor PT-100 / caudalímetro reemplazado',
];

const humanize = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

const STAGE_ORDER = [
  'acidificar',
  'calentar y cuajar',
  'desuerar',
  'hilar',
  'moldear',
  'pasteurizacion',
  'inoculacion',
  'maduracion frio',
  'batido y adiciones',
  'envasado',
];

const stageRank = (label: string): number => {
  const norm = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const idx = STAGE_ORDER.findIndex((s) => norm === s || norm.startsWith(s));
  return idx === -1 ? STAGE_ORDER.length : idx;
};

type ProductScope = 'kumis' | 'yogur' | 'griego' | 'otro';

const SCOPE_LABEL: Record<ProductScope, string> = {
  kumis: 'Kumis',
  yogur: 'Yogur',
  griego: 'Yogur Griego',
  otro: '',
};

const resolveScope = (productId?: string): ProductScope => {
  if (productId === 'prod-kumis') return 'kumis';
  if (productId === 'prod-yogur') return 'yogur';
  if (productId === 'prod-yogur-griego') return 'griego';
  return 'otro';
};

const KUMIS_FIELD = /(^|\.)(litrosKumis|litrosKumisDestinados|formatosKumis|kumis[A-Z][A-Za-z0-9]*)(\.|$)/;
const GRIEGO_FIELD =
  /(^|\.)(litrosYogurGriego|extraccionGriego|formatosSinEstevia|formatosConEstevia|variedadSinEstevia|variedadConEstevia)(\.|$)/;
const YOGUR_SIN_AZUCAR = /(^|\.)(litrosYogurSinAzucar|variedadSinAzucar|sinAzucar_[A-Za-z0-9]+)(\.|$)/;
const YOGUR_ESTEVIA = /(^|\.)(variedadEstevia|stevia_[A-Za-z0-9]+|botella120ml)(\.|$)/;
const YOGUR_AZUCAR = /(^|\.)(litrosYogurConAzucar|variedadAzucar)(\.|$)/;
const YOGUR_FORMATOS = /(^|\.)formatos\.(botella200ml|botella1000g|botella500g|vaso200g|vaso150g)(\.|$)/;
const YOGUR_ADICIONES_EXTRA =
  /(^|\.)(sabor|saborizanteMl|loteSaborizante|coloranteMl|loteColorante|kilosSaborizante)(\.|$)/;

const yogurVariedades = (batch: any) => {
  const adiciones = batch?.batidoYAdiciones?.adiciones ?? {};
  const division = batch?.pasteurizacion?.divisionLeche ?? {};
  return {
    sinAzucar: adiciones.tipoYogur === 'sin_azucar' || Number(division.litrosYogurSinAzucar) > 0,
    estevia: adiciones.tipoYogur === 'con_estevia' || Number(adiciones.variedadEstevia?.litrosBase) > 0,
    azucar: adiciones.tipoYogur === 'con_azucar' || Number(division.litrosYogurConAzucar) > 0,
  };
};

const loteIncluyeKumis = (batch: any): boolean =>
  Boolean(batch?.pasteurizacion?.incluyeKumis) ||
  Number(batch?.pasteurizacion?.litrosKumisDestinados) > 0 ||
  Number(batch?.pasteurizacion?.divisionLeche?.litrosKumis) > 0;

const isForeignField = (path: string, scope: ProductScope, batch: any): boolean => {
  if (scope === 'otro') return false;

  if (scope === 'kumis') {
    return (
      /(^|\.)(litrosYogurConAzucar|litrosYogurSinAzucar|litrosYogurGriego|litrosKumisDestinados)(\.|$)/.test(path) ||
      GRIEGO_FIELD.test(path) ||
      /(^|\.)formatosKumis(\.|$)/.test(path) ||
      /(^|\.)(variedadSinAzucar|variedadEstevia|variedadNatural)(\.|$)/.test(path) ||
      /(^|\.)(sinAzucar_[A-Za-z0-9]+|stevia_[A-Za-z0-9]+)(\.|$)/.test(path) ||
      YOGUR_FORMATOS.test(path) ||
      YOGUR_ADICIONES_EXTRA.test(path)
    );
  }

  if (scope === 'yogur') {
    if (GRIEGO_FIELD.test(path)) return true;
    if (/(^|\.)formatosKumis(\.|$)/.test(path)) return true;
    if (/(^|\.)formulacion(\.|$)/.test(path)) return true;
    if (/(^|\.)temperaturaIncubacion(\.|$)/.test(path)) return true;
    if (
      /(^|\.)variedadNatural(\.|$)/.test(path) &&
      Number(batch?.batidoYAdiciones?.adiciones?.variedadNatural?.litrosBase) <= 0
    ) {
      return true;
    }
    if (KUMIS_FIELD.test(path) && !loteIncluyeKumis(batch)) return true;
    const variedades = yogurVariedades(batch);
    if (!variedades.sinAzucar && YOGUR_SIN_AZUCAR.test(path)) return true;
    if (!variedades.estevia && YOGUR_ESTEVIA.test(path)) return true;
    if (!variedades.azucar && YOGUR_AZUCAR.test(path)) return true;
    return false;
  }

  return (
    /(^|\.)(litrosYogurConAzucar|litrosYogurSinAzucar|litrosKumis|litrosKumisDestinados)(\.|$)/.test(path) ||
    /(^|\.)(kumis[A-Z][A-Za-z0-9]*|formatosKumis|extraccionKumis)(\.|$)/.test(path) ||
    /(^|\.)(variedadSinAzucar|variedadAzucar|variedadEstevia|variedadNatural)(\.|$)/.test(path) ||
    /(^|\.)(sinAzucar_[A-Za-z0-9]+|stevia_[A-Za-z0-9]+)(\.|$)/.test(path) ||
    /(^|\.)adiciones(\.|$)/.test(path) ||
    YOGUR_FORMATOS.test(path)
  );
};

const flatten = (node: any, trail: string[], out: FlatField[]) => {
  if (node === null || node === undefined) return;
  if (typeof node === 'number') {
    if (!Number.isFinite(node) || Math.abs(node) > 1e11) return;
    const labels = trail.map((t) => (/^\d+$/.test(t) ? `#${Number(t) + 1}` : humanize(t)));
    out.push({
      path: trail.join('.'),
      stageLabel: labels[0] ?? 'Lote',
      label: labels.slice(1).join(' › ') || labels[0] || 'Valor',
      value: node,
    });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => flatten(item, [...trail, String(i)], out));
    return;
  }
  if (typeof node === 'object') {
    Object.keys(node).forEach((k) => {
      if (SKIP_KEY.test(k)) return;
      flatten(node[k], [...trail, k], out);
    });
  }
};

export const AdminBatchCorrectionModal: React.FC<AdminBatchCorrectionModalProps> = ({
  isOpen,
  onClose,
  batch,
  title,
  adminName,
  productId,
  onApply,
}) => {
  const scope = resolveScope(productId);

  const fields = useMemo(() => {
    const out: FlatField[] = [];
    flatten(batch, [], out);
    return out.filter((f) => !isForeignField(f.path, scope, batch));
  }, [batch, scope]);

  const stageGroups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, FlatField[]>();
    fields.forEach((f) => {
      if (!map.has(f.stageLabel)) {
        map.set(f.stageLabel, []);
        order.push(f.stageLabel);
      }
      map.get(f.stageLabel)!.push(f);
    });
    return order
      .map((label, idx) => ({ label, index: idx + 1, items: map.get(label)! }))
      .sort((a, b) => stageRank(a.label) - stageRank(b.label))
      .map((g, idx) => ({ ...g, index: idx + 1 }));
  }, [fields]);

  const [selectedPath, setSelectedPath] = useState('');
  const [newValueInput, setNewValueInput] = useState('');
  const [reasonCategory, setReasonCategory] = useState(REASON_CATEGORIES[0]);
  const [justification, setJustification] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const valueInputRef = useRef<HTMLInputElement>(null);

  const current = fields.find((f) => f.path === selectedPath) ?? fields[0];

  useEffect(() => {
    if (!isOpen) return;
    setSelectedPath(fields[0]?.path ?? '');
    setNewValueInput(fields[0] ? String(fields[0].value) : '');
    setJustification('');
    setErrorMsg('');
  }, [isOpen, fields]);

  if (!isOpen) return null;

  const justificationValid = justification.trim().length >= 20;

  const handleSelect = (path: string) => {
    setSelectedPath(path);
    const f = fields.find((x) => x.path === path);
    setNewValueInput(f ? String(f.value) : '');
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
    const parsed = parseFloat(newValueInput);
    if (isNaN(parsed)) {
      setErrorMsg('Ingresa un valor numérico válido.');
      return;
    }
    if (parsed === current.value) {
      setErrorMsg('El nuevo valor debe ser diferente del valor registrado.');
      return;
    }
    if (!justificationValid) {
      setErrorMsg('La justificación debe tener al menos 20 caracteres.');
      return;
    }
    setSaving(true);
    const error = await onApply({
      path: current.path,
      stageLabel: current.stageLabel,
      label: current.label,
      oldValue: current.value,
      newValue: parsed,
      reasonCategory,
      justification: justification.trim(),
    });
    setSaving(false);
    if (error) {
      setErrorMsg(error);
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
              Este lote no tiene variables numéricas registradas para corregir.
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
                  1. ETAPA Y VARIABLE A CORREGIR
                </label>
                <span className="flex flex-wrap items-center gap-2">
                  {scope !== 'otro' && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
                      Solo variables de {SCOPE_LABEL[scope]}
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-[#1B4E9B]">
                    {stageGroups.length} etapa(s) · {fields.length} variable(s)
                  </span>
                </span>
              </div>
              <div className="space-y-3">
                {stageGroups.map((stage) => (
                  <div key={stage.label} className="p-3 sm:p-4 bg-white rounded-2xl border border-[#D6DEEA]">
                    <h4 className="font-black text-gray-900 text-sm mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#1B4E9B] text-white text-[11px] font-black flex items-center justify-center shrink-0">
                          {stage.index}
                        </span>
                        <span>{stage.label}</span>
                      </span>
                      <span className="text-[10px] font-bold uppercase text-gray-500">
                        {stage.items.length} variable(s)
                      </span>
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {stage.items.map((f) => {
                        const selected = current?.path === f.path;
                        return (
                          <button
                            key={f.path}
                            type="button"
                            onClick={() => handleSelect(f.path)}
                            aria-pressed={selected}
                            className={`text-left rounded-xl px-2.5 py-2 border transition-all cursor-pointer ${
                              selected
                                ? 'border-red-500 bg-red-50 ring-1 ring-red-200'
                                : 'border-[#E6EBF3] bg-white hover:bg-gray-50'
                            }`}
                          >
                            <span className="block text-[10px] uppercase font-bold text-gray-500 leading-tight">
                              {f.label}
                            </span>
                            <span
                              className={`block text-sm font-black font-mono ${
                                selected ? 'text-red-800' : 'text-gray-800'
                              }`}
                            >
                              {f.value}
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
                  {current ? `${current.stageLabel} › ${current.label}` : '—'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-300 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Valor actual registrado</span>
                  <span className="mt-2 text-3xl font-black font-mono text-gray-700">{current?.value}</span>
                </div>
                <div className="p-4 rounded-2xl bg-red-50 border border-red-300 flex flex-col justify-between">
                  <label
                    htmlFor="batch-correction-new-value"
                    className="text-[10px] uppercase font-bold text-red-800"
                  >
                    Nuevo valor rectificado
                  </label>
                  <input
                    id="batch-correction-new-value"
                    ref={valueInputRef}
                    type="number"
                    step="any"
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
                    {justification.trim().length} / 20
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
