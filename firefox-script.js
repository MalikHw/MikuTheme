// Firefox-specific script - wraps browser API to chrome API for compatibility
// This allows the extension to work with Firefox's browser.* API

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
      openOptionsPage: () => browser.runtime.openOptionsPage()
    },
    tabs: {
      create: (options) => browser.tabs.create(options)
    }
  };
}

// Now load the main script
const script = document.createElement('script');
script.src = 'script.js';
document.head.appendChild(script);