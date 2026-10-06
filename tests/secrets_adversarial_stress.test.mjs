/**
 * ==============================================================================
 * Tucson Hybrid Smart Key Trunk Prevention Tips Website
 * File: tests/secrets_adversarial_stress.test.mjs
 * Description: Empirical Adversarial Stress Suite for Advanced Tips & Hidden Features (#secrets)
 *
 * EMPIRICAL CHALLENGER 1 (m3_challenger_1)
 *
 * Adversarial Verifications:
 * 1. Physical HTML Specification & Card Inventory Integrity (index.html).
 * 2. 100 Randomized Rapid Category Switches & Card Visibility Invariant Check.
 * 3. Extreme Keyboard Navigation (WAI-ARIA tab pattern, wraps, Home/End, 1000 keystroke barrage).
 * 4. Re-initialization Idempotency & Event Listener Accumulation Check (Zero leaks).
 * 5. Bookmark Concurrency, SafeStorage Fail-over & Hydration Integrity.
 * ==============================================================================
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ============================================================================
// Section 1: Lightweight Robust DOM Simulation Engine
// ============================================================================

class MockClassList {
  constructor(initial = '') {
    this._classes = new Set(initial.split(/\s+/).filter(Boolean));
  }
  add(cls) {
    if (cls) this._classes.add(cls);
  }
  remove(cls) {
    if (cls) this._classes.delete(cls);
  }
  contains(cls) {
    return this._classes.has(cls);
  }
  toggle(cls, force) {
    if (force === undefined) {
      if (this._classes.has(cls)) {
        this._classes.delete(cls);
        return false;
      }
      this._classes.add(cls);
      return true;
    }
    if (force) {
      this._classes.add(cls);
      return true;
    }
    this._classes.delete(cls);
    return false;
  }
  toString() {
    return Array.from(this._classes).join(' ');
  }
  get value() {
    return this.toString();
  }
}

class MockElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.id = attributes.id || '';
    this.className = attributes.class || '';
    this.classList = new MockClassList(this.className);
    this.attributes = { ...attributes };
    this.dataset = {};
    this.children = [];
    this.parentNode = null;
    this._textContent = '';
    this.listeners = new Map();
    this.focused = false;

    // Hydrate dataset from data- attributes
    for (const [k, v] of Object.entries(attributes)) {
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        this.dataset[camel] = String(v);
      }
    }
  }

  getAttribute(name) {
    return this.attributes[name] !== undefined ? this.attributes[name] : null;
  }

  setAttribute(name, val) {
    const sVal = String(val);
    this.attributes[name] = sVal;
    if (name === 'id') this.id = sVal;
    if (name === 'class') {
      this.className = sVal;
      this.classList = new MockClassList(sVal);
    }
    if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
      this.dataset[camel] = sVal;
    }
  }

  hasAttribute(name) {
    return this.attributes[name] !== undefined;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'id') this.id = '';
    if (name === 'class') {
      this.className = '';
      this.classList = new MockClassList('');
    }
    if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
      delete this.dataset[camel];
    }
  }

  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map(c => c.textContent).join('');
  }

  set textContent(txt) {
    this._textContent = String(txt);
    this.children = [];
  }

  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
      return child;
    }
    throw new Error('NotFoundError: Node not found in parent');
  }

  closest(selector) {
    let curr = this;
    const matchSimple = (node, sel) => {
      sel = sel.trim();
      if (sel.startsWith('.')) return node.classList.contains(sel.slice(1));
      if (sel.startsWith('#')) return node.id === sel.slice(1);
      return node.tagName.toLowerCase() === sel.toLowerCase();
    };

    while (curr) {
      if (matchSimple(curr, selector)) return curr;
      curr = curr.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const subSelectors = selector.split(',').map(s => s.trim()).filter(Boolean);
    const res = new Set();

    const matchSingle = (node, s) => {
      if (s.startsWith('#')) return node.id === s.slice(1);
      if (s.startsWith('.')) {
        const classes = s.split('.').filter(Boolean);
        return classes.every(c => node.classList.contains(c));
      }
      return node.tagName.toLowerCase() === s.toLowerCase();
    };

    const walk = (node) => {
      for (const child of node.children) {
        for (const sub of subSelectors) {
          if (matchSingle(child, sub)) {
            res.add(child);
            break;
          }
        }
        walk(child);
      }
    };

    walk(this);
    return Array.from(res);
  }

  querySelector(selector) {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    if (!this.listeners.has(type)) return;
    const list = this.listeners.get(type);
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  focus() {
    this.focused = true;
  }

  click() {
    const handlers = this.listeners.get('click') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'click',
        target: this,
        currentTarget: this,
        preventDefault: () => {}
      });
    }
  }

  dispatchKeydown(key) {
    let defaultPrevented = false;
    const handlers = this.listeners.get('keydown') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'keydown',
        key,
        target: this,
        currentTarget: this,
        preventDefault: () => { defaultPrevented = true; }
      });
    }
    return { defaultPrevented };
  }
}

class MockDocument {
  constructor() {
    this.body = new MockElement('BODY');
    this.readyState = 'complete';
    this.listeners = new Map();
  }

  createElement(tag) {
    return new MockElement(tag);
  }

  getElementById(id) {
    const walk = (node) => {
      if (node.id === id) return node;
      for (const c of node.children) {
        const m = walk(c);
        if (m) return m;
      }
      return null;
    };
    return walk(this.body);
  }

  querySelector(sel) {
    if (sel === 'body' || sel === 'BODY') return this.body;
    return this.body.querySelector(sel);
  }

  querySelectorAll(sel) {
    return this.body.querySelectorAll(sel);
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
}

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(k) {
    return this.store.has(String(k)) ? this.store.get(String(k)) : null;
  }
  setItem(k, v) {
    this.store.set(String(k), String(v));
  }
  removeItem(k) {
    this.store.delete(String(k));
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
}

// ============================================================================
// Section 2: Global Environment Setup
// ============================================================================

const mockDoc = new MockDocument();
const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

let toastCalls = [];
let screenReaderCalls = [];

global.document = mockDoc;
global.window = {
  document: mockDoc,
  localStorage: mockLocalStorage,
  sessionStorage: mockSessionStorage,
  showToast: (msg) => { toastCalls.push(msg); },
  announceToScreenReader: (msg) => { screenReaderCalls.push(msg); },
  location: { href: 'https://tucson-hybrid-tips.vercel.app' }
};

// Import modules under test
const secretsModule = await import('../js/secrets.js');
const storageModule = await import('../js/storage.js');
const appModule = await import('../js/app.js');

const {
  initSecretsModule,
  loadBookmarks,
  saveBookmarks,
  SECRETS_BOOKMARKS_KEY,
  SECRETS_STORAGE_KEY,
  SECRETS_FILTER_KEY
} = secretsModule;
const { SafeStorage, MemoryStorage } = storageModule;

// ============================================================================
// Section 3: Test Harness & Canonical Data Definition
// ============================================================================

const CANONICAL_CARDS = [
  { id: 'batt-reset', cat: 'hidden', num: '#01', title: '12V 배터리 리셋 버튼 (12V BATT RESET)' },
  { id: 'wiper-service', cat: 'hidden', num: '#02', title: '히든 와이퍼 교체/세차 서비스 모드' },
  { id: 'mech-key', cat: 'hidden', num: '#03', title: '비상 기계식 키 및 도어 커버 탈거 & 림프홈 시동' },
  { id: 'auto-defog', cat: 'hidden', num: '#04', title: '오토 디포그(ADS) 하드웨어 간편 토글' },
  { id: 'neutral-shift', cat: 'hidden', num: '#05', title: '아파트 이중주차 N단(중립) 유지법' },
  { id: 'pulse-glide', cat: 'hybrid', num: '#06', title: 'EV 글라이드 & Pulse & Glide (P&G 테크닉)' },
  { id: 'paddle-regen', cat: 'hybrid', num: '#07', title: '패들시프트 회생제동 & 원페달 풀스탑' },
  { id: 'battery-thermal', cat: 'hybrid', num: '#08', title: '하이브리드 배터리 열관리 & 공조 연비 팁' },
  { id: 'key-case', cat: 'accessory', num: '#09', title: '스마트키 버튼 함몰형 아연합금 하드 케이스' },
  { id: 'console-tray', cat: 'accessory', num: '#10', title: '2단 센터 콘솔 트레이 오거나이저' },
  { id: 'ar-film', cat: 'accessory', num: '#11', title: '12.3인치 커브드 디스플레이 무광 저반사(AR) 보호필름' },
  { id: 'bumper-guard', cat: 'accessory', num: '#12', title: 'SUS304 스테인리스 트렁크 리어 범퍼 프로텍터' },
  { id: 'wireless-dongle', cat: 'accessory', num: '#13', title: '무선 카플레이 / 안드로이드 오토 어댑터 동글' }
];

/**
 * Builds a fresh Mock DOM Tree representing the physical #secrets section
 */
