/**
 * Adversarial Test Harness: State Resilience & Storage Quota Stress
 * 
 * Executed by: ev_challenger_2 (State Resilience & Storage Quota Challenger)
 * Scope:
 * 1. QuotaExceededError stress & multi-tier fallbacks (Tier 1 -> Tier 2 -> Tier 3)
 * 2. SecurityError stress (Safari Private Mode & blocked storage access)
 * 3. Corrupted state injection & autonomous self-healing
 * 4. Simulator persistence & bounds clamping (180cm ~ 260cm, preset modes)
 * 5. Multi-tab synchronization & lifecycle persistence
 */

const assert = require('node:assert');
const path = require('node:path');

// Test tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [✔ PASS] ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err });
    console.log(`  [✖ FAIL] ${name}`);
    console.log(`         Error: ${err.message}`);
  }
}

// Ensure clean environment for imports
const { SafeStorage, MemoryStorage } = require('../js/storage.js');
const { calculateChecklistScore, loadChecklistState, saveChecklistState, initChecklist, STORAGE_KEY } = require('../js/checklist.js');
const { calculateClearance, loadSimulatorState, saveSimulatorState, initTailgateSimulator, SIMULATOR_STORAGE_KEY, TAILGATE_PRESETS } = require('../js/simulator.js');

console.log('================================================================================');
console.log('  ADVERSARIAL STRESS TEST HARNESS: STORAGE RESILIENCE & QUOTA');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// Part 1: QuotaExceededError Stress
// -----------------------------------------------------------------------------
console.log('▶ CATEGORY 1: QUOTA EXCEEDED ERROR STRESS & MULTI-TIER FALLBACK');

test('STR-01: QuotaExceededError on localStorage falls back to sessionStorage for new keys', () => {
  const localStore = {};
  const sessionStore = {};

  global.window = {
    localStorage: {
      getItem(k) { return localStore[k] ?? null; },
      setItem(k, v) {
        if (k === '__tucson_storage_probe__') return;
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        err.code = 22;
        throw err;
      },
      removeItem(k) { delete localStore[k]; },
      clear() { for (const k in localStore) delete localStore[k]; }
    },
    sessionStorage: {
      getItem(k) { return sessionStore[k] ?? null; },
      setItem(k, v) { sessionStore[k] = String(v); },
      removeItem(k) { delete sessionStore[k]; },
      clear() { for (const k in sessionStore) delete sessionStore[k]; }
    }
  };

  const key = 'quota_new_key_test';
  const val = JSON.stringify({ test: 'quota_fallback_success' });

  const writeResult = SafeStorage.setItem(key, val);
  assert.strictEqual(writeResult, true, 'SafeStorage.setItem must return true without throwing');
  assert.strictEqual(sessionStore[key], val, 'Data must be physically written to sessionStorage');
  assert.strictEqual(SafeStorage.getItem(key), val, 'SafeStorage.getItem must read back from sessionStorage');

  SafeStorage.removeItem(key);
});

test('STR-02: QuotaExceededError on BOTH localStorage and sessionStorage falls back to MemoryStorage', () => {
  global.window = {
    localStorage: {
      getItem(k) { return null; },
      setItem(k, v) {
        if (k === '__tucson_storage_probe__') return;
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      },
      removeItem(k) {},
      clear() {}
    },
    sessionStorage: {
      getItem(k) { return null; },
      setItem(k, v) {
        if (k === '__tucson_storage_probe__') return;
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      },
      removeItem(k) {},
      clear() {}
    }
  };

  const key = 'double_quota_key_test';
  const val = 'in_memory_only_value';

  const writeResult = SafeStorage.setItem(key, val);
  assert.strictEqual(writeResult, true, 'SafeStorage.setItem must return true on double quota failure');
  const readBack = SafeStorage.getItem(key);
  assert.strictEqual(readBack, val, 'SafeStorage.getItem must retrieve data from Tier 3 MemoryStorage');

  SafeStorage.removeItem(key);
});

