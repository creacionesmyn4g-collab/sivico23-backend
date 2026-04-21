# 🏥 SIVICO23 - Backend API

## Sistema de Vigilancia y Control de Salud Comunitaria - Fase 2

Backend RESTful con Node.js + Express + PostgreSQL para sincronización de datos del sistema móvil SIVICO23.

---

## 📋 REQUISITOS

- **Node.js:** v18.0.0 o superior
- **PostgreSQL:** v14.0 o superior
- **npm:** v9.0.0 o superior

---

## 🚀 INSTALACIÓN RÁPIDA

```bash
# 1. Clonar/Extraer archivos
cd SIVICO23_FASE2_BACKEND

# 2. Instalar dependencias
npm install

# 3. Configurar base de datos
psql -U postgres
CREATE DATABASE sivico23_db;
\c sivico23_db
\i schema.sql
\q

# 4. Configurar variables de entorno
cp .env.example .env
nano .env  # Editar con tus credenciales

# 5. Iniciar servidor
npm start
```

---

## 📁 ESTRUCTURA DEL PROYECTO

```
SIVICO23_FASE2_BACKEND/
├── server.js              # Servidor principal (Express)
├── database.sql           # Esquema completo de la base de datos (PostgreSQL)
├── package.json           # Lista de dependencias del proyecto (npm)
├── package-lock.json      # ¡Importante! Fija las versiones exactas de las dependencias para evitar que el servidor falle si una librería se actualiza en el futuro.
├── .env.example           # Plantilla de variables de entorno
├── README.md              # Documentación técnica
└── logs/                  # Logs estandarizados
```

---

## 🔌 ENDPOINTS DE LA API

### **Autenticación**

#### `POST /api/auth/register`
Registrar nuevo usuario

**Body:**
```json
{
  "cedula": "V-12345678",
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "juan@example.com",
  "password": "contraseña123",
  "rol": "vocero"
}
```

**Respuesta:**
```json
{
  "message": "Usuario registrado exitosamente",
  "usuario": {
    "id": 1,
    "cedula": "V-12345678",
    "nombre": "Juan",
    "apellido": "Pérez",
    "rol": "vocero"
  }
}
```

#### `POST /api/auth/login`
Iniciar sesión

**Body:**
```json
{
  "cedula": "V-12345678",
  "password": "contraseña123"
}
```

**Respuesta:**
```json
{
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": 1,
    "cedula": "V-12345678",
    "nombre": "Juan",
    "apellido": "Pérez",
    "rol": "vocero"
  }
}
```

---

### **Pacientes**

#### `GET /api/pacientes`
Listar todos los pacientes

**Headers:**
```
Authorization: Bearer {token}
```

**Query params:**
- `limit`: Número de resultados (default: 50)
- `offset`: Página (default: 0)
- `busqueda`: Texto a buscar en nombre/cédula

**Respuesta:**
```json
{
  "pacientes": [
    {
      "id": 1,
      "cedula": "V-8123456",
      "nombre": "María",
      "apellido": "Rodríguez",
      "edad": 45,
      "sexo": "Femenino",
      "telefono": "0414-1234567",
      "sector": "Zona Central"
    }
  ],
  "total": 1
}
```

#### `GET /api/pacientes/:cedula`
Buscar paciente por cédula

**Respuesta:**
```json
{
  "id": 1,
  "cedula": "V-8123456",
  "nombre": "María",
  "apellido": "Rodríguez",
  "edad": 45
}
```

#### `POST /api/pacientes`
Crear nuevo paciente

**Body:**
```json
{
  "cedula": "V-8123456",
  "nombre": "María",
  "apellido": "Rodríguez",
  "edad": 45,
  "sexo": "Femenino",
  "telefono": "0414-1234567"
}
```

---

### **Registros Médicos**

#### `POST /api/registros`
Crear registro médico completo

