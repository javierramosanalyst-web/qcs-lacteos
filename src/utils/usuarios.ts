import { UserProfile } from '../types';

/** Rol para mostrar en listas. */
export const rolTexto = (u: UserProfile): string =>
  u.isSuperAdmin ? 'Superadmin' : u.role === 'administrador' ? 'Administrador' : 'Operador';

/** "OP-104 · Operador · CC 1010000104 · desde 16/11/2026" (lo que haya). */
export const detalleUsuario = (u: UserProfile): string => {
  const desde = u.createdAt
    ? new Date(u.createdAt).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Bogota',
      })
    : null;
  return [u.code, rolTexto(u), u.cedula ? `CC ${u.cedula}` : null, desde ? `desde ${desde}` : null]
    .filter(Boolean)
    .join(' · ');
};
