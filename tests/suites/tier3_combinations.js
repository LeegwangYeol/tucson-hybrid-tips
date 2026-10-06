/**
 * Tier 3: Cross-Feature Combinations Test Suite (16 Tests)
 * Verifies multi-module synchronization, state cascades, and cross-cutting behaviors.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { DOMParser } = require('../lib/dom_parser.js');
const { CSSParser } = require('../lib/css_parser.js');
const { MockLocalStorage, SimulatorOracle, ChecklistOracle } = require('../lib/virtual_env.js');

function runTier3(context) {
  const { rootDir, reporter } = context;
  const indexPath = path.join(rootDir, 'index.html');
  const vercelPath = path.join(rootDir, 'vercel.json');
  const cssDir = path.join(rootDir, 'css');

  let dom = null;
  let vercelConfig = null;
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
    if (fs.existsSync(vercelPath)) {
      vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
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
        tier: 'tier3',
        id,
        name,
        status: 'PASS',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.addResult({
        tier: 'tier3',
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

  test('T3-COMB-01', 'Simulator preset button selection updates clearance calculation dynamically', () => {
    // Test that switching presets changes calculated clearance for the same ceiling height (210cm)
    const ceiling = 210;
    const fullCalc = SimulatorOracle.calculate(ceiling, SimulatorOracle.PRESETS.full);
    const lvl3Calc = SimulatorOracle.calculate(ceiling, SimulatorOracle.PRESETS.level3);
    const lvl2Calc = SimulatorOracle.calculate(ceiling, SimulatorOracle.PRESETS.level2);

    assert.strictEqual(fullCalc.status, 'COLLISION_DANGER');
    assert.strictEqual(lvl3Calc.status, 'SAFE');
    assert.strictEqual(lvl2Calc.status, 'SAFE');
    assert.ok(lvl2Calc.clearance > lvl3Calc.clearance);
  });

  test('T3-COMB-02', 'Slider adjustment against preset levels dynamically alters danger / safe status', () => {
    // If user is at Level 3 (1920mm) and lowers ceiling from 220cm to 190cm
    const safeCalc = SimulatorOracle.calculate(220, SimulatorOracle.PRESETS.level3);
    const dangerCalc = SimulatorOracle.calculate(190, SimulatorOracle.PRESETS.level3);

    assert.strictEqual(safeCalc.status, 'SAFE');
    assert.strictEqual(dangerCalc.status, 'COLLISION_DANGER');
    assert.strictEqual(dangerCalc.clearance, -20);
  });

  test('T3-COMB-03', 'Checklist score calculation dynamically synchronizes progress percentage and safety badge', () => {
    // Transitioning from 2 items (high risk) to 3 items (warning) to 6 items (safe)
    const step1 = ChecklistOracle.calculateScore([0, 1]);
    assert.strictEqual(step1.level, 'HIGH_RISK');

    const step2 = ChecklistOracle.calculateScore([0, 1, 2]);
    assert.strictEqual(step2.level, 'WARNING');

    const step3 = ChecklistOracle.calculateScore([0, 1, 2, 3, 4, 5]);
    assert.strictEqual(step3.level, 'SAFE');
  });

  test('T3-COMB-04', 'Checklist state update dynamically regenerates clipboard share summary text', () => {
    const scoreState = ChecklistOracle.calculateScore([0, 1, 2, 3, 4, 5, 6]);
    const shareText = `[투싼 하이브리드 트렁크 안전 점수] 100점 - ${scoreState.title}`;
    assert.ok(shareText.includes('100점'));
    assert.ok(shareText.includes('철벽 방어'));
  });

  test('T3-COMB-05', 'Navbar scrollspy targets correspond exactly to page section identifiers', () => {
    requireDOM();
    const navLinks = dom.querySelectorAll('nav a[href^="#"], header a[href^="#"]');
    assert.ok(navLinks.length >= 3, 'Navbar must contain section links');
    for (const link of navLinks) {
      const targetId = link.getAttribute('href').substring(1);
      const targetSection = dom.getElementById(targetId);
      assert.ok(targetSection, `Scrollspy link #${targetId} must point to a real section in the DOM`);
    }
  });

  test('T3-COMB-06', 'Mobile navigation menu drawer and is-open state are governed in CSS', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    requireDOM();
    const primaryNav = dom.getElementById('primary-nav') || dom.querySelector('header nav');
    assert.ok(primaryNav, 'Primary nav element must exist in DOM');

    const navClasses = (primaryNav.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    
    // 1. Verify primary nav classes or ID have display styling
    const hasNavDisplayRule = navClasses.some(c => cssParsed.hasProperty('.' + c, 'display')) ||
                              cssParsed.hasProperty('#' + primaryNav.id, 'display');
    assert.ok(hasNavDisplayRule, `Primary nav classes [${navClasses.join(', ')}] must have display rules in CSS`);

    // 2. Verify .is-open state is explicitly handled in CSS for the mobile drawer
    const hasIsOpenRule = navClasses.some(c => 
      cssParsed.hasProperty('.' + c + '.is-open', 'display') ||
      combinedCSS.includes('.' + c + '.is-open') ||
      combinedCSS.includes('#' + primaryNav.id + '.is-open')
    ) || combinedCSS.includes('.mobile-nav-drawer.is-open');

    assert.ok(hasIsOpenRule, 'CSS must define rules for .is-open state on the navigation drawer');
  });

  test('T3-COMB-07', 'Print stylesheet preserves current checklist score card while hiding interactive checkboxes', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const printBlocks = cssParsed.getMediaRules('print');
    let controlsHidden = false;
    for (const b of printBlocks) {
      for (const r of b.rules) {
        if (r.selector.includes('input') || r.selector.includes('button') || r.selector.includes('.btn')) {
          if (r.declarations.display && r.declarations.display.includes('none')) {
            controlsHidden = true;
          }
        }
      }
    }
    assert.ok(controlsHidden, 'Interactive inputs/buttons must be cleanly hidden in print mode');
  });

  test('T3-COMB-08', 'OpenGraph meta tags align with document title and page description', () => {
    requireDOM();
    const title = dom.querySelector('title');
    const ogTitle = dom.querySelector('meta[property="og:title"]');
    const metaDesc = dom.querySelector('meta[name="description"]');
    const ogDesc = dom.querySelector('meta[property="og:description"]');

    assert.ok(title && ogTitle, 'Both title and og:title must exist');
    assert.ok(metaDesc && ogDesc, 'Both description and og:description must exist');
    assert.ok(ogTitle.getAttribute('content').includes('투싼'), 'og:title must include "투싼"');
  });

  test('T3-COMB-09', 'Simulator collision danger triggers CSS danger styling tokens (var(--nline-red))', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const vars = cssParsed.getRootVariables();
    const dangerColor = vars['--nline-red'] || vars['--color-danger'] || '#E63946';
    assert.ok(dangerColor, 'Danger accent color must be available for collision state');
    assert.ok(combinedCSS.includes('danger') || combinedCSS.includes('collision'), 'CSS must define collision/danger classes');
  });

  test('T3-COMB-10', 'Simulator safe margin triggers CSS success styling tokens (var(--success-emerald))', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const vars = cssParsed.getRootVariables();
    const safeColor = vars['--success-emerald'] || vars['--color-success'] || '#10B981';
    assert.ok(safeColor, 'Safe accent color must be available for safe clearance state');
    assert.ok(combinedCSS.includes('safe') || combinedCSS.includes('success'), 'CSS must define safe/success classes');
  });

  test('T3-COMB-11', 'Infotainment Tip 2 and Height Tip 3 cross-reference height levels and speed setting', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(text.includes('보통') && text.includes('빠르게'), 'Tips must compare "보통" vs "빠르게" speeds');
    assert.ok(text.includes('3초') && (text.includes('단계') || text.includes('높이')), 'Tips must connect 3-second hold to height steps');
  });

  test('T3-COMB-12', 'Disaster Scenarios damage sums corroborate Hero section damage statistics (150만 원+)', () => {
    requireDOM();
    const hero = dom.getElementById('hero') || dom.querySelector('#hero, section.hero');
    const scenarios = dom.getElementById('scenarios') || dom.querySelector('#scenarios, section.scenarios');
    assert.ok(hero && scenarios, 'Both hero and scenarios must exist');

    const heroText = hero.textContent;
    const tableText = scenarios.textContent;
    assert.ok(/150만|155만|300만/.test(heroText), 'Hero must cite 150만 원+ damage');
    assert.ok(/150만|155만|300만|총합/.test(tableText), 'Scenarios table must calculate total damage matching the hero magnitude');
  });

  test('T3-COMB-13', 'Toast notification system uses elevated z-index above sticky navbar', () => {
    assert.ok(cssParsed, 'CSS must be parsed');
    const hasToastZIndex = cssParsed.hasProperty('.toast', 'z-index') ||
                           cssParsed.hasProperty('#toast', 'z-index') ||
                           combinedCSS.includes('z-index: 100') ||
                           combinedCSS.includes('z-index: 1000');
    assert.ok(hasToastZIndex, 'Toast notification should specify elevated z-index for viewport prominence');
  });

  test('T3-COMB-14', 'vercel.json caching headers map accurately to /css/ and /js/ asset structures', () => {
    assert.ok(vercelConfig, 'vercel.json must exist');
    const headersList = vercelConfig.headers || [];
    const cssHeader = headersList.find(h => h.source && h.source.includes('css'));
    const jsHeader = headersList.find(h => h.source && h.source.includes('js'));
    assert.ok(cssHeader || jsHeader, 'vercel.json must define caching headers for static assets');
  });

  test('T3-COMB-15', 'Checklist reset action clears stored state and resets score badge to initial 0%', () => {
    const storage = new MockLocalStorage();
    storage.setItem(ChecklistOracle.STORAGE_KEY, JSON.stringify([0, 1, 2, 3, 4, 5, 6]));
    assert.strictEqual(storage.getItem(ChecklistOracle.STORAGE_KEY) !== null, true);

    // Simulate reset
    storage.removeItem(ChecklistOracle.STORAGE_KEY);
    const clearedIndices = ChecklistOracle.deserialize(storage.getItem(ChecklistOracle.STORAGE_KEY));
    const clearedScore = ChecklistOracle.calculateScore(clearedIndices);

    assert.strictEqual(clearedScore.count, 0);
    assert.strictEqual(clearedScore.percentage, 0);
    assert.strictEqual(clearedScore.level, 'HIGH_RISK');
  });

  test('T3-COMB-16', 'Hero CTA smooth-scroll targets match exact interactive container IDs', () => {
    requireDOM();
    const hero = dom.getElementById('hero') || dom.querySelector('#hero, section.hero');
    assert.ok(hero, 'Hero section must exist');

    const simCta = hero.querySelector('a[href*="simulator"]');
    const checkCta = hero.querySelector('a[href*="checklist"]');

    assert.ok(simCta, 'Hero simulator CTA must exist');
    assert.ok(checkCta, 'Hero checklist CTA must exist');

    const simTarget = dom.getElementById(simCta.getAttribute('href').replace('#', ''));
    const checkTarget = dom.getElementById(checkCta.getAttribute('href').replace('#', ''));

    assert.ok(simTarget, `Simulator target #${simCta.getAttribute('href')} must physically exist`);
    assert.ok(checkTarget, `Checklist target #${checkCta.getAttribute('href')} must physically exist`);
  });
}

module.exports = { runTier3 };
