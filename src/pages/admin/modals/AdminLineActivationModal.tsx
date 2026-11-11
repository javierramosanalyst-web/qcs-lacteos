import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui';
import { ProductDefinition, ProductionLine } from '../../../types';
import {
  InactiveLine,
  deactivateLineRequest,
  fetchInactiveLines,
  productCodeFromUiId,
  reactivateLineRequest,
  updateLineRequest,
} from '../../../api/client';

interface AdminLineActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lines: ProductionLine[];
  products: ProductDefinition[];
  onSaved: () => void;
}

const STATUS_LABEL: Record<ProductionLine['status'], string> = {
  disponible: 'Disponible',
  en_produccion: 'En Producción',
  mantenimiento: 'Mantenimiento',
  limpieza_cip: 'Limpieza CIP',
};

export const AdminLineActivationModal: React.FC<AdminLineActivationModalProps> = ({
  isOpen,
  onClose,
  lines,
  products,
  onSaved,
}) => {
  const [inactiveLines, setInactiveLines] = useState<InactiveLine[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadingInactive, setLoadingInactive] = useState(false);

  const cargarInactivas = () => {
    setLoadingInactive(true);
    fetchInactiveLines()
      .then(setInactiveLines)
      .catch(() => setInactiveLines([]))
      .finally(() => setLoadingInactive(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSavingKey(null);
    cargarInactivas();
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleProducto = async (line: ProductionLine, productId: string) => {
    const activos = line.allowedProductIds;
    const yaActivo = activos.includes(productId);
    if (yaActivo && activos.length === 1) {
      setError(`La línea ${line.code} debe conservar al menos un producto activo.`);
      return;
    }
    const siguientes = yaActivo
      ? activos.filter((id) => id !== productId)
      : [...activos, productId];
    setSavingKey(`${line.code}:${productId}`);
    setError('');
    try {
      await updateLineRequest(line.code, { productos: siguientes.map(productCodeFromUiId) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el producto de la línea.');
    } finally {
      setSavingKey(null);
    }
  };

  const desactivarLinea = async (line: ProductionLine) => {
    if (
      !window.confirm(
        `¿Desactivar la línea ${line.name} (${line.code})? Dejará de aparecer para los operarios.`
      )
    )
      return;
    setSavingKey(`line:${line.code}`);
    setError('');
    try {
      await deactivateLineRequest(line.code);
      onSaved();
      cargarInactivas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar la línea.');
    } finally {
      setSavingKey(null);
    }
  };

  const reactivarLinea = async (line: InactiveLine) => {
    setSavingKey(`line:${line.codigo}`);
    setError('');
    try {
      await reactivateLineRequest(line.codigo);
      onSaved();
      cargarInactivas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reactivar la línea.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      icon="toggle_on"
      title="Activar o Desactivar Línea"
      subtitle="Habilita o deshabilita los productos de cada línea. Las líneas ya existen y no se crean nuevas."
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
        >
          Cerrar
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {lines.map((line) => {
            const productosDeLinea = products.filter((p) => p.lineType === line.lineType);
            return (
              <div
                key={line.id}
                className="rounded-2xl border border-[#D6DEEA] bg-white p-3 sm:p-4 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#D6DEEA] pb-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-[#1B4E9B] bg-[#1B4E9B]/5 px-2 py-0.5 rounded border border-[#1B4E9B]/20 whitespace-nowrap">
                        {line.code}
                      </span>
                      <h3 className="text-sm font-bold text-gray-900 min-w-0 break-words">{line.name}</h3>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">
                      {STATUS_LABEL[line.status]} · {line.allowedProductIds.length} producto(s) activo(s)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => desactivarLinea(line)}
                    disabled={savingKey === `line:${line.code}`}
                    className="px-3 py-2 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">block</span>
                    <span>{savingKey === `line:${line.code}` ? 'Desactivando...' : 'Desactivar línea'}</span>
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {productosDeLinea.map((prod) => {
                    const activo = line.allowedProductIds.includes(prod.id);
                    const guardando = savingKey === `${line.code}:${prod.id}`;
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => toggleProducto(line, prod.id)}
                        disabled={guardando}
                        className={`w-full text-left p-2.5 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer disabled:opacity-60 ${
                          activo
                            ? 'bg-[#5FAF32]/5 border-[#5FAF32]/50 text-[#191c1e]'
                            : 'bg-[#F2F4F7] border-[#D6DEEA] text-gray-500'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[20px] shrink-0 ${
                            activo ? 'text-[#3F7F1E]' : 'text-gray-400'
                          }`}
                        >
                          {activo ? 'toggle_on' : 'toggle_off'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-xs font-bold block break-words">{prod.name}</span>
                          <span className="text-[10px] text-gray-500 block break-words">{prod.standards}</span>
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border shrink-0 ${
                            activo
                              ? 'bg-[#5FAF32]/10 text-[#3F7F1E] border-[#5FAF32]/40'
                              : 'bg-white text-gray-500 border-[#D6DEEA]'
                          }`}
                        >
                          {guardando ? 'Guardando' : activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-[#D6DEEA]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-gray-500 text-[18px]">restore</span>
            <h3 className="text-xs font-bold text-gray-900">Líneas desactivadas ({inactiveLines.length})</h3>
          </div>
          {loadingInactive && <p className="text-[11px] text-gray-500">Consultando líneas desactivadas...</p>}
          {!loadingInactive && inactiveLines.length === 0 && (
            <p className="text-[11px] text-gray-500">No hay líneas desactivadas.</p>
          )}
          {inactiveLines.map((l) => (
            <div
              key={l.id}
              className="p-2.5 rounded-xl bg-[#F2F4F7] border border-[#D6DEEA] flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <div className="font-bold text-gray-700 break-words">{l.nombre}</div>
                <div className="text-[10px] text-gray-500 break-words">Línea · {l.codigo}</div>
              </div>
              <button
                type="button"
                onClick={() => reactivarLinea(l)}
                disabled={savingKey === `line:${l.codigo}`}
                className="px-3 h-8 rounded-lg bg-white border border-[#5FAF32]/60 text-[#3F7F1E] font-bold hover:bg-[#5FAF32]/10 cursor-pointer shrink-0 disabled:opacity-50"
              >
                {savingKey === `line:${l.codigo}` ? 'Reactivando...' : 'Reactivar línea'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
