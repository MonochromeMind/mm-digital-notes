// ============================================
// UI.JS
// Fungsi UI universal: sidebar, modal, toast
// ============================================

// --------------------------------------------
// SIDEBAR
// --------------------------------------------

function openSidebar() {
  const sidebar = document.getElementById("sidebar");
  const hamburger = document.getElementById("btnSidebar");
  if (!sidebar) return;
  sidebar.classList.add("is-open");
  hamburger?.classList.add("is-active");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const hamburger = document.getElementById("btnSidebar");
  if (!sidebar) return;
  sidebar.classList.remove("is-open");
  hamburger?.classList.remove("is-active");
  document.body.style.overflow = "";
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  if (sidebar.classList.contains("is-open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

// --------------------------------------------
// MODAL
// --------------------------------------------

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    mmError(`Modal tidak ditemukan: ${modalId}`);
    return;
  }
  modal.classList.add("is-open");
  document.body.style.overflow = "hidden";

  // Fokus ke input pertama
  const firstInput = modal.querySelector("input, select, textarea, button");
  setTimeout(() => firstInput?.focus(), 100);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("is-open");

  // Restore scroll kalau tidak ada modal/sidebar lain terbuka
  const anyOpen = document.querySelector(".modal.is-open, .sidebar.is-open");
  if (!anyOpen) {
    document.body.style.overflow = "";
  }
}

function closeAllModals() {
  document.querySelectorAll(".modal.is-open").forEach((m) => {
    m.classList.remove("is-open");
  });
  document.body.style.overflow = "";
}

// --------------------------------------------
// TOAST
// --------------------------------------------

let toastTimeout = null;

function showToast(message, type = "info", duration = 3000) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  // Reset class
  toast.className = "toast";
  toast.hidden = false;

  // Set type
  if (type === "success") toast.classList.add("toast--success");
  if (type === "error") toast.classList.add("toast--error");

  toast.textContent = message;

  // Trigger animasi
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  // Auto-hide
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => {
      toast.hidden = true;
    }, 300);
  }, duration);
}

// --------------------------------------------
// DELEGASI EVENT MODAL (data-close)
// --------------------------------------------

function initModalDelegation() {
  document.addEventListener("click", (e) => {
    // Klik tombol/overlay dengan data-close
    const closeTarget = e.target.closest("[data-close]");
    if (closeTarget) {
      const modal = closeTarget.closest(".modal");
      if (modal) {
        closeModal(modal.id);
        return;
      }
    }
  });

  // ESC untuk tutup
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (document.querySelector(".modal.is-open")) {
        closeAllModals();
      } else if (document.querySelector(".sidebar.is-open")) {
        closeSidebar();
      }
    }
  });
}

// --------------------------------------------
// SIDEBAR EVENT LISTENERS
// --------------------------------------------

function initSidebar() {
  const btnSidebar = document.getElementById("btnSidebar");
  const btnClose = document.getElementById("btnCloseSidebar");
  const overlay = document.getElementById("sidebarOverlay");

  btnSidebar?.addEventListener("click", toggleSidebar);
  btnClose?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);
}

// --------------------------------------------
// FORMAT HELPERS
// --------------------------------------------

function formatDate(isoString) {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  } catch {
    return "—";
  }
}

function escapeHTML(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --------------------------------------------
// INIT
// --------------------------------------------

function initUI() {
  initModalDelegation();
  initSidebar();
  mmLog("UI initialized");
}

// Jalankan saat DOM siap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}