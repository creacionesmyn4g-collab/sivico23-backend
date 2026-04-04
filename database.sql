-- ============================================================
-- SIVICO23 FASE 2 — Base de Datos Maestra (PostgreSQL)
-- Modelo Normalizado 3FN — Arquitectura de 10 Tablas
-- Archivo unificado para despliegue en Railway
-- ============================================================
CREATE EXTENSION IF NOT EXISTS unaccent;


-- 1. LIMPIEZA INICIAL
DROP TABLE IF EXISTS medicamentos CASCADE;
DROP TABLE IF EXISTS tratamientos CASCADE;
DROP TABLE IF EXISTS registros CASCADE;
DROP TABLE IF EXISTS pacientes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS alertas_emergencia CASCADE;
DROP TABLE IF EXISTS sectores CASCADE;
DROP TABLE IF EXISTS patologias_cie10 CASCADE;
DROP TABLE IF EXISTS categorias_cie10 CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS notificaciones_usuarios CASCADE;
DROP TABLE IF EXISTS jornadas_salud CASCADE;
DROP TABLE IF EXISTS registro_vacunacion CASCADE;
DROP TABLE IF EXISTS cat_vacunas_mpps CASCADE;
DROP TABLE IF EXISTS paciente_discapacidades CASCADE;
DROP TABLE IF EXISTS cat_discapacidades CASCADE;
DROP TABLE IF EXISTS auditoria_pacientes CASCADE;
DROP VIEW IF EXISTS vista_registros_completos CASCADE;

