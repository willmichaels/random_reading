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
const PRESETS_KEY = "random_wiki_presets";
const CURRENTLY_READING_KEY = "random_wiki_currently_reading";

// Auth state (set when backend is available and user is logged in)
let loggedInUser = null;
let readLogCache = null;
let userLinksCache = null;
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

function addUserLinks(urlInput, displayNameInput) {
  const urlStrings = (urlInput || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const names = (displayNameInput || "")
    .split(",")
    .map((s) => s.trim());

  const links = getUserLinks();
  const added = [];
  for (let i = 0; i < urlStrings.length; i++) {
    const url = normalizeUrl(urlStrings[i]);
    if (!url || links.some((l) => l.url === url) || added.some((a) => a.url === url)) continue;
    const displayName = names[i] || "";
    const title = displayName || deriveTitleFromUrl(url);
    added.push({ url, title, date: new Date().toISOString(), notes: "" });
  }
  if (!added.length) return 0;
  links.push(...added);
  saveUserLinks(links);
  renderUserLinks();
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
  const sources = preset.includeMyLinks ? [...categories, "my_links"] : categories;
  hiddenInput.value = JSON.stringify(sources.length ? sources : ["vital_technology"]);
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
  const wikipediaCategories = selected.filter((c) => c !== "my_links");
  const includeMyLinks = selected.includes("my_links");
  if (!wikipediaCategories.length && !includeMyLinks) {
    alert("Please select at least one source (Wikipedia category or Links) from the dropdown.");
    return;
  }
  const presets = getPresets();
  presets.push({
    name,
    wikipediaCategories,
    includeMyLinks
  });
  savePresets(presets);
  renderPresets();
  closePresetModal();
}

function renderUserLinks() {
  const container = document.getElementById("userLinksList");
  if (!container) return;
  const links = getUserLinks();
  if (!links.length) {
    container.innerHTML = '<p class="my-links-empty">No links yet. Add a URL above.</p>';
    return;
  }
  container.innerHTML = links
    .map(
      (e, i) => `
    <div class="user-link-entry" data-index="${i}">
      <div class="entry-main">
        <span class="entry-title-wrap"><a href="${escapeHtml(e.url)}" target="_blank">${escapeHtml(e.title || e.url)}</a></span>
        <span class="user-link-meta">${escapeHtml(e.date ? formatLogDate(e.date) : "—")}</span>
        <input type="text" class="entry-note" data-index="${i}" placeholder="Add note..." value="${escapeHtml(e.notes || "")}" />
      </div>
      <span class="user-link-actions">
        <span class="user-link-edit" data-index="${i}">Edit</span>
        <span class="user-link-reading" data-index="${i}" data-url="${escapeHtml(e.url)}" data-title="${escapeHtml(e.title || deriveTitleFromUrl(e.url))}">Reading</span>
        <span class="user-link-log" data-index="${i}" data-url="${escapeHtml(e.url)}" data-title="${escapeHtml(e.title || deriveTitleFromUrl(e.url))}">Log</span>
        <span class="user-link-remove" data-index="${i}">Remove</span>
      </span>
    </div>`
    )
    .join("");
  container.querySelectorAll(".user-link-edit").forEach((el) => {
    el.addEventListener("click", () => {
      const entry = el.closest(".user-link-entry");
      const index = Number(el.dataset.index);
      const wrap = entry?.querySelector(".entry-title-wrap");
      const link = wrap?.querySelector("a");
      if (!wrap || !link || index < 0) return;
      const currentTitle = (getUserLinks()[index]?.title || getUserLinks()[index]?.url || "").trim();
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
  container.querySelectorAll(".user-link-reading").forEach((el) => {
    el.addEventListener("click", () => {
      removeUserLink(Number(el.dataset.index));
      addToCurrentlyReading(el.dataset.url, el.dataset.title, "my_links");
    });
  });
  container.querySelectorAll(".user-link-log").forEach((el) => {
    el.addEventListener("click", () => {
      removeUserLink(Number(el.dataset.index));
      logArticle(el.dataset.url, el.dataset.title, "my_links");
    });
  });
  container.querySelectorAll(".user-link-remove").forEach((el) => {
    el.addEventListener("click", () => removeUserLink(Number(el.dataset.index)));
  });
  container.querySelectorAll(".user-link-entry .entry-note").forEach((el) => {
    el.addEventListener("blur", () => updateUserLinkNote(Number(el.dataset.index), el.value));
  });
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
  const wikiCategories = selected.filter((c) => c !== "my_links");
  const includeMyLinks = selected.includes("my_links");
  const resultDiv = document.getElementById("result");

  resultDiv.innerHTML = "Loading...";

  let url = null;
  let title = "";
  let categoryLabel = "";
  let logCategory = "my_links";

  try {
    const userLinks = getUserLinks();
    const hasWiki = wikiCategories.length > 0;
    const hasLinks = includeMyLinks && userLinks.length > 0;

    if (!hasWiki && !hasLinks) {
      resultDiv.innerHTML = "Select at least one source (Wikipedia category or Links) from the dropdown.";
      return;
    }
    if (includeMyLinks && !userLinks.length) {
      resultDiv.innerHTML = "Add some links first in the Links section.";
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
      const pick = userLinks[Math.floor(Math.random() * userLinks.length)];
      url = pick.url;
      title = pick.title || deriveTitleFromUrl(url);
      categoryLabel = "Links";
      logCategory = "my_links";
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
    <div class="meta" style="margin-top: 12px;"><span class="download-link log-article-link" data-url="${escapeHtml(url)}" data-title="${escapeHtml(title)}" data-category="${escapeHtml(logCategory)}">Log</span> &middot; <span class="add-to-currently-reading-link" data-url="${escapeHtml(url)}" data-title="${escapeHtml(title)}" data-category="${escapeHtml(logCategory)}">Reading</span></div>
  `;

  resultDiv.innerHTML = html;

  resultDiv.querySelectorAll(".log-article-link").forEach((el) => {
    el.addEventListener("click", () => {
      logArticle(el.dataset.url, el.dataset.title, el.dataset.category);
    });
  });
  resultDiv.querySelectorAll(".add-to-currently-reading-link").forEach((el) => {
    el.addEventListener("click", () => {
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
  presetsCache = null;
  currentlyReadingCache = null;
  updateAuthUI();
  renderReadLog();
  renderUserLinks();
  renderPresets();
  renderCurrentlyReading();
}

function updateCategoryLabel() {
  const hiddenInput = document.getElementById("categorySelect");
  const labelEl = document.querySelector(".category-trigger-label");
  if (!hiddenInput || !labelEl) return;
  const selected = getSelectedCategories();
  if (selected.length === 0) {
    labelEl.textContent = "Select sources...";
  } else if (selected.length === 1) {
    labelEl.textContent = CATEGORY_LABELS[selected[0]] || selected[0];
  } else {
    labelEl.textContent = `${selected.length} sources`;
  }
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
      syncCategoryPanelFromValue();
      open();
    } else {
      persistSelection();
      close();
    }
  });

  panel.querySelectorAll(".category-option").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const checkbox = el.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        el.classList.toggle("selected", checkbox.checked);
      }
    });
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

// Wire up when DOM ready
document.addEventListener("DOMContentLoaded", () => {
  window.fetchArticle = fetchArticle;
  initCategoryDropdown();
  initAuth();
  function tryAddLink() {
    const urlInput = document.getElementById("newLinkInput");
    const displayNameInput = document.getElementById("newLinkDisplayName");
    const count = addUserLinks(urlInput?.value, displayNameInput?.value);
    if (count > 0) {
      if (urlInput) urlInput.value = "";
      if (displayNameInput) displayNameInput.value = "";
      return true;
    }
    return false;
  }
  document.getElementById("addLinkBtn")?.addEventListener("click", () => {
    if (!tryAddLink()) alert("Please enter at least one valid URL.");
  });
  document.getElementById("newLinkInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!tryAddLink()) alert("Please enter at least one valid URL.");
    }
  });
  document.getElementById("newLinkDisplayName")?.addEventListener("keydown", (e) => {
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
