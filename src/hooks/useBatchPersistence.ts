import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ParentMilkBatch, ProcessTimerState, StageId, UserProfile } from '../types';
import { registrarActividadOperario } from '../utils/operariosActividad';
import {
  ApiError,
  fetchWorkspace,
  productCodeFromUiId,
  saveDraftRequest,
  saveWorkspaceRequest,
} from '../api/client';

type AnyBatch = {
  id: string;
  status: string;
  processTimer: ProcessTimerState;
  stageStatuses: Record<string, string>;
  observaciones?: string;
  [key: string]: any;
};

export interface PersistedProduct {
  productId: string;
  lineCode: string;
  state: AnyBatch;
  setState: (updater: (prev: any) => any) => void;
  createTemplate: () => AnyBatch;
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

const FERMENT_LINE = 'L-FERMENT-02';
const LINE_CODES = ['L-HILADA-01', FERMENT_LINE];

const stripTimer = (b: AnyBatch) => ({
  ...b,
  processTimer: { ...b.processTimer, elapsedSeconds: 0, formattedTime: '' },
});

const stripOperator = (b: AnyBatch) => ({
  ...stripTimer(b),
  operator: '',
  responsableProceso: '',
  operatorRole: '',
  operariosIntervinientes: [],
});

const signature = (b: AnyBatch, stage: StageId | undefined) =>
  JSON.stringify({ b: stripTimer(b), stage });

const contentSignature = (b: AnyBatch) =>
  JSON.stringify({
    ...stripTimer(b),
    actividadOperarios: undefined,
    operariosIntervinientes: undefined,
  });

const BACKUP_MAX_AGE_MS = 48 * 60 * 60 * 1000;

interface LocalBackup {
  batch: AnyBatch;
  stage?: StageId;
  sig: string;
  ts: number;
}

const backupStore = new Map<string, LocalBackup>();

const readBackup = (productId: string): LocalBackup | null => {
  const parsed = backupStore.get(productId);
  if (!parsed) return null;
  if (!parsed.batch || Date.now() - parsed.ts > BACKUP_MAX_AGE_MS) {
    backupStore.delete(productId);
    return null;
  }
  return parsed;
};

const writeBackup = (productId: string, backup: LocalBackup) => {
  backupStore.set(productId, backup);
};

const clearBackup = (productId: string) => {
  backupStore.delete(productId);
};

const isStarted = (b: AnyBatch) =>
  Boolean(b.processTimer?.startTimestamp) || b.status === 'COMPLETADO';

const volumeOf = (b: AnyBatch): number => {
  if (b.pasteurizacion) return Number(b.pasteurizacion.litrosLeche) || 0;
  const ins = b.acidificar?.insumos;
  return (Number(ins?.lecheFresca) || 0) + (Number(ins?.lecheAcida) || 0);
};

const varianteOf = (productId: string, b: AnyBatch): string | null => {
  if (productId === 'prod-kumis') return 'kumis';
  if (productId === 'prod-yogur-griego') return 'yogur_griego';
  if (productId === 'prod-yogur')
    return b.pasteurizacion?.llevaAzucar === false ? 'yogur_sin_azucar' : 'yogur_con_azucar';
  return null;
};

interface Params {
  enabled: boolean;
  products: PersistedProduct[];
  stagesByProduct: Record<string, StageId>;
  setStagesByProduct: (updater: (prev: Record<string, StageId>) => Record<string, StageId>) => void;
  parentBatch: ParentMilkBatch;
  setParentBatch: (value: ParentMilkBatch) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  onDraftRemoved?: (productId: string) => void;
  currentUser?: UserProfile | null;
}

export function useBatchPersistence({
  enabled,
  products,
  stagesByProduct,
  setStagesByProduct,
  parentBatch,
  setParentBatch,
  showToast,
  onDraftRemoved,
  currentUser,
}: Params) {
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  const productsRef = useRef(products);
  productsRef.current = products;
  const stagesRef = useRef(stagesByProduct);
  stagesRef.current = stagesByProduct;
  const parentRef = useRef(parentBatch);
  parentRef.current = parentBatch;

  const versions = useRef<Record<string, number>>({});
  const lastSaved = useRef<Record<string, string>>({});
  const lastContent = useRef<Record<string, string>>({});
  const userRef = useRef<UserProfile | null | undefined>(currentUser);
  userRef.current = currentUser;
  const inflight = useRef<Record<string, boolean>>({});
  const completed = useRef<Record<string, boolean>>({});
  const parentVersion = useRef(0);
  const parentSaved = useRef<string>(JSON.stringify(parentBatch));
  const parentInflight = useRef(false);
  const errorNotified = useRef(false);
  const retryTimer = useRef<number | null>(null);
  const missingCount = useRef<Record<string, number>>({});
  const onDraftRemovedRef = useRef(onDraftRemoved);
  onDraftRemovedRef.current = onDraftRemoved;

  const pristineSig = useCallback((p: PersistedProduct) => {
    return JSON.stringify(stripOperator(p.createTemplate()));
  }, []);

  const adopt = useCallback(
    (productId: string, estado: any, version: number) => {
      const p = productsRef.current.find((x) => x.productId === productId);
      if (!p || !estado?.batch) return;
      versions.current[productId] = version;
      completed.current[productId] = false;
      const stage: StageId | undefined = estado.stage;
      lastSaved.current[productId] = signature(estado.batch, stage ?? stagesRef.current[productId]);
      lastContent.current[productId] = contentSignature(estado.batch);
      p.setState(() => estado.batch);
      if (stage) setStagesByProduct((prev) => ({ ...prev, [productId]: stage }));
    },
    [setStagesByProduct]
  );

  const restoreBackup = useCallback(
    (productId: string) => {
      const p = productsRef.current.find((x) => x.productId === productId);
      const backup = readBackup(productId);
      if (!p || !backup) return;
      const current = versions.current[productId] !== undefined ? lastSaved.current[productId] : undefined;
      if (current === backup.sig) {
        clearBackup(productId);
        return;
      }
      if (!isStarted(backup.batch) || backup.batch.status === 'COMPLETADO') {
        clearBackup(productId);
        return;
      }
      p.setState(() => backup.batch);
      if (backup.stage) setStagesByProduct((prev) => ({ ...prev, [productId]: backup.stage as StageId }));
      showToast('Se recuperaron cambios guardados en este equipo y se enviarán al servidor.', 'info');
    },
    [setStagesByProduct, showToast]
  );

  const loadFromServer = useCallback(
    async (initial: boolean) => {
      for (const lineCode of LINE_CODES) {
        let data: Awaited<ReturnType<typeof fetchWorkspace>>;
        try {
          data = await fetchWorkspace(lineCode);
        } catch (err) {
          if (err instanceof ApiError && (err.status === 403 || err.status === 404)) continue;
          throw err;
        }
        for (const d of data.drafts) {
          const local = versions.current[d.producto_ui_id] ?? 0;
          const p = productsRef.current.find((x) => x.productId === d.producto_ui_id);
          if (!p) continue;
          const dirty =
            lastSaved.current[d.producto_ui_id] !== undefined &&
            lastSaved.current[d.producto_ui_id] !==
              signature(p.state, stagesRef.current[d.producto_ui_id]);
          if (initial || (d.version > local && !dirty && !inflight.current[d.producto_ui_id])) {
            const estado = d.estado?.batch ? d.estado : { batch: d.estado };
            if (d.codigo_lote) estado.batch = { ...estado.batch, id: d.codigo_lote };
            adopt(d.producto_ui_id, estado, d.version);
            if (initial) restoreBackup(d.producto_ui_id);
          }
        }
        if (!initial) {
          const present = new Set(data.drafts.map((d) => d.producto_ui_id));
          for (const p of productsRef.current) {
            const pid = p.productId;
            if (p.lineCode !== lineCode) continue;
            if (present.has(pid) || versions.current[pid] === undefined || completed.current[pid] || inflight.current[pid]) {
              missingCount.current[pid] = 0;
              continue;
            }
            missingCount.current[pid] = (missingCount.current[pid] ?? 0) + 1;
            if (missingCount.current[pid] < 2) continue;
            missingCount.current[pid] = 0;
            delete versions.current[pid];
            delete lastSaved.current[pid];
            delete lastContent.current[pid];
            clearBackup(pid);
            const closed = (data.cerrados ?? []).find((c) => c.codigo_lote === (p.state as any)?.id);
            p.setState(() => p.createTemplate());
            onDraftRemovedRef.current?.(pid);
            if (closed?.estado === 'COMPLETADO') {
              showToast('Este lote fue finalizado desde otro equipo. El producto quedó libre para iniciar uno nuevo.', 'info');
            } else {
              showToast('Un supervisor anuló este lote. El producto quedó libre para iniciar uno nuevo.', 'warning');
            }
          }
        }
        if (lineCode === FERMENT_LINE && data.workspace?.estado?.id) {
          const ws = data.workspace;
          const parentDirty = JSON.stringify(parentRef.current) !== parentSaved.current;
          if (initial || (ws.version > parentVersion.current && !parentDirty && !parentInflight.current)) {
            parentVersion.current = ws.version;
            parentSaved.current = JSON.stringify(ws.estado);
            setParentBatch(ws.estado);
          }
        }
      }
      if (initial) {
        for (const p of productsRef.current) {
          if (versions.current[p.productId] === undefined) restoreBackup(p.productId);
        }
      }
    },
    [adopt, restoreBackup, setParentBatch, showToast]
  );

  useEffect(() => {
    if (!enabled) {
      setHydrated(false);
      versions.current = {};
      lastSaved.current = {};
      lastContent.current = {};
      completed.current = {};
      parentVersion.current = 0;
      return;
    }
    let cancelled = false;
    let retryLoad: number | undefined;
    loadFromServer(true)
      .then(() => {
        if (!cancelled) {
          setHydrated(true);
          setSyncStatus('saved');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSyncStatus('offline');
          showToast('No se pudieron cargar los lotes guardados. Reintentando…', 'warning');
          const retry = (attempt: number) => {
            retryLoad = window.setTimeout(() => {
              if (cancelled) return;
              loadFromServer(true)
                .then(() => {
                  if (!cancelled) {
                    setHydrated(true);
                    setSyncStatus('saved');
                  }
                })
                .catch(() => retry(Math.min(attempt + 1, 6)));
            }, Math.min(5000 * attempt, 30000));
          };
          retry(1);
        }
      });
    return () => {
      cancelled = true;
      if (retryLoad !== undefined) window.clearTimeout(retryLoad);
    };
  }, [enabled, loadFromServer, showToast]);

  useEffect(() => {
    if (!enabled || !hydrated) return;
    const id = window.setInterval(() => {
      loadFromServer(false).catch(() => setSyncStatus('offline'));
    }, 15000);
    return () => window.clearInterval(id);
  }, [enabled, hydrated, loadFromServer]);

  const saveProduct = useCallback(
    async (p: PersistedProduct) => {
      const pid = p.productId;
      const stage = stagesRef.current[pid];
      const content = contentSignature(p.state);
      const contentChanged = lastContent.current[pid] !== content;
      const b: AnyBatch = contentChanged
        ? registrarActividadOperario(p.state, userRef.current, pid, stage)
        : p.state;
      const sig = signature(b, stage);
      const started = isStarted(b);
      const isDone = b.status === 'COMPLETADO' && started;
      inflight.current[pid] = true;
      setSyncStatus('saving');
      try {
        const res = await saveDraftRequest(pid, {
          lineCode: p.lineCode,
          productCode: productCodeFromUiId(pid),
          estado: { batch: b, stage },
          etapaActual: stage ?? 'acidificar',
          stageStatuses: b.stageStatuses,
          version: versions.current[pid] ?? 0,
          started,
          completed: isDone,
          volumen: volumeOf(b),
          llevaAzucar: b.pasteurizacion ? b.pasteurizacion.llevaAzucar !== false : false,
          variante: varianteOf(pid, b),
          elapsedSeconds: b.processTimer?.elapsedSeconds ?? 0,
          observaciones: b.observaciones ?? '',
        });
        versions.current[pid] = res.version;
        lastSaved.current[pid] = sig;
        lastContent.current[pid] = content;
        if (b !== p.state) {
          p.setState((prev: AnyBatch) => ({
            ...prev,
            actividadOperarios: b.actividadOperarios,
            operariosIntervinientes: Array.from(
              new Set([...(b.operariosIntervinientes ?? []), ...(prev.operariosIntervinientes ?? [])])
            ),
          }));
        }
        if (readBackup(pid)?.sig === sig || res.completed) clearBackup(pid);
        errorNotified.current = false;
        setSyncStatus('saved');
        if (res.codigo_lote && b.id !== res.codigo_lote) {
          if (!res.completed) {
            lastSaved.current[pid] = signature({ ...b, id: res.codigo_lote }, stage);
          }
          p.setState((prev: AnyBatch) => ({ ...prev, id: res.codigo_lote }));
        }
        if (res.completed) {
          completed.current[pid] = true;
          showToast(`✓ Lote ${res.codigo_lote ?? ''} cerrado y guardado en la base de datos.`, 'success');
        }
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 409 && err.body?.error === 'BATCH_CLOSED') {
          completed.current[pid] = true;
          setSyncStatus('saved');
          showToast(
            `El lote ${err.body?.codigo_lote ?? ''} ya fue cerrado en otra sesión. No se guardaron más cambios.`,
            'warning'
          );
        } else if (err.status === 409 && err.body?.current) {
          const cur = err.body.current;
          const estado = cur.estado?.batch ? cur.estado : { batch: cur.estado };
          if (cur.codigo_lote) estado.batch = { ...estado.batch, id: cur.codigo_lote };
          adopt(pid, estado, cur.version);
          showToast('Otro usuario actualizó este lote. Se cargaron los datos más recientes.', 'warning');
          setSyncStatus('saved');
        } else {
          setSyncStatus(err.status === 0 ? 'offline' : 'error');
          if (!errorNotified.current) {
            errorNotified.current = true;
            showToast(`No se pudo guardar el lote: ${err.message} Se reintentará automáticamente.`, 'warning');
          }
          if (retryTimer.current === null) {
            retryTimer.current = window.setTimeout(() => {
              retryTimer.current = null;
              flushRef.current();
            }, 5000);
          }
        }
      } finally {
        inflight.current[pid] = false;
      }
    },
    [adopt, showToast]
  );

