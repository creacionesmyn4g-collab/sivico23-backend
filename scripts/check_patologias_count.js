// Simple check script: cuenta filas en patologias_cie10
require('dotenv').config();
const { Pool } = require('pg');

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

(async () => {
  try {
    const res = await pool.query('SELECT COUNT(*) as total FROM patologias_cie10');
    console.log('Patologias en DB:', res.rows[0].total);
  } catch (err) {
    console.error('Error verificando count:', err.message || err);
  } finally {
    await pool.end();
  }
})();
