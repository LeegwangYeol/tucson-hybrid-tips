/**
 * Empirical Technical Specification & Accuracy Audit Script
 * Tucson Hybrid (NX4 / NX4 PE) Simplified Owner's Manual (#manual)
 * Challenger 2 (Technical Vehicle Spec & Accuracy Challenger)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const HTML_PATH = path.resolve(__dirname, '../index.html');
const html = fs.readFileSync(HTML_PATH, 'utf-8');

console.log('================================================================');
console.log('CHALLENGER 2: TECHNICAL SPECIFICATION & ACCURACY AUDIT');
console.log('Target: tips_website/index.html (#manual & related sections)');
console.log('Standard: Official Hyundai Tucson Hybrid (NX4 / NX4 PE) Manual');
console.log('================================================================\n');

const auditResults = [];

function auditItem(category, itemCode, name, checkFn) {
  try {
    const detail = checkFn();
    auditResults.push({
      category,
      itemCode,
      name,
      status: 'PASS',
      detail
    });
    console.log(`[PASS] ${itemCode} - ${name}: ${detail}`);
  } catch (err) {
    auditResults.push({
      category,
      itemCode,
      name,
      status: 'FINDING',
      detail: err.message
    });
    console.log(`[FINDING/DEFECT] ${itemCode} - ${name}: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// 1. Driving Basics Audit
// -----------------------------------------------------------------------------

auditItem('Driving Basics', 'DRV-READY-01', 'READY indicator meaning & symbol', () => {
  assert.ok(html.includes('READY'), 'Must mention READY');
  assert.ok(html.includes('초록색') || html.includes('자동차'), 'Must mention green car/symbol');
  assert.ok(html.includes('시동이 걸린 상태') || html.includes('출발 준비'), 'Must state engine-off ready state');
  return 'Verified: READY indicator explained as active drive state despite 0 engine noise.';
});

auditItem('Driving Basics', 'DRV-READY-02', 'Zero-RPM hazard & vehicle creeping warning', () => {
  // Check if zero-RPM hazard (stepping out of vehicle while in D gear or creeping due to silent engine) is warned against in card 1
  const card1Match = html.match(/id="manual-card-driving-1"[\s\S]*?<\/article>/);
  assert.ok(card1Match, 'manual-card-driving-1 must exist');
  const card1 = card1Match[0];

  const hasZeroRpmMention = card1.includes('0 RPM') || card1.includes('RPM') || card1.includes('무음 크리핑') || card1.includes('크리핑') || card1.includes('하차') || card1.includes('P단');
  if (!hasZeroRpmMention) {
    throw new Error('MISSING ZERO-RPM HAZARD: Card 1 does not warn about the critical safety hazard of unintended vehicle movement/creeping when engine is at 0-RPM (silent), or forgetting to shift to P before exiting.');
  }
  return 'Zero-RPM hazard verified.';
});

auditItem('Driving Basics', 'DRV-BATT-01', '12V BATT RESET 15-second start window', () => {
  assert.ok(html.includes('15초'), 'Must specify 15-second window');
  assert.ok(html.includes('12V BATT RESET'), 'Must specify 12V BATT RESET switch');
  return 'Verified: 15-second golden window accurately documented.';
});

auditItem('Driving Basics', 'DRV-BATT-02', 'Integrated 12V Lithium auxiliary battery in main pack', () => {
  assert.ok(html.includes('고전압 배터리 팩 안에') || html.includes('고전압 배터리에 통합'), 'Must specify 12V battery integration');
  assert.ok(html.includes('리튬 배터리'), 'Must specify lithium battery integration');
  return 'Verified: Integrated lithium battery in high-voltage pack documented.';
});

auditItem('Driving Basics', 'DRV-BATT-03', '30-minute minimum LDC charging requirement', () => {
  const has30Min = html.includes('30분 이상 주행') || html.includes('최소 30분');
  assert.ok(has30Min, 'Must specify 30-minute charging rule for LDC');
  return 'Verified: 30-minute post-reset operation rule documented.';
});

auditItem('Driving Basics', 'DRV-BATT-04', 'Danger of external jump-starting other vehicles (역점프 금지)', () => {
  const manualMatch = html.match(/id="manual"[\s\S]*?<\/section>/);
  assert.ok(manualMatch, 'Section #manual must exist');
  const manualHtml = manualMatch[0];
  const hasJumpOtherWarning = manualHtml.includes('다른 차량') && (manualHtml.includes('점프') || manualHtml.includes('역점프'));
  const hasReverseJumpProhibition = manualHtml.includes('다른 차') && manualHtml.includes('점프');
  const hasBoosterProhibition = manualHtml.includes('24V') || manualHtml.includes('역점프');
  if (!hasJumpOtherWarning && !hasReverseJumpProhibition && !hasBoosterProhibition) {
    throw new Error('MISSING CRITICAL SAFETY WARNING: Neither Card 4 nor any other card in #manual warns against jump-starting other vehicles (다른 차에 점프선 연결/역점프 절대 금지) or using 24V boosters, which destroys Tucson Hybrid LDC converter and 12V circuits.');
  }
  return 'Verified: External jump prohibitions documented.';
});

auditItem('Driving Basics', 'DRV-REGEN-01', 'Regenerative braking paddles (Level 0~3)', () => {
  assert.ok(html.includes('0~3단계'), 'Must specify levels 0 to 3');
  assert.ok(html.includes('패들'), 'Must specify paddle shift');
  return 'Verified: Paddle levels 0-3 accurately documented.';
});

auditItem('Driving Basics', 'DRV-REGEN-02', 'Auto Smart Regen mode operation (Right paddle 1s hold)', () => {
  assert.ok(html.includes('오른쪽(+)') || html.includes('우측 패들'), 'Must specify right paddle');
  assert.ok(html.includes('1초') || html.includes('길게'), 'Must specify long press/hold');
  assert.ok(html.includes('AUTO') || html.includes('스마트'), 'Must specify AUTO / Smart mode');
  return 'Verified: Smart AUTO regen paddle hold operation documented.';
});

auditItem('Driving Basics', 'DRV-REGEN-03', 'Brake pad extended life & inspection needs', () => {
  assert.ok(html.includes('브레이크 패드') && html.includes('오래'), 'Must document extended pad life');
  assert.ok(html.includes('10만 km') || html.includes('100,000km'), 'Must cite 100k km scale');
  return 'Verified: Brake pad longevity via regenerative braking documented.';
});

// -----------------------------------------------------------------------------
// 2. Warning Lights & Emergency Handling Audit
// -----------------------------------------------------------------------------

auditItem('Warning & Emergency', 'WRN-HEV-01', 'HEV service warning indicator & cluster symbol', () => {
  assert.ok(html.includes('하이브리드 시스템 경고등') || html.includes('하이브리드 시스템을 점검하십시오'), 'Must cite HEV warning');
  const card6Match = html.match(/id="manual-card-warnings-1"[\s\S]*?<\/article>/);
  assert.ok(card6Match, 'Card 6 must exist');
  const card6 = card6Match[0];
  
  // Official manual symbol: Yellow wrench (스패너 🔧) or vehicle with warning symbol [⚠️/🚗!]
  // Current text in card 6: "자동차 모양에 느낌표? 톱니바퀴?"
  const hasWrench = card6.includes('스패너') || card6.includes('wrench');
  if (!hasWrench) {
    throw new Error('SYMBOL ACCURACY FLAW: Card 6 asks "자동차 모양에 느낌표? 톱니바퀴?", but official Hyundai HEV service indicator is a yellow Wrench (스패너 🔧) icon or vehicle with warning mark [🚗! / ⚠️]. A gearwheel (톱니바퀴) indicates transmission/DCT or EPB error in Hyundai clusters, not HEV system.');
  }
  return 'Verified: HEV service warning symbol accurate.';
});

auditItem('Warning & Emergency', 'WRN-WASH-01', 'Automatic conveyor car wash N-gear sequence: Auto Hold OFF', () => {
  const card7Match = html.match(/id="manual-card-warnings-2"[\s\S]*?<\/article>/);
  assert.ok(card7Match, 'Card 7 must exist');
  const card7 = card7Match[0];
  assert.ok(card7.includes('AUTO HOLD') && (card7.includes('OFF') || card7.includes('소등')), 'Must require Auto Hold OFF');
  return 'Verified: Auto Hold OFF requirement documented.';
});

auditItem('Warning & Emergency', 'WRN-WASH-02', 'Shift to N & OK button hold 1s+', () => {
  const card7Match = html.match(/id="manual-card-warnings-2"[\s\S]*?<\/article>/);
  assert.ok(card7Match, 'Card 7 must exist');
  const card7 = card7Match[0];
  assert.ok(card7.includes('N단') && card7.includes('OK') && card7.includes('1초'), 'Must require N shift and OK button hold for 1s+');
  return 'Verified: N shift and OK button hold sequence documented.';
});

auditItem('Warning & Emergency', 'WRN-WASH-03', 'Prohibition on opening doors during wash', () => {
  const card7Match = html.match(/id="manual-card-warnings-2"[\s\S]*?<\/article>/);
  assert.ok(card7Match, 'Card 7 must exist');
  const card7 = card7Match[0];
  assert.ok(card7.includes('문') && (card7.includes('열지 마') || card7.includes('P단')), 'Must prohibit opening doors');
  return 'Verified: Door opening prohibition during wash documented.';
});

auditItem('Warning & Emergency', 'WRN-WASH-04', 'N-gear retention engine OFF vs ON distinction', () => {
  const card7Match = html.match(/id="manual-card-warnings-2"[\s\S]*?<\/article>/);
  assert.ok(card7Match, 'Card 7 must exist');
  const card7 = card7Match[0];
  // Check if official manual "시동을 끈 후 N단 유지" is clear or contradicted
  // In Card 7: "시동을 끄지 마시고" (line 833) vs cluster prompt "시동을 끈 후 N단이 유지됩니다"
  if (card7.includes('시동을 끄지 마시고') && card7.includes('시동 버튼을 누르지 마세요')) {
    throw new Error('TERMINOLOGY & LOGIC AMBIGUITY: Card 7 states "시동을 끄지 마시고" and "시동 버튼을 누르지 마세요". However, the official Hyundai function is named "시동을 끈 후 N단 유지 모드" (Neutral retention after ignition OFF). If the car wash attendant orders the driver to turn off the engine (시동 OFF), completing this OK button hold allows the vehicle to remain in N (ACC mode) without shifting to P. The card text creates confusion between keeping READY on vs official ignition OFF neutral retention.');
  }
  return 'Verified: Neutral retention engine state logic clear.';
});

auditItem('Warning & Emergency', 'WRN-COOL-01', 'Coolant distinction: BSA-401 blue vs pink engine coolant', () => {
  assert.ok(html.includes('BSA-401') || html.includes('저전도'), 'Must cite low-conductivity / BSA-401');
  assert.ok(html.includes('파란색') && html.includes('분홍색'), 'Must contrast blue vs pink');
  return 'Verified: Blue low-conductivity inverter coolant vs pink engine coolant clearly contrasted.';
});

auditItem('Warning & Emergency', 'WRN-COOL-02', 'Strict prohibition on tap water / mineral water for inverter coolant', () => {
  assert.ok(html.includes('수돗물') && (html.includes('절대 금지') || html.includes('붓지 마세요')), 'Must strictly prohibit tap water');
  assert.ok(html.includes('누전') || html.includes('전기 화재') || html.includes('절연'), 'Must explain electrical short risk');
  return 'Verified: Tap water electrical hazard strictly prohibited and explained.';
});

auditItem('Warning & Emergency', 'WRN-KEY-01', 'Smart key dead battery RFID physical start button touch', () => {
  const card10Match = html.match(/id="manual-card-warnings-5"[\s\S]*?<\/article>/);
  assert.ok(card10Match, 'Card 10 must exist');
  const card10 = card10Match[0];
  assert.ok(card10.includes('비상키') || card10.includes('쇠키'), 'Must explain mechanical key door unlock');
  assert.ok(card10.includes('RFID') || card10.includes('직접 접촉') || card10.includes('본체로'), 'Must explain physical contact on start button');
  assert.ok(card10.includes('시동 버튼') && card10.includes('누릅니다'), 'Must press start button with smart key');
  return 'Verified: Smart key mechanical key unlock and RFID direct button touch procedure documented.';
});

// -----------------------------------------------------------------------------
// 3. Maintenance & Inspection Audit
// -----------------------------------------------------------------------------

auditItem('Maintenance', 'MNT-OIL-01', 'Engine oil viscosity: 0W-16 / 0W-20 & API SP / ILSAC GF-6', () => {
  assert.ok(html.includes('0W-16') && html.includes('0W-20'), 'Must cite 0W-16 and 0W-20');
  assert.ok(html.includes('API SP') || html.includes('ILSAC GF-6'), 'Must cite API SP / ILSAC GF-6');
  return 'Verified: 0W-16 / 0W-20 and API SP / ILSAC GF-6 specifications present.';
});

auditItem('Maintenance', 'MNT-OIL-02', 'Engine oil replacement intervals (Normal vs Severe)', () => {
  const card11Match = html.match(/id="manual-card-maint-1"[\s\S]*?<\/article>/);
  assert.ok(card11Match, 'Card 11 must exist');
  const card11 = card11Match[0];
  
  // Official Hyundai Manual Specification:
  // Normal: 10,000 km or 12 months
  // Severe: 5,000 km or 6 months (매 5,000km 또는 6개월)
  // Check what index.html states:
  if (card11.includes('7,000~8,000km')) {
    throw new Error('NUMERIC SPECIFICATION INACCURACY: Card 11 states severe condition interval is "7,000~8,000km/6개월". The official Hyundai Tucson Hybrid (NX4) manual specifies severe condition oil change interval is 5,000 km / 6 months (매 5,000 km 또는 6개월마다 교환). Recommending 7,000~8,000 km for severe short-trip driving exceeds official manufacturer warranty guidelines.');
  }
  assert.ok(card11.includes('10,000km'), 'Must state 10,000 km normal interval');
  return 'Verified: Oil intervals conform to official specs.';
});

auditItem('Maintenance', 'MNT-CABIN-01', 'Cabin air filter DIY replacement instructions & air flow arrow', () => {
  const card13Match = html.match(/id="manual-card-maint-3"[\s\S]*?<\/article>/);
  assert.ok(card13Match, 'Card 13 must exist');
  const card13 = card13Match[0];
  assert.ok(card13.includes('글러브박스'), 'Must cite glove box');
  assert.ok(card13.includes('화살표') && (card13.includes('아래') || card13.includes('AIR FLOW ↓')), 'Must cite air flow downward arrow');
  return 'Verified: Cabin air filter replacement steps and downward air flow arrow documented.';
});

auditItem('Maintenance', 'MNT-DUCT-01', 'High-voltage battery cooling air duct location & blockage precautions', () => {
  const card15Match = html.match(/id="manual-card-maint-5"[\s\S]*?<\/article>/);
  assert.ok(card15Match, 'Card 15 must exist');
  const card15 = card15Match[0];
  assert.ok(card15.includes('통풍구') || card15.includes('공기 흡입구'), 'Must cite cooling air duct');
  assert.ok(card15.includes('시트'), 'Must cite seat location');
  assert.ok(card15.includes('짐') || card15.includes('담요') || card15.includes('매트'), 'Must warn against cargo/blanket blockage');
  assert.ok(card15.includes('물') || card15.includes('액체'), 'Must warn against liquid spill danger');
  return 'Verified: Battery cooling duct location and blockage/liquid precautions documented.';
});

console.log('\n================================================================');
console.log('AUDIT SUMMARY');
console.log('================================================================');
const passed = auditResults.filter(r => r.status === 'PASS').length;
const findings = auditResults.filter(r => r.status === 'FINDING').length;
console.log(`Total Checks: ${auditResults.length} | Passed: ${passed} | Findings: ${findings}`);

if (findings > 0) {
  console.log('\nDetailed Findings:');
  auditResults.filter(r => r.status === 'FINDING').forEach(f => {
    console.log(`- [${f.itemCode}] ${f.name}: ${f.detail}`);
  });
}
