# 🏥 SIVICO23 - SISTEMA INTEGRAL DE VIGILANCIA COMUNITARIA (V3.1)

## Proyecto Final de Graduación TSU en Informática
### Backend Cloud + Frontend Mobile + Cartografía Comunitaria

---

## 📦 ESTRUCTURA DEL PROYECTO

```
SIVICO23_FASE2_FINAL/
├── 📱 frontend/                    # App móvil React Native (Expo)
│   ├── src/
│   │   ├── screens/
│   │   │   ├── DashboardScreen.js # ✅ Dashboard con ErrorBoundary (v3.1)
│   │   │   └── RegistroScreen.js  # ✅ Registro multi-patología
│   │   ├── components/
│   │   │   └── LeafletMap.js      # ✅ Cartografía Profesional (Leaflet + GeoJSON) v3.2
│   │   ├── data/
│   │   │   └── patologias.js      # ✅ Catálogo 11k patologías CIE-10
│   │   └── docs/                  # 📚 Informes técnicos y validaciones
│   │
│   ├── app.json                   # Configuración Expo
│   └── package.json               # Dependencias (React Native 0.81)
│
├── 🖥️ backend/                     # Servidor Node.js + PostgreSQL
│   ├── DOCUMENTO_TSU.md
│   └── CHANGELOG.md
│
└── 📄 README.md                    # ← Este archivo
```

---

## 🎯 ¿QUÉ HAY DE NUEVO EN FASE 2?

### **Frontend (App Móvil):**

| Característica | Fase 1 | Fase 2 ✅ |
|----------------|--------|-----------|
| **SDK Expo** | 51 | **54** |
| **Búsqueda de paciente** | ❌ | ✅ Por cédula |
| **Patologías por registro** | 1 | **∞ (ilimitadas)** |
| **Medicamentos por patología** | 1 | **∞ (ilimitados)** |
| **Presentaciones medicamento** | Fija | **2-5 opciones** |
| **Selector de dosis** | ❌ | ✅ Por presentación |
| **Total patologías** | ~10 | **43 con CIE-10** |
| **Total medicamentos** | ~30 | **150+ con MPPS/IVSS** |
| **Sincronización** | ❌ | ✅ Con servidor |
| **Autenticación** | ❌ | ✅ JWT |
| **Roles de usuario** | ❌ | ✅ 4 roles |
| **Dashboard Analítico** | ❌ | ✅ Sectores, Brechas y Triaje |
| **Fusión de Catálogo** | ❌ | ✅ Consolidación de medicinas |

### **Backend (Servidor):**

✅ **Node.js 18.x + Express 4.18**
✅ **PostgreSQL 14+ con 6 tablas**
✅ **API REST con 15 endpoints**
✅ **Autenticación JWT**
✅ **Sistema de roles** (admin, médico, promotor, ciudadano)
✅ **Sincronización offline→online**
✅ **Estadísticas en tiempo real**
✅ **Geolocalización de emergencias**

### **Base de Datos:**

✅ **43 patologías clasificadas CIE-10**
✅ **11 categorías médicas**
✅ **150+ medicamentos del Cuadro Básico MPPS/IVSS**
✅ **Múltiples presentaciones por medicamento**
✅ **Modelo ER normalizado (3FN)**
✅ **20 índices para optimización**
✅ **Vistas materializadas**
✅ **Row-Level Security (RLS)**

---

## 🚀 INSTALACIÓN RÁPIDA (15 MINUTOS)

### **Requisitos Previos:**
- ✅ Node.js 18+
- ✅ PostgreSQL 14+
- ✅ Expo Go en teléfono
- ✅ Git (opcional)

### **Paso 1: Instalar Base de Datos**

```bash
# Iniciar PostgreSQL
# Windows: Ya debe estar corriendo si lo instalaste
# Mac: brew services start postgresql
# Linux: sudo systemctl start postgresql

# Crear base de datos
psql -U postgres
CREATE DATABASE sivico23_db;
\c sivico23_db
\i backend/schema.sql
\q
```

### **Paso 2: Configurar Backend**

```bash
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
nano .env  # Editar con tus credenciales

# Contenido de .env:
# DB_USER=postgres
# DB_HOST=localhost
# DB_NAME=sivico23_db
# DB_PASSWORD=tu_password
# DB_PORT=5432
# JWT_SECRET=sivico23_secret_2026
# PORT=3000

# Iniciar servidor
npm start

# Debes ver:
# ╔════════════════════════════════════════╗
# ║   SIVICO23 FASE 2 — Backend API       ║
# ║   Puerto: 3000                         ║
# ║   PostgreSQL: Conectado ✓              ║
# ╚════════════════════════════════════════╝
```

