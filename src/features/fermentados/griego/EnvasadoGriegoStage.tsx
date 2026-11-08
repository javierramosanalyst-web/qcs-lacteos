import React from 'react';
import {
  EnvasadoYAlmacenamientoYogurGriegoState,
  YogurGriegoBatchData,
} from '../../../types/yogur_griego';
import {
  StageHeader,
  Card,
  InputField,
  Button,
  Badge,
} from '../../../components/ui';

interface EnvasadoGriegoStageProps {
  batch: YogurGriegoBatchData;
  onChange: (
    updater: (
      prev: EnvasadoYAlmacenamientoYogurGriegoState
    ) => EnvasadoYAlmacenamientoYogurGriegoState
  ) => void;
  onFinalizeProcess: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const EnvasadoGriegoStage: React.FC<EnvasadoGriegoStageProps> = ({
  batch,
  onChange: onChangeSaved,
  onOpenReviewModal,
  showToast,
}) => {
  const state = batch.envasado;
  const onChange: typeof onChangeSaved = (updater) =>
    onChangeSaved((prev) => ({
      ...updater(prev),
      conteoConfirmado: false,
    }));
  const lecheInicialL = batch.pasteurizacion.litrosLeche ?? 0;

  // Categoría 1: Sin Azúcar (Natural) - 1000 g, 500 g, 120 g
  const sinEstevia1000g =
    state.formatosSinEstevia?.tarro1L ||
    state.formatosSinEstevia?.tarrina1000g ||
    0;
  const sinEstevia500g =
    state.formatosSinEstevia?.tarro500ml ||
    state.formatosSinEstevia?.tarrina500g ||
    0;
  const sinEstevia120g =
    state.formatosSinEstevia?.vasito120ml ||
    state.formatosSinEstevia?.tarrina120g ||
    0;
  const sinEsteviaBolsa4L = state.formatosSinEstevia?.bolsa4L || 0;
  const kgSinEstevia = Number(
    (
      sinEstevia1000g * 1.0 +
      sinEstevia500g * 0.5 +
      sinEstevia120g * 0.12 +
      sinEsteviaBolsa4L * 4.0
    ).toFixed(2)
  );
  const undsSinEstevia =
    sinEstevia1000g + sinEstevia500g + sinEstevia120g + sinEsteviaBolsa4L;

  // Categoría 2: Con Stevia - 1000 g, 500 g, 120 g
  const conEstevia1000g =
    state.formatosConEstevia?.tarro1L ||
    state.formatosConEstevia?.tarrina1000g ||
    0;
  const conEstevia500g =
    state.formatosConEstevia?.tarro500ml ||
    state.formatosConEstevia?.tarrina500g ||
    0;
  const conEstevia120g =
    state.formatosConEstevia?.vasito120ml ||
    state.formatosConEstevia?.tarrina120g ||
    0;
  const conEsteviaBolsa4L = state.formatosConEstevia?.bolsa4L || 0;
  const kgConEstevia = Number(
    (
      conEstevia1000g * 1.0 +
      conEstevia500g * 0.5 +
      conEstevia120g * 0.12 +
      conEsteviaBolsa4L * 4.0
    ).toFixed(2)
  );
  const undsConEstevia =
    conEstevia1000g + conEstevia500g + conEstevia120g + conEsteviaBolsa4L;

  // Totales
  const totalUnidades = undsSinEstevia + undsConEstevia;
  const totalKgEnvasados = Number(
    (kgSinEstevia + kgConEstevia).toFixed(2)
  );
  const rendimientoLacteoPct =
    lecheInicialL > 0
      ? Number(((totalKgEnvasados / lecheInicialL) * 100).toFixed(1))
      : 0;

  const handleGuardarConteo = () => {
    onChangeSaved((prev) => ({
      ...prev,
      conteoConfirmado: true,
      esManualConteo: false,
    }));
    showToast(
      `✓ Conteo de envases guardado (${totalKgEnvasados} kg en ${totalUnidades} unidades).`,
      'success'
    );
  };

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-5 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-16">
      {/* CABECERA ESTÁNDAR MAESTRA */}
      <StageHeader
        stageNumber={5}
        totalStages={5}
        lineName="Línea de Fermentados · Yogur Griego"
        title="5. Guardar"
        subtitle="Conteo directo de envases en gramos para Griego Natural y Griego con Stevia (120 g, 500 g, 1000 g), balance de materia y rendimiento."
        standardBadge="NTC-805"
        metrics={[
          {
            icon: 'inventory_2',
            label: 'Total Envasado',
            value: `${totalKgEnvasados} kg (${totalUnidades} u.)`,
            tone: totalUnidades > 0 ? 'emerald' : 'default',
          },
          {
            icon: 'trending_up',
            label: 'Rendimiento s/ Leche',
            value: `${rendimientoLacteoPct} %`,
            tone: rendimientoLacteoPct > 0 ? 'emerald' : 'default',
          },
        ]}
      />

      {/* ========================================================================= */}
      {/* CONTEO DE TARRINAS / VASOS (DIRECTAMENTE ACTIVA CON 2 BLOQUES)             */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Etapa 5"
        title="Conteo de Tarrinas / Vasos"
        subtitle="Ingresa directamente la cantidad de unidades envasadas en cada gramaje para Griego Natural y Griego con Stevia."
        icon="format_list_numbered"
        tone={totalUnidades > 0 ? 'completed' : 'default'}
        statusBadge={{
          label: `${totalUnidades} unidades · ${totalKgEnvasados} kg totales`,
          variant: totalUnidades > 0 ? 'success' : 'info',
        }}
      >
        <fieldset disabled={Boolean(state.conteoConfirmado)} className="grid grid-cols-1 lg:grid-cols-2 gap-5 border-0 p-0 m-0 min-w-0">
          {/* CATEGORÍA 1: SIN AZÚCAR (NATURAL) */}
          <div className="p-5 rounded-2xl bg-emerald-50/40 border-2 border-emerald-200 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-emerald-200/80 mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-800 block">
                    Categoría 1
                  </span>
                  <h3 className="text-base font-black text-emerald-950">
                    Griego Sin Azúcar (Natural)
                  </h3>
                </div>
                <Badge variant="success">100% Puro</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField
                  label="Tarrina / Vaso 1000 g"
                  type="number"
                  min="0"
                  unit="und"
                  placeholder="Ej: 20"
                  showZero={false}
                  value={sinEstevia1000g}
                  onChange={(e) => {
                    const val =
                      e.target.value === ''
                        ? 0
                        : Math.max(0, parseInt(e.target.value, 10) || 0);
                    onChange((prev) => ({
                      ...prev,
                      formatosSinEstevia: {
                        ...prev.formatosSinEstevia,
                        tarro1L: val,
                        tarrina1000g: val,
                      },
                    }));
                  }}
                />

                <InputField
                  label="Tarrina / Vaso 500 g"
                  type="number"
                  min="0"
                  unit="und"
                  placeholder="Ej: 40"
                  showZero={false}
                  value={sinEstevia500g}
                  onChange={(e) => {
                    const val =
                      e.target.value === ''
                        ? 0
                        : Math.max(0, parseInt(e.target.value, 10) || 0);
                    onChange((prev) => ({
                      ...prev,
                      formatosSinEstevia: {
                        ...prev.formatosSinEstevia,
                        tarro500ml: val,
                        tarrina500g: val,
                      },
                    }));
                  }}
                />

                <InputField
                  label="Tarrina / Vaso 120 g"
                  type="number"
                  min="0"
                  unit="und"
                  placeholder="Ej: 30"
                  showZero={false}
                  value={sinEstevia120g}
                  onChange={(e) => {
                    const val =
                      e.target.value === ''
                        ? 0
                        : Math.max(0, parseInt(e.target.value, 10) || 0);
                    onChange((prev) => ({
                      ...prev,
                      formatosSinEstevia: {
                        ...prev.formatosSinEstevia,
                        vasito120ml: val,
                        tarrina120g: val,
                      },
                    }));
                  }}
                />

                <InputField
                  label="Bolsa 4 L"
                  type="number"
                  min="0"
                  unit="und"
                  placeholder="Ej: 10"
                  showZero={false}
                  value={sinEsteviaBolsa4L}
                  onChange={(e) => {
                    const val =
                      e.target.value === ''
                        ? 0
                        : Math.max(0, parseInt(e.target.value, 10) || 0);
                    onChange((prev) => ({
                      ...prev,
                      formatosSinEstevia: {
                        ...prev.formatosSinEstevia,
                        bolsa4L: val,
                      },
                    }));
                  }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-emerald-200/80 flex items-center justify-between text-xs">
              <span className="text-emerald-900 font-bold">
                Subtotal Sin Azúcar:
              </span>
              <span className="font-mono font-black text-emerald-950 text-sm">
                {kgSinEstevia} kg ({undsSinEstevia} und)
              </span>
            </div>
          </div>

          {/* CATEGORÍA 2: CON STEVIA */}
          <div className="p-5 rounded-2xl bg-amber-50/40 border-2 border-amber-200 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-amber-200/80 mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-800 block">
                    Categoría 2
                  </span>
                  <h3 className="text-base font-black text-amber-950">
                    Griego Con Stevia
                  </h3>
                </div>
                <Badge variant="warning">Endulzado Stevia</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField
                  label="Tarrina / Vaso 1000 g"
                  type="number"
                  min="0"
                  unit="und"
                  placeholder="Ej: 15"
                  showZero={false}
                  value={conEstevia1000g}
                  onChange={(e) => {
                    const val =
                      e.target.value === ''
                        ? 0
                        : Math.max(0, parseInt(e.target.value, 10) || 0);
                    onChange((prev) => ({
                      ...prev,
                      formatosConEstevia: {
                        ...prev.formatosConEstevia,
                        tarro1L: val,
                        tarrina1000g: val,
                      },
                    }));
                  }}
                />

                <InputField
                  label="Tarrina / Vaso 500 g"
                  type="number"
                  min="0"
                  unit="und"
                  placeholder="Ej: 30"
                  showZero={false}
                  value={conEstevia500g}
                  onChange={(e) => {
                    const val =
                      e.target.value === ''
                        ? 0
                        : Math.max(0, parseInt(e.target.value, 10) || 0);
                    onChange((prev) => ({
                      ...prev,
                      formatosConEstevia: {
                        ...prev.formatosConEstevia,
                        tarro500ml: val,
                        tarrina500g: val,
                      },
                    }));
                  }}
                />

                <InputField
                  label="Tarrina / Vaso 120 g"
                  type="number"
                  min="0"
                  unit="und"
                  placeholder="Ej: 50"
                  showZero={false}
                  value={conEstevia120g}
                  onChange={(e) => {
                    const val =
                      e.target.value === ''
                        ? 0
                        : Math.max(0, parseInt(e.target.value, 10) || 0);
                    onChange((prev) => ({
                      ...prev,
                      formatosConEstevia: {
                        ...prev.formatosConEstevia,
                        vasito120ml: val,
                        tarrina120g: val,
                      },
                    }));
                  }}
                />

                <InputField
                  label="Bolsa 4 L"
                  type="number"
                  min="0"
                  unit="und"
                  placeholder="Ej: 8"
                  showZero={false}
                  value={conEsteviaBolsa4L}
                  onChange={(e) => {
                    const val =
                      e.target.value === ''
                        ? 0
                        : Math.max(0, parseInt(e.target.value, 10) || 0);
                    onChange((prev) => ({
                      ...prev,
                      formatosConEstevia: {
                        ...prev.formatosConEstevia,
                        bolsa4L: val,
                      },
                    }));
                  }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-amber-200/80 flex items-center justify-between text-xs">
              <span className="text-amber-900 font-bold">
                Subtotal Con Stevia:
              </span>
              <span className="font-mono font-black text-amber-950 text-sm">
                {kgConEstevia} kg ({undsConEstevia} und)
              </span>
            </div>
          </div>
        </fieldset>

        {/* Balance de Rendimiento y Materia */}
        <div className="mt-4 p-4 rounded-2xl bg-[#F7F9FC] border border-[#D6DEEA] flex flex-col gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-purple-700">scale</span>
            Balance de Materia y Rendimiento sobre Lote Desviado
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-[#D6DEEA]">
              <span className="text-gray-500 block text-[10px] uppercase font-bold">Leche Base Desviada:</span>
              <span className="text-base font-black font-mono text-blue-950">{lecheInicialL} L</span>
              <span className="text-[10px] text-gray-400 block mt-0.5">Volumen sub-lote Griego</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-[#D6DEEA]">
              <span className="text-gray-500 block text-[10px] uppercase font-bold">Total Envasado:</span>
              <span className="text-base font-black font-mono text-emerald-950">{totalKgEnvasados} kg</span>
              <span className="text-[10px] text-gray-400 block mt-0.5">{totalUnidades} unidades</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-[#D6DEEA]">
              <span className="text-gray-500 block text-[10px] uppercase font-bold">Rendimiento Operativo:</span>
              <span className="text-base font-black font-mono text-emerald-800">{rendimientoLacteoPct} %</span>
              <span className="text-[10px] text-emerald-700 block mt-0.5">s/ Leche</span>
            </div>
          </div>
        </div>

        {/* Botón de guardado de conteo */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#D6DEEA]">
          <div className="text-xs text-gray-500">
            {state.conteoConfirmado
              ? '✓ Conteo registrado en sistema.'
              : 'Puedes registrar los envases y continuar directamente al cierre del lote.'}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
          <Button
            variant={state.conteoConfirmado ? 'success' : 'primary'}
            size="md"
            icon={state.conteoConfirmado ? 'check_circle' : 'save'}
            onClick={handleGuardarConteo}
            disabled={Boolean(state.conteoConfirmado)}
            className="font-bold shadow-md w-full sm:w-auto disabled:opacity-100"
          >
            {state.conteoConfirmado ? 'Conteo Guardado' : 'Guardar Conteo de Envases'}
          </Button>
          {state.conteoConfirmado && (
            <Button
              variant="outline"
              size="md"
              icon="edit"
              onClick={() =>
                onChangeSaved((prev) => ({ ...prev, conteoConfirmado: false }))
              }
              className="font-bold w-full sm:w-auto"
            >
              Editar
            </Button>
          )}
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* CIERRE DE LOTE GRIEGO Y MODAL DE RESUMEN                                  */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-900 shrink-0">
            <span className="material-symbols-outlined text-[24px]">verified</span>
          </div>
          <div className="text-xs sm:text-sm text-[#434655]">
            <p className="font-bold text-[#191C1E]">
              Finalización de Producción de Yogur Griego
            </p>
            <p>
              Total envasado:{' '}
              <strong className="text-emerald-900 font-black">
                {totalKgEnvasados} kg
              </strong>{' '}
              ({totalUnidades} unidades en total) · Rendimiento:{' '}
              <strong className="text-emerald-900 font-black">
                {rendimientoLacteoPct}%
              </strong>.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="xl"
          icon="check_circle"
          onClick={onOpenReviewModal}
          className="w-full sm:w-auto font-black shadow-lg"
        >
          Finalizar Proceso y Ver Resumen
        </Button>
      </div>
    </div>
  );
};
