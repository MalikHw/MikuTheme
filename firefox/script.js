const searchEngines = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  yandex: 'https://yandex.com/search/?text=',
  brave: 'https://search.brave.com/search?q=',
  youtube: 'https://www.youtube.com/results?search_query='
};

const REPO_BASE = 'https://raw.githubusercontent.com/MalikHw/MikuTheme/main';
const IMAGES_FOLDER = `${REPO_BASE}/images`;
const TETO_IMAGES_FOLDER = `${REPO_BASE}/images-teto`;
const IMAGES_COUNT_FILE = `${REPO_BASE}/images-count.txt`;
const TETO_IMAGES_COUNT_FILE = `${REPO_BASE}/images-teto-count.txt`;

// Default shortcuts
const DEFAULT_SHORTCUTS = [
  { title: 'YouTube', url: 'https://youtube.com' },
  { title: 'ChatGPT', url: 'https://chat.openai.com' },
  { title: 'Claude', url: 'https://claude.ai' },
  { title: 'MalikHw47', url: 'https://youtube.com/@MalikHw47' },
  { title: 'TikTok', url: 'https://tiktok.com' },
  { title: 'Twitter', url: 'https://twitter.com' },
  { title: 'Reddit', url: 'https://reddit.com' },
  { title: 'GitHub', url: 'https://github.com' }
];

let currentEngine = 'google';
let shortcuts = [];
let settings = {
  blurEnabled: true,
  wallpaperBlur: false,
  customBg: null,
  bannerHidden: false,
  tetoMode: false,
  tetoMikuMode: false,
  bgDisplayMode: 'cover',
  customColorEnabled: false,
  customColor: '#68c3ff',
  tempUnit: 'celsius'
};
let isOnline = navigator.onLine;

let versionClickCount = 0;
let tetoModeUnlocked = false;
const REPO_MANIFEST_URL = 'https://raw.githubusercontent.com/MalikHw/MikuTheme/main/manifest.json';
const LATEST_RELEASE_URL = 'https://github.com/MalikHw/MikuTheme/releases/latest/download/miku-theme-chrome.zip';


// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await window.MikuStorage.init();
  await loadSettings();
  await loadShortcuts();

  // Initialize default shortcuts if none exist
  if (shortcuts.length === 0) {
    shortcuts = [...DEFAULT_SHORTCUTS];
    await saveShortcuts();
  }

  applyTetoMode();
  applyCustomColor();
  applyBlurSettings();
  updateBannerVisibility();

  loadRandomImage();
  loadWeather();

  setupEventListeners();
  setupCompletions();
  loadVersion();
  checkTetoModeUnlocked();
  checkForUpdates();
  renderShortcuts();

  // Listen for online/offline events
  window.addEventListener('online', () => {
    isOnline = true;
    loadWeather();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    showOfflineWeather();
  });
});

// Load Settings
async function loadSettings() {
  const savedSettings = await window.MikuStorage.getSettings();
  if (savedSettings && Object.keys(savedSettings).length > 0) {
    settings = { ...settings, ...savedSettings };
  }

  const savedEngine = await window.MikuStorage.getOtherData('currentEngine');
  if (savedEngine) {
    currentEngine = savedEngine;
    updateActiveEngine();
  }
}

// Save Settings
async function saveSettings() {
  await window.MikuStorage.saveSettings(settings);
  showToast('Saved!');
}

// Load Shortcuts
async function loadShortcuts() {
  const savedShortcuts = await window.MikuStorage.getShortcuts();
  if (savedShortcuts && savedShortcuts.length > 0) {
    shortcuts = savedShortcuts;
  }
}

// Save Shortcuts
async function saveShortcuts() {
  await window.MikuStorage.saveShortcuts(shortcuts);
}

