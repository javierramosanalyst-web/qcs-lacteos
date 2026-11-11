import React, { useEffect, useState } from 'react';
import {
  PasteurizacionYogurGriegoState,
  ProcessTimerState,
} from '../../../types';
import { formatHumanDuration, getCurrentTimeString } from '../../../utils/timer';
import {
  StageHeader,
  Card,
  InputField,
  ConfirmButton,
  TimerBanner,
  Button,
  Badge,
} from '../../../components/ui';

interface PasteurizacionStageGriegoProps {
  state: PasteurizacionYogurGriegoState;
  onChange: (
    updater: (
      prev: PasteurizacionYogurGriegoState
    ) => PasteurizacionYogurGriegoState
  ) => void;
  processTimer: ProcessTimerState;
  onStartProcessTimer: () => void;
  onNextStage: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const PasteurizacionStageGriego: React.FC<
  PasteurizacionStageGriegoProps
> = ({
  state,
  onChange,
  processTimer,
  onStartProcessTimer,
  onNextStage,
  showToast,
}) => {
  // 1. Cronómetro en vivo de calentamiento
  const [liveCalentamientoSec, setLiveCalentamientoSec] = useState<number>(0);
  useEffect(() => {
    if (!state.calentamiento.iniciado || state.calentamiento.completado) return;
    const base = state.calentamiento.timestampInicio || Date.now();
    const interval = setInterval(() => {
      setLiveCalentamientoSec(
        Math.max(0, Math.floor((Date.now() - base) / 1000))
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [
    state.calentamiento.iniciado,
    state.calentamiento.completado,
    state.calentamiento.timestampInicio,
  ]);

  // 2. Temporizador en vivo de sostenimiento (15 min = 900 s)
  const [liveSostenimientoSec, setLiveSostenimientoSec] = useState<number>(0);
  useEffect(() => {
    if (!state.sostenimiento.iniciado || state.sostenimiento.completado) return;
    const base = state.sostenimiento.timestampInicio || Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - base) / 1000));
      setLiveSostenimientoSec(elapsed);

      if (elapsed >= 900 && !state.sostenimiento.completado) {
        const timeStr = getCurrentTimeString();
        const now = Date.now();
        onChange((prev) => ({
          ...prev,
          sostenimiento: {
            ...prev.sostenimiento,
            completado: true,
            horaFin: timeStr,
            duracionReal: '15 min',
          },
          enfriamiento: {
            ...prev.enfriamiento,
            enfriamientoIniciado: true,
            horaInicio: timeStr,
            timestampInicioEnfriamiento: now,
          },
        }));
        showToast(
          '✓ Ya pasaron los 15 minutos a 85–90 °C. Ahora enfría la leche a 45 °C.',
          'success'
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [
    state.sostenimiento.iniciado,
    state.sostenimiento.completado,
    state.sostenimiento.timestampInicio,
    onChange,
    showToast,
  ]);

  // 3. Cronómetro en vivo de enfriamiento a 45 °C
  const [liveEnfriamientoSec, setLiveEnfriamientoSec] = useState<number>(0);
  useEffect(() => {
    if (
      !state.enfriamiento.enfriamientoIniciado ||
      state.enfriamiento.enfriamientoCompletado
    )
      return;
    const base = state.enfriamiento.timestampInicioEnfriamiento || Date.now();
    const interval = setInterval(() => {
      setLiveEnfriamientoSec(
        Math.max(0, Math.floor((Date.now() - base) / 1000))
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [
    state.enfriamiento.enfriamientoIniciado,
    state.enfriamiento.enfriamientoCompletado,
    state.enfriamiento.timestampInicioEnfriamiento,
  ]);

  // 4. Cronómetro en vivo de trasiego a cantinas (a 45 °C)
  const [liveTrasiegoSec, setLiveTrasiegoSec] = useState<number>(0);
  useEffect(() => {
    if (!state.trasiego.iniciado || state.trasiego.completado) return;
    const base = state.trasiego.timestampInicio || Date.now();
    const interval = setInterval(() => {
      setLiveTrasiegoSec(Math.max(0, Math.floor((Date.now() - base) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [
    state.trasiego.iniciado,
    state.trasiego.completado,
    state.trasiego.timestampInicio,
  ]);

  const handleStartCalentamiento = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();

    if (!processTimer.isRunning) {
      onStartProcessTimer();
    }

    onChange((prev) => ({
      ...prev,
      calentamiento: {
        ...prev.calentamiento,
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
        timestampInicio: now,
      },
    }));

    showToast(
      `⏱ Empezaste a calentar la leche para Yogur Griego a las ${timeStr}.`,
      'info'
    );
  };

  const handleLlego85a90 = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();

    const elapsedCal = state.calentamiento.timestampInicio
      ? formatHumanDuration(
          Math.max(
            0,
            Math.floor((now - state.calentamiento.timestampInicio) / 1000)
          )
        )
      : 'Calculado';

    onChange((prev) => ({
      ...prev,
      calentamiento: {
        ...prev.calentamiento,
        completado: true,
        llego85a90: true,
        horaFin: timeStr,
        horaLlegada85a90: timeStr,
        tiempoCalentamiento: elapsedCal,
      },
      sostenimiento: {
        ...prev.sostenimiento,
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
        timestampInicio: now,
      },
    }));

    showToast(
      `✓ La leche llegó a ${state.calentamiento.temperaturaAlcanzada} °C. Arrancó el conteo de 15 minutos.`,
      'success'
    );
  };

  const handleForzarFinSostenimiento = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();
    const realMin = Math.max(1, Math.round(liveSostenimientoSec / 60));

    onChange((prev) => ({
      ...prev,
      sostenimiento: {
        ...prev.sostenimiento,
        completado: true,
        horaFin: timeStr,
        duracionReal: `${realMin} min`,
      },
      enfriamiento: {
        ...prev.enfriamiento,
        enfriamientoIniciado: true,
        horaInicio: timeStr,
        timestampInicioEnfriamiento: now,
      },
    }));

    showToast(
      '✓ Sostenimiento listo. Empezó el conteo de enfriamiento a 45 °C.',
      'info'
    );
  };

  const handleLlego45 = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();

    const elapsedEnf = state.enfriamiento.timestampInicioEnfriamiento
      ? formatHumanDuration(
          Math.max(
            0,
            Math.floor(
              (now - state.enfriamiento.timestampInicioEnfriamiento) / 1000
            )
          )
        )
      : 'Calculado';

    onChange((prev) => ({
      ...prev,
      enfriamiento: {
        ...prev.enfriamiento,
        enfriamientoCompletado: true,
        horaFinEnfriamiento: timeStr,
        tiempoEnfriamiento: elapsedEnf,
      },
      trasiego: {
        ...prev.trasiego,
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
        timestampInicio: now,
      },
    }));

    showToast(
      '✓ La leche ya bajó a 45 °C. Pásala a las cantinas limpias.',
      'success'
    );
  };

  const handleYaTrasegue = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();

    const elapsedTras = state.trasiego.timestampInicio
      ? formatHumanDuration(
          Math.max(0, Math.floor((now - state.trasiego.timestampInicio) / 1000))
        )
      : 'Calculado';

    onChange((prev) => ({
      ...prev,
      trasiego: {
        ...prev.trasiego,
        completado: true,
        horaFin: timeStr,
        tiempoTrasiego: elapsedTras,
      },
    }));

    showToast(
      '✓ Ya pasaste la leche a las cantinas. Listo para agregar el cultivo.',
      'success'
    );
  };

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)]">
      {/* Encabezado Homogéneo del Sistema */}
      <StageHeader
        stageNumber={1}
        totalStages={5}
        title="Pasteurización de la Leche (Sin Azúcar)"
        productName="Yogur Griego"
        icon="local_fire_department"
        isCompleted={state.trasiego.completado}
      />

      {/* Nota amigable para el operario */}
      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
        <span className="material-symbols-outlined text-amber-700 text-[22px] shrink-0 mt-0.5">
          lightbulb
        </span>
        <div>
          <p className="font-bold text-amber-950 text-sm">
            Recuerda: El Yogur Griego va con leche 100% pura (sin azúcar ni crema)
          </p>
          <p className="text-amber-900/90 text-xs mt-0.5 leading-relaxed">
            Esta leche se espesa más adelante cuando le saquemos el suero en las mallas. Comparte el mismo número de lote con el Yogur sin Azúcar del día.
          </p>
        </div>
      </div>

      {/* Tarjeta 0: Recepción de Leche y Lote */}
      <Card
        stepBadge="PASO 00"
        title="Datos de la Leche y Número de Lote"
        icon="inventory_2"
        headerRight={
          state.loteYogurSinAzucar?.trim() ? (
            <Badge variant="success" size="sm" icon="check_circle">
              Lote Registrado
            </Badge>
          ) : (
            <Badge variant="warning" size="sm" icon="edit">
              Falta Lote
            </Badge>
          )
        }
      >
        <div className="space-y-5">
          <InputField
            label="Lote del Yogur sin Azúcar del día (compartido con el Griego) *"
            icon="qr_code_2"
            placeholder="Ej: YSA-20261025-01"
            value={state.loteYogurSinAzucar || ''}
            onChange={(e) => {
              const val = e.target.value;
              onChange((p) => ({ ...p, loteYogurSinAzucar: val }));
            }}
            status={state.loteYogurSinAzucar?.trim() ? 'valid' : 'warning'}
            helperText="Escribe el mismo número de lote que usaste para el Yogur sin Azúcar de hoy."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InputField
              label="Litros de Leche"
              type="number"
              unit="L"
              icon="water_drop"
              value={state.litrosLeche}
              onChange={(e) => {
                const val = Number(e.target.value);
                onChange((p) => ({ ...p, litrosLeche: val }));
              }}
            />

            <InputField
              label="Lote de Leche (Proveedor)"
              type="text"
              icon="local_shipping"
              value={state.loteLeche}
              onChange={(e) => {
                const val = e.target.value;
                onChange((p) => ({ ...p, loteLeche: val }));
              }}
            />

            <InputField
              label="Acidez de la Leche"
              type="number"
              step="0.5"
              unit="°D"
              targetHint="15–18 °D"
              value={state.acidezDornic}
              status={
                state.acidezDornic >= 15 && state.acidezDornic <= 18
                  ? 'valid'
                  : 'warning'
              }
              onChange={(e) => {
                const val = Number(e.target.value);
                onChange((p) => ({ ...p, acidezDornic: val }));
              }}
            />

            <InputField
              label="Temperatura al Recibir"
              type="number"
              step="0.1"
              unit="°C"
              targetHint="< 6.0 °C"
              value={state.temperaturaRecepcion}
              status={state.temperaturaRecepcion <= 6.0 ? 'valid' : 'warning'}
              onChange={(e) => {
                const val = Number(e.target.value);
                onChange((p) => ({ ...p, temperaturaRecepcion: val }));
              }}
            />
          </div>
        </div>
      </Card>

      {/* PASO 1: Calentamiento a 85–90 °C */}
      <Card
        stepBadge="PASO 01"
        title="Calentar la Leche hasta 85–90 °C"
        icon="thermostat"
        variant={
          state.calentamiento.completado
            ? 'completed'
            : state.calentamiento.iniciado
            ? 'active'
            : 'default'
        }
        headerRight={
          state.calentamiento.completado ? (
            <Badge variant="success" icon="check_circle">
              Llegó a {state.calentamiento.temperaturaAlcanzada} °C
            </Badge>
          ) : state.calentamiento.iniciado ? (
            <Badge variant="primary" pulse>
              Calentando...
            </Badge>
          ) : (
            <Badge variant="default">Por iniciar</Badge>
          )
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#737686] block mb-1">
                Meta de Temperatura
              </span>
              <span className="text-2xl font-mono font-black text-[#191c1e]">
                85.0 – 90.0 °C
              </span>
            </div>

            <InputField
              label="Temperatura que marca ahorita"
              type="number"
              step="0.1"
              unit="°C"
              inputSize="lg"
              value={state.calentamiento.temperaturaAlcanzada}
              onChange={(e) => {
                const val = Number(e.target.value);
                onChange((p) => ({
                  ...p,
                  calentamiento: {
                    ...p.calentamiento,
                    temperaturaAlcanzada: val,
                    esManual: true,
                  },
                }));
              }}
            />

            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#737686] block mb-1">
                Tiempo Calentando
              </span>
              <span className="text-2xl font-mono font-black text-[#1B4E9B]">
                {state.calentamiento.completado
                  ? state.calentamiento.tiempoCalentamiento || 'Listo'
                  : state.calentamiento.iniciado
                  ? formatHumanDuration(liveCalentamientoSec)
                  : '00:00'}
              </span>
            </div>
          </div>

          {!state.calentamiento.iniciado ? (
            <Button
              variant="primary"
              size="lg"
              icon="play_circle"
              onClick={handleStartCalentamiento}
            >
              Empezar a calentar la leche
            </Button>
          ) : (
            <ConfirmButton
              confirmed={state.calentamiento.completado}
              onConfirm={handleLlego85a90}
              labelPending="¡Ya llegó a 85–90 °C!"
              subtitlePending="Toca aquí para arrancar el conteo de 15 minutos de sostenimiento"
              labelConfirmed={`Llegó a ${state.calentamiento.temperaturaAlcanzada} °C (${state.calentamiento.tiempoCalentamiento || 'listo'})`}
              subtitleConfirmed={`Inició a las ${state.calentamiento.horaInicio}`}
              timestamp={state.calentamiento.horaFin}
              variantPending="emerald"
              iconPending="local_fire_department"
            />
          )}
        </div>
      </Card>

      {/* PASO 2: Sostenimiento térmico 15 minutos */}
      <Card
        stepBadge="PASO 02"
        title="Mantener entre 85 y 90 °C por 15 Minutos"
        icon="timer"
        variant={
          state.sostenimiento.completado
            ? 'completed'
            : state.sostenimiento.iniciado
            ? 'active'
            : 'locked'
        }
      >
        <div className="space-y-4">
          <TimerBanner
            title="Reloj de Sostenimiento (15 Minutos)"
            subtitle="Al cumplir los 15 minutos, el paso de enfriamiento se activará automáticamente."
            elapsedSeconds={
              state.sostenimiento.completado ? 900 : liveSostenimientoSec
            }
            targetSeconds={900}
            isRunning={
              state.sostenimiento.iniciado && !state.sostenimiento.completado
            }
            isCompleted={state.sostenimiento.completado}
            actionButton={
              state.sostenimiento.iniciado && !state.sostenimiento.completado ? (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="done_all"
                  onClick={handleForzarFinSostenimiento}
                >
                  Ya pasaron los 15 min
                </Button>
              ) : undefined
            }
          />
        </div>
      </Card>

      {/* PASO 3: Enfriamiento a 45 °C */}
      <Card
        stepBadge="PASO 03"
        title="Enfriar la Leche a 45 °C"
        icon="ac_unit"
        variant={
          state.enfriamiento.enfriamientoCompletado
            ? 'completed'
            : state.enfriamiento.enfriamientoIniciado
            ? 'active'
            : 'locked'
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#737686] block mb-1">
                Temperatura Meta
              </span>
              <span className="text-2xl font-mono font-black text-[#191c1e]">
                45.0 °C
              </span>
            </div>

            <InputField
              label="Temperatura al terminar de enfriar"
              type="number"
              step="0.1"
              unit="°C"
              inputSize="lg"
              disabled={!state.enfriamiento.enfriamientoIniciado}
              value={state.enfriamiento.temperaturaFinal}
              onChange={(e) => {
                const val = Number(e.target.value);
                onChange((p) => ({
                  ...p,
                  enfriamiento: {
                    ...p.enfriamiento,
                    temperaturaFinal: val,
                    esManual: true,
                  },
                }));
              }}
            />

            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#737686] block mb-1">
                Tiempo Enfriando
              </span>
              <span className="text-2xl font-mono font-black text-[#1B4E9B]">
                {state.enfriamiento.enfriamientoCompletado
                  ? state.enfriamiento.tiempoEnfriamiento || 'Listo'
                  : state.enfriamiento.enfriamientoIniciado
                  ? formatHumanDuration(liveEnfriamientoSec)
                  : '00:00'}
              </span>
            </div>
          </div>

          <ConfirmButton
            confirmed={state.enfriamiento.enfriamientoCompletado}
            onConfirm={handleLlego45}
            disabled={!state.enfriamiento.enfriamientoIniciado}
            disabledReason="Primero debe terminar el sostenimiento de 15 minutos."
            labelPending="¡Ya bajó a 45 °C!"
            subtitlePending="Toca aquí cuando la leche esté lista para pasar a las cantinas"
            labelConfirmed={`Enfriada a ${state.enfriamiento.temperaturaFinal} °C (${state.enfriamiento.tiempoEnfriamiento || 'listo'})`}
            timestamp={state.enfriamiento.horaFinEnfriamiento}
            iconPending="ac_unit"
          />
        </div>
      </Card>

      {/* PASO 4: Trasiego a cantinas */}
      <Card
        stepBadge="PASO 04"
        title="Pasar la Leche a las Cantinas (Trasiego)"
        icon="move_down"
        variant={
          state.trasiego.completado
            ? 'completed'
            : state.trasiego.iniciado
            ? 'active'
            : 'locked'
        }
      >
        <div className="space-y-4">
          <TimerBanner
            title="Tiempo pasando a cantinas"
            subtitle="Destino: Cantinas de acero inoxidable limpias y desinfectadas"
            elapsedSeconds={liveTrasiegoSec}
            isRunning={state.trasiego.iniciado && !state.trasiego.completado}
            isCompleted={state.trasiego.completado}
          />

          <ConfirmButton
            confirmed={state.trasiego.completado}
            onConfirm={handleYaTrasegue}
            disabled={!state.trasiego.iniciado}
            disabledReason="Primero confirma que la leche llegó a 45 °C."
            labelPending="¡Ya trasegué la leche a las cantinas!"
            labelConfirmed={`Leche en cantinas (${state.trasiego.tiempoTrasiego || 'listo'})`}
            timestamp={state.trasiego.horaFin}
            variantPending="emerald"
            iconPending="System_Update_Alt"
          />
        </div>
      </Card>

      {/* Botón para avanzar a la Etapa 2 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        {!state.loteYogurSinAzucar?.trim() && (
          <span className="text-xs text-amber-800 font-bold bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-300 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">
              warning
            </span>
            Anota arriba el Lote del Yogur sin Azúcar del día para poder avanzar.
          </span>
        )}
        <div className="ml-auto">
          <Button
            variant="primary"
            size="xl"
            iconRight="arrow_forward"
            disabled={
              !state.trasiego.completado || !state.loteYogurSinAzucar?.trim()
            }
            onClick={() => {
              if (!state.loteYogurSinAzucar?.trim()) {
                showToast(
                  '⚠ Escribe el Lote del Yogur sin Azúcar del día para continuar.',
                  'warning'
                );
                return;
              }
              onNextStage();
            }}
          >
            Pasar a Etapa 2: Agregar Cultivo
          </Button>
        </div>
      </div>
    </div>
  );
};