function buildMockSecretsTree() {
  const container = new MockElement('section', {
    id: 'secrets',
    class: 'section secrets-section',
    'aria-labelledby': 'secrets-heading'
  });

  const controls = new MockElement('div', {
    class: 'secrets-controls secrets-filter-tabs secrets-filter-bar no-print',
    role: 'tablist',
    'aria-label': '고급 꿀팁 카테고리 필터'
  });
  container.appendChild(controls);

  const tabsConfig = [
    { id: 'filter-tab-all', filter: 'all', count: '13', active: true },
    { id: 'filter-tab-hidden', filter: 'hidden', count: '5', active: false },
    { id: 'filter-tab-hybrid', filter: 'hybrid', count: '3', active: false },
    { id: 'filter-tab-accessory', filter: 'accessory', count: '5', active: false }
  ];

  const filterTabs = tabsConfig.map(cfg => {
    const btn = new MockElement('button', {
      type: 'button',
      class: `secrets-filter-btn secrets-tab-btn${cfg.active ? ' active' : ''}`,
      role: 'tab',
      id: cfg.id,
      'aria-selected': cfg.active ? 'true' : 'false',
      'aria-controls': 'secrets-grid',
      tabindex: cfg.active ? '0' : '-1',
      'data-filter': cfg.filter
    });
    btn.textContent = `${cfg.filter} ${cfg.count}`;
    controls.appendChild(btn);
    return btn;
  });

  const grid = new MockElement('div', {
    id: 'secrets-grid',
    class: 'secrets-grid grid grid-2-col',
    role: 'region',
    'aria-label': '투싼 하이브리드 숨은 기능 및 꿀팁 카드 목록'
  });
  container.appendChild(grid);

  const cards = CANONICAL_CARDS.map(item => {
    const card = new MockElement('article', {
      class: 'secret-card glass-card card-hover',
      'data-category': item.cat,
      id: `secret-${item.id}`
    });

    const header = new MockElement('div', { class: 'secret-card-header' });
    const numSpan = new MockElement('span', { class: 'secret-num' });
    numSpan.textContent = item.num;
    header.appendChild(numSpan);
    card.appendChild(header);

    const body = new MockElement('div', { class: 'secret-card-body' });
    const title = new MockElement('h3', { class: 'secret-title' });
    title.textContent = item.title;
    body.appendChild(title);
    card.appendChild(body);

    const footer = new MockElement('div', { class: 'secret-card-footer secret-card-actions' });
    const bookmarkBtn = new MockElement('button', {
      type: 'button',
      class: 'btn btn-outline btn-sm btn-bookmark secret-bookmark-btn',
      'data-secret-id': item.id,
      'aria-pressed': 'false',
      'aria-label': `${item.title} 꿀팁 저장`
    });

    const iconSpan = new MockElement('span', { class: 'bookmark-icon' });
    iconSpan.textContent = '⭐';
    bookmarkBtn.appendChild(iconSpan);

    const textSpan = new MockElement('span', { class: 'bookmark-text' });
    textSpan.textContent = '유용한 팁 저장';
    bookmarkBtn.appendChild(textSpan);

    footer.appendChild(bookmarkBtn);
    card.appendChild(footer);

    grid.appendChild(card);
    return card;
  });

  const announcer = new MockElement('div', {
    id: 'global-announcer',
    class: 'visually-hidden',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true'
  });
  mockDoc.body.appendChild(announcer);

  mockDoc.body.appendChild(container);
  return { container, filterTabs, cards, grid, announcer };
}

