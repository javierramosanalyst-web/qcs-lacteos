import React, { useState } from 'react';
import { BatidoEnvasadoYogurStage } from '../yogur/BatidoEnvasadoYogurStage';
import { ManualEditToggle } from '../../../components/ui/ManualEditToggle';
import { BatidoYAdicionesYogurGriegoState } from '../../../types/yogur_griego';
import { ProcessTimerState } from '../../../types';
import {
  formatTimeFromStep1,
  getCurrentTimeString,
} from '../../../utils/timer';
import { insumoOptions, useInsumoLotesVersion } from '../../../data/insumoLotes';
import {
  Card,
  InputField,
  SelectField,
  Button,
  PopoverTimePicker,
} from '../../../components/ui';

interface BatidoYAdicionesStageGriegoProps {
  state: BatidoYAdicionesYogurGriegoState;
  onChange: (
    updater: (
      prev: BatidoYAdicionesYogurGriegoState
    ) => BatidoYAdicionesYogurGriegoState
  ) => void;
  litrosLecheBase?: number;
  processTimer: ProcessTimerState;
  onNextStage: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

// Lotes de Stevia: vienen de la base de datos (Admin > Insumos, tipo 'estevia').
// Conserva el lote ya registrado aunque hoy no esté activo en Insumos.
const conLoteActual = (opts: { value: string; label: string }[], val: string) =>
  val && !opts.some((o) => o.value === val) ? [{ value: val, label: val }, ...opts] : opts;

export const BatidoYAdicionesStageGriego: React.FC<
  BatidoYAdicionesStageGriegoProps
> = ({ state, onChange, litrosLecheBase, onNextStage, showToast }) => {
  const { formulacion } = state;
  useInsumoLotesVersion();

  // Estado Paso 1: Insumo Stevia
  const [cantidadSteviaInput, setCantidadSteviaInput] = useState<string>(
    formulacion.variedadConEstevia?.gramosEstevia
      ? String(formulacion.variedadConEstevia.gramosEstevia)
      : ''
  );
  const [loteSteviaSelected, setLoteSteviaSelected] = useState<string>(
    formulacion.variedadConEstevia?.loteEstevia || ''
  );
  const [manualStevia, setManualStevia] = useState<boolean>(false);
  const [horaManualStevia, setHoraManualStevia] = useState<string>(
    formulacion.variedadConEstevia?.horaAdicion || getCurrentTimeString()
  );


  const isSteviaConfirmada = Boolean(
    formulacion.variedadConEstevia?.confirmado ||
      (formulacion.registrado && formulacion.variedadConEstevia?.gramosEstevia > 0)
  );

  // --- Handlers Paso 1: Stevia ---
  const handleConfirmarStevia = () => {
    const numGramos = Number(cantidadSteviaInput);
    if (!cantidadSteviaInput || numGramos <= 0) {
      showToast('⚠️ Ingresa la cantidad de Stevia en gramos.', 'warning');
      return;
    }
    if (!loteSteviaSelected.trim()) {
      showToast('⚠️ Selecciona el lote de Stevia.', 'warning');
      return;
    }

    const timeStr = manualStevia
      ? formatTimeFromStep1(horaManualStevia)
      : getCurrentTimeString();

    onChange((prev) => ({
      ...prev,
      formulacion: {
        ...prev.formulacion,
        tipo: 'con_stevia',
        llevaStevia: true,
        registrado: true,
        horaRegistro: timeStr,
        variedadConEstevia: {
          ...prev.formulacion.variedadConEstevia,
          gramosEstevia: numGramos,
          loteEstevia: loteSteviaSelected,
          horaAdicion: timeStr,
          confirmado: true,
        },
      },
    }));

    setHoraManualStevia(timeStr);
    showToast(
      `✓ Adición de Stevia confirmada (${numGramos} g · Lote ${loteSteviaSelected}) a las ${timeStr}.`,
      'success'
    );
  };

  const handleSaveManualSteviaTime = () => {
    const timeFmt = formatTimeFromStep1(horaManualStevia);
    onChange((prev) => ({
      ...prev,
      formulacion: {
        ...prev.formulacion,
        variedadConEstevia: {
          ...prev.formulacion.variedadConEstevia,
          horaAdicion: timeFmt,
        },
      },
    }));
    setManualStevia(false);
    showToast(`✓ Hora de adición de Stevia actualizada a ${timeFmt}.`, 'success');
  };

  const steviaCard = (
    <Card
      stepBadge="Paso 01"
      title="Registro de Insumo Stevia"
      subtitle="Registra el lote y la cantidad exacta de Stevia en polvo a incorporar en la masa concentrada de Yogur Griego."
      icon="tune"
      tone={isSteviaConfirmada ? 'completed' : 'active'}
      statusBadge={
        isSteviaConfirmada
          ? {
              label: `Stevia Confirmada (${formulacion.variedadConEstevia.gramosEstevia} g) ✓`,
              variant: 'success',
            }
          : { label: 'Pendiente de Registro', variant: 'warning' }
      }
      headerAction={
        <div className="flex items-center gap-3">
          <ManualEditToggle manual={Boolean(manualStevia)} onChange={(checked: boolean) => setManualStevia(checked)} />

          <Button
            variant={isSteviaConfirmada ? 'secondary' : 'primary'}
            size="md"
            icon={isSteviaConfirmada ? 'check_circle' : 'add'}
            onClick={handleConfirmarStevia}
            className={
              isSteviaConfirmada
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-bold'
                : 'font-bold shadow-sm'
            }
          >
            {isSteviaConfirmada
              ? `✓ ¡Ya agregué la stevia! (${formulacion.variedadConEstevia.gramosEstevia} g)`
              : '¡Ya agregué la stevia!'}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Selector de Lote de Stevia */}
        <SelectField
          label="Lote de Stevia"
          icon="label"
          options={conLoteActual(insumoOptions('estevia'), loteSteviaSelected)}
          value={loteSteviaSelected}
          onChange={(e) => setLoteSteviaSelected(e.target.value)}
          disabled={isSteviaConfirmada && !manualStevia}
          hint="Selecciona el lote de stevia recibido de bodega"
        />

        {/* Campo Limpio de Cantidad en Gramos */}
        <InputField
          label="Cantidad de Stevia"
          type="number"
          min="0.1"
          step="0.1"
          unit="gramos"
          icon="scale"
          placeholder="Ej: 15"
          showZero={false}
          value={cantidadSteviaInput}
          onChange={(e) => setCantidadSteviaInput(e.target.value)}
          disabled={isSteviaConfirmada && !manualStevia}
          hint="Dosis estándar recomendada: 12 a 18 g"
        />

        {/* Hora de Adición / Selector Manual */}
        {!manualStevia ? (
          <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex flex-col justify-between">
            <span className="text-[11px] uppercase font-bold text-[#4A5263]">
              Hora de Adición
            </span>
            <div className="text-xl font-black font-mono text-[#191C1E] mt-1">
              {formulacion.variedadConEstevia?.horaAdicion || '--:--:--'}
            </div>
            <span className="text-[11px] text-[#6B7280] mt-1 block">
              {isSteviaConfirmada
                ? 'Registrada al confirmar adición'
                : 'Pendiente de registrar'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 justify-between">
            <PopoverTimePicker
              label="Hora de Adición Manual"
              icon="schedule"
              value={horaManualStevia}
              onChange={setHoraManualStevia}
            />
            <Button
              variant="secondary"
              size="sm"
              icon="save"
              onClick={handleSaveManualSteviaTime}
              className="w-full text-xs font-semibold"
            >
              Guardar Hora
            </Button>
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <BatidoEnvasadoYogurStage
      state={state}
      onChange={onChange}
      litrosLecheBase={litrosLecheBase}
      onNextStage={onNextStage}
      showToast={showToast}
      lineName="Línea de Fermentados · Yogur Griego"
      timerKey="batido"
      mostrarSalida={false}
      generarLotes={false}
      bloqueo={isSteviaConfirmada ? null : 'Primero registra la adición de Stevia (Paso 01) para iniciar el batido y envasado.'}
      antes={steviaCard}
      nextLabel="5. Guardar"
    />
  );
};