### **Paso 3: Configurar Frontend**

```bash
# En OTRA terminal
cd frontend

# Instalar dependencias
npm install

# Obtener tu IP local
# Windows: ipconfig
# Mac/Linux: ifconfig

# Editar src/utils/api.js
nano src/utils/api.js

# Cambiar línea 5:
# const API_URL = 'http://TU_IP_AQUI:3000/api';
# Ejemplo: const API_URL = 'http://192.168.1.10:3000/api';

# Iniciar app
npx expo start

# Escanear QR con Expo Go
```

### **Paso 4: Probar Todo**

```bash
# 1. Login
Usuario: V-00000000
Password: admin123

# 2. Crear un registro
- Ir a "Registro"
- Seleccionar múltiples patologías
- Seleccionar medicamentos con dosis
- Guardar

# 3. Sincronizar
- Ir a "Inicio"
- Tocar "Sincronizar con Servidor"
- Ver mensaje de éxito

# 4. Verificar en BD
psql -U postgres -d sivico23_db
SELECT * FROM registros;
\q
```

---

## 📖 DOCUMENTACIÓN INCLUIDA

### **1. Guías de Instalación:**

| Archivo | Descripción |
|---------|-------------|
| `GUIA_INSTALACION_COMPLETA.md` | Paso a paso detallado (Windows/Mac/Linux) |
| `INSTALACION_BACKEND.md` | Configuración del servidor |
| `INSTALACION_FRONTEND.md` | Configuración de la app móvil |
| `TROUBLESHOOTING.md` | Solución de problemas comunes |

### **2. Guías Técnicas:**

| Archivo | Descripción |
|---------|-------------|
| `API_REFERENCE.md` | Documentación de endpoints |
| `DATABASE_SCHEMA.md` | Estructura de base de datos |
| `DIAGRAMA_ER.md` | Modelo entidad-relación |
| `ARQUITECTURA.md` | Diagrama de arquitectura |

### **3. Para el Documento TSU:**

| Archivo | Descripción |
|---------|-------------|
| `CAPITULO_V_PROPUESTA.md` | Sección lista para copiar |
| `CAPITULO_VI_RESULTADOS.md` | Pruebas y validación |
| `METODOLOGIA.md` | Marco metodológico |
| `REFERENCIAS.md` | Bibliografía APA 7 |

### **4. Capacitación Socio-Tecnológica (NUEVO):**

Estos documentos fueron diseñados en HTML interactivo y full-color, listos para imprimir en PDF y entregar a la comunidad:

| Archivo | Descripción |
|---------|-------------|
| `documentos_sociotecnologicos/Guia_de_Instalacion.html` | Guía visual didáctica para instalar el sistema |
| `documentos_sociotecnologicos/Manual_de_Usuario.html` | Enseñanza del flujo de la app por roles |
| `documentos_sociotecnologicos/Taller_de_Capacitacion_Comunitaria.html` | 4 Módulos de clase para voceros y médicos |

---

## 🗄️ BASE DE DATOS COMPLETA

### **43 Patologías con CIE-10:**

#### **Cardiovasculares (5):**
- I10 - Hipertensión Arterial
- I50 - Insuficiencia Cardíaca
- I20 - Angina de Pecho
- I49 - Arritmias Cardíacas
- E78 - Dislipidemia

#### **Metabólicas (5):**
- E11 - Diabetes Mellitus Tipo 2
- E10 - Diabetes Mellitus Tipo 1
- E03 - Hipotiroidismo
- E05 - Hipertiroidismo
- E66 - Obesidad

#### **Respiratorias (5):**
- J45 - Asma Bronquial
- J44 - EPOC
- J20 - Bronquitis Aguda
- J18 - Neumonía
- A15 - Tuberculosis Pulmonar

#### **Gastrointestinales (8):**
- K29 - Gastritis
- K27 - Úlcera Péptica
- K21 - ERGE
- K58 - Síndrome Intestino Irritable
- K59.0 - Estreñimiento
- K59.1 - Diarrea Aguda
- B82 - Parasitosis Intestinal
- K70.1 - Hepatitis Alcohólica

