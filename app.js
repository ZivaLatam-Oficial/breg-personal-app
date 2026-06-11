const API_BASE = 'https://ziva-core-backend-production-fb94.up.railway.app';

const STORAGE_KEYS = {
  pendingLogs: 'breg_pending_logs',
  cachedDashboard: 'breg_cached_dashboard',
  cachedHistory: 'breg_cached_history',
  cachedVault: 'breg_cached_vault'
};

// 🔴 ZID temporal (luego será login real)
const ZID = localStorage.getItem('zid') || 'test-zid-001';

const MATERIAL_OPTIONS = [
  'Aluminum','Copper','Bronze','Scrap',
  'PET','HDPE','Clothes','Shoes','Tech','Hardware'
];

const MILESTONES = [
  { label: 'ZivaPay MVP', target: 250 },
  { label: 'ZivaPay Beta', target: 750 },
  { label: 'Production Launch', target: 1500 },
  { label: 'Legal Structure', target: 3000 },
  { label: 'Capital Target', target: 5000 }
];

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
  const offline = !navigator.onLine;
  statusButton.textContent = offline ? 'Offline' : 'Online';
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

// 🔥 SYNC REAL
async function syncPendingLogs() {
  if (!navigator.onLine || isSyncing || pendingLogs.length === 0) return;

  isSyncing = true;
  const updated = [];

  for (let log of pendingLogs) {
    try {
      const payload = {
        zid: ZID,
        materials: log.materials,
        kilos: log.kilos,
        price: log.price_per_kilo,
        total: log.total,
        timestamp: Date.now()
      };

      const res = await fetchApi('/breg/log', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        showToast('✔ Sincronizado');
        continue;
      }

      throw new Error();

    } catch (err) {
      log.retries = (log.retries || 0) + 1;
      log.status = log.retries >= 3 ? 'failed' : 'pending';
      updated.push(log);
    }
  }

  pendingLogs = updated;
  saveState(STORAGE_KEYS.pendingLogs, pendingLogs);

  isSyncing = false;

  await Promise.all([
    fetchDashboardData(),
    fetchHistoryData(),
    fetchVaultData()
  ]);

  renderView();
}

function addPendingLog(entry) {
  const log = {
    ...entry,
    zid: ZID,
    status: 'pending',
    retries: 0
  };

  pendingLogs.unshift(log);
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

function renderView() {
  switch (activeView) {
    case 'register': renderRegister(); break;
    case 'history': renderHistory(); break;
    case 'vault': renderVault(); break;
    case 'profile': renderProfile(); break;
    default: renderDashboard();
  }
}

// ================= REGISTER =================

function renderRegister() {
  pageTitle.textContent = 'Registrar';

  mainContent.innerHTML = `
    <section class="card form-card">
      <h2>Nuevo registro</h2>

      <div id="material-select" class="multi-select"></div>

      <input id="kilos" placeholder="Kilos"/>
      <input id="price" placeholder="Precio por kilo"/>

      <div id="calc">Total: $0</div>

      <button id="submit-log" class="button-primary">Guardar</button>
    </section>
  `;

  const select = document.getElementById('material-select');

  MATERIAL_OPTIONS.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'option-chip';
    btn.textContent = m;
    btn.onclick = () => btn.classList.toggle('active');
    select.appendChild(btn);
  });

  const kilos = document.getElementById('kilos');
  const price = document.getElementById('price');
  const calc = document.getElementById('calc');

  const updateCalc = () => {
    const total = (kilos.value || 0) * (price.value || 0);
    calc.textContent = `Total: $${total}`;
  };

  kilos.oninput = updateCalc;
  price.oninput = updateCalc;

  document.getElementById('submit-log').onclick = () =>
    onSubmitLog(kilos, price);
}

function onSubmitLog(kilosInput, priceInput) {
  const selected = Array.from(document.querySelectorAll('.option-chip.active'))
    .map(b => b.textContent);

  if (!selected.length) return showToast('Selecciona material');

  const kilos = parseFloat(kilosInput.value);
  const price = parseFloat(priceInput.value);

  if (!kilos || !price) return showToast('Datos inválidos');

  const total = kilos * price;

  addPendingLog({
    id: Date.now(),
    date: new Date().toISOString(),
    materials: selected,
    kilos,
    price_per_kilo: price,
    total
  });

  showToast('Guardado local');
  syncPendingLogs();
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

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2000);
}

