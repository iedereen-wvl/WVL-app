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
    <button class="bottombar-btn ${activeTab === 'hoehel' ? 'active' : ''}" onclick="renderHoehel()">
      ${hoehelSVG(activeTab === 'hoehel')}
      <span>Hoehel</span>
    </button>
<button class="bottombar-btn ${activeTab === 'wiki' ? 'active' : ''}" onclick="renderWiki()">
  <img src="https://vls.wikipedia.org/static/images/icons/wikipedia.png" 
    style="width:28px; height:28px; object-fit:contain; ${activeTab === 'wiki' ? 'opacity:1' : 'opacity:0.5'};" 
    alt="Wikipedia">
  <span>Wikipedia</span>
</button>
    <button class="bottombar-btn ${activeTab === 'info' ? 'active' : ''}" onclick="renderInfo()">
      <img src="img/logo_wvl@2x.png" class="tab-logo" alt="Info">
      <span>Info</span>
    </button>
  `;
}
function hoehelSVG(active) {
  // G-vorm in Google kleuren
  return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M28 16.5c0-.8-.1-1.6-.2-2.3H16v4.4h6.7c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9C26.6 23 28 20 28 16.5z" fill="${active ? '#4285F4' : '#666'}"/>
    <path d="M16 28c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.8H5.4v3.1C7.4 25.8 11.4 28 16 28z" fill="${active ? '#34A853' : '#666'}"/>
    <path d="M9.4 18.5c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2v-3H5.4C4.5 12.8 4 14.3 4 16s.5 3.2 1.4 4.6l4-3.1z" fill="${active ? '#FBBC05' : '#666'}"/>
    <path d="M16 9.2c1.7 0 3.3.6 4.5 1.8l3.4-3.4C21.9 5.7 19.2 4.5 16 4.5c-4.6 0-8.6 2.6-10.6 6.4l4 3.1C10.3 11.3 12.9 9.2 16 9.2z" fill="${active ? '#EA4335' : '#666'}"/>
  </svg>`;
}
function renderHoehel() {
  activeTab = "hoehel";
  currentTheme = null;
  document.getElementById("title").innerHTML = `
    <div class="back" onclick="renderThemes()">&#8592; Terug</div>
    <div class="title-text">HOEHEL</div>
  `;

  const content = document.getElementById("content");
  content.innerHTML = "";

  const inner = document.createElement("div");
  inner.className = "info-content";
  inner.style.cssText = "display:flex; flex-direction:column; align-items:center; padding-top: 40px;";
  inner.innerHTML = `
    <div style="font-size:64px; font-weight:bold; margin-bottom:8px; letter-spacing:-2px; line-height:1;">
      <span style="color:#4285F4">H</span><span style="color:#EA4335">o</span><span style="color:#FBBC05">e</span><span style="color:#4285F4">h</span><span style="color:#34A853">e</span><span style="color:#EA4335">l</span><span style="color:white; font-size:32px;">.be</span>
    </div>
    <div style="color:#aaa; font-size:14px; margin-bottom:32px;">West-Vloander'n</div>

    <div style="width:100%; max-width:500px; display:flex; gap:8px; margin-bottom:16px;">
      <input 
        id="hoehel-input"
        type="text" 
        placeholder="Zeg eki wa daj moe weet'n..."
        style="flex:1; padding:10px 12px; border-radius:24px; border:1px solid #444; background:#1a1a1a; color:white; font-family:WVL,sans-serif; font-size:clamp(13px, 3.5vw, 16px); outline:none; min-width:0;"
      >
    </div>

   <button onclick="hoehelZoeken()" style="padding:10px 20px; border-radius:6px; border:1px solid #444; background:#f4f4f4; color:#444444; font-family:WVL,sans-serif; font-size:14px; cursor:pointer; margin-bottom:10px; width:100%; max-width:500px;">Zoek'n me Hoehel</button>
<button onclick="hoehelKhonSjans()" style="padding:10px 20px; border-radius:6px; border:1px solid #444; background:#f4f4f4; color:#444444; font-family:WVL,sans-serif; font-size:14px; cursor:pointer; width:100%; max-width:500px;">Ip goe heluk</button>
    <div style="margin-top:24px; color:#aaa; font-size:12px; text-align:center; line-height:2;">
      Da is ier e versie van Hoehel int: <a href="https://hoehel.be" target="_blank" style="color:#4a9eff;">Westvloams</a>
    </div>

    <div style="margin-top:8px; color:#aaa; font-size:12px; text-align:center; line-height:2;">
      Origineel eje hoehel wok in:
      <a href="https://www.google.com/?hl=en" target="_blank" style="color:#4a9eff;">'t Engels</a> &middot;
      <a href="https://www.google.com/?hl=fr" target="_blank" style="color:#4a9eff;">'t Frans</a> &middot;
      <a href="https://www.google.com/?hl=de" target="_blank" style="color:#4a9eff;">'t Duts</a> &middot;
      <a href="https://www.google.be" target="_blank" style="color:#4a9eff;">'Vo d'Hollanders</a>
    </div>

    <div style="margin-top:24px; color:#ccc; font-size:11px; text-align:center; line-height:1.8; max-width:500px;">
  &copy; Hoehel kiekt in stief vele pohina's in't Westvloms<br>
  (meir of elvendertihoendertust-en-vuvenvihtig).<br>
  Dien pahina iere ku je tbest bekieken m&eacute; ruute ahtenegentich, moa nen aipet is wok hoed.
</div>
<strong style="color:#ccc; margin-top:32px; margin-bottom:4px; display:block; text-align:center;">Diskleemer:</strong>
<div style="margin-top:4px; color:#ccc; font-size:11px; text-align:center; line-height:1.8; max-width:500px;">
  Dat is ier al nie te serieus eni.<br>
  Hoehel is e woordspelinge vo de klucht ip de zoekmasjine van Google.<br>
  't Is ier ollemoale voe de leute, zonder commerce en met geslotn beuzn.<br>
  Hoehel et niet te moakn met Google, 'tis 'thopn da ze der e bitje mee kun lach'n.
</div>

    <div style="margin-top:80px; padding-top:24px; border-top:1px solid #222; color:#444; font-size:10px; text-align:center; line-height:1.8; max-width:500px; margin-bottom:20px;">
      <div style="margin-bottom:12px;">
        <strong style="color:#ccc;">Disclaimer (NL)</strong><br>
        Hoehel is een parodiewebsite en is niet verbonden met, gesponsord door of gelieerd aan Google LLC.<br>
        Alle handelsmerken, logo's en merknamen zijn eigendom van hun respectieve eigenaars.<br>
        Deze website is gratis, bevat geen advertenties en is niet bedoeld voor commercieel gebruik.
      </div>
      <div>
        <strong style="color:#ccc;">Disclaimer (EN)</strong><br>
        Hoehel is a parody website and is not affiliated with, endorsed by, or associated with Google LLC.<br>
        All trademarks, logos, and brand names are the property of their respective owners.<br>
        This website is free, contains no advertisements, and is not intended for commercial use.
      </div>
    </div>
  `;
  content.appendChild(inner);

  setTimeout(() => {
    const input = document.getElementById("hoehel-input");
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") hoehelZoeken();
      });
    }
  }, 100);

  renderBottombar();
}

