/**
 * ==============================================================================
 * Tucson Hybrid Simplified Owner's Manual ("눈높이 차량 설명서")
 * File: tests/remediated_concepts_search.test.mjs
 * Description: Empirical Search Filtering Test for Remediated Concepts
 *
 * Concepts under test:
 * 1. "크리핑" (Zero-RPM creeping roll-away hazard precaution)
 * 2. "역점프" (Prohibition on external jump starting other vehicles)
 * 3. "스패너" (Official HEV cluster warning light yellow wrench/spanner icon)
 * 4. "5,000km" (Engine oil replacement interval for severe operating conditions)
 * 5. "가혹 조건" (Severe driving condition specification for short trips/congestion)
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
// 1. DOM Mock Engine
// ============================================================================

class MockClassList {
  constructor(initial = '') {
    this._classes = new Set(initial.split(/\s+/).filter(Boolean));
  }
  add(cls) { if (cls) this._classes.add(cls); }
  remove(cls) { if (cls) this._classes.delete(cls); }
  contains(cls) { return this._classes.has(cls); }
  toggle(cls, force) {
    if (force === undefined) {
      if (this._classes.has(cls)) { this._classes.delete(cls); return false; }
      this._classes.add(cls); return true;
    }
    if (force) { this._classes.add(cls); return true; }
    this._classes.delete(cls); return false;
  }
  toString() { return Array.from(this._classes).join(' '); }
  get value() { return this.toString(); }
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

    for (const [k, v] of Object.entries(attributes)) {
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        this.dataset[camel] = String(v);
      }
    }
  }

  getAttribute(name) { return this.attributes[name] !== undefined ? this.attributes[name] : null; }
  setAttribute(name, val) {
    const sVal = String(val);
    this.attributes[name] = sVal;
    if (name === 'id') this.id = sVal;
    if (name === 'class') {
      this.className = sVal;
      this.classList = new MockClassList(sVal);
    }
    if (name === 'value') this.value = sVal;
    if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
      this.dataset[camel] = sVal;
    }
  }
  hasAttribute(name) { return this.attributes[name] !== undefined; }
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
    if (this.childNodes.length === 0 && this.children.length === 0) return this._textContent;
    let text = '';
    for (const node of this.childNodes) {
      if (typeof node === 'string') text += node;
      else if (node instanceof MockElement) text += node.textContent;
    }
    return text || this._textContent;
  }
  set textContent(txt) {
    this._textContent = String(txt);
    this.childNodes = [this._textContent];
    this.children = [];
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
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
    throw new Error('NotFoundError');
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
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  focus() { this.focused = true; }
  blur() { this.focused = false; }

  dispatchInput(value) {
    this.value = value;
    const handlers = this.listeners.get('input') || [];
    for (const handler of handlers) {
      handler.call(this, { type: 'input', target: this, currentTarget: this });
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

  click() {
    const handlers = this.listeners.get('click') || [];
    for (const handler of handlers) {
      handler.call(this, { type: 'click', target: this, currentTarget: this });
    }
  }
}

class MockDocument {
  constructor() {
    this.body = new MockElement('BODY');
    this.readyState = 'complete';
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
    if (sel === 'body') return this.body;
    if (sel.startsWith('#') && !sel.includes(' ') && !sel.includes(',')) {
      return this.getElementById(sel.slice(1));
    }
    return this.body.querySelector(sel);
  }
  querySelectorAll(sel) { return this.body.querySelectorAll(sel); }
}

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
      if (current) current.childNodes.push(textContent);
      continue;
    }
    if (isClosing) {
      const closing = tagName.toUpperCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === closing) { stack.splice(i); break; }
      }
      continue;
    }
    const upperTag = tagName.toUpperCase();
    const attrs = parseAttributes(rawAttrs || '');
    const parent = stack[stack.length - 1];
    const newNode = new MockElement(upperTag, attrs);
    if (parent) parent.appendChild(newNode);
    const isVoid = isSelfCloseSlash === '/' || selfClosing.has(upperTag);
    if (!isVoid) stack.push(newNode);
  }
  return root.children.length === 1 ? root.children[0] : root;
}

// 2. Load index.html and extract #manual
const indexHtmlPath = path.join(rootDir, 'index.html');
const fullHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const manualSectionStart = fullHtml.indexOf('<section id="manual"');
const manualSectionEnd = fullHtml.indexOf('</section>', manualSectionStart) + '</section>'.length;
const manualSnippet = fullHtml.substring(manualSectionStart, manualSectionEnd);

const mockDoc = new MockDocument();
let announcedMessages = [];
global.document = mockDoc;
global.window = {
  document: mockDoc,
  announceToScreenReader: (msg) => { announcedMessages.push(msg); }
};

const { initManual } = await import('../js/manual.js');

function createFreshDOM() {
  const el = parseHtmlSnippetToMockElement(manualSnippet);
  mockDoc.body = new MockElement('BODY');
  mockDoc.body.appendChild(el);
  initManual(el);
  return el;
}

// ============================================================================
// 3. Execution of Empirical Search Filtering Tests
// ============================================================================

console.log('================================================================');
console.log('EMPIRICAL CHALLENGER: REMEDIATED CONCEPTS SEARCH FILTERING SUITE');
console.log('================================================================');

const testScenarios = [
  {
    name: 'TC-SRCH-01: Concept "크리핑" (Zero-RPM Creeping Roll-Away Hazard)',
    query: '크리핑',
    expectedPrimaryCard: 'manual-card-driving-1',
    expectedCategory: 'driving',
    expectedSnippet: '무음 크리핑 추돌 위험'
  },
  {
    name: 'TC-SRCH-02: Concept "역점프" (Prohibition on Jump-Starting Other Cars)',
    query: '역점프',
    expectedPrimaryCard: 'manual-card-driving-4',
    expectedCategory: 'driving',
    expectedSnippet: '역점프 시 상대 차 시동 모터의 과전류로 투싼의 LDC 전장 회로가 파손됩니다'
  },
  {
    name: 'TC-SRCH-03: Concept "스패너" (Official HEV Warning Cluster Symbol)',
    query: '스패너',
    expectedPrimaryCard: 'manual-card-warnings-1',
    expectedCategory: 'warnings',
    expectedSnippet: '노란색 스패너(🔧)'
  },
  {
    name: 'TC-SRCH-04: Concept "5,000km" (Severe Engine Oil Replacement Interval)',
    query: '5,000km',
    expectedPrimaryCard: 'manual-card-maint-1',
    expectedCategory: 'maintenance',
    expectedSnippet: '5,000km/6개월'
  },
  {
    name: 'TC-SRCH-05: Concept "가혹 조건" (Severe Operating Condition Specification)',
    query: '가혹 조건',
    expectedPrimaryCard: 'manual-card-maint-1',
    expectedCategory: 'maintenance',
    expectedSnippet: '시내 단거리·정체 가혹 조건'
  }
];

let passCount = 0;
let failCount = 0;

for (const tc of testScenarios) {
  try {
    const manualEl = createFreshDOM();
    const searchInput = manualEl.querySelector('#manual-search-input');
    const searchCount = manualEl.querySelector('#manual-search-count');
    const emptyState = manualEl.querySelector('#manual-empty-state');
    const clearBtn = manualEl.querySelector('#manual-search-clear');
    const allCards = manualEl.querySelectorAll('.manual-card');
    assert.strictEqual(allCards.length, 15, 'Total 15 cards must be present initially');

    // 1. Dispatch input with 150ms delay for 100ms debounce
    searchInput.dispatchInput(tc.query);
    await new Promise(r => setTimeout(r, 150));

    // 2. Identify visible and hidden cards
    const visibleCards = allCards.filter(c => !c.hasAttribute('hidden'));
    const hiddenCards = allCards.filter(c => c.hasAttribute('hidden'));

    // Check match count
    assert.ok(visibleCards.length >= 1, `Query "${tc.query}" must yield at least 1 match`);
    const targetCard = visibleCards.find(c => c.id === tc.expectedPrimaryCard);
    assert.ok(targetCard, `Query "${tc.query}" must match card ${tc.expectedPrimaryCard}`);

    // Check snippet existence
    assert.ok(
      targetCard.textContent.includes(tc.expectedSnippet),
      `Card ${tc.expectedPrimaryCard} must contain snippet "${tc.expectedSnippet}"`
    );

    // Check display styling
    for (const c of visibleCards) {
      assert.strictEqual(c.style.display, '', `Visible card ${c.id} style.display must be empty`);
      assert.strictEqual(c.hasAttribute('hidden'), false, `Visible card ${c.id} must not have hidden attr`);
    }
    for (const c of hiddenCards) {
      assert.strictEqual(c.style.display, 'none', `Hidden card ${c.id} style.display must be none`);
      assert.strictEqual(c.hasAttribute('hidden'), true, `Hidden card ${c.id} must have hidden attr`);
    }

    // Check search count and controls
    assert.ok(!clearBtn.hasAttribute('hidden'), 'Clear button must be visible');
    assert.ok(emptyState.hasAttribute('hidden'), 'Empty state must be hidden');
    assert.ok(
      searchCount.textContent.includes(`총 ${visibleCards.length}건`),
      `Search count "${searchCount.textContent}" must mention total matches (${visibleCards.length})`
    );

    // 3. Test active panel calculation across tab switching
    const tabBtns = manualEl.querySelectorAll('.manual-tab-btn');
    const targetTabBtn = tabBtns.find(b => b.getAttribute('data-category') === tc.expectedCategory);
    assert.ok(targetTabBtn, `Target category tab "${tc.expectedCategory}" must exist`);

    // Click target tab
    targetTabBtn.click();
    assert.strictEqual(targetTabBtn.getAttribute('aria-selected'), 'true');
    // Active panel match count should match visible cards in target panel
    const targetPanel = manualEl.querySelector(`#manual-panel-${tc.expectedCategory}`);
    const visibleInTargetPanel = visibleCards.filter(c => targetPanel.contains(c)).length;
    assert.ok(
      searchCount.textContent.includes(`현재 탭: ${visibleInTargetPanel}건`),
      `Search count should report active tab matches: ${visibleInTargetPanel}건`
    );

    // 4. Test Clear functionality
    clearBtn.click();
    assert.strictEqual(searchInput.value, '', 'Input should be cleared');
    const restoredCards = allCards.filter(c => !c.hasAttribute('hidden'));
    assert.strictEqual(restoredCards.length, 15, 'All 15 cards restored');
    assert.ok(clearBtn.hasAttribute('hidden'), 'Clear button hidden after reset');
    assert.strictEqual(searchCount.textContent, '', 'Search count cleared');

    console.log(`[PASS] ${tc.name}`);
    console.log(`       Query: "${tc.query}" -> Matched: ${visibleCards.length} card(s) (including ${tc.expectedPrimaryCard})`);
    console.log(`       Verified text snippet, CSS display, ARIA hidden, tab switching, and clean reset.`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${tc.name}`);
    console.error(`       Error: ${err.message}`);
    failCount++;
  }
}

// ============================================================================
// 4. Case-Insensitivity & Whitespace Edge Cases for Remediated Terms
// ============================================================================

try {
  const manualEl = createFreshDOM();
  const searchInput = manualEl.querySelector('#manual-search-input');
  const allCards = manualEl.querySelectorAll('.manual-card');

  // Test with leading/trailing whitespace: "  크리핑  "
  searchInput.dispatchInput('  크리핑  ');
  await new Promise(r => setTimeout(r, 150));
  let visibleCards = allCards.filter(c => !c.hasAttribute('hidden'));
  assert.ok(visibleCards.some(c => c.id === 'manual-card-driving-1'), 'Whitespace-padded "  크리핑  " matches');

  // Test case insensitivity for "5,000KM" (uppercase KM)
  searchInput.dispatchInput('5,000KM');
  await new Promise(r => setTimeout(r, 150));
  visibleCards = allCards.filter(c => !c.hasAttribute('hidden'));
  assert.ok(visibleCards.some(c => c.id === 'manual-card-maint-1'), 'Uppercase "5,000KM" matches');

  // Test partial query "역점"
  searchInput.dispatchInput('역점');
  await new Promise(r => setTimeout(r, 150));
  visibleCards = allCards.filter(c => !c.hasAttribute('hidden'));
  assert.ok(visibleCards.some(c => c.id === 'manual-card-driving-4'), 'Substring "역점" matches');

  console.log('[PASS] TC-SRCH-06: Case-insensitivity, whitespace padding, and substring edge cases verified.');
  passCount++;
} catch (err) {
  console.error('[FAIL] TC-SRCH-06: Edge cases failed');
  console.error(err.message);
  failCount++;
}

console.log('================================================================');
console.log(`SUMMARY: Total Tests: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL REMEDIATED SEARCH CONCEPTS PASS EMPIRICAL VERIFICATION (100% SUCCESS)');
}
