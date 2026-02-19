/**
 * Random Technical Wiki - Static client-side implementation
 * Fetches Vital Articles and Good Articles via MediaWiki API, parses content.
 */

const VITAL_SOURCES = {
  vital_people: "Wikipedia:Vital_articles/Level/4/People",
  vital_history: "Wikipedia:Vital_articles/Level/4/History",
  vital_geography: "Wikipedia:Vital_articles/Level/4/Geography",
  vital_arts: "Wikipedia:Vital_articles/Level/4/Arts",
  vital_philosophy_religion: "Wikipedia:Vital_articles/Level/4/Philosophy_and_religion",
  vital_everyday_life: "Wikipedia:Vital_articles/Level/4/Everyday_life",
  vital_society_social_sciences: "Wikipedia:Vital_articles/Level/4/Society_and_social_sciences",
  vital_biology_health_sciences: "Wikipedia:Vital_articles/Level/4/Biology_and_health_sciences",
  vital_physical_sciences: "Wikipedia:Vital_articles/Level/4/Physical_sciences",
  vital_technology: "Wikipedia:Vital_articles/Level/4/Technology",
  vital_mathematics: "Wikipedia:Vital_articles/Level/4/Mathematics"
};

const GOOD_SOURCES = {
  "agriculture_food_drink": "Wikipedia:Good_articles/Agriculture,_food_and_drink",
  "art_architecture": "Wikipedia:Good_articles/Art_and_architecture",
  "engineering_technology": "Wikipedia:Good_articles/Engineering_and_technology",
  "geography_places": "Wikipedia:Good_articles/Geography_and_places",
  "history": "Wikipedia:Good_articles/History",
  "language_literature": "Wikipedia:Good_articles/Language_and_literature",
  "mathematics": "Wikipedia:Good_articles/Mathematics",
  "media_drama": "Wikipedia:Good_articles/Media_and_drama",
  "music": "Wikipedia:Good_articles/Music",
  "natural_sciences": "Wikipedia:Good_articles/Natural_sciences",
  "philosophy_religion": "Wikipedia:Good_articles/Philosophy_and_religion",
  "social_sciences_society": "Wikipedia:Good_articles/Social_sciences_and_society",
  "sports_recreation": "Wikipedia:Good_articles/Sports_and_recreation",
  "video_games": "Wikipedia:Good_articles/Video_games",
  "warfare": "Wikipedia:Good_articles/Warfare",
  "all_good": "Wikipedia:Good_articles/all"
};

const CATEGORY_LABELS = {
  vital_people: "People",
  vital_history: "History",
  vital_geography: "Geography",
  vital_arts: "Arts",
  vital_philosophy_religion: "Philosophy and religion",
  vital_everyday_life: "Everyday life",
  vital_society_social_sciences: "Society and social sciences",
  vital_biology_health_sciences: "Biology and health sciences",
  vital_physical_sciences: "Physical sciences",
  vital_technology: "Technology",
  vital_mathematics: "Mathematics",
  agriculture_food_drink: "Agriculture, food and drink",
  art_architecture: "Art and architecture",
  engineering_technology: "Engineering and technology",
  geography_places: "Geography and places",
  history: "History",
  language_literature: "Language and literature",
  mathematics: "Mathematics",
  media_drama: "Media and drama",
  music: "Music",
  natural_sciences: "Natural sciences",
  philosophy_religion: "Philosophy and religion",
  social_sciences_society: "Social sciences and society",
  sports_recreation: "Sports and recreation",
  video_games: "Video games",
  warfare: "Warfare",
  all_good: "All good articles",
  my_links: "Links"
};

const API_BASE = "https://en.wikipedia.org/w/api.php";
const HEADERS = {
  "User-Agent": "RandomTechnicalWiki/1.0 (https://github.com; contact via GitHub)",
  "Api-User-Agent": "RandomTechnicalWiki/1.0 (https://github.com)"
};

// Cache: { category: ["/wiki/Title1", "/wiki/Title2", ...] }
const ARTICLES_CACHE = {};

const READ_LOG_KEY = "random_wiki_read_log";
const USER_LINKS_KEY = "random_wiki_user_links";
const LINK_LISTS_KEY = "random_wiki_link_lists";
const PRESETS_KEY = "random_wiki_presets";
const CURRENTLY_READING_KEY = "random_wiki_currently_reading";

// Which link list sections are expanded (persists across re-renders)
let openLinkListIds = new Set();

// Auth state (set when backend is available and user is logged in)
let loggedInUser = null;
let readLogCache = null;
let userLinksCache = null;
let linkListsCache = null;
let presetsCache = null;
let currentlyReadingCache = null;

const fetchOpts = { credentials: "include" };

async function apiFetch(path, options = {}) {
  const res = await fetch(path, { ...fetchOpts, ...options });
  return res;
}