function hoehelZoeken() {
  const query = document.getElementById("hoehel-input")?.value?.trim();
  if (!query) return;
  playEasterEgg();
  setTimeout(() => {
    window.open(`https://www.google.be/search?q=${encodeURIComponent(query)}`, "_blank");
  }, 300);
}

function hoehelKhonSjans() {
  const query = document.getElementById("hoehel-input")?.value?.trim();
  playEasterEgg();
  const url = query
    ? `https://www.google.be/search?q=${encodeURIComponent(query)}&btnI=1`
    : "https://hoehel.be";
  setTimeout(() => {
    window.open(url, "_blank");
  }, 300);
}

function wikiSVG(active) {
  const c = active ? "white" : "#888";
  return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="12" stroke="${c}" stroke-width="1.8"/>
    <path d="M4 16 Q10 10 16 16 Q22 22 28 16" stroke="${c}" stroke-width="1.5"/>
    <path d="M4 16 Q10 22 16 16 Q22 10 28 16" stroke="${c}" stroke-width="1.5"/>
    <line x1="16" y1="4" x2="16" y2="28" stroke="${c}" stroke-width="1.5"/>
    <line x1="4" y1="16" x2="28" y2="16" stroke="${c}" stroke-width="1.5"/>
  </svg>`;
}

function renderWiki() {
  activeTab = "wiki";
  currentTheme = null;
  document.getElementById("title").innerHTML = `
    <div class="back" onclick="renderThemes()">&#8592; Terug</div>
    <div class="title-text">WIKIPEDIA</div>
  `;

  const content = document.getElementById("content");
  content.innerHTML = "";

  const inner = document.createElement("div");
  inner.className = "info-content";
  inner.style.cssText = "display:flex; flex-direction:column; align-items:center; padding-top:30px;";
  inner.innerHTML = `
    <a href="https://vls.wikipedia.org/wiki/Voorblad" target="_blank" 
      style="display:flex; flex-direction:column; align-items:center; background:white; border-radius:8px; padding:16px 24px; margin-bottom:28px; text-decoration:none; width:100%; max-width:400px; box-sizing:border-box;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:6px;">
        <img src="https://vls.wikipedia.org/static/images/icons/wikipedia.png" 
          style="width:50px; height:50px; object-fit:contain;" alt="Wikipedia logo">
        <img src="https://vls.wikipedia.org/static/images/mobile/copyright/wikipedia-wordmark-en.svg" 
          style="height:28px; width:auto;" alt="Wikipedia">
      </div>
      <img src="https://vls.wikipedia.org/static/images/mobile/copyright/wikipedia-tagline-vls.svg" 
        style="height:16px; width:auto;" alt="Den vryen encyclopedie">
    </a>

    <div style="width:100%; max-width:500px; margin-bottom:16px;">
<div style="display:flex; align-items:center; border:1px solid #555; border-radius:4px; background:#1a1a1a; overflow:hidden; width:100%; box-sizing:border-box;">        

<input
  id="wiki-input"
  type="text"
  placeholder="Deurzoek Wikipedia"
  style="flex:1; min-width:0; padding:12px 14px; border:none; background:transparent; color:white; font-family:WVL,sans-serif; font-size:clamp(13px, 3.5vw, 16px); outline:none;"
>

        <button onclick="wikiZoeken()" style="padding:12px 16px; border:none; border-left:1px solid #555; background:#f8f9fa; color:#333; font-family:WVL,sans-serif; font-size:14px; cursor:pointer; white-space:nowrap;">
          Zoekn
        </button>
      </div>
    </div>

    <div style="width:100%; max-width:500px; border-top:1px solid #222; padding-top:20px; color:#ccc; font-size:14px; line-height:1.9; text-align:center; margin-top:8px;">
      <big><b>Welgekommn by de <a href="https://vls.wikipedia.org/wiki/West-Vlams" target="_blank" style="color:#4a9eff;">West-Vlamsche</a> Wikipedia!</b></big>
    </div>

    <div style="width:100%; max-width:500px; color:#aaa; font-size:13px; line-height:1.9; text-align:center; margin-top:12px;">
      Der zyn ol <a href="https://vls.wikipedia.org/wiki/Specioal:Statistieken" target="_blank" style="color:#4a9eff;">8.334 artikels</a> ip de West-Vlamsche Wikipedia.<br> 
      Olleman meugt hêlegans vo nietn informoasje ipzoekn, toevoegn of zelve bewerkn. 
      Ge moe gy gin benauwd èn vo'n twadde te verandern of derby te zettn. <br>
      A je der nog nie hêel grust ip zyt, ku je gy olsan e kêe probeern in de 
      <a href="https://vls.wikipedia.org/wiki/Wikipedia:Zanbak" target="_blank" style="color:#4a9eff;">zandbak</a>.
    </div>

    <div style="width:100%; max-width:500px; color:#aaa; font-size:13px; line-height:1.9; text-align:center; margin-top:12px;">
      <a href="https://vls.wikipedia.org/wiki/Wikipedia:Gebruuk_van_streektoaln" target="_blank" style="color:#4a9eff;">'k Ei der gin gedacht van oe da 'k ik in 't West-Vlams kanne begunn schryvn.</a><br>
      <a href="https://vls.wikipedia.org/wiki/Ulpe:Wikipedia" target="_blank" style="color:#4a9eff;">Oe moe 'k ik eigentlik begunn?</a>
    </div>

    <div style="margin-top:40px; width:100%; max-width:500px; border-top:1px solid #222; padding-top:20px; color:#aaa; font-size:12px; text-align:center; line-height:2;">
      Da is ier e versie van Wikipedia int: <a href="https://vls.wikipedia.org/wiki/Voorblad" target="_blank" style="color:#4a9eff;">Westvloams</a>
    </div>

    <div style="margin-top:8px; color:#aaa; font-size:12px; text-align:center; line-height:2; max-width:500px;">
      Wikipedia ej natuurlik wok in:
      <a href="https://en.wikipedia.org" target="_blank" style="color:#4a9eff;">'t Engels</a> &middot;
      <a href="https://fr.wikipedia.org" target="_blank" style="color:#4a9eff;">'t Frans</a> &middot;
      <a href="https://de.wikipedia.org" target="_blank" style="color:#4a9eff;">'t Duts</a> &middot;
      <a href="https://nl.wikipedia.org" target="_blank" style="color:#4a9eff;">'Vo d'Hollanders</a>
    </div>

    <div style="margin-top:24px; color:#ccc; font-size:11px; text-align:center; line-height:1.8; max-width:500px;">
      &copy; Wikipedia is e vrye encyclopedie da iedereen ku bewerkn.<br>
      Dien pahina iere ku je tbest bekieken m&eacute; ruute ahtenegentich, moa nen aipet is wok hoed.
    </div>

    <strong style="color:#ccc; margin-top:24px; margin-bottom:4px; display:block; text-align:center;">Diskleemer:</strong>
    <div style="margin-top:4px; color:#ccc; font-size:11px; text-align:center; line-height:1.8; max-width:500px;">
      Dat is ier al nie te serieus eni.<br>
      Dezen pagina is e liefdevolle ode an de West-Vlamsche Wikipedia.<br>
      't Is ier ollemoale voe de leute, zonder commerce en met geslotn beuzn.<br>
      Dezen pagina et niet te moakn met de Wikimedia Foundation.
    </div>

    <div style="margin-top:80px; padding-top:24px; border-top:1px solid #222; color:#444; font-size:10px; text-align:center; line-height:1.8; max-width:500px; margin-bottom:20px;">
      <div style="margin-bottom:12px;">
        <strong style="color:#ccc;">Disclaimer (NL)</strong><br>
        Deze pagina is niet verbonden met, gesponsord door of gelieerd aan de Wikimedia Foundation.<br>
        Alle handelsmerken, logo's en merknamen zijn eigendom van hun respectieve eigenaars.<br>
        Deze pagina is gratis, bevat geen advertenties en is niet bedoeld voor commercieel gebruik.
      </div>
      <div>
        <strong style="color:#ccc;">Disclaimer (EN)</strong><br>
        This page is not affiliated with, endorsed by, or associated with the Wikimedia Foundation.<br>
        All trademarks, logos, and brand names are the property of their respective owners.<br>
        This page is free, contains no advertisements, and is not intended for commercial use.
      </div>
    </div>
  `;
  content.appendChild(inner);

  setTimeout(() => {
    const input = document.getElementById("wiki-input");
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") wikiZoeken();
      });
      input.focus();
    }
  }, 100);

  renderBottombar();
}

function wikiZoeken() {
  const query = document.getElementById("wiki-input")?.value?.trim();
  playEasterEgg();
  const url = query
    ? `https://vls.wikipedia.org/wiki/Specioal:Zoeken?search=${encodeURIComponent(query)}`
    : "https://vls.wikipedia.org/wiki/Voorblad";
  setTimeout(() => {
    window.open(url, "_blank");
  }, 300);
}

