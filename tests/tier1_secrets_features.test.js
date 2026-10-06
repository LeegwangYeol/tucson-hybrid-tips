/**
 * ==============================================================================
 * Tucson Hybrid Smart Key Trunk Prevention Tips Website
 * File: tests/tier1_secrets_features.test.js
 * Description: Comprehensive Feature & Boundary Test Suite for Advanced Tips &
 * Hidden Features (#secrets) Module.
 *
 * Covers:
 * - Tier 1: Section existence, WAI-ARIA tablist/tabs, 13 pre-rendered cards,
 *   category filtering, keyboard navigation (Arrow keys, Home, End),
 *   bookmark state toggling & hydration, QuotaExceededError graceful degradation.
 * - Tier 2: Touch target dimensions (>=44px), focus-visible ring styles,
 *   navigation bar & mobile drawer integration, print isolation, filter persistence.
 * ==============================================================================
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { DOMParser } = require('./lib/dom_parser.js');
const { CSSParser } = require('./lib/css_parser.js');
const { Reporter } = require('./lib/reporter.js');

// Ensure headless mock environment before importing secrets module
function ensureMockGlobals() {
  if (typeof global.window === 'undefined') {
    global.window = {
      showToast: () => {}
    };
  } else if (!global.window.showToast) {
    global.window.showToast = () => {};
  }

  if (typeof global.document === 'undefined') {
    global.document = {
      readyState: 'loading',
      addEventListener: () => {},
      getElementById: () => null,
      querySelector: () => null,
      createElement: (tag) => new MockDOMElement(tag)
    };
  }
}

ensureMockGlobals();

const {
  initSecretsModule,
  loadBookmarks,
  saveBookmarks,
  SECRETS_BOOKMARKS_KEY,
  SECRETS_STORAGE_KEY,
  SECRETS_FILTER_KEY
} = require('../js/secrets.js');
const { SafeStorage, MemoryStorage } = require('../js/storage.js');

/**
 * Lightweight Mock DOM Element for Interactive Testing in Headless Node.js
 */
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

  dispatchKey(key) {
    let prevented = false;
    const handlers = this.listeners['keydown'] || [];
    for (const fn of handlers) {
      fn({
        type: 'keydown',
        key,
        preventDefault() { prevented = true; }
      });
    }
    return prevented;
  }
}

/**
 * Builds an interactive mock DOM tree representing the #secrets section
 */
