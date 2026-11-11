import React, { useState } from 'react';
import { ManualEditToggle } from '../../../components/ui/ManualEditToggle';
import {
  AcidificarState,
  LotesLeche,
  ProcessTimerState,
} from '../../../types';
import {
  LOTES_LECHE_PROVEEDOR_DEFAULT,
  LOTES_CULTIVO_LACTEO_DEFAULT,
  LOTES_CUAJO_PERA_DEFAULT,
  LOTES_SAL_CATALOG,
  useInsumoLotesVersion,
} from '../../../data/insumoLotes';
import { getCurrentTimeString } from '../../../utils/timer';
import {
  StageHeader,
  Card,
  TimerBanner,
  InputField,
  SelectField,
  Button,
  Badge,
} from '../../../components/ui';

interface PremaduracionStageProps {
  state: AcidificarState;
  onChange: (updater: (prev: AcidificarState) => AcidificarState) => void;
  processTimer: ProcessTimerState;
  onStartProcessTimer: () => void;
  lotesLeche: LotesLeche;
  onUpdateLotesLeche: (updater: (prev: LotesLeche) => LotesLeche) => void;
  loteCuajo?: string;
  onUpdateLoteCuajo?: (val: string) => void;
  loteCuajoPera?: string;
  onUpdateLoteCuajoPera?: (val: string) => void;
  loteSal?: string;
  onUpdateLoteSal?: (val: string) => void;
  responsableProceso?: string;
  onNextStage: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const PremaduracionStage: React.FC<PremaduracionStageProps> = ({
  state,
  onChange,
  processTimer,
  onStartProcessTimer,
  lotesLeche,
  onUpdateLotesLeche,
  loteCuajo,
  onUpdateLoteCuajo,
  loteCuajoPera,
  onUpdateLoteCuajoPera,
  loteSal,
  onUpdateLoteSal,
  responsableProceso = '',
  onNextStage,
  showToast,
}) => {
  // Estado local como string para permitir tipeo totalmente limpio sin ceros residuales ni 75 inicial
  const [litrosInput, setLitrosInput] = useState<string>(() => {
    // Si viene de lote nuevo o con el valor dummy 75 sin iniciar, arranca totalmente vacío ('')
    const rawVal =
      state.insumos.lecheFresca ?? lotesLeche.litrosConfirmados ?? 0;
    if (
      !rawVal ||
      rawVal <= 0 ||
      (rawVal === 75 &&
        !state.insumos.saved &&
        !state.inicioCalentamiento?.iniciado)
    ) {
      return '';
    }
    return String(rawVal);
  });

  const litrosLeche = litrosInput !== '' ? parseFloat(litrosInput) || 0 : 0;

  // Cultivo láctico: dosis base calculada (1 cucharada por cada 40 L)
  const cultivoCalculadoCucharadas =
    litrosLeche > 0 ? Number((litrosLeche / 40).toFixed(2)) : 0;

  // Cuajo calculado (1.2 g por cada 100 L)
  const cuajoCalculadoGramos =
    litrosLeche > 0 ? Number(((litrosLeche * 1.2) / 100).toFixed(2)) : 0;

  // Selector de lote de leche
  const [loteLecheInput, setLoteLecheInput] = useState<string>(
    lotesLeche.loteLecheFresca ||
      lotesLeche.loteLeche1 ||
      ''
  );

  // Selector de lote de cultivo láctico
  const [loteCultivoInput, setLoteCultivoInput] = useState<string>(
    state.insumos.loteCultivoLacteo ||
      lotesLeche.loteCultivoLacteo ||
      ''
  );

  // Selector de lote de cuajo para Queso Pera
  const [loteCuajoPeraInput, setLoteCuajoPeraInput] = useState<string>(
    loteCuajoPera ||
      lotesLeche.loteCuajoPera ||
      state.insumos.loteCuajoPera ||
      loteCuajo ||
      ''
  );

  const [loteSalInput, setLoteSalInput] = useState<string>(loteSal || '');

  useInsumoLotesVersion();

  const [editModeInsumos, setEditModeInsumos] = useState<boolean>(false);
  const calentamientoIniciado = Boolean(state.inicioCalentamiento?.iniciado);
  const isLocked = calentamientoIniciado && !editModeInsumos;

  const optionsLeche =
    loteLecheInput && !LOTES_LECHE_PROVEEDOR_DEFAULT.includes(loteLecheInput)
      ? [loteLecheInput, ...LOTES_LECHE_PROVEEDOR_DEFAULT]
      : LOTES_LECHE_PROVEEDOR_DEFAULT;

  const optionsCultivo =
    loteCultivoInput && !LOTES_CULTIVO_LACTEO_DEFAULT.includes(loteCultivoInput)
      ? [loteCultivoInput, ...LOTES_CULTIVO_LACTEO_DEFAULT]
      : LOTES_CULTIVO_LACTEO_DEFAULT;

  const optionsCuajo =
    loteCuajoPeraInput && !LOTES_CUAJO_PERA_DEFAULT.includes(loteCuajoPeraInput)
      ? [loteCuajoPeraInput, ...LOTES_CUAJO_PERA_DEFAULT]
      : LOTES_CUAJO_PERA_DEFAULT;

  const optionsSal =
    loteSalInput && !LOTES_SAL_CATALOG.includes(loteSalInput)
      ? [loteSalInput, ...LOTES_SAL_CATALOG]
      : LOTES_SAL_CATALOG;

  const handleSaveInsumos = () => {
    const faltantes: string[] = [];
    if (!loteLecheInput) faltantes.push('lote de leche');
    if (litrosLeche <= 0) faltantes.push('litros de leche fresca');
    if (!loteCultivoInput) faltantes.push('lote de cultivo láctico');
    if (!loteCuajoPeraInput) faltantes.push('lote de cuajo');
    if (!loteSalInput) faltantes.push('lote de sal');

    if (faltantes.length > 0) {
      showToast(`Completa los datos requeridos: ${faltantes.join(', ')}.`, 'warning');
      return;
    }

    setEditModeInsumos(false);
    showToast('✓ Cambios en insumos guardados correctamente.', 'success');
  };

  // Manejador para cambio de litros de leche con placeholder limpio
  const handleUpdateLitros = (litros: number) => {
    const valLitros = Math.max(0, litros);
    const nuevasCucharadas =
      valLitros > 0 ? Number((valLitros / 40).toFixed(2)) : 0;

    onUpdateLotesLeche((prev) => ({
      ...prev,
      litrosLote1: valLitros,
      litrosConfirmados: valLitros,
      cultivoLacteoUnidades: nuevasCucharadas,
    }));

    onChange((prev) => ({
      ...prev,
      insumos: {
        ...prev.insumos,
        lecheFresca: valLitros,
        cultivoLacteoUnidades: nuevasCucharadas,
        litrosConfirmados: valLitros,
        saved: true,
      },
    }));
  };

  // Manejador del input de texto con sanitización para evitar "050"
  const handleLitrosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      setLitrosInput('');
      handleUpdateLitros(0);
      return;
    }
    // Si el usuario escribe después de un 0, remover ceros a la izquierda (ej: "05" -> "5", "050" -> "50")
    const sanitized =
      raw.length > 1 && raw.startsWith('0') && !raw.startsWith('0.')
        ? raw.replace(/^0+/, '')
        : raw;

