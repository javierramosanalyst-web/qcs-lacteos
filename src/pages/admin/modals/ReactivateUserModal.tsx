import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui';
import { UserProfile } from '../../../types';
import { reactivateUserRequest } from '../../../api/client';

interface ReactivateUserModalProps {
  user: UserProfile | null;
  onClose: () => void;
  onDone: (user: UserProfile) => void;
}

const inputClass =
  'p-2.5 rounded-xl border border-[#D6DEEA] text-xs font-medium text-gray-900 outline-none focus:border-[#1B4E9B] focus:ring-2 focus:ring-[#1B4E9B]/15';

/** Reactiva un usuario dado de baja asignándole claves nuevas (administradores: PIN y contraseña). */
export const ReactivateUserModal: React.FC<ReactivateUserModalProps> = ({ user, onClose, onDone }) => {
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPin('');
    setPassword('');
    setError('');
  }, [user]);

  if (!user) return null;
  const isAdmin = user.role === 'administrador';
  const pinMin = isAdmin ? 4 : 3;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!new RegExp(`^\\d{${pinMin},8}$`).test(pin)) {
      setError(`El PIN nuevo debe tener entre ${pinMin} y 8 dígitos.`);
      return;
    }
    if (isAdmin && password.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres.');
      return;
    }
    if (isAdmin && password === pin) {
      setError('La contraseña debe ser distinta del PIN.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await reactivateUserRequest(user.id, pin, isAdmin ? password : undefined);
      onDone(user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reactivar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      maxWidth="md"
      icon="restore"
      title={`Reactivar · ${user.code}`}
      subtitle={`${user.name} vuelve a tener acceso con claves nuevas`}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className={`grid gap-3 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">PIN nuevo ({pinMin} a 8 dígitos)</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
                setError('');
              }}
              className={inputClass}
              autoFocus
            />
          </div>
          {isAdmin && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700">Contraseña nueva (mín. 8)</label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className={inputClass}
              />
            </div>
          )}
        </div>

        {error && <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800">{error}</div>}

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
            className="px-5 py-2.5 rounded-xl bg-[#5FAF32] hover:bg-[#4E9A26] disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
          >
            {saving ? 'Reactivando...' : 'Reactivar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
