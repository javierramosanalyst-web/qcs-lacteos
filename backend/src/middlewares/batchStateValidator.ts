import { NextFunction, Request, RequestHandler, Response } from 'express';
import pool from '../db';

/**
 * Middleware de bloqueo de lotes cerrados (doc §3.1-A).
 *
 * Política:
 *  - ANULADO    -> siempre 403 (terminal, solo lectura).
 *  - COMPLETADO -> 403, SALVO la excepción controlada: si `motivo_cierre = 'DESVIO_TOTAL'`
 *                  y la ruta lo habilita explícitamente (`allowDesvioTotalReopen: true`).
 *  - PENDIENTE / EN_PROCESO -> pasa.
 *
 * La excepción es opt-in por ruta: solo el endpoint de extracción (desvío a Kumis/Griego)
 * debe usarla. Un lote cerrado en CUARTO_FRIO nunca se reabre por esta vía.
 *
 * Cuando se concede la excepción, se marca `res.locals.allowExtractionReopen = true`.
 * El handler de la ruta debe, dentro de su transacción, ejecutar
 *   SET LOCAL app.allow_extraction_reopen = 'true'
 * para que los triggers de PostgreSQL (capa 2) permitan la reapertura.
 *
 * Las rutas de rectificación y anulación (Admin/Superadmin) NO usan este middleware:
 * operan con `app.allow_admin_override` dentro de su propia transacción.
 */

export interface BatchStateValidatorOptions {
  /** Nombre del parámetro de ruta con el id del lote. Por defecto 'batchId'. */
  paramName?: string;
  /** Permite continuar si el lote está COMPLETADO por DESVIO_TOTAL (solo ruta de extracción). */
  allowDesvioTotalReopen?: boolean;
}

interface LoteEstadoRow {
  id: string;
  codigo_lote: string;
  estado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'ANULADO';
  motivo_cierre: 'CUARTO_FRIO' | 'DESVIO_TOTAL' | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateBatchEditable(options: BatchStateValidatorOptions = {}): RequestHandler {
  const { paramName = 'batchId', allowDesvioTotalReopen = false } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const batchId = req.params[paramName];

      if (!batchId) {
        res.status(400).json({
          error: 'MISSING_BATCH_ID',
          message: 'El identificador del lote es obligatorio.',
        });
        return;
      }

      // Buscar en lotes_produccion por UUID o por codigo_lote
      let rows = (
        await pool.query<LoteEstadoRow>(
          'SELECT id, codigo_lote, estado, motivo_cierre FROM lotes_produccion WHERE id::text = $1 OR codigo_lote = $1',
          [batchId]
        )
      ).rows;

      // Si no es lote de producción, verificar en lotes_padre
      if (rows.length === 0) {
        rows = (
          await pool.query<LoteEstadoRow>(
            'SELECT id, codigo_lote, estado, NULL::motivo_cierre_enum AS motivo_cierre FROM lotes_padre WHERE id::text = $1 OR codigo_lote = $1',
            [batchId]
          )
        ).rows;
      }

      if (rows.length === 0) {
        res.status(404).json({ error: 'BATCH_NOT_FOUND', message: 'Lote no encontrado.' });
        return;
      }

      const lote = rows[0];

      if (lote.estado === 'ANULADO') {
        res.status(403).json({
          error: 'BATCH_LOCKED_READ_ONLY',
          message: `El lote ${lote.codigo_lote} está ANULADO y es de solo lectura.`,
          locked: true,
        });
        return;
      }

      if (lote.estado === 'COMPLETADO') {
        const reaperturaPermitida = allowDesvioTotalReopen && lote.motivo_cierre === 'DESVIO_TOTAL';

        if (!reaperturaPermitida) {
          res.status(403).json({
            error: 'BATCH_LOCKED_READ_ONLY',
            message: `El lote ${lote.codigo_lote} está COMPLETADO y cerrado para edición operativa. Acceso en modo de solo lectura.`,
            locked: true,
          });
          return;
        }

        // Excepción controlada: reversión de un cierre por DESVIO_TOTAL.
        res.locals.allowExtractionReopen = true;
      }

      res.locals.batch = lote;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Alias semántico para validar que el lote NO esté cerrado ni completado */
export const validateBatchNotCompleted = validateBatchEditable;
