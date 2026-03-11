const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'sivico23_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sivico23_db',
  password: process.env.DB_PASSWORD || 'sivico123',
  port: process.env.DB_PORT || 5432,
});

const query = `
      SELECT r.id, r.codigo, r.fecha, 
             p.cedula, p.nombre, p.apellido, p.fecha_nacimiento,
             p.sexo, p.sector,
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
      JOIN usuarios u ON r.usuario_id = u.id
      ORDER BY r.fecha DESC LIMIT 5 OFFSET 0
`;

pool.query(query)
  .then(res => {
    console.log('EXITO. Filas:', res.rowCount);
    pool.end();
  })
  .catch(err => {
    console.error('ERROR SQL:', err.message);
    pool.end();
  });
