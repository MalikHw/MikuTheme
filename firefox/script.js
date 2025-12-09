// script.js - Main script using IndexedDB (Firefox compatible)

// Search Engines Configuration
const searchEngines = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  yandex: 'https://yandex.com/search/?text=',
  brave: 'https://search.brave.com/search?q='
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
  bgDisplayMode: 'cover',
  customColorEnabled: false,
  customColor: '#68c3ff',
  tempUnit: 'celsius'
};
let isOnline = navigator.onLine;

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
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=celsius&windspeed_unit=kmh`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json();

    const tempC = Math.round(data.current.temperature_2m);
    const weatherCode = data.current.weathercode;
    const windSpeed = data.current.windspeed_10m;

    weatherDisplay.dataset.tempC = tempC;
    const weatherCondition = getWeatherCondition(weatherCode, windSpeed);

    updateWeatherDisplay(weatherCondition, tempC);
    weatherDisplay.style.display = 'flex';
  } catch (error) {
    console.log('Could not load weather:', error);
    showOfflineWeather();
  }
}

function showOfflineWeather() {
  const weatherDisplay = document.getElementById('weatherDisplay');
  if (!weatherDisplay) return;
  
  weatherDisplay.innerHTML = `
    <span class="nf nf-md-cloud_off_outline"></span>
    <span>No Internet~</span>
  `;
  weatherDisplay.style.display = 'flex';
  weatherDisplay.style.cursor = 'default';
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
  return Math.round((c * 9/5) + 32);
}

function getWeatherCondition(code, windSpeed) {
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2) return 'Sunny';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 55) return 'Drizzly';
  if (code >= 61 && code <= 65) return 'Rainy';
  if (code >= 71 && code <= 77) return 'Snowy';
  if (code >= 80 && code <= 82) return 'Rainy';
  if (code >= 85 && code <= 86) return 'Snowy';
  if (code >= 95 && code <= 99) return 'Stormy';
  if (windSpeed > 30) return 'Windy';
  return 'Sunny';
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
    const countFile = settings.tetoMode ? TETO_IMAGES_COUNT_FILE : IMAGES_COUNT_FILE;
    const imagesFolder = settings.tetoMode ? TETO_IMAGES_FOLDER : IMAGES_FOLDER;
    
    const response = await fetch(countFile, { signal: AbortSignal.timeout(5000) });
    const text = await response.text();
    const imageCount = parseInt(text.trim());
    
    if (isNaN(imageCount) || imageCount <= 0) {
      console.error('Invalid image count:', text);
      await loadRandomCachedImage(bgLayer);
      return;
    }
    
    const randomNum = Math.floor(Math.random() * imageCount) + 1;
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
      let cachedArray = await window.MikuStorage.getCachedImages(settings.tetoMode);
      
      // Check if this image is already cached
      const exists = cachedArray.some(img => img.url === imageUrl);
      if (!exists) {
        const deleteThreshold = settings.tetoMode ? 7 : 15;
        
        if (cachedArray.length >= deleteThreshold) {
          // Sort by size and keep smallest images
          cachedArray.sort((a, b) => (a.size || 0) - (b.size || 0));
          cachedArray = cachedArray.slice(0, deleteThreshold - 1);
        }
        
        cachedArray.push({ url: imageUrl, data: base64data, size: base64data.length });
        await window.MikuStorage.saveCachedImages(cachedArray, settings.tetoMode);
      }
      
      bgLayer.style.backgroundImage = `url(${base64data})`;
      applyBackgroundDisplayMode(bgLayer);
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
    const cachedArray = await window.MikuStorage.getCachedImages(settings.tetoMode);
    
    if (cachedArray.length > 0) {
      const randomIndex = Math.floor(Math.random() * cachedArray.length);
      const randomCached = cachedArray[randomIndex];
      bgLayer.style.backgroundImage = `url(${randomCached.data})`;
      applyBackgroundDisplayMode(bgLayer);
      console.log('Loaded cached image (offline mode)');
    } else {
      console.log('No cached images available, using gradient');
    }
  } catch (error) {
    console.error('Error loading cached image:', error);
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
  if (settings.customColorEnabled && settings.customBg) {
    body.classList.add('custom-color');
    document.documentElement.style.setProperty('--custom-primary', settings.customColor);
    document.documentElement.style.setProperty('--custom-primary-dark', adjustColorBrightness(settings.customColor, -20));
    document.documentElement.style.setProperty('--custom-primary-light', adjustColorBrightness(settings.customColor, 20));
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
  const blurElements = document.querySelectorAll('.search-engine-selector, .search-bar-wrapper, .shortcut-card, .settings-btn, .kofi-banner, .weather-display');
  
  if (settings.blurEnabled) {
    blurElements.forEach(el => el.classList.add('blur'));
    bgLayer.classList.toggle('blur', settings.wallpaperBlur);
  } else {
    bgLayer.classList.remove('blur');
    blurElements.forEach(el => el.classList.remove('blur'));
  }
}

function updateBannerVisibility() {
  const banner = document.querySelector('.kofi-banner');
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
    // Firefox uses browser.runtime instead of chrome.runtime
    browser.runtime.openOptionsPage();
  });

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
    const card = createShortcutCard(shortcuts[i], i);
    grid.appendChild(card);
  }

  for (let i = shortcuts.length; i < maxSlots; i++) {
    const addCard = createAddButton();
    grid.appendChild(addCard);
  }
  
  applyBlurSettings();
}

function createShortcutCard(shortcut, index) {
  const card = document.createElement('a');
  card.className = 'shortcut-card';
  card.href = shortcut.url;
  
  const faviconUrl = getFaviconUrl(shortcut.url);
  const iconHtml = faviconUrl 
    ? `<img src="${faviconUrl}" class="shortcut-favicon" alt="${escapeHtml(shortcut.title)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
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
