let settings = { blurEnabled: false, wallpaperBlur: false, customBg: null, tetoMode: false };
let versionClickCount = 0;
let tetoModeUnlocked = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadVersion();
  await checkTetoModeUnlocked();
  setupEventListeners();
  updateUI();
});

// Load Settings
async function loadSettings() {
  const result = await chrome.storage.local.get(['settings']);
  if (result.settings) {
    settings = result.settings;
  }
}

// Save Settings
async function saveSettings() {
  await chrome.storage.local.set({ settings });
  showToast('Settings saved!');
}

// Load Version from manifest
async function loadVersion() {
  try {
    const response = await fetch(chrome.runtime.getURL('manifest.json'));
    const manifest = await response.json();
    document.getElementById('versionNumber').textContent = manifest.version;
  } catch (error) {
    document.getElementById('versionNumber').textContent = 'Unknown';
  }
}

// Check if Teto Mode is unlocked
async function checkTetoModeUnlocked() {
  const result = await chrome.storage.local.get(['tetoModeUnlocked']);
  if (result.tetoModeUnlocked) {
    tetoModeUnlocked = true;
    showTetoMode();
  }
}

// Unlock Teto Mode
async function unlockTetoMode() {
  tetoModeUnlocked = true;
  await chrome.storage.local.set({ tetoModeUnlocked: true });
  showToast('🔴 Teto Mode Unlocked! Refreshing...', false);
  setTimeout(() => {
    location.reload();
  }, 1000);
}

// Show Teto Mode Toggle
function showTetoMode() {
  const tetoContainer = document.getElementById('tetoModeContainer');
  tetoContainer.style.display = 'flex';
  tetoContainer.style.animation = 'slideDown 0.5s ease';
}

// Clear Image Cache
async function clearImageCache() {
  try {
    await chrome.storage.local.remove(['cachedImage', 'cachedTetoImage']);
    showToast('Image cache cleared! Refresh the new tab page to load a new image.');
  } catch (error) {
    showToast('Failed to clear cache', true);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Blur Toggle
  const blurToggle = document.getElementById('blurToggle');
  blurToggle.addEventListener('change', () => {
    settings.blurEnabled = blurToggle.checked;
    saveSettings();
  });

  // Wallpaper Blur Toggle
  const wallpaperBlurToggle = document.getElementById('wallpaperBlurToggle');
  wallpaperBlurToggle.addEventListener('change', () => {
    settings.wallpaperBlur = wallpaperBlurToggle.checked;
    saveSettings();
  });

  // Teto Mode Toggle
  const tetoModeToggle = document.getElementById('tetoModeToggle');
  tetoModeToggle.addEventListener('change', async () => {
    settings.tetoMode = tetoModeToggle.checked;
    await saveSettings();
    applyTetoMode();
  });

  // Upload Button
  const uploadBtn = document.getElementById('uploadBtn');
  const bgUpload = document.getElementById('bgUpload');
  
  uploadBtn.addEventListener('click', () => {
    bgUpload.click();
  });

  bgUpload.addEventListener('change', handleImageUpload);

  // Reset Background Button
  const resetBgBtn = document.getElementById('resetBgBtn');
  resetBgBtn.addEventListener('click', resetBackground);

  // Clear Cache Button
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  clearCacheBtn.addEventListener('click', clearImageCache);

  // Version Click Easter Egg
  const versionDisplay = document.getElementById('versionDisplay');
  versionDisplay.addEventListener('click', () => {
    if (tetoModeUnlocked) return; // Already unlocked
    
    versionClickCount++;
    
    if (versionClickCount === 5) {
      unlockTetoMode();
    } else if (versionClickCount >= 3) {
      versionDisplay.style.transform = 'scale(1.1)';
      setTimeout(() => {
        versionDisplay.style.transform = 'scale(1)';
      }, 200);
    }
  });
}

// Update UI
function updateUI() {
  // Update blur toggles
  document.getElementById('blurToggle').checked = settings.blurEnabled;
  document.getElementById('wallpaperBlurToggle').checked = settings.wallpaperBlur;
  
  // Update Teto Mode toggle
  document.getElementById('tetoModeToggle').checked = settings.tetoMode;

  // Update background preview
  const bgPreview = document.getElementById('bgPreview');
  if (settings.customBg) {
    bgPreview.style.backgroundImage = `url(${settings.customBg})`;
    bgPreview.classList.add('active');
  } else {
    bgPreview.classList.remove('active');
  }

  // Apply Teto Mode if enabled
  if (settings.tetoMode) {
    applyTetoMode();
  }
}

// Apply Teto Mode Color Scheme
function applyTetoMode() {
  const body = document.body;
  if (settings.tetoMode) {
    body.classList.add('teto-mode');
  } else {
    body.classList.remove('teto-mode');
  }
}

// Handle Image Upload
async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Check file type
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file!', true);
    return;
  }

  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image too large! Max size is 5MB.', true);
    return;
  }

  // Read file as data URL
  const reader = new FileReader();
  reader.onload = async (e) => {
    settings.customBg = e.target.result;
    await saveSettings();
    updateUI();
    showToast('Background image uploaded!');
  };
  reader.readAsDataURL(file);
}

// Reset Background
async function resetBackground() {
  settings.customBg = null;
  await saveSettings();
  updateUI();
  showToast('Background reset to random!');
}

// Show Toast Notification
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.background = isError ? '#ff4757' : 'white';
  toast.style.color = isError ? 'white' : '#202124';
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
