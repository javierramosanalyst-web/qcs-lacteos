-- ============================================================================
-- QCS PRO LÁCTEOS · ESTRUCTURA COMPLETA DE LA BASE DE DATOS (PostgreSQL)
--
-- Este archivo crea TODA la estructura: tipos, tablas, índices, funciones, vistas
-- y triggers de protección. No carga datos: los catálogos y el superadmin inicial
-- están en seed.sql.
--
-- USO (base de datos NUEVA y vacía), en este orden:
--   psql -U <usuario> -d <base> -f backend/database/init.sql
--   psql -U <usuario> -d <base> -f backend/database/seed.sql
--
-- No es idempotente (CREATE TYPE / CREATE TABLE sin IF NOT EXISTS): es para una
-- instalación limpia. Las bases ya existentes las actualiza el backend al arrancar
-- (backend/src/schema.ts), sin borrar datos.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- pgcrypto: hashes bcrypt de PIN y contraseñas (crypt / gen_salt).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 0. TIPOS ENUMERADOS
-- ============================================================================
CREATE TYPE tipo_linea_enum       AS ENUM ('pasta_hilada', 'fermentacion', 'dulces');
CREATE TYPE rol_usuario_enum      AS ENUM ('superadmin', 'administrador', 'operador');
CREATE TYPE estado_linea_enum     AS ENUM ('disponible', 'en_produccion', 'mantenimiento', 'limpieza_cip');
CREATE TYPE estado_lote_enum      AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'ANULADO');
CREATE TYPE motivo_cierre_enum    AS ENUM ('CUARTO_FRIO', 'DESVIO_TOTAL');
CREATE TYPE estado_etapa_enum     AS ENUM ('pendiente', 'en_proceso', 'completada');
CREATE TYPE accion_auditoria_enum AS ENUM ('RECTIFICACION', 'ANULACION');

-- ============================================================================
-- 1. GOBIERNO: LÍNEAS, USUARIOS, PRODUCTOS
-- ============================================================================
CREATE TABLE lineas_produccion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    tipo_linea tipo_linea_enum NOT NULL,
    capacidad_litros NUMERIC(10,2) NOT NULL CHECK (capacidad_litros > 0),
    estado estado_linea_enum NOT NULL DEFAULT 'disponible',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_empleado VARCHAR(30) UNIQUE NOT NULL,   -- con el que ingresa (lo define el administrador)
    primer_nombre VARCHAR(60),
    segundo_nombre VARCHAR(60),
    primer_apellido VARCHAR(60),
    segundo_apellido VARCHAR(60),
    nombre_completo VARCHAR(120) NOT NULL,         -- se arma solo con nombres y apellidos
    cedula VARCHAR(20) UNIQUE,                     -- solo dígitos; no se repite
    rol rol_usuario_enum NOT NULL,
    turno VARCHAR(40) NOT NULL DEFAULT 'Jornada Continua',
    pin_hash VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    linea_asignada_id UUID REFERENCES lineas_produccion(id) ON DELETE SET NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,   -- los usuarios no se borran: baja lógica
    sesiones_desde TIMESTAMPTZ,             -- sesiones emitidas antes de esta fecha quedan revocadas
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    tipo_linea tipo_linea_enum NOT NULL,
    descripcion TEXT,
    norma_tecnica VARCHAR(100) NOT NULL,           -- 'NTC-589', 'NTC-805'
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Equivale a ProductionLine.allowedProductIds (relación N:M, 1FN)
CREATE TABLE lineas_productos_permitidos (
    linea_id UUID NOT NULL REFERENCES lineas_produccion(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    PRIMARY KEY (linea_id, producto_id)
);

CREATE TABLE recetas_estandares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    version_receta INTEGER NOT NULL DEFAULT 1,
    temp_pasteurizacion_min NUMERIC(5,2),
    temp_pasteurizacion_max NUMERIC(5,2),
    tiempo_sostenimiento_segundos INTEGER,
    temp_enfriamiento_objetivo NUMERIC(5,2),
    temp_incubacion_objetivo NUMERIC(5,2),
    tiempo_incubacion_min_segundos INTEGER,
    ph_objetivo_corte NUMERIC(4,2),
    dias_vida_util_vencimiento INTEGER,
    especificaciones_json JSONB NOT NULL,          -- documento congelado de la receta
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (producto_id, version_receta)
);

