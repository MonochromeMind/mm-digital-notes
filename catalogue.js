// ============================================
// PAGES/CATALOGUE.JS
// Logika lengkap halaman Catalogue + Custom List
// ============================================

// --------------------------------------------
// STATE
// --------------------------------------------
let allSheets = [];
let allBooks = [];
let allChapters = [];
let currentMode = "notes";
let currentView = "sheets";
let currentFilter = "";
let currentSort = "date-desc";
let currentSearch = "";
let currentRole = null;
let currentCodename = null;
let pendingDelete = null;
let pendingHelperSheetId = null;
let pendingHelperList = [];
let pendingAddToList = null;  // { type: "sheet"|"book", id }
let pendingRemoveFromList = null; // { listId, itemId }
let pendingDeleteList = null; // listId
let currentOpenListId = null;

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
// FETCH DATA
// --------------------------------------------

async function fetchSheets() {
  try {
    const res = await callAPI("list_sheets");
    allSheets = res.data || [];
  } catch (err) {
    mmError("Gagal load sheets:", err.message);
    allSheets = [];
  }
}

async function fetchBooks() {
  try {
    const res = await callAPI("list_books");
    allBooks = res.data || [];
  } catch (err) {
    mmError("Gagal load books:", err.message);
    allBooks = [];
  }
}

async function fetchChapters() {
  try {
    const res = await callAPI("list_chapters");
    allChapters = res.data || [];
  } catch (err) {
    mmError("Gagal load chapters:", err.message);
    allChapters = [];
  }
}

async function fetchAll() {
  await Promise.all([fetchSheets(), fetchBooks(), fetchChapters()]);
}

// ============================================
// CUSTOM LIST — STORAGE
// ============================================

const CL_MAX_LISTS = 100;
const CL_MAX_ITEMS = 100;

function getCLKey(type) {
  return type === "sheet" ? "mm_custom_lists_sheet" : "mm_custom_lists_book";
}

