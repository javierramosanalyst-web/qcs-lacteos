import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BatchData,
  ChildBatchReference,
  INITIAL_KUMIS_BATCH,
  INITIAL_YOGUR_BATCH,
  INITIAL_YOGUR_GRIEGO_BATCH,
  KumisBatchData,
  ParentMilkBatch,
  ProcessTimerState,
  SplitMilkAllocationInput,
  StageId,
  SubBatchTabInfo,
  UserProfile,
  YogurBatchData,
  YogurGriegoBatchData,
} from '../types';
import {
  createInitial7CuerosBatch,
  createInitialIndustrialBatch,
  createInitialPeraBatch,
  createInitialPremiumBatch,
} from '../data/initialBatches';
import {
  computeDurationBetweenTimes,
  formatSecondsToHMS,
  getCurrentTimeString,
  timeStringToTimestampToday,
} from '../utils/timer';
import { useIndependentBatchTimer } from './useProcessTimer';
import { PersistedProduct, useBatchPersistence } from './useBatchPersistence';

export const STAGE_ORDER: StageId[] = [
  'acidificar',
  'calentar-y-cuajar',
  'desuerar',
  'hilar',
  'moldeo',
];

const FERMENTADOS_STAGE_LABELS: Record<StageId, string> = {
  acidificar: '1. Pasteurización',
  'calentar-y-cuajar': '2. Inoculación',
  desuerar: '3. Cuarto Frío / Mallas',
  hilar: '4. Batido y Sabores',
  moldeo: '5. Envasado',
};

const QUESOS_STAGE_LABELS: Record<StageId, string> = {
  acidificar: '1. Acidificar',
  'calentar-y-cuajar': '2. Calentar y Cuajar',
  desuerar: '3. Desuerar',
  hilar: '4. Hilar',
  moldeo: '5. Moldeo',
};

const DEFAULT_STAGES: Record<string, StageId> = {
  'prod-doble-crema-premium': 'acidificar',
  'prod-doble-crema-industrial': 'acidificar',
  'prod-queso-pera': 'acidificar',
  'prod-queso-7-cueros': 'acidificar',
  'prod-yogur': 'acidificar',
  'prod-kumis': 'acidificar',
  'prod-yogur-griego': 'desuerar',
};

const createInitialParentBatch = (): ParentMilkBatch => ({
  id: 'LP-FERM',
  codigoLotePadre: 'Sin iniciar',
  fechaProduccion: new Date().toISOString().slice(0, 10),
  responsable: '',
  totalMilkLiters: 0,
  allocatedLiters: 0,
  remainingLiters: 0,
  proveedorPrincipal: '',
  loteLecheProveedor: '',
  isStarted: false,
  startedAt: null,
  isDivided: false,
  dividedAt: null,
  childBatches: [],
});

const totalTimeOf = (timer: ProcessTimerState): { seconds: number; hms: string } => {
  const seconds = timer.startTimestamp
    ? Math.max(timer.elapsedSeconds, Math.floor((Date.now() - timer.startTimestamp) / 1000))
    : timer.elapsedSeconds;
  return { seconds, hms: formatSecondsToHMS(Math.max(0, seconds)) };
};

const withOperator = <T extends { processTimer: ProcessTimerState }>(
  prev: T,
  respName: string,
  roleStr: string
): T =>
  prev.processTimer.startTimestamp
    ? prev
    : {
        ...prev,
        operator: respName,
        responsableProceso: respName,
        operatorRole: roleStr,
        operariosIntervinientes: [respName],
      };

interface UseBatchManagerParams {
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  persistenceEnabled?: boolean;
}

