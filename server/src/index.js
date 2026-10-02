const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { isValidTransition } = require('./stateMachine');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// 1. Idempotent Batch Sync Endpoint
app.post('/api/reports/sync', async (req, res) => {
  const { reports } = req.body;
  if (!Array.isArray(reports)) {
    return res.status(400).json({ error: 'Payload must contain a reports array.' });
  }

  const results = [];

  for (const report of reports) {
    try {
      const existing = await prisma.report.findUnique({
        where: { clientId: report.clientId },
      });

      if (existing) {
        results.push({ clientId: report.clientId, serverId: existing.id, status: 'SYNCED_EXISTING' });
        continue;
      }

      const created = await prisma.report.create({
        data: {
          clientId: report.clientId,
          category: report.category,
          description: report.description,
          location: report.location,
          priority: report.priority || 'MEDIUM',
          status: report.status || 'SUBMITTED',
          reportedAt: new Date(report.reportedAt),
          history: {
            create: {
              action: 'CREATED',
              actor: report.actor || 'FIELD_WORKER',
              details: 'Report synchronized from offline client store.',
            },
          },
        },
      });

      results.push({ clientId: report.clientId, serverId: created.id, status: 'CREATED' });
    } catch (err) {
      results.push({ clientId: report.clientId, status: 'FAILED', error: err.message });
    }
  }

  res.json({ results });
});

// 2. Fetch Reports List & History
app.get('/api/reports', async (req, res) => {
  const reports = await prisma.report.findMany({
    include: { history: { orderBy: { timestamp: 'desc' } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(reports);
});

// 3. Coordinator Status Update with State Machine Validation
app.patch('/api/reports/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, actor = 'COORDINATOR', note } = req.body;

  const currentReport = await prisma.report.findUnique({ where: { id } });
  if (!currentReport) return res.status(404).json({ error: 'Report not found' });

  if (!isValidTransition(currentReport.status, status)) {
    return res.status(422).json({
      error: `Invalid status transition from ${currentReport.status} to ${status}.`,
    });
  }

  const updated = await prisma.report.update({
    where: { id },
    data: {
      status,
      history: {
        create: {
          action: 'STATUS_CHANGE',
          actor,
          details: `Changed status to ${status}.${note ? ' Note: ' + note : ''}`,
        },
      },
    },
    include: { history: { orderBy: { timestamp: 'desc' } } },
  });

  res.json(updated);
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;