#### **Musculoesqueléticas (5):**
- M05 - Artritis Reumatoide
- M19 - Osteoartritis
- M10 - Gota
- M81 - Osteoporosis
- M54.5 - Lumbalgia

#### **Neurológicas (7):**
- G40 - Epilepsia
- G43 - Migraña
- F41.1 - Ansiedad
- F32 - Depresión
- F51.0 - Insomnio
- G20 - Parkinson
- F00 - Demencia/Alzheimer

#### **Dermatológicas (5):**
- L20 - Dermatitis Atópica
- L40 - Psoriasis
- L70 - Acné Vulgar
- B86 - Escabiosis (Sarna)
- B37.2 - Candidiasis Cutánea

#### **Oftalmológicas/ORL (5):**
- H10 - Conjuntivitis
- H40 - Glaucoma
- H66 - Otitis Media
- J30 - Rinitis Alérgica
- J02 - Faringitis Aguda

#### **Ginecológicas/Urológicas (5):**
- N39.0 - Infección Vías Urinarias
- N76.0 - Vaginosis Bacteriana
- B37.3 - Candidiasis Vaginal
- N40 - Hiperplasia Prostática
- N94.6 - Dismenorrea

#### **Hematológicas (2):**
- D50 - Anemia Ferropénica
- D51 - Anemia Megaloblástica

#### **Infecciosas (5):**
- A90 - Dengue
- B54 - Malaria
- B24 - VIH/SIDA
- U07.1 - COVID-19
- B57 - Enfermedad de Chagas

---

## 🔌 API ENDPOINTS

### **Autenticación:**
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión

### **Pacientes:**
- `GET /api/pacientes` - Listar todos
- `GET /api/pacientes/:cedula` - Buscar por cédula
- `POST /api/pacientes` - Crear nuevo

### **Registros Médicos:**
- `POST /api/registros` - Crear registro completo
- `GET /api/registros` - Listar registros
- `GET /api/registros/:id` - Obtener detalle

### **Estadísticas:**
- `GET /api/estadisticas` - Dashboard estadísticas

### **Sincronización:**
- `POST /api/sync` - Sincronizar registros offline

---

## 📊 ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                     │
│   ┌──────────────────────────────────────────────────┐     │
│   │  App Móvil (React Native + Expo SDK 54)         │     │
│   │  - Multi-patología                               │     │
│   │  - Selector de dosis                             │     │
│   │  - Offline-first con AsyncStorage                │     │
│   │  - Sincronización bajo demanda                   │     │
│   └──────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/JSON
                       │ WiFi/4G
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  CAPA DE LÓGICA DE NEGOCIO                  │
│   ┌──────────────────────────────────────────────────┐     │
│   │  Backend API (Node.js + Express)                 │     │
│   │  - Autenticación JWT                             │     │
│   │  - Control de acceso por roles                   │     │
│   │  - Validación de datos                           │     │
│   │  - Lógica de sincronización                      │     │
│   └──────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL
                       │ pg Pool
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      CAPA DE DATOS                          │
│   ┌──────────────────────────────────────────────────┐     │
│   │  PostgreSQL 14+                                  │     │
│   │  - 6 tablas principales                          │     │
│   │  - 20 índices optimizados                        │     │
│   │  - Vistas materializadas                         │     │
│   │  - Row-Level Security                            │     │
│   └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎓 PARA TU DEFENSA DE TSU

### **Demostración en Vivo (10 minutos):**

**1. Backend funcionando (2 min):**
- Mostrar terminal con servidor activo
- Explicar puerto 3000, PostgreSQL conectado

**2. Base de datos poblada (2 min):**
- Abrir pgAdmin
- Mostrar tablas con datos
- Ejecutar query: `SELECT * FROM registros;`

**3. App móvil funcionando (3 min):**
- Login en la app
- Crear registro con múltiples patologías
- Seleccionar medicamentos con dosis
- Guardar

**4. Sincronización (2 min):**
- Tocar botón "Sincronizar"
- Mostrar mensaje de éxito
- Verificar en pgAdmin que aparece el dato

**5. Estadísticas (1 min):**
- Mostrar dashboard con números
- Patologías más comunes
- Medicamentos más prescritos

### **Preguntas Frecuentes y Respuestas:**

**Q: ¿Por qué React Native?**
A: "Permite desarrollo multiplataforma (Android/iOS) con un solo código base, reduciendo tiempo y costo. Expo facilita testing sin compilar APK."

