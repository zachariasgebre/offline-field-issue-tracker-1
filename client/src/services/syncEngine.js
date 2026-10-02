import axios from 'axios';
import { db } from '../db/db';

const API_BASE = 'http://localhost:5000/api';

export async function syncPendingReports() {
  const pendingReports = await db.reports
    .where('syncStatus')
    .equals('PENDING')
    .toArray();

  if (pendingReports.length === 0) return { syncedCount: 0 };

  try {
    const response = await axios.post(`${API_BASE}/reports/sync`, {
      reports: pendingReports,
    });

    const { results } = response.data;

    for (const res of results) {
      if (res.status === 'CREATED' || res.status === 'SYNCED_EXISTING') {
        await db.reports
          .where('clientId')
          .equals(res.clientId)
          .modify({ syncStatus: 'SYNCED', serverId: res.serverId });

        await db.auditLogs.add({
          reportClientId: res.clientId,
          action: 'SYNCHRONIZED',
          details: `Sync success with server ID: ${res.serverId}`,
          timestamp: new Date().toISOString(),
        });
      } else {
        await db.reports
          .where('clientId')
          .equals(res.clientId)
          .modify({ syncStatus: 'FAILED', syncError: res.error });
      }
    }

    return { syncedCount: results.length };
  } catch (err) {
    console.error('Sync network failure:', err.message);
    throw err;
  }
}