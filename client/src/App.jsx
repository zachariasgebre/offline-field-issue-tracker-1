import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db/db';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { syncPendingReports } from './services/syncEngine';

export default function App() {
  const isOnline = useOnlineStatus();
  const [reports, setReports] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    category: 'Water Infrastructure',
    description: '',
    location: '',
    priority: 'MEDIUM',
  });

  const loadLocalReports = async () => {
    const data = await db.reports.toArray();
    setReports(data.reverse());
  };

  useEffect(() => {
    loadLocalReports();
  }, []);

  useEffect(() => {
    if (isOnline) {
      handleManualSync();
    }
  }, [isOnline]);

  const handleManualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncPendingReports();
      await loadLocalReports();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newReport = {
      clientId: uuidv4(),
      category: form.category,
      description: form.description,
      location: form.location,
      priority: form.priority,
      status: 'SUBMITTED',
      syncStatus: 'PENDING',
      reportedAt: new Date().toISOString(),
    };

    await db.reports.add(newReport);
    setForm({ category: 'Water Infrastructure', description: '', location: '', priority: 'MEDIUM' });
    await loadLocalReports();

    if (isOnline) {
      handleManualSync();
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Offline Field Issue Tracker</h2>
        <div>
          <span style={{
            padding: '6px 12px',
            borderRadius: '12px',
            color: '#fff',
            backgroundColor: isOnline ? '#2e7d32' : '#c62828',
            fontWeight: 'bold'
          }}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
          <button onClick={handleManualSync} disabled={!isOnline || syncing} style={{ marginLeft: '10px' }}>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </header>

      <section style={{ backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '8px', margin: '20px 0' }}>
        <h3>Create Issue Report</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '10px' }}>
            <label>Category: </label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option>Water Infrastructure</option>
              <option>Power Supply</option>
              <option>Road Damage</option>
              <option>Facility Maintenance</option>
            </select>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>Location: </label>
            <input required type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>Description: </label>
            <textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ width: '100%' }} />
          </div>
          <button type="submit">Save Report (Offline Safe)</button>
        </form>
      </section>

      <section>
        <h3>Submitted Reports</h3>
        {reports.map((r) => (
          <div key={r.clientId} style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{r.category} - {r.location}</strong>
              <span style={{
                fontSize: '0.8em',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: r.syncStatus === 'SYNCED' ? '#e8f5e9' : '#fff3e0'
              }}>
                {r.syncStatus}
              </span>
            </div>
            <p>{r.description}</p>
            <small>Status: <strong>{r.status}</strong> | Priority: {r.priority}</small>
          </div>
        ))}
      </section>
    </div>
  );
}