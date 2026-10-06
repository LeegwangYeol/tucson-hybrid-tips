/**
 * ==============================================================================
 * Tucson Hybrid Smart Key Trunk Prevention Tips Website
 * Adversarial Stress & Leak Challenge Suite (Empirical Challenger 1)
 * 
 * Verifies:
 * 1. Rapid Toast Triggers: 100 calls, zombie timers, clobbering, DOM node counts.
 * 2. Clipboard Exception Stress: execCommand exception cleanup, zero detached textareas.
 * 3. Event Listener Idempotency: Multiple initializations, mobile drawer lockout check.
 * 4. Slider Scrub Stress: High-frequency input throttled via RAF without unhandled errors.
 * 5. Fuzz Input Stress: calculateClearance with extreme edge cases and 10,000 fuzz cycles.
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
// Lightweight DOM & Environment Simulation Harness
// ============================================================================

class MockClassList {
  constructor(initial = '') {
    this._classes = new Set(initial.split(/\s+/).filter(Boolean));
  }
  add(cls) { this._classes.add(cls); }
  remove(cls) { this._classes.delete(cls); }
  contains(cls) { return this._classes.has(cls); }
  toggle(cls) {
    if (this._classes.has(cls)) {
      this._classes.delete(cls);
      return false;
    }
    this._classes.add(cls);
    return true;
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
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this._textContent = '';
    this.value = attributes.value !== undefined ? attributes.value : '';
    this.listeners = new Map();
    this.offsetParent = {}; // Simulate visible element

    // Parse data- attributes into dataset
    for (const [k, v] of Object.entries(attributes)) {
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        this.dataset[camel] = v;
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

  contains(child) {
    if (child === this) return true;
    for (const c of this.children) {
      if (c.contains(child)) return true;
    }
    return false;
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

  dispatchEvent(event) {
    event.target = this;
    event.currentTarget = this;
    const list = this.listeners.get(event.type) || [];
    for (const handler of list) {
      handler.call(this, event);
    }
    return !event.defaultPrevented;
  }

  select() {
    this._selected = true;
  }

  focus() {
    this._focused = true;
  }

  getElementById(id) {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.getElementById(id);
      if (found) return found;
    }
    return null;
  }

  getElementsByTagName(tag) {
    const res = [];
    const t = tag.toUpperCase();
    for (const child of this.children) {
      if (t === '*' || child.tagName === t) res.push(child);
      res.push(...child.getElementsByTagName(tag));
    }
    return res;
  }

  querySelectorAll(sel) {
    const res = new Set();
    const subSelectors = sel.split(',').map(s => s.trim()).filter(Boolean);

    const matchSingle = (node, s) => {
      s = s.trim();
      if (!s) return false;
      if (s.startsWith('#')) return node.id === s.slice(1);
      if (s.startsWith('.')) return node.classList.contains(s.slice(1));
      if (s.includes('.')) {
        const parts = s.split('.');
        const tag = parts[0].toUpperCase();
        const cls = parts.slice(1);
        if (tag && node.tagName !== tag) return false;
        return cls.every(c => node.classList.contains(c));
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

  querySelector(sel) {
    const list = this.querySelectorAll(sel);
    return list.length > 0 ? list[0] : null;
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
    return this.body.getElementById(id);
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

  removeEventListener(type, handler) {
    if (!this.listeners.has(type)) return;
    const list = this.listeners.get(type);
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  dispatchEvent(event) {
    event.target = this;
    event.currentTarget = this;
    const list = this.listeners.get(event.type) || [];
    for (const handler of list) {
      handler.call(this, event);
    }
  }

  execCommand(cmd) {
    return true;
  }
}

class MockStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.has(String(k)) ? this.store.get(String(k)) : null; }
  setItem(k, v) { this.store.set(String(k), String(v)); }
  removeItem(k) { this.store.delete(String(k)); }
  clear() { this.store.clear(); }
  get length() { return this.store.size; }
}

// Timer Tracker for Zombie Timer Detection
class TimerTracker {
  constructor() {
    this.timers = new Map();
    this.nextId = 1;
    this.totalScheduled = 0;
    this.totalCancelled = 0;
  }

  setTimeout(cb, ms = 0) {
    const id = this.nextId++;
    this.totalScheduled++;
    const entry = { id, cb, ms, scheduledAt: Date.now(), active: true };
    this.timers.set(id, entry);
    return id;
  }

  clearTimeout(id) {
    if (id && this.timers.has(id)) {
      const entry = this.timers.get(id);
      if (entry.active) {
        entry.active = false;
        this.totalCancelled++;
      }
      this.timers.delete(id);
    }
  }

  getActiveCount() {
    return Array.from(this.timers.values()).filter(t => t.active).length;
  }

  getActiveTimers() {
    return Array.from(this.timers.values()).filter(t => t.active);
  }

  runTimer(id) {
    if (this.timers.has(id)) {
      const entry = this.timers.get(id);
      this.timers.delete(id);
      entry.active = false;
      entry.cb();
    }
  }

  runAll() {
    const entries = Array.from(this.timers.values());
    this.timers.clear();
    for (const entry of entries) {
      entry.active = false;
      entry.cb();
    }
  }

  clear() {
    this.timers.clear();
    this.totalScheduled = 0;
    this.totalCancelled = 0;
  }
}

// RAF Tracker for Animation Frame Throttling
class RAFTracker {
  constructor() {
    this.callbacks = new Map();
    this.nextId = 1;
    this.totalScheduled = 0;
    this.totalCancelled = 0;
  }

  requestAnimationFrame(cb) {
    const id = this.nextId++;
    this.totalScheduled++;
    this.callbacks.set(id, cb);
    return id;
  }

  cancelAnimationFrame(id) {
    if (id && this.callbacks.has(id)) {
      this.totalCancelled++;
      this.callbacks.delete(id);
    }
  }

  getPendingCount() {
    return this.callbacks.size;
  }

  flushOne() {
    if (this.callbacks.size === 0) return 0;
    const [id, cb] = this.callbacks.entries().next().value;
    this.callbacks.delete(id);
    cb(Date.now());
    return 1;
  }

  flushAll() {
    const entries = Array.from(this.callbacks.entries());
    this.callbacks.clear();
    for (const [id, cb] of entries) {
      cb(Date.now());
    }
    return entries.length;
  }

  clear() {
    this.callbacks.clear();
    this.totalScheduled = 0;
    this.totalCancelled = 0;
  }
}

// Global test execution environment setup
const mockDoc = new MockDocument();
const timerTracker = new TimerTracker();
const rafTracker = new RAFTracker();
const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

global.document = mockDoc;
global.window = {
  document: mockDoc,
  localStorage: mockLocalStorage,
  sessionStorage: mockSessionStorage,
  setTimeout: (cb, ms) => timerTracker.setTimeout(cb, ms),
  clearTimeout: (id) => timerTracker.clearTimeout(id),
  requestAnimationFrame: (cb) => rafTracker.requestAnimationFrame(cb),
  cancelAnimationFrame: (id) => rafTracker.cancelAnimationFrame(id),
  print: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  addEventListener: (t, fn) => mockDoc.addEventListener(t, fn),
  dispatchEvent: (e) => mockDoc.dispatchEvent(e),
  location: { href: 'https://tucson-hybrid-tips.vercel.app' }
};
global.setTimeout = (cb, ms) => timerTracker.setTimeout(cb, ms);
global.clearTimeout = (id) => timerTracker.clearTimeout(id);
global.requestAnimationFrame = (cb) => rafTracker.requestAnimationFrame(cb);
global.cancelAnimationFrame = (id) => rafTracker.cancelAnimationFrame(id);

// Import application modules under test
const appModule = await import('../js/app.js');
const simulatorModule = await import('../js/simulator.js');
const checklistModule = await import('../js/checklist.js');
const storageModule = await import('../js/storage.js');

const { showToast, announceToScreenReader, initMobileNavigation, initPrintTrigger, initApp } = appModule;
const { calculateClearance, initTailgateSimulator, saveSimulatorState, loadSimulatorState, TAILGATE_PRESETS } = simulatorModule;
const { calculateChecklistScore, initChecklist, saveChecklistState, loadChecklistState } = checklistModule;
const { SafeStorage } = storageModule;

// Test Runner Results Collector
const suiteResults = [];

function runTest(id, name, testFn) {
  const start = Date.now();
  try {
    testFn();
    suiteResults.push({ id, name, status: 'PASS', duration: Date.now() - start });
    console.log(`  [✔ PASS] ${id}: ${name} (${Date.now() - start}ms)`);
  } catch (err) {
    suiteResults.push({ id, name, status: 'FAIL', duration: Date.now() - start, error: err });
    console.error(`  [✖ FAIL] ${id}: ${name} (${Date.now() - start}ms)`);
    console.error(`          ${err.stack || err.message}`);
  }
}

async function runAsyncTest(id, name, testFn) {
  const start = Date.now();
  try {
    await testFn();
    suiteResults.push({ id, name, status: 'PASS', duration: Date.now() - start });
    console.log(`  [✔ PASS] ${id}: ${name} (${Date.now() - start}ms)`);
  } catch (err) {
    suiteResults.push({ id, name, status: 'FAIL', duration: Date.now() - start, error: err });
    console.error(`  [✖ FAIL] ${id}: ${name} (${Date.now() - start}ms)`);
    console.error(`          ${err.stack || err.message}`);
  }
}

console.log('\n================================================================================');
console.log('▶ ADVERSARIAL STRESS TEST CHALLENGE 1 (EMPIRICAL VERIFICATION)');
console.log('================================================================================\n');

// ============================================================================
// SUITE 1: Multi-Click & Rapid Toast Trigger Stress
// ============================================================================
console.log('--- SUITE 1: Multi-Click & Rapid Toast Trigger Stress ---');

runTest('ADV-TOAST-01', 'Rapid 100 consecutive showToast() invocations: single DOM node, zero zombie timers', () => {
  // Reset DOM and Timers
  mockDoc.body.children = [];
  timerTracker.clear();

  // Add global announcer to DOM
  const announcer = mockDoc.createElement('div');
  announcer.id = 'global-announcer';
  mockDoc.body.appendChild(announcer);

  // Rapidly call showToast 100 times in succession
  const callCount = 100;
  for (let i = 0; i < callCount; i++) {
    showToast(`Rapid message alert #${i}`, 3000);
  }

  // 1. DOM Integrity: Container and Toast element count
  const containers = mockDoc.querySelectorAll('#toast-container');
  assert.strictEqual(containers.length, 1, 'Exactly one #toast-container must exist in DOM');
  const toasts = mockDoc.querySelectorAll('#toast');
  assert.strictEqual(toasts.length, 1, 'Exactly one #toast element must exist in DOM (no duplicate leaks)');
  assert.strictEqual(containers[0].children.length, 1, 'Container must hold exactly 1 child element');

  // 2. DOM Content Integrity: Content reflects the final message
  const toast = toasts[0];
  assert.strictEqual(toast.textContent, 'Rapid message alert #99');
  assert.strictEqual(toast.classList.contains('show'), true, 'Toast must have "show" class active');

  // 3. Zombie Timer Elimination: Prior timers must have been cancelled
  const activeTimers = timerTracker.getActiveTimers();
  // There should be exactly 1 active toast timer and 1 active announcer timer
  assert.strictEqual(activeTimers.length, 2, `Expected exactly 2 active timers (toast + announcer), got ${activeTimers.length}`);
  assert.strictEqual(timerTracker.totalCancelled, 198, `Expected 198 cancelled timers (99 toast + 99 announcer), got ${timerTracker.totalCancelled}`);
});

runTest('ADV-TOAST-02', 'Toast lifecycle & no premature clobbering: Newer toast survives older timer expiry', () => {
  mockDoc.body.children = [];
  timerTracker.clear();

  // Call toast 1 at t=0
  showToast('First Toast Message', 2000);
  const toastEl = mockDoc.getElementById('toast');
  assert.strictEqual(toastEl.textContent, 'First Toast Message');
  assert.strictEqual(toastEl.classList.contains('show'), true);

  // Capture timer ID for toast 1
  const firstTimers = timerTracker.getActiveTimers();
  const firstToastTimerId = firstTimers.find(t => t.ms === 2000)?.id;
  assert.ok(firstToastTimerId, 'First toast timer must be scheduled');

  // Call toast 2 at t=1000
  showToast('Second Toast Message (Latest)', 2000);
  assert.strictEqual(toastEl.textContent, 'Second Toast Message (Latest)');
  assert.strictEqual(toastEl.classList.contains('show'), true);

  // Verify first toast timer was explicitly cancelled
  assert.strictEqual(timerTracker.timers.has(firstToastTimerId), false, 'First toast timer must have been cancelled');

  // Verify second toast timer is active
  const secondTimers = timerTracker.getActiveTimers();
  const secondToastTimer = secondTimers.find(t => t.ms === 2000);
  assert.ok(secondToastTimer, 'Second toast timer must be scheduled');

  // Fire second toast timer (representing expiry at t=3000)
  timerTracker.runTimer(secondToastTimer.id);

  // Toast should now have 'show' removed
  assert.strictEqual(toastEl.classList.contains('show'), false, 'Toast show class should be removed on natural expiry');
});

runTest('ADV-TOAST-03', 'Fuzz & extreme arguments to showToast: null, undefined, large string, object', () => {
  mockDoc.body.children = [];
  timerTracker.clear();

  // Fuzz arguments
  const testInputs = [
    null,
    undefined,
    12345,
    { status: 'ok', code: 200 },
    'X'.repeat(50000), // Huge string
    '',
    NaN
  ];

  for (const input of testInputs) {
    assert.doesNotThrow(() => {
      showToast(input);
    }, `showToast should not throw on input: ${typeof input}`);
    const toastEl = mockDoc.getElementById('toast');
    assert.strictEqual(toastEl.textContent, String(input));
    assert.strictEqual(toastEl.classList.contains('show'), true);
  }
});

// ============================================================================
// SUITE 2: Clipboard Exception Stress
// ============================================================================
console.log('\n--- SUITE 2: Clipboard Exception Stress ---');

await runAsyncTest('ADV-CLIP-01', 'document.execCommand("copy") throws: zero detached <textarea> elements in body', async () => {
  // Construct Checklist DOM
  mockDoc.body.children = [];
  const container = mockDoc.createElement('div');
  container.id = 'checklist-container';
  const shareBtn = mockDoc.createElement('button');
  shareBtn.id = 'share-score-btn';
  container.appendChild(shareBtn);

  // Add 7 checkboxes
  for (let i = 0; i < 7; i++) {
    const cb = mockDoc.createElement('input');
    cb.setAttribute('type', 'checkbox');
    cb.checked = (i % 2 === 0);
    container.appendChild(cb);
  }
  mockDoc.body.appendChild(container);

  // Initialize checklist
  initChecklist('#checklist-container');

  // Simulate environment where navigator.clipboard is NOT supported
  delete global.navigator;
  global.navigator = {}; // No clipboard object

  // Mock document.execCommand to throw SecurityError
  let execCommandCalls = 0;
  mockDoc.execCommand = function(cmd) {
    execCommandCalls++;
    const err = new Error('SecurityError: The operation is insecure (Simulated blocked clipboard)');
    err.name = 'SecurityError';
    throw err;
  };

  // Dispatch click on share button
  const clickEvent = { type: 'click', preventDefault: () => {} };
  await shareBtn.dispatchEvent(clickEvent);

  // Assertions
  assert.strictEqual(execCommandCalls, 1, 'execCommand should have been attempted');
  const textareas = mockDoc.body.getElementsByTagName('textarea');
  assert.strictEqual(textareas.length, 0, 'No detached <textarea> element must remain in document.body after exception');

  // Check that failure toast was displayed
  const toast = mockDoc.getElementById('toast');
  assert.ok(toast, 'Failure toast should be created');
  assert.strictEqual(toast.textContent, '클립보드 복사에 실패했습니다.');
});

await runAsyncTest('ADV-CLIP-02', '50 consecutive clipboard exception clicks: zero DOM accumulation leak', async () => {
  mockDoc.body.children = [];
  const container = mockDoc.createElement('div');
  container.id = 'checklist-container';
  const shareBtn = mockDoc.createElement('button');
  shareBtn.id = 'share-score-btn';
  container.appendChild(shareBtn);
  mockDoc.body.appendChild(container);

  initChecklist('#checklist-container');

  // Keep clipboard throwing
  delete global.navigator;
  global.navigator = {};
  mockDoc.execCommand = function() {
    throw new Error('Simulated Permission Denied');
  };

  const initialBodyChildren = mockDoc.body.children.length;

  for (let i = 0; i < 50; i++) {
    await shareBtn.dispatchEvent({ type: 'click' });
    const textareas = mockDoc.body.getElementsByTagName('textarea');
    assert.strictEqual(textareas.length, 0, `Iteration ${i}: textarea must not be left behind`);
  }

  // Verify body children count did not grow with 50 textareas
  const finalBodyChildren = mockDoc.body.children.length;
  // Should only have initial container + toast-container
  assert.ok(finalBodyChildren <= initialBodyChildren + 1, 'Body children should not accumulate leaked elements');
});

// ============================================================================
// SUITE 3: Event Listener Idempotency Stress
// ============================================================================
console.log('\n--- SUITE 3: Event Listener Idempotency Stress ---');

runTest('ADV-IDEM-01', 'initMobileNavigation() called 50 times: single event listener, no toggle lockout', () => {
  mockDoc.body.children = [];

  const toggleBtn = mockDoc.createElement('button');
  toggleBtn.id = 'nav-toggle';
  toggleBtn.setAttribute('aria-expanded', 'false');

  const primaryNav = mockDoc.createElement('nav');
  primaryNav.id = 'primary-nav';
  const link = mockDoc.createElement('a');
  link.setAttribute('href', '#tips');
  primaryNav.appendChild(link);

  const header = mockDoc.createElement('header');
  header.id = 'navbar';

  mockDoc.body.appendChild(toggleBtn);
  mockDoc.body.appendChild(primaryNav);
  mockDoc.body.appendChild(header);

  // Call initMobileNavigation 50 times!
  for (let i = 0; i < 50; i++) {
    initMobileNavigation();
  }

  // Verify dataset bound flag is present
  assert.strictEqual(toggleBtn.dataset.navBound, 'true');

  // Verify click listener count on toggleBtn is strictly 1
  const clickListeners = toggleBtn.listeners.get('click') || [];
  assert.strictEqual(clickListeners.length, 1, `Expected exactly 1 click listener, got ${clickListeners.length}`);

  // Test toggle: First click OPENS the drawer
  const clickEvent1 = { type: 'click', stopPropagation: () => {} };
  toggleBtn.dispatchEvent(clickEvent1);
  assert.strictEqual(toggleBtn.getAttribute('aria-expanded'), 'true', 'Click 1 must open drawer');
  assert.strictEqual(primaryNav.classList.contains('is-open'), true, 'Primary nav must have is-open');
  assert.strictEqual(mockDoc.body.classList.contains('menu-open'), true, 'Body must have menu-open');

  // Test toggle: Second click CLOSES the drawer (not locked out!)
  const clickEvent2 = { type: 'click', stopPropagation: () => {} };
  toggleBtn.dispatchEvent(clickEvent2);
  assert.strictEqual(toggleBtn.getAttribute('aria-expanded'), 'false', 'Click 2 must close drawer');
  assert.strictEqual(primaryNav.classList.contains('is-open'), false, 'Primary nav is-open removed');
  assert.strictEqual(mockDoc.body.classList.contains('menu-open'), false, 'Body menu-open removed');

  // Test toggle: Third click OPENS again
  toggleBtn.dispatchEvent(clickEvent1);
  assert.strictEqual(toggleBtn.getAttribute('aria-expanded'), 'true', 'Click 3 must open drawer');

  // Nav link click CLOSES drawer
  link.dispatchEvent({ type: 'click' });
  assert.strictEqual(toggleBtn.getAttribute('aria-expanded'), 'false', 'Nav link click must close drawer');
});

runTest('ADV-IDEM-02', 'initPrintTrigger() called 50 times: window.print() fires strictly once per click', () => {
  mockDoc.body.children = [];
  const printBtn = mockDoc.createElement('button');
  printBtn.id = 'print-trigger-btn';
  mockDoc.body.appendChild(printBtn);

  let printCallCount = 0;
  global.window.print = () => { printCallCount++; };

  // Call initPrintTrigger 50 times
  for (let i = 0; i < 50; i++) {
    initPrintTrigger();
  }

  assert.strictEqual(printBtn.dataset.printBound, 'true');
  const listeners = printBtn.listeners.get('click') || [];
  assert.strictEqual(listeners.length, 1, 'Print button must have exactly 1 click listener');

  // Dispatch click
  printBtn.dispatchEvent({ type: 'click' });
  assert.strictEqual(printCallCount, 1, 'window.print() must be called exactly 1 time, NOT 50 times');
});

runTest('ADV-IDEM-03', 'initTailgateSimulator() and initChecklist() idempotency guards', () => {
  mockDoc.body.children = [];

  const simContainer = mockDoc.createElement('div');
  simContainer.id = 'simulator-container';
  mockDoc.body.appendChild(simContainer);

  const chkContainer = mockDoc.createElement('div');
  chkContainer.id = 'checklist-container';
  mockDoc.body.appendChild(chkContainer);

  // Call initializations 50 times each
  for (let i = 0; i < 50; i++) {
    initTailgateSimulator('#simulator-container');
    initChecklist('#checklist-container');
  }

  assert.strictEqual(simContainer.dataset.simBound, 'true');
  assert.strictEqual(chkContainer.dataset.chkBound, 'true');
});

// ============================================================================
// SUITE 4: Slider Scrub Stress (RAF Throttling)
// ============================================================================
console.log('\n--- SUITE 4: Slider Scrub Stress (RAF Throttling) ---');

runTest('ADV-RAF-01', 'High-frequency slider drag (500 events): 499 frames cancelled, 1 pending, 0 errors', () => {
  mockDoc.body.children = [];
  rafTracker.clear();

  const container = mockDoc.createElement('div');
  container.id = 'simulator-container';

  const slider = mockDoc.createElement('input');
  slider.id = 'ceiling-height-slider';
  slider.setAttribute('type', 'range');
  slider.value = '210';
  container.appendChild(slider);

  const output = mockDoc.createElement('output');
  output.id = 'ceiling-height-output';
  container.appendChild(output);

  // SVG elements for visualizer
  const ceilingLine = mockDoc.createElement('line');
  ceilingLine.id = 'svg-ceiling-line';
  container.appendChild(ceilingLine);

  const tailgateBar = mockDoc.createElement('line');
  tailgateBar.id = 'svg-tailgate-bar';
  container.appendChild(tailgateBar);

  const spoilerPoint = mockDoc.createElement('circle');
  spoilerPoint.id = 'svg-spoiler-point';
  container.appendChild(spoilerPoint);

  mockDoc.body.appendChild(container);

  initTailgateSimulator('#simulator-container');

  // Rapidly fire 500 scrub input events within single frame interval
  const scrubEventCount = 500;
  for (let i = 0; i < scrubEventCount; i++) {
    const val = 180 + (i % 81); // 180 ~ 260cm
    slider.value = String(val);
    slider.dispatchEvent({ type: 'input', target: slider });
  }

  // Assertions BEFORE frame flush
  assert.strictEqual(rafTracker.totalScheduled, 500, '500 RAF callbacks scheduled');
  assert.strictEqual(rafTracker.totalCancelled, 499, '499 intermediate RAF callbacks must be cancelled');
  assert.strictEqual(rafTracker.getPendingCount(), 1, 'Exactly 1 pending RAF callback remains');

  // Flush the single pending frame
  const flushed = rafTracker.flushOne();
  assert.strictEqual(flushed, 1, 'Flushed exactly 1 frame');

  // Verify DOM updated to final scrub value
  const finalVal = slider.value;
  assert.strictEqual(output.textContent, `${finalVal}cm`);

  // Verify SafeStorage persisted final value
  const saved = loadSimulatorState();
  assert.strictEqual(saved.ceilingCm, Number(finalVal));
});

runTest('ADV-RAF-02', 'Multi-frame scrub burst (10 frames x 50 events each): steady state throttling', () => {
  rafTracker.clear();
  const slider = mockDoc.getElementById('ceiling-height-slider');
  const output = mockDoc.getElementById('ceiling-height-output');

  let totalFlushed = 0;
  for (let frame = 0; frame < 10; frame++) {
    // 50 scrub events during frame
    for (let e = 0; e < 50; e++) {
      const val = 180 + frame * 8 + (e % 5);
      slider.value = String(val);
      slider.dispatchEvent({ type: 'input', target: slider });
    }
    assert.strictEqual(rafTracker.getPendingCount(), 1, `Frame ${frame}: only 1 pending RAF allowed`);
    totalFlushed += rafTracker.flushAll();
  }

  assert.strictEqual(totalFlushed, 10, 'Across 10 frames with 500 events, exactly 10 updates were rendered');
  assert.strictEqual(rafTracker.totalCancelled, 490, '490 intermediate RAF updates were cancelled');
});

runTest('ADV-RAF-03', 'Scrub with extreme and malformed values: safe boundary recovery', () => {
  const slider = mockDoc.getElementById('ceiling-height-slider');

  const strangeValues = ['', 'abc', '-500', '999999', '210.5', 'NaN', 'Infinity'];
  for (const v of strangeValues) {
    assert.doesNotThrow(() => {
      slider.value = v;
      slider.dispatchEvent({ type: 'input', target: slider });
      rafTracker.flushAll();
    }, `Slider scrub should not throw on value: "${v}"`);
  }
});

runTest('ADV-RAF-04', 'Environment fallback: requestAnimationFrame is undefined', () => {
  const origRAF = global.requestAnimationFrame;
  const origCAF = global.cancelAnimationFrame;
  global.requestAnimationFrame = undefined;
  global.cancelAnimationFrame = undefined;

  const slider = mockDoc.getElementById('ceiling-height-slider');
  slider.value = '220';

  assert.doesNotThrow(() => {
    slider.dispatchEvent({ type: 'input', target: slider });
  }, 'Should fall back gracefully to synchronous update when RAF is missing');

  const output = mockDoc.getElementById('ceiling-height-output');
  assert.strictEqual(output.textContent, '220cm');

  // Restore RAF
  global.requestAnimationFrame = origRAF;
  global.cancelAnimationFrame = origCAF;
});

// ============================================================================
// SUITE 5: Fuzz Input Stress for calculateClearance
// ============================================================================
console.log('\n--- SUITE 5: Fuzz Input Stress for calculateClearance ---');

runTest('ADV-FUZZ-01', 'Automotive safety fail-safe: NaN, Infinity, -Infinity, undefined, non-finite', () => {
  const dangerousInputs = [
    [NaN, 2150],
    [210, NaN],
    [NaN, NaN],
    [Infinity, 2150],
    [210, Infinity],
    [-Infinity, 2150],
    [210, -Infinity],
    [Infinity, Infinity],
    [-Infinity, -Infinity],
    [undefined, 2150],
    [210, undefined],
    ['invalid_str', 2150],
    [210, 'corrupt_val'],
    [{}, 2150],
    [210, {}],
    [[1, 2], 2150],
    [() => {}, 2150],
    ['NaN', 2150],
    ['Infinity', 2150]
  ];

  for (const [ceiling, tailgate] of dangerousInputs) {
    const res = calculateClearance(ceiling, tailgate);
    assert.strictEqual(res.clearance, -Infinity, `Input [${ceiling}, ${tailgate}] must yield clearance -Infinity`);
    assert.strictEqual(res.status, 'COLLISION_DANGER', `Input [${ceiling}, ${tailgate}] must trigger COLLISION_DANGER`);
    assert.strictEqual(res.badgeType, 'danger', `Input [${ceiling}, ${tailgate}] must yield badgeType "danger"`);
    assert.strictEqual(res.ceilingMm, 0);
    assert.strictEqual(res.tailgateHeightMm, 0);
  }
});

runTest('ADV-FUZZ-02', 'Extreme boundary values: null, zero, negative, huge numbers', () => {
  // Test null ceiling: Number(null) is 0
  const nullCeiling = calculateClearance(null, 2150);
  assert.strictEqual(nullCeiling.clearance, -2150);
  assert.strictEqual(nullCeiling.status, 'COLLISION_DANGER');

  // Test null tailgate: Number(null) is 0 (0mm tailgate)
  const nullTailgate = calculateClearance(210, null);
  assert.strictEqual(nullTailgate.clearance, 2100);
  assert.strictEqual(nullTailgate.status, 'SAFE');

  // Negative numbers
  const negCeiling = calculateClearance(-50, 2150);
  assert.strictEqual(negCeiling.clearance, -2650);
  assert.strictEqual(negCeiling.status, 'COLLISION_DANGER');

  const negBoth = calculateClearance(-100, -500);
  assert.strictEqual(negBoth.clearance, -500);
  assert.strictEqual(negBoth.status, 'COLLISION_DANGER');

  // Exact collision boundary: clearance = 0
  const zeroClearance = calculateClearance(215, 2150);
  assert.strictEqual(zeroClearance.clearance, 0);
  assert.strictEqual(zeroClearance.status, 'WARNING'); // 0 < 150

  // Warning margin boundary: clearance = 149 vs 150
  const warning149 = calculateClearance(206.9, 1920); // 2069 - 1920 = 149
  assert.strictEqual(warning149.clearance, 149);
  assert.strictEqual(warning149.status, 'WARNING');

  const safe150 = calculateClearance(207.0, 1920); // 2070 - 1920 = 150
  assert.strictEqual(safe150.clearance, 150);
  assert.strictEqual(safe150.status, 'SAFE');

  // Huge numbers
  const hugeCeiling = calculateClearance(1e10, 2150);
  assert.strictEqual(hugeCeiling.status, 'SAFE');

  const hugeTailgate = calculateClearance(210, 1e10);
  assert.strictEqual(hugeTailgate.status, 'COLLISION_DANGER');
});

runTest('ADV-FUZZ-03', 'Massive pseudo-random fuzzing: 10,000 randomized trials', () => {
  const fuzzCorpus = [
    // Numbers
    0, -0, 1, -1, 180, 210, 260, 2150, 1920, 1780, -2150, 0.0001, -0.0001,
    // Extremes
    Infinity, -Infinity, NaN, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER,
    Number.MAX_VALUE, Number.MIN_VALUE, Number.EPSILON, 1e20, -1e20,
    // Primitives & Types
    null, undefined, true, false,
    // Strings
    '', ' ', '0', '180', '210', '260', '2150', '-50', '210cm', 'abc', '   210   ',
    '0x10', '0b101', '1e5', 'NaN', 'Infinity', '-Infinity',
    // Objects & Arrays
    {}, [], [210], [1, 2], { val: 210 }
  ];

  let unhandledExceptions = 0;
  let validContractCount = 0;
  const iterations = 10000;

  for (let i = 0; i < iterations; i++) {
    const cIdx = Math.floor(Math.random() * fuzzCorpus.length);
    const tIdx = Math.floor(Math.random() * fuzzCorpus.length);
    const cVal = fuzzCorpus[cIdx];
    const tVal = fuzzCorpus[tIdx];

    try {
      const res = calculateClearance(cVal, tVal);

      // Contract assertions
      assert.ok(typeof res === 'object' && res !== null, 'Must return non-null object');
      assert.ok('ceilingMm' in res, 'Missing ceilingMm');
      assert.ok('tailgateHeightMm' in res, 'Missing tailgateHeightMm');
      assert.ok('clearance' in res, 'Missing clearance');
      assert.ok('status' in res, 'Missing status');
      assert.ok('badgeType' in res, 'Missing badgeType');

      assert.ok(typeof res.ceilingMm === 'number', 'ceilingMm must be number');
      assert.ok(typeof res.tailgateHeightMm === 'number', 'tailgateHeightMm must be number');
      assert.ok(typeof res.clearance === 'number', 'clearance must be number');
      assert.ok(['SAFE', 'WARNING', 'COLLISION_DANGER'].includes(res.status), `Invalid status: ${res.status}`);
      assert.ok(['safe', 'warning', 'danger'].includes(res.badgeType), `Invalid badgeType: ${res.badgeType}`);

      // Semantic integrity
      if (res.clearance < 0 || res.clearance === -Infinity) {
        assert.strictEqual(res.status, 'COLLISION_DANGER');
        assert.strictEqual(res.badgeType, 'danger');
      } else if (res.clearance < 150) {
        assert.strictEqual(res.status, 'WARNING');
        assert.strictEqual(res.badgeType, 'warning');
      } else {
        assert.strictEqual(res.status, 'SAFE');
        assert.strictEqual(res.badgeType, 'safe');
      }

      validContractCount++;
    } catch (e) {
      unhandledExceptions++;
      console.error(`Fuzz exception on inputs: cVal=${String(cVal)}, tVal=${String(tVal)}:`, e.message);
    }
  }

  assert.strictEqual(unhandledExceptions, 0, `Encountered ${unhandledExceptions} unhandled exceptions during fuzzing`);
  assert.strictEqual(validContractCount, iterations, `All ${iterations} fuzz trials must conform strictly to interface contract`);
});

// ============================================================================
// SUITE SUMMARY
// ============================================================================
console.log('\n================================================================================');
console.log('  ADVERSARIAL STRESS TEST EXECUTION SUMMARY');
console.log('--------------------------------------------------------------------------------');
const passedCount = suiteResults.filter(r => r.status === 'PASS').length;
const failedCount = suiteResults.filter(r => r.status === 'FAIL').length;
console.log(`  Total Adversarial Tests: ${suiteResults.length}`);
console.log(`  Passed:                  ${passedCount}`);
console.log(`  Failed:                  ${failedCount}`);
console.log(`  Status:                  ${failedCount === 0 ? 'ALL ADVERSARIAL STRESS TESTS PASSED (100% GREEN)' : 'FAILURES DETECTED'}`);
console.log('================================================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
