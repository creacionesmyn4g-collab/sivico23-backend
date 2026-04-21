const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
// Intentar cargar dotenv si existe en la raíz del backend
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('\n❌ ERROR: La variable DATABASE_URL no está definida.');
  console.log('\nPara solucionar esto, puedes:');
  console.log('1. Crear un archivo .env en la carpeta backend/ con la línea:');
  console.log('   DATABASE_URL=tu_url_de_railway_aquí');
  console.log('\n2. O ejecutar directamente en la terminal (Windows PowerShell):');
  console.log('   $env:DATABASE_URL="tu_url_de_railway_aquí"; node scripts/migrate_railway.js');
  console.log('\nEncuentra tu URL en el Dashboard de Railway -> Servicio PostgreSQL -> Variables -> DATABASE_URL\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') 
    ? false 
    : { rejectUnauthorized: false }
});

const sqlFile = path.join(__dirname, '../database.sql');

async function runMigration() {
  console.log('\n================================================');
  console.log('🚀 SIVICO23 — MIGRACIÓN AUTOMÁTICA A RAILWAY');
  console.log('================================================\n');

  try {
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`No se encontró el archivo database.sql en ${sqlFile}`);
    }

    console.log('⏳ Leyendo esquema desde database.sql...');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('🔗 Conectando a la instancia de Railway...');
    const client = await pool.connect();
    
    try {
      console.log('⚙️  Ejecutando script SQL (esto puede tardar unos segundos)...');
      // Ejecutar secuencialmente el contenido del archivo
      await client.query(sql);
      console.log('\n✅ ¡ÉXITO! La base de datos ha sido actualizada correctamente.\n');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:');
    console.error(err.message);
    console.log('\nVerifica que tu DATABASE_URL sea correcta y tengas conexión a internet.\n');
  } finally {
    await pool.end();
  }
}

runMigration();
