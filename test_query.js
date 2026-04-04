const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('railway.app') ? { rejectUnauthorized: false } : false
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      }
);

async function testQuery() {
  try {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM pacientes WHERE activo = true) as total_poblacion,
        COUNT(DISTINCT pd.paciente_id) as total_con_discapacidad,
        COUNT(DISTINCT p.id) FILTER (WHERE p.requiere_vigilancia_constante = true) as total_vigilancia,
        COUNT(pd.id) FILTER (WHERE pd.posee_certificado_conapdis = true) as total_certificados,
        COALESCE((
          SELECT json_agg(json_build_object('name', cd.nombre, 'population', count_row))
          FROM (
            SELECT cd.nombre, COUNT(pd2.id) as count_row
            FROM cat_discapacidades cd
            LEFT JOIN paciente_discapacidades pd2 ON cd.id = pd2.discapacidad_id
            GROUP BY cd.nombre
          ) sub
        ), '[]'::json) as distribucion_tipos
      FROM pacientes p
      LEFT JOIN paciente_discapacidades pd ON p.id = pd.paciente_id
      WHERE p.activo = true
    `;
    const res = await pool.query(query);
    console.log('Success:', res.rows[0]);
  } catch (error) {
    console.error('SQL Error:', error);
  } finally {
    pool.end();
  }
}

testQuery();
