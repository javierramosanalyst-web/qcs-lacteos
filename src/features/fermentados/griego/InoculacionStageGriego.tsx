import React from 'react';
import { InoculacionYogurGriegoState } from '../../../types/yogur_griego';
import { ProcessTimerState } from '../../../types';
import { formatHumanDuration, getCurrentTimeString } from '../../../utils/timer';
import { useStageCountdown } from '../../../hooks/useStageCountdown';
import {
  StageHeader,
  Card,
  InputField,
  ConfirmButton,
  TimerBanner,
  Button,
} from '../../../components/ui';

interface InoculacionStageGriegoProps {
  state: InoculacionYogurGriegoState;
  onChange: (
    updater: (prev: InoculacionYogurGriegoState) => InoculacionYogurGriegoState
  ) => void;
  tempLlegada45?: number;
  horaLlegada45?: string | null;
  processTimer: ProcessTimerState;
  onNextStage: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const InoculacionStageGriego: React.FC<InoculacionStageGriegoProps> = ({
  state,
  onChange,
  tempLlegada45 = 45.0,
  horaLlegada45,
  onNextStage,
  showToast,
}) => {
  // Reloj de incubación de Yogur Griego (8 horas = 480 min)
  const incubacionTimer = useStageCountdown({
    isRunning: state.incubacion.iniciada && !state.incubacion.completada,
    isCompleted: state.incubacion.completada,
    startTimestamp: state.incubacion.timestampInicio,
    targetMinutes: (state.incubacion.duracionObjetivoHoras || 8) * 60,
    completedDurationText: state.incubacion.tiempoTranscurrido,
  });

  const handleConfirmTemp45 = () => {
    onChange((prev) => ({
      ...prev,
      temperaturaConfirmada: true,
      temperaturaVerificada45: 45.0,
    }));
    showToast('✓ Temperatura de 45.0 °C lista para sembrar el Griego.', 'success');
  };

  const handleYaInoculeYMezcle = () => {
    if (!state.loteCultivo.trim()) {
      showToast('⚠️ Anota primero el lote del sobre de cultivo.', 'warning');
      return;
    }

    const timeStr = getCurrentTimeString();
    const now = Date.now();

    onChange((prev) => ({
      ...prev,
      temperaturaConfirmada: true,
      inoculacionConfirmada: true,
      mezcladoConfirmado: true,
      horaInoculacion: timeStr,
      incubacion: {
        ...prev.incubacion,
        iniciada: true,
        completada: false,
        horaInicio: timeStr,
        timestampInicio: now,
      },
    }));

    showToast(
      `✓ Cultivo de Griego agregado a las ${timeStr}. Reloj de incubación (8 h) en marcha.`,
      'success'
    );
  };

  const handleFinalizarIncubacion = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();
    const start = state.incubacion.timestampInicio || now;
    const elapsedSec = Math.max(1, Math.floor((now - start) / 1000));
    const durStr = formatHumanDuration(elapsedSec);

    onChange((prev) => ({
      ...prev,
      incubacion: {
        ...prev.incubacion,
        completada: true,
        horaFin: timeStr,
        tiempoTranscurrido: durStr || '8 h',
      },
    }));

    showToast(
      `✓ Incubación terminada a las ${timeStr}. Cuajada lista para enfriar y colar en lienzos.`,
      'success'
    );
  };

  const isReadyForNext = state.inoculacionConfirmada && state.incubacion.completada;

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-5 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-14">
      <StageHeader
        stageNumber={2}
        totalStages={5}
        lineName="Línea de Fermentados · Yogur Griego"
        title="2. Inoculación e Incubación (Griego)"
        standardBadge="NTC-805"
      />