test('STR-03: Probe failure in isAvailable() routes directly to next tier', () => {
  global.window = {
    localStorage: {
      setItem() {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
    },
    sessionStorage: {
      _data: {},
      setItem(k, v) { this._data[k] = String(v); },
      getItem(k) { return this._data[k] ?? null; },
      removeItem(k) { delete this._data[k]; }
    }
  };

  assert.strictEqual(SafeStorage.isAvailable('localStorage'), false, 'Probe failure must report localStorage unavailable');
  assert.strictEqual(SafeStorage.isAvailable('sessionStorage'), true, 'sessionStorage probe must succeed');

  SafeStorage.setItem('probe_bypass_key', 'bypassed_val');
  assert.strictEqual(SafeStorage.getItem('probe_bypass_key'), 'bypassed_val');
});

test('STR-04: QuotaExceededError on existing key update reveals stale data shadowing (EMPIRICAL AUDIT)', () => {
  // Scenario: An existing key exists in localStorage.
  // A subsequent update throws QuotaExceededError.
  // The update writes to sessionStorage, but localStorage retains the old value.
  const localStore = { 'shadow_test_key': 'version_1_old' };
  const sessionStore = {};

  global.window = {
    localStorage: {
      getItem(k) { return localStore[k] ?? null; },
      setItem(k, v) {
        if (k === '__tucson_storage_probe__') return;
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      },
      removeItem(k) { delete localStore[k]; },
      clear() {}
    },
    sessionStorage: {
      getItem(k) { return sessionStore[k] ?? null; },
      setItem(k, v) { sessionStore[k] = String(v); },
      removeItem(k) { delete sessionStore[k]; },
      clear() {}
    }
  };

  SafeStorage.setItem('shadow_test_key', 'version_2_new');

  // Verify sessionStorage got the new version
  assert.strictEqual(sessionStore['shadow_test_key'], 'version_2_new', 'sessionStorage must have version_2_new');

  // Audit what SafeStorage.getItem returns:
  const readBack = SafeStorage.getItem('shadow_test_key');
  
  // If readBack is 'version_1_old', the stale localStorage value is shadowing the new value!
  if (readBack === 'version_1_old') {
    throw new Error('STALE_DATA_SHADOWING: SafeStorage.getItem returned stale localStorage value ("version_1_old") instead of fallback tier value ("version_2_new")');
  }

  assert.strictEqual(readBack, 'version_2_new', 'SafeStorage.getItem must return latest updated value');
});

// -----------------------------------------------------------------------------
// Part 2: SecurityError Stress (Safari Private Browsing)
// -----------------------------------------------------------------------------
console.log('\n▶ CATEGORY 2: SECURITY ERROR STRESS (SAFARI PRIVATE BROWSING)');

test('SEC-01: Property getter throws SecurityError on window.localStorage', () => {
  global.window = {};
  Object.defineProperty(global.window, 'localStorage', {
    get() {
      const err = new Error('SecurityError: The operation is insecure.');
      err.name = 'SecurityError';
      throw err;
    }
  });
  const sessionStore = {};
  global.window.sessionStorage = {
    getItem(k) { return sessionStore[k] ?? null; },
    setItem(k, v) { sessionStore[k] = String(v); },
    removeItem(k) { delete sessionStore[k]; },
    clear() {}
  };

  assert.strictEqual(SafeStorage.isAvailable('localStorage'), false);
  assert.doesNotThrow(() => {
    SafeStorage.setItem('sec_prop_key', 'sec_prop_val');
    const res = SafeStorage.getItem('sec_prop_key');
    assert.strictEqual(res, 'sec_prop_val');
  });
});

test('SEC-02: Property getters throw SecurityError on BOTH localStorage and sessionStorage', () => {
  global.window = {};
  Object.defineProperty(global.window, 'localStorage', {
    get() {
      const err = new Error('SecurityError: The operation is insecure.');
      err.name = 'SecurityError';
      throw err;
    }
  });
  Object.defineProperty(global.window, 'sessionStorage', {
    get() {
      const err = new Error('SecurityError: The operation is insecure.');
      err.name = 'SecurityError';
      throw err;
    }
  });

  assert.strictEqual(SafeStorage.isAvailable('localStorage'), false);
  assert.strictEqual(SafeStorage.isAvailable('sessionStorage'), false);

  // Verify complete checklist workflow without crashes
  saveChecklistState([1, 2, 4]);
  const loadedChecklist = loadChecklistState();
  assert.deepStrictEqual(loadedChecklist, [1, 2, 4]);

  // Verify complete simulator workflow without crashes
  saveSimulatorState(220, 'level2');
  const loadedSim = loadSimulatorState();
  assert.strictEqual(loadedSim.ceilingCm, 220);
  assert.strictEqual(loadedSim.mode, 'level2');

  // Reset checklist memory fallback after test
  saveChecklistState([]);
});

test('SEC-03: Method invocations throw SecurityError unexpectedly', () => {
  global.window = {
    localStorage: {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
      removeItem() { throw new Error('SecurityError'); },
      clear() { throw new Error('SecurityError'); }
    },
    sessionStorage: {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
      removeItem() { throw new Error('SecurityError'); },
      clear() { throw new Error('SecurityError'); }
    }
  };

  assert.doesNotThrow(() => {
    SafeStorage.setItem('sec_method_key', 'val');
    SafeStorage.getItem('sec_method_key');
    SafeStorage.removeItem('sec_method_key');
    SafeStorage.clear();
  });
});

// -----------------------------------------------------------------------------
// Part 3: Corrupted State Injection & Autonomous Self-Healing
// -----------------------------------------------------------------------------
console.log('\n▶ CATEGORY 3: CORRUPTED STATE INJECTION & SELF-HEALING');

let windowListeners = {};

function resetMockStorage() {
  const store = {};
  windowListeners = {};
  global.window = {
    addEventListener(event, fn) {
      if (!windowListeners[event]) windowListeners[event] = [];
      windowListeners[event].push(fn);
    },
    removeEventListener(event, fn) {},
    dispatchEvent(event) {
      const list = windowListeners[event.type] || [];
      for (const fn of list) fn(event);
    },
    location: { href: 'http://localhost/' },
    localStorage: {
      getItem(k) { return store[k] ?? null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; },
      clear() { for (const k in store) delete store[k]; }
    },
    sessionStorage: {
      getItem(k) { return null; },
      setItem(k, v) {},
      removeItem(k) {},
      clear() {}
    }
  };
  saveChecklistState([]); // Reset in-memory cache to ensure fresh fallback tests
  return store;
}

test('COR-01: Malformed JSON "{broken_json" in checklist state self-heals and purges key', () => {
  const store = resetMockStorage();
  store[STORAGE_KEY] = '{broken_json';

  const loaded = loadChecklistState();
  assert.deepStrictEqual(loaded, [], 'Must return safe empty array fallback');
  assert.strictEqual(SafeStorage.getItem(STORAGE_KEY), null, 'Corrupted key must be purged from storage');

  const score = calculateChecklistScore(loaded);
  assert.strictEqual(score.count, 0);
  assert.strictEqual(score.percentage, 0);
});

test('COR-02: Literal "null" string in checklist state self-heals and purges key', () => {
  const store = resetMockStorage();
  store[STORAGE_KEY] = 'null';

  const loaded = loadChecklistState();
  assert.deepStrictEqual(loaded, [], 'Must return safe empty array fallback');
  assert.strictEqual(SafeStorage.getItem(STORAGE_KEY), null, 'Poisoned "null" key must be purged');
});

test('COR-03: Primitive number "123" in checklist state self-heals and purges key', () => {
  const store = resetMockStorage();
  store[STORAGE_KEY] = '123';

  const loaded = loadChecklistState();
  assert.deepStrictEqual(loaded, [], 'Must return safe empty array fallback');
  assert.strictEqual(SafeStorage.getItem(STORAGE_KEY), null, 'Primitive integer key must be purged');
});

test('COR-04: Malformed array with illegal indices "[-999, 999, 1.5, \"evil\", null]" sanitized to []', () => {
  const store = resetMockStorage();
  store[STORAGE_KEY] = '[-999, 999, 1.5, "evil", null]';

  const loaded = loadChecklistState();
  assert.deepStrictEqual(loaded, [], 'All illegal elements must be stripped');
  const score = calculateChecklistScore(loaded);
  assert.strictEqual(score.count, 0);
  assert.strictEqual(score.percentage, 0);
});

test('COR-05: Partially valid array "[1.5, 2, 7, -1, 3, 2]" sanitizes to deduplicated sorted integers [2, 3]', () => {
  const store = resetMockStorage();
  store[STORAGE_KEY] = '[1.5, 2, 7, -1, 3, 2]';

  const loaded = loadChecklistState();
  assert.deepStrictEqual(loaded, [2, 3], 'Must retain only unique valid integer indices [0..6]');
  const score = calculateChecklistScore(loaded);
  assert.strictEqual(score.count, 2);
  assert.strictEqual(score.percentage, 29);
});

test('COR-06: Malformed JSON "{broken_json" in simulator state self-heals and purges key', () => {
  const store = resetMockStorage();
  store[SIMULATOR_STORAGE_KEY] = '{broken_json';

  const loaded = loadSimulatorState();
  assert.deepStrictEqual(loaded, { ceilingCm: 210, mode: 'full' }, 'Must return default simulator state');
  assert.strictEqual(SafeStorage.getItem(SIMULATOR_STORAGE_KEY), null, 'Corrupted key must be purged');
});

test('COR-07: Literal "null" string in simulator state self-heals and purges key', () => {
  const store = resetMockStorage();
  store[SIMULATOR_STORAGE_KEY] = 'null';

  const loaded = loadSimulatorState();
  assert.deepStrictEqual(loaded, { ceilingCm: 210, mode: 'full' });
  assert.strictEqual(SafeStorage.getItem(SIMULATOR_STORAGE_KEY), null);
});

test('COR-08: Primitive number "123" in simulator state self-heals and purges key', () => {
  const store = resetMockStorage();
  store[SIMULATOR_STORAGE_KEY] = '123';

  const loaded = loadSimulatorState();
  assert.deepStrictEqual(loaded, { ceilingCm: 210, mode: 'full' });
  assert.strictEqual(SafeStorage.getItem(SIMULATOR_STORAGE_KEY), null);
});

test('COR-09: Array payload "[-999, 999, 1.5, \"evil\"]" in simulator safely defaults without crash', () => {
  const store = resetMockStorage();
  store[SIMULATOR_STORAGE_KEY] = '[-999, 999, 1.5, "evil"]';

  const loaded = loadSimulatorState();
  assert.deepStrictEqual(loaded, { ceilingCm: 210, mode: 'full' });
});

test('COR-10: Prototype pollution payload safely parsed without modifying Object prototype', () => {
  const store = resetMockStorage();
  store[STORAGE_KEY] = '{"__proto__":{"polluted":true},"checked":[1,2]}';

  const loaded = loadChecklistState();
  assert.deepStrictEqual(loaded, [1, 2]);
  assert.strictEqual(Object.prototype.polluted, undefined, 'Prototype must not be polluted');
});

// -----------------------------------------------------------------------------
// Part 4: Simulator State Persistence & Bounds Clamping
// -----------------------------------------------------------------------------
console.log('\n▶ CATEGORY 4: SIMULATOR STATE PERSISTENCE & BOUNDS CLAMPING');

test('SIM-01: Low ceiling boundary clamping (170cm, 0cm, -50cm, -Infinity -> clamped or defaulted >= 180cm)', () => {
  resetMockStorage();

  saveSimulatorState(170, 'full');
  assert.strictEqual(loadSimulatorState().ceilingCm, 180, '170cm must clamp to 180cm');

  saveSimulatorState(179, 'full');
  assert.strictEqual(loadSimulatorState().ceilingCm, 180, '179cm must clamp to 180cm');

  saveSimulatorState(-50, 'full');
  assert.strictEqual(loadSimulatorState().ceilingCm, 180, '-50cm must clamp to 180cm');

  saveSimulatorState(0, 'full');
  assert.ok(loadSimulatorState().ceilingCm >= 180, '0cm must be safely clamped or defaulted >= 180cm');
});

test('SIM-02: High ceiling boundary clamping (270cm, 350cm, 1000cm, Infinity -> clamped to 260cm)', () => {
  resetMockStorage();

  saveSimulatorState(261, 'full');
  assert.strictEqual(loadSimulatorState().ceilingCm, 260, '261cm must clamp to 260cm');

  saveSimulatorState(350, 'full');
  assert.strictEqual(loadSimulatorState().ceilingCm, 260, '350cm must clamp to 260cm');

  saveSimulatorState(1000, 'full');
  assert.strictEqual(loadSimulatorState().ceilingCm, 260, '1000cm must clamp to 260cm');

  saveSimulatorState(Infinity, 'full');
  assert.strictEqual(loadSimulatorState().ceilingCm, 260, 'Infinity must clamp to 260cm');
});

test('SIM-03: Boundary values 180cm and 260cm preserved with exact precision', () => {
  resetMockStorage();

  saveSimulatorState(180, 'full');
  assert.strictEqual(loadSimulatorState().ceilingCm, 180);

  saveSimulatorState(260, 'full');
  assert.strictEqual(loadSimulatorState().ceilingCm, 260);

  saveSimulatorState(215, 'full');
  assert.strictEqual(loadSimulatorState().ceilingCm, 215);
});

test('SIM-04: Tailgate preset modes validated against whitelist ("full", "level3", "level2")', () => {
  resetMockStorage();

  saveSimulatorState(210, 'full');
  assert.strictEqual(loadSimulatorState().mode, 'full');

  saveSimulatorState(210, 'level3');
  assert.strictEqual(loadSimulatorState().mode, 'level3');

  saveSimulatorState(210, 'level2');
  assert.strictEqual(loadSimulatorState().mode, 'level2');

  const invalidModes = ['level1', 'level4', 'custom', '', null, undefined, 123, '<script>'];
  for (const inv of invalidModes) {
    saveSimulatorState(210, inv);
    assert.strictEqual(loadSimulatorState().mode, 'full', `Mode "${inv}" must default to "full"`);
  }
});

// -----------------------------------------------------------------------------
// Part 5: Multi-Tab Synchronization & Lifecycle Events
// -----------------------------------------------------------------------------
console.log('\n▶ CATEGORY 5: MULTI-TAB SYNCHRONIZATION & LIFECYCLE EVENTS');

class MockDOMElement {
  constructor(tag, id = '', className = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = className;
    this.classList = {
      _classes: new Set(className.split(' ').filter(Boolean)),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); }
    };
    this.attributes = {};
    this.dataset = {};
    this.children = [];
    this.checked = false;
    this.value = '';
    this.textContent = '';
    this.style = {};
    this.listeners = {};
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }
  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length > 0 ? all[0] : null;
  }
  querySelectorAll(sel) {
    const results = [];
    function match(el) {
      if (sel.startsWith('#') && el.id === sel.slice(1)) return true;
      if (sel.startsWith('.') && el.classList.contains(sel.slice(1))) return true;
      if (sel === 'input[type="checkbox"]' && el.tagName === 'INPUT' && el.attributes.type === 'checkbox') return true;
      if (sel.includes(',')) {
        const parts = sel.split(',').map(s => s.trim());
        for (const p of parts) {
          if (p.startsWith('.') && el.classList.contains(p.slice(1))) return true;
          if (p.startsWith('#') && el.id === p.slice(1)) return true;
        }
      }
      return false;
    }
    function walk(node) {
      if (match(node)) results.push(node);
      for (const ch of node.children) walk(ch);
    }
    for (const ch of this.children) walk(ch);
    return results;
  }
}

