import React, { useEffect, useMemo } from 'react';
import { StageHeader, Card, Button } from '../../../components/ui';
import {
  BatidoYAdicionesYogurState,
  LoteSaborYogurProceso,
} from '../../../types/yogur';
import {
  computeDurationBetweenTimes,
  getCurrentTimeString,
} from '../../../utils/timer';

interface BatidoEnvasadoYogurStageProps {
  state: BatidoYAdicionesYogurState;
  onChange: (
    updater: (prev: BatidoYAdicionesYogurState) => BatidoYAdicionesYogurState
  ) => void;
  llevaAzucar?: boolean;
  litrosLecheBase?: number;
  horaIngresoCuartoFrio?: string | null;
  onNextStage: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
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

const consolidar = (
  prev: BatidoYAdicionesYogurState,
  lotes: LoteSaborYogurProceso[]
): BatidoYAdicionesYogurState => {
  const iniciados = lotes.filter((l) => l.batidoInicio);
  const todosBatidos = lotes.length > 0 && lotes.every((l) => l.batidoFin);
  const todosEnvasados = lotes.length > 0 && lotes.every((l) => l.envasadoFin);
  const horaInicio = iniciados.length > 0 ? iniciados[0].batidoInicio : null;
  const finales = lotes.filter((l) => l.batidoFin);
  const horaFin = todosBatidos ? finales[finales.length - 1].batidoFin : null;
  return {
    ...prev,
    lotesSabor: lotes,
    batidora: {
      ...prev.batidora,
      iniciado: iniciados.length > 0,
      completado: todosBatidos,
      horaInicio,
      horaFin,
      tiempoBatido:
        horaInicio && horaFin ? computeDurationBetweenTimes(horaInicio, horaFin).human : null,
      esManual: false,
    },
    preparacionTolva: {
      ...(prev.preparacionTolva || ({} as any)),
      completado: todosEnvasados,
      horaPreparacion: todosEnvasados ? lotes[lotes.length - 1].envasadoFin : null,
    } as any,
  };
};

export const BatidoEnvasadoYogurStage: React.FC<BatidoEnvasadoYogurStageProps> = ({
  state,
  onChange,
  llevaAzucar = true,
  litrosLecheBase = 0,
  horaIngresoCuartoFrio,
  onNextStage,
  showToast,
}) => {
  const lotes = state.lotesSabor || [];
  const recetaLista = Boolean(
    (state.adiciones as any)?.recetaConfirmada || state.adiciones?.registrado
  );
  const puedeOperar = llevaAzucar ? recetaLista : true;
  const salida = state.salidaCuartoFrio;
  const salidaConfirmada = Boolean(salida?.confirmada && salida?.hora);

  useEffect(() => {
    if (lotes.length > 0 || !puedeOperar) return;
    if (!llevaAzucar) {
      onChange((prev) => ({
        ...prev,
        lotesSabor: [nuevoLote('sin-azucar', 'Yogur sin azúcar (Stevia)')],
      }));
      return;
    }
    const recetas = ((state.adiciones as any)?.sabores || []) as { id: string; sabor: string }[];
    const origen =
      recetas.length > 0
        ? recetas.map((r) => nuevoLote(r.id, r.sabor))
        : [nuevoLote('sabor-previo', (state.adiciones as any)?.sabor || 'Yogur')];
    onChange((prev) => ({ ...prev, lotesSabor: origen }));
  }, [lotes.length, puedeOperar, llevaAzucar]);

  const actualizarLote = (id: string, cambios: Partial<LoteSaborYogurProceso>) => {
    onChange((prev) => {
      const actuales = prev.lotesSabor || [];
      const nuevos = actuales.map((l) => {
        if (l.id !== id) return l;
        const m = { ...l, ...cambios };
        m.tiempoBatido =
          m.batidoInicio && m.batidoFin
            ? computeDurationBetweenTimes(m.batidoInicio, m.batidoFin).human
            : null;
        m.tiempoEnvasado =
          m.envasadoInicio && m.envasadoFin
            ? computeDurationBetweenTimes(m.envasadoInicio, m.envasadoFin).human
            : null;
        m.tiempoTotal =
          m.batidoInicio && m.envasadoFin
            ? computeDurationBetweenTimes(m.batidoInicio, m.envasadoFin).human
            : null;
        return m;
      });
      return consolidar(prev, nuevos);
    });
  };

  const registrarSalida = () => {
    const hora = getCurrentTimeString();
    onChange((prev) => ({ ...prev, salidaCuartoFrio: { hora, confirmada: true } }));
    showToast(`✓ Salida de cuarto frío registrada a las ${hora}.`, 'success');
  };

  const editarSalida = () => {
    if (lotes.some((l) => l.batidoInicio)) {
      showToast('No se puede editar la salida: ya se inició el batido de un sabor.', 'warning');
      return;
    }
    onChange((prev) => ({ ...prev, salidaCuartoFrio: { hora: null, confirmada: false } }));
  };

  const iniciarBatido = (l: LoteSaborYogurProceso) => {
    if (!salidaConfirmada) {
      showToast('Primero registra la salida del yogur del cuarto frío.', 'warning');
      return;
    }
    const hora = getCurrentTimeString();
    actualizarLote(l.id, { batidoInicio: hora });
    showToast(`✓ Batido de ${l.sabor} iniciado a las ${hora}.`, 'info');
  };

  const finalizarBatido = (l: LoteSaborYogurProceso) => {
    const hora = getCurrentTimeString();
    actualizarLote(l.id, { batidoFin: hora });
    showToast(`✓ Batido de ${l.sabor} finalizado a las ${hora}.`, 'success');
  };

  const iniciarEnvasado = (l: LoteSaborYogurProceso) => {
    const hora = getCurrentTimeString();
    actualizarLote(l.id, { envasadoInicio: hora });
    showToast(`✓ Envasado de ${l.sabor} iniciado a las ${hora}.`, 'info');
  };

  const finalizarEnvasado = (l: LoteSaborYogurProceso) => {
    const hora = getCurrentTimeString();
    actualizarLote(l.id, { envasadoFin: hora });
    showToast(`✓ Envasado de ${l.sabor} finalizado a las ${hora}.`, 'success');
  };

  const reabrirLote = (l: LoteSaborYogurProceso) => {
    actualizarLote(l.id, {
      batidoInicio: null,
      batidoFin: null,
      envasadoInicio: null,
      envasadoFin: null,
    });
  };

  const todosListos = lotes.length > 0 && lotes.every((l) => l.envasadoFin);
  const terminados = lotes.filter((l) => l.envasadoFin).length;

  const tiempoBatidoEnvasado = useMemo(() => {
    const inicios = lotes.filter((l) => l.batidoInicio);
    if (!todosListos || inicios.length === 0) return null;
    const primero = inicios[0].batidoInicio;
    const ultimo = lotes[lotes.length - 1].envasadoFin;
    return computeDurationBetweenTimes(primero, ultimo).human;
  }, [lotes, todosListos]);

  const tiempoAfuera = useMemo(() => {
    if (!salidaConfirmada || !horaIngresoCuartoFrio) return null;
    return computeDurationBetweenTimes(salida?.hora, horaIngresoCuartoFrio).human;
  }, [salidaConfirmada, salida?.hora, horaIngresoCuartoFrio]);

  const pasoLote = (l: LoteSaborYogurProceso) => {
    if (!l.batidoInicio) return { texto: 'Iniciar batido', icono: 'play_arrow', accion: () => iniciarBatido(l) };
    if (!l.batidoFin) return { texto: 'Finalizar batido', icono: 'stop_circle', accion: () => finalizarBatido(l) };
    if (!l.envasadoInicio) return { texto: 'Iniciar envasado', icono: 'inventory_2', accion: () => iniciarEnvasado(l) };
    if (!l.envasadoFin) return { texto: 'Finalizar envasado', icono: 'task_alt', accion: () => finalizarEnvasado(l) };
    return null;
  };

  const estadoLote = (l: LoteSaborYogurProceso) => {
    if (l.envasadoFin) return 'Envasado completo';
    if (l.envasadoInicio) return 'Envasando';
    if (l.batidoFin) return 'Batido listo';
    if (l.batidoInicio) return 'Batiendo';
    return 'Pendiente';
  };

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-5 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-14">
      <StageHeader
        stageNumber={4}
        totalStages={5}
        lineName="Línea de Fermentados · Yogur"
        title="4. Batido y Envasado"
        subtitle="Cada sabor se bate con su saborizante y colorante y se envasa. Se mide el tiempo entre el inicio del batido y el fin del envasado, y el tiempo que el yogur estuvo fuera del cuarto frío."
        standardBadge="NTC-805"
        metrics={[
          {
            icon: 'water_drop',
            label: 'Volumen del Lote',
            value: `${litrosLecheBase} L`,
            tone: 'emerald',
          },
          {
            icon: 'blender',
            label: 'Sabores Envasados',
            value: `${terminados} / ${lotes.length}`,
            tone: todosListos ? 'emerald' : 'amber',
          },
          {
            icon: 'timer',
            label: 'Batido a Envasado',
            value: tiempoBatidoEnvasado || 'En curso',
            tone: tiempoBatidoEnvasado ? 'emerald' : 'default',
          },
        ]}
      />

      {!puedeOperar && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-sm text-amber-900 font-semibold">
          Primero confirma la receta de sabores en la fase 3 para poder iniciar el batido.
        </div>
      )}

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
        headerAction={
          <div className="flex flex-wrap items-center gap-3">
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
              disabled={salidaConfirmada || !puedeOperar}
              className="font-bold shadow-sm"
            >
              {salidaConfirmada ? `Salida registrada (${salida?.hora})` : 'Registrar salida de cuarto frío'}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[#4A5263]">
          {tiempoAfuera
            ? `Tiempo fuera del cuarto frío hasta el reingreso (${horaIngresoCuartoFrio}): ${tiempoAfuera}.`
            : 'El tiempo fuera del cuarto frío se calcula al registrar el traslado final a cuarto frío en la fase 5.'}
        </p>
      </Card>

      <Card
        stepBadge="Paso 02"
        title="Batido y Envasado por Sabor"
        subtitle="Avanza cada sabor: inicio de batido, fin de batido, inicio de envasado y fin de envasado."
        icon="blender"
        tone={todosListos ? 'completed' : 'default'}
        statusBadge={{
          label: todosListos ? 'Todos los sabores envasados' : `${terminados} / ${lotes.length} sabores`,
          variant: todosListos ? 'success' : 'info',
        }}
      >
        <div className="space-y-4">
          {lotes.map((l) => {
            const paso = pasoLote(l);
            const completo = Boolean(l.envasadoFin);
            return (
              <div
                key={l.id}
                className={`p-4 rounded-2xl border-2 flex flex-col gap-3 ${
                  completo ? 'bg-emerald-50/50 border-emerald-200' : 'bg-[#F7F9FC] border-[#D6DEEA]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-[#143A73]">{l.sabor}</span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                        completo
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-white text-[#4A5263] border-[#D6DEEA]'
                      }`}
                    >
                      {estadoLote(l)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.batidoInicio && (
                      <Button variant="outline" size="sm" icon="edit" onClick={() => reabrirLote(l)} className="font-bold">
                        Editar
                      </Button>
                    )}
                    {paso && (
                      <Button
                        variant="primary"
                        size="md"
                        icon={paso.icono}
                        onClick={paso.accion}
                        disabled={!puedeOperar}
                        className="font-bold shadow-sm"
                      >
                        {paso.texto}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-[#D6DEEA]">
                    <div className="font-bold uppercase tracking-wider text-[#4A5263] text-[10px]">Batido</div>
                    <div className="font-mono font-bold text-[#191C1E] mt-1">
                      {l.batidoInicio || '--'} → {l.batidoFin || '--'}
                    </div>
                    <div className="text-[#4A5263] mt-0.5">{l.tiempoBatido || 'Sin duración'}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#D6DEEA]">
                    <div className="font-bold uppercase tracking-wider text-[#4A5263] text-[10px]">Envasado</div>
                    <div className="font-mono font-bold text-[#191C1E] mt-1">
                      {l.envasadoInicio || '--'} → {l.envasadoFin || '--'}
                    </div>
                    <div className="text-[#4A5263] mt-0.5">{l.tiempoEnvasado || 'Sin duración'}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#D6DEEA] col-span-2">
                    <div className="font-bold uppercase tracking-wider text-[#4A5263] text-[10px]">
                      Total Batido a Envasado
                    </div>
                    <div className="font-mono font-black text-[#143A73] text-sm mt-1">
                      {l.tiempoTotal || 'En curso'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs sm:text-sm text-[#434655]">
          Cuando todos los sabores estén envasados, avanza a{' '}
          <strong className="text-[#191C1E]">5. Guardar</strong> para registrar conteos, balance y traslado a cuarto frío.
        </div>
        <Button
          variant="primary"
          size="lg"
          iconRight="arrow_forward"
          disabled={!todosListos}
          onClick={onNextStage}
          className="w-full sm:w-auto font-bold shadow-md"
        >
          Pasar a 5. Guardar
        </Button>
      </div>
    </div>
  );
};
