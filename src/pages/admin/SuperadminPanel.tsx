import React from 'react';
import { UserProfile } from '../../types';
import { SecurityLog } from './SecurityLog';
import { detalleUsuario } from '../../utils/usuarios';

interface SuperadminPanelProps {
  users: UserProfile[];
  inactiveUsers: UserProfile[];
  currentUser: UserProfile;
  onCreateAdmin: () => void;
  onCreateOperator: () => void;
  onEditUser: (user: UserProfile) => void;
  onDeactivateUser: (user: UserProfile) => void;
  onReactivateUser: (user: UserProfile) => void;
}

const card = 'bg-white rounded-2xl border border-[#D6DEEA] shadow-xs';


/**
 * Panel propio del superadmin: gestión de administradores (crear, editar, dar de baja, reactivar)
 * y su propia cuenta. El resto del sistema lo usa igual que un administrador.
 */
export const SuperadminPanel: React.FC<SuperadminPanelProps> = ({
  users,
  inactiveUsers,
  currentUser,
  onCreateAdmin,
  onCreateOperator,
  onEditUser,
  onDeactivateUser,
  onReactivateUser,
}) => {
  const admins = users.filter((u) => u.role === 'administrador');
  const operators = users.filter((u) => u.role === 'operador');
  const inactiveAdmins = inactiveUsers.filter((u) => u.role === 'administrador');
  const me = users.find((u) => u.id === currentUser.id) ?? currentUser;

  const kpis = [
    { label: 'Administradores', value: admins.length, sub: 'Activos (incluye superadmin)', icon: 'admin_panel_settings', color: 'text-[#1B4E9B]' },
    { label: 'Operarios', value: operators.length, sub: 'Activos en planta', icon: 'badge', color: 'text-[#5FAF32]' },
    { label: 'Dados de baja', value: inactiveUsers.length, sub: `${inactiveAdmins.length} administradores`, icon: 'person_off', color: 'text-gray-500' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-[#143A73] text-white p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3 min-w-0">
          <span className="material-symbols-outlined text-[32px] text-[#8CC63F] shrink-0">shield_person</span>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold">Panel del Superadmin</h3>
            <p className="text-xs text-white/80 leading-relaxed mt-0.5">
              Solo tú puedes crear, editar, dar de baja y reactivar <strong>administradores</strong>. Los administradores
              gestionan a los operarios. Las demás pestañas funcionan igual que para un administrador.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={onCreateAdmin}
            className="px-4 h-10 rounded-xl bg-[#5FAF32] hover:bg-[#4E9A26] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Crear administrador
          </button>
          <button
            onClick={() => onEditUser(me)}
            className="px-4 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">key</span>
            Mi cuenta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
        {kpis.map((k) => (
          <div key={k.label} className={`${card} p-3 sm:p-4 flex flex-col justify-between min-w-0`}>
            <div className="flex items-center justify-between gap-1 text-gray-500">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider truncate">{k.label}</span>
              <span className={`material-symbols-outlined text-[18px] sm:text-[20px] shrink-0 ${k.color}`}>{k.icon}</span>
            </div>
            <div className="mt-1.5 sm:mt-2">
              <span className={`text-2xl sm:text-3xl font-black font-mono ${k.color}`}>{k.value}</span>
              <span className="text-[10px] text-gray-500 hidden sm:block mt-0.5">{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={`${card} p-5 flex flex-col gap-3`}>
        <div className="flex items-center justify-between gap-2 border-b border-[#D6DEEA] pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">admin_panel_settings</span>
            <h3 className="text-sm font-bold text-gray-900">Administradores ({admins.length})</h3>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={onCreateOperator} className="text-xs text-gray-600 font-bold hover:underline cursor-pointer">
              + Operador
            </button>
            <button onClick={onCreateAdmin} className="text-xs text-[#1B4E9B] font-bold hover:underline cursor-pointer">
              + Administrador
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {admins.map((u) => {
            const isSelf = u.id === currentUser.id;
            return (
              <div key={u.id} className="p-3 rounded-xl bg-[#F2F4F7] border border-[#D6DEEA] flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      u.isSuperAdmin ? 'bg-[#143A73] text-[#8CC63F]' : 'bg-[#1B4E9B] text-white'
                    }`}
                  >
                    {u.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 truncate">
                      {u.name} {isSelf && <span className="text-[10px] text-gray-500">(tú)</span>}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {detalleUsuario(u)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => onEditUser(u)}
                    title={isSelf ? 'Cambiar mi nombre, PIN o contraseña' : 'Editar / restablecer PIN y contraseña'}
                    aria-label={isSelf ? 'Mi cuenta' : `Editar a ${u.name}`}
                    className="w-8 h-8 rounded-lg bg-white border border-[#D6DEEA] hover:bg-[#1B4E9B]/5 text-[#1B4E9B] flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">{isSelf ? 'key' : 'edit'}</span>
                  </button>
                  {!isSelf && (
                    <button
                      onClick={() => onDeactivateUser(u)}
                      title="Dar de baja"
                      aria-label={`Dar de baja a ${u.name}`}
                      className="w-8 h-8 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-700 flex items-center justify-center cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">person_remove</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {inactiveAdmins.length > 0 && (
        <div className={`${card} p-5 flex flex-col gap-3`}>
          <div className="flex items-center gap-2 border-b border-[#D6DEEA] pb-3">
            <span className="material-symbols-outlined text-gray-500 text-[20px]">restore</span>
            <h3 className="text-sm font-bold text-gray-900">Administradores dados de baja ({inactiveAdmins.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {inactiveAdmins.map((u) => (
              <div key={u.id} className="p-3 rounded-xl bg-[#F2F4F7] border border-[#D6DEEA] flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-bold text-gray-700 truncate">{u.name}</div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {detalleUsuario(u)}
                  </div>
                </div>
                <button
                  onClick={() => onReactivateUser(u)}
                  className="px-3 h-8 rounded-lg bg-white border border-[#5FAF32]/60 text-[#3F7F1E] font-bold hover:bg-[#5FAF32]/10 cursor-pointer shrink-0"
                >
                  Reactivar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <SecurityLog />

      <div className={`${card} p-5 flex flex-col gap-2`}>
        <div className="flex items-center gap-2 border-b border-[#D6DEEA] pb-3">
          <span className="material-symbols-outlined text-amber-600 text-[20px]">checklist</span>
          <h3 className="text-sm font-bold text-gray-900">Antes de usar el sistema en planta</h3>
        </div>
        <ol className="list-decimal pl-5 text-xs text-gray-700 leading-relaxed flex flex-col gap-1">
          <li>
            Cambia tu PIN y tu contraseña en <strong>Mi cuenta</strong> (el usuario superadmin viene con una clave de
            prueba).
          </li>
          <li>Crea los administradores reales y da de baja los administradores de prueba.</li>
          <li>
            Pide a los administradores registrar a los operarios reales (pestaña <strong>Usuarios</strong>) y dar de
            baja los de prueba.
          </li>
        </ol>
      </div>
    </div>
  );
};