function getReadLog() {
  if (loggedInUser !== null && readLogCache !== null) {
    return readLogCache;
  }
  try {
    const raw = localStorage.getItem(READ_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReadLog(log) {
  if (loggedInUser !== null) {
    readLogCache = [...log];
    apiFetch("/api/read-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log })
    }).catch((e) => console.error("Failed to sync read log:", e));
    return;
  }
  try {
    localStorage.setItem(READ_LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.error("Failed to save read log:", e);
  }
}

function logArticle(url, title, category) {
  const log = getReadLog();
  const categoryLabel = CATEGORY_LABELS[category] || category;
  const existing = log.findIndex((e) => e.url === url);
  const entry = { title, url, category: categoryLabel, date: new Date().toISOString(), notes: "" };
  if (existing >= 0) {
    entry.notes = log[existing].notes || "";
    log[existing] = entry;
  } else {
    log.unshift(entry);
  }
  saveReadLog(log);
  renderReadLog();
}

function updateLogEntryNote(index, notes) {
  const log = getReadLog();
  if (index < 0 || index >= log.length) return;
  log[index] = { ...log[index], notes: (notes || "").trim() };
  saveReadLog(log);
}

function updateLogEntryTitle(index, title) {
  const log = getReadLog();
  if (index < 0 || index >= log.length) return;
  log[index] = { ...log[index], title: (title || "").trim() };
  saveReadLog(log);
}

function removeFromLog(index) {
  const log = getReadLog();
  log.splice(index, 1);
  saveReadLog(log);
  renderReadLog();
}

// --- Currently reading ---

function getCurrentlyReading() {
  if (loggedInUser !== null && currentlyReadingCache !== null) {
    return currentlyReadingCache;
  }
  try {
    const raw = localStorage.getItem(CURRENTLY_READING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCurrentlyReading(items) {
  if (loggedInUser !== null) {
    currentlyReadingCache = [...items];
    apiFetch("/api/currently-reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    }).catch((e) => console.error("Failed to sync currently reading:", e));
    return;
  }
  try {
    localStorage.setItem(CURRENTLY_READING_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Failed to save currently reading:", e);
  }
}

function addToCurrentlyReading(url, title, category) {
  const items = getCurrentlyReading();
  if (items.some((e) => e.url === url)) return;
  const categoryLabel = category ? (CATEGORY_LABELS[category] || category) : "";
  items.unshift({
    url,
    title: title || deriveTitleFromUrl(url),
    category: categoryLabel,
    categoryKey: category || "my_links",
    date: new Date().toISOString(),
    notes: ""
  });
  saveCurrentlyReading(items);
  renderCurrentlyReading();
}

function removeFromCurrentlyReading(index) {
  const items = getCurrentlyReading();
  items.splice(index, 1);
  saveCurrentlyReading(items);
  renderCurrentlyReading();
}

function renderCurrentlyReading() {
  const container = document.getElementById("currentlyReadingList");
  if (!container) return;
  const items = getCurrentlyReading();
  if (!items.length) {
    container.innerHTML =
      '<p class="currently-reading-empty">Nothing in your reading list. Add articles from Links, the article selector, or the log.</p>';
    return;
  }
  container.innerHTML = items
    .map(
      (e, i) => `
    <div class="currently-reading-entry" data-index="${i}">
      <div class="entry-main">
        <span class="entry-title-wrap"><a href="${escapeHtml(e.url)}" target="_blank">${escapeHtml(e.title)}</a></span>
        <span class="currently-reading-meta">${escapeHtml(e.category || "—")}</span>
      </div>
      <span class="currently-reading-actions">
        <span class="currently-reading-links" data-index="${i}" data-url="${escapeHtml(e.url)}" data-title="${escapeHtml(e.title)}" data-notes="${escapeHtml(e.notes || "")}">Links</span>
        <span class="currently-reading-log" data-index="${i}" data-url="${escapeHtml(e.url)}" data-title="${escapeHtml(e.title)}" data-category-key="${escapeHtml(e.categoryKey || "my_links")}">Log</span>
        <span class="currently-reading-remove" data-index="${i}">Remove</span>
      </span>
    </div>`
    )
    .join("");
  container.querySelectorAll(".currently-reading-links").forEach((el) => {
    el.addEventListener("click", () => {
      removeFromCurrentlyReading(Number(el.dataset.index));
      addUserLink(el.dataset.url, el.dataset.title, el.dataset.notes);
    });
  });
  container.querySelectorAll(".currently-reading-log").forEach((el) => {
    el.addEventListener("click", () => {
      removeFromCurrentlyReading(Number(el.dataset.index));
      logArticle(el.dataset.url, el.dataset.title, el.dataset.categoryKey || "my_links");
    });
  });
  container.querySelectorAll(".currently-reading-remove").forEach((el) => {
    el.addEventListener("click", () => removeFromCurrentlyReading(Number(el.dataset.index)));
  });
}

// --- User links ---

function normalizeUrl(input) {
  let s = (input || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    new URL(s);
    return s;
  } catch {
    return null;
  }
}

function isWikipediaUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes("wikipedia.org") && u.pathname.startsWith("/wiki/");
  } catch {
    return false;
  }
}

function deriveTitleFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("wikipedia.org") && u.pathname.startsWith("/wiki/")) {
      return decodeURIComponent(u.pathname.split("/wiki/")[1] || "").replace(/_/g, " ") || "Untitled";
    }
    const path = u.pathname.replace(/\/+$/, "").split("/").pop() || "";
    const pathDecoded = decodeURIComponent(path);
    return pathDecoded || u.hostname || "Untitled";
  } catch {
    return "Untitled";
  }
}

function getUserLinks() {
  if (loggedInUser !== null && userLinksCache !== null) {
    return userLinksCache;
  }
  try {
    const raw = localStorage.getItem(USER_LINKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUserLinks(links) {
  if (loggedInUser !== null) {
    userLinksCache = [...links];
    apiFetch("/api/user-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links })
    }).catch((e) => console.error("Failed to sync user links:", e));
    return;
  }
  try {
    localStorage.setItem(USER_LINKS_KEY, JSON.stringify(links));
  } catch (e) {
    console.error("Failed to save user links:", e);
  }
}

function addUserLinks(urlInput, listIds = []) {
  const urlStrings = (urlInput || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const links = getUserLinks();
  const added = [];
  for (let i = 0; i < urlStrings.length; i++) {
    const url = normalizeUrl(urlStrings[i]);
    if (!url || links.some((l) => l.url === url) || added.some((a) => a.url === url)) continue;
    const title = deriveTitleFromUrl(url);
    added.push({ url, title, date: new Date().toISOString(), notes: "" });
  }
  if (!added.length) return 0;
  links.push(...added);
  saveUserLinks(links);
  for (const a of added) {
    for (const listId of listIds) {
      addUrlToList(listId, a.url);
    }
  }
  renderUserLinks();
  renderAddLinkLists();
  return added.length;
}

function updateUserLinkNote(index, notes) {
  const links = getUserLinks();
  if (index < 0 || index >= links.length) return;
  links[index] = { ...links[index], notes: (notes || "").trim() };
  saveUserLinks(links);
}

function updateUserLinkTitle(index, title) {
  const links = getUserLinks();
  if (index < 0 || index >= links.length) return;
  const trimmed = (title || "").trim();
  links[index] = { ...links[index], title: trimmed || deriveTitleFromUrl(links[index].url) };
  saveUserLinks(links);
}

function removeUserLink(index) {
  const links = getUserLinks();
  links.splice(index, 1);
  saveUserLinks(links);
  renderUserLinks();
}

function removeUserLinkByUrl(url) {
  const links = getUserLinks();
  const idx = links.findIndex((l) => l.url === url);
  if (idx >= 0) {
    links.splice(idx, 1);
    saveUserLinks(links);
    renderUserLinks();
  }
}

function addUserLink(url, title, notes = "") {
  const links = getUserLinks();
  if (links.some((l) => l.url === url)) return;
  links.unshift({
    url,
    title: title || deriveTitleFromUrl(url),
    date: new Date().toISOString(),
    notes: notes || ""
  });
  saveUserLinks(links);
  renderUserLinks();
}

// --- Link lists ---

function getLinkLists() {
  if (loggedInUser !== null && linkListsCache !== null) {
    return linkListsCache;
  }
  try {
    const raw = localStorage.getItem(LINK_LISTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLinkLists(linkLists) {
  if (loggedInUser !== null) {
    linkListsCache = [...linkLists];
    apiFetch("/api/link-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkLists })
    }).catch((e) => console.error("Failed to sync link lists:", e));
    return;
  }
  try {
    localStorage.setItem(LINK_LISTS_KEY, JSON.stringify(linkLists));
  } catch (e) {
    console.error("Failed to save link lists:", e);
  }
}

function createLinkListId() {
  return "list_" + Math.random().toString(36).slice(2, 11);
}

function addLinkList(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const lists = getLinkLists();
  const list = { id: createLinkListId(), name: trimmed, urls: [] };
  lists.push(list);
  saveLinkLists(lists);
  return list.id;
}

function updateLinkList(listId, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const lists = getLinkLists();
  const idx = lists.findIndex((l) => l.id === listId);
  if (idx < 0) return;
  lists[idx] = { ...lists[idx], name: trimmed };
  saveLinkLists(lists);
}

function deleteLinkList(listId) {
  const lists = getLinkLists().filter((l) => l.id !== listId);
  saveLinkLists(lists);
}

function addUrlToList(listId, url) {
  const lists = getLinkLists();
  const list = lists.find((l) => l.id === listId);
  if (!list || list.urls.includes(url)) return;
  list.urls = [...list.urls, url];
  saveLinkLists(lists);
}

function removeUrlFromList(listId, url) {
  const lists = getLinkLists();
  const list = lists.find((l) => l.id === listId);
  if (!list) return;
  list.urls = list.urls.filter((u) => u !== url);
  saveLinkLists(lists);
}

function toggleUrlInList(listId, url) {
  const lists = getLinkLists();
  const list = lists.find((l) => l.id === listId);
  if (!list) return;
  if (list.urls.includes(url)) {
    list.urls = list.urls.filter((u) => u !== url);
  } else {
    list.urls = [...list.urls, url];
  }
  saveLinkLists(lists);
}

// --- Presets ---

function getPresets() {
  if (loggedInUser !== null && presetsCache !== null) {
    return presetsCache;
  }
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresets(presets) {
  if (loggedInUser !== null) {
    presetsCache = [...presets];
    apiFetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presets })
    }).catch((e) => console.error("Failed to sync presets:", e));
    return;
  }
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error("Failed to save presets:", e);
  }
}

function applyPreset(preset, andFetch = false) {
  const hiddenInput = document.getElementById("categorySelect");
  if (!hiddenInput) return;
  const categories = preset.wikipediaCategories || [];
  let sources = preset.includeMyLinks ? [...categories, "my_links"] : categories;
  const linkListIds = preset.linkListIds || [];
  for (const id of linkListIds) {
    sources.push("linklist:" + id);
  }
  hiddenInput.value = JSON.stringify(sources.length ? sources : ["vital_technology"]);
  renderCategoryPanelLinkLists();
  syncCategoryPanelFromValue();
  updateCategoryLabel();
  if (andFetch) fetchArticle();
}

function renderPresets() {
  const container = document.getElementById("presetsList");
  if (!container) return;
  const presets = getPresets();
  if (!presets.length) {
    container.innerHTML = '<span class="read-log-empty">No presets yet. Save your current selection as a preset.</span>';
    return;
  }
  container.innerHTML = presets
    .map(
      (p, i) =>
        `<span class="preset-chip" data-index="${i}">${escapeHtml(p.name)}<span class="preset-go">Go</span><span class="preset-delete" data-index="${i}">×</span></span>`
    )
    .join("");
  container.querySelectorAll(".preset-chip").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.classList.contains("preset-delete")) {
        e.stopPropagation();
        const idx = Number(e.target.dataset.index);
        const presets = getPresets().filter((_, i) => i !== idx);
        savePresets(presets);
        renderPresets();
        return;
      }
      const preset = getPresets()[Number(el.dataset.index)];
      if (preset) applyPreset(preset, true);
    });
  });
}

