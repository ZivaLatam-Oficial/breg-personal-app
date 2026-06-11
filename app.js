const API_BASE = 'https://ziva-core-backend-production-fb94.up.railway.app';
const STORAGE_KEYS = {
  pendingLogs: 'breg_pending_logs',
  cachedDashboard: 'breg_cached_dashboard',
  cachedHistory: 'breg_cached_history',
  cachedVault: 'breg_cached_vault'
};
const MATERIAL_OPTIONS = [
  'Aluminum', 'Copper', 'Bronze', 'Scrap',
  'PET', 'HDPE', 'Clothes', 'Shoes', 'Tech', 'Hardware'
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
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
  navButtons.forEach(button => button.addEventListener('click', onNavClick));
  window.addEventListener('online', () => {
    updateStatus();
    showToast('Conectado. Sincronizando entradas...');
    syncPendingLogs();
  });
  window.addEventListener('offline', () => updateStatus());
}

function onNavClick(event) {
  const view = event.currentTarget.dataset.view;
  activeView = view;
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  renderView();
}

function updateStatus() {
  const offline = !navigator.onLine;
  statusButton.textContent = offline ? 'Offline' : 'Online';
  statusButton.style.background = offline ? 'rgba(244,63,94,0.16)' : 'rgba(34,197,94,0.16)';
  statusButton.style.color = offline ? '#fecaca' : '#dcfce7';
}

async function loadAllData() {
  await Promise.all([fetchDashboardData(), fetchHistoryData(), fetchVaultData()]);
  renderView();
  syncPendingLogs();
}

async function fetchDashboardData() {
  try {
    const result = await fetchApi('/breg/dashboard');
    cachedDashboard = result;
    saveState(STORAGE_KEYS.cachedDashboard, cachedDashboard);
    return cachedDashboard;
  } catch (error) {
    return cachedDashboard;
  }
}

async function fetchHistoryData() {
  try {
    const result = await fetchApi('/breg/history');
    cachedHistory = result;
    saveState(STORAGE_KEYS.cachedHistory, cachedHistory);
    return cachedHistory;
  } catch (error) {
    return cachedHistory;
  }
}

async function fetchVaultData() {
  try {
    const result = await fetchApi('/breg/vault');
    cachedVault = result;
    saveState(STORAGE_KEYS.cachedVault, cachedVault);
    return cachedVault;
  } catch (error) {
    return cachedVault;
  }
}

async function fetchApi(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    throw new Error('API error');
  }
  return response.json();
}

async function syncPendingLogs() {
  if (!navigator.onLine || isSyncing || pendingLogs.length === 0) {
    return;
  }
  isSyncing = true;
  let failed = false;
  for (let i = 0; i < pendingLogs.length; i += 1) {
    const entry = pendingLogs[i];
    let attempt = 0;
    let success = false;
    while (attempt < 4 && !success) {
      try {
        await fetchApi('/breg/log', {
          method: 'POST',
          body: JSON.stringify(entry)
        });
        pendingLogs.splice(i, 1);
        i -= 1;
        saveState(STORAGE_KEYS.pendingLogs, pendingLogs);
        success = true;
        showToast('Entrada sincronizada con éxito');
      } catch (error) {
        attempt += 1;
        const delay = 500 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    if (!success) {
      failed = true;
    }
  }
  isSyncing = false;
  if (!failed) {
    await Promise.all([fetchDashboardData(), fetchHistoryData(), fetchVaultData()]);
    renderView();
  }
}

function addPendingLog(entry) {
  pendingLogs.unshift(entry);
  saveState(STORAGE_KEYS.pendingLogs, pendingLogs);
}

function buildCard(title, html) {
  return `<section class="card"><h2>${title}</h2>${html}</section>`;
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

function renderDashboard() {
  pageTitle.textContent = 'Dashboard';
  const data = cachedDashboard || {};
  const dailyIncome = data.dailyIncome || 0;
  const vaultSaved = data.vaultSavings || 0;
  const rank = data.zivaRank?.badge || 'Explorador Financiero';
  const progress = Math.min(100, data.rankProgress || 0);
  const nudges = data.nudges || ['Registra tu primera ruta para ganar impulso.'];
  const cards = [];
  cards.push(buildCard('Ingreso diario', `<p><strong>$${dailyIncome.toFixed(2)}</strong></p>`));
  cards.push(buildCard('Ahorro automático', `<p><strong>$${vaultSaved.toFixed(2)}</strong> · 15% del ingreso</p>`));
  cards.push(buildCard('ZivaRank', `<span class="badge">${rank}</span><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>`));
  const chartBars = renderChartBars(data.incomeTrend || [20,40,60,50,80]);
  const nudgeText = nudges[0];
  mainContent.innerHTML = `
    ${buildCard('Resumen rápido', `
      <div class="stat-row">
        <div class="stat-card"><strong>$${dailyIncome.toFixed(0)}</strong><span>Ingresos</span></div>
        <div class="stat-card"><strong>$${vaultSaved.toFixed(0)}</strong><span>Protegido</span></div>
      </div>
    `)}
    ${buildCard('Progreso ZivaRank', `
      <div class="badge">${rank}</div>
      <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
      <p class="message">Sigue registrando para asegurar tu siguiente avance.</p>
    `)}
    ${buildCard('Actividad reciente', chartBars)}
    ${buildCard('Nudges', `<div class="nudge-card"><p>${nudgeText}</p></div>`)}
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
