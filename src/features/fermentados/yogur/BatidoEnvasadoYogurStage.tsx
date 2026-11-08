import React, { useEffect, useMemo } from 'react';
import { StageHeader, Card, Button } from '../../../components/ui';
import { LoteSaborYogurProceso } from '../../../types/yogur';
import {
  computeDurationBetweenTimes,
  getCurrentTimeString,
} from '../../../utils/timer';
import {
  BatidoEnvasadoTimerCard,
  BatidoEnvasadoTimerDatos,
} from '../common/BatidoEnvasadoTimerCard';

interface BatidoEnvasadoYogurStageProps {
  state: any;
  onChange: (updater: (prev: any) => any) => void;
  llevaAzucar?: boolean;
  litrosLecheBase?: number;
  horaIngresoCuartoFrio?: string | null;
  onNextStage: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
  lineName?: string;
  timerKey?: 'batidora' | 'batido';
  mostrarSalida?: boolean;
  generarLotes?: boolean;
  bloqueo?: string | null;
  antes?: React.ReactNode;
  nextLabel?: string;
}

const nuevoLote = (id: string, sabor: string): LoteSaborYogurProceso => ({
  id,
  sabor,
  batidoInicio: null,
  batidoFin: null,
  envasadoInicio: null,
  envasadoFin: null,
  tiempoBatido: null,
  tiempoEnvasado: null,
  tiempoTotal: null,
});