    setLitrosInput(sanitized);
    const num = parseFloat(sanitized);
    handleUpdateLitros(isNaN(num) ? 0 : num);
  };

  // Manejador para cambio de lote de cuajo Queso Pera
  const handleUpdateLoteCuajoPera = (val: string) => {
    setLoteCuajoPeraInput(val);
    if (onUpdateLoteCuajoPera) {
      onUpdateLoteCuajoPera(val);
    }
    if (onUpdateLoteCuajo) {
      onUpdateLoteCuajo(val);
    }
    onUpdateLotesLeche((p) => ({
      ...p,
      loteCuajoPera: val,
    }));
    onChange((p) => ({
      ...p,
      insumos: {
        ...p.insumos,
        loteCuajoPera: val,
      },
      phase2: {
        ...p.phase2,
        loteCuajo: val,
      },
    }));
  };

  // Botón: Iniciar calentamiento de la leche (Registra hora y arranca cronómetro general simultáneamente)
  const handleIniciarCalentamiento = () => {
    const faltantes: string[] = [];
    if (!loteLecheInput) faltantes.push('lote de leche');
    if (!loteCultivoInput) faltantes.push('lote de cultivo láctico');
    if (!loteCuajoPeraInput) faltantes.push('lote de cuajo');
    if (!loteSalInput) faltantes.push('lote de sal');
    if (faltantes.length > 0) {
      showToast(`Selecciona primero: ${faltantes.join(', ')}.`, 'warning');
      return;
    }
    if (litrosLeche <= 0) {
      showToast(
        'Ingresa los litros de leche fresca en la tina antes de empezar a calentar.',
        'warning'
      );
      return;
    }

    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();

    // Arranca simultáneamente el cronómetro general del lote
    onStartProcessTimer();

    onChange((prev) => ({
      ...prev,
      tempConsigna: 40.0,
      inicioCalentamiento: {
        iniciado: true,
        horaInicio: prev.inicioCalentamiento?.horaInicio || timeStr,
        timestampInicio: prev.inicioCalentamiento?.timestampInicio || nowTs,
      },
      insumos: {
        ...prev.insumos,
        lecheFresca: litrosLeche,
        lecheAcida: 0,
        cultivoLacteoUnidades: cultivoCalculadoCucharadas,
        loteCultivoLacteo: loteCultivoInput,
        loteCuajoPera: loteCuajoPeraInput,
        litrosConfirmados: litrosLeche,
        saved: true,
      },
      phase2: {
        ...prev.phase2,
        loteCuajo: loteCuajoPeraInput,
      },
    }));

    showToast(
      `✓ Calentamiento hacia 40 °C iniciado a las ${timeStr}. Cronómetro general activo.`,
      'success'
    );
  };

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-12">
      {/* CABECERA ESTANDARIZADA */}
      <StageHeader
        stageNumber={1}
        totalStages={5}
        title="Preparar la Leche e Insumos del Día"
        productName="Queso Pera"
        icon="science"
        isCompleted={calentamientoIniciado}
      />

      {/* BANNER DEL CRONÓMETRO GENERAL DEL LOTE */}
      <TimerBanner
        title="Cronómetro General del Lote (Queso Pera)"
        subtitle={
          calentamientoIniciado
            ? `Calentamiento hacia 40 °C iniciado a las ${state.inicioCalentamiento?.horaInicio}`
            : 'Registra los litros y lotes de abajo y presiona "Empezar a Calentar la Leche a 40 °C" para arrancar el reloj del lote.'
        }
        formattedTime={processTimer.formattedTime || '00:00:00'}
        isRunning={processTimer.isRunning}
        isCompleted={calentamientoIniciado}
        statusLabel={
          calentamientoIniciado ? 'Calentando hacia 40 °C' : 'Listo para empezar'
        }
        variant="info"
      />

      {/* =========================================================================
          1. REORGANIZACIÓN VISUAL DE INSUMOS (TARJETA UNIFICADA Y COHERENTE)
      ========================================================================= */}
      <Card
        title="Insumos y Lotes del Día"
        icon="inventory_2"
        badge={`Total en Tina: ${litrosLeche} L`}
        variant="default"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {/* 1.1 LECHE FRESCA (Sin botones rápidos, placeholder limpio) */}
          <div className="flex flex-col justify-between gap-3 p-4 rounded-xl bg-blue-50/60 border border-blue-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-blue-950 flex items-center gap-1.5 uppercase tracking-wide">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  water_drop
                </span>
                Leche Fresca en Tina
              </label>
              <Badge variant="info" size="sm">
                Recepción Planta
              </Badge>
            </div>

            <SelectField
              label="Lote de Leche del Proveedor"
              icon="local_shipping"
              value={loteLecheInput}
              disabled={isLocked}
              options={optionsLeche.map((lt) => ({
                value: lt,
                label: `Lote ${lt}`,
              }))}
              onChange={(e) => {
                const val = e.target.value;
                setLoteLecheInput(val);
                onUpdateLotesLeche((p) => ({
                  ...p,
                  loteLeche1: val,
                  loteLecheFresca: val,
                }));
                showToast(`Lote de leche seleccionado: ${val}`);
              }}
            />

            <InputField
              label="Litros de leche fresca"
              icon="water_drop"
              type="number"
              inputMode="decimal"
              min="0"
              unit="Litros"
              placeholder="Ej: 75"
              value={litrosInput}
              disabled={isLocked}
              onChange={handleLitrosChange}
            />
          </div>

          {/* 1.2 CULTIVO LÁCTICO */}
          <div className="flex flex-col justify-between gap-3 p-4 rounded-xl bg-amber-50/60 border border-amber-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-amber-950 flex items-center gap-1.5 uppercase tracking-wide">
                <span className="material-symbols-outlined text-[18px] text-amber-700">
                  science
                </span>
                Cultivo Láctico (Fermento)
              </label>
              <Badge variant="warning" size="sm">
                1 cda / 40 L
              </Badge>
            </div>

            <SelectField
              label="Lote de Cultivo Láctico"
              icon="science"
              value={loteCultivoInput}
              disabled={isLocked}
              options={optionsCultivo.map((lt) => ({
                value: lt,
                label: `Lote ${lt}`,
              }))}
              onChange={(e) => {
                const val = e.target.value;
                setLoteCultivoInput(val);
                onUpdateLotesLeche((p) => ({
                  ...p,
                  loteCultivoLacteo: val,
                }));
                onChange((p) => ({
                  ...p,
                  insumos: { ...p.insumos, loteCultivoLacteo: val },
                }));
                showToast(`Lote de cultivo seleccionado: ${val}`);
              }}
            />

            <div className="p-3 rounded-lg bg-white/80 border border-amber-200/80 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-amber-900 uppercase">
                Dosis Calculada de Cultivo
              </span>
              <div className="text-base font-black font-mono text-amber-950 mt-1">
                {cultivoCalculadoCucharadas}{' '}
                <span className="text-xs font-semibold text-amber-800">
                  {cultivoCalculadoCucharadas === 1 ? 'cucharada' : 'cucharadas'}
                </span>
              </div>
              <span className="text-[10px] text-gray-500 mt-0.5">
                Para {litrosLeche} L (se adiciona al llegar a 40 °C)
              </span>
            </div>
          </div>

          {/* 1.3 CUAJO PARA QUESO PERA */}
          <div className="flex flex-col justify-between gap-3 p-4 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-[#191c1e] flex items-center gap-1.5 uppercase tracking-wide">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  opacity
                </span>
                Cuajo (Coagulante Pera)
              </label>
              <Badge variant="neutral" size="sm">
                1.2 g / 100 L
              </Badge>
            </div>

            <SelectField
              label="Lote de Cuajo a Utilizar"
              icon="opacity"
              value={loteCuajoPeraInput}
              disabled={isLocked}
              options={optionsCuajo.map((lt) => ({
                value: lt,
                label: `Lote ${lt}`,
              }))}
              onChange={(e) => {
                const val = e.target.value;
                handleUpdateLoteCuajoPera(val);
                showToast(`Lote de cuajo seleccionado: ${val}`);
              }}
            />

            <div className="p-3 rounded-lg bg-white border border-[#D6DEEA] flex flex-col justify-between">
              <span className="text-[11px] font-bold text-gray-700 uppercase">
                Dosis Sugerida de Cuajo
              </span>
              <div className="text-base font-black font-mono text-[#1B4E9B] mt-1">
                {cuajoCalculadoGramos}{' '}
                <span className="text-xs font-semibold text-gray-600">gramos</span>
              </div>
              <span className="text-[10px] text-gray-500 mt-0.5">
                Se adiciona tras los 40 min de reposo del fermento
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 p-4 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-[#191c1e] flex items-center gap-1.5 uppercase tracking-wide">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  grain
                </span>
                Sal (Salmuera)
              </label>
              <Badge variant="neutral" size="sm">
                1 kg / 30 L agua
              </Badge>
            </div>

            <SelectField
              label="Lote de Sal a Utilizar"
              icon="grain"
              value={loteSalInput}
              disabled={isLocked}
              options={optionsSal.map((lt) => ({
                value: lt,
                label: lt,
              }))}
              onChange={(e) => {
                const val = e.target.value;
                setLoteSalInput(val);
                if (onUpdateLoteSal) onUpdateLoteSal(val);
                showToast(`Lote de sal seleccionado: ${val}`);
              }}
            />
          </div>
        </div>

        {/* Casilla de verificación y botón de Guardar cambios */}
        {calentamientoIniciado && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-4 border-t border-[#D6DEEA]">
            <ManualEditToggle
              manual={Boolean(editModeInsumos)}
              onChange={(checked: boolean) => setEditModeInsumos(checked)}
            />

            {editModeInsumos && (
              <Button
                variant="primary"
                size="md"
                icon="save"
                onClick={handleSaveInsumos}
              >
                Guardar cambios
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* =========================================================================
          2. TARJETA INDEPENDIENTE: "Empezar a calentar la leche a 40 °C"
      ========================================================================= */}
      <Card
        title="Empezar a calentar la leche a 40 °C"
        icon="local_fire_department"
        badge={
          calentamientoIniciado
            ? `✓ Calentando desde las ${state.inicioCalentamiento?.horaInicio}`
            : 'Pendiente de inicio'
        }
        variant={calentamientoIniciado ? 'success' : 'warning'}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white border border-[#D6DEEA]">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                calentamientoIniciado
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              <span className="material-symbols-outlined text-[28px]">
                {calentamientoIniciado ? 'thermostat' : 'local_fire_department'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-[#191c1e]">
                  {calentamientoIniciado
                    ? 'Calentamiento en Proceso'
                    : 'Calentador de Tina Apagado'}
                </span>
                {calentamientoIniciado && (
                  <Badge variant="success" size="sm">
                    {processTimer.formattedTime || '00:00:00'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {calentamientoIniciado
                  ? `Hora de inicio registrada: ${state.inicioCalentamiento?.horaInicio}. El cronómetro general del lote está corriendo.`
                  : 'Presiona el botón cuando comiences a calentar para iniciar el registro oficial de tiempos.'}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto shrink-0">
            {!calentamientoIniciado ? (
              <Button
                variant="warning"
                size="lg"
                icon="local_fire_department"
                onClick={handleIniciarCalentamiento}
              >
                Empezar a Calentar la Leche a 40 °C
              </Button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs">
                <span className="material-symbols-outlined text-emerald-700 text-[18px]">
                  check_circle
                </span>
                <span>Calentando hacia 40 °C ({state.inicioCalentamiento?.horaInicio})</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* =========================================================================
          3. TRANSICIÓN Y SIGUIENTE PASO: PREMADURACIÓN Y CUAJAR
      ========================================================================= */}
      <div className="flex flex-col gap-4 p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-[#1B4E9B] block">
              Siguiente Etapa
            </span>
            <h3 className="text-base font-black text-[#191c1e] mt-0.5">
              Premaduración y Cuajado
            </h3>
          </div>
          <Badge variant={calentamientoIniciado ? 'info' : 'neutral'} size="sm">
            {calentamientoIniciado ? 'Listo para avanzar' : 'Esperando inicio'}
          </Badge>
        </div>

        {/* Texto explicativo claro y coloquial */}
        <p className="text-xs text-gray-700 leading-relaxed">
          {calentamientoIniciado
            ? 'Ahora que ya has iniciado a calentar la leche, pasamos a la premaduración y cuajado. En la siguiente pantalla podrás confirmar el momento exacto en que la leche llegue a 40 °C, agregar el cultivo láctico, dejar reposar los 40 minutos reglamentarios y finalmente adicionar el cuajo hasta alcanzar el pH objetivo de 5.80.'
            : 'Una vez que pulses "Empezar a Calentar la Leche a 40 °C", pasaremos a la premaduración y cuajado, donde controlarás la temperatura, el fermento y el reposo de la cuajada.'}
        </p>

        {/* Campos de resumen de la etapa para trazabilidad */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA] text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500 block">
              Leche en Tina
            </span>
            <span className="font-black text-[#1B4E9B] font-mono">
              {litrosLeche} L
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500 block">
              Lote Leche
            </span>
            <span className="font-bold text-gray-800 font-mono">
              {loteLecheInput}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500 block">
              Cultivo Láctico
            </span>
            <span className="font-bold text-amber-900 font-mono">
              {loteCultivoInput} ({cultivoCalculadoCucharadas} cdas)
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500 block">
              Cuajo Pera
            </span>
            <span className="font-bold text-blue-900 font-mono">
              {loteCuajoPeraInput} ({cuajoCalculadoGramos} g)
            </span>
          </div>
        </div>

        {/* Botón hacia la etapa de Premaduración y Cuajar */}
        <div className="flex justify-end pt-1">
          <Button
            variant="primary"
            size="xl"
            iconRight="arrow_forward"
            disabled={!calentamientoIniciado || litrosLeche <= 0}
            onClick={() => {
              if (!calentamientoIniciado) {
                showToast(
                  'Debes presionar "Empezar a Calentar la Leche a 40 °C" antes de pasar a la siguiente etapa.',
                  'warning'
                );
                return;
              }
              if (litrosLeche <= 0) {
                showToast('Ingresa los litros de leche fresca antes de continuar.', 'warning');
                return;
              }
              onNextStage();
            }}
          >
            Pasar a Premaduración y Cuajar
          </Button>
        </div>
      </div>
    </div>
  );
};
