import React, { useState } from 'react';
import { Modal } from '../../components/ui';
import { ProductDefinition, ProductionLine } from '../../types';

interface OperatorProductSelectorProps {
  selectedLine: ProductionLine;
  products: ProductDefinition[];
  onSelectProduct: (productId: string) => void;
  onBackToLines: () => void;
  /**
   * Sub-lotes que nacen del Yogur (Kumis / Griego). No se pueden iniciar desde aquí:
   * toda la leche entra por el Yogur. Solo se puede continuar uno que ya exista.
   */
  derivedLots?: Record<string, { activo: boolean; yogurId?: string; litros?: number }>;
}

const DERIVADOS_DE_YOGUR = ['prod-kumis', 'prod-yogur-griego'];

const QUESO_STAGES = ['Acidificar (35 °C)', 'Calentar y Cuajar', 'Desuerar (40 °C)', 'Hilar (65 °C / Hebra / Extrusión)', 'Moldeo y Balance'];

const PRODUCT_STAGES: Record<string, string[]> = {
  'prod-doble-crema-premium': QUESO_STAGES,
  'prod-doble-crema-industrial': QUESO_STAGES,
  'prod-queso-pera': ['Premaduración', 'Calentar y Cuajar', 'Desuerar (40 °C)', 'Hilar (Queso Pera)', 'Moldeo y Balance'],
  'prod-queso-7-cueros': ['Acidificar', 'Calentar y Cuajar', 'Desuerar (40 °C)', 'Hilar', 'Rendimiento y Moldeo'],
  'prod-yogur': ['Pasteurización y Enfriamiento', 'Inoculación (Cultivo)', 'Maduración en Frío', 'Batido y Adiciones', 'Envasado y Rendimiento'],
  'prod-kumis': ['Pasteurización', 'Inocular e Incubar', 'Envasar y Guardar'],
  'prod-yogur-griego': ['Pasteurización', 'Inoculación', 'Maduración y Filtrado en Telas', 'Batido, Crema y Adiciones', 'Envasado y Almacenamiento'],
};

const START_LABEL: Record<string, string> = {
  'prod-doble-crema-premium': 'Doble Crema Premium (Tradicional)',
  'prod-doble-crema-industrial': 'Doble Crema Industrial',
  'prod-queso-pera': 'Queso Pera',
  'prod-queso-7-cueros': 'Queso 7 Cueros',
  'prod-yogur': 'Yogur',
  'prod-kumis': 'Kumis',
  'prod-yogur-griego': 'Yogur Griego',
};

