const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

async function recategorizar() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updates = [
      { id: 7, regex: '^[N]' },        // Renales
      { id: 12, regex: '^[CD]' },      // Neoplasias
      { id: 1, regex: '^[I]' },        // Cardiovasculares
      { id: 3, regex: '^[J]' },        // Respiratorias
      { id: 8, regex: '^[AB]' },       // Infecciosas
      { id: 5, regex: '^[K]' },        // Gastrointestinales
      { id: 6, regex: '^[G]' },        // Neurológicas
      { id: 2, regex: '^[E]' },        // Metabólicas
      { id: 10, regex: '^[M]' },       // Musculoesqueléticas
      { id: 9, regex: '^[L]' },        // Dermatológicas
      { id: 15, regex: '^[H][6-9]' },  // Otorrino
      { id: 14, regex: '^[H][0-5]' }   // Oftalmo
    ];

    for (const update of updates) {
      const res = await client.query(
        'UPDATE patologias_cie10 SET categoria_id = $1 WHERE codigo ~ $2',
        [update.id, update.regex]
      );
      console.log(`Categoría ${update.id}: ${res.rowCount} filas actualizadas`);
    }

    const stats = await client.query(`
      SELECT c.nombre, COUNT(pc.id) as total 
      FROM categorias_cie10 c 
      LEFT JOIN patologias_cie10 pc ON c.id = pc.categoria_id 
      GROUP BY c.nombre 
      ORDER BY total DESC
    `);

    await client.query('COMMIT');
    console.log('\n--- Nuevas Estadísticas por Categoría ---');
    console.table(stats.rows);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}

recategorizar();
