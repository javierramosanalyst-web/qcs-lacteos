import { ActividadOperario, UserProfile } from '../types';
import { stageLabelFor } from './stageNav';

export const operarioLabel = (u: { name: string; code: string }) => `${u.name} (${u.code})`;

export const codigoDeOperario = (label: string): string | null =>
  label.match(/\(([A-Za-z0-9-]+)\)\s*$/)?.[1] ?? null;

export const registrarActividadOperario = <T extends Record<string, any>>(
  batch: T,
  user: UserProfile | null | undefined,
  productId: string,
  stage: string | undefined,
  now: Date = new Date()
): T => {
  if (!user || !user.code || !stage) return batch;
  const iso = now.toISOString();
  const actual: ActividadOperario[] = Array.isArray(batch.actividadOperarios) ? batch.actividadOperarios : [];
  const idx = actual.findIndex((a) => a.codigo === user.code && a.etapa === stage);
  const actividadOperarios: ActividadOperario[] =
    idx >= 0
      ? actual.map((a, i) => (i === idx ? { ...a, ultimaAccion: iso } : a))
      : [
          ...actual,
          {
            codigo: user.code,
            nombre: user.name,
            rol: user.role === 'administrador' ? 'Administrador' : 'Operador',
            etapa: stage,
            fase: stageLabelFor(productId, stage),
            primeraAccion: iso,
            ultimaAccion: iso,
          },
        ];
  const label = operarioLabel(user);
  const lista: string[] = Array.isArray(batch.operariosIntervinientes) ? batch.operariosIntervinientes : [];
  const yaEsta = lista.some((o) => codigoDeOperario(o) === user.code || o === user.name);
  return {
    ...batch,
    actividadOperarios,
    operariosIntervinientes: yaEsta
      ? lista.map((o) => (o === user.name ? label : o))
      : [...lista, label],
  };
};
