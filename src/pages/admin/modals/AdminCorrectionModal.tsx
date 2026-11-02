import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui';
import { AuditLogEntry, BatchData } from '../../../types';
import { getCurrentTimeString } from '../../../utils/timer';

interface AdminCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: BatchData;
  adminName: string;
  onApplyCorrection: (updatedBatch: BatchData, logEntry: AuditLogEntry) => Promise<string | null>;
}

interface EditableField {
  key: string;
  stageId: 'acidificar' | 'calentar-y-cuajar' | 'desuerar' | 'hilar';
  stageLabel: string;
  label: string;
  unit: string;
  getValue: (b: BatchData) => number;
  applyValue: (b: BatchData, val: number) => BatchData;
}

const EDITABLE_FIELDS: EditableField[] = [

  {
    key: 'desuerar.temperaturaVerificada',
    stageId: 'desuerar',
    stageLabel: 'Desuerar',
    label: 'Temperatura Verificada en Desuerado',
    unit: '°C',
    getValue: (b) => b.desuerar.temperaturaVerificada,
    applyValue: (b, val) => ({
      ...b,
      desuerar: { ...b.desuerar, temperaturaVerificada: val },
    }),
  },
  {
    key: 'desuerar.acidezSuero',
    stageId: 'desuerar',
    stageLabel: 'Desuerar',
    label: 'Acidez del Lactosuero',
    unit: '% LA',
    getValue: (b) => b.desuerar.acidezSuero,
    applyValue: (b, val) => ({
      ...b,
      desuerar: { ...b.desuerar, acidezSuero: val },
    }),
  },
  {
    key: 'acidificar.insumos.lecheFresca',
    stageId: 'acidificar',
    stageLabel: 'Acidificar',
    label: 'Volumen Leche Fresca',
    unit: 'L',
    getValue: (b) => b.acidificar.insumos.lecheFresca,
    applyValue: (b, val) => ({
      ...b,
      acidificar: {
        ...b.acidificar,
        insumos: { ...b.acidificar.insumos, lecheFresca: val },
      },
    }),
  },
  {
    key: 'acidificar.insumos.lecheAcida',
    stageId: 'acidificar',
    stageLabel: 'Acidificar',
    label: 'Volumen Leche Ácida (Base)',
    unit: 'L',
    getValue: (b) => b.acidificar.insumos.lecheAcida,
    applyValue: (b, val) => ({
      ...b,
      acidificar: {
        ...b.acidificar,
        insumos: { ...b.acidificar.insumos, lecheAcida: val },
      },
    }),
  },
  {
    key: 'acidificar.insumos.phMezcla',
    stageId: 'acidificar',
    stageLabel: 'Acidificar',
    label: 'Medición de pH de la Leche (Obj: 5.7, Rango: 5.6-5.8)',
    unit: 'pH',
    getValue: (b) => b.acidificar.insumos.phMezcla ?? 5.7,
    applyValue: (b, val) => ({
      ...b,
      acidificar: {
        ...b.acidificar,
        insumos: { ...b.acidificar.insumos, phMezcla: val },
      },
    }),
  },
  {
    key: 'acidificar.insumos.cultivoLacteoGramos',
    stageId: 'acidificar',
    stageLabel: 'Acidificar',
    label: 'Cantidad de Ácido Acético (Línea Industrial)',
    unit: 'ml',
    getValue: (b) => b.acidificar.insumos.cultivoLacteoGramos ?? 15.0,
    applyValue: (b, val) => ({
      ...b,
      acidificar: {
        ...b.acidificar,
        insumos: { ...b.acidificar.insumos, cultivoLacteoGramos: val },
      },
      lotesLeche: {
        ...b.lotesLeche,
        cultivoLacteoGramos: val,
      },
    }),
  },
  {
    key: 'hilar.tempBano',
    stageId: 'hilar',
    stageLabel: 'Hilar',
    label: 'Temperatura del Baño de Hilado',
    unit: '°C',
    getValue: (b) => b.hilar.tempBano,
    applyValue: (b, val) => ({
      ...b,
      hilar: { ...b.hilar, tempBano: val },
    }),
  },
  {
    key: 'hilar.phActual',
    stageId: 'hilar',
    stageLabel: 'Hilar',
    label: 'pH de Hilado',
    unit: 'pH',
    getValue: (b) => b.hilar.phActual,
    applyValue: (b, val) => ({
      ...b,
      hilar: { ...b.hilar, phActual: val },
    }),
  },
  {
    key: 'hilar.pesoTotalQueso',
    stageId: 'hilar',
    stageLabel: 'Hilar',
    label: 'Peso Total Queso Obtenido',
    unit: 'kg',
    getValue: (b) => b.hilar.pesoTotalQueso,
    applyValue: (b, val) => ({
      ...b,
      hilar: { ...b.hilar, pesoTotalQueso: val },
    }),
  },
  {
    key: 'hilar.numeroMoldes',
    stageId: 'hilar',
    stageLabel: 'Hilar',
    label: 'Número de Moldes Llenados',
    unit: 'unid',
    getValue: (b) => b.hilar.numeroMoldes,
    applyValue: (b, val) => ({
      ...b,
      hilar: { ...b.hilar, numeroMoldes: Math.round(val) },
    }),
  },
];