function openPresetModal() {
  const modal = document.getElementById("presetModal");
  const nameInput = document.getElementById("presetNameInput");
  if (!modal || !nameInput) return;
  nameInput.value = "";
  modal.classList.add("visible");
  nameInput.focus();
}

function closePresetModal() {
  const modal = document.getElementById("presetModal");
  if (modal) modal.classList.remove("visible");
}

function savePresetFromModal() {
  const nameInput = document.getElementById("presetNameInput");
  const name = (nameInput?.value || "").trim();
  if (!name) {
    alert("Please enter a preset name.");
    return;
  }
  const selected = getSelectedCategories();
  const wikipediaCategories = selected.filter((c) => c !== "my_links" && !c.startsWith("linklist:"));
  const includeMyLinks = selected.includes("my_links");
  const linkListIds = selected.filter((c) => c.startsWith("linklist:")).map((c) => c.slice(9));
  if (!wikipediaCategories.length && !includeMyLinks && !linkListIds.length) {
    alert("Please select at least one source (Wikipedia category, Links, or a link list) from the dropdown.");
    return;
  }
  const presets = getPresets();
  presets.push({
    name,
    wikipediaCategories,
    includeMyLinks,
    linkListIds: linkListIds.length ? linkListIds : undefined
  });
  savePresets(presets);
  renderPresets();
  closePresetModal();
}

