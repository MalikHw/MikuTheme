// Firefox-specific script for settings page - wraps browser API to chrome API for compatibility
// This allows the extension settings to work with Firefox's browser.* API

if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  // Firefox detected, create chrome wrapper
  window.chrome = {
    storage: {
      local: {
        get: (keys) => browser.storage.local.get(keys),
        set: (items) => browser.storage.local.set(items),
        remove: (keys) => browser.storage.local.remove(keys)
      }
    },
    runtime: {
      openOptionsPage: () => browser.runtime.openOptionsPage(),
      getURL: (path) => browser.runtime.getURL(path)
    }
  };
}

// Now load the main settings script
const script = document.createElement('script');
script.src = 'settings-script.js';
document.head.appendChild(script);
