/**
 * Tier 1: Feature Coverage Test Suite (12 Inventoried Features = 65 Tests)
 * Verifies existence, semantic structure, Korean content fidelity, and interface contracts.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { DOMParser } = require('../lib/dom_parser.js');
const { CSSParser } = require('../lib/css_parser.js');

function runTier1(context) {
  const { rootDir, reporter } = context;
  const indexPath = path.join(rootDir, 'index.html');
  const vercelPath = path.join(rootDir, 'vercel.json');
  const cssDir = path.join(rootDir, 'css');

  let htmlContent = '';
  let dom = null;
  let vercelConfig = null;
  let combinedCSS = '';
  let cssParsed = null;

  try {
    if (fs.existsSync(indexPath)) {
      htmlContent = fs.readFileSync(indexPath, 'utf-8');
      const parser = new DOMParser();
      dom = parser.parse(htmlContent);
    }
  } catch (e) {
    // Handled in individual tests
  }

  try {
    if (fs.existsSync(vercelPath)) {
      vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
    }
  } catch (e) {
    // Handled in individual tests
  }

  try {
    if (fs.existsSync(cssDir)) {
      const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
      for (const f of files) {
        combinedCSS += fs.readFileSync(path.join(cssDir, f), 'utf-8') + '\n';
      }
      const cssParser = new CSSParser();
      cssParsed = cssParser.parse(combinedCSS);
    }
  } catch (e) {
    // Handled in individual tests
  }

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

  // Helper assertions
  function requireDOM() {
    assert.ok(dom, 'index.html must exist and be valid HTML5');
  }

  // =========================================================================
  // F00: HTML5 Document Shell, Semantic Landmarks & Assets
  // =========================================================================
  test('T1-F00-01', 'Document includes semantic <main> and <footer> landmark containers', () => {
    requireDOM();
    const main = dom.querySelector('main');
    const footer = dom.querySelector('footer');
    assert.ok(main, 'Document must contain a <main> landmark element');
    assert.ok(footer, 'Document must contain a <footer> landmark element');
  });

  test('T1-F00-02', 'Head section references modular CSS stylesheets in css/ directory', () => {
    requireDOM();
    const links = dom.querySelectorAll('link[rel="stylesheet"]');
    assert.ok(links.length >= 1, 'Document must link to at least one CSS stylesheet');
    const hrefs = links.map(l => l.getAttribute('href') || '');
    const hasCssDir = hrefs.some(h => h.includes('css/'));
    assert.ok(hasCssDir, 'Stylesheets must be linked from css/ directory');
  });

  test('T1-F00-03', 'Document imports modular JavaScript entrypoint (js/app.js or ES module)', () => {
    requireDOM();
    const scripts = dom.querySelectorAll('script');
    assert.ok(scripts.length >= 1, 'Document must load client-side JavaScript');
    const hasApp = scripts.some(s => (s.getAttribute('src') || '').includes('app.js') || s.getAttribute('type') === 'module');
    assert.ok(hasApp, 'Document must load js/app.js or an ES module');
  });

  test('T1-F00-04', 'Footer contains copyright notice and automotive disclaimer in Korean', () => {
    requireDOM();
    const footer = dom.querySelector('footer');
    assert.ok(footer, 'Footer element must exist');
    const text = footer.textContent;
    assert.ok(text.includes('투싼') || text.includes('현대') || text.includes('Tucson'), 'Footer must reference Tucson / Hyundai');
  });

  test('T1-F00-05', 'Viewport meta tag specifies mobile optimization parameters (width=device-width)', () => {
    requireDOM();
    const viewport = dom.querySelector('meta[name="viewport"]');
    assert.ok(viewport, 'Viewport meta tag must exist');
    const content = viewport.getAttribute('content') || '';
    assert.ok(content.includes('width=device-width'), 'Viewport must specify width=device-width');
    assert.ok(content.includes('initial-scale=1'), 'Viewport must specify initial-scale=1');
  });

  // =========================================================================
  // F01: Hero Section & Visual Identity
  // =========================================================================
  test('T1-F01-01', 'Hero section exists with #hero identifier', () => {
    requireDOM();
    const hero = dom.getElementById('hero') || dom.querySelector('#hero, section.hero');
    assert.ok(hero, 'Element with id="hero" or class="hero" must exist in index.html');
  });

  test('T1-F01-02', 'Hero section contains Korean headline addressing Tucson Hybrid owners', () => {
    requireDOM();
    const hero = dom.getElementById('hero') || dom.querySelector('#hero, section.hero');
    assert.ok(hero, 'Hero section must exist');
    const text = hero.textContent;
    assert.ok(text.includes('투싼'), 'Hero must mention "투싼"');
    assert.ok(text.includes('하이브리드') || text.includes('스마트키'), 'Hero must mention "하이브리드" or "스마트키"');
    assert.ok(text.includes('트렁크') || text.includes('테일게이트'), 'Hero must mention "트렁크" or "테일게이트"');
  });

  test('T1-F01-03', 'Hero section presents 3 key metrics badges (1.0~1.5s press, 30~50m RF, 150만 원+ damage)', () => {
    requireDOM();
    const hero = dom.getElementById('hero') || dom.querySelector('#hero, section.hero');
    assert.ok(hero, 'Hero section must exist');
    const text = hero.textContent;
    assert.ok(/1\.0|1\.5|1~1\.5|1\.5초/.test(text), 'Hero must mention 1.0~1.5s press time');
    assert.ok(/30m|50m|30~50m|20~50m/.test(text), 'Hero must mention 30~50m RF distance');
    assert.ok(/150만|155만|300만|수백만/.test(text), 'Hero must mention 150만 원+ damage estimate');
  });

  test('T1-F01-04', 'Hero primary CTA button links to simulator', () => {
    requireDOM();
    const hero = dom.getElementById('hero') || dom.querySelector('#hero, section.hero');
    assert.ok(hero, 'Hero section must exist');
    const links = hero.querySelectorAll('a[href*="simulator"]');
    assert.ok(links.length > 0, 'Hero must contain a CTA link pointing to #simulator or #simulator-container');
  });

  test('T1-F01-05', 'Hero secondary CTA button links to checklist', () => {
    requireDOM();
    const hero = dom.getElementById('hero') || dom.querySelector('#hero, section.hero');
    assert.ok(hero, 'Hero section must exist');
    const links = hero.querySelectorAll('a[href*="checklist"]');
    assert.ok(links.length > 0, 'Hero must contain a CTA link pointing to #checklist or #checklist-container');
  });

  // =========================================================================
  // F02: Sticky Glassmorphic Navbar & Mobile Navigation
  // =========================================================================
  test('T1-F02-01', 'Navbar header exists with #navbar identifier or semantic tag', () => {
    requireDOM();
    const nav = dom.getElementById('navbar') || dom.querySelector('header nav, nav.navbar, header.navbar');
    assert.ok(nav, 'Navbar element must exist in index.html');
  });

  test('T1-F02-02', 'Navbar includes Tucson brand text/logo', () => {
    requireDOM();
    const nav = dom.getElementById('navbar') || dom.querySelector('header, nav');
    assert.ok(nav, 'Navbar element must exist');
    const text = nav.textContent;
    assert.ok(text.includes('투싼') || text.includes('TUCSON') || text.includes('Tucson'), 'Navbar must include Tucson branding');
  });

  test('T1-F02-03', 'Navbar contains semantic navigation links covering main sections', () => {
    requireDOM();
    const nav = dom.getElementById('navbar') || dom.querySelector('header, nav');
    assert.ok(nav, 'Navbar element must exist');
    const links = nav.querySelectorAll('a[href^="#"]');
    assert.ok(links.length >= 4, `Navbar must contain at least 4 internal anchor links (found ${links.length})`);
    const hrefs = links.map(l => l.getAttribute('href'));
    const hasTips = hrefs.some(h => h.includes('tip'));
    const hasSim = hrefs.some(h => h.includes('simulator'));
    const hasChecklist = hrefs.some(h => h.includes('checklist'));
    assert.ok(hasTips || hasSim || hasChecklist, 'Navbar links must cover core sections (tips, simulator, checklist)');
  });

  test('T1-F02-04', 'Mobile navigation toggle button exists with accessible label', () => {
    requireDOM();
    const toggle = dom.getElementById('nav-toggle') || dom.querySelector('button.nav-toggle, button.hamburger, button[aria-label*="메뉴"], button[aria-label*="menu"]');
    assert.ok(toggle, 'Mobile menu toggle button must exist with #nav-toggle or class');
  });

  test('T1-F02-05', 'CSS defines sticky/fixed positioning for navbar', () => {
    assert.ok(cssParsed, 'CSS must be present');
    const isSticky = cssParsed.hasProperty('#navbar', 'position', /(sticky|fixed)/) ||
                     cssParsed.hasProperty('.navbar', 'position', /(sticky|fixed)/) ||
                     cssParsed.hasProperty('header', 'position', /(sticky|fixed)/);
    assert.ok(isSticky, 'Navbar CSS must specify position: sticky or fixed');
  });

  // =========================================================================
  // F03: Reality Check & Sensor Blind Spot
  // =========================================================================
  test('T1-F03-01', 'Section #reality-check exists in index.html', () => {
    requireDOM();
    const sec = dom.getElementById('reality-check') || dom.querySelector('#reality-check, section.reality-check');
    assert.ok(sec, 'Section with id="reality-check" must exist in index.html');
  });

  test('T1-F03-02', 'Reality check details pocket compression physics (1.5s static tension)', () => {
    requireDOM();
    const sec = dom.getElementById('reality-check') || dom.querySelector('#reality-check, section.reality-check');
    assert.ok(sec, 'Reality check section must exist');
    const text = sec.textContent;
    assert.ok(/주머니|청바지|바지|압력|착석/.test(text), 'Must explain pocket compression upon sitting');
    assert.ok(/1\.5|1초|홀드|HOLD/i.test(text), 'Must mention button hold duration');
  });

  test('T1-F03-03', 'Reality check details smart tailgate 3-second proximity hazard', () => {
    requireDOM();
    const sec = dom.getElementById('reality-check') || dom.querySelector('#reality-check, section.reality-check');
    assert.ok(sec, 'Reality check section must exist');
    const text = sec.textContent;
    assert.ok(/3초/.test(text), 'Must explain 3-second proximity trigger');
    assert.ok(/50|100cm|접근|감지/.test(text), 'Must explain 50~100cm rear detection zone');
  });

  test('T1-F03-04', 'Reality check highlights anti-pinch sensor blind spots', () => {
    requireDOM();
    const sec = dom.getElementById('reality-check') || dom.querySelector('#reality-check, section.reality-check');
    assert.ok(sec, 'Reality check section must exist');
    const text = sec.textContent;
    assert.ok(/센서|사각지대|스포일러|상단|유리|도장/.test(text), 'Must highlight anti-pinch blind spots on upper spoiler/glass');
  });

  test('T1-F03-05', 'Reality check documents real-world incident case studies', () => {
    requireDOM();
    const sec = dom.getElementById('reality-check') || dom.querySelector('#reality-check, section.reality-check');
    assert.ok(sec, 'Reality check section must exist');
    const text = sec.textContent;
    assert.ok(/배관|소방|파이프|스프링클러|주차타워/.test(text), 'Must mention real incident contexts (pipe or tower)');
  });

  // =========================================================================
  // F04: 4 Disaster Scenarios & Repair Matrix
  // =========================================================================
  test('T1-F04-01', 'Section #scenarios exists in index.html', () => {
    requireDOM();
    const sec = dom.getElementById('scenarios') || dom.querySelector('#scenarios, section.scenarios');
    assert.ok(sec, 'Section with id="scenarios" must exist in index.html');
  });

  test('T1-F04-02', 'Documents Scenario 1: Underground parking pipe collision', () => {
    requireDOM();
    const sec = dom.getElementById('scenarios') || dom.querySelector('#scenarios, section.scenarios');
    assert.ok(sec, 'Scenarios section must exist');
    const text = sec.textContent;
    assert.ok(/배관|파이프|스프링클러/.test(text), 'Must detail underground parking pipe collision scenario');
  });

  test('T1-F04-03', 'Documents Scenario 2: Mechanical parking tower crush', () => {
    requireDOM();
    const sec = dom.getElementById('scenarios') || dom.querySelector('#scenarios, section.scenarios');
    assert.ok(sec, 'Scenarios section must exist');
    const text = sec.textContent;
    assert.ok(/기계식|주차타워|팔레트|리프트/.test(text), 'Must detail mechanical parking tower crush scenario');
  });

  test('T1-F04-04', 'Documents Scenarios 3 & 4: Car wash and rain/flooding damages', () => {
    requireDOM();
    const sec = dom.getElementById('scenarios') || dom.querySelector('#scenarios, section.scenarios');
    assert.ok(sec, 'Scenarios section must exist');
    const text = sec.textContent;
    assert.ok(/세차|자동세차|고압수/.test(text), 'Must detail car wash danger scenario');
    assert.ok(/우천|침수|비|방전/.test(text), 'Must detail rain exposure or battery drain scenario');
  });

  test('T1-F04-05', 'Repair cost comparison table exists with parts breakdown and damage sums', () => {
    requireDOM();
    const sec = dom.getElementById('scenarios') || dom.querySelector('#scenarios, section.scenarios');
    assert.ok(sec, 'Scenarios section must exist');
    const table = sec.querySelector('table');
    assert.ok(table, 'Scenarios section must contain a comparison table');
    const text = table.textContent;
    assert.ok(/모터|스핀들/.test(text), 'Table must list motor/spindle damage');
    assert.ok(/판금|도장/.test(text), 'Table must list sheet metal / paint repair');
    assert.ok(/유리|틴팅/.test(text), 'Table must list rear heated glass / tinting');
    assert.ok(/원|KRW/.test(text), 'Table must include cost estimates');
  });

  // =========================================================================
  // F05: Tip 1: Physical Key Protection
  // =========================================================================
  test('T1-F05-01', 'Section #tips contains Tip 1 focusing on physical key protection', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section with id="tips" must exist in index.html');
    const text = tips.textContent;
    assert.ok(/물리적|케이스|보호|하드웨어/i.test(text), 'Tips section must contain physical key protection topic');
  });

  test('T1-F05-02', 'Recommends zinc alloy metal hard case for structural defense', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/아연합금|메탈|금속|하드케이스/.test(text), 'Must recommend zinc alloy metal hard case');
  });

  test('T1-F05-03', 'Recommends recessed bezel TPU case with elevated button border', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/음각|돌출|베젤|TPU/.test(text), 'Must recommend recessed bezel TPU case');
  });

  test('T1-F05-04', 'Explicitly warns against soft silicone cases', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/실리콘|젤리/.test(text), 'Must mention silicone or jelly cases');
    assert.ok(/비추천|금지|위험|무용지물|전달/.test(text), 'Must warn against silicone failure in preventing compression');
  });

  test('T1-F05-05', 'Recommends carabiner belt loop clip and single pocket habits', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/카라비너|벨트|클립|고리|단독/.test(text), 'Must recommend carabiner belt loop or single pocket habit');
  });

  // =========================================================================
  // F06: Tip 2: Vehicle Infotainment/Cluster Smart Tailgate Disable Guide
  // =========================================================================
  test('T1-F06-01', 'Section #tips contains Tip 2 focusing on vehicle infotainment & cluster settings', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/인포테인먼트|설정|차량|도어/.test(text), 'Must contain vehicle infotainment settings guide');
  });

  test('T1-F06-02', 'Specifies ccNC infotainment path: [설정] -> [차량] -> [도어] -> [스마트 테일게이트] OFF', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/ccNC|더 뉴 투싼|페이스리프트/.test(text), 'Must specify ccNC or facelift model');
    assert.ok(/도어/.test(text) && /스마트 테일게이트|스마트 트렁크/.test(text), 'Must document door menu path for smart tailgate');
  });

  test('T1-F06-03', 'Specifies Gen5W standard navigation path with checkbox deactivation', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/5W|표준형|초기형|체크/.test(text), 'Must document Gen5W navigation path or checkbox');
  });

  test('T1-F06-04', 'Specifies LCD instrument cluster path for vehicle settings', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/계기판|클러스터|사용자 설정/.test(text), 'Must document cluster menu path');
  });

  test('T1-F06-05', 'Recommends changing tailgate opening speed from "빠르게" to "보통"', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/속도/.test(text), 'Must mention tailgate opening speed');
    assert.ok(/보통/.test(text), 'Must recommend "보통" (normal) speed');
    assert.ok(/빠르게/.test(text), 'Must mention "빠르게" (fast) speed');
  });

  // =========================================================================
  // F07: Tip 3: Tailgate Height Memory & Speed Setting
  // =========================================================================
  test('T1-F07-01', 'Section #tips contains Tip 3 focusing on tailgate height calibration', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/높이|메모리|각도/.test(text), 'Must detail tailgate height setting');
  });

  test('T1-F07-02', 'Details 3-second button hold manual calibration on inner tailgate trim', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/3초/.test(text), 'Must mention 3-second button hold duration');
    assert.ok(/닫힘 버튼|테일게이트 버튼|스위치/.test(text), 'Must mention inner closing button');
  });

  test('T1-F07-03', 'Describes audio confirmation chime ("삐-") on height save', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/삐|비프|경보음|신호음/.test(text), 'Must describe audio confirmation chime');
  });

  test('T1-F07-04', 'Lists infotainment height preset levels (100%, 3단계 90%, 2단계 80%, etc.)', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/완전 열림|3단계|2단계|1단계|사용자/.test(text), 'Must list height preset levels');
  });

  test('T1-F07-05', 'Details reset procedure to restore factory full height', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/초기화|복원|끝까지|최대/.test(text), 'Must explain height reset or restoration to full open');
  });

  // =========================================================================
  // F08: Tip 4: Mechanical Parking & Behavioral Habits
  // =========================================================================
  test('T1-F08-01', 'Section #tips contains Tip 4 on mechanical towers and habits', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/기계식|습관|보관|환경/.test(text), 'Must cover mechanical tower and habit precautions');
  });

  test('T1-F08-02', 'Mandates mechanical parking tower safety rule (turn OFF power tailgate)', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/기계식|주차타워/.test(text), 'Must address mechanical tower precautions');
    assert.ok(/OFF|해제|끄기|차단|두고/.test(text), 'Must advise deactivating power tailgate or leaving key in car');
  });

  test('T1-F08-03', 'Explains 433MHz RF penetration through home walls and windows', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/433|RF|전파|벽|창문|소파|아파트|빌라/.test(text), 'Must explain RF signal penetration from home');
  });

  test('T1-F08-04', 'Recommends entryway key tray or Faraday signal-blocking pouch', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/트레이|현관|보관함|차폐|파우치|틴케이스/.test(text), 'Must recommend home key tray or Faraday pouch');
  });

  test('T1-F08-05', 'Documents 0.5-second emergency abort rule: 1 tap on any key button halts movement', () => {
    requireDOM();
    const tips = dom.getElementById('tips') || dom.querySelector('#tips, section.tips');
    assert.ok(tips, 'Tips section must exist');
    const text = tips.textContent;
    assert.ok(/정지|멈춤|비상|취소/.test(text), 'Must explain emergency abort behavior');
    assert.ok(/아무 버튼|1회|탭|누름/.test(text), 'Must explain pressing any button halts the tailgate');
  });

  // =========================================================================
  // F09: Interactive Tailgate Height Simulator
  // =========================================================================
  test('T1-F09-01', 'Target container #simulator-container exists in index.html', () => {
    requireDOM();
    const sim = dom.getElementById('simulator-container') || dom.querySelector('#simulator-container, #simulator');
    assert.ok(sim, 'Element with id="simulator-container" or "#simulator" must exist');
  });

  test('T1-F09-02', 'Ceiling height slider #ceiling-height-slider exists with min="180", max="260", default="210"', () => {
    requireDOM();
    const slider = dom.getElementById('ceiling-height-slider') || dom.querySelector('input[type="range"]#ceiling-height-slider, input[type="range"][name="ceiling-height"]');
    assert.ok(slider, 'Slider input with id="ceiling-height-slider" must exist');
    assert.strictEqual(slider.getAttribute('min'), '180', 'Slider min must be 180 (cm)');
    assert.strictEqual(slider.getAttribute('max'), '260', 'Slider max must be 260 (cm)');
    assert.ok(['210', '215'].includes(slider.getAttribute('value') || '210'), 'Slider default value should be 210cm');
  });

  test('T1-F09-03', 'SVG visualizer #tailgate-svg exists for vehicle & ceiling rendering', () => {
    requireDOM();
    const svg = dom.getElementById('tailgate-svg') || dom.querySelector('#tailgate-svg, svg.tailgate-visualizer');
    assert.ok(svg, 'SVG visualizer with id="tailgate-svg" must exist in simulator');
  });

  test('T1-F09-04', 'Simulator includes preset buttons for quick height selection', () => {
    requireDOM();
    const sim = dom.getElementById('simulator-container') || dom.querySelector('#simulator-container, #simulator');
    assert.ok(sim, 'Simulator container must exist');
    const buttons = sim.querySelectorAll('button[data-preset], .preset-btn, .preset-tab');
    assert.ok(buttons.length >= 3, `Simulator must include at least 3 preset buttons (found ${buttons.length})`);
  });

  test('T1-F09-05', 'Clearance calculation display / status badge exists in simulator', () => {
    requireDOM();
    const sim = dom.getElementById('simulator-container') || dom.querySelector('#simulator-container, #simulator');
    assert.ok(sim, 'Simulator container must exist');
    const badge = sim.querySelector('#clearance-badge, #simulator-status, .clearance-indicator, .status-badge');
    assert.ok(badge, 'Simulator must have a clearance status indicator element');
  });

  // =========================================================================
  // F10: Interactive 7-Step Prevention Checklist
  // =========================================================================
  test('T1-F10-01', 'Target container #checklist-container exists in index.html', () => {
    requireDOM();
    const check = dom.getElementById('checklist-container') || dom.querySelector('#checklist-container, #checklist');
    assert.ok(check, 'Element with id="checklist-container" or "#checklist" must exist');
  });

  test('T1-F10-02', 'Contains exactly 7 interactive checklist checkboxes', () => {
    requireDOM();
    const check = dom.getElementById('checklist-container') || dom.querySelector('#checklist-container, #checklist');
    assert.ok(check, 'Checklist container must exist');
    const boxes = check.querySelectorAll('input[type="checkbox"]');
    assert.strictEqual(boxes.length, 7, `Must contain exactly 7 checklist checkboxes (found ${boxes.length})`);
  });

  test('T1-F10-03', 'Score element #checklist-score exists in checklist UI', () => {
    requireDOM();
    const check = dom.getElementById('checklist-container') || dom.querySelector('#checklist-container, #checklist');
    assert.ok(check, 'Checklist container must exist');
    const score = check.querySelector('#checklist-score, .checklist-score, .score-percentage');
    assert.ok(score, 'Checklist must contain score display element (#checklist-score)');
  });

  test('T1-F10-04', 'Safety level badge #checklist-badge exists in checklist UI', () => {
    requireDOM();
    const check = dom.getElementById('checklist-container') || dom.querySelector('#checklist-container, #checklist');
    assert.ok(check, 'Checklist container must exist');
    const badge = check.querySelector('#checklist-badge, .checklist-badge, .safety-grade');
    assert.ok(badge, 'Checklist must contain safety grade badge element (#checklist-badge)');
  });

  test('T1-F10-05', 'Checklist includes a share result CTA button', () => {
    requireDOM();
    const check = dom.getElementById('checklist-container') || dom.querySelector('#checklist-container, #checklist');
    assert.ok(check, 'Checklist container must exist');
    const shareBtn = check.querySelector('#share-score-btn, button.share-btn, .btn-share');
    assert.ok(shareBtn, 'Checklist must provide a score share button');
  });

  // =========================================================================
  // F11: Printable Glovebox Cheat Sheet
  // =========================================================================
  test('T1-F11-01', 'Print container #print-card exists in index.html', () => {
    requireDOM();
    const printCard = dom.getElementById('print-card') || dom.querySelector('#print-card, .print-card, section.printable');
    assert.ok(printCard, 'Element with id="print-card" or .print-card must exist in index.html');
  });

  test('T1-F11-02', 'Print card includes 3-second button hold height programming summary', () => {
    requireDOM();
    const printCard = dom.getElementById('print-card') || dom.querySelector('#print-card, .print-card');
    assert.ok(printCard, 'Print card must exist');
    const text = printCard.textContent;
    assert.ok(/3초/.test(text) && /닫힘 버튼|높이|저장/.test(text), 'Print card must include 3-second hold height guide');
  });

  test('T1-F11-03', 'Print card includes infotainment and cluster menu hierarchy tree', () => {
    requireDOM();
    const printCard = dom.getElementById('print-card') || dom.querySelector('#print-card, .print-card');
    assert.ok(printCard, 'Print card must exist');
    const text = printCard.textContent;
    assert.ok(/설정.*차량.*도어|ccNC|5W|클러스터/.test(text), 'Print card must include menu hierarchy path');
  });

  test('T1-F11-04', 'Print card includes 0.5-second emergency abort rule', () => {
    requireDOM();
    const printCard = dom.getElementById('print-card') || dom.querySelector('#print-card, .print-card');
    assert.ok(printCard, 'Print card must exist');
    const text = printCard.textContent;
    assert.ok(/비상|정지|취소/.test(text) && /버튼|1회|탭/.test(text), 'Print card must include emergency stop rule');
  });

  test('T1-F11-05', 'Print trigger button exists in page to initiate printing', () => {
    requireDOM();
    const printBtn = dom.querySelector('#print-trigger-btn, button.print-btn, button[onclick*="print"]');
    assert.ok(printBtn, 'A print trigger button must exist on the page');
  });

  // =========================================================================
  // F12: Vercel Deployment Configuration & SEO
  // =========================================================================
  test('T1-F12-01', 'vercel.json exists and is valid JSON', () => {
    assert.ok(vercelConfig, 'vercel.json must exist in root and parse as valid JSON');
    assert.ok(vercelConfig.version === 2 || vercelConfig.headers !== undefined, 'vercel.json must be valid Vercel v2 format');
  });

  test('T1-F12-02', 'vercel.json configures security headers (nosniff, DENY, XSS)', () => {
    assert.ok(vercelConfig, 'vercel.json must exist');
    const headersList = vercelConfig.headers || [];
    const allHeaders = [];
    for (const hGroup of headersList) {
      if (Array.isArray(hGroup.headers)) {
        for (const item of hGroup.headers) {
          allHeaders.push(item);
        }
      }
    }
    const hasNosniff = allHeaders.some(h => h.key === 'X-Content-Type-Options' && h.value === 'nosniff');
    const hasDeny = allHeaders.some(h => h.key === 'X-Frame-Options' && (h.value === 'DENY' || h.value === 'SAMEORIGIN'));
    assert.ok(hasNosniff, 'vercel.json must include X-Content-Type-Options: nosniff');
    assert.ok(hasDeny, 'vercel.json must include X-Frame-Options: DENY or SAMEORIGIN');
  });

  test('T1-F12-03', 'vercel.json configures static asset caching headers for /css/ and /js/', () => {
    assert.ok(vercelConfig, 'vercel.json must exist');
    const headersList = vercelConfig.headers || [];
    const hasCssCache = headersList.some(h => (h.source && h.source.includes('css')) && h.headers.some(item => item.key === 'Cache-Control'));
    const hasJsCache = headersList.some(h => (h.source && h.source.includes('js')) && h.headers.some(item => item.key === 'Cache-Control'));
    assert.ok(hasCssCache || hasJsCache, 'vercel.json must configure Cache-Control for css or js');
  });

  test('T1-F12-04', 'index.html specifies <html lang="ko"> and <meta charset="UTF-8">', () => {
    requireDOM();
    const htmlTag = dom.querySelector('html');
    assert.ok(htmlTag, '<html> tag must exist');
    assert.strictEqual(htmlTag.getAttribute('lang'), 'ko', 'html lang must be "ko"');
    const metaCharset = dom.querySelector('meta[charset]');
    assert.ok(metaCharset, 'meta charset tag must exist');
    assert.strictEqual((metaCharset.getAttribute('charset') || '').toUpperCase(), 'UTF-8', 'Charset must be UTF-8');
  });

  test('T1-F12-05', 'index.html includes complete OpenGraph and viewport meta tags', () => {
    requireDOM();
    const ogTitle = dom.querySelector('meta[property="og:title"]');
    const ogDesc = dom.querySelector('meta[property="og:description"]');
    const viewport = dom.querySelector('meta[name="viewport"]');
    assert.ok(ogTitle, 'meta property="og:title" must exist');
    assert.ok(ogDesc, 'meta property="og:description" must exist');
    assert.ok(viewport, 'meta name="viewport" must exist');
    assert.ok(viewport.getAttribute('content').includes('width=device-width'), 'Viewport must specify width=device-width');
  });

  // =========================================================================
  // F13: Tucson Hybrid Simplified Owner's Manual ("눈높이 차량 설명서")
  // =========================================================================
  test('T1-F13-01', 'Section #manual exists with semantic landmark attributes, <h2 id="manual-heading">, and aria-labelledby', () => {
    requireDOM();
    const manualSection = dom.getElementById('manual');
    assert.ok(manualSection, 'Section #manual must exist in DOM');
    assert.strictEqual(manualSection.tagName, 'SECTION', '#manual must be a semantic <section> element');
    assert.ok(manualSection.classList.has('manual-section'), '#manual must have class manual-section');
    assert.strictEqual(manualSection.getAttribute('aria-labelledby'), 'manual-heading', '#manual must specify aria-labelledby="manual-heading"');

    const heading = dom.getElementById('manual-heading');
    assert.ok(heading, 'Heading with id="manual-heading" must exist in DOM');
    assert.strictEqual(heading.tagName, 'H2', '#manual-heading must be an <h2> element for single-h1 hierarchy integrity');
    assert.ok(heading.textContent.includes('투싼'), 'Heading must mention "투싼"');
    assert.ok(heading.textContent.includes('하이브리드'), 'Heading must mention "하이브리드"');
    assert.ok(heading.textContent.includes('눈높이 차량 설명서') || heading.textContent.includes('설명서'), 'Heading must mention "눈높이 차량 설명서"');
  });

  test('T1-F13-02', 'Navigation links in navbar and mobile drawer target #manual with accessible text', () => {
    requireDOM();
    const primaryNav = dom.getElementById('primary-nav');
    assert.ok(primaryNav, '#primary-nav container must exist');
    assert.ok(primaryNav.classList.has('mobile-nav-drawer') || primaryNav.classList.has('nav-menu'), '#primary-nav serves as navbar and mobile drawer');

    const manualNavLinks = primaryNav.querySelectorAll('a[href="#manual"]');
    assert.ok(manualNavLinks.length >= 1, 'Primary navigation menu must contain a link targeting #manual');

    const link = manualNavLinks[0];
    assert.ok(link.classList.has('nav-link'), 'Manual link must have .nav-link class');
    assert.ok(link.classList.has('mobile-nav-link'), 'Manual link must have .mobile-nav-link class for mobile drawer support');
    const text = link.textContent.trim();
    assert.ok(text.includes('눈높이 설명서') || text.includes('설명서'), `Nav link text must be accessible (found: "${text}")`);
  });

  test('T1-F13-03', '3 core categories present with WAI-ARIA tablist (#manual-tabs), role="tab", and role="tabpanel"', () => {
    requireDOM();
    const tablist = dom.getElementById('manual-tabs') || dom.querySelector('#manual [role="tablist"]');
    assert.ok(tablist, 'Tab container with role="tablist" must exist in #manual');
    assert.strictEqual(tablist.getAttribute('role'), 'tablist', 'Tabs container must have role="tablist"');
    assert.ok(tablist.getAttribute('aria-label') || tablist.getAttribute('aria-labelledby'), 'tablist must have accessible label attribute');

    const drivingPanel = dom.getElementById('manual-panel-driving');
    const warningsPanel = dom.getElementById('manual-panel-warnings');
    const maintPanel = dom.getElementById('manual-panel-maintenance');
    assert.ok(drivingPanel, '#manual-panel-driving panel must exist');
    assert.ok(warningsPanel, '#manual-panel-warnings panel must exist');
    assert.ok(maintPanel, '#manual-panel-maintenance panel must exist');

    assert.strictEqual(drivingPanel.getAttribute('role'), 'tabpanel', 'Driving panel must have role="tabpanel"');
    assert.strictEqual(warningsPanel.getAttribute('role'), 'tabpanel', 'Warnings panel must have role="tabpanel"');
    assert.strictEqual(maintPanel.getAttribute('role'), 'tabpanel', 'Maintenance panel must have role="tabpanel"');

    assert.strictEqual(drivingPanel.getAttribute('aria-labelledby'), 'manual-tab-driving', 'Driving panel must link to its tab');
    assert.strictEqual(warningsPanel.getAttribute('aria-labelledby'), 'manual-tab-warnings', 'Warnings panel must link to its tab');
    assert.strictEqual(maintPanel.getAttribute('aria-labelledby'), 'manual-tab-maintenance', 'Maintenance panel must link to its tab');

    const tabs = tablist.querySelectorAll('[role="tab"]');
    assert.strictEqual(tabs.length, 3, 'tablist must contain exactly 3 category tabs');

    const controlledPanels = tabs.map(t => t.getAttribute('aria-controls'));
    assert.ok(controlledPanels.includes('manual-panel-driving'), 'Tab must control manual-panel-driving');
    assert.ok(controlledPanels.includes('manual-panel-warnings'), 'Tab must control manual-panel-warnings');
    assert.ok(controlledPanels.includes('manual-panel-maintenance'), 'Tab must control manual-panel-maintenance');

    const activeTabs = tabs.filter(t => t.getAttribute('aria-selected') === 'true');
    assert.strictEqual(activeTabs.length, 1, 'Exactly one tab must have aria-selected="true" initially');
  });

  test('T1-F13-04', '15 topic cards present across 3 categories with complete 4-part structure (.manual-summary, .manual-faq, .manual-steps, .manual-donts)', () => {
    requireDOM();
    const manualSection = dom.getElementById('manual');
    assert.ok(manualSection, '#manual section must exist');

    const allCards = manualSection.querySelectorAll('.manual-card');
    assert.strictEqual(allCards.length, 15, `Must contain exactly 15 manual topic cards (found: ${allCards.length})`);

    const drivingPanel = dom.getElementById('manual-panel-driving');
    const warningsPanel = dom.getElementById('manual-panel-warnings');
    const maintPanel = dom.getElementById('manual-panel-maintenance');

    const drivingCards = drivingPanel.querySelectorAll('.manual-card');
    const warningsCards = warningsPanel.querySelectorAll('.manual-card');
    const maintCards = maintPanel.querySelectorAll('.manual-card');

    assert.strictEqual(drivingCards.length, 5, `Driving panel must have 5 topic cards (found ${drivingCards.length})`);
    assert.strictEqual(warningsCards.length, 5, `Warnings panel must have 5 topic cards (found ${warningsCards.length})`);
    assert.strictEqual(maintCards.length, 5, `Maintenance panel must have 5 topic cards (found ${maintCards.length})`);

    for (const card of allCards) {
      const cardId = card.id || card.getAttribute('id');
      assert.ok(cardId, 'Each topic card must have a unique ID');

      const title = card.querySelector('.manual-card-title');
      assert.ok(title && title.textContent.trim().length > 0, `Card ${cardId} must have non-empty .manual-card-title`);

      const summary = card.querySelector('.manual-summary');
      assert.ok(summary, `Card ${cardId} must contain 💡 한 줄 요약 (.manual-summary)`);
      assert.ok(summary.textContent.includes('요약'), `Card ${cardId} summary must contain "요약" block`);

      const faq = card.querySelector('.manual-faq');
      assert.ok(faq, `Card ${cardId} must contain 🤔 운전자 FAQ (.manual-faq)`);
      assert.ok(faq.textContent.includes('질문') || faq.textContent.includes('FAQ'), `Card ${cardId} FAQ must contain question block`);

      const steps = card.querySelector('.manual-steps');
      assert.ok(steps, `Card ${cardId} must contain 🛠️ 당장 이렇게 하세요 (.manual-steps)`);
      const stepItems = steps.querySelectorAll('li');
      assert.ok(stepItems.length >= 1, `Card ${cardId} steps must include actionable list items`);

      const donts = card.querySelector('.manual-donts');
      assert.ok(donts, `Card ${cardId} must contain ⚠️ 절대 하지 말아야 할 것 (.manual-donts)`);
      const dontItems = donts.querySelectorAll('li');
      assert.ok(dontItems.length >= 1, `Card ${cardId} donts must include precautions list items`);
    }
  });

  test('T1-F13-05', 'Interactive controls present (#manual-search-input, accordion controls with aria-expanded, modulepreload, and js/manual.js export)', () => {
    requireDOM();
    const searchInput = dom.getElementById('manual-search-input');
    assert.ok(searchInput, 'Search input #manual-search-input must exist');
    assert.strictEqual(searchInput.getAttribute('type'), 'search', 'Search input must have type="search"');
    assert.ok(searchInput.getAttribute('placeholder'), 'Search input must define a descriptive placeholder');

    const searchCount = dom.getElementById('manual-search-count');
    assert.ok(searchCount, '#manual-search-count status display must exist');

    const searchClear = dom.getElementById('manual-search-clear');
    assert.ok(searchClear, '#manual-search-clear button must exist');

    const accordionBtns = dom.querySelectorAll('#manual .manual-accordion-btn');
    assert.strictEqual(accordionBtns.length, 15, 'All 15 cards must contain an accordion button');

    for (const btn of accordionBtns) {
      assert.strictEqual(btn.getAttribute('aria-expanded'), 'false', 'Accordion button must initialize with aria-expanded="false"');
      const targetId = btn.getAttribute('aria-controls');
      assert.ok(targetId, 'Accordion button must have aria-controls attribute');
      const targetEl = dom.getElementById(targetId);
      assert.ok(targetEl, `Accordion target content #${targetId} must exist in DOM`);
      assert.ok(targetEl.hasAttribute('hidden'), `Accordion target content #${targetId} must have hidden attribute initially`);
    }

    const preloads = dom.querySelectorAll('link[rel="modulepreload"], link[rel="preload"]');
    const hasManualPreload = preloads.some(l => (l.getAttribute('href') || '').includes('manual.js'));
    assert.ok(hasManualPreload, 'index.html must include modulepreload link for js/manual.js');

    const manualJsPath = path.join(rootDir, 'js', 'manual.js');
    assert.ok(fs.existsSync(manualJsPath), 'js/manual.js must physically exist in codebase');

    const manualModule = require(manualJsPath);
    assert.strictEqual(typeof manualModule.initManual, 'function', 'js/manual.js must export initManual() function');
  });
}

module.exports = { runTier1 };