export const OperatorProductSelector: React.FC<OperatorProductSelectorProps> = ({
  selectedLine,
  products,
  onSelectProduct,
  onBackToLines,
  derivedLots = {},
}) => {
  const [infoModalProduct, setInfoModalProduct] = useState<ProductDefinition | null>(null);

  const allowedProducts = products
    .filter((p) => selectedLine.allowedProductIds.includes(p.id))
    .sort((a, b) => {
      const order: Record<string, number> = {
        'prod-doble-crema-premium': 0,
        'prod-doble-crema-industrial': 1,
        'prod-queso-pera': 2,
        'prod-queso-7-cueros': 3,
        'prod-yogur': 0,
        'prod-kumis': 1,
        'prod-yogur-griego': 2,
      };
      return (order[a.id] ?? 99) - (order[b.id] ?? 99);
    });

  const isPastaHilada = selectedLine.lineType === 'pasta_hilada';

  return (
    <div className="flex flex-col w-full p-4 lg:p-8 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl shadow-xs border border-[#D6DEEA] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBackToLines}
            className="text-xs font-bold text-[#1B4E9B] flex items-center gap-1 hover:underline mb-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Volver al selector de líneas</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-[#1B4E9B] border border-blue-200">
              {selectedLine.code}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#191c1e]">
              {selectedLine.name}
            </h1>
          </div>
        </div>
      </div>

      {/* Banner de contexto de la línea */}
      <div className="p-4 rounded-2xl bg-[#1B4E9B]/5 border border-[#1B4E9B]/25 text-xs text-[#143A73] flex items-start gap-3">
        <img
          src={isPastaHilada ? '/brand/queso.png' : '/brand/yogurt-congelado.png'}
          alt=""
          className="w-6 h-6 object-contain shrink-0"
        />
        <div>
          <strong className="font-bold text-sm">
            {isPastaHilada ? 'Línea de Pasta Hilada Activa' : 'Línea de Fermentados Activa'}
          </strong>
          <p className="mt-0.5 leading-relaxed">
            {isPastaHilada
              ? 'Elige el queso que vas a preparar hoy.'
              : 'Todo empieza en el Yogur. Durante el proceso del Yogur se decide si de esa misma leche sale Kumis (con azúcar) o Yogur Griego (sin azúcar); cada uno sigue después con su propio cronómetro.'}
          </p>
        </div>
      </div>

      {/* Lista de Productos asociados a la línea */}
      <div className="flex flex-col gap-4">
        {allowedProducts.map((prod) => {
          const stages = PRODUCT_STAGES[prod.id];

          return (
            <div
              key={prod.id}
              className="p-6 rounded-3xl border border-[#D6DEEA] bg-white hover:border-[#1B4E9B] hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-[#D6DEEA] bg-[#F2F4F7]">
                  <img
                    src={
                      isPastaHilada
                        ? '/brand/queso.png'
                        : '/brand/yogurt-congelado.png'
                    }
                    alt=""
                    className="w-8 h-8 object-contain"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded border bg-[#1B4E9B]/5 text-[#1B4E9B] border-[#1B4E9B]/25">
                      {prod.code}
                    </span>
                    <h3 className="text-lg font-black text-[#191c1e]">{prod.name}</h3>
                  </div>
                  <p className="text-xs text-[#434655] max-w-xl">{prod.description}</p>
                  <span className="text-[11px] font-bold text-gray-500 mt-0.5">
                    Normativa: {prod.standards}
                  </span>

                  {stages && (
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold text-gray-700">
                      {stages.map((stage, i) => (
                        <span key={stage} className="px-2 py-1 bg-[#F2F4F7] border border-[#D6DEEA] rounded-lg">
                          {i + 1}. {stage}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full md:w-auto shrink-0">
                {stages && DERIVADOS_DE_YOGUR.includes(prod.id) ? (
                  derivedLots[prod.id]?.activo ? (
                    <button
                      onClick={() => onSelectProduct(prod.id)}
                      className="w-full md:w-auto px-6 py-3.5 rounded-2xl bg-[#1B4E9B] hover:bg-[#143A73] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      <span>
                        Continuar {START_LABEL[prod.id] ?? prod.name}
                        {derivedLots[prod.id]?.litros ? ` (${derivedLots[prod.id]?.litros} L)` : ''}
                      </span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  ) : (
                    <div className="flex flex-col items-stretch md:items-end gap-1">
                      <button
                        disabled
                        className="w-full md:w-auto px-6 py-3.5 rounded-2xl bg-[#F2F4F7] text-gray-400 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-[#D6DEEA] cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-[18px]">call_split</span>
                        <span>Se crea desde un lote de Yogur</span>
                      </button>
                      <span className="text-[10px] text-gray-500 text-center md:text-right">
                        {prod.id === 'prod-kumis'
                          ? 'Inicia un Yogur con azúcar y desvía leche a Kumis.'
                          : 'Inicia un Yogur sin azúcar y desvía leche a Griego tras el cuarto frío.'}
                      </span>
                    </div>
                  )
                ) : stages ? (
                  <button
                    onClick={() => onSelectProduct(prod.id)}
                    className="w-full md:w-auto px-6 py-3.5 rounded-2xl bg-[#1B4E9B] hover:bg-[#143A73] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <span>Iniciar {START_LABEL[prod.id] ?? prod.name}</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setInfoModalProduct(prod)}
                    className="w-full md:w-auto px-6 py-3.5 rounded-2xl bg-white hover:bg-[#F2F4F7] text-[#1B4E9B] text-xs sm:text-sm font-bold border border-[#1B4E9B] flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>Ver Ficha Técnica</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Ficha Técnica de Producto */}
      <Modal
        isOpen={Boolean(infoModalProduct)}
        onClose={() => setInfoModalProduct(null)}
        maxWidth="lg"
        icon="assignment"
        title={infoModalProduct ? `Ficha Técnica: ${infoModalProduct.name}` : 'Ficha Técnica'}
        subtitle={infoModalProduct ? `Código: ${infoModalProduct.code}` : undefined}
        footer={
          <button
            onClick={() => setInfoModalProduct(null)}
            className="px-5 py-2.5 rounded-xl bg-[#1B4E9B] text-white font-bold text-xs hover:bg-[#143A73] cursor-pointer"
          >
            Entendido / Volver
          </button>
        }
      >
        {infoModalProduct && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="p-3 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase text-[10px]">Línea de Proceso</span>
              <span className="font-bold text-gray-900 text-sm">
                {infoModalProduct.lineType === 'fermentacion'
                  ? 'Línea de Fermentación (Yogur, Kumis y Griego)'
                  : infoModalProduct.lineType === 'dulces'
                  ? 'Línea de Dulces (Manjar y Panelitas)'
                  : 'Línea de Pasta Hilada'}
              </span>
            </div>

            <div>
              <span className="text-gray-500 font-bold uppercase text-[10px] block mb-1">Descripción del Proceso</span>
              <p className="text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-200">
                {infoModalProduct.description}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[#1B4E9B]">
              <strong className="block font-bold">Norma y Marco Regulatorio:</strong>
              <span>{infoModalProduct.standards}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