-- Etapas por PRODUCTO: yogur (4), kumis (3), griego (5), quesos (5).
-- 'codigo_ui' es el StageId del frontend, cuyo significado depende del producto.
CREATE TABLE etapas_catalogo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    codigo_ui VARCHAR(40) NOT NULL,                -- 'acidificar','calentar-y-cuajar','desuerar','hilar','moldeo'
    nombre VARCHAR(100) NOT NULL,
    orden_secuencia INTEGER NOT NULL,
    UNIQUE (producto_id, codigo_ui),
    UNIQUE (producto_id, orden_secuencia)
);

-- ============================================================================
-- 2. CATÁLOGOS DE MEDICIÓN, INSUMOS Y ENVASES (3FN)
-- ============================================================================
CREATE TABLE parametros_medicion (
    codigo VARCHAR(60) PRIMARY KEY,                -- 'temperatura_alcanzada','ph_mezcla','acidez_suero','masa_filtrada_kg'...
    nombre VARCHAR(120) NOT NULL,
    unidad VARCHAR(20) NOT NULL                    -- '°C','pH','% LA','°D','RPM','kg','L'
);

CREATE TABLE tipos_insumo (
    codigo VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    unidad_base VARCHAR(20) NOT NULL,
    gestionable_admin BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE insumos_catalogo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(40) UNIQUE NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    tipo_insumo VARCHAR(50) NOT NULL
        CONSTRAINT fk_insumos_catalogo_tipo REFERENCES tipos_insumo(codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
    unidad_base VARCHAR(20) NOT NULL,              -- 'L','g','kg','ml','unidades','cucharadas'
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sabores de yogur: no tienen tabla propia. El sabor es la descripción de cada lote de
-- saborizante (insumos_lotes.descripcion), y es lo que el operario elige en "Receta y Sabores".

-- Lotes de insumo recibidos (bultos, frascos). Permite trazabilidad hacia atrás.
CREATE TABLE insumos_lotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insumo_id UUID NOT NULL REFERENCES insumos_catalogo(id) ON DELETE RESTRICT,
    codigo_lote VARCHAR(80) NOT NULL,
    descripcion VARCHAR(200),
    proveedor VARCHAR(150),
    fecha_vencimiento DATE,
    cantidad_recibida NUMERIC(12,3)
        CONSTRAINT chk_insumos_lotes_cantidad CHECK (cantidad_recibida IS NULL OR cantidad_recibida >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    eliminado_at TIMESTAMPTZ,               -- en papelera (se borra solo pasado el plazo)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (insumo_id, codigo_lote)
);

CREATE TABLE formatos_envase (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(60) UNIQUE NOT NULL,            -- 'botella_200ml','tarro_1L','tarrina_500g','molde_400g','pera_grande_350g'
    descripcion VARCHAR(120) NOT NULL,
    tipo_linea tipo_linea_enum NOT NULL,
    categoria_variedad VARCHAR(50) NOT NULL DEFAULT 'estandar', -- 'con_azucar','sin_azucar','stevia','natural'
    capacidad_unitaria NUMERIC(10,3) NOT NULL CHECK (capacidad_unitaria > 0),
    unidad_medida VARCHAR(10) NOT NULL CHECK (unidad_medida IN ('L','kg')),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================================
-- 3. LOTES PADRE (RECEPCIÓN DE LECHE)
--    Reservado para registrar la leche recibida antes de repartirla en lotes. La
--    aplicación todavía no tiene esa pantalla: hoy cada lote empieza con su propio volumen.
-- ============================================================================
CREATE TABLE lotes_padre (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_lote VARCHAR(50) UNIQUE NOT NULL,
    linea_id UUID NOT NULL REFERENCES lineas_produccion(id) ON DELETE RESTRICT,
    responsable_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_produccion DATE NOT NULL DEFAULT CURRENT_DATE,
    total_leche_litros NUMERIC(10,2) NOT NULL CHECK (total_leche_litros > 0),
    litros_asignados NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (litros_asignados >= 0),
    litros_remanentes NUMERIC(10,2) NOT NULL CHECK (litros_remanentes >= 0),
    proveedor_principal VARCHAR(150) NOT NULL,
    lote_leche_proveedor VARCHAR(80) NOT NULL,
    estado estado_lote_enum NOT NULL DEFAULT 'PENDIENTE',
    iniciado_at TIMESTAMPTZ,
    dividido_at TIMESTAMPTZ,
    finalizado_at TIMESTAMPTZ,
    observaciones TEXT,
    -- Anulación manual por administrador (decisión de gerencia #1)
    anulado_at TIMESTAMPTZ,
    anulado_por_id UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    motivo_anulacion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_balance_leche_padre CHECK (litros_asignados + litros_remanentes = total_leche_litros),
    -- Se exige motivo NOT NULL de forma explícita: length(NULL) >= 15 daría NULL y el CHECK pasaría.
    CONSTRAINT chk_anulacion_padre CHECK (
        estado <> 'ANULADO'
        OR (anulado_at IS NOT NULL AND anulado_por_id IS NOT NULL
            AND motivo_anulacion IS NOT NULL AND length(trim(motivo_anulacion)) >= 15)
    )
);

CREATE TABLE lote_padre_recepcion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_padre_id UUID NOT NULL UNIQUE REFERENCES lotes_padre(id) ON DELETE CASCADE,
    temperatura_recepcion_celsius NUMERIC(5,2) NOT NULL,
    acidez_dornic NUMERIC(5,2),
    ph_recepcion NUMERIC(4,2),
    observaciones_plataforma TEXT,
    registrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. LOTES DE PRODUCCIÓN (QUESOS Y FERMENTADOS)
-- ============================================================================
CREATE TABLE lotes_produccion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_lote VARCHAR(50) UNIQUE NOT NULL,
    lote_dia VARCHAR(5),                -- Lote visible por día en letras (DD+M+AA); lo asigna trg_asignar_lote_dia
    producto_ui_id VARCHAR(60),         -- id del producto en la aplicación (prod-yogur, prod-queso-pera...)
    lote_padre_id UUID REFERENCES lotes_padre(id) ON DELETE RESTRICT,       -- leche de origen (NULL en quesos directos)
    lote_origen_id UUID REFERENCES lotes_produccion(id) ON DELETE RESTRICT, -- lote del que se desvió el volumen (Kumis/Griego desde Yogur)
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    linea_id UUID NOT NULL REFERENCES lineas_produccion(id) ON DELETE RESTRICT,
    responsable_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,

    -- Snapshots inmutables
    norma_tecnica_aplicada VARCHAR(100) NOT NULL,
    receta_snapshot JSONB NOT NULL,

    -- Formulación
    variante_fermentado VARCHAR(30)
        CHECK (variante_fermentado IN ('yogur_con_azucar','yogur_sin_azucar','kumis','yogur_griego')),
    volumen_leche_base_litros NUMERIC(10,2) NOT NULL CHECK (volumen_leche_base_litros >= 0),
    lleva_azucar BOOLEAN NOT NULL DEFAULT TRUE,

    -- Estado y tiempos
    estado estado_lote_enum NOT NULL DEFAULT 'EN_PROCESO',
    en_ajuste BOOLEAN NOT NULL DEFAULT FALSE,            -- equivale a 'EN AJUSTE' del frontend
    etapa_actual_codigo VARCHAR(40) NOT NULL DEFAULT 'acidificar',
    iniciado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalizado_at TIMESTAMPTZ,
    duracion_total_segundos INTEGER,

    -- Cierre: fin del ciclo = ingreso a cuarto frío (decisión #5) o desvío total
    motivo_cierre motivo_cierre_enum,
    ingreso_cuarto_frio_at TIMESTAMPTZ,
    temp_almacenamiento_celsius NUMERIC(5,2),
    lote_producto_terminado VARCHAR(80),
    fecha_vencimiento DATE,
    observaciones_finales TEXT,
    finalizado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,

    -- Estado completo del lote tal como lo registró la aplicación (de aquí se reparte a las tablas de detalle)
    estado_ui JSONB,

    -- Anulación manual por administrador (decisión #1)
    anulado_at TIMESTAMPTZ,
    anulado_por_id UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    motivo_anulacion TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_cierre_completado CHECK (
        estado <> 'COMPLETADO' OR (motivo_cierre IS NOT NULL AND finalizado_at IS NOT NULL)
    ),
    CONSTRAINT chk_cierre_cuarto_frio CHECK (
        motivo_cierre IS DISTINCT FROM 'CUARTO_FRIO' OR ingreso_cuarto_frio_at IS NOT NULL
    ),
    CONSTRAINT chk_anulacion_lote CHECK (
        estado <> 'ANULADO'
        OR (anulado_at IS NOT NULL AND anulado_por_id IS NOT NULL
            AND motivo_anulacion IS NOT NULL AND length(trim(motivo_anulacion)) >= 15)
    )
);
-- NOTA: no existe columna de rendimiento ni de merma. Se DERIVAN en la vista
-- v_balance_materia_lote con matemática estricta, sin tolerancias (decisión #2).

CREATE TABLE lote_operarios_intervinientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id UUID NOT NULL REFERENCES lotes_produccion(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    rol_en_proceso VARCHAR(80) NOT NULL DEFAULT 'Operador de Etapa',
    asignado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lote_id, usuario_id)
);

-- Operarios que trabajaron en cada etapa (primera y última acción)
CREATE TABLE lote_etapa_operarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id UUID NOT NULL REFERENCES lotes_produccion(id) ON DELETE CASCADE,
    etapa_codigo VARCHAR(40) NOT NULL,
    fase_nombre VARCHAR(120) NOT NULL,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    primera_accion_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_accion_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lote_id, etapa_codigo, usuario_id)
);

-- Historial append-only de desvíos de volumen (Kumis / Griego) con reversibilidad
CREATE TABLE lote_extracciones_sublote (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_origen_id UUID NOT NULL REFERENCES lotes_produccion(id) ON DELETE RESTRICT,
    lote_destino_id UUID NOT NULL REFERENCES lotes_produccion(id) ON DELETE RESTRICT,
    etapa_origen_codigo VARCHAR(40) NOT NULL,       -- 'acidificar' (Kumis) o etapa de cuarto frío (Griego)
    litros_anteriores NUMERIC(10,2) NOT NULL CHECK (litros_anteriores >= 0),
    litros_nuevos NUMERIC(10,2) NOT NULL CHECK (litros_nuevos >= 0),
    es_desvio_total BOOLEAN NOT NULL DEFAULT FALSE,
    operario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    registrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (lote_origen_id <> lote_destino_id)
);

-- ============================================================================
-- 5. ETAPAS, HITOS Y MEDICIONES
-- ============================================================================
CREATE TABLE lote_etapas_ejecucion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id UUID NOT NULL REFERENCES lotes_produccion(id) ON DELETE CASCADE,
    etapa_catalogo_id UUID NOT NULL REFERENCES etapas_catalogo(id) ON DELETE RESTRICT,
    estado estado_etapa_enum NOT NULL DEFAULT 'pendiente',
    iniciado_at TIMESTAMPTZ,
    finalizado_at TIMESTAMPTZ,
    duracion_segundos INTEGER,
    operario_responsable_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lote_id, etapa_catalogo_id)
);

-- Sub-pasos cronometrados de una etapa (calentamiento, sostenimiento, enfriamiento,
-- trasiego, inoculación, incubación, cuarto frío, filtrado en telas, batido, cuajado,
-- corte, desuerado, escurrido, hilado, extruido...). Reemplaza los pares hora*/timestamp*.
CREATE TABLE lote_hitos_proceso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_etapa_id UUID NOT NULL REFERENCES lote_etapas_ejecucion(id) ON DELETE CASCADE,
    lote_id UUID NOT NULL REFERENCES lotes_produccion(id) ON DELETE CASCADE,
    codigo_hito VARCHAR(60) NOT NULL,
    iniciado_at TIMESTAMPTZ,
    finalizado_at TIMESTAMPTZ,
    duracion_segundos INTEGER,
    es_captura_manual BOOLEAN NOT NULL DEFAULT FALSE,   -- hora editada a mano (PopoverTimePicker)
    operario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    registrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lote_etapa_id, codigo_hito),
    CHECK (finalizado_at IS NULL OR iniciado_at IS NULL OR finalizado_at >= iniciado_at)
);