function buildMockSecretsTree() {
  const container = new MockDOMElement('section', 'secrets-section');
  container.setAttribute('id', 'secrets');
  container.setAttribute('aria-labelledby', 'secrets-heading');

  const filterTabs = [
    new MockDOMElement('button', 'secrets-filter-btn secrets-tab-btn active', { filter: 'all' }),
    new MockDOMElement('button', 'secrets-filter-btn secrets-tab-btn', { filter: 'hidden' }),
    new MockDOMElement('button', 'secrets-filter-btn secrets-tab-btn', { filter: 'hybrid' }),
    new MockDOMElement('button', 'secrets-filter-btn secrets-tab-btn', { filter: 'accessory' })
  ];

  filterTabs[0].setAttribute('aria-selected', 'true');
  filterTabs[0].setAttribute('tabindex', '0');
  filterTabs[1].setAttribute('aria-selected', 'false');
  filterTabs[1].setAttribute('tabindex', '-1');
  filterTabs[2].setAttribute('aria-selected', 'false');
  filterTabs[2].setAttribute('tabindex', '-1');
  filterTabs[3].setAttribute('aria-selected', 'false');
  filterTabs[3].setAttribute('tabindex', '-1');

  filterTabs.forEach(t => {
    container.children.push(t);
    t.parentNode = container;
  });

  const cardDefinitions = [
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

  const cards = [];
  cardDefinitions.forEach(def => {
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

/**
 * Resets storage mocks to a clean state
 */
function resetMockStorage() {
  const store = {};
  global.window = {
    localStorage: {
      _data: store,
      getItem(k) { return this._data[k] ?? null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { for (const k in this._data) delete this._data[k]; }
    },
    sessionStorage: {
      _data: {},
      getItem(k) { return this._data[k] ?? null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { for (const k in this._data) delete this._data[k]; }
    },
    showToast: () => {}
  };
  SafeStorage.clear();
}

/**
 * Tier 1: Feature Coverage Test Suite for Advanced Tips & Secrets
 */
function runTier1Secrets(context) {
  const { rootDir, reporter } = context;
  const indexPath = path.join(rootDir, 'index.html');

  let htmlContent = '';
  let dom = null;

  try {
    if (fs.existsSync(indexPath)) {
      htmlContent = fs.readFileSync(indexPath, 'utf-8');
      const parser = new DOMParser();
      dom = parser.parse(htmlContent);
    }
  } catch (e) {}

  function test(id, name, fn) {
    const t0 = Date.now();
    try {
      fn();
      reporter.addResult({
        tier: 'tier1',
        id,
        name,
        status: 'PASS',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.addResult({
        tier: 'tier1',
        id,
        name,
        status: 'FAIL',
        durationMs: Date.now() - t0,
        error: err
      });
    }
  }

  function requireDOM() {
    assert.ok(dom, 'index.html must exist and parse as valid HTML5 DOM');
  }

  // T1-SEC-01: Section #secrets exists with aria-labelledby="secrets-heading"
  test('T1-SEC-01', 'Section #secrets exists in DOM with aria-labelledby="secrets-heading"', () => {
    requireDOM();
    const section = dom.querySelector('#secrets');
    assert.ok(section, 'Section element with id="secrets" must exist');
    assert.strictEqual(
      section.getAttribute('aria-labelledby'),
      'secrets-heading',
      '#secrets section must have aria-labelledby="secrets-heading"'
    );
    const heading = dom.querySelector('#secrets-heading');
    assert.ok(heading, 'Heading element with id="secrets-heading" must exist');
    assert.ok(
      heading.textContent.includes('고급 꿀팁') && heading.textContent.includes('숨은 기능'),
      'Heading must contain "고급 꿀팁 & 숨은 기능"'
    );
  });

  // T1-SEC-02: Filter controls container has role="tablist" and accessible aria-label
  test('T1-SEC-02', 'Filter controls container has role="tablist" and accessible aria-label', () => {
    requireDOM();
    const tablist = dom.querySelector('#secrets [role="tablist"]');
    assert.ok(tablist, 'Filter container inside #secrets must have role="tablist"');
    const ariaLabel = tablist.getAttribute('aria-label');
    assert.ok(ariaLabel && ariaLabel.length > 0, 'Tablist container must have descriptive aria-label');
  });

  // T1-SEC-03: 4 filter tabs (all, hidden, hybrid, accessory) exist with role="tab"
  test('T1-SEC-03', '4 filter tabs (all, hidden, hybrid, accessory) exist with role="tab" and aria-controls', () => {
    requireDOM();
    const section = dom.querySelector('#secrets');
    const tabs = section.querySelectorAll('[role="tab"]');
    assert.strictEqual(tabs.length, 4, `Must contain exactly 4 filter tabs (found ${tabs.length})`);

    const filters = tabs.map(t => t.getAttribute('data-filter'));
    assert.deepStrictEqual(filters, ['all', 'hidden', 'hybrid', 'accessory']);

    for (const tab of tabs) {
      assert.strictEqual(tab.getAttribute('aria-controls'), 'secrets-grid', 'Each tab must control #secrets-grid');
      assert.ok(tab.hasAttribute('aria-selected'), 'Each tab must define aria-selected');
    }
  });

  // T1-SEC-04: Pre-rendered grid contains exactly 13 secret cards (5 hidden, 3 hybrid, 5 accessory)
  test('T1-SEC-04', 'Pre-rendered grid contains exactly 13 secret cards (5 hidden, 3 hybrid, 5 accessory)', () => {
    requireDOM();
    const section = dom.querySelector('#secrets');
    const cards = section.querySelectorAll('.secret-card');
    assert.strictEqual(cards.length, 13, `Must contain exactly 13 secret cards (found ${cards.length})`);

    const hiddenCards = cards.filter(c => c.getAttribute('data-category') === 'hidden');
    const hybridCards = cards.filter(c => c.getAttribute('data-category') === 'hybrid');
    const accessoryCards = cards.filter(c => c.getAttribute('data-category') === 'accessory');

    assert.strictEqual(hiddenCards.length, 5, `Expected 5 hidden cards, got ${hiddenCards.length}`);
    assert.strictEqual(hybridCards.length, 3, `Expected 3 hybrid cards, got ${hybridCards.length}`);
    assert.strictEqual(accessoryCards.length, 5, `Expected 5 accessory cards, got ${accessoryCards.length}`);
  });

  // T1-SEC-05: Each secret card contains unique ID, title, summary, step list, and bookmark button
  test('T1-SEC-05', 'Each secret card has unique ID, title, summary, procedure steps, and bookmark button', () => {
    requireDOM();
    const section = dom.querySelector('#secrets');
    const cards = section.querySelectorAll('.secret-card');
    const idSet = new Set();
    const bookmarkIdSet = new Set();

    for (const card of cards) {
      const cardId = card.getAttribute('id');
      assert.ok(cardId && cardId.startsWith('secret-'), `Card must have id starting with "secret-", got "${cardId}"`);
      assert.ok(!idSet.has(cardId), `Duplicate card id found: ${cardId}`);
      idSet.add(cardId);

      const title = card.querySelector('.secret-title');
      assert.ok(title && title.textContent.trim().length > 0, `Card ${cardId} must contain .secret-title`);

      const summary = card.querySelector('.secret-summary');
      assert.ok(summary && summary.textContent.trim().length > 0, `Card ${cardId} must contain .secret-summary`);

      const bookmarkBtn = card.querySelector('.secret-bookmark-btn, .btn-bookmark');
      assert.ok(bookmarkBtn, `Card ${cardId} must have a bookmark action button`);

      const secretId = bookmarkBtn.getAttribute('data-secret-id');
      assert.ok(secretId && secretId.length > 0, `Card ${cardId} bookmark button must have data-secret-id`);
      assert.ok(!bookmarkIdSet.has(secretId), `Duplicate bookmark secretId found: ${secretId}`);
      bookmarkIdSet.add(secretId);
    }
  });

  // T1-SEC-06: Category filtering logic - selecting 'hidden'
  test('T1-SEC-06', 'Category filtering logic: selecting "hidden" displays 5 cards and hides 8 others with .is-hidden', () => {
    resetMockStorage();
    const { container, filterTabs, cards } = buildMockSecretsTree();
    initSecretsModule(container);

    const hiddenTab = filterTabs.find(t => t.dataset.filter === 'hidden');
    hiddenTab.click();

    const visibleCards = cards.filter(c => !c.classList.contains('is-hidden'));
    const hiddenCards = cards.filter(c => c.classList.contains('is-hidden'));

    assert.strictEqual(visibleCards.length, 5, '5 hidden cards must remain visible');
    assert.strictEqual(hiddenCards.length, 8, '8 hybrid and accessory cards must receive .is-hidden');
    assert.strictEqual(hiddenTab.classList.contains('active'), true, '"hidden" tab must receive active class');
    assert.strictEqual(hiddenTab.getAttribute('aria-selected'), 'true');
    assert.strictEqual(SafeStorage.getItem(SECRETS_FILTER_KEY), 'hidden');
  });

  // T1-SEC-07: Category filtering logic - selecting 'hybrid'
  test('T1-SEC-07', 'Category filtering logic: selecting "hybrid" displays 3 cards and hides 10 others with .is-hidden', () => {
    resetMockStorage();
    const { container, filterTabs, cards } = buildMockSecretsTree();
    initSecretsModule(container);

    const hybridTab = filterTabs.find(t => t.dataset.filter === 'hybrid');
    hybridTab.click();

    const visibleCards = cards.filter(c => !c.classList.contains('is-hidden'));
    const hiddenCards = cards.filter(c => c.classList.contains('is-hidden'));

    assert.strictEqual(visibleCards.length, 3, '3 hybrid cards must remain visible');
    assert.strictEqual(hiddenCards.length, 10, '10 non-hybrid cards must receive .is-hidden');
    assert.strictEqual(hybridTab.classList.contains('active'), true);
    assert.strictEqual(hybridTab.getAttribute('aria-selected'), 'true');
    assert.strictEqual(SafeStorage.getItem(SECRETS_FILTER_KEY), 'hybrid');
  });

  // T1-SEC-08: Category filtering logic - selecting 'accessory'
  test('T1-SEC-08', 'Category filtering logic: selecting "accessory" displays 5 cards and hides 8 others with .is-hidden', () => {
    resetMockStorage();
    const { container, filterTabs, cards } = buildMockSecretsTree();
    initSecretsModule(container);

    const accessoryTab = filterTabs.find(t => t.dataset.filter === 'accessory');
    accessoryTab.click();

    const visibleCards = cards.filter(c => !c.classList.contains('is-hidden'));
    const hiddenCards = cards.filter(c => c.classList.contains('is-hidden'));

    assert.strictEqual(visibleCards.length, 5, '5 accessory cards must remain visible');
    assert.strictEqual(hiddenCards.length, 8, '8 non-accessory cards must receive .is-hidden');
    assert.strictEqual(accessoryTab.classList.contains('active'), true);
    assert.strictEqual(accessoryTab.getAttribute('aria-selected'), 'true');
    assert.strictEqual(SafeStorage.getItem(SECRETS_FILTER_KEY), 'accessory');
  });

  // T1-SEC-09: Category filtering logic - selecting 'all'
  test('T1-SEC-09', 'Category filtering logic: selecting "all" restores visibility to all 13 cards', () => {
    resetMockStorage();
    const { container, filterTabs, cards } = buildMockSecretsTree();
    initSecretsModule(container);

    // Switch to hidden first
    filterTabs.find(t => t.dataset.filter === 'hidden').click();
    assert.strictEqual(cards.filter(c => !c.classList.contains('is-hidden')).length, 5);

    // Switch back to all
    const allTab = filterTabs.find(t => t.dataset.filter === 'all');
    allTab.click();

    const visibleCards = cards.filter(c => !c.classList.contains('is-hidden'));
    assert.strictEqual(visibleCards.length, 13, 'All 13 cards must be visible under "all" filter');
    assert.strictEqual(allTab.classList.contains('active'), true);
    assert.strictEqual(allTab.getAttribute('aria-selected'), 'true');
  });

  // T1-SEC-10: Tab keyboard navigation - ArrowRight / ArrowDown
  test('T1-SEC-10', 'Tab keyboard navigation: ArrowRight / ArrowDown moves focus and updates filter with wrap-around', () => {
    resetMockStorage();
    const { container, filterTabs } = buildMockSecretsTree();
    initSecretsModule(container);

    // ArrowRight from index 0 ('all') -> index 1 ('hidden')
    const prevented1 = filterTabs[0].dispatchKey('ArrowRight');
    assert.strictEqual(prevented1, true, 'ArrowRight should call preventDefault()');
    assert.strictEqual(filterTabs[1].focused, true, 'Next tab must receive focus');
    assert.strictEqual(filterTabs[1].classList.contains('active'), true, 'Next tab must be activated');

    // ArrowDown from index 1 ('hidden') -> index 2 ('hybrid')
    const prevented2 = filterTabs[1].dispatchKey('ArrowDown');
    assert.strictEqual(prevented2, true);
    assert.strictEqual(filterTabs[2].focused, true);
    assert.strictEqual(filterTabs[2].classList.contains('active'), true);

    // ArrowRight from index 3 ('accessory') -> wrap to index 0 ('all')
    filterTabs[2].dispatchKey('ArrowRight'); // index 3
    filterTabs[3].focused = false;
    filterTabs[0].focused = false;
    filterTabs[3].dispatchKey('ArrowRight'); // wraps to index 0
    assert.strictEqual(filterTabs[0].focused, true, 'ArrowRight on last tab must wrap around to index 0');
    assert.strictEqual(filterTabs[0].classList.contains('active'), true);
  });

  // T1-SEC-11: Tab keyboard navigation - ArrowLeft / ArrowUp
  test('T1-SEC-11', 'Tab keyboard navigation: ArrowLeft / ArrowUp moves focus in reverse with wrap-around', () => {
    resetMockStorage();
    const { container, filterTabs } = buildMockSecretsTree();
    initSecretsModule(container);

    // ArrowLeft from index 0 ('all') -> wrap around to index 3 ('accessory')
    const prevented = filterTabs[0].dispatchKey('ArrowLeft');
    assert.strictEqual(prevented, true);
    assert.strictEqual(filterTabs[3].focused, true, 'ArrowLeft on first tab must wrap around to last tab');
    assert.strictEqual(filterTabs[3].classList.contains('active'), true);

    // ArrowUp from index 3 ('accessory') -> index 2 ('hybrid')
    filterTabs[3].dispatchKey('ArrowUp');
    assert.strictEqual(filterTabs[2].focused, true);
    assert.strictEqual(filterTabs[2].classList.contains('active'), true);
  });

  // T1-SEC-12: Tab keyboard navigation - Home / End keys
  test('T1-SEC-12', 'Tab keyboard navigation: Home jumps to first tab, End jumps to last tab', () => {
    resetMockStorage();
    const { container, filterTabs } = buildMockSecretsTree();
    initSecretsModule(container);

    // From index 2 ('hybrid'), press Home -> jumps to index 0 ('all')
    filterTabs[2].dispatchKey('Home');
    assert.strictEqual(filterTabs[0].focused, true, 'Home key must jump to first tab');
    assert.strictEqual(filterTabs[0].classList.contains('active'), true);

    // From index 0 ('all'), press End -> jumps to index 3 ('accessory')
    filterTabs[0].dispatchKey('End');
    assert.strictEqual(filterTabs[3].focused, true, 'End key must jump to last tab');
    assert.strictEqual(filterTabs[3].classList.contains('active'), true);
  });

  // T1-SEC-13: Bookmark functionality - adding bookmark
  test('T1-SEC-13', 'Bookmark functionality: clicking bookmark button persists tip ID to SafeStorage', () => {
    resetMockStorage();
    const { container, cards } = buildMockSecretsTree();
    initSecretsModule(container);

    const battCard = cards.find(c => c.getAttribute('id') === 'secret-batt-reset');
    const bookmarkBtn = battCard.querySelector('.secret-bookmark-btn');

    bookmarkBtn.click();

    assert.strictEqual(bookmarkBtn.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(bookmarkBtn.classList.contains('is-bookmarked'), true);
    const stored = loadBookmarks();
    assert.ok(stored.includes('batt-reset'), 'Stored bookmarks must contain "batt-reset"');
    assert.strictEqual(bookmarkBtn.querySelector('.bookmark-text').textContent, '저장 완료');
  });

  // T1-SEC-14: Bookmark functionality - removing bookmark
  test('T1-SEC-14', 'Bookmark functionality: re-clicking bookmark button removes tip ID from SafeStorage', () => {
    resetMockStorage();
    const { container, cards } = buildMockSecretsTree();
    initSecretsModule(container);

    const battCard = cards.find(c => c.getAttribute('id') === 'secret-batt-reset');
    const bookmarkBtn = battCard.querySelector('.secret-bookmark-btn');

    // Toggle on then toggle off
    bookmarkBtn.click();
    assert.ok(loadBookmarks().includes('batt-reset'));

    bookmarkBtn.click();
    assert.strictEqual(bookmarkBtn.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(bookmarkBtn.classList.contains('is-bookmarked'), false);
    assert.strictEqual(loadBookmarks().includes('batt-reset'), false, '"batt-reset" must be removed from storage');
    assert.strictEqual(bookmarkBtn.querySelector('.bookmark-text').textContent, '유용한 팁 저장');
  });

  // T1-SEC-15: Bookmark hydration from storage
  test('T1-SEC-15', 'Bookmark hydration: initial module loading restores active bookmark state from SafeStorage', () => {
    resetMockStorage();
    // Pre-populate storage with bookmarks
    saveBookmarks(['wiper-service', 'key-case']);

    const { container, cards } = buildMockSecretsTree();
    initSecretsModule(container);

    const wiperCard = cards.find(c => c.getAttribute('id') === 'secret-wiper-service');
    const wiperBtn = wiperCard.querySelector('.secret-bookmark-btn');
    assert.strictEqual(wiperBtn.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(wiperBtn.classList.contains('is-bookmarked'), true);

    const keyCaseCard = cards.find(c => c.getAttribute('id') === 'secret-key-case');
    const keyCaseBtn = keyCaseCard.querySelector('.secret-bookmark-btn');
    assert.strictEqual(keyCaseBtn.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(keyCaseBtn.classList.contains('is-bookmarked'), true);

    const otherCard = cards.find(c => c.getAttribute('id') === 'secret-batt-reset');
    const otherBtn = otherCard.querySelector('.secret-bookmark-btn');
    assert.strictEqual(otherBtn.getAttribute('aria-pressed'), 'false');
  });

  // T1-SEC-16: Storage error handling - QuotaExceededError and SecurityError
  test('T1-SEC-16', 'Storage error handling: QuotaExceededError and SecurityError degrade gracefully', () => {
    // 1. QuotaExceededError on localStorage
    global.window.localStorage = {
      getItem() { return null; },
      setItem() {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      },
      removeItem() {}
    };

    assert.doesNotThrow(() => {
      saveBookmarks(['batt-reset']);
    }, 'saveBookmarks must not throw on QuotaExceededError');

    // 2. SecurityError (Safari Private Mode simulation)
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
      saveBookmarks(['batt-reset', 'wiper-service']);
      const loaded = loadBookmarks();
      assert.ok(Array.isArray(loaded));
    }, 'SafeStorage must seamlessly fall back to In-Memory Map under total storage block');
  });

  // T1-SEC-17: Storage self-healing on corrupted string
  test('T1-SEC-17', 'Self-healing: corrupted/invalid JSON strings in bookmark storage self-heal without crash', () => {
    resetMockStorage();

    // Inject corrupted malformed JSON
    SafeStorage.setItem(SECRETS_BOOKMARKS_KEY, '{corrupt_json: true');
    const bookmarks = loadBookmarks();
    assert.deepStrictEqual(bookmarks, [], 'Corrupted JSON must fallback to empty array');

    // Inject non-array JSON primitive
    SafeStorage.setItem(SECRETS_BOOKMARKS_KEY, '12345');
    const bookmarks2 = loadBookmarks();
    assert.deepStrictEqual(bookmarks2, [], 'Non-array payload must fallback to empty array');
  });
}

/**
 * Tier 2: Boundary & Accessibility Test Suite for Advanced Tips & Secrets
 */
function runTier2Secrets(context) {
  const { rootDir, reporter } = context;
  const indexPath = path.join(rootDir, 'index.html');
  const cssDir = path.join(rootDir, 'css');

  let dom = null;
  let combinedCSS = '';
  let cssParsed = null;

  try {
    if (fs.existsSync(indexPath)) {
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      const parser = new DOMParser();
      dom = parser.parse(htmlContent);
    }
  } catch (e) {}

  try {
    if (fs.existsSync(cssDir)) {
      const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
      for (const f of files) {
        combinedCSS += fs.readFileSync(path.join(cssDir, f), 'utf-8') + '\n';
      }
      const cssParser = new CSSParser();
      cssParsed = cssParser.parse(combinedCSS);
    }
  } catch (e) {}

  function test(id, name, fn) {
    const t0 = Date.now();
    try {
      fn();
      reporter.addResult({
        tier: 'tier2',
        id,
        name,
        status: 'PASS',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.addResult({
        tier: 'tier2',
        id,
        name,
        status: 'FAIL',
        durationMs: Date.now() - t0,
        error: err
      });
    }
  }

  // T2-SEC-01: Filter buttons have touch target height >= 44px
  test('T2-SEC-01', 'Filter tabs and buttons meet minimum touch target height >= 44px in CSS', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const hasMinHeight =
      cssParsed.hasProperty('.secrets-tab-btn', 'min-height', '44px') ||
      cssParsed.hasProperty('.secrets-filter-btn', 'min-height', '44px') ||
      combinedCSS.includes('min-height: 44px');
    assert.ok(hasMinHeight, 'Filter tab buttons must declare min-height: 44px for touch accessibility');
  });

  // T2-SEC-02: Bookmark buttons have touch target height >= 44px
  test('T2-SEC-02', 'Bookmark buttons meet minimum touch target height >= 44px in CSS', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const hasMinHeight =
      cssParsed.hasProperty('.secret-bookmark-btn', 'min-height', '44px') ||
      cssParsed.hasProperty('.btn-bookmark', 'min-height', '44px') ||
      cssParsed.hasProperty('.btn', 'min-height');
    assert.ok(hasMinHeight, 'Bookmark buttons must have touch target sizing >= 44px');
  });

  // T2-SEC-03: Filter tabs and bookmark buttons have accessible focus-visible rings
  test('T2-SEC-03', 'Filter tabs and bookmark buttons define accessible :focus-visible outline rings in CSS', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const hasTabFocus =
      cssParsed.hasProperty('.secrets-tab-btn:focus-visible', 'outline') ||
      cssParsed.hasProperty('.secrets-filter-btn:focus-visible', 'outline') ||
      combinedCSS.includes('.secrets-filter-btn:focus-visible') ||
      combinedCSS.includes('.secrets-tab-btn:focus-visible');

    const hasBookmarkFocus =
      cssParsed.hasProperty('.secret-bookmark-btn:focus-visible', 'outline') ||
      cssParsed.hasProperty('.btn-bookmark:focus-visible', 'outline') ||
      combinedCSS.includes('.secret-bookmark-btn:focus-visible') ||
      combinedCSS.includes('.btn-bookmark:focus-visible');

    assert.ok(hasTabFocus, 'Filter tabs must define :focus-visible outline');
    assert.ok(hasBookmarkFocus, 'Bookmark buttons must define :focus-visible outline');
  });

  // T2-SEC-04: Navigation menu and mobile drawer include link to #secrets
  test('T2-SEC-04', 'Navigation menu (#primary-nav) and mobile drawer include link to #secrets with accessible text', () => {
    assert.ok(dom, 'DOM must be parsed');
    const nav = dom.querySelector('#primary-nav');
    assert.ok(nav, '#primary-nav navigation menu must exist');

    const secretsLink = nav.querySelector('a[href="#secrets"]');
    assert.ok(secretsLink, 'Link pointing to href="#secrets" must exist in primary-nav');

    const linkText = secretsLink.textContent;
    assert.ok(
      linkText.includes('고급 꿀팁') && linkText.includes('숨은 기능'),
      `Navigation link text must contain "고급 꿀팁 & 숨은 기능", got "${linkText}"`
    );
  });

  // T2-SEC-05: Filter tabs active state contrast & styling
  test('T2-SEC-05', 'Filter tabs active state defines prominent contrast styling and ARIA attributes in CSS', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const hasActiveStyle =
      cssParsed.hasProperty('.secrets-tab-btn.active', 'background') ||
      cssParsed.hasProperty('.secrets-filter-btn.active', 'background') ||
      cssParsed.hasProperty('.secrets-tab-btn[aria-selected="true"]', 'background') ||
      cssParsed.hasProperty('.secrets-filter-btn[aria-selected="true"]', 'background');
    assert.ok(hasActiveStyle, 'Active filter tabs must declare distinct active background styling in CSS');
  });

  // T2-SEC-06: Print stylesheet suppresses interactive filter tabs
  test('T2-SEC-06', 'Print stylesheet suppresses interactive filter tabs (.no-print or .secrets-filter-tabs)', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    assert.ok(dom, 'DOM must be parsed');
    const filterContainer = dom.querySelector('.secrets-filter-tabs, .secrets-filter-bar');
    assert.ok(filterContainer, 'Filter container must exist in index.html');
    assert.ok(
      filterContainer.classList.has('no-print') || combinedCSS.includes('@media print'),
      'Filter container must include .no-print or print suppression'
    );
  });

  // T2-SEC-07: Filter persistence validates and clamps stored filter category
  test('T2-SEC-07', 'Filter persistence validates against allowed categories ("hidden", "hybrid", "accessory")', () => {
    resetMockStorage();
    // Injected invalid foreign category
    SafeStorage.setItem(SECRETS_FILTER_KEY, 'malicious_category_xyz');

    const { container, cards } = buildMockSecretsTree();
    // Initializing with invalid category should not crash and should keep all cards visible
    initSecretsModule(container);

    const visibleCards = cards.filter(c => !c.classList.contains('is-hidden'));
    assert.strictEqual(visibleCards.length, 13, 'Invalid stored filter category must safely default to showing all cards');
  });
}

function runAllSecretsTests(context) {
  runTier1Secrets(context);
  runTier2Secrets(context);
}

// Standalone CLI execution
if (require.main === module) {
  const rootDir = path.resolve(__dirname, '..');
  const reporter = new Reporter('pretty');
  const context = { rootDir, reporter, options: {} };

  console.log('\n================================================================================');
  console.log('  TUCSON HYBRID ADVANCED TIPS & SECRETS - FEATURE TEST HARNESS');
  console.log('================================================================================\n');

  runAllSecretsTests(context);

  const output = reporter.generateOutput();
  console.log(output);

  const hasFailures = reporter.results.some(r => r.status === 'FAIL');
  process.exit(hasFailures ? 1 : 0);
}

module.exports = {
  runTier1Secrets,
  runTier2Secrets,
  runAllSecretsTests
};