// Weather Functions
async function loadWeather() {
  const weatherDisplay = document.getElementById('weatherDisplay');
  if (!weatherDisplay) return;

  if (!isOnline) {
    showOfflineWeather();
    return;
  }

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
    });

    const { latitude, longitude } = position.coords;

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m,is_day&temperature_unit=celsius&windspeed_unit=kmh`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json();

    const tempC = Math.round(data.current.temperature_2m);
    const weatherCode = data.current.weathercode;
    const windSpeed = data.current.windspeed_10m;
    const isDay = data.current.is_day;

    weatherDisplay.dataset.tempC = tempC;
    const weatherCondition = getWeatherCondition(weatherCode, windSpeed, isDay);

    updateWeatherDisplay(weatherCondition, tempC);
    weatherDisplay.style.display = 'flex';
  } catch (error) {
    console.log('Could not load weather:', error);
    if (error.code === 1) { // PERMISSION_DENIED
      showPermissionWeather();
    } else {
      showOfflineWeather();
    }
  }
}



function updateWeatherDisplay(condition, tempC) {
  const weatherDisplay = document.getElementById('weatherDisplay');
  const unit = settings.tempUnit || 'celsius';
  const temp = unit === 'fahrenheit' ? celsiusToFahrenheit(tempC) : tempC;
  const symbol = unit === 'fahrenheit' ? '°F' : '°C';

  weatherDisplay.innerHTML = `
    <span class="nf nf-md-weather_partly_cloudy"></span>
    <span>${condition} ${temp}${symbol}</span>
  `;
  weatherDisplay.style.cursor = 'pointer';
}

function celsiusToFahrenheit(c) {
  return Math.round((c * 9 / 5) + 32);
}



// Load Random Image from Repo with IndexedDB Caching
async function loadRandomImage() {
  const bgLayer = document.querySelector('.background-layer');

  if (settings.customBg) {
    bgLayer.style.backgroundImage = `url(${settings.customBg})`;
    applyBackgroundDisplayMode(bgLayer);
    return;
  }

  applyFallbackGradient(bgLayer);

  if (!isOnline) {
    await loadRandomCachedImage(bgLayer);
    return;
  }

  try {
    // Determine which folder(s) to use
    let countFile, imagesFolder, isTeto;

    if (settings.tetoMikuMode && settings.tetoMode) {
      // Mixed mode: randomly choose between Miku and Teto
      isTeto = Math.random() < 0.5;
      countFile = isTeto ? TETO_IMAGES_COUNT_FILE : IMAGES_COUNT_FILE;
      imagesFolder = isTeto ? TETO_IMAGES_FOLDER : IMAGES_FOLDER;
    } else if (settings.tetoMode) {
      // Teto only
      countFile = TETO_IMAGES_COUNT_FILE;
      imagesFolder = TETO_IMAGES_FOLDER;
      isTeto = true;
    } else {
      // Miku only
      countFile = IMAGES_COUNT_FILE;
      imagesFolder = IMAGES_FOLDER;
      isTeto = false;
    }

    // Add cache-busting parameters to force fresh fetch every time
    const cacheBuster = `?t=${Date.now()}`;
    const response = await fetch(countFile + cacheBuster, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store'
    });
    const text = await response.text();
    const imageCount = parseInt(text.trim());

    if (isNaN(imageCount) || imageCount <= 0) {
      console.error('Invalid image count:', text);
      await loadRandomCachedImage(bgLayer);
      return;
    }

    // Get favorites list
    const favorites = await window.MikuStorage.getFavorites(isTeto);

    // Weighted random selection (favorites have 3x chance)
    let randomNum;
    if (favorites.length > 0 && Math.random() < 0.6) {
      // 60% chance to pick a favorite
      randomNum = favorites[Math.floor(Math.random() * favorites.length)];
    } else {
      randomNum = Math.floor(Math.random() * imageCount) + 1;
    }

    const imageUrl = `${imagesFolder}/${randomNum}.png`;

    showLoadingIndicator();

    const imgResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    const contentLength = imgResponse.headers.get('content-length');
    const total = parseInt(contentLength, 10);
    let loaded = 0;

    const reader = imgResponse.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.length;

      if (total) {
        const percentage = Math.round((loaded / total) * 100);
        updateLoadingProgress(percentage);
      }
    }

    const blob = new Blob(chunks);
    const fileReader = new FileReader();

    fileReader.onloadend = async () => {
      const base64data = fileReader.result;

      // Get cached images from IndexedDB
      let cachedArray = await window.MikuStorage.getCachedImages(isTeto);

      // Check if this image is already cached
      const exists = cachedArray.some(img => img.url === imageUrl);
      if (!exists) {
        const deleteThreshold = isTeto ? 7 : 15;

        if (cachedArray.length >= deleteThreshold) {
          // Sort by size and keep smallest images
          cachedArray.sort((a, b) => (a.size || 0) - (b.size || 0));
          cachedArray = cachedArray.slice(0, deleteThreshold - 1);
        }

        cachedArray.push({ url: imageUrl, data: base64data, size: base64data.length, num: randomNum });
        await window.MikuStorage.saveCachedImages(cachedArray, isTeto);
      }

      bgLayer.style.backgroundImage = `url(${base64data})`;
      applyBackgroundDisplayMode(bgLayer);

      // Show star button if not custom wallpaper
      showStarButton(randomNum, isTeto);

      hideLoadingIndicator();
    };

    fileReader.readAsDataURL(blob);

  } catch (error) {
    console.error('Error loading random image (offline?):', error);
    hideLoadingIndicator();
    await loadRandomCachedImage(bgLayer);
  }
}

// Load random cached image when offline
async function loadRandomCachedImage(bgLayer) {
  try {
    const isTeto = settings.tetoMode && !settings.tetoMikuMode;
    const cachedArray = await window.MikuStorage.getCachedImages(isTeto);

    if (cachedArray.length > 0) {
      const randomIndex = Math.floor(Math.random() * cachedArray.length);
      const randomCached = cachedArray[randomIndex];
      bgLayer.style.backgroundImage = `url(${randomCached.data})`;
      applyBackgroundDisplayMode(bgLayer);

      // Show star button
      if (randomCached.num) {
        showStarButton(randomCached.num, isTeto);
      }

      console.log('Loaded cached image (offline mode)');
    } else {
      console.log('No cached images available, using gradient');
    }
  } catch (error) {
    console.error('Error loading cached image:', error);
  }
}

// Star button functionality
function showStarButton(imageNum, isTeto) {
  if (settings.customBg) return; // Don't show for custom wallpapers

  let starBtn = document.getElementById('starBtn');
  if (!starBtn) return;

  starBtn.dataset.imageNum = imageNum;
  starBtn.dataset.isTeto = isTeto;

  // Check if this image is a favorite
  window.MikuStorage.getFavorites(isTeto).then(favorites => {
    if (favorites.includes(imageNum)) {
      starBtn.classList.add('active');
    } else {
      starBtn.classList.remove('active');
    }
  });

  starBtn.style.display = 'flex';
}

function hideStarButton() {
  const starBtn = document.getElementById('starBtn');
  if (starBtn) {
    starBtn.style.display = 'none';
  }
}

// Apply Background Display Mode
function applyBackgroundDisplayMode(bgLayer) {
  const modes = {
    cover: { size: 'cover', position: 'center', repeat: 'no-repeat' },
    contain: { size: 'contain', position: 'center', repeat: 'no-repeat' },
    fill: { size: '100% 100%', position: 'center', repeat: 'no-repeat' },
    stretch: { size: '100% 100%', position: 'center', repeat: 'no-repeat' },
    tile: { size: 'auto', position: 'top left', repeat: 'repeat' }
  };

  const mode = modes[settings.bgDisplayMode] || modes.cover;
  bgLayer.style.backgroundSize = mode.size;
  bgLayer.style.backgroundPosition = mode.position;
  bgLayer.style.backgroundRepeat = mode.repeat;
}

function showLoadingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'wallpaperLoader';
  indicator.className = 'wallpaper-loader';
  indicator.innerHTML = `
    <span class="nf nf-md-download"></span>
    <span class="loader-text">loading wallpapah <span class="loader-percentage">0%</span></span>
  `;
  document.body.appendChild(indicator);
  setTimeout(() => indicator.classList.add('active'), 10);
}

function updateLoadingProgress(percentage) {
  const loader = document.getElementById('wallpaperLoader');
  if (loader) {
    const percentageEl = loader.querySelector('.loader-percentage');
    if (percentageEl) percentageEl.textContent = `${percentage}%`;
  }
}

function hideLoadingIndicator() {
  const loader = document.getElementById('wallpaperLoader');
  if (loader) {
    loader.classList.remove('active');
    setTimeout(() => loader.remove(), 300);
  }
}

function applyFallbackGradient(bgLayer) {
  if (settings.customColorEnabled && settings.customBg) {
    const color = settings.customColor;
    bgLayer.style.background = `linear-gradient(135deg, ${color} 0%, ${adjustColorBrightness(color, -20)} 100%)`;
  } else {
    const gradient = settings.tetoMode
      ? 'linear-gradient(135deg, #ff9999 0%, #ff6b6b 100%)'
      : 'linear-gradient(135deg, #9ee5ff 0%, #68c3ff 100%)';
    bgLayer.style.background = gradient;
  }
}

function applyTetoMode() {
  document.body.classList.toggle('teto-mode', settings.tetoMode);
}

function applyCustomColor() {
  const body = document.body;
  if (settings.customColorEnabled) {
    body.classList.add('custom-color');
    const color = settings.customColor;
    document.documentElement.style.setProperty('--custom-primary', color);
    document.documentElement.style.setProperty('--custom-primary-dark', adjustColorBrightness(color, -20));
    document.documentElement.style.setProperty('--custom-primary-light', adjustColorBrightness(color, 20));
    document.documentElement.style.setProperty('--custom-primary-lighter', adjustColorBrightness(color, 40));
  } else {
    body.classList.remove('custom-color');
  }
}

function adjustColorBrightness(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
}

function applyBlurSettings() {
  const bgLayer = document.querySelector('.background-layer');
  const blurElements = document.querySelectorAll('.search-engine-selector, .search-bar-wrapper, .shortcut-card, .settings-btn, .donate-banner, .weather-display');

  if (settings.blurEnabled) {
    blurElements.forEach(el => el.classList.add('blur'));
    bgLayer.classList.toggle('blur', settings.wallpaperBlur);
  } else {
    bgLayer.classList.remove('blur');
    blurElements.forEach(el => el.classList.remove('blur'));
  }
}

function updateBannerVisibility() {
  const banner = document.querySelector('.donate-banner');
  if (banner) {
    banner.style.display = settings.bannerHidden ? 'none' : 'flex';
  }
}

async function hideBanner() {
  settings.bannerHidden = true;
  await saveSettings();
  updateBannerVisibility();
}

function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch (e) {
    return null;
  }
}

async function getCachedFavicon(url) {
  const faviconUrl = getFaviconUrl(url);
  if (!faviconUrl) return null;

  const cached = await window.MikuStorage.getCachedFavicon(url);
  if (cached) return cached;

  // Cache the favicon
  try {
    const response = await fetch(faviconUrl);
    const blob = await response.blob();
    const reader = new FileReader();

    return new Promise((resolve) => {
      reader.onloadend = async () => {
        const base64 = reader.result;
        await window.MikuStorage.saveCachedFavicon(url, base64);
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error caching favicon:', error);
    return faviconUrl;
  }
}

function setupEventListeners() {
  document.querySelectorAll('.engine-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentEngine = btn.dataset.engine;
      await window.MikuStorage.saveOtherData('currentEngine', currentEngine);
      updateActiveEngine();
    });
  });

  const searchBar = document.querySelector('.search-bar');
  const searchSubmit = document.querySelector('.search-submit');

  searchBar.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  searchSubmit.addEventListener('click', () => {
    performSearch();
  });

  document.getElementById('settingsBtn').addEventListener('click', () => {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.classList.add('active');
      updateUI();
      // Setup settings event listeners if not done yet
      if (!modal.dataset.initialized) {
        setupSettingsEventListeners();
        modal.dataset.initialized = 'true';
      }
    } else {
      chrome.runtime.openOptionsPage();
    }
  });

  const closeSettingsModal = document.getElementById('closeSettingsModal');
  if (closeSettingsModal) {
    closeSettingsModal.addEventListener('click', () => {
      document.getElementById('settingsModal').classList.remove('active');
    });
  }

  const bannerClose = document.getElementById('bannerClose');
  if (bannerClose) {
    bannerClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideBanner();
    });
  }

  const weatherDisplay = document.getElementById('weatherDisplay');
  if (weatherDisplay) {
    weatherDisplay.addEventListener('click', async () => {
      if (!isOnline || !weatherDisplay.dataset.tempC) return;

      settings.tempUnit = settings.tempUnit === 'celsius' ? 'fahrenheit' : 'celsius';
      await saveSettings();

      const tempC = parseInt(weatherDisplay.dataset.tempC);
      const weatherText = weatherDisplay.textContent.split(' ')[0];
      updateWeatherDisplay(weatherText, tempC);
    });
  }

  const starBtn = document.getElementById('starBtn');
  if (starBtn) {
    starBtn.addEventListener('click', async () => {
      const isTeto = starBtn.dataset.isTeto === 'true';
      const imageNum = parseInt(starBtn.dataset.imageNum, 10);

      const favorites = await window.MikuStorage.getFavorites(isTeto);
      const index = favorites.indexOf(imageNum);

      if (index > -1) {
        favorites.splice(index, 1);
        starBtn.classList.remove('active');
      } else {
        favorites.push(imageNum);
        starBtn.classList.add('active');
      }

      await window.MikuStorage.saveFavorites(favorites, isTeto);
    });
  }
}

function updateActiveEngine() {
  document.querySelectorAll('.engine-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.engine === currentEngine);
  });
}

function performSearch() {
  const query = document.querySelector('.search-bar').value.trim();
  if (query) {
    window.location.href = searchEngines[currentEngine] + encodeURIComponent(query);
  }
}

async function renderShortcuts() {
  const grid = document.getElementById('shortcutsGrid');
  grid.innerHTML = '';

  const maxSlots = 14;

  for (let i = 0; i < shortcuts.length; i++) {
    const card = await createShortcutCard(shortcuts[i], i);
    grid.appendChild(card);
  }

  for (let i = shortcuts.length; i < maxSlots; i++) {
    const addCard = createAddButton();
    grid.appendChild(addCard);
  }

  applyBlurSettings();
}

async function createShortcutCard(shortcut, index) {
  const card = document.createElement('a');
  card.className = 'shortcut-card';
  card.href = shortcut.url;

  const cachedFavicon = await getCachedFavicon(shortcut.url);
  const iconHtml = cachedFavicon
    ? `<img src="${cachedFavicon}" class="shortcut-favicon" alt="${escapeHtml(shortcut.title)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
       <div class="shortcut-icon nf nf-md-link_variant" style="display: none;"></div>`
    : `<div class="shortcut-icon nf nf-md-link_variant"></div>`;

  card.innerHTML = `
    ${iconHtml}
    <div class="shortcut-title">${escapeHtml(shortcut.title)}</div>
    <button class="delete-shortcut nf nf-md-close"></button>
  `;

  const deleteBtn = card.querySelector('.delete-shortcut');
  deleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    shortcuts.splice(index, 1);
    saveShortcuts();
    renderShortcuts();
  });

  return card;
}

function createAddButton() {
  const card = document.createElement('div');
  card.className = 'shortcut-card add-btn';
  card.innerHTML = `
    <div class="shortcut-icon nf nf-md-plus"></div>
    <div class="shortcut-title">Add</div>
  `;

  card.addEventListener('click', () => showAddShortcutModal());

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  card.addEventListener('drop', async (e) => {
    e.preventDefault();
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url && isValidUrl(url)) {
      shortcuts.push({ title: 'untitled', url });
      await saveShortcuts();
      renderShortcuts();
    }
  });

  return card;
}

function showAddShortcutModal() {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Add Shortcut</h2>
      <input type="text" id="shortcutTitle" placeholder="Title" maxlength="50" />
      <input type="url" id="shortcutUrl" placeholder="URL (https://...)" />
      <div class="modal-buttons">
        <button class="modal-btn secondary" id="cancelBtn">Cancel</button>
        <button class="modal-btn primary" id="addBtn">Add</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.getElementById('cancelBtn').addEventListener('click', () => modal.remove());

  document.getElementById('addBtn').addEventListener('click', async () => {
    const title = document.getElementById('shortcutTitle').value.trim();
    const url = document.getElementById('shortcutUrl').value.trim();

    if (title && url && isValidUrl(url)) {
      shortcuts.push({ title, url });
      await saveShortcuts();
      renderShortcuts();
      modal.remove();
    } else {
      alert('Please enter a valid title and URL (must start with http:// or https://)');
    }
  });

  const inputs = modal.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') document.getElementById('addBtn').click();
    });
  });

  setTimeout(() => document.getElementById('shortcutTitle').focus(), 100);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function showOfflineWeather() {
  const weatherDisplay = document.getElementById('weatherDisplay');
  if (!weatherDisplay) return;
  weatherDisplay.innerHTML = `<span class="nf nf-md-cloud_off_outline"></span><span>No Internet~</span>`;
  weatherDisplay.style.display = 'flex';
  weatherDisplay.style.cursor = 'default';
}

function showPermissionWeather() {
  const weatherDisplay = document.getElementById('weatherDisplay');
  if (!weatherDisplay) return;
  weatherDisplay.innerHTML = `<span class="nf nf-md-alert_circle_outline"></span><span style="font-size: 0.85rem;">Weather for weather wont work cuz no Location perms</span>`;
  weatherDisplay.style.display = 'flex';
  weatherDisplay.style.cursor = 'default';
}

function getWeatherCondition(code, windSpeed, isDay) {
  if (code === 0) return isDay ? 'Clear' : 'Moon';
  if (code === 1 || code === 2) return isDay ? 'Sunny' : 'Clear';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 55) return 'Drizzly';
  if (code >= 61 && code <= 65) return 'Rainy';
  if (code >= 71 && code <= 77) return 'Snowy';
  if (code >= 80 && code <= 82) return 'Rainy';
  if (code >= 85 && code <= 86) return 'Snowy';
  if (code >= 95 && code <= 99) return 'Stormy';
  if (windSpeed > 30) return 'Windy';
  return isDay ? 'Sunny' : 'Clear';
}
let suggestionTimeout;
function setupCompletions() {
  const searchBar = document.querySelector('.search-bar');
  const searchContainer = document.querySelector('.search-container');
  if (!searchBar || !searchContainer) return;

  let suggestionsDropdown = document.querySelector('.suggestions-dropdown');
  if (!suggestionsDropdown) {
    suggestionsDropdown = document.createElement('div');
    suggestionsDropdown.className = 'suggestions-dropdown';
    searchContainer.appendChild(suggestionsDropdown);
  }

  let currentFocus = -1;

  searchBar.addEventListener('input', (e) => {
    clearTimeout(suggestionTimeout);
    const val = e.target.value.trim();
    if (!val) {
      suggestionsDropdown.classList.remove('active');
      return;
    }

    suggestionTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(val)}`);
        const data = await res.json();
        const suggestions = data[1] || [];

        suggestionsDropdown.innerHTML = '';
        if (suggestions.length === 0) {
          suggestionsDropdown.classList.remove('active');
          return;
        }

        suggestions.forEach((item) => {
          const div = document.createElement('div');
          div.className = 'suggestion-item';
          div.innerHTML = `<span class="suggestion-icon nf nf-md-magnify"></span><span>${escapeHtml(item)}</span>`;
          div.addEventListener('click', () => {
            searchBar.value = item;
            suggestionsDropdown.classList.remove('active');
            performSearch();
          });
          suggestionsDropdown.appendChild(div);
        });

        if (settings.blurEnabled) {
          suggestionsDropdown.classList.add('blur');
        } else {
          suggestionsDropdown.classList.remove('blur');
        }

        suggestionsDropdown.classList.add('active');
        currentFocus = -1;
      } catch (err) {
        console.error('Failed to fetch suggestions', err);
      }
    }, 150);
  });

  searchBar.addEventListener('keydown', (e) => {
    let items = suggestionsDropdown.querySelectorAll('.suggestion-item');
    if (!suggestionsDropdown.classList.contains('active') || items.length === 0) return;

    if (e.key === 'ArrowDown') {
      currentFocus++;
      addActive(items);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      currentFocus--;
      addActive(items);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (currentFocus > -1) {
        e.preventDefault();
        items[currentFocus].click();
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target !== searchBar) {
      suggestionsDropdown.classList.remove('active');
    }
  });

  function addActive(items) {
    if (!items) return false;
    items.forEach(item => item.classList.remove('selected'));
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (items.length - 1);
    items[currentFocus].classList.add('selected');
    searchBar.value = items[currentFocus].textContent;
  }
}

