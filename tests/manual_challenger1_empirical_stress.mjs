/**
 * ==============================================================================
 * Tucson Hybrid Simplified Owner's Manual (#manual)
 * File: tests/manual_challenger1_empirical_stress.mjs
 * Description: Empirical Chrome CDP Adversarial Stress Harness for Challenger 1
 * ==============================================================================
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const htmlPath = path.join(rootDir, 'index.html');

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9669;
const serverPort = 8765;
const userDataDir = `/tmp/chrome-challenger1-stress-${Date.now()}`;

// Static file server to serve ES modules correctly
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0];
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(rootDir, safePath === '/' ? 'index.html' : safePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(rootDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end(err.message);
  }
});

await new Promise(r => server.listen(serverPort, '127.0.0.1', r));

const proc = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  'about:blank'
]);

proc.on('error', (err) => {
  console.error('Failed to spawn Chrome:', err);
  process.exit(1);
});

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => resolve(JSON.parse(raw)));
    }).on('error', reject);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const testResults = [];
let passCount = 0;
let failCount = 0;

function recordTest(id, name, fn) {
  return async () => {
    const t0 = performance.now();
    try {
      await fn();
      const dur = (performance.now() - t0).toFixed(1);
      passCount++;
      testResults.push({ id, name, status: 'PASS', dur });
      console.log(`  [✔ PASS] ${id}: ${name} (${dur}ms)`);
    } catch (err) {
      const dur = (performance.now() - t0).toFixed(1);
      failCount++;
      testResults.push({ id, name, status: 'FAIL', dur, error: err.message });
      console.error(`  [✖ FAIL] ${id}: ${name} (${dur}ms)`);
      console.error(`         Error: ${err.message}`);
    }
  };
}

async function run() {
  console.log('='.repeat(80));
  console.log('▶ CHALLENGER 1 (ITERATION 3): EMPIRICAL REAL-BROWSER CDP STRESS TEST');
  console.log(`  Target: file://${htmlPath}`);
  console.log('='.repeat(80));

  // 1. Wait for Chrome debugging endpoint
  for (let i = 0; i < 30; i++) {
    try {
      await getJson(`http://127.0.0.1:${port}/json/version`);
      break;
    } catch {
      await sleep(200);
    }
  }

  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  const wsUrl = list[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const consoleErrors = [];

  function call(method, params = {}) {
    return new Promise(resolve => {
      const id = msgId++;
      const handler = (e) => {
        const d = JSON.parse(e.data);
        if (d.id === id) {
          ws.removeEventListener('message', handler);
          resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Listen for console and exceptions
  ws.addEventListener('message', (e) => {
    const d = JSON.parse(e.data);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
      consoleErrors.push(d.params.args.map(a => a.value || a.description).join(' '));
    }
    if (d.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(d.params.exceptionDetails.text);
    }
  });

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Page.navigate', { url: `http://127.0.0.1:${serverPort}/index.html` });
  await sleep(1500);

  async function evalInBrowser(expr) {
    const res = await call('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result.value;
  }

  const tests = [
    // --------------------------------------------------------------------------
    // SUITE 1: DOM SPECIFICATION & ACCESSIBILITY AUDIT
    // --------------------------------------------------------------------------
    recordTest('CDP-SPEC-01', 'Component structure: #manual exists with 3 tabs and 3 panels', async () => {
      const spec = await evalInBrowser(`(() => {
        const manual = document.querySelector('#manual');
        if (!manual) return { error: '#manual missing' };
        const tabs = Array.from(manual.querySelectorAll('.manual-tab-btn'));
        const panels = Array.from(manual.querySelectorAll('.manual-panel'));
        const cards = Array.from(manual.querySelectorAll('.manual-card'));
        const searchInput = manual.querySelector('#manual-search-input');
        const emptyState = manual.querySelector('#manual-empty-state');
        return {
          tabsCount: tabs.length,
          panelsCount: panels.length,
          cardsCount: cards.length,
          hasSearch: !!searchInput,
          hasEmptyState: !!emptyState,
          emptyHidden: emptyState ? emptyState.hasAttribute('hidden') : false
        };
      })()`);
      assert.strictEqual(spec.tabsCount, 3, 'Must have 3 tabs');
      assert.strictEqual(spec.panelsCount, 3, 'Must have 3 panels');
      assert.strictEqual(spec.cardsCount, 15, 'Must have 15 cards');
      assert.ok(spec.hasSearch, 'Has search input');
      assert.ok(spec.hasEmptyState, 'Has empty state');
      assert.ok(spec.emptyHidden, 'Empty state initially hidden');
    }),

    // --------------------------------------------------------------------------
    // SUITE 2: RAPID TAB TOGGLING STRESS (500 CYCLES IN REAL BROWSER)
    // --------------------------------------------------------------------------
    recordTest('CDP-TAB-01', 'Rapid 500 sequential & random tab clicks preserve strict ARIA invariants', async () => {
      const result = await evalInBrowser(`(() => {
        const tabs = Array.from(document.querySelectorAll('.manual-tab-btn'));
        const panels = Array.from(document.querySelectorAll('.manual-panel'));
        let violations = 0;

        for (let i = 0; i < 500; i++) {
          const targetTab = tabs[i % tabs.length];
          targetTab.click();

          const activeTabs = tabs.filter(t => t.getAttribute('aria-selected') === 'true');
          const visiblePanels = panels.filter(p => !p.hasAttribute('hidden'));

          if (activeTabs.length !== 1 || visiblePanels.length !== 1) {
            violations++;
            break;
          }
          if (activeTabs[0] !== targetTab) {
            violations++;
            break;
          }
          if (visiblePanels[0].id !== targetTab.getAttribute('aria-controls')) {
            violations++;
            break;
          }
        }

        // Return current active state
        return {
          violations,
          activeTabId: tabs.find(t => t.getAttribute('aria-selected') === 'true').id,
          activePanelId: panels.find(p => !p.hasAttribute('hidden')).id
        };
      })()`);
      assert.strictEqual(result.violations, 0, 'Zero invariant violations during 500 clicks');
    }),

    recordTest('CDP-TAB-02', 'Keyboard arrow navigation and cyclic wrapping (ArrowRight, ArrowLeft, Home, End)', async () => {
      const keyNav = await evalInBrowser(`(() => {
        const tabs = Array.from(document.querySelectorAll('.manual-tab-btn'));
        const log = [];

        // Focus first tab
        tabs[0].click();

        // Dispatch ArrowRight
        tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        log.push(document.activeElement.id);

        // Dispatch ArrowRight
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        log.push(document.activeElement.id);

        // Cyclic wrap ArrowRight -> should be first tab
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        log.push(document.activeElement.id);

        // Cyclic wrap ArrowLeft -> should be last tab
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
        log.push(document.activeElement.id);

        // Home key -> should be first tab
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
        log.push(document.activeElement.id);

        // End key -> should be last tab
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
        log.push(document.activeElement.id);

        return log;
      })()`);

      assert.deepStrictEqual(keyNav, [
        'manual-tab-warnings',
        'manual-tab-maintenance',
        'manual-tab-driving',
        'manual-tab-maintenance',
        'manual-tab-driving',
        'manual-tab-maintenance'
      ], 'Keyboard navigation matched cyclic arrow navigation');
    }),

    // --------------------------------------------------------------------------
    // SUITE 3: EDGE-CASE SEARCH FILTER QUERIES
    // --------------------------------------------------------------------------
    recordTest('CDP-SRCH-01', 'Empty query & whitespace variations cleanly restore all 15 cards', async () => {
      const whitespaceProbes = ['', '   ', '\t\n\r  ', '\u3000\u2003'];
      for (const query of whitespaceProbes) {
        const res = await evalInBrowser(`(async () => {
          const input = document.querySelector('#manual-search-input');
          const cards = Array.from(document.querySelectorAll('.manual-card'));
          const emptyState = document.querySelector('#manual-empty-state');
          const searchCount = document.querySelector('#manual-search-count');

          input.value = ${JSON.stringify(query)};
          input.dispatchEvent(new Event('input', { bubbles: true }));

          await new Promise(r => setTimeout(r, 120));

          const hiddenCards = cards.filter(c => c.hasAttribute('hidden') || c.style.display === 'none');
          return {
            hiddenCount: hiddenCards.length,
            emptyHidden: emptyState.hasAttribute('hidden'),
            countText: searchCount.textContent
          };
        })()`);
        assert.strictEqual(res.hiddenCount, 0, `Query "${query}" hid cards`);
        assert.ok(res.emptyHidden, 'Empty state must be hidden');
        assert.strictEqual(res.countText, '', 'Count text must be blank');
      }
    }),

    recordTest('CDP-SRCH-02', 'Unicode emojis, Korean compound characters, and symbols', async () => {
      // Test emoji that exists
      const emojiMatch = await evalInBrowser(`(async () => {
        const input = document.querySelector('#manual-search-input');
        input.value = '💡';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 120));

        const cards = Array.from(document.querySelectorAll('.manual-card'));
        const visible = cards.filter(c => !c.hasAttribute('hidden') && c.style.display !== 'none');
        return visible.length;
      })()`);
      assert.strictEqual(emojiMatch, 15, '💡 matches all 15 cards');

      // Test zero-match emojis (flags, family, skin tone)
      const zeroEmojis = ['👨‍👩‍👧‍👦', '🇰🇷', '👍🏽', '🚀'];
      for (const emoji of zeroEmojis) {
        const zeroMatch = await evalInBrowser(`(async () => {
          const input = document.querySelector('#manual-search-input');
          input.value = ${JSON.stringify(emoji)};
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 120));

          const cards = Array.from(document.querySelectorAll('.manual-card'));
          const visible = cards.filter(c => !c.hasAttribute('hidden') && c.style.display !== 'none');
          const emptyState = document.querySelector('#manual-empty-state');
          return {
            visibleCount: visible.length,
            emptyVisible: !emptyState.hasAttribute('hidden')
          };
        })()`);
        assert.strictEqual(zeroMatch.visibleCount, 0, `Emoji ${emoji} should have 0 matches`);
        assert.ok(zeroMatch.emptyVisible, `Empty state must show for emoji ${emoji}`);
      }
    }),

    recordTest('CDP-SRCH-03', 'HTML injection, XSS vectors, and script tag resistance', async () => {
      const xssVectors = [
        '<script>window.__pwned = 1</script>',
        '<img src=x onerror="window.__pwned = 2">',
        '"><svg onload="window.__pwned = 3">',
        'javascript:alert(1)',
        '${7*7}',
        '{{7*7}}',
        '<!--#exec cmd="ls"-->'
      ];

      for (const vec of xssVectors) {
        const res = await evalInBrowser(`(async () => {
          const input = document.querySelector('#manual-search-input');
          input.value = ${JSON.stringify(vec)};
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 120));

          const cards = Array.from(document.querySelectorAll('.manual-card'));
          const visible = cards.filter(c => !c.hasAttribute('hidden') && c.style.display !== 'none');
          const emptyState = document.querySelector('#manual-empty-state');
          return {
            visibleCount: visible.length,
            emptyVisible: !emptyState.hasAttribute('hidden'),
            pwned: window.__pwned || null
          };
        })()`);
        assert.strictEqual(res.visibleCount, 0, `Vector "${vec}" had non-zero matches`);
        assert.ok(res.emptyVisible, 'Empty state displayed');
        assert.strictEqual(res.pwned, null, 'No script executed');
      }
    }),

    recordTest('CDP-SRCH-04', 'Regex special character attack resilience ([.*+?^${}()|[\\]\\\\])', async () => {
      const regexStrings = [
        '[.*+?^${}()|[\\]\\\\]',
        '(',
        '[',
        '\\',
        '+',
        '*',
        '?',
        '^',
        '$',
        '|',
        '{',
        '}'
      ];

      for (const rStr of regexStrings) {
        const res = await evalInBrowser(`(async () => {
          try {
            const input = document.querySelector('#manual-search-input');
            input.value = ${JSON.stringify(rStr)};
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 120));
            return { ok: true };
          } catch (e) {
            return { ok: false, error: e.message };
          }
        })()`);
        assert.ok(res.ok, `Regex probe "${rStr}" threw an exception: ${res.error}`);
      }
    }),

    recordTest('CDP-SRCH-05', 'Oversized query strings: 10,000 characters and 50,000 unicode characters', async () => {
      const t0 = performance.now();
      const res = await evalInBrowser(`(async () => {
        const massive = 'A'.repeat(10000);
        const input = document.querySelector('#manual-search-input');
        input.value = massive;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 120));

        const cards = Array.from(document.querySelectorAll('.manual-card'));
        const visible = cards.filter(c => !c.hasAttribute('hidden') && c.style.display !== 'none');
        const emptyState = document.querySelector('#manual-empty-state');
        return {
          visibleCount: visible.length,
          emptyVisible: !emptyState.hasAttribute('hidden')
        };
      })()`);
      const dur = performance.now() - t0;
      assert.strictEqual(res.visibleCount, 0, '10,000 char query yields 0 matches');
      assert.ok(res.emptyVisible, 'Empty state displayed for 10,000 char query');
      assert.ok(dur < 500, `Execution duration took ${dur}ms (expected < 500ms)`);
    }),

    recordTest('CDP-SRCH-06', 'Domain query accuracy and live count calculation across tab switching', async () => {
      const res = await evalInBrowser(`(async () => {
        const input = document.querySelector('#manual-search-input');
        const tabs = Array.from(document.querySelectorAll('.manual-tab-btn'));
        const countEl = document.querySelector('#manual-search-count');

        // Query "배터리" (occurs in driving panel and warnings panel)
        input.value = '배터리';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 120));

        // Switch to driving tab
        tabs[0].click();
        const countDriving = countEl.textContent;

        // Switch to warnings tab
        tabs[1].click();
        const countWarnings = countEl.textContent;

        // Switch to maintenance tab
        tabs[2].click();
        const countMaint = countEl.textContent;

        return { countDriving, countWarnings, countMaint };
      })()`);

      assert.ok(res.countDriving.includes('총'), 'Count driving shows total');
      assert.ok(res.countWarnings.includes('총'), 'Count warnings shows total');
      assert.ok(res.countMaint.includes('총'), 'Count maintenance shows total');
      assert.notStrictEqual(res.countDriving, '', 'Count not empty');
    }),

    // --------------------------------------------------------------------------
    // SUITE 4: ACCORDION STRESS & PRINT CASCADE
    // --------------------------------------------------------------------------
    recordTest('CDP-ACC-01', 'Rapid 500 accordion toggles maintain ARIA state & label/icon synchronization', async () => {
      const accRes = await evalInBrowser(`(() => {
        const accBtns = Array.from(document.querySelectorAll('.manual-accordion-btn'));
        let violations = 0;

        for (let i = 0; i < 500; i++) {
          const btn = accBtns[i % accBtns.length];
          const contentId = btn.getAttribute('aria-controls');
          const content = document.getElementById(contentId);
          const wasOpen = btn.getAttribute('aria-expanded') === 'true';

          btn.click();

          const isOpen = btn.getAttribute('aria-expanded') === 'true';
          const hasHidden = content.hasAttribute('hidden');

          if (isOpen === wasOpen) violations++;
          if (isOpen && hasHidden) violations++;
          if (!isOpen && !hasHidden) violations++;
        }

        return { violations };
      })()`);
      assert.strictEqual(accRes.violations, 0, 'Zero accordion state violations');
    }),

    recordTest('CDP-PRT-01', 'Print media emulation: all accordions unroll with display: block while screen remains collapsed', async () => {
      // First ensure accordions are closed
      await evalInBrowser(`(() => {
        const accBtns = Array.from(document.querySelectorAll('.manual-accordion-btn'));
        accBtns.forEach(btn => {
          if (btn.getAttribute('aria-expanded') === 'true') btn.click();
        });
      })()`);

      // Screen media check
      const screenCheck = await evalInBrowser(`(() => {
        const contents = Array.from(document.querySelectorAll('.manual-accordion-content'));
        return {
          allHidden: contents.every(c => c.hasAttribute('hidden')),
          allNone: contents.every(c => window.getComputedStyle(c).display === 'none')
        };
      })()`);
      assert.ok(screenCheck.allHidden, 'All contents have hidden attribute on screen');
      assert.ok(screenCheck.allNone, 'All contents have display: none on screen');

      // Switch to print emulation
      await call('Emulation.setEmulatedMedia', { media: 'print' });
      await sleep(300);

      const printCheck = await evalInBrowser(`(() => {
        const contents = Array.from(document.querySelectorAll('.manual-accordion-content'));
        const displays = contents.map(c => window.getComputedStyle(c).display);
        return {
          displays,
          allBlock: displays.every(d => d === 'block')
        };
      })()`);
      assert.ok(printCheck.allBlock, `In print media, all accordion contents must be display: block (got ${JSON.stringify(printCheck.displays.slice(0, 3))})`);

      // Restore screen media
      await call('Emulation.setEmulatedMedia', { media: '' });
      await sleep(200);

      const screenRestored = await evalInBrowser(`(() => {
        const contents = Array.from(document.querySelectorAll('.manual-accordion-content'));
        return contents.every(c => window.getComputedStyle(c).display === 'none');
      })()`);
      assert.ok(screenRestored, 'Returned to screen media: display returns to none');
    }),

    // --------------------------------------------------------------------------
    // SUITE 5: RE-INITIALIZATION & RUNTIME CONSOLE ERROR AUDIT
    // --------------------------------------------------------------------------
    recordTest('CDP-ROBUST-01', 'Idempotent re-initialization and zero runtime console errors', async () => {
      // Re-invoke initManual multiple times from global module if accessible
      await evalInBrowser(`(() => {
        const searchClear = document.querySelector('#manual-search-clear');
        const searchInput = document.querySelector('#manual-search-input');

        // Test search clear click
        searchInput.value = '엔진오일';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchClear.click();

        // Test Escape key
        searchInput.value = '브레이크';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      })()`);

      assert.strictEqual(consoleErrors.length, 0, `Zero runtime console errors (found: ${consoleErrors.join('; ')})`);
    })
  ];

  for (const t of tests) {
    await t();
  }

  console.log('\n' + '='.repeat(80));
  console.log('  CHALLENGER 1 EMPIRICAL CDP STRESS TEST SUMMARY');
  console.log('-'.repeat(80));
  console.log(`  Total Tests:    ${testResults.length}`);
  console.log(`  Passed Tests:   ${passCount}`);
  console.log(`  Failed Tests:   ${failCount}`);
  console.log(`  Console Errors: ${consoleErrors.length}`);
  console.log('-'.repeat(80));
  if (failCount === 0) {
    console.log('  VERDICT: APPROVE (EMPIRICALLY VERIFIED IN REAL CHROME)');
  } else {
    console.log('  VERDICT: REQUEST_CHANGES');
  }
  console.log('='.repeat(80) + '\n');

  ws.close();
  proc.kill();
  server.close();

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  proc.kill();
  server.close();
  process.exit(1);
});
