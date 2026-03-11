const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la base de datos
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

const JSON_URL = 'https://raw.githubusercontent.com/verasativa/CIE-10/master/codes.json';

async function importarCIE10() {
  const client = await pool.connect();
  try {
    console.log('🚀 Iniciando importación segura de CIE-10...');
    
    // 1. Descargar datos
    console.log('📥 Descargando catálogo desde GitHub...');
    const response = await axios.get(JSON_URL);
    const data = response.data;
    
    if (!Array.isArray(data)) {
      throw new Error('El formato del JSON no es válido.');
    }

    // 2. Procesar datos (Nivel 3 son patologías específicas)
    // Nivel 0 son los Capítulos (Categorías)
    const siviMap = {
      'A': 'Infecciosas', 'B': 'Infecciosas',
      'C': 'Neoplasias (Cáncer)', 'D': 'Neoplasias (Cáncer)',
      'E0': 'Metabólicas', 'E1': 'Metabólicas', 'E2': 'Metabólicas', 'E3': 'Metabólicas', 'E4': 'Nutricionales', 'E5': 'Nutricionales', 'E6': 'Nutricionales', 'E7': 'Metabólicas', 'E8': 'Metabólicas',
      'F': 'Salud Mental',
      'G': 'Neurológicas',
      'H0': 'Oftalmológicas', 'H1': 'Oftalmológicas', 'H2': 'Oftalmológicas', 'H3': 'Oftalmológicas', 'H4': 'Oftalmológicas', 'H5': 'Oftalmológicas', 'H6': 'Otorrinolaringología', 'H7': 'Otorrinolaringología', 'H8': 'Otorrinolaringología', 'H9': 'Otorrinolaringología',
      'I': 'Cardiovasculares',
      'J': 'Respiratorias',
      'K': 'Gastrointestinales',
      'L': 'Dermatológicas',
      'M': 'Musculoesqueléticas',
      'N': 'Genitourinarias (Renales)',
      'O': 'Materno-Infantil', 'P': 'Materno-Infantil', 'Q': 'Materno-Infantil',
      'R': 'Síntomas y Hallazgos',
      'S': 'Traumatismos', 'T': 'Traumatismos / Envenenamientos',
      'V': 'Causas Externas', 'W': 'Causas Externas', 'X': 'Causas Externas', 'Y': 'Causas Externas',
      'Z': 'Generales / Otros'
    };

    const categoriasMap = {};
    data.filter(item => item.level === 0).forEach(cat => {
      categoriasMap[cat.code] = cat.description;
    });

    const patologias = data.filter(item => item.level === 3);
    console.log(`📦 Procesando ${patologias.length} patologías finales...`);

    // 3. Pre-cargar mapa de categorias_cie10 (nombre → id)
    const catRows = await client.query('SELECT id, nombre FROM categorias_cie10');
    const catIdMap = {};
    catRows.rows.forEach(r => { catIdMap[r.nombre] = r.id; });
    // Asegurar que existe 'Generales / Otros' como fallback
    if (!catIdMap['Generales / Otros']) {
      const ins = await client.query(
        `INSERT INTO categorias_cie10(nombre) VALUES('Generales / Otros') ON CONFLICT DO NOTHING RETURNING id`
      );
      if (ins.rows[0]) catIdMap['Generales / Otros'] = ins.rows[0].id;
    }

    // 4. Iniciar Transacción
    await client.query('BEGIN');

    let insertados = 0;
    let saltados = 0;

    for (const pat of patologias) {
      let categoriaNombre = 'Generales / Otros';
      const prefix1 = pat.code.charAt(0);
      const prefix2 = pat.code.substring(0, 2);

      if (siviMap[prefix2]) {
        categoriaNombre = siviMap[prefix2];
      } else if (siviMap[prefix1]) {
        categoriaNombre = siviMap[prefix1];
      } else {
        categoriaNombre = categoriasMap[pat.code_0] || 'Generales / Otros';
      }

      // Resolver categoria_id (FK) en lugar de texto libre
      let categoria_id = catIdMap[categoriaNombre] || catIdMap['Generales / Otros'];

      const query = `
        INSERT INTO patologias_cie10 (codigo, nombre, categoria_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (codigo) DO NOTHING
      `;

      const res = await client.query(query, [pat.code, pat.description, categoria_id]);

      if (res.rowCount > 0) {
        insertados++;
      } else {
        saltados++;
      }

      if ((insertados + saltados) % 1000 === 0) {
        console.log(`⏳ Progreso: ${insertados + saltados} procesados...`);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ ¡Importación completada con éxito!`);
    console.log(`✨ Nuevos registros: ${insertados}`);
    console.log(`ℹ️ Registros existentes (saltados): ${saltados}`);

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ Error durante la importación:', error.message);
  } finally {
    if (client) client.release();
    process.exit();
  }
}

importarCIE10();
