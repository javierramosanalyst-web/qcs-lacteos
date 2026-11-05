import React, { useEffect, useState, useMemo } from 'react';
import {
  StageHeader,
  Card,
  InputField,
  SelectField,
  TimerBanner,
  PopoverTimePicker,
  Button,
  Badge,
} from '../../../components/ui';
import { ProcessTimerState } from '../../../types';
import { insumoOptions, saborOptions } from '../../../data/insumoLotes';
import { BatidoYAdicionesYogurState, SaborYogurReceta } from '../../../types/yogur';
import { BatidoYAdicionesKumisState } from '../../../types/kumis';
import {
  computeDurationBetweenTimes,
  getCurrentTimeString,
} from '../../../utils/timer';
import { useStageCountdown } from '../../../hooks/useStageCountdown';

export interface BatidoYSaboresStageCommonProps {
  productType: 'yogur' | 'kumis';
  state: BatidoYAdicionesYogurState | BatidoYAdicionesKumisState;
  onChange: (
    updater: (
      prev: BatidoYAdicionesYogurState | BatidoYAdicionesKumisState
    ) => BatidoYAdicionesYogurState | BatidoYAdicionesKumisState
  ) => void;
  llevaAzucar?: boolean;
  litrosLecheBase?: number;
  processTimer: ProcessTimerState;
  onNextStage?: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

const conActual = (opts: { value: string; label: string }[], val: string) =>
  val && !opts.some((o) => o.value === val) ? [{ value: val, label: val }, ...opts] : opts;


const nuevoSabor = (): SaborYogurReceta => ({
  id: `sabor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  sabor: '',
  saborizanteMl: '',
  loteSaborizante: '',
  coloranteMl: '',
  loteColorante: '',
});

// Lotes de Stevia: vienen de la base de datos (Admin > Insumos, tipo 'estevia').

export const BatidoYSaboresStageCommon: React.FC<BatidoYSaboresStageCommonProps> = ({
  productType,
  state,
  onChange,
  llevaAzucar = true,
  litrosLecheBase = 100,
  onNextStage,
  showToast,
}) => {
  const isYogur = productType === 'yogur';

  // =========================================================================
  // ESTADOS DEL PASO 01: PREPARACIÓN DE LA RECETA (COLOR Y SABOR)
  // =========================================================================
  const [sabores, setSabores] = useState<SaborYogurReceta[]>(() => {
    const guardados = (state.adiciones as any)?.sabores;
    if (Array.isArray(guardados) && guardados.length > 0) return guardados;
    const v = (state.adiciones as any)?.variedadAzucar || {};
    const saborPrevio = v.sabor || (state.adiciones as any)?.sabor;
    if ((state.adiciones as any)?.recetaConfirmada && saborPrevio) {
      return [
        {
          id: 'sabor-previo',
          sabor: saborPrevio,
          saborizanteMl: v.saborizanteMl ?? '',
          loteSaborizante: v.loteSaborizante || '',
          coloranteMl: v.coloranteMl ?? '',
          loteColorante: v.loteColorante || '',
        },
      ];
    }
    return [nuevoSabor()];
  });

  const isRecetaConfirmada = Boolean(
    (state.adiciones as any)?.recetaConfirmada || state.adiciones?.registrado
  );

  // =========================================================================
  // ESTADOS DEL PASO 01 (ALTERNATIVO): ADICIÓN DE STEVIA (SI NO LLEVA AZÚCAR)
  // =========================================================================
  const variedadEsteviaState = (state.adiciones as any)?.variedadEstevia || {};

  const isSteviaConfirmada = Boolean(
    (state.adiciones as any)?.steviaConfirmada ||
      Boolean((state.adiciones as any)?.horaAdicionStevia)
  );

  // Insumo limpio: inicia vacío sin ceros si no ha sido confirmada la adición
  const [cantidadStevia, setCantidadStevia] = useState<number | ''>(() => {
    if (
      (state.adiciones as any)?.steviaConfirmada ||
      (state.adiciones as any)?.horaAdicionStevia
    ) {
      return (
        (state.adiciones as any)?.gramosStevia ||
        variedadEsteviaState.gramosEstevia ||
        ''
      );
    }
    return '';
  });

  const [loteStevia, setLoteStevia] = useState<string>(
    (state.adiciones as any)?.loteStevia ||
      variedadEsteviaState.loteEstevia ||
      ''
  );

  const [manualPaso1Stevia, setManualPaso1Stevia] = useState<boolean>(
    Boolean((state.adiciones as any)?.esManualStevia)
  );

  const [horaManualStevia, setHoraManualStevia] = useState<string>(
    (state.adiciones as any)?.horaAdicionStevia ||
      variedadEsteviaState.horaAdicion ||
      getCurrentTimeString()
  );

  const horaSteviaDisplay =
    (state.adiciones as any)?.horaAdicionStevia ||
    variedadEsteviaState.horaAdicion ||
    (state.adiciones as any)?.horaPreparacionReceta ||
    state.adiciones?.horaRegistro;

  useEffect(() => {
    if (!manualPaso1Stevia) {
      if ((state.adiciones as any)?.horaAdicionStevia) {
        setHoraManualStevia((state.adiciones as any).horaAdicionStevia);
      }
    }
  }, [manualPaso1Stevia, state.adiciones]);

  // Indicador unificado: ¿El paso 1 (Receta o Stevia) está confirmado?
  const isPaso1Listo = llevaAzucar ? isRecetaConfirmada : isSteviaConfirmada;

  const handleAgregarSabor = () => {
    setSabores((prev) => [...prev, nuevoSabor()]);
  };

  const handleQuitarSabor = (id: string) => {
    setSabores((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  };

  const handleCambioSabor = (id: string, cambios: Partial<SaborYogurReceta>) => {
    setSabores((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)));
  };

  const handleConfirmReceta = () => {
    const incompleto = sabores.find((s) => !s.sabor);
    if (incompleto) {
      showToast('Selecciona el sabor en todas las filas o quita las que no uses.', 'warning');
      return;
    }
    const nombres = sabores.map((s) => s.sabor);
    if (new Set(nombres).size !== nombres.length) {
      showToast('Hay sabores repetidos. Quita el duplicado.', 'warning');
      return;
    }
    const sinInsumos = sabores.find(
      (s) =>
        (!(Number(s.saborizanteMl) > 0) || !s.loteSaborizante.trim())
    );
    if (sinInsumos) {
      showToast(`Registra cantidad y lote de saborizante para ${sinInsumos.sabor}.`, 'warning');
      return;
    }
    const sinLoteColor = sabores.find((s) => Number(s.coloranteMl) > 0 && !s.loteColorante.trim());
    if (sinLoteColor) {
      showToast(`Registra el lote del colorante de ${sinLoteColor.sabor}.`, 'warning');
      return;
    }

    const timeStr = getCurrentTimeString();
    const limpios = sabores.map((s) => ({
      ...s,
      saborizanteMl: s.saborizanteMl === '' ? 0 : Number(s.saborizanteMl),
      coloranteMl: s.coloranteMl === '' ? 0 : Number(s.coloranteMl),
      loteSaborizante: s.loteSaborizante.trim(),
      loteColorante: s.loteColorante.trim(),
    }));
    const totalSab = limpios.reduce((acc, s) => acc + Number(s.saborizanteMl), 0);
    const totalCol = limpios.reduce((acc, s) => acc + Number(s.coloranteMl), 0);
    const lotesSab = Array.from(new Set(limpios.map((s) => s.loteSaborizante).filter(Boolean))).join(', ');
    const lotesCol = Array.from(new Set(limpios.map((s) => s.loteColorante).filter(Boolean))).join(', ');

    onChange((prev: any) => {
      const existentes: any[] = prev.lotesSabor || [];
      const lotes = limpios.map((s) => {
        const previo = existentes.find((l) => l.id === s.id);
        return previo
          ? { ...previo, sabor: s.sabor }
          : {
              id: s.id,
              sabor: s.sabor,
              batidoInicio: null,
              batidoFin: null,
              envasadoInicio: null,
              envasadoFin: null,
              tiempoBatido: null,
              tiempoEnvasado: null,
              tiempoTotal: null,
            };
      });
      return {
        ...prev,
        lotesSabor: lotes,
        adiciones: {
          ...prev.adiciones,
          sabores: limpios,
          recetaConfirmada: true,
          registrado: true,
          horaRegistro: timeStr,
          horaPreparacionReceta: timeStr,
          sabor: nombres.join(', '),
          saborizanteMl: totalSab,
          loteSaborizante: lotesSab,
          coloranteMl: totalCol,
          loteColorante: lotesCol,
          variedadAzucar: {
            ...(prev.adiciones?.variedadAzucar || {}),
            sabor: nombres.join(', '),
            saborizanteMl: totalSab,
            loteSaborizante: lotesSab,
            coloranteMl: totalCol,
            loteColorante: lotesCol,
          },
        },
      };
    });

    showToast(`✓ ¡La receta está lista! ${limpios.length} sabor(es) registrados a las ${timeStr}.`, 'success');
  };

  const handleEditarReceta = () => {
    const enCurso = ((state as any).lotesSabor || []).some((l: any) => l.batidoInicio);
    if (enCurso) {
      showToast('No se puede editar la receta: ya se inició el batido de un sabor.', 'warning');
      return;
    }
    onChange((prev: any) => ({
      ...prev,
      adiciones: { ...prev.adiciones, recetaConfirmada: false, registrado: false },
    }));
  };

  // =========================================================================
  // MANEJADORES PASO 01 (ALTERNATIVO): ADICIÓN DE STEVIA
  // =========================================================================
  const handleConfirmStevia = () => {
    if (!loteStevia.trim()) {
      showToast('Selecciona el lote de Stevia antes de confirmar.', 'warning');
      return;
    }
    const timeStr = getCurrentTimeString();
    const numStevia = cantidadStevia === '' ? 0 : Number(cantidadStevia);

    onChange((prev: any) => ({
      ...prev,
      adiciones: {
        ...prev.adiciones,
        tipoYogur: 'con_estevia',
        steviaConfirmada: true,
        registrado: true,
        horaRegistro: timeStr,
        horaAdicionStevia: timeStr,
        horaPreparacionReceta: timeStr,
        gramosStevia: numStevia,
        loteStevia: loteStevia,
        variedadEstevia: {
          ...(prev.adiciones?.variedadEstevia || {}),
          litrosBase: litrosLecheBase,
          gramosEstevia: numStevia,
          loteEstevia: loteStevia,
          registrado: true,
          horaAdicion: timeStr,
        },
      },
    }));

    showToast(
      `✓ ¡Ya agregué la stevia! Registrada a las ${timeStr} (${numStevia} g, Lote: ${loteStevia}). Paso de batido habilitado.`,
      'success'
    );
  };

  const handleSaveManualStevia = () => {
    onChange((prev: any) => ({
      ...prev,
      adiciones: {
        ...prev.adiciones,
        steviaConfirmada: true,
        registrado: true,
        horaRegistro: horaManualStevia,
        horaAdicionStevia: horaManualStevia,
        horaPreparacionReceta: horaManualStevia,
        esManualStevia: true,
        habilitarModificacionManual: true,
        variedadEstevia: {
          ...(prev.adiciones?.variedadEstevia || {}),
          loteEstevia: loteStevia,
          horaAdicion: horaManualStevia,
        },
      },
    }));

    showToast(
      `✓ Hora de adición de stevia actualizada a ${horaManualStevia}.`,
      'success'
    );
  };

  const horaRecetaDisplay =
    (state.adiciones as any)?.horaPreparacionReceta || state.adiciones?.horaRegistro;

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-5 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-14">
      {/* CABECERA ESTÁNDAR MAESTRA */}
      <StageHeader
        stageNumber={3}
        totalStages={5}
        lineName={isYogur ? 'Línea de Fermentados · Yogur' : 'Línea de Fermentados · Kumis'}
        title="3. Receta y Sabores"
        subtitle={
          llevaAzucar
            ? 'Formulación de la receta (color y sabor) y batido suave controlado para lograr la textura homogénea y cremosa.'
            : 'Adición de stevia edulcorante y batido suave controlado para lograr la textura homogénea y cremosa.'
        }
        standardBadge="NTC-805"
        metrics={[
          {
            icon: 'water_drop',
            label: 'Volumen del Lote',
            value: `${litrosLecheBase} L`,
            tone: 'emerald',
          },
          {
            icon: llevaAzucar ? 'menu_book' : 'eco',
            label: llevaAzucar ? 'Receta' : 'Stevia',
            value: isPaso1Listo
              ? llevaAzucar
                ? 'Receta Lista ✓'
                : 'Stevia Lista ✓'
              : llevaAzucar
              ? 'Por Definir'
              : 'Por Agregar',
            tone: isPaso1Listo ? 'emerald' : 'amber',
          },
          {
            icon: 'blender',
            label: 'Sabores',
            value: llevaAzucar ? `${sabores.length} por producir` : 'Sin azúcar',
            tone: 'default',
          },
        ]}
      />

      {/* ========================================================================= */}
      {/* PASO 01 CONDICIONAL: CON AZÚCAR (RECETA) vs SIN AZÚCAR (STEVIA)           */}
      {/* ========================================================================= */}
      {llevaAzucar ? (
        <Card
          stepBadge="Paso 01"
          title="Preparación de la Receta (Color y Sabor)"
          subtitle="Agrega todos los sabores que se producirán en este lote, con su saborizante y colorante, y confirma la receta."
          icon="menu_book"
          tone={isRecetaConfirmada ? 'completed' : 'active'}
          statusBadge={
            isRecetaConfirmada
              ? {
                  label: `Receta Lista (${horaRecetaDisplay || 'Confirmada'}) · ${sabores.length} sabor(es)`,
                  variant: 'success',
                }
              : { label: `${sabores.length} sabor(es) por definir`, variant: 'warning' }
          }
          headerAction={
            <div className="flex flex-wrap items-center gap-3">
              {isRecetaConfirmada && (
                <Button variant="outline" size="md" icon="edit" onClick={handleEditarReceta} className="font-bold">
                  Editar
                </Button>
              )}
              <Button
                variant={isRecetaConfirmada ? 'success' : 'primary'}
                size="md"
                icon={isRecetaConfirmada ? 'lock' : 'check_circle'}
                onClick={handleConfirmReceta}
                disabled={isRecetaConfirmada}
                className="font-bold shadow-sm"
              >
                {isRecetaConfirmada ? `Receta lista (${horaRecetaDisplay || 'OK'})` : '¡La receta está lista!'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {sabores.map((s, idx) => (
              <div
                key={s.id}
                className={`p-4 rounded-2xl border-2 flex flex-col gap-3 ${
                  isRecetaConfirmada ? 'bg-emerald-50/50 border-emerald-200' : 'bg-[#F7F9FC] border-[#D6DEEA]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#143A73]">
                    Sabor {idx + 1}
                  </span>
                  {!isRecetaConfirmada && sabores.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon="delete"
                      onClick={() => handleQuitarSabor(s.id)}
                      className="font-bold text-red-700 border-red-300 hover:bg-red-50"
                    >
                      Quitar
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#4A5263] block mb-1">
                      Sabor
                    </label>
                    <select
                      value={s.sabor}
                      disabled={isRecetaConfirmada}
                      onChange={(e) => handleCambioSabor(s.id, { sabor: e.target.value })}
                      className="w-full bg-white px-3 py-2.5 rounded-xl border border-[#D6DEEA] font-bold text-sm text-[#191C1E] outline-none shadow-2xs disabled:opacity-70"
                    >
                      <option value="">Selecciona sabor</option>
                      {conActual(saborOptions(), s.sabor).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <InputField
                    label="Cantidad de Saborizante (ml)"
                    type="number"
                    unit="ml"
                    placeholder="Ej: 800"
                    disabled={isRecetaConfirmada}
                    value={s.saborizanteMl}
                    onChange={(e) =>
                      handleCambioSabor(s.id, {
                        saborizanteMl: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                  />
                  <SelectField
                    label="Lote de Saborizante"
                    icon="qr_code"
                    options={conActual(insumoOptions('saborizante'), s.loteSaborizante)}
                    disabled={isRecetaConfirmada}
                    value={s.loteSaborizante}
                    onChange={(e) => handleCambioSabor(s.id, { loteSaborizante: e.target.value })}
                  />
                  <InputField
                    label="Cantidad de Colorante (ml)"
                    type="number"
                    unit="ml"
                    placeholder="Ej: 50"
                    disabled={isRecetaConfirmada}
                    value={s.coloranteMl}
                    onChange={(e) =>
                      handleCambioSabor(s.id, {
                        coloranteMl: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                  />
                  <SelectField
                    label="Lote de Colorante"
                    icon="qr_code"
                    options={conActual(insumoOptions('colorante'), s.loteColorante)}
                    disabled={isRecetaConfirmada}
                    value={s.loteColorante}
                    onChange={(e) => handleCambioSabor(s.id, { loteColorante: e.target.value })}
                  />
                </div>
              </div>
            ))}
            {!isRecetaConfirmada && (
              <Button variant="outline" size="md" icon="add" onClick={handleAgregarSabor} className="font-bold">
                Agregar sabor
              </Button>
            )}
          </div>
        </Card>
      ) : (
        /* PASO 01 ALTERNATIVO (SIN AZÚCAR): ¡ADICIÓN DE STEVIA! */
        <Card
          stepBadge="Paso 01"
          title="¡Adición de Stevia!"
          subtitle="Dosifica la cantidad exacta de stevia según la formulación del lote para endulzar el producto sin azúcar."
          icon="eco"
          tone={isSteviaConfirmada ? 'completed' : 'active'}
          statusBadge={
            isSteviaConfirmada
              ? {
                  label: `Stevia Agregada (${horaSteviaDisplay || 'Confirmada'}) ✓`,
                  variant: 'success',
                }
              : { label: 'Por Agregar', variant: 'warning' }
          }
          headerAction={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[#4A5263] bg-[#F2F4F7] px-3 py-1.5 rounded-lg border border-[#D6DEEA] hover:bg-[#E6ECF5] transition-colors">
                <input
                  type="checkbox"
                  checked={manualPaso1Stevia}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setManualPaso1Stevia(checked);
                    onChange((p: any) => ({
                      ...p,
                      adiciones: { ...p.adiciones, esManualStevia: checked },
                    }));
                  }}
                  className="rounded border-[#C5D0E0] text-[#191C1E] focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <span>Habilitar edición manual</span>
              </label>

              {/* Botón de confirmación tipo "¡Ya agregué la stevia!" */}
              <Button
                variant={isSteviaConfirmada ? 'secondary' : 'primary'}
                size="md"
                icon="check_circle"
                onClick={handleConfirmStevia}
                className={
                  isSteviaConfirmada
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                    : 'font-bold shadow-sm'
                }
              >
                {isSteviaConfirmada
                  ? `✓ ¡Ya agregué la stevia! (${horaSteviaDisplay || 'OK'})`
                  : '¡Ya agregué la stevia!'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Insumo 1: Cantidad de Stevia (g) */}
              <InputField
                label="Cantidad de Stevia (g)"
                type="number"
                unit="g"
                placeholder="Ej: 80"
                value={cantidadStevia === '' ? '' : cantidadStevia}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setCantidadStevia(val);
                }}
                hint={`Dosificación sugerida: ${(litrosLecheBase * 0.8).toFixed(0)} g para ${litrosLecheBase} L`}
              />

              {/* Insumo 2: Lote de Stevia (Selector desplegable) */}
              <SelectField
                label="Lote de Stevia"
                icon="eco"
                options={conActual(insumoOptions('estevia'), loteStevia)}
                value={loteStevia}
                onChange={(e) => setLoteStevia(e.target.value)}
                hint="Selecciona el lote del insumo edulcorante"
              />

              {/* Resumen / Estado de Adición */}
              <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex flex-col justify-between">
                <span className="text-[11px] uppercase font-bold text-[#4A5263]">
                  Hora de Adición
                </span>
                <div className="text-xl font-black font-mono text-[#191C1E] mt-1">
                  {horaSteviaDisplay || '--:--:--'}
                </div>
                <span className="text-[11px] text-[#6B7280] mt-1 block">
                  {isSteviaConfirmada
                    ? 'Registrada al pulsar confirmación'
                    : 'Pendiente de registrar'}
                </span>
              </div>
            </div>

            {/* Edición manual de hora de adición con PopoverTimePicker */}
            {manualPaso1Stevia && (
              <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col sm:flex-row items-end gap-3 justify-between">
                <div className="w-full sm:max-w-xs">
                  <PopoverTimePicker
                    label="Hora en que se agregó la stevia"
                    icon="schedule"
                    hint="Toca para desplegar selector flotante (hh:mm:ss a)"
                    value={horaManualStevia}
                    onChange={setHoraManualStevia}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualStevia}
                  className="w-full sm:w-auto font-bold"
                >
                  Guardar Hora de Stevia
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs sm:text-sm text-[#434655]">
          Cuando la receta de sabores esté lista, avanza a{' '}
          <strong className="text-[#191C1E]">4. Batido y Envasado</strong>.
        </div>
        {onNextStage && (
          <Button
            variant="primary"
            size="lg"
            iconRight="arrow_forward"
            disabled={!isPaso1Listo}
            onClick={onNextStage}
            className="w-full sm:w-auto font-bold shadow-md"
          >
            Pasar a Batido y Envasado
          </Button>
        )}
      </div>
    </div>
  );
};