**Body:**
```json
{
  "codigo": "SIV-2026-12345",
  "paciente_cedula": "V-8123456",
  "tratamientos": [
    {
      "categoria": {
        "nombre": "Cardiovasculares",
        "icono": "🫀"
      },
      "patologia": {
        "nombre": "Hipertensión Arterial",
        "cie10": "I10"
      },
      "medicamentos": [
        {
          "nombre": "Enalapril",
          "presentacion_seleccionada": {
            "mg": "10",
            "forma": "Tableta"
          },
          "dosis_seleccionada": {
            "label": "10 mg c/12h",
            "valor": "1 tableta de 10mg cada 12 horas"
          },
          "via": "Oral",
          "disponibilidad": "MPPS / IVSS"
        }
      ]
    }
  ]
}
```

#### `GET /api/registros`
Listar registros

**Query params:**
- `paciente_cedula`: Filtrar por paciente
- `limit`: Número de resultados
- `offset`: Página

#### `GET /api/registros/:id`
Obtener detalle completo de un registro

---

### **Estadísticas**

#### `GET /api/estadisticas`
Dashboard con estadísticas generales

**Respuesta:**
```json
{
  "total_registros": 1200,
  "total_pacientes": 450,
  "registros_hoy": 15,
  "patologias_comunes": [
    { "patologia": "Hipertensión Arterial", "total": 320 },
    { "patologia": "Diabetes Mellitus Tipo 2", "total": 180 }
  ],
  "medicamentos_comunes": [
    { "nombre": "Enalapril", "total": 280 },
    { "nombre": "Metformina", "total": 150 }
  ]
}
```

---

### **Sincronización**

#### `POST /api/sync`
Sincronizar múltiples registros offline

**Body:**
```json
{
  "registros_offline": [
    {
      "codigo": "SIV-2026-12345",
      "fecha": "2026-02-18T10:30:00.000Z",
      "paciente": {
        "cedula": "V-8123456",
        "nombre": "María",
        "apellido": "Rodríguez",
        "edad": 45
      },
      "tratamientos": [...]
    }
  ]
}
```

**Respuesta:**
```json
{
  "message": "Sincronización completada",
  "resultados": [
    {
      "codigo_offline": "SIV-2026-12345",
      "id_servidor": 234,
      "status": "sincronizado"
    }
  ]
}
```

---

## 🔐 SEGURIDAD

### **Autenticación JWT**

Todos los endpoints (excepto `/auth/login` y `/auth/register`) requieren token JWT en el header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Roles de Usuario**

- **admin:** Acceso completo al sistema, fusiones, catálogos y métricas.
- **medico:** Visualización global de historiales clínicos y empadronamiento.
- **vocero:** (Vocero Comunal) Empadronamiento y carga de encuestas de salud enfocadas en su sector asignado.

### **Rate Limiting**

- Máximo 100 peticiones por 15 minutos por IP
- Excepciones para endpoints críticos

---

## 🗄️ BASE DE DATOS

### **Estructura Dinámica (17 Tablas):**

El sistema cuenta con un esquema relacional profundo distribuido en 17 tablas activas:

1. **roles** - Roles del sistema
2. **categorias_cie10** - Clasificación principal CIE-10
3. **sectores** - Polígonos y sectores del Eje Comunal
4. **patologias_cie10** - Diccionario médico internacional
5. **usuarios** - Credenciales (Admin, Médico, Vocero)
6. **pacientes** - Datos demográficos e identidad
7. **registros** - Cabecera de atención médica (Fecha, Médico)
8. **tratamientos** - Diagnóstico cruzado entre Paciente y Patología
9. **medicamentos** - Prescripciones detalladas asociadas al tratamiento
10. **alertas_emergencia** - Sistema SOS Georreferenciado
11. **cat_discapacidades** - Catálogo oficial CONAPDIS
12. **paciente_discapacidades** - Relación Paciente-Discapacidad
13. **cat_vacunas_mpps** - Esquema PAI Nacional
14. **registro_vacunacion** - Dosis aplicadas (Módulo Pediátrico)
15. **jornadas_salud** - Planificación de despliegues comunitarios
16. **notificaciones_usuarios** - Sistema de buzón de alertas
17. **auditoria_pacientes** - Historial inmutable de cambios críticos