function resetEnvironment() {
  mockDoc.body.children = [];
  mockLocalStorage.setItem = function(k, v) { this.store.set(String(k), String(v)); };
  mockLocalStorage.clear();
  mockSessionStorage.clear();
  SafeStorage.clear();
  toastCalls = [];
  screenReaderCalls = [];
}

const suiteResults = [];

async function runTest(id, name, testFn) {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    suiteResults.push({ id, name, status: 'PASS', duration });
    console.log(`  [✔ PASS] ${id}: ${name} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - start;
    suiteResults.push({ id, name, status: 'FAIL', duration, error: err.message, stack: err.stack });
    console.error(`  [✖ FAIL] ${id}: ${name} (${duration}ms)`);
    console.error(`         Error: ${err.message}`);
  }
}

// ============================================================================
// Execution: Adversarial Stress Suites
// ============================================================================

console.log('\n================================================================================');
console.log('▶ ADVERSARIAL STRESS CHALLENGE: #secrets MODULE (m3_challenger_1)');
console.log('================================================================================\n');

// ----------------------------------------------------------------------------
// SUITE 1: Physical HTML Specification & Card Inventory Integrity
// ----------------------------------------------------------------------------
console.log('--- SUITE 1: Physical HTML Specification & Inventory Verification ---');

await runTest('SEC-HTML-01', 'Physical index.html contains #secrets section with full accessibility contracts', () => {
  const htmlPath = path.join(rootDir, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('id="secrets"'), 'Section #secrets must physically exist in index.html');
  assert.ok(html.includes('aria-labelledby="secrets-heading"'), 'Section must declare aria-labelledby="secrets-heading"');
  assert.ok(html.includes('id="secrets-heading"'), 'Heading id="secrets-heading" must exist');
  assert.ok(html.includes('role="tablist"'), 'Category controls must have role="tablist"');
  assert.ok(html.includes('id="secrets-grid"'), 'Card grid id="secrets-grid" must exist');
});

await runTest('SEC-HTML-02', 'Physical index.html contains exactly 13 cards with exact category distribution (5 hidden, 3 hybrid, 5 accessory)', () => {
  const htmlPath = path.join(rootDir, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Extract all secret cards
  const cardMatches = [...html.matchAll(/class="secret-card[^"]*"[^>]*data-category="([^"]+)"/g)];
  assert.strictEqual(cardMatches.length, 13, `Expected exactly 13 cards in index.html, found ${cardMatches.length}`);

  const counts = { hidden: 0, hybrid: 0, accessory: 0 };
  for (const match of cardMatches) {
    const cat = match[1];
    assert.ok(['hidden', 'hybrid', 'accessory'].includes(cat), `Unknown category found: ${cat}`);
    counts[cat]++;
  }

  assert.strictEqual(counts.hidden, 5, `Expected 5 hidden cards, found ${counts.hidden}`);
  assert.strictEqual(counts.hybrid, 3, `Expected 3 hybrid cards, found ${counts.hybrid}`);
  assert.strictEqual(counts.accessory, 5, `Expected 5 accessory cards, found ${counts.accessory}`);
});

await runTest('SEC-HTML-03', 'All 13 cards possess unique IDs and unique bookmark button secret-ids', () => {
  const htmlPath = path.join(rootDir, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const cardIdMatches = [...html.matchAll(/<article[^>]*id="(secret-[^"]+)"/g)].map(m => m[1]);
  assert.strictEqual(cardIdMatches.length, 13, `Expected 13 card IDs, found ${cardIdMatches.length}`);
  const uniqueCardIds = new Set(cardIdMatches);
  assert.strictEqual(uniqueCardIds.size, 13, 'Card IDs must be strictly unique');

  const bookmarkIds = [...html.matchAll(/class="[^"]*secret-bookmark-btn[^"]*"[^>]*data-secret-id="([^"]+)"/g)].map(m => m[1]);
  assert.strictEqual(bookmarkIds.length, 13, `Expected 13 bookmark button IDs, found ${bookmarkIds.length}`);
  const uniqueBookmarkIds = new Set(bookmarkIds);
  assert.strictEqual(uniqueBookmarkIds.size, 13, 'Bookmark secret-ids must be strictly unique');

  // Verify all 13 canonical IDs are present
  for (const c of CANONICAL_CARDS) {
    assert.ok(uniqueBookmarkIds.has(c.id), `Missing canonical secret id in HTML: ${c.id}`);
  }
});

// ----------------------------------------------------------------------------
// SUITE 2: Rapid Randomized Category Switching & Visibility Invariant
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 2: 100 Randomized Rapid Category Switches & Visibility Invariants ---');

await runTest('SEC-SWT-01', 'Initial state: "all" category active, all 13 cards visible with zero hidden attributes', () => {
  resetEnvironment();
  const { container, filterTabs, cards } = buildMockSecretsTree();

  initSecretsModule(container);

  // Tab state check
  assert.ok(filterTabs[0].classList.contains('active'), 'Tab "all" should have active class');
  assert.strictEqual(filterTabs[0].getAttribute('aria-selected'), 'true');
  assert.strictEqual(filterTabs[0].getAttribute('tabindex'), '0');

  for (let i = 1; i < filterTabs.length; i++) {
    assert.ok(!filterTabs[i].classList.contains('active'), `Tab ${i} should not be active`);
    assert.strictEqual(filterTabs[i].getAttribute('aria-selected'), 'false');
    assert.strictEqual(filterTabs[i].getAttribute('tabindex'), '-1');
  }

  // Cards visibility check
  const visibleCards = cards.filter(c => !c.classList.contains('is-hidden') && !c.hasAttribute('hidden'));
  assert.strictEqual(visibleCards.length, 13, 'All 13 cards must be visible on initial load');
});

await runTest('SEC-SWT-02', '100 Rapid randomized category switches maintain zero-desync invariant across all 13 cards', () => {
  resetEnvironment();
  const { container, filterTabs, cards } = buildMockSecretsTree();
  initSecretsModule(container);

  const categories = ['all', 'hidden', 'hybrid', 'accessory'];
  const expectedCounts = {
    all: 13,
    hidden: 5,
    hybrid: 3,
    accessory: 5
  };

  // Seeded deterministic pseudo-random sequence for repeatability
  let seed = 42;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let cycle = 1; cycle <= 100; cycle++) {
    const targetCat = categories[Math.floor(pseudoRandom() * categories.length)];
    const targetTab = filterTabs.find(t => t.dataset.filter === targetCat);

    // Simulate user click
    targetTab.click();

    // Verification 1: Exactly one tab is active
    const activeTabs = filterTabs.filter(t => t.classList.contains('active'));
    assert.strictEqual(activeTabs.length, 1, `Cycle ${cycle}: Expected exactly 1 active tab, got ${activeTabs.length}`);
    assert.strictEqual(activeTabs[0].dataset.filter, targetCat, `Cycle ${cycle}: Active tab must match target category`);
    assert.strictEqual(activeTabs[0].getAttribute('aria-selected'), 'true');
    assert.strictEqual(activeTabs[0].getAttribute('tabindex'), '0');

    // Verification 2: Storage persistence updated
    assert.strictEqual(SafeStorage.getItem(SECRETS_FILTER_KEY), targetCat, `Cycle ${cycle}: Filter must be saved to storage`);

    // Verification 3: Card visibility strict invariant
    let visibleCount = 0;
    let hiddenCount = 0;

    cards.forEach((card, idx) => {
      const cardCategory = card.dataset.category;
      const shouldBeVisible = (targetCat === 'all' || cardCategory === targetCat);

      const hasHiddenClass = card.classList.contains('is-hidden');
      const hasHiddenAttr = card.hasAttribute('hidden');

      // STRICT DESYNC CHECK: class and attribute MUST ALWAYS MATCH
      assert.strictEqual(hasHiddenClass, hasHiddenAttr,
        `Cycle ${cycle}, Card ${idx} (${card.id}): Class .is-hidden (${hasHiddenClass}) and attribute [hidden] (${hasHiddenAttr}) desynchronized!`);

      if (shouldBeVisible) {
        assert.ok(!hasHiddenClass, `Cycle ${cycle}, Card ${card.id}: Expected visible for '${targetCat}', but found .is-hidden`);
        assert.ok(!hasHiddenAttr, `Cycle ${cycle}, Card ${card.id}: Expected visible for '${targetCat}', but found [hidden]`);
        visibleCount++;
      } else {
        assert.ok(hasHiddenClass, `Cycle ${cycle}, Card ${card.id}: Expected hidden for '${targetCat}', but lacked .is-hidden`);
        assert.ok(hasHiddenAttr, `Cycle ${cycle}, Card ${card.id}: Expected hidden for '${targetCat}', but lacked [hidden]`);
        hiddenCount++;
      }
    });

    assert.strictEqual(visibleCount, expectedCounts[targetCat],
      `Cycle ${cycle}: Expected ${expectedCounts[targetCat]} visible cards for '${targetCat}', got ${visibleCount}`);
    assert.strictEqual(hiddenCount, 13 - expectedCounts[targetCat],
      `Cycle ${cycle}: Expected ${13 - expectedCounts[targetCat]} hidden cards for '${targetCat}', got ${hiddenCount}`);
  }
});

await runTest('SEC-SWT-03', 'Ping-Pong stress: 25 full cycles of all -> hidden -> hybrid -> accessory -> all (100 switches)', () => {
  resetEnvironment();
  const { container, filterTabs, cards } = buildMockSecretsTree();
  initSecretsModule(container);

  const order = ['all', 'hidden', 'hybrid', 'accessory', 'all'];

  for (let round = 1; round <= 25; round++) {
    for (const cat of order) {
      const tab = filterTabs.find(t => t.dataset.filter === cat);
      tab.click();

      // Verify count
      const visible = cards.filter(c => !c.classList.contains('is-hidden'));
      const expected = (cat === 'all' ? 13 : cat === 'hidden' ? 5 : cat === 'hybrid' ? 3 : 5);
      assert.strictEqual(visible.length, expected, `Round ${round}, Cat ${cat}: Expected ${expected} cards`);
    }
  }
});

// ----------------------------------------------------------------------------
// SUITE 3: Extreme Keyboard Navigation (WAI-ARIA Tab Pattern)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Extreme Keyboard Navigation & WAI-ARIA Boundaries ---');

await runTest('SEC-KEY-01', 'ArrowRight / ArrowDown wrapping: 0 -> 1 -> 2 -> 3 -> 0 wraps around seamlessly', () => {
  resetEnvironment();
  const { container, filterTabs } = buildMockSecretsTree();
  initSecretsModule(container);

  // Tab 0 starts active ('all')
  assert.strictEqual(filterTabs[0].getAttribute('aria-selected'), 'true');

  // Step 1: ArrowRight from Tab 0 -> Tab 1 ('hidden')
  let res = filterTabs[0].dispatchKeydown('ArrowRight');
  assert.ok(res.defaultPrevented, 'ArrowRight should preventDefault');
  assert.ok(filterTabs[1].focused, 'Tab 1 should receive focus');
  assert.strictEqual(filterTabs[1].getAttribute('aria-selected'), 'true');
  assert.strictEqual(SafeStorage.getItem(SECRETS_FILTER_KEY), 'hidden');

  // Step 2: ArrowDown from Tab 1 -> Tab 2 ('hybrid')
  res = filterTabs[1].dispatchKeydown('ArrowDown');
  assert.ok(res.defaultPrevented);
  assert.ok(filterTabs[2].focused);
  assert.strictEqual(filterTabs[2].getAttribute('aria-selected'), 'true');
  assert.strictEqual(SafeStorage.getItem(SECRETS_FILTER_KEY), 'hybrid');

  // Step 3: ArrowRight from Tab 2 -> Tab 3 ('accessory')
  res = filterTabs[2].dispatchKeydown('ArrowRight');
  assert.ok(res.defaultPrevented);
  assert.ok(filterTabs[3].focused);
  assert.strictEqual(filterTabs[3].getAttribute('aria-selected'), 'true');
  assert.strictEqual(SafeStorage.getItem(SECRETS_FILTER_KEY), 'accessory');

  // Step 4: ArrowRight from Tab 3 -> WRAPS to Tab 0 ('all')
  res = filterTabs[3].dispatchKeydown('ArrowRight');
  assert.ok(res.defaultPrevented);
  assert.ok(filterTabs[0].focused, 'Tab 0 should receive focus after wrapping from end');
  assert.strictEqual(filterTabs[0].getAttribute('aria-selected'), 'true');
  assert.strictEqual(SafeStorage.getItem(SECRETS_FILTER_KEY), 'all');
});

await runTest('SEC-KEY-02', 'ArrowLeft / ArrowUp wrapping: 0 -> 3 (wraps) -> 2 -> 1 -> 0 seamlessly', () => {
  resetEnvironment();
  const { container, filterTabs } = buildMockSecretsTree();
  initSecretsModule(container);

  // Step 1: ArrowLeft from Tab 0 ('all') -> WRAPS to Tab 3 ('accessory')
  let res = filterTabs[0].dispatchKeydown('ArrowLeft');
  assert.ok(res.defaultPrevented, 'ArrowLeft should preventDefault');
  assert.ok(filterTabs[3].focused, 'Tab 3 should receive focus after reverse wrapping');
  assert.strictEqual(filterTabs[3].getAttribute('aria-selected'), 'true');
  assert.strictEqual(SafeStorage.getItem(SECRETS_FILTER_KEY), 'accessory');

  // Step 2: ArrowUp from Tab 3 -> Tab 2 ('hybrid')
  res = filterTabs[3].dispatchKeydown('ArrowUp');
  assert.ok(res.defaultPrevented);
  assert.ok(filterTabs[2].focused);
  assert.strictEqual(filterTabs[2].getAttribute('aria-selected'), 'true');

  // Step 3: ArrowLeft from Tab 2 -> Tab 1 ('hidden')
  res = filterTabs[2].dispatchKeydown('ArrowLeft');
  assert.ok(res.defaultPrevented);
  assert.ok(filterTabs[1].focused);
  assert.strictEqual(filterTabs[1].getAttribute('aria-selected'), 'true');

  // Step 4: ArrowLeft from Tab 1 -> Tab 0 ('all')
  res = filterTabs[1].dispatchKeydown('ArrowLeft');
  assert.ok(res.defaultPrevented);
  assert.ok(filterTabs[0].focused);
  assert.strictEqual(filterTabs[0].getAttribute('aria-selected'), 'true');
});

await runTest('SEC-KEY-03', 'Home and End key navigation: jumps to boundaries from any intermediate tab', () => {
  resetEnvironment();
  const { container, filterTabs } = buildMockSecretsTree();
  initSecretsModule(container);

  // Activate Tab 2 ('hybrid')
  filterTabs[2].click();
  assert.strictEqual(filterTabs[2].getAttribute('aria-selected'), 'true');

  // Press Home -> Jumps to Tab 0 ('all')
  let res = filterTabs[2].dispatchKeydown('Home');
  assert.ok(res.defaultPrevented, 'Home should preventDefault');
  assert.ok(filterTabs[0].focused);
  assert.strictEqual(filterTabs[0].getAttribute('aria-selected'), 'true');

  // From Tab 0, press End -> Jumps to Tab 3 ('accessory')
  res = filterTabs[0].dispatchKeydown('End');
  assert.ok(res.defaultPrevented, 'End should preventDefault');
  assert.ok(filterTabs[3].focused);
  assert.strictEqual(filterTabs[3].getAttribute('aria-selected'), 'true');
  assert.strictEqual(SafeStorage.getItem(SECRETS_FILTER_KEY), 'accessory');

  // From Tab 3, press Home -> Jumps back to Tab 0
  res = filterTabs[3].dispatchKeydown('Home');
  assert.ok(res.defaultPrevented);
  assert.ok(filterTabs[0].focused);
  assert.strictEqual(filterTabs[0].getAttribute('aria-selected'), 'true');
});

await runTest('SEC-KEY-04', '1,000 Keystroke randomized navigation barrage: zero index-out-of-bounds or exceptions', () => {
  resetEnvironment();
  const { container, filterTabs, cards } = buildMockSecretsTree();
  initSecretsModule(container);

  const navKeys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  let currentActiveIndex = 0;

  for (let i = 0; i < 1000; i++) {
    const key = navKeys[Math.floor(Math.random() * navKeys.length)];
    const activeTab = filterTabs[currentActiveIndex];

    const { defaultPrevented } = activeTab.dispatchKeydown(key);
    assert.ok(defaultPrevented, `Key ${key} must prevent default navigation`);

    // Determine expected index
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      currentActiveIndex = (currentActiveIndex + 1) % 4;
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      currentActiveIndex = (currentActiveIndex - 1 + 4) % 4;
    } else if (key === 'Home') {
      currentActiveIndex = 0;
    } else if (key === 'End') {
      currentActiveIndex = 3;
    }

    // Assert internal state consistency
    assert.ok(currentActiveIndex >= 0 && currentActiveIndex <= 3, `Index out of bounds: ${currentActiveIndex}`);
    assert.strictEqual(filterTabs[currentActiveIndex].getAttribute('aria-selected'), 'true');
    assert.strictEqual(filterTabs[currentActiveIndex].getAttribute('tabindex'), '0');
    assert.ok(filterTabs[currentActiveIndex].focused);
  }

  // After 1000 keystrokes, verify cards are properly synchronized with final active tab
  const finalCategory = filterTabs[currentActiveIndex].dataset.filter;
  const expectedVisibleCount = finalCategory === 'all' ? 13 : finalCategory === 'hidden' ? 5 : finalCategory === 'hybrid' ? 3 : 5;
  const actualVisible = cards.filter(c => !c.classList.contains('is-hidden'));
  assert.strictEqual(actualVisible.length, expectedVisibleCount, 'Cards must match final category state after keystroke barrage');
});

await runTest('SEC-KEY-05', 'Inert & Invalid keys: Tab, Enter, Space, Escape, PageUp, undefined do not mutate state or throw', () => {
  resetEnvironment();
  const { container, filterTabs } = buildMockSecretsTree();
  initSecretsModule(container);

  const inertKeys = ['Tab', 'Enter', ' ', 'Escape', 'PageUp', 'PageDown', 'Backspace', 'Shift', 'a', '', null, undefined];

  filterTabs[1].click(); // Activate 'hidden'
  assert.strictEqual(filterTabs[1].getAttribute('aria-selected'), 'true');

  for (const k of inertKeys) {
    const res = filterTabs[1].dispatchKeydown(k);
    assert.strictEqual(res.defaultPrevented, false, `Inert key '${k}' should NOT preventDefault`);
    assert.strictEqual(filterTabs[1].getAttribute('aria-selected'), 'true', `Inert key '${k}' should not change active tab`);
    assert.strictEqual(SafeStorage.getItem(SECRETS_FILTER_KEY), 'hidden');
  }
});

// ----------------------------------------------------------------------------
// SUITE 4: Re-initialization & Listener Idempotency Stress (Zero Leaks)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Re-initialization Idempotency & Memory Leak Checks ---');

await runTest('SEC-IDEM-01', 'initSecretsModule() called 50 times on same container: strict dataset guard prevents duplicate listeners', () => {
  resetEnvironment();
  const { container, filterTabs, cards } = buildMockSecretsTree();

  // First initialization
  initSecretsModule(container);
  assert.strictEqual(container.dataset.secretsBound, 'true');

  // Verify initial listener counts
  const initialClickCount = filterTabs[0].listeners.get('click')?.length || 0;
  const initialKeyCount = filterTabs[0].listeners.get('keydown')?.length || 0;
  assert.strictEqual(initialClickCount, 1, 'Filter tab should have 1 click handler');
  assert.strictEqual(initialKeyCount, 1, 'Filter tab should have 1 keydown handler');

  const bookmarkBtn = cards[0].querySelector('.secret-bookmark-btn');
  const initialBookmarkCount = bookmarkBtn.listeners.get('click')?.length || 0;
  assert.strictEqual(initialBookmarkCount, 1, 'Bookmark button should have 1 click handler');

  // Call initSecretsModule 49 more times
  for (let i = 2; i <= 50; i++) {
    initSecretsModule(container);
  }

  // Listener counts MUST REMAIN UNCHANGED
  assert.strictEqual(filterTabs[0].listeners.get('click')?.length, 1, 'Click listener must NOT accumulate');
  assert.strictEqual(filterTabs[0].listeners.get('keydown')?.length, 1, 'Keydown listener must NOT accumulate');
  assert.strictEqual(bookmarkBtn.listeners.get('click')?.length, 1, 'Bookmark listener must NOT accumulate');
});

await runTest('SEC-IDEM-02', '50 Re-initializations do not multiply side effects on single button click', () => {
  resetEnvironment();
  const { container, cards } = buildMockSecretsTree();

  for (let i = 1; i <= 50; i++) {
    initSecretsModule(container);
  }

  const bookmarkBtn = cards[0].querySelector('.secret-bookmark-btn');
  toastCalls = [];

  // Single click
  bookmarkBtn.click();

  // Toast should fire strictly ONCE, not 50 times!
  assert.strictEqual(toastCalls.length, 1, `Expected exactly 1 toast call, received ${toastCalls.length}`);
  assert.ok(toastCalls[0].includes('12V 배터리 리셋 버튼'), 'Toast message should contain card title');

  // Saved bookmarks array should contain exactly 1 item
  const saved = loadBookmarks();
  assert.strictEqual(saved.length, 1, `Expected 1 bookmark saved, got ${saved.length}`);
  assert.strictEqual(saved[0], 'batt-reset');
});

await runTest('SEC-IDEM-03', 'Defensive inputs to initSecretsModule: null, undefined, non-existent selector do not throw', () => {
  assert.doesNotThrow(() => initSecretsModule(null));
  assert.doesNotThrow(() => initSecretsModule(undefined));
  assert.doesNotThrow(() => initSecretsModule('#definitely-not-in-dom'));
  assert.doesNotThrow(() => initSecretsModule(new MockElement('section')));
});

// ----------------------------------------------------------------------------
// SUITE 5: Bookmark Concurrency, Hydration & Storage Resilience
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Bookmark Concurrency, Hydration & Storage Resilience ---');

await runTest('SEC-BMK-01', 'Initial bookmark hydration: pre-existing bookmarks in storage correctly illuminate UI cards', () => {
  resetEnvironment();
  const preSaved = ['batt-reset', 'pulse-glide', 'key-case'];
  saveBookmarks(preSaved);

  const { container, cards } = buildMockSecretsTree();
  initSecretsModule(container);

  for (const card of cards) {
    const btn = card.querySelector('.secret-bookmark-btn');
    const secretId = btn.dataset.secretId;
    const isPreSaved = preSaved.includes(secretId);

    if (isPreSaved) {
      assert.strictEqual(btn.getAttribute('aria-pressed'), 'true', `Card ${secretId} must have aria-pressed="true"`);
      assert.ok(btn.classList.contains('is-bookmarked'), `Card ${secretId} must have class .is-bookmarked`);
      assert.strictEqual(btn.querySelector('.bookmark-text')?.textContent, '저장 완료');
    } else {
      assert.strictEqual(btn.getAttribute('aria-pressed'), 'false', `Card ${secretId} must have aria-pressed="false"`);
      assert.ok(!btn.classList.contains('is-bookmarked'), `Card ${secretId} must not have class .is-bookmarked`);
      assert.strictEqual(btn.querySelector('.bookmark-text')?.textContent, '유용한 팁 저장');
    }
  }
});

await runTest('SEC-BMK-02', 'Rapid 50 toggle clicks on single card cleanly alternates state without duplicate IDs', () => {
  resetEnvironment();
  const { container, cards } = buildMockSecretsTree();
  initSecretsModule(container);

  const btn = cards[0].querySelector('.secret-bookmark-btn');

  for (let clickNum = 1; clickNum <= 50; clickNum++) {
    btn.click();
    const shouldBeBookmarked = (clickNum % 2 === 1);

    assert.strictEqual(btn.getAttribute('aria-pressed'), shouldBeBookmarked ? 'true' : 'false');
    assert.strictEqual(btn.classList.contains('is-bookmarked'), shouldBeBookmarked);

    const stored = loadBookmarks();
    if (shouldBeBookmarked) {
      assert.strictEqual(stored.length, 1);
      assert.strictEqual(stored[0], 'batt-reset');
    } else {
      assert.strictEqual(stored.length, 0);
    }
  }
});

await runTest('SEC-BMK-03', 'Mass bookmarking all 13 cards and full revocation: complete set fidelity', () => {
  resetEnvironment();
  const { container, cards } = buildMockSecretsTree();
  initSecretsModule(container);

  // Bookmark all 13 cards
  for (let i = 0; i < cards.length; i++) {
    const btn = cards[i].querySelector('.secret-bookmark-btn');
    btn.click();
  }

  let stored = loadBookmarks();
  assert.strictEqual(stored.length, 13, 'All 13 cards should be in stored bookmarks');
  const storedSet = new Set(stored);
  assert.strictEqual(storedSet.size, 13, 'Stored bookmarks must contain no duplicate entries');

  // Verify all UI buttons are in bookmarked state
  for (const card of cards) {
    const btn = card.querySelector('.secret-bookmark-btn');
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'true');
    assert.ok(btn.classList.contains('is-bookmarked'));
  }

  // Revoke bookmarks in reverse order
  for (let i = cards.length - 1; i >= 0; i--) {
    const btn = cards[i].querySelector('.secret-bookmark-btn');
    btn.click();
  }

  stored = loadBookmarks();
  assert.strictEqual(stored.length, 0, 'Storage must be completely empty after full revocation');
});

await runTest('SEC-BMK-04', 'Storage error resilience: QuotaExceededError and SecurityError safely fallback without crashing UI', () => {
  resetEnvironment();
  const { container, cards } = buildMockSecretsTree();

  // Force localStorage.setItem to throw QuotaExceededError
  const quotaErr = new Error('The quota has been exceeded.');
  quotaErr.name = 'QuotaExceededError';
  quotaErr.code = 22;
  mockLocalStorage.setItem = () => { throw quotaErr; };

  initSecretsModule(container);

  const btn = cards[0].querySelector('.secret-bookmark-btn');

  // Clicking bookmark must NOT throw unhandled error to the user
  assert.doesNotThrow(() => {
    btn.click();
  }, 'Bookmark toggle must degrade safely when localStorage quota is exceeded');

  // UI button should still reflect bookmarked state locally
  assert.strictEqual(btn.getAttribute('aria-pressed'), 'true');
  assert.ok(btn.classList.contains('is-bookmarked'));

  // MemoryStorage or sessionStorage should safely hold the fallback data
  const fallback = SafeStorage.getJSON(SECRETS_BOOKMARKS_KEY, null, []);
  assert.strictEqual(fallback.length, 1);
  assert.strictEqual(fallback[0], 'batt-reset');
});

await runTest('SEC-BMK-05', 'Poisoned/Corrupted JSON in bookmarks storage auto-heals and gracefully recovers', () => {
  resetEnvironment();
  // Poison the storage with corrupt JSON
  mockLocalStorage.setItem(SECRETS_BOOKMARKS_KEY, '{"invalid_json"::::corrupted');

  const bookmarks = loadBookmarks();
  assert.deepStrictEqual(bookmarks, [], 'Corrupted JSON should fallback to empty array');

  // Poison with non-string array
  mockLocalStorage.setItem(SECRETS_BOOKMARKS_KEY, JSON.stringify([123, null, '', '  ', false, 'valid-id']));
  const sanitized = loadBookmarks();
  assert.deepStrictEqual(sanitized, ['valid-id'], 'Schema validator must filter out non-strings and empty strings');
});

await runTest('SEC-FLT-01', 'Storage filter restoration on initialization: valid saved category restores smoothly', () => {
  resetEnvironment();
  SafeStorage.setItem(SECRETS_FILTER_KEY, 'hybrid');

  const { container, filterTabs, cards } = buildMockSecretsTree();
  initSecretsModule(container);

  // Filter tab 2 ('hybrid') should be active
  assert.ok(filterTabs[2].classList.contains('active'));
  assert.strictEqual(filterTabs[2].getAttribute('aria-selected'), 'true');
  assert.strictEqual(filterTabs[2].getAttribute('tabindex'), '0');

  // 3 hybrid cards visible, 10 hidden
  const visible = cards.filter(c => !c.classList.contains('is-hidden'));
  assert.strictEqual(visible.length, 3);
});

await runTest('SEC-FLT-02', 'Poisoned/Malicious filter values in storage default safely to "all"', () => {
  resetEnvironment();
  // Inject malicious script / unknown category in storage
  SafeStorage.setItem(SECRETS_FILTER_KEY, '<script>alert(1)</script>');

  const { container, filterTabs, cards } = buildMockSecretsTree();
  initSecretsModule(container);

  // Tab 0 ('all') must remain active
  assert.ok(filterTabs[0].classList.contains('active'));
  assert.strictEqual(filterTabs[0].getAttribute('aria-selected'), 'true');

  // All 13 cards visible
  const visible = cards.filter(c => !c.classList.contains('is-hidden'));
  assert.strictEqual(visible.length, 13);
});

await runTest('SEC-SR-01', 'Accessibility screen reader announcements trigger with exact Korean category counts on filter switch', async () => {
  resetEnvironment();
  const { container, filterTabs, announcer } = buildMockSecretsTree();
  initSecretsModule(container);

  // Click hidden tab
  filterTabs[1].click();
  await new Promise(r => setTimeout(r, 70));
  assert.strictEqual(announcer.textContent, '차량 숨은 기능 5개 항목이 표시됩니다.');

  // Click hybrid tab
  filterTabs[2].click();
  await new Promise(r => setTimeout(r, 70));
  assert.strictEqual(announcer.textContent, '하이브리드 연비 3개 항목이 표시됩니다.');

  // Click accessory tab
  filterTabs[3].click();
  await new Promise(r => setTimeout(r, 70));
  assert.strictEqual(announcer.textContent, '추천 용품 5개 항목이 표시됩니다.');

  // Click all tab
  filterTabs[0].click();
  await new Promise(r => setTimeout(r, 70));
  assert.strictEqual(announcer.textContent, '전체 13개 항목이 표시됩니다.');
});

// ============================================================================
// Section 4: Summary & Empirical Verdict
// ============================================================================

console.log('\n================================================================================');
console.log('  ADVERSARIAL STRESS TEST EXECUTION SUMMARY (#secrets)');
console.log('--------------------------------------------------------------------------------');

const total = suiteResults.length;
const passed = suiteResults.filter(r => r.status === 'PASS').length;
const failed = suiteResults.filter(r => r.status === 'FAIL').length;

console.log(`  Total Stress Tests: ${total}`);
console.log(`  Passed:             ${passed}`);
console.log(`  Failed:             ${failed}`);
console.log('--------------------------------------------------------------------------------');

if (failed === 0) {
  console.log('  EMPIRICAL VERDICT:  APPROVE (100% Robustness Verified across all 5 Suites)');
} else {
  console.log('  EMPIRICAL VERDICT:  REQUEST_CHANGES (Regressions / Failures Detected)');
}
console.log('================================================================================\n');

process.exit(failed === 0 ? 0 : 1);

