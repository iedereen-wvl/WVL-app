// =======================
// STATE
// =======================
let sounds = [];
let data = {};
let favorites = JSON.parse(localStorage.getItem("fav") || "[]");

let currentTheme = null;
let currentAudio = null;
let activeTab = "themas";
let quizMode = false;

// Volgorde thema's
const THEME_ORDER = [
  "Uitdrukkingen",
  "Uitdrukkingen per regio",
  "Vervoegingen van ja",
  "Maaike Cafmeyer",
  "Huis/Tuin/Keuken",
  "Feestdagen",
  "Het weer",
  "Op restaurant",
  "In de winkel",
  "Dieren",
  "In het caf\u00e9",
  "Op straat",
  "Onderweg",
  "Alles"
];

const REGIO_THEMES = ["Oostende", "Ieper", "Kortrijk", "Brugge", "Roeselare"];

const CATEGORY_MAP = {
  "uitdrukking":    "Uitdrukkingen",
  "uitdrukkingen":  "Uitdrukkingen",
  "uitdruk":        "Uitdrukkingen",
  "vervoeg":        "Vervoegingen van ja",
  "ja":             "Vervoegingen van ja",
  "maaike":         "Maaike Cafmeyer",
  "cafmeyer":       "Maaike Cafmeyer",
  "huis":           "Huis/Tuin/Keuken",
  "tuin":           "Huis/Tuin/Keuken",
  "keuken":         "Huis/Tuin/Keuken",
  "huistuinkeuken": "Huis/Tuin/Keuken",
  "feest":          "Feestdagen",
  "feestdagen":     "Feestdagen",
  "weer":           "Het weer",
  "restaurant":     "Op restaurant",
  "resto":          "Op restaurant",
  "winkel":         "In de winkel",
  "dieren":         "Dieren",
  "dier":           "Dieren",
  "cafe":           "In het caf\u00e9",
  "caf\u00e9":      "In het caf\u00e9",
  "straat":         "Op straat",
  "onderweg":       "Onderweg",
  "oostende":       "Oostende",
  "ieper":          "Ieper",
  "kortrijk":       "Kortrijk",
  "brugge":         "Brugge",
  "roeselare":      "Roeselare",
};

// =======================
// HELPERS
// =======================
function cleanPath(fileName) {
  return ("mp3/" + fileName).replace(/\\/g, "/");
}

function vibrate() {
  if (navigator.vibrate) navigator.vibrate(20);
}

function fixSpacing(text) {
  return String(text).split(" ").map(w => `<span>${w}</span>`).join(" ");
}