const EASTER_EGG_SOUNDS = [
  "WVL_APP_10_UitdrukkingenKortrijk_OeScjeetDaNu.mp3",
  "WVL_APP_9_UitdrukkingenRoeselare_GifMaChette.mp3",
  "in_de_zunne_en_ut_de_wind___t_is_doar_daj_de_leegaarts_vindt_V_2.mp3",
  "WVL_APP_9_UitdrukkingenRoeselare_HeidIerNieTePiep'n.mp3",
  "t_sop_is_de_kolen_nie_weird.mp3",
  "Ewel__sante__me_ratje.mp3",
  "Tut_te_fe_te.mp3",
  "_t_schoap_e_s_de_preute_of.mp3",
  "WVL_APP_8_UitdrukkingenOostende_TisOalGinOarSnien.mp3",
  "tis_van_lek_mien_liptje.mp3",
  "t_es_betre_goe_geeten_dan_t_bedde_versleten.mp3",
  "Je_zoe_je_duum_in_je_gat_breken.mp3",
  "k_Wit_zoender.mp3",
  "WVL_APP_10_UitdrukkingenKortrijk_TwaMoZusteVo.mp3",
  "ti_tiet_ta_tut_is.mp3",
  "tes_un_besche_ten_comme_che.mp3",
  "WVL_APP_10_UitdrukkingenKortrijk_GeMeugIpUweKinnekloppen.mp3",
  "WVL_APP_9_UitdrukkingenRoeselare_PreusLikVijrtig.mp3",
  "_t_lopt_van_de_schuppe.mp3",
  "In_de_kerke_pissen_en__tip_d_Hillegen_steken.mp3",
  "WVL_APP_10_UitdrukkingenIeper_KukkettekikElpen.mp3",
  "j_es_nie_van_nen__oaze_gepoept.mp3",
  "WVL_APP_9_UitdrukkingenRoeselare_TisNeNoekOf.mp3",
  "WVL_APP_9_UitdrukkingenRoeselare_GeMoeDjeMuleOed'n.mp3",
  "WVL_APP_10_UitdrukkingenBrugge_ZoRoendOfEnEi.mp3",
  "WVL_APP_10_UitdrukkingenBrugge_MoGowZeg.mp3",
  "WVL_APP_8_UitdrukkingenOostende_OhGeireMeneireMeTeinDoeZeir.mp3",
  "WVL_APP_10_UitdrukkingenBrugge_MeVeleVuuvnEnZessen.mp3",
  "Scheur_je_puuste.mp3",
  "Joen_kitten_smoeten.mp3",
  "WVL_APP_10_UitdrukkingenKortrijk_TenEGinAvanse.mp3",
  "ja_ikvorm.mp3",
  "wat_is_er.mp3"
];

function playEasterEgg() {
  const random = EASTER_EGG_SOUNDS[Math.floor(Math.random() * EASTER_EGG_SOUNDS.length)];
  play(cleanPath(random));
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

<button class="info-share-btn" onclick="shareApp()">
  <svg style="width:18px;height:18px;vertical-align:middle;margin-right:8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
  Deel deze app
</button>

<a href="https://www.west-vlaanderen.be/artikel/app-iedereen-west-vlaams-t-nieuw-voor-de-eindejaarsfeesten" target="_blank" class="info-link" style="background:#333; border:1px solid #444; border-radius:10px; color:#ccc; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:10px; padding:14px; margin-bottom:12px;">
  <img src="img/logo_wvl@2x.png" style="height:24px; width:auto; object-fit:contain;">
  West-Vlaanderen.be
</a>

<a href="https://vls.wikipedia.org/wiki/Iedereen_West-Vlaams" target="_blank" class="info-link" style="background:#333; border:1px solid #444; border-radius:10px; color:#ccc; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:10px; padding:14px; margin-bottom:12px;">
  <img src="https://vls.wikipedia.org/static/images/icons/wikipedia.png" style="width:24px;height:24px;object-fit:contain;">
  Wikipedia pagina
</a>
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
