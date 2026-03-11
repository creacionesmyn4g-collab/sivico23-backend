// ============================================================
// SIVICO23 FASE 2 — server.js — Backend Node.js + Express + PostgreSQL
// API REST para sincronización de datos
// ============================================================

// ⚠️ BUG FIX: dotenv DEBE ir PRIMERO antes de cualquier otra cosa
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// ——— SECTORES VÁLIDOS (Estructura de apoyo) ———
const SECTORES_VALIDOS = [
  'Observatorio', 'La Piedrita', 'Sierra Maestra', 'La Cañada',
  'Zona Central', 'Monte Piedad', 'Zona E', 'Zona F',
  'El Mirador', 'Cristo Rey', 'Santa Rosa', 'La Planicie', 'La Silsa',
  'El Samán'
];

// ——— HELPER: Calcular edad a partir de fecha_nacimiento ———
const edadDesdeFechaNacimiento = (fechaNac) => {
  if (!fechaNac) return null;
  const hoy = new Date();
  const nacimiento = new Date(fechaNac);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
};

// ——— HELPER: Convertir edad (entero) a fecha_nacimiento aproximada ———
const fechaNacimientoDesdeEdad = (edad) => {
  if (edad === null || edad === undefined || isNaN(parseInt(edad))) return null;
  const hoy = new Date();
  return new Date(hoy.getFullYear() - parseInt(edad), 0, 1).toISOString().split('T')[0];
};

// ——— HELPER: Normalizar cédula (quitar letras, puntos, guiones, espacios) ———
const normalizarCedula = (ced) => {
  if (!ced) return null;
  // Convertir a string y quitar todo lo que no sea número
  return String(ced).replace(/[^0-9]/g, '');
};

// ——— HELPER: Adaptar fila de paciente para JSON (Patrón Adaptador) ———
const adaptarPaciente = (row) => {
  const { activo, ...rest } = row;
  return {
    ...rest,
    edad: edadDesdeFechaNacimiento(row.fecha_nacimiento),
    fecha_nacimiento: row.fecha_nacimiento ? row.fecha_nacimiento.toISOString().split('T')[0] : null,
  };
};

const app = express();

// Configuración dinámica de Proxies (Requerido para Railway, pero causa error en local)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Confía en el primer proxy (Railway/Load Balancer)
} else {
  app.set('trust proxy', false); // En local no hay proxy, evita ERR_ERL_PERMISSIVE_TRUST_PROXY
}
const PORT = process.env.PORT || 3000;

