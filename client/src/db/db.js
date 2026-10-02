import Dexie from 'dexie';

export const db = new Dexie('OfflineFieldTracker');

db.version(1).stores({
  reports: '++id, clientId, syncStatus, status, category, reportedAt',
  auditLogs: '++id, reportClientId, timestamp',
});