// Global document mock for DOM initialization
global.document = {
  readyState: 'complete',
  getElementById(id) { return null; },
  querySelector(sel) { return null; }
};

test('TAB-01: Checklist re-renders DOM checkboxes and score ring on external "storage" event', () => {
  resetMockStorage();

  const container = new MockDOMElement('div', 'checklist-container');
  const checkboxes = [];
  for (let i = 0; i < 7; i++) {
    const cb = new MockDOMElement('input', `chk_${i}`);
    cb.setAttribute('type', 'checkbox');
    container.children.push(cb);
    checkboxes.push(cb);
  }
  const scoreEl = new MockDOMElement('span', 'checklist-score');
  const ringEl = new MockDOMElement('circle', 'score-ring-progress');
  const titleEl = new MockDOMElement('h4', 'checklist-status-title');
  const badgeEl = new MockDOMElement('span', 'checklist-badge');
  container.children.push(scoreEl, ringEl, titleEl, badgeEl);

  initChecklist(container);
  assert.strictEqual(scoreEl.textContent, '0%');

  // External tab writes [0, 1, 2]
  SafeStorage.setJSON(STORAGE_KEY, { version: 1, checked: [0, 1, 2] });

  // Fire storage event
  global.window.dispatchEvent({ type: 'storage', key: STORAGE_KEY });

  assert.strictEqual(scoreEl.textContent, '43%');
  assert.strictEqual(checkboxes[0].checked, true);
  assert.strictEqual(checkboxes[1].checked, true);
  assert.strictEqual(checkboxes[2].checked, true);
  assert.strictEqual(checkboxes[3].checked, false);
  assert.ok(ringEl.style.strokeDashoffset, 'Ring offset must be recalculated');
});

