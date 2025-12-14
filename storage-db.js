const DB_NAME = 'MikuThemeDB';
const DB_VERSION = 2;
const STORES = {
  SETTINGS: 'settings',
  SHORTCUTS: 'shortcuts',
  IMAGES: 'images',
  TETO_IMAGES: 'tetoImages',
  FAVORITES: 'favorites',
  TETO_FAVORITES: 'tetoFavorites',
  FAVICONS: 'favicons'
};

class MikuStorage {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS);
        }
        if (!db.objectStoreNames.contains(STORES.SHORTCUTS)) {
          db.createObjectStore(STORES.SHORTCUTS);
        }
        if (!db.objectStoreNames.contains(STORES.IMAGES)) {
          db.createObjectStore(STORES.IMAGES);
        }
        if (!db.objectStoreNames.contains(STORES.TETO_IMAGES)) {
          db.createObjectStore(STORES.TETO_IMAGES);
        }
        if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
          db.createObjectStore(STORES.FAVORITES);
        }
        if (!db.objectStoreNames.contains(STORES.TETO_FAVORITES)) {
          db.createObjectStore(STORES.TETO_FAVORITES);
        }
        if (!db.objectStoreNames.contains(STORES.FAVICONS)) {
          db.createObjectStore(STORES.FAVICONS);
        }
      };
    });
  }

  async get(storeName, key) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async set(storeName, key, value) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value, key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Helper methods for common operations
  async getSettings() {
    return await this.get(STORES.SETTINGS, 'userSettings') || {};
  }

  async saveSettings(settings) {
    return await this.set(STORES.SETTINGS, 'userSettings', settings);
  }

  async getShortcuts() {
    return await this.get(STORES.SHORTCUTS, 'userShortcuts') || [];
  }

  async saveShortcuts(shortcuts) {
    return await this.set(STORES.SHORTCUTS, 'userShortcuts', shortcuts);
  }

  async getCachedImages(isTeto = false) {
    const storeName = isTeto ? STORES.TETO_IMAGES : STORES.IMAGES;
    return await this.get(storeName, 'cached') || [];
  }

  async saveCachedImages(images, isTeto = false) {
    const storeName = isTeto ? STORES.TETO_IMAGES : STORES.IMAGES;
    return await this.set(storeName, 'cached', images);
  }

  async clearImageCache(isTeto = false) {
    const storeName = isTeto ? STORES.TETO_IMAGES : STORES.IMAGES;
    return await this.delete(storeName, 'cached');
  }

  async clearAllImageCaches() {
    await this.clear(STORES.IMAGES);
    await this.clear(STORES.TETO_IMAGES);
  }

  // Favorites management
  async getFavorites(isTeto = false) {
    const storeName = isTeto ? STORES.TETO_FAVORITES : STORES.FAVORITES;
    return await this.get(storeName, 'list') || [];
  }

  async saveFavorites(favorites, isTeto = false) {
    const storeName = isTeto ? STORES.TETO_FAVORITES : STORES.FAVORITES;
    return await this.set(storeName, 'list', favorites);
  }

  async clearFavorites(isTeto = false) {
    const storeName = isTeto ? STORES.TETO_FAVORITES : STORES.FAVORITES;
    return await this.delete(storeName, 'list');
  }

  // Favicon caching
  async getCachedFavicon(url) {
    return await this.get(STORES.FAVICONS, url);
  }

  async saveCachedFavicon(url, base64Data) {
    return await this.set(STORES.FAVICONS, url, base64Data);
  }

  async clearFaviconCache() {
    return await this.clear(STORES.FAVICONS);
  }

  async getOtherData(key) {
    return await this.get(STORES.SETTINGS, key);
  }

  async saveOtherData(key, value) {
    return await this.set(STORES.SETTINGS, key, value);
  }
}

// Create singleton instance
const storage = new MikuStorage();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.MikuStorage = storage;
}
