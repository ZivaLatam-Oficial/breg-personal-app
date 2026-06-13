const API_BASE = 'https://ziva-core-backend-production-fb94.up.railway.app';

const STORAGE_KEYS = {
  pendingLogs: 'breg_pending_logs',
  cachedDashboard: 'breg_cached_dashboard',
  cachedHistory: 'breg_cached_history',
  cachedVault: 'breg_cached_vault',
  zid: 'ziva_zid'
};

// ✅ ZID persistente (base real)
let ZID = localStorage.getItem(STORAGE_KEYS.zid);
if (!ZID) {
  ZID = `zid-${Date.now()}`;
  localStorage.setItem(STORAGE_KEYS.zid, ZID);
}

let pendingLogs = [];
let cachedDashboard = null;
let cachedHistory = null;
let cachedVault = null;

let isSyncing = false;
let activeView = 'dashboard';

const pageTitle = document.getElementById('page-title');
const mainContent = document.getElementById('main-content');
const toast = document.getElementById('toast');
const statusButton = document.getElementById('status-button');
const navButtons = document.querySelectorAll('.nav-item');

function init() {
  restoreState();
  updateStatus();
  registerEvents();
  loadAllData();
  setInterval(syncPendingLogs, 30000);
}

function restoreState() {
  pendingLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.pendingLogs) || '[]');
  cachedDashboard = JSON.parse(localStorage.getItem(STORAGE_KEYS.cachedDashboard) || 'null');
  cachedHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.cachedHistory) || 'null');
  cachedVault = JSON.parse(localStorage.getItem(STORAGE_KEYS.cachedVault) || 'null');
}

function saveState(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function registerEvents() {
  navButtons.forEach(btn => btn.addEventListener('click', onNavClick));

  window.addEventListener('online', () => {
    updateStatus();
    showToast('Conectado. Sincronizando...');
    syncPendingLogs();
  });

  window.addEventListener('offline', updateStatus);
}

function onNavClick(e) {
  activeView = e.currentTarget.dataset.view;
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.view === activeView));
  renderView();
}

function updateStatus() {
  statusButton.textContent = navigator.onLine ? 'Online' : 'Offline';
}

async function loadAllData() {
  await Promise.all([
    fetchDashboardData(),
    fetchHistoryData(),
    fetchVaultData()
  ]);
  renderView();
  syncPendingLogs();
}

async function fetchApi(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!res.ok) throw new Error('API error');
  return res.json();
}

// ================= SYNC REAL =================

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
        timestamp: Date.now()
      };

      const res = await fetchApi('/breg/log', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!res.success) throw new Error();

      showToast('✔ Sincronizado');

    } catch (err) {
      log.retries = (log.retries || 0) + 1;
      log.status = log.retries >= 3 ? 'failed' : 'pending';
      remaining.push(log);
    }
  }

  pendingLogs = remaining;
  saveState(STORAGE_KEYS.pendingLogs, pendingLogs);

  isSyncing = false;

  await Promise.all([
    fetchDashboardData(),
    fetchHistoryData(),
    fetchVaultData()
  ]);

  renderView();
}

// ================= DATA =================

function addPendingLog(entry) {
  pendingLogs.unshift({
    ...entry,
    zid: ZID,
    status: 'pending',
    retries: 0
  });

  saveState(STORAGE_KEYS.pendingLogs, pendingLogs);
}

async function fetchDashboardData() {
  try {
    cachedDashboard = await fetchApi('/breg/dashboard');
    saveState(STORAGE_KEYS.cachedDashboard, cachedDashboard);
  } catch {}
}

async function fetchHistoryData() {
  try {
    cachedHistory = await fetchApi('/breg/history');
    saveState(STORAGE_KEYS.cachedHistory, cachedHistory);
  } catch {}
}

async function fetchVaultData() {
  try {
    cachedVault = await fetchApi('/breg/vault');
    saveState(STORAGE_KEYS.cachedVault, cachedVault);
  } catch {}
}

// ================= UI =================

function renderView() {
  switch (activeView) {
    case 'register': return renderRegister();
    case 'history': return renderHistory();
    case 'vault': return renderVault();
    case 'profile': return renderProfile();
    default: return renderDashboard();
  }
}

// ================= REGISTER =================

function renderRegister() {
  pageTitle.textContent = 'Registrar';

  mainContent.innerHTML = `
    <div class="card">
      <h2>Nuevo registro</h2>
      <input id="materials" placeholder="Materiales (coma)" />
      <input id="kilos" placeholder="Kilos" />
      <input id="price" placeholder="Precio" />
      <button id="submit-log">Guardar</button>
    </div>
  `;

  document.getElementById('submit-log').onclick = () => {
    const materials = document.getElementById('materials').value.split(',');
    const kilos = parseFloat(document.getElementById('kilos').value);
    const price = parseFloat(document.getElementById('price').value);

    if (!materials.length || !kilos || !price) {
      return showToast('Datos inválidos');
    }

    addPendingLog({
      id: Date.now(),
      date: new Date().toISOString(),
      materials,
      kilos,
      price,
      total: kilos * price
    });

    showToast('Guardado local');
    syncPendingLogs();
  };
}

// ================= DASHBOARD =================

function renderDashboard() {
  pageTitle.textContent = 'Dashboard';

  const data = cachedDashboard || {};

  mainContent.innerHTML = `
    <div class="card">
      <h2>Ingreso</h2>
      <p>$${data.dailyIncome || 0}</p>
    </div>
    <div class="card">
      <h2>Vault</h2>
      <p>$${data.vaultSavings || 0}</p>
    </div>
  `;
}

// ================= HISTORY =================

function renderHistory() {
  pageTitle.textContent = 'Historial';

  const all = [...pendingLogs, ...(cachedHistory?.logs || [])];

  mainContent.innerHTML = all.map(log => `
    <div class="card">
      <strong>${log.materials.join(', ')}</strong>
      <p>$${log.total}</p>
      <span>${log.status || 'sync'}</span>
    </div>
  `).join('');
}

// ================= VAULT =================

function renderVault() {
  pageTitle.textContent = 'Vault';

  const vault = cachedVault || {};

  mainContent.innerHTML = `
    <div class="card">
      <h2>Total</h2>
      <p>$${vault.totalSaved || 0}</p>
    </div>
  `;
}

// ================= PROFILE =================

function renderProfile() {
  pageTitle.textContent = 'Perfil';

  mainContent.innerHTML = `
    <div class="card">
      <h2>ZID</h2>
      <p>${ZID}</p>
    </div>
  `;
}

// ================= UTIL =================

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2000);
}

init();