test('TAB-02: Simulator updates slider, output, and active mode on external "storage" event', () => {
  resetMockStorage();

  const simContainer = new MockDOMElement('div', 'simulator-container');
  const slider = new MockDOMElement('input', 'ceiling-height-slider');
  const output = new MockDOMElement('output', 'ceiling-height-output');
  const statusBox = new MockDOMElement('div', 'simulator-status');
  const statusTitle = new MockDOMElement('div', '', 'status-title');
  statusBox.children.push(statusTitle);

  const presetBtn210 = new MockDOMElement('button', '', 'preset-btn');
  presetBtn210.setAttribute('data-preset', '210');
  const modeBtnFull = new MockDOMElement('button', '', 'btn-tailgate-mode');
  modeBtnFull.setAttribute('data-mode', 'full');
  const modeBtnLevel3 = new MockDOMElement('button', '', 'btn-tailgate-mode');
  modeBtnLevel3.setAttribute('data-mode', 'level3');

  simContainer.children.push(slider, output, statusBox, presetBtn210, modeBtnFull, modeBtnLevel3);

  initTailgateSimulator(simContainer);
  assert.strictEqual(output.textContent, '210cm');

  // External tab writes 240cm, level3
  SafeStorage.setJSON(SIMULATOR_STORAGE_KEY, { version: 1, ceilingCm: 240, mode: 'level3' });

  // Fire storage event
  global.window.dispatchEvent({ type: 'storage', key: SIMULATOR_STORAGE_KEY });

  assert.strictEqual(slider.value, 240);
  assert.strictEqual(output.textContent, '240cm');
  assert.strictEqual(modeBtnLevel3.classList.contains('active'), true);
  assert.strictEqual(modeBtnFull.classList.contains('active'), false);
  assert.ok(statusTitle.textContent.includes('안전'), 'Status must reflect safe margin');
});

