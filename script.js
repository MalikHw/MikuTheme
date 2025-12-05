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
let suggestionsCache = new Map();
let currentSuggestions = [];
let selectedSuggestionIndex = -1;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadShortcuts();
  await loadBackground();
  setupEventListeners();
  renderShortcuts();
  applyBlurSettings();
  createSuggestionsDropdown();
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
      const randomId = Math.floor(Math.random() * 100) + 1;
      const imageUrl = `https://raw.githubusercontent.com/MalikHw/MikuTheme/main/images/${randomId}.png`;
      
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (response.ok) {
        bgLayer.style.backgroundImage = `url(${imageUrl})`;
      } else {
        bgLayer.style.background = 'linear-gradient(135deg, #9ee5ff 0%, #68c3ff 100%)';
      }
    } catch (error) {
      bgLayer.style.background = 'linear-gradient(135deg, #9ee5ff 0%, #68c3ff 100%)';
    }
  }
}

// Apply Blur Settings - Now includes all UI elements
function applyBlurSettings() {
  const bgLayer = document.querySelector('.background-layer');
  const blurElements = document.querySelectorAll('.search-engine-selector, .search-bar-wrapper, .shortcut-card, .settings-btn, .kofi-banner, .suggestions-dropdown');
  
  if (settings.blurEnabled) {
    blurElements.forEach(el => el.classList.add('blur'));
    
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

// Create Suggestions Dropdown
function createSuggestionsDropdown() {
  const searchContainer = document.querySelector('.search-container');
  const dropdown = document.createElement('div');
  dropdown.className = 'suggestions-dropdown';
  dropdown.id = 'suggestionsDropdown';
  searchContainer.appendChild(dropdown);
}

// Fetch Search Suggestions from Brave API
async function fetchSuggestions(query) {
  if (!query.trim()) {
    hideSuggestions();
    return;
  }

  if (suggestionsCache.has(query)) {
    displaySuggestions(suggestionsCache.get(query));
    return;
  }

  try {
    const response = await fetch(`https://search.brave.com/api/suggest?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (data && data[1] && Array.isArray(data[1])) {
      const suggestions = data[1].slice(0, 8);
      suggestionsCache.set(query, suggestions);
      displaySuggestions(suggestions);
    }
  } catch (error) {
    console.error('Failed to fetch suggestions:', error);
  }
}

// Display Suggestions
function displaySuggestions(suggestions) {
  const dropdown = document.getElementById('suggestionsDropdown');
  currentSuggestions = suggestions;
  selectedSuggestionIndex = -1;
  
  if (suggestions.length === 0) {
    hideSuggestions();
    return;
  }

  dropdown.innerHTML = suggestions.map((suggestion, index) => `
    <div class="suggestion-item" data-index="${index}">
      <span class="suggestion-icon nf nf-md-magnify"></span>
      <span>${escapeHtml(suggestion)}</span>
    </div>
  `).join('');

  dropdown.classList.add('active');
  applyBlurSettings();

  dropdown.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const query = currentSuggestions[item.dataset.index];
      document.querySelector('.search-bar').value = query;
      performSearch();
    });
  });
}

// Hide Suggestions
function hideSuggestions() {
  const dropdown = document.getElementById('suggestionsDropdown');
  dropdown.classList.remove('active');
  currentSuggestions = [];
  selectedSuggestionIndex = -1;
}

// Navigate Suggestions with Keyboard
function navigateSuggestions(direction) {
  if (currentSuggestions.length === 0) return;

  const items = document.querySelectorAll('.suggestion-item');
  
  if (items.length === 0) return;

  if (selectedSuggestionIndex >= 0) {
    items[selectedSuggestionIndex].classList.remove('selected');
  }

  if (direction === 'down') {
    selectedSuggestionIndex = (selectedSuggestionIndex + 1) % currentSuggestions.length;
  } else if (direction === 'up') {
    selectedSuggestionIndex = selectedSuggestionIndex <= 0 
      ? currentSuggestions.length - 1 
      : selectedSuggestionIndex - 1;
  }

  items[selectedSuggestionIndex].classList.add('selected');
  document.querySelector('.search-bar').value = currentSuggestions[selectedSuggestionIndex];
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
  
  let suggestionTimeout;
  
  searchBar.addEventListener('input', (e) => {
    clearTimeout(suggestionTimeout);
    suggestionTimeout = setTimeout(() => {
      fetchSuggestions(e.target.value);
    }, 300);
  });

  searchBar.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateSuggestions('down');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateSuggestions('up');
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });
  
  searchBar.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
      hideSuggestions();
    }
  });

  searchBar.addEventListener('blur', () => {
    setTimeout(hideSuggestions, 200);
  });
  
  searchSubmit.addEventListener('click', () => {
    performSearch();
    hideSuggestions();
  });

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

  const maxSlots = 14;
  
  shortcuts.forEach((shortcut, index) => {
    const card = createShortcutCard(shortcut, index);
    grid.appendChild(card);
  });

  for (let i = shortcuts.length; i < maxSlots; i++) {
    const addCard = createAddButton();
    grid.appendChild(addCard);
  }
  
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

  const inputs = modal.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('addBtn').click();
      }
    });
  });

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
