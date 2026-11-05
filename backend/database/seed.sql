-- ============================================================================
-- QCS PRO LÁCTEOS · DATOS SEMILLA DE CATÁLOGOS MAESTROS (PostgreSQL)
-- Requiere: backend/database/init.sql ya ejecutado.
--
-- USO:
--   psql -U <usuario> -d <base> -f backend/database/seed.sql
--
-- IDEMPOTENTE: cada INSERT usa ON CONFLICT DO NOTHING (los UNIQUE/PK de init.sql
-- actúan como llave natural). Se puede ejecutar varias veces sin duplicar ni fallar.
-- Importante: DO NOTHING no ACTUALIZA filas ya existentes; si cambias un valor aquí,
-- hay que editarlo en la base (o recrearla) para que se refleje.
--
-- ORIGEN DE LOS VALORES (frontend React, sin modificarlo):
--   lineas / productos / usuarios ... src/data/initialData.ts
--   etapas_catalogo ................. src/layouts/Sidebar.tsx (navItems por producto)
--   formatos_envase ................. src/features/fermentados/common/EnvasadoStageCommon.tsx,
--                                     src/features/fermentados/griego/EnvasadoGriegoStage.tsx,
--                                     src/types/pastaHilada.ts (MoldesDesglose), MoldeoStage*.tsx
--   parametros_medicion ............. src/types/*.ts (campos medidos) y AdminCorrectionModal.tsx
--
-- EQUIVALENCIA id del frontend  ->  `codigo` en la base (los ids del frontend no son UUID):
--   line-pasta-hilada -> L-HILADA-01     prod-doble-crema-premium    -> QDC-PREM
--   line-fermentacion -> L-FERMENT-02    prod-doble-crema-industrial -> QDC-IND
--   line-dulces       -> L-DULCES-03     prod-queso-pera             -> QP-2026
--                                        prod-queso-7-cueros         -> Q7C-2026
--   prod-yogur -> YOG-101   prod-kumis -> KUM-102   prod-yogur-griego -> YGR-103
--   prod-manjar -> MNJ-201  prod-panelitas -> PNL-202  prod-cortado -> DTC-203
--   usr-admin-1 -> ADM-901  usr-op-1 -> OP-104   (SA-001 no existe en el frontend)
-- ============================================================================

BEGIN;

-- pgcrypto: genera hashes bcrypt directamente en SQL para los usuarios de prueba.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. LÍNEAS DE PRODUCCIÓN  (INITIAL_LINES)
-- ============================================================================
INSERT INTO lineas_produccion (codigo, nombre, tipo_linea, capacidad_litros, estado) VALUES
    ('L-HILADA-01',  'Línea de Producción de Pasta Hilada', 'pasta_hilada', 1200, 'disponible'),
    ('L-FERMENT-02', 'Línea de Fermentación',               'fermentacion', 2000, 'disponible')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. PRODUCTOS  (INITIAL_PRODUCTS)
--    Las descripciones se copian tal cual del frontend. Algunas de fermentados
--    describen tiempos antiguos (p. ej. "maduración en frío (12 h)", "filtrado en
--    telas (16 h)") que ya no coinciden con el flujo actual; son solo informativas.
-- ============================================================================
INSERT INTO productos (codigo, nombre, tipo_linea, descripcion, norma_tecnica) VALUES
    ('QDC-PREM', 'Queso Doble Crema Premium (Tradicional)', 'pasta_hilada',
     'Proceso tradicional y artesanal premium de pasta hilada con doble crema de alta materia grasa, amasado manual de hebra en paila y moldeo microperforado.',
     'Norma Técnica Colombiana NTC-589'),
    ('QDC-IND', 'Queso Doble Crema Industrial', 'pasta_hilada',
     'Proceso industrial estandarizado a gran escala: Tina mecanizada, acidificación a 35 °C, cuajado enzimático, desuerado a 40 °C, hiladora continua de doble sinfín a 65 °C, extrusión y aireado combinados.',
     'Norma Técnica Colombiana NTC-589 / Resolución 2310 de 1986'),
    ('QP-2026', 'Queso Pera', 'pasta_hilada',
     'Queso fresco de pasta hilada semicocida con forma característica de pera o lágrima. Incluye etapa inicial de premaduración con cultivo lácteo dosificado en unidades, cuajado enzimático, desuerado a 40 °C, hilado elástico y moldeo artesanal.',
     'Norma Técnica Colombiana NTC-589'),
    ('Q7C-2026', 'Queso 7 Cueros', 'pasta_hilada',
     'Queso fresco de pasta hilada en capas o cintas. Proceso que incluye acidificación, cuajado, desuerado, hilado y moldeo.',
     'Norma Técnica Colombiana NTC-589'),
    ('YOG-101', 'Yogur Entero', 'fermentacion',
     'Leche entera pasteurizada e inoculada con cultivos lácticos específicos. Incluye tratamiento térmico a 85-90 °C, enfriamiento a 45 °C, inoculación (8 h), maduración en frío (12 h), batido con adición de saborizante natural/azúcar y envasado.',
     'NTC-805 (Productos Lácteos Fermentados)'),
    ('KUM-102', 'Kumis Tradicional Fermentado', 'fermentacion',
     'Leche entera pasteurizada e inoculada con cultivo láctico específico para kumis. Incluye tratamiento térmico a 85-90 °C, enfriamiento a 45 °C, inoculación (8 h), maduración en frío (12 h), batido con adición de endulzante (sin saborizantes) y envasado.',
     'NTC-805'),
    ('YGR-103', 'Yogur Griego', 'fermentacion',
     'Producto lácteo fermentado de alta densidad y cremosidad. Incluye pasteurización a 85-90 °C, enfriamiento a 45 °C, inoculación (8 h), maduración en frío (12 h), proceso especial de filtrado en telas (16 h), batido con crema de leche y estevia opcional, y envasado.',
     'NTC-805 (Productos Lácteos Fermentados)')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2.1 Productos permitidos por línea  (ProductionLine.allowedProductIds)
-- ----------------------------------------------------------------------------
INSERT INTO lineas_productos_permitidos (linea_id, producto_id)
SELECT l.id, p.id
FROM (VALUES
    ('L-HILADA-01',  'QDC-PREM'),
    ('L-HILADA-01',  'QDC-IND'),
    ('L-HILADA-01',  'QP-2026'),
    ('L-HILADA-01',  'Q7C-2026'),
    ('L-FERMENT-02', 'YOG-101'),
    ('L-FERMENT-02', 'KUM-102'),
    ('L-FERMENT-02', 'YGR-103')
) AS v(linea_codigo, producto_codigo)
JOIN lineas_produccion l ON l.codigo = v.linea_codigo
JOIN productos         p ON p.codigo = v.producto_codigo
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. ETAPAS POR PRODUCTO  (Sidebar.tsx · navItems)
--    codigo_ui = StageId del frontend. Su significado depende del producto
--    (p. ej. 'desuerar' = "Cuarto Frío y Escurrido" en Yogur Griego).
--    El número ("1.", "2."...) del menú se guarda en orden_secuencia, no en el nombre.
--    Dulces: el frontend aún no define etapas para esa línea, por eso no se siembran.
-- ============================================================================
INSERT INTO etapas_catalogo (producto_id, codigo_ui, nombre, orden_secuencia)
SELECT p.id, v.codigo_ui, v.nombre, v.orden_secuencia
FROM (VALUES
    -- Yogur Entero (4 etapas; el yogur NO tiene "Cuarto Frío y Escurrido")
    ('YOG-101', 'acidificar',        'Pasteurizar Leche',      1),
    ('YOG-101', 'calentar-y-cuajar', 'Inocular e Incubar',     2),
    ('YOG-101', 'hilar',             'Batido',                 3),
    ('YOG-101', 'moldeo',            'Envasar y Guardar',      4),
    -- Kumis Tradicional (3 etapas)
    ('KUM-102', 'acidificar',        'Pasteurizar Leche',      1),
    ('KUM-102', 'calentar-y-cuajar', 'Inocular e Incubar',     2),
    ('KUM-102', 'moldeo',            'Envasar y Guardar',      3),
    -- Yogur Griego (5 etapas; "Cuarto Frío y Escurrido" solo existe aquí)
    ('YGR-103', 'acidificar',        'Pasteurizar Leche',      1),
    ('YGR-103', 'calentar-y-cuajar', 'Inocular e Incubar',     2),
    ('YGR-103', 'desuerar',          'Cuarto Frío y Escurrido',3),
    ('YGR-103', 'hilar',             'Batido',                 4),
    ('YGR-103', 'moldeo',            'Envasar y Guardar',      5),
    -- Queso 7 Cueros
    ('Q7C-2026', 'acidificar',        'Acidificar Leche',      1),
    ('Q7C-2026', 'calentar-y-cuajar', 'Cuajar y Calentar',     2),
    ('Q7C-2026', 'desuerar',          'Desuerar y Escurrir',   3),
    ('Q7C-2026', 'hilar',             'Hilar y Salar',         4),
    ('Q7C-2026', 'moldeo',            'Moldear y Pesar',       5),
    -- Queso Pera
    ('QP-2026',  'acidificar',        'Leche e Insumos',       1),
    ('QP-2026',  'calentar-y-cuajar', 'Premadurar y Cuajar',   2),
    ('QP-2026',  'desuerar',          'Desuerar y Escurrir',   3),
    ('QP-2026',  'hilar',             'Hilar y Salmueras',     4),
    ('QP-2026',  'moldeo',            'Moldear y Pesar',       5),
    -- Doble Crema Premium (rama por defecto del Sidebar)
    ('QDC-PREM', 'acidificar',        'Acidificar Leche',      1),
    ('QDC-PREM', 'calentar-y-cuajar', 'Calentar y Cuajar',     2),
    ('QDC-PREM', 'desuerar',          'Desuerar y Escurrir',   3),
    ('QDC-PREM', 'hilar',             'Hilar y Salar',         4),
    ('QDC-PREM', 'moldeo',            'Moldear y Pesar',       5),
    -- Doble Crema Industrial (misma rama por defecto del Sidebar)
    ('QDC-IND',  'acidificar',        'Acidificar Leche',      1),
    ('QDC-IND',  'calentar-y-cuajar', 'Calentar y Cuajar',     2),
    ('QDC-IND',  'desuerar',          'Desuerar y Escurrir',   3),
    ('QDC-IND',  'hilar',             'Hilar y Salar',         4),
    ('QDC-IND',  'moldeo',            'Moldear y Pesar',       5)
) AS v(producto_codigo, codigo_ui, nombre, orden_secuencia)
JOIN productos p ON p.codigo = v.producto_codigo
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. PARÁMETROS DE MEDICIÓN  (valores que el operario captura a mano)
--    Se incluyen solo campos que la UI usa. Los volúmenes y cantidades de insumos
--    (leche fresca/ácida, cuajo, azúcar, ácido acético...) NO son mediciones: van
--    a lote_insumos_utilizados. Tampoco se incluyen horas ni duraciones (hitos).
--    'masa_filtrada_kg' es obligatorio: lo consume la vista v_balance_materia_lote.
-- ============================================================================
INSERT INTO parametros_medicion (codigo, nombre, unidad) VALUES
    -- Fermentados (Yogur, Kumis, Yogur Griego)
    ('temperatura_recepcion',            'Temperatura de recepción de la leche',                          '°C'),
    ('ph_recepcion',                     'pH de recepción de la leche',                                   'pH'),
    ('acidez_dornic',                    'Acidez de la leche (Dornic)',                                   '°D'),
    ('temperatura_pasteurizacion',       'Temperatura alcanzada en pasteurización (85-90 °C)',            '°C'),
    ('temperatura_enfriamiento',         'Temperatura final de enfriamiento (45 °C yogur / 35 °C kumis)', '°C'),
    ('temperatura_inoculacion',          'Temperatura verificada al inocular',                            '°C'),
    ('temperatura_incubacion',           'Temperatura de la cámara de incubación',                        '°C'),
    ('ph_final_incubacion',              'pH final de incubación',                                        'pH'),
    ('velocidad_batido_rpm',             'Velocidad de batido',                                           'RPM'),
    ('masa_filtrada_kg',                 'Masa concentrada escurrida (Yogur Griego)',                     'kg'),
    ('suero_eliminado_estimado_litros',  'Suero eliminado estimado en el filtrado (Yogur Griego)',        'L'),
    -- Quesos de pasta hilada
    ('ph_mezcla',                        'pH de la leche (mezcla)',                                       'pH'),
    ('temperatura_acidificacion',        'Temperatura alcanzada al calentar la mezcla (35 °C)',           '°C'),
    ('temperatura_40_alcanzada',         'Temperatura alcanzada para el desuerado (40 °C)',               '°C'),
    ('ph_fin_reposo',                    'pH al finalizar el reposo (Queso Pera)',                        'pH'),
    ('temperatura_desuerado',            'Temperatura verificada en desuerado',                           '°C'),
    ('acidez_suero',                     'Acidez del lactosuero',                                         '% LA'),
    ('ph_escurrido',                     'pH en bandeja de escurrido',                                    'pH'),
    ('temperatura_bano_hilado',          'Temperatura del baño de hilado',                                '°C'),
    ('ph_hilado',                        'pH de hilado',                                                  'pH'),
    ('temperatura_salmuera_hilado',      'Temperatura de la salmuera caliente de hilado',                 '°C'),
    ('peso_total_queso_kg',              'Peso total de queso obtenido',                                  'kg'),
    ('numero_moldes',                    'Número de moldes llenados',                                     'unid')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. FORMATOS DE ENVASE
--    `codigo` = la clave exacta que usa el frontend en el estado del lote
--    (formatos.botella200ml, formatos.stevia_botella120ml, moldesDesglose.moldes400g...),
--    así la API puede mapear el payload sin tabla de traducción.
--    Fermentados se miden en litros (L); Yogur Griego y quesos en kilogramos (kg).
-- ============================================================================
INSERT INTO formatos_envase (codigo, descripcion, tipo_linea, categoria_variedad, capacidad_unitaria, unidad_medida) VALUES
    -- Yogur CON azúcar (FORMAT_CONFIGS_YOGUR_CON_AZUCAR). Kumis usa solo botella1L y botella2L
    -- (FORMAT_CONFIGS_KUMIS_CON_AZUCAR): son los mismos formatos físicos, no se duplican.
    ('botella200ml',           'Botella de 200 ml',                'fermentacion', 'con_azucar', 0.200, 'L'),
    ('botella1L',              'Botella de 1 L',                   'fermentacion', 'con_azucar', 1.000, 'L'),
    ('botella2L',              'Botella de 2 L',                   'fermentacion', 'con_azucar', 2.000, 'L'),
    ('bolsa4L',                'Bolsa de 4 L',                     'fermentacion', 'con_azucar', 4.000, 'L'),
    -- Yogur SIN azúcar - Natural (FORMAT_CONFIGS_SIN_AZUCAR_NATURAL)
    ('sinAzucar_botella200ml', 'Botella de 200 ml (Sin Azúcar)',   'fermentacion', 'sin_azucar', 0.200, 'L'),
    ('sinAzucar_botella1L',    'Botella de 1 L (Sin Azúcar)',      'fermentacion', 'sin_azucar', 1.000, 'L'),
    ('sinAzucar_botella2L',    'Botella de 2 L (Sin Azúcar)',      'fermentacion', 'sin_azucar', 2.000, 'L'),
    ('sinAzucar_bolsa4L',      'Bolsa de 4 L (Sin Azúcar)',        'fermentacion', 'sin_azucar', 4.000, 'L'),
    -- Yogur con Stevia (FORMAT_CONFIGS_CON_STEVIA)
    ('stevia_botella120ml',    'Botella de 120 ml (Stevia)',       'fermentacion', 'stevia',     0.120, 'L'),
    ('stevia_botella200ml',    'Botella de 200 ml (Stevia)',       'fermentacion', 'stevia',     0.200, 'L'),
    ('stevia_botella1L',       'Botella de 1 L (Stevia)',          'fermentacion', 'stevia',     1.000, 'L'),
    ('stevia_botella2L',       'Botella de 2 L (Stevia)',          'fermentacion', 'stevia',     2.000, 'L'),
    ('stevia_bolsa4L',         'Bolsa de 4 L (Stevia)',            'fermentacion', 'stevia',     4.000, 'L'),
    -- Yogur Griego (EnvasadoGriegoStage: 2 bloques x 3 envases; kg = 1.0 / 0.5 / 0.12).
    -- La UI escribe además los alias tarro1L / tarro500ml / vasito120ml con el mismo
    -- valor; no se siembran (son duplicados de tarrina1000g / 500g / 120g).
    ('griego_natural_tarrina1000g', 'Tarrina / Vaso 1000 g (Griego Natural)', 'fermentacion', 'natural', 1.000, 'kg'),
    ('griego_natural_tarrina500g',  'Tarrina / Vaso 500 g (Griego Natural)',  'fermentacion', 'natural', 0.500, 'kg'),
    ('griego_natural_tarrina120g',  'Tarrina / Vaso 120 g (Griego Natural)',  'fermentacion', 'natural', 0.120, 'kg'),
    ('griego_stevia_tarrina1000g',  'Tarrina / Vaso 1000 g (Griego con Stevia)', 'fermentacion', 'stevia', 1.000, 'kg'),
    ('griego_stevia_tarrina500g',   'Tarrina / Vaso 500 g (Griego con Stevia)',  'fermentacion', 'stevia', 0.500, 'kg'),
    ('griego_stevia_tarrina120g',   'Tarrina / Vaso 120 g (Griego con Stevia)',  'fermentacion', 'stevia', 0.120, 'kg'),
    ('griego_natural_bolsa4L',      'Bolsa de 4 L (Griego Natural)',             'fermentacion', 'natural', 4.000, 'kg'),
    ('griego_stevia_bolsa4L',       'Bolsa de 4 L (Griego con Stevia)',          'fermentacion', 'stevia',  4.000, 'kg'),
    -- Quesos: Doble Crema (MoldeoStage: 100/200/400/800/1600 g)
    ('moldes100g',  'Molde de 100 g',  'pasta_hilada', 'estandar', 0.100, 'kg'),
    ('moldes200g',  'Molde de 200 g',  'pasta_hilada', 'estandar', 0.200, 'kg'),
    ('moldes400g',  'Molde de 400 g',  'pasta_hilada', 'estandar', 0.400, 'kg'),
    ('moldes800g',  'Molde de 800 g',  'pasta_hilada', 'estandar', 0.800, 'kg'),
    ('moldes1600g', 'Molde de 1600 g', 'pasta_hilada', 'estandar', 1.600, 'kg'),
    -- Quesos: derivaciones de Queso Pera (Mexicano / Finas Hierbas: 100, 200 y 350 g).
    -- moldes100g y moldes200g se reutilizan; la derivación se distingue por derivacion_id.
    ('moldes350g',  'Molde de 350 g (derivaciones)', 'pasta_hilada', 'estandar', 0.350, 'kg'),
    -- Quesos: Queso Pera (MoldeoStagePera)
    ('moldesPeraGrande350g', 'Queso Pera Grande (350 g)',  'pasta_hilada', 'estandar', 0.350, 'kg'),
    ('moldesPeraPequeno60g', 'Queso Pera Pequeño (60 g)',  'pasta_hilada', 'estandar', 0.060, 'kg'),
    -- Quesos: Queso 7 Cueros (MoldeoStage7Cueros)
    ('moldes7Cueros350g',           'Queso 7 Cueros (350 g)',             'pasta_hilada', 'estandar', 0.350, 'kg'),
    ('moldesTrenza350g',            'Queso Trenza (350 g)',               'pasta_hilada', 'estandar', 0.350, 'kg'),
    ('moldesQuesadillaArequipe60g', 'Quesadilla con Arequipe (60 g)',     'pasta_hilada', 'estandar', 0.060, 'kg'),
    ('moldesQuesadillaBocadillo60g','Quesadilla con Bocadillo (60 g)',    'pasta_hilada', 'estandar', 0.060, 'kg')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. USUARIOS DE PRUEBA  (SOLO DESARROLLO)
--
-- !! NO usar estas credenciales fuera de desarrollo. Cambiarlas o desactivarlas
-- !! (activo = FALSE) antes de cualquier despliegue real.
--
-- Hash: bcrypt ($2a$, costo 10) generado aquí con pgcrypto -> crypt(clave, gen_salt('bf', 10)).
-- Es compatible con bcrypt.compare() de Node (paquete `bcrypt` / `bcryptjs`).
-- Un PIN de 4 dígitos tiene solo 10.000 combinaciones: aunque esté hasheado, se puede
-- adivinar por fuerza bruta; la API debe limitar intentos antes de usarlo en serio.
--
--   Código    Rol            PIN    Password      Origen
--   SA-001    superadmin     1234   1234          nuevo (no existe en el frontend)
--   ADM-901   administrador  9090   admin         INITIAL_USERS (usr-admin-1)
--   OP-104    operador       1040   1234          INITIAL_USERS (usr-op-1)
-- ============================================================================
INSERT INTO usuarios (codigo_empleado, nombre_completo, rol, turno, pin_hash, password_hash, linea_asignada_id)
VALUES
    ('SA-001',  'Superadmin QCS',       'superadmin',    'Jornada Continua',
        crypt('1234', gen_salt('bf', 10)), crypt('1234',  gen_salt('bf', 10)), NULL),
    ('ADM-901', 'Ing. David Rojas',     'administrador', 'Jornada Continua',
        crypt('9090', gen_salt('bf', 10)), crypt('admin', gen_salt('bf', 10)), NULL),
    ('OP-104',  'Carlos Mendoza',       'operador',      'Jornada Continua',
        crypt('1040', gen_salt('bf', 10)), crypt('1234',  gen_salt('bf', 10)),
        (SELECT id FROM lineas_produccion WHERE codigo = 'L-HILADA-01')),
    ('OP-105',  'Luisa Ramírez',        'operador',      'Jornada Continua',
        crypt('1050', gen_salt('bf', 10)), crypt('1234',  gen_salt('bf', 10)),
        (SELECT id FROM lineas_produccion WHERE codigo = 'L-FERMENT-02'))
ON CONFLICT DO NOTHING;

COMMIT;
