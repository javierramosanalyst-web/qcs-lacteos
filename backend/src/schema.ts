import { pool } from './db';

const MIGRATIONS = `
ALTER TABLE lotes_produccion ADD COLUMN IF NOT EXISTS estado_ui JSONB;
ALTER TABLE lotes_produccion ADD COLUMN IF NOT EXISTS producto_ui_id VARCHAR(60);

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
  ('acido_acetico', 'Ácido acético', 'ml', FALSE),
  ('agua', 'Agua', 'ml', FALSE),
  ('especia', 'Especia', 'g', FALSE),
  ('arequipe', 'Arequipe', 'g', FALSE),
  ('bocadillo', 'Bocadillo', 'g', FALSE)
ON CONFLICT (codigo) DO NOTHING;

-- La Stevia se registra por lotes en Insumos (bases creadas antes la tenían como no gestionable).
UPDATE tipos_insumo SET gestionable_admin = TRUE WHERE codigo = 'estevia' AND gestionable_admin = FALSE;

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
`;

export async function ensureSchema(): Promise<void> {
  await pool.query(MIGRATIONS);
}
