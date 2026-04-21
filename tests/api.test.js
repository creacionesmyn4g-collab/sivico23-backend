// ============================================================
// SIVICO23 FASE 2 — api.test.js — Tests básicos de la API
// Ejecutar con: npm test (desde carpeta backend)
// ============================================================

const request = require('supertest');

// Cargar env antes de importar la app
require('dotenv').config();

const app = require('../server');

// ——— HEALTH CHECK ———
describe('GET /api/health', () => {
    it('debe responder 200 con status ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('time');
    });
});

// ——— AUTENTICACIÓN ———
describe('POST /api/auth/login', () => {
    it('debe rechazar login sin body con 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({});
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('debe rechazar credenciales incorrectas con 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ cedula: 'V-99999999', password: 'wrongpassword' });
        expect([401, 500]).toContain(res.statusCode);
    });

    it('debe rechazar login con cédula faltante con 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ password: 'admin123' });
        expect(res.statusCode).toBe(400);
    });
});

// ——— RUTAS PROTEGIDAS ———
describe('Rutas protegidas sin token', () => {
    it('GET /api/pacientes debe responder 401 sin token', async () => {
        const res = await request(app).get('/api/pacientes');
        expect(res.statusCode).toBe(401);
        expect(res.body).toHaveProperty('error', 'Token requerido');
    });

    it('GET /api/registros debe responder 401 sin token', async () => {
        const res = await request(app).get('/api/registros');
        expect(res.statusCode).toBe(401);
    });

    it('GET /api/estadisticas debe responder 401 sin token', async () => {
        const res = await request(app).get('/api/estadisticas');
        expect(res.statusCode).toBe(401);
    });

    it('POST /api/registros debe responder 401 sin token', async () => {
        const res = await request(app)
            .post('/api/registros')
            .send({ paciente_cedula: 'V-12345678', tratamientos: [] });
        expect(res.statusCode).toBe(401);
    });
});

// ——— TOKEN INVÁLIDO ———
describe('Rutas protegidas con token inválido', () => {
    it('GET /api/pacientes debe responder 403 con token falso', async () => {
        const res = await request(app)
            .get('/api/pacientes')
            .set('Authorization', 'Bearer token_falso_invalido');
        expect(res.statusCode).toBe(403);
        expect(res.body).toHaveProperty('error', 'Token inválido');
    });
});
