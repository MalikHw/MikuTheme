// Search Engines Configuration
const searchEngines = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  yandex: 'https://yandex.com/search/?text=',
  brave: 'https://search.brave.com/search?q='
};

let currentEngine = 'google';
let shortcuts = [];
let settings = { blurEnabled: false, wallpaperBlur: false, customBg: null };

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadShortcuts();
  await loadBackground();
  setupEventListeners();
  renderShortcuts();
  applyBlurSettings();
});

// Load Settings
async function loadSettings() {
  const result = await chrome.storage.local.get(['settings', 'currentEngine']);
  if (result.settings) {
    settings = result.settings;
  }
  if (result.currentEngine) {
    currentEngine = result.currentEngine;
    updateActiveEngine();
  }
}

// Load Shortcuts
async function loadShortcuts() {
  const result = await chrome.storage.local.get(['shortcuts']);
  if (result.shortcuts) {
    shortcuts = result.shortcuts;
  }
}

// Save Shortcuts
async function saveShortcuts() {
  await chrome.storage.local.set({ shortcuts });
}

// Load Background
async function loadBackground() {
  const bgLayer = document.querySelector('.background-layer');
  
  if (settings.customBg) {
    bgLayer.style.backgroundImage = `url(${settings.customBg})`;
  } else {
    try {
      // Try to fetch a random image from the GitHub repo
      const randomId = Math.floor(Math.random() * 100) + 1;
      const imageUrl = `https://raw.githubusercontent.com/MalikHw/MikuTheme/main/images/${randomId}.png`;
      
      // Test if image exists
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (response.ok) {
        bgLayer.style.backgroundImage = `url(${imageUrl})`;
      } else {
        // Fallback gradient
        bgLayer.style.background = 'linear-gradient(135deg, #9ee5ff 0%, #68c3ff 100%)';
      }
    } catch (error) {
      // Fallback gradient
      bgLayer.style.background = 'linear-gradient(135deg, #9ee5ff 0%, #68c3ff 100%)';
    }
  }
}

// Apply Blur Settings - Now applies to all UI elements
function applyBlurSettings() {
  const bgLayer = document.querySelector('.background-layer');
  const blurElements = document.querySelectorAll('.search-engine-selector, .search-bar-wrapper, .shortcut-card, .settings-btn, .kofi-banner');
  
  if (settings.blurEnabled) {
    // Apply blur to UI elements
    blurElements.forEach(el => el.classList.add('blur'));
    
    // Apply blur to background only if wallpaperBlur is enabled
    if (settings.wallpaperBlur) {
      bgLayer.classList.add('blur');
    } else {
      bgLayer.classList.remove('blur');
    }
  } else {
    bgLayer.classList.remove('blur');
    blurElements.forEach(el => el.classList.remove('blur'));
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Search Engine Selection
  document.querySelectorAll('.engine-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentEngine = btn.dataset.engine;
      chrome.storage.local.set({ currentEngine });
      updateActiveEngine();
    });
  });

  // Search Bar
  const searchBar = document.querySelector('.search-bar');
  const searchSubmit = document.querySelector('.search-submit');
  
  searchBar.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });
  
  searchSubmit.addEventListener('click', performSearch);

  // Settings Button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// Update Active Engine
function updateActiveEngine() {
  document.querySelectorAll('.engine-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.engine === currentEngine);
  });
}

// Perform Search
function performSearch() {
  const query = document.querySelector('.search-bar').value.trim();
  if (query) {
    window.location.href = searchEngines[currentEngine] + encodeURIComponent(query);
  }
}

// Render Shortcuts
function renderShortcuts() {
  const grid = document.getElementById('shortcutsGrid');
  grid.innerHTML = '';

  // Calculate slots (2 rows × 7 columns = 14 slots)
  const maxSlots = 14;
  
  // Render existing shortcuts
  shortcuts.forEach((shortcut, index) => {
    const card = createShortcutCard(shortcut, index);
    grid.appendChild(card);
  });

  // Render empty slots with add buttons
  for (let i = shortcuts.length; i < maxSlots; i++) {
    const addCard = createAddButton();
    grid.appendChild(addCard);
  }
  
  // Reapply blur settings to newly created cards
  applyBlurSettings();
}

// Create Shortcut Card
function createShortcutCard(shortcut, index) {
  const card = document.createElement('a');
  card.className = 'shortcut-card';
  card.href = shortcut.url;
  card.innerHTML = `
    <div class="shortcut-icon nf nf-md-link_variant"></div>
    <div class="shortcut-title">${escapeHtml(shortcut.title)}</div>
    <button class="delete-shortcut nf nf-md-close"></button>
  `;

  // Delete button
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

// Create Add Button
function createAddButton() {
  const card = document.createElement('div');
  card.className = 'shortcut-card add-btn';
  card.innerHTML = `
    <div class="shortcut-icon nf nf-md-plus"></div>
    <div class="shortcut-title">Add</div>
  `;

  card.addEventListener('click', () => {
    showAddShortcutModal();
  });

  return card;
}

// Show Add Shortcut Modal
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

  // Modal events
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  document.getElementById('cancelBtn').addEventListener('click', () => {
    modal.remove();
  });

  document.getElementById('addBtn').addEventListener('click', () => {
    const title = document.getElementById('shortcutTitle').value.trim();
    const url = document.getElementById('shortcutUrl').value.trim();

    if (title && url && isValidUrl(url)) {
      shortcuts.push({ title, url });
      saveShortcuts();
      renderShortcuts();
      modal.remove();
    } else {
      alert('Please enter a valid title and URL (must start with http:// or https://)');
    }
  });

  // Allow Enter key to submit
  const inputs = modal.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('addBtn').click();
      }
    });
  });

  // Focus on title input
  setTimeout(() => {
    document.getElementById('shortcutTitle').focus();
  }, 100);
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper function to validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}