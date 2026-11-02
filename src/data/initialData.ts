import { ProductDefinition, ProductionLine } from '../types';

export const INITIAL_PRODUCTS: ProductDefinition[] = [
  // 1. PRODUCTOS DE PASTA HILADA
  {
    id: 'prod-doble-crema-premium',
    name: 'Queso Doble Crema Premium (Tradicional)',
    code: 'QDC-PREM',
    lineType: 'pasta_hilada',
    description: 'Proceso tradicional y artesanal premium de pasta hilada con doble crema de alta materia grasa, amasado manual de hebra en paila y moldeo microperforado.',
    standards: 'Norma Técnica Colombiana NTC-589',
    isTargetProduct: true,
  },
  {
    id: 'prod-doble-crema-industrial',
    name: 'Queso Doble Crema Industrial',
    code: 'QDC-IND',
    lineType: 'pasta_hilada',
    description: 'Proceso industrial estandarizado a gran escala: Tina mecanizada, acidificación a 35 °C, cuajado enzimático, desuerado a 40 °C, hiladora continua de doble sinfín a 65 °C, extrusión y aireado combinados.',
    standards: 'Norma Técnica Colombiana NTC-589 / Resolución 2310 de 1986',
    isTargetProduct: true,
  },
  {
    id: 'prod-queso-pera',
    name: 'Queso Pera',
    code: 'QP-2026',
    lineType: 'pasta_hilada',
    description: 'Queso fresco de pasta hilada semicocida con forma característica de pera o lágrima. Incluye etapa inicial de premaduración con cultivo lácteo dosificado en unidades, cuajado enzimático, desuerado a 40 °C, hilado elástico y moldeo artesanal.',
    standards: 'Norma Técnica Colombiana NTC-589',
    isTargetProduct: true,
  },
  {
    id: 'prod-queso-7-cueros',
    name: 'Queso 7 Cueros',
    code: 'Q7C-2026',
    lineType: 'pasta_hilada',
    description: 'Queso fresco de pasta hilada en capas o cintas. Proceso que incluye acidificación, cuajado, desuerado, hilado y moldeo.',
    standards: 'Norma Técnica Colombiana NTC-589',
    isTargetProduct: true,
  },

  // 2. PRODUCTOS DE FERMENTACIÓN
  {
    id: 'prod-yogur',
    name: 'Yogur Entero',
    code: 'YOG-101',
    lineType: 'fermentacion',
    description: 'Leche entera pasteurizada e inoculada con cultivos lácticos específicos. Incluye tratamiento térmico a 85-90 °C, enfriamiento a 45 °C, inoculación (8 h), maduración en frío (12 h), batido con adición de saborizante natural/azúcar y envasado.',
    standards: 'NTC-805 (Productos Lácteos Fermentados)',
    isTargetProduct: true,
  },
  {
    id: 'prod-kumis',
    name: 'Kumis Tradicional Fermentado',
    code: 'KUM-102',
    lineType: 'fermentacion',
    description: 'Leche entera pasteurizada e inoculada con cultivo láctico específico para kumis. Incluye tratamiento térmico a 85-90 °C, enfriamiento a 45 °C, inoculación (8 h), maduración en frío (12 h), batido con adición de endulzante (sin saborizantes) y envasado.',
    standards: 'NTC-805',
    isTargetProduct: true,
  },
  {
    id: 'prod-yogur-griego',
    name: 'Yogur Griego',
    code: 'YGR-103',
    lineType: 'fermentacion',
    description: 'Producto lácteo fermentado de alta densidad y cremosidad. Incluye pasteurización a 85-90 °C, enfriamiento a 45 °C, inoculación (8 h), maduración en frío (12 h), proceso especial de filtrado en telas (16 h), batido con crema de leche y estevia opcional, y envasado.',
    standards: 'NTC-805 (Productos Lácteos Fermentados)',
    isTargetProduct: true,
  },
];

export const INITIAL_LINES: ProductionLine[] = [
  // LÍNEA 1: PASTA HILADA
  {
    id: 'line-pasta-hilada',
    name: 'Línea de Producción de Pasta Hilada',
    code: 'L-HILADA-01',
    lineType: 'pasta_hilada',
    lineTypeName: 'Línea de Producción de Pasta Hilada',
    capacityLiters: 1200,
    status: 'disponible',
    activeBatchId: null,
    assignedOperatorName: null,
    allowedProductIds: [
      'prod-doble-crema-premium',
      'prod-doble-crema-industrial',
      'prod-queso-pera',
      'prod-queso-7-cueros',
    ],
  },

  // LÍNEA 2: FERMENTACIÓN
  {
    id: 'line-fermentacion',
    name: 'Línea de Fermentación',
    code: 'L-FERMENT-02',
    lineType: 'fermentacion',
    lineTypeName: 'Línea de Fermentación',
    capacityLiters: 2000,
    status: 'disponible',
    activeBatchId: null,
    assignedOperatorName: null,
    allowedProductIds: ['prod-yogur', 'prod-kumis', 'prod-yogur-griego'],
  },

];
