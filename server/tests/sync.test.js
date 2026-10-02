const request = require('supertest');
const app = require('../src/index');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Sync and State Machine API', () => {
  beforeAll(async () => {
    await prisma.auditHistory.deleteMany();
    await prisma.report.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('POST /api/reports/sync creates new report and handles retries idempotently', async () => {
    const testReport = {
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      category: 'Water Infrastructure',
      description: 'Pump leaking water',
      location: 'Sub-site B',
      priority: 'HIGH',
      status: 'SUBMITTED',
      reportedAt: new Date().toISOString(),
    };

    // First attempt -> Created
    const res1 = await request(app)
      .post('/api/reports/sync')
      .send({ reports: [testReport] });

    expect(res1.statusCode).toBe(200);
    expect(res1.body.results[0].status).toBe('CREATED');

    // Duplicate attempt -> Syncs to existing without duplicating
    const res2 = await request(app)
      .post('/api/reports/sync')
      .send({ reports: [testReport] });

    expect(res2.statusCode).toBe(200);
    expect(res2.body.results[0].status).toBe('SYNCED_EXISTING');

    const totalInDb = await prisma.report.count({ where: { clientId: testReport.clientId } });
    expect(totalInDb).toBe(1);
  });

  test('PATCH /api/reports/:id/status enforces valid state transitions', async () => {
    const created = await prisma.report.findFirst();

    // Valid transition: SUBMITTED -> ASSIGNED
    const resValid = await request(app)
      .patch(`/api/reports/${created.id}/status`)
      .send({ status: 'ASSIGNED' });

    expect(resValid.statusCode).toBe(200);
    expect(resValid.body.status).toBe('ASSIGNED');

    // Invalid transition: ASSIGNED -> RESOLVED (must go through IN_PROGRESS)
    const resInvalid = await request(app)
      .patch(`/api/reports/${created.id}/status`)
      .send({ status: 'RESOLVED' });

    expect(resInvalid.statusCode).toBe(422);
    expect(resInvalid.body.error).toContain('Invalid status transition');
  });
});