async function loadVersion() {
  try {
    const response = await fetch(chrome.runtime.getURL('manifest.json'));
    const manifest = await response.json();
    document.getElementById('versionNumber').textContent = manifest.version;
  } catch (error) {
    document.getElementById('versionNumber').textContent = 'Unknown';
  }
}

async function checkForUpdates() {
  try {
    const localManifest = await fetch(chrome.runtime.getURL('manifest.json')).then(r => r.json());
    const remoteManifest = await fetch(REPO_MANIFEST_URL).then(r => r.json());

    if (localManifest.version !== remoteManifest.version) {
      showUpdateAvailable(localManifest.version, remoteManifest.version);
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }
}

function showUpdateAvailable(currentVersion, newVersion) {
  const updateBanner = document.createElement('div');
  updateBanner.className = 'update-banner';
  updateBanner.innerHTML = `
    <div class="update-content">
      <span class="nf nf-md-update"></span>
      <div class="update-info">
        <strong>Update Available!</strong>
        <p>Version ${newVersion} is available (you have ${currentVersion})</p>
      </div>
      <button class="btn secondary" id="downloadUpdate">
        <span class="nf nf-md-download"></span> Download Update
      </button>
      <button class="update-close nf nf-md-close"></button>
    </div>
  `;

  document.querySelector('.container').insertBefore(updateBanner, document.querySelector('header'));

  document.getElementById('downloadUpdate').addEventListener('click', () => {
    window.open(LATEST_RELEASE_URL, '_blank');
    showUpdateInstructions(newVersion);
  });

  updateBanner.querySelector('.update-close').addEventListener('click', () => {
    updateBanner.remove();
  });
}

async function showUpdateInstructions(newVersion) {
  try {
    const updateMdUrl = 'https://raw.githubusercontent.com/MalikHw/MikuTheme/main/UPDATE.md';
    const response = await fetch(updateMdUrl);
    const instructions = await response.text();

    showUpdateModal(instructions, newVersion);
  } catch (error) {
    console.error('Failed to load update instructions:', error);
  }
}

function showUpdateModal(markdownContent, version) {
  const modal = document.createElement('div');
  modal.className = 'modal active update-modal';

  const htmlContent = markdownContent
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hl])/gim, '<p>')
    .replace(/<\/li>\n<li>/g, '</li><li>')
    .replace(/<li>/g, '<ul><li>')
    .replace(/<\/li>(?!\s*<li>)/g, '</li></ul>');

  modal.innerHTML = `
    <div class="modal-content update-instructions">
      <div class="update-header">
        <h2><span class="nf nf-md-information"></span> Update Instructions</h2>
        <button class="update-modal-close nf nf-md-close"></button>
      </div>
      <div class="update-body">
        ${htmlContent}
      </div>
      <div class="modal-buttons">
        <button class="modal-btn primary" id="closeInstructions">Got it!</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.update-modal-close').addEventListener('click', () => modal.remove());
  document.getElementById('closeInstructions').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

async function checkTetoModeUnlocked() {
  const unlocked = await window.MikuStorage.getOtherData('tetoModeUnlocked');
  if (unlocked) {
    tetoModeUnlocked = true;
    showTetoMode();
  }
}

async function unlockTetoMode() {
  tetoModeUnlocked = true;
  await window.MikuStorage.saveOtherData('tetoModeUnlocked', true);
  showToast('🔴 Teto Mode Unlocked! Refreshing...', false);
  setTimeout(() => location.reload(), 1000);
}

function showTetoMode() {
  const tetoContainer = document.getElementById('tetoModeContainer');
  tetoContainer.style.display = 'flex';
  tetoContainer.style.animation = 'slideDown 0.5s ease';

  const tetoMikuContainer = document.getElementById('tetoMikuModeContainer');
  tetoMikuContainer.style.display = 'flex';
  tetoMikuContainer.style.animation = 'slideDown 0.5s ease';
}

async function clearImageCache() {
  try {
    await window.MikuStorage.clearAllImageCaches();
    showToast('Image cache cleared! Refresh the new tab page to load a new image.');
  } catch (error) {
    showToast('Failed to clear cache', true);
  }
}

async function clearFaviconCache() {
  try {
    await window.MikuStorage.clearFaviconCache();
    showToast('Favicon cache cleared!');
  } catch (error) {
    showToast('Failed to clear favicon cache', true);
  }
}

function setupSettingsEventListeners() {
  const blurToggle = document.getElementById('blurToggle');
  blurToggle.addEventListener('change', () => {
    settings.blurEnabled = blurToggle.checked;
    saveSettings();
  });

  const wallpaperBlurToggle = document.getElementById('wallpaperBlurToggle');
  wallpaperBlurToggle.addEventListener('change', () => {
    settings.wallpaperBlur = wallpaperBlurToggle.checked;
    saveSettings();
  });

  const tetoModeToggle = document.getElementById('tetoModeToggle');
  tetoModeToggle.addEventListener('change', async () => {
    settings.tetoMode = tetoModeToggle.checked;

    if (!settings.tetoMode) {
      settings.tetoMikuMode = false;
      document.getElementById('tetoMikuModeToggle').checked = false;
    }

    await saveSettings();
    applyTetoMode();
    updateTetoMikuToggleState();
  });

  const tetoMikuModeToggle = document.getElementById('tetoMikuModeToggle');
  tetoMikuModeToggle.addEventListener('change', async () => {
    settings.tetoMikuMode = tetoMikuModeToggle.checked;
    await saveSettings();
  });

  const bgDisplaySelect = document.getElementById('bgDisplayMode');
  bgDisplaySelect.addEventListener('change', async () => {
    settings.bgDisplayMode = bgDisplaySelect.value;
    await saveSettings();
    updateBackgroundPreview();
  });

  const customColorToggle = document.getElementById('customColorToggle');
  customColorToggle.addEventListener('change', async () => {
    settings.customColorEnabled = customColorToggle.checked;
    await saveSettings();
    applyCustomColor();
  });

  const customColorPicker = document.getElementById('customColorPicker');
  customColorPicker.addEventListener('input', async (e) => {
    settings.customColor = e.target.value;
    await saveSettings();
    applyCustomColor();
  });

  const uploadBtn = document.getElementById('uploadBtn');
  const bgUpload = document.getElementById('bgUpload');

  uploadBtn.addEventListener('click', () => bgUpload.click());
  bgUpload.addEventListener('change', handleImageUpload);

  const resetBgBtn = document.getElementById('resetBgBtn');
  resetBgBtn.addEventListener('click', resetBackground);

  const clearCacheBtn = document.getElementById('clearCacheBtn');
  clearCacheBtn.addEventListener('click', clearImageCache);

  const clearFaviconBtn = document.getElementById('clearFaviconBtn');
  if (clearFaviconBtn) {
    clearFaviconBtn.addEventListener('click', clearFaviconCache);
  }

  const versionDisplay = document.getElementById('versionDisplay');
  versionDisplay.addEventListener('click', () => {
    if (tetoModeUnlocked) return;

    versionClickCount++;

    if (versionClickCount === 5) {
      unlockTetoMode();
    } else if (versionClickCount >= 3) {
      versionDisplay.style.transform = 'scale(1.1)';
      setTimeout(() => versionDisplay.style.transform = 'scale(1)', 200);
    }
  });
}

function updateTetoMikuToggleState() {
  const tetoMikuToggle = document.getElementById('tetoMikuModeToggle');
  tetoMikuToggle.disabled = !settings.tetoMode;

  if (!settings.tetoMode) {
    tetoMikuToggle.checked = false;
    settings.tetoMikuMode = false;
  }
}

function updateUI() {
  document.getElementById('blurToggle').checked = settings.blurEnabled;
  document.getElementById('wallpaperBlurToggle').checked = settings.wallpaperBlur;
  document.getElementById('tetoModeToggle').checked = settings.tetoMode;
  document.getElementById('tetoMikuModeToggle').checked = settings.tetoMikuMode;
  document.getElementById('bgDisplayMode').value = settings.bgDisplayMode || 'cover';
  document.getElementById('customColorToggle').checked = settings.customColorEnabled;
  document.getElementById('customColorPicker').value = settings.customColor || '#68c3ff';

  updateBackgroundPreview();
  updateTetoMikuToggleState();

  if (settings.tetoMode) {
    applyTetoMode();
  }

  if (settings.customColorEnabled) {
    applyCustomColor();
  }
}

function updateBackgroundPreview() {
  const bgPreview = document.getElementById('bgPreview');
  if (settings.customBg) {
    bgPreview.style.backgroundImage = `url(${settings.customBg})`;

    const modes = {
      cover: { size: 'cover', position: 'center' },
      contain: { size: 'contain', position: 'center' },
      fill: { size: '100% 100%', position: 'center' },
      stretch: { size: '100% 100%', position: 'center' },
      tile: { size: 'auto', position: 'top left', repeat: 'repeat' }
    };

    const mode = modes[settings.bgDisplayMode] || modes.cover;
    bgPreview.style.backgroundSize = mode.size;
    bgPreview.style.backgroundPosition = mode.position;
    bgPreview.style.backgroundRepeat = mode.repeat || 'no-repeat';

    bgPreview.classList.add('active');
  } else {
    bgPreview.classList.remove('active');
  }
}

async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file!', true);
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('Image too large! Max size is 5MB.', true);
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    settings.customBg = e.target.result;
    await saveSettings();
    updateUI();
    showToast('Background image uploaded!');
  };
  reader.readAsDataURL(file);
}

async function resetBackground() {
  settings.customBg = null;
  settings.customColorEnabled = false;
  await saveSettings();
  updateUI();
  showToast('Background reset to random!');
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.background = isError ? '#ff4757' : 'white';
  toast.style.color = isError ? 'white' : '#202124';
  toast.classList.add('show');

  setTimeout(() => toast.classList.remove('show'), 3000);
}