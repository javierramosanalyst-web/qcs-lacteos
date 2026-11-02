import React from 'react';
import { Modal } from '../../../components/ui';
import { AuditLogEntry } from '../../../types';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  logs,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      icon="history_edu"
      title="Registro de Auditoría e Inocuidad (Audit Trail)"
      subtitle="Historial inmutable de rectificaciones técnicas y justificaciones de calidad"
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
        <div className="text-xs text-gray-600 bg-[#FFFFFF] p-3 rounded-xl border border-[#D6DEEA]">
          Total de rectificaciones registradas en la planta:{' '}
          <strong className="text-[#1B4E9B]">{logs.length}</strong> · Cada cambio cuenta con firma digital de Administrador y justificación técnica validada.
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-[36px] text-gray-400">verified</span>
            <span>No hay rectificaciones registradas. Todos los valores se mantienen conforme a captura de línea.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col gap-2.5 hover:border-blue-300 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#D6DEEA]/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1B4E9B]">{log.batchId}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-xs font-semibold text-gray-700">{log.lineName}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-[#1B4E9B] border border-blue-200 font-bold uppercase">
                      {log.stageLabel}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    <span>{log.dateStr}</span>
                  </div>
                </div>

                {/* Diff */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 flex justify-between items-center">
                    <span className="text-gray-500">{log.fieldLabel} (Previo):</span>
                    <span className="font-bold text-gray-700 font-mono line-through">
                      {log.oldValue} {log.unit}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 flex justify-between items-center">
                    <span className="text-red-800 font-medium">Rectificado a:</span>
                    <span className="font-black text-red-700 font-mono">
                      {log.newValue} {log.unit}
                    </span>
                  </div>
                </div>

                {/* Reason & Justification */}
                <div className="text-xs bg-[#FFFFFF] p-3 rounded-xl border border-[#D6DEEA] flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-[11px] text-amber-800 font-bold">
                    <span className="material-symbols-outlined text-[14px]">label</span>
                    <span>Motivo: {log.reasonCategory}</span>
                  </div>
                  <div className="text-gray-800 italic mt-0.5">
                    "{log.justificationText}"
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 flex items-center justify-between">
                    <span>Autorizado por: <strong className="text-gray-700">{log.adminName}</strong></span>
                    <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                      Certificado BPM
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