      {/* PASO 01: VERIFICACIÓN DE TEMPERATURA */}
      <Card
        stepBadge="Paso 01"
        title="Temperatura de la Leche a 45.0 °C"
        icon="thermostat"
        tone={state.temperaturaConfirmada ? 'completed' : 'default'}
        statusBadge={
          state.temperaturaConfirmada
            ? { label: 'Temperatura Lista ✓', variant: 'success' }
            : { label: 'Por verificar', variant: 'warning' }
        }
        headerAction={
          <ConfirmButton
            confirmed={state.temperaturaConfirmada}
            confirmedLabel="✓ Temperatura 45.0 °C Lista"
            unconfirmedLabel="Confirmar Temperatura (45.0 °C)"
            onConfirm={handleConfirmTemp45}
          />
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Temperatura Medida en Cantina"
            type="number"
            step="0.1"
            unit="°C"
            value={state.temperaturaVerificada45}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChange((prev) => ({ ...prev, temperaturaVerificada45: val }));
            }}
            hint="Rango ideal: 44.0 °C a 45.5 °C"
          />

          <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex flex-col justify-between">
            <span className="text-[11px] uppercase font-bold text-[#4A5263] block">
              Llegada desde Enfriamiento
            </span>
            <div className="text-xl font-black font-mono text-emerald-800 mt-1">
              {tempLlegada45.toFixed(1)} °C
            </div>
            <span className="text-[11px] text-[#6B7280] mt-1 block">
              Hora llegada a 45 °C: {horaLlegada45 || '--:--'}
            </span>
          </div>
        </div>
      </Card>

      {/* PASO 02: SIEMBRA DE CULTIVO */}
      <Card
        stepBadge="Paso 02"
        title="Agregar el Cultivo y Revolver (5 min)"
        subtitle="Pon 1 cucharada de cultivo por cada 40 L de leche y revuelve suave. Al confirmar arranca solo el reloj de 8 horas."
        icon="biotech"
        tone={state.inoculacionConfirmada ? 'completed' : 'active'}
        statusBadge={
          state.inoculacionConfirmada
            ? { label: `Sembrado (${state.horaInoculacion})`, variant: 'success' }
            : { label: 'Pendiente', variant: 'info' }
        }
        headerAction={
          <ConfirmButton
            confirmed={state.inoculacionConfirmada}
            confirmedLabel={`✓ Cultivo Agregado (${state.horaInoculacion})`}
            unconfirmedLabel="Confirmar: Ya Puse el Cultivo y Mezclé"
            onConfirm={handleYaInoculeYMezcle}
          />
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InputField
            label="Lote del Cultivo Láctico"
            type="text"
            value={state.loteCultivo}
            onChange={(e) => {
              const val = e.target.value;
              onChange((prev) => ({ ...prev, loteCultivo: val }));
            }}
            placeholder="Ej: CULT-GRI-2026-01"
            hint="Código del sobre de cultivo"
          />

          <InputField
            label="Cucharadas de Cultivo"
            type="number"
            step="0.5"
            unit="cucharadas"
            value={state.cantidadCultivoCucharadas}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChange((prev) => ({ ...prev, cantidadCultivoCucharadas: val }));
            }}
            hint="Medida: 1 cucharada por cada 40 L"
          />

          <InputField
            label="Gramos Equivalentes"
            type="number"
            step="0.1"
            unit="g"
            value={state.cantidadCultivoGramos}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChange((prev) => ({ ...prev, cantidadCultivoGramos: val }));
            }}
            hint={`Hora de siembra: ${state.horaInoculacion || '--:--'}`}
          />
        </div>
      </Card>

      {/* PASO 03: INCUBACIÓN DE 8 HORAS */}
      <Card
        stepBadge="Paso 03"
        title="Incubación de la Cuajada (Mínimo 8 Horas)"
        icon="timelapse"
        tone={
          state.incubacion.completada
            ? 'completed'
            : state.incubacion.iniciada
              ? 'active'
              : 'default'
        }
        statusBadge={
          state.incubacion.completada
            ? { label: 'Incubación Lista (8 h) ✓', variant: 'success' }
            : state.incubacion.iniciada
              ? { label: 'Incubando (8 h)', variant: 'warning', pulse: true }
              : { label: 'Inicia al sembrar', variant: 'neutral' }
        }
        headerAction={
          state.incubacion.iniciada ? (
            <ConfirmButton
              confirmed={state.incubacion.completada}
              confirmedLabel={`✓ Incubación Lista (${state.incubacion.horaFin})`}
              unconfirmedLabel="Confirmar: Ya Cuajó Firme (8 Horas)"
              onConfirm={handleFinalizarIncubacion}
            />
          ) : undefined
        }
      >
        {(state.incubacion.iniciada || state.incubacion.completada) && (
          <TimerBanner
            label="Tiempo de Incubación de Yogur Griego"
            sublabel="Meta mínima: 8 horas de reposo entre 42.0 °C y 44.0 °C"
            formattedTime={incubacionTimer.formattedElapsed}
            targetLabel="8 Horas"
            progressPercent={incubacionTimer.progressPercent}
            isRunning={state.incubacion.iniciada && !state.incubacion.completada}
            isCompleted={state.incubacion.completada}
            isOvertime={incubacionTimer.isOvertime}
            className="mb-4"
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InputField
            label="Temperatura de Incubación"
            type="number"
            step="0.5"
            unit="°C"
            value={state.incubacion.temperaturaIncubacion}
            onChange={(e) => {
              const val = e.target.value === '' ? 0 : Number(e.target.value);
              onChange((prev) => ({
                ...prev,
                incubacion: {
                  ...prev.incubacion,
                  temperaturaIncubacion: val,
                },
              }));
            }}
            hint="Rango ideal: 42.0 °C a 44.0 °C"
          />

          <InputField
            label="pH al Terminar de Cuajar"
            type="number"
            step="0.05"
            unit="pH"
            value={state.incubacion.phFinalIncubacion}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChange((prev) => ({
                ...prev,
                incubacion: {
                  ...prev.incubacion,
                  phFinalIncubacion: val,
                  esManual: true,
                },
              }));
            }}
            hint="Punto ideal: 4.50 a 4.65"
          />

          <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex flex-col justify-between">
            <span className="text-[11px] uppercase font-bold text-[#4A5263] block">
              Horarios de Incubación
            </span>
            <div className="mt-1.5 text-xs text-[#434655] space-y-1">
              <div>
                Inicio:{' '}
                <strong className="font-mono text-[#191C1E]">
                  {state.incubacion.horaInicio || '--:--'}
                </strong>
              </div>
              <div>
                Fin:{' '}
                <strong className="font-mono text-emerald-800">
                  {state.incubacion.horaFin || 'En reposo'}
                </strong>
              </div>
            </div>
            <span className="text-[11px] text-[#6B7280] mt-1 block">
              Cuajada firme lista para colar en lienzos
            </span>
          </div>
        </div>
      </Card>

      {/* AVANZAR A ETAPA 3 */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs sm:text-sm text-[#434655]">
          Cuando la cuajada esté firme, pasa a{' '}
          <strong className="text-[#191C1E]">3. Cuarto Frío y Filtrado en Lienzos</strong>.
        </div>
        <Button
          variant="primary"
          size="lg"
          iconRight="arrow_forward"
          disabled={!isReadyForNext}
          onClick={onNextStage}
          className="w-full sm:w-auto"
        >
          Ir a 3. Cuarto Frío y Filtrado
        </Button>
      </div>
    </div>
  );
};
