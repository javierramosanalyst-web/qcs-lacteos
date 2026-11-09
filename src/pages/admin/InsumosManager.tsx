import React, { useCallback, useEffect, useState } from 'react';
import {
  createInsumoLoteRequest,
  deactivateInsumoLoteRequest,
  fetchInsumoLotes,
  fetchInsumoPapelera,
  purgeInsumoLoteRequest,
  restoreInsumoLoteRequest,
  trashInsumoLoteRequest,
  reactivateInsumoLoteRequest,
  updateInsumoLoteRequest,
} from '../../api/client';
import { InsumoLoteRow, InsumoTipo, setInsumoLotes } from '../../data/insumoLotes';
import { SaboresManager } from './SaboresManager';

const card = 'bg-white rounded-2xl border border-[#D6DEEA] shadow-xs';
const inputClass =
  'p-2.5 rounded-xl border border-[#D6DEEA] text-xs font-medium text-gray-900 outline-none focus:border-[#1B4E9B] focus:ring-2 focus:ring-[#1B4E9B]/15 w-full';

const TIPOS: { key: InsumoTipo; label: string; icon: string; unidad: string; hint: string; descLabel: string }[] = [
  { key: 'leche_fresca', label: 'Leche de proveedores', icon: 'local_shipping', unidad: 'L', hint: 'Ej. 1-09-26 #1M', descLabel: 'Hato / origen' },
  { key: 'cultivo', label: 'Cultivo láctico (fermentados)', icon: 'biotech', unidad: 'g', hint: 'Ej. CUL-2026-09A', descLabel: 'Cepa / referencia' },
  { key: 'cuajo', label: 'Cuajo (coagulante)', icon: 'science', unidad: 'ml', hint: 'Ej. CJ-2026-09A', descLabel: 'Tipo / referencia' },
  { key: 'sal', label: 'Sal', icon: 'grain', unidad: 'kg', hint: 'Ej. SAL-2026-44B', descLabel: 'Referencia' },
  { key: 'azucar', label: 'Azúcar (fermentados)', icon: 'cookie', unidad: 'kg', hint: 'Ej. AZU-2026-10A', descLabel: 'Ingenio / referencia' },
  { key: 'saborizante', label: 'Saborizante (yogur)', icon: 'water_drop', unidad: 'ml', hint: 'Ej. SAB-2026-10A', descLabel: 'Sabor / referencia' },
  { key: 'colorante', label: 'Colorante (yogur)', icon: 'palette', unidad: 'ml', hint: 'Ej. COL-2026-10A', descLabel: 'Color / referencia' },
  { key: 'estevia', label: 'Stevia (yogur y griego)', icon: 'eco', unidad: 'g', hint: 'Ej. EST-2026-10A', descLabel: 'Pureza / referencia' },
  { key: 'acido_acetico', label: 'Ácido acético (pasta hilada)', icon: 'colorize', unidad: 'ml', hint: 'Ej. AA-2026-01A', descLabel: 'Proveedor / concentración' },
  { key: 'especia', label: 'Especias y condimentos (ají, pimienta, finas hierbas)', icon: 'grain', unidad: 'g', hint: 'Ej. ESP-2026-01A', descLabel: 'Especia / referencia' },
];

interface FormState {
  codigo_lote: string;
  descripcion: string;
  proveedor: string;
  fecha_vencimiento: string;
  cantidad_recibida: string;
}

const EMPTY: FormState = { codigo_lote: '', descripcion: '', proveedor: '', fecha_vencimiento: '', cantidad_recibida: '' };

