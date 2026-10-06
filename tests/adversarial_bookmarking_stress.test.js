/**
 * ==============================================================================
 * Tucson Hybrid Smart Key Trunk Prevention Tips Website
 * File: tests/adversarial_bookmarking_stress.test.js
 * Description: Adversarial State Persistence & Resilience Test Suite for
 * Bookmarking System (`tucson_bookmarked_secrets_v1`) in `js/secrets.js` and `js/storage.js`.
 *
 * Executed by: m3_challenger_2 (Empirical Challenger)
 *
 * Adversarial Attack Vectors:
 * 1. Rapid Toggle Spam (500x synchronous clicks, 501x parity, multi-card concurrent spam, 10,000x micro-cycles)
 * 2. Storage Quota Exhaustion & Graceful Tier Degradation (localStorage -> sessionStorage -> MemoryStorage)
 * 3. Poisoned & Corrupted Storage Self-Healing (`{corrupt_json:true`, non-array types, invalid items, prototype pollution)
 * 4. Multi-Tip State Lifecycle & Filtering (All 13 tips bookmark -> reload -> unbookmark 7 odd tips -> verify 6 even tips)
 * 5. Full End-to-End DOM Hydration & Interaction Persistence Lifecycle
 * ==============================================================================
 */

const assert = require('node:assert');
const path = require('node:path');

