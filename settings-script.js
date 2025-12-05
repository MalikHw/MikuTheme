let settings = { blurEnabled: false, wallpaperBlur: false, customBg: null };

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
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
}

// Update UI
function updateUI() {
  // Update blur toggles
  document.getElementById('blurToggle').checked = settings.blurEnabled;
  document.getElementById('wallpaperBlurToggle').checked = settings.wallpaperBlur;

  // Update background preview
  const bgPreview = document.getElementById('bgPreview');
  if (settings.customBg) {
    bgPreview.style.backgroundImage = `url(${settings.customBg})`;
    bgPreview.classList.add('active');
  } else {
    bgPreview.classList.remove('active');
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
}}