function renderAddLinkLists() {
  const container = document.getElementById("addLinkListsContainer");
  if (!container) return;
  const lists = getLinkLists();
  if (!lists.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML =
    '<span class="add-link-lists-label">Add to lists:</span> ' +
    lists
      .map(
        (l) =>
          `<label><input type="checkbox" class="add-link-list-check" data-list-id="${escapeHtml(l.id)}"> ${escapeHtml(l.name)}</label>`
      )
      .join("");
}

function getSelectedAddLinkListIds() {
  return Array.from(document.querySelectorAll(".add-link-list-check:checked")).map(
    (el) => el.dataset.listId
  );
}

function renderLinkEntry(link, index) {
  return `
    <div class="user-link-entry" data-index="${index}" data-url="${escapeHtml(link.url)}">
      <div class="entry-main">
        <span class="entry-title-wrap"><a href="${escapeHtml(link.url)}" target="_blank">${escapeHtml(link.title || link.url)}</a></span>
        <span class="user-link-meta">${escapeHtml(link.date ? formatLogDate(link.date) : "—")}</span>
        <input type="text" class="entry-note" data-index="${index}" placeholder="Add note..." value="${escapeHtml(link.notes || "")}" />
      </div>
      <span class="user-link-actions">
        <span class="user-link-edit" data-index="${index}">Edit</span>
        <span class="user-link-add-to-list" data-url="${escapeHtml(link.url)}">
          <span class="user-link-add-to-list-trigger">Lists</span>
          <div class="user-link-add-to-list-panel"></div>
        </span>
        <span class="user-link-reading" data-index="${index}" data-url="${escapeHtml(link.url)}" data-title="${escapeHtml(link.title || deriveTitleFromUrl(link.url))}">Reading</span>
        <span class="user-link-log" data-index="${index}" data-url="${escapeHtml(link.url)}" data-title="${escapeHtml(link.title || deriveTitleFromUrl(link.url))}">Log</span>
        <span class="user-link-remove" data-index="${index}">Remove</span>
      </span>
    </div>`;
}

function renderUserLinks() {
  const container = document.getElementById("userLinksList");
  if (!container) return;
  const links = getUserLinks();
  const linkLists = getLinkLists();

  if (!links.length) {
    container.innerHTML = '<p class="my-links-empty">No links yet. Add a URL above.</p>';
    renderAddLinkLists();
    return;
  }

  const urlToIndex = new Map();
  links.forEach((l, i) => urlToIndex.set(l.url, i));

  const urlsInAnyList = new Set();
  linkLists.forEach((list) => list.urls.forEach((u) => urlsInAnyList.add(u)));

  // Capture current open state from DOM before replacing (so re-renders preserve it)
  container.querySelectorAll(".link-list-section.open").forEach((s) => {
    const id = s.getAttribute("data-list-id");
    if (id) openLinkListIds.add(id);
  });

  let html = "";
  const openClass = (id) => (openLinkListIds.has(id) ? " link-list-section open" : " link-list-section");

  if (linkLists.length === 0) {
    html = `<div class="${openClass("all").trim()}" data-list-id="all">
      <div class="link-list-header">
        <span>All links</span>
        <span class="link-list-chevron">&#9662;</span>
      </div>
      <div class="link-list-content">${links.map((e, i) => renderLinkEntry(e, i)).join("")}</div>
    </div>`;
  } else {
    for (const list of linkLists) {
      const listLinks = links.filter((l) => list.urls.includes(l.url));
      if (listLinks.length === 0) continue;
      html += `<div class="${openClass(list.id).trim()}" data-list-id="${escapeHtml(list.id)}">
        <div class="link-list-header">
          <span class="link-list-name">${escapeHtml(list.name)}</span>
          <span class="link-list-actions">
            <span class="link-list-rename" data-list-id="${escapeHtml(list.id)}" data-name="${escapeHtml(list.name)}">Rename</span>
            <span class="link-list-delete" data-list-id="${escapeHtml(list.id)}">Delete</span>
          </span>
          <span class="link-list-chevron">&#9662;</span>
        </div>
        <div class="link-list-content">${listLinks.map((e) => renderLinkEntry(e, urlToIndex.get(e.url))).join("")}</div>
      </div>`;
    }
    const unlistedLinks = links.filter((l) => !urlsInAnyList.has(l.url));
    if (unlistedLinks.length > 0) {
      html += `<div class="${openClass("unlisted").trim()}" data-list-id="unlisted">
        <div class="link-list-header">
          <span>Unlisted</span>
          <span class="link-list-chevron">&#9662;</span>
        </div>
        <div class="link-list-content">${unlistedLinks.map((e) => renderLinkEntry(e, urlToIndex.get(e.url))).join("")}</div>
      </div>`;
    }
  }

  container.innerHTML = html;

  container.querySelectorAll(".link-list-header").forEach((h) => {
    h.addEventListener("click", (e) => {
      if (e.target.closest(".link-list-rename") || e.target.closest(".link-list-delete")) return;
      const section = h.closest(".link-list-section");
      if (!section) return;
      const id = section.getAttribute("data-list-id");
      section.classList.toggle("open");
      if (section.classList.contains("open")) openLinkListIds.add(id);
      else openLinkListIds.delete(id);
    });
  });
  container.querySelectorAll(".link-list-rename").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const listId = el.dataset.listId;
      const current = el.dataset.name || "";
      const name = prompt("List name:", current);
      if (name != null && name.trim()) {
        updateLinkList(listId, name.trim());
        renderUserLinks();
        renderCategoryPanelLinkLists();
        renderPresets();
      }
    });
  });
  container.querySelectorAll(".link-list-delete").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Delete this list? Links will remain in your collection.")) {
        deleteLinkList(el.dataset.listId);
        renderUserLinks();
        renderCategoryPanelLinkLists();
        renderPresets();
      }
    });
  });

  container.querySelectorAll(".user-link-edit").forEach((el) => {
    el.addEventListener("click", () => {
      const entry = el.closest(".user-link-entry");
      const index = Number(el.dataset.index);
      const wrap = entry?.querySelector(".entry-title-wrap");
      const link = wrap?.querySelector("a");
      if (!wrap || !link || index < 0) return;
      const linksArr = getUserLinks();
      const currentTitle = (linksArr[index]?.title || linksArr[index]?.url || "").trim();
      const input = document.createElement("input");
      input.type = "text";
      input.className = "entry-title-edit";
      input.value = currentTitle;
      wrap.replaceChild(input, link);
      input.focus();
      input.select();
      const save = () => {
        const val = input.value.trim();
        updateUserLinkTitle(index, val || undefined);
        renderUserLinks();
      };
      input.addEventListener("blur", save);
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          input.blur();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          renderUserLinks();
        }
      });
    });
  });

  container.querySelectorAll(".user-link-add-to-list").forEach((addEl) => {
    const url = addEl.dataset.url;
    const trigger = addEl.querySelector(".user-link-add-to-list-trigger");
    const panel = addEl.querySelector(".user-link-add-to-list-panel");
    const lists = getLinkLists();
    panel.innerHTML = lists
      .map((l) => {
        const inList = l.urls.includes(url);
        return `<label><input type="checkbox" ${inList ? "checked" : ""} data-list-id="${escapeHtml(l.id)}"> ${escapeHtml(l.name)}</label>`;
      })
      .join("");
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      addEl.classList.toggle("open");
    });
    panel.addEventListener("click", (e) => e.stopPropagation());
    panel.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => {
        toggleUrlInList(cb.dataset.listId, url);
        renderUserLinks();
        renderCategoryPanelLinkLists();
      });
    });
  });
  container.querySelectorAll(".user-link-add-to-list").forEach((el) => el.addEventListener("click", (e) => e.stopPropagation()));

  container.querySelectorAll(".user-link-reading").forEach((el) => {
    el.addEventListener("click", () => {
      const index = Number(el.dataset.index);
      removeUserLink(index);
      addToCurrentlyReading(el.dataset.url, el.dataset.title, "my_links");
    });
  });
  container.querySelectorAll(".user-link-log").forEach((el) => {
    el.addEventListener("click", () => {
      const index = Number(el.dataset.index);
      removeUserLink(index);
      logArticle(el.dataset.url, el.dataset.title, "my_links");
    });
  });
  container.querySelectorAll(".user-link-remove").forEach((el) => {
    el.addEventListener("click", () => removeUserLink(Number(el.dataset.index)));
  });
  container.querySelectorAll(".user-link-entry .entry-note").forEach((el) => {
    el.addEventListener("blur", () => updateUserLinkNote(Number(el.dataset.index), el.value));
  });

  renderAddLinkLists();
}