  const saveParent = useCallback(async () => {
    const snapshot = parentRef.current;
    const sig = JSON.stringify(snapshot);
    parentInflight.current = true;
    try {
      const res = await saveWorkspaceRequest(FERMENT_LINE, snapshot, parentVersion.current);
      parentVersion.current = res.version;
      parentSaved.current = sig;
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409 && err.body?.current) {
        parentVersion.current = err.body.current.version;
        parentSaved.current = JSON.stringify(err.body.current.estado);
        setParentBatch(err.body.current.estado);
      } else {
        setSyncStatus(err.status === 0 ? 'offline' : 'error');
      }
    } finally {
      parentInflight.current = false;
    }
  }, [setParentBatch]);

  const flush = useCallback(() => {
    if (!enabled || !hydrated) return;
    for (const p of productsRef.current) {
      const pid = p.productId;
      if (inflight.current[pid] || completed.current[pid]) continue;
      const sig = signature(p.state, stagesRef.current[pid]);
      if (lastSaved.current[pid] === sig) continue;
      if (!isStarted(p.state) && JSON.stringify(stripOperator(p.state)) === pristineSig(p) && versions.current[pid] === undefined) {
        lastSaved.current[pid] = sig;
        continue;
      }
      void saveProduct(p);
    }
    if (!parentInflight.current && JSON.stringify(parentRef.current) !== parentSaved.current && parentRef.current.isStarted) {
      void saveParent();
    }
  }, [enabled, hydrated, pristineSig, saveParent, saveProduct]);

  const flushRef = useRef(flush);
  flushRef.current = flush;

  const sigs = useMemo(
    () => products.map((p) => signature(p.state, stagesByProduct[p.productId])).join('|') + JSON.stringify(parentBatch),
    [products, stagesByProduct, parentBatch]
  );

  useEffect(() => {
    if (!enabled || !hydrated) return;
    for (const p of productsRef.current) {
      const pid = p.productId;
      if (completed.current[pid] || !isStarted(p.state) || p.state.status === 'COMPLETADO') continue;
      const stage = stagesRef.current[pid];
      const sig = signature(p.state, stage);
      if (lastSaved.current[pid] === sig) continue;
      writeBackup(pid, { batch: p.state, stage, sig, ts: Date.now() });
    }
  }, [sigs, enabled, hydrated]);

  useEffect(() => {
    if (!enabled || !hydrated) return;
    const goOnline = () => flushRef.current();
    const leaving = () => {
      for (const p of productsRef.current) {
        const pid = p.productId;
        if (completed.current[pid] || !isStarted(p.state) || p.state.status === 'COMPLETADO') continue;
        const stage = stagesRef.current[pid];
        const sig = signature(p.state, stage);
        if (lastSaved.current[pid] !== sig) writeBackup(pid, { batch: p.state, stage, sig, ts: Date.now() });
      }
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('beforeunload', leaving);
    document.addEventListener('visibilitychange', leaving);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('beforeunload', leaving);
      document.removeEventListener('visibilitychange', leaving);
    };
  }, [enabled, hydrated]);

  useEffect(() => {
    if (!enabled || !hydrated) return;
    const t = window.setTimeout(() => flushRef.current(), 1200);
    return () => window.clearTimeout(t);
  }, [sigs, enabled, hydrated]);

  const resetIfCompleted = useCallback((productId: string): boolean => {
    const p = productsRef.current.find((x) => x.productId === productId);
    if (!p || !completed.current[productId]) return false;
    const fresh = p.createTemplate();
    completed.current[productId] = false;
    delete versions.current[productId];
    delete lastSaved.current[productId];
    delete lastContent.current[productId];
    p.setState(() => fresh);
    return true;
  }, []);

  const markRectified = useCallback((productId: string, newBatch: AnyBatch) => {
    if (newBatch.status !== 'COMPLETADO' && versions.current[productId] !== undefined) {
      versions.current[productId] = (versions.current[productId] ?? 0) + 1;
    }
    lastSaved.current[productId] = signature(newBatch, stagesRef.current[productId]);
  }, []);

  const resetParentSaved = useCallback((fresh: ParentMilkBatch) => {
    parentSaved.current = JSON.stringify(fresh);
  }, []);

  const refreshFromServer = useCallback(async () => {
    try {
      await loadFromServer(false);
    } catch {
      setSyncStatus('offline');
    }
  }, [loadFromServer]);

  return { hydrated, syncStatus, resetIfCompleted, markRectified, resetParentSaved, refreshFromServer };
}
