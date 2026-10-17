// ============================================
// PAGES/PROFILE.JS
// Logika halaman Profile
// ============================================

// --------------------------------------------
// STATE
// --------------------------------------------
let currentRole = null;
let currentCodename = null;

// --------------------------------------------
// DAFTAR FITUR PER ROLE
// --------------------------------------------

const FEATURES_USER = [
  "Lihat Catalogue",
  "Search & Filter",
  "Favorite",
  "Custom List",
  "Lihat Statistic",
  "Baca Guide & Infos",
];

const FEATURES_ADMIN = [
  ...FEATURES_USER,
  "Add Sheet",
  "Edit Sheet",
  "Delete Sheet (milik sendiri)",
  "Add Digital Book",
  "Edit Digital Book",
  "Delete Book (milik sendiri)",
];

const FEATURES_DEVELOPER = [
  ...FEATURES_ADMIN.slice(0, 6), // User features
  "Add Sheet",
  "Edit Sheet",
  "Delete Sheet (semua)",
  "Add Digital Book",
  "Edit Digital Book",
  "Delete Book (semua)",
  "Edit Content Guide & Infos",
];

function getFeaturesByRole(role) {
  if (role === "developer") return FEATURES_DEVELOPER;
  if (role === "admin") return FEATURES_ADMIN;
  return FEATURES_USER;
}

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

function isLoggedIn() {
  return !!currentRole;
}

// --------------------------------------------
// RENDER STATUS
// --------------------------------------------

function renderStatus() {
  const statusCard = document.getElementById("profileStatus");
  const statusValue = document.getElementById("statusValue");
  const statusCodename = document.getElementById("statusCodename");
  const loginSection = document.getElementById("profileLogin");
  const logoutSection = document.getElementById("profileLogout");

  // Reset class
  statusCard.classList.remove("is-user", "is-admin", "is-developer");

  if (!isLoggedIn()) {
    statusValue.textContent = "User (Belum Login)";
    statusCodename.textContent = "";
    statusCard.classList.add("is-user");
    loginSection.hidden = false;
    logoutSection.hidden = true;
  } else {
    const roleLabel =
      currentRole === "developer"
        ? "Developer"
        : currentRole === "admin"
        ? "Admin"
        : "User";

    statusValue.textContent = roleLabel;
    statusCodename.textContent = "Codename: " + currentCodename;
    statusCard.classList.add("is-" + currentRole);
    loginSection.hidden = true;
    logoutSection.hidden = false;
  }

  // Update badge di navbar
  const badge = document.getElementById("roleBadge");
  const profileBtn = document.getElementById("btnProfile");

  if (isLoggedIn()) {
    badge.textContent = currentCodename;
    badge.classList.add("is-visible");
    profileBtn.textContent = "×";
    profileBtn.title = "Keluar";
  } else {
    badge.textContent = "";
    badge.classList.remove("is-visible");
    profileBtn.textContent = "👤";
    profileBtn.title = "Profil";
  }
}

// --------------------------------------------
// RENDER FITUR
// --------------------------------------------

function renderFeatures() {
  const list = document.getElementById("featureList");
  if (!list) return;

  const features = getFeaturesByRole(currentRole);
  list.innerHTML = "";

  features.forEach((feature) => {
    const li = document.createElement("li");
    li.textContent = feature;
    list.appendChild(li);
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

    // Clear form
    document.getElementById("login-codename").value = "";
    document.getElementById("login-code").value = "";

    // Update tampilan
    renderStatus();
    renderFeatures();

    showToast(`Selamat datang, ${data.codename}!`, "success");
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

// --------------------------------------------
// LOGOUT
// --------------------------------------------

function handleLogout() {
  if (!confirm("Keluar dari mode " + currentRole + "?")) return;

  clearAuth();
  currentRole = null;
  currentCodename = null;

  renderStatus();
  renderFeatures();

  showToast("Berhasil keluar", "success");
}

// --------------------------------------------
// INIT
// --------------------------------------------

function initProfile() {
  mmLog("Profile init");

  const auth = getStoredAuth();
  currentRole = auth.role;
  currentCodename = auth.codename;

  // Render awal
  renderStatus();
  renderFeatures();

  // Event listeners
  document.getElementById("form-login")?.addEventListener("submit", handleLogin);
  document.getElementById("btnLogout")?.addEventListener("click", handleLogout);

  // Tombol profil di navbar → kalau sudah login, logout; kalau belum, scroll ke form login
  document.getElementById("btnProfile")?.addEventListener("click", () => {
    if (isLoggedIn()) {
      handleLogout();
    } else {
      // Scroll ke form login
      document.getElementById("profileLogin")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      document.getElementById("login-codename")?.focus();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initProfile);
} else {
  initProfile();
}