function renderReadLog() {
  const container = document.getElementById("readLogList");
  if (!container) return;
  const log = getReadLog();
  if (!log.length) {
    container.innerHTML = '<p class="read-log-empty">No articles logged yet.</p>';
    return;
  }
  container.innerHTML = log
    .map(
      (e, i) => `
    <div class="read-log-entry" data-index="${i}">
      <div class="entry-main">
        <span class="entry-title-wrap"><a href="${escapeHtml(e.url)}" target="_blank">${escapeHtml(e.title)}</a></span>
        <span class="read-log-meta">${escapeHtml(e.category)} &middot; ${formatLogDate(e.date)}</span>
        <input type="text" class="entry-note" data-index="${i}" placeholder="Add note..." value="${escapeHtml(e.notes || "")}" />
      </div>
      <span class="read-log-actions">
        <span class="read-log-edit" data-index="${i}">Edit</span>
        <span class="read-log-reading" data-index="${i}" data-url="${escapeHtml(e.url)}" data-title="${escapeHtml(e.title)}" data-category-key="${escapeHtml(getCategoryKeyFromLabel(e.category))}">Reading</span>
        <span class="read-log-links" data-index="${i}" data-url="${escapeHtml(e.url)}" data-title="${escapeHtml(e.title)}" data-notes="${escapeHtml(e.notes || "")}">Links</span>
        <span class="read-log-remove" data-index="${i}">Remove</span>
      </span>
    </div>`
    )
    .join("");
  container.querySelectorAll(".read-log-edit").forEach((el) => {
    el.addEventListener("click", () => {
      const entry = el.closest(".read-log-entry");
      const index = Number(el.dataset.index);
      const wrap = entry?.querySelector(".entry-title-wrap");
      const link = wrap?.querySelector("a");
      if (!wrap || !link || index < 0) return;
      const currentTitle = (getReadLog()[index]?.title || "").trim();
      const input = document.createElement("input");
      input.type = "text";
      input.className = "entry-title-edit";
      input.value = currentTitle;
      wrap.replaceChild(input, link);
      input.focus();
      input.select();
      const save = () => {
        const val = input.value.trim();
        updateLogEntryTitle(index, val || currentTitle);
        renderReadLog();
      };
      input.addEventListener("blur", save);
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          input.blur();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          renderReadLog();
        }
      });
    });
  });
  container.querySelectorAll(".read-log-reading").forEach((el) => {
    el.addEventListener("click", () => {
      removeFromLog(Number(el.dataset.index));
      addToCurrentlyReading(el.dataset.url, el.dataset.title, el.dataset.categoryKey);
    });
  });
  container.querySelectorAll(".read-log-links").forEach((el) => {
    el.addEventListener("click", () => {
      removeFromLog(Number(el.dataset.index));
      addUserLink(el.dataset.url, el.dataset.title, el.dataset.notes);
    });
  });
  container.querySelectorAll(".read-log-remove").forEach((el) => {
    el.addEventListener("click", () => removeFromLog(Number(el.dataset.index)));
  });
  container.querySelectorAll(".read-log-entry .entry-note").forEach((el) => {
    el.addEventListener("blur", () => updateLogEntryNote(Number(el.dataset.index), el.value));
  });
}

function formatLogDate(iso) {
  try {
    const d = new Date(iso);
    const dateStr = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    const minStr = String(minutes).padStart(2, "0");
    return `${dateStr}, ${hour12}:${minStr} ${ampm}`;
  } catch {
    return iso;
  }
}

function getPageTitleForCategory(category) {
  return VITAL_SOURCES[category] || GOOD_SOURCES[category] || null;
}

/**
 * Fetch all article links from a Wikipedia list page via MediaWiki API.
 */
async function fetchArticleLinks(category) {
  const pageTitle = getPageTitleForCategory(category);
  if (!pageTitle) return [];

  const allLinks = [];
  let plcontinue = null;

  try {
    do {
      let url = `${API_BASE}?action=query&prop=links&titles=${encodeURIComponent(pageTitle)}&plnamespace=0&pllimit=500&format=json&origin=*`;
      if (plcontinue) url += `&plcontinue=${encodeURIComponent(plcontinue)}`;

      const response = await fetch(url, { headers: HEADERS, mode: "cors" });
      if (!response.ok) {
        console.error("Wikipedia API error:", response.status, response.statusText);
        return [];
      }
      const data = await response.json();
      if (data.error) {
        console.error("Wikipedia API error:", data.error);
        return [];
      }

      const pages = data.query?.pages || {};
      const page = Object.values(pages)[0];
      if (page?.missing !== undefined) {
        console.error("Wikipedia page not found:", pageTitle);
        return [];
      }
      const links = page?.links || [];
      for (const link of links) {
        if (link.ns === 0 && !link.title.includes(":")) {
          allLinks.push("/wiki/" + link.title.replace(/ /g, "_"));
        }
      }

      plcontinue = data.continue?.plcontinue || null;
    } while (plcontinue);
  } catch (err) {
    console.error("Fetch error:", err);
    return [];
  }

  return allLinks;
}

/**
 * Get a random article URL for the given category or categories.
 * categoryOrCategories: string (single) or string[] (multiple)
 */
async function getRandomArticle(categoryOrCategories) {
  const categories = Array.isArray(categoryOrCategories)
    ? categoryOrCategories.filter((c) => getPageTitleForCategory(c))
    : getPageTitleForCategory(categoryOrCategories)
      ? [categoryOrCategories]
      : [];
  if (!categories.length) return null;

  const category = categories[Math.floor(Math.random() * categories.length)];

  if (ARTICLES_CACHE[category]?.length) {
    const href = ARTICLES_CACHE[category][Math.floor(Math.random() * ARTICLES_CACHE[category].length)];
    return "https://en.wikipedia.org" + href;
  }

  const links = await fetchArticleLinks(category);
  if (!links.length) return null;

  ARTICLES_CACHE[category] = links;
  const href = links[Math.floor(Math.random() * links.length)];
  return "https://en.wikipedia.org" + href;
}

