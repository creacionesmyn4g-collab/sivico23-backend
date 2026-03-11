const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'sivico23_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sivico23_db',
  password: process.env.DB_PASSWORD || 'sivico123',
  port: process.env.DB_PORT || 5432,
});

pool.query('SELECT m.id, m.nombre, m.presentacion, t.descripcion as patologia FROM medicamentos m JOIN tratamientos t ON m.tratamiento_id = t.id ORDER BY m.id DESC LIMIT 15;')
  .then(res => {
    console.table(res.rows);
    pool.end();
  })
  .catch(err => {
    console.error('ERROR SQL:', err.message);
    pool.end();
  });