const REASON_CATEGORIES = [
  'Error de lectura de instrumento / sensor descalibrado',
  'Corrección de muestra analizada en laboratorio de calidad',
  'Error de digitación o transcripción del operario',
  'Ajuste por tara o calibración de báscula de piso',
  'Desviación técnica justificada por Jefe de Turno',
  'Falla en sensor PT-100 / caudalímetro reemplazado',
];

export const AdminCorrectionModal: React.FC<AdminCorrectionModalProps> = ({
  isOpen,
  onClose,
  batch,
  adminName,
  onApplyCorrection,
}) => {
  const [selectedKey, setSelectedKey] = useState<string>(EDITABLE_FIELDS[0].key);
  const currentField = EDITABLE_FIELDS.find((f) => f.key === selectedKey) || EDITABLE_FIELDS[0];
  const currentValue = currentField.getValue(batch);

  const [newValueInput, setNewValueInput] = useState<string>(() => currentValue.toString());
  const [reasonCategory, setReasonCategory] = useState<string>(REASON_CATEGORIES[0]);
  const [justification, setJustification] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setNewValueInput(currentField.getValue(batch).toString());
    setErrorMsg('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectField = (key: string) => {
    setSelectedKey(key);
    const field = EDITABLE_FIELDS.find((f) => f.key === key);
    if (field) {
      setNewValueInput(field.getValue(batch).toString());
    }
    setErrorMsg('');
  };

  const isJustificationValid = justification.trim().length >= 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedNewValue = parseFloat(newValueInput);

    if (isNaN(parsedNewValue)) {
      setErrorMsg('Por favor ingresa un valor numérico válido.');
      return;
    }

    if (parsedNewValue === currentValue) {
      setErrorMsg('El nuevo valor debe ser diferente del valor actual registrado.');
      return;
    }

    if (!isJustificationValid) {
      setErrorMsg('La justificación técnica es obligatoria y debe tener al menos 20 caracteres.');
      return;
    }

    const updatedBatch = currentField.applyValue(batch, parsedNewValue);

    const logEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      batchId: batch.id,
      lineName: batch.line,
      timestamp: Date.now(),
      dateStr: getCurrentTimeString(),
      adminName,
      stageId: currentField.stageId,
      stageLabel: currentField.stageLabel,
      fieldKey: currentField.key,
      fieldLabel: currentField.label,
      oldValue: currentValue,
      newValue: parsedNewValue,
      unit: currentField.unit,
      reasonCategory,
      justificationText: justification.trim(),
    };

    setSaving(true);
    const error = await onApplyCorrection(updatedBatch, logEntry);
    setSaving(false);
    if (error) {
      setErrorMsg(error);
      return;
    }
    setJustification('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      icon="admin_panel_settings"
      title="Corrección Justificada de Dato en Proceso"
      subtitle={`Lote: ${batch.id} · ${batch.line} · Operador: ${batch.operator}`}
      badge={
        <span className="text-[10px] font-bold uppercase tracking-widest text-red-800 bg-red-100 px-2.5 py-0.5 rounded-full border border-red-300">
          Modo Auditoría · Nivel Administrador
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Step 1: Select Variable */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-800 flex items-center justify-between">
              <span>1. SELECCIONA LA VARIABLE DEL PROCESO A CORREGIR</span>
              <span className="text-[11px] text-[#1B4E9B] font-semibold">
                Etapa: {currentField.stageLabel}
              </span>
            </label>
            <select
              value={selectedKey}
              onChange={(e) => handleSelectField(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA] text-sm font-bold text-[#191c1e] outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
            >
              {EDITABLE_FIELDS.map((field) => (
                <option key={field.key} value={field.key}>
                  [{field.stageLabel}] {field.label} ({field.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Old Value */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-300 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-gray-500">
                VALOR ACTUAL EN BITÁCORA
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-black font-mono text-gray-700">
                  {currentValue}
                </span>
                <span className="text-sm font-bold text-gray-500">{currentField.unit}</span>
              </div>
              <span className="text-[10px] text-gray-500 mt-1">
                Registrado por operario de turno
              </span>
            </div>

            {/* New Value Input */}
            <div className="p-4 rounded-2xl bg-red-50/50 border border-red-300 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-red-800">
                NUEVO VALOR CORREGIDO
              </span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  value={newValueInput}
                  onChange={(e) => {
                    setNewValueInput(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full bg-white px-3 py-1.5 rounded-xl border border-red-300 text-2xl font-black font-mono text-red-900 outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="0.0"
                  required
                />
                <span className="text-sm font-bold text-red-800 shrink-0">{currentField.unit}</span>
              </div>
              <span className="text-[10px] text-red-700 font-semibold mt-1">
                Rectificación técnica auditada
              </span>
            </div>
          </div>

          {/* Reason Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-800">
              2. CAUSAL O MOTIVO TIPIFICADO DEL CAMBIO
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA] text-xs font-medium text-gray-800 outline-none focus:border-red-600"
            >
              {REASON_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Justification Textarea (MANDATORY >= 20 chars) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <span>3. JUSTIFICACIÓN TÉCNICA OBLIGATORIA</span>
                <span className="text-red-600 font-bold">*</span>
              </label>
              <span
                className={`text-[11px] font-bold ${
                  isJustificationValid ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {justification.trim().length} / 20 caracteres requeridos{' '}
                {isJustificationValid ? '✓' : '(Mínimo 20 obligatorios)'}
              </span>
            </div>

            <textarea
              rows={3}
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
                setErrorMsg('');
              }}
              placeholder="Explica en detalle el motivo técnico por el cual se rectifica este parámetro (ej: Se recalibra instrumento de medición tras lectura anómala verificada con sensor patrón...)"
              className="w-full p-3 rounded-xl bg-white border border-[#D6DEEA] text-xs text-gray-900 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 placeholder:text-gray-400"
              required
            />
            <p className="text-[10px] text-gray-500">
              Nota legal: Esta justificación se almacenará de manera inmutable en el <strong>Audit Trail</strong> del lote con firma del Administrador ({adminName}).
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-100 border border-red-300 text-xs font-bold text-red-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D6DEEA]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isJustificationValid || saving}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all ${
                isJustificationValid
                  ? 'bg-red-700 hover:bg-red-800 text-white cursor-pointer active:scale-95'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span>Confirmar Corrección y Registrar Auditoría</span>
            </button>
          </div>
        </form>
    </Modal>
  );
};
