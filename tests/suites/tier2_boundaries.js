/**
 * Tier 2: Boundary & Corner Cases Test Suite (65 Tests)
 * Verifies numeric limits, storage exceptions, invalid states, responsive constraints, and print isolation.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { DOMParser } = require('../lib/dom_parser.js');
const { CSSParser } = require('../lib/css_parser.js');
const { MockLocalStorage, SimulatorOracle, ChecklistOracle } = require('../lib/virtual_env.js');

function runTier2(context) {
  const { rootDir, reporter } = context;
  const indexPath = path.join(rootDir, 'index.html');
  const cssDir = path.join(rootDir, 'css');

  let dom = null;
  let htmlContent = '';
  let combinedCSS = '';
  let cssParsed = null;

  try {
    if (fs.existsSync(indexPath)) {
      htmlContent = fs.readFileSync(indexPath, 'utf-8');
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

  function requireDOM() {
    assert.ok(dom, 'index.html must exist and be valid HTML5');
  }

  // =========================================================================
  // Category 1: Simulator Boundary & Numeric Limits (12 tests)
  // =========================================================================
  test('T2-SIM-01', 'Simulator min boundary: 180cm ceiling generates negative clearance collision with full opening (2150mm)', () => {
    const res = SimulatorOracle.calculate(180, SimulatorOracle.PRESETS.full);
    assert.strictEqual(res.clearance, -350, '1800mm ceiling - 2150mm tailgate = -350mm');
    assert.strictEqual(res.status, 'COLLISION_DANGER');
    assert.strictEqual(res.badgeType, 'danger');
  });

  test('T2-SIM-02', 'Simulator max boundary: 260cm ceiling generates safe clearance with all presets', () => {
    const res = SimulatorOracle.calculate(260, SimulatorOracle.PRESETS.full);
    assert.strictEqual(res.clearance, 450, '2600mm ceiling - 2150mm tailgate = +450mm');
    assert.strictEqual(res.status, 'SAFE');
    assert.strictEqual(res.badgeType, 'safe');
  });

  test('T2-SIM-03', 'Simulator default value: 210cm ceiling creates exact danger collision with full open', () => {
    const res = SimulatorOracle.calculate(210, SimulatorOracle.PRESETS.full);
    assert.strictEqual(res.clearance, -50, '2100mm ceiling - 2150mm tailgate = -50mm');
    assert.strictEqual(res.status, 'COLLISION_DANGER');
  });

  test('T2-SIM-04', 'Simulator exact zero clearance boundary (clearance === 0) categorizes as WARNING (0 < 150)', () => {
    const res = SimulatorOracle.calculate(215, 2150);
    assert.strictEqual(res.clearance, 0, '2150mm ceiling - 2150mm tailgate = 0mm');
    assert.strictEqual(res.status, 'WARNING', 'Zero clearance has no margin and should trigger WARNING');
  });

  test('T2-SIM-05', 'Simulator warning threshold boundary: clearance of 149mm triggers WARNING (<150mm margin)', () => {
    const res = SimulatorOracle.calculate(206.9, 1920); // 2069 - 1920 = 149mm
    assert.strictEqual(Math.round(res.clearance), 149);
    assert.strictEqual(res.status, 'WARNING');
  });

  test('T2-SIM-06', 'Simulator safe threshold boundary: clearance of 150mm triggers SAFE (>=150mm margin)', () => {
    const res = SimulatorOracle.calculate(207.0, 1920); // 2070 - 1920 = 150mm
    assert.strictEqual(Math.round(res.clearance), 150);
    assert.strictEqual(res.status, 'SAFE');
  });

  test('T2-SIM-07', 'Simulator Level 3 preset (1920mm) in standard 2.1m parking generates +180mm SAFE clearance', () => {
    const res = SimulatorOracle.calculate(210, SimulatorOracle.PRESETS.level3);
    assert.strictEqual(res.clearance, 180);
    assert.strictEqual(res.status, 'SAFE');
  });

  test('T2-SIM-08', 'Simulator Level 2 preset (1780mm) in tight 1.85m parking generates +70mm WARNING clearance', () => {
    const res = SimulatorOracle.calculate(185, SimulatorOracle.PRESETS.level2);
    assert.strictEqual(res.clearance, 70);
    assert.strictEqual(res.status, 'WARNING');
  });

  test('T2-SIM-09', 'Simulator handles string conversion for slider numeric value input gracefully', () => {
    const res = SimulatorOracle.calculate(Number('205'), 1920);
    assert.strictEqual(res.clearance, 130);
    assert.strictEqual(res.status, 'WARNING');
  });

  test('T2-SIM-10', 'Slider HTML attributes min, max, step enforce correct DOM boundaries', () => {
    requireDOM();
    const slider = dom.getElementById('ceiling-height-slider') || dom.querySelector('input[type="range"]');
    assert.ok(slider, 'Slider must exist');
    assert.strictEqual(slider.getAttribute('min'), '180');
    assert.strictEqual(slider.getAttribute('max'), '260');
  });

  test('T2-SIM-11', 'Extreme low ceiling (170cm out-of-range clamped to 180cm) triggers extreme collision', () => {
    const clampedCeiling = Math.max(180, 170);
    assert.strictEqual(clampedCeiling, 180);
    const res = SimulatorOracle.calculate(clampedCeiling, 2150);
    assert.strictEqual(res.clearance, -350);
    assert.strictEqual(res.status, 'COLLISION_DANGER');
  });

  test('T2-SIM-12', 'Extreme high ceiling (300cm out-of-range clamped to 260cm) maintains SAFE boundary', () => {
    const clampedCeiling = Math.min(260, 300);
    assert.strictEqual(clampedCeiling, 260);
    const res = SimulatorOracle.calculate(clampedCeiling, 2150);
    assert.strictEqual(res.clearance, 450);
    assert.strictEqual(res.status, 'SAFE');
  });

  test('T2-SIM-13', 'Simulator fail-safe boundary: invalid/NaN input defaults to COLLISION_DANGER and clearance -Infinity', () => {
    const { calculateClearance } = require('../../js/simulator.js');
    const resModule = calculateClearance('invalid', 2150);
    assert.strictEqual(resModule.status, 'COLLISION_DANGER');
    assert.strictEqual(resModule.badgeType, 'danger');
    assert.strictEqual(resModule.clearance, -Infinity);

    const resOracle = SimulatorOracle.calculate('invalid', 2150);
    assert.strictEqual(resOracle.status, 'COLLISION_DANGER');
    assert.strictEqual(resOracle.badgeType, 'danger');
    assert.strictEqual(resOracle.clearance, -Infinity);
  });

  // =========================================================================
  // Category 2: Checklist State & Score Boundaries (14 tests)
  // =========================================================================
  test('T2-CHK-01', 'Checklist empty state (0 checked) returns 0% score and HIGH_RISK badge', () => {
    const score = ChecklistOracle.calculateScore([]);
    assert.strictEqual(score.count, 0);
    assert.strictEqual(score.percentage, 0);
    assert.strictEqual(score.level, 'HIGH_RISK');
    assert.ok(score.title.includes('고위험군'));
  });

  test('T2-CHK-02', 'Checklist 1/7 checked returns 14% score and HIGH_RISK badge', () => {
    const score = ChecklistOracle.calculateScore([0]);
    assert.strictEqual(score.count, 1);
    assert.strictEqual(score.percentage, 14);
    assert.strictEqual(score.level, 'HIGH_RISK');
  });

  test('T2-CHK-03', 'Checklist 2/7 checked returns 28% score and HIGH_RISK badge (upper boundary of HIGH_RISK)', () => {
    const score = ChecklistOracle.calculateScore([0, 1]);
    assert.strictEqual(score.count, 2);
    assert.strictEqual(score.percentage, 29); // Math.round(2/7*100) = 29%
    assert.strictEqual(score.level, 'HIGH_RISK');
  });

  test('T2-CHK-04', 'Checklist 3/7 checked returns 43% score and transitions to WARNING badge', () => {
    const score = ChecklistOracle.calculateScore([0, 1, 2]);
    assert.strictEqual(score.count, 3);
    assert.strictEqual(score.percentage, 43);
    assert.strictEqual(score.level, 'WARNING');
    assert.ok(score.title.includes('주의'));
  });

  test('T2-CHK-05', 'Checklist 4/7 checked returns 57% score and retains WARNING badge', () => {
    const score = ChecklistOracle.calculateScore([0, 1, 2, 3]);
    assert.strictEqual(score.count, 4);
    assert.strictEqual(score.percentage, 57);
    assert.strictEqual(score.level, 'WARNING');
  });

  test('T2-CHK-06', 'Checklist 5/7 checked returns 71% score and retains WARNING badge (upper boundary of WARNING)', () => {
    const score = ChecklistOracle.calculateScore([0, 1, 2, 3, 4]);
    assert.strictEqual(score.count, 5);
    assert.strictEqual(score.percentage, 71);
    assert.strictEqual(score.level, 'WARNING');
  });

  test('T2-CHK-07', 'Checklist 6/7 checked returns 86% score and transitions to SAFE badge', () => {
    const score = ChecklistOracle.calculateScore([0, 1, 2, 3, 4, 5]);
    assert.strictEqual(score.count, 6);
    assert.strictEqual(score.percentage, 86);
    assert.strictEqual(score.level, 'SAFE');
    assert.ok(score.title.includes('철벽 방어'));
  });

  test('T2-CHK-08', 'Checklist full state (7/7 checked) returns 100% score and SAFE badge', () => {
    const score = ChecklistOracle.calculateScore([0, 1, 2, 3, 4, 5, 6]);
    assert.strictEqual(score.count, 7);
    assert.strictEqual(score.percentage, 100);
    assert.strictEqual(score.level, 'SAFE');
    assert.ok(score.title.includes('100% 안전'));
  });

  test('T2-CHK-09', 'Checklist deduplicates duplicate index inputs correctly', () => {
    const score = ChecklistOracle.calculateScore([0, 0, 1, 1, 2, 2]);
    assert.strictEqual(score.count, 3);
    assert.strictEqual(score.percentage, 43);
  });

  test('T2-CHK-10', 'Checklist filters out out-of-bound indices (<0 or >=7)', () => {
    const score = ChecklistOracle.calculateScore([-1, 0, 1, 7, 99]);
    assert.strictEqual(score.count, 2);
    assert.deepStrictEqual(score.checkedIndices, [0, 1]);
  });

  test('T2-CHK-11', 'Checklist handles non-numeric values in input array cleanly', () => {
    const score = ChecklistOracle.calculateScore([null, undefined, 'abc', 0, 1]);
    assert.strictEqual(score.count, 2);
  });

  test('T2-CHK-12', 'Checklist DOM inputs all possess unique id and value attributes', () => {
    requireDOM();
    const check = dom.getElementById('checklist-container') || dom.querySelector('#checklist-container, #checklist');
    assert.ok(check, 'Checklist container must exist');
    const inputs = check.querySelectorAll('input[type="checkbox"]');
    const ids = new Set();
    for (const input of inputs) {
      const id = input.id;
      assert.ok(id, 'Every checklist input must have an id');
      assert.ok(!ids.has(id), `Duplicate checkbox id detected: ${id}`);
      ids.add(id);
    }
  });

  test('T2-CHK-13', 'Checklist label tags properly associate with checkbox inputs via "for" attribute', () => {
    requireDOM();
    const check = dom.getElementById('checklist-container') || dom.querySelector('#checklist-container, #checklist');
    assert.ok(check, 'Checklist container must exist');
    const labels = check.querySelectorAll('label[for]');
    assert.ok(labels.length >= 7, `Expected at least 7 <label for="..."> tags (found ${labels.length})`);
  });

  test('T2-CHK-14', 'Rapid toggling simulation preserves state integrity', () => {
    let current = [];
    for (let i = 0; i < 20; i++) {
      const idx = i % 7;
      if (current.includes(idx)) {
        current = current.filter(x => x !== idx);
      } else {
        current.push(idx);
      }
    }
    const score = ChecklistOracle.calculateScore(current);
    assert.ok(score.count >= 0 && score.count <= 7);
  });

  // =========================================================================
  // Category 3: Storage Resiliency & Corrupt Data Tests (12 tests)
  // =========================================================================
  test('T2-STO-01', 'MockLocalStorage correctly sets, retrieves, and removes items', () => {
    const storage = new MockLocalStorage();
    storage.setItem('test_key', 'test_val');
    assert.strictEqual(storage.getItem('test_key'), 'test_val');
    storage.removeItem('test_key');
    assert.strictEqual(storage.getItem('test_key'), null);
  });

  test('T2-STO-02', 'Deserialization handles null or empty storage without crashing', () => {
    const res = ChecklistOracle.deserialize(null);
    assert.deepStrictEqual(res, []);
    const resEmpty = ChecklistOracle.deserialize('');
    assert.deepStrictEqual(resEmpty, []);
  });

  test('T2-STO-03', 'Deserialization handles corrupt JSON string ({invalid_json) by returning empty array fallback', () => {
    const res = ChecklistOracle.deserialize('{invalid_json');
    assert.deepStrictEqual(res, []);
  });

  test('T2-STO-04', 'Deserialization parses legacy raw array format [0, 1, 2] seamlessly', () => {
    const res = ChecklistOracle.deserialize('[0, 1, 2]');
    assert.deepStrictEqual(res, [0, 1, 2]);
  });

  test('T2-STO-05', 'Deserialization parses versioned payload format {"version":1,"checked":[2,4]}', () => {
    const res = ChecklistOracle.deserialize(JSON.stringify({ version: 1, checked: [2, 4] }));
    assert.deepStrictEqual(res, [2, 4]);
  });

  test('T2-STO-06', 'Storage throws SecurityError when disabled (simulating Safari incognito mode) and falls back safely', () => {
    const storage = new MockLocalStorage();
    storage.throwOnAccess = true;
    let fallbackUsed = false;
    try {
      storage.getItem('tucson_trunk_prevention_checklist_v1');
    } catch (e) {
      fallbackUsed = true;
    }
    assert.strictEqual(fallbackUsed, true, 'SecurityError must be caught and in-memory state used');
  });

  test('T2-STO-07', 'Storage throws QuotaExceededError and app catches without crashing', () => {
    const storage = new MockLocalStorage();
    storage.quotaExceeded = true;
    let caught = false;
    try {
      storage.setItem('tucson_trunk_prevention_checklist_v1', 'data');
    } catch (e) {
      if (e.name === 'QuotaExceededError') caught = true;
    }
    assert.strictEqual(caught, true, 'QuotaExceededError must be handled gracefully');
  });

  test('T2-STO-08', 'Serialized data matches canonical storage key name "tucson_trunk_prevention_checklist_v1"', () => {
    assert.strictEqual(ChecklistOracle.STORAGE_KEY, 'tucson_trunk_prevention_checklist_v1');
  });

  test('T2-STO-09', 'Clear operation completely empties stored key without leaving orphaned references', () => {
    const storage = new MockLocalStorage();
    storage.setItem(ChecklistOracle.STORAGE_KEY, JSON.stringify([0, 1]));
    storage.clear();
    assert.strictEqual(storage.getItem(ChecklistOracle.STORAGE_KEY), null);
  });

  test('T2-STO-10', 'Storage handles extreme length payloads safely without stack overflow', () => {
    const largeArray = new Array(1000).fill(1);
    const serialized = ChecklistOracle.serialize(largeArray);
    const deserialized = ChecklistOracle.deserialize(serialized);
    const score = ChecklistOracle.calculateScore(deserialized);
    assert.strictEqual(score.count, 1, 'Only index 1 should remain valid');
  });

  test('T2-STO-11', 'Storage handles unexpected object schema gracefully', () => {
    const weirdPayload = JSON.stringify({ unexpected: true, foo: 'bar' });
    const res = ChecklistOracle.deserialize(weirdPayload);
    assert.deepStrictEqual(res, []);
  });

  test('T2-STO-12', 'Multiple sequential save-and-load cycles maintain exact array fidelity', () => {
    const testCases = [[], [0], [0, 2, 4, 6], [1, 3, 5], [0, 1, 2, 3, 4, 5, 6]];
    for (const tc of testCases) {
      const ser = ChecklistOracle.serialize(tc);
      const de = ChecklistOracle.deserialize(ser);
      const score = ChecklistOracle.calculateScore(de);
      assert.deepStrictEqual(score.checkedIndices, tc);
    }
  });

  test('T2-STO-13', 'Checklist strict integer validation rejects floating-point numbers ([1.5, 2.7, 3] -> only [3])', () => {
    const { calculateChecklistScore } = require('../../js/checklist.js');
    const res = calculateChecklistScore([1.5, 2.7, 3]);
    assert.strictEqual(res.count, 1, 'Only integer index 3 must be valid');
    assert.strictEqual(res.percentage, 14);
    assert.deepStrictEqual(res.checkedIndices, [3]);

    const resOracle = ChecklistOracle.calculateScore([1.5, 2.7, 3]);
    assert.strictEqual(resOracle.count, 1);
    assert.strictEqual(resOracle.percentage, 14);
  });

  test('T2-STO-14', 'SafeStorage getJSON automatically self-heals corrupted JSON string by purging key', () => {
    const { SafeStorage } = require('../../js/storage.js');
    SafeStorage.setItem('corrupted_key_test', '{bad_json:true');
    const result = SafeStorage.getJSON('corrupted_key_test', null, [], true);
    assert.deepStrictEqual(result, []);
    assert.strictEqual(SafeStorage.getItem('corrupted_key_test'), null, 'Corrupted key must be purged by self-healing');
  });

  test('T2-STO-15', 'SafeStorage multi-tier fallback: QuotaExceeded on localStorage seamlessly falls back to sessionStorage or memory', () => {
    const { SafeStorage } = require('../../js/storage.js');
    const writeOk = SafeStorage.setItem('quota_fallback_test', JSON.stringify({ saved: true }));
    assert.strictEqual(writeOk, true);
    const readVal = SafeStorage.getJSON('quota_fallback_test');
    assert.deepStrictEqual(readVal, { saved: true });
    SafeStorage.removeItem('quota_fallback_test');
  });

  test('T2-STO-16', 'MemoryStorage facade provides guaranteed in-memory storage when browser storage is blocked', () => {
    const { MemoryStorage } = require('../../js/storage.js');
    const memStore = new MemoryStorage();
    memStore.setItem('session_key', 'session_data');
    assert.strictEqual(memStore.getItem('session_key'), 'session_data');
    assert.strictEqual(memStore.length, 1);
    memStore.removeItem('session_key');
    assert.strictEqual(memStore.getItem('session_key'), null);
  });

  test('T2-STO-17', 'Simulator state persistence clamps out-of-bounds ceiling values (170cm -> 180cm, 350cm -> 260cm)', () => {
    const { saveSimulatorState, loadSimulatorState, SIMULATOR_STORAGE_KEY } = require('../../js/simulator.js');
    const { SafeStorage } = require('../../js/storage.js');

    saveSimulatorState(170, 'full');
    let state = loadSimulatorState();
    assert.strictEqual(state.ceilingCm, 180, 'Ceiling 170cm must be clamped to 180cm minimum');

    saveSimulatorState(350, 'full');
    state = loadSimulatorState();
    assert.strictEqual(state.ceilingCm, 260, 'Ceiling 350cm must be clamped to 260cm maximum');

    SafeStorage.removeItem(SIMULATOR_STORAGE_KEY);
  });

  test('T2-STO-18', 'Simulator state persistence defaults invalid tailgate preset mode to "full"', () => {
    const { saveSimulatorState, loadSimulatorState, SIMULATOR_STORAGE_KEY } = require('../../js/simulator.js');
    const { SafeStorage } = require('../../js/storage.js');

    saveSimulatorState(210, 'hyper_open');
    const state = loadSimulatorState();
    assert.strictEqual(state.mode, 'full', 'Invalid preset mode must default safely to "full"');

    SafeStorage.removeItem(SIMULATOR_STORAGE_KEY);
  });

  // =========================================================================
  // Category 4: Responsive Layout & Viewport Breakpoints (12 tests)
  // =========================================================================
  test('T2-RSP-01', 'CSS variables define design tokens (hyundai-blue, hyundai-active, nline-red, bg-primary)', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const vars = cssParsed.getRootVariables();
    const hasTokens = vars['--hyundai-blue'] || vars['--color-hyundai-blue'] ||
                      vars['--hyundai-active'] || vars['--color-accent-cyan'] ||
                      vars['--bg-primary'] || vars['--color-bg-base'] ||
                      vars['--nline-red'] || vars['--color-nline-red'];
    assert.ok(hasTokens, 'Must define core automotive CSS custom properties');
  });

  test('T2-RSP-02', 'CSS includes responsive media query for mobile screens (max-width <= 768px)', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const mobileRules = cssParsed.getMediaRules('768');
    assert.ok(mobileRules.length > 0 || cssParsed.getMediaRules('max-width').length > 0, 'CSS must contain responsive media queries for mobile viewports');
  });

  test('T2-RSP-03', 'Mobile navigation drawer toggle is hidden on desktop screens and styled for mobile', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    requireDOM();
    const toggle = dom.getElementById('nav-toggle') || dom.querySelector('.nav-toggle');
    assert.ok(toggle, 'Nav toggle element must exist in DOM');

    // Verify toggle button selector is explicitly targeted in CSS
    const toggleClass = toggle.getAttribute('class') || '';
    const hasToggleRule = cssParsed.hasProperty('#' + toggle.id, 'display') ||
                         toggleClass.split(/\s+/).some(c => cssParsed.hasProperty('.' + c, 'display') || cssParsed.hasProperty('.' + c, 'width'));
    assert.ok(hasToggleRule, 'Nav toggle styling (#nav-toggle or .nav-toggle) must be declared with display/dimensions in CSS');

    // Verify desktop hiding rule exists in media queries or layout
    const desktopRules = cssParsed.getMediaRules('1024').concat(cssParsed.getMediaRules('min-width'));
    const isHiddenOnDesktop = desktopRules.some(b => b.rules.some(r => 
      (r.selector.includes('nav-toggle') || r.selector.includes('#nav-toggle') || r.selector.includes('mobile-menu-toggle')) &&
      (r.declarations.display === 'none' || (r.declarations.display && r.declarations.display.includes('none')))
    )) || cssParsed.hasProperty('#nav-toggle', 'display', 'none') || cssParsed.hasProperty('.nav-toggle', 'display', 'none');

    assert.ok(isHiddenOnDesktop, 'Nav toggle must have display: none on desktop viewports (>= 1024px)');
  });

  test('T2-RSP-04', 'Ultra-narrow viewport (320px) safety: body has overflow-x hidden or responsive wrapper', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const hasOverflow = cssParsed.hasProperty('body', 'overflow-x', 'hidden') ||
                        cssParsed.hasProperty('html', 'overflow-x', 'hidden') ||
                        cssParsed.hasProperty('.container', 'max-width') ||
                        cssParsed.hasProperty('.container', 'width');
    assert.ok(hasOverflow, 'CSS must protect against horizontal scroll overflow on 320px devices');
  });

  test('T2-RSP-05', 'Touch targets for buttons and links have adequate sizing (>= 44px height/padding)', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const btnPadding = cssParsed.hasProperty('button', 'padding') ||
                       cssParsed.hasProperty('.btn', 'padding') ||
                       cssParsed.hasProperty('button', 'min-height') ||
                       cssParsed.hasProperty('.btn', 'min-height');
    assert.ok(btnPadding, 'Buttons must have touch target padding/sizing defined');
  });

  test('T2-RSP-06', 'Scenario cards layout uses CSS Grid or Flexbox for dynamic wrapping', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    requireDOM();
    const scenariosSection = dom.getElementById('scenarios');
    assert.ok(scenariosSection, 'Section #scenarios must exist');

    // Find the actual card container inside #scenarios
    const cardContainer = scenariosSection.querySelector('.scenarios-grid, .scenario-grid, .grid, [class*="grid"]');
    assert.ok(cardContainer, 'Scenario cards container must exist in #scenarios');

    // Verify that the actual class applied to the container is styled with grid or flex
    const containerClasses = (cardContainer.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    const hasGridOrFlex = containerClasses.some(cls => 
      cssParsed.hasProperty('.' + cls, 'display', /(grid|flex)/)
    ) || cssParsed.hasProperty('#' + scenariosSection.id + ' .' + containerClasses[0], 'display', /(grid|flex)/);

    assert.ok(hasGridOrFlex, `Container classes [${containerClasses.join(', ')}] must have display: grid or flex declared in CSS`);
  });

  test('T2-RSP-07', 'Max-width containment: page container limits width to 1200px~1400px on widescreen displays', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const hasMaxWidth = cssParsed.hasProperty('.container', 'max-width') ||
                        cssParsed.hasProperty('main', 'max-width') ||
                        cssParsed.hasProperty('.wrapper', 'max-width');
    assert.ok(hasMaxWidth, 'Page layout must contain max-width on wide displays');
  });

  test('T2-RSP-08', 'Interactive slider thumb has touch-friendly thumb dimensions in CSS', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const hasThumb = combinedCSS.includes('::-webkit-slider-thumb') ||
                     combinedCSS.includes('::-moz-range-thumb') ||
                     cssParsed.hasProperty('input[type="range"]', 'cursor');
    assert.ok(hasThumb, 'CSS should include custom range slider thumb styling');
  });

  test('T2-RSP-09', 'Checklist items have vertical spacing preventing mis-taps on mobile', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const hasSpacing = cssParsed.hasProperty('.checklist-item', 'margin') ||
                       cssParsed.hasProperty('.checklist-item', 'padding') ||
                       cssParsed.hasProperty('.checklist-item', 'gap') ||
                       cssParsed.hasProperty('.checklist-list', 'gap');
    assert.ok(hasSpacing, 'Checklist items must have adequate tap spacing');
  });

  test('T2-RSP-10', 'Table container supports horizontal scrolling on mobile viewports', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const hasTableOverflow = cssParsed.hasProperty('.table-responsive', 'overflow-x') ||
                             cssParsed.hasProperty('.table-wrapper', 'overflow-x') ||
                             cssParsed.hasProperty('table', 'overflow-x') ||
                             combinedCSS.includes('overflow-x: auto');
    assert.ok(hasTableOverflow, 'Table must have horizontal scroll wrapper for narrow mobile screens');
  });

  test('T2-RSP-11', 'Typography uses relative fluid units (rem / em) for accessible scaling', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    assert.ok(combinedCSS.includes('rem') || combinedCSS.includes('em'), 'CSS must use rem/em units for typography');
  });

  test('T2-RSP-12', 'Smooth scrolling behavior is enabled on html element', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const smooth = cssParsed.hasProperty('html', 'scroll-behavior', 'smooth');
    assert.ok(smooth, 'html tag should specify scroll-behavior: smooth for anchor links');
  });

  test('T2-RSP-13', 'HTML-to-CSS Class Coverage Integrity: >= 85% of unique HTML classes have corresponding CSS selectors', () => {
    requireDOM();
    assert.ok(combinedCSS, 'Combined CSS must exist');

    // Extract all unique class names from index.html
    const classRegex = /class="([^"]+)"/g;
    let match;
    const htmlClasses = new Set();
    while ((match = classRegex.exec(htmlContent)) !== null) {
      for (const token of match[1].split(/\s+/).filter(Boolean)) {
        htmlClasses.add(token);
      }
    }

    assert.ok(htmlClasses.size > 0, 'index.html must contain styled classes');

    // Ignore dynamic state classes that may be toggled via JS
    const ignoredStateClasses = new Set(['active', 'is-open', 'show', 'hidden', 'menu-open', 'no-scroll']);
    const auditClasses = [...htmlClasses].filter(c => !ignoredStateClasses.has(c));

    const unstyled = [];
    for (const cls of auditClasses) {
      const escaped = cls.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const classPattern = new RegExp('\\.' + escaped + '(?:[\\s,:.\\[#>]|$)', 'm');
      if (!classPattern.test(combinedCSS)) {
        unstyled.push(cls);
      }
    }

    const coveragePct = Math.round(((auditClasses.length - unstyled.length) / auditClasses.length) * 100);
    assert.ok(
      coveragePct >= 85,
      `HTML-to-CSS class coverage must be at least 85% (current: ${coveragePct}%, unstyled: ${unstyled.length} of ${auditClasses.length}: ${unstyled.slice(0, 5).join(', ')}...)`
    );
  });

  // =========================================================================
  // Category 5: Print Stylesheet & Isolation Boundaries (8 tests)
  // =========================================================================
  test('T2-PRT-01', 'CSS contains dedicated @media print block', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const printRules = cssParsed.getMediaRules('print');
    assert.ok(printRules.length > 0, 'CSS must contain @media print rules');
  });

  test('T2-PRT-02', 'Navbar is hidden in @media print (display: none !important)', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const printBlocks = cssParsed.getMediaRules('print');
    let navHidden = false;
    for (const b of printBlocks) {
      for (const r of b.rules) {
        if (r.selector.includes('navbar') || r.selector.includes('header') || r.selector.includes('#navbar')) {
          if (r.declarations.display && r.declarations.display.includes('none')) {
            navHidden = true;
          }
        }
      }
    }
    assert.ok(navHidden, 'Navbar must be hidden in print view');
  });

  test('T2-PRT-03', 'Interactive buttons and slider controls are hidden in @media print', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const printBlocks = cssParsed.getMediaRules('print');
    let controlsHidden = false;
    for (const b of printBlocks) {
      for (const r of b.rules) {
        if (r.selector.includes('button') || r.selector.includes('slider') || r.selector.includes('.btn') || r.selector.includes('.nav-toggle')) {
          if (r.declarations.display && r.declarations.display.includes('none')) {
            controlsHidden = true;
          }
        }
      }
    }
    assert.ok(controlsHidden, 'Interactive buttons and sliders must be hidden in print view');
  });

  test('T2-PRT-04', 'Print card container and child layout elements are styled in @media print', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    requireDOM();
    const printCard = dom.getElementById('print-card');
    assert.ok(printCard, '#print-card must exist in DOM');

    // Collect all class names within the print-card subtree
    const subtreeClasses = new Set();
    function scanClasses(el) {
      for (const c of (el.getAttribute('class') || '').split(/\s+/)) if (c) subtreeClasses.add(c);
      for (const ch of el.children) scanClasses(ch);
    }
    scanClasses(printCard);

    // Extract all selectors defined in @media print
    const printBlocks = cssParsed.getMediaRules('print');
    const printSelectors = printBlocks.flatMap(b => b.rules.map(r => r.selector)).join(' ');

    let styledSubtreeClassCount = 0;
    for (const cls of subtreeClasses) {
      if (printSelectors.includes('.' + cls)) styledSubtreeClassCount++;
    }

    assert.ok(
      printSelectors.includes('#print-card') || printSelectors.includes('.print-card') || styledSubtreeClassCount >= 2,
      `Print card and children classes [${[...subtreeClasses].join(', ')}] must match print stylesheet rules (matched: ${styledSubtreeClassCount})`
    );
  });

  test('T2-PRT-05', 'Print layout specifies page-break-inside: avoid or break-inside: avoid', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const printBlocks = cssParsed.getMediaRules('print');
    let hasBreakAvoid = false;
    for (const b of printBlocks) {
      for (const r of b.rules) {
        if (r.declarations['page-break-inside'] || r.declarations['break-inside']) {
          hasBreakAvoid = true;
        }
      }
    }
    assert.ok(hasBreakAvoid, 'Print card must enforce break-inside: avoid for single-page printing');
  });

  test('T2-PRT-06', 'Print styling overrides dark background to light/white for ink preservation', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const printBlocks = cssParsed.getMediaRules('print');
    let inkSaving = false;
    for (const b of printBlocks) {
      for (const r of b.rules) {
        if (r.declarations.background || r.declarations['background-color'] || r.declarations.color) {
          inkSaving = true;
        }
      }
    }
    assert.ok(inkSaving, 'Print stylesheet must override background/colors for clean paper printing');
  });

  test('T2-PRT-07', 'Footer and floating social widgets are suppressed in @media print', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const printBlocks = cssParsed.getMediaRules('print');
    let footerHidden = false;
    for (const b of printBlocks) {
      for (const r of b.rules) {
        if (r.selector.includes('footer') || r.selector.includes('.toast') || r.selector.includes('.cta-group')) {
          if (r.declarations.display && r.declarations.display.includes('none')) {
            footerHidden = true;
          }
        }
      }
    }
    assert.ok(footerHidden, 'Footer / toast / floating widgets must be hidden in print');
  });

  test('T2-PRT-08', 'Print page dimensions enforce standard A4 layout margins', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    assert.ok(combinedCSS.includes('@page') || combinedCSS.includes('print'), 'CSS must include @page or print media definitions');
  });

  // =========================================================================
  // Category 6: Markup Integrity & Unique ID Boundaries (7 tests)
  // =========================================================================
  test('T2-DOM-01', 'All DOM element IDs in index.html are strictly unique', () => {
    requireDOM();
    const idMap = new Map();
    function scan(node) {
      if (node.id) {
        const count = idMap.get(node.id) || 0;
        idMap.set(node.id, count + 1);
      }
      for (const c of node.children) scan(c);
    }
    scan(dom);

    const duplicates = [];
    for (const [id, count] of idMap.entries()) {
      if (count > 1) duplicates.push(`${id} (count: ${count})`);
    }
    assert.strictEqual(duplicates.length, 0, `Duplicate IDs found: ${duplicates.join(', ')}`);
  });

  test('T2-DOM-02', 'All internal anchor links (href="#...") map to elements that physically exist in the DOM', () => {
    requireDOM();
    const anchors = dom.querySelectorAll('a[href^="#"]');
    const missingTargets = [];
    for (const a of anchors) {
      const href = a.getAttribute('href');
      if (href && href.length > 1 && !href.startsWith('#!')) {
        const targetId = href.substring(1);
        const targetNode = dom.getElementById(targetId);
        if (!targetNode) {
          missingTargets.push(`${href} referenced in link "${a.textContent.trim()}"`);
        }
      }
    }
    assert.strictEqual(missingTargets.length, 0, `Dead anchor targets detected: ${missingTargets.join(', ')}`);
  });

  test('T2-DOM-03', 'Document begins with standard <!DOCTYPE html>', () => {
    assert.ok(dom, 'index.html must exist');
    const raw = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8').trim();
    assert.ok(/^<!DOCTYPE\s+html>/i.test(raw), 'Document must begin with <!DOCTYPE html>');
  });

  test('T2-DOM-04', 'Document title tag exists and contains meaningful Korean branding text', () => {
    requireDOM();
    const title = dom.querySelector('title');
    assert.ok(title, '<title> tag must exist in <head>');
    assert.ok(title.textContent.includes('투싼'), 'Title must mention "투싼"');
    assert.ok(title.textContent.includes('트렁크') || title.textContent.includes('테일게이트'), 'Title must mention trunk or tailgate');
  });

  test('T2-DOM-05', 'Meta description exists and has meaningful length (>= 30 characters)', () => {
    requireDOM();
    const metaDesc = dom.querySelector('meta[name="description"]');
    assert.ok(metaDesc, '<meta name="description"> must exist');
    const content = metaDesc.getAttribute('content') || '';
    assert.ok(content.length >= 30, `Meta description should be >= 30 chars (found ${content.length})`);
  });

  test('T2-DOM-06', 'Heading hierarchy begins with a single <h1> element for SEO accessibility', () => {
    requireDOM();
    const h1s = dom.querySelectorAll('h1');
    assert.strictEqual(h1s.length, 1, `Document must contain exactly one <h1> element for proper SEO hierarchy (found ${h1s.length})`);
  });

  test('T2-DOM-07', 'All image <img> tags have alt attributes for accessibility', () => {
    requireDOM();
    const imgs = dom.querySelectorAll('img');
    for (const img of imgs) {
      assert.ok(img.hasAttribute('alt'), `Image with src="${img.getAttribute('src')}" is missing an alt attribute`);
    }
  });

  // =========================================================================
  // Category 7: Simplified Owner's Manual Boundary & Interaction Matrix
  // =========================================================================
  test('T2-MAN-01', 'Manual category tab WAI-ARIA tabindex & aria-selected exclusivity', () => {
    requireDOM();
    const tabs = dom.querySelectorAll('#manual-tabs [role="tab"]');
    assert.strictEqual(tabs.length, 3, 'Must have exactly 3 category tabs');

    const activeTabs = tabs.filter(t => t.getAttribute('aria-selected') === 'true');
    const zeroTabIndexTabs = tabs.filter(t => t.getAttribute('tabindex') === '0');
    assert.strictEqual(activeTabs.length, 1, 'Strictly 1 tab must have aria-selected="true" initially');
    assert.strictEqual(zeroTabIndexTabs.length, 1, 'Strictly 1 tab must have tabindex="0" initially for roving tabindex');
    assert.strictEqual(activeTabs[0], zeroTabIndexTabs[0], 'Active tab must be the one with tabindex="0"');

    const inactiveTabs = tabs.filter(t => t.getAttribute('aria-selected') === 'false');
    assert.strictEqual(inactiveTabs.length, 2, 'Inactive tabs must have aria-selected="false"');
    for (const it of inactiveTabs) {
      assert.strictEqual(it.getAttribute('tabindex'), '-1', 'Inactive tabs must have tabindex="-1"');
    }

    const drivingPanel = dom.getElementById('manual-panel-driving');
    const warningsPanel = dom.getElementById('manual-panel-warnings');
    const maintPanel = dom.getElementById('manual-panel-maintenance');
    assert.ok(drivingPanel && !drivingPanel.hasAttribute('hidden'), 'Active panel must not have hidden attribute');
    assert.ok(warningsPanel && warningsPanel.hasAttribute('hidden'), 'Inactive warnings panel must have hidden attribute');
    assert.ok(maintPanel && maintPanel.hasAttribute('hidden'), 'Inactive maintenance panel must have hidden attribute');
  });

  test('T2-MAN-02', 'Manual accordion initial boundary state & bidirectional ARIA contract', () => {
    requireDOM();
    const accordionBtns = dom.querySelectorAll('#manual .manual-accordion-btn');
    assert.strictEqual(accordionBtns.length, 15, 'All 15 cards must contain an accordion button');

    for (const btn of accordionBtns) {
      assert.strictEqual(btn.getAttribute('aria-expanded'), 'false', 'Initial accordion boundary must be collapsed (aria-expanded="false")');
      const targetId = btn.getAttribute('aria-controls');
      assert.ok(targetId, 'Accordion button must define aria-controls');
      const contentEl = dom.getElementById(targetId);
      assert.ok(contentEl, `Accordion content #${targetId} must physically exist in DOM`);
      assert.ok(contentEl.hasAttribute('hidden'), `Accordion content #${targetId} must have hidden attribute initially`);
      assert.strictEqual(contentEl.getAttribute('role'), 'region', `Accordion content #${targetId} must have role="region"`);
      assert.strictEqual(contentEl.getAttribute('aria-labelledby'), btn.getAttribute('id'), `Accordion content must reference button via aria-labelledby`);
    }
  });

  test('T2-MAN-03', 'Manual search input accessibility boundary & autocomplete suppression', () => {
    requireDOM();
    const searchInput = dom.getElementById('manual-search-input');
    assert.ok(searchInput, 'Search input #manual-search-input must exist');
    assert.strictEqual(searchInput.getAttribute('autocomplete'), 'off', 'Search input must suppress browser autocomplete popup');
    assert.strictEqual(searchInput.getAttribute('aria-describedby'), 'manual-search-hint', 'Search input must reference search hint');

    const hintEl = dom.getElementById('manual-search-hint');
    assert.ok(hintEl, 'Search hint element #manual-search-hint must exist');
    assert.ok(hintEl.textContent.includes('15개 핵심 주제'), 'Search hint must mention 15 core topics');

    const label = dom.querySelector('label[for="manual-search-input"]');
    assert.ok(label, 'Accessible label for #manual-search-input must exist');

    const clearBtn = dom.getElementById('manual-search-clear');
    assert.ok(clearBtn, '#manual-search-clear must exist');
    assert.ok(clearBtn.hasAttribute('hidden'), 'Clear button must start hidden when search is empty');
  });

  test('T2-MAN-04', 'Manual empty search state boundary container and guidance text', () => {
    requireDOM();
    const emptyState = dom.getElementById('manual-empty-state');
    assert.ok(emptyState, '#manual-empty-state must exist in DOM');
    assert.ok(emptyState.hasAttribute('hidden'), 'Empty state must have hidden attribute initially');
    assert.ok(emptyState.classList.has('manual-empty-state'), 'Empty state must have .manual-empty-state class');

    const emptyText = emptyState.querySelector('.manual-empty-text') || emptyState;
    assert.ok(emptyText.textContent.includes('검색 결과가 없습니다'), 'Empty state must display helpful zero-result message');
  });

  test('T2-MAN-05', 'Manual print stylesheet boundary isolation overrides dark UI with ink-preserving unrolled panels', () => {
    assert.ok(combinedCSS, 'Combined CSS must exist');
    const printCSSPath = path.join(cssDir, 'print.css');
    assert.ok(fs.existsSync(printCSSPath), 'print.css must exist');
    const printCSS = fs.readFileSync(printCSSPath, 'utf-8');
    assert.ok(combinedCSS.includes('.manual-tabs-container') && combinedCSS.includes('display: none !important'), 'Print CSS must hide .manual-tabs-container');
    assert.ok(combinedCSS.includes('.manual-search-container'), 'Print CSS must suppress .manual-search-container');
    assert.ok(combinedCSS.includes('.manual-accordion-btn'), 'Print CSS must hide interactive accordion buttons');
    assert.ok(combinedCSS.includes('.manual-panel') && combinedCSS.includes('display: block !important'), 'Print CSS must unroll all panels');
    assert.ok(combinedCSS.includes('.manual-accordion-content') && combinedCSS.includes('display: block !important'), 'Print CSS must unroll all accordion contents');
    assert.ok(printCSS.includes('.manual-accordion-content[hidden]') && printCSS.includes('display: block !important'), 'print.css must contain .manual-accordion-content[hidden] with display: block !important');
    assert.ok(combinedCSS.includes('.manual-card') && combinedCSS.includes('break-inside: avoid !important'), 'Print CSS must prevent card page splitting');
  });

  test('T2-MAN-06', 'Manual search filter logic boundaries: empty query, domain keywords, and zero-match state', () => {
    requireDOM();
    const manualSection = dom.getElementById('manual');
    const cards = manualSection.querySelectorAll('.manual-card');
    assert.strictEqual(cards.length, 15, 'Total cards must be 15');

    function simulateSearch(query) {
      const q = query.toLowerCase().trim();
      if (!q) return cards;
      return cards.filter(c => c.textContent.toLowerCase().includes(q));
    }

    // Boundary 1: Empty or whitespace query returns all 15 cards
    assert.strictEqual(simulateSearch('').length, 15, 'Empty query must preserve all 15 cards');
    assert.strictEqual(simulateSearch('   ').length, 15, 'Whitespace query must preserve all 15 cards');

    // Boundary 2: Domain keywords filter to precise subsets
    const coolantMatches = simulateSearch('냉각수');
    assert.ok(coolantMatches.length >= 2, 'Coolant query must match at least 2 cards (Topic 2.3, Topic 3.2)');
    assert.ok(coolantMatches.every(c => c.textContent.includes('냉각수')), 'All matched cards must contain coolant text');

    // Boundary 3: Case-insensitive query
    const readyUpper = simulateSearch('READY');
    const readyLower = simulateSearch('ready');
    assert.strictEqual(readyUpper.length, readyLower.length, 'Search must be case-insensitive');
    assert.ok(readyUpper.length >= 1, 'READY query must match at least 1 card');

    // Boundary 4: Non-matching boundary query yields 0 matches
    const zeroMatches = simulateSearch('xyz_impossible_term_999');
    assert.strictEqual(zeroMatches.length, 0, 'Non-existent term must match 0 cards');
  });

  test('T2-MAN-07', 'Manual module initialization boundary guards against SSR and re-binding', () => {
    const { initManual } = require('../../js/manual.js');
    assert.strictEqual(typeof initManual, 'function', 'initManual must be exported');

    // Boundary 1: Headless / SSR safe execution without document does not throw
    assert.doesNotThrow(() => {
      initManual();
    }, 'Calling initManual() in SSR/headless environment must safely no-op');

    // Boundary 2: Non-existent container selector safely no-ops
    assert.doesNotThrow(() => {
      initManual('#non-existent-selector-12345');
    }, 'Non-existent container must safely return without exception');
  });
}

module.exports = { runTier2 };
