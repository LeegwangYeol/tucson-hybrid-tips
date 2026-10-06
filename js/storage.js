/**
 * SafeStorage: Resilient Multi-Tier Web Storage Facade
 * 
 * Features:
 * - Multi-tier fallback: localStorage -> sessionStorage -> In-Memory Map
 * - Graceful degradation in restricted environments (Safari Private Mode, iframe storage partition)
 * - Self-healing JSON deserializer: purges corrupted/poisoned payloads and restores baseline defaults
 * - Safe for headless, SSR, and Node.js testing environments
 */

export class MemoryStorage {
  constructor() {
    this._store = new Map();
  }

  getItem(key) {
    const k = String(key);
    return this._store.has(k) ? this._store.get(k) : null;
  }

  setItem(key, value) {
    this._store.set(String(key), String(value));
    return true;
  }

  removeItem(key) {
    this._store.delete(String(key));
  }

  clear() {
    this._store.clear();
  }

  get length() {
    return this._store.size;
  }
}

const memoryStore = new MemoryStorage();

export class SafeStorage {
  static isAvailable(type) {
    if (typeof window === 'undefined') return false;
    try {
      const storage = window[type];
      if (!storage) return false;
      const probe = '__tucson_storage_probe__';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  static getItem(key) {
    const k = String(key);
    // Tier 1: window.localStorage
    if (this.isAvailable('localStorage')) {
      try {
        const val = window.localStorage.getItem(k);
        if (val !== null) return val;
      } catch (e) {
        console.debug('[SafeStorage] localStorage.getItem failed:', e.message);
      }
    }

    // Tier 2: window.sessionStorage fallback
    if (this.isAvailable('sessionStorage')) {
      try {
        const val = window.sessionStorage.getItem(k);
        if (val !== null) return val;
      } catch (e) {
        console.debug('[SafeStorage] sessionStorage.getItem failed:', e.message);
      }
    }

    // Tier 3: In-Memory Map fallback
    return memoryStore.getItem(k);
  }

  static setItem(key, value) {
    const k = String(key);
    const v = String(value);

    // Keep memory store continuously synchronized for seamless fallback
    memoryStore.setItem(k, v);

    let written = false;

    // Tier 1: window.localStorage
    if (this.isAvailable('localStorage')) {
      try {
        window.localStorage.setItem(k, v);
        written = true;
      } catch (e) {
        console.debug('[SafeStorage] localStorage.setItem failed (Quota/Security):', e.message);
        try { window.localStorage.removeItem(k); } catch {}
      }
    }

    // Tier 2: window.sessionStorage
    if (!written && this.isAvailable('sessionStorage')) {
      try {
        window.sessionStorage.setItem(k, v);
        written = true;
      } catch (e) {
        console.debug('[SafeStorage] sessionStorage.setItem failed:', e.message);
        try { window.sessionStorage.removeItem(k); } catch {}
      }
    }

    return true;
  }

  static removeItem(key) {
    const k = String(key);
    memoryStore.removeItem(k);

    if (this.isAvailable('localStorage')) {
      try {
        window.localStorage.removeItem(k);
      } catch {}
    }

    if (this.isAvailable('sessionStorage')) {
      try {
        window.sessionStorage.removeItem(k);
      } catch {}
    }
  }

  static clear() {
    memoryStore.clear();

    if (this.isAvailable('localStorage')) {
      try {
        window.localStorage.clear();
      } catch {}
    }

    if (this.isAvailable('sessionStorage')) {
      try {
        window.sessionStorage.clear();
      } catch {}
    }
  }

  /**
   * Safe JSON getter with schema validation and automatic self-healing.
   *
   * @template T
   * @param {string} key - Storage key name
   * @param {(parsed: any) => T | null} [validator] - Validation and sanitization function
   * @param {T} [fallbackValue=null] - Value returned when key is absent or data corrupted
   * @param {boolean} [autoHeal=true] - If true, clears corrupted or invalid stored keys
   * @returns {T}
   */
  static getJSON(key, validator = null, fallbackValue = null, autoHeal = true) {
    const raw = this.getItem(key);
    if (!raw) return fallbackValue;

    try {
      const parsed = JSON.parse(raw);
      if (typeof validator === 'function') {
        const validated = validator(parsed);
        if (validated !== null && validated !== undefined) {
          return validated;
        }
        // Schema invalid -> self-heal corrupted key
        if (autoHeal) {
          this.removeItem(key);
        }
        return fallbackValue;
      }
      return parsed;
    } catch (e) {
      // SyntaxError or malformed JSON -> auto-heal immediately
      if (autoHeal) {
        console.warn(`[SafeStorage] Auto-healing corrupted key "${key}":`, e.message);
        this.removeItem(key);
      }
      return fallbackValue;
    }
  }

  /**
   * Safe JSON setter.
   *
   * @param {string} key - Storage key name
   * @param {any} payload - Serializable data
   * @returns {boolean}
   */
  static setJSON(key, payload) {
    try {
      const serialized = JSON.stringify(payload);
      return this.setItem(key, serialized);
    } catch (e) {
      console.debug('[SafeStorage] JSON stringify failed:', e.message);
      return false;
    }
  }
}
