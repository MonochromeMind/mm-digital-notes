// ============================================
// PAGES/GUIDE.JS
// Logika halaman Guide & Infos
// ============================================

// --------------------------------------------
// STATE
// --------------------------------------------
let currentRole = null;
let currentCodename = null;
let currentTab = "guide";
let guideContent = "";
let infoContent = "";

// --------------------------------------------
// MARKDOWN PARSER (sederhana)
// --------------------------------------------

function renderMarkdown(md) {
  if (!md) return "";

  let html = md;

  // Escape HTML dulu (kecuali yang kita generate)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code block (```)
  html = html.replace(/```([\s\S]*?)```/g, (m, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Heading
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Link [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Blockquote
  html = html.replace(/^&gt;\s+(.+)$/gm, "<blockquote>$1</blockquote>");

  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr>");

  // List (unordered)
  html = html.replace(/^[\*\-]\s+(.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);

  // List (ordered) — sederhana
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  // Paragraf (baris yang bukan tag)
  html = html
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<")) return line;
      return `<p>${line}</p>`;
    })
    .join("\n");

  // Bersihkan paragraf kosong
  html = html.replace(/<p><\/p>/g, "");

  return html;
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

  const res = await fetch(MM_CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      payload,
      codename: auth.codename,
      code: auth.code,
    }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

// --------------------------------------------
// FETCH CONTENT
// --------------------------------------------

async function fetchContent(key) {
  const res = await callAPI("get_content", { key });
  return res.data?.value || "";
}

async function loadAllContent() {
  try {
    guideContent = await fetchContent("guide_content");
    infoContent = await fetchContent("info_content");
  } catch (err) {
    mmError("Gagal fetch content:", err);
    guideContent = "";
    infoContent = "";
  }
}

// --------------------------------------------
// RENDER
// --------------------------------------------

function renderTab(tab) {
  // Hide all panels
  document.getElementById("panel-guide").hidden = tab !== "guide";
  document.getElementById("panel-infos").hidden = tab !== "infos";

  // Update tab button active
  document.querySelectorAll(".guide-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === tab);
  });

  // Update Edit button label
  const label = document.getElementById("editButtonLabel");
  if (label) {
    label.textContent = tab === "guide" ? "Guide" : "Infos";
  }

  // Render content
  if (tab === "guide") {
    renderContent("guide");
  } else {
    renderContent("infos");
  }
}

function renderContent(tab) {
  const loadingEl = document.getElementById(`guideLoading${tab === "guide" ? "Guide" : "Infos"}`);
  const contentEl = document.getElementById(`content${tab === "guide" ? "Guide" : "Infos"}`);
  const raw = tab === "guide" ? guideContent : infoContent;

  if (!contentEl || !loadingEl) return;

  loadingEl.hidden = true;
  contentEl.hidden = false;

  if (!raw || !raw.trim()) {
    contentEl.innerHTML = `
      <p class="guide-loading">
        Konten belum diisi.
        ${isDeveloper() ? "Klik tombol ✏️ Edit di atas untuk mengisi." : "Hubungi Developer untuk mengisi konten ini."}
      </p>
    `;
    return;
  }

  contentEl.innerHTML = renderMarkdown(raw);
}

// --------------------------------------------
// TABS
// --------------------------------------------

function initTabs() {
  const tabs = document.getElementById("guideTabs");
  if (!tabs) return;

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".guide-tab");
    if (!btn) return;

    currentTab = btn.dataset.tab;
    renderTab(currentTab);
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

    // Re-render content (untuk update tampilan Developer-only)
    renderContent(currentTab);
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
  renderContent(currentTab);
}

// --------------------------------------------
// UI BERDASARKAN ROLE
// --------------------------------------------

function updateUIForRole() {
  const badge = document.getElementById("roleBadge");
  const profileBtn = document.getElementById("btnProfile");
  const actionsBar = document.getElementById("guideActions");

  if (isLoggedIn()) {
    if (badge) {
      badge.textContent = currentCodename;
      badge.classList.add("is-visible");
    }
    if (profileBtn) {
      profileBtn.textContent = "×";
      profileBtn.title = "Keluar";
    }
    if (actionsBar) {
      actionsBar.hidden = !isDeveloper();
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
    if (actionsBar) {
      actionsBar.hidden = true;
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
// EDIT CONTENT
// --------------------------------------------

function initEditContent() {
  const btn = document.getElementById("btnEditContent");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const raw = currentTab === "guide" ? guideContent : infoContent;

    document.getElementById("edit-content-area").value = raw || "";
    document.getElementById("edit-content-error").hidden = true;
    document.getElementById("editModalLabel").textContent =
      currentTab === "guide" ? "Guide" : "Infos";

    openModal("modal-edit-content");
  });

  document.getElementById("form-edit-content")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const errorEl = document.getElementById("edit-content-error");
    errorEl.hidden = true;

    const value = document.getElementById("edit-content-area").value;
    const key = currentTab === "guide" ? "guide_content" : "info_content";

    try {
      await callAPI("edit_content", { key, value });
      closeModal("modal-edit-content");
      showToast("Konten berhasil disimpan", "success");

      // Update local state
      if (currentTab === "guide") guideContent = value;
      else infoContent = value;

      renderContent(currentTab);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
}

// --------------------------------------------
// INIT
// --------------------------------------------

async function initGuide() {
  mmLog("Guide init");

  const auth = getStoredAuth();
  currentRole = auth.role;
  currentCodename = auth.codename;

  updateUIForRole();

  // Event listeners
  initTabs();
  initProfileButton();
  initEditContent();

  document.getElementById("form-login")?.addEventListener("submit", handleLogin);

  // Fetch content
  if (isConfigReady()) {
    await loadAllContent();
  }

  // Render default tab
  renderTab(currentTab);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGuide);
} else {
  initGuide();
}