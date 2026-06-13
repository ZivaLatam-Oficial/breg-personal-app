const API_BASE = 'https://ziva-core-backend-production-fb94.up.railway.app';

const STORAGE_KEYS = {
  pendingLogs: 'breg_pending_logs',
  zid: 'zid'
};

// ================= ZID =================

async function initZID() {
  let zid = localStorage.getItem(STORAGE_KEYS.zid);

  if (!zid) {
    try {
      const res = await fetch(`${API_BASE}/identity`, { method: 'POST' });
      const data = await res.json();

      zid = data.zid;
      localStorage.setItem(STORAGE_KEYS.zid, zid);

      console.log('[ZID] Created:', zid);
    } catch (err) {
      console.error('[ZID] Error creating identity');
      zid = 'offline-zid-' + Date.now();
    }
  }

  return zid;
}

let ZID = null;

// ================= STATE =================

let pendingLogs = [];
let isSyncing = false;

// ================= INIT =================

async function init() {
  ZID = await initZID();

  pendingLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.pendingLogs) || '[]');

  updateStatus();
  registerEvents();

  setInterval(syncPendingLogs, 20000);

  renderDashboard();
}

// ================= EVENTS =================

function registerEvents() {
  window.addEventListener('online', syncPendingLogs);
  window.addEventListener('offline', updateStatus);
}

// ================= STATUS =================

function updateStatus() {
  const btn = document.getElementById('status-button');
  btn.textContent = navigator.onLine ? 'Online' : 'Offline';
}

// ================= SYNC =================

async function syncPendingLogs() {
  if (!navigator.onLine || isSyncing || pendingLogs.length === 0) return;

  isSyncing = true;

  const remaining = [];

  for (let log of pendingLogs) {
    try {
      const res = await fetch(`${API_BASE}/breg/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...log, zid: ZID })
      });

      if (!res.ok) throw new Error();

    } catch {
      remaining.push(log);
    }
  }

  pendingLogs = remaining;
  localStorage.setItem(STORAGE_KEYS.pendingLogs, JSON.stringify(pendingLogs));

  isSyncing = false;
}

// ================= LOG =================

function addLog(log) {
  pendingLogs.unshift(log);
  localStorage.setItem(STORAGE_KEYS.pendingLogs, JSON.stringify(pendingLogs));
  syncPendingLogs();
}

// ================= UI =================

function renderDashboard() {
  const main = document.getElementById('main-content');

  main.innerHTML = `
    <div class="card">
      <h2>ZID</h2>
      <p>${ZID}</p>
    </div>

    <div class="card">
      <button onclick="testLog()" class="button-primary">
        Test Log
      </button>
    </div>
  `;
}

// ================= TEST =================

function testLog() {
  addLog({
    materials: ['Aluminum'],
    kilos: 1,
    price: 1000,
    total: 1000,
    zone: 'Santiago'
  });

  alert('Log creado');
}

// ================= START =================

init();
