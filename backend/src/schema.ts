import { pool } from './db';

const MIGRATIONS = `
ALTER TABLE lotes_produccion ADD COLUMN IF NOT EXISTS estado_ui JSONB;
ALTER TABLE lotes_produccion ADD COLUMN IF NOT EXISTS producto_ui_id VARCHAR(60);
ALTER TABLE lotes_produccion ADD COLUMN IF NOT EXISTS finalizado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lotes_produccion_producto_ui ON lotes_produccion(producto_ui_id, estado);

CREATE TABLE IF NOT EXISTS borradores_lote (
    producto_ui_id VARCHAR(60) PRIMARY KEY,
    linea_id UUID NOT NULL REFERENCES lineas_produccion(id) ON DELETE RESTRICT,
    estado JSONB NOT NULL,
    etapa_actual VARCHAR(40) NOT NULL DEFAULT 'acidificar',
    version INTEGER NOT NULL DEFAULT 1,
    lote_id UUID REFERENCES lotes_produccion(id) ON DELETE SET NULL,
    actualizado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS espacio_trabajo_linea (
    linea_id UUID PRIMARY KEY REFERENCES lineas_produccion(id) ON DELETE CASCADE,
    estado JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    actualizado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS seq_codigo_lote START 1;

INSERT INTO parametros_medicion (codigo, nombre, unidad) VALUES
  ('ph_leche_acida', 'pH leche ácida', 'pH'),
  ('acidez_hilado', 'Acidez de la masa al hilar', '% LA')
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE insumos_lotes ADD COLUMN IF NOT EXISTS descripcion VARCHAR(200);
ALTER TABLE insumos_lotes ADD COLUMN IF NOT EXISTS eliminado_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_borradores_lote_linea ON borradores_lote(linea_id);

CREATE TABLE IF NOT EXISTS tipos_insumo (
    codigo VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    unidad_base VARCHAR(20) NOT NULL,
    gestionable_admin BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tipos_insumo (codigo, nombre, unidad_base, gestionable_admin) VALUES
  ('leche_fresca', 'Leche fresca de proveedor', 'L', TRUE),
  ('cultivo', 'Cultivo láctico', 'g', TRUE),
  ('cuajo', 'Cuajo (coagulante)', 'ml', TRUE),
  ('sal', 'Sal', 'kg', TRUE),
  ('azucar', 'Azúcar', 'kg', TRUE),
  ('saborizante', 'Saborizante', 'ml', TRUE),
  ('colorante', 'Colorante', 'ml', TRUE),
  ('leche_acida', 'Leche ácida', 'L', FALSE),
  ('cultivo_lactico', 'Cultivo láctico (proceso)', 'g', FALSE),
  ('estevia', 'Estevia', 'g', TRUE),
  ('acido_acetico', 'Ácido acético', 'ml', TRUE),
  ('agua', 'Agua', 'ml', FALSE),
  ('especia', 'Especia', 'g', TRUE),
  ('arequipe', 'Arequipe', 'g', TRUE),
  ('bocadillo', 'Bocadillo', 'g', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- La Stevia se registra por lotes en Insumos (bases creadas antes la tenían como no gestionable).
UPDATE tipos_insumo SET gestionable_admin = TRUE WHERE codigo = 'estevia' AND gestionable_admin = FALSE;

-- El Ácido Acético se registra por lotes para Queso Doble Crema Industrial y 7 Cueros.
UPDATE tipos_insumo SET gestionable_admin = TRUE WHERE codigo = 'acido_acetico' AND gestionable_admin = FALSE;

-- Las especias se registran por lotes para Queso Mexicano y Finas Hierbas.
UPDATE tipos_insumo SET gestionable_admin = TRUE WHERE codigo = 'especia' AND gestionable_admin = FALSE;

-- Arequipe y Bocadillo se registran por lotes para Quesadillas (7 Cueros).
UPDATE tipos_insumo SET gestionable_admin = TRUE WHERE codigo IN ('arequipe', 'bocadillo') AND gestionable_admin = FALSE;

INSERT INTO insumos_catalogo (codigo, nombre, tipo_insumo, unidad_base)
VALUES ('INS-ACIDO-ACETICO', 'Ácido acético', 'acido_acetico', 'ml')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO insumos_catalogo (codigo, nombre, tipo_insumo, unidad_base)
VALUES
  ('INS-AREQUIPE', 'Arequipe', 'arequipe', 'g'),
  ('INS-BOCADILLO', 'Bocadillo', 'bocadillo', 'g')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO tipos_insumo (codigo, nombre, unidad_base)
SELECT DISTINCT tipo_insumo, tipo_insumo, 'unidades' FROM insumos_catalogo
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO tipos_insumo (codigo, nombre, unidad_base)
SELECT DISTINCT tipo_insumo, tipo_insumo, 'unidades' FROM lote_insumos_utilizados
ON CONFLICT (codigo) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_insumos_catalogo_tipo') THEN
    ALTER TABLE insumos_catalogo ADD CONSTRAINT fk_insumos_catalogo_tipo
      FOREIGN KEY (tipo_insumo) REFERENCES tipos_insumo(codigo) ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_insumos_utilizados_tipo') THEN
    ALTER TABLE lote_insumos_utilizados ADD CONSTRAINT fk_insumos_utilizados_tipo
      FOREIGN KEY (tipo_insumo) REFERENCES tipos_insumo(codigo) ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_insumos_lotes_cantidad') THEN
    ALTER TABLE insumos_lotes ADD CONSTRAINT chk_insumos_lotes_cantidad
      CHECK (cantidad_recibida IS NULL OR cantidad_recibida >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_insumos_catalogo_tipo ON insumos_catalogo(tipo_insumo);
CREATE INDEX IF NOT EXISTS idx_insumos_utilizados_tipo ON lote_insumos_utilizados(tipo_insumo);

CREATE TABLE IF NOT EXISTS sabores_yogur (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(80) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sabores_yogur_nombre ON sabores_yogur (LOWER(nombre));

-- Yogur Griego: Bolsa de 4 L (natural y con stevia). Se mide en kg como el resto del Griego.
INSERT INTO formatos_envase (codigo, descripcion, tipo_linea, categoria_variedad, capacidad_unitaria, unidad_medida) VALUES
  ('griego_natural_bolsa4L', 'Bolsa de 4 L (Griego Natural)',    'fermentacion', 'natural', 4.000, 'kg'),
  ('griego_stevia_bolsa4L',  'Bolsa de 4 L (Griego con Stevia)', 'fermentacion', 'stevia',  4.000, 'kg')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS lote_etapa_operarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id UUID NOT NULL REFERENCES lotes_produccion(id) ON DELETE CASCADE,
    etapa_codigo VARCHAR(40) NOT NULL,
    fase_nombre VARCHAR(120) NOT NULL,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    primera_accion_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_accion_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lote_id, etapa_codigo, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_lote_etapa_operarios_lote ON lote_etapa_operarios(lote_id);
CREATE INDEX IF NOT EXISTS idx_lote_etapa_operarios_usuario ON lote_etapa_operarios(usuario_id);

DROP TRIGGER IF EXISTS trg_lock_lote_etapa_operarios ON lote_etapa_operarios;
CREATE TRIGGER trg_lock_lote_etapa_operarios
    BEFORE INSERT OR UPDATE OR DELETE ON lote_etapa_operarios
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_hijas_de_lote_cerrado();

-- ============================================================================
-- Lote visible por día (5 letras): DD + M + AA, con la fecha de INICIO del lote
-- en hora de Colombia. Dígitos 1..9,0 -> A..J ; meses enero..diciembre -> A..L.
-- Ej.: 12/10/2026 -> "AB" + "J" + "BF" = ABJBF. Todos los lotes que arrancan el
-- mismo día comparten estas letras; el código interno (codigo_lote) y el id siguen
-- siendo únicos y son los que usa el sistema por dentro.
-- ============================================================================
ALTER TABLE lotes_produccion ADD COLUMN IF NOT EXISTS lote_dia VARCHAR(5);
CREATE INDEX IF NOT EXISTS idx_lotes_produccion_lote_dia ON lotes_produccion(lote_dia);

CREATE OR REPLACE FUNCTION fn_lote_dia(ts TIMESTAMPTZ) RETURNS VARCHAR(5)
LANGUAGE sql STABLE AS $$
    SELECT translate(to_char(ts AT TIME ZONE 'America/Bogota', 'DD'), '1234567890', 'ABCDEFGHIJ')
        || substr('ABCDEFGHIJKL', EXTRACT(MONTH FROM ts AT TIME ZONE 'America/Bogota')::int, 1)
        || translate(to_char(ts AT TIME ZONE 'America/Bogota', 'YY'), '1234567890', 'ABCDEFGHIJ');
$$;

CREATE OR REPLACE FUNCTION fn_asignar_lote_dia() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lote_dia IS NULL THEN
        NEW.lote_dia := fn_lote_dia(COALESCE(NEW.iniciado_at, NOW()));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asignar_lote_dia ON lotes_produccion;
CREATE TRIGGER trg_asignar_lote_dia
    BEFORE INSERT ON lotes_produccion
    FOR EACH ROW EXECUTE FUNCTION fn_asignar_lote_dia();

-- Balance de materia: el Yogur Griego ya no registra masa filtrada; se mide como la app
-- (kg envasados / litros de leche recibidos). Se recrea la vista sin la columna de masa.
DROP VIEW IF EXISTS v_balance_materia_lote;
CREATE VIEW v_balance_materia_lote AS
WITH envasado AS (
    SELECT lote_id,
           SUM(total_volumen_o_peso) FILTER (WHERE unidad_medida = 'L')  AS total_litros_envasados,
           SUM(total_volumen_o_peso) FILTER (WHERE unidad_medida = 'kg') AS total_kg_envasados,
           SUM(unidades_conteo)                                            AS total_unidades
    FROM lote_presentaciones_envasado
    GROUP BY lote_id
)
-- Yogur Griego: ya no se registra masa filtrada ni suero eliminado; su balance es
-- kg envasados sobre los litros de leche que recibió del Yogur (igual que la app).
SELECT l.id AS lote_id,
       l.codigo_lote,
       l.variante_fermentado,
       l.volumen_leche_base_litros,
       e.total_litros_envasados,
       e.total_kg_envasados,
       e.total_unidades,
       -- Yogur / Kumis: litros envasados vs. leche base del propio lote
       CASE WHEN l.volumen_leche_base_litros > 0 AND e.total_litros_envasados IS NOT NULL
            THEN l.volumen_leche_base_litros - e.total_litros_envasados END       AS diferencia_litros,
       CASE WHEN l.volumen_leche_base_litros > 0 AND e.total_litros_envasados IS NOT NULL
            THEN ROUND(e.total_litros_envasados / l.volumen_leche_base_litros * 100, 2) END AS rendimiento_litros_pct,
       -- Griego y quesos: kg envasados sobre leche base (kg/L)
       CASE WHEN l.volumen_leche_base_litros > 0 AND e.total_kg_envasados IS NOT NULL
            THEN ROUND(e.total_kg_envasados / l.volumen_leche_base_litros * 100, 2) END AS rendimiento_s_leche_pct
FROM lotes_produccion l
LEFT JOIN envasado e ON e.lote_id = l.id;
`;

export async function ensureSchema(): Promise<void> {
  await pool.query(MIGRATIONS);
  await rellenarLoteDia();
}

/**
 * Asigna las letras del día a los lotes que aún no las tienen (los creados antes de
 * existir la columna). Los lotes cerrados o anulados están protegidos contra cambios,
 * así que se usa el mismo permiso controlado de las rectificaciones de administrador,
 * activo SOLO dentro de esta transacción y solo para llenar lote_dia.
 */
async function rellenarLoteDia(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL app.allow_admin_override = 'true'");
    const result = await client.query(
      `UPDATE lotes_produccion SET lote_dia = fn_lote_dia(iniciado_at) WHERE lote_dia IS NULL;`
    );
    await client.query('COMMIT');
    if ((result.rowCount ?? 0) > 0) {
      console.log(`[schema] Lote por día asignado a ${result.rowCount} lote(s) existentes.`);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