function parseCategories(raw) {
  if (!raw) return [];
  return String(raw)
    .replace(/['"]/g, "")
    .split(/[\s,]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function resolveCategory(key) {
  const k = key.toLowerCase().trim();
  if (CATEGORY_MAP[k]) return CATEGORY_MAP[k];
  for (const [pattern, name] of Object.entries(CATEGORY_MAP)) {
    if (k.includes(pattern) || pattern.includes(k)) return name;
  }
  return null;
}

// =======================
// SVG ICONEN
// =======================
function heartSVG(filled) {
  const color = filled ? "#e8192c" : "none";
  const stroke = filled ? "#e8192c" : "#aaa";
  return `<svg class="heart-icon" viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 27 C16 27 2 18 2 9.5 C2 5.36 5.36 2 9.5 2 C12.1 2 14.4 3.3 16 5.3 C17.6 3.3 19.9 2 22.5 2 C26.64 2 30 5.36 30 9.5 C30 18 16 27 16 27Z"
      fill="${color}" stroke="${stroke}" stroke-width="2"/>
  </svg>`;
}

function bookSVG(active) {
  const c = active ? "white" : "#888";
  return `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="3" width="16" height="22" rx="2" stroke="${c}" stroke-width="1.8"/>
    <rect x="8" y="3" width="12" height="22" rx="2" stroke="${c}" stroke-width="1.8" fill="${active ? '#555' : 'none'}"/>
    <line x1="10" y1="9" x2="18" y2="9" stroke="${c}" stroke-width="1.5"/>
    <line x1="10" y1="13" x2="18" y2="13" stroke="${c}" stroke-width="1.5"/>
    <line x1="10" y1="17" x2="16" y2="17" stroke="${c}" stroke-width="1.5"/>
  </svg>`;
}

function tabHeartSVG(active) {
  const c = active ? "white" : "#888";
  return `<svg viewBox="0 0 32 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 27 C16 27 2 18 2 9.5 C2 5.36 5.36 2 9.5 2 C12.1 2 14.4 3.3 16 5.3 C17.6 3.3 19.9 2 22.5 2 C26.64 2 30 5.36 30 9.5 C30 18 16 27 16 27Z"
      fill="none" stroke="${c}" stroke-width="2"/>
  </svg>`;
}

function quizSVG(active) {
  const c = active ? "#f0a500" : "#888";
  return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 8 Q6 4 10 4 L22 4 Q26 4 26 8 L26 20 Q26 24 22 24 L18 24 L12 29 L12 24 L10 24 Q6 24 6 20 Z"
      stroke="${c}" stroke-width="2" fill="none"/>
    <line x1="11" y1="11" x2="21" y2="11" stroke="${c}" stroke-width="1.8"/>
    <line x1="11" y1="15" x2="18" y2="15" stroke="${c}" stroke-width="1.8"/>
  </svg>`;
}

// =======================
// AUDIO
// =======================
const blobCache = {};

async function preloadAll(files) {
  const BATCH_SIZE = 10;
  let failCount = 0;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async file => {
      if (blobCache[file]) return;
      try {
        const res = await fetch(encodeURI(file));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        blobCache[file] = URL.createObjectURL(blob);
      } catch(e) {
        failCount++;
        console.warn(`Preload mislukt: ${file} — ${e.message}`);
      }
    }));
  }

  if (failCount > 0) {
    // Toon melding onderaan het scherm
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%);
      background: #7a2000;
      color: white;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      z-index: 9999;
      text-align: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;
    toast.innerHTML = `&#9888; ${failCount} geluid(en) niet geladen. <u>Tik om te herladen</u>`;
    toast.onclick = () => location.reload();
    document.body.appendChild(toast);

    // Verdwijnt automatisch na 8 seconden als gebruiker niet klikt
    setTimeout(() => toast.remove(), 8000);
  } else {
    console.log("\u2705 Alle audio geladen");
  }
}

function play(file) {
  if (!file) return;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  const src = blobCache[file] || encodeURI(file);
  const audio = new Audio(src);
  currentAudio = audio;
  audio.play().catch(e => console.warn(`Audio mislukt: ${file} — ${e.message}`));
}

// Diagnose via console: checkAllAudio()
async function checkAllAudio() {
  console.log("=== AUDIO DIAGNOSE START ===");
  const errors = [];
  const allItems = [...new Map(Object.values(data).flat().map(i => [i.file, i])).values()];
  for (const item of allItems) {
    await new Promise(resolve => {
      const url = encodeURI(item.file);
      const audio = new Audio(url);
      const timeout = setTimeout(() => {
        errors.push({ title: item.title, file: item.file, fout: "Timeout" });
        resolve();
      }, 5000);
      audio.addEventListener("canplaythrough", () => { clearTimeout(timeout); resolve(); }, { once: true });
      audio.addEventListener("error", () => {
        clearTimeout(timeout);
        const msg = audio.error ? `code ${audio.error.code}` : "onbekend";
        errors.push({ title: item.title, file: item.file, fout: msg });
        resolve();
      }, { once: true });
      audio.load();
    });
  }
  console.log(`=== KLAAR: ${errors.length} fouten op ${allItems.length} bestanden ===`);
  if (errors.length) console.table(errors);
  else console.log("\u2705 Alles werkt!");
  return errors;
}
window.checkAllAudio = checkAllAudio;

// =======================
// FAVORIETEN
// =======================
function toggleFav(file) {
  if (navigator.vibrate) navigator.vibrate(15);
  favorites = favorites.includes(file)
    ? favorites.filter(f => f !== file)
    : [...favorites, file];
  localStorage.setItem("fav", JSON.stringify(favorites));
  if (currentTheme) renderTheme(currentTheme);
}

// =======================
// QUIZ MODE
// =======================
function toggleQuiz() {
  quizMode = !quizMode;
  const badge = document.getElementById("quiz-badge");
  const content = document.getElementById("content");
  if (quizMode) {
    if (!badge) {
      const b = document.createElement("div");
      b.id = "quiz-badge";
      b.className = "quiz-badge";
      b.textContent = "We gon eki kik'n ofdaj der 'ntwa van verstoan 'et";
      document.body.appendChild(b);
    }
    content.classList.add("quiz-active");
  } else {
    badge?.remove();
    content.classList.remove("quiz-active");
  }
  renderBottombar();
  if (currentTheme) renderTheme(currentTheme);
  else if (activeTab === "favorieten") renderFavorieten();
}

// =======================
// BOTTOMBAR
// =======================
function renderBottombar() {
  const bar = document.querySelector(".bottombar");
  bar.innerHTML = `
    <button class="bottombar-btn ${activeTab === 'themas' ? 'active' : ''}" onclick="renderThemes()">
      ${bookSVG(activeTab === 'themas')}
      <span>Thema's</span>
    </button>
    <button class="bottombar-btn ${activeTab === 'favorieten' ? 'active' : ''}" onclick="renderFavorieten()">
      ${tabHeartSVG(activeTab === 'favorieten')}
      <span>'t Beste</span>
    </button>
    <button class="bottombar-btn ${quizMode ? 'active' : ''}" onclick="toggleQuiz()" style="${quizMode ? 'color:#f0a500' : ''}">
      ${quizSVG(quizMode)}
      <span>Quiz</span>
    </button>
    <button class="bottombar-btn ${activeTab === 'info' ? 'active' : ''}" onclick="renderInfo()">
      <img src="img/logo_wvl@2x.png" class="tab-logo" alt="Info">
      <span>Info</span>
    </button>
  `;
}

// =======================
// POPUP
// =======================
function confirmDeleteFavs() {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup-box">
      <p>Dit verwijdert alle favorieten.</p>
        <p>Ben je het zeker?</p>
      <div class="popup-actions">
        <button class="btn-cancel" onclick="this.closest('.popup-overlay').remove()">Annuleren</button>
        <button class="btn-confirm" onclick="deleteAllFavs()">Verwijderen</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function deleteAllFavs() {
  favorites = [];
  localStorage.setItem("fav", JSON.stringify(favorites));
  document.querySelector(".popup-overlay")?.remove();
  renderFavorieten();
}

// =======================
// LOAD JSON
// =======================
async function loadSounds() {
  try {
    const res = await fetch("mp3/Sound.json");
    const json = await res.json();
    sounds = json.results || json;
    buildData();
    renderThemes();
  } catch (e) {
    console.error("JSON load failed", e);
  }
}

// =======================
// BUILD DATA
// =======================
function buildData() {
  data = {};
  [...THEME_ORDER, ...REGIO_THEMES].forEach(t => { data[t] = []; });

  sounds.forEach(s => {
    const file = cleanPath(s.fileName);
    const item = {
      file,
      title: s.soundTitle || s.dialectTitle || file,
      dialect: s.dialectTitle || s.soundTitle || file
    };

    const rawCats = s.categories || "";
    const catKeys = parseCategories(rawCats);
    let resolved = [...new Set(catKeys.map(resolveCategory).filter(Boolean))];

    if (resolved.length === 0) {
      const detected = detectCategoryFromFile(file);
      if (detected) resolved.push(detected);
    }

    resolved.forEach(cat => {
      if (!data[cat]) data[cat] = [];
      if (!data[cat].find(i => i.file === file)) {
        data[cat].push(item);
      }
    });

    if (!data["Alles"].find(i => i.file === file)) {
      data["Alles"].push(item);
    }
  });
}

function detectCategoryFromFile(file) {
  const f = file.toLowerCase();
  if (f.includes("uitdruk"))  return "Uitdrukkingen";
  if (f.includes("weer"))     return "Het weer";
  if (f.includes("huis") || f.includes("tuin") || f.includes("keuken")) return "Huis/Tuin/Keuken";
  if (f.includes("resto"))    return "Op restaurant";
  if (f.includes("cafe"))     return "In het caf\u00e9";
  if (f.includes("dieren") || f.includes("dier")) return "Dieren";
  if (f.includes("winkel"))   return "In de winkel";
  if (f.includes("straat"))   return "Op straat";
  if (f.includes("onderweg")) return "Onderweg";
  if (f.includes("feest"))    return "Feestdagen";
  if (f.includes("maaike") || f.includes("cafmeyer")) return "Maaike Cafmeyer";
  if (f.includes("ja"))       return "Vervoegingen van ja";
  return null;
}

// =======================
// ITEM RENDEREN
// =======================
function renderItem(item, onFavClick) {
  const div = document.createElement("div");
  div.className = "item";

  const displayTitle = quizMode ? item.dialect : item.title;
  const flipTitle = quizMode ? item.title : item.dialect;

  div.innerHTML = `
    <span class="label">${fixSpacing(displayTitle)}</span>
    <span class="fav">${heartSVG(favorites.includes(item.file))}</span>
  `;

  const label = div.querySelector(".label");
  let flipTimeout = null;

  label.onclick = () => {
    vibrate();
    if (flipTimeout) clearTimeout(flipTimeout);
    play(item.file);
    label.innerHTML = fixSpacing(flipTitle);
    label.classList.add("showing-dialect");
    flipTimeout = setTimeout(() => {
      label.innerHTML = fixSpacing(displayTitle);
      label.classList.remove("showing-dialect");
      flipTimeout = null;
    }, 2000);
  };

  div.querySelector(".fav").onclick = (e) => {
    e.stopPropagation();
    onFavClick(item.file);
  };

  return div;
}

// =======================
// THEME OVERVIEW
// =======================
function renderThemes() {
  activeTab = "themas";
  currentTheme = null;
  document.getElementById("title").innerHTML = `<div class="title-text">THEMA'S</div>`;

  const content = document.getElementById("content");
  content.innerHTML = "";

  const inner = document.createElement("div");
  inner.id = "content-inner";
  content.appendChild(inner);

  THEME_ORDER.forEach(theme => {
    if (theme === "Uitdrukkingen per regio") {
      const hasRegio = REGIO_THEMES.some(r => data[r] && data[r].length > 0);
      if (!hasRegio) return;
      const div = document.createElement("div");
      div.className = "item";
      div.style.paddingLeft = "28px";
      div.innerHTML = `<span class="label" style="color:#aaa; font-size:0.95em">${fixSpacing("Uitdrukkingen per regio")}</span><span class="arrow">&#10142;</span>`;
      div.onclick = () => renderRegioMenu();
      inner.appendChild(div);
      return;
    }

    if (!data[theme] || data[theme].length === 0) return;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<span class="label">${fixSpacing(theme)}</span><span class="arrow">&#10142;</span>`;
    div.onclick = () => renderTheme(theme);
    inner.appendChild(div);
  });

  renderBottombar();
}

// =======================
// REGIO SUBMENU
// =======================
function renderRegioMenu() {
  currentTheme = null;
  document.getElementById("title").innerHTML = `
    <div class="back" onclick="renderThemes()">&#8592; Terug</div>
    <div class="title-text">PER REGIO</div>
  `;

  const content = document.getElementById("content");
  content.innerHTML = "";
  const inner = document.createElement("div");
  inner.id = "content-inner";
  content.appendChild(inner);

  REGIO_THEMES.forEach(regio => {
    if (!data[regio] || data[regio].length === 0) return;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<span class="label">${fixSpacing(regio)}</span><span class="arrow">&#10142;</span>`;
    div.onclick = () => renderTheme(regio);
    inner.appendChild(div);
  });

  renderBottombar();
}

// =======================
// SUBTHEME VIEW
// =======================
function renderTheme(theme) {
  currentTheme = theme;
  const isRegio = REGIO_THEMES.includes(theme);

  document.getElementById("title").innerHTML = `
    <div class="back" onclick="${isRegio ? 'renderRegioMenu()' : 'renderThemes()'}">&#8592; Terug</div>
    <div class="title-text">${fixSpacing(theme.toUpperCase())}</div>
  `;

  const content = document.getElementById("content");
  content.innerHTML = "";
  const inner = document.createElement("div");
  inner.id = "content-inner";
  content.appendChild(inner);

  (data[theme] || []).forEach(item => {
    inner.appendChild(renderItem(item, (file) => toggleFav(file)));
  });

  renderBottombar();
}

// =======================
// FAVORIETEN PAGINA
// =======================
function renderFavorieten() {
  activeTab = "favorieten";
  currentTheme = null;

  document.getElementById("title").innerHTML = `
    <div class="back" onclick="renderThemes()">&#8592; Terug</div>
    <div class="title-text">FAVORIETEN</div>
    <div class="topbar-with-action">
      <button class="delete-fav-topbtn" onclick="confirmDeleteFavs()" title="Verwijder alle favorieten">&#128465;&#65039;</button>
    </div>
  `;

  const content = document.getElementById("content");
  content.innerHTML = "";
  const inner = document.createElement("div");
  inner.id = "content-inner";
  content.appendChild(inner);

  const seen = new Set();
  const favItems = [];
  Object.values(data).flat().forEach(item => {
    if (favorites.includes(item.file) && !seen.has(item.file)) {
      seen.add(item.file);
      favItems.push(item);
    }
  });

  if (favItems.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "text-align:center; padding: 40px 20px; color: #888; font-size: 18px;";
    empty.textContent = "Nog geen favorieten toegevoegd.";
    inner.appendChild(empty);
  } else {
    favItems.forEach(item => {
      inner.appendChild(renderItem(item, () => {
        toggleFav(item.file);
        renderFavorieten();
      }));
    });
  }

  renderBottombar();
}

// =======================
// INFO PAGINA
// =======================
function renderInfo() {
  activeTab = "info";
  currentTheme = null;
  document.getElementById("title").innerHTML = `
    <div class="back" onclick="renderThemes()">&#8592; Terug</div>
    <div class="title-text">INFO</div>
  `;

  const content = document.getElementById("content");
  content.innerHTML = "";

  const inner = document.createElement("div");
  inner.className = "info-content";
  inner.innerHTML = `
    <p class="info-section-title">Over West-Vlamingen</p>
    <p class="info-intro">Het zijn nogal levensgenieters: ze weten alles van lekker eten en drinken, van cultureel \u00e9n sportief ontspannen.</p>
    <p class="info-body">Levenskwaliteit is er ook genoeg in de enige provincie aan de zee: met de uitgestrekte provinciale domeinen en de prachtige fiets- en wandelpaden in de polders, de heuvels of langs de Leie. Daarenboven zijn West-Vlamingen een zeer ondernemend volkje. Stil zitten staat niet in hun woordenboek. Vwoert'doen daarentegen wel...</p>
    <div class="info-wvl-logo">
      <img src="img/logo_wvl@2x.png" alt="West-Vlaanderen">
    </div>
    <hr class="info-divider">
    <p class="info-section-title">Over de app</p>
    <p class="info-intro">Verras vriend en vijand met de leukste West-Vlaamse woorden en uitspraken.</p>
    <p class="info-body">Voor elke situatie en bij elke gelegenheid kan je vanaf nu uitpakken met een perfecte West-Vlaamse tongval. Onderweg, op caf\u00e9 of restaurant, in de winkel, ...</p>
     <hr class="info-divider">
    <p class="info-section-title">Info over deze versie</p>
    <p class="info-intro">Dit is een nagemaakte webpagina van de originele app.</p>
    <p class="info-body">De originele app is niet meer beschikbaar op de Google Play Store of de Apple App Store. Deze site werd nagemaakt op basis van een oude versie van de app, met alle audiofiles. Zelf voegde ik er nog wat andere functionaliteiten aan toe zoals de quiz en het zichtbaar maken van de West-Vlaamse geschreven versie.</p>
    <p class="info-body">Alle credits behoren toe aan de originele makers van de West-Vlaanderen app, dit werd enkel gemaakt ter preservatie van onze taal!</p>
    <p class="info-body">Deel dit met je vrienden!</p>
        <p class="info-body">Made by Jasmine Menu.</p>
    <hr class="info-divider">
    <a href="https://vls.wikipedia.org/wiki/Iedereen_West-Vlaams" target="_blank" class="info-link">
      &#128216; Wikipedia pagina
    </a>
    <button class="info-share-btn" onclick="shareApp()">
      &#8679; Deel deze app
    </button>
  `;
  content.appendChild(inner);

  renderBottombar();
}

function shareApp() {
  const url = "https://jasminemenu.github.io/IedereenWVL/";
  
  if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    // Alleen op mobile de native share gebruiken
    navigator.share({
      title: "Iedereen West-Vlaams",
      text: "Verras vriend en vijand met de leukste West-Vlaamse woorden!",
      url: url
    }).catch(() => {});
  } else {
    // Desktop: kopieer naar klembord en toon bevestiging in de app
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.querySelector(".info-share-btn");
      const original = btn.innerHTML;
      btn.innerHTML = "&#10003; Link gekopieerd!";
      btn.style.background = "#1a4a1a";
      btn.style.borderColor = "#2a7a2a";
      setTimeout(() => {
        btn.innerHTML = original;
        btn.style.background = "";
        btn.style.borderColor = "";
      }, 2000);
    }).catch(() => {
      // Laatste fallback: toon de URL in een prompt zodat gebruiker kan kopiëren
      prompt("Kopieer deze link:", url);
    });
  }
}
// =======================
// START
// =======================
loadSounds();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

window.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("touchstart", () => {
    const unlock = new Audio();
    unlock.play().catch(() => {});
  }, { once: true });
});

window.addEventListener("DOMContentLoaded", () => {
  const startScreen = document.getElementById("startscreen");
  if (!startScreen) return;
  startScreen.addEventListener("click", () => {
    startScreen.style.opacity = "0";
    startScreen.style.transition = "opacity 0.4s ease";
    setTimeout(() => {
      startScreen.remove();
      renderThemes();
      const allFiles = [...new Set(sounds.map(s => cleanPath(s.fileName)))];
      preloadAll(allFiles);
    }, 400);
  });
});
