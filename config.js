// ============================================
// CONFIG.JS
// Konfigurasi global Monochrome Mind Digital Notes
// ============================================

const MM_CONFIG = {
  // ------------------------------------------
  // URL Edge Function Supabase
  // ISI dengan URL function kamu nanti
  // Format: https://xxxxx.supabase.co/functions/v1/mm-api
  // ------------------------------------------
  API_URL: "https://quagvqzkiwdizurxxijo.supabase.co/functions/v1/mm-api",

  // ------------------------------------------
  // Info website
  // ------------------------------------------
  VERSION: "1.0.0",
  COMMUNITY: "Monochrome Mind",
  TAGLINE: "Think freely. Question deeply. Discuss respectfully.",

  // ------------------------------------------
  // Label sheet types (untuk tampilan)
  // ------------------------------------------
  SHEET_TYPES: {
    book:     { emoji: "📘", label: "Book",      prefix: "" },
    target:   { emoji: "🎯", label: "Target",    prefix: "Tg : " },
    pencil:   { emoji: "✏️", label: "Pencil",    prefix: "Pn : " },
    lamp:     { emoji: "💡", label: "Lamp",      prefix: "La : " },
    crown:    { emoji: "👑", label: "Crown",     prefix: "Cn : " },
    analyst:  { emoji: "🔍", label: "Analyst",   prefix: "An : " },
    rocket:   { emoji: "🚀", label: "Rocket",    prefix: "Rc : " },
    specific: { emoji: "🚩", label: "Specific",  prefix: "Sp : " },
    more:     { emoji: "➕", label: "More",      prefix: "Mr : " },
  },

  // ------------------------------------------
  // Kunci localStorage
  // ------------------------------------------
  STORAGE_KEYS: {
    ROLE:      "mm_role",
    CODENAME:  "mm_codename",
    CODE:      "mm_code",
    FAVORITES: "mm_favorites",
  },

  // ------------------------------------------
  // Debug mode
  // Set true untuk lihat log di console
  // ------------------------------------------
  DEBUG: false,
};

// ============================================
// LOG HELPER (hanya muncul kalau DEBUG=true)
// ============================================

function mmLog(...args) {
  if (MM_CONFIG.DEBUG) {
    console.log("[MM]", ...args);
  }
}

function mmError(...args) {
  console.error("[MM ERROR]", ...args);
}

// ============================================
// CEK KONFIGURASI
// ============================================

function isConfigReady() {
  return MM_CONFIG.API_URL && MM_CONFIG.API_URL.startsWith("https://");
}