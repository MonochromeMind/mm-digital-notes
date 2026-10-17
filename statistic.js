// ============================================
// PAGES/STATISTIC.JS
// Logika halaman Statistic
// ============================================

// --------------------------------------------
// STATE
// --------------------------------------------
let currentRole = null;
let currentCodename = null;

// --------------------------------------------
// AUTH HELPERS
// --------------------------------------------

function getStoredAuth() {
  return {
    role: localStorage.getItem(MM_CONFIG.STORAGE_KEYS.ROLE),
    codename: localStorage.getItem(MM_CONFIG.STORAGE_KEYS.CODENAME),
    code: localStorage.getItem(MM_CONFIG.STORAGE_KEYS.CODE),
  };
}

function saveAuth(role, codename, code) {
  localStorage.setItem(MM_CONFIG.STORAGE_KEYS.ROLE, role);
  localStorage.setItem(MM_CONFIG.STORAGE_KEYS.CODENAME, codename);
  localStorage.setItem(MM_CONFIG.STORAGE_KEYS.CODE, code);
}

function clearAuth() {
  localStorage.removeItem(MM_CONFIG.STORAGE_KEYS.ROLE);
  localStorage.removeItem(MM_CONFIG.STORAGE_KEYS.CODENAME);
  localStorage.removeItem(MM_CONFIG.STORAGE_KEYS.CODE);
}

function isLoggedIn() { return !!currentRole; }
function isAdmin() { return currentRole === "admin" || currentRole === "developer"; }
function isDeveloper() { return currentRole === "developer"; }

// --------------------------------------------
// API CALL
// --------------------------------------------