// ——— CONFIGURACIÓN ———
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos por IP
  message: { error: 'Demasiados intentos de login. Intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ——— CONEXIÓN POSTGRESQL ———
const connectionString = process.env.DATABASE_URL;
const pool = new Pool(
  connectionString
    ? { connectionString, ssl: { rejectUnauthorized: false } }
    : {
      user: process.env.DB_USER || 'sivico23_user',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'sivico23_db',
      password: process.env.DB_PASSWORD || 'sivico23_password',
      port: process.env.DB_PORT || 5432,
    }
);

// Test conexión + limpieza automática de duplicados al arrancar
pool.query('SELECT NOW()', async (err, res) => {
  if (err) {
    console.error('❌ Error conectando a PostgreSQL:', err);
  } else {
    console.log('✅ PostgreSQL conectado:', res.rows[0].now);

    // Auto-limpiar cédulas duplicadas en la tabla pacientes
    try {
      // Reasignar registros médicos al paciente más antiguo
      await pool.query(`
        UPDATE registros r
        SET paciente_id = (
          SELECT MIN(p2.id) FROM pacientes p2
          WHERE p2.cedula = (SELECT cedula FROM pacientes WHERE id = r.paciente_id)
        )
        WHERE r.paciente_id IN (
          SELECT id FROM pacientes
          WHERE cedula IN (SELECT cedula FROM pacientes GROUP BY cedula HAVING COUNT(*) > 1)
          AND id NOT IN (SELECT MIN(id) FROM pacientes GROUP BY cedula)
        )
      `);

      // Eliminar los duplicados más recientes
      const dupDel = await pool.query(`
        DELETE FROM pacientes
        WHERE id NOT IN (SELECT MIN(id) FROM pacientes GROUP BY cedula)
          AND cedula IN (SELECT cedula FROM pacientes GROUP BY cedula HAVING COUNT(*) > 1)
        RETURNING cedula
      `);

      if (dupDel.rowCount > 0) {
        console.log(`⚠️  Auto-deduplicación: eliminados ${dupDel.rowCount} pacientes duplicados:`,
          dupDel.rows.map(r => r.cedula).join(', '));
      } else {
        console.log('✅ Sin cédulas duplicadas en pacientes.');
      }
      // 3. Normalizar cédulas en la tabla usuarios
      const userNorm = await pool.query(`
        UPDATE usuarios
        SET cedula = regexp_replace(cedula, '[^0-9]', '', 'g')
        WHERE cedula ~ '[^0-9]'
        RETURNING id, cedula
      `);

      if (userNorm.rowCount > 0) {
        console.log(`⚠️  Normalización Usuarios: corregidas ${userNorm.rowCount} cédulas de usuario.`);
      }

      // Eliminar usuarios duplicados si los hubiere después de normalizar (conservar más antiguo)
      await pool.query(`
        DELETE FROM usuarios
        WHERE id NOT IN (SELECT MIN(id) FROM usuarios GROUP BY cedula)
          AND cedula IN (SELECT cedula FROM usuarios GROUP BY cedula HAVING COUNT(*) > 1)
      `);
    } catch (startupErr) {
      console.warn('⚠️  Error en procesos de limpieza inicial (no crítico):', startupErr.message);
    }
  }
});

// ——— MIDDLEWARE DE AUTENTICACIÓN ———
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  // Permitir token de desarrollo en entorno DEV
  const devToken = process.env.DEV_TOKEN;
  if (process.env.NODE_ENV === 'development' && devToken && token === devToken) {
    req.user = { id: 1, cedula: 'V-00000000', rol: 'medico', dev: true };
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET || 'sivico23_secret_key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// ——— MIDDLEWARE DE AUTORIZACIÓN POR ROLES ———
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const role = req.user && req.user.rol ? String(req.user.rol).toLowerCase() : '';
    const allowed = allowedRoles.map(r => String(r).toLowerCase());
    if (!allowed.includes(role)) {
      console.warn(`Acceso denegado para usuario ${req.user?.cedula} rol = ${role} ruta = ${req.path}`);
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  };
};

// Health check
app.get('/api/health', (req, res) => {
  console.log(`[HEALTH] Check desde: ${req.ip} - ${new Date().toISOString()}`);
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ============================================================
// RUTAS DE AUTENTICACIÓN
// ============================================================

// POST /api/auth/register — Registrar nuevo usuario
app.post('/api/auth/register', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    let { cedula, nombre, apellido, email, password, rol } = req.body;
    cedula = normalizarCedula(cedula);

    // Validaciones
    if (!cedula || !nombre || !apellido || !password) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Verificar si ya existe
    const existente = await pool.query(
      'SELECT * FROM usuarios WHERE cedula = $1 OR email = $2',
      [cedula, email]
    );

    if (existente.rows.length > 0) {
      return res.status(409).json({ error: 'Usuario ya existe' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar usuario (con búsqueda de rol_id)
    const resRol = await pool.query('SELECT id FROM roles WHERE nombre = $1', [rol || 'vocero']);
    const rol_id = resRol.rows[0]?.id || 3; // Default vocero

    const resSector = req.body.sector ? await pool.query('SELECT id FROM sectores WHERE nombre = $1', [req.body.sector]) : { rows: [] };
    const sector_id = resSector.rows[0]?.id || null;

    const result = await pool.query(
      `INSERT INTO usuarios(cedula, nombre, apellido, email, password_hash, rol_id, sector_id, activo)
       VALUES($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id, cedula, nombre, apellido, email, created_at`,
      [cedula, nombre, apellido, email, hashedPassword, rol_id, sector_id]
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      usuario: { ...result.rows[0], rol: rol || 'vocero' }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/login — Iniciar sesión (con rate limiting anti brute-force)
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    let { cedula, password } = req.body;
    if (!cedula || !password) {
      return res.status(400).json({ error: 'Cédula y contraseña requeridos' });
    }
    cedula = normalizarCedula(cedula);

    // Buscar usuario con JOIN a roles y sectores (ESQUEMA 3FN)
    const result = await pool.query(
      `SELECT u.*, r.nombre AS rol, s.nombre AS sector_nombre 
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       LEFT JOIN sectores s ON u.sector_id = s.id
       WHERE (u.cedula = $1 OR regexp_replace(u.cedula, '[^0-9]', '', 'g') = $1) AND u.activo = true`,
      [cedula]
    );

    if (result.rows.length === 0) {
      console.warn(`[LOGIN] Usuario no encontrado: ${cedula}`);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const usuario = result.rows[0];

    // Verificar password
    const match = await bcrypt.compare(password, usuario.password_hash);

    if (!match) {
      console.warn(`[LOGIN] Contraseña incorrecta para: ${cedula}`);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: usuario.id, cedula: usuario.cedula, rol: usuario.rol },
      process.env.JWT_SECRET || 'sivico23_secret_key',
      { expiresIn: '7d' }
    );

    // Actualizar último login
    await pool.query(
      'UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1',
      [usuario.id]
    );

    res.json({
      message: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        cedula: usuario.cedula,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/me — Verificar token y obtener usuario actual
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.cedula, u.nombre, u.apellido, u.email, r.nombre AS rol, s.nombre AS sector_nombre 
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       LEFT JOIN sectores s ON u.sector_id = s.id
       WHERE u.id = $1 AND u.activo = true`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }
    res.json({ usuario: result.rows[0] });
  } catch (error) {
    console.error('Error en /auth/me:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================================
// RUTAS DE CATÁLOGOS (3FN)
// ============================================================

app.get('/api/catalogos/roles', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre, descripcion FROM roles ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo roles:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/catalogos/categorias', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre FROM categorias_cie10 ORDER BY nombre ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/catalogos/sectores', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sectores ORDER BY nombre ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo sectores:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// ============================================================
// RUTAS DE PACIENTES
// ============================================================

// GET /api/pacientes — Listar todos los pacientes (solo activos)
app.get('/api/pacientes', authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, busqueda } = req.query;

    let query = `
      SELECT p.*, s.nombre AS sector_nombre,
      EXISTS (
        SELECT 1 FROM tratamientos t
        JOIN registros r ON t.registro_id = r.id
        JOIN patologias_cie10 pc ON t.patologia_id = pc.id
        WHERE r.paciente_id = p.id AND (pc.codigo = 'I10' OR pc.codigo = 'E11')
      ) AS tiene_cronica
      FROM pacientes p
      LEFT JOIN sectores s ON p.sector_id = s.id
      WHERE p.activo = true`;
    const params = [];

    if (busqueda) {
      const idx = params.length;
      query += ` AND (p.cedula ILIKE $${idx + 1} OR p.nombre ILIKE $${idx + 2} OR p.apellido ILIKE $${idx + 3})`;
      params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      pacientes: result.rows.map(row => ({
        ...adaptarPaciente(row),
        sector_nombre: row.sector // Compatibilidad con frontend
      })),
      total: result.rowCount
    });
  } catch (error) {
    console.error('Error obteniendo pacientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/pacientes/:cedula/historial — Obtener expediente consolidado (MUST be before /:cedula)
app.get('/api/pacientes/:cedula/historial', authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
  try {
    const cedula = normalizarCedula(req.params.cedula);

    // Control ciudadano: solo puede ver su propio historial
    const role = (req.user && req.user.rol) ? String(req.user.rol).toLowerCase() : '';
    if (role === 'ciudadano' && String(req.user.cedula) !== String(cedula)) {
      return res.status(403).json({ error: 'Acceso denegado. Solo puede ver su propio historial.' });
    }

    // Obtener info básica del paciente
    const resPaciente = await pool.query(
      `SELECT p.id, p.cedula, p.nombre, p.apellido,
              EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER AS edad,
              p.sexo, p.telefono, s.nombre AS sector_nombre,
              EXISTS (
                SELECT 1 FROM tratamientos t
                JOIN registros r ON t.registro_id = r.id
                JOIN patologias_cie10 pc ON t.patologia_id = pc.id
                WHERE r.paciente_id = p.id AND (pc.codigo = 'I10' OR pc.codigo = 'E11')
              ) AS tiene_cronica
       FROM pacientes p
       LEFT JOIN sectores s ON p.sector_id = s.id
       WHERE p.cedula = $1 AND p.activo = true`,
      [cedula]
    );

    if (resPaciente.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    const paciente = resPaciente.rows[0];

    // Obtener todos los registros del paciente
    const resRegistros = await pool.query(
      `SELECT r.id, r.codigo, r.fecha, r.observaciones, u.nombre as vocero_nombre 
       FROM registros r 
       JOIN usuarios u ON r.usuario_id = u.id 
       WHERE r.paciente_id = $1 
       ORDER BY r.fecha DESC`,
      [paciente.id]
    );

    const consultas = [];

    // Para cada registro, cargar tratamientos y medicamentos
    for (const reg of resRegistros.rows) {
      const resTrat = await pool.query(
        `SELECT t.id, c.nombre AS categoria, pc.nombre AS patologia, pc.codigo AS cie10 
         FROM tratamientos t 
         JOIN patologias_cie10 pc ON t.patologia_id = pc.id
         JOIN categorias_cie10 c ON pc.categoria_id = c.id
         WHERE t.registro_id = $1`,
        [reg.id]
      );

      const tratamientos = resTrat.rows;
      for (const trat of tratamientos) {
        const resMeds = await pool.query(
          `SELECT nombre, presentacion, dosis, via, disponibilidad 
           FROM medicamentos WHERE tratamiento_id = $1`,
          [trat.id]
        );
        trat.medicamentos = resMeds.rows;
      }

      consultas.push({
        id: reg.id,
        codigo: reg.codigo,
        fecha: reg.fecha,
        observaciones: reg.observaciones,
        vocero: reg.vocero_nombre,
        tratamientos
      });
    }

    res.json({ paciente, consultas });
  } catch (error) {
    console.error('Error obteniendo historial por cédula:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/pacientes/:cedula — Buscar paciente por cédula (solo activos)
app.get('/api/pacientes/:cedula', authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
  try {
    const cedula = normalizarCedula(req.params.cedula);

    const result = await pool.query(
      `SELECT p.*, s.nombre AS sector_nombre,
       EXISTS (
         SELECT 1 FROM tratamientos t
         JOIN registros r ON t.registro_id = r.id
         JOIN patologias_cie10 pc ON t.patologia_id = pc.id
         WHERE r.paciente_id = p.id AND (pc.codigo = 'I10' OR pc.codigo = 'E11')
       ) AS tiene_cronica
       FROM pacientes p 
       LEFT JOIN sectores s ON p.sector_id = s.id
       WHERE p.cedula = $1 AND p.activo = true`,
      [cedula]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    res.json(adaptarPaciente(result.rows[0]));
  } catch (error) {
    console.error('Error buscando paciente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/pacientes — Crear o actualizar paciente manualmente
app.post('/api/pacientes', authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
  try {
    let { cedula, nombre, apellido, edad, fecha_nacimiento, sexo, telefono, sector, direccionOrCoord } = req.body;
    const direccion = direccionOrCoord;

    cedula = normalizarCedula(cedula);

    if (!nombre || !apellido || (!edad && edad !== 0 && !fecha_nacimiento)) {
      return res.status(400).json({ error: 'Datos requeridos incompletos (nombre, apellido, edad o fecha de nacimiento)' });
    }

    // Adapter: usar fecha_nacimiento si viene, sino convertir edad → fecha_nacimiento
    const fechaNac = fecha_nacimiento || fechaNacimientoDesdeEdad(edad);

    // Obtener sector_id si viene el nombre
    let sector_id = null;
    if (sector) {
      const resS = await pool.query('SELECT id FROM sectores WHERE nombre = $1', [sector]);
      sector_id = resS.rows[0]?.id || null;
    }

    let result;
    if (cedula) {
      // UPSERT por cédula
      result = await pool.query(
        `INSERT INTO pacientes(cedula, nombre, apellido, fecha_nacimiento, sexo, telefono, sector_id, direccion)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT(cedula) WHERE cedula IS NOT NULL DO UPDATE SET
           nombre = EXCLUDED.nombre,
           apellido = EXCLUDED.apellido,
           fecha_nacimiento = EXCLUDED.fecha_nacimiento,
           sexo = EXCLUDED.sexo,
           telefono = COALESCE(EXCLUDED.telefono, pacientes.telefono),
           sector_id = COALESCE(EXCLUDED.sector_id, pacientes.sector_id),
           direccion = COALESCE(EXCLUDED.direccion, pacientes.direccion),
           activo = true,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *, (xmax = 0) AS es_nuevo`,
        [cedula, nombre, apellido, fechaNac, sexo || null, telefono || null, sector_id, direccion || null]
      );
    } else {
      // Sin cédula (infantes): buscar duplicado por nombre+apellido+fecha_nacimiento
      const existente = await pool.query(
        `SELECT * FROM pacientes WHERE nombre = $1 AND apellido = $2 AND fecha_nacimiento = $3 AND activo = true`,
        [nombre, apellido, fechaNac]
      );

      if (existente.rows.length > 0) {
        // Actualizar el existente
        result = await pool.query(
          `UPDATE pacientes SET
            sexo = COALESCE($1, sexo),
            telefono = COALESCE($2, telefono),
            sector_id = COALESCE($3, sector_id),
            direccion = COALESCE($4, direccion),
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $5
           RETURNING *, false AS es_nuevo`,
          [sexo || null, telefono || null, sector_id, direccion || null, existente.rows[0].id]
        );
      } else {
        result = await pool.query(
          `INSERT INTO pacientes(cedula, nombre, apellido, fecha_nacimiento, sexo, telefono, sector_id, direccion)
           VALUES(NULL, $1, $2, $3, $4, $5, $6, $7)
           RETURNING *, true AS es_nuevo`,
          [nombre, apellido, fechaNac, sexo || null, telefono || null, sector_id, direccion || null]
        );
      }
    }

    const paciente = result.rows[0];
    const esNuevo = paciente.es_nuevo;

    res.status(esNuevo ? 201 : 200).json({
      message: esNuevo ? 'Paciente creado exitosamente' : 'Paciente actualizado',
      paciente: adaptarPaciente(paciente),
    });
  } catch (error) {
    console.error('Error creando paciente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/pacientes/:id — Soft Delete (marcar como inactivo)
app.delete('/api/pacientes/:id', authenticateToken, authorizeRoles('admin', 'medico'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE pacientes SET activo = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND activo = true
       RETURNING id, nombre, apellido`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado o ya inactivo' });
    }

    res.json({
      message: 'Paciente desactivado exitosamente',
      paciente: result.rows[0]
    });
  } catch (error) {
    console.error('Error desactivando paciente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/admin/limpiar-duplicados — Eliminar ptes duplicados (solo admin)
app.get('/api/admin/limpiar-duplicados', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ver cuántos duplicados hay
    const dup = await client.query(
      `SELECT cedula, COUNT(*) as cnt, array_agg(id ORDER BY id) as ids
       FROM pacientes GROUP BY cedula HAVING COUNT(*) > 1`
    );
    const totalDup = dup.rows.length;

    if (totalDup === 0) {
      await client.query('ROLLBACK');
      return res.json({ message: 'No hay cédulas duplicadas en la base de datos', duplicados: 0 });
    }

    // Reasignar registros médicos del duplicado al paciente original (id más bajo)
    await client.query(`
      UPDATE registros r
      SET paciente_id = (
  SELECT MIN(p2.id) FROM pacientes p2
        WHERE p2.cedula = (SELECT cedula FROM pacientes WHERE id = r.paciente_id)
      )
      WHERE r.paciente_id IN(
    SELECT id FROM pacientes
        WHERE cedula IN(SELECT cedula FROM pacientes GROUP BY cedula HAVING COUNT(*) > 1)
        AND id NOT IN(SELECT MIN(id) FROM pacientes GROUP BY cedula)
  )
  `);

    // Reasignar alertas si existen
    await client.query(`
      UPDATE alertas_emergencia ae
      SET paciente_id = (
  SELECT MIN(p2.id) FROM pacientes p2
        WHERE p2.cedula = (SELECT cedula FROM pacientes WHERE id = ae.paciente_id)
      )
      WHERE ae.paciente_id IS NOT NULL
        AND ae.paciente_id IN(
    SELECT id FROM pacientes
          WHERE cedula IN(SELECT cedula FROM pacientes GROUP BY cedula HAVING COUNT(*) > 1)
          AND id NOT IN(SELECT MIN(id) FROM pacientes GROUP BY cedula)
  )
  `).catch(() => { }); // Silenciar si no hay alertas

    // Eliminar los pacientes duplicados (conservar el de id más bajo)
    const delResult = await client.query(`
      DELETE FROM pacientes
      WHERE id NOT IN(SELECT MIN(id) FROM pacientes GROUP BY cedula)
        AND cedula IN(SELECT cedula FROM pacientes GROUP BY cedula HAVING COUNT(*) > 1)
      RETURNING id, cedula
  `);

    await client.query('COMMIT');
    res.json({
      message: `Limpieza completada: ${delResult.rowCount} registros duplicados eliminados`,
      eliminados: delResult.rows,
      cedulas_afectadas: totalDup,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error limpiando duplicados:', error);
    res.status(500).json({ error: 'Error al limpiar duplicados: ' + error.message });
  } finally {
    client.release();
  }
});

// ============================================================
// RUTAS DE REGISTROS MÉDICOS
// ============================================================

// POST /api/registros — Crear nuevo registro médico
app.post('/api/registros', authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { paciente_cedula, paciente, tratamientos, observaciones } = req.body;
    const usuario_id = req.user.id;

    // 1. VALIDAR USUARIO (Session Check)
    const checkUser = await client.query('SELECT id FROM usuarios WHERE id = $1 AND activo = true', [usuario_id]);
    if (checkUser.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        error: 'Sesión expirada',
        requireLogout: true,
        detalle: 'Tu sesión es antigua. Por favor, CIERRA SESIÓN y vuelve a entrar.'
      });
    }

    // 2. PROCESAR PACIENTE (UPSERT)
    let cedula = normalizarCedula(paciente_cedula || paciente?.cedula);
    if (cedula === '') cedula = null;

    let fechaNac = paciente?.fecha_nacimiento || paciente?.fechaNacimiento;
    if (fechaNac && String(fechaNac).includes('/')) {
      fechaNac = fechaNac.split('/').reverse().join('-');
    }
    if (!fechaNac && paciente?.edad) fechaNac = fechaNacimientoDesdeEdad(paciente.edad);
    if (!fechaNac) fechaNac = '2000-01-01';

    // Obtener sector_id
    let sector_id = null;
    if (paciente?.sector) {
      const resS = await client.query('SELECT id FROM sectores WHERE nombre = $1', [paciente.sector]);
      sector_id = resS.rows[0]?.id || null;
    }

    let cedulaRep = normalizarCedula(paciente?.cedula_representante || req.body.cedula_representante);
    if (cedulaRep === '') cedulaRep = null;

    let paciente_id;
    if (cedula) {
      const pUpsert = await client.query(
        `INSERT INTO pacientes(cedula, nombre, apellido, fecha_nacimiento, sexo, telefono, sector_id, direccion)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT(cedula) WHERE cedula IS NOT NULL DO UPDATE SET
           nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido, sector_id = COALESCE(EXCLUDED.sector_id, pacientes.sector_id),
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [cedula, paciente?.nombre || 'S/N', paciente?.apellido || 'S/A', fechaNac, paciente?.sexo || 'Masculino', paciente?.telefono || null, sector_id, paciente?.direccion || null]
      );
      paciente_id = pUpsert.rows[0].id;
    } else {
      const pFind = await client.query(
        'SELECT id FROM pacientes WHERE nombre=$1 AND apellido=$2 AND fecha_nacimiento=$3 AND (cedula_representante=$4 OR (cedula_representante IS NULL AND $4 IS NULL))',
        [paciente?.nombre, paciente?.apellido, fechaNac, cedulaRep]
      );
      if (pFind.rows.length > 0) {
        paciente_id = pFind.rows[0].id;
      } else {
        const pIns = await client.query(
          `INSERT INTO pacientes(nombre, apellido, fecha_nacimiento, sexo, telefono, sector_id, direccion, cedula_representante)
           VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [paciente?.nombre || 'S/N', paciente?.apellido || 'S/A', fechaNac, paciente?.sexo || 'Masculino', paciente?.telefono || null, sector_id, paciente?.direccion || null, cedulaRep]
        );
        paciente_id = pIns.rows[0].id;
      }
    }

    // 3. REGISTRO PRINCIPAL
    const codigoFinal = `SIV-${new Date().getFullYear()}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
    const regRes = await client.query(
      `INSERT INTO registros(codigo, paciente_id, usuario_id, observaciones) VALUES($1, $2, $3, $4) RETURNING id`,
      [codigoFinal, paciente_id, usuario_id, observaciones || null]
    );
    const registro_id = regRes.rows[0].id;

    // 4. TRATAMIENTOS Y MEDICAMENTOS
    for (const t of (tratamientos || [])) {
      let cie10 = t.patologia?.cie10 || t.cie10 || (typeof t.patologia === 'string' ? t.patologia : 'Z00.0');
      if (cie10.length > 10) cie10 = 'Z00.0';

      // Buscar patologia_id
      const resP = await client.query('SELECT id FROM patologias_cie10 WHERE codigo = $1', [cie10]);
      const patologia_id = resP.rows[0]?.id || 4; // Default Z00.0

      const tIns = await client.query(
        `INSERT INTO tratamientos(registro_id, patologia_id, descripcion) VALUES($1, $2, $3) RETURNING id`,
        [registro_id, patologia_id, t.patologia?.nombre || (typeof t.patologia === 'string' ? t.patologia : 'Consulta')]
      );
      const t_id = tIns.rows[0].id;

      for (const m of (t.medicamentos || [])) {
        let pres = m.presentacion_seleccionada ? `${m.presentacion_seleccionada.forma || ''} ${m.presentacion_seleccionada.mg || ''}`.trim() : m.presentacion;
        const medNombreFinal = m.nombre && m.nombre !== 'Medicamento' ? m.nombre : (t.patologia?.nombre ? `Med. para ${t.patologia.nombre}` : 'Medicamento no especificado');
        await client.query(
          `INSERT INTO medicamentos(tratamiento_id, nombre, presentacion, dosis, es_oficial) VALUES($1, $2, $3, $4, false)`,
          [t_id, medNombreFinal, pres || null, m.dosis_seleccionada?.valor || m.dosis || null]
        );
      }
    }

    // 5. RESPUESTA EXITOSA
    await client.query('COMMIT');
    console.log(`[REGISTRO] ✅ Guardado exitoso: ${codigoFinal} (ID: ${registro_id})`);
    res.status(201).json({ success: true, codigo: codigoFinal, id: registro_id });

  } catch (e) {
    if (client) await client.query('ROLLBACK');
    
    // LOG DETALLADO PARA DEPURACIÓN
    console.error('!!! REGISTRO ERROR ERROR !!!');
    console.error('Mensaje:', e.message);
    console.error('Stack:', e.stack);
    console.error('Payload recibido:', JSON.stringify(req.body, null, 2));
    
    // Si el error es por falta de datos, retornar 400 con detalle
    if (e.message.includes('null value') || e.message.includes('NOT NULL')) {
      return res.status(400).json({ 
        error: 'Datos incompletos', 
        detalle: 'Faltan campos obligatorios en el registro.',
        codigo_db: e.code 
      });
    }

    res.status(500).json({ 
      error: 'Fallo crítico al guardar registro', 
      detalle: e.message 
    });
  } finally {
    client.release();
  }
});

// GET /api/registros — Listar registros
app.get('/api/registros', authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
  try {
    const { paciente_cedula, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT r.id, r.codigo, r.fecha, 
             p.cedula, p.nombre, p.apellido, p.fecha_nacimiento,
             p.sexo, s.nombre AS sector,
             (SELECT pc2.nombre FROM tratamientos t2 
              JOIN patologias_cie10 pc2 ON t2.patologia_id = pc2.id 
              WHERE t2.registro_id = r.id LIMIT 1) as patologia_nombre,
             (SELECT c2.nombre FROM tratamientos t2 
              JOIN patologias_cie10 pc2 ON t2.patologia_id = pc2.id 
              JOIN categorias_cie10 c2 ON pc2.categoria_id = c2.id
              WHERE t2.registro_id = r.id LIMIT 1) as patologia_categoria,
             u.nombre as vocero_nombre,
             EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER AS edad
      FROM registros r
      JOIN pacientes p ON r.paciente_id = p.id
      LEFT JOIN sectores s ON p.sector_id = s.id
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE 1 = 1
    `;
    const params = [];

    if (paciente_cedula) {
      query += ` AND p.cedula = $${params.length + 1} `;
      params.push(paciente_cedula);
    }

    // Control de acceso por rol
    const role = (req.user && req.user.rol) ? String(req.user.rol).toLowerCase() : '';
    if (role === 'vocero') {
      query += ` AND r.usuario_id = $${params.length + 1} `;
      params.push(req.user.id);
    }

    query += ` ORDER BY r.fecha DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2} `;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Mapear a formato anidado esperado por el frontend
    const registrosMapeados = result.rows.map(row => ({
      id: row.id,
      codigo: row.codigo,
      fecha: row.fecha,
      paciente: {
        cedula: row.cedula,
        nombre: row.nombre,
        apellido: row.apellido,
        fecha_nacimiento: row.fecha_nacimiento,
        sexo: row.sexo,
        sector: row.sector,
        edad: row.edad
      },
      patologia: {
        nombre: row.patologia_nombre || 'Consulta General',
        categoria: row.patologia_categoria
      },
      categoria: {
        nombre: row.patologia_categoria
      },
      vocero_nombre: row.vocero_nombre
    }));

    res.json({
      registros: registrosMapeados,
      total: result.rowCount
    });
  } catch (error) {
    console.error('Error obteniendo registros:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/registros/:id — Obtener detalle completo de un registro
app.get('/api/registros/:id', authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
  try {
    const { id } = req.params;

    // Registro principal (incluye usuario_id para control de acceso)
    const registro = await pool.query(
      `SELECT r.*, r.usuario_id, p.cedula, p.nombre, p.apellido,
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER AS edad,
    p.sexo, p.telefono, s.nombre AS sector
       FROM registros r
       JOIN pacientes p ON r.paciente_id = p.id
       LEFT JOIN sectores s ON p.sector_id = s.id
       WHERE r.id = $1`,
      [id]
    );

    if (registro.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    // Control de acceso por rol al detalle:
    const roleDetail = (req.user && req.user.rol) ? String(req.user.rol).toLowerCase() : '';
    const regRow = registro.rows[0];
    if (roleDetail === 'vocero' && regRow.usuario_id !== req.user.id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Tratamientos (Actualizado 3FN)
    const tratamientos = await pool.query(
      `SELECT t.id, c.nombre as categoria, pc.codigo AS cie10, t.descripcion AS patologia
       FROM tratamientos t
       LEFT JOIN patologias_cie10 pc ON t.patologia_id = pc.id
       LEFT JOIN categorias_cie10 c ON pc.categoria_id = c.id
       WHERE t.registro_id = $1`,
      [id]
    );

    // Medicamentos por tratamiento
    for (const trat of tratamientos.rows) {
      const meds = await pool.query(
        `SELECT nombre, presentacion, dosis, via, disponibilidad
         FROM medicamentos
         WHERE tratamiento_id = $1`,
        [trat.id]
      );
      trat.medicamentos = meds.rows;
    }

    res.json({
      registro: registro.rows[0],
      tratamientos: tratamientos.rows
    });
  } catch (error) {
    console.error('Error obteniendo detalle:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// END of previous routes

// DELETE /api/registros/:registroId/tratamientos/:tratamientoId — Quitar patología de registro
app.delete('/api/registros/:registroId/tratamientos/:tratamientoId',
  authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { registroId, tratamientoId } = req.params;

      // Verificar que el tratamiento pertenece al registro
      const trat = await client.query(
        'SELECT t.id FROM tratamientos t WHERE t.id = $1 AND t.registro_id = $2',
        [tratamientoId, registroId]
      );
      if (trat.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Tratamiento no encontrado en ese registro' });
      }

      // Eliminar medicamentos del tratamiento primero
      await client.query('DELETE FROM medicamentos WHERE tratamiento_id = $1', [tratamientoId]);
      // Eliminar tratamiento
      await client.query('DELETE FROM tratamientos WHERE id = $1', [tratamientoId]);

      await client.query('COMMIT');
      res.json({ message: 'Patología eliminada del registro exitosamente' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error eliminando tratamiento:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
      client.release();
    }
  }
);

// POST /api/registros/:id/tratamientos — Agregar nueva patología a registro existente
app.post('/api/registros/:id/tratamientos',
  authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { id } = req.params;
      const { patologia, categoria, medicamentos = [] } = req.body;

      if (!patologia) {
        return res.status(400).json({ error: 'Patología requerida' });
      }

      const patNombre = typeof patologia === 'object' ? patologia.nombre : String(patologia);
      let patCie10 = typeof patologia === 'object' ? (patologia.cie10 || patNombre) : String(patologia);

      if (!patCie10 || patCie10 === 'Desconocida') {
        patCie10 = 'Z00.0';
      }

      // Buscar patologia_id por codigo (Actualizado 3FN)
      const resP = await client.query('SELECT id FROM patologias_cie10 WHERE codigo = $1', [patCie10]);
      const patologia_id = resP.rows[0]?.id || 4; // Default Z00.0

      const trat = await client.query(
        `INSERT INTO tratamientos(registro_id, patologia_id, descripcion)
         VALUES($1, $2, $3) RETURNING id`,
        [id, patologia_id, patNombre]
      );
      const tratamientoId = trat.rows[0].id;

      for (const med of medicamentos) {
        await client.query(
          `INSERT INTO medicamentos(tratamiento_id, nombre, presentacion, dosis, via, disponibilidad)
VALUES($1, $2, $3, $4, $5, $6)`,
          [tratamientoId, med.nombre, med.presentacion || null, med.dosis || null, med.via || null, med.disponibilidad || null]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ message: 'Patología agregada exitosamente', tratamiento_id: tratamientoId });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error agregando tratamiento:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
      client.release();
    }
  }
);


// ============================================================
// RUTAS DE EMERGENCIAS (SOS)
// ============================================================

// POST /api/alertas — Crear una nueva alerta de emergencia
app.post('/api/alertas', authenticateToken, async (req, res) => {
  try {
    const { tipo, latitud, longitud, direccion, paciente_id } = req.body;
    const usuario_id = req.user.id; // Usuario que emite la alerta (médico/vocero)

    if (!tipo || !latitud || !longitud) {
      return res.status(400).json({ error: 'Faltan datos críticos (tipo, lat, lng)' });
    }

    const result = await pool.query(
      `INSERT INTO alertas_emergencia (paciente_id, usuario_id, tipo, latitud, longitud, direccion, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'activa')
       RETURNING *`,
      [paciente_id || null, usuario_id, tipo, latitud, longitud, direccion || null]
    );

    console.log(`[SOS] 🚨 Alerta registrada: ID ${result.rows[0].id} - Usuario: ${usuario_id}`);

    res.status(201).json({
      message: 'Alerta registrada exitosamente',
      alerta: result.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar alerta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/alertas — Obtener historial de alertas (Admin/Medicos/Voceros - Monitor Comunitario)
app.get('/api/alertas', authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
  try {
    const { estado, limite = 50 } = req.query;
    let query = `
      SELECT a.*, 
             u.nombre as usuario_nombre, u.apellido as usuario_apellido,
             p.nombre as paciente_nombre, p.apellido as paciente_apellido,
             ua.nombre as atendida_por_nombre
      FROM alertas_emergencia a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      LEFT JOIN pacientes p ON a.paciente_id = p.id
      LEFT JOIN usuarios ua ON a.atendida_por = ua.id
    `;
    const params = [];

    if (estado) {
      query += ` WHERE a.estado = $1`;
      params.push(estado);
    }

    query += ` ORDER BY a.fecha DESC LIMIT $${params.length + 1}`;
    params.push(limite);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/alertas/:id — Actualizar estado de una alerta (Atender/Cancelar)
app.put('/api/alertas/:id', authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, observaciones } = req.body;
    const atendida_por = req.user.id;

    if (!['atendida', 'cancelada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const result = await pool.query(
      `UPDATE alertas_emergencia 
       SET estado = $1, observaciones = $2, atendida_por = $3, fecha_atencion = NOW()
       WHERE id = $4
       RETURNING *`,
      [estado, observaciones || null, atendida_por, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    res.json({
      message: 'Alerta actualizada correctamente',
      alerta: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar alerta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================================
// RUTAS DE ESTADÍSTICAS
// ============================================================

// GET /api/estadisticas — Dashboard estadísticas con soporte de filtrado temporal
app.get('/api/estadisticas', authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Construcción de cláusula WHERE temporal
    let timeFilter = 'WHERE 1=1'; 
    let params = [];
    if (startDate && endDate) {
      timeFilter = 'WHERE r.fecha BETWEEN $1 AND $2';
      params = [startDate, endDate];
    }

    // 1. Total registros en el periodo
    const totalRegistros = await pool.query(
      `SELECT COUNT(*) FROM registros r ${timeFilter}`, 
      params
    );

    // 2. Total pacientes únicos atendidos en el periodo
    const totalPacientes = await pool.query(
      `SELECT COUNT(DISTINCT r.paciente_id) FROM registros r ${timeFilter}`,
      params
    );

    // 3. Registros de hoy (siempre fijo o relativo al periodo)
    const registrosHoy = await pool.query(
      "SELECT COUNT(*) FROM registros WHERE DATE(fecha) = CURRENT_DATE"
    );

    // 4. Patologías más comunes en el periodo (Actualizado 3FN)
    const patologiasComunes = await pool.query(
      `SELECT pc.nombre as patologia, COUNT(t.id) as total
       FROM tratamientos t
       JOIN registros r ON t.registro_id = r.id
       JOIN patologias_cie10 pc ON t.patologia_id = pc.id
       ${timeFilter}
       GROUP BY pc.nombre
       ORDER BY total DESC
       LIMIT 5`,
      params
    );

    // 5. Medicamentos más usados en el periodo
    const medicamentosComunes = await pool.query(
      `SELECT m.nombre, COUNT(m.id) as total
       FROM medicamentos m
       JOIN tratamientos t ON m.tratamiento_id = t.id
       JOIN registros r ON t.registro_id = r.id
       ${timeFilter}
       GROUP BY m.nombre
       ORDER BY total DESC
       LIMIT 10`,
      params
    );

    // 6. Distribución por edades de pacientes atendidos en el periodo
    const distEdades = await pool.query(`
      SELECT
        CASE
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER < 18 THEN 'Menor de 18'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER BETWEEN 18 AND 35 THEN '18-35'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER BETWEEN 36 AND 50 THEN '36-50'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER BETWEEN 51 AND 65 THEN '51-65'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER > 65 THEN 'Mayor de 65'
          ELSE 'Sin datos'
        END AS rango,
        COUNT(DISTINCT p.id) as total
      FROM pacientes p
      JOIN registros r ON r.paciente_id = p.id
      ${timeFilter}
      GROUP BY rango
      ORDER BY MIN(EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER)
    `, params);

    // 7. Distribución por categoría en el periodo (Actualizado 3FN)
    const distCategorias = await pool.query(`
      SELECT c.nombre as categoria, COUNT(t.id) as total
      FROM tratamientos t
      JOIN registros r ON t.registro_id = r.id
      JOIN patologias_cie10 pc ON t.patologia_id = pc.id
      JOIN categorias_cie10 c ON pc.categoria_id = c.id
      ${timeFilter}
      GROUP BY c.nombre
      ORDER BY total DESC
    `, params);

    // 8. Distribución por sexo en el periodo
    const distSexo = await pool.query(`
      SELECT
        CASE WHEN p.sexo IS NULL OR p.sexo = '' THEN 'No especificado' ELSE p.sexo END AS sexo,
        COUNT(DISTINCT p.id) as total
      FROM pacientes p
      JOIN registros r ON r.paciente_id = p.id
      ${timeFilter}
      GROUP BY p.sexo
      ORDER BY total DESC
    `, params);

    // 9. Promedio de edad en el periodo
    const promedioEdad = await pool.query(`
      SELECT ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento)))::numeric, 1) AS promedio
      FROM pacientes p
      JOIN registros r ON r.paciente_id = p.id
      ${timeFilter}
    `, params);

    // 11. Distribución por Triaje (Prioridades) en el periodo
    const distTriaje = await pool.query(`
      SELECT
        CASE
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER >= 65 
               OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER <= 5 THEN 'Alta'
          WHEN EXISTS (
            SELECT 1 FROM tratamientos t2
            JOIN patologias_cie10 pc2 ON t2.patologia_id = pc2.id
            JOIN categorias_cie10 c2 ON pc2.categoria_id = c2.id
            JOIN registros r2 ON t2.registro_id = r2.id
            WHERE r2.paciente_id = p.id AND c2.nombre IN ('Cardiovasculares', 'Metabólicas')
          ) THEN 'Media'
          ELSE 'Estándar'
        END AS prioridad,
        COUNT(DISTINCT p.id) as total
      FROM pacientes p
      JOIN registros r ON r.paciente_id = p.id
      ${timeFilter}
      GROUP BY prioridad
      ORDER BY total DESC
    `, params);

    // 12. Estadísticas por Sector (Ranking y Mapas)
    const statsPorSector = await pool.query(`
      SELECT s.nombre as sector, COUNT(r.id) as total_registros, COUNT(DISTINCT p.id) as total_pacientes
      FROM pacientes p
      JOIN sectores s ON p.sector_id = s.id
      JOIN registros r ON r.paciente_id = p.id
      ${timeFilter}
      GROUP BY s.nombre
      ORDER BY total_pacientes DESC
    `, params);

    res.json({
      total_registros: parseInt(totalRegistros.rows[0].count),
      total_pacientes: parseInt(totalPacientes.rows[0].count),
      registros_hoy: parseInt(registrosHoy.rows[0].count),
      patologias_comunes: patologiasComunes.rows,
      medicamentos_comunes: medicamentosComunes.rows,
      distribucion_edades: distEdades.rows,
      distribucion_categorias: distCategorias.rows,
      distribucion_sexo: distSexo.rows,
      distribucion_triaje: distTriaje.rows,
      promedio_edad: parseFloat(promedioEdad.rows[0].promedio) || 0,
      estadisticas_por_sector: statsPorSector.rows,
      filtros: { startDate, endDate } // Útil para feedback en frontend
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/estadisticas/sector/:sector — Estadísticas detalladas de un sector
app.get('/api/estadisticas/sector/:sector', authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
  try {
    const { sector: sectorRaw } = req.params;
    const sector = String(sectorRaw || '').trim();

    // Validación robusta e insensible a mayúsculas
    const sectorExiste = SECTORES_VALIDOS.some(s => s.toLowerCase() === sector.toLowerCase());

    if (!sectorExiste) {
      console.warn(`[Stats] Intento de acceso a sector inválido: "${sector}"`);
      return res.status(400).json({ 
        error: 'Sector inválido', 
        mensaje: `El sector "${sector}" no está en la lista de sectores oficiales de la parroquia.`
      });
    }

    // Usar el nombre oficial de la lista para la query
    const sectorOficial = SECTORES_VALIDOS.find(s => s.toLowerCase() === sector.toLowerCase());

    // Total + desglose por sexo
    const totales = await pool.query(`
SELECT
COUNT(*) AS total_pacientes,
  COUNT(*) FILTER(WHERE p.sexo = 'Masculino') AS total_hombres,
    COUNT(*) FILTER(WHERE p.sexo = 'Femenino') AS total_mujeres,
      COUNT(*) FILTER(WHERE p.fecha_nacimiento IS NOT NULL
          AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento)):: INTEGER < 18) AS total_infantes,
  ROUND(AVG(
    CASE WHEN p.fecha_nacimiento IS NOT NULL
            THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento)):: numeric
            ELSE NULL END
  ), 1) AS promedio_edad
      FROM pacientes p
      JOIN sectores s ON p.sector_id = s.id
      WHERE s.nombre = $1 AND p.activo = true
  `, [sectorOficial]);

    // Distribución por tramos de edad
    const distEdades = await pool.query(`
SELECT
CASE
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento)):: INTEGER < 18 THEN 'Menor de 18'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER BETWEEN 18 AND 35 THEN '18-35'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER BETWEEN 36 AND 50 THEN '36-50'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento))::INTEGER BETWEEN 51 AND 65 THEN '51-65'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento)):: INTEGER > 65 THEN 'Mayor de 65'
          ELSE 'Sin datos'
        END AS rango,
  COUNT(*) AS total
      FROM pacientes p
      JOIN sectores s ON p.sector_id = s.id
      WHERE s.nombre = $1 AND p.activo = true AND p.fecha_nacimiento IS NOT NULL
      GROUP BY rango
      ORDER BY MIN(EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento)):: INTEGER)
  `, [sectorOficial]);

    // Top 5 patologías del sector
    const patologiasComunes = await pool.query(`
      SELECT pc.nombre AS patologia, pc.id AS patologia_id, COUNT(*) AS total
      FROM tratamientos t
      JOIN patologias_cie10 pc ON t.patologia_id = pc.id
      JOIN registros r ON r.id = t.registro_id
      JOIN pacientes p ON p.id = r.paciente_id
      JOIN sectores s ON p.sector_id = s.id
      WHERE s.nombre = $1 AND p.activo = true
      GROUP BY pc.nombre, pc.id
      ORDER BY total DESC
      LIMIT 5
    `, [sectorOficial]);

    // Top 5 medicamentos del sector (Requerimientos de Suministros)
    const medicamentosComunes = await pool.query(`
      SELECT m.nombre, COUNT(*) as total
      FROM medicamentos m
      JOIN tratamientos t ON m.tratamiento_id = t.id
      JOIN registros r ON t.registro_id = r.id
      JOIN pacientes p ON r.paciente_id = p.id
      JOIN sectores s ON p.sector_id = s.id
      WHERE s.nombre = $1 AND p.activo = true
      GROUP BY m.nombre
      ORDER BY total DESC
      LIMIT 5
    `, [sectorOficial]);

    // Total registros del sector
    const totalRegistros = await pool.query(`
      SELECT COUNT(*) AS total
      FROM registros r
      JOIN pacientes p ON p.id = r.paciente_id
      JOIN sectores s ON p.sector_id = s.id
      WHERE s.nombre = $1 AND p.activo = true
  `, [sectorOficial]);

    const row = totales.rows[0];
    if (!row) {
      return res.json({
        sector: sectorOficial,
        total_pacientes: 0,
        total_hombres: 0,
        total_mujeres: 0,
        total_infantes: 0,
        promedio_edad: 0,
        total_registros: 0,
        distribucion_edades: [],
        patologias_comunes: [],
        medicamentos_comunes: [],
      });
    }

    res.json({
      sector: sectorOficial,
      total_pacientes: parseInt(row.total_pacientes) || 0,
      total_hombres: parseInt(row.total_hombres) || 0,
      total_mujeres: parseInt(row.total_mujeres) || 0,
      total_infantes: parseInt(row.total_infantes) || 0,
      promedio_edad: parseFloat(row.promedio_edad) || 0,
      total_registros: parseInt(totalRegistros.rows[0]?.total) || 0,
      distribucion_edades: distEdades.rows,
      patologias_comunes: patologiasComunes.rows,
      medicamentos_comunes: medicamentosComunes.rows,
    });
  } catch (error) {
    console.error('Error estadísticas sector:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para catálogo de patologías CIE-10 (CON BÚSQUEDA DINÁMICA)
app.get('/api/catalogos/patologias', authenticateToken, async (req, res) => {
    const { busqueda, categoria } = req.query;
    try {
        let params = [];
        let whereClauses = [];
        if (busqueda && busqueda.length >= 2) {
            let searchStr = busqueda;
            let conditions = [
                `unaccent(pc.nombre) ILIKE unaccent($${params.length + 1})`,
                `pc.codigo ILIKE $${params.length + 1}`
            ];
            params.push(`%${searchStr}%`);

            // Soporte coloquial: Si busca "cancer" o "cáncer", buscar también "tumor maligno"
            if (/c[áa]ncer/i.test(busqueda)) {
                let termTumor = busqueda.replace(/c[áa]ncer/gi, 'tumor');
                let termMaligno = busqueda.replace(/c[áa]ncer/gi, 'tumor maligno');
                
                conditions.push(`unaccent(pc.nombre) ILIKE unaccent($${params.length + 1})`);
                params.push(`%${termTumor}%`);
                
                conditions.push(`unaccent(pc.nombre) ILIKE unaccent($${params.length + 1})`);
                params.push(`%${termMaligno}%`);
            }

            whereClauses.push(`(${conditions.join(' OR ')})`);
        }

        if (categoria) {
            whereClauses.push(`unaccent(c.nombre) ILIKE unaccent($${params.length + 1})`);
            params.push(categoria);
        }

        let query = `
            SELECT pc.*, c.nombre as categoria 
            FROM patologias_cie10 pc
            JOIN categorias_cie10 c ON pc.categoria_id = c.id
        `;
        
        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        // Si no hay búsqueda ni categoría, devolvemos conteos por categoría (Resumen)
        if (!busqueda && !categoria) {
            const summaryQuery = `
                SELECT c.nombre as nombre, COUNT(*) as cantidad 
                FROM patologias_cie10 pc
                JOIN categorias_cie10 c ON pc.categoria_id = c.id
                GROUP BY c.nombre 
                ORDER BY cantidad DESC
            `;
            const summary = await pool.query(summaryQuery);
            return res.json({
                resumen: summary.rows,
                total: summary.rows.reduce((acc, row) => acc + parseInt(row.cantidad), 0)
            });
        }

        query += ' ORDER BY nombre ASC LIMIT 100';

        const start = Date.now();
        const result = await pool.query(query, params);
        const duration = Date.now() - start;
        
        if (duration > 500) {
            console.warn(`⚠️ Consulta lenta detectada (${duration}ms): "${busqueda}"`);
        } else {
            console.log(`🔍 Búsqueda completada en ${duration}ms para: "${busqueda}"`);
        }
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener patologías:', err);
        res.status(500).json({ error: 'Error al obtener patologías' });
    }
});

// Endpoint para obtener total global de patologías (Dashboard)
app.get('/api/catalogos/stats', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) as total FROM patologias_cie10');
        res.json({ total_patologias: parseInt(result.rows[0].total) });
    } catch (err) {
        console.error('Error al obtener stats:', err);
        res.status(500).json({ error: 'Error al obtener estadísticas del catálogo' });
    }
});

// Endpoint para estadísticas de brechas de medicamentos (Necesidades no cubiertas)
app.get('/api/estadisticas/brechas', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT m.nombre, COUNT(*) as frecuencia
            FROM medicamentos m
            JOIN tratamientos t ON m.tratamiento_id = t.id
            WHERE m.es_oficial = false
            GROUP BY m.nombre
            ORDER BY frecuencia DESC
            LIMIT 10
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener brechas de medicamentos:', err);
        res.status(500).json({ error: 'Error al obtener brechas' });
    }
});

// Endpoint para normalizar y fusionar nombres de medicamentos (Admin)
app.post('/api/admin/medicamentos/fusionar', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const { nombre_erroneo, nombre_correcto } = req.body;
    try {
        const query = `
            UPDATE medicamentos 
            SET nombre = $2, es_oficial = true
            WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))
        `;
        await pool.query(query, [nombre_erroneo, nombre_correcto]);
        res.json({ success: true, message: 'Medicamentos normalizados con éxito' });
    } catch (err) {
        console.error('Error al fusionar medicamentos:', err);
        res.status(500).json({ error: 'Error al fusionar' });
    }
});

// ============================================================
// RUTAS DE SINCRONIZACIÓN (OFFLINE → ONLINE)
// ============================================================

// POST /api/sync — Sincronizar registros offline
app.post('/api/sync', authenticateToken, authorizeRoles('admin', 'medico', 'vocero'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar si el usuario existe antes de sincronizar
    const usuario_id = req.user.id;
    const checkUser = await client.query('SELECT id FROM usuarios WHERE id = $1 AND activo = true', [usuario_id]);
    if (checkUser.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        error: 'Sesión inválida o usuario inexistente',
        requireLogout: true,
        detalle: 'El usuario vocero no fue encontrado. Por favor, cierre sesión y vuelva a ingresar.'
      });
    }

    const { registros_offline } = req.body;
    const resultados = [];

    for (const reg of registros_offline) {
      try {
        const cedulaPac = normalizarCedula(reg.paciente.cedula);
        const fechaNacSync = reg.paciente.edad ? fechaNacimientoDesdeEdad(reg.paciente.edad) : null;
        let paciente;

        if (cedulaPac) {
          paciente = await client.query(
            'SELECT id FROM pacientes WHERE cedula = $1',
            [cedulaPac]
          );
        } else {
          // Si no tiene cédula (infante), buscar por nombre + apellido + fecha_nacimiento
          paciente = await client.query(
            'SELECT id FROM pacientes WHERE nombre = $1 AND apellido = $2 AND fecha_nacimiento = $3 AND activo = true',
            [reg.paciente.nombre, reg.paciente.apellido, fechaNacSync]
          );
        }

        if (paciente.rows.length === 0) {
          let sector_id = null;
          if (reg.paciente.sector) {
            const resS = await client.query('SELECT id FROM sectores WHERE nombre = $1', [reg.paciente.sector]);
            sector_id = resS.rows[0]?.id || null;
          }

          paciente = await client.query(
            `INSERT INTO pacientes(cedula, nombre, apellido, fecha_nacimiento, sexo, telefono, sector_id, direccion)
             VALUES($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
              cedulaPac || null,
              reg.paciente.nombre,
              reg.paciente.apellido,
              fechaNacSync,
              reg.paciente.sexo,
              reg.paciente.telefono,
              sector_id,
              reg.paciente.direccion || null
            ]
          );
        }

        const paciente_id = paciente.rows[0].id;

        // Insertar registro — BUG FIX: generar codigo si viene null
        let codigoSync = reg.codigo || `SYNC - ${Date.now()} -${Math.random().toString(36).substr(2, 5).toUpperCase()} `;
        const registro = await client.query(
          `INSERT INTO registros(codigo, paciente_id, usuario_id, fecha)
           VALUES($1, $2, $3, $4)
           RETURNING id`,
          [codigoSync, paciente_id, req.user.id, reg.fecha || new Date()]
        );
        const registro_id = registro.rows[0].id;

        // --- NUEVO: Sincronizar Tratamientos y Medicamentos ---
        for (const t of (reg.tratamientos || [])) {
          let cie10 = t.patologia?.cie10 || t.cie10 || (typeof t.patologia === 'string' ? t.patologia : 'Z00.0');
          if (cie10.length > 10) cie10 = 'Z00.0';

          // Buscar patologia_id
          const resP = await client.query('SELECT id FROM patologias_cie10 WHERE codigo = $1', [cie10]);
          const patologia_id = resP.rows[0]?.id || 4; // Default Z00.0

          const tIns = await client.query(
            `INSERT INTO tratamientos(registro_id, patologia_id, descripcion) VALUES($1, $2, $3) RETURNING id`,
            [registro_id, patologia_id, t.patologia?.nombre || (typeof t.patologia === 'string' ? t.patologia : 'Consulta')]
          );
          const t_id = tIns.rows[0].id;

          for (const m of (t.medicamentos || [])) {
            let pres = m.presentacion_seleccionada ? `${m.presentacion_seleccionada.forma || ''} ${m.presentacion_seleccionada.mg || ''}`.trim() : m.presentacion;
            const medNombreSync = m.nombre && m.nombre !== 'Medicamento' ? m.nombre : (t.patologia?.nombre ? `Med. para ${t.patologia.nombre}` : 'Medicamento no especificado');
            await client.query(
              `INSERT INTO medicamentos(tratamiento_id, nombre, presentacion, dosis, es_oficial) VALUES($1, $2, $3, $4, false)`,
              [t_id, medNombreSync, pres || null, m.dosis_seleccionada?.valor || m.dosis || null]
            );
          }
        }

        resultados.push({
          codigo_offline: reg.codigo,
          id_servidor: registro.rows[0].id,
          status: 'sincronizado'
        });
      } catch (error) {
        resultados.push({
          codigo_offline: reg.codigo,
          status: 'error',
          mensaje: error.message
        });
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'Sincronización completada',
      resultados
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en sincronización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
});

// ============================================================
// SERVIDOR
// ============================================================

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════╗
║   SIVICO23 FASE 2 — Backend API       ║
║   Puerto: ${PORT}                         ║
║   PostgreSQL: Conectado                ║
║   Estado: ✅ Operativo                 ║
╚════════════════════════════════════════╝
`);
  });
}

module.exports = app;
