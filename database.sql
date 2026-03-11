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
VALUES ('V-19947792', 'Administrador', 'SIVICO23', 'admin@sivico23.ve', '$2b$10$7Z8Z/4Z/4Z/4Z/4Z/4Z/4eu/7Z8Z/4Z/4Z/4Z/4Z/4Z/4Z/4Z/4Z/4Z', (SELECT id FROM roles WHERE nombre='admin'));

-- Vocero Base (password: vocero123)
INSERT INTO usuarios (cedula, nombre, apellido, email, password_hash, rol_id, sector_id)
VALUES ('V-11111111', 'Juan', 'Vocero', 'vocero@sivico23.ve', '$2b$10$UwwNgZ27Yuh7.RrxTQCljevUNVo75i7.pTNnCkoAJSouiPNQR6aX.', (SELECT id FROM roles WHERE nombre='vocero'), (SELECT id FROM sectores WHERE nombre='Zona Central'));

-- Médico Base (password: medico123)
INSERT INTO usuarios (cedula, nombre, apellido, email, password_hash, rol_id, sector_id)
VALUES ('V-33333333', 'María', 'Médico', 'medico@sivico23.ve', '$2b$10$.4kOfolktjqQk3yot7HqlumUSj8Cuu4UpOChPucKvDEYSF7p/nTpm', (SELECT id FROM roles WHERE nombre='medico'), (SELECT id FROM sectores WHERE nombre='Observatorio'));
