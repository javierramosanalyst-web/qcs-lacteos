import React, { useMemo, useState } from 'react';
import { Modal } from '../../../components/ui';
import { AuditLogEntry } from '../../../types';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
  onCorrectBatch?: (log: AuditLogEntry) => void;
}

type AuditTab = 'todos' | 'corregidos' | 'anulados';

const esAnulacion = (log: AuditLogEntry) => log.action === 'ANULACION';

const DatosLote: React.FC<{ log: AuditLogEntry }> = ({ log }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
    <span className="flex items-center gap-1 text-gray-700 min-w-0">
      <span className="material-symbols-outlined text-[14px] text-[#1B4E9B]">inventory_2</span>
      <span className="font-bold break-words">{log.productName ?? 'Producto no identificado'}</span>
    </span>
    <span className="flex items-center gap-1 text-gray-600 min-w-0">
      <span className="material-symbols-outlined text-[14px] text-gray-500">badge</span>
      <span className="break-words">
        Responsable: <strong className="text-gray-800">{log.responsibleName ?? '—'}</strong>
      </span>
    </span>
  </div>
);

const BotonCorregir: React.FC<{ log: AuditLogEntry; onCorrect?: (log: AuditLogEntry) => void }> = ({ log, onCorrect }) => {
  if (!onCorrect || !log.loteId || log.batchStatus === 'ANULADO') return null;
  return (
    <button
      type="button"
      onClick={() => onCorrect(log)}
      className="self-start sm:self-end inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1B4E9B] hover:bg-[#163F7D] text-white text-[11px] font-bold transition-all cursor-pointer"
    >
      <span className="material-symbols-outlined text-[15px]">edit</span>
      Corregir lote
    </button>
  );
};