### **Relaciones Principales:**

```
sectores (1) ──< (N) pacientes
usuarios (1) ──< (N) registros
pacientes (1) ──< (N) registros
registros (1) ──< (N) tratamientos
tratamientos (1) ──< (N) medicamentos
```

### **Respaldo Automático:**

```bash
# Configurar en crontab
0 2 * * * pg_dump sivico23_db > /var/backups/sivico23/backup_$(date +\%Y\%m\%d).sql
```

---

## 🧪 PRUEBAS

### **Prueba Manual con cURL:**

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"cedula":"V-00000000","password":"admin123"}'

# Obtener estadísticas (reemplazar TOKEN)
curl http://localhost:3000/api/estadisticas \
  -H "Authorization: Bearer TOKEN"
```

### **Prueba con Thunder Client (VS Code):**

1. Instalar extensión "Thunder Client"
2. Importar colección desde `SIVICO23_API.json`
3. Configurar variable de entorno `baseUrl`
4. Ejecutar requests

---

## 📊 MONITOREO

### **Logs:**

```bash
# Ver logs en tiempo real
tail -f logs/sivico23.log

# Logs de PostgreSQL
tail -f /var/log/postgresql/postgresql-14-main.log
```

### **Estado del servidor:**

```bash
# Verificar que está corriendo
curl http://localhost:3000/health

# Respuesta esperada:
# {"status":"ok","database":"connected"}
```

---

## 🚀 DESPLIEGUE EN PRODUCCIÓN

### **Opción 1: VPS (Ubuntu)**

```bash
# 1. Instalar Node.js y PostgreSQL
sudo apt update
sudo apt install nodejs npm postgresql

# 2. Clonar proyecto
git clone https://github.com/tu-repo/sivico23-backend.git
cd sivico23-backend

# 3. Instalar PM2 (gestor de procesos)
sudo npm install -g pm2

# 4. Configurar .env con credenciales de producción

# 5. Iniciar con PM2
pm2 start server.js --name sivico23-api
pm2 save
pm2 startup

# 6. Configurar Nginx como reverse proxy
sudo apt install nginx
# ... configuración de Nginx
```

### **Opción 2: Docker**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t sivico23-backend .
docker run -p 3000:3000 --env-file .env sivico23-backend
```

---

## 📞 TROUBLESHOOTING

### **Error: "Cannot connect to PostgreSQL"**

```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Iniciar si está detenido
sudo systemctl start postgresql

# Verificar credenciales en .env
psql -U postgres -d sivico23_db
```

### **Error: "Port 3000 already in use"**

```bash
# Encontrar proceso usando puerto 3000
lsof -i :3000

# Matar proceso (reemplazar PID)
kill -9 PID

# O cambiar puerto en .env
PORT=3001
```

### **Error: "JWT malformed"**

- Verificar que el token se envía en header `Authorization: Bearer TOKEN`
- Token debe ser el completo sin espacios
- Token expira en 7 días, generar nuevo con `/auth/login`

---

## 📄 LICENCIA

Proyecto Sociotecnológico - PNF Informática

---

## 👥 AUTORES

- Proyecto: SIVICO23 (Sistema de Vigilancia y Control Comunitario)
- Comunidad: Eje Territorial Comunal
- Institución: Universidad Politécnica Territorial "Andrés Eloy Blanco" (UPTAEB)
- Año: 2026

---

## 📧 CONTACTO

Para soporte técnico o preguntas sobre el proyecto:
- Email: sivico23@proyecto.ve
- GitHub: github.com/sivico23

---

**¡Sistema operativo y listo para graduación!** 🎓🇻🇪
