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
  customColor: '#68c3ff'
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
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
  
  setupEventListeners();
  renderShortcuts();
});

// Load Settings
async function loadSettings() {
  const result = await browser.storage.local.get(['settings', 'currentEngine']);
  if (result.settings) {
    settings = { ...settings, ...result.settings };
  }
  if (result.currentEngine) {
    currentEngine = result.currentEngine;
    updateActiveEngine();
  }
}

// Save Settings
async function saveSettings() {
  await browser.storage.local.set({ settings });
}

// Load Shortcuts
async function loadShortcuts() {
  const result = await browser.storage.local.get(['shortcuts']);
  if (result.shortcuts) {
    shortcuts = result.shortcuts;
  }
}

// Save Shortcuts
async function saveShortcuts() {
  await browser.storage.local.set({ shortcuts });
}

// Load Random Image from Repo with Caching and Offline Support
async function loadRandomImage() {
  const bgLayer = document.querySelector('.background-layer');
  
  // Apply display mode
  applyBackgroundDisplayMode(bgLayer);
  
  // If custom background is set, use it
  if (settings.customBg) {
    bgLayer.style.backgroundImage = `url(${settings.customBg})`;
    return;
  }

  // Apply fallback gradient immediately
  applyFallbackGradient(bgLayer);

  try {
    const countFile = settings.tetoMode ? TETO_IMAGES_COUNT_FILE : IMAGES_COUNT_FILE;
    const imagesFolder = settings.tetoMode ? TETO_IMAGES_FOLDER : IMAGES_FOLDER;
    const cacheKey = settings.tetoMode ? 'cachedTetoImage' : 'cachedImage';
    const cacheUrlKey = settings.tetoMode ? 'cachedTetoImageUrl' : 'cachedImageUrl';
    const allCachedKey = settings.tetoMode ? 'allCachedTetoImages' : 'allCachedImages';
    
    const response = await fetch(countFile);
    const text = await response.text();
    const imageCount = parseInt(text.trim());
    
    if (isNaN(imageCount) || imageCount <= 0) {
      console.error('Invalid image count:', text);
      await loadRandomCachedImage(allCachedKey, bgLayer);
      return;
    }
    
    const randomNum = Math.floor(Math.random() * imageCount) + 1;
    const imageUrl = `${imagesFolder}/${randomNum}.png`;
    
    const cached = await browser.storage.local.get([cacheKey, cacheUrlKey]);
    
    if (cached[cacheKey] && cached[cacheUrlKey] === imageUrl) {
      bgLayer.style.backgroundImage = `url(${cached[cacheKey]})`;
      return;
    }
    
    showLoadingIndicator();
    
    const imgResponse = await fetch(imageUrl);
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
      
      // Save to current cache
      await browser.storage.local.set({ 
        [cacheKey]: base64data,
        [cacheUrlKey]: imageUrl 
      });
      
      // Add to all cached images array
      const allCached = await browser.storage.local.get([allCachedKey]);
      const cachedArray = allCached[allCachedKey] || [];
      
      // Check if this image is already cached
      const exists = cachedArray.some(img => img.url === imageUrl);
      if (!exists) {
        const maxCacheSize = settings.tetoMode ? 10 : 20;
        
        // If we've reached max cache size, remove the largest one
        if (cachedArray.length >= maxCacheSize) {
          let largestIndex = 0;
          let largestSize = cachedArray[0]?.data?.length || 0;
          
          for (let i = 1; i < cachedArray.length; i++) {
            const size = cachedArray[i]?.data?.length || 0;
            if (size > largestSize) {
              largestSize = size;
              largestIndex = i;
            }
          }
          
          cachedArray.splice(largestIndex, 1);
        }
        
        cachedArray.push({ url: imageUrl, data: base64data, size: base64data.length });
        await browser.storage.local.set({ [allCachedKey]: cachedArray });
      }
      
      bgLayer.style.backgroundImage = `url(${base64data})`;
      hideLoadingIndicator();
    };
    
    fileReader.readAsDataURL(blob);
    
  } catch (error) {
    console.error('Error loading random image (offline?):', error);
    hideLoadingIndicator();
    const allCachedKey = settings.tetoMode ? 'allCachedTetoImages' : 'allCachedImages';
    await loadRandomCachedImage(allCachedKey, bgLayer);
  }
}

// Load random cached image when offline
async function loadRandomCachedImage(cacheKey, bgLayer) {
  try {
    const cached = await browser.storage.local.get([cacheKey]);
    const cachedArray = cached[cacheKey] || [];
    
    if (cachedArray.length > 0) {
      const randomIndex = Math.floor(Math.random() * cachedArray.length);
      const randomCached = cachedArray[randomIndex];
      bgLayer.style.backgroundImage = `url(${randomCached.data})`;
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
    cover: { size: 'cover', position: 'center' },
    contain: { size: 'contain', position: 'center' },
    fill: { size: '100% 100%', position: 'center' },
    stretch: { size: '100% 100%', position: 'center' },
    tile: { size: 'auto', position: 'top left', repeat: 'repeat' }
  };
  
  const mode = modes[settings.bgDisplayMode] || modes.cover;
  bgLayer.style.backgroundSize = mode.size;
  bgLayer.style.backgroundPosition = mode.position;
  bgLayer.style.backgroundRepeat = mode.repeat || 'no-repeat';
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
  const blurElements = document.querySelectorAll('.search-engine-selector, .search-bar-wrapper, .shortcut-card, .settings-btn, .kofi-banner');
  
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

// Get and cache favicon
async function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    
    const cacheKey = `favicon_${domain}`;
    const cached = await browser.storage.local.get([cacheKey]);
    
    if (cached[cacheKey]) {
      return cached[cacheKey];
    }
    
    try {
      const response = await fetch(faviconUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      
      return new Promise((resolve) => {
        reader.onloadend = async () => {
          const base64data = reader.result;
          await browser.storage.local.set({ [cacheKey]: base64data });
          resolve(base64data);
        };
        reader.readAsDataURL(blob);
      });
    } catch (fetchError) {
      console.log('Could not cache favicon:', fetchError);
      return faviconUrl;
    }
  } catch (e) {
    return null;
  }
}

function setupEventListeners() {
  document.querySelectorAll('.engine-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentEngine = btn.dataset.engine;
      browser.storage.local.set({ currentEngine });
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
  
  const shortcutPromises = shortcuts.map(async (shortcut, index) => {
    return await createShortcutCard(shortcut, index);
  });
  
  const shortcutCards = await Promise.all(shortcutPromises);
  shortcutCards.forEach(card => grid.appendChild(card));

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
  
  const faviconUrl = await getFaviconUrl(shortcut.url);
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
      await getFaviconUrl(url);
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