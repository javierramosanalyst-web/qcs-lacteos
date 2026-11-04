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

CREATE INDEX IF NOT EXISTS idx_borradores_lote_linea ON borradores_lote(linea_id);
`;

export async function ensureSchema(): Promise<void> {
  await pool.query(MIGRATIONS);
}