function getCategoryKeyFromLabel(label) {
  return Object.keys(CATEGORY_LABELS).find((k) => CATEGORY_LABELS[k] === label) || "my_links";
}

function getSelectedCategories() {
  const raw = document.getElementById("categorySelect")?.value || "[]";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  } catch {
    return raw ? [raw] : [];
  }
}

/**
 * Main: fetch random article and display.
 */
async function fetchArticle() {
  const selected = getSelectedCategories();
  const wikiCategories = selected.filter((c) => c !== "my_links" && !c.startsWith("linklist:"));
  const includeMyLinks = selected.includes("my_links");
  const selectedListIds = selected.filter((c) => c.startsWith("linklist:")).map((c) => c.slice(9));
  const resultDiv = document.getElementById("result");

  resultDiv.innerHTML = "Loading...";

  let url = null;
  let title = "";
  let categoryLabel = "";
  let logCategory = "my_links";
  let isFromLinks = false;

  try {
    const userLinks = getUserLinks();
    const linkLists = getLinkLists();
    const urlToLink = new Map(userLinks.map((l) => [l.url, l]));

    let linkPool = [];
    if (includeMyLinks) linkPool.push(...userLinks);
    for (const listId of selectedListIds) {
      const list = linkLists.find((l) => l.id === listId);
      if (!list) continue;
      for (const u of list.urls) {
        const link = urlToLink.get(u);
        if (link && !linkPool.some((l) => l.url === u)) linkPool.push(link);
      }
    }

    const hasWiki = wikiCategories.length > 0;
    const hasLinks = linkPool.length > 0;

    if (!hasWiki && !hasLinks) {
      resultDiv.innerHTML = "Select at least one source (Wikipedia category, Links, or a link list) from the dropdown. Ensure your link list(s) have links.";
      return;
    }
    if ((includeMyLinks || selectedListIds.length) && !linkPool.length) {
      resultDiv.innerHTML = "Add some links to your Links section (and to the selected list(s) if using link lists).";
      return;
    }

    const useWiki = hasWiki && (!hasLinks || Math.random() < 0.5);

    if (useWiki) {
      const cats = wikiCategories.length ? wikiCategories : ["vital_technology"];
      url = await getRandomArticle(cats);
      if (url) {
        title = url.split("/wiki/")[1].replace(/_/g, " ");
        const cat = cats[0];
        categoryLabel = CATEGORY_LABELS[cat] || cat;
        logCategory = cat;
      }
    } else {
      const pick = linkPool[Math.floor(Math.random() * linkPool.length)];
      url = pick.url;
      title = pick.title || deriveTitleFromUrl(url);
      categoryLabel = "Links";
      logCategory = "my_links";
      isFromLinks = true;
    }
  } catch (err) {
    console.error("fetchArticle error:", err);
    resultDiv.innerHTML = `Failed to fetch article. Check the browser console (F12) for details. If testing locally, try <code>vercel dev</code> or <code>npx serve public</code> instead of opening the file directly.`;
    return;
  }

  if (!url) {
    resultDiv.innerHTML = `Failed to fetch article. Check the browser console (F12) for details.`;
    return;
  }

  let html = `
    <div>Read: <a href="${escapeHtml(url)}" target="_blank">${escapeHtml(title)}</a></div>
    <div class="meta">Category: ${escapeHtml(categoryLabel)}</div>
    <div class="meta" style="margin-top: 12px;"><span class="download-link log-article-link" data-url="${escapeHtml(url)}" data-title="${escapeHtml(title)}" data-category="${escapeHtml(logCategory)}" data-from-links="${isFromLinks}">Log</span> &middot; <span class="add-to-currently-reading-link" data-url="${escapeHtml(url)}" data-title="${escapeHtml(title)}" data-category="${escapeHtml(logCategory)}" data-from-links="${isFromLinks}">Reading</span></div>
  `;

  resultDiv.innerHTML = html;

  resultDiv.querySelectorAll(".log-article-link").forEach((el) => {
    el.addEventListener("click", () => {
      if (el.dataset.fromLinks === "true") {
        removeUserLinkByUrl(el.dataset.url);
      }
      logArticle(el.dataset.url, el.dataset.title, el.dataset.category);
    });
  });
  resultDiv.querySelectorAll(".add-to-currently-reading-link").forEach((el) => {
    el.addEventListener("click", () => {
      if (el.dataset.fromLinks === "true") {
        removeUserLinkByUrl(el.dataset.url);
      }
      addToCurrentlyReading(el.dataset.url, el.dataset.title, el.dataset.category);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Auth ---

function updateAuthUI() {
  const loggedOut = document.getElementById("authLoggedOut");
  const loggedIn = document.getElementById("authLoggedIn");
  const usernameEl = document.getElementById("authUsername");
  if (loggedOut && loggedIn && usernameEl) {
    if (loggedInUser) {
      loggedOut.style.display = "none";
      loggedIn.style.display = "";
      usernameEl.textContent = loggedInUser;
    } else {
      loggedOut.style.display = "";
      loggedIn.style.display = "none";
    }
  }
}

async function initAuth() {
  try {
    const res = await apiFetch("/api/me");
    if (!res.ok) return;
    const data = await res.json();
    if (data.username) {
      loggedInUser = data.username;
      const logRes = await apiFetch("/api/read-log");
      if (logRes.ok) {
        const logData = await logRes.json();
        const serverLog = logData.log || [];
        const localLog = (() => {
          try {
            const raw = localStorage.getItem(READ_LOG_KEY);
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        })();
        if (localLog.length && !serverLog.length) {
          readLogCache = localLog;
          saveReadLog(localLog);
        } else {
          readLogCache = serverLog;
        }
      } else {
        readLogCache = [];
      }
      const linksRes = await apiFetch("/api/user-links");
      if (linksRes.ok) {
        const linksData = await linksRes.json();
        const serverLinks = linksData.links || [];
        const localLinks = (() => {
          try {
            const raw = localStorage.getItem(USER_LINKS_KEY);
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        })();
        if (localLinks.length && !serverLinks.length) {
          userLinksCache = localLinks;
          saveUserLinks(localLinks);
        } else {
          userLinksCache = serverLinks;
        }
      } else {
        userLinksCache = [];
      }
      const linkListsRes = await apiFetch("/api/link-lists");
      if (linkListsRes.ok) {
        const linkListsData = await linkListsRes.json();
        const serverLists = linkListsData.linkLists || [];
        const localLists = (() => {
          try {
            const raw = localStorage.getItem(LINK_LISTS_KEY);
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        })();
        if (localLists.length && !serverLists.length) {
          linkListsCache = localLists;
          saveLinkLists(localLists);
        } else {
          linkListsCache = serverLists;
        }
      } else {
        linkListsCache = [];
      }
      const presetsRes = await apiFetch("/api/presets");
      if (presetsRes.ok) {
        const presetsData = await presetsRes.json();
        const serverPresets = presetsData.presets || [];
        const localPresets = (() => {
          try {
            const raw = localStorage.getItem(PRESETS_KEY);
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        })();
        if (localPresets.length && !serverPresets.length) {
          presetsCache = localPresets;
          savePresets(localPresets);
        } else {
          presetsCache = serverPresets;
        }
      } else {
        presetsCache = [];
      }
      const currentlyReadingRes = await apiFetch("/api/currently-reading");
      if (currentlyReadingRes.ok) {
        const crData = await currentlyReadingRes.json();
        const serverCR = crData.items || [];
        const localCR = (() => {
          try {
            const raw = localStorage.getItem(CURRENTLY_READING_KEY);
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        })();
        if (localCR.length && !serverCR.length) {
          currentlyReadingCache = localCR;
          saveCurrentlyReading(localCR);
        } else {
          currentlyReadingCache = serverCR;
        }
      } else {
        currentlyReadingCache = [];
      }
    }
  } catch {
    // No backend (e.g. static serve)
  }
  updateAuthUI();
  renderReadLog();
  renderUserLinks();
  renderPresets();
  renderCurrentlyReading();
}

function openAuthModal(mode) {
  const modal = document.getElementById("authModal");
  const title = document.getElementById("authModalTitle");
  const submitBtn = document.getElementById("authSubmit");
  const form = document.getElementById("authForm");
  const errorEl = document.getElementById("authError");
  if (!modal || !title || !submitBtn) return;
  errorEl.style.display = "none";
  errorEl.textContent = "";
  form.dataset.mode = mode;
  if (mode === "login") {
    title.textContent = "Log in";
    submitBtn.textContent = "Log in";
  } else {
    title.textContent = "Create account";
    submitBtn.textContent = "Create account";
  }
  modal.classList.add("visible");
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.remove("visible");
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const form = document.getElementById("authForm");
  const usernameInput = document.getElementById("authUsernameInput");
  const passwordInput = document.getElementById("authPasswordInput");
  const errorEl = document.getElementById("authError");
  const submitBtn = document.getElementById("authSubmit");
  const title = document.getElementById("authModalTitle");
  if (!form || !usernameInput || !passwordInput || !errorEl) return;
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const mode = form.dataset.mode || "login";
  errorEl.style.display = "none";
  submitBtn.disabled = true;
  try {
    const path = mode === "login" ? "/api/login" : "/api/register";
    const res = await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    if (mode === "register") {
      if (!res.ok) {
        const noBackend = res.status === 404 || res.status === 0;
        errorEl.textContent = noBackend
          ? "Login requires the backend. Run `vercel dev` or deploy to Vercel."
          : (data.error || "Registration failed");
        errorEl.style.display = "block";
        return;
      }
      const loginRes = await apiFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!loginRes.ok) {
        errorEl.textContent = "Account created. Please log in.";
        errorEl.style.display = "block";
        form.dataset.mode = "login";
        title.textContent = "Log in";
        submitBtn.textContent = "Log in";
        return;
      }
      const loginData = await loginRes.json();
      loggedInUser = loginData.username || username;
      const logRes = await apiFetch("/api/read-log");
      if (logRes.ok) {
        const logData = await logRes.json();
        readLogCache = logData.log || [];
      } else {
        readLogCache = [];
      }
      const linksRes = await apiFetch("/api/user-links");
      if (linksRes.ok) {
        const linksData = await linksRes.json();
        userLinksCache = linksData.links || [];
      } else {
        userLinksCache = [];
      }
      const linkListsRes = await apiFetch("/api/link-lists");
      if (linkListsRes.ok) {
        const linkListsData = await linkListsRes.json();
        linkListsCache = linkListsData.linkLists || [];
      } else {
        linkListsCache = [];
      }
      const presetsRes = await apiFetch("/api/presets");
      if (presetsRes.ok) {
        const presetsData = await presetsRes.json();
        presetsCache = presetsData.presets || [];
      } else {
        presetsCache = [];
      }
      const currentlyReadingRes = await apiFetch("/api/currently-reading");
      if (currentlyReadingRes.ok) {
        const crData = await currentlyReadingRes.json();
        currentlyReadingCache = crData.items || [];
      } else {
        currentlyReadingCache = [];
      }
      closeAuthModal();
      updateAuthUI();
      renderReadLog();
      renderUserLinks();
      renderPresets();
      renderCurrentlyReading();
      return;
    }
    if (!res.ok) {
      const noBackend = res.status === 404 || res.status === 0;
      errorEl.textContent = noBackend
        ? "Login requires the backend. Run `vercel dev` or deploy to Vercel."
        : (data.error || "Login failed");
      errorEl.style.display = "block";
      return;
    }
    loggedInUser = data.username || username;
    const logRes = await apiFetch("/api/read-log");
    if (logRes.ok) {
      const logData = await logRes.json();
      readLogCache = logData.log || [];
    } else {
      readLogCache = [];
    }
    const linksRes = await apiFetch("/api/user-links");
    if (linksRes.ok) {
      const linksData = await linksRes.json();
      userLinksCache = linksData.links || [];
    } else {
      userLinksCache = [];
    }
    const linkListsRes = await apiFetch("/api/link-lists");
    if (linkListsRes.ok) {
      const linkListsData = await linkListsRes.json();
      linkListsCache = linkListsData.linkLists || [];
    } else {
      linkListsCache = [];
    }
    const presetsRes = await apiFetch("/api/presets");
    if (presetsRes.ok) {
      const presetsData = await presetsRes.json();
      presetsCache = presetsData.presets || [];
    } else {
      presetsCache = [];
    }
    const currentlyReadingRes = await apiFetch("/api/currently-reading");
    if (currentlyReadingRes.ok) {
      const crData = await currentlyReadingRes.json();
      currentlyReadingCache = crData.items || [];
    } else {
      currentlyReadingCache = [];
    }
    closeAuthModal();
    updateAuthUI();
    renderReadLog();
    renderUserLinks();
    renderPresets();
    renderCurrentlyReading();
  } catch (err) {
    errorEl.textContent = "Could not connect. Run `vercel dev` or deploy to Vercel.";
    errorEl.style.display = "block";
  } finally {
    submitBtn.disabled = false;
  }
}

async function handleLogout() {
  try {
    await apiFetch("/api/logout", { method: "POST" });
  } catch {
    // ignore
  }
  loggedInUser = null;
  readLogCache = null;
  userLinksCache = null;
  linkListsCache = null;
  presetsCache = null;
  currentlyReadingCache = null;
  updateAuthUI();
  renderReadLog();
  renderUserLinks();
  renderPresets();
  renderCurrentlyReading();
}

function getListNameForCategoryValue(val) {
  if (val && val.startsWith("linklist:")) {
    const id = val.slice(9);
    const list = getLinkLists().find((l) => l.id === id);
    return list ? list.name : val;
  }
  return CATEGORY_LABELS[val] || val;
}

function updateCategoryLabel() {
  const hiddenInput = document.getElementById("categorySelect");
  const labelEl = document.querySelector(".category-trigger-label");
  if (!hiddenInput || !labelEl) return;
  const selected = getSelectedCategories();
  if (selected.length === 0) {
    labelEl.textContent = "Select sources...";
  } else if (selected.length === 1) {
    labelEl.textContent = getListNameForCategoryValue(selected[0]);
  } else {
    labelEl.textContent = `${selected.length} sources`;
  }
}

function renderCategoryPanelLinkLists() {
  const container = document.getElementById("categoryPanelLinkLists");
  const labelEl = document.getElementById("linkListsGroupLabel");
  if (!container || !labelEl) return;
  const lists = getLinkLists();
  if (!lists.length) {
    labelEl.style.display = "none";
    container.innerHTML = "";
    return;
  }
  labelEl.style.display = "block";
  container.innerHTML = lists
    .map(
      (l) =>
        `<label class="category-option" data-value="linklist:${escapeHtml(l.id)}" role="option"><input type="checkbox"> ${escapeHtml(l.name)}</label>`
    )
    .join("");
}

function syncCategoryPanelFromValue() {
  const hiddenInput = document.getElementById("categorySelect");
  const panel = document.getElementById("categoryPanel");
  if (!hiddenInput || !panel) return;
  const selected = getSelectedCategories();
  panel.querySelectorAll(".category-option").forEach((el) => {
    const checkbox = el.querySelector('input[type="checkbox"]');
    const val = el.dataset.value;
    if (checkbox && val) {
      checkbox.checked = selected.includes(val);
      el.classList.toggle("selected", selected.includes(val));
    }
  });
}

// Custom category dropdown (multi-select)
function initCategoryDropdown() {
  const trigger = document.getElementById("categoryTrigger");
  const panel = document.getElementById("categoryPanel");
  const hiddenInput = document.getElementById("categorySelect");
  const labelEl = trigger?.querySelector(".category-trigger-label");
  const doneBtn = document.getElementById("categoryPanelDone");
  if (!trigger || !panel || !hiddenInput || !labelEl) return;

  function close() {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function open() {
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }

  function persistSelection() {
    const selected = [];
    panel.querySelectorAll(".category-option").forEach((el) => {
      const checkbox = el.querySelector('input[type="checkbox"]');
      const val = el.dataset.value;
      if (checkbox?.checked && val) selected.push(val);
    });
    hiddenInput.value = JSON.stringify(selected.length ? selected : ["vital_technology"]);
    updateCategoryLabel();
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (panel.hidden) {
      renderCategoryPanelLinkLists();
      syncCategoryPanelFromValue();
      open();
    } else {
      persistSelection();
      close();
    }
  });

  panel.addEventListener("click", (e) => {
    const opt = e.target.closest(".category-option");
    if (!opt) return;
    e.stopPropagation();
    const checkbox = opt.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = !checkbox.checked;
      opt.classList.toggle("selected", checkbox.checked);
    }
  });

  if (doneBtn) {
    doneBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      persistSelection();
      close();
    });
  }

  document.addEventListener("click", () => {
    if (!panel.hidden) {
      persistSelection();
      close();
    }
  });
  panel.addEventListener("click", (e) => e.stopPropagation());

  updateCategoryLabel();
}

// Close "Add to list" dropdown when clicking outside
document.addEventListener("click", () => {
  document.querySelectorAll(".user-link-add-to-list.open").forEach((el) => el.classList.remove("open"));
});

// Wire up when DOM ready
document.addEventListener("DOMContentLoaded", () => {
  window.fetchArticle = fetchArticle;
  initCategoryDropdown();
  initAuth();
  function tryAddLink() {
    const urlInput = document.getElementById("newLinkInput");
    const listIds = getSelectedAddLinkListIds();
    const count = addUserLinks(urlInput?.value, listIds);
    if (count > 0) {
      if (urlInput) urlInput.value = "";
      document.querySelectorAll(".add-link-list-check:checked").forEach((cb) => { cb.checked = false; });
      return true;
    }
    return false;
  }
  document.getElementById("addListBtn")?.addEventListener("click", () => {
    const input = document.getElementById("newListInput");
    const name = input?.value?.trim();
    if (!name) {
      alert("Please enter a list name.");
      return;
    }
    addLinkList(name);
    if (input) input.value = "";
    renderUserLinks();
    renderCategoryPanelLinkLists();
  });
  document.getElementById("addLinkBtn")?.addEventListener("click", () => {
    if (!tryAddLink()) alert("Please enter at least one valid URL.");
  });
  document.getElementById("collapseAllListsBtn")?.addEventListener("click", () => {
    openLinkListIds.clear();
    const listEl = document.getElementById("userLinksList");
    listEl?.querySelectorAll(".link-list-section.open").forEach((s) => s.classList.remove("open"));
  });
  document.getElementById("newLinkInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!tryAddLink()) alert("Please enter at least one valid URL.");
    }
  });
  document.getElementById("authLoginLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    openAuthModal("login");
  });
  document.getElementById("authRegisterLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    openAuthModal("register");
  });
  document.getElementById("authLogout")?.addEventListener("click", (e) => {
    e.preventDefault();
    handleLogout();
  });
  document.getElementById("authModalClose")?.addEventListener("click", (e) => {
    e.preventDefault();
    closeAuthModal();
  });
  document.getElementById("authForm")?.addEventListener("submit", handleAuthSubmit);
  document.getElementById("authModal")?.addEventListener("click", (e) => {
    if (e.target.id === "authModal") closeAuthModal();
  });
  document.getElementById("savePresetBtn")?.addEventListener("click", () => openPresetModal());
  document.getElementById("presetModalSave")?.addEventListener("click", () => savePresetFromModal());
  document.getElementById("presetModalCancel")?.addEventListener("click", () => closePresetModal());
  document.getElementById("presetNameInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      savePresetFromModal();
    }
  });
  document.getElementById("presetModal")?.addEventListener("click", (e) => {
    if (e.target.id === "presetModal") closePresetModal();
  });
});