async function callAPI(action, payload = {}) {
  if (!isConfigReady()) {
    throw new Error("API_URL belum diisi di js/config.js");
  }

  const auth = getStoredAuth();

  const body = {
    action,
    payload,
    codename: auth.codename,
    code: auth.code,
  };

  mmLog("API call:", action);

  const res = await fetch(MM_CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

// --------------------------------------------
// FETCH STATISTICS
// --------------------------------------------

async function fetchStatistics() {
  const res = await callAPI("get_statistics");
  return res.data || {};
}

// --------------------------------------------
// RENDER
// --------------------------------------------

function renderStatistics(stats) {
  // Hide loading, show content
  document.getElementById("statLoading").hidden = true;
  document.getElementById("statContent").hidden = false;

  // Overview
  setText("statTotalSheets", stats.totalSheets ?? 0);
  setText("statTotalBooks", stats.totalBooks ?? 0);
  setText("statTotalChapters", stats.totalChapters ?? 0);

  // Hierarchy
  setText("statTotalDisciplines", stats.totalDisciplines ?? 0);
  setText("statTotalFields", stats.totalFields ?? 0);

  // Tier 2
  const tier2 = stats.tier2 || {};
  setText("statBranch", tier2.branch ?? 0);
  setText("statMultidisciplinary", tier2.multidisciplinary ?? 0);
  setText("statApplied", tier2.applied ?? 0);
  setText("statPractical", tier2.practical ?? 0);

  // Sheet Types
  renderSheetTypes(stats.sheetTypes || {});

  // Relations
  renderRelations(stats.relations || {});
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// --------------------------------------------
// RENDER SHEET TYPES (bar)
// --------------------------------------------

function renderSheetTypes(counts) {
  const container = document.getElementById("statSheetTypes");
  if (!container) return;

  const types = [
    { key: "book",     emoji: "📘", label: "Book" },
    { key: "target",   emoji: "🎯", label: "Target" },
    { key: "pencil",   emoji: "✏️", label: "Pencil" },
    { key: "lamp",     emoji: "💡", label: "Lamp" },
    { key: "crown",    emoji: "👑", label: "Crown" },
    { key: "analyst",  emoji: "🔍", label: "Analyst" },
    { key: "rocket",   emoji: "🚀", label: "Rocket" },
    { key: "specific", emoji: "🚩", label: "Specific" },
    { key: "more",     emoji: "➕", label: "More" },
  ];

  const max = Math.max(...Object.values(counts), 1);
  container.innerHTML = "";

  types.forEach((t) => {
    const count = counts[t.key] || 0;
    const percent = (count / max) * 100;

    const bar = document.createElement("div");
    bar.className = "stat-bar";
    bar.innerHTML = `
      <span class="stat-bar__label">${t.emoji} ${t.label}</span>
      <span class="stat-bar__value">${count}</span>
      <div class="stat-bar__progress">
        <div class="stat-bar__progress-fill" style="width: ${percent}%"></div>
      </div>
    `;
    container.appendChild(bar);
  });
}

// --------------------------------------------
// RENDER RELATIONS (bar)
// --------------------------------------------

function renderRelations(counts) {
  const container = document.getElementById("statRelations");
  if (!container) return;

  const types = [
    { key: "learning_path",  label: "🔵 Learning Path" },
    { key: "similarity",     label: "🟢 Similarity" },
    { key: "influence",      label: "🟡 Influence" },
    { key: "contradiction",  label: "🔴 Contradiction" },
    { key: "reinforcement",  label: "🟩 Reinforcement" },
    { key: "application",    label: "🟠 Application" },
  ];

  const max = Math.max(...Object.values(counts), 1);
  container.innerHTML = "";

  types.forEach((t) => {
    const count = counts[t.key] || 0;
    const percent = (count / max) * 100;

    const bar = document.createElement("div");
    bar.className = "stat-bar";
    bar.innerHTML = `
      <span class="stat-bar__label">${t.label}</span>
      <span class="stat-bar__value">${count}</span>
      <div class="stat-bar__progress">
        <div class="stat-bar__progress-fill" style="width: ${percent}%"></div>
      </div>
    `;
    container.appendChild(bar);
  });
}

// --------------------------------------------
// LOGIN
// --------------------------------------------

async function handleLogin(event) {
  event.preventDefault();

  const codename = document.getElementById("login-codename").value.trim();
  const code = document.getElementById("login-code").value;
  const errorEl = document.getElementById("loginError");

  errorEl.hidden = true;

  if (!codename || !code) {
    errorEl.textContent = "Codename dan kode wajib diisi";
    errorEl.hidden = false;
    return;
  }

  try {
    const res = await fetch(MM_CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codename, code, action: "login" }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || "Login gagal");
    }

    saveAuth(data.role, data.codename, code);
    currentRole = data.role;
    currentCodename = data.codename;

    updateUIForRole();
    closeModal("modal-login");
    showToast(`Selamat datang, ${data.codename}!`, "success");

    // Reload statistic
    await loadStatistic();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

function handleLogout() {
  clearAuth();
  currentRole = null;
  currentCodename = null;
  updateUIForRole();
  showToast("Berhasil keluar", "success");
  closeSidebar();
}

// --------------------------------------------
// UI BERDASARKAN ROLE
// --------------------------------------------

function updateUIForRole() {
  const badge = document.getElementById("roleBadge");
  const profileBtn = document.getElementById("btnProfile");

  if (isLoggedIn()) {
    if (badge) {
      badge.textContent = currentCodename;
      badge.classList.add("is-visible");
    }
    if (profileBtn) {
      profileBtn.textContent = "×";
      profileBtn.title = "Keluar";
    }
  } else {
    if (badge) {
      badge.textContent = "";
      badge.classList.remove("is-visible");
    }
    if (profileBtn) {
      profileBtn.textContent = "👤";
      profileBtn.title = "Masuk";
    }
  }
}

// --------------------------------------------
// PROFILE BUTTON
// --------------------------------------------

function initProfileButton() {
  const btn = document.getElementById("btnProfile");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (isLoggedIn()) {
      if (confirm("Keluar dari mode admin?")) handleLogout();
    } else {
      document.getElementById("login-codename").value = "";
      document.getElementById("login-code").value = "";
      document.getElementById("loginError").hidden = true;
      openModal("modal-login");
    }
  });
}

// --------------------------------------------
// LOAD STATISTIC
// --------------------------------------------

async function loadStatistic() {
  const loadingEl = document.getElementById("statLoading");
  const contentEl = document.getElementById("statContent");

  loadingEl.hidden = false;
  contentEl.hidden = true;

  if (!isConfigReady()) {
    loadingEl.textContent = "⚙️ API_URL belum diisi di js/config.js";
    return;
  }

  // Butuh login dulu (karena Edge Function butuh codename+code)
  if (!isLoggedIn()) {
    loadingEl.textContent = "Silakan login dulu untuk melihat statistik.";
    return;
  }

  try {
    const stats = await fetchStatistics();
    renderStatistics(stats);
  } catch (err) {
    mmError("Gagal load statistic:", err);
    loadingEl.textContent = `Gagal memuat: ${err.message}`;
  }
}

// --------------------------------------------
// INIT
// --------------------------------------------

async function initStatistic() {
  mmLog("Statistic init");

  const auth = getStoredAuth();
  currentRole = auth.role;
  currentCodename = auth.codename;

  updateUIForRole();

  // Event listeners
  initProfileButton();
  document.getElementById("form-login")?.addEventListener("submit", handleLogin);

  // Load data
  await loadStatistic();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStatistic);
} else {
  initStatistic();
}