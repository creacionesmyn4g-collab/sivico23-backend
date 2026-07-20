# Diccionario de Datos del Sistema SIVICO23

El sistema utiliza una base de datos relacional PostgreSQL modelada hasta la Tercera Forma Normal (3FN). A continuación se describe el diccionario de datos con sus tablas principales, tipos de datos y restricciones.

## 1. Seguridad y Acceso

### Tabla: `roles`
Define los niveles de acceso al sistema (Administrador, Médico, Vocero).
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | Identificador único del rol. |
| nombre | VARCHAR(50) | UNIQUE, NOT NULL | Nombre del rol (Ej. admin, medico, vocero). |
| descripcion | TEXT | | Descripción detallada de los permisos del rol. |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de creación del rol. |

### Tabla: `usuarios`
Almacena el personal médico, administrativo y voceros que acceden al sistema.
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | Identificador único del usuario. |
| cedula | VARCHAR(20) | UNIQUE, NOT NULL | Número de identificación nacional (Login). |
| nombre | VARCHAR(100) | NOT NULL | Nombre del usuario. |
| apellido | VARCHAR(100) | NOT NULL | Apellido del usuario. |
| email | VARCHAR(150) | UNIQUE | Correo electrónico de contacto. |
| password_hash | VARCHAR(255) | NOT NULL | Contraseña encriptada (bcrypt). |
| rol_id | INTEGER | FK -> roles(id) | Rol asignado (Control de acceso). |
| sector_id | INTEGER | FK -> sectores(id) | Sector asignado (opcional, útil para voceros). |
| telefono | VARCHAR(20) | | Teléfono de contacto. |
| activo | BOOLEAN | DEFAULT true | Estado de la cuenta en el sistema. |
| ultimo_login | TIMESTAMP | | Fecha del último acceso registrado. |

## 2. Catálogos Maestros (Parametrización)

### Tabla: `sectores`
Sectores, comunidades o zonas geográficas controladas por el ambulatorio.
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID único del sector. |
| nombre | VARCHAR(100) | UNIQUE, NOT NULL | Nombre del sector (Ej. Sierra Maestra). |

### Tabla: `categorias_cie10`
Agrupación general de patologías médicas.
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID de la categoría. |
| nombre | VARCHAR(100) | UNIQUE, NOT NULL | Nombre (Ej. Gastrointestinales). |
| descripcion | TEXT | | Detalles adicionales. |

### Tabla: `patologias_cie10`
Catálogo estandarizado de enfermedades (Clasificación Internacional de Enfermedades).
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID de la patología. |
| codigo | VARCHAR(10) | UNIQUE, NOT NULL | Código CIE-10 (Ej. J18.9, K29). |
| nombre | VARCHAR(200) | NOT NULL | Nombre de la enfermedad. |
| categoria_id | INTEGER | FK -> categorias_cie10 | Categoría a la que pertenece. |

### Tabla: `cat_discapacidades`
Tipos de discapacidades registradas por el CONAPDIS.
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID de la discapacidad. |
| nombre | VARCHAR(100) | UNIQUE, NOT NULL | Tipo (Ej. Intelectual, Motora). |
| descripcion | TEXT | | Breve explicación. |

### Tabla: `cat_vacunas_mpps`
Catálogo oficial del Programa Ampliado de Inmunizaciones (PAI - MPPS).
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID de la vacuna. |
| nombre | VARCHAR(100) | UNIQUE, NOT NULL | Nombre (Ej. Pentavalente, BCG). |
| edad_minima_meses | INTEGER | | Edad a partir de la cual es aplicable. |
| edad_maxima_meses | INTEGER | | Edad límite de aplicación. |
| dosis_totales | INTEGER | DEFAULT 1 | Cantidad de dosis en el esquema. |
| descripcion | TEXT | | Instrucciones adicionales. |

## 3. Datos Clínicos y Demográficos

### Tabla: `pacientes`
Información centralizada de cada habitante de la comunidad.
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID único del paciente. |
| cedula | VARCHAR(20) | | Cédula (puede ser nula para niños sin identificación). |
| nombre | VARCHAR(100) | NOT NULL | Nombre del paciente. |
| apellido | VARCHAR(100) | NOT NULL | Apellido del paciente. |
| fecha_nacimiento | DATE | NOT NULL | Utilizada para calcular edad dinámicamente. |
| sexo | VARCHAR(10) | IN (Masculino, Femenino) | Sexo biológico. |
| telefono | VARCHAR(20) | | Teléfono principal. |
| direccion | TEXT | | Dirección exacta de la residencia. |
| sector_id | INTEGER | FK -> sectores(id) | Sector al que pertenece. |
| cedula_representante | VARCHAR(20) | | Para menores de edad. |
| requiere_vigilancia_constante| BOOLEAN | DEFAULT false | Flag de atención especial prioritaria. |

### Tabla: `paciente_discapacidades`
Relación N:M entre pacientes y discapacidades (CONAPDIS).
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID del registro. |
| paciente_id | INTEGER | FK -> pacientes(id) | Paciente asociado. |
| discapacidad_id | INTEGER | FK -> cat_discapacidades | Discapacidad asociada. |
| posee_certificado_conapdis| BOOLEAN | DEFAULT false | Indica si está certificado legalmente. |
| numero_certificado | VARCHAR(50) | | Serial del carnet CONAPDIS. |
| observaciones | TEXT | | Anotaciones médicas. |

