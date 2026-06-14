const API_BASE = 'https://ziva-core-backend-production-fb94.up.railway.app';

// ================= ZID =================
const ZID = localStorage.getItem('zid') || 'test-zid-001';

// ================= UI =================
const pageTitle = document.getElementById('page-title');
const mainContent = document.getElementById('main-content');
const toast = document.getElementById('toast');
const navButtons = document.querySelectorAll('.nav-item');

// ================= STATE =================
let dashboard = null;
let history = [];
let vault = null;

let activeView = 'dashboard';

// ================= INIT =================
init();

function init() {
  registerEvents();
  loadData();
}

// ================= EVENTS =================
function registerEvents() {
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      activeView = btn.dataset.view;
      render();
    });
  });
}

// ================= API =================
async function fetchApi(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!res.ok) throw new Error('API error');
  return res.json();
}

async function loadData() {
  try {
    dashboard = await fetchApi(`/breg/dashboard/${ZID}`);
    history = (await fetchApi(`/breg/history/${ZID}`)).logs;
    vault = await fetchApi(`/breg/vault/${ZID}`);
  } catch (err) {
    console.error(err);
    showToast('Error cargando datos');
  }

  render();
}

// ================= RENDER =================
function render() {
  switch (activeView) {
    case 'register': return renderRegister();
    case 'history': return renderHistory();
    case 'vault': return renderVault();
    default: return renderDashboard();
  }
}

// ================= DASHBOARD =================
function renderDashboard() {
  pageTitle.textContent = 'Tu progreso';

  mainContent.innerHTML = `
    <div class="card">
      <h2>Ingresos de hoy</h2>
      <p style="font-size:24px">$${dashboard?.dailyIncome || 0}</p>
      <small>Lo que generaste hoy</small>
    </div>

    <div class="card">
      <h2>Capital acumulado</h2>
      <p style="font-size:24px">$${vault?.totalSaved || 0}</p>
      <small>Tu fondo de crecimiento (15%)</small>
    </div>

    <div class="card">
      <h2>Lectura financiera</h2>
      <p>
        Cada vez que trabajas, no solo ganas dinero.  
        Estás construyendo estabilidad.
      </p>
    </div>
  `;
}

// ================= REGISTER =================
function renderRegister() {
  pageTitle.textContent = 'Registrar ingreso';

  mainContent.innerHTML = `
    <div class="card">
      <h2>Nuevo ingreso</h2>

      <input id="kilos" placeholder="Kilos"/>
      <input id="price" placeholder="Precio por kilo"/>

      <button id="save">Guardar</button>
    </div>
  `;

  document.getElementById('save').onclick = saveLog;
}

async function saveLog() {
  const kilos = Number(document.getElementById('kilos').value);
  const price = Number(document.getElementById('price').value);

  const total = kilos * price;

  try {
    await fetchApi('/breg/log', {
      method: 'POST',
      body: JSON.stringify({
        zid: ZID,
        materials: ['Aluminum'],
        kilos,
        price,
        total,
        zone: 'Santiago'
      })
    });

    showToast('Ingreso registrado');
    loadData();

  } catch (err) {
    showToast('Error al guardar');
  }
}

// ================= HISTORY =================
function renderHistory() {
  pageTitle.textContent = 'Historial';

  mainContent.innerHTML = history.map(h => `
    <div class="card">
      <strong>$${h.total}</strong>
      <p>${h.materials.join(', ')}</p>
    </div>
  `).join('');
}

// ================= VAULT =================
function renderVault() {
  pageTitle.textContent = 'Tu capital';

  mainContent.innerHTML = `
    <div class="card">
      <h2>Total acumulado</h2>
      <p style="font-size:28px">$${vault?.totalSaved || 0}</p>
    </div>

    <div class="card">
      <p>
        Este dinero no es gasto.  
        Es tu futuro.
      </p>
    </div>
  `;
}

// ================= TOAST =================
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2000);
}
