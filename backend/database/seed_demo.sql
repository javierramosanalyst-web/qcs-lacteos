-- ============================================================================
-- QCS PRO LÁCTEOS · DATOS DE PRUEBA (SOLO DESARROLLO)
-- Lotes de insumos y sabores para poder probar los desplegables
-- (lote de leche, cultivo, cuajo, sal, azúcar, saborizante, colorante).
--
-- Requiere: init.sql + seed.sql, y haber arrancado el backend una vez
-- (ensureSchema agrega columnas que usa la API).
--
-- USO:  psql -U <usuario> -d <base> -f backend/database/seed_demo.sql
-- Idempotente: se puede correr varias veces.
-- NO correr en producción: los lotes reales los registra el administrador
-- en la pantalla "Insumos".
-- ============================================================================
BEGIN;

-- 1. Un insumo de catálogo por tipo gestionable (mismo código que crea la API)
INSERT INTO insumos_catalogo (codigo, nombre, tipo_insumo, unidad_base)
SELECT 'INS-' || UPPER(REPLACE(t.codigo, '_', '-')), t.nombre, t.codigo, t.unidad_base
FROM tipos_insumo t
WHERE t.gestionable_admin AND t.activo
  AND NOT EXISTS (SELECT 1 FROM insumos_catalogo c WHERE c.tipo_insumo = t.codigo)
ON CONFLICT DO NOTHING;

-- 2. Lotes de prueba (2 por tipo)
INSERT INTO insumos_lotes (insumo_id, codigo_lote, proveedor, fecha_vencimiento, cantidad_recibida)
SELECT c.id, v.codigo_lote, v.proveedor, (CURRENT_DATE + v.dias_venc), v.cantidad
FROM (VALUES
    ('leche_fresca', 'LCH-DEMO-001', 'Finca La Esperanza',   5,  800),
    ('leche_fresca', 'LCH-DEMO-002', 'Hacienda El Roble',    5,  600),
    ('cultivo',      'CUL-DEMO-001', 'Proveedor Cultivos',  180,  500),
    ('cultivo',      'CUL-DEMO-002', 'Proveedor Cultivos',  180,  500),
    ('cuajo',        'CUA-DEMO-001', 'Proveedor Cuajo',     365, 1000),
    ('cuajo',        'CUA-DEMO-002', 'Proveedor Cuajo',     365, 1000),
    ('sal',          'SAL-DEMO-001', 'Refisal',             720,   50),
    ('sal',          'SAL-DEMO-002', 'Refisal',             720,   50),
    ('azucar',       'AZU-DEMO-001', 'Ingenio Manuelita',   365,  100),
    ('azucar',       'AZU-DEMO-002', 'Ingenio Riopaila',    365,  100),
    ('saborizante',  'SAB-DEMO-001', 'Proveedor Sabores',   365, 5000),
    ('saborizante',  'SAB-DEMO-002', 'Proveedor Sabores',   365, 5000),
    ('colorante',    'COL-DEMO-001', 'Proveedor Colorantes',365, 2000),
    ('colorante',    'COL-DEMO-002', 'Proveedor Colorantes',365, 2000)
) AS v(tipo, codigo_lote, proveedor, dias_venc, cantidad)
JOIN insumos_catalogo c ON c.tipo_insumo = v.tipo
ON CONFLICT (insumo_id, codigo_lote) DO NOTHING;

-- 3. Sabores de yogur
INSERT INTO sabores_yogur (nombre)
SELECT s FROM (VALUES ('Fresa'), ('Mora'), ('Melocotón'), ('Guanábana'), ('Natural')) AS v(s)
WHERE NOT EXISTS (SELECT 1 FROM sabores_yogur y WHERE LOWER(y.nombre) = LOWER(v.s));

COMMIT;
