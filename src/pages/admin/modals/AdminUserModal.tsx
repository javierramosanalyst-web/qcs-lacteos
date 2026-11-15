import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui';
import { ProductionLine, UserProfile, UserRole } from '../../../types';
import { createUserRequest, updateUserRequest } from '../../../api/client';

interface AdminUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  lines: ProductionLine[];
  editingUser?: UserProfile | null;
  onSaved: (user: UserProfile, isNew: boolean) => void;
  /** Solo el superadmin puede registrar administradores: muestra el selector de rol. */
  canCreateAdmin?: boolean;
  /** Rol preseleccionado al registrar (p. ej. "administrador" desde el panel del superadmin). */
  initialRole?: UserRole;
  /** Usuario con sesión abierta: si edita su propia ficha el modal se presenta como "Mi cuenta". */
  currentUserId?: string;
}

const inputClass =
  'p-2.5 rounded-xl border border-[#D6DEEA] text-xs font-medium text-gray-900 outline-none focus:border-[#1B4E9B] focus:ring-2 focus:ring-[#1B4E9B]/15';

const ADMIN_PASSWORD_MIN = 8;

export const AdminUserModal: React.FC<AdminUserModalProps> = ({
  isOpen,
  onClose,
  editingUser,
  onSaved,
  canCreateAdmin = false,
  initialRole = 'operador',
  currentUserId,
}) => {
  const isEdit = Boolean(editingUser);
  const isSelf = isEdit && Boolean(currentUserId) && editingUser!.id === currentUserId;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [currentKey, setCurrentKey] = useState('');
  const [role, setRole] = useState<UserRole>('operador');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(editingUser?.name ?? '');
    setCode(editingUser?.code ?? '');
    setPin('');
    setPassword('');
    setCurrentKey('');
    setRole(canCreateAdmin ? initialRole : 'operador');
    setError('');
  }, [isOpen, editingUser, canCreateAdmin, initialRole]);

  if (!isOpen) return null;

  // Rol del usuario que se guarda: el del usuario editado, o el elegido al registrar.
  const targetRole: UserRole = isEdit ? editingUser!.role : role;
  const isAdminTarget = targetRole === 'administrador';
  // Operarios: PIN de 3 a 8 dígitos. Administradores (y superadmin): de 4 a 8.
  const pinMin = isAdminTarget ? 4 : 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      setError('Ingresa el nombre completo (mínimo 3 letras).');
      return;
    }
    if (!isEdit && code.trim().length < 2) {
      setError(isAdminTarget ? 'Ingresa el código del administrador (ej: ADM-902).' : 'Ingresa el código de empleado (ej: OP-112).');
      return;
    }
    if ((!isEdit || pin) && !new RegExp(`^\\d{${pinMin},8}$`).test(pin)) {
      setError(`El PIN debe tener entre ${pinMin} y 8 dígitos numéricos.`);
      return;
    }
    if (isAdminTarget) {
      if (!isEdit && !password) {
        setError(`Los administradores necesitan una contraseña de al menos ${ADMIN_PASSWORD_MIN} caracteres.`);
        return;
      }
      if (password && password.length < ADMIN_PASSWORD_MIN) {
        setError(`La contraseña debe tener al menos ${ADMIN_PASSWORD_MIN} caracteres.`);
        return;
      }
      if (password && pin && password === pin) {
        setError('La contraseña debe ser distinta del PIN.');
        return;
      }
    } else if (password && password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (isSelf && (pin || password) && !currentKey.trim()) {
      setError('Escribe tu contraseña o PIN actual para cambiar tu clave.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      // Turno y línea ya no se piden: los operarios nuevos quedan en Jornada Continua y sin línea fija
      // (pueden trabajar en cualquier línea). Al editar no se envían, así se conservan los valores actuales.
      const saved = isEdit
        ? await updateUserRequest(editingUser!.id, {
            nombre_completo: name.trim(),
            ...(pin ? { pin } : {}),
            ...(password ? { password } : {}),
            ...(isSelf && (pin || password) ? { clave_actual: currentKey.trim() } : {}),
          })
        : await createUserRequest({
            nombre_completo: name.trim(),
            codigo_empleado: code.trim().toUpperCase(),
            pin,
            ...(password ? { password } : {}),
            rol: isAdminTarget ? 'administrador' : 'operador',
          });
      onSaved(saved, !isEdit);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = editingUser?.isSuperAdmin ? 'Superadmin' : isAdminTarget ? 'Administrador' : 'Operador de Planta';

  const title = isSelf
    ? `Mi cuenta · ${editingUser!.code}`
    : isEdit
      ? `Editar Usuario · ${editingUser!.code}`
      : isAdminTarget
        ? 'Registrar Administrador'
        : 'Registrar Operador de Planta';
  const subtitle = isSelf
    ? 'Cambia tu nombre, tu PIN o tu contraseña'
    : isEdit
      ? isAdminTarget
        ? 'Actualiza el nombre, el PIN o la contraseña'
        : 'Actualiza el nombre o restablece el PIN'
      : isAdminTarget
        ? 'Acceso al panel de administración'
        : 'Alta de nuevo usuario para piso de producción';
  const submitLabel = saving
    ? 'Guardando...'
    : isEdit
      ? 'Guardar Cambios'
      : isAdminTarget
        ? 'Registrar Administrador'
        : 'Registrar Operador';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      icon={isSelf ? 'key' : isEdit ? 'manage_accounts' : isAdminTarget ? 'admin_panel_settings' : 'person_add'}
      title={title}
      subtitle={subtitle}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!isEdit && !canCreateAdmin && (
          <div className="p-3 rounded-2xl bg-[#1B4E9B]/5 border border-[#1B4E9B]/25 text-xs flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[#1B4E9B] text-[20px] shrink-0 mt-0.5">lock</span>
            <div className="text-[#143A73] leading-relaxed">
              Los administradores solo pueden crear usuarios con el rol <strong>Operador</strong>. El operario
              ingresará con su <strong>código</strong> y su <strong>PIN</strong> (o la contraseña, si se define).
            </div>
          </div>
        )}

        {!isEdit && canCreateAdmin && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">Rol en el Sistema</label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Rol del nuevo usuario">
              {(
                [
                  { key: 'operador', label: 'Operador', icon: 'badge', hint: 'Registra lotes en planta' },
                  { key: 'administrador', label: 'Administrador', icon: 'admin_panel_settings', hint: 'Panel, correcciones y reportes' },
                ] as const
              ).map((opt) => {
                const active = role === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setRole(opt.key);
                      setError('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-[#1B4E9B] border-[#1B4E9B] text-white shadow-xs'
                        : 'bg-white border-[#D6DEEA] text-gray-700 hover:bg-[#F2F4F7]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold">
                      <span className="material-symbols-outlined text-[18px]">{opt.icon}</span>
                      {opt.label}
                    </span>
                    <span className={`block text-[10px] mt-0.5 ${active ? 'text-white/80' : 'text-gray-500'}`}>{opt.hint}</span>
                  </button>
                );
              })}
            </div>
            <span className="text-[10px] text-gray-500 leading-relaxed">
              {isAdminTarget
                ? `El administrador entra con su código y su contraseña (mínimo ${ADMIN_PASSWORD_MIN} caracteres) o su PIN.`
                : 'El operario entra con su código y su PIN (o la contraseña, si se define).'}
            </span>
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

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-700">Código de Empleado</label>
          <input
            type="text"
            value={code}
            disabled={isEdit}
            onChange={(e) => setCode(e.target.value)}
            placeholder={isAdminTarget ? 'ej: ADM-902' : 'ej: OP-112'}
            className={`${inputClass} font-bold text-[#1B4E9B] uppercase disabled:bg-[#F2F4F7]`}
          />
        </div>

        {isSelf && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">Contraseña o PIN actual</label>
            <input
              type="password"
              autoComplete="current-password"
              value={currentKey}
              onChange={(e) => {
                setCurrentKey(e.target.value);
                setError('');
              }}
              placeholder="Solo si vas a cambiar tu PIN o tu contraseña"
              className={inputClass}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">
              {isEdit ? 'Nuevo PIN (opcional)' : `PIN (${pinMin} a 8 dígitos)`}
            </label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
                setError('');
              }}
              placeholder={isEdit ? 'Dejar vacío = no cambia' : isAdminTarget ? 'ej: 4829' : 'ej: 482'}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">
              {isEdit
                ? isAdminTarget
                  ? `Nueva contraseña (mín. ${ADMIN_PASSWORD_MIN})`
                  : 'Nueva contraseña (opcional)'
                : isAdminTarget
                  ? `Contraseña (mín. ${ADMIN_PASSWORD_MIN})`
                  : 'Contraseña (opcional)'}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder={
                isEdit
                  ? 'Dejar vacío = no cambia'
                  : isAdminTarget
                    ? `${ADMIN_PASSWORD_MIN} o más caracteres`
                    : 'Si se deja vacía = PIN'
              }
              className={inputClass}
            />
          </div>
        </div>

        {(isEdit || !canCreateAdmin) && (
          <div className="flex flex-col gap-1 pt-1">
            <label className="text-xs font-bold text-gray-700">Rol en el Sistema</label>
            <div className="p-3 rounded-xl bg-[#F2F4F7] border border-[#D6DEEA] text-xs font-bold text-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#5FAF32]">
                  {isAdminTarget ? 'admin_panel_settings' : 'badge'}
                </span>
                <span>{roleLabel}</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono bg-white px-2 py-0.5 rounded border border-gray-200">
                Bloqueado
              </span>
            </div>
          </div>
        )}

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
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};