test('TAB-03: Storage event for unrelated key does not cause state modification or error', () => {
  resetMockStorage();

  const container = new MockDOMElement('div', 'checklist-container');
  const scoreEl = new MockDOMElement('span', 'checklist-score');
  container.children.push(scoreEl);
  initChecklist(container);

  assert.strictEqual(scoreEl.textContent, '0%');

  // Fire storage event for unrelated key
  assert.doesNotThrow(() => {
    global.window.dispatchEvent({ type: 'storage', key: 'unrelated_foreign_key_xyz' });
  });
  assert.strictEqual(scoreEl.textContent, '0%');
});

test('TAB-04: Idempotency guards prevent duplicate listener binding and state cancellation', () => {
  const container = new MockDOMElement('div', 'checklist-container');
  const scoreEl = new MockDOMElement('span', 'checklist-score');
  container.children.push(scoreEl);

  initChecklist(container);
  assert.strictEqual(container.dataset.chkBound, 'true');

  // Second initialization should early exit
  initChecklist(container);
  assert.strictEqual(container.dataset.chkBound, 'true');

  const simContainer = new MockDOMElement('div', 'simulator-container');
  initTailgateSimulator(simContainer);
  assert.strictEqual(simContainer.dataset.simBound, 'true');

  initTailgateSimulator(simContainer);
  assert.strictEqual(simContainer.dataset.simBound, 'true');
});

console.log('\n================================================================================');
console.log(`  EXECUTION SUMMARY: ${passedTests} / ${totalTests} PASSED (${failedTests} FAILED)`);
console.log('================================================================================\n');

if (failedTests > 0) {
  console.log('FAILURES ENCOUNTERED:');
  for (const f of failures) {
    console.log(`- ${f.name}: ${f.error.message}`);
  }
}