const CardCorreccion: React.FC<{ log: AuditLogEntry; onCorrect?: (log: AuditLogEntry) => void }> = ({ log, onCorrect }) => (
  <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col gap-2.5 min-w-0 hover:border-blue-300 transition-all">
    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#D6DEEA]/60">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className="text-xs font-bold text-[#1B4E9B] break-all">{log.batchId}</span>
        <span className="text-gray-300">|</span>
        <span className="text-xs font-semibold text-gray-700">{log.lineName}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-[#1B4E9B] border border-blue-200 font-bold uppercase">
          {log.stageLabel}
        </span>
      </div>
      <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">schedule</span>
        <span>{log.dateStr}</span>
      </div>
    </div>

    <DatosLote log={log} />

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
      <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-wrap justify-between items-center gap-1">
        <span className="text-gray-500">{log.fieldLabel} (Previo):</span>
        <span className="font-bold text-gray-700 font-mono line-through">
          {log.oldValue} {log.unit}
        </span>
      </div>
      <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 flex flex-wrap justify-between items-center gap-1">
        <span className="text-red-800 font-medium">Rectificado a:</span>
        <span className="font-black text-red-700 font-mono">
          {log.newValue} {log.unit}
        </span>
      </div>
    </div>

    <div className="text-xs bg-[#FFFFFF] p-3 rounded-xl border border-[#D6DEEA] flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[11px] text-amber-800 font-bold">
        <span className="material-symbols-outlined text-[14px]">label</span>
        <span>Motivo: {log.reasonCategory}</span>
      </div>
      <div className="text-gray-800 italic mt-0.5 break-words">"{log.justificationText}"</div>
      <div className="text-[10px] text-gray-500 mt-1 flex flex-wrap items-center justify-between gap-1">
        <span>Autorizado por: <strong className="text-gray-700">{log.adminName}</strong></span>
        <span className="text-emerald-700 font-bold flex items-center gap-0.5">
          <span className="material-symbols-outlined text-[13px]">check_circle</span>
          Certificado BPM
        </span>
      </div>
    </div>

    <BotonCorregir log={log} onCorrect={onCorrect} />
  </div>
);

const CardAnulacion: React.FC<{ log: AuditLogEntry }> = ({ log }) => (
  <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-red-200 shadow-2xs flex flex-col gap-2.5 min-w-0 hover:border-red-400 transition-all">
    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-red-100">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className="text-xs font-bold text-[#1B4E9B] break-all">{log.batchId}</span>
        <span className="text-gray-300">|</span>
        <span className="text-xs font-semibold text-gray-700">{log.lineName}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-bold uppercase flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">block</span>
          Lote anulado
        </span>
      </div>
      <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">schedule</span>
        <span>{log.dateStr}</span>
      </div>
    </div>

    <DatosLote log={log} />

    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 flex flex-wrap justify-between items-center gap-1 text-xs">
      <span className="text-red-800 font-medium">{log.fieldLabel}:</span>
      <span className="font-mono font-bold text-gray-600 line-through">{log.oldValue}</span>
      <span className="material-symbols-outlined text-[16px] text-red-500">arrow_forward</span>
      <span className="font-black text-red-700 font-mono">{log.newValue}</span>
    </div>

    <div className="text-xs bg-[#FFFFFF] p-3 rounded-xl border border-[#D6DEEA] flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[11px] text-amber-800 font-bold">
        <span className="material-symbols-outlined text-[14px]">label</span>
        <span>Motivo: {log.reasonCategory}</span>
      </div>
      <div className="text-gray-800 italic mt-0.5 break-words">"{log.justificationText}"</div>
      <div className="text-[10px] text-gray-500 mt-1 flex flex-wrap items-center justify-between gap-1">
        <span>Anulado por: <strong className="text-gray-700">{log.adminName}</strong></span>
        <span className="text-red-700 font-bold flex items-center gap-0.5">
          <span className="material-symbols-outlined text-[13px]">gpp_bad</span>
          Lote fuera de inventario
        </span>
      </div>
    </div>
  </div>
);

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  logs,
  onCorrectBatch,
}) => {
  const [activeTab, setActiveTab] = useState<AuditTab>('todos');

  const { corregidos, anulados } = useMemo(
    () => ({
      corregidos: logs.filter((log) => !esAnulacion(log)),
      anulados: logs.filter(esAnulacion),
    }),
    [logs]
  );

  if (!isOpen) return null;

  const tabClass = (tab: AuditTab) =>
    `py-3 text-[11px] sm:text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
      activeTab === tab ? 'border-[#1B4E9B] text-[#1B4E9B]' : 'border-transparent text-gray-500 hover:text-gray-800'
    }`;

  const seccion = (titulo: string, icono: string, items: AuditLogEntry[], tipo: 'corregidos' | 'anulados') => {
    if (items.length === 0) return null;
    return (
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 sticky top-0 z-10 bg-[#FFFFFF]/95 backdrop-blur-xs py-1">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
            <span className={`material-symbols-outlined text-[16px] ${tipo === 'anulados' ? 'text-red-600' : 'text-[#1B4E9B]'}`}>
              {icono}
            </span>
            {titulo}
          </h3>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            tipo === 'anulados'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-blue-50 text-[#1B4E9B] border-blue-200'
          }`}>
            {items.length}
          </span>
        </div>
        {items.map((log) =>
          tipo === 'anulados' ? (
            <CardAnulacion key={log.id} log={log} />
          ) : (
            <CardCorreccion key={log.id} log={log} onCorrect={onCorrectBatch} />
          )
        )}
      </section>
    );
  };

  const vacio = (texto: string, icono: string) => (
    <div className="p-8 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
      <span className="material-symbols-outlined text-[36px] text-gray-400">{icono}</span>
      <span>{texto}</span>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      icon="history_edu"
      title="Registro de Auditoría e Inocuidad (Audit Trail)"
      subtitle="Historial inmutable de rectificaciones técnicas y anulaciones de lote"
      tabs={
        <div className="flex px-4 sm:px-6 gap-4 sm:gap-6 overflow-x-auto">
          <button onClick={() => setActiveTab('todos')} className={tabClass('todos')}>
            Todos ({logs.length})
          </button>
          <button onClick={() => setActiveTab('corregidos')} className={tabClass('corregidos')}>
            Lotes corregidos ({corregidos.length})
          </button>
          <button onClick={() => setActiveTab('anulados')} className={tabClass('anulados')}>
            Lotes anulados ({anulados.length})
          </button>
        </div>
      }
      footer={
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800 transition-all cursor-pointer"
        >
          Cerrar Auditoría
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA] flex items-center justify-between gap-2">
            <span className="text-gray-600 font-semibold">Registros totales</span>
            <strong className="text-[#1B4E9B] text-sm">{logs.length}</strong>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-2">
            <span className="text-[#1B4E9B] font-semibold">Lotes corregidos</span>
            <strong className="text-[#1B4E9B] text-sm">{corregidos.length}</strong>
          </div>
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-2">
            <span className="text-red-800 font-semibold">Lotes anulados</span>
            <strong className="text-red-700 text-sm">{anulados.length}</strong>
          </div>
        </div>

        {logs.length === 0
          ? vacio('No hay registros de auditoría. Todos los valores se mantienen conforme a captura de línea.', 'verified')
          : activeTab === 'corregidos'
            ? corregidos.length === 0
              ? vacio('No hay lotes corregidos registrados.', 'edit_note')
              : <div className="flex flex-col gap-3">{corregidos.map((log) => <CardCorreccion key={log.id} log={log} onCorrect={onCorrectBatch} />)}</div>
            : activeTab === 'anulados'
              ? anulados.length === 0
                ? vacio('No hay lotes anulados registrados.', 'block')
                : <div className="flex flex-col gap-3">{anulados.map((log) => <CardAnulacion key={log.id} log={log} />)}</div>
              : (
                <div className="flex flex-col gap-5">
                  {seccion('Lotes corregidos', 'edit_note', corregidos, 'corregidos')}
                  {seccion('Lotes anulados', 'block', anulados, 'anulados')}
                </div>
              )}
      </div>
    </Modal>
  );
};
