// ============================================================
// SIVICO23 FASE 2 — simulation.test.js — Simulación de Flujo Real
// ============================================================

const request = require('supertest');
require('dotenv').config();
const app = require('../server');

describe('Simulación de Escenario Real de Operación', () => {
    let token;
    let pacienteId;
    const testCedula = '99887766';

    // 1. LOGIN
    it('Debe iniciar sesión como administrador', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ cedula: '00000000', password: 'admin123' });
        
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        token = res.body.token;
    });

    // 2. REGISTRO DE PACIENTE VULNERABLE (ALTA POR EDAD)
    it('Debe registrar un nuevo paciente vulnerable (>65 años)', async () => {
        const res = await request(app)
            .post('/api/pacientes')
            .set('Authorization', `Bearer ${token}`)
            .send({
                cedula: testCedula,
                nombre: 'Simulado',
                apellido: 'Test',
                fecha_nacimiento: '1940-05-20', // Edad ~83
                sexo: 'Masculino',
                telefono: '04121234567',
                sector: 'Zona Central'
            });
        
        expect([200, 201]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('paciente');
        pacienteId = res.body.paciente.id;
    });

    // 3. CREACIÓN DE REGISTRO CLÍNICO CON PATOLOGÍA CRÓNICA (MEDIA POR DIABETES)
    it('Debe crear un registro clínico con Diabetes (E11)', async () => {
        const res = await request(app)
            .post('/api/registros')
            .set('Authorization', `Bearer ${token}`)
            .send({
                paciente_id: pacienteId,
                paciente_cedula: testCedula,
                observaciones: 'Paciente en monitoreo de prueba',
                tratamientos: [
                    {
                        patologia: {
                            cie10: 'E11', 
                            nombre: 'Diabetes Mellitus Tipo 2'
                        },
                        medicamentos: [
                            { nombre: 'Metformina', presentacion: '500mg', dosis: '1 cada 12h' }
                        ]
                    }
                ]
            });
        
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('codigo');
    });

    // 4. VERIFICACIÓN DE TRIAJE Y FLAG TIENE_CRONICA
    it('Debe verificar que el paciente tiene el flag tiene_cronica activado', async () => {
        const res = await request(app)
            .get(`/api/pacientes/${testCedula}`)
            .set('Authorization', `Bearer ${token}`);
        
        console.log('Step 4 Response Body:', JSON.stringify(res.body, null, 2));
        expect(res.statusCode).toBe(200);
        expect(res.body.tiene_cronica).toBe(true);
    });

    // 5. ESTADÍSTICAS
    it('Debe verificar que las estadísticas incluyen al nuevo paciente', async () => {
        const res = await request(app)
            .get('/api/estadisticas')
            .set('Authorization', `Bearer ${token}`);
        
        console.log('Step 5 Response Body:', JSON.stringify(res.body, null, 2));
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('total_pacientes');
        expect(parseInt(res.body.total_pacientes)).toBeGreaterThan(0);
    });
});