CREATE TABLE mediciones_fisicoquimicas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_etapa_id UUID NOT NULL REFERENCES lote_etapas_ejecucion(id) ON DELETE CASCADE,
    lote_id UUID NOT NULL REFERENCES lotes_produccion(id) ON DELETE CASCADE,
    parametro_codigo VARCHAR(60) NOT NULL REFERENCES parametros_medicion(codigo) ON DELETE RESTRICT,
    valor_numerico NUMERIC(10,3) NOT NULL,
    es_captura_manual BOOLEAN NOT NULL DEFAULT FALSE,
    registrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ============================================================================
-- 6. DERIVACIONES DE QUESOS, INSUMOS Y ENVASADO
-- ============================================================================
CREATE TABLE lote_derivaciones_quesos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id UUID NOT NULL REFERENCES lotes_produccion(id) ON DELETE CASCADE,
    tipo_derivacion VARCHAR(60) NOT NULL
        CHECK (tipo_derivacion IN ('mexicano','finas_hierbas','quesadilla_arequipe','quesadilla_bocadillo')),
    codigo_sub_lote VARCHAR(60) NOT NULL,
    lote_base_origen VARCHAR(60),
    peso_pasta_utilizado_kg NUMERIC(10,3),
    es_edicion_manual BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lote_id, tipo_derivacion)
);

