import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui';
import { ProductionLine, UserProfile } from '../../../types';
import { createUserRequest, lineCodeFromUiId, updateUserRequest } from '../../../api/client';

interface AdminUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  lines: ProductionLine[];
  editingUser?: UserProfile | null;
  onSaved: (user: UserProfile, isNew: boolean) => void;
}

const inputClass =
  'p-2.5 rounded-xl border border-[#D6DEEA] text-xs font-medium text-gray-900 outline-none focus:border-[#1B4E9B] focus:ring-2 focus:ring-[#1B4E9B]/15';

export const AdminUserModal: React.FC<AdminUserModalProps> = ({
  isOpen,
  onClose,
  lines,
  editingUser,
  onSaved,
}) => {
  const isEdit = Boolean(editingUser);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [shift, setShift] = useState<UserProfile['shift']>('Mañana');
  const [assignedLineId, setAssignedLineId] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(editingUser?.name ?? '');
    setCode(editingUser?.code ?? '');
    setShift(editingUser?.shift ?? 'Mañana');
    setAssignedLineId(editingUser?.assignedLineId ?? '');
    setPin('');
    setPassword('');
    setError('');
  }, [isOpen, editingUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      setError('Ingresa el nombre completo (mínimo 3 letras).');
      return;
    }
    if (!isEdit && code.trim().length < 2) {
      setError('Ingresa el código de empleado (ej: OP-112).');
      return;
    }
    if ((!isEdit || pin) && !/^\d{4,8}$/.test(pin)) {
      setError('El PIN debe tener entre 4 y 8 dígitos numéricos.');
      return;
    }
    if (password && password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const linea = assignedLineId ? lineCodeFromUiId(assignedLineId) : null;
      const saved = isEdit
        ? await updateUserRequest(editingUser!.id, {
            nombre_completo: name.trim(),
            turno: shift,
            linea_asignada_id: linea,
            ...(pin ? { pin } : {}),
            ...(password ? { password } : {}),
          })
        : await createUserRequest({
            nombre_completo: name.trim(),
            codigo_empleado: code.trim().toUpperCase(),
            pin,
            ...(password ? { password } : {}),
            turno: shift,
            linea_asignada_id: linea,
            rol: 'operador',
          });
      onSaved(saved, !isEdit);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      icon={isEdit ? 'manage_accounts' : 'person_add'}
      title={isEdit ? `Editar Usuario · ${editingUser!.code}` : 'Registrar Operador de Planta'}
      subtitle={isEdit ? 'Actualiza los datos, la línea o restablece el PIN' : 'Alta de nuevo usuario para piso de producción'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!isEdit && (
          <div className="p-3 rounded-2xl bg-[#1B4E9B]/5 border border-[#1B4E9B]/25 text-xs flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[#1B4E9B] text-[20px] shrink-0 mt-0.5">lock</span>
            <div className="text-[#143A73] leading-relaxed">
              Los administradores solo pueden crear usuarios con el rol <strong>Operador</strong>. El operario
              ingresará con su <strong>código</strong> y su <strong>PIN</strong> (o la contraseña, si se define).
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-700">Nombre Completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="ej: Santiago Betancur"
            className={inputClass}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">Código de Empleado</label>
            <input
              type="text"
              value={code}
              disabled={isEdit}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ej: OP-112"
              className={`${inputClass} font-bold text-[#1B4E9B] uppercase disabled:bg-[#F2F4F7]`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">Turno Asignado</label>
            <select value={shift} onChange={(e) => setShift(e.target.value as UserProfile['shift'])} className={inputClass}>
              <option value="Mañana">Mañana (06:00 - 14:00)</option>
              <option value="Tarde">Tarde (14:00 - 22:00)</option>
              <option value="Noche">Noche (22:00 - 06:00)</option>
              <option value="Jornada Continua">Jornada Continua</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">
              {isEdit ? 'Nuevo PIN (opcional)' : 'PIN (4 a 8 dígitos)'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
                setError('');
              }}
              placeholder={isEdit ? 'Dejar vacío = no cambia' : 'ej: 4821'}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">
              {isEdit ? 'Nueva contraseña (opcional)' : 'Contraseña (opcional)'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? 'Dejar vacío = no cambia' : 'Si se deja vacía = PIN'}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-700">Línea Asignada</label>
          <select value={assignedLineId} onChange={(e) => setAssignedLineId(e.target.value)} className={inputClass}>
            <option value="">-- Sin línea fija / Flotante --</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 pt-1">
          <label className="text-xs font-bold text-gray-700">Rol en el Sistema</label>
          <div className="p-3 rounded-xl bg-[#F2F4F7] border border-[#D6DEEA] text-xs font-bold text-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#5FAF32]">badge</span>
              <span>{editingUser?.role === 'administrador' ? 'Administrador' : 'Operador de Planta'}</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono bg-white px-2 py-0.5 rounded border border-gray-200">
              Bloqueado
            </span>
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
            {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Registrar Operador'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