### Tabla: `registro_vacunacion`
Historial de inmunizaciones (vacunas aplicadas).
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID del registro. |
| paciente_id | INTEGER | FK -> pacientes(id) | Paciente que recibe la vacuna. |
| vacuna_id | INTEGER | FK -> cat_vacunas_mpps | Tipo de vacuna. |
| numero_dosis | INTEGER | DEFAULT 1 | Número de la dosis (Ej. Dosis 1, Refuerzo). |
| fecha_aplicacion | DATE | NOT NULL | Fecha exacta de la aplicación. |
| lote_vacuna | VARCHAR(50) | | Lote o marca del biológico. |
| aplicada_por | INTEGER | FK -> usuarios(id) | Médico o enfermero que la aplicó. |

## 4. Registro y Triaje (Offline First)

### Tabla: `registros`
Cada visita, triaje o encuentro del paciente con el sistema de salud.
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID interno del encuentro. |
| codigo | VARCHAR(20) | UNIQUE, NOT NULL | Código generado (útil para conciliación offline). |
| paciente_id | INTEGER | FK -> pacientes(id) | Paciente atendido. |
| usuario_id | INTEGER | FK -> usuarios(id) | Personal que generó el registro. |
| fecha | TIMESTAMP | NOT NULL | Fecha de la atención médica. |
| observaciones | TEXT | | Anotaciones generales del triaje. |

### Tabla: `tratamientos`
Diagnósticos (CIE-10) vinculados a un encuentro médico (`registros`).
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID del tratamiento/diagnóstico. |
| registro_id | INTEGER | FK -> registros(id) | Visita asociada (ON DELETE CASCADE). |
| patologia_id | INTEGER | FK -> patologias_cie10 | Enfermedad diagnosticada. |
| descripcion | TEXT | | Notas sobre la evolución clínica. |

### Tabla: `medicamentos`
Medicación exacta recetada en un tratamiento.
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID de la receta. |
| tratamiento_id | INTEGER | FK -> tratamientos(id)| Tratamiento asociado (ON DELETE CASCADE). |
| nombre | VARCHAR(200) | NOT NULL | Nombre del medicamento recetado. |
| presentacion | VARCHAR(100) | | Ej. Tabletas, Jarabe, Ampollas. |
| dosis | VARCHAR(200) | | Ej. 500mg cada 8 horas. |
| via | VARCHAR(50) | | Ej. Oral, Intravenosa. |
| es_oficial | BOOLEAN | DEFAULT false | Determina si el medicamento fue canonizado o ingresado manual. |

## 5. Módulos Adicionales (Alertas y Notificaciones)

### Tabla: `alertas_emergencia`
Almacenamiento de llamadas SOS generadas en el campo.
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID de la alerta. |
| paciente_id | INTEGER | FK -> pacientes(id) | Víctima de la emergencia (opcional). |
| usuario_id | INTEGER | FK -> usuarios(id) | Quien activó el botón SOS. |
| tipo | VARCHAR(20) | IN (SOS, urgencia, llamada)| Clasificación de la alerta. |
| direccion | TEXT | | Coordenadas o texto de ubicación. |
| estado | VARCHAR(20) | IN (activa, atendida...) | Ciclo de vida de la alerta. |
| fecha_atencion | TIMESTAMP | | Cuándo el centro médico despachó ayuda. |
| atendida_por | INTEGER | FK -> usuarios(id) | Administrador que tomó el caso. |

### Tabla: `jornadas_salud`
Eventos comunitarios programados (Despistajes, Vacunación Masiva).
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID del evento. |
| titulo | VARCHAR(150) | NOT NULL | Nombre (Ej. Jornada de Vacunación). |
| fecha_jornada | TIMESTAMP | NOT NULL | Cuándo ocurrirá. |
| lugar | VARCHAR(200) | | Punto de encuentro. |
| sector_id | INTEGER | FK -> sectores(id) | Hacia qué zona va dirigida. |
| activa | BOOLEAN | DEFAULT true | Estado de la jornada. |

### Tabla: `notificaciones_usuarios`
Push notifications / In-App notifications para el personal.
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID de la notificación. |
| usuario_id | INTEGER | FK -> usuarios(id) | Destinatario. |
| titulo | VARCHAR(150) | NOT NULL | Título del mensaje. |
| mensaje | TEXT | NOT NULL | Cuerpo del mensaje. |
| leida | BOOLEAN | DEFAULT false | Estado de lectura (indicador visual). |

### Tabla: `auditoria_pacientes`
Tabla de Tracking para trazabilidad de modificaciones sensibles.
| Campo | Tipo | Restricción | Descripción |
|-------|------|-------------|-------------|
| id | SERIAL | PK | ID del log. |
| paciente_id | INTEGER | | Referencia al paciente alterado. |
| operacion | VARCHAR(10) | IN (INSERT, UPDATE, DELETE)| Qué se hizo. |
| datos_anteriores | JSONB | | Backup instantáneo (en formato JSON) previo al cambio. |
| datos_nuevos | JSONB | | Data posterior a la actualización. |
| fecha | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha del suceso. |
