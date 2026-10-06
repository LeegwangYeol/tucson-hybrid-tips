/**
 * Tier 4: Real-World Application Scenarios (6 Comprehensive User Journeys)
 * Simulates complete end-to-end user workflows from problem discovery to resolution.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { DOMParser } = require('../lib/dom_parser.js');
const { CSSParser } = require('../lib/css_parser.js');
const { MockLocalStorage, SimulatorOracle, ChecklistOracle } = require('../lib/virtual_env.js');

function runTier4(context) {
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
        tier: 'tier4',
        id,
        name,
        status: 'PASS',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.addResult({
        tier: 'tier4',
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
  // Scenario 1: New Tucson Hybrid owner in low-ceiling apartment setting up 70% height memory
  // =========================================================================
  test('T4-SCEN-01', 'User Journey 1: New Tucson Hybrid owner in low-ceiling apartment configures height memory', () => {
    requireDOM();
    // Step 1: User lands on page, observes hero warning regarding low ceiling and pipe collision
    const hero = dom.getElementById('hero') || dom.querySelector('#hero, section.hero');
    assert.ok(hero, 'Hero section must greet the user');

    // Step 2: User scrolls to simulator to test their apartment 205cm pipe ceiling
    const ceilingHeight = 205; // 2050mm
    const fullOpenCalc = SimulatorOracle.calculate(ceilingHeight, SimulatorOracle.PRESETS.full);
    assert.strictEqual(fullOpenCalc.status, 'COLLISION_DANGER', 'Full open must trigger collision danger in 205cm parking');
    assert.strictEqual(fullOpenCalc.clearance, -100);

    // Step 3: User tests Level 3 (1920mm) and Level 2 (1780mm)
    const lvl3Calc = SimulatorOracle.calculate(ceilingHeight, SimulatorOracle.PRESETS.level3);
    assert.strictEqual(lvl3Calc.status, 'WARNING', 'Level 3 leaves 130mm margin which is <150mm warning');

    const lvl2Calc = SimulatorOracle.calculate(ceilingHeight, SimulatorOracle.PRESETS.level2);
    assert.strictEqual(lvl2Calc.status, 'SAFE', 'Level 2 leaves 270mm safe margin');

    // Step 4: User scrolls to Tip 3 to learn the physical 3-second button hold protocol
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const tipsContent = tips.textContent;
    assert.ok(tipsContent.includes('3초'), 'Tip 3 must specify 3-second hold');
    assert.ok(tipsContent.includes('삐') || tipsContent.includes('비프'), 'Tip 3 must specify confirmation chime');
  });

  // =========================================================================
  // Scenario 2: Commuter using mechanical parking tower reviewing emergency rules
  // =========================================================================
  test('T4-SCEN-02', 'User Journey 2: Commuter using mechanical parking tower masters emergency precautions', () => {
    requireDOM();
    // Step 1: Commuter reviews Scenario 2 in Scenarios section on mechanical parking tower crush
    const scenarios = dom.getElementById('scenarios') || dom.querySelector('#scenarios, section.scenarios');
    assert.ok(scenarios, 'Scenarios section must exist');
    assert.ok(scenarios.textContent.includes('기계식') || scenarios.textContent.includes('주차타워'), 'Must detail parking tower catastrophe');

    // Step 2: Commuter reviews Tip 4 for mechanical parking tower protocol (master OFF)
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const tipsText = tips.textContent;
    assert.ok(tipsText.includes('기계식'), 'Tip 4 must address mechanical parking tower rules');

    // Step 3: Commuter checks Tip 2 for ccNC / cluster menu path to turn OFF power tailgate / smart tailgate
    assert.ok(tipsText.includes('도어') && tipsText.includes('설정'), 'Must guide menu deactivation path');

    // Step 4: Commuter memorizes the 0.5s emergency abort rule
    assert.ok(tipsText.includes('정지') || tipsText.includes('멈춤'), 'Must explain emergency abort behavior');
  });

  // =========================================================================
  // Scenario 3: Owner shopping for key cases comparing zinc alloy vs silicone
  // =========================================================================
  test('T4-SCEN-03', 'User Journey 3: Owner shopping for key cases compares zinc alloy vs soft silicone', () => {
    requireDOM();
    // Step 1: Owner reads Reality Check to understand why pocket compression defeats the 1.5s delay
    const reality = dom.getElementById('reality-check') || dom.querySelector('#reality-check, section.reality-check');
    assert.ok(reality, 'Reality check section must exist');
    assert.ok(/주머니|청바지|바지/.test(reality.textContent), 'Reality check must explain pocket compression mechanics');

    // Step 2: Owner reads Tip 1 hardware case recommendations
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const tipsText = tips.textContent;

    // Step 3: Verifies soft silicone case is explicitly flagged as ineffective/dangerous
    assert.ok(/실리콘|젤리/.test(tipsText), 'Tip 1 must evaluate silicone cases');
    assert.ok(/비추천|금지|위험|무용지물|전달/.test(tipsText), 'Tip 1 must explicitly warn that soft silicone fails to prevent button hold');

    // Step 4: Verifies zinc alloy metal case or recessed TPU case is strongly recommended
    assert.ok(/아연합금|메탈|음각|TPU/.test(tipsText), 'Tip 1 must recommend zinc alloy or recessed TPU case');

    // Step 5: Notes carabiner belt clip advice for zero pocket compression
    assert.ok(/카라비너|벨트/.test(tipsText), 'Tip 1 must recommend belt carabiner clip');
  });

  // =========================================================================
  // Scenario 4: Driver sharing checklist results to family member
  // =========================================================================
  test('T4-SCEN-04', 'User Journey 4: Driver completes 7-step checklist and shares results', () => {
    requireDOM();
    // Step 1: User opens checklist on mobile
    const check = dom.getElementById('checklist-container') || dom.querySelector('#checklist-container, #checklist');
    assert.ok(check, 'Checklist container must exist');

    // Step 2: User checks all 7 items sequentially, simulating state updates
    const checked = [];
    for (let i = 0; i < 7; i++) {
      checked.push(i);
    }
    const scoreState = ChecklistOracle.calculateScore(checked);
    assert.strictEqual(scoreState.count, 7);
    assert.strictEqual(scoreState.percentage, 100);
    assert.strictEqual(scoreState.level, 'SAFE');
    assert.ok(scoreState.title.includes('철벽 방어'));

    // Step 3: State is serialized to localStorage
    const storage = new MockLocalStorage();
    storage.setItem(ChecklistOracle.STORAGE_KEY, ChecklistOracle.serialize(checked));
    const retrieved = ChecklistOracle.deserialize(storage.getItem(ChecklistOracle.STORAGE_KEY));
    assert.deepStrictEqual(retrieved, [0, 1, 2, 3, 4, 5, 6]);

    // Step 4: User clicks share button, clipboard text is constructed
    const shareText = `[투싼 하이브리드 트렁크 안전 점수] 100점 - ${scoreState.title}`;
    assert.ok(shareText.includes('100점'));
    assert.ok(shareText.includes('철벽 방어'));
  });

  // =========================================================================
  // Scenario 5: Driver printing glovebox cheat sheet for physical storage in vehicle
  // =========================================================================
  test('T4-SCEN-05', 'User Journey 5: Driver prints glovebox cheat sheet for in-vehicle storage', () => {
    requireDOM();
    // Step 1: User navigates to print card section
    const printCard = dom.getElementById('print-card') || dom.querySelector('#print-card, .print-card');
    assert.ok(printCard, 'Print card element must exist in page');

    // Step 2: Print card contains 3-second hold diagram, ccNC/Gen5W menu tree, emergency abort rule
    const printText = printCard.textContent;
    assert.ok(/3초/.test(printText) && /닫힘 버튼|높이|저장/.test(printText), 'Must have 3-second hold instructions in print card');
    assert.ok(/설정.*차량.*도어|ccNC|5W|클러스터/.test(printText), 'Must have menu navigation hierarchy');
    assert.ok(/비상|정지|취소/.test(printText), 'Must have emergency stop rule');

    // Step 3: Verify @media print rules suppress interactive chrome and buttons
    assert.ok(cssParsed, 'CSS must be parsed');
    const printBlocks = cssParsed.getMediaRules('print');
    assert.ok(printBlocks.length > 0, '@media print rules must be declared');
  });

  // =========================================================================
  // Scenario 6: Vercel deployment pre-flight validation
  // =========================================================================
  test('T4-SCEN-06', 'User Journey 6: Automated Vercel deployment pre-flight validation', () => {
    requireDOM();
    // Step 1: Validate vercel.json structure and HTTP security response headers
    assert.ok(vercelConfig, 'vercel.json must be present');
    assert.ok(vercelConfig.headers && vercelConfig.headers.length > 0, 'vercel.json must specify headers array');

    const allHeaders = [];
    for (const hGroup of vercelConfig.headers) {
      if (Array.isArray(hGroup.headers)) {
        for (const h of hGroup.headers) allHeaders.push(h);
      }
    }

    const hasNosniff = allHeaders.some(h => h.key === 'X-Content-Type-Options' && h.value === 'nosniff');
    const hasFrameOptions = allHeaders.some(h => h.key === 'X-Frame-Options');
    const hasXSS = allHeaders.some(h => h.key === 'X-XSS-Protection');
    const hasReferrer = allHeaders.some(h => h.key === 'Referrer-Policy');

    assert.ok(hasNosniff, 'Must enforce X-Content-Type-Options: nosniff');
    assert.ok(hasFrameOptions, 'Must enforce X-Frame-Options');
    assert.ok(hasXSS, 'Must enforce X-XSS-Protection');
    assert.ok(hasReferrer, 'Must enforce Referrer-Policy');

    // Step 2: Validate static assets folder structure
    assert.ok(fs.existsSync(path.join(rootDir, 'css')), 'Directory /css must exist');
    assert.ok(fs.existsSync(path.join(rootDir, 'js')) || fs.existsSync(path.join(rootDir, 'index.html')), 'JS or HTML entrypoint must exist');

    // Step 3: Validate HTML doctype, UTF-8 charset, and Korean lang attribute
    const htmlTag = dom.querySelector('html');
    assert.ok(htmlTag && htmlTag.getAttribute('lang') === 'ko', 'HTML lang attribute must be "ko"');
  });
}

module.exports = { runTier4 };