// Test tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function test(id, description, fn) {
  totalTests++;
  const start = Date.now();
  try {
    fn();
    const duration = Date.now() - start;
    passedTests++;
    console.log(`  [✔ PASS] ${id}: ${description} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - start;
    failedTests++;
    failures.push({ id, description, error: err });
    console.log(`  [✖ FAIL] ${id}: ${description} (${duration}ms)`);
    console.log(`         Error: ${err.message}`);
    if (err.stack) {
      const relevantStack = err.stack.split('\n').slice(1, 4).join('\n');
      console.log(`         Stack: ${relevantStack}`);
    }
  }
}

// -----------------------------------------------------------------------------
// Lightweight Mock DOM Architecture for Headless Node.js
// -----------------------------------------------------------------------------
class MockDOMElement {
  constructor(tag, className = '', dataset = {}) {
    this.tagName = tag.toUpperCase();
    this.className = className;
    const classes = new Set(className.split(/\s+/).filter(Boolean));
    this.classList = {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classes.has(c)) { classes.delete(c); return false; }
          classes.add(c); return true;
        }
        if (force) { classes.add(c); return true; }
        classes.delete(c); return false;
      }
    };
    this.dataset = { ...dataset };
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this.textContent = '';
    this.focused = false;
  }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return this.attributes[k] !== undefined; }

  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }

  closest(sel) {
    let curr = this;
    const targetClass = sel.replace(/^\./, '');
    while (curr) {
      if (curr.classList.contains(targetClass)) return curr;
      curr = curr.parentNode;
    }
    return null;
  }

  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(sel) {
    const res = [];
    const selectors = sel.split(',').map(s => s.trim());
    function matchNode(node) {
      return selectors.some(s => {
        if (s.startsWith('.')) return node.classList.contains(s.slice(1));
        if (s.startsWith('#')) return node.attributes.id === s.slice(1);
        return node.tagName.toLowerCase() === s.toLowerCase();
      });
    }
    function walk(node) {
      for (const ch of node.children) {
        if (matchNode(ch)) res.push(ch);
        walk(ch);
      }
    }
    walk(this);
    return res;
  }

  focus() { this.focused = true; }

  click() {
    const handlers = this.listeners['click'] || [];
    for (const fn of handlers) {
      fn({ type: 'click', target: this, preventDefault() {} });
    }
  }
}

// Canonical 13 secret tips definition
const ALL_13_SECRETS = [
  { id: 'batt-reset', cat: 'hidden', title: '12V 배터리 리셋 버튼' },
  { id: 'wiper-service', cat: 'hidden', title: '히든 와이퍼 서비스 모드' },
  { id: 'mech-key', cat: 'hidden', title: '비상 기계식 키 홀캡 분리' },
  { id: 'auto-defog', cat: 'hidden', title: '오토 디포그 시스템 수동 해제' },
  { id: 'neutral-shift', cat: 'hidden', title: '이중주차 N단 중립 유지' },
  { id: 'pulse-glide', cat: 'hybrid', title: '펄스 앤 글라이드 (P&G) 주행법' },
  { id: 'paddle-regen', cat: 'hybrid', title: '회생제동 패들시프트 감속' },
  { id: 'battery-thermal', cat: 'hybrid', title: '고전압 배터리 겨울철 보온' },
  { id: 'key-case', cat: 'accessory', title: '아연합금 풀커버 프레임 키케이스' },
  { id: 'console-tray', cat: 'accessory', title: '센터콘솔 2단 분할 트레이' },
  { id: 'ar-film', cat: 'accessory', title: '디스플레이 AR 저반사 강화유리' },
  { id: 'bumper-guard', cat: 'accessory', title: '리어 범퍼 스테인리스 프로텍터' },
  { id: 'wireless-dongle', cat: 'accessory', title: '무선 카플레이/안드로이드 오토 동글' }
];

const CANONICAL_IDS = ALL_13_SECRETS.map(s => s.id);
// 1-based indexing: Odd = [1,3,5,7,9,11,13] (indices 0,2,4,6,8,10,12)
const ODD_IDS = CANONICAL_IDS.filter((_, idx) => (idx + 1) % 2 === 1);
// 1-based indexing: Even = [2,4,6,8,10,12] (indices 1,3,5,7,9,11)
const EVEN_IDS = CANONICAL_IDS.filter((_, idx) => (idx + 1) % 2 === 0);

function buildMockSecretsTree() {
  const container = new MockDOMElement('section', 'secrets-section');
  container.setAttribute('id', 'secrets');

  const filterTabs = [
    new MockDOMElement('button', 'secrets-filter-btn secrets-tab-btn active', { filter: 'all' }),
    new MockDOMElement('button', 'secrets-filter-btn secrets-tab-btn', { filter: 'hidden' }),
    new MockDOMElement('button', 'secrets-filter-btn secrets-tab-btn', { filter: 'hybrid' }),
    new MockDOMElement('button', 'secrets-filter-btn secrets-tab-btn', { filter: 'accessory' })
  ];
  filterTabs.forEach(t => {
    container.children.push(t);
    t.parentNode = container;
  });

  const cards = [];
  ALL_13_SECRETS.forEach(def => {
    const card = new MockDOMElement('article', 'secret-card', { category: def.cat });
    card.setAttribute('id', `secret-${def.id}`);

    const title = new MockDOMElement('h3', 'secret-title');
    title.textContent = def.title;
    card.children.push(title);
    title.parentNode = card;

    const bBtn = new MockDOMElement('button', 'btn-bookmark secret-bookmark-btn', { secretId: def.id });
    bBtn.setAttribute('aria-pressed', 'false');

    const bText = new MockDOMElement('span', 'bookmark-text');
    bText.textContent = '유용한 팁 저장';
    bBtn.children.push(bText);
    bText.parentNode = bBtn;

    card.children.push(bBtn);
    bBtn.parentNode = card;

    container.children.push(card);
    card.parentNode = container;
    cards.push(card);
  });

  return { container, filterTabs, cards };
}

let toastCalls = [];
function ensureGlobals() {
  toastCalls = [];
  global.window = {
    showToast: (msg) => { toastCalls.push(msg); }
  };
  global.document = {
    readyState: 'loading',
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => new MockDOMElement(tag)
  };
}

ensureGlobals();

// Import target modules
const {
  loadBookmarks,
  saveBookmarks,
  initSecretsModule,
  SECRETS_BOOKMARKS_KEY
} = require('../js/secrets.js');
const { SafeStorage, MemoryStorage } = require('../js/storage.js');

function resetStorageEnv() {
  SafeStorage.clear();
  const localStore = {};
  const sessionStore = {};
  toastCalls = [];

  global.window.localStorage = {
    getItem(k) { return localStore[k] ?? null; },
    setItem(k, v) { localStore[k] = String(v); },
    removeItem(k) { delete localStore[k]; },
    clear() { for (const k in localStore) delete localStore[k]; }
  };

  global.window.sessionStorage = {
    getItem(k) { return sessionStore[k] ?? null; },
    setItem(k, v) { sessionStore[k] = String(v); },
    removeItem(k) { delete sessionStore[k]; },
    clear() { for (const k in sessionStore) delete sessionStore[k]; }
  };

  return { localStore, sessionStore };
}

console.log('================================================================================');
console.log('  ADVERSARIAL STRESS TEST: BOOKMARKING STATE RESILIENCE & INTEGRITY');
console.log('  Target: js/secrets.js & js/storage.js (Key: tucson_bookmarked_secrets_v1)');
console.log('================================================================================\n');

// =============================================================================
// VECTOR 1: BOOKMARKING TOGGLE SPAM STRESS
// =============================================================================
console.log('▶ CATEGORY 1: BOOKMARKING TOGGLE SPAM STRESS');

test('SPAM-01', 'Toggle same bookmark 500 times in rapid synchronous succession returns to unbookmarked state', () => {
  resetStorageEnv();
  const { container, cards } = buildMockSecretsTree();
  initSecretsModule(container);

  const card = cards.find(c => c.getAttribute('id') === 'secret-batt-reset');
  const btn = card.querySelector('.secret-bookmark-btn');

  assert.strictEqual(btn.getAttribute('aria-pressed'), 'false');
  assert.strictEqual(btn.classList.contains('is-bookmarked'), false);

  // Rapidly toggle 500 times
  for (let i = 0; i < 500; i++) {
    btn.click();
  }

  // After 500 toggles (even count), state must be exactly unbookmarked
  assert.strictEqual(btn.getAttribute('aria-pressed'), 'false', 'Button aria-pressed must be false after 500 toggles');
  assert.strictEqual(btn.classList.contains('is-bookmarked'), false, 'Button must NOT have is-bookmarked class');
  assert.strictEqual(btn.querySelector('.bookmark-text').textContent, '유용한 팁 저장', 'Label must be unbookmarked text');
  
  const stored = loadBookmarks();
  assert.deepStrictEqual(stored, [], 'Storage must contain empty array after 500 toggles');
  assert.strictEqual(toastCalls.length, 500, 'Toast dispatch must match exact click count without dropping events');
});

test('SPAM-02', '501 toggles (odd count) leaves bookmark in bookmarked state with exact tip ID', () => {
  resetStorageEnv();
  const { container, cards } = buildMockSecretsTree();
  initSecretsModule(container);

  const card = cards.find(c => c.getAttribute('id') === 'secret-batt-reset');
  const btn = card.querySelector('.secret-bookmark-btn');

  // Rapidly toggle 501 times
  for (let i = 0; i < 501; i++) {
    btn.click();
  }

  assert.strictEqual(btn.getAttribute('aria-pressed'), 'true', 'Button aria-pressed must be true after 501 toggles');
  assert.strictEqual(btn.classList.contains('is-bookmarked'), true, 'Button must have is-bookmarked class');
  assert.strictEqual(btn.querySelector('.bookmark-text').textContent, '저장 완료', 'Label must indicate bookmarked');

  const stored = loadBookmarks();
  assert.deepStrictEqual(stored, ['batt-reset'], 'Storage must contain exactly ["batt-reset"]');
});

test('SPAM-03', 'Multi-card interleaved chaos toggle spam (13 cards x 50 toggles = 650 rapid clicks)', () => {
  resetStorageEnv();
  const { container, cards } = buildMockSecretsTree();
  initSecretsModule(container);

  // Toggle each card 50 times (even count -> all unbookmarked)
  for (let round = 0; round < 50; round++) {
    for (const card of cards) {
      const btn = card.querySelector('.secret-bookmark-btn');
      btn.click();
    }
  }

  // All 13 cards must be unbookmarked
  cards.forEach(card => {
    const btn = card.querySelector('.secret-bookmark-btn');
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(btn.classList.contains('is-bookmarked'), false);
  });
  assert.deepStrictEqual(loadBookmarks(), []);

  // Now click odd-indexed cards once more (7 cards: 0, 2, 4, 6, 8, 10, 12)
  const oddCards = cards.filter((_, idx) => (idx + 1) % 2 === 1);
  oddCards.forEach(card => card.querySelector('.secret-bookmark-btn').click());

  const storedAfterChaos = loadBookmarks();
  assert.strictEqual(storedAfterChaos.length, 7, 'Must have exactly 7 bookmarked tips');
  ODD_IDS.forEach(id => {
    assert.ok(storedAfterChaos.includes(id), `Stored bookmarks must contain odd ID: ${id}`);
  });
});

test('SPAM-04', 'High-frequency micro-benchmark: 5,000 rapid saveBookmarks & loadBookmarks executions', () => {
  resetStorageEnv();
  const t0 = Date.now();
  const sampleData = ['batt-reset', 'pulse-glide', 'key-case'];

  for (let i = 0; i < 5000; i++) {
    saveBookmarks(sampleData);
    const loaded = loadBookmarks();
    if (i % 1000 === 0) {
      assert.strictEqual(loaded.length, 3);
    }
  }

  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 2000, `5,000 save/load cycles should finish in under 2000ms (took ${elapsed}ms)`);
});

// =============================================================================
// VECTOR 2: STORAGE QUOTA EXHAUSTION & RESILIENT FALLBACK
// =============================================================================
console.log('\n▶ CATEGORY 2: STORAGE QUOTA EXHAUSTION & TIER FALLBACK');

test('QUOTA-01', 'localStorage QuotaExceededError falls back cleanly to sessionStorage without throwing', () => {
  const { sessionStore } = resetStorageEnv();

  // Make localStorage throw QuotaExceededError on setItem
  global.window.localStorage.setItem = (k, v) => {
    if (k === '__tucson_storage_probe__') return; // let probe pass to simulate write failure
    const err = new Error('QuotaExceededError: DOMException');
    err.name = 'QuotaExceededError';
    err.code = 22;
    throw err;
  };

  assert.doesNotThrow(() => {
    saveBookmarks(['wiper-service', 'auto-defog']);
  }, 'saveBookmarks must not throw when localStorage exhausts quota');

  // Verify physical fallback to sessionStorage
  assert.ok(sessionStore[SECRETS_BOOKMARKS_KEY], 'Data must be physically written to sessionStorage');
  const sessionData = JSON.parse(sessionStore[SECRETS_BOOKMARKS_KEY]);
  assert.deepStrictEqual(sessionData, ['wiper-service', 'auto-defog']);

  // Verify loadBookmarks reads back seamlessly
  const loaded = loadBookmarks();
  assert.deepStrictEqual(loaded, ['wiper-service', 'auto-defog'], 'loadBookmarks must retrieve data from fallback tier');
});

test('QUOTA-02', 'Total QuotaExceededError on BOTH localStorage and sessionStorage falls back to MemoryStorage', () => {
  resetStorageEnv();

  // Both tiers throw QuotaExceededError
  global.window.localStorage.setItem = (k, v) => {
    if (k === '__tucson_storage_probe__') return;
    const err = new Error('QuotaExceededError: localStorage full');
    err.name = 'QuotaExceededError';
    throw err;
  };

  global.window.sessionStorage.setItem = (k, v) => {
    if (k === '__tucson_storage_probe__') return;
    const err = new Error('QuotaExceededError: sessionStorage full');
    err.name = 'QuotaExceededError';
    throw err;
  };

  assert.doesNotThrow(() => {
    saveBookmarks(['pulse-glide', 'paddle-regen', 'bumper-guard']);
  }, 'saveBookmarks must not throw even under total web storage quota exhaustion');

  const loaded = loadBookmarks();
  assert.deepStrictEqual(loaded, ['pulse-glide', 'paddle-regen', 'bumper-guard'],
    'loadBookmarks must return data preserved in MemoryStorage tier');
});

test('QUOTA-03', 'Stale cache eviction: localStorage failure cleans stale key preventing zombie shadowing', () => {
  const { localStore, sessionStore } = resetStorageEnv();

  // Initial valid write to localStorage
  saveBookmarks(['old-obsolete-tip']);
  assert.ok(localStore[SECRETS_BOOKMARKS_KEY]);

  // Now localStorage runs out of quota for subsequent writes
  global.window.localStorage.setItem = (k, v) => {
    if (k === '__tucson_storage_probe__') return;
    const err = new Error('QuotaExceededError: storage full');
    err.name = 'QuotaExceededError';
    throw err;
  };

  // Update bookmarks to new set
  saveBookmarks(['fresh-tip-1', 'fresh-tip-2']);

  // SafeStorage.setItem attempts removeItem(k) on localStorage to prevent stale shadowing
  const loaded = loadBookmarks();
  assert.deepStrictEqual(loaded, ['fresh-tip-1', 'fresh-tip-2'],
    'Stale old data in localStorage must NOT shadow newer update in sessionStorage');
});

test('QUOTA-04', 'Safari Private Browsing simulation: SecurityError on storage access degrades gracefully', () => {
  resetStorageEnv();

  global.window.localStorage = {
    getItem() { throw new Error('SecurityError: The operation is insecure.'); },
    setItem() { throw new Error('SecurityError: The operation is insecure.'); },
    removeItem() { throw new Error('SecurityError: The operation is insecure.'); }
  };
  global.window.sessionStorage = {
    getItem() { throw new Error('SecurityError: The operation is insecure.'); },
    setItem() { throw new Error('SecurityError: The operation is insecure.'); },
    removeItem() { throw new Error('SecurityError: The operation is insecure.'); }
  };

  assert.doesNotThrow(() => {
    saveBookmarks(['batt-reset', 'wireless-dongle']);
    const loaded = loadBookmarks();
    assert.deepStrictEqual(loaded, ['batt-reset', 'wireless-dongle']);
  }, 'Under total SecurityError lockdown, in-memory store keeps application operational');
});

// =============================================================================
// VECTOR 3: CORRUPTED / POISONED STORAGE DATA SELF-HEALING
// =============================================================================
console.log('\n▶ CATEGORY 3: CORRUPTED / POISONED STORAGE SELF-HEALING');

test('POISON-01', 'Verbatim target: invalid JSON "{corrupt_json:true" self-heals, purges key, and returns []', () => {
  resetStorageEnv();

  // Inject malformed unparsable JSON string directly into storage
  SafeStorage.setItem(SECRETS_BOOKMARKS_KEY, '{corrupt_json:true');
  assert.strictEqual(SafeStorage.getItem(SECRETS_BOOKMARKS_KEY), '{corrupt_json:true');

  // Call loadBookmarks - must NOT throw SyntaxError
  let loaded = null;
  assert.doesNotThrow(() => {
    loaded = loadBookmarks();
  }, 'loadBookmarks must never throw on malformed JSON payload');

  assert.deepStrictEqual(loaded, [], 'Corrupted JSON must safely fallback to empty array []');

  // Verify self-healing: corrupted key must be purged from storage
  const rawAfterHeal = SafeStorage.getItem(SECRETS_BOOKMARKS_KEY);
  assert.strictEqual(rawAfterHeal, null, 'SafeStorage must have purged corrupted key from storage');
});

test('POISON-02', 'Non-array JSON primitives self-heal and purge corrupted key', () => {
  resetStorageEnv();

  const primitiveCorruptions = [
    { label: 'number 12345', raw: '12345' },
    { label: 'string literal "hacked"', raw: '"hacked"' },
    { label: 'boolean true', raw: 'true' },
    { label: 'boolean false', raw: 'false' },
    { label: 'null literal', raw: 'null' }
  ];

  primitiveCorruptions.forEach(({ label, raw }) => {
    SafeStorage.setItem(SECRETS_BOOKMARKS_KEY, raw);
    const loaded = loadBookmarks();
    assert.deepStrictEqual(loaded, [], `Primitive corruption (${label}) must fallback to []`);
    assert.strictEqual(SafeStorage.getItem(SECRETS_BOOKMARKS_KEY), null, `Key must be purged for ${label}`);
  });
});

test('POISON-03', 'Invalid object dictionary schema self-heals and purges key', () => {
  resetStorageEnv();

  SafeStorage.setItem(SECRETS_BOOKMARKS_KEY, JSON.stringify({
    'batt-reset': true,
    malicious: 'payload',
    tampered: true
  }));

  const loaded = loadBookmarks();
  assert.deepStrictEqual(loaded, [], 'Object payload must be rejected and return []');
  assert.strictEqual(SafeStorage.getItem(SECRETS_BOOKMARKS_KEY), null, 'Object payload key must be purged');
});

test('POISON-04', 'Array containing corrupted, dirty, and non-string elements is sanitized cleanly', () => {
  resetStorageEnv();

  // Injected array with bad data types mixed in
  const poisonedArray = [
    'batt-reset',
    12345,
    null,
    undefined,
    {},
    [],
    true,
    false,
    '',
    '   ',
    'wiper-service',
    NaN,
    Infinity
  ];

  SafeStorage.setItem(SECRETS_BOOKMARKS_KEY, JSON.stringify(poisonedArray));
  const sanitized = loadBookmarks();

  assert.deepStrictEqual(sanitized, ['batt-reset', 'wiper-service'],
    'Sanitizer must retain only valid, non-empty string IDs');
});

test('POISON-05', 'Prototype pollution attack attempt does not pollute Object prototype', () => {
  resetStorageEnv();

  const pollutionPayload = JSON.stringify({
    __proto__: { pollutedSecret: 'INJECTED_ATTACK' },
    constructor: { prototype: { pollutedSecret: 'INJECTED_ATTACK' } }
  });

  SafeStorage.setItem(SECRETS_BOOKMARKS_KEY, pollutionPayload);
  const loaded = loadBookmarks();

  assert.deepStrictEqual(loaded, []);
  assert.strictEqual(({}).pollutedSecret, undefined, 'Object prototype must NOT be polluted');
  assert.strictEqual(Object.prototype.pollutedSecret, undefined, 'Object.prototype must remain clean');
});

test('POISON-06', 'Oversized 1MB garbage string payload safely self-heals without memory explosion', () => {
  resetStorageEnv();

  // Create 1MB garbage payload
  const hugeGarbage = '{corrupt_data:' + 'A'.repeat(1024 * 1024);
  SafeStorage.setItem(SECRETS_BOOKMARKS_KEY, hugeGarbage);

  const t0 = Date.now();
  const loaded = loadBookmarks();
  const duration = Date.now() - t0;

  assert.deepStrictEqual(loaded, []);
  assert.strictEqual(SafeStorage.getItem(SECRETS_BOOKMARKS_KEY), null);
  assert.ok(duration < 200, `Huge garbage handling should be fast (took ${duration}ms)`);
});

// =============================================================================
// VECTOR 4: MULTI-TIP BOOKMARKING & STATE RELOAD INTEGRITY
// =============================================================================
console.log('\n▶ CATEGORY 4: MULTI-TIP BOOKMARKING & SELECTIVE MUTATION');

test('MULTI-01', 'Bookmark all 13 canonical tips, reload state, verify exact fidelity', () => {
  resetStorageEnv();

  // Bookmark all 13 tips
  saveBookmarks(CANONICAL_IDS);

  // Reload state
  const reloaded = loadBookmarks();
  assert.strictEqual(reloaded.length, 13, 'Must load exactly 13 bookmarks');
  assert.deepStrictEqual(reloaded, CANONICAL_IDS, 'Loaded bookmarks must match all 13 canonical IDs exactly');
});

test('MULTI-02', 'Bookmark all 13 tips, unbookmark 7 odd tips, verify remaining 6 even tips remain intact', () => {
  resetStorageEnv();

  // Step 1: Bookmark all 13 tips
  saveBookmarks(CANONICAL_IDS);
  const initial = loadBookmarks();
  assert.strictEqual(initial.length, 13);

  // Step 2: Unbookmark odd tips (1st, 3rd, 5th, 7th, 9th, 11th, 13th)
  // Odd IDs (7 tips): batt-reset, mech-key, neutral-shift, paddle-regen, key-case, ar-film, wireless-dongle
  // Even IDs (6 tips): wiper-service, auto-defog, pulse-glide, battery-thermal, console-tray, bumper-guard
  assert.strictEqual(ODD_IDS.length, 7, 'Must have exactly 7 odd tips');
  assert.strictEqual(EVEN_IDS.length, 6, 'Must have exactly 6 even tips');

  const afterRemoval = initial.filter(id => !ODD_IDS.includes(id));
  saveBookmarks(afterRemoval);

  // Step 3: Reload state and verify
  const reloaded = loadBookmarks();
  assert.strictEqual(reloaded.length, 6, 'Exactly 6 even tips must remain in storage');
  assert.deepStrictEqual(reloaded, EVEN_IDS, 'Remaining tips must strictly match the 6 even tips');

  // Verify none of the odd tips are present
  ODD_IDS.forEach(oddId => {
    assert.strictEqual(reloaded.includes(oddId), false, `Odd tip "${oddId}" must NOT be present in storage`);
  });

  // Verify all even tips are present
  EVEN_IDS.forEach(evenId => {
    assert.strictEqual(reloaded.includes(evenId), true, `Even tip "${evenId}" must be present in storage`);
  });
});

test('MULTI-03', 'Sequential unbookmarking one-by-one decrements state with 100% precision (13 -> 12 -> ... -> 0)', () => {
  resetStorageEnv();
  saveBookmarks(CANONICAL_IDS);

  let current = loadBookmarks();
  assert.strictEqual(current.length, 13);

  // Remove one by one
  for (let i = 0; i < CANONICAL_IDS.length; i++) {
    const idToRemove = CANONICAL_IDS[i];
    current = current.filter(id => id !== idToRemove);
    saveBookmarks(current);

    const reloaded = loadBookmarks();
    assert.strictEqual(reloaded.length, 13 - (i + 1), `Length must be ${13 - (i + 1)} after removing ${idToRemove}`);
    assert.strictEqual(reloaded.includes(idToRemove), false, `${idToRemove} must be removed`);
  }

  assert.deepStrictEqual(loadBookmarks(), [], 'Final state must be empty array');
});

// =============================================================================
// VECTOR 5: FULL END-TO-END DOM HYDRATION & LIFECYCLE PERSISTENCE
// =============================================================================
console.log('\n▶ CATEGORY 5: END-TO-END DOM HYDRATION & INTERACTION LIFECYCLE');

test('E2E-01', 'Full lifecycle: DOM clicks all 13 -> reload DOM -> DOM unclicks 7 odd -> reload DOM verifies 6 even', () => {
  resetStorageEnv();

  // Stage 1: Initial Render
  const tree1 = buildMockSecretsTree();
  initSecretsModule(tree1.container);

  // Verify initial unbookmarked DOM state
  tree1.cards.forEach(card => {
    const btn = card.querySelector('.secret-bookmark-btn');
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(btn.classList.contains('is-bookmarked'), false);
    assert.strictEqual(btn.querySelector('.bookmark-text').textContent, '유용한 팁 저장');
  });

  // Stage 2: User clicks all 13 bookmark buttons
  tree1.cards.forEach(card => {
    const btn = card.querySelector('.secret-bookmark-btn');
    btn.click();
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(btn.classList.contains('is-bookmarked'), true);
    assert.strictEqual(btn.querySelector('.bookmark-text').textContent, '저장 완료');
  });

  // Verify storage reflects all 13
  let stored = loadBookmarks();
  assert.strictEqual(stored.length, 13);
  CANONICAL_IDS.forEach(id => assert.ok(stored.includes(id)));

  // Stage 3: Page Reload Simulation (Fresh DOM tree #2 hydrated from storage)
  const tree2 = buildMockSecretsTree();
  initSecretsModule(tree2.container);

  // Verify DOM hydration restored all 13 bookmarked buttons
  tree2.cards.forEach(card => {
    const btn = card.querySelector('.secret-bookmark-btn');
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'true', `Card ${card.dataset.secretId || card.attributes.id} must be hydrated as pressed`);
    assert.strictEqual(btn.classList.contains('is-bookmarked'), true);
    assert.strictEqual(btn.querySelector('.bookmark-text').textContent, '저장 완료');
  });

  // Stage 4: User clicks the 7 odd buttons to unbookmark them in the active DOM
  ODD_IDS.forEach(oddId => {
    const card = tree2.cards.find(c => c.getAttribute('id') === `secret-${oddId}`);
    assert.ok(card, `Card for ${oddId} must exist`);
    const btn = card.querySelector('.secret-bookmark-btn');
    btn.click(); // Unbookmark

    assert.strictEqual(btn.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(btn.classList.contains('is-bookmarked'), false);
    assert.strictEqual(btn.querySelector('.bookmark-text').textContent, '유용한 팁 저장');
  });

  // Verify even buttons in tree2 remain bookmarked
  EVEN_IDS.forEach(evenId => {
    const card = tree2.cards.find(c => c.getAttribute('id') === `secret-${evenId}`);
    const btn = card.querySelector('.secret-bookmark-btn');
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(btn.classList.contains('is-bookmarked'), true);
    assert.strictEqual(btn.querySelector('.bookmark-text').textContent, '저장 완료');
  });

  // Verify storage state now has exactly 6 even tips
  stored = loadBookmarks();
  assert.strictEqual(stored.length, 6);
  EVEN_IDS.forEach(id => assert.ok(stored.includes(id)));
  ODD_IDS.forEach(id => assert.strictEqual(stored.includes(id), false));

  // Stage 5: Second Page Reload Simulation (Fresh DOM tree #3 hydrated from modified storage)
  const tree3 = buildMockSecretsTree();
  initSecretsModule(tree3.container);

  // In tree3, exactly the 6 even cards must be bookmarked, and the 7 odd cards must be unbookmarked
  EVEN_IDS.forEach(evenId => {
    const card = tree3.cards.find(c => c.getAttribute('id') === `secret-${evenId}`);
    const btn = card.querySelector('.secret-bookmark-btn');
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'true', `Even tip ${evenId} must be hydrated as bookmarked`);
    assert.strictEqual(btn.classList.contains('is-bookmarked'), true);
    assert.strictEqual(btn.querySelector('.bookmark-text').textContent, '저장 완료');
  });

  ODD_IDS.forEach(oddId => {
    const card = tree3.cards.find(c => c.getAttribute('id') === `secret-${oddId}`);
    const btn = card.querySelector('.secret-bookmark-btn');
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'false', `Odd tip ${oddId} must be hydrated as unbookmarked`);
    assert.strictEqual(btn.classList.contains('is-bookmarked'), false);
    assert.strictEqual(btn.querySelector('.bookmark-text').textContent, '유용한 팁 저장');
  });
});

test('E2E-02', 'Idempotency test: duplicate initSecretsModule calls on same container do not double-bind listeners', () => {
  resetStorageEnv();
  const tree = buildMockSecretsTree();

  // Call init twice
  initSecretsModule(tree.container);
  initSecretsModule(tree.container);

  const card = tree.cards[0];
  const btn = card.querySelector('.secret-bookmark-btn');

  // Single click
  btn.click();
  // If double-bound, click would run twice: toggle on then toggle off!
  assert.strictEqual(btn.getAttribute('aria-pressed'), 'true', 'Single click must toggle to on (not toggled twice)');
  assert.strictEqual(btn.classList.contains('is-bookmarked'), true);
  assert.strictEqual(loadBookmarks().length, 1);
});

test('QUOTA-05', 'localStorage probe itself throws QuotaExceededError -> routes immediately to sessionStorage', () => {
  resetStorageEnv();

  // Make probe itself fail due to extreme storage saturation
  global.window.localStorage.setItem = (k, v) => {
    const err = new Error('QuotaExceededError: Probe failed - zero bytes free');
    err.name = 'QuotaExceededError';
    throw err;
  };

  assert.strictEqual(SafeStorage.isAvailable('localStorage'), false, 'isAvailable must be false when probe throws');
  
  saveBookmarks(['batt-reset', 'pulse-glide']);
  const loaded = loadBookmarks();
  assert.deepStrictEqual(loaded, ['batt-reset', 'pulse-glide'], 'Must fall back immediately to working tier');
});

test('POISON-07', 'Non-array arguments to saveBookmarks (null, undefined, number, object) safely normalize to []', () => {
  resetStorageEnv();

  [null, undefined, 42, 'string-payload', { a: 1 }].forEach(badInput => {
    assert.doesNotThrow(() => {
      saveBookmarks(badInput);
    });
    assert.deepStrictEqual(loadBookmarks(), [], `saveBookmarks(${JSON.stringify(badInput)}) must normalize to []`);
  });
});

test('POISON-08', 'Whitespace-only and empty string IDs in array are purged during loadBookmarks', () => {
  resetStorageEnv();

  SafeStorage.setJSON(SECRETS_BOOKMARKS_KEY, ['  ', '', '\t\n', 'batt-reset', '   ', 'mech-key', '  ']);
  const loaded = loadBookmarks();
  assert.deepStrictEqual(loaded, ['batt-reset', 'mech-key'], 'Whitespace/empty IDs must be filtered out');
});

test('E2E-03', 'Forward compatibility: unrecognized/future secret IDs in storage survive UI mutations', () => {
  resetStorageEnv();

  // Storage contains a future feature ID not rendered in current DOM
  saveBookmarks(['future-secret-2027', 'batt-reset']);

  const tree = buildMockSecretsTree();
  initSecretsModule(tree.container);

  // User interacts with a known card in the UI
  const wiperCard = tree.cards.find(c => c.getAttribute('id') === 'secret-wiper-service');
  wiperCard.querySelector('.secret-bookmark-btn').click(); // Bookmark wiper-service

  const current = loadBookmarks();
  assert.ok(current.includes('future-secret-2027'), 'Unrecognized future secret ID must be preserved');
  assert.ok(current.includes('batt-reset'), 'Existing batt-reset must be preserved');
  assert.ok(current.includes('wiper-service'), 'Newly added wiper-service must be included');
  assert.strictEqual(current.length, 3);
});

// -----------------------------------------------------------------------------
// EXECUTION SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log('  ADVERSARIAL STRESS TEST SUMMARY');
console.log('--------------------------------------------------------------------------------');
console.log(`  Total Tests:    ${totalTests}`);
console.log(`  Passed Tests:   ${passedTests}`);
console.log(`  Failed Tests:   ${failedTests}`);
console.log('--------------------------------------------------------------------------------');

if (failedTests === 0) {
  console.log('  FINAL VERDICT:  APPROVE (100% RESILIENT)');
  console.log('  State persistence, quota degradation, self-healing, and spam resilience verified.');
} else {
  console.log('  FINAL VERDICT:  REQUEST_CHANGES');
  console.log(`  ${failedTests} tests failed. Actionable remediation required.`);
}
console.log('================================================================================\n');

process.exit(failedTests === 0 ? 0 : 1);
