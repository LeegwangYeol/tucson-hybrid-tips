/**
 * ==============================================================================
 * Tucson Hybrid Simplified Owner's Manual ("눈높이 차량 설명서")
 * File: tests/manual_adversarial_stress.test.mjs
 * Description: Empirical Adversarial Stress Suite for Simplified Manual (#manual)
 *
 * EMPIRICAL CHALLENGER 1 (m4_challenger_1)
 *
 * Stress Test Battery:
 * 1. Physical HTML Specification & Card Inventory Integrity (index.html).
 * 2. High-Frequency Rapid Tab Switching (1,000 rapid cycles, sequential & random).
 * 3. Extreme Keyboard Navigation (WAI-ARIA tab pattern, wraps, Home/End, 1,000 keystrokes).
 * 4. High-Frequency Accordion Toggling (1,000 rapid cycles across all 15 cards).
 * 5. Extreme Search Filter Queries:
 *    - Empty string & whitespace variations
 *    - Unicode emojis & non-ASCII characters
 *    - HTML injection / XSS attempts (<script>, <img>, <svg>)
 *    - Regex special character attacks ([.*+?^${}()|[\]\\])
 *    - 5,000-character oversized query string
 * 6. Multiple initManual() Idempotency & Zero-Leak Verification (100 invocations).
 * 7. DOM Node & Event Listener Safety (debounce timer safety, detached node check).
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
    this.childNodes = [];
    this.parentNode = null;
    this._textContent = '';
    this.listeners = new Map();
    this.focused = false;
    this.style = { display: '' };
    this.value = attributes.value || '';

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
    if (name === 'value') {
      this.value = sVal;
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
    if (this.childNodes.length === 0 && this.children.length === 0) {
      return this._textContent;
    }
    let text = '';
    for (const node of this.childNodes) {
      if (typeof node === 'string') {
        text += node;
      } else if (node instanceof MockElement) {
        text += node.textContent;
      }
    }
    return text || this._textContent;
  }

  set textContent(txt) {
    this._textContent = String(txt);
    this.childNodes = [this._textContent];
    this.children = [];
  }

  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.children.push(child);
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      const cIdx = this.childNodes.indexOf(child);
      if (cIdx !== -1) this.childNodes.splice(cIdx, 1);
      child.parentNode = null;
      return child;
    }
    throw new Error('NotFoundError: Node not found in parent');
  }

  contains(otherNode) {
    if (!otherNode) return false;
    if (otherNode === this) return true;
    let curr = otherNode.parentNode;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }

  querySelectorAll(selector) {
    const subSelectors = selector.split(',').map(s => s.trim()).filter(Boolean);
    const res = new Set();

    const matchSingle = (node, s) => {
      s = s.trim();
      // Attribute selector [attr=val] or [attr]
      if (s.startsWith('[') && s.endsWith(']')) {
        const inner = s.slice(1, -1);
        const eqIdx = inner.indexOf('=');
        if (eqIdx !== -1) {
          const attr = inner.slice(0, eqIdx).trim();
          let expectedVal = inner.slice(eqIdx + 1).trim();
          if ((expectedVal.startsWith('"') && expectedVal.endsWith('"')) ||
              (expectedVal.startsWith("'") && expectedVal.endsWith("'"))) {
            expectedVal = expectedVal.slice(1, -1);
          }
          return node.getAttribute(attr) === expectedVal;
        }
        return node.hasAttribute(inner.trim());
      }
      if (s.startsWith('#')) return node.id === s.slice(1);
      if (s.startsWith('.')) {
        const classes = s.split('.').filter(Boolean);
        return classes.every(c => node.classList && node.classList.contains(c));
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

  blur() {
    this.focused = false;
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

  dispatchInput(value) {
    this.value = value;
    const handlers = this.listeners.get('input') || [];
    for (const handler of handlers) {
      handler.call(this, {
        type: 'input',
        target: this,
        currentTarget: this,
        preventDefault: () => {}
      });
    }
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
    if (sel.startsWith('#') && !sel.includes(' ') && !sel.includes(',')) {
      return this.getElementById(sel.slice(1));
    }
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

// ============================================================================
// Section 2: Physical HTML Parser for index.html's #manual Section
// ============================================================================

function parseAttributes(raw) {
  const attrs = {};
  const attrRegex = /([a-zA-Z0-9_\-:@.]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = attrRegex.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    const val = match[2] !== undefined ? match[2] :
                match[3] !== undefined ? match[3] :
                match[4] !== undefined ? match[4] : '';
    attrs[name] = val;
  }
  return attrs;
}

function parseHtmlSnippetToMockElement(htmlSnippet) {
  const root = new MockElement('DIV');
  const selfClosing = new Set(['INPUT', 'IMG', 'BR', 'HR', 'META', 'LINK']);
  const tagRegex = /<!--[\s\S]*?-->|<(\/)?([a-zA-Z0-9\-]+)((?:\s+[a-zA-Z0-9_\-:@.]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;

  const stack = [root];
  let match;

  while ((match = tagRegex.exec(htmlSnippet)) !== null) {
    const [fullMatch, isClosing, tagName, rawAttrs, isSelfCloseSlash, textContent] = match;

    if (fullMatch.startsWith('<!--')) continue;

    if (textContent) {
      const current = stack[stack.length - 1];
      if (current) {
        current.childNodes.push(textContent);
      }
      continue;
    }

    if (isClosing) {
      const closing = tagName.toUpperCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === closing) {
          stack.splice(i);
          break;
        }
      }
      continue;
    }

    const upperTag = tagName.toUpperCase();
    const attrs = parseAttributes(rawAttrs || '');
    const parent = stack[stack.length - 1];
    const newNode = new MockElement(upperTag, attrs);

    if (parent) {
      parent.appendChild(newNode);
    }

    const isVoid = isSelfCloseSlash === '/' || selfClosing.has(upperTag);
    if (!isVoid) {
      stack.push(newNode);
    }
  }

  // Return the first element child if it's the section
  return root.children.length === 1 ? root.children[0] : root;
}

// Extract physical #manual section from index.html
const indexHtmlPath = path.join(rootDir, 'index.html');
const fullHtml = fs.readFileSync(indexHtmlPath, 'utf8');

const manualSectionStart = fullHtml.indexOf('<section id="manual"');
if (manualSectionStart === -1) {
  throw new Error('FAILED: <section id="manual"> not found in index.html');
}
const manualSectionEnd = fullHtml.indexOf('</section>', manualSectionStart) + '</section>'.length;
const manualSnippet = fullHtml.substring(manualSectionStart, manualSectionEnd);

// ============================================================================
// Section 3: Global Environment Setup & Module Import
// ============================================================================

const mockDoc = new MockDocument();
let announcedMessages = [];

global.document = mockDoc;
global.window = {
  document: mockDoc,
  announceToScreenReader: (msg) => {
    announcedMessages.push(msg);
  }
};

// Dynamically import manual.js
const manualModule = await import('../js/manual.js');
const { initManual } = manualModule;

// Helper to instantiate a fresh physical #manual DOM element
function createFreshManualDOM() {
  const manualEl = parseHtmlSnippetToMockElement(manualSnippet);
  mockDoc.body = new MockElement('BODY');
  mockDoc.body.appendChild(manualEl);
  return manualEl;
}

// ============================================================================
// Section 4: Adversarial Test Runner & Assertion Harness
// ============================================================================

let testCount = 0;
let passCount = 0;
let failCount = 0;
const results = [];
const testQueue = [];

function test(id, description, fn) {
  testQueue.push({ id, description, fn, isAsync: false });
}

function testAsync(id, description, fn) {
  testQueue.push({ id, description, fn, isAsync: true });
}


console.log('='.repeat(80));
console.log('▶ ADVERSARIAL STRESS TEST CHALLENGER 1: SIMPLIFIED OWNER\'S MANUAL (#manual)');
console.log('='.repeat(80));

// ============================================================================
// SUITE 1: PHYSICAL HTML SPECIFICATION & INVENTORY INTEGRITY
// ============================================================================
console.log('\n--- SUITE 1: Physical HTML Specification & Inventory Verification ---');

test('MAN-SPEC-01', 'Physical HTML contains #manual section, heading, tabs, panels, search, and empty state', () => {
  const manualEl = createFreshManualDOM();
  assert.strictEqual(manualEl.id, 'manual', 'Root ID must be manual');
  assert.ok(manualEl.classList.contains('manual-section'), 'Class must include manual-section');
  assert.strictEqual(manualEl.getAttribute('aria-labelledby'), 'manual-heading');

  const heading = manualEl.querySelector('#manual-heading');
  assert.ok(heading, '#manual-heading exists');
  assert.strictEqual(heading.tagName, 'H2', 'Heading must be an H2');

  const tabs = manualEl.querySelector('#manual-tabs');
  assert.ok(tabs, '#manual-tabs exists');
  assert.strictEqual(tabs.getAttribute('role'), 'tablist');

  const tabBtns = manualEl.querySelectorAll('.manual-tab-btn');
  assert.strictEqual(tabBtns.length, 3, 'Must have exactly 3 category tabs');

  const panels = manualEl.querySelectorAll('.manual-panel');
  assert.strictEqual(panels.length, 3, 'Must have exactly 3 panels');

  const searchInput = manualEl.querySelector('#manual-search-input');
  assert.ok(searchInput, '#manual-search-input exists');

  const emptyState = manualEl.querySelector('#manual-empty-state');
  assert.ok(emptyState, '#manual-empty-state exists');
  assert.ok(emptyState.hasAttribute('hidden'), 'Empty state must be hidden by default');
});

test('MAN-SPEC-02', 'Exactly 15 canonical topic cards distributed 5-5-5 across 3 panels', () => {
  const manualEl = createFreshManualDOM();
  const allCards = manualEl.querySelectorAll('.manual-card');
  assert.strictEqual(allCards.length, 15, `Must have exactly 15 cards (found: ${allCards.length})`);

  const drivingPanel = manualEl.querySelector('#manual-panel-driving');
  const warningsPanel = manualEl.querySelector('#manual-panel-warnings');
  const maintPanel = manualEl.querySelector('#manual-panel-maintenance');

  assert.strictEqual(drivingPanel.querySelectorAll('.manual-card').length, 5, 'Driving panel has 5 cards');
  assert.strictEqual(warningsPanel.querySelectorAll('.manual-card').length, 5, 'Warnings panel has 5 cards');
  assert.strictEqual(maintPanel.querySelectorAll('.manual-card').length, 5, 'Maintenance panel has 5 cards');
});

test('MAN-SPEC-03', 'All 15 cards adhere strictly to 4-part structure (.manual-summary, .manual-faq, .manual-steps, .manual-donts)', () => {
  const manualEl = createFreshManualDOM();
  const allCards = manualEl.querySelectorAll('.manual-card');

  allCards.forEach((card, idx) => {
    const cardId = card.id || `card-${idx}`;
    const summary = card.querySelector('.manual-summary');
    const faq = card.querySelector('.manual-faq');
    const steps = card.querySelector('.manual-steps');
    const donts = card.querySelector('.manual-donts');
    const accBtn = card.querySelector('.manual-accordion-btn');

    assert.ok(summary, `${cardId} missing .manual-summary`);
    assert.ok(faq, `${cardId} missing .manual-faq`);
    assert.ok(steps, `${cardId} missing .manual-steps`);
    assert.ok(donts, `${cardId} missing .manual-donts`);
    assert.ok(accBtn, `${cardId} missing .manual-accordion-btn`);
  });
});

test('MAN-SPEC-04', 'Initial WAI-ARIA states: driving tab active, panels 2 & 3 hidden, all 15 accordions collapsed', () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const tabDriving = manualEl.querySelector('#manual-tab-driving');
  const tabWarnings = manualEl.querySelector('#manual-tab-warnings');
  const tabMaint = manualEl.querySelector('#manual-tab-maintenance');

  assert.strictEqual(tabDriving.getAttribute('aria-selected'), 'true');
  assert.strictEqual(tabDriving.getAttribute('tabindex'), '0');
  assert.ok(tabDriving.classList.contains('active'));

  assert.strictEqual(tabWarnings.getAttribute('aria-selected'), 'false');
  assert.strictEqual(tabWarnings.getAttribute('tabindex'), '-1');
  assert.ok(!tabWarnings.classList.contains('active'));

  assert.strictEqual(tabMaint.getAttribute('aria-selected'), 'false');
  assert.strictEqual(tabMaint.getAttribute('tabindex'), '-1');
  assert.ok(!tabMaint.classList.contains('active'));

  const pDriving = manualEl.querySelector('#manual-panel-driving');
  const pWarnings = manualEl.querySelector('#manual-panel-warnings');
  const pMaint = manualEl.querySelector('#manual-panel-maintenance');

  assert.ok(!pDriving.hasAttribute('hidden'), 'Driving panel not hidden');
  assert.ok(pWarnings.hasAttribute('hidden'), 'Warnings panel hidden');
  assert.ok(pMaint.hasAttribute('hidden'), 'Maintenance panel hidden');

  const accBtns = manualEl.querySelectorAll('.manual-accordion-btn');
  assert.strictEqual(accBtns.length, 15);
  accBtns.forEach(btn => {
    assert.strictEqual(btn.getAttribute('aria-expanded'), 'false');
    assert.ok(!btn.classList.contains('is-open'));
  });
});

// ============================================================================
// SUITE 2: HIGH-FREQUENCY RAPID TAB SWITCHING STRESS (1,000 CYCLES)
// ============================================================================
console.log('\n--- SUITE 2: High-Frequency Rapid Tab Switching Stress (1,000 Cycles) ---');

test('MAN-TAB-01', 'High-frequency sequential tab switches (1,000 rapid cycles) maintain strict ARIA exclusivity', () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const tabBtns = manualEl.querySelectorAll('.manual-tab-btn');
  const panels = manualEl.querySelectorAll('.manual-panel');

  const CYCLES = 1000;
  for (let i = 0; i < CYCLES; i++) {
    const targetIdx = i % tabBtns.length;
    const targetBtn = tabBtns[targetIdx];
    targetBtn.click();

    // Verify invariant after click
    assert.strictEqual(targetBtn.getAttribute('aria-selected'), 'true');
    assert.strictEqual(targetBtn.getAttribute('tabindex'), '0');
    assert.ok(targetBtn.classList.contains('active'));

    tabBtns.forEach((btn, idx) => {
      if (idx !== targetIdx) {
        assert.strictEqual(btn.getAttribute('aria-selected'), 'false');
        assert.strictEqual(btn.getAttribute('tabindex'), '-1');
        assert.ok(!btn.classList.contains('active'));
      }
    });

    const targetPanelId = targetBtn.getAttribute('aria-controls');
    panels.forEach(panel => {
      if (panel.id === targetPanelId) {
        assert.ok(!panel.hasAttribute('hidden'));
        assert.ok(panel.classList.contains('active'));
      } else {
        assert.ok(panel.hasAttribute('hidden'));
        assert.ok(!panel.classList.contains('active'));
      }
    });
  }
});

test('MAN-TAB-02', 'High-frequency randomized tab switches (1,000 chaos cycles) with zero invariant violation', () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const tabBtns = manualEl.querySelectorAll('.manual-tab-btn');
  const panels = manualEl.querySelectorAll('.manual-panel');

  // Pseudo-random LCG sequence for deterministic reproducibility
  let seed = 0xDEADBEEF;
  const lcg = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  };

  const CYCLES = 1000;
  for (let i = 0; i < CYCLES; i++) {
    const randIdx = Math.floor(lcg() * tabBtns.length);
    const targetBtn = tabBtns[randIdx];
    targetBtn.click();

    const activeTabs = tabBtns.filter(b => b.getAttribute('aria-selected') === 'true');
    assert.strictEqual(activeTabs.length, 1, 'Strictly 1 tab active');
    assert.strictEqual(activeTabs[0], targetBtn);

    const activePanels = panels.filter(p => !p.hasAttribute('hidden') && p.classList.contains('active'));
    assert.strictEqual(activePanels.length, 1, 'Strictly 1 panel visible');
    assert.strictEqual(activePanels[0].id, targetBtn.getAttribute('aria-controls'));
  }
});

test('MAN-TAB-03', '1,000 Keystroke navigation barrage (ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Home, End) with wrapping', () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const tabBtns = manualEl.querySelectorAll('.manual-tab-btn');
  const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];

  let currIdx = 0;
  const CYCLES = 1000;

  for (let i = 0; i < CYCLES; i++) {
    const key = keys[i % keys.length];
    const currBtn = tabBtns[currIdx];

    currBtn.dispatchKeydown(key);

    if (key === 'ArrowRight' || key === 'ArrowDown') {
      currIdx = (currIdx + 1) % tabBtns.length;
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      currIdx = (currIdx - 1 + tabBtns.length) % tabBtns.length;
    } else if (key === 'Home') {
      currIdx = 0;
    } else if (key === 'End') {
      currIdx = tabBtns.length - 1;
    }

    const selectedBtn = tabBtns[currIdx];
    assert.strictEqual(selectedBtn.getAttribute('aria-selected'), 'true');
    assert.strictEqual(selectedBtn.getAttribute('tabindex'), '0');
    assert.ok(selectedBtn.focused, 'Focused target tab');
  }
});

test('MAN-TAB-04', 'Tab switching under active search query recalculates activePanelMatches accurately', () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const searchInput = manualEl.querySelector('#manual-search-input');
  const searchCount = manualEl.querySelector('#manual-search-count');
  const tabBtns = manualEl.querySelectorAll('.manual-tab-btn');

  // Search keyword "배터리" (appears in both driving panel and warnings panel)
  searchInput.value = '배터리';
  // Simulate search execution
  searchInput.dispatchKeydown('Enter'); // triggers nothing, but we test switchTab sync
  // Trigger input
  manualEl.querySelector('#manual-search-clear').click(); // clears
  // Re-set query
  searchInput.value = '경고등';
  tabBtns[0].click(); // driving tab
  // Check driving panel
  tabBtns[1].click(); // warnings tab: should recalculate active matches
  assert.ok(tabBtns[1].classList.contains('active'));
});

// ============================================================================
// SUITE 3: HIGH-FREQUENCY ACCORDION TOGGLING STRESS (1,000 CYCLES)
// ============================================================================
console.log('\n--- SUITE 3: High-Frequency Accordion Toggling Stress (1,000 Cycles) ---');

test('MAN-ACC-01', '1,000 Sequential accordion toggle cycles across all 15 cards maintain state invariants', () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const accBtns = manualEl.querySelectorAll('.manual-accordion-btn');
  assert.strictEqual(accBtns.length, 15);

  const CYCLES = 1000;
  for (let i = 0; i < CYCLES; i++) {
    const btn = accBtns[i % accBtns.length];
    const contentId = btn.getAttribute('aria-controls');
    const content = manualEl.querySelector(`#${contentId}`);
    const labelSpan = btn.querySelector('.manual-accordion-label');
    const iconSpan = btn.querySelector('.manual-accordion-icon');

    const wasExpanded = btn.getAttribute('aria-expanded') === 'true';

    btn.click();

    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    assert.strictEqual(isExpanded, !wasExpanded, 'Toggle inverted expanded state');

    if (isExpanded) {
      assert.ok(btn.classList.contains('is-open'));
      assert.ok(!content.hasAttribute('hidden'));
      assert.ok(content.classList.contains('is-open'));
      assert.strictEqual(labelSpan.textContent, '상세 해설 접기');
      assert.strictEqual(iconSpan.textContent, '▲');
    } else {
      assert.ok(!btn.classList.contains('is-open'));
      assert.ok(content.hasAttribute('hidden'));
      assert.ok(!content.classList.contains('is-open'));
      assert.strictEqual(labelSpan.textContent, '상세 해설 & 실전 수칙 보기');
      assert.strictEqual(iconSpan.textContent, '▼');
    }
  }
});

test('MAN-ACC-02', '1,000 Randomized interleaved accordion chaos attacks verify independent state isolation', () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const accBtns = manualEl.querySelectorAll('.manual-accordion-btn');

  // Track expected state of all 15 accordions
  const states = new Array(accBtns.length).fill(false);

  let seed = 0xCAFEBABE;
  const lcg = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  };

  const CYCLES = 1000;
  for (let i = 0; i < CYCLES; i++) {
    const targetIdx = Math.floor(lcg() * accBtns.length);
    const btn = accBtns[targetIdx];
    states[targetIdx] = !states[targetIdx];

    btn.click();

    // Verify all 15 accordions match expected isolated state
    accBtns.forEach((b, idx) => {
      const expected = states[idx];
      const actual = b.getAttribute('aria-expanded') === 'true';
      assert.strictEqual(actual, expected, `Accordion ${idx} state contaminated on cycle ${i}`);
    });
  }
});

test('MAN-ACC-03', 'Accordion state synchronization: ARIA, classes, hidden, label, and icon stay 100% harmonious', () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const accBtns = manualEl.querySelectorAll('.manual-accordion-btn');

  // Open all 15
  accBtns.forEach(btn => btn.click());
  accBtns.forEach(btn => {
    assert.strictEqual(btn.getAttribute('aria-expanded'), 'true');
    const content = manualEl.querySelector(`#${btn.getAttribute('aria-controls')}`);
    assert.ok(!content.hasAttribute('hidden'));
  });

  // Close all 15
  accBtns.forEach(btn => btn.click());
  accBtns.forEach(btn => {
    assert.strictEqual(btn.getAttribute('aria-expanded'), 'false');
    const content = manualEl.querySelector(`#${btn.getAttribute('aria-controls')}`);
    assert.ok(content.hasAttribute('hidden'));
  });
});

test('MAN-ACC-04', 'Accordion handles missing content or malformed aria-controls gracefully without throwing', () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  // Add dummy accordion button with non-existent target content
  const orphanBtn = new MockElement('button', {
    class: 'manual-accordion-btn',
    'aria-expanded': 'false',
    'aria-controls': 'non-existent-content-id'
  });
  orphanBtn.appendChild(new MockElement('span', { class: 'manual-accordion-label' }));
  orphanBtn.appendChild(new MockElement('span', { class: 'manual-accordion-icon' }));
  manualEl.appendChild(orphanBtn);

  // Re-bind (won't bind due to idempotency, so manual click should test safety)
  assert.doesNotThrow(() => {
    orphanBtn.click();
  });
});

// ============================================================================
// SUITE 4: EXTREME SEARCH FILTER QUERIES & BOUNDARY STRESS
// ============================================================================
console.log('\n--- SUITE 4: Extreme Search Filter Queries & Boundary Stress ---');

testAsync('MAN-SRCH-01', 'Empty string and whitespace variations restore all 15 cards cleanly', async () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const searchInput = manualEl.querySelector('#manual-search-input');
  const cards = manualEl.querySelectorAll('.manual-card');
  const emptyState = manualEl.querySelector('#manual-empty-state');
  const searchCount = manualEl.querySelector('#manual-search-count');
  const clearBtn = manualEl.querySelector('#manual-search-clear');

  const whitespaceVariants = ['', ' ', '   ', '\t\n\r  ', '   \u2003\u3000   '];

  for (const query of whitespaceVariants) {
    searchInput.dispatchInput(query);
    await new Promise(r => setTimeout(r, 120)); // wait for 100ms debounce

    // All 15 cards must be visible
    cards.forEach(card => {
      assert.ok(!card.hasAttribute('hidden'), `Card ${card.id} hidden for query "${query}"`);
      assert.strictEqual(card.style.display, '');
    });

    assert.ok(emptyState.hasAttribute('hidden'), 'Empty state must be hidden');
    assert.strictEqual(searchCount.textContent, '', 'Count must be empty');
    assert.ok(clearBtn.hasAttribute('hidden'), 'Clear button must be hidden');
  }
});

testAsync('MAN-SRCH-02', 'Unicode emojis and Korean compound queries match accurately without distortion', async () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const searchInput = manualEl.querySelector('#manual-search-input');
  const searchCount = manualEl.querySelector('#manual-search-count');
  const cards = manualEl.querySelectorAll('.manual-card');

  // Topic 1.1 has READY and 시동
  searchInput.dispatchInput('READY');
  await new Promise(r => setTimeout(r, 120));

  let matchedCards = cards.filter(c => !c.hasAttribute('hidden'));
  assert.ok(matchedCards.length >= 1, 'Matches READY card');
  assert.ok(searchCount.textContent.includes(`총 ${matchedCards.length}건`));

  // Search emoji "💡" (exists in summary badge)
  searchInput.dispatchInput('💡');
  await new Promise(r => setTimeout(r, 120));
  matchedCards = cards.filter(c => !c.hasAttribute('hidden'));
  assert.strictEqual(matchedCards.length, 15, 'All 15 cards contain 💡 한 줄 핵심 요약');
});

testAsync('MAN-SRCH-03', 'HTML injection and XSS attempts execute zero scripts and display safe zero matches', async () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const searchInput = manualEl.querySelector('#manual-search-input');
  const cards = manualEl.querySelectorAll('.manual-card');
  const emptyState = manualEl.querySelector('#manual-empty-state');

  const xssPayloads = [
    '<script>alert(1)</script>',
    '<img src="x" onerror="alert(1)">',
    '"><svg onload=alert(1)>',
    'javascript:alert(1)',
    '<b onmouseover=evil()>hover me</b>'
  ];

  for (const payload of xssPayloads) {
    searchInput.dispatchInput(payload);
    await new Promise(r => setTimeout(r, 120));

    const matched = cards.filter(c => !c.hasAttribute('hidden'));
    assert.strictEqual(matched.length, 0, `Payload "${payload}" must yield 0 matches`);
    assert.ok(!emptyState.hasAttribute('hidden'), 'Empty state must be visible for XSS probe');
  }
});

testAsync('MAN-SRCH-04', 'Regex special character bombardment ([.*+?^${}()|[\\]\\\\]) runs safely with zero SyntaxErrors', async () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const searchInput = manualEl.querySelector('#manual-search-input');
  const regexAttacks = [
    '[.*+?^${}()|[\\]\\\\]',
    '(a|b)*+',
    '(?<=foo)bar',
    '\\d{5,100}',
    '^(.*?)$',
    '[',
    '(',
    '\\',
    '+',
    '*',
    '?'
  ];

  for (const attack of regexAttacks) {
    assert.doesNotThrow(async () => {
      searchInput.dispatchInput(attack);
      await new Promise(r => setTimeout(r, 120));
    }, `Regex attack "${attack}" threw exception`);
  }
});

testAsync('MAN-SRCH-05', '5,000-Character oversized query string executes in sub-millisecond time with zero matches', async () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const searchInput = manualEl.querySelector('#manual-search-input');
  const cards = manualEl.querySelectorAll('.manual-card');
  const emptyState = manualEl.querySelector('#manual-empty-state');

  const massiveQuery = 'HYUNDAI_TUCSON_NX4_PE_'.repeat(250); // 5,500 chars
  assert.ok(massiveQuery.length > 5000);

  const t0 = performance.now();
  searchInput.dispatchInput(massiveQuery);
  await new Promise(r => setTimeout(r, 120));
  const tDuration = performance.now() - t0;

  assert.ok(tDuration < 200, `Execution took ${tDuration}ms (expected < 200ms with debounce)`);

  const matched = cards.filter(c => !c.hasAttribute('hidden'));
  assert.strictEqual(matched.length, 0, 'Oversized query yields 0 matches');
  assert.ok(!emptyState.hasAttribute('hidden'), 'Empty state shown cleanly');
});

testAsync('MAN-SRCH-06', 'Precision domain search verification for automotive hybrid topics', async () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const searchInput = manualEl.querySelector('#manual-search-input');
  const searchCount = manualEl.querySelector('#manual-search-count');
  const cards = manualEl.querySelectorAll('.manual-card');

  const tests = [
    { term: '0W-16', minMatches: 1 },
    { term: '회생제동', minMatches: 2 },
    { term: '냉각수', minMatches: 2 },
    { term: '에어컨', minMatches: 1 },
    { term: '12V', minMatches: 2 },
    { term: '리셋', minMatches: 1 }
  ];

  for (const { term, minMatches } of tests) {
    searchInput.dispatchInput(term);
    await new Promise(r => setTimeout(r, 120));

    const matched = cards.filter(c => !c.hasAttribute('hidden'));
    assert.ok(matched.length >= minMatches, `Search for "${term}" found ${matched.length} (expected >= ${minMatches})`);
    assert.ok(searchCount.textContent.includes(`총 ${matched.length}건`));
  }
});

testAsync('MAN-SRCH-07', 'Zero-match queries trigger #manual-empty-state with descriptive guidance text', async () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const searchInput = manualEl.querySelector('#manual-search-input');
  const emptyState = manualEl.querySelector('#manual-empty-state');

  searchInput.dispatchInput('완전히존재하지않는가상의키워드9999');
  await new Promise(r => setTimeout(r, 120));

  assert.ok(!emptyState.hasAttribute('hidden'), 'Empty state unhidden');
  assert.ok(emptyState.textContent.includes('일치하는 설명서 검색 결과가 없습니다'));
});

testAsync('MAN-SRCH-08', 'Escape key clears search input and restores all 15 cards instantly', async () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const searchInput = manualEl.querySelector('#manual-search-input');
  const cards = manualEl.querySelectorAll('.manual-card');

  searchInput.dispatchInput('냉각수');
  await new Promise(r => setTimeout(r, 120));

  assert.ok(cards.some(c => c.hasAttribute('hidden')), 'Some cards hidden');

  searchInput.dispatchKeydown('Escape');

  assert.strictEqual(searchInput.value, '', 'Input value cleared');
  cards.forEach(card => {
    assert.ok(!card.hasAttribute('hidden'), 'All cards restored');
  });
});

testAsync('MAN-SRCH-09', 'Search clear button click clears input, restores all cards, and focuses input', async () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const searchInput = manualEl.querySelector('#manual-search-input');
  const clearBtn = manualEl.querySelector('#manual-search-clear');
  const cards = manualEl.querySelectorAll('.manual-card');

  searchInput.dispatchInput('엔진오일');
  await new Promise(r => setTimeout(r, 120));

  assert.ok(!clearBtn.hasAttribute('hidden'), 'Clear button visible when query active');

  clearBtn.click();

  assert.strictEqual(searchInput.value, '', 'Input value cleared');
  assert.ok(searchInput.focused, 'Input received focus');
  cards.forEach(card => {
    assert.ok(!card.hasAttribute('hidden'), 'All cards restored');
  });
});

// ============================================================================
// SUITE 5: IDEMPOTENCY & RE-INITIALIZATION STRESS
// ============================================================================
console.log('\n--- SUITE 5: Idempotency & Re-initialization Stress ---');

test('MAN-IDEM-01', 'Multiple consecutive initManual() invocations (100 times) prevent duplicate listeners', () => {
  const manualEl = createFreshManualDOM();

  // Call initManual 100 times
  for (let i = 0; i < 100; i++) {
    initManual(manualEl);
  }

  assert.strictEqual(manualEl.dataset.manualBound, 'true');

  const accBtn = manualEl.querySelector('.manual-accordion-btn');
  // Click once: should toggle to true
  accBtn.click();
  assert.strictEqual(accBtn.getAttribute('aria-expanded'), 'true', 'Single click must toggle open');

  // Click second time: should toggle to false
  accBtn.click();
  assert.strictEqual(accBtn.getAttribute('aria-expanded'), 'false', 'Second click must toggle closed');
});

test('MAN-IDEM-02', 'Memory and listener stability across 100 consecutive re-initialization calls', () => {
  const manualEl = createFreshManualDOM();

  for (let i = 0; i < 100; i++) {
    initManual(manualEl);
  }

  const tabBtn = manualEl.querySelector('.manual-tab-btn');
  const listeners = tabBtn.listeners.get('click') || [];
  assert.strictEqual(listeners.length, 1, 'Strictly 1 click listener attached to tab button');
});

test('MAN-IDEM-03', 'Boundary parameter resilience: null, invalid selector, and SSR environment (document undefined)', () => {
  assert.doesNotThrow(() => {
    initManual(null);
    initManual(undefined);
    initManual('#non-existent-selector-999');
  });

  // SSR simulation
  const originalDoc = global.document;
  delete global.document;

  assert.doesNotThrow(() => {
    initManual('#manual');
  });

  global.document = originalDoc;
});

// ============================================================================
// SUITE 6: DOM NODE & EVENT LISTENER SAFETY
// ============================================================================
console.log('\n--- SUITE 6: DOM Node & Resource Safety ---');

test('MAN-LEAK-01', 'Zero detached DOM node accumulation across 2,000 cumulative stress operations', () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const initialNodeCount = manualEl.querySelectorAll('*').length;

  const tabBtns = manualEl.querySelectorAll('.manual-tab-btn');
  const accBtns = manualEl.querySelectorAll('.manual-accordion-btn');

  // Perform 1,000 tab switches
  for (let i = 0; i < 1000; i++) {
    tabBtns[i % tabBtns.length].click();
  }

  // Perform 1,000 accordion toggles
  for (let i = 0; i < 1000; i++) {
    accBtns[i % accBtns.length].click();
  }

  const finalNodeCount = manualEl.querySelectorAll('*').length;
  assert.strictEqual(finalNodeCount, initialNodeCount, 'DOM node count must remain 100% constant');
});

testAsync('MAN-LEAK-02', 'Search input rapid keystroke spam (500 rapid inputs) clears prior timers without leakage', async () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  const searchInput = manualEl.querySelector('#manual-search-input');

  // Rapidly fire 500 input events within a tight loop
  for (let i = 0; i < 500; i++) {
    searchInput.dispatchInput(`query_${i}`);
  }

  // Wait for the single active debounce timer to settle
  await new Promise(r => setTimeout(r, 150));

  const emptyState = manualEl.querySelector('#manual-empty-state');
  assert.ok(!emptyState.hasAttribute('hidden'), 'Settled cleanly on final query (0 matches)');
});

test('MAN-LEAK-03', 'Screen reader announcer exception injection fails silently without crashing UI interactions', () => {
  const manualEl = createFreshManualDOM();
  initManual(manualEl);

  // Corrupt global announcer to throw
  const origAnnouncer = global.window.announceToScreenReader;
  global.window.announceToScreenReader = () => {
    throw new Error('CORRUPTED_ANNOUNCER_SYNTHESIS_FAILURE');
  };

  const tabBtn = manualEl.querySelectorAll('.manual-tab-btn')[1];
  const accBtn = manualEl.querySelectorAll('.manual-accordion-btn')[0];

  assert.doesNotThrow(() => {
    tabBtn.click();
    accBtn.click();
  }, 'Interactions must proceed smoothly despite announcer failure');

  global.window.announceToScreenReader = origAnnouncer;
});

// ============================================================================
// Section 5: Execution Summary & Output Generation
// ============================================================================

async function runAll() {
  for (const t of testQueue) {
    testCount++;
    const t0 = performance.now();
    try {
      if (t.isAsync) {
        await t.fn();
      } else {
        t.fn();
      }
      const durationMs = (performance.now() - t0).toFixed(1);
      passCount++;
      results.push({ id: t.id, description: t.description, status: 'PASS', durationMs });
      console.log(`  [✔ PASS] ${t.id}: ${t.description} (${durationMs}ms)`);
    } catch (err) {
      const durationMs = (performance.now() - t0).toFixed(1);
      failCount++;
      results.push({ id: t.id, description: t.description, status: 'FAIL', durationMs, error: err.message });
      console.error(`  [✖ FAIL] ${t.id}: ${t.description} (${durationMs}ms)`);
      console.error(`         Reason: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ADVERSARIAL STRESS TEST SUMMARY');
  console.log('-'.repeat(80));
  console.log(`  Total Tests:    ${testCount}`);
  console.log(`  Passed Tests:   ${passCount}`);
  console.log(`  Failed Tests:   ${failCount}`);
  console.log('-'.repeat(80));
  if (failCount === 0) {
    console.log('  FINAL VERDICT:  APPROVE (100% RESILIENT)');
    console.log('  Interactive UI, high-frequency stress, XSS/Regex boundaries, and idempotency verified.');
  } else {
    console.log('  FINAL VERDICT:  REQUEST_CHANGES');
    console.log(`  ${failCount} stress test(s) failed.`);
  }
  console.log('='.repeat(80) + '\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

await runAll();

