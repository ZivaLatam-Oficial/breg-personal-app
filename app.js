const API_BASE = 'https://ziva-core-backend-production-fb94.up.railway.app';

const STORAGE_KEYS = {
  pendingLogs: 'breg_pending_logs',
  cachedDashboard: 'breg_cached_dashboard',
  cachedHistory: 'breg_cached_history',
  cachedVault: 'breg_cached_vault'
};

// ⚠️ TEMPORAL (luego reemplazamos con ZID real)
const ZID = localStorage.getItem('zid') || 'test-zid-001';

let pendingLogs = [];
let cachedDashboard = null;
let cachedHistory = null;
let cachedVault = null;

let isSyncing = false;
let activeView = 'dashboard';

// ================= INIT =================
function init() {
  restoreState();
  updateStatus();
  registerEvents();
  loadAllData();

  setInterval(syncPendingLogs, 30000);
}

// ================= STATE =================
function restoreState() {
  pendingLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.pendingLogs) || '[]');
  cachedDashboard = JSON.parse(localStorage.getItem(STORAGE_KEYS.cachedDashboard) || 'null');
  cachedHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.cachedHistory) || 'null');
  cachedVault = JSON.parse(localStorage.getItem(STORAGE_KEYS.cachedVault) || 'null');
}

function saveState(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ================= NETWORK =================
async function fetchApi(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!res.ok) throw new Error('API error');
  return res.json();
}

// ================= SYNC =================
async function syncPendingLogs() {
  if (!navigator.onLine || isSyncing || pendingLogs.length === 0) return;

  isSyncing = true;
  const remaining = [];

  for (let log of pendingLogs) {
    try {
      const payload = {
        zid: ZID,
        materials: log.materials,
        kilos: log.kilos,
        price: log.price,
        total: log.total,
        zone: log.zone || null
      };

      const res = await fetchApi('/breg/log', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!res.success) throw new Error();

    } catch {
      log.retries = (log.retries || 0) + 1;
      remaining.push(log);
    }
  }

  pendingLogs = remaining;
  saveState(STORAGE_KEYS.pendingLogs, pendingLogs);

  isSyncing = false;

  await loadAllData();
}

// ================= DATA =================
async function loadAllData() {
  await Promise.all([
    fetchDashboardData(),
    fetchHistoryData(),
    fetchVaultData()
  ]);

  renderDashboard();
}

async function fetchDashboardData() {
  try {
    cachedDashboard = await fetchApi(`/breg/dashboard/${ZID}`);
    saveState(STORAGE_KEYS.cachedDashboard, cachedDashboard);
  } catch {}
}

async function fetchHistoryData() {
  try {
    cachedHistory = await fetchApi(`/breg/history/${ZID}`);
    saveState(STORAGE_KEYS.cachedHistory, cachedHistory);
  } catch {}
}

async function fetchVaultData() {
  try {
    cachedVault = await fetchApi(`/breg/vault/${ZID}`);
    saveState(STORAGE_KEYS.cachedVault, cachedVault);
  } catch {}
}

// ================= UI =================
function renderDashboard() {
  const data = cachedDashboard || {};

  document.getElementById('main-content').innerHTML = `
    <div class="card">
      <h2>Ingreso diario</h2>
      <p>$${data.dailyIncome || 0}</p>
    </div>

    <div class="card">
      <h2>Ingreso mensual</h2>
      <p>$${data.monthlyIncome || 0}</p>
    </div>

    <div class="card">
      <h2>Vault</h2>
      <p>$${data.vaultSavings || 0}</p>
    </div>
  `;
}

// ================= REGISTER =================
function addPendingLog(entry) {
  const log = {
    ...entry,
    zid: ZID,
    retries: 0
  };

  pendingLogs.unshift(log);
  saveState(STORAGE_KEYS.pendingLogs, pendingLogs);
}

// ================= EVENTS =================
function registerEvents() {
  window.addEventListener('online', () => {
    updateStatus();
    syncPendingLogs();
  });

  window.addEventListener('offline', updateStatus);
}

function updateStatus() {
  const statusButton = document.getElementById('status-button');
  statusButton.textContent = navigator.onLine ? 'Online' : 'Offline';
}

// ================= START =================
init();