export const BatidoEnvasadoYogurStage: React.FC<BatidoEnvasadoYogurStageProps> = ({
  state,
  onChange,
  llevaAzucar = true,
  litrosLecheBase = 0,
  horaIngresoCuartoFrio,
  onNextStage,
  showToast,
  lineName = 'Línea de Fermentados · Yogur',
  timerKey = 'batidora',
  mostrarSalida = true,
  generarLotes = true,
  bloqueo,
  antes,
  nextLabel = '5. Guardar',
}) => {
  const lotes: LoteSaborYogurProceso[] = state.lotesSabor || [];
  const datos: BatidoEnvasadoTimerDatos = state[timerKey] || {};
  const recetaLista = Boolean(state.adiciones?.recetaConfirmada || state.adiciones?.registrado);
  const bloqueoReceta =
    bloqueo !== undefined
      ? bloqueo
      : llevaAzucar && !recetaLista
      ? 'Primero confirma la receta de sabores en la fase 3 para poder iniciar el batido.'
      : null;
  const salida = state.salidaCuartoFrio;
  const salidaConfirmada = Boolean(salida?.confirmada && salida?.hora);
  const bloqueoTimer =
    bloqueoReceta ||
    (mostrarSalida && !salidaConfirmada
      ? 'Primero registra la salida del yogur del cuarto frío.'
      : null);
  const completado = Boolean(datos.completado && datos.horaFin);

  useEffect(() => {
    if (!generarLotes || lotes.length > 0 || bloqueoReceta) return;
    if (!llevaAzucar) {
      onChange((prev) => ({
        ...prev,
        lotesSabor: [nuevoLote('sin-azucar', 'Yogur sin azúcar (Stevia)')],
      }));
      return;
    }
    const recetas = (state.adiciones?.sabores || []) as { id: string; sabor: string }[];
    const origen =
      recetas.length > 0
        ? recetas.map((r) => nuevoLote(r.id, r.sabor))
        : [nuevoLote('sabor-previo', state.adiciones?.sabor || 'Yogur')];
    onChange((prev) => ({ ...prev, lotesSabor: origen }));
  }, [generarLotes, lotes.length, bloqueoReceta, llevaAzucar]);

  const cambiarTimer = (cambios: BatidoEnvasadoTimerDatos & { esManual?: boolean }) => {
    onChange((prev) => {
      const actual = { ...(prev[timerKey] || {}), ...cambios };
      const inicio = actual.horaInicio || null;
      const fin = actual.completado ? actual.horaFin || null : null;
      const total = inicio && fin ? computeDurationBetweenTimes(inicio, fin).human : null;
      const next: any = { ...prev, [timerKey]: actual };
      if (Array.isArray(prev.lotesSabor)) {
        next.lotesSabor = prev.lotesSabor.map((l: LoteSaborYogurProceso) => ({
          ...l,
          batidoInicio: inicio,
          batidoFin: fin,
          envasadoInicio: inicio,
          envasadoFin: fin,
          tiempoBatido: total,
          tiempoEnvasado: total,
          tiempoTotal: total,
        }));
      }
      if (prev.preparacionTolva) {
        next.preparacionTolva = {
          ...prev.preparacionTolva,
          completado: Boolean(fin),
          horaPreparacion: fin,
        };
      }
      return next;
    });
  };

  const registrarSalida = () => {
    const hora = getCurrentTimeString();
    onChange((prev) => ({ ...prev, salidaCuartoFrio: { hora, confirmada: true } }));
    showToast(`✓ Salida de cuarto frío registrada a las ${hora}.`, 'success');
  };

  const editarSalida = () => {
    if (datos.iniciado) {
      showToast('No se puede editar la salida: ya se inició el batido y envasado.', 'warning');
      return;
    }
    onChange((prev) => ({ ...prev, salidaCuartoFrio: { hora: null, confirmada: false } }));
  };

  const tiempoAfuera = useMemo(() => {
    if (!salidaConfirmada || !horaIngresoCuartoFrio) return null;
    return computeDurationBetweenTimes(salida?.hora, horaIngresoCuartoFrio).human;
  }, [salidaConfirmada, salida?.hora, horaIngresoCuartoFrio]);

  const pasoTimer = mostrarSalida || antes ? 'Paso 02' : 'Paso 01';

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-5 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-14">
      <StageHeader
        stageNumber={4}
        totalStages={5}
        lineName={lineName}
        title="4. Batido y Envasado"
        subtitle="Un solo cronómetro mide desde el inicio del batido hasta el fin del envasado."
        standardBadge="NTC-805"
        metrics={[
          {
            icon: 'water_drop',
            label: 'Volumen del Lote',
            value: `${litrosLecheBase} L`,
            tone: 'emerald',
          },
          {
            icon: 'timer',
            label: 'Batido a Envasado',
            value: completado ? datos.tiempoBatido || '--' : datos.iniciado ? 'En curso' : 'Por iniciar',
            tone: completado ? 'emerald' : datos.iniciado ? 'amber' : 'default',
          },
        ]}
      />

      {antes}

      {mostrarSalida && (
        <Card
          stepBadge="Paso 01"
          title="Salida del Yogur del Cuarto Frío"
          subtitle="Registra la hora en que el yogur sale del cuarto frío hacia batido y envasado."
          icon="ac_unit"
          tone={salidaConfirmada ? 'completed' : 'active'}
          statusBadge={
            salidaConfirmada
              ? {
                  label: tiempoAfuera
                    ? `Salida ${salida?.hora} · Afuera ${tiempoAfuera}`
                    : `Salida ${salida?.hora}`,
                  variant: 'success',
                }
              : { label: 'Por registrar', variant: 'warning' }
          }
        >
          <div className="flex flex-col gap-4">
            <p className="text-xs text-[#4A5263]">
              {tiempoAfuera
                ? `Tiempo fuera del cuarto frío hasta el reingreso (${horaIngresoCuartoFrio}): ${tiempoAfuera}.`
                : 'El tiempo fuera del cuarto frío se calcula al registrar el traslado final a cuarto frío en la fase 5.'}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {salidaConfirmada && (
                <Button variant="outline" size="md" icon="edit" onClick={editarSalida} className="font-bold">
                  Editar
                </Button>
              )}
              <Button
                variant={salidaConfirmada ? 'success' : 'primary'}
                size="md"
                icon={salidaConfirmada ? 'lock' : 'logout'}
                onClick={registrarSalida}
                disabled={salidaConfirmada || Boolean(bloqueoReceta)}
                className="font-bold shadow-sm"
              >
                {salidaConfirmada ? `Salida registrada (${salida?.hora})` : 'Registrar salida de cuarto frío'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <BatidoEnvasadoTimerCard
        stepBadge={pasoTimer}
        datos={datos}
        onCambio={cambiarTimer}
        bloqueo={bloqueoTimer}
        showToast={showToast}
        detalle={
          lotes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {lotes.map((l) => (
                <span
                  key={l.id}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-[#F7F9FC] text-[#143A73] border-[#D6DEEA]"
                >
                  {l.sabor}
                </span>
              ))}
            </div>
          ) : null
        }
      />

      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs sm:text-sm text-[#434655]">
          Cuando finalice el envasado, avanza a{' '}
          <strong className="text-[#191C1E]">{nextLabel}</strong> para registrar conteos, balance y traslado a cuarto frío.
        </div>
        <Button
          variant="primary"
          size="lg"
          iconRight="arrow_forward"
          disabled={!completado}
          onClick={onNextStage}
          className="w-full sm:w-auto font-bold shadow-md"
        >
          Pasar a {nextLabel}
        </Button>
      </div>
    </div>
  );
};
