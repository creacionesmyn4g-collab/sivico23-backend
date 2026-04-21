const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

// Configuración de conexión
const getPool = () => new Pool(
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

const JSON_URL = 'https://raw.githubusercontent.com/verasativa/CIE-10/master/codes.json';

const BATCH_SIZE = parseInt(process.env.IMPORT_BATCH_SIZE || '100', 10);
const MAX_RETRIES = 3;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function importar() {
  let pool = getPool();
  let client;
  try {
    console.log('🚀 Importador por lotes iniciado...');
    const resp = await axios.get(JSON_URL, { timeout: 30000 });
    const data = resp.data;
    if (!Array.isArray(data)) throw new Error('Formato JSON inválido');

    const patologias = data.filter(i => i.level === 3);
    console.log(`📦 Total a procesar: ${patologias.length}`);

    client = await pool.connect();

    // map categorias
    const catRows = await client.query('SELECT id, nombre FROM categorias_cie10');
    const catIdMap = {};
    catRows.rows.forEach(r => { catIdMap[r.nombre] = r.id; });
    if (!catIdMap['Generales / Otros']) {
      const ins = await client.query("INSERT INTO categorias_cie10(nombre) VALUES('Generales / Otros') ON CONFLICT DO NOTHING RETURNING id");
      if (ins.rows[0]) catIdMap['Generales / Otros'] = ins.rows[0].id;
    }

    const siviMap = {
      'A': 'Infecciosas', 'B': 'Infecciosas', 'C': 'Neoplasias (Cáncer)', 'D': 'Neoplasias (Cáncer)',
      'E0': 'Metabólicas', 'E1': 'Metabólicas', 'E2': 'Metabólicas', 'E3': 'Metabólicas', 'E4': 'Nutricionales',
      'F': 'Salud Mental', 'G': 'Neurológicas', 'H0': 'Oftalmológicas', 'H1': 'Oftalmológicas', 'H2': 'Oftalmológicas',
      'H6': 'Otorrinolaringología', 'I': 'Cardiovasculares', 'J': 'Respiratorias', 'K': 'Gastrointestinales',
      'L': 'Dermatológicas', 'M': 'Musculoesqueléticas', 'N': 'Genitourinarias (Renales)', 'O': 'Materno-Infantil',
      'P': 'Materno-Infantil', 'Q': 'Materno-Infantil', 'R': 'Síntomas y Hallazgos', 'S': 'Traumatismos', 'T': 'Traumatismos / Envenenamientos',
      'V': 'Causas Externas', 'W': 'Causas Externas', 'X': 'Causas Externas', 'Y': 'Causas Externas', 'Z': 'Generales / Otros'
    };

    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < patologias.length; i += BATCH_SIZE) {
      const batch = patologias.slice(i, i + BATCH_SIZE);
      // preparar filas
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const p of batch) {
        const prefix1 = p.code.charAt(0);
        const prefix2 = p.code.substring(0,2);
        let categoriaNombre = 'Generales / Otros';
        if (siviMap[prefix2]) categoriaNombre = siviMap[prefix2];
        else if (siviMap[prefix1]) categoriaNombre = siviMap[prefix1];
        const categoria_id = catIdMap[categoriaNombre] || catIdMap['Generales / Otros'];

        values.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
        params.push(p.code, p.description || p.name || p.description, categoria_id);
      }

      const query = `INSERT INTO patologias_cie10 (codigo, nombre, categoria_id) VALUES ${values.join(',')} ON CONFLICT (codigo) DO NOTHING`;

      // retries
      let attempt = 0;
      while (attempt < MAX_RETRIES) {
        try {
          await client.query('BEGIN');
          const res = await client.query(query, params);
          await client.query('COMMIT');
          // res.rowCount may be number of inserted rows for this batch in newer pg versions
          inserted += res.rowCount || 0;
          skipped += (batch.length - (res.rowCount || 0));
          console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE)+1}: insertados ${res.rowCount || 0} / ${batch.length}`);
          break;
        } catch (err) {
          attempt++;
          console.warn(`⚠️ Error lote ${Math.floor(i/BATCH_SIZE)+1} intento ${attempt}:`, err.message || err);
          try { await client.query('ROLLBACK'); } catch(e){}
          if (attempt >= MAX_RETRIES) {
            console.error('❌ Falló el lote tras varios intentos, re-conectando y continuando...');
            try { client.release(); } catch(e){}
            // recrear pool y client
            try { pool.end && await pool.end(); } catch(e){}
            await sleep(1000 * attempt);
            pool = getPool();
            client = await pool.connect();
            // continue to next attempt/retry
          } else {
            await sleep(500 * attempt);
          }
        }
      }
    }

    console.log('✨ Importación por lotes finalizada.');
    console.log(`📈 Total nuevos: ${inserted}, saltados: ${skipped}`);
  } catch (err) {
    console.error('❌ Error global del importador:', err.message || err);
  } finally {
    try { client && client.release(); } catch(e){}
    try { pool && pool.end(); } catch(e){}
    process.exit();
  }
}

importar();
