#!/usr/bin/env node
const { spawnSync } = require('child_process');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..', '..');
const backendDir = path.resolve(__dirname, '..', '..', 'backend');
const frontendDir = path.resolve(__dirname, '..', '..', 'frontend');
const configPath = path.join(__dirname, 'config.json');

function runBackendTests() {
  console.log('→ Ejecutando tests del backend (Jest)...');
  try {
    const res = spawnSync('npm', ['test'], { cwd: backendDir, stdio: 'inherit', shell: true });
    if (res.error) throw res.error;
    console.log('→ Tests backend finalizados con código', res.status);
    return res.status === 0;
  } catch (err) {
    console.error('Error al ejecutar tests del backend:', err.message);
    return false;
  }
}

function runCommand(cmd, cwd) {
  console.log(`→ Ejecutando comando: ${cmd} (cwd=${cwd || process.cwd()})`);
  try {
    const res = spawnSync(cmd, { cwd: cwd || process.cwd(), stdio: 'inherit', shell: true });
    if (res.error) throw res.error;
    return res.status === 0;
  } catch (err) {
    console.error('  Error al ejecutar comando:', err.message);
    return false;
  }
}

function checkHealth(url, attempts = 2) {
  return new Promise((resolve) => {
    console.log(`→ Comprobando endpoint de salud: ${url}`);
    try {
      const lib = url.startsWith('http://') ? http : https;
      const tryOnce = (remaining) => {
        const req = lib.get(url, { timeout: 8000 }, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              console.log('  statusCode =', res.statusCode);
              console.log('  body:', json);
              resolve(res.statusCode === 200);
            } catch (e) {
              console.log('  respuesta no JSON, statusCode =', res.statusCode);
              resolve(res.statusCode === 200);
            }
          });
        });
        req.on('error', (e) => {
          console.error('  request error:', e.message);
          if (remaining > 0) {
            console.log('  reintentando...', remaining);
            setTimeout(() => tryOnce(remaining - 1), 1000);
          } else resolve(false);
        });
        req.on('timeout', () => { req.destroy(); console.error('  timeout'); if (remaining > 0) { console.log('  reintentando por timeout...', remaining); setTimeout(() => tryOnce(remaining - 1), 1000); } else resolve(false); });
      };
      tryOnce(attempts - 1);
    } catch (err) {
      console.error('  error:', err.message);
      resolve(false);
    }
  });
}

function readEnvDatabaseUrl(envPath) {
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const m = content.match(/DATABASE_URL\s*=\s*(.+)/);
    if (m) return m[1].trim();
  } catch (e) {
    // ignore
  }
  return null;
}

async function checkPostgres(databaseUrl) {
  if (!databaseUrl) {
    console.log('→ No se encontró DATABASE_URL para comprobar Supabase.');
    return false;
  }
  console.log('→ Comprobando conexión PostgreSQL (Supabase)');
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query('SELECT NOW() as now');
    console.log('  OK — servidor Postgres respondió:', res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error('  Error al conectar a Postgres:', err.message);
    try { await client.end(); } catch(e){}
    return false;
  }
}

async function main() {
  console.log('Miguel — Asistente de pruebas y comprobaciones para SIVICO23');

  // 1) Ejecutar tests del backend
  const testsOk = runBackendTests();

  // 2) Comprobar endpoint de salud desplegado en Render
  const healthUrl = 'https://sivico23-backend.onrender.com/api/health';
  const healthOk = await checkHealth(healthUrl);

  // 2b) Cargar configuraciones adicionales si existen
  let config = null;
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('→ Configuración cargada desde', configPath);
    }
  } catch (e) {
    console.log('  No se pudo leer config.json:', e.message);
    config = null;
  }

  // Ejecutar checks configurados: endpoints y comandos
  let extraEndpointsOk = true;
  let extraCommandsOk = true;
  if (config) {
    if (Array.isArray(config.endpoints)) {
      for (const ep of config.endpoints) {
        const ok = await checkHealth(ep.url).catch(()=>false);
        console.log(`  Endpoint ${ep.name || ep.url}:`, ok ? 'OK' : 'FALLÓ');
        if (!ok) extraEndpointsOk = false;
      }
    }
    if (Array.isArray(config.commands)) {
      for (const c of config.commands) {
        const ok = runCommand(c.cmd, c.cwd ? path.resolve(__dirname, '..', '..', c.cwd) : undefined);
        console.log(`  Comando ${c.name || c.cmd}:`, ok ? 'OK' : 'FALLÓ');
        if (!ok) extraCommandsOk = false;
      }
    }
  }

  async function runRemediation() {
    console.log('→ Ejecutando acciones de remediación: migraciones y seed_admin');
    const migrateOk = runCommand('npm run migrate', path.resolve(backendDir));
    const seedOk = runCommand('node scripts/seed_admin.js', path.resolve(backendDir));
    return migrateOk && seedOk;
  }

  // 3) Comprobar Supabase / Postgres usando backend/.env
  const envPath = path.join(backendDir, '.env');
  const databaseUrl = readEnvDatabaseUrl(envPath) || process.env.DATABASE_URL || null;
  const dbOk = await checkPostgres(databaseUrl);

  // 4) Comprobación ligera del frontend: existencia de constants y URL de API
  console.log('→ Comprobación del frontend (chequeo de constantes)');
  const constFile = path.join(frontendDir, 'src', 'utils', 'constants.js');
  let frontendApi = null;
  try {
    const content = fs.readFileSync(constFile, 'utf8');
    const m = content.match(/API_BASE_URL\s*=\s*['\"]([^'\"]+)['\"]/);
    if (m) {
      frontendApi = m[1];
      console.log('  API_BASE_URL encontrada en frontend:', frontendApi);
    } else {
      console.log('  No se encontró API_BASE_URL en', constFile);
    }
  } catch (e) {
    console.log('  No se pudo leer', constFile);
  }
  let frontendApiOk = true;
  if (frontendApi) {
    frontendApiOk = await checkHealth(frontendApi + '/api/health').catch(()=>false);
  }

  console.log('\n--- Resumen — Miguel ---');
  console.log('Tests backend:', testsOk ? 'OK' : 'FALLÓ');
  console.log('Backend (Render) health:', healthOk ? 'OK' : 'FALLÓ');
  console.log('Supabase/Postgres:', dbOk ? 'OK' : 'FALLÓ');
  console.log('Frontend API health:', frontendApi ? (frontendApiOk ? 'OK' : 'FALLÓ') : 'No verificado');
  if (config) {
    console.log('Checks extra - endpoints:', extraEndpointsOk ? 'OK' : 'FALLÓ');
    console.log('Checks extra - commands:', extraCommandsOk ? 'OK' : 'FALLÓ');
  }

  // Si los tests fallaron pero la DB responde, intentar remediación automática
  if (!testsOk && dbOk) {
    console.log('→ Tests fallaron pero DB OK — intentando remediación automática');
    const remedied = await runRemediation();
    if (remedied) {
      console.log('→ Remediación ejecutada, volviendo a ejecutar tests...');
      const retryTests = runBackendTests();
      if (retryTests) {
        console.log('→ Tests pasaron tras remediación');
        process.exit(0);
      } else {
        console.log('→ Tests siguen fallando después de remediación');
      }
    } else {
      console.log('→ Remediación fallida');
    }
  }

  const exitCode = (testsOk && healthOk && dbOk && (frontendApiOk || !frontendApi) && (config ? (extraEndpointsOk && extraCommandsOk) : true)) ? 0 : 2;
  process.exit(exitCode);
}

main();
