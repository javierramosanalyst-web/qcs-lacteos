import React, { useState, useEffect, useMemo } from 'react';
import { ManualEditToggle } from '../../../components/ui/ManualEditToggle';
import {
  CalentarYCuajarState,
  LotesLeche,
  LOTES_CUAJO_PERA_DEFAULT,
  ProcessTimerState,
} from '../../../types';
import {
  formatHumanDuration,
  getCurrentTimeString,
  formatTimeFromStep1,
  computeDurationBetweenTimes,
  timeStringToSecondsToday,
} from '../../../utils/timer';
import { useStageCountdown } from '../../../hooks/useStageCountdown';
import {
  StageHeader,
  Card,
  TimerBanner,
  ConfirmButton,
  InputField,
  SelectField,
  Button,
  Badge,
  PopoverTimePicker,
} from '../../../components/ui';

interface CalentarYCuajarStagePeraProps {
  state: CalentarYCuajarState;
  onChange: (updater: (prev: CalentarYCuajarState) => CalentarYCuajarState) => void;
  processTimer: ProcessTimerState;
  horaInicioCalentamientoDesdeAcidificar?: string | null;
  timestampInicioCalentamientoDesdeAcidificar?: number | null;
  horaAdicionCuajoDesdeAcidificar?: string | null;
  timestampAdicionCuajoDesdeAcidificar?: number | null;
  lotesLeche: LotesLeche;
  loteCuajo?: string;
  loteCultivoPera?: string;
  tipoCuajo?: string;
  cantidadCuajoSugerida?: string | number;
  totalLecheMezcla?: number;
  onUpdateCuajoLote?: (newLote: string) => void;
  onNextStage: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const CalentarYCuajarStagePera: React.FC<CalentarYCuajarStagePeraProps> = ({
  state,
  onChange,
  processTimer,
  horaInicioCalentamientoDesdeAcidificar,
  timestampInicioCalentamientoDesdeAcidificar,
  horaAdicionCuajoDesdeAcidificar,
  timestampAdicionCuajoDesdeAcidificar,
  lotesLeche,
  loteCuajo = '',
  loteCultivoPera,
  totalLecheMezcla,
  onUpdateCuajoLote,
  onNextStage,
  showToast,
}) => {
  // Litros totales de leche para Queso Pera
  const totalLitros =
    lotesLeche.litrosConfirmados ||
    totalLecheMezcla ||
    lotesLeche.litrosLote1 ||
    0;

  // Dosis de cultivo láctico: 1 cucharada por cada 40 L
  const cultivoCalculadoCucharadas =
    totalLitros > 0 ? Number((totalLitros / 40).toFixed(2)) : 0;

  // Lote de cultivo heredado de la etapa anterior (solo lectura)
  const loteCultivoMostrado = (
    loteCultivoPera ||
    state.cultivoLacticoPera?.loteCultivo ||
    lotesLeche.loteCultivoLacteo ||
    ''
  ).trim();

  // Dosis de cuajo del Queso Pera: 1.2 g por cada 100 L
  const cuajoCalculado =
    totalLitros > 0 ? Number(((totalLitros * 1.2) / 100).toFixed(2)) : 0;

  // Lote de cuajo heredado de la etapa anterior (solo lectura)
  const loteCuajoMostrado = (
    loteCuajo ||
    state.adicionCuajo?.loteCuajo ||
    lotesLeche.loteCuajoPera ||
    ''
  ).trim();

  // =========================================================================
  // REFERENCIAS TEMPORALES OFICIALES
  // =========================================================================
  // Paso 1: Calentamiento inicial
  const horaInicioCalentamiento =
    horaInicioCalentamientoDesdeAcidificar ||
    processTimer.startTime ||
    'En espera';
  const tsInicioCalentamiento =
    timestampInicioCalentamientoDesdeAcidificar ||
    processTimer.startTimestamp ||
    null;

  // Paso 2: Llegó a 40 °C
  const llegoA40 = Boolean(
    state.llegada40?.alcanzado ||
      (state.temperatura40?.alcanzado &&
        state.temperatura40?.temperaturaAlcanzada >= 40.0)
  );
  const hora40Oficial =
    state.llegada40?.horaRegistro ||
    (state.temperatura40?.temperaturaAlcanzada >= 40.0
      ? state.temperatura40?.horaRegistro
      : null);
  const duracionCalentamientoOficial =
    state.llegada40?.tiempoCalentamiento40 ||
    (llegoA40 && horaInicioCalentamiento !== 'En espera' && hora40Oficial
      ? computeDurationBetweenTimes(horaInicioCalentamiento, hora40Oficial).human
      : state.temperatura40?.tiempoCalentamiento40 || '0 s');

  // Paso 3: Cultivo láctico adicionado
  const cultivoAdicionado = Boolean(state.cultivoLacticoPera?.registrado);
  const timestampCultivo = state.cultivoLacticoPera?.timestamp || null;
  const horaCultivoOficial = state.cultivoLacticoPera?.horaRegistro || null;
  const cucharadasCultivoOficial =
    state.cultivoLacticoPera?.cucharadas ?? cultivoCalculadoCucharadas;

  // Paso 5: Cuajo adicionado
  const cuajoAdicionado = Boolean(state.adicionCuajo?.registrado);
  const timestampCuajo =
    state.adicionCuajo?.timestampCuajo ||
    timestampAdicionCuajoDesdeAcidificar ||
    null;
  const horaCuajoOficial =
    state.adicionCuajo?.horaRegistro ||
    horaAdicionCuajoDesdeAcidificar ||
    state.horaAdicionCuajo ||
    null;
  const gramosCuajoOficial =
    state.adicionCuajo?.cantidadGramos ?? cuajoCalculado;
  const duracionReposoCultivoOficial =
    state.adicionCuajo?.tiempoTranscurridoDesdeCultivo ||
    (cuajoAdicionado && horaCultivoOficial && horaCuajoOficial
      ? computeDurationBetweenTimes(horaCultivoOficial, horaCuajoOficial).human
      : '0 s');

  // Paso 6: Cuajada confirmada
  const cuajadoConfirmado = Boolean(state.cuajado?.registrado);
  const horaCuajadoOficial = state.cuajado?.horaRegistro || null;
  const duracionCuajadoOficial =
    state.cuajado?.tiempoTranscurridoDesdeCuajo ||
    (cuajadoConfirmado && horaCuajoOficial && horaCuajadoOficial
      ? computeDurationBetweenTimes(horaCuajoOficial, horaCuajadoOficial).human
      : '0 s');
  const consistenciaOficial =
    state.cuajado?.consistencia || 'Cuajada firme / Corte limpio';

  // Paso 7: Corte y agitación suave
  const corteTerminado = Boolean(state.corte?.registrado);
  const horaCorteOficial = state.corte?.horaRegistro || null;
  const duracionCorteOficial =
    state.corte?.tiempoTranscurridoDesdeCuajado ||
    (corteTerminado && horaCuajadoOficial && horaCorteOficial
      ? computeDurationBetweenTimes(horaCuajadoOficial, horaCorteOficial).human
      : '0 s');

  // Paso 8 & 9: Reposo bajo suero y meta pH 5.8
  const timestampInicioReposo =
    state.timestampInicioReposo || state.corte?.timestampCorte || null;
  const reposoFinalizado = Boolean(
    state.finReposoPh58?.alcanzado ||
      (state.temperatura40?.alcanzado &&
        state.temperatura40?.temperaturaAlcanzada === 5.8)
  );
  const horaPh58Oficial =
    state.finReposoPh58?.horaRegistro ||
    (state.temperatura40?.temperaturaAlcanzada === 5.8
      ? state.temperatura40?.horaRegistro
      : null);
  const duracionReposoCuajadaOficial =
    state.finReposoPh58?.tiempoTotalReposo ||
    (reposoFinalizado && horaCorteOficial && horaPh58Oficial
      ? computeDurationBetweenTimes(horaCorteOficial, horaPh58Oficial).human
      : '0 s');

  // =========================================================================
  // CRONÓMETROS EN VIVO
  // =========================================================================
  // Paso 1: Cronómetro en vivo de calentamiento hacia 40 °C
  const timerCalentamiento = useStageCountdown({
    startTimestamp: tsInicioCalentamiento,
    isRunning: !llegoA40 && Boolean(tsInicioCalentamiento),
    isCompleted: llegoA40,
    completedDurationText: duracionCalentamientoOficial,
  });

  // Paso 4: Temporizador de 40 minutos de reposo del cultivo
  const premaduracionCountdown = useStageCountdown({
    startTime: timestampCultivo,
    endTimestamp: timestampCuajo,
    targetMinutes: 40,
    isRunning: cultivoAdicionado && !cuajoAdicionado,
    isCompleted: cuajoAdicionado,
    completedDurationText: duracionReposoCultivoOficial,
  });
  const temporizador40MinCumplido =
    cultivoAdicionado && premaduracionCountdown.remainingSeconds === 0;

  // Paso 8: Cronómetro de reposo de la cuajada bajo suero
  const reposoTimer = useStageCountdown({
    startTime: timestampInicioReposo,
    isRunning: corteTerminado && !reposoFinalizado,
    isCompleted: reposoFinalizado,
    completedDurationText: duracionReposoCuajadaOficial,
  });

  // =========================================================================
  // ESTADOS PARA MODO DE EDICIÓN MANUAL (ESTILO DOBLE CREMA PREMIUM)
  // =========================================================================
  // Paso 2: Llegó a 40 °C
  const [manualPaso2, setManualPaso2] = useState<boolean>(
    Boolean(state.llegada40?.esManual || state.temperatura40?.esManual)
  );
  const [draftHora40, setDraftHora40] = useState<string>(
    hora40Oficial || getCurrentTimeString()
  );
  const [draftTemp40, setDraftTemp40] = useState<number>(40.0);

  // Paso 3: Cultivo adicionado
  const [manualPaso3, setManualPaso3] = useState<boolean>(
    Boolean(state.cultivoLacticoPera?.esManual)
  );
  const [draftHoraCultivo, setDraftHoraCultivo] = useState<string>(
    horaCultivoOficial || getCurrentTimeString()
  );
  const [draftCucharadas, setDraftCucharadas] = useState<number>(
    cucharadasCultivoOficial
  );

  // Paso 5: Cuajo adicionado
  const [manualPaso5, setManualPaso5] = useState<boolean>(
    Boolean(state.adicionCuajo?.esManual)
  );
  const [draftHoraCuajo, setDraftHoraCuajo] = useState<string>(
    horaCuajoOficial || getCurrentTimeString()
  );
  const [draftGramosCuajo, setDraftGramosCuajo] = useState<number>(
    gramosCuajoOficial
  );

  // Paso 6: Cuajado confirmado
  const [manualPaso6, setManualPaso6] = useState<boolean>(
    Boolean(state.cuajado?.esManual)
  );
  const [draftHoraCuajado, setDraftHoraCuajado] = useState<string>(
    horaCuajadoOficial || getCurrentTimeString()
  );
  const [draftConsistencia, setDraftConsistencia] = useState<string>(
    consistenciaOficial
  );

  // Paso 7: Corte y agitación
  const [manualPaso7, setManualPaso7] = useState<boolean>(
    Boolean(state.corte?.esManual)
  );
  const [draftHoraCorte, setDraftHoraCorte] = useState<string>(
    horaCorteOficial || getCurrentTimeString()
  );

  // Paso 9: Llegada a pH 5.8
  const [manualPaso9, setManualPaso9] = useState<boolean>(
    Boolean(state.finReposoPh58?.esManual)
  );
  const [draftHoraPh58, setDraftHoraPh58] = useState<string>(
    horaPh58Oficial || getCurrentTimeString()
  );
  const [draftPhFinal, setDraftPhFinal] = useState<number>(5.8);

  // Sincronizaciones con el estado cuando no está en modo manual
  useEffect(() => {
    if (!manualPaso2) {
      setDraftHora40(hora40Oficial || getCurrentTimeString());
      setDraftTemp40(40.0);
    }
  }, [manualPaso2, hora40Oficial]);

  useEffect(() => {
    if (!manualPaso3) {
      setDraftHoraCultivo(horaCultivoOficial || getCurrentTimeString());
      setDraftCucharadas(cucharadasCultivoOficial);
    }
  }, [manualPaso3, horaCultivoOficial, cucharadasCultivoOficial]);

  useEffect(() => {
    if (!manualPaso5) {
      setDraftHoraCuajo(horaCuajoOficial || getCurrentTimeString());
      setDraftGramosCuajo(gramosCuajoOficial);
    }
  }, [manualPaso5, horaCuajoOficial, gramosCuajoOficial]);

  useEffect(() => {
    if (!manualPaso6) {
      setDraftHoraCuajado(horaCuajadoOficial || getCurrentTimeString());
      setDraftConsistencia(consistenciaOficial);
    }
  }, [manualPaso6, horaCuajadoOficial, consistenciaOficial]);

  useEffect(() => {
    if (!manualPaso7) {
      setDraftHoraCorte(horaCorteOficial || getCurrentTimeString());
    }
  }, [manualPaso7, horaCorteOficial]);

  useEffect(() => {
    if (!manualPaso9) {
      setDraftHoraPh58(horaPh58Oficial || getCurrentTimeString());
      setDraftPhFinal(5.8);
    }
  }, [manualPaso9, horaPh58Oficial]);

  // =========================================================================
  // HANDLERS PASO 2: CONFIRMAR QUE LA LECHE LLEGÓ A 40 °C
  // =========================================================================
  const handleRecordReach40 = () => {
    if (horaInicioCalentamiento === 'En espera' && !tsInicioCalentamiento) {
      showToast('Debes iniciar el calentamiento en la etapa anterior antes de registrar 40 °C.', 'warning');
      return;
    }

    const timeStr = getCurrentTimeString();
    const nowTs = Date.now();
    const duracionStr =
      horaInicioCalentamiento !== 'En espera'
        ? computeDurationBetweenTimes(horaInicioCalentamiento, timeStr).human
        : '0 s';

    onChange((prev) => ({
      ...prev,
      tempConsigna: 40.0,
      llegada40: {
        alcanzado: true,
        horaRegistro: timeStr,
        timestamp40Grados: nowTs,
        temperaturaAlcanzada: 40.0,
        tiempoCalentamiento40: duracionStr,
        esManual: false,
      },
      temperatura40: {
        ...prev.temperatura40,
        alcanzado: true,
        horaRegistro: timeStr,
        timestamp40Grados: nowTs,
        temperaturaAlcanzada: 40.0,
        tiempoCalentamiento40: duracionStr,
        esManual: false,
      },
      telemetria: {
        ...prev.telemetria,
        temperatura: 40.0,
      },
    }));

    setDraftHora40(timeStr);
    setManualPaso2(false);
    showToast(
      `✓ Leche a 40 °C confirmada a las ${timeStr} (${duracionStr})`,
      'success'
    );
  };

  const handleSaveManualReach40 = () => {
    if (horaInicioCalentamiento === 'En espera' && !tsInicioCalentamiento) {
      showToast('Debes iniciar el calentamiento en la etapa anterior antes de registrar 40 °C.', 'warning');
      return;
    }

    const formattedHora = formatTimeFromStep1(draftHora40);
    const duracionStr =
      horaInicioCalentamiento !== 'En espera'
        ? computeDurationBetweenTimes(horaInicioCalentamiento, formattedHora)
            .human
        : '0 s';

    const sec = timeStringToSecondsToday(formattedHora);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualTs = today.getTime() + sec * 1000;

    onChange((prev) => ({
      ...prev,
      tempConsigna: draftTemp40 || 40.0,
      llegada40: {
        alcanzado: true,
        horaRegistro: formattedHora,
        timestamp40Grados: manualTs,
        temperaturaAlcanzada: draftTemp40 || 40.0,
        tiempoCalentamiento40: duracionStr,
        esManual: true,
      },
      temperatura40: {
        ...prev.temperatura40,
        alcanzado: true,
        horaRegistro: formattedHora,
        timestamp40Grados: manualTs,
        temperaturaAlcanzada: draftTemp40 || 40.0,
        tiempoCalentamiento40: duracionStr,
        esManual: true,
      },
    }));

    setManualPaso2(false);
    showToast(
      `✓ Llegada a 40 °C guardada manualmente (${formattedHora} · ${duracionStr})`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 3: ADICIÓN DEL CULTIVO LÁCTICO
  // =========================================================================
  const handleRecordCultivo = () => {
    if (!llegoA40) {
      showToast('Confirma primero que la leche llegó a 40 °C antes de agregar el cultivo.', 'warning');
      return;
    }

    const timeStr = getCurrentTimeString();
    const nowTs = Date.now();
    const cdasFinales =
      Number(draftCucharadas) > 0
        ? Number(draftCucharadas)
        : cultivoCalculadoCucharadas;

    onChange((prev) => ({
      ...prev,
      cultivoLacticoPera: {
        registrado: true,
        horaRegistro: timeStr,
        timestamp: nowTs,
        cucharadas: cdasFinales,
        loteCultivo: loteCultivoMostrado,
        esManual: false,
      },
    }));

    setDraftHoraCultivo(timeStr);
    setManualPaso3(false);
    showToast(
      `✓ Cultivo láctico agregado a las ${timeStr} (${cdasFinales} cdas). Arrancó el reposo de 40 min.`,
      'success'
    );
  };

  const handleSaveManualCultivo = () => {
    if (!llegoA40) {
      showToast('Confirma primero que la leche llegó a 40 °C antes de agregar el cultivo.', 'warning');
      return;
    }

    const formattedHora = formatTimeFromStep1(draftHoraCultivo);
    const cdasFinales =
      Number(draftCucharadas) > 0
        ? Number(draftCucharadas)
        : cultivoCalculadoCucharadas;

    const sec = timeStringToSecondsToday(formattedHora);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualTs = today.getTime() + sec * 1000;

    onChange((prev) => ({
      ...prev,
      cultivoLacticoPera: {
        registrado: true,
        horaRegistro: formattedHora,
        timestamp: manualTs,
        cucharadas: cdasFinales,
        loteCultivo: loteCultivoMostrado,
        esManual: true,
      },
    }));

    setManualPaso3(false);
    showToast(
      `✓ Datos de cultivo guardados manualmente (${formattedHora} · ${cdasFinales} cdas)`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 5: ADICIÓN DEL CUAJO
  // =========================================================================
  const handleRecordCuajo = () => {
    if (!cultivoAdicionado) {
      showToast('Debes registrar primero la adición del cultivo láctico antes de agregar el cuajo.', 'warning');
      return;
    }

    const timeStr = getCurrentTimeString();
    const nowTs = Date.now();
    const cantidadFinal =
      Number(draftGramosCuajo) > 0 ? Number(draftGramosCuajo) : cuajoCalculado;

    const duracionReposoStr =
      horaCultivoOficial && horaCultivoOficial !== 'En espera'
        ? computeDurationBetweenTimes(horaCultivoOficial, timeStr).human
        : '0 s';

    onChange((prev) => ({
      ...prev,
      horaAdicionCuajo: timeStr,
      timestampAdicionCuajo: nowTs,
      adicionCuajo: {
        registrado: true,
        horaRegistro: timeStr,
        timestampCuajo: nowTs,
        tiempoTranscurridoDesdeCultivo: duracionReposoStr,
        cantidadGramos: cantidadFinal,
        loteCuajo: loteCuajoMostrado,
        esManual: false,
      },
    }));

    if (onUpdateCuajoLote) {
      onUpdateCuajoLote(loteCuajoMostrado);
    }

    setDraftHoraCuajo(timeStr);
    setManualPaso5(false);
    showToast(
      `✓ Cuajo agregado a las ${timeStr} (${cantidadFinal} g). Reposo del cultivo detenido.`,
      'success'
    );
  };

  const handleSaveManualCuajo = () => {
    if (!cultivoAdicionado) {
      showToast('Debes registrar primero la adición del cultivo láctico antes de agregar el cuajo.', 'warning');
      return;
    }

    const formattedHora = formatTimeFromStep1(draftHoraCuajo);
    const cantidadFinal =
      Number(draftGramosCuajo) > 0 ? Number(draftGramosCuajo) : cuajoCalculado;

    const duracionReposoStr =
      horaCultivoOficial && horaCultivoOficial !== 'En espera'
        ? computeDurationBetweenTimes(horaCultivoOficial, formattedHora).human
        : '0 s';

    const sec = timeStringToSecondsToday(formattedHora);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualTs = today.getTime() + sec * 1000;

    onChange((prev) => ({
      ...prev,
      horaAdicionCuajo: formattedHora,
      timestampAdicionCuajo: manualTs,
      adicionCuajo: {
        registrado: true,
        horaRegistro: formattedHora,
        timestampCuajo: manualTs,
        tiempoTranscurridoDesdeCultivo: duracionReposoStr,
        cantidadGramos: cantidadFinal,
        loteCuajo: loteCuajoMostrado,
        esManual: true,
      },
    }));

    if (onUpdateCuajoLote) {
      onUpdateCuajoLote(loteCuajoMostrado);
    }

    setManualPaso5(false);
    showToast(
      `✓ Cuajo guardado manualmente (${formattedHora} · ${cantidadFinal} g · ${duracionReposoStr})`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 6: CONFIRMACIÓN DE CUAJADO
  // =========================================================================
  const handleRecordCuajado = () => {
    if (!cuajoAdicionado) {
      showToast('Debes adicionar primero el cuajo antes de confirmar el cuajado.', 'warning');
      return;
    }

    const timeStr = getCurrentTimeString();
    const nowTs = Date.now();
    const duracionStr =
      horaCuajoOficial && horaCuajoOficial !== 'En espera'
        ? computeDurationBetweenTimes(horaCuajoOficial, timeStr).human
        : '0 s';

    const elapsedSec = timeStringToSecondsToday(timeStr);

    onChange((prev) => ({
      ...prev,
      cuajado: {
        ...prev.cuajado,
        registrado: true,
        horaRegistro: timeStr,
        timestampCuajado: nowTs,
        tiempoTranscurridoDesdeCuajo: duracionStr,
        segundosCuajado: elapsedSec,
        consistencia: draftConsistencia || 'Cuajada firme / Corte limpio',
        esManual: false,
      },
    }));

    setDraftHoraCuajado(timeStr);
    setManualPaso6(false);
    showToast(`✓ Leche cuajada a las ${timeStr} (${duracionStr})`, 'success');
  };

  const handleSaveManualCuajado = () => {
    if (!cuajoAdicionado) {
      showToast('Debes adicionar primero el cuajo antes de confirmar el cuajado.', 'warning');
      return;
    }

    const formattedHora = formatTimeFromStep1(draftHoraCuajado);
    const duracionStr =
      horaCuajoOficial && horaCuajoOficial !== 'En espera'
        ? computeDurationBetweenTimes(horaCuajoOficial, formattedHora).human
        : '0 s';

    const sec = timeStringToSecondsToday(formattedHora);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualTs = today.getTime() + sec * 1000;

    onChange((prev) => ({
      ...prev,
      cuajado: {
        ...prev.cuajado,
        registrado: true,
        horaRegistro: formattedHora,
        timestampCuajado: manualTs,
        tiempoTranscurridoDesdeCuajo: duracionStr,
        segundosCuajado: sec,
        consistencia: draftConsistencia || 'Cuajada firme / Corte limpio',
        esManual: true,
      },
    }));

    setManualPaso6(false);
    showToast(
      `✓ Cuajado guardado manualmente (${formattedHora} · ${duracionStr})`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 7: CORTE Y AGITADO SUAVE
  // =========================================================================
  const handleRecordCorte = () => {
    if (!cuajadoConfirmado) {
      showToast('Debes confirmar primero el cuajado antes de registrar el corte.', 'warning');
      return;
    }

    const timeStr = getCurrentTimeString();
    const nowTs = Date.now();
    const duracionStr =
      horaCuajadoOficial && horaCuajadoOficial !== 'En espera'
        ? computeDurationBetweenTimes(horaCuajadoOficial, timeStr).human
        : '0 s';

    onChange((prev) => ({
      ...prev,
      corte: {
        ...prev.corte,
        registrado: true,
        horaRegistro: timeStr,
        timestampCorte: nowTs,
        tiempoTranscurridoDesdeCuajado: duracionStr,
        esManual: false,
      },
      reposoIniciado: true,
      timestampInicioReposo: nowTs,
    }));

    setDraftHoraCorte(timeStr);
    setManualPaso7(false);
    showToast(
      `✓ Corte y agitación listos a las ${timeStr} (${duracionStr}). Arrancó el reposo de la cuajada.`,
      'success'
    );
  };

  const handleSaveManualCorte = () => {
    if (!cuajadoConfirmado) {
      showToast('Debes confirmar primero el cuajado antes de registrar el corte.', 'warning');
      return;
    }

    const formattedHora = formatTimeFromStep1(draftHoraCorte);
    const duracionStr =
      horaCuajadoOficial && horaCuajadoOficial !== 'En espera'
        ? computeDurationBetweenTimes(horaCuajadoOficial, formattedHora).human
        : '0 s';

    const sec = timeStringToSecondsToday(formattedHora);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualTs = today.getTime() + sec * 1000;

    onChange((prev) => ({
      ...prev,
      corte: {
        ...prev.corte,
        registrado: true,
        horaRegistro: formattedHora,
        timestampCorte: manualTs,
        tiempoTranscurridoDesdeCuajado: duracionStr,
        esManual: true,
      },
      reposoIniciado: true,
      timestampInicioReposo: manualTs,
    }));

    setManualPaso7(false);
    showToast(
      `✓ Corte guardado manualmente (${formattedHora} · ${duracionStr})`,
      'success'
    );
  };


  // =========================================================================
  // HANDLERS PASO 9: CONFIRMACIÓN DE pH 5.8
  // =========================================================================
  const handleRecordPh58 = () => {
    if (!corteTerminado) {
      showToast('Debes registrar primero el corte antes de finalizar el reposo a pH 5.80.', 'warning');
      return;
    }

    const timeStr = getCurrentTimeString();
    const nowTs = Date.now();
    const duracionStr =
      horaCorteOficial && horaCorteOficial !== 'En espera'
        ? computeDurationBetweenTimes(horaCorteOficial, timeStr).human
        : '0 s';

    onChange((prev) => ({
      ...prev,
      finReposoPh58: {
        alcanzado: true,
        horaRegistro: timeStr,
        timestampPh58: nowTs,
        phAlcanzado: 5.8,
        tiempoTotalReposo: duracionStr,
        esManual: false,
      },
      temperatura40: {
        ...prev.temperatura40,
        alcanzado: true,
        horaRegistro: timeStr,
        timestamp40Grados: nowTs,
        temperaturaAlcanzada: 5.8,
        tiempoCalentamiento40: `pH 5.8 alcanzado a las ${timeStr} (${duracionStr})`,
      },
    }));

    setDraftHoraPh58(timeStr);
    setManualPaso9(false);
    showToast(
      `✓ pH 5.8 alcanzado a las ${timeStr} (${duracionStr}). Reposo finalizado.`,
      'success'
    );
  };

  const handleSaveManualPh58 = () => {
    if (!corteTerminado) {
      showToast('Debes registrar primero el corte antes de finalizar el reposo a pH 5.80.', 'warning');
      return;
    }

    const formattedHora = formatTimeFromStep1(draftHoraPh58);
    const valPh = Number(draftPhFinal) || 5.8;
    const duracionStr =
      horaCorteOficial && horaCorteOficial !== 'En espera'
        ? computeDurationBetweenTimes(horaCorteOficial, formattedHora).human
        : '0 s';

    const sec = timeStringToSecondsToday(formattedHora);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualTs = today.getTime() + sec * 1000;

    onChange((prev) => ({
      ...prev,
      finReposoPh58: {
        alcanzado: true,
        horaRegistro: formattedHora,
        timestampPh58: manualTs,
        phAlcanzado: valPh,
        tiempoTotalReposo: duracionStr,
        esManual: true,
      },
      temperatura40: {
        ...prev.temperatura40,
        alcanzado: true,
        horaRegistro: formattedHora,
        timestamp40Grados: manualTs,
        temperaturaAlcanzada: valPh,
        tiempoCalentamiento40: `pH ${valPh.toFixed(2)} registrado a las ${formattedHora} (${duracionStr})`,
      },
    }));

    setManualPaso9(false);
    showToast(
      `✓ Datos de pH 5.8 guardados manualmente (${formattedHora} · ${duracionStr})`,
      'success'
    );
  };

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-12">
      {/* CABECERA ESTANDARIZADA */}
      <StageHeader
        stageNumber={2}
        totalStages={5}
        title="Premaduración, Cuajado y Reposo hasta pH 5.8"
        subtitle={`Calienta la leche a 40 °C, agrega el cultivo láctico, deja reposar 40 minutos, adiciona el cuajo y controla el reposo bajo suero hasta alcanzar pH 5.80 (${totalLitros} L).`}
        productName="Queso Pera"
        icon="thermostat"
        isCompleted={reposoFinalizado}
        startTime={
          horaInicioCalentamiento !== 'En espera'
            ? horaInicioCalentamiento
            : undefined
        }
        rightContent={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2 min-h-[48px]">
              <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">
                water_drop
              </span>
              <div>
                <div className="text-[10px] text-blue-900 uppercase font-bold">
                  DOSIS CUAJO (PERA)
                </div>
                <div className="text-xs font-black text-[#1B4E9B] font-mono">
                  1.2 g / 100 L ({cuajoCalculado} g)
                </div>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 min-h-[48px]">
              <span className="material-symbols-outlined text-emerald-700 text-[20px]">
                science
              </span>
              <div>
                <div className="text-[10px] text-emerald-900 uppercase font-bold">
                  META DE REPOSO
                </div>
                <div className="text-xs font-black text-emerald-900 font-mono">
                  pH 5.80
                </div>
              </div>
            </div>
          </div>
        }
      />

      {/* =========================================================================
          1. CALENTAMIENTO INICIAL (SIN NÚMERO EN EL TÍTULO)
      ========================================================================= */}
      <Card
        title="Calentando la leche hacia 40 grados C"
        subtitle="Monitoreo en vivo del tiempo transcurrido desde que se inició el calentamiento de la tina. Este momento marca el inicio del cronómetro general del lote."
        icon="local_fire_department"
        badge={
          llegoA40
            ? `✓ Calentamiento completado (${duracionCalentamientoOficial})`
            : `Calentando en curso (${timerCalentamiento.formattedElapsed})`
        }
        variant={llegoA40 ? 'success' : 'info'}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white border border-[#D6DEEA]">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                llegoA40
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              <span className="material-symbols-outlined text-[28px]">
                {llegoA40 ? 'check_circle' : 'local_fire_department'}
              </span>
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-gray-500 block">
                {llegoA40
                  ? 'Calentamiento Finalizado'
                  : 'Calentando Tina hacia 40 °C'}
              </span>
              <div className="text-2xl font-black font-mono text-[#1B4E9B] mt-0.5">
                {llegoA40
                  ? duracionCalentamientoOficial
                  : timerCalentamiento.formattedElapsed}
              </div>
              <span className="text-[11px] text-gray-500">
                Hora de inicio registrada:{' '}
                <strong>{horaInicioCalentamiento}</strong>
              </span>
            </div>
          </div>

          <div className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700 font-bold">
            Meta: 40.0 °C
          </div>
        </div>
      </Card>

      {/* =========================================================================
          2. CONFIRMACIÓN DE TEMPERATURA (SIN NÚMERO EN EL TÍTULO)
      ========================================================================= */}
      <Card
        title="Confirmo que la leche ya llegó a 40 °C"
        subtitle="Apenas el termómetro de la tina marque 40 °C, confirma el momento exacto para detener el cronómetro de calentamiento y registrar la duración oficial."
        icon="thermostat"
        badge={
          llegoA40
            ? `✓ Llegó a 40 °C (${hora40Oficial})`
            : 'Pendiente llegar a 40 °C'
        }
        variant={llegoA40 ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="Registrar: Llegó a 40 °C"
            confirmedLabel="✓ Llegó a 40 °C"
            icon="thermostat"
            isConfirmed={llegoA40}
            onConfirm={handleRecordReach40}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* Checkbox de edición manual */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso2)} onChange={(checked: boolean) => setManualPaso2(checked)} />
            <Badge variant={manualPaso2 ? 'warning' : 'neutral'} size="sm">
              {manualPaso2 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso2 ? (
            llegoA40 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de Llegada
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {hora40Oficial}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Momento exacto en que alcanzó 40 °C
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Tiempo de Calentamiento
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {duracionCalentamientoOficial}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Calculado desde las {horaInicioCalentamiento}
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Temperatura Confirmada
                  </span>
                  <span className="text-lg font-black font-mono text-emerald-700 mt-1">
                    40.0 °C
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Temperatura ideal para el fermento
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  info
                </span>
                <span>
                  Revisa el termómetro de la tina. Al marcar 40 °C, presiona{' '}
                  <strong>"Registrar: Llegó a 40 °C"</strong> para habilitar la
                  adición del cultivo.
                </span>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <PopoverTimePicker
                  label="Hora de llegada a 40 °C"
                  icon="schedule"
                  hint="Selector flotante (hh:mm:ss)"
                  value={draftHora40}
                  onChange={setDraftHora40}
                />

                <InputField
                  label="Temperatura alcanzada"
                  icon="thermostat"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  unit="°C"
                  value={draftTemp40}
                  onChange={(e) => setDraftTemp40(Number(e.target.value))}
                />

                <InputField
                  label="Tiempo de calentamiento"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={`Calculado: ${horaInicioCalentamiento} → ${draftHora40}`}
                  value={
                    computeDurationBetweenTimes(
                      horaInicioCalentamiento,
                      draftHora40
                    ).human
                  }
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-amber-300">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualReach40}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          3. ADICIÓN DE CULTIVO LÁCTICO (SIN NÚMERO EN EL TÍTULO)
      ========================================================================= */}
      <Card
        title="¡Ya adicioné el cultivo láctico y revolví!"
        subtitle="Agrega el cultivo láctico disuelto con la leche a 40 °C y revuelve uniformemente. Al confirmar, arranca inmediatamente el temporizador de 40 minutos de reposo."
        icon="science"
        badge={
          cultivoAdicionado
            ? `✓ Agregado (${cucharadasCultivoOficial} cdas)`
            : `Sugerido: ${cultivoCalculadoCucharadas} cdas`
        }
        variant={cultivoAdicionado ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="Registrar: Ya agregué el cultivo"
            confirmedLabel="✓ Cultivo agregado y revuelto"
            icon="science"
            isConfirmed={cultivoAdicionado}
            disabled={!llegoA40}
            onConfirm={handleRecordCultivo}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* Checkbox de edición manual */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso3)} onChange={(checked: boolean) => setManualPaso3(checked)} />
            <Badge variant={manualPaso3 ? 'warning' : 'neutral'} size="sm">
              {manualPaso3 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso3 ? (
            cultivoAdicionado ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de Adición
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {horaCultivoOficial}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Momento exacto en que se revolvió
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Cantidad de Cultivo
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {cucharadasCultivoOficial} cucharadas
                  </span>
                  <span className="text-[11px] text-gray-500">
                    1 cda / 40 L ({totalLitros} L)
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Lote de Cultivo (Solo Lectura)
                  </span>
                  <span className="text-sm font-black font-mono text-gray-800 mt-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-amber-700">
                      lock
                    </span>
                    {loteCultivoMostrado}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Heredado de la Etapa 1
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  info
                </span>
                <span>
                  Sugerencia para {totalLitros} L:{' '}
                  <strong>{cultivoCalculadoCucharadas} cucharadas</strong> de
                  cultivo. Agrega y revuelve, luego presiona el botón de
                  confirmación.
                </span>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <PopoverTimePicker
                  label="Hora de adición del cultivo"
                  icon="schedule"
                  hint="Selector flotante (hh:mm:ss)"
                  value={draftHoraCultivo}
                  onChange={setDraftHoraCultivo}
                />

                <InputField
                  label="Cantidad de cultivo (cucharadas)"
                  icon="science"
                  type="number"
                  inputMode="decimal"
                  step="0.25"
                  min="0"
                  unit="cdas"
                  value={draftCucharadas}
                  onChange={(e) => setDraftCucharadas(Number(e.target.value))}
                />

                <InputField
                  label="Lote de cultivo (Solo lectura)"
                  icon="lock"
                  type="text"
                  disabled
                  readOnly
                  value={loteCultivoMostrado}
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-amber-300">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualCultivo}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          4. REPOSO DEL CULTIVO (SIN NÚMERO EN EL TÍTULO)
      ========================================================================= */}
      <TimerBanner
        title="Reposo del cultivo láctico"
        subtitle={
          temporizador40MinCumplido
            ? '✓ ¡Ya pasaron los 40 minutos reglamentarios de reposo! Ya puedes agregar el cuajo en el siguiente paso.'
            : cultivoAdicionado
            ? 'La leche reposa a 40 °C con el fermento. Deja reposar mínimo 40 minutos antes de agregar el cuajo.'
            : 'Esperando que confirmes la adición del cultivo láctico para arrancar los 40 minutos de reposo.'
        }
        formattedTime={
          cultivoAdicionado ? premaduracionCountdown.formattedRemaining : '40:00'
        }
        isRunning={cultivoAdicionado && !cuajoAdicionado}
        isCompleted={temporizador40MinCumplido || cuajoAdicionado}
        isOverdue={temporizador40MinCumplido && !cuajoAdicionado}
        statusLabel={
          cuajoAdicionado
            ? 'Detenido al agregar cuajo'
            : temporizador40MinCumplido
            ? '✓ Ya pasaron 40 min — agrega el cuajo'
            : cultivoAdicionado
            ? 'Cuenta regresiva activa'
            : 'En espera (40:00 min)'
        }
        targetLabel="40 min de reposo"
        variant={
          temporizador40MinCumplido
            ? 'success'
            : cultivoAdicionado
            ? 'info'
            : 'warning'
        }
      />

      {/* =========================================================================
          5. ADICIÓN DE CUAJO (SIN NÚMERO EN EL TÍTULO)
      ========================================================================= */}
      <Card
        title="¡Ya agregué el cuajo!"
        subtitle={`Agrega el cuajo disuelto a los 40 °C. Para ${totalLitros} L de leche se sugieren ${cuajoCalculado} g. Al confirmar, se detiene el reloj de reposo del cultivo.`}
        icon="opacity"
        badge={
          cuajoAdicionado
            ? `✓ Cuajo Agregado (${gramosCuajoOficial} g)`
            : `Sugerido: ${cuajoCalculado} g`
        }
        variant={cuajoAdicionado ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="Registrar: Ya agregué el cuajo"
            confirmedLabel="✓ Cuajo agregado"
            icon="opacity"
            isConfirmed={cuajoAdicionado}
            disabled={!cultivoAdicionado}
            onConfirm={handleRecordCuajo}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* Checkbox de edición manual */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso5)} onChange={(checked: boolean) => setManualPaso5(checked)} />
            <Badge variant={manualPaso5 ? 'warning' : 'neutral'} size="sm">
              {manualPaso5 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso5 ? (
            cuajoAdicionado ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de Adición
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {horaCuajoOficial}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Momento de incorporación
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Cantidad de Cuajo
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {gramosCuajoOficial} g
                  </span>
                  <span className="text-[11px] text-gray-500">
                    1.2 g / 100 L ({totalLitros} L)
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Tiempo de Reposo del Cultivo
                  </span>
                  <span className="text-lg font-black font-mono text-emerald-700 mt-1">
                    {duracionReposoCultivoOficial}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Desde adición de fermento
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Lote de Cuajo (Solo Lectura)
                  </span>
                  <span className="text-sm font-black font-mono text-gray-800 mt-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-amber-700">
                      lock
                    </span>
                    {loteCuajoMostrado}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Heredado de la Etapa 1
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  info
                </span>
                <span>
                  Sugerencia para {totalLitros} L:{' '}
                  <strong>{cuajoCalculado} g</strong> de cuajo. Disuelve en agua
                  limpia, adiciona a la tina y confirma el paso.
                </span>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-start">
                <PopoverTimePicker
                  label="Hora en que se agregó el cuajo"
                  icon="schedule"
                  hint="Selector flotante (hh:mm:ss)"
                  value={draftHoraCuajo}
                  onChange={setDraftHoraCuajo}
                />

                <InputField
                  label="Cantidad de cuajo (g)"
                  icon="science"
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  min="0"
                  unit="g"
                  value={draftGramosCuajo}
                  onChange={(e) => setDraftGramosCuajo(Number(e.target.value))}
                />

                <InputField
                  label="Tiempo de reposo del cultivo"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={`Calculado: ${horaCultivoOficial || '--'} → ${draftHoraCuajo}`}
                  value={
                    computeDurationBetweenTimes(
                      horaCultivoOficial,
                      draftHoraCuajo
                    ).human
                  }
                />

                <InputField
                  label="Lote de cuajo (Solo lectura)"
                  icon="lock"
                  type="text"
                  disabled
                  readOnly
                  value={loteCuajoMostrado}
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-amber-300">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualCuajo}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          6. CONFIRMACIÓN DE CUAJADO (SIN NÚMERO EN EL TÍTULO)
      ========================================================================= */}
      <Card
        title="Confirmo que la leche ya cuajó"
        subtitle="Comprueba que la cuajada tenga la consistencia adecuada y corte firme antes de pasar la lira."
        icon="egg"
        badge={
          cuajadoConfirmado
            ? `✓ Cuajada Lista (${duracionCuajadoOficial})`
            : 'Esperando que cuaje'
        }
        variant={cuajadoConfirmado ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="Registrar: Ya cuajó"
            confirmedLabel="✓ Cuajada lista y firme"
            icon="egg"
            isConfirmed={cuajadoConfirmado}
            disabled={!cuajoAdicionado}
            onConfirm={handleRecordCuajado}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* Checkbox de edición manual */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso6)} onChange={(checked: boolean) => setManualPaso6(checked)} />
            <Badge variant={manualPaso6 ? 'warning' : 'neutral'} size="sm">
              {manualPaso6 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso6 ? (
            cuajadoConfirmado ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de Cuajado
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {horaCuajadoOficial}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Momento de prueba de corte
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Tiempo que Tardó en Cuajar
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {duracionCuajadoOficial}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Desde adición de cuajo ({horaCuajoOficial})
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Firmeza de la Cuajada
                  </span>
                  <span className="text-sm font-black text-emerald-700 mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">
                      verified
                    </span>
                    {consistenciaOficial}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Lista para cortar con la lira
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  info
                </span>
                <span>
                  Al observar el corte firme y limpio, presiona{' '}
                  <strong>"Registrar: Ya cuajó"</strong> para medir el tiempo
                  oficial de cuajado.
                </span>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <PopoverTimePicker
                  label="Hora de cuajado"
                  icon="schedule"
                  hint="Selector flotante (hh:mm:ss)"
                  value={draftHoraCuajado}
                  onChange={setDraftHoraCuajado}
                />

                <InputField
                  label="Tiempo que tardó en cuajar"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={`Calculado: ${horaCuajoOficial || '--'} → ${draftHoraCuajado}`}
                  value={
                    computeDurationBetweenTimes(
                      horaCuajoOficial,
                      draftHoraCuajado
                    ).human
                  }
                />

                <InputField
                  label="Firmeza de la cuajada"
                  icon="verified"
                  type="text"
                  value={draftConsistencia}
                  onChange={(e) => setDraftConsistencia(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-amber-300">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualCuajado}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          7. CORTE Y AGITADO SUAVE (SIN NÚMERO EN EL TÍTULO)
      ========================================================================= */}
      <Card
        title="Ya corté la cuajada y ya agité suavemente"
        subtitle="Corta la cuajada en cubos parejos y agítala despacio. Al confirmar, arranca automáticamente el reloj de reposo de la cuajada."
        icon="content_cut"
        badge={
          corteTerminado
            ? `✓ Terminado (${duracionCorteOficial})`
            : 'Pendiente cortar y agitar'
        }
        variant={corteTerminado ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="Registrar: Corte y agitación listos"
            confirmedLabel="✓ Corte y agitación terminados"
            icon="content_cut"
            isConfirmed={corteTerminado}
            disabled={!cuajadoConfirmado}
            onConfirm={handleRecordCorte}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* Checkbox de edición manual */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso7)} onChange={(checked: boolean) => setManualPaso7(checked)} />
            <Badge variant={manualPaso7 ? 'warning' : 'neutral'} size="sm">
              {manualPaso7 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso7 ? (
            corteTerminado ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de Corte y Agitación
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {horaCorteOficial}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Momento de fin de corte
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Tiempo de Corte y Agitación
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {duracionCorteOficial}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Calculado desde la hora de cuajado ({horaCuajadoOficial})
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  info
                </span>
                <span>
                  Al terminar de pasar la lira y agitar suavemente, presiona{' '}
                  <strong>"Registrar: Corte y agitación listos"</strong> para
                  activar el cronómetro de reposo bajo suero.
                </span>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <PopoverTimePicker
                  label="Hora de corte y agitación"
                  icon="schedule"
                  hint="Selector flotante (hh:mm:ss)"
                  value={draftHoraCorte}
                  onChange={setDraftHoraCorte}
                />

                <InputField
                  label="Tiempo de corte y agitación"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={`Calculado: ${horaCuajadoOficial || '--'} → ${draftHoraCorte}`}
                  value={
                    computeDurationBetweenTimes(
                      horaCuajadoOficial,
                      draftHoraCorte
                    ).human
                  }
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-amber-300">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualCorte}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          8. REPOSO DE LA CUAJADA (SIN NÚMERO EN EL TÍTULO)
      ========================================================================= */}
      <Card
        title="Reposo de la cuajada"
        subtitle="La cuajada cortada permanece en reposo bajo el suero tibio para acidificarse antes del desuerado."
        icon="speed"
        badge={
          reposoFinalizado
            ? `✓ Reposo completado (${duracionReposoCuajadaOficial})`
            : corteTerminado
            ? `Reposo en curso (${reposoTimer.formattedElapsed})`
            : 'Esperando corte y agitación'
        }
        variant={
          reposoFinalizado
            ? 'success'
            : corteTerminado
            ? 'info'
            : 'default'
        }
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl bg-white border border-[#D6DEEA]">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                reposoFinalizado
                  ? 'bg-emerald-100 text-emerald-800'
                  : corteTerminado
                  ? 'bg-blue-100 text-[#1B4E9B]'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className="material-symbols-outlined text-[32px]">
                {reposoFinalizado ? 'check_circle' : 'timer'}
              </span>
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-gray-500 block">
                {reposoFinalizado
                  ? 'Tiempo Total en Reposo de la Cuajada'
                  : corteTerminado
                  ? 'Tiempo Transcurrido en Reposo de la Cuajada'
                  : 'Reposo en Espera'}
              </span>
              <div className="text-3xl font-black font-mono text-[#1B4E9B] mt-0.5">
                {reposoFinalizado
                  ? duracionReposoCuajadaOficial || reposoTimer.formattedElapsed
                  : reposoTimer.formattedElapsed}
              </div>
              <span className="text-[11px] text-gray-500">
                {corteTerminado
                  ? `Iniciado a las ${horaCorteOficial}`
                  : 'Arrancará automáticamente al registrar el corte y agitación'}
              </span>
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA] text-xs font-bold text-gray-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-700">
              science
            </span>
            <span>Meta de reposo: pH 5.80</span>
          </div>
        </div>
      </Card>

      {/* =========================================================================
          9. CONFIRMACIÓN DE pH / ESTADO (SIN NÚMERO EN EL TÍTULO)
      ========================================================================= */}
      <Card
        title="¡La pasta ya llegó a 5.8!"
        subtitle="Cuando el potenciómetro o cinta marque pH 5.80 (o menos), confirma el término del reposo para detener el cronómetro y avanzar a Desuerado."
        icon="task_alt"
        badge={
          reposoFinalizado
            ? `✓ pH 5.80 Alcanzado (${duracionReposoCuajadaOficial})`
            : 'Esperando pH 5.80'
        }
        variant={reposoFinalizado ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="Confirmar: ¡Llegó a pH 5.8!"
            confirmedLabel="✓ pH 5.80 confirmado"
            icon="task_alt"
            isConfirmed={reposoFinalizado}
            disabled={!corteTerminado}
            onConfirm={handleRecordPh58}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* Checkbox de edición manual */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso9)} onChange={(checked: boolean) => setManualPaso9(checked)} />
            <Badge variant={manualPaso9 ? 'warning' : 'neutral'} size="sm">
              {manualPaso9 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso9 ? (
            reposoFinalizado ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora en que Llegó a 5.8
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {horaPh58Oficial}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Fin del reposo bajo suero
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Tiempo Total de Reposo
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {duracionReposoCuajadaOficial}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Calculado desde el corte ({horaCorteOficial})
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    pH Final Confirmado
                  </span>
                  <span className="text-lg font-black font-mono text-emerald-700 mt-1">
                    5.80 pH
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Punto ideal para desuerar
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  info
                </span>
                <span>
                  Cuando la medición confirme pH 5.80 (o menos), presiona{' '}
                  <strong>"Confirmar: ¡Llegó a pH 5.8!"</strong> para finalizar
                  esta etapa y desbloquear el paso a Desuerado.
                </span>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <PopoverTimePicker
                  label="Hora en que llegó a pH 5.8"
                  icon="schedule"
                  hint="Selector flotante (hh:mm:ss)"
                  value={draftHoraPh58}
                  onChange={setDraftHoraPh58}
                />

                <InputField
                  label="pH confirmado"
                  icon="science"
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  min="4.0"
                  max="7.0"
                  unit="pH"
                  value={draftPhFinal}
                  onChange={(e) => setDraftPhFinal(Number(e.target.value))}
                />

                <InputField
                  label="Tiempo total de reposo"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={`Calculado: ${horaCorteOficial || '--'} → ${draftHoraPh58}`}
                  value={
                    computeDurationBetweenTimes(
                      horaCorteOficial,
                      draftHoraPh58
                    ).human
                  }
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-amber-300">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualPh58}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          BOTÓN DE NAVEGACIÓN A LA SIGUIENTE ETAPA (DESUERAR)
      ========================================================================= */}
      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          size="xl"
          iconRight="arrow_forward"
          disabled={!reposoFinalizado}
          onClick={onNextStage}
        >
          Pasar a Etapa 3: Desuerar
        </Button>
      </div>
    </div>
  );
};