CREATE TABLE lote_insumos_utilizados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id UUID NOT NULL REFERENCES lotes_produccion(id) ON DELETE CASCADE,
    lote_etapa_id UUID REFERENCES lote_etapas_ejecucion(id) ON DELETE SET NULL,
    derivacion_id UUID REFERENCES lote_derivaciones_quesos(id) ON DELETE CASCADE,
    insumo_lote_id UUID REFERENCES insumos_lotes(id) ON DELETE RESTRICT,
    -- Snapshot: sobrevive a cambios o bajas del maestro
    tipo_insumo VARCHAR(50) NOT NULL
        CONSTRAINT fk_insumos_utilizados_tipo REFERENCES tipos_insumo(codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
    insumo_nombre_snapshot VARCHAR(120) NOT NULL,
    codigo_lote_insumo VARCHAR(80) NOT NULL,
    proveedor VARCHAR(150),
    unidad_medida VARCHAR(20) NOT NULL,
    peso_inicial_gramos NUMERIC(10,3),              -- pesaje de especias / arequipe / bocadillo
    peso_final_gramos NUMERIC(10,3),
    cantidad_utilizada NUMERIC(10,3) NOT NULL CHECK (cantidad_utilizada >= 0),
    es_dosificacion_manual BOOLEAN NOT NULL DEFAULT FALSE,
    registrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    -- Matemática estricta: utilizado = inicial - final (sin ajustes)
    CONSTRAINT chk_peso_utilizado CHECK (
        peso_inicial_gramos IS NULL OR peso_final_gramos IS NULL
        OR cantidad_utilizada = peso_inicial_gramos - peso_final_gramos
    )
);

