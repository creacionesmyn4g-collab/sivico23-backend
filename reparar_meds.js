const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'sivico23_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sivico23_db',
  password: process.env.DB_PASSWORD || 'sivico123',
  port: process.env.DB_PORT || 5432,
});

async function repararMedicamentos() {
  try {
    console.log('--- Iniciando Reparación de Medicamentos ---');
    
    // Buscar medicamentos con nombre 'Medicamento'
    const query = `
      UPDATE medicamentos m
      SET nombre = 'Med. para ' || pc.nombre
      FROM tratamientos t
      JOIN patologias_cie10 pc ON t.patologia_id = pc.id
      WHERE m.tratamiento_id = t.id 
      AND (m.nombre = 'Medicamento' OR m.nombre IS NULL)
      RETURNING m.id, m.nombre;
    `;
    
    const res = await pool.query(query);
    console.log(`✅ Se repararon ${res.rowCount} registros de medicamentos.`);
    
    if (res.rowCount > 0) {
      console.log('Ejemplos de cambios:');
      console.table(res.rows.slice(0, 5));
    }

    await pool.end();
  } catch (err) {
    console.error('❌ Error en la reparación:', err.message);
    await pool.end();
  }
}

repararMedicamentos();
