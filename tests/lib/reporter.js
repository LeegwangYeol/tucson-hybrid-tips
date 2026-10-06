/**
 * Multi-Format E2E Test Reporter (Pretty ANSI, TAP 13, JSON)
 */

class Reporter {
  constructor(format = 'pretty') {
    this.format = format;
    this.results = [];
    this.startTime = Date.now();
    this.tierCounts = {
      tier1: { total: 0, passed: 0, failed: 0, pending: 0 },
      tier2: { total: 0, passed: 0, failed: 0, pending: 0 },
      tier3: { total: 0, passed: 0, failed: 0, pending: 0 },
      tier4: { total: 0, passed: 0, failed: 0, pending: 0 }
    };
  }

  addResult(result) {
    // result: { tier: 'tier1', id: 'T1-F01-01', name: '...', status: 'PASS'|'FAIL'|'PENDING', error: null, expected: ..., actual: ... }
    const durationMs = result.durationMs !== undefined ? result.durationMs : 0;
    const entry = { ...result, durationMs };
    this.results.push(entry);

    const tierKey = entry.tier.toLowerCase();
    if (this.tierCounts[tierKey]) {
      this.tierCounts[tierKey].total++;
      if (entry.status === 'PASS') this.tierCounts[tierKey].passed++;
      else if (entry.status === 'FAIL') this.tierCounts[tierKey].failed++;
      else this.tierCounts[tierKey].pending++;
    }
  }

  generateOutput() {
    const durationTotal = Date.now() - this.startTime;
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const pending = this.results.filter(r => r.status === 'PENDING').length;

    if (this.format === 'json') {
      return JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: {
          total,
          passed,
          failed,
          pending,
          durationMs: durationTotal,
          passRate: total > 0 ? ((passed / total) * 100).toFixed(1) + '%' : '0%'
        },
        tiers: this.tierCounts,
        tests: this.results
      }, null, 2);
    }

    if (this.format === 'tap') {
      let tap = 'TAP version 13\n';
      tap += `1..${total}\n`;
      this.results.forEach((r, idx) => {
        const num = idx + 1;
        if (r.status === 'PASS') {
          tap += `ok ${num} - [${r.tier.toUpperCase()}] ${r.id}: ${r.name}\n`;
        } else if (r.status === 'PENDING') {
          tap += `ok ${num} - [${r.tier.toUpperCase()}] ${r.id}: ${r.name} # TODO Pending implementation\n`;
        } else {
          tap += `not ok ${num} - [${r.tier.toUpperCase()}] ${r.id}: ${r.name}\n`;
          tap += `  ---\n`;
          tap += `  message: ${JSON.stringify(r.error ? r.error.message || String(r.error) : 'Assertion Failed')}\n`;
          if (r.expected !== undefined) tap += `  expected: ${JSON.stringify(r.expected)}\n`;
          if (r.actual !== undefined) tap += `  actual: ${JSON.stringify(r.actual)}\n`;
          tap += `  ...\n`;
        }
      });
      tap += `# tests ${total}\n`;
      tap += `# pass ${passed}\n`;
      tap += `# fail ${failed}\n`;
      if (pending > 0) tap += `# todo ${pending}\n`;
      return tap;
    }

    // Default 'pretty' ANSI console output
    const cyan = '\x1b[36m';
    const green = '\x1b[32m';
    const red = '\x1b[31m';
    const yellow = '\x1b[33m';
    const gray = '\x1b[90m';
    const bold = '\x1b[1m';
    const reset = '\x1b[0m';

    let out = '\n';
    out += `${bold}${cyan}================================================================================${reset}\n`;
    out += `${bold}${cyan}  TUCSON HYBRID TRUNK PREVENTION TIPS - E2E TEST RUNNER${reset}\n`;
    out += `${bold}${cyan}================================================================================${reset}\n\n`;

    let currentTier = '';
    for (const r of this.results) {
      if (r.tier !== currentTier) {
        currentTier = r.tier;
        const tierTitle = currentTier === 'tier1' ? 'TIER 1: FEATURE COVERAGE (12 FEATURES)' :
                          currentTier === 'tier2' ? 'TIER 2: BOUNDARY & CORNER CASES' :
                          currentTier === 'tier3' ? 'TIER 3: CROSS-FEATURE COMBINATIONS' :
                          'TIER 4: REAL-WORLD APPLICATION SCENARIOS';
        out += `\n${bold}${cyan}▶ ${tierTitle}${reset}\n`;
        out += `${gray}--------------------------------------------------------------------------------${reset}\n`;
      }

      let tag;
      if (r.status === 'PASS') tag = `${green}✔ PASS${reset}`;
      else if (r.status === 'PENDING') tag = `${yellow}⧖ PEND${reset}`;
      else tag = `${red}✖ FAIL${reset}`;

      out += `  [${tag}] ${bold}${r.id}${reset}: ${r.name}`;
      if (r.durationMs > 0) out += ` ${gray}(${r.durationMs}ms)${reset}`;
      out += '\n';

      if (r.status === 'FAIL' && r.error) {
        out += `         ${red}Error: ${r.error.message || r.error}${reset}\n`;
        if (r.expected !== undefined && r.actual !== undefined) {
          out += `         ${gray}Expected: ${JSON.stringify(r.expected)} | Actual: ${JSON.stringify(r.actual)}${reset}\n`;
        }
      }
    }

    out += `\n${bold}${cyan}================================================================================${reset}\n`;
    out += `${bold}  TEST EXECUTION SUMMARY${reset}\n`;
    out += `${gray}--------------------------------------------------------------------------------${reset}\n`;
    out += `  Tier 1 (Features):    ${this.tierCounts.tier1.passed} / ${this.tierCounts.tier1.total} passed\n`;
    out += `  Tier 2 (Boundaries):  ${this.tierCounts.tier2.passed} / ${this.tierCounts.tier2.total} passed\n`;
    out += `  Tier 3 (Combination): ${this.tierCounts.tier3.passed} / ${this.tierCounts.tier3.total} passed\n`;
    out += `  Tier 4 (Scenarios):   ${this.tierCounts.tier4.passed} / ${this.tierCounts.tier4.total} passed\n`;
    out += `${gray}--------------------------------------------------------------------------------${reset}\n`;

    const statusBadge = failed === 0 ? `${green}${bold}ALL TESTS PASSED (100%)${reset}` : `${red}${bold}${failed} TESTS FAILED${reset}`;
    out += `  TOTAL: ${bold}${total}${reset} | PASSED: ${green}${passed}${reset} | FAILED: ${failed > 0 ? red : gray}${failed}${reset} | PENDING: ${pending > 0 ? yellow : gray}${pending}${reset} | DURATION: ${durationTotal}ms\n`;
    out += `  STATUS: ${statusBadge}\n`;
    out += `${bold}${cyan}================================================================================${reset}\n\n`;

    return out;
  }
}

module.exports = { Reporter };