init();    ${buildCard('Nudges', `<div class="nudge-card"><p>${nudgeText}</p></div>`)}
    <section class="card"><h2>Estado local</h2><p class="message">${navigator.onLine ? 'Conectado. Datos actualizados.' : 'Offline. Las entradas se guardan localmente y se sincronizarán al volver en línea.'}</p></section>
  `;
}

function renderChartBars(values) {
  const max = Math.max(...values, 1);
  const bars = values.map(value => {
    const height = Math.max(18, Math.round((value / max) * 120));
    return `<div class="chart-bar" style="height:${height}px;"><span>${value}</span></div>`;
  }).join('');
  return `<div class="chart-grid">${bars}</div>`;
}

function renderRegister() {
  pageTitle.textContent = 'Registrar';
  const saved = cachedDashboard?.recentTotal || 0;
  mainContent.innerHTML = `
    <section class="card form-card">
      <h2>Nuevo registro</h2>
      <label>Material</label>
      <div class="multi-select" id="material-select"></div>
      <label for="kilos">Kilos</label>
      <input id="kilos" type="number" min="0" step="0.1" placeholder="0.0" />
      <label for="price">Precio por kilo</label>
      <input id="price" type="number" min="0" step="0.1" placeholder="0.0" />
      <div class="message" id="calculation">Total: $0.00 · Ahorro 15%: $0.00</div>
      <button class="button-primary" id="submit-log">Guardar entrada</button>
    </section>
    <section class="card"><h2>Resumen</h2><p><strong>$${saved.toFixed(2)}</strong> registrado recientemente.</p></section>
  `;
  const selectContainer = document.getElementById('material-select');
  MATERIAL_OPTIONS.forEach(material => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option-chip';
    button.textContent = material;
    button.dataset.material = material;
    button.addEventListener('click', () => button.classList.toggle('active'));
    selectContainer.appendChild(button);
  });
  const kilosInput = document.getElementById('kilos');
  const priceInput = document.getElementById('price');
  const calculation = document.getElementById('calculation');
  const updateCalc = () => {
    const kilos = parseFloat(kilosInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    const total = kilos * price;
    const vault = total * 0.15;
    calculation.textContent = `Total: $${total.toFixed(2)} · Ahorro 15%: $${vault.toFixed(2)}`;
  };
  kilosInput.addEventListener('input', updateCalc);
  priceInput.addEventListener('input', updateCalc);
  document.getElementById('submit-log').addEventListener('click', () => onSubmitLog(kilosInput, priceInput));
}

function onSubmitLog(kilosInput, priceInput) {
  const selected = Array.from(document.querySelectorAll('.option-chip.active')).map(btn => btn.dataset.material);
  if (selected.length === 0) {
    showToast('Selecciona al menos un material.');
    return;
  }
  const kilos = parseFloat(kilosInput.value) || 0;
  const price = parseFloat(priceInput.value) || 0;
  if (kilos <= 0 || price <= 0) {
    showToast('Ingresa kilos y precio válidos.');
    return;
  }
  const total = kilos * price;
  const vault = total * 0.15;
  const entry = {
    id: `local-${Date.now()}`,
    date: new Date().toISOString(),
    materials: selected,
    kilos,
    price_per_kilo: price,
    total,
    vault,
    source: navigator.onLine ? 'online' : 'offline'
  };
  addPendingLog(entry);
  showToast('Entrada registrada. Se sincronizará cuando estés en línea.');
  renderDashboard();
}

function renderHistory() {
  pageTitle.textContent = 'Historial';
  const history = cachedHistory?.logs || [];
  const pending = pendingLogs;
  const allLogs = [...pending, ...history].slice(0, 30);
  const html = allLogs.length === 0 ? '<p class="message">No hay registros todavía.</p>' : allLogs.map(item => {
    const date = new Date(item.date).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
    return `<div class="list-item"><strong>${item.materials?.join(', ') || 'Material desconocido'}</strong><small>${date} · ${item.kilos || 0} kg · $${(item.total || 0).toFixed(2)}</small><span class="badge-pill">${item.source === 'offline' ? 'Pendiente' : 'Registrado'}</span></div>`;
  }).join('');
  mainContent.innerHTML = `<section class="card"><h2>Registros recientes</h2>${html}</section>`;
}

function renderVault() {
  pageTitle.textContent = 'Vault';
  const vault = cachedVault || { totalSaved: 0, progress: 0 };
  const totalSaved = vault.totalSaved || 0;
  const progress = Math.min(100, vault.progress || 0);
  const milestone = MILESTONES.find(m => totalSaved < m.target) || MILESTONES[MILESTONES.length - 1];
  mainContent.innerHTML = `
    <section class="card">
      <h2>Vault protegido</h2>
      <p><strong>$${totalSaved.toFixed(2)}</strong></p>
      <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
      <p class="message">Meta activa: ${milestone.label} · ${milestone.target} USD</p>
    </section>
    <section class="card">
      <h2>Ahorras cada día</h2>
      <p>El 15% de cada entrada se guarda para fortalecer tu capital.</p>
    </section>
  `;
}

function renderProfile() {
  pageTitle.textContent = 'Perfil';
  const badge = cachedDashboard?.zivaRank?.badge || 'Explorador Financiero';
  const alias = 'Usuario BREG';
  const accountAge = cachedDashboard?.accountAge || '2 meses';
  const totalIncome = cachedDashboard?.totalIncome || 0;
  const totalSaved = cachedDashboard?.lifetimeSaved || 0;
  mainContent.innerHTML = `
    <section class="card"><h2>${alias}</h2><p class="badge">${badge}</p><p class="message">Cuenta activa desde ${accountAge}</p></section>
    <section class="card">
      <div class="stat-card"><strong>$${totalIncome.toFixed(0)}</strong><span>Ingresos totales</span></div>
      <div class="stat-card" style="margin-top:14px;"><strong>$${totalSaved.toFixed(0)}</strong><span>Ahorros totales</span></div>
    </section>
    <section class="card"><h2>QR</h2><p class="message">Alias: breg.usuario</p><div class="badge-pill">QR protegido con PIN</div></section>
    <section class="card"><h2>Identidad de sistema</h2><p>ZIVA Latam · ZivaTech · ZivaPay · ZivaCredit · ZivaTrust · ZivaOS</p><p class="message">© ZIVA LATAM — BHG Holding Group — All rights reserved</p></section>
  `;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2800);
}

init();