export const InsumosManager: React.FC = () => {
  const [tipo, setTipo] = useState<InsumoTipo>('leche_fresca');
  const [rows, setRows] = useState<InsumoLoteRow[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [vista, setVista] = useState<'lotes' | 'papelera'>('lotes');
  const [papelera, setPapelera] = useState<InsumoLoteRow[]>([]);

  const load = useCallback(async () => {
    try {
      const all = await fetchInsumoLotes(true);
      setRows(all);
      setInsumoLotes(all);
      setPapelera(await fetchInsumoPapelera());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron consultar los lotes.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const meta = TIPOS.find((t) => t.key === tipo)!;
  const list = rows.filter((r) => r.tipo === tipo);

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  const selectTipo = (t: InsumoTipo) => {
    setTipo(t);
    reset();
    setError('');
    setInfo('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!form.codigo_lote.trim()) {
      setError('El código del lote es obligatorio.');
      return;
    }
    if (tipo === 'especia' && !form.descripcion.trim()) {
      setError('Debes seleccionar el tipo de especia (Ají Picante, Pimienta o Finas Hierbas).');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, codigo_lote: form.codigo_lote.trim(), cantidad_recibida: form.cantidad_recibida || null };
      if (editingId) await updateInsumoLoteRequest(editingId, payload);
      else await createInsumoLoteRequest({ ...payload, tipo });
      setInfo(editingId ? 'Lote actualizado.' : 'Lote registrado.');
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el lote.');
    } finally {
      setSaving(false);
    }
  };

  const edit = (r: InsumoLoteRow) => {
    setEditingId(r.id);
    setForm({
      codigo_lote: r.codigo_lote,
      descripcion: r.descripcion ?? '',
      proveedor: r.proveedor ?? '',
      fecha_vencimiento: r.fecha_vencimiento ? String(r.fecha_vencimiento).slice(0, 10) : '',
      cantidad_recibida: r.cantidad_recibida === null || r.cantidad_recibida === undefined ? '' : String(Number(r.cantidad_recibida)),
    });
    setError('');
    setInfo('');
  };

  const toggle = async (r: InsumoLoteRow) => {
    try {
      if (r.activo) await deactivateInsumoLoteRequest(r.id);
      else await reactivateInsumoLoteRequest(r.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    }
  };

  const trash = async (r: InsumoLoteRow) => {
    if (!window.confirm(`¿Enviar el lote ${r.codigo_lote} a la papelera? Podrás recuperarlo durante 30 días; después se elimina de forma permanente.`)) return;
    try {
      await trashInsumoLoteRequest(r.id);
      if (editingId === r.id) reset();
      setInfo(`Lote ${r.codigo_lote} enviado a la papelera.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el lote.');
    }
  };

  const restore = async (r: InsumoLoteRow) => {
    try {
      await restoreInsumoLoteRequest(r.id);
      setInfo(`Lote ${r.codigo_lote} restaurado.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restaurar el lote.');
    }
  };

  const purge = async (r: InsumoLoteRow) => {
    if (!window.confirm(`¿Eliminar permanentemente el lote ${r.codigo_lote}? Esta acción no se puede deshacer.`)) return;
    try {
      await purgeInsumoLoteRequest(r.id);
      setInfo(`Lote ${r.codigo_lote} eliminado permanentemente.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el lote.');
    }
  };

  const diasRestantes = (r: InsumoLoteRow) => {
    const t = r.eliminado_at ? new Date(r.eliminado_at).getTime() : Date.now();
    return Math.max(0, Math.ceil((t + 30 * 86400000 - Date.now()) / 86400000));
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TIPOS.map((t) => {
          const count = rows.filter((r) => r.tipo === t.key && r.activo).length;
          return (
            <button
              key={t.key}
              onClick={() => selectTipo(t.key)}
              className={`${card} p-4 text-left flex items-center gap-3 cursor-pointer transition-all ${
                tipo === t.key ? 'ring-2 ring-[#1B4E9B] border-[#1B4E9B]' : 'hover:border-[#1B4E9B]/50'
              }`}
            >
              <span className="material-symbols-outlined text-[26px] text-[#1B4E9B]">{t.icon}</span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-gray-800">{t.label}</span>
                <span className="block text-[11px] text-gray-500">{count} lote(s) activo(s)</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        {([['lotes', 'Lotes'], ['papelera', `Papelera (${papelera.length})`]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              setVista(k);
              setError('');
              setInfo('');
            }}
            className={`px-4 h-9 rounded-xl text-xs font-bold cursor-pointer border ${
              vista === k ? 'bg-[#1B4E9B] text-white border-[#1B4E9B]' : 'bg-white text-gray-700 border-[#D6DEEA]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="text-xs font-bold text-red-700">{error}</div>}
      {info && <div className="text-xs font-bold text-[#3F7F1E]">{info}</div>}

      {vista === 'papelera' && (
        <div className={`${card} p-5`}>
          <h3 className="text-sm font-extrabold text-[#143A73] mb-1">Papelera de lotes</h3>
          <p className="text-[11px] text-gray-500 mb-3">
            Los lotes eliminados se pueden recuperar durante 30 días. Pasado ese plazo se borran de forma permanente.
          </p>
          {papelera.length === 0 ? (
            <div className="text-xs text-gray-500 py-6 text-center">La papelera está vacía.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-gray-500 border-b border-[#D6DEEA]">
                    <th className="py-2 pr-3">Insumo</th>
                    <th className="pr-3">Lote</th>
                    <th className="pr-3">Eliminado</th>
                    <th className="pr-3">Se borra en</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {papelera.map((r) => (
                    <tr key={r.id} className="border-b border-[#F2F4F7]">
                      <td className="py-2 pr-3">{TIPOS.find((t) => t.key === r.tipo)?.label}</td>
                      <td className="pr-3 font-mono font-bold text-[#1B4E9B]">{r.codigo_lote}</td>
                      <td className="pr-3">{r.eliminado_at ? new Date(r.eliminado_at).toLocaleDateString('es-CO') : '—'}</td>
                      <td className="pr-3 font-bold">{diasRestantes(r)} día(s)</td>
                      <td className="text-right whitespace-nowrap">
                        <button onClick={() => restore(r)} className="px-2 font-bold text-[#3F7F1E] hover:underline cursor-pointer">Recuperar</button>
                        <button onClick={() => purge(r)} className="px-2 font-bold text-red-700 hover:underline cursor-pointer">Eliminar ya</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {vista === 'lotes' && (<>
      <form onSubmit={submit} className={`${card} p-5 flex flex-col gap-4`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-[#143A73]">
            {editingId ? 'Editar lote' : 'Registrar lote'} · {meta.label}
          </h3>
          {editingId && (
            <button type="button" onClick={reset} className="text-xs font-bold text-gray-500 hover:text-gray-800 cursor-pointer">
              Cancelar edición
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-bold text-gray-600 uppercase">
            Código del lote *
            <input className={inputClass} value={form.codigo_lote} onChange={set('codigo_lote')} placeholder={meta.hint} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-gray-600 uppercase">
            {meta.descLabel} {tipo === 'especia' ? '*' : ''}
            {tipo === 'especia' ? (
              <select
                className={inputClass}
                value={form.descripcion}
                onChange={set('descripcion')}
              >
                <option value="">Seleccionar especia...</option>
                <option value="Ají Picante">Ají Picante (Queso Mexicano)</option>
                <option value="Pimienta">Pimienta (Queso Mexicano)</option>
                <option value="Finas Hierbas">Mezcla Finas Hierbas (Queso Finas Hierbas)</option>
              </select>
            ) : (
              <input className={inputClass} value={form.descripcion} onChange={set('descripcion')} />
            )}
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-gray-600 uppercase">
            Proveedor
            <input className={inputClass} value={form.proveedor} onChange={set('proveedor')} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-gray-600 uppercase">
            Vencimiento
            <input type="date" className={inputClass} value={form.fecha_vencimiento} onChange={set('fecha_vencimiento')} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-gray-600 uppercase">
            Cantidad recibida ({meta.unidad})
            <input type="number" min="0" step="any" className={inputClass} value={form.cantidad_recibida} onChange={set('cantidad_recibida')} />
          </label>
        </div>
        <div>
          <button
            type="submit"
            disabled={saving}
            className="px-5 h-10 rounded-xl bg-[#1B4E9B] text-white text-xs font-bold hover:bg-[#143A73] disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Registrar lote'}
          </button>
        </div>
      </form>

      <div className={`${card} p-5`}>
        <h3 className="text-sm font-extrabold text-[#143A73] mb-3">Lotes registrados ({list.length})</h3>
        {list.length === 0 ? (
          <div className="text-xs text-gray-500 py-6 text-center">
            Aún no hay lotes de este insumo. Los operarios no podrán seleccionarlo hasta que lo registres.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-500 border-b border-[#D6DEEA]">
                  <th className="py-2 pr-3">Lote</th>
                  <th className="pr-3">{meta.descLabel}</th>
                  <th className="pr-3">Proveedor</th>
                  <th className="pr-3">Vence</th>
                  <th className="pr-3 text-right">Cantidad</th>
                  <th className="pr-3">Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-[#F2F4F7]">
                    <td className="py-2 pr-3 font-mono font-bold text-[#1B4E9B]">{r.codigo_lote}</td>
                    <td className="pr-3">{r.descripcion || '—'}</td>
                    <td className="pr-3">{r.proveedor || '—'}</td>
                    <td className="pr-3">{r.fecha_vencimiento ? String(r.fecha_vencimiento).slice(0, 10) : '—'}</td>
                    <td className="pr-3 text-right font-mono">
                      {r.cantidad_recibida === null ? '—' : `${Number(r.cantidad_recibida)} ${r.unidad}`}
                    </td>
                    <td className="pr-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                        {r.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => edit(r)} className="px-2 font-bold text-[#1B4E9B] hover:underline cursor-pointer">Editar</button>
                      <button onClick={() => toggle(r)} className={`px-2 font-bold hover:underline cursor-pointer ${r.activo ? 'text-red-700' : 'text-[#3F7F1E]'}`}>
                        {r.activo ? 'Desactivar' : 'Reactivar'}
                      </button>
                      <button onClick={() => trash(r)} className="px-2 font-bold text-red-700 hover:underline cursor-pointer">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>)}
      <SaboresManager />
    </div>
  );
};
