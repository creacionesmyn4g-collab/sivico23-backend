require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function injectDB() {
  console.log('--- Iniciando Inyección de Base de Datos en Railway ---');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado exitosamente a PostgreSQL en Railway.');

    const sqlPath = path.join(__dirname, 'database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('⏳ Ejecutando comandos SQL (esto puede tomar unos segundos)...');
    await client.query(sql);
    
    console.log('✅ Base de datos inyectada y sembrada con éxito.');
  } catch (error) {
    console.error('❌ Error durante la inyección:', error);
  } finally {
    await client.end();
    console.log('--- Proceso Finalizado ---');
  }
}

injectDB();
