import React, { useEffect, useState } from 'react';
import { HilarState, ProcessTimerState } from '../../../types';
import {
  formatHumanDuration,
  getCurrentTimeString,
  toTimeInputStep1,
  formatTimeFromStep1,
} from '../../../utils/timer';
import { useStageCountdown } from '../../../hooks/useStageCountdown';
import {
  StageHeader,
  Card,
  ConfirmButton,
  InputField,
  SelectField,
  Button,
  Badge,
} from '../../../components/ui';
import { LOTES_SAL_CATALOG } from '../../../data/insumoLotes';

interface HilarStagePeraProps {
  state: HilarState;
  onChange: (updater: (prev: HilarState) => HilarState) => void;
  timestampDesuerado?: number | null;
  horaDesuerado?: string | null;
  horaFinEscurrido?: string | null;
  timestampFinEscurrido?: number | null;
  phEscurrido?: number;
  totalLecheMezcla?: number;
  processTimer: ProcessTimerState;
  loteSal?: string;
  onFinalizeProcess: () => void;
  onNextStage?: () => void;
  onOpenModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const HilarStagePera: React.FC<HilarStagePeraProps> = ({
  state,
  onChange,
  timestampDesuerado,
  phEscurrido,
  loteSal = '',
  onNextStage,
  showToast,
}) => {
  const [entryTimestamp] = useState<number>(() => Date.now());
  const phMedidoEnEscurrido = phEscurrido ?? state.phActual ?? 5.3;

  // =========================================================================
  // ESTADOS PARA SALMUERA CALIENTE (QUESO PERA)
  // Proporción FIJA: 30 L de agua + 1 kg de sal (1000 g)
  // =========================================================================
  const [litrosAgua, setLitrosAgua] = useState<number>(30);
  const [salManualKg, setSalManualKg] = useState<number | undefined>(undefined);
  const [salmueraLista, setSalmueraLista] = useState<boolean>(
    Boolean(state.sal?.registrado || state.salmuera?.lista)
  );
  const [loteSalActual, setLoteSalActual] = useState<string>(
    state.sal?.loteSal || loteSal || ''
  );
  const [manualSalmuera, setManualSalmuera] = useState<boolean>(
    Boolean(state.sal?.esManual)
  );

  const salKgDisplay = salManualKg !== undefined ? salManualKg : Number((litrosAgua / 30).toFixed(2));
  const salGramosDisplay =
    salManualKg !== undefined ? Math.round(salManualKg * 1000) : Math.round((litrosAgua / 30) * 1000);

  // =========================================================================
  // ESTADOS PARA SALMUERA FRÍA (ENFRIAMIENTO)
  // Proporción FIJA: 30 L de agua fría + 500 g de sal (valores FIJOS)
  // =========================================================================
  const [salmueraFriaPreparada, setSalmueraFriaPreparada] = useState<boolean>(
    Boolean(state.salmueraFria?.preparada)
  );
  const [manualSalmueraFria, setManualSalmueraFria] = useState<boolean>(false);
  const [salFriaManualGramos, setSalFriaManualGramos] = useState<
    number | undefined
  >(undefined);
  const [loteSalFriaActual, setLoteSalFriaActual] = useState<string>(
    state.salmueraFria?.loteSal || state.sal?.loteSal || loteSal || ''
  );

  useEffect(() => {
    if (loteSal) {
      setLoteSalActual((prev) => prev || loteSal);
      setLoteSalFriaActual((prev) => prev || loteSal);
    }
  }, [loteSal]);
  const salFriaGramosDisplay =
    salFriaManualGramos !== undefined ? salFriaManualGramos : 500;

  // Estados de edición manual para horas (Formato estándar hh:mm:ss a)
  const [draftHoraPrueba, setDraftHoraPrueba] = useState<string>(
    toTimeInputStep1(state.pruebaHilado.horaRegistro || '')
  );
  const [editModePrueba, setEditModePrueba] = useState<boolean>(false);

  const [editModeHilado, setEditModeHilado] = useState<boolean>(false);
  const [draftHoraInicioHilado, setDraftHoraInicioHilado] = useState<string>(
    toTimeInputStep1(state.hiladoEnPaila?.horaInicio || '')
  );
  const [draftHoraFinHilado, setDraftHoraFinHilado] = useState<string>(
    toTimeInputStep1(state.hiladoEnPaila?.horaFin || '')
  );
  const [draftDuracionHilado, setDraftDuracionHilado] = useState<string>(
    state.hiladoEnPaila?.duracion || '15 min'
  );

  // Cronómetros independientes via useStageCountdown
  const pruebaTimer = useStageCountdown({
    startTime: timestampDesuerado || entryTimestamp,
    isRunning: !state.pruebaHilado.exitosa,
    isCompleted: state.pruebaHilado.exitosa,
  });

  const pailaTimer = useStageCountdown({
    startTime: state.hiladoEnPaila?.timestampInicio || null,
    isRunning: Boolean(
      state.hiladoEnPaila?.iniciado && !state.hiladoEnPaila?.completado
    ),
    isCompleted: Boolean(state.hiladoEnPaila?.completado),
  });

  // 1. Registro de prueba de hilado exitosa
  const handleRecordPruebaHiladoExitosa = () => {
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();

    const baseTs = timestampDesuerado || entryTimestamp;
    const elapsedSec = Math.max(1, Math.floor((nowTs - baseTs) / 1000));
    const duracionStr = formatHumanDuration(elapsedSec);

    onChange((prev) => ({
      ...prev,
      pruebaHilado: {
        ...prev.pruebaHilado,
        exitosa: true,
        horaRegistro: timeStr,
        timestampPruebaHilado: nowTs,
        tiempoDesdeDesuerado: duracionStr,
        resultado:
          'La prueba de hilado ha sido exitosa (Hebra continua, elástica y brillante)',
      },
    }));

    showToast(
      `✓ Prueba de hilado lista a las ${timeStr} · Tardó ${duracionStr} desde el desuerado`,
      'success'
    );
  };

  // 2. Botón de acción principal: "Ya preparé la salmuera caliente"
  const handleSalmueraListaYCalentada = () => {
    if (!loteSalActual) {
      showToast('Selecciona el lote de sal de la salmuera caliente.', 'warning');
      return;
    }
    const timeStr = getCurrentTimeString();
    setSalmueraLista(true);

    onChange((prev) => {
      const salFria = prev.salmueraFria?.preparada
        ? prev.salmueraFria.salGramos ?? 500
        : salmueraFriaPreparada
        ? salFriaGramosDisplay
        : 0;
      const totalSal = salGramosDisplay + salFria;
      return {
        ...prev,
        sal: {
          ...(prev.sal || { esManual: false }),
          registrado: true,
          horaRegistro: timeStr,
          cantidadGramos: totalSal,
          loteSal: loteSalActual,
          esManual: manualSalmuera,
        },
        salmuera: {
          ...(prev.salmuera || {}),
          lista: true,
          temperaturaAlcanzada85: true,
          temperaturaValor: 85.0,
          litrosAgua: litrosAgua,
          cantidadSalKg: salKgDisplay,
          cantidadSalGramos: salGramosDisplay,
          loteSal: loteSalActual,
          horaLista: timeStr,
        },
      };
    });

    showToast(
      `✓ Salmuera caliente lista a las ${timeStr} (${litrosAgua} L agua · ${salKgDisplay} kg sal · Lote: ${loteSalActual})`,
      'success'
    );
  };

  // 3. Botón de acción: "Ya preparé la salmuera fría"
  const handlePrepararSalmueraFria = () => {
    if (!loteSalFriaActual) {
      showToast('Selecciona el lote de sal de la salmuera fría.', 'warning');
      return;
    }
    const timeStr = getCurrentTimeString();
    const nowTs = Date.now();
    setSalmueraFriaPreparada(true);

    onChange((prev) => {
      const salCaliente =
        prev.salmuera?.cantidadSalGramos ?? salGramosDisplay;
      const totalSal = salCaliente + salFriaGramosDisplay;
      return {
        ...prev,
        sal: {
          ...(prev.sal || { esManual: false, registrado: true }),
          cantidadGramos: totalSal,
          loteSal: prev.sal?.loteSal || loteSalActual,
        },
        salmueraFria: {
          preparada: true,
          horaRegistro: timeStr,
          timestamp: nowTs,
          litrosAgua: 30,
          salGramos: salFriaGramosDisplay,
          loteSal: loteSalFriaActual,
        },
      };
    });

    showToast(
      `✓ Salmuera fría preparada a las ${timeStr} (30 L agua fría + ${salFriaGramosDisplay} g de sal)`,
      'success'
    );
  };

  // 4. Iniciar Hilado / Amasado en Paila
  const handleStartAmasadoPaila = () => {
    if (state.hiladoEnPaila?.iniciado) return;
    const timeStr = getCurrentTimeString();
    const nowTs = Date.now();

    onChange((prev) => ({
      ...prev,
      hiladoEnPaila: {
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
        timestampInicio: nowTs,
        horaFin: null,
        duracion: null,
        esManual: false,
      },
    }));

    showToast(`⏱ Proceso de hilado iniciado a las ${timeStr}`, 'info');
  };

  // 5. Finalizar Hilado / Amasado en Paila
  const handleFinAmasadoPaila = () => {
    if (!state.hiladoEnPaila?.iniciado || state.hiladoEnPaila?.completado) return;
    const timeStr = getCurrentTimeString();
    const nowTs = Date.now();
    const startTs = state.hiladoEnPaila?.timestampInicio || nowTs - 900000;
    const elapsedSec = Math.max(1, Math.floor((nowTs - startTs) / 1000));
    const duracionStr = formatHumanDuration(elapsedSec);

    onChange((prev) => ({
      ...prev,
      hiladoEnPaila: {
        ...prev.hiladoEnPaila,
        iniciado: true,
        completado: true,
        horaFin: timeStr,
        duracion: duracionStr,
      },
      extruirYAirear: {
        ...prev.extruirYAirear,
        completado: true,
        horaRegistro: timeStr,
      },
    }));

    showToast(
      `✓ Hilado terminado a las ${timeStr} · Duración: ${duracionStr}`,
      'success'
    );
  };

  // Guardado manual: Paso 1 (Prueba de Hilado)
  const handleSaveManualPrueba = () => {
    const formattedHora = formatTimeFromStep1(draftHoraPrueba);
    onChange((prev) => ({
      ...prev,
      pruebaHilado: {
        ...prev.pruebaHilado,
        exitosa: true,
        horaRegistro: formattedHora,
        esManual: true,
      },
    }));
    setEditModePrueba(false);
    showToast(`✓ Hora de prueba guardada: ${formattedHora}`, 'success');
  };

  // Guardado manual: Paso 2 (Salmuera Caliente)
  const handleSaveManualSalmuera = () => {
    handleSalmueraListaYCalentada();
    setManualSalmuera(false);
  };

  // Guardado manual: Paso 3 (Hilado en Paila)
  const handleSaveManualHilado = () => {
    const formattedInicio = formatTimeFromStep1(draftHoraInicioHilado);
    const formattedFin = formatTimeFromStep1(draftHoraFinHilado);
    const duracion = draftDuracionHilado || '15 min';

    onChange((prev) => ({
      ...prev,
      hiladoEnPaila: {
        ...(prev.hiladoEnPaila || {}),
        iniciado: true,
        completado: true,
        horaInicio: formattedInicio,
        horaFin: formattedFin,
        duracion,
        esManual: true,
      },
      extruirYAirear: {
        ...prev.extruirYAirear,
        completado: true,
        horaRegistro: formattedFin,
      },
    }));

    setEditModeHilado(false);
    showToast(
      `✓ Hilado actualizado: ${formattedInicio} a ${formattedFin} (${duracion})`,
      'success'
    );
  };

  // Guardado manual: Paso 4 (Salmuera Fría)
  const handleSaveManualSalmueraFria = () => {
    if (!loteSalFriaActual) {
      showToast('Selecciona el lote de sal de la salmuera fría.', 'warning');
      return;
    }
    const timeStr = getCurrentTimeString();
    const nowTs = Date.now();
    setSalmueraFriaPreparada(true);

    onChange((prev) => {
      const salCaliente =
        prev.salmuera?.cantidadSalGramos ?? salGramosDisplay;
      const totalSal = salCaliente + salFriaGramosDisplay;
      return {
        ...prev,
        sal: {
          ...(prev.sal || { esManual: true, registrado: true }),
          cantidadGramos: totalSal,
          loteSal: prev.sal?.loteSal || loteSalActual,
        },
        salmueraFria: {
          preparada: true,
          horaRegistro: timeStr,
          timestamp: nowTs,
          litrosAgua: 30,
          salGramos: salFriaGramosDisplay,
          loteSal: loteSalFriaActual,
        },
      };
    });

    setManualSalmueraFria(false);
    showToast(
      `✓ Salmuera fría actualizada: 30 L agua + ${salFriaGramosDisplay} g sal (${loteSalFriaActual})`,
      'success'
    );
  };

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-12">
      <StageHeader
        stageNumber={4}
        totalStages={5}
        title="Hilar con Salmuera Caliente y Salmuera Fría"
        subtitle="Haz la prueba de hilado, deja lista la salmuera caliente (~85 °C) y la salmuera fría, y luego hila la masa."
        productName="Queso Pera"
        icon="waves"
        isCompleted={Boolean(
          state.hiladoEnPaila?.completado && salmueraFriaPreparada
        )}
        rightContent={
          <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-300 flex items-center gap-2.5 min-h-[48px]">
            <span className="material-symbols-outlined text-amber-700 text-[22px]">
              science
            </span>
            <div>
              <div className="text-[10px] text-amber-900 uppercase font-bold">
                pH MEDIDO EN ESCURRIDO
              </div>
              <div className="text-sm font-black text-amber-950 font-mono">
                {phMedidoEnEscurrido.toFixed(2)} pH
              </div>
            </div>
          </div>
        }
      />

      {/* =========================================================================
          1. PRIMERO: LA PRUEBA DE HILADO HA SIDO EXITOSA
      ========================================================================= */}
      <Card
        title="Paso 1 · Hacer la Prueba de Hilado"
        subtitle={`Con el pH de ${phMedidoEnEscurrido.toFixed(
          2
        )} medido en el escurrido, prueba que la cuajada estire firme y brillante sin romperse.`}
        icon="verified"
        badge={
          state.pruebaHilado.exitosa
            ? '✓ Prueba Exitosa'
            : 'Pendiente Prueba de Hilado'
        }
        variant={state.pruebaHilado.exitosa ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="Confirmar: La Prueba Salió Bien"
            confirmedLabel="✓ La Prueba ha sido Exitosa"
            icon="verified"
            isConfirmed={state.pruebaHilado.exitosa}
            onConfirm={handleRecordPruebaHiladoExitosa}
          />
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-xl border border-[#D6DEEA] shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-amber-600">
                verified
              </span>
              Hora Prueba Exitosa
            </span>
            <div className="mt-2">
              {editModePrueba ? (
                <InputField
                  label="Hora de la prueba"
                  icon="schedule"
                  type="time"
                  step="1"
                  value={draftHoraPrueba}
                  onChange={(e) => setDraftHoraPrueba(e.target.value)}
                />
              ) : (
                <>
                  <span className="text-xl font-black font-mono text-amber-900 block">
                    {state.pruebaHilado.horaRegistro || '--:--:--'}
                  </span>
                  <span className="text-[11px] text-gray-500 font-semibold block mt-0.5">
                    {state.pruebaHilado.exitosa
                      ? 'Prueba confirmada con éxito'
                      : 'Pendiente confirmar'}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-[#D6DEEA] shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#1B4E9B]">
                schedule
              </span>
              Tiempo desde el Desuerado
            </span>
            <div className="mt-2">
              <span className="text-2xl font-black font-mono text-[#1B4E9B] block">
                {state.pruebaHilado.tiempoDesdeDesuerado ||
                  (!state.pruebaHilado.exitosa
                    ? formatHumanDuration(pruebaTimer.elapsedSeconds)
                    : '--')}
              </span>
              <span className="text-[11px] text-gray-500 font-semibold block mt-0.5">
                {state.pruebaHilado.exitosa
                  ? `Tardó ${state.pruebaHilado.tiempoDesdeDesuerado} desde desuerado`
                  : 'Contando desde el desuerado...'}
              </span>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-emerald-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-800 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-emerald-700">
                grade
              </span>
              Resultado de la Hebra
            </span>
            <div className="mt-2">
              <span className="text-xs font-black text-emerald-800 block">
                {state.pruebaHilado.exitosa
                  ? 'Hebra continua, elástica y brillante'
                  : state.pruebaHilado.resultado}
              </span>
              <span className="text-[11px] text-gray-500 font-semibold block mt-1">
                pH en escurrido: {phMedidoEnEscurrido.toFixed(2)} pH
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D6DEEA] mt-4">
          <label className="flex items-center gap-2.5 text-xs font-extrabold text-[#434655] cursor-pointer select-none min-h-[40px]">
            <input
              type="checkbox"
              checked={editModePrueba}
              onChange={(e) => {
                const checked = e.target.checked;
                if (checked) {
                  setDraftHoraPrueba(
                    toTimeInputStep1(state.pruebaHilado.horaRegistro)
                  );
                }
                setEditModePrueba(checked);
              }}
              className="w-5 h-5 rounded accent-[#1B4E9B] cursor-pointer"
            />
            <span>Habilitar edición manual</span>
          </label>

          {editModePrueba && (
            <Button
              variant="primary"
              size="sm"
              icon="save"
              onClick={handleSaveManualPrueba}
            >
              Guardar cambios
            </Button>
          )}
        </div>
      </Card>

      {/* =========================================================================
          2. SALMUERA CALIENTE (PARA HILAR)
          Proporción FIJA: 30 L de agua + 1 kg de sal (1000 g)
      ========================================================================= */}
      <Card
        title="Paso 2 · Salmuera Caliente (Para Hilar)"
        subtitle="Prepara la salmuera caliente con la proporción fija: 30 L de agua + 1 kg de sal (1,000 g)."
        icon="local_fire_department"
        badge={
          salmueraLista
            ? '✓ Salmuera Caliente Lista'
            : '30 L agua + 1 kg sal'
        }
        variant={salmueraLista ? 'success' : 'warning'}
        headerAction={
          <ConfirmButton
            label="Ya preparé la salmuera caliente"
            confirmedLabel="✓ Ya preparé la salmuera caliente"
            icon="check_circle"
            isConfirmed={salmueraLista}
            onConfirm={handleSalmueraListaYCalentada}
          />
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* BLOQUE 1: LITROS DE AGUA */}
          <div className="p-4 bg-white rounded-xl border border-[#D6DEEA] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  LITROS DE AGUA
                </span>
                <Badge variant="info" size="sm">
                  Proporción fija
                </Badge>
              </div>
              <div className="mt-2.5">
                {manualSalmuera ? (
                  <InputField
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="1"
                    unit="Litros"
                    value={litrosAgua}
                    onChange={(e) =>
                      setLitrosAgua(Number(e.target.value) || 0)
                    }
                  />
                ) : (
                  <span className="font-mono font-black text-2xl text-gray-900">
                    {litrosAgua} Litros
                  </span>
                )}
              </div>
            </div>
            <span className="text-[11px] text-gray-500 font-semibold mt-3 pt-2 border-t border-gray-100">
              Agua caliente para estirar la masa
            </span>
          </div>

          {/* BLOQUE 2: CANTIDAD DE SAL FIJA */}
          <div className="p-4 bg-white rounded-xl border border-amber-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-900">
                  CANTIDAD DE SAL (FIJA)
                </span>
                <Badge variant="warning" size="sm">
                  1 kg / 30 L
                </Badge>
              </div>
              <div className="mt-2.5">
                {manualSalmuera ? (
                  <InputField
                    type="number"
                    inputMode="decimal"
                    step="0.05"
                    unit="kg"
                    value={salKgDisplay}
                    onChange={(e) => setSalManualKg(Number(e.target.value))}
                  />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-mono text-amber-900">
                      {salKgDisplay.toFixed(2)} kg
                    </span>
                    <span className="text-xs font-bold text-gray-600">
                      ({salGramosDisplay} g)
                    </span>
                  </div>
                )}
              </div>
            </div>
            <span className="text-[11px] text-amber-900 font-semibold mt-3 pt-2 border-t border-amber-100">
              Proporción fija: 1 kg de sal (1,000 g)
            </span>
          </div>

          {/* BLOQUE 3: TEXTO INFORMATIVO DE ALERTA ~85 °C */}
          <div className="p-4 bg-amber-50/90 rounded-xl border-2 border-amber-300 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black text-amber-900 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-amber-700">
                    warning
                  </span>
                  CUIDADO CON LA TEMPERATURA
                </span>
                <Badge variant="warning" size="sm">
                  ~85.0 °C
                </Badge>
              </div>
              <p className="text-xs font-bold text-amber-950 mt-2 leading-snug">
                Mantenga el agua cerca de 85 °C. Al agregar el queso la temperatura baja; vuelva a subirla antes de continuar.
              </p>
            </div>
            <span className="text-[11px] text-amber-800 font-semibold mt-2 pt-2 border-t border-amber-200">
              Recomendación de planta
            </span>
          </div>

          {/* BLOQUE 4: LOTE DE SAL REGISTRADA */}
          <div className="p-4 bg-white rounded-xl border border-emerald-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-emerald-900">
                  LOTE DE LA SAL
                </span>
                <Badge variant="success" size="sm">
                  Trazabilidad
                </Badge>
              </div>
              <div className="mt-2.5">
                {manualSalmuera ? (
                  <SelectField
                    value={loteSalActual}
                    onChange={(e) => setLoteSalActual(e.target.value)}
                    options={LOTES_SAL_CATALOG.map((l) => ({
                      value: l,
                      label: l,
                    }))}
                  />
                ) : (
                  <div className="flex items-center gap-2 bg-[#FFFFFF] px-3 py-2 rounded-xl border border-emerald-200 min-h-[48px]">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">
                      verified
                    </span>
                    <span className="font-mono font-black text-sm text-gray-900">
                      {loteSalActual}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <span className="text-[11px] text-gray-500 font-semibold mt-3 pt-2 border-t border-emerald-100">
              Lote de sal usado en salmuera caliente
            </span>
          </div>
        </div>

        {/* Checkbox inferior de edición manual */}
        <div className="mt-4 pt-3 border-t border-[#D6DEEA]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 text-xs font-bold text-gray-800 cursor-pointer select-none min-h-[40px]">
            <input
              type="checkbox"
              checked={manualSalmuera}
              onChange={(e) => setManualSalmuera(e.target.checked)}
              className="w-5 h-5 rounded text-[#1B4E9B] border-gray-300 cursor-pointer"
            />
            <span>Habilitar edición manual</span>
          </label>

          {manualSalmuera && (
            <Button
              variant="primary"
              size="sm"
              icon="save"
              onClick={handleSaveManualSalmuera}
            >
              Guardar cambios
            </Button>
          )}

          <Badge variant="warning" size="md">
            Salmuera Caliente: 30 L agua + 1 kg sal
          </Badge>
        </div>
      </Card>

      {/* =========================================================================
          3. SALMUERA FRÍA (SE DEJA LISTA JUNTO A LA CALIENTE)
          30 L de agua fría + 500 g de sal (valores FIJOS)
      ========================================================================= */}
      <Card
        title="Paso 3 · Salmuera Fría (déjala lista junto a la caliente)"
        subtitle="Prepara la salmuera fría ahora y déjala lista a un lado, junto a la caliente: 30 L de agua fría + 500 g de sal (valores fijos). Cuando la tengas lista, presiona el botón."
        icon="ac_unit"
        badge={
          salmueraFriaPreparada
            ? '✓ Salmuera Fría Lista'
            : '30 L agua fría + 500 g sal'
        }
        variant={salmueraFriaPreparada ? 'success' : 'info'}
        headerAction={
          <ConfirmButton
            label="Ya preparé la salmuera fría"
            confirmedLabel="✓ Ya preparé la salmuera fría"
            icon="ac_unit"
            isConfirmed={salmueraFriaPreparada}
            onConfirm={handlePrepararSalmueraFria}
          />
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-xl border border-cyan-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-cyan-900">
                  AGUA FRÍA (FIJA)
                </span>
                <Badge variant="info" size="sm">
                  Fijo
                </Badge>
              </div>
              <div className="mt-2.5">
                <span className="font-mono font-black text-2xl text-gray-900">
                  30 Litros
                </span>
              </div>
            </div>
            <span className="text-[11px] text-gray-500 font-semibold mt-3 pt-2 border-t border-cyan-100">
              Agua fría para enfriar el queso
            </span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-cyan-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-cyan-900">
                  SAL USADA (FIJA)
                </span>
                <Badge variant="info" size="sm">
                  500 g fija
                </Badge>
              </div>
              <div className="mt-2.5">
                {manualSalmueraFria ? (
                  <InputField
                    type="number"
                    inputMode="decimal"
                    min="100"
                    step="50"
                    unit="g"
                    value={salFriaGramosDisplay}
                    onChange={(e) =>
                      setSalFriaManualGramos(Number(e.target.value) || 0)
                    }
                  />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-mono text-cyan-950">
                      {salFriaGramosDisplay} g
                    </span>
                    <span className="text-xs font-bold text-gray-600">
                      (0.50 kg)
                    </span>
                  </div>
                )}
              </div>
            </div>
            <span className="text-[11px] text-gray-500 font-semibold mt-3 pt-2 border-t border-cyan-100">
              Se suma al gasto total de sal del lote
            </span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-cyan-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-cyan-900">
                  LOTE DE LA SAL
                </span>
                <Badge variant="info" size="sm">
                  Trazabilidad
                </Badge>
              </div>
              <div className="mt-2.5">
                {manualSalmueraFria ? (
                  <SelectField
                    value={loteSalFriaActual}
                    onChange={(e) => setLoteSalFriaActual(e.target.value)}
                    options={LOTES_SAL_CATALOG.map((l) => ({
                      value: l,
                      label: l,
                    }))}
                  />
                ) : (
                  <div className="flex items-center gap-2 bg-[#FFFFFF] px-3 py-2 rounded-xl border border-cyan-200 min-h-[48px]">
                    <span className="material-symbols-outlined text-[18px] text-cyan-700">
                      verified
                    </span>
                    <span className="font-mono font-black text-sm text-gray-900">
                      {state.salmueraFria?.loteSal || loteSalFriaActual}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <span className="text-[11px] text-gray-500 font-semibold mt-3 pt-2 border-t border-cyan-100">
              {salmueraFriaPreparada
                ? `Preparada a las ${
                    state.salmueraFria?.horaRegistro || 'ahora'
                  }`
                : 'Lista para preparar'}
            </span>
          </div>

          {/* REGLA DE DESTINO */}
          <div className="p-4 bg-amber-50/90 rounded-xl border-2 border-amber-300 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black text-amber-900 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-amber-700">
                    info
                  </span>
                  REGLA IMPORTANTE
                </span>
                <Badge variant="warning" size="sm">
                  Solo Pera
                </Badge>
              </div>
              <p className="text-xs font-bold text-amber-950 mt-2 leading-snug">
                Solo para Queso Pera pequeño y grande. Mexicano y Finas Hierbas NO van a salmuera fría.
              </p>
            </div>
            <span className="text-[11px] text-amber-900 font-semibold mt-2 pt-2 border-t border-amber-200">
              Salmuera Fría exclusiva para Queso Pera
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#D6DEEA]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 text-xs font-bold text-gray-800 cursor-pointer select-none min-h-[40px]">
            <input
              type="checkbox"
              checked={manualSalmueraFria}
              onChange={(e) => setManualSalmueraFria(e.target.checked)}
              className="w-5 h-5 rounded text-cyan-700 border-gray-300 cursor-pointer"
            />
            <span>Habilitar edición manual</span>
          </label>

          {manualSalmueraFria && (
            <Button
              variant="primary"
              size="sm"
              icon="save"
              onClick={handleSaveManualSalmueraFria}
            >
              Guardar cambios
            </Button>
          )}

          <Badge variant="info" size="md">
            Salmuera Fría: 30 L agua fría + 500 g sal
          </Badge>
        </div>
      </Card>

      {/* =========================================================================
          3. TERCERO: PROCESO DE HILADO GENERAL
      ========================================================================= */}
      <Card
        title="Paso 4 · Hilar y Amasar con la Salmuera a ~85 °C"
        subtitle="Hila y amasa la pasta con la salmuera caliente hasta que quede suave y brillante. Marca el inicio y el fin."
        icon="settings_motion_mode"
        badge={
          state.hiladoEnPaila?.completado
            ? '✓ Hilado Terminado'
            : state.hiladoEnPaila?.iniciado
            ? 'Hilando...'
            : 'Pendiente Iniciar Hilado'
        }
        variant={
          state.hiladoEnPaila?.completado
            ? 'success'
            : state.hiladoEnPaila?.iniciado
            ? 'info'
            : 'default'
        }
        headerAction={
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              icon="play_circle"
              disabled={Boolean(state.hiladoEnPaila?.iniciado)}
              onClick={handleStartAmasadoPaila}
            >
              {state.hiladoEnPaila?.iniciado
                ? `Iniciado (${state.hiladoEnPaila.horaInicio})`
                : '1. Iniciar Hilado'}
            </Button>

            <Button
              variant="danger"
              size="md"
              icon="stop_circle"
              disabled={
                !state.hiladoEnPaila?.iniciado ||
                Boolean(state.hiladoEnPaila?.completado)
              }
              onClick={handleFinAmasadoPaila}
            >
              {state.hiladoEnPaila?.completado
                ? '✓ Fin de Hilado Registrado'
                : '2. Terminar Hilado'}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-xl border border-[#D6DEEA] shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#1B4E9B]">
                schedule
              </span>
              Hora de Inicio del Hilado
            </span>
            <div className="mt-2">
              {editModeHilado ? (
                <InputField
                  label="Hora de Inicio"
                  icon="schedule"
                  type="time"
                  step="1"
                  value={draftHoraInicioHilado}
                  onChange={(e) => setDraftHoraInicioHilado(e.target.value)}
                />
              ) : (
                <>
                  <span className="text-xl font-black font-mono text-gray-900 block">
                    {state.hiladoEnPaila?.horaInicio || '--:--:--'}
                  </span>
                  <span className="text-[11px] text-gray-500 font-semibold block mt-0.5">
                    Inicio del estirado con salmuera caliente
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-amber-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-amber-900 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-amber-600">
                verified
              </span>
              Hora en que Terminó el Hilado
            </span>
            <div className="mt-2">
              {editModeHilado ? (
                <InputField
                  label="Hora de Fin"
                  icon="schedule"
                  type="time"
                  step="1"
                  value={draftHoraFinHilado}
                  onChange={(e) => setDraftHoraFinHilado(e.target.value)}
                />
              ) : (
                <>
                  <span className="text-xl font-black font-mono text-amber-900 block">
                    {state.hiladoEnPaila?.horaFin || '--:--:--'}
                  </span>
                  <span className="text-[11px] text-gray-500 font-semibold block mt-0.5">
                    Masa lista para moldear
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-[#D6DEEA] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-[#1B4E9B]">
                  timer
                </span>
                Tiempo de Hilado
              </span>
              {state.hiladoEnPaila?.completado && (
                <Badge variant="success" size="sm">
                  Terminado
                </Badge>
              )}
            </div>
            <div className="mt-2">
              {editModeHilado ? (
                <InputField
                  label="Duración"
                  icon="timer"
                  type="text"
                  value={draftDuracionHilado}
                  onChange={(e) => setDraftDuracionHilado(e.target.value)}
                  placeholder="ej: 15 min"
                />
              ) : (
                <>
                  <span className="text-2xl font-black font-mono text-[#1B4E9B] block">
                    {state.hiladoEnPaila?.duracion ||
                      (state.hiladoEnPaila?.iniciado
                        ? formatHumanDuration(pailaTimer.elapsedSeconds)
                        : '--')}
                  </span>
                  <span className="text-[11px] text-gray-500 font-semibold block mt-0.5">
                    {state.hiladoEnPaila?.completado
                      ? `Duración total: ${state.hiladoEnPaila.duracion}`
                      : state.hiladoEnPaila?.iniciado
                      ? 'Hilando...'
                      : 'Entre el inicio y el fin del hilado'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D6DEEA] mt-4">
          <label className="flex items-center gap-2.5 text-xs font-extrabold text-[#434655] cursor-pointer select-none min-h-[40px]">
            <input
              type="checkbox"
              checked={editModeHilado}
              onChange={(e) => {
                const checked = e.target.checked;
                if (checked) {
                  setDraftHoraInicioHilado(
                    toTimeInputStep1(state.hiladoEnPaila?.horaInicio)
                  );
                  setDraftHoraFinHilado(
                    toTimeInputStep1(state.hiladoEnPaila?.horaFin)
                  );
                  setDraftDuracionHilado(
                    state.hiladoEnPaila?.duracion || '15 min'
                  );
                }
                setEditModeHilado(checked);
              }}
              className="w-5 h-5 rounded accent-[#1B4E9B] cursor-pointer"
            />
            <span>Habilitar edición manual</span>
          </label>

          {editModeHilado && (
            <Button
              variant="primary"
              size="sm"
              icon="save"
              onClick={handleSaveManualHilado}
            >
              Guardar cambios
            </Button>
          )}
        </div>
      </Card>

      {/* =========================================================================
          5. BOTÓN DE AVANCE A RENDIMIENTO Y MOLDEO
      ========================================================================= */}
      {onNextStage && (
        <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1B4E9B] to-[#003796] text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6 border border-blue-900/30">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
              <span className="material-symbols-outlined text-[34px] text-amber-300">
                scale
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-blue-200 bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                Siguiente Etapa del Proceso
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                Pasar a Etapa 5: Rendimiento y Moldeo
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
                Cuenta los <strong>moldes de Queso Pera (350 g y 60 g)</strong>, registra si sacaste Mexicano o Finas Hierbas y cierra el lote.
              </p>
            </div>
          </div>

          <Button
            variant="warning"
            size="xl"
            iconRight="arrow_forward"
            onClick={onNextStage}
          >
            IR A RENDIMIENTO Y MOLDEO
          </Button>
        </div>
      )}
    </div>
  );
};
