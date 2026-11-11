import React from 'react';
import { Card, Button, TimerBanner } from '../../../components/ui';
import { useStageCountdown } from '../../../hooks/useStageCountdown';
import {
  computeDurationBetweenTimes,
  getCurrentTimeString,
  timeStringToTimestampToday,
} from '../../../utils/timer';

export interface BatidoEnvasadoTimerDatos {
  iniciado?: boolean;
  completado?: boolean;
  horaInicio?: string | null;
  horaFin?: string | null;
  tiempoBatido?: string | null;
  timestampInicio?: number | null;
}

interface BatidoEnvasadoTimerCardProps {
  stepBadge: string;
  datos?: BatidoEnvasadoTimerDatos | null;
  onCambio: (cambios: BatidoEnvasadoTimerDatos & { esManual?: boolean }) => void;
  bloqueo?: string | null;
  detalle?: React.ReactNode;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const BatidoEnvasadoTimerCard: React.FC<BatidoEnvasadoTimerCardProps> = ({
  stepBadge,
  datos,
  onCambio,
  bloqueo,
  detalle,
  showToast,
}) => {
  const horaInicio = datos?.horaInicio || null;
  const horaFin = datos?.horaFin || null;
  const iniciado = Boolean(datos?.iniciado && horaInicio);
  const completado = Boolean(datos?.completado && horaFin);
  const enCurso = iniciado && !completado;

  const timer = useStageCountdown({
    startTimestamp: iniciado
      ? datos?.timestampInicio ?? timeStringToTimestampToday(horaInicio)
      : null,
    isRunning: enCurso,
    isCompleted: completado,
    completedDurationText: datos?.tiempoBatido,
  });

  const iniciar = () => {
    if (bloqueo) {
      showToast(bloqueo, 'warning');
      return;
    }
    const hora = getCurrentTimeString();
    onCambio({
      iniciado: true,
      completado: false,
      horaInicio: hora,
      horaFin: null,
      tiempoBatido: null,
      timestampInicio: Date.now(),
      esManual: false,
    });
    showToast(`✓ Batido y envasado iniciado a las ${hora}.`, 'info');
  };

  const finalizar = () => {
    if (!horaInicio) return;
    const hora = getCurrentTimeString();
    const duracion = computeDurationBetweenTimes(horaInicio, hora).human;
    onCambio({ completado: true, horaFin: hora, tiempoBatido: duracion });
    showToast(`✓ Envasado finalizado a las ${hora}. Tiempo total: ${duracion}.`, 'success');
  };

  const editar = () => {
    onCambio({
      iniciado: false,
      completado: false,
      horaInicio: null,
      horaFin: null,
      tiempoBatido: null,
      timestampInicio: null,
    });
  };

  return (
    <Card
      stepBadge={stepBadge}
      title="Batido y Envasado"
      icon="blender"
      tone={completado ? 'completed' : enCurso ? 'active' : 'default'}
      statusBadge={
        completado
          ? { label: `Finalizado (${datos?.tiempoBatido || '--'})`, variant: 'success' }
          : enCurso
          ? { label: 'Batiendo y envasando...', variant: 'warning', pulse: true }
          : { label: 'Pendiente', variant: 'neutral' }
      }
    >
      <div className="flex flex-col gap-4">
        {bloqueo && !iniciado && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 font-semibold">
            {bloqueo}
          </div>
        )}

        {(enCurso || completado) && (
          <TimerBanner
            label="Cronómetro de Batido y Envasado"
            sublabel="Desde el inicio del batido hasta el fin del envasado"
            formattedTime={completado ? datos?.tiempoBatido || '--' : timer.formattedElapsed}
            isRunning={enCurso}
            isCompleted={completado}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white border border-[#D6DEEA]">
            <div className="font-bold uppercase tracking-wider text-[#4A5263] text-[10px]">Inicio del batido</div>
            <div className="font-mono font-bold text-[#191C1E] text-sm mt-1">{horaInicio || '--'}</div>
          </div>
          <div className="p-3 rounded-xl bg-white border border-[#D6DEEA]">
            <div className="font-bold uppercase tracking-wider text-[#4A5263] text-[10px]">Fin del envasado</div>
            <div className="font-mono font-bold text-[#191C1E] text-sm mt-1">{horaFin || '--'}</div>
          </div>
          <div className="p-3 rounded-xl bg-white border border-[#D6DEEA]">
            <div className="font-bold uppercase tracking-wider text-[#4A5263] text-[10px]">Tiempo total</div>
            <div className="font-mono font-black text-[#143A73] text-sm mt-1">
              {completado ? datos?.tiempoBatido || '--' : enCurso ? timer.formattedElapsed : '--'}
            </div>
          </div>
        </div>

        {detalle}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {!iniciado && (
            <Button
              variant="primary"
              size="lg"
              icon="play_arrow"
              onClick={iniciar}
              disabled={Boolean(bloqueo)}
              className="font-bold shadow-sm"
            >
              Iniciar batido y envasado
            </Button>
          )}
          {enCurso && (
            <Button
              variant="success"
              size="lg"
              icon="stop_circle"
              onClick={finalizar}
              className="font-bold shadow-sm"
            >
              Finalizar envasado
            </Button>
          )}
          {completado && (
            <>
              <Button variant="outline" size="lg" icon="edit" onClick={editar} className="font-bold">
                Editar
              </Button>
              <Button variant="success" size="lg" icon="lock" disabled className="font-bold">
                Finalizado
              </Button>
            </>
          )}
          {enCurso && (
            <Button variant="outline" size="lg" icon="restart_alt" onClick={editar} className="font-bold">
              Reiniciar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
