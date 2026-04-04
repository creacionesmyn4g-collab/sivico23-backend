const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function seedAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  const client = await pool.connect();
  try {
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);

    // Buscar rol admin
    const rolRes = await client.query("SELECT id FROM roles WHERE nombre = 'admin' LIMIT 1");
    const rolId = rolRes.rows[0] ? rolRes.rows[0].id : 1;

    // Insertar usuario si no existe
    const cedula = 'V-00000000';
    const exists = await client.query('SELECT id FROM usuarios WHERE cedula = $1', [cedula]);
    if (exists.rows.length > 0) {
      console.log('Usuario test ya existe:', cedula);
    } else {
      await client.query(
        `INSERT INTO usuarios (cedula, nombre, apellido, email, password_hash, rol_id, activo)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [cedula, 'Admin', 'Test', 'admin-test@sivico23.local', hash, rolId]
      );
      console.log('Usuario admin de prueba insertado:', cedula);
    }
  } catch (err) {
    console.error('Error al insertar admin de prueba:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdmin();