function getCustomLists(type) {
  try {
    const raw = localStorage.getItem(getCLKey(type));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomLists(type, lists) {
  localStorage.setItem(getCLKey(type), JSON.stringify(lists));
}

function getListById(type, listId) {
  return getCustomLists(type).find((l) => l.id === listId) || null;
}

// ============================================
// CUSTOM LIST — MODAL DAFTAR
// ============================================

function openCustomListModal() {
  const type = currentMode === "notes" ? "sheet" : "book";
  const title = currentMode === "notes"
    ? "📁 Custom List — Sheet"
    : "📁 Custom List — Digital Books";

  document.getElementById("customListTitle").textContent = title;
  document.getElementById("customListSearch").value = "";

  renderCustomListDaftar(type);
  openModal("modal-custom-list");
}

function renderCustomListDaftar(type, searchQuery = "") {
  const container = document.getElementById("customListContainer");
  const lists = getCustomLists(type);

  let filtered = lists;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = lists.filter((l) => l.name.toLowerCase().includes(q));
  }

  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `<p class="custom-list-empty">${searchQuery ? "Tidak ada list yang cocok." : "Belum ada list. Klik \"Buat List Baru\" untuk mulai."}</p>`;
    return;
  }

  filtered.forEach((list) => {
    const item = document.createElement("div");
    item.className = "custom-list-item";
    item.innerHTML = `
      <div class="custom-list-item__info">
        <span class="custom-list-item__name">📁 ${escapeHTML(list.name)}</span>
        <span class="custom-list-item__meta">${list.items.length} item</span>
      </div>
      <div class="custom-list-item__actions">
        <button class="custom-list-item__btn" data-action="open-list" data-id="${list.id}" title="Buka">→</button>
        <button class="custom-list-item__btn custom-list-item__btn--danger" data-action="delete-list" data-id="${list.id}" title="Hapus list">✕</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function initCustomListEvents() {
  // Tombol utama Custom List
  document.getElementById("btnCustomList")?.addEventListener("click", () => {
    openCustomListModal();
  });

  // Search list
  document.getElementById("customListSearch")?.addEventListener("input", (e) => {
    const type = currentMode === "notes" ? "sheet" : "book";
    renderCustomListDaftar(type, e.target.value.trim());
  });

  // Tombol buat list baru
  document.getElementById("btnNewList")?.addEventListener("click", () => {
    const type = currentMode === "notes" ? "sheet" : "book";
    const lists = getCustomLists(type);
    if (lists.length >= CL_MAX_LISTS) {
      showToast(`Maksimal ${CL_MAX_LISTS} list. Hapus beberapa list dulu.`, "error");
      return;
    }
    document.getElementById("new-list-name").value = "";
    document.getElementById("new-list-error").hidden = true;
    openModal("modal-new-list");
  });

  // Submit buat list baru
  document.getElementById("form-new-list")?.addEventListener("submit", handleNewList);

  // Tombol kembali dari buka list
  document.getElementById("btnBackToList")?.addEventListener("click", () => {
    closeModal("modal-open-list");
    openCustomListModal();
  });

  // Delegasi klik di container list
  document.getElementById("customListContainer")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const type = currentMode === "notes" ? "sheet" : "book";

    if (action === "open-list") openList(type, id);
    else if (action === "delete-list") askDeleteList(id);
  });

  // Konfirmasi hapus list
  document.getElementById("btnConfirmDeleteList")?.addEventListener("click", confirmDeleteList);

  // Konfirmasi hapus item dari list
  document.getElementById("btnConfirmRemove")?.addEventListener("click", confirmRemoveFromList);
}

function handleNewList(event) {
  event.preventDefault();
  const type = currentMode === "notes" ? "sheet" : "book";
  const name = document.getElementById("new-list-name").value.trim();
  const errorEl = document.getElementById("new-list-error");

  errorEl.hidden = true;

  if (!name) {
    errorEl.textContent = "Nama list wajib diisi";
    errorEl.hidden = false;
    return;
  }

  const lists = getCustomLists(type);
  if (lists.length >= CL_MAX_LISTS) {
    errorEl.textContent = `Maksimal ${CL_MAX_LISTS} list. Hapus beberapa list dulu.`;
    errorEl.hidden = false;
    return;
  }

  if (lists.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
    errorEl.textContent = "Nama list sudah dipakai";
    errorEl.hidden = false;
    return;
  }

  const newList = {
    id: "list-" + Date.now(),
    name,
    items: [],
    created_at: new Date().toISOString(),
  };

  lists.push(newList);
  saveCustomLists(type, lists);

  closeModal("modal-new-list");
  showToast("List berhasil dibuat", "success");
  renderCustomListDaftar(type);
}

// ============================================
// CUSTOM LIST — BUKA LIST
// ============================================

function openList(type, listId) {
  const list = getListById(type, listId);
  if (!list) return;

  currentOpenListId = listId;

  document.getElementById("openListTitle").textContent = "📁 " + list.name;
  document.getElementById("openListCount").textContent = `${list.items.length} item`;

  renderOpenList(type, list);
  closeModal("modal-custom-list");
  openModal("modal-open-list");
}

function renderOpenList(type, list) {
  const container = document.getElementById("openListContainer");
  container.innerHTML = "";

  if (list.items.length === 0) {
    container.innerHTML = `<p class="custom-list-empty">List kosong. Tambah item dari katalog.</p>`;
    return;
  }

  list.items.forEach((itemId) => {
    const data = type === "sheet"
      ? allSheets.find((s) => s.id === itemId)
      : allBooks.find((b) => b.id === itemId);

    if (!data) {
      // Item mungkin sudah dihapus dari database
      const item = document.createElement("div");
      item.className = "custom-list-item";
      item.innerHTML = `
        <div class="custom-list-item__info">
          <span class="custom-list-item__name">⚠️ Item tidak ditemukan</span>
          <span class="custom-list-item__meta">Mungkin sudah dihapus</span>
        </div>
        <div class="custom-list-item__actions">
          <button class="custom-list-item__btn custom-list-item__btn--danger" data-action="remove-from-list" data-id="${itemId}" title="Hapus dari list">✕</button>
        </div>
      `;
      container.appendChild(item);
      return;
    }

    const item = document.createElement("div");
    item.className = "custom-list-item";

    if (type === "sheet") {
      item.innerHTML = `
        <div class="custom-list-item__info">
          <span class="custom-list-item__name">${escapeHTML(data.header)}</span>
          <span class="custom-list-item__meta">${data.id_number} · ${data.sheet_type}</span>
        </div>
        <div class="custom-list-item__actions">
          ${data.gdrive_link ? `<a href="${escapeHTML(data.gdrive_link)}" target="_blank" rel="noopener" class="custom-list-item__btn" title="Buka">📖</a>` : ""}
          <button class="custom-list-item__btn custom-list-item__btn--danger" data-action="remove-from-list" data-id="${itemId}" title="Hapus dari list">✕</button>
        </div>
      `;
    } else {
      item.innerHTML = `
        <div class="custom-list-item__info">
          <span class="custom-list-item__name">${escapeHTML(data.title)}</span>
          <span class="custom-list-item__meta">${data.author || "—"}${data.year ? " · " + data.year : ""}</span>
        </div>
        <div class="custom-list-item__actions">
          <a href="${escapeHTML(data.gdrive_link)}" target="_blank" rel="noopener" class="custom-list-item__btn" title="Buka">📖</a>
          <button class="custom-list-item__btn custom-list-item__btn--danger" data-action="remove-from-list" data-id="${itemId}" title="Hapus dari list">✕</button>
        </div>
      `;
    }

    container.appendChild(item);
  });

  // Delegasi hapus item
  container.onclick = (e) => {
    const btn = e.target.closest('[data-action="remove-from-list"]');
    if (btn) {
      askRemoveFromList(currentOpenListId, parseInt(btn.dataset.id));
    }
  };
}

// ============================================
// CUSTOM LIST — TAMBAH ITEM
// ============================================

function openAddToListModal(type, itemId) {
  pendingAddToList = { type, id: itemId };

  const item = type === "sheet"
    ? allSheets.find((s) => s.id === itemId)
    : allBooks.find((b) => b.id === itemId);

  const label = type === "sheet" ? (item?.header || "Item") : (item?.title || "Item");
  document.getElementById("addToListItemName").textContent = label;

  renderAddToList(type, itemId);
  openModal("modal-add-to-list");
}

function renderAddToList(type, itemId) {
  const container = document.getElementById("addToListContainer");
  const lists = getCustomLists(type);

  container.innerHTML = "";

  if (lists.length === 0) {
    container.innerHTML = `<p class="custom-list-empty">Belum ada list. Buat list dulu dari menu Custom List.</p>`;
    return;
  }

  lists.forEach((list) => {
    const alreadyHas = list.items.includes(itemId);
    const isFull = list.items.length >= CL_MAX_ITEMS;

    const row = document.createElement("div");
    row.className = "custom-list-row";
    if (alreadyHas || isFull) row.classList.add("is-disabled");

    row.innerHTML = `
      <div class="custom-list-row__info">
        <span class="custom-list-row__name">📁 ${escapeHTML(list.name)}</span>
        <span class="custom-list-row__count">${list.items.length}/${CL_MAX_ITEMS}${alreadyHas ? " · sudah ada" : ""}${isFull && !alreadyHas ? " · penuh" : ""}</span>
      </div>
      ${alreadyHas || isFull ? "" : `<button class="custom-list-row__btn" data-list-id="${list.id}" title="Tambahkan">+</button>`}
    `;

    if (!alreadyHas && !isFull) {
      row.querySelector(".custom-list-row__btn")?.addEventListener("click", () => {
        addItemToList(type, list.id, itemId);
      });
    }

    container.appendChild(row);
  });
}

function addItemToList(type, listId, itemId) {
  const lists = getCustomLists(type);
  const list = lists.find((l) => l.id === listId);
  if (!list) return;

  if (list.items.length >= CL_MAX_ITEMS) {
    showToast(`List ini sudah penuh (${CL_MAX_ITEMS} item). Hapus beberapa item dulu.`, "error");
    return;
  }

  if (list.items.includes(itemId)) {
    showToast("Item sudah ada di list ini", "error");
    return;
  }

  list.items.push(itemId);
  saveCustomLists(type, lists);

  showToast("Ditambahkan ke list", "success");
  closeModal("modal-add-to-list");
  pendingAddToList = null;
}

// ============================================
// CUSTOM LIST — HAPUS ITEM & LIST
// ============================================

function askRemoveFromList(listId, itemId) {
  pendingRemoveFromList = { listId, itemId };
  document.getElementById("confirm-remove-text").textContent =
    "Item ini akan dihapus dari list. (Data asli tidak terpengaruh)";
  openModal("modal-confirm-remove-item");
}

function confirmRemoveFromList() {
  if (!pendingRemoveFromList) return;

  const type = currentMode === "notes" ? "sheet" : "book";
  const { listId, itemId } = pendingRemoveFromList;

  const lists = getCustomLists(type);
  const list = lists.find((l) => l.id === listId);
  if (list) {
    list.items = list.items.filter((id) => id !== itemId);
    saveCustomLists(type, lists);
  }

  closeModal("modal-confirm-remove-item");
  pendingRemoveFromList = null;
  showToast("Item dihapus dari list", "success");

  // Refresh tampilan
  const updatedList = getListById(type, listId);
  if (updatedList) {
    document.getElementById("openListCount").textContent = `${updatedList.items.length} item`;
    renderOpenList(type, updatedList);
  }
}

function askDeleteList(listId) {
  pendingDeleteList = listId;
  const type = currentMode === "notes" ? "sheet" : "book";
  const list = getListById(type, listId);
  document.getElementById("confirm-delete-list-text").textContent =
    `List "${list?.name || ""}" akan dihapus permanen.`;
  openModal("modal-confirm-delete-list");
}

function confirmDeleteList() {
  if (!pendingDeleteList) return;

  const type = currentMode === "notes" ? "sheet" : "book";
  let lists = getCustomLists(type);
  lists = lists.filter((l) => l.id !== pendingDeleteList);
  saveCustomLists(type, lists);

  closeModal("modal-confirm-delete-list");
  pendingDeleteList = null;
  showToast("List dihapus", "success");
  renderCustomListDaftar(type);
}

// ============================================
// RENDER KARTU
// ============================================

function createSheetCard(sheet) {
  const typeInfo = MM_CONFIG.SHEET_TYPES[sheet.sheet_type] || {};
  const emoji = typeInfo.emoji || "📄";
  const label = typeInfo.label || sheet.sheet_type;

  let category = "—";
  if (sheet.fields?.branches) {
    const branch = sheet.fields.branches;
    category = branch.disciplines?.name || branch.name;
  }

  const chapterName = sheet.chapters?.name || "";

  const card = document.createElement("article");
  card.className = "card";
  card.dataset.type = sheet.sheet_type;
  card.dataset.id = sheet.id;

  card.innerHTML = `
    <div class="card__top">
      <span class="card__id">${escapeHTML(sheet.id_number)}</span>
      ${
        isAdmin()
          ? `
        <div class="card__actions">
          <button class="card__action" data-action="edit-sheet" title="Edit">✏️</button>
          ${
            isDeveloper() || sheet.creator_mark === currentCodename
              ? `<button class="card__action card__action--danger" data-action="delete-sheet" title="Hapus">🗑️</button>`
              : ""
          }
        </div>
      `
          : ""
      }
    </div>
    <h3 class="card__header">${escapeHTML(sheet.header)}</h3>
    <div class="card__meta">
      <span class="card__type">${emoji} ${escapeHTML(label)}</span>
      ${category !== "—" ? `<span class="card__category">· ${escapeHTML(category)}</span>` : ""}
      ${chapterName ? `<span class="card__category">· 📖 ${escapeHTML(chapterName)}</span>` : ""}
    </div>
    ${sheet.description ? `<p class="card__desc">${escapeHTML(sheet.description)}</p>` : ""}
    <span class="card__date">${formatDate(sheet.created_at)}</span>
    ${sheet.gdrive_link ? `<a href="${escapeHTML(sheet.gdrive_link)}" target="_blank" rel="noopener" class="card__link">📖 Buka →</a>` : ""}
    <button class="card__add-to-list" data-action="add-to-list" data-id="${sheet.id}">➕ Tambah ke List</button>
  `;

  return card;
}

function createBookCard(book) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.type = "book-digital";
  card.dataset.id = book.id;

  card.innerHTML = `
    <div class="card__top">
      <span class="card__id">📚 Buku Digital</span>
      ${
        isAdmin()
          ? `
        <div class="card__actions">
          <button class="card__action" data-action="edit-book" title="Edit">✏️</button>
          ${
            isDeveloper() || book.creator_mark === currentCodename
              ? `<button class="card__action card__action--danger" data-action="delete-book" title="Hapus">🗑️</button>`
              : ""
          }
        </div>
      `
          : ""
      }
    </div>
    <h3 class="card__header">${escapeHTML(book.title)}</h3>
    <div class="card__meta">
      ${book.author ? `<span>${escapeHTML(book.author)}</span>` : ""}
      ${book.year ? `<span>· ${book.year}</span>` : ""}
      ${book.topic ? `<span>· ${escapeHTML(book.topic)}</span>` : ""}
    </div>
    <a href="${escapeHTML(book.gdrive_link)}" target="_blank" rel="noopener" class="card__link">📖 Buka →</a>
    <button class="card__add-to-list" data-action="add-to-list" data-id="${book.id}">➕ Tambah ke List</button>
  `;

  return card;
}

function createChapterCard(chapter) {
  const sheetCount = allSheets.filter((s) => s.chapter_id === chapter.id).length;

  let category = "—";
  if (chapter.fields?.branches) {
    const branch = chapter.fields.branches;
    category = branch.disciplines?.name || branch.name;
  }

  const card = document.createElement("article");
  card.className = "card";
  card.dataset.type = "chapter";
  card.dataset.id = chapter.id;

  card.innerHTML = `
    <div class="card__top">
      <span class="card__id">📖 Chapter</span>
    </div>
    <h3 class="card__header">${escapeHTML(chapter.name)}</h3>
    <div class="card__meta">
      <span class="card__category">${sheetCount} Sheet</span>
      ${category !== "—" ? `<span class="card__category">· ${escapeHTML(category)}</span>` : ""}
    </div>
  `;

  return card;
}

// --------------------------------------------
// RENDER CATALOGUE
// --------------------------------------------

function renderCatalogue() {
  const container = document.getElementById("catalogue");
  if (!container) return;

  container.innerHTML = "";

  if (currentMode === "notes") {
    renderNotesCatalogue(container);
  } else {
    renderBooksCatalogue(container);
  }
}

function renderNotesCatalogue(container) {
  if (currentView === "chapters") {
    let chapters = [...allChapters];

    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      chapters = chapters.filter((c) => c.name.toLowerCase().includes(q));
    }

    chapters.sort((a, b) => a.name.localeCompare(b.name));

    if (chapters.length === 0) {
      container.innerHTML = `<p class="catalogue__empty">Belum ada chapter.</p>`;
      return;
    }

    chapters.forEach((c) => container.appendChild(createChapterCard(c)));
    return;
  }

  let sheets = [...allSheets];

  if (currentFilter) {
    sheets = sheets.filter((s) => s.sheet_type === currentFilter);
  }

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    sheets = sheets.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.header?.toLowerCase().includes(q) ||
        s.id_number?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
    );
  }

  sheets = sortItems(sheets, "title", "created_at");

  if (sheets.length === 0) {
    const msg = currentSearch || currentFilter ? "Tidak ada yang cocok." : "Belum ada sheet.";
    container.innerHTML = `<p class="catalogue__empty">${msg}</p>`;
    return;
  }

  sheets.forEach((s) => container.appendChild(createSheetCard(s)));
}

function renderBooksCatalogue(container) {
  let books = [...allBooks];

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    books = books.filter(
      (b) =>
        b.title?.toLowerCase().includes(q) ||
        b.author?.toLowerCase().includes(q) ||
        b.topic?.toLowerCase().includes(q)
    );
  }

  books = sortItems(books, "title", "created_at");

  if (books.length === 0) {
    const msg = currentSearch ? "Tidak ada yang cocok." : "Belum ada buku.";
    container.innerHTML = `<p class="catalogue__empty">${msg}</p>`;
    return;
  }

  books.forEach((b) => container.appendChild(createBookCard(b)));
}

function sortItems(items, nameKey, dateKey) {
  const sorted = [...items];

  switch (currentSort) {
    case "date-desc":
      sorted.sort((a, b) => new Date(b[dateKey] || 0) - new Date(a[dateKey] || 0));
      break;
    case "date-asc":
      sorted.sort((a, b) => new Date(a[dateKey] || 0) - new Date(b[dateKey] || 0));
      break;
    case "name-asc":
      sorted.sort((a, b) => (a[nameKey] || "").localeCompare(b[nameKey] || ""));
      break;
    case "name-desc":
      sorted.sort((a, b) => (b[nameKey] || "").localeCompare(a[nameKey] || ""));
      break;
    default:
      sorted.sort(() => Math.random() - 0.5);
  }

  return sorted;
}

// --------------------------------------------
// TOGGLE MODE & VIEW
// --------------------------------------------

function initCatalogueToggle() {
  const toggle = document.getElementById("catalogueToggle");
  if (!toggle) return;

  toggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-btn");
    if (!btn) return;

    toggle.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    currentMode = btn.dataset.mode;
    currentFilter = "";
    currentSearch = "";

    const filterType = document.getElementById("filterType");
    if (filterType) filterType.value = "";

    updateFilterVisibility();

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.placeholder = currentMode === "notes" ? "🔍 Cari sheet..." : "🔍 Cari buku...";
      searchInput.value = "";
    }

    renderCatalogue();
  });
}

function updateFilterVisibility() {
  const filterType = document.getElementById("filterType");
  const filterViewToggle = document.getElementById("filterViewToggle");

  if (currentMode === "notes") {
    if (filterType) filterType.hidden = false;
    if (filterViewToggle) filterViewToggle.hidden = false;
  } else {
    if (filterType) filterType.hidden = true;
    if (filterViewToggle) filterViewToggle.hidden = true;
  }
}

function initViewToggle() {
  const toggle = document.getElementById("filterViewToggle");
  if (!toggle) return;

  toggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-sm");
    if (!btn) return;

    toggle.querySelectorAll(".toggle-sm").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    currentView = btn.dataset.view;
    renderCatalogue();
  });
}

// --------------------------------------------
// SEARCH & FILTER
// --------------------------------------------

function initSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;

  let debounceTimer;
  input.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentSearch = e.target.value.trim();
      renderCatalogue();
    }, 200);
  });
}

function initFilters() {
  const sortSelect = document.getElementById("filterSort");
  const typeSelect = document.getElementById("filterType");

  sortSelect?.addEventListener("change", (e) => {
    currentSort = e.target.value;
    renderCatalogue();
  });

  typeSelect?.addEventListener("change", (e) => {
    currentFilter = e.target.value;
    renderCatalogue();
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
    renderCatalogue();
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
  renderCatalogue();
  showToast("Berhasil keluar", "success");
  closeSidebar();
}

// --------------------------------------------
// UI ROLE
// --------------------------------------------

function updateUIForRole() {
  const badge = document.getElementById("roleBadge");
  const adminActions = document.getElementById("adminActions");
  const profileBtn = document.getElementById("btnProfile");
  const btnAdd = document.getElementById("btnAdd");

  if (isLoggedIn()) {
    if (badge) {
      badge.textContent = currentCodename;
      badge.classList.add("is-visible");
    }
    if (adminActions) adminActions.hidden = !isAdmin();
    if (profileBtn) {
      profileBtn.textContent = "×";
      profileBtn.title = "Keluar";
    }
    if (btnAdd) {
      btnAdd.textContent = currentMode === "notes" ? "➕ Tambah Sheet" : "📚 Tambah Buku";
    }
  } else {
    if (badge) {
      badge.textContent = "";
      badge.classList.remove("is-visible");
    }
    if (adminActions) adminActions.hidden = true;
    if (profileBtn) {
      profileBtn.textContent = "👤";
      profileBtn.title = "Masuk";
    }
  }
}

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
// ADMIN ACTIONS
// --------------------------------------------

function initAdminActions() {
  const btnAdd = document.getElementById("btnAdd");
  if (!btnAdd) return;

  btnAdd.addEventListener("click", () => {
    if (currentMode === "notes") openAddSheetModal();
    else openAddBookModal();
  });
}

function openAddSheetModal() {
  document.getElementById("form-add-sheet").reset();
  document.getElementById("add-sheet-error").hidden = true;
  document.getElementById("add-header-preview").textContent = "";
  document.getElementById("add-desc-count").textContent = "0";
  document.getElementById("group-discipline").hidden = true;
  document.getElementById("group-tier2-name").hidden = true;
  document.getElementById("group-field").hidden = true;
  document.getElementById("group-new-chapter").hidden = true;
  document.getElementById("add-relations-container").innerHTML = "";
  document.getElementById("add-id-manual").disabled = true;

  populateChapterDropdown("add-chapter-select");
  populateDisciplineDatalist();
  openModal("modal-add-sheet");
}

function openAddBookModal() {
  document.getElementById("form-add-book").reset();
  document.getElementById("add-book-error").hidden = true;
  openModal("modal-add-book");
}

// --------------------------------------------
// HEADER PREVIEW
// --------------------------------------------

const TYPE_PREFIXES = {
  book: "", target: "Tg : ", pencil: "Pn : ", lamp: "La : ",
  crown: "Cn : ", analyst: "An : ", rocket: "Rc : ", specific: "Sp : ", more: "Mr : ",
};

function buildHeaderPreview(type, title) {
  if (!type || !title) return "";
  const prefix = TYPE_PREFIXES[type] ?? "";
  return `[ ${prefix}${title} ]`;
}

function initHeaderPreview() {
  const titleInput = document.getElementById("add-title");
  const typeSelect = document.getElementById("add-type");
  const preview = document.getElementById("add-header-preview");

  if (titleInput && typeSelect && preview) {
    const update = () => {
      const title = titleInput.value.trim();
      const type = typeSelect.value;
      preview.textContent = buildHeaderPreview(type, title) ? `Header: ${buildHeaderPreview(type, title)}` : "";
    };
    titleInput.addEventListener("input", update);
    typeSelect.addEventListener("change", update);
  }

  const editTitle = document.getElementById("edit-title");
  const editType = document.getElementById("edit-type");
  const editPreview = document.getElementById("edit-header-preview");

  if (editTitle && editType && editPreview) {
    const updateEdit = () => {
      const title = editTitle.value.trim();
      const type = editType.value;
      editPreview.textContent = buildHeaderPreview(type, title) ? `Header: ${buildHeaderPreview(type, title)}` : "";
    };
    editTitle.addEventListener("input", updateEdit);
    editType.addEventListener("change", updateEdit);
  }
}

// --------------------------------------------
// ID MODE, COUNTER, CHAPTER, HIERARCHY, RELATION
// --------------------------------------------

function initIDMode() {
  const form = document.getElementById("form-add-sheet");
  if (!form) return;

  form.querySelectorAll('input[name="add-id-mode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const manual = document.getElementById("add-id-manual");
      manual.disabled = e.target.value !== "manual";
      if (e.target.value === "auto") manual.value = "";
    });
  });
}

function initDescCounter() {
  const addDesc = document.getElementById("add-desc");
  const addCount = document.getElementById("add-desc-count");
  addDesc?.addEventListener("input", () => {
    if (addCount) addCount.textContent = addDesc.value.length;
  });

  const editDesc = document.getElementById("edit-desc");
  const editCount = document.getElementById("edit-desc-count");
  editDesc?.addEventListener("input", () => {
    if (editCount) editCount.textContent = editDesc.value.length;
  });
}

function populateChapterDropdown(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = `
    <option value="">— Tidak ada bab —</option>
    <option value="__new__">+ Tambah Bab Baru</option>
  `;

  allChapters.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
}

function initChapterSelect() {
  const select = document.getElementById("add-chapter-select");
  const groupNew = document.getElementById("group-new-chapter");
  select?.addEventListener("change", (e) => {
    groupNew.hidden = e.target.value !== "__new__";
  });

  const editSelect = document.getElementById("edit-chapter-select");
  const editNew = document.getElementById("edit-chapter-name");
  editSelect?.addEventListener("change", (e) => {
    if (editNew) editNew.hidden = e.target.value !== "__new__";
  });
}

function initHierarchyFields() {
  const typeSelect = document.getElementById("add-tier2-type");
  typeSelect?.addEventListener("change", (e) => {
    const val = e.target.value;
    document.getElementById("group-discipline").hidden = val !== "branch";
    document.getElementById("group-tier2-name").hidden = !val;
    document.getElementById("group-field").hidden = !val;
  });

  const editSelect = document.getElementById("edit-tier2-type");
  editSelect?.addEventListener("change", (e) => {
    const val = e.target.value;
    document.getElementById("edit-group-discipline").hidden = val !== "branch";
    document.getElementById("edit-group-tier2-name").hidden = !val;
    document.getElementById("edit-group-field").hidden = !val;
  });
}

function populateDisciplineDatalist() {
  const datalist = document.getElementById("list-disciplines");
  if (!datalist) return;

  const names = new Set();
  allSheets.forEach((s) => {
    const d = s.fields?.branches?.disciplines?.name;
    if (d) names.add(d);
  });
  allChapters.forEach((c) => {
    const d = c.fields?.branches?.disciplines?.name;
    if (d) names.add(d);
  });

  datalist.innerHTML = "";
  names.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n;
    datalist.appendChild(opt);
  });
}

function addRelationItem() {
  const container = document.getElementById("add-relations-container");
  if (!container) return;

  const item = document.createElement("div");
  item.className = "relation-item";
  item.innerHTML = `
    <div class="relation-item__fields">
      <select class="form__select relation-target">
        <option value="">— Pilih sheet —</option>
        ${allSheets.map((s) => `<option value="${s.id}">${escapeHTML(s.header)}</option>`).join("")}
      </select>
      <select class="form__select relation-type">
        <option value="">— Tipe relasi —</option>
        <option value="learning_path">Learning Path</option>
        <option value="similarity">Similarity</option>
        <option value="influence">Influence</option>
        <option value="contradiction">Contradiction</option>
        <option value="reinforcement">Reinforcement</option>
        <option value="application">Application</option>
      </select>
      <input type="text" class="form__input relation-note" placeholder="Catatan (opsional)">
    </div>
    <button type="button" class="relation-item__remove" title="Hapus relasi">✕</button>
  `;

  item.querySelector(".relation-item__remove").addEventListener("click", () => item.remove());
  container.appendChild(item);
}

function initRelationButton() {
  document.getElementById("btnAddRelation")?.addEventListener("click", addRelationItem);
}

// --------------------------------------------
// SUBMIT: ADD/EDIT SHEET/BOOK
// --------------------------------------------

async function handleAddSheet(event) {
  event.preventDefault();

  const errorEl = document.getElementById("add-sheet-error");
  errorEl.hidden = true;

  const title = document.getElementById("add-title").value.trim();
  const sheet_type = document.getElementById("add-type").value;
  const gdrive_link = document.getElementById("add-link").value.trim();
  const description = document.getElementById("add-desc").value.trim();
  const idMode = document.querySelector('input[name="add-id-mode"]:checked').value;

  if (!title || !sheet_type || !gdrive_link) {
    errorEl.textContent = "Judul, jenis, dan link wajib diisi";
    errorEl.hidden = false;
    return;
  }

  let id_number = null;
  if (idMode === "manual") {
    id_number = document.getElementById("add-id-manual").value.trim();
    if (!id_number) {
      errorEl.textContent = "ID manual wajib diisi";
      errorEl.hidden = false;
      return;
    }
  }

  let chapter_id = null;
  const chapterSel = document.getElementById("add-chapter-select").value;
  if (chapterSel === "__new__") {
    const newName = document.getElementById("add-chapter-name").value.trim();
    if (newName) {
      try {
        const res = await callAPI("add_chapter", { name: newName });
        chapter_id = res.data.id;
      } catch (err) {
        errorEl.textContent = "Gagal tambah chapter: " + err.message;
        errorEl.hidden = false;
        return;
      }
    }
  } else if (chapterSel) {
    chapter_id = parseInt(chapterSel);
  }

  try {
    const payload = { title, sheet_type, gdrive_link, description: description || null, id_number, chapter_id };
    const res = await callAPI("add_sheet", payload);

    closeModal("modal-add-sheet");
    showToast("Sheet berhasil ditambahkan", "success");

    await fetchAll();
    renderCatalogue();

    pendingHelperSheetId = res.data.id;
    pendingHelperList = [];
    openHelperMarkModal();

  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

async function handleAddBook(event) {
  event.preventDefault();

  const errorEl = document.getElementById("add-book-error");
  errorEl.hidden = true;

  const payload = {
    title: document.getElementById("book-title").value.trim(),
    author: document.getElementById("book-author").value.trim() || null,
    year: parseInt(document.getElementById("book-year").value) || null,
    topic: document.getElementById("book-topic").value.trim() || null,
    gdrive_link: document.getElementById("book-link").value.trim(),
  };

  if (!payload.title || !payload.gdrive_link) {
    errorEl.textContent = "Judul dan link wajib diisi";
    errorEl.hidden = false;
    return;
  }

  try {
    await callAPI("add_book", payload);
    closeModal("modal-add-book");
    showToast("Buku berhasil ditambahkan", "success");
    await fetchBooks();
    renderCatalogue();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

// --------------------------------------------
// HELPER MARK
// --------------------------------------------

function openHelperMarkModal() {
  document.getElementById("helper-input").value = "";
  document.getElementById("helper-list").innerHTML = "";
  pendingHelperList = [];
  openModal("modal-helper-mark");
}

function initHelperMark() {
  const input = document.getElementById("helper-input");
  const list = document.getElementById("helper-list");

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;
      pendingHelperList.push(val);
      renderHelperList();
      input.value = "";
    }
  });

  function renderHelperList() {
    list.innerHTML = "";
    pendingHelperList.forEach((name, idx) => {
      const tag = document.createElement("span");
      tag.className = "helper-tag";
      tag.innerHTML = `${escapeHTML(name)} <button type="button" data-idx="${idx}">✕</button>`;
      tag.querySelector("button").addEventListener("click", () => {
        pendingHelperList.splice(idx, 1);
        renderHelperList();
      });
      list.appendChild(tag);
    });
  }

  document.getElementById("btnSkipHelper")?.addEventListener("click", () => {
    closeModal("modal-helper-mark");
    pendingHelperSheetId = null;
    pendingHelperList = [];
  });

  document.getElementById("btnSaveHelper")?.addEventListener("click", async () => {
    if (pendingHelperList.length > 0 && pendingHelperSheetId) {
      try {
        await callAPI("edit_sheet", { id: pendingHelperSheetId, helper_marks: pendingHelperList });
        await fetchSheets();
        renderCatalogue();
      } catch (err) {
        mmError("Helper mark error:", err);
      }
    }
    closeModal("modal-helper-mark");
    pendingHelperSheetId = null;
    pendingHelperList = [];
    showToast("Helper mark tersimpan", "success");
  });
}

// --------------------------------------------
// EDIT SHEET/BOOK
// --------------------------------------------

function openEditSheetModal(id) {
  const sheet = allSheets.find((s) => s.id === id);
  if (!sheet) return;

  document.getElementById("edit-id").value = sheet.id;
  document.getElementById("edit-title").value = sheet.title;
  document.getElementById("edit-type").value = sheet.sheet_type;
  document.getElementById("edit-id-number").value = sheet.id_number;
  document.getElementById("edit-link").value = sheet.gdrive_link || "";
  document.getElementById("edit-desc").value = sheet.description || "";
  document.getElementById("edit-desc-count").textContent = (sheet.description || "").length;
  document.getElementById("edit-revision").value = sheet.revision_code || "";
  document.getElementById("edit-header-preview").textContent = `Header: ${sheet.header}`;
  document.getElementById("edit-sheet-error").hidden = true;

  document.getElementById("edit-info").innerHTML = `Day Created: <strong>${formatDate(sheet.created_at)}</strong> · Creator: <strong>${escapeHTML(sheet.creator_mark)}</strong>`;

  populateChapterDropdown("edit-chapter-select");
  if (sheet.chapter_id) document.getElementById("edit-chapter-select").value = sheet.chapter_id;

  const btnDelete = document.getElementById("btnDeleteSheet");
  if (btnDelete) {
    btnDelete.hidden = !(isDeveloper() || sheet.creator_mark === currentCodename);
  }

  openModal("modal-edit-sheet");
}

async function handleEditSheet(event) {
  event.preventDefault();

  const errorEl = document.getElementById("edit-sheet-error");
  errorEl.hidden = true;

  const id = parseInt(document.getElementById("edit-id").value);
  const title = document.getElementById("edit-title").value.trim();
  const sheet_type = document.getElementById("edit-type").value;
  const id_number = document.getElementById("edit-id-number").value.trim();
  const gdrive_link = document.getElementById("edit-link").value.trim();
  const description = document.getElementById("edit-desc").value.trim();
  const revision_code = document.getElementById("edit-revision").value.trim();

  if (!title || !sheet_type || !id_number || !gdrive_link) {
    errorEl.textContent = "Judul, jenis, ID, dan link wajib diisi";
    errorEl.hidden = false;
    return;
  }

  let chapter_id = null;
  const chapterSel = document.getElementById("edit-chapter-select").value;
  if (chapterSel === "__new__") {
    const newName = document.getElementById("edit-chapter-name").value.trim();
    if (newName) {
      try {
        const res = await callAPI("add_chapter", { name: newName });
        chapter_id = res.data.id;
      } catch (err) {
        errorEl.textContent = "Gagal tambah chapter: " + err.message;
        errorEl.hidden = false;
        return;
      }
    }
  } else if (chapterSel) {
    chapter_id = parseInt(chapterSel);
  }

  try {
    await callAPI("edit_sheet", {
      id, title, sheet_type, id_number, gdrive_link,
      description: description || null,
      revision_code: revision_code || null,
      chapter_id,
    });

    closeModal("modal-edit-sheet");
    showToast("Sheet berhasil diupdate", "success");
    await fetchAll();
    renderCatalogue();

    pendingHelperSheetId = id;
    pendingHelperList = [];
    openHelperMarkModal();

  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

function openEditBookModal(id) {
  const book = allBooks.find((b) => b.id === id);
  if (!book) return;

  document.getElementById("edit-book-id").value = book.id;
  document.getElementById("edit-book-title").value = book.title;
  document.getElementById("edit-book-author").value = book.author || "";
  document.getElementById("edit-book-year").value = book.year || "";
  document.getElementById("edit-book-topic").value = book.topic || "";
  document.getElementById("edit-book-link").value = book.gdrive_link || "";
  document.getElementById("edit-book-error").hidden = true;

  const btnDelete = document.getElementById("btnDeleteBook");
  if (btnDelete) {
    btnDelete.hidden = !(isDeveloper() || book.creator_mark === currentCodename);
  }

  openModal("modal-edit-book");
}

async function handleEditBook(event) {
  event.preventDefault();

  const errorEl = document.getElementById("edit-book-error");
  errorEl.hidden = true;

  const id = parseInt(document.getElementById("edit-book-id").value);
  const payload = {
    id,
    title: document.getElementById("edit-book-title").value.trim(),
    author: document.getElementById("edit-book-author").value.trim() || null,
    year: parseInt(document.getElementById("edit-book-year").value) || null,
    topic: document.getElementById("edit-book-topic").value.trim() || null,
    gdrive_link: document.getElementById("edit-book-link").value.trim(),
  };

  if (!payload.title || !payload.gdrive_link) {
    errorEl.textContent = "Judul dan link wajib diisi";
    errorEl.hidden = false;
    return;
  }

  try {
    await callAPI("edit_book", payload);
    closeModal("modal-edit-book");
    showToast("Buku berhasil diupdate", "success");
    await fetchBooks();
    renderCatalogue();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

// --------------------------------------------
// DELETE
// --------------------------------------------

function openConfirmDelete(type, id) {
  pendingDelete = { type, id };
  document.getElementById("confirm-delete-text").textContent =
    type === "sheet" ? "Sheet ini akan dihapus permanen." : "Buku ini akan dihapus permanen.";
  openModal("modal-confirm-delete");
}

async function handleConfirmDelete() {
  if (!pendingDelete) return;

  try {
    if (pendingDelete.type === "sheet") {
      await callAPI("delete_sheet", { id: pendingDelete.id });
      showToast("Sheet dihapus", "success");
      await fetchAll();
    } else {
      await callAPI("delete_book", { id: pendingDelete.id });
      showToast("Buku dihapus", "success");
      await fetchBooks();
    }

    closeModal("modal-confirm-delete");
    closeModal("modal-edit-sheet");
    closeModal("modal-edit-book");
    renderCatalogue();
  } catch (err) {
    showToast(err.message, "error");
  }

  pendingDelete = null;
}

// --------------------------------------------
// CARD ACTIONS
// --------------------------------------------

function initCardActions() {
  document.addEventListener("click", (e) => {
    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const card = actionBtn.closest(".card");
    const id = card ? parseInt(card.dataset.id) : null;

    if (action === "edit-sheet") openEditSheetModal(id);
    else if (action === "delete-sheet") openConfirmDelete("sheet", id);
    else if (action === "edit-book") openEditBookModal(id);
    else if (action === "delete-book") openConfirmDelete("book", id);
    else if (action === "add-to-list") {
      const type = currentMode === "notes" ? "sheet" : "book";
      openAddToListModal(type, id);
    }
  });
}

// --------------------------------------------
// INIT
// --------------------------------------------

async function initCatalogue() {
  mmLog("Catalogue init");

  const auth = getStoredAuth();
  currentRole = auth.role;
  currentCodename = auth.codename;

  updateUIForRole();
  updateFilterVisibility();

  initCatalogueToggle();
  initViewToggle();
  initSearch();
  initFilters();
  initProfileButton();
  initAdminActions();
  initHeaderPreview();
  initIDMode();
  initDescCounter();
  initChapterSelect();
  initHierarchyFields();
  initRelationButton();
  initHelperMark();
  initCardActions();
  initCustomListEvents();

  document.getElementById("form-login")?.addEventListener("submit", handleLogin);
  document.getElementById("form-add-sheet")?.addEventListener("submit", handleAddSheet);
  document.getElementById("form-add-book")?.addEventListener("submit", handleAddBook);
  document.getElementById("form-edit-sheet")?.addEventListener("submit", handleEditSheet);
  document.getElementById("form-edit-book")?.addEventListener("submit", handleEditBook);
  document.getElementById("btnConfirmDelete")?.addEventListener("click", handleConfirmDelete);

  document.getElementById("btnDeleteSheet")?.addEventListener("click", () => {
    const id = parseInt(document.getElementById("edit-id").value);
    openConfirmDelete("sheet", id);
  });
  document.getElementById("btnDeleteBook")?.addEventListener("click", () => {
    const id = parseInt(document.getElementById("edit-book-id").value);
    openConfirmDelete("book", id);
  });

  if (!isConfigReady()) {
    document.getElementById("catalogue").innerHTML = `<p class="catalogue__empty">⚙️ API_URL belum diisi di <code>js/config.js</code>.</p>`;
    return;
  }

  await fetchAll();
  renderCatalogue();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCatalogue);
} else {
  initCatalogue();
}