**Q: ¿Por qué PostgreSQL y no MySQL?**
A: "PostgreSQL ofrece mejor soporte para funciones avanzadas, cumple normativas CNTI de software libre, y es estándar en proyectos gubernamentales venezolanos."

**Q: ¿Cómo garantizan seguridad?**
A: "JWT con expiración 7 días, bcrypt 10 rounds para passwords, sanitización SQL injection, CORS restrictivo, Row-Level Security por rol."

**Q: ¿Qué pasa si no hay internet?**
A: "App funciona 100% offline con AsyncStorage. Al recuperar WiFi, botón de sincronización envía datos acumulados al servidor mediante endpoint /api/sync."

**Q: ¿Escalabilidad?**
A: "Diseñado para 50 promotores concurrentes, 5000 pacientes, 20000 registros/año. Connection pooling, índices optimizados, paginación en listados."

---

## 📋 CHECKLIST DE ENTREGA

### **Archivos Técnicos:**
- [ ] Código fuente frontend (carpeta `frontend/`)
- [ ] Código fuente backend (carpeta `backend/`)
- [ ] Script SQL completo (`backend/schema.sql`)
- [ ] Archivo README.md principal
- [ ] Archivo .env.example
- [ ] package.json de ambos proyectos

### **Documentación:**
- [ ] Diagrama ER (imagen + código Mermaid)
- [ ] Diagrama de arquitectura
- [ ] Manual de instalación
- [ ] Manual de usuario
- [ ] Documentación de API
- [ ] Capítulos V y VI actualizados

### **Evidencias:**
- [ ] Capturas: Terminal con backend corriendo
- [ ] Capturas: pgAdmin con datos
- [ ] Capturas: App - Login
- [ ] Capturas: App - Registro multi-patología
- [ ] Capturas: App - Sincronización
- [ ] Video demo (5 min) mostrando flujo completo

### **Presentación:**
- [ ] Diapositivas de defensa (PPT/PDF)
- [ ] Diagrama ER en alta resolución
- [ ] Script de demostración paso a paso
- [ ] Lista de preguntas frecuentes con respuestas

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### **Backend no inicia:**
```bash
# Verificar PostgreSQL
pg_isready
# Si falla: sudo systemctl start postgresql

# Ver logs
npm start 2>&1 | tee backend.log

# Verificar .env
cat .env
```

### **App no conecta al backend:**
```bash
# 1. Verificar IP en src/utils/api.js
# 2. Teléfono y PC en misma WiFi
# 3. Backend corriendo (puerto 3000)
# 4. Firewall no bloquea puerto 3000
```

### **Error al sincronizar:**
```bash
# Verificar token JWT
# Login de nuevo en la app
# Verificar endpoint /api/sync activo
curl http://localhost:3000/api/estadisticas
```

---

## 📞 SOPORTE

Para problemas durante instalación o configuración:

1. **Revisar esta documentación completa**
2. **Consultar `TROUBLESHOOTING.md`**
3. **Verificar logs** del backend
4. **Limpiar caché**: `npx expo start -c`
5. **Reinstalar** dependencias si es necesario

---

## 📈 PRÓXIMOS PASOS

1. **Descomprimir** este paquete
2. **Leer** `GUIA_INSTALACION_COMPLETA.md`
3. **Instalar** PostgreSQL
4. **Configurar** backend
5. **Probar** frontend
6. **Sincronizar** datos
7. **Tomar evidencias** para documento
8. **Actualizar** Capítulos V y VI
9. **Preparar** presentación de defensa
10. **¡GRADUARTE!** 🎓

---

## 🎉 ¡SISTEMA COMPLETO Y LISTO!

Este paquete contiene **TODO** lo necesario para:
- ✅ Implementar sistema completo
- ✅ Demostrar en defensa
- ✅ Documentar en informe TSU
- ✅ Cumplir requisitos académicos
- ✅ **GRADUARTE**

---

**Versión:** 2.0 - Fase 2 Completa  
**Fecha:** Febrero 2026  
**Proyecto:** SIVICO23 - Sistema de Vigilancia y Control de Salud Comunitaria  
**Comunidad:** 23 de Enero, Caracas, Venezuela  
**Institución:** IUTEPAL / UPTAEB  
**Nivel:** TSU en Informática

---

**¡Éxito en tu graduación!** 🚀🇻🇪