export function useBatchManager({ showToast, persistenceEnabled = false }: UseBatchManagerParams) {
  // Producto activo y línea activa
  const [selectedLineId, setSelectedLineId] = useState<string>('line-pasta-hilada');
  const [activeProductId, setActiveProductId] = useState<string>(
    'prod-doble-crema-premium'
  );

  // Etapa independiente por cada producto/lote hijo (para no perder la etapa al saltar entre sub-lotes)
  const [stagesByProduct, setStagesByProduct] =
    useState<Record<string, StageId>>(DEFAULT_STAGES);

  const currentStage: StageId = stagesByProduct[activeProductId] || 'acidificar';

  const setCurrentStage = useCallback(
    (stage: StageId) => {
      setStagesByProduct((prev) => ({
        ...prev,
        [activeProductId]: stage,
      }));
    },
    [activeProductId]
  );

  // LOTE PADRE (Recepción / Pasteurización Base para Producción Divergente)
  const [parentBatch, setParentBatch] = useState<ParentMilkBatch>(createInitialParentBatch);

  // LOTES DE PASTA HILADA (QUESOS)
  const [batchIndustrial, setBatchIndustrial] = useState<BatchData>(
    createInitialIndustrialBatch
  );
  const [batchPremium, setBatchPremium] = useState<BatchData>(
    createInitialPremiumBatch
  );
  const [batchPera, setBatchPera] = useState<BatchData>(createInitialPeraBatch);
  const [batch7Cueros, setBatch7Cueros] = useState<BatchData>(
    createInitial7CuerosBatch
  );

  // LOTES HIJOS DE FERMENTACIÓN (YOGUR, KUMIS, GRIEGO)
  const [batchYogur, setBatchYogur] =
    useState<YogurBatchData>(INITIAL_YOGUR_BATCH);
  const [batchKumis, setBatchKumis] =
    useState<KumisBatchData>(INITIAL_KUMIS_BATCH);
  const [batchYogurGriego, setBatchYogurGriego] =
    useState<YogurGriegoBatchData>(INITIAL_YOGUR_GRIEGO_BATCH);

  // Modales de resumen por línea
  const [reviewModalOpen, setReviewModalOpen] = useState<boolean>(false);
  const [yogurReviewModalOpen, setYogurReviewModalOpen] =
    useState<boolean>(false);
  const [kumisReviewModalOpen, setKumisReviewModalOpen] =
    useState<boolean>(false);
  const [yogurGriegoReviewModalOpen, setYogurGriegoReviewModalOpen] =
    useState<boolean>(false);

  // CRONÓMETROS INDEPENDIENTES EN PARALELO PARA CADA LOTE
  // Ningún cronómetro depende de qué pestaña esté abierta; cada lote corre su propio reloj.
  useIndependentBatchTimer(batchIndustrial, setBatchIndustrial, 7200, 14400);
  useIndependentBatchTimer(batchPremium, setBatchPremium, 7200, 14400);
  useIndependentBatchTimer(batchPera, setBatchPera, 9000, 18000);
  useIndependentBatchTimer(batch7Cueros, setBatch7Cueros, 7200, 14400);
  useIndependentBatchTimer(batchYogur, setBatchYogur, 28800, 86400);
  useIndependentBatchTimer(batchKumis, setBatchKumis, 64800, 108000);
  useIndependentBatchTimer(batchYogurGriego, setBatchYogurGriego, 86400, 172800);

  // Flags de producto activo
  const isIndustrial = activeProductId === 'prod-doble-crema-industrial';
  const isQuesoPera = activeProductId === 'prod-queso-pera';
  const isQueso7Cueros = activeProductId === 'prod-queso-7-cueros';
  const isYogurGriego = activeProductId === 'prod-yogur-griego';
  const isKumis = activeProductId === 'prod-kumis';
  const isYogur = activeProductId === 'prod-yogur';
  const isFermentacionLine = isYogur || isKumis || isYogurGriego;

  const batch: BatchData = isIndustrial
    ? batchIndustrial
    : isQuesoPera
    ? batchPera
    : isQueso7Cueros
    ? batch7Cueros
    : batchPremium;

  const setBatch = isIndustrial
    ? setBatchIndustrial
    : isQuesoPera
    ? setBatchPera
    : isQueso7Cueros
    ? setBatch7Cueros
    : setBatchPremium;

  // Asignar operario responsable a TODOS los lotes (incluyendo Yogur Griego y Lote Padre)
  const assignOperatorToAllBatches = useCallback((user: UserProfile) => {
    const respName = user.name;
    const roleStr = `Operador Responsable · ${user.shift || 'Jornada Continua'}`;

    setParentBatch((prev) => (prev.isStarted ? prev : { ...prev, responsable: respName }));
    setBatchIndustrial((prev) => withOperator(prev, respName, roleStr));
    setBatchPremium((prev) => withOperator(prev, respName, roleStr));
    setBatchPera((prev) => withOperator(prev, respName, roleStr));
    setBatch7Cueros((prev) => withOperator(prev, respName, roleStr));
    setBatchYogur((prev) => withOperator(prev, respName, roleStr));
    setBatchKumis((prev) => withOperator(prev, respName, roleStr));
    setBatchYogurGriego((prev) => withOperator(prev, respName, roleStr));
  }, []);

  // 1. INICIAR LOTE PADRE (Recepción / Pasteurización Base)
  const startParentBatch = useCallback(
    (params: {
      totalMilkLiters: number;
      loteLecheProveedor?: string;
      codigoLotePadre?: string;
    }) => {
      const timeStr = getCurrentTimeString();
      setParentBatch((prev) => ({
        ...prev,
        totalMilkLiters: params.totalMilkLiters,
        remainingLiters: Math.max(
          0,
          params.totalMilkLiters - prev.allocatedLiters
        ),
        loteLecheProveedor:
          params.loteLecheProveedor || prev.loteLecheProveedor,
        codigoLotePadre: params.codigoLotePadre || prev.codigoLotePadre,
        isStarted: true,
        startedAt: timeStr,
      }));
      showToast(
        `🥛 Lote Padre iniciado con ${params.totalMilkLiters} L de leche (${timeStr}).`,
        'info'
      );
    },
    [showToast]
  );

  // 2. DIVIDIR LOTE PADRE EN LOTES HIJOS (Yogur, Kumis, Griego)
  const splitParentBatch = useCallback(
    (input: SplitMilkAllocationInput) => {
      const timeStr = getCurrentTimeString();
      const now = Date.now();

      const litrosYogur =
        Math.max(0, Number(input.litrosYogurConAzucar) || 0) +
        Math.max(0, Number(input.litrosYogurSinAzucar) || 0);
      const litrosKumis = Math.max(0, Number(input.litrosKumis) || 0);
      const litrosGriego = Math.max(0, Number(input.litrosYogurGriego) || 0);
      const totalAllocated = litrosYogur + litrosKumis + litrosGriego;

      setParentBatch((prev) => {
        const baseTotal = input.totalParentLiters ?? prev.totalMilkLiters;
        const effectiveTotal = Math.max(baseTotal, totalAllocated);
        const remaining = Math.max(0, effectiveTotal - totalAllocated);
        const newChildren: ChildBatchReference[] = [];

        if (litrosYogur > 0) {
          newChildren.push({
            id: batchYogur.id,
            parentBatchId: prev.id,
            variant:
              (input.litrosYogurSinAzucar || 0) > 0 &&
              input.litrosYogurConAzucar === 0
                ? 'yogur_sin_azucar'
                : 'yogur_con_azucar',
            productId: 'prod-yogur',
            productName: 'Yogur Probiótico',
            allocatedLiters: litrosYogur,
            llevaAzucar: input.litrosYogurConAzucar > 0,
            targetInoculationTempRange: '42 – 45 °C',
            createdAt: timeStr,
            status:
              batchYogur.status === 'COMPLETADO' ? 'completado' : 'en_proceso',
          });
        }

        if (litrosKumis > 0) {
          newChildren.push({
            id: batchKumis.id,
            parentBatchId: prev.id,
            variant: 'kumis',
            productId: 'prod-kumis',
            productName: 'Kumis Tradicional',
            allocatedLiters: litrosKumis,
            llevaAzucar: true,
            targetInoculationTempRange: '30 – 35 °C',
            createdAt: timeStr,
            status:
              batchKumis.status === 'COMPLETADO' ? 'completado' : 'en_proceso',
          });
        }

        if (litrosGriego > 0) {
          newChildren.push({
            id: batchYogurGriego.id,
            parentBatchId: prev.id,
            variant: 'yogur_griego',
            productId: 'prod-yogur-griego',
            productName: 'Yogur Griego',
            allocatedLiters: litrosGriego,
            llevaAzucar: false,
            targetInoculationTempRange: '42 – 45 °C',
            createdAt: timeStr,
            status:
              batchYogurGriego.status === 'COMPLETADO'
                ? 'completado'
                : 'en_proceso',
          });
        }

        return {
          ...prev,
          totalMilkLiters: effectiveTotal,
          allocatedLiters: totalAllocated,
          remainingLiters: remaining,
          loteLecheProveedor: input.loteLeche || prev.loteLecheProveedor,
          isStarted: true,
          startedAt: prev.startedAt || timeStr,
          isDivided: true,
          dividedAt: timeStr,
          childBatches: newChildren,
        };
      });

      // Actualizar Lote Hijo 1: Yogur
      if (litrosYogur > 0) {
        setBatchYogur((prev) => ({
          ...prev,
          processTimer: prev.processTimer.isRunning
            ? prev.processTimer
            : {
                ...prev.processTimer,
                isRunning: true,
                isCompleted: false,
                startTime: timeStr,
                startTimestamp: now,
              },
          pasteurizacion: {
            ...prev.pasteurizacion,
            litrosLeche: litrosYogur,
            loteLeche: input.loteLeche || prev.pasteurizacion.loteLeche,
            incluyeKumis: litrosKumis > 0,
            azucar: {
              ...prev.pasteurizacion.azucar,
              cantidadKg: prev.pasteurizacion.azucar?.esManual
                ? prev.pasteurizacion.azucar.cantidadKg
                : Number((((Number(input.litrosYogurConAzucar) || 0) / 40) * 3.2).toFixed(2)),
            },
            litrosKumisDestinados: litrosKumis,
            divisionLeche: {
              ...prev.pasteurizacion.divisionLeche,
              litrosYogurConAzucar: input.litrosYogurConAzucar,
              litrosYogurSinAzucar: input.litrosYogurSinAzucar || 0,
              litrosKumis: litrosKumis,
              litrosYogurGriego: litrosGriego,
            },
          },
        }));
      }

      // Actualizar Lote Hijo 2: Kumis
      if (litrosKumis > 0) {
        setBatchKumis((prev) => ({
          ...prev,
          processTimer: prev.processTimer.isRunning
            ? prev.processTimer
            : {
                ...prev.processTimer,
                isRunning: true,
                isCompleted: false,
                startTime: timeStr,
                startTimestamp: now,
              },
          pasteurizacion: {
            ...prev.pasteurizacion,
            litrosLeche: litrosKumis,
            loteLeche: input.loteLeche || prev.pasteurizacion.loteLeche,
            azucar: {
              ...prev.pasteurizacion.azucar,
              cantidadKg: Number(((litrosKumis / 40) * 3.2).toFixed(2)),
              cantidadGramos: Math.round((litrosKumis / 40) * 3200),
            },
          },
        }));
      }

      // Actualizar Lote Hijo 3: Yogur Griego
      if (litrosGriego > 0) {
        setBatchYogurGriego((prev) => ({
          ...prev,
          processTimer: prev.processTimer.isRunning
            ? prev.processTimer
            : {
                ...prev.processTimer,
                isRunning: true,
                isCompleted: false,
                startTime: timeStr,
                startTimestamp: now,
              },
          pasteurizacion: {
            ...prev.pasteurizacion,
            litrosLeche: litrosGriego,
            loteLeche: input.loteLeche || prev.pasteurizacion.loteLeche,
            loteYogurSinAzucar:
              input.loteYogurSinAzucar ||
              prev.pasteurizacion.loteYogurSinAzucar ||
              `YSA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`,
          },
        }));
      }

      showToast(
        `✓ Lote Padre dividido en Lotes Hijos: Yogur (${litrosYogur} L), Kumis (${litrosKumis} L) y Griego (${litrosGriego} L). Relojes individuales activos.`,
        'success'
      );
    },
    [
      batchYogur.id,
      batchYogur.status,
      batchKumis.id,
      batchKumis.status,
      batchYogurGriego.id,
      batchYogurGriego.status,
      showToast,
    ]
  );

  // 3. EXTRAER LOTE HIJO DE KUMIS DESDE YOGUR CON AZÚCAR (POST-RETENCIÓN)
  const handleExtractKumisChildBatch = useCallback(
    (litrosKumis: number) => {
      const timeStr = getCurrentTimeString();
      const now = Date.now();
      const childKumisId = `${batchYogur.id}-KUM`;

      // Volumen disponible reversible: leche actual de yogur + lo que ya se había extraído para kumis
      const prevExtraidosKumis =
        batchYogur.pasteurizacion.extraccionKumis?.litrosExtraidos || 0;
      const volumenBaseDisponible =
        batchYogur.pasteurizacion.litrosLeche + prevExtraidosKumis;
      const nuevoLitrosKumis = Math.min(
        Math.max(0, litrosKumis),
        volumenBaseDisponible
      );
      const nuevoVolumenYogur = Math.max(
        0,
        volumenBaseDisponible - nuevoLitrosKumis
      );
      const esDesvioTotal = nuevoVolumenYogur === 0 && nuevoLitrosKumis > 0;
      const nuevoAzucarKg = Number(((nuevoVolumenYogur / 40) * 3.2).toFixed(2));

      // Descontar litros del lote de Yogur dulce (o auto-cerrar si desvío total)
      setBatchYogur((prev) => {
        let obs = prev.observaciones || '';
        const notaDesvio =
          'Lote desviado en su totalidad hacia sub-lotes (0 L remanentes)';
        if (esDesvioTotal) {
          if (!obs.includes(notaDesvio)) {
            obs = obs ? `${obs}. ${notaDesvio}.` : `${notaDesvio}.`;
          }
        } else {
          obs = obs
            .replace(
              /(\. )?Lote desviado en su totalidad hacia sub-lotes \(0 L remanentes\)\.?/g,
              ''
            )
            .trim();
        }

        return {
          ...prev,
          status: esDesvioTotal
            ? 'COMPLETADO'
            : prev.status === 'COMPLETADO'
            ? 'NOMINAL'
            : prev.status,
          observaciones: obs || undefined,
          processTimer: {
            ...prev.processTimer,
            isRunning: esDesvioTotal ? false : prev.processTimer.isRunning,
            isCompleted: esDesvioTotal ? true : prev.processTimer.isCompleted,
          },
          pasteurizacion: {
            ...prev.pasteurizacion,
            litrosLeche: nuevoVolumenYogur,
            extraccionKumis: {
              realizado: nuevoLitrosKumis > 0,
              litrosExtraidos: nuevoLitrosKumis,
              hora: timeStr,
            },
            azucar: {
              ...prev.pasteurizacion.azucar,
              cantidadKg: prev.pasteurizacion.azucar?.esManual
                ? prev.pasteurizacion.azucar.cantidadKg
                : nuevoAzucarKg,
            },
          },
        };
      });

      // Configurar el Lote Hijo de Kumis heredando materias primas y etapas previas
      setBatchKumis((prev) => {
        const loteLecheHeredado =
          batchYogur.pasteurizacion.loteLeche || prev.pasteurizacion.loteLeche;
        const loteAzucarHeredado =
          batchYogur.pasteurizacion.azucar?.loteAzucar ||
          batchYogur.pasteurizacion.loteAzucarPastur ||
          prev.pasteurizacion.azucar?.loteAzucar ||
          '';
        const azucarProporcionalKg = Number(
          ((nuevoLitrosKumis / 40) * 3.2).toFixed(2)
        );

        const horaInicioRetencion =
          batchYogur.pasteurizacion.sostenimiento?.horaInicio ||
          batchYogur.pasteurizacion.calentamiento?.horaFin ||
          timeStr;
        const horaFinRetencion =
          batchYogur.pasteurizacion.sostenimiento?.horaFin || timeStr;
        const duracionRetencion =
          batchYogur.pasteurizacion.sostenimiento?.duracionReal || null;

        const timestampInicioEnfriamiento =
          batchYogur.pasteurizacion.enfriamiento?.timestampInicioEnfriamiento ||
          (horaFinRetencion ? timeStringToTimestampToday(horaFinRetencion) : now);

        return {
          ...prev,
          id: childKumisId,
          productId: 'prod-kumis',
          productName: 'Kumis Tradicional Fermentado',
          lineId: 'line-fermentacion',
          line: 'Línea de Fermentación',
          operator: batchYogur.operator || prev.operator,
          responsableProceso:
            batchYogur.responsableProceso ||
            batchYogur.operator ||
            prev.responsableProceso,
          operatorRole: batchYogur.operatorRole || prev.operatorRole,
          operariosIntervinientes:
            batchYogur.operariosIntervinientes || prev.operariosIntervinientes,
          status: 'NOMINAL',
          processTimer: {
            ...prev.processTimer,
            isRunning: true,
            isCompleted: false,
            startTime: batchYogur.processTimer.startTime || timeStr,
            startTimestamp: batchYogur.processTimer.startTimestamp || now,
          },
          stageStatuses: {
            acidificar: 'en_proceso',
            'calentar-y-cuajar': 'pendiente',
            desuerar: 'pendiente',
            hilar: 'pendiente',
            moldeo: 'pendiente',
          },
          pasteurizacion: {
            ...prev.pasteurizacion,
            litrosLeche: nuevoLitrosKumis,
            loteLeche: loteLecheHeredado,
            loteAzucar: loteAzucarHeredado,
            loteAzucarPastur: loteAzucarHeredado,
            llevaAzucar: true,
            azucarElegido: true,
            azucar: {
              ...prev.pasteurizacion.azucar,
              adicionado: true,
              horaAdicion:
                batchYogur.pasteurizacion.azucar?.horaAdicion ||
                batchYogur.pasteurizacion.calentamiento?.horaInicio ||
                timeStr,
              cantidadKg: azucarProporcionalKg,
              loteAzucar: loteAzucarHeredado,
              esManual: false,
            },
            calentamiento: {
              ...batchYogur.pasteurizacion.calentamiento,
              iniciado: true,
              completado: true,
              horaInicio:
                batchYogur.pasteurizacion.calentamiento?.horaInicio || timeStr,
              horaFin:
                batchYogur.pasteurizacion.calentamiento?.horaFin ||
                horaInicioRetencion,
              tiempoCalentamiento:
                batchYogur.pasteurizacion.calentamiento?.tiempoCalentamiento ||
                null,
            },
            sostenimiento: {
              ...batchYogur.pasteurizacion.sostenimiento,
              iniciado: true,
              completado: true,
              horaInicio: horaInicioRetencion,
              horaFin: horaFinRetencion,
              duracionReal: duracionRetencion,
            },
            enfriamiento: {
              ...prev.pasteurizacion.enfriamiento,
              enfriamientoIniciado: true,
              enfriamientoCompletado: false,
              horaInicio: horaFinRetencion,
              horaInicioEnfriamiento: horaFinRetencion,
              horaFinEnfriamiento: null,
              timestampInicioEnfriamiento: timestampInicioEnfriamiento,
              tiempoEnfriamiento: null,
              temperaturaFinal: 35.0,
              esManual: false,
            },
            trasiego: {
              ...prev.pasteurizacion.trasiego,
              iniciado: false,
              completado: false,
              horaInicio: null,
              horaFin: null,
              timestampInicio: null,
              tiempoTrasiego: null,
            },
          },
        };
      });

      // Sincronizar asignación en Lote Padre
      setParentBatch((prev) => {
        let childFound = false;
        const updatedChildren = prev.childBatches.map((child) => {
          if (child.id === batchYogur.id || child.productId === 'prod-yogur') {
            return {
              ...child,
              allocatedLiters: nuevoVolumenYogur,
              status: (esDesvioTotal
                ? 'completado'
                : 'en_proceso') as 'completado' | 'en_proceso',
            };
          }
          if (child.productId === 'prod-kumis') {
            childFound = true;
            return {
              ...child,
              id: childKumisId,
              allocatedLiters: nuevoLitrosKumis,
              status: 'en_proceso' as const,
            };
          }
          return child;
        });

        if (!childFound) {
          updatedChildren.push({
            id: childKumisId,
            parentBatchId: prev.id,
            variant: 'kumis',
            productId: 'prod-kumis',
            productName: 'Kumis Tradicional',
            allocatedLiters: nuevoLitrosKumis,
            llevaAzucar: true,
            targetInoculationTempRange: '30 - 35 °C',
            createdAt: timeStr,
            status: 'en_proceso' as const,
          });
        }

        return {
          ...prev,
          childBatches: updatedChildren,
        };
      });

      // Conmutación automática de pantalla al Lote Hijo de Kumis
      setStagesByProduct((prev) => ({
        ...prev,
        'prod-kumis': 'acidificar',
      }));
      setActiveProductId('prod-kumis');
      setSelectedLineId('line-fermentacion');

      showToast(
        esDesvioTotal
          ? `✓ Desvío total hacia Kumis (${childKumisId}) con ${nuevoLitrosKumis} L. El lote padre fue completado y cerrado (0 L remanentes).`
          : `✓ Lote Hijo de Kumis (${childKumisId}) iniciado con ${nuevoLitrosKumis} L. Se transfirió el foco a Kumis en Enfriamiento a 35 °C.`,
        'success'
      );
    },
    [
      batchYogur.id,
      batchYogur.operator,
      batchYogur.responsableProceso,
      batchYogur.operatorRole,
      batchYogur.operariosIntervinientes,
      batchYogur.pasteurizacion,
      batchYogur.processTimer,
      showToast,
    ]
  );

  // 4. EXTRAER LOTE HIJO DE YOGUR GRIEGO DESDE YOGUR SIN AZÚCAR (EN CUARTO FRÍO)
  const handleExtractYogurGriegoChildBatch = useCallback(
    (litrosGriego: number) => {
      const timeStr = getCurrentTimeString();
      const now = Date.now();
      const childGriegoId = `${batchYogur.id}-YGR`;

      // Volumen disponible reversible: leche actual de yogur + lo que ya se había extraído para griego
      const prevExtraidosGriego =
        batchYogur.pasteurizacion.extraccionGriego?.litrosExtraidos || 0;
      const volumenBaseDisponible =
        batchYogur.pasteurizacion.litrosLeche + prevExtraidosGriego;
      const nuevoLitrosGriego = Math.min(
        Math.max(0, litrosGriego),
        volumenBaseDisponible
      );
      const nuevoVolumenYogur = Math.max(
        0,
        volumenBaseDisponible - nuevoLitrosGriego
      );
      const esDesvioTotal = nuevoVolumenYogur === 0 && nuevoLitrosGriego > 0;

      // Descontar litros del lote padre de Yogur Sin Azúcar (o auto-cerrar si desvío total)
      setBatchYogur((prev) => {
        let obs = prev.observaciones || '';
        const notaDesvio =
          'Lote desviado en su totalidad hacia sub-lotes (0 L remanentes)';
        if (esDesvioTotal) {
          if (!obs.includes(notaDesvio)) {
            obs = obs ? `${obs}. ${notaDesvio}.` : `${notaDesvio}.`;
          }
        } else {
          obs = obs
            .replace(
              /(\. )?Lote desviado en su totalidad hacia sub-lotes \(0 L remanentes\)\.?/g,
              ''
            )
            .trim();
        }

        return {
          ...prev,
          status: esDesvioTotal
            ? 'COMPLETADO'
            : prev.status === 'COMPLETADO'
            ? 'NOMINAL'
            : prev.status,
          observaciones: obs || undefined,
          processTimer: {
            ...prev.processTimer,
            isRunning: esDesvioTotal ? false : prev.processTimer.isRunning,
            isCompleted: esDesvioTotal ? true : prev.processTimer.isCompleted,
          },
          pasteurizacion: {
            ...prev.pasteurizacion,
            litrosLeche: nuevoVolumenYogur,
            extraccionGriego: {
              realizado: nuevoLitrosGriego > 0,
              litrosExtraidos: nuevoLitrosGriego,
              hora: timeStr,
            },
          },
        };
      });

      // Configurar el Lote Hijo de Yogur Griego heredando materias primas y etapas previas
      setBatchYogurGriego((prev) => {
        const loteLecheHeredado =
          batchYogur.pasteurizacion.loteLeche || prev.pasteurizacion.loteLeche;
        const loteCultivoHeredado =
          batchYogur.inoculacion.loteCultivo ||
          batchYogur.pasteurizacion.loteCultivoLacticoPastur ||
          prev.inoculacion.loteCultivo;

        const horaEntradaFrio =
          batchYogur.inoculacion.incubacion.horaEntradaCuartoFrio ||
          batchYogur.inoculacion.incubacion.horaFin ||
          timeStr;
        const timestampEntradaFrio =
          batchYogur.inoculacion.incubacion.horaEntradaCuartoFrio
            ? timeStringToTimestampToday(
                batchYogur.inoculacion.incubacion.horaEntradaCuartoFrio
              )
            : now;

        const masaEstimada = 0;
        const sueroEstimado = 0;

        return {
          ...prev,
          id: childGriegoId,
          productId: 'prod-yogur-griego',
          productName: 'Yogur Griego',
          lineId: 'line-fermentacion',
          operator: batchYogur.operator || prev.operator,
          responsableProceso:
            batchYogur.responsableProceso ||
            batchYogur.operator ||
            prev.responsableProceso,
          operatorRole: batchYogur.operatorRole || prev.operatorRole,
          operariosIntervinientes:
            batchYogur.operariosIntervinientes || prev.operariosIntervinientes,
          status: 'NOMINAL',
          processTimer: {
            ...prev.processTimer,
            isRunning: true,
            isCompleted: false,
            startTime: batchYogur.processTimer.startTime || timeStr,
            startTimestamp: batchYogur.processTimer.startTimestamp || now,
          },
          stageStatuses: {
            acidificar: 'completada',
            'calentar-y-cuajar': 'completada',
            desuerar: 'en_proceso',
            hilar: 'pendiente',
            moldeo: 'pendiente',
          },
          pasteurizacion: {
            ...prev.pasteurizacion,
            litrosLeche: nuevoLitrosGriego,
            loteLeche: loteLecheHeredado,
            calentamiento: {
              ...prev.pasteurizacion.calentamiento,
              iniciado: true,
              completado: true,
              horaInicio:
                batchYogur.pasteurizacion.calentamiento?.horaInicio || timeStr,
              horaFin:
                batchYogur.pasteurizacion.calentamiento?.horaFin || timeStr,
              tiempoCalentamiento:
                batchYogur.pasteurizacion.calentamiento?.tiempoCalentamiento ||
                null,
            },
            sostenimiento: {
              ...prev.pasteurizacion.sostenimiento,
              iniciado: true,
              completado: true,
              horaInicio:
                batchYogur.pasteurizacion.sostenimiento?.horaInicio || timeStr,
              horaFin:
                batchYogur.pasteurizacion.sostenimiento?.horaFin || timeStr,
              duracionReal:
                batchYogur.pasteurizacion.sostenimiento?.duracionReal ||
                null,
            },
            enfriamiento: {
              ...prev.pasteurizacion.enfriamiento,
              enfriamientoIniciado: true,
              enfriamientoCompletado: true,
              horaInicio:
                batchYogur.pasteurizacion.enfriamiento?.horaInicio || timeStr,
              horaFinEnfriamiento:
                batchYogur.pasteurizacion.enfriamiento?.horaFinEnfriamiento ||
                timeStr,
              tiempoEnfriamiento:
                batchYogur.pasteurizacion.enfriamiento?.tiempoEnfriamiento ||
                null,
            },
            trasiego: {
              ...prev.pasteurizacion.trasiego,
              iniciado: true,
              completado: true,
              horaInicio:
                batchYogur.pasteurizacion.trasiego?.horaInicio || timeStr,
              horaFin: batchYogur.pasteurizacion.trasiego?.horaFin || timeStr,
              tiempoTrasiego:
                batchYogur.pasteurizacion.trasiego?.tiempoTrasiego || null,
            },
          },
          inoculacion: {
            ...prev.inoculacion,
            loteCultivo: loteCultivoHeredado,
            temperaturaConfirmada: true,
            mezcladoConfirmado: true,
            inoculacionConfirmada: true,
            horaInoculacion: batchYogur.inoculacion.horaInoculacion || timeStr,
            incubacion: {
              ...prev.inoculacion.incubacion,
              iniciada: true,
              completada: true,
              horaInicio:
                batchYogur.inoculacion.incubacion?.horaInicio || timeStr,
              horaFin: batchYogur.inoculacion.incubacion?.horaFin || timeStr,
              tiempoTranscurrido:
                batchYogur.inoculacion.incubacion?.tiempoTranscurrido || null,
            },
          },
          maduracionYFiltrado: {
            cuartoFrio: {
              ...prev.maduracionYFiltrado.cuartoFrio,
              iniciado: true,
              completado: false,
              horaInicio: horaEntradaFrio,
              timestampInicio: timestampEntradaFrio,
              tiempoTranscurrido: null,
            },
            filtradoTelas: {
              ...prev.maduracionYFiltrado.filtradoTelas,
              iniciado: false,
              completado: false,
              horaInicio: null,
              timestampInicio: null,
              tiempoTranscurrido: null,
              masaFiltradaKg: masaEstimada,
              sueroEliminadoEstimadoLitros: sueroEstimado,
            },
          },
        };
      });

      // Sincronizar asignación en Lote Padre
      setParentBatch((prev) => {
        let childFound = false;
        const updatedChildren = prev.childBatches.map((child) => {
          if (child.id === batchYogur.id || child.productId === 'prod-yogur') {
            return {
              ...child,
              allocatedLiters: nuevoVolumenYogur,
              status: (esDesvioTotal
                ? 'completado'
                : 'en_proceso') as 'completado' | 'en_proceso',
            };
          }
          if (
            child.id === childGriegoId ||
            child.productId === 'prod-yogur-griego'
          ) {
            childFound = true;
            return {
              ...child,
              id: childGriegoId,
              allocatedLiters: nuevoLitrosGriego,
              status: 'en_proceso' as const,
            };
          }
          return child;
        });

        if (!childFound) {
          updatedChildren.push({
            id: childGriegoId,
            parentBatchId: prev.id,
            variant: 'yogur_griego',
            productId: 'prod-yogur-griego',
            productName: 'Yogur Griego',
            allocatedLiters: nuevoLitrosGriego,
            llevaAzucar: false,
            targetInoculationTempRange: '42 - 45 °C',
            createdAt: timeStr,
            status: 'en_proceso' as const,
          });
        }

        return {
          ...prev,
          childBatches: updatedChildren,
        };
      });

      setStagesByProduct((prev) => ({
        ...prev,
        'prod-yogur-griego': 'desuerar',
      }));
      setActiveProductId('prod-yogur-griego');
      setSelectedLineId('line-fermentacion');

      showToast(
        esDesvioTotal
          ? `✓ Desvío total hacia Yogur Griego (${childGriegoId}) con ${nuevoLitrosGriego} L. El lote padre fue completado y cerrado (0 L remanentes).`
          : `✓ Lote Hijo de Yogur Griego (${childGriegoId}) generado con ${nuevoLitrosGriego} L. Se transfirió el foco a Maduración y Filtrado.`,
        'success'
      );
    },
    [
      batchYogur.id,
      batchYogur.operator,
      batchYogur.responsableProceso,
      batchYogur.operatorRole,
      batchYogur.operariosIntervinientes,
      batchYogur.pasteurizacion,
      batchYogur.inoculacion,
      batchYogur.processTimer,
      showToast,
    ]
  );

  // Sincronizar automáticamente la hora de fin de retención del Yogur con el inicio de enfriamiento del Kumis
  useEffect(() => {
    const horaFinYogur = batchYogur.pasteurizacion.sostenimiento?.horaFin;
    const duracionYogur = batchYogur.pasteurizacion.sostenimiento?.duracionReal;
    const extraccionRealizada = Boolean(
      batchYogur.pasteurizacion.extraccionKumis?.realizado
    );

    if (extraccionRealizada && horaFinYogur) {
      setBatchKumis((prevKumis) => {
        if (
          prevKumis.pasteurizacion.sostenimiento?.horaFin === horaFinYogur &&
          prevKumis.pasteurizacion.enfriamiento?.horaInicio === horaFinYogur
        ) {
          return prevKumis;
        }

        const nuevoEnfriamiento = {
          ...prevKumis.pasteurizacion.enfriamiento,
          horaInicio: horaFinYogur,
          horaInicioEnfriamiento: horaFinYogur,
          timestampInicioEnfriamiento: timeStringToTimestampToday(horaFinYogur),
        };

        if (
          prevKumis.pasteurizacion.enfriamiento?.enfriamientoCompletado &&
          prevKumis.pasteurizacion.enfriamiento?.horaFinEnfriamiento
        ) {
          nuevoEnfriamiento.tiempoEnfriamiento = computeDurationBetweenTimes(
            horaFinYogur,
            prevKumis.pasteurizacion.enfriamiento.horaFinEnfriamiento
          ).human;
        }

        return {
          ...prevKumis,
          pasteurizacion: {
            ...prevKumis.pasteurizacion,
            sostenimiento: {
              ...prevKumis.pasteurizacion.sostenimiento,
              horaFin: horaFinYogur,
              duracionReal:
                duracionYogur ||
                prevKumis.pasteurizacion.sostenimiento?.duracionReal,
            },
            enfriamiento: nuevoEnfriamiento,
          },
        };
      });
    }
  }, [
    batchYogur.pasteurizacion.sostenimiento?.horaFin,
    batchYogur.pasteurizacion.sostenimiento?.duracionReal,
    batchYogur.pasteurizacion.extraccionKumis?.realizado,
  ]);

  // INICIAR CRONÓMETROS POR PRODUCTO
  const handleStartProcessTimer = useCallback(() => {
    const now = Date.now();
    const timeStr = getCurrentTimeString();

    setBatch((prev) => ({
      ...prev,
      processTimer: {
        ...prev.processTimer,
        isRunning: true,
        isCompleted: false,
        startTime: timeStr,
        startTimestamp: now,
        elapsedSeconds: 0,
        formattedTime: '00:00:00',
      },
      acidificar: {
        ...prev.acidificar,
        inicioCalentamiento: {
          iniciado: true,
          horaInicio: timeStr,
          timestampInicio: now,
        },
      },
    }));

    showToast(
      `⏱ Calentamiento iniciado a las ${timeStr} (${batch.productName}).`,
      'info'
    );
  }, [batch.productName, setBatch, showToast]);

  // DETENER EL CRONÓMETRO GENERAL DEL LOTE (Al terminar el hilado en paila)
  const handleStopProcessTimer = useCallback(
    (customEndTime?: string) => {
      const now = Date.now();
      const timeStr = customEndTime || getCurrentTimeString();

      setBatch((prev) => {
        const startTs = prev.processTimer.startTimestamp;
        const finalElapsedSec = startTs
          ? Math.max(
              prev.processTimer.elapsedSeconds,
              Math.floor((now - startTs) / 1000)
            )
          : prev.processTimer.elapsedSeconds;
        const totalTime = formatSecondsToHMS(Math.max(0, finalElapsedSec));

        return {
          ...prev,
          processTimer: {
            ...prev.processTimer,
            isRunning: false,
            isCompleted: true,
            endTime: timeStr,
            endTimestamp: now,
            elapsedSeconds: finalElapsedSec,
            formattedTime: totalTime,
          },
          hilar: {
            ...prev.hilar,
            procesoFinalizado: {
              finalizado: true,
              horaFinalizacion: timeStr,
              tiempoTotalProceso: totalTime,
            },
          },
        };
      });

      showToast(
        `⏱ Cronómetro general de producción detenido a las ${timeStr}. Listo para moldeo.`,
        'info'
      );
    },
    [setBatch, showToast]
  );

  const handleStartProcessTimerYogur = useCallback(() => {
    const now = Date.now();
    const timeStr = getCurrentTimeString();

    setBatchYogur((prev) => ({
      ...prev,
      processTimer: {
        ...prev.processTimer,
        isRunning: true,
        isCompleted: false,
        startTime: timeStr,
        startTimestamp: now,
        elapsedSeconds: 0,
        formattedTime: '00:00:00',
      },
      stageStatuses: {
        ...prev.stageStatuses,
        acidificar: 'en_proceso',
      },
    }));

    showToast(`⏱ Reloj de Yogur en marcha desde las ${timeStr}.`, 'info');
  }, [showToast]);

  const handleStartProcessTimerKumis = useCallback(() => {
    const now = Date.now();
    const timeStr = getCurrentTimeString();

    setBatchKumis((prev) => ({
      ...prev,
      processTimer: {
        ...prev.processTimer,
        isRunning: true,
        isCompleted: false,
        startTime: timeStr,
        startTimestamp: now,
        elapsedSeconds: 0,
        formattedTime: '00:00:00',
      },
      stageStatuses: {
        ...prev.stageStatuses,
        acidificar: 'en_proceso',
      },
    }));

    showToast(`⏱ Reloj de Kumis en marcha desde las ${timeStr}.`, 'info');
  }, [showToast]);

  const handleStartProcessTimerYogurGriego = useCallback(() => {
    const now = Date.now();
    const timeStr = getCurrentTimeString();

    setBatchYogurGriego((prev) => ({
      ...prev,
      processTimer: {
        ...prev.processTimer,
        isRunning: true,
        isCompleted: false,
        startTime: timeStr,
        startTimestamp: now,
        elapsedSeconds: 0,
        formattedTime: '00:00:00',
      },
      stageStatuses: {
        ...prev.stageStatuses,
        acidificar: 'en_proceso',
      },
    }));

    showToast(
      `⏱ Reloj de Yogur Griego en marcha desde las ${timeStr}.`,
      'info'
    );
  }, [showToast]);

  // AVANZAR DE ETAPA EN EL SUB-LOTE ACTIVO
  const handleNextStage = useCallback(() => {
    if (isKumis) {
      const kumisStages: StageId[] = ['acidificar', 'calentar-y-cuajar', 'moldeo'];
      const currentIndex = kumisStages.indexOf(currentStage);
      if (currentIndex !== -1 && currentIndex < kumisStages.length - 1) {
        const nextStage = kumisStages[currentIndex + 1];
        setCurrentStage(nextStage);
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        setBatchKumis((prev) => ({
          ...prev,
          stageStatuses: {
            ...prev.stageStatuses,
            [currentStage]: 'completada',
            [nextStage]: 'en_proceso',
          },
        }));
        return;
      } else {
        setKumisReviewModalOpen(true);
        return;
      }
    }

    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    if (currentIndex < STAGE_ORDER.length - 1) {
      const nextStage = STAGE_ORDER[currentIndex + 1];
      setCurrentStage(nextStage);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

      if (isYogurGriego) {
        setBatchYogurGriego((prev) => ({
          ...prev,
          stageStatuses: {
            ...prev.stageStatuses,
            [currentStage]: 'completada',
            [nextStage]: 'en_proceso',
          },
        }));
      } else if (isYogur) {
        setBatchYogur((prev) => ({
          ...prev,
          stageStatuses: {
            ...prev.stageStatuses,
            [currentStage]: 'completada',
            [nextStage]: 'en_proceso',
          },
        }));
      } else {
        setBatch((prev) => ({
          ...prev,
          stageStatuses: {
            ...prev.stageStatuses,
            [currentStage]: 'completada',
            [nextStage]: 'en_proceso',
          },
        }));
      }
    } else {
      if (isYogurGriego) {
        setYogurGriegoReviewModalOpen(true);
      } else if (isKumis) {
        setKumisReviewModalOpen(true);
      } else if (isYogur) {
        setYogurReviewModalOpen(true);
      } else {
        setReviewModalOpen(true);
      }
    }
  }, [
    currentStage,
    isKumis,
    isYogur,
    isYogurGriego,
    setBatch,
    setCurrentStage,
  ]);

  // FINALIZAR LOTES
  const handleFinalizeYogurGriegoBatch = useCallback((_openModal: boolean = true) => {
    const timeStr = getCurrentTimeString();
    const { seconds: totalSeconds, hms: totalTime } = totalTimeOf(batchYogurGriego.processTimer);

    setBatchYogurGriego((prev) => ({
      ...prev,
      status: 'COMPLETADO',
      processTimer: {
        ...prev.processTimer,
        isRunning: false,
        isCompleted: true,
        elapsedSeconds: totalSeconds,
        formattedTime: totalTime,
      },
      stageStatuses: {
        acidificar: 'completada',
        'calentar-y-cuajar': 'completada',
        desuerar: 'completada',
        hilar: 'completada',
        moldeo: 'completada',
      },
      envasado: {
        ...prev.envasado,
        procesoFinalizado: {
          finalizado: true,
          horaFinalizacion: timeStr,
          tiempoTotalProceso: totalTime,
        },
      },
    }));
    setYogurGriegoReviewModalOpen(true);
    showToast(
      `✓ Lote de Yogur Griego terminado y guardado (${totalTime}).`,
      'success'
    );
  }, [batchYogurGriego.processTimer, showToast]);

  const handleFinalizeKumisBatch = useCallback(
    (openModal: boolean = true) => {
      const timeStr = getCurrentTimeString();
      const { seconds: totalSeconds, hms: totalTime } = totalTimeOf(batchKumis.processTimer);

      setBatchKumis((prev) => ({
        ...prev,
        status: 'COMPLETADO',
        processTimer: {
          ...prev.processTimer,
          isRunning: false,
          isCompleted: true,
          elapsedSeconds: totalSeconds,
          formattedTime: totalTime,
        },
        stageStatuses: {
          acidificar: 'completada',
          'calentar-y-cuajar': 'completada',
          desuerar: 'completada',
          hilar: 'completada',
          moldeo: 'completada',
        },
        envasado: {
          ...prev.envasado,
          procesoFinalizado: {
            finalizado: true,
            horaFinalizacion: timeStr,
            tiempoTotalProceso: totalTime,
          },
        },
      }));
      if (openModal) {
        setKumisReviewModalOpen(true);
      }
      showToast(`✓ Lote de Kumis terminado y guardado (${totalTime}).`, 'success');
    },
    [batchKumis.processTimer, showToast]
  );

  const handleFinalizeYogurBatch = useCallback(
    (openModal: boolean = true) => {
      const timeStr = getCurrentTimeString();
      const { seconds: totalSeconds, hms: totalTime } = totalTimeOf(batchYogur.processTimer);

      setBatchYogur((prev) => ({
        ...prev,
        status: 'COMPLETADO',
        processTimer: {
          ...prev.processTimer,
          isRunning: false,
          isCompleted: true,
          elapsedSeconds: totalSeconds,
          formattedTime: totalTime,
        },
        stageStatuses: {
          acidificar: 'completada',
          'calentar-y-cuajar': 'completada',
          desuerar: 'completada',
          hilar: 'completada',
          moldeo: 'completada',
        },
        envasado: {
          ...prev.envasado,
          procesoFinalizado: {
            finalizado: true,
            horaFinalizacion: timeStr,
            tiempoTotalProceso: totalTime,
          },
        },
      }));
      if (openModal) {
        setYogurReviewModalOpen(true);
      }
      showToast(`✓ Lote de Yogur terminado y guardado (${totalTime}).`, 'success');
    },
    [batchYogur.processTimer, showToast]
  );

  const handleFinalizeBatch = useCallback(
    (openModal: boolean = true) => {
      const nowTs = Date.now();
      const timeStr = getCurrentTimeString();
      const finalElapsedSec = batch.processTimer.startTimestamp
        ? Math.max(
            batch.processTimer.elapsedSeconds,
            Math.floor((nowTs - batch.processTimer.startTimestamp) / 1000)
          )
        : batch.processTimer.elapsedSeconds;
      const totalTime = formatSecondsToHMS(Math.max(0, finalElapsedSec));

      setBatch((prev) => ({
        ...prev,
        status: 'COMPLETADO',
        processTimer: {
          ...prev.processTimer,
          isRunning: false,
          isCompleted: true,
          elapsedSeconds: finalElapsedSec || prev.processTimer.elapsedSeconds,
          formattedTime: totalTime,
        },
        stageStatuses: {
          acidificar: 'completada',
          'calentar-y-cuajar': 'completada',
          desuerar: 'completada',
          hilar: 'completada',
          moldeo: 'completada',
        },
        calentarYCuajar: {
          ...prev.calentarYCuajar,
          cuajado: {
            ...prev.calentarYCuajar.cuajado,
            registrado: true,
            horaRegistro:
              prev.calentarYCuajar.cuajado.horaRegistro || timeStr,
          },
          corte: {
            ...prev.calentarYCuajar.corte,
            registrado: true,
            horaRegistro: prev.calentarYCuajar.corte.horaRegistro || timeStr,
          },
          temperatura40: {
            ...prev.calentarYCuajar.temperatura40,
            alcanzado: true,
            horaRegistro:
              prev.calentarYCuajar.temperatura40.horaRegistro || timeStr,
          },
        },
        desuerar: {
          ...prev.desuerar,
          desuerado: {
            ...prev.desuerar.desuerado,
            registrado: true,
            horaRegistro: prev.desuerar.desuerado.horaRegistro || timeStr,
          },
          escurrido: {
            ...prev.desuerar.escurrido,
            iniciado: true,
            completado: true,
            horaFin: prev.desuerar.escurrido.horaFin || timeStr,
          },
        },
        hilar: {
          ...prev.hilar,
          pruebaHilado: {
            ...prev.hilar.pruebaHilado,
            exitosa: true,
            horaRegistro: prev.hilar.pruebaHilado.horaRegistro || timeStr,
          },
          hiladoEnPaila: {
            ...prev.hilar.hiladoEnPaila,
            iniciado: true,
            completado: true,
            horaFin: prev.hilar.hiladoEnPaila?.horaFin || timeStr,
            duracion: prev.hilar.hiladoEnPaila?.duracion || null,
          },
          extruirYAirear: {
            ...prev.hilar.extruirYAirear,
            completado: true,
            horaFin: prev.hilar.extruirYAirear.horaFin || timeStr,
            duracion: prev.hilar.extruirYAirear.duracion || null,
          },
          procesoFinalizado: {
            finalizado: true,
            horaFinalizacion: timeStr,
            tiempoTotalProceso: totalTime,
          },
        },
      }));
      if (openModal) {
        setReviewModalOpen(true);
        showToast(
          `✓ Lote terminado (${totalTime}). Se detuvo el reloj del lote.`,
          'success'
        );
      }
    },
    [
      batch.processTimer.elapsedSeconds,
      batch.processTimer.formattedTime,
      batch.processTimer.startTimestamp,
      setBatch,
      showToast,
    ]
  );

  const persistedProducts = useMemo<PersistedProduct[]>(
    () => [
      { productId: 'prod-doble-crema-premium', lineCode: 'L-HILADA-01', state: batchPremium, setState: setBatchPremium, createTemplate: createInitialPremiumBatch },
      { productId: 'prod-doble-crema-industrial', lineCode: 'L-HILADA-01', state: batchIndustrial, setState: setBatchIndustrial, createTemplate: createInitialIndustrialBatch },
      { productId: 'prod-queso-pera', lineCode: 'L-HILADA-01', state: batchPera, setState: setBatchPera, createTemplate: createInitialPeraBatch },
      { productId: 'prod-queso-7-cueros', lineCode: 'L-HILADA-01', state: batch7Cueros, setState: setBatch7Cueros, createTemplate: createInitial7CuerosBatch },
      { productId: 'prod-yogur', lineCode: 'L-FERMENT-02', state: batchYogur, setState: setBatchYogur, createTemplate: () => INITIAL_YOGUR_BATCH },
      { productId: 'prod-kumis', lineCode: 'L-FERMENT-02', state: batchKumis, setState: setBatchKumis, createTemplate: () => INITIAL_KUMIS_BATCH },
      { productId: 'prod-yogur-griego', lineCode: 'L-FERMENT-02', state: batchYogurGriego, setState: setBatchYogurGriego, createTemplate: () => INITIAL_YOGUR_GRIEGO_BATCH },
    ],
    [batchPremium, batchIndustrial, batchPera, batch7Cueros, batchYogur, batchKumis, batchYogurGriego]
  );

  const persistence = useBatchPersistence({
    enabled: persistenceEnabled,
    products: persistedProducts,
    stagesByProduct,
    setStagesByProduct,
    parentBatch,
    setParentBatch,
    showToast,
  });
  const { resetIfCompleted, resetParentSaved } = persistence;

  useEffect(() => {
    if (persistenceEnabled) return;
    setBatchPremium(createInitialPremiumBatch());
    setBatchIndustrial(createInitialIndustrialBatch());
    setBatchPera(createInitialPeraBatch());
    setBatch7Cueros(createInitial7CuerosBatch());
    setBatchYogur(INITIAL_YOGUR_BATCH);
    setBatchKumis(INITIAL_KUMIS_BATCH);
    setBatchYogurGriego(INITIAL_YOGUR_GRIEGO_BATCH);
    setParentBatch(createInitialParentBatch());
    setStagesByProduct(DEFAULT_STAGES);
  }, [persistenceEnabled]);

  // Seleccionar producto o sub-lote (conserva la etapa en que iba ese sub-lote)
  const selectProductBatch = useCallback(
    (productId: string, silent: boolean = false) => {
      if (resetIfCompleted(productId)) {
        setStagesByProduct((prev) => ({
          ...prev,
          [productId]: DEFAULT_STAGES[productId] ?? 'acidificar',
        }));
        if (productId === 'prod-yogur') {
          const freshParent = createInitialParentBatch();
          resetParentSaved(freshParent);
          setParentBatch(freshParent);
        }
      }
      setActiveProductId(productId);
      if (
        productId === 'prod-yogur' ||
        productId === 'prod-kumis' ||
        productId === 'prod-yogur-griego'
      ) {
        setSelectedLineId('line-fermentacion');
        if (productId === 'prod-yogur-griego') {
          setStagesByProduct((prev) => ({
            ...prev,
            'prod-yogur-griego':
              prev['prod-yogur-griego'] &&
              prev['prod-yogur-griego'] !== 'acidificar' &&
              prev['prod-yogur-griego'] !== 'calentar-y-cuajar'
                ? prev['prod-yogur-griego']
                : 'desuerar',
          }));
        }
      } else {
        setSelectedLineId('line-pasta-hilada');
      }

      if (!silent) {
        const names: Record<string, string> = {
          'prod-yogur': 'Yogur Probiótico',
          'prod-kumis': 'Kumis Tradicional',
          'prod-yogur-griego': 'Yogur Griego',
          'prod-doble-crema-industrial': 'Queso Doble Crema Industrial',
          'prod-doble-crema-premium': 'Queso Doble Crema Tradicional',
          'prod-queso-pera': 'Queso Pera',
          'prod-queso-7-cueros': 'Queso 7 Cueros',
        };
        showToast(
          `✓ Trabajando en: ${names[productId] || productId}.`,
          'info'
        );
      }
    },
    [resetIfCompleted, resetParentSaved, showToast]
  );

  // PESTAÑAS PARA EL SELECTOR RÁPIDO DE SUB-LOTES
  const subBatchTabs = useMemo<SubBatchTabInfo[]>(() => {
    if (isFermentacionLine) {
      const yogurStage = stagesByProduct['prod-yogur'] || 'acidificar';
      const kumisStage = stagesByProduct['prod-kumis'] || 'acidificar';
      const griegoStage = stagesByProduct['prod-yogur-griego'] || 'acidificar';

      const allFermentadosTabs: SubBatchTabInfo[] = [
        {
          productId: 'prod-yogur',
          batchId: batchYogur.id,
          shortName: 'Yogur',
          fullName: batchYogur.productName,
          icon: 'icecream',
          allocatedLiters: batchYogur.pasteurizacion.litrosLeche,
          currentStage: yogurStage,
          currentStageNumber: STAGE_ORDER.indexOf(yogurStage) + 1,
          stageLabel: FERMENTADOS_STAGE_LABELS[yogurStage],
          status: batchYogur.status,
          timer: batchYogur.processTimer,
          isChildOfParent: true,
        },
        {
          productId: 'prod-kumis',
          batchId: batchKumis.id,
          shortName: 'Kumis',
          fullName: batchKumis.productName,
          icon: 'local_drink',
          allocatedLiters: batchKumis.pasteurizacion.litrosLeche,
          currentStage: kumisStage,
          currentStageNumber:
            kumisStage === 'moldeo' || kumisStage === 'hilar'
              ? 3
              : kumisStage === 'calentar-y-cuajar' || kumisStage === 'desuerar'
              ? 2
              : 1,
          stageLabel:
            kumisStage === 'moldeo' || kumisStage === 'hilar'
              ? '3. Envasado'
              : kumisStage === 'calentar-y-cuajar' || kumisStage === 'desuerar'
              ? '2. Inoculación'
              : '1. Pasteurización',
          status: batchKumis.status,
          timer: batchKumis.processTimer,
          isChildOfParent: true,
        },
        {
          productId: 'prod-yogur-griego',
          batchId: batchYogurGriego.id,
          shortName: 'Yogur Griego',
          fullName: batchYogurGriego.productName,
          icon: 'filter_alt',
          allocatedLiters: batchYogurGriego.pasteurizacion.litrosLeche,
          currentStage: griegoStage,
          currentStageNumber: STAGE_ORDER.indexOf(griegoStage) + 1,
          stageLabel: FERMENTADOS_STAGE_LABELS[griegoStage],
          status: batchYogurGriego.status,
          timer: batchYogurGriego.processTimer,
          isChildOfParent: true,
        },
      ];

      // Si un sub-lote no ha sido instanciado o tiene 0 Litros, su pestaña NO se renderiza
      return allFermentadosTabs.filter(
        (tab) => tab.productId === 'prod-yogur' || (tab.allocatedLiters ?? 0) > 0
      );
    }

    // Pestañas para Línea de Pasta Hilada (Quesos)
    const cheeseItems: {
      productId: string;
      shortName: string;
      icon: string;
      data: BatchData;
    }[] = [
      {
        productId: 'prod-doble-crema-premium',
        shortName: 'Doble Crema Trad.',
        icon: 'local_pizza',
        data: batchPremium,
      },
      {
        productId: 'prod-doble-crema-industrial',
        shortName: 'Doble Crema Ind.',
        icon: 'factory',
        data: batchIndustrial,
      },
      {
        productId: 'prod-queso-pera',
        shortName: 'Queso Pera',
        icon: 'spa',
        data: batchPera,
      },
      {
        productId: 'prod-queso-7-cueros',
        shortName: 'Queso 7 Cueros',
        icon: 'layers',
        data: batch7Cueros,
      },
    ];

    return cheeseItems.map((item) => {
      const st = stagesByProduct[item.productId] || 'acidificar';
      const liters =
        (item.data.acidificar.insumos.lecheFresca || 0) +
        (item.data.acidificar.insumos.lecheAcida || 0);
      return {
        productId: item.productId,
        batchId: item.data.id,
        shortName: item.shortName,
        fullName: item.data.productName,
        icon: item.icon,
        allocatedLiters: liters,
        currentStage: st,
        currentStageNumber: STAGE_ORDER.indexOf(st) + 1,
        stageLabel: QUESOS_STAGE_LABELS[st],
        status: item.data.status,
        timer: item.data.processTimer,
        isChildOfParent: false,
      };
    });
  }, [
    isFermentacionLine,
    stagesByProduct,
    activeProductId,
    batchYogur,
    batchKumis,
    batchYogurGriego,
    batchPremium,
    batchIndustrial,
    batchPera,
    batch7Cueros,
  ]);

  // Datos consolidados del encabezado / sidebar según el lote activo
  const activeHeaderBatch: BatchData = useMemo(() => {
    if (isYogurGriego) {
      return {
        ...batch,
        id: batchYogurGriego.id,
        productName: batchYogurGriego.productName,
        productId: batchYogurGriego.productId,
        line: batchYogurGriego.line,
        status: batchYogurGriego.status,
        processTimer: batchYogurGriego.processTimer,
      };
    }
    if (isKumis) {
      return {
        ...batch,
        id: batchKumis.id,
        productName: batchKumis.productName,
        productId: batchKumis.productId,
        line: batchKumis.line,
        status: batchKumis.status,
        processTimer: batchKumis.processTimer,
      };
    }
    if (isYogur) {
      return {
        ...batch,
        id: batchYogur.id,
        productName: batchYogur.productName,
        productId: batchYogur.productId,
        line: batchYogur.line,
        status: batchYogur.status,
        processTimer: batchYogur.processTimer,
      };
    }
    return batch;
  }, [batch, batchKumis, batchYogur, batchYogurGriego, isKumis, isYogur, isYogurGriego]);

  const activeStageStatuses = isYogurGriego
    ? batchYogurGriego.stageStatuses
    : isKumis
    ? batchKumis.stageStatuses
    : isYogur
    ? batchYogur.stageStatuses
    : batch.stageStatuses;

  const openActiveReviewModal = useCallback(() => {
    if (isYogurGriego) setYogurGriegoReviewModalOpen(true);
    else if (isKumis) setKumisReviewModalOpen(true);
    else if (isYogur) setYogurReviewModalOpen(true);
    else setReviewModalOpen(true);
  }, [isKumis, isYogur, isYogurGriego]);

  return {
    // Selección y Navegación de Etapa
    selectedLineId,
    setSelectedLineId,
    activeProductId,
    setActiveProductId,
    selectProductBatch,
    currentStage,
    setCurrentStage,
    handleNextStage,

    // Flags
    isIndustrial,
    isQuesoPera,
    isQueso7Cueros,
    isYogurGriego,
    isKumis,
    isYogur,
    isFermentacionLine,

    // Lote Padre y División Divergente
    parentBatch,
    startParentBatch,
    splitParentBatch,
    handleExtractKumisChildBatch,
    handleExtractYogurGriegoChildBatch,
    subBatchTabs,

    // Lotes Individuales
    batch,
    setBatch,
    batchIndustrial,
    setBatchIndustrial,
    batchPremium,
    setBatchPremium,
    batchPera,
    setBatchPera,
    batch7Cueros,
    setBatch7Cueros,
    batchYogur,
    setBatchYogur,
    batchKumis,
    setBatchKumis,
    batchYogurGriego,
    setBatchYogurGriego,

    // Datos activos para Header/Sidebar
    activeHeaderBatch,
    activeStageStatuses,

    // Inicio y detención de cronómetros
    handleStartProcessTimer,
    handleStopProcessTimer,
    handleStartProcessTimerYogur,
    handleStartProcessTimerKumis,
    handleStartProcessTimerYogurGriego,

    // Finalización de lotes
    handleFinalizeBatch,
    handleFinalizeYogurBatch,
    handleFinalizeKumisBatch,
    handleFinalizeYogurGriegoBatch,

    // Modales de resumen
    reviewModalOpen,
    setReviewModalOpen,
    yogurReviewModalOpen,
    setYogurReviewModalOpen,
    kumisReviewModalOpen,
    setKumisReviewModalOpen,
    yogurGriegoReviewModalOpen,
    setYogurGriegoReviewModalOpen,
    openActiveReviewModal,

    // Asignación de operario
    assignOperatorToAllBatches,

    // Persistencia en base de datos
    syncStatus: persistence.syncStatus,
    hydrated: persistence.hydrated,
    markRectified: persistence.markRectified,
  };
}