CREATE TABLE lote_presentaciones_envasado (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id UUID NOT NULL REFERENCES lotes_produccion(id) ON DELETE CASCADE,
    derivacion_id UUID REFERENCES lote_derivaciones_quesos(id) ON DELETE CASCADE,
    formato_id UUID NOT NULL REFERENCES formatos_envase(id) ON DELETE RESTRICT,
    -- Snapshot del formato
    descripcion_formato VARCHAR(120) NOT NULL,
    capacidad_unitaria NUMERIC(10,3) NOT NULL CHECK (capacidad_unitaria > 0),
    unidad_medida VARCHAR(10) NOT NULL CHECK (unidad_medida IN ('L','kg')),
    categoria_variedad VARCHAR(50) NOT NULL DEFAULT 'estandar',
    unidades_conteo INTEGER NOT NULL CHECK (unidades_conteo >= 0),
    total_volumen_o_peso NUMERIC(12,3) GENERATED ALWAYS AS (unidades_conteo * capacidad_unitaria) STORED,
    es_captura_manual BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- El UNIQUE (lote_id, derivacion_id, formato_id, categoria_variedad) del documento no
-- protege cuando derivacion_id es NULL (en PostgreSQL los NULL son distintos entre sí).
-- Se implementa con dos índices únicos parciales, que cubren ambos casos.
CREATE UNIQUE INDEX uq_presentacion_lote_formato
    ON lote_presentaciones_envasado (lote_id, formato_id, categoria_variedad)
    WHERE derivacion_id IS NULL;
CREATE UNIQUE INDEX uq_presentacion_derivacion_formato
    ON lote_presentaciones_envasado (lote_id, derivacion_id, formato_id, categoria_variedad)
    WHERE derivacion_id IS NOT NULL;

-- ============================================================================
-- 6.1 TRABAJO EN CURSO (lo que el operario va registrando antes y durante el lote)
-- ============================================================================
-- Borrador de cada producto: se guarda solo mientras el operario trabaja. Al iniciar el
-- lote queda enlazado (lote_id); los borradores sin lote se borran tras 8 h sin cambios.
CREATE TABLE borradores_lote (
    producto_ui_id VARCHAR(60) PRIMARY KEY,
    linea_id UUID NOT NULL REFERENCES lineas_produccion(id) ON DELETE RESTRICT,
    estado JSONB NOT NULL,
    etapa_actual VARCHAR(40) NOT NULL DEFAULT 'acidificar',
    version INTEGER NOT NULL DEFAULT 1,
    lote_id UUID REFERENCES lotes_produccion(id) ON DELETE SET NULL,
    actualizado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Estado de la pantalla de cada línea (qué producto está abierto, etc.).
CREATE TABLE espacio_trabajo_linea (
    linea_id UUID PRIMARY KEY REFERENCES lineas_produccion(id) ON DELETE CASCADE,
    estado JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    actualizado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consecutivo del código interno de lote (PRODUCTO-AAAAMMDD-NNN).
CREATE SEQUENCE seq_codigo_lote START 1;

-- ============================================================================
-- 7. AUDITORÍA INMUTABLE (RECTIFICACIONES Y ANULACIONES)
-- ============================================================================
CREATE TABLE auditoria_rectificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    accion accion_auditoria_enum NOT NULL DEFAULT 'RECTIFICACION',
    lote_id UUID REFERENCES lotes_produccion(id) ON DELETE RESTRICT,
    lote_padre_id UUID REFERENCES lotes_padre(id) ON DELETE RESTRICT,
    etapa_codigo VARCHAR(40),
    etapa_label VARCHAR(80),
    -- Destino exacto del dato modificado (fila física)
    tabla_destino VARCHAR(60) NOT NULL,
    registro_destino_id UUID NOT NULL,
    campo_modificado VARCHAR(100) NOT NULL,
    campo_label VARCHAR(120) NOT NULL,
    valor_anterior VARCHAR(255) NOT NULL,
    valor_nuevo VARCHAR(255) NOT NULL,
    unidad VARCHAR(30),
    categoria_motivo VARCHAR(150) NOT NULL,
    justificacion_tecnica TEXT NOT NULL CHECK (length(trim(justificacion_tecnica)) >= 15),
    autorizado_por_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    ip_address VARCHAR(45),
    registrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_un_solo_lote CHECK (num_nonnulls(lote_id, lote_padre_id) = 1)
);

-- ============================================================================
-- 8. ÍNDICES
-- ============================================================================
CREATE INDEX idx_lotes_produccion_estado    ON lotes_produccion(estado);
CREATE INDEX idx_lotes_produccion_fecha     ON lotes_produccion(iniciado_at);
CREATE INDEX idx_lotes_produccion_padre     ON lotes_produccion(lote_padre_id);
CREATE INDEX idx_lotes_produccion_origen    ON lotes_produccion(lote_origen_id);
CREATE INDEX idx_lotes_produccion_producto  ON lotes_produccion(producto_id, iniciado_at);
CREATE INDEX idx_lotes_produccion_producto_ui ON lotes_produccion(producto_ui_id, estado);
CREATE INDEX idx_lotes_produccion_lote_dia  ON lotes_produccion(lote_dia);
CREATE INDEX idx_hitos_lote                 ON lote_hitos_proceso(lote_id, codigo_hito);
CREATE INDEX idx_mediciones_lote_param      ON mediciones_fisicoquimicas(lote_id, parametro_codigo, registrado_at);
CREATE INDEX idx_insumos_usados_lote        ON lote_insumos_utilizados(lote_id);
CREATE INDEX idx_insumos_usados_lote_insumo ON lote_insumos_utilizados(insumo_lote_id);  -- trazabilidad hacia adelante
CREATE INDEX idx_extracciones_origen        ON lote_extracciones_sublote(lote_origen_id, registrado_at);
CREATE INDEX idx_auditoria_lote             ON auditoria_rectificaciones(lote_id);
CREATE INDEX idx_auditoria_padre            ON auditoria_rectificaciones(lote_padre_id);
CREATE INDEX idx_auditoria_fecha            ON auditoria_rectificaciones(registrado_at);
CREATE INDEX idx_insumos_catalogo_tipo      ON insumos_catalogo(tipo_insumo);
CREATE INDEX idx_insumos_utilizados_tipo    ON lote_insumos_utilizados(tipo_insumo);
CREATE INDEX idx_lote_etapa_operarios_lote  ON lote_etapa_operarios(lote_id);
CREATE INDEX idx_lote_etapa_operarios_usuario ON lote_etapa_operarios(usuario_id);
CREATE INDEX idx_borradores_lote_linea      ON borradores_lote(linea_id);

-- ============================================================================
-- 9. VISTA DE BALANCE DE MATERIA (matemática estricta, sin tolerancias)
--    Sin GREATEST / factores de corrección / recortes. Un resultado negativo se muestra negativo.
-- ============================================================================
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

-- ============================================================================
-- 10. TRIGGERS DE SEGURIDAD (versión corregida)
--
-- Variables de sesión (solo con SET LOCAL dentro de una transacción autorizada):
--   app.allow_admin_override    = 'true'  -> rectificación / anulación por Admin o Superadmin
--   app.allow_extraction_reopen = 'true'  -> reapertura por reversión de un cierre DESVIO_TOTAL
-- ============================================================================

-- 10.1 Cabeceras: lotes_produccion y lotes_padre
CREATE OR REPLACE FUNCTION fn_bloquear_cabecera_cerrada() RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.allow_admin_override', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- Reapertura controlada: solo un lote cerrado por DESVIO_TOTAL, desde el endpoint de extracción.
    -- Se lee motivo_cierre vía to_jsonb porque lotes_padre no tiene esa columna: referenciar
    -- OLD.motivo_cierre directamente fallaría en tiempo de ejecución para esa tabla.
    IF TG_TABLE_NAME = 'lotes_produccion'
       AND TG_OP = 'UPDATE'
       AND current_setting('app.allow_extraction_reopen', true) = 'true'
       AND OLD.estado = 'COMPLETADO'
       AND (to_jsonb(OLD) ->> 'motivo_cierre') = 'DESVIO_TOTAL' THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'SEGURIDAD INDUSTRIAL: % % está % y no admite modificaciones directas.',
        TG_TABLE_NAME, OLD.id, OLD.estado USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lock_lotes_produccion
    BEFORE UPDATE OR DELETE ON lotes_produccion
    FOR EACH ROW WHEN (OLD.estado IN ('COMPLETADO','ANULADO'))
    EXECUTE FUNCTION fn_bloquear_cabecera_cerrada();

CREATE TRIGGER trg_lock_lotes_padre
    BEFORE UPDATE OR DELETE ON lotes_padre
    FOR EACH ROW WHEN (OLD.estado IN ('COMPLETADO','ANULADO'))
    EXECUTE FUNCTION fn_bloquear_cabecera_cerrada();

-- 10.2 Tablas hijas (lote_id, lote_origen_id o lote_padre_id)
CREATE OR REPLACE FUNCTION fn_bloquear_hijas_de_lote_cerrado() RETURNS TRIGGER AS $$
DECLARE
    v_fila   JSONB := to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END);
    v_estado estado_lote_enum;
    v_motivo motivo_cierre_enum;
    v_lote   UUID := COALESCE((v_fila ->> 'lote_id')::uuid, (v_fila ->> 'lote_origen_id')::uuid);
    v_padre  UUID := (v_fila ->> 'lote_padre_id')::uuid;
BEGIN
    IF current_setting('app.allow_admin_override', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    IF v_lote IS NOT NULL THEN
        SELECT estado, motivo_cierre INTO v_estado, v_motivo
        FROM lotes_produccion WHERE id = v_lote;
    ELSIF v_padre IS NOT NULL THEN
        SELECT estado, NULL::motivo_cierre_enum INTO v_estado, v_motivo
        FROM lotes_padre WHERE id = v_padre;
    END IF;

    IF v_estado IN ('COMPLETADO','ANULADO') THEN
        IF current_setting('app.allow_extraction_reopen', true) = 'true'
           AND v_estado = 'COMPLETADO' AND v_motivo = 'DESVIO_TOTAL' THEN
            IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
        END IF;
        RAISE EXCEPTION 'SEGURIDAD INDUSTRIAL: el lote asociado a % está % y es de solo lectura.',
            TG_TABLE_NAME, v_estado USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lock_lote_etapas_ejecucion
    BEFORE INSERT OR UPDATE OR DELETE ON lote_etapas_ejecucion
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_hijas_de_lote_cerrado();

CREATE TRIGGER trg_lock_lote_hitos_proceso
    BEFORE INSERT OR UPDATE OR DELETE ON lote_hitos_proceso
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_hijas_de_lote_cerrado();

CREATE TRIGGER trg_lock_mediciones_fisicoquimicas
    BEFORE INSERT OR UPDATE OR DELETE ON mediciones_fisicoquimicas
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_hijas_de_lote_cerrado();

CREATE TRIGGER trg_lock_lote_insumos_utilizados
    BEFORE INSERT OR UPDATE OR DELETE ON lote_insumos_utilizados
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_hijas_de_lote_cerrado();

CREATE TRIGGER trg_lock_lote_presentaciones_envasado
    BEFORE INSERT OR UPDATE OR DELETE ON lote_presentaciones_envasado
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_hijas_de_lote_cerrado();

CREATE TRIGGER trg_lock_lote_derivaciones_quesos
    BEFORE INSERT OR UPDATE OR DELETE ON lote_derivaciones_quesos
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_hijas_de_lote_cerrado();

CREATE TRIGGER trg_lock_lote_operarios_intervinientes
    BEFORE INSERT OR UPDATE OR DELETE ON lote_operarios_intervinientes
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_hijas_de_lote_cerrado();

CREATE TRIGGER trg_lock_lote_padre_recepcion
    BEFORE INSERT OR UPDATE OR DELETE ON lote_padre_recepcion
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_hijas_de_lote_cerrado();

CREATE TRIGGER trg_lock_lote_extracciones_sublote
    BEFORE INSERT OR UPDATE OR DELETE ON lote_extracciones_sublote
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_hijas_de_lote_cerrado();

CREATE TRIGGER trg_lock_lote_etapa_operarios
    BEFORE INSERT OR UPDATE OR DELETE ON lote_etapa_operarios
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_hijas_de_lote_cerrado();

-- 10.3 La auditoría es append-only para TODOS, incluido SuperAdmin
CREATE OR REPLACE FUNCTION fn_auditoria_inmutable() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'auditoria_rectificaciones es de solo inserción.' USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_inmutable
    BEFORE UPDATE OR DELETE ON auditoria_rectificaciones
    FOR EACH ROW EXECUTE FUNCTION fn_auditoria_inmutable();

-- TRUNCATE no dispara triggers por fila; se bloquea con un trigger por sentencia.
CREATE TRIGGER trg_auditoria_sin_truncate
    BEFORE TRUNCATE ON auditoria_rectificaciones
    FOR EACH STATEMENT EXECUTE FUNCTION fn_auditoria_inmutable();

REVOKE UPDATE, DELETE, TRUNCATE ON auditoria_rectificaciones FROM PUBLIC;

-- ============================================================================
-- 11. LOTE POR DÍA (5 letras): DD + M + AA, con la fecha de INICIO del lote en hora
-- de Colombia. Dígitos 1..9,0 -> A..J ; meses enero..diciembre -> A..L.
-- Ej.: 12/10/2026 -> "AB" + "J" + "BF" = ABJBF. Todos los lotes que arrancan el mismo
-- día comparten estas letras; el código interno (codigo_lote) y el id siguen siendo únicos.
-- ============================================================================
CREATE FUNCTION fn_lote_dia(ts TIMESTAMPTZ) RETURNS VARCHAR(5)
LANGUAGE sql STABLE AS $$
    SELECT translate(to_char(ts AT TIME ZONE 'America/Bogota', 'DD'), '1234567890', 'ABCDEFGHIJ')
        || substr('ABCDEFGHIJKL', EXTRACT(MONTH FROM ts AT TIME ZONE 'America/Bogota')::int, 1)
        || translate(to_char(ts AT TIME ZONE 'America/Bogota', 'YY'), '1234567890', 'ABCDEFGHIJ');
$$;

CREATE FUNCTION fn_asignar_lote_dia() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lote_dia IS NULL THEN
        NEW.lote_dia := fn_lote_dia(COALESCE(NEW.iniciado_at, NOW()));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asignar_lote_dia
    BEFORE INSERT ON lotes_produccion
    FOR EACH ROW EXECUTE FUNCTION fn_asignar_lote_dia();

-- ============================================================================
-- 12. BITÁCORA DE ACCESOS (inicios de sesión, intentos fallidos, bloqueos, cambios de
-- usuarios y claves). La escribe el servidor automáticamente; nunca guarda PIN ni
-- contraseñas. Solo inserción: no se puede editar ni borrar fila por fila. Para dejarla
-- en cero antes de producción se usa deploy/limpiar-datos-de-prueba.sh.
-- ============================================================================
CREATE TABLE eventos_seguridad (
    id              BIGSERIAL PRIMARY KEY,
    evento          VARCHAR(40) NOT NULL,
    usuario_id      UUID,
    codigo_empleado VARCHAR(40),
    actor_id        UUID,
    detalle         VARCHAR(300),
    ip              VARCHAR(64),
    registrado_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_eventos_seguridad_fecha ON eventos_seguridad(registrado_at DESC);

CREATE FUNCTION fn_eventos_seguridad_inmutable() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'eventos_seguridad es de solo inserción.' USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_eventos_seguridad_inmutable
    BEFORE UPDATE OR DELETE ON eventos_seguridad
    FOR EACH ROW EXECUTE FUNCTION fn_eventos_seguridad_inmutable();

COMMIT;
