import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui';
import { LineType, ProductDefinition, ProductionLine } from '../../../types';
import { createLineRequest, productCodeFromUiId, updateLineRequest } from '../../../api/client';

interface AdminLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductDefinition[];
  editingLine?: ProductionLine | null;
  onSaved: (name: string, isNew: boolean) => void;
}

const LINE_TYPES: { id: LineType; name: string; label: string; icon: string; defaultCode: string }[] = [
  { id: 'pasta_hilada', name: 'Línea de Producción de Pasta Hilada', label: 'Pasta Hilada', icon: 'lunch_dining', defaultCode: 'L-HILADA-02' },
  { id: 'fermentacion', name: 'Línea de Fermentación', label: 'Fermentados', icon: 'biotech', defaultCode: 'L-FERMENT-03' },
];

const inputClass =
  'p-2.5 rounded-xl border border-[#D6DEEA] text-xs font-medium text-gray-900 outline-none focus:border-[#1B4E9B] focus:ring-2 focus:ring-[#1B4E9B]/15';

export const AdminLineModal: React.FC<AdminLineModalProps> = ({
  isOpen,
  onClose,
  products,
  editingLine,
  onSaved,
}) => {
  const isEdit = Boolean(editingLine);
  const [lineType, setLineType] = useState<LineType>('pasta_hilada');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [capacity, setCapacity] = useState('1200');
  const [status, setStatus] = useState<ProductionLine['status']>('disponible');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const defaultsFor = (type: LineType) => products.filter((p) => p.lineType === type).map((p) => p.id);

  useEffect(() => {
    if (!isOpen) return;
    if (editingLine) {
      setLineType(editingLine.lineType);
      setName(editingLine.name);
      setCode(editingLine.code);
      setCapacity(String(editingLine.capacityLiters));
      setStatus(editingLine.status);
      setSelectedProductIds(editingLine.allowedProductIds);
    } else {
      setLineType('pasta_hilada');
      setName('');
      setCode(LINE_TYPES[0].defaultCode);
      setCapacity('1200');
      setStatus('disponible');
      setSelectedProductIds(defaultsFor('pasta_hilada'));
    }
    setError('');
  }, [isOpen, editingLine]);

  if (!isOpen) return null;

  const handleLineTypeChange = (type: LineType) => {
    if (isEdit) return;
    const matched = LINE_TYPES.find((t) => t.id === type)!;
    setLineType(type);
    setCode(matched.defaultCode);
    setSelectedProductIds(defaultsFor(type));
    setError('');
  };

  const toggleProduct = (prodId: string) => {
    if (selectedProductIds.includes(prodId)) {
      if (selectedProductIds.length === 1) {
        setError('Debes asociar al menos un producto a la línea.');
        return;
      }
      setSelectedProductIds(selectedProductIds.filter((id) => id !== prodId));
    } else {
      setSelectedProductIds([...selectedProductIds, prodId]);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const capacityNum = Number(capacity);
    if (name.trim().length < 3 || code.trim().length < 2) {
      setError('Completa el nombre y el código de la línea.');
      return;
    }
    if (!Number.isFinite(capacityNum) || capacityNum <= 0) {
      setError('La capacidad debe ser un número mayor que 0.');
      return;
    }
    if (selectedProductIds.length === 0) {
      setError('Debes asociar al menos un producto a la línea.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        codigo: code.trim().toUpperCase(),
        nombre: name.trim(),
        tipo_linea: lineType,
        capacidad_litros: capacityNum,
        estado: status,
        productos: selectedProductIds.map(productCodeFromUiId),
      };
      if (isEdit) await updateLineRequest(editingLine!.code, payload);
      else await createLineRequest(payload);
      onSaved(payload.nombre, !isEdit);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la línea.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      icon="precision_manufacturing"
      title={isEdit ? `Editar Línea · ${editingLine!.code}` : 'Crear Línea de Producción'}
      subtitle="Pasta Hilada o Fermentados"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-800">1. TIPO DE LÍNEA DE PRODUCCIÓN</label>
          <div className="grid grid-cols-2 gap-2">
            {LINE_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={isEdit && lineType !== t.id}
                onClick={() => handleLineTypeChange(t.id)}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  lineType === t.id
                    ? 'bg-[#1B4E9B] text-white border-[#1B4E9B] shadow-xs'
                    : 'bg-[#F2F4F7] border-[#D6DEEA] text-gray-700 hover:bg-[#E6ECF5]'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
                <span className="text-[10px] leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-700">Nombre de la Línea</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="ej: Línea de Producción de Pasta Hilada 2"
            className={inputClass}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">Código de Línea</label>
            <input
              type="text"
              value={code}
              disabled={isEdit}
              onChange={(e) => {
                setCode(e.target.value);
                setError('');
              }}
              placeholder="ej: L-HILADA-02"
              className={`${inputClass} font-bold text-[#1B4E9B] uppercase disabled:bg-[#F2F4F7]`}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">Capacidad (Litros)</label>
            <input
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="1200"
              className={inputClass}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-700">Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductionLine['status'])}
            className={inputClass}
          >
            <option value="disponible">Disponible (Lista para lotes)</option>
            <option value="en_produccion">En Producción</option>
            <option value="mantenimiento">En Mantenimiento</option>
            <option value="limpieza_cip">En Limpieza CIP</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#D6DEEA]">
          <label className="text-xs font-bold text-gray-800">PRODUCTOS ASOCIADOS A ESTA LÍNEA</label>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
            {products
              .filter((p) => p.lineType === lineType)
              .map((prod) => {
                const isSelected = selectedProductIds.includes(prod.id);
                return (
                  <div
                    key={prod.id}
                    onClick={() => toggleProduct(prod.id)}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#1B4E9B]/5 border-[#1B4E9B] text-[#1B4E9B]'
                        : 'bg-[#F2F4F7] border-[#D6DEEA] text-gray-600 hover:bg-[#E6ECF5]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {isSelected ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                    <div>
                      <div className="text-xs font-bold">{prod.name}</div>
                      <div className="text-[10px] text-gray-500">{prod.standards}</div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800">{error}</div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D6DEEA]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-[#1B4E9B] hover:bg-[#143A73] disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
          >
            {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Línea'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
