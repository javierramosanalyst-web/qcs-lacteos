/**
 * Mantiene coherentes los totales de un lote cuando el administrador corrige un conteo.
 *
 * Las pantallas del operario guardan, junto a los conteos de moldes, unos totales derivados
 * (moldesDesglose.pesoTotalCalculadoKg, hilar.pesoTotalQueso, hilar.numeroMoldes). Una
 * corrección cambia solo el conteo, así que aquí se recalculan esos totales con las mismas
 * fórmulas de las etapas de moldeo. En el Yogur Griego la pantalla guarda cada cantidad con
 * dos nombres (p. ej. tarro1L y tarrina1000g); al corregir uno se iguala el otro.
 */

type Json = any;

const conteo = (v: unknown): number => Math.max(0, Number(v) || 0);
const redondear2 = (x: number): number => Math.round(x * 100) / 100;

const MOLDES_DOBLE_CREMA = [100, 200, 400, 800, 1600];

const PARES_GRIEGO: [string, string][] = [
  ['tarro1L', 'tarrina1000g'],
  ['tarro500ml', 'tarrina500g'],
  ['vasito120ml', 'tarrina120g'],
];

function sincronizarAliasGriego(batch: Json, fieldKey: string): void {
  const m = /^envasado\.(formatosSinEstevia|formatosConEstevia)\.([A-Za-z0-9]+)$/.exec(fieldKey);
  if (!m) return;
  const grupo = batch.envasado?.[m[1]];
  if (!grupo || typeof grupo !== 'object') return;
  for (const [a, b] of PARES_GRIEGO) {
    if (m[2] === a) grupo[b] = grupo[a];
    else if (m[2] === b) grupo[a] = grupo[b];
  }
}

/** Solo reacciona a cambios de conteos de moldes; una corrección directa de un total se respeta. */
const esConteoDeMoldes = (fieldKey: string): boolean =>
  /^moldesDesglose\.moldes[A-Za-z0-9]+$/.test(fieldKey) || /^derivaciones7Cueros\.[A-Za-z]+\.moldes60g$/.test(fieldKey);

export function sincronizarTotalesTrasCorreccion(batch: Json, fieldKey: string): void {
  if (!batch || typeof batch !== 'object') return;
  const producto = batch.productId;

  if (producto === 'prod-yogur-griego') {
    sincronizarAliasGriego(batch, fieldKey);
    return;
  }
  if (!esConteoDeMoldes(fieldKey)) return;

  const md = batch.moldesDesglose;
  if (!md || typeof md !== 'object' || md.esPesoManual === true) return;

  let gramos = 0;
  let unidades = 0;

  if (producto === 'prod-queso-pera') {
    // Igual que MoldeoStagePera: el total principal es Pera grande (350 g) + Pera pequeño (60 g).
    const grande = conteo(md.moldesPeraGrande350g);
    const pequeno = conteo(md.moldesPeraPequeno60g);
    gramos = grande * 350 + pequeno * 60;
    unidades = grande + pequeno;
  } else if (producto === 'prod-queso-7-cueros') {
    // Las quesadillas viven en dos lugares (moldesDesglose y derivaciones7Cueros): se igualan.
    const der = batch.derivaciones7Cueros ?? {};
    const pares: [string, string][] = [
      ['moldesQuesadillaBocadillo60g', 'bocadillo'],
      ['moldesQuesadillaArequipe60g', 'arequipe'],
    ];
    for (const [clave, tipo] of pares) {
      const d = der[tipo];
      if (fieldKey === `moldesDesglose.${clave}`) {
        if (d && typeof d === 'object') d.moldes60g = md[clave];
      } else if (fieldKey === `derivaciones7Cueros.${tipo}.moldes60g`) {
        md[clave] = d?.habilitado ? conteo(d.moldes60g) : 0;
      }
    }
    const u7 = conteo(md.moldes7Cueros350g);
    const trenza = conteo(md.moldesTrenza350g);
    const bocadillo = conteo(md.moldesQuesadillaBocadillo60g);
    const arequipe = conteo(md.moldesQuesadillaArequipe60g);
    gramos = u7 * 350 + trenza * 350 + bocadillo * 60 + arequipe * 60;
    unidades = u7 + trenza + bocadillo + arequipe;
  } else if (producto === 'prod-doble-crema-premium' || producto === 'prod-doble-crema-industrial') {
    for (const g of MOLDES_DOBLE_CREMA) {
      const n = conteo(md[`moldes${g}g`]);
      gramos += n * g;
      unidades += n;
    }
  } else {
    return;
  }

  const kg = redondear2(gramos / 1000);
  md.pesoTotalCalculadoKg = kg;
  batch.hilar = { ...(batch.hilar ?? {}), pesoTotalQueso: kg, numeroMoldes: unidades };
}
