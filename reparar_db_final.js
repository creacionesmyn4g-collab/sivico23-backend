const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

async function reparacionIntegral() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('--- PASO 1: Normalizando nombres de categorías ---');
    await client.query("UPDATE categorias_cie10 SET nombre = 'Neoplasias (Cáncer)' WHERE id = 12");
    await client.query("UPDATE categorias_cie10 SET nombre = 'Traumatismos / Envenenamientos' WHERE id = 16");
    console.log('Nombres normalizados.');

    console.log('\n--- PASO 2: Recategorización Exhaustiva CIE-10 ---');
    const updates = [
      { id: 8, regex: '^[AB]' },       // Infecciosas
      { id: 12, regex: '^[CD]' },      // Neoplasias (Cáncer)
      { id: 13, regex: '^E[4-6]' },    // Nutricionales (Desnutrición/Deficiencias)
      { id: 2, regex: '^E(?!4|5|6)' }, // Metabólicas (Endocrinas, excepto nutricionales)
      { id: 18, regex: '^[F]' },        // Salud Mental
      { id: 6, regex: '^[G]' },        // Neurológicas
      { id: 14, regex: '^H[0-5]' },    // Oftalmológicas
      { id: 15, regex: '^H[6-9]' },    // Otorrinolaringología
      { id: 1, regex: '^[I]' },        // Cardiovasculares
      { id: 3, regex: '^[J]' },        // Respiratorias
      { id: 5, regex: '^[K]' },        // Gastrointestinales
      { id: 9, regex: '^[L]' },        // Dermatológicas
      { id: 10, regex: '^[M]' },       // Musculoesqueléticas
      { id: 7, regex: '^[N]' },        // Renales
      { id: 11, regex: '^[OPQ]' },     // Materno-Infantil
      { id: 16, regex: '^[ST]' },      // Traumatismos / Envenenamientos
      { id: 17, regex: '^[VWXYZ]' },   // Causas Externas
      { id: 19, regex: '^[RZ]' }        // Síntomas / Generales
    ];

    for (const update of updates) {
      const res = await client.query(
        'UPDATE patologias_cie10 SET categoria_id = $1 WHERE codigo ~ $2',
        [update.id, update.regex]
      );
      console.log(`Categoría ID ${update.id}: ${res.rowCount} patologías asignadas.`);
    }

    await client.query('COMMIT');
    console.log('\n--- REPARACIÓN COMPLETADA EXITOSAMENTE ---');

    console.log('\nVerificación final de conteos:');
    const stats = await client.query(`
      SELECT c.nombre, COUNT(pc.id) as total 
      FROM categorias_cie10 c 
      JOIN patologias_cie10 pc ON c.id = pc.categoria_id 
      GROUP BY c.nombre 
      ORDER BY total DESC
    `);
    console.table(stats.rows);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('CRITICAL ERROR:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}

reparacionIntegral();
