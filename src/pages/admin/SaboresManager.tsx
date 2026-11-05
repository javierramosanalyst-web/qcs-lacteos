import React, { useCallback, useEffect, useState } from 'react';
import {
  createSaborYogurRequest,
  fetchSaboresYogur,
  reactivateSaborYogurRequest,
  deactivateSaborYogurRequest,
  updateSaborYogurRequest,
} from '../../api/client';
import { SaborYogurRow, setSaboresYogur } from '../../data/insumoLotes';

const card = 'bg-white rounded-2xl border border-[#D6DEEA] shadow-xs';
const inputClass =
  'p-2.5 rounded-xl border border-[#D6DEEA] text-xs font-medium text-gray-900 outline-none focus:border-[#1B4E9B] focus:ring-2 focus:ring-[#1B4E9B]/15 w-full';

export const SaboresManager: React.FC = () => {
  const [rows, setRows] = useState<SaborYogurRow[]>([]);
  const [nombre, setNombre] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await fetchSaboresYogur(true);
      setRows(all);
      setSaboresYogur(all);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron consultar los sabores.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setNombre('');
    setEditingId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('Escribe el nombre del sabor.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) await updateSaborYogurRequest(editingId, nombre.trim());
      else await createSaborYogurRequest(nombre.trim());
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el sabor.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (r: SaborYogurRow) => {
    try {
      if (r.activo) await deactivateSaborYogurRequest(r.id);
      else await reactivateSaborYogurRequest(r.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    }
  };

  return (
    <div className={`${card} p-5 flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[22px] text-[#1B4E9B]">icecream</span>
        <h3 className="text-sm font-black text-gray-900">Sabores de yogur</h3>
        <span className="text-[11px] text-gray-500">{rows.filter((r) => r.activo).length} activo(s)</span>
      </div>
      {error && <div className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">{error}</div>}
      <form onSubmit={submit} className="flex flex-wrap gap-2 items-center">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Ej. Mora"
          maxLength={80}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving}
          className="px-4 h-9 rounded-xl text-xs font-bold bg-[#1B4E9B] text-white cursor-pointer disabled:opacity-50"
        >
          {editingId ? 'Guardar cambios' : 'Agregar sabor'}
        </button>
        {editingId && (
          <button type="button" onClick={reset} className="px-4 h-9 rounded-xl text-xs font-bold border border-[#D6DEEA] cursor-pointer">
            Cancelar
          </button>
        )}
      </form>
      <div className="flex flex-wrap gap-2">
        {rows.length === 0 && <span className="text-xs text-gray-500">Aún no hay sabores registrados.</span>}
        {rows.map((r) => (
          <span
            key={r.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
              r.activo ? 'bg-[#F2F4F7] border-[#D6DEEA] text-gray-800' : 'bg-gray-50 border-gray-200 text-gray-400 line-through'
            }`}
          >
            {r.nombre}
            <button
              type="button"
              className="text-[#1B4E9B] cursor-pointer"
              onClick={() => {
                setEditingId(r.id);
                setNombre(r.nombre);
              }}
            >
              Editar
            </button>
            <button type="button" className={`${r.activo ? 'text-red-600' : 'text-emerald-700'} cursor-pointer`} onClick={() => toggle(r)}>
              {r.activo ? 'Desactivar' : 'Reactivar'}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};
