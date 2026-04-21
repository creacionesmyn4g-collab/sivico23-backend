const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'sivico23_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sivico23_db',
  password: process.env.DB_PASSWORD || 'sivico123',
  port: process.env.DB_PORT || 5432,
});

const sqlFile = path.join(__dirname, '../database.sql');

async function setupDatabase() {
  console.log('\n================================================');
  console.log('🚀 SIVICO23 — INICIALIZACIÓN DE BASE DE DATOS LOCAL');
  console.log('================================================\n');

  try {
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`No se encontró el archivo database.sql en ${sqlFile}`);
    }

    console.log('⏳ Leyendo esquema desde database.sql...');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('🔗 Conectando a PostgreSQL local...');
    const client = await pool.connect();
    
    try {
      console.log('⚙️  Ejecutando script SQL (creando 10 tablas y semillas)...');
      // Ejecutar el script SQL completo
      await client.query(sql);
      console.log('\n✅ ¡ÉXITO! La base de datos ha sido inicializada correctamente.');
      console.log('   - Tablas creadas: roles, usuarios, sectores, etc.');
      console.log('   - Usuario inicial: V-00000000 (admin123)\n');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('\n❌ ERROR DURANTE LA INICIALIZACIÓN:');
    console.error(err.message);
    if (err.code === '3D000') {
        console.error('El error indica que la base de datos "sivico23_db" no existe. Por favor créala primero en pgAdmin o psql.');
    }
  } finally {
    await pool.end();
  }
}

setupDatabase();