-- 2. TABLAS DE CATÁLOGO MAESTRAS (Nivel 1 de normalización)
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categorias_cie10 (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sectores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patologias_cie10 (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) UNIQUE NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    categoria_id INTEGER REFERENCES categorias_cie10(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA: usuarios (Normalizada con FK a roles y sectores)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    sector_id INTEGER REFERENCES sectores(id) ON DELETE SET NULL,
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_login TIMESTAMP
);

-- 4. TABLA: pacientes
CREATE TABLE pacientes (
    id SERIAL PRIMARY KEY,
    cedula VARCHAR(20),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    sexo VARCHAR(10) CHECK (sexo IN ('Masculino', 'Femenino', 'Otro', '')),
    telefono VARCHAR(20),
    direccion TEXT,
    sector_id INTEGER REFERENCES sectores(id) ON DELETE SET NULL,
    cedula_representante VARCHAR(20), 
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_pacientes_cedula_unique ON pacientes(cedula) WHERE cedula IS NOT NULL;

-- 5. TABLA: registros (Encuentros médicos)
CREATE TABLE registros (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA: tratamientos (Diagnósticos)
CREATE TABLE tratamientos (
    id SERIAL PRIMARY KEY,
    registro_id INTEGER NOT NULL REFERENCES registros(id) ON DELETE CASCADE,
    patologia_id INTEGER NOT NULL REFERENCES patologias_cie10(id) ON DELETE RESTRICT,
    descripcion TEXT, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLA: medicamentos
CREATE TABLE medicamentos (
    id SERIAL PRIMARY KEY,
    tratamiento_id INTEGER NOT NULL REFERENCES tratamientos(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    presentacion VARCHAR(100),
    dosis VARCHAR(200),
    via VARCHAR(50),
    disponibilidad BOOLEAN DEFAULT true,
    es_oficial BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLA: alertas_emergencia
CREATE TABLE alertas_emergencia (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER REFERENCES pacientes(id) ON DELETE SET NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('SOS', 'urgencia', 'llamada')),
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    direccion TEXT,
    estado VARCHAR(20) DEFAULT 'activa' CHECK (estado IN ('activa', 'atendida', 'cancelada')),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atendida_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_atencion TIMESTAMP,
    observaciones TEXT
);

-- 9. VISTAS NORMALIZADAS
CREATE VIEW vista_registros_completos AS
SELECT 
    r.id AS registro_id,
    r.codigo,
    r.fecha,
    p.cedula AS paciente_cedula,
    p.nombre AS paciente_nombre,
    p.apellido AS paciente_apellido,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER AS paciente_edad,
    p.sexo AS paciente_sexo,
    u.nombre AS personal_nombre,
    u.apellido AS personal_apellido,
    ro.nombre AS personal_rol,
    COUNT(DISTINCT t.id) AS total_patologias
FROM registros r
JOIN pacientes p ON r.paciente_id = p.id
JOIN usuarios u ON r.usuario_id = u.id
JOIN roles ro ON u.rol_id = ro.id
LEFT JOIN tratamientos t ON r.id = t.registro_id
GROUP BY r.id, p.cedula, p.nombre, p.apellido, p.fecha_nacimiento, p.sexo, u.nombre, u.apellido, ro.nombre;

-- 10. SEMILLAS (DATA BASE)

-- Roles Maestros
INSERT INTO roles (nombre, descripcion) VALUES
('admin', 'Administrador total del sistema'),
('medico', 'Personal médico con acceso a diagnósticos'),
('vocero', 'Promotor de salud comunitario');

-- Categorías CIE-10 Maestras
INSERT INTO categorias_cie10 (nombre) VALUES
('Cardiovasculares'),
('Metabólicas'),
('Respiratorias'),
('Generales'),
('Gastrointestinales'),
('Neurológicas'),
('Renales'),
('Infecciosas'),
('Dermatológicas'),
('Musculoesqueléticas'),
('Materno-Infantil'),
('Neoplasias'),
('Nutricionales'),
('Oftalmológicas'),
('Otorrinolaringología'),
('Traumatismos'),
('Causas Externas'),
('Salud Mental');

-- Sectores oficiales del 23 de Enero
INSERT INTO sectores (nombre, latitud, longitud) VALUES
('Observatorio', 10.507777, -66.935555),
('La Piedrita', 10.506666, -66.936666),
('Sierra Maestra', 10.505555, -66.937777),
('La Cañada', 10.508888, -66.934444),
('Zona Central', 10.511111, -66.932222),
('Monte Piedad', 10.510000, -66.933333),
('Zona E', 10.512345, -66.931111),
('Zona F', 10.513456, -66.930000),
('El Mirador', 10.504444, -66.938888),
('Cristo Rey', 10.502222, -66.940000),
('Santa Rosa', 10.499000, -66.941000),
('La Planicie', 10.498888, -66.943333),
('La Silsa', 10.497000, -66.945000),
('El Samán', 10.503333, -66.939999);

-- Patologías CIE-10 Base (Vinculadas a Categorías)
INSERT INTO patologias_cie10 (codigo, nombre, categoria_id) VALUES
('I10', 'Hipertensión Arterial', (SELECT id FROM categorias_cie10 WHERE nombre='Cardiovasculares')),
('E11', 'Diabetes Mellitus Tipo 2', (SELECT id FROM categorias_cie10 WHERE nombre='Metabólicas')),
('J45', 'Asma Bronquial', (SELECT id FROM categorias_cie10 WHERE nombre='Respiratorias')),
('Z00.0', 'Examen médico general / Control Sano', (SELECT id FROM categorias_cie10 WHERE nombre='Generales')),
('K29', 'Gastritis / Úlcera Péptica', (SELECT id FROM categorias_cie10 WHERE nombre='Gastrointestinales'));

-- Usuario Administrador Oficial (password: lamuerte)
INSERT INTO usuarios (cedula, nombre, apellido, email, password_hash, rol_id)
VALUES ('V-19947792', 'Administrador', 'SIVICO23', 'admin@sivico23.ve', '$2b$10$oUmLek8wZyeL5B3JeNC2wuwz6hGX6ndlppTJM.qtQsBbphpLU3OA2', (SELECT id FROM roles WHERE nombre='admin'));

-- Vocero Base (password: vocero123)
INSERT INTO usuarios (cedula, nombre, apellido, email, password_hash, rol_id, sector_id)
VALUES ('V-11111111', 'Juan', 'Vocero', 'vocero@sivico23.ve', '$2b$10$UwwNgZ27Yuh7.RrxTQCljevUNVo75i7.pTNnCkoAJSouiPNQR6aX.', (SELECT id FROM roles WHERE nombre='vocero'), (SELECT id FROM sectores WHERE nombre='Zona Central'));

-- Médico Base (password: medico123)
INSERT INTO usuarios (cedula, nombre, apellido, email, password_hash, rol_id, sector_id)
VALUES ('V-33333333', 'María', 'Médico', 'medico@sivico23.ve', '$2b$10$.4kOfolktjqQk3yot7HqlumUSj8Cuu4UpOChPucKvDEYSF7p/nTpm', (SELECT id FROM roles WHERE nombre='medico'), (SELECT id FROM sectores WHERE nombre='Observatorio'));

-- ============================================================
-- SIVICO23 FASE 2.1 — Módulo de Discapacidad (CONAPDIS)
-- ============================================================
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS requiere_vigilancia_constante BOOLEAN DEFAULT false;

CREATE TABLE cat_discapacidades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_discapacidades (nombre, descripcion) VALUES
('Visual', 'Ceguera total o deficiencia visual grave'),
('Auditiva', 'Sordera total o hipoacusia'),
('Sordoceguera', 'Combinación de deficiencias visuales y auditivas'),
('Física/Motora', 'Alteración en el sistema osteoarticular, muscular y/o nervioso'),
('Intelectual', 'Limitaciones significativas en el funcionamiento intelectual'),
('Trastorno del Espectro Autista (TEA)', 'Condición del neurodesarrollo'),
('Mental/Psicosocial', 'Trastornos mentales crónicos y discapacitantes'),
('Múltiple', 'Presencia de dos o más condiciones de discapacidad')
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE paciente_discapacidades (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    discapacidad_id INTEGER NOT NULL REFERENCES cat_discapacidades(id) ON DELETE RESTRICT,
    posee_certificado_conapdis BOOLEAN DEFAULT false,
    numero_certificado VARCHAR(50),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(paciente_id, discapacidad_id)
);

-- ============================================================
-- SIVICO23 FASE 3.1 — Módulo de Vacunación (MPPS)
-- ============================================================
CREATE TABLE cat_vacunas_mpps (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    edad_minima_meses INTEGER,
    edad_maxima_meses INTEGER,
    dosis_totales INTEGER DEFAULT 1,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cat_vacunas_mpps (nombre, edad_minima_meses, dosis_totales, descripcion) VALUES
('BCG', 0, 1, 'Contra Tuberculosis. Dosis única (Recién Nacido)'),
('Hepatitis B RN', 0, 1, 'Dosis RN (primeras 12 horas de vida)'),
('Hepatitis B Adulto', 216, 3, 'Esquema de 3 dosis para adultos no vacunados'),
('Pentavalente', 2, 5, 'Difteria, Tétanos, Tosferina, Hepatitis B, H. Influenzae b (2, 4, 6 meses + refuerzos)'),
('Polio (IPV)', 2, 2, 'Vacuna inactivada contra Poliomielitis. Inyectada (2, 4 meses)'),
('Polio (OPV)', 6, 3, 'Vacuna oral contra Poliomielitis. (6 meses + 2 refuerzos)'),
('Rotavirus', 2, 2, 'Primera dosis a los 2 meses. Máximo hasta los 6 meses de edad.'),
('Neumococo Conjugada', 2, 3, 'Esquema de 2 y 4 meses + refuerzo entre 12 y 15 meses.'),
('Neumococo Polisacárida', 24, 1, 'Refuerzo para poblaciones de riesgo a partir de los 2 años.'),
('Influenza Estacional', 6, 2, 'Dosis inicial a los 6 meses, refuerzo al mes. Luego anual.'),
('Fiebre Amarilla', 12, 1, 'Protección aplicable a partir de los 12 meses de vida.'),
('SRP (Trivalente Viral)', 12, 2, 'Sarampión, Rubéola y Parotiditis. (12 meses + refuerzo 5 años)'),
('SR (Doble Viral)', 120, 1, 'Sarampión y Rubéola. Refuerzo en edad escolar o campañas.'),
('Toxoide Tetánico Diftérico', 120, 5, 'Esquema de 5 dosis para adolescentes y adultos.'),
('Meningocócica BC', 3, 2, 'Protección contra Meningitis. Esquema de 2 dosis.'),
('Rabia Humana', 0, 5, 'Esquema post-exposición de 5 dosis.'),
('Varicela', 12, 2, 'Protección contra Varicela. Esquema de 2 dosis.'),
('Hepatitis A', 12, 2, 'Protección contra Hepatitis A. Esquema de 2 dosis.'),
('COVID-19', 36, 3, 'Esquema inicial de 2 dosis + refuerzo.')
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE registro_vacunacion (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    vacuna_id INTEGER NOT NULL REFERENCES cat_vacunas_mpps(id) ON DELETE RESTRICT,
    numero_dosis INTEGER NOT NULL DEFAULT 1,
    fecha_aplicacion DATE NOT NULL,
    lote_vacuna VARCHAR(50),
    aplicada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(paciente_id, vacuna_id, numero_dosis)
);

-- ============================================================
-- SIVICO23 FASE 4 — Jornadas y Notificaciones
-- ============================================================
CREATE TABLE jornadas_salud (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    fecha_jornada TIMESTAMP NOT NULL,
    lugar VARCHAR(200),
    sector_id INTEGER REFERENCES sectores(id) ON DELETE SET NULL,
    activa BOOLEAN DEFAULT true,
    creada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notificaciones_usuarios (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    jornada_id INTEGER REFERENCES jornadas_salud(id) ON DELETE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    leida BOOLEAN DEFAULT false,
    tipo VARCHAR(50) DEFAULT 'jornada',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notificaciones_usuario ON notificaciones_usuarios(usuario_id, leida);
CREATE INDEX idx_jornadas_fecha ON jornadas_salud(fecha_jornada DESC);

-- (Las definiciones de Discapacidad y Vacunación PAI están en las secciones Fase 2.1 y 3.1 arriba)

-- ============================================================
-- SIVICO23 FASE 14 — ROBUSTEZ Y OPTIMIZACIÓN
-- ============================================================

-- 1. ÍNDICES DE RENDIMIENTO PARA FK
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_sector ON usuarios(sector_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_sector ON pacientes(sector_id);
CREATE INDEX IF NOT EXISTS idx_registros_paciente ON registros(paciente_id);
CREATE INDEX IF NOT EXISTS idx_registros_usuario ON registros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_tratamientos_registro ON tratamientos(registro_id);
CREATE INDEX IF NOT EXISTS idx_medicamentos_tratamiento ON medicamentos(tratamiento_id);
CREATE INDEX IF NOT EXISTS idx_paciente_discapacidades_pac ON paciente_discapacidades(paciente_id);

-- 2. SISTEMA DE AUDITORÍA PARA PACIENTES
CREATE TABLE IF NOT EXISTS auditoria_pacientes (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER,
    cedula_afectada VARCHAR(20),
    operacion VARCHAR(10), -- 'INSERT', 'UPDATE', 'DELETE'
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION auditar_cambios_paciente() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO auditoria_pacientes (paciente_id, cedula_afectada, operacion, datos_nuevos)
        VALUES (NEW.id, NEW.cedula, 'INSERT', to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO auditoria_pacientes (paciente_id, cedula_afectada, operacion, datos_anteriores, datos_nuevos)
        VALUES (OLD.id, OLD.cedula, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO auditoria_pacientes (paciente_id, cedula_afectada, operacion, datos_anteriores)
        VALUES (OLD.id, OLD.cedula, 'DELETE', to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditar_pacientes ON pacientes;
CREATE TRIGGER trg_auditar_pacientes
AFTER INSERT OR UPDATE OR DELETE ON pacientes
FOR EACH ROW EXECUTE FUNCTION auditar_cambios_paciente();
