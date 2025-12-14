let settings = { 
  blurEnabled: true,
  wallpaperBlur: false, 
  customBg: null, 
  tetoMode: false,
  tetoMikuMode: false,
  bgDisplayMode: 'cover',
  customColorEnabled: false,
  customColor: '#68c3ff'
};
let versionClickCount = 0;
let tetoModeUnlocked = false;

const REPO_MANIFEST_URL = 'https://raw.githubusercontent.com/MalikHw/MikuTheme/main/firefox/manifest.json';
const LATEST_RELEASE_URL = 'https://github.com/MalikHw/MikuTheme/releases/latest/download/miku-theme-firefox.zip';

document.addEventListener('DOMContentLoaded', async () => {
  await window.MikuStorage.init();
  await loadSettings();
  await loadVersion();
  await checkTetoModeUnlocked();
  await checkForUpdates();
  setupEventListeners();
  updateUI();
});

async function loadSettings() {
  const savedSettings = await window.MikuStorage.getSettings();
  if (savedSettings && Object.keys(savedSettings).length > 0) {
    settings = { ...settings, ...savedSettings };
  }
}

async function saveSettings() {
  await window.MikuStorage.saveSettings(settings);
  showToast('Settings saved!');
}

async function loadVersion() {
  try {
    const manifest = browser.runtime.getManifest();
    document.getElementById('versionNumber').textContent = manifest.version;
  } catch (error) {
    document.getElementById('versionNumber').textContent = 'Unknown';
  }
}

async function checkForUpdates() {
  try {
    const localManifest = browser.runtime.getManifest();
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

function setupEventListeners() {
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
    
    // If turning off Teto mode, also turn off mixed mode
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
