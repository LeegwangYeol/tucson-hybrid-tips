/**
 * ==============================================================================
 * Tucson Hybrid Smart Key Trunk Prevention Tips Website
 * File: js/simulator.js
 * Description: Interactive Tailgate Height & Ceiling Collision Simulator Module
 * Interface Contract: Exposes initTailgateSimulator(containerId), calculateClearance(ceilingHeightCm, tailgateHeightMm)
 * ==============================================================================
 */

import { SafeStorage } from './storage.js';

export const SIMULATOR_STORAGE_KEY = 'tucson_tailgate_simulator_v1';

export const TAILGATE_PRESETS = {
  full: 2150,     // 완전 열림 (~2150mm / 215cm)
  level3: 1920,   // 3단계 (~1920mm / 192cm)
  level2: 1780    // 2단계 (~1780mm / 178cm)
};

const DEFAULT_SIMULATOR_STATE = {
  ceilingCm: 210,
  mode: 'full'
};

/**
 * Calculates clearance, status, and badge classification.
 * Defensively defaults to COLLISION_DANGER and clearance -Infinity on invalid/corrupted input.
 * 
 * @param {number|string} ceilingHeightCm - Ceiling height in cm (180 ~ 260)
 * @param {number|string} tailgateHeightMm - Tailgate opening height in mm
 * @returns {object} Result object with ceilingMm, tailgateHeightMm, clearance, status, badgeType
 */
export function calculateClearance(ceilingHeightCm, tailgateHeightMm) {
  const numCeiling = Number(ceilingHeightCm);
  const numTailgate = Number(tailgateHeightMm);

  // Fail-safe boundary: if input is NaN or non-finite, default to DANGER
  if (!Number.isFinite(numCeiling) || !Number.isFinite(numTailgate)) {
    return {
      ceilingMm: 0,
      tailgateHeightMm: 0,
      clearance: -Infinity,
      status: 'COLLISION_DANGER',
      badgeType: 'danger'
    };
  }

  const ceilingMm = Math.round(numCeiling * 10);
  const clearance = ceilingMm - Math.round(numTailgate);

  let status = 'SAFE';
  let badgeType = 'safe';

  if (clearance < 0) {
    status = 'COLLISION_DANGER';
    badgeType = 'danger';
  } else if (clearance < 150) {
    status = 'WARNING';
    badgeType = 'warning';
  }

  return {
    ceilingMm,
    tailgateHeightMm: Math.round(numTailgate),
    clearance,
    status,
    badgeType
  };
}

/**
 * Loads simulator state from SafeStorage with clamping & default fallback.
 * @returns {{ ceilingCm: number, mode: string }}
 */
export function loadSimulatorState() {
  return SafeStorage.getJSON(SIMULATOR_STORAGE_KEY, (parsed) => {
    if (!parsed || typeof parsed !== 'object') return null;
    let ceilingCm = Number(parsed.ceilingCm);
    if (!Number.isFinite(ceilingCm)) {
      ceilingCm = 210;
    } else {
      ceilingCm = Math.min(260, Math.max(180, ceilingCm));
    }
    let mode = parsed.mode;
    if (!mode || !TAILGATE_PRESETS[mode]) {
      mode = 'full';
    }
    return { ceilingCm, mode };
  }, DEFAULT_SIMULATOR_STATE, true);
}

/**
 * Persists simulator state to SafeStorage.
 * @param {number} ceilingCm
 * @param {string} mode
 */
export function saveSimulatorState(ceilingCm, mode) {
  const clampedCeiling = Math.min(260, Math.max(180, Number(ceilingCm) || 210));
  const validMode = TAILGATE_PRESETS[mode] ? mode : 'full';
  SafeStorage.setJSON(SIMULATOR_STORAGE_KEY, {
    version: 1,
    ceilingCm: clampedCeiling,
    mode: validMode,
    timestamp: Date.now()
  });
}

/**
 * Initializes the Tailgate Height Simulator.
 * @param {string|HTMLElement} containerId - Target DOM selector or element
 */
export function initTailgateSimulator(containerId = '#simulator-container') {
  if (typeof document === 'undefined') return;

  const container = typeof containerId === 'string'
    ? document.querySelector(containerId)
    : containerId;

  if (!container) return;

  // Idempotency guard: prevent duplicate listeners and reflow storms
  if (container.dataset.simBound === 'true') return;
  container.dataset.simBound = 'true';

  const slider = container.querySelector('#ceiling-height-slider');
  const output = container.querySelector('#ceiling-height-output');
  const presetBtns = container.querySelectorAll('.preset-btn, .btn-preset');
  const modeBtns = container.querySelectorAll('.btn-tailgate-mode');
  const statusBox = container.querySelector('#simulator-status, #clearance-badge');

  // SVG Elements
  const ceilingLine = container.querySelector('#svg-ceiling-line');
  const ceilingText = container.querySelector('#svg-ceiling-text');
  const pipeRect = container.querySelector('#svg-pipe-rect');
  const tailgateBar = container.querySelector('#svg-tailgate-bar');
  const spoilerPoint = container.querySelector('#svg-spoiler-point');
  const tailgateMaxText = container.querySelector('#svg-tailgate-max-text');

  // Load saved state or default
  const savedState = loadSimulatorState();
  let currentCeilingCm = savedState.ceilingCm;
  let currentMode = savedState.mode;

  let rafId = null;

  function update() {
    const tailgateMm = TAILGATE_PRESETS[currentMode] || TAILGATE_PRESETS.full;
    const result = calculateClearance(currentCeilingCm, tailgateMm);

    // Update Slider & Output
    if (slider) {
      slider.value = currentCeilingCm;
      slider.setAttribute('aria-valuenow', String(currentCeilingCm));
      slider.setAttribute('aria-valuetext', `천장 높이 ${currentCeilingCm} 센티미터`);
    }
    if (output) {
      output.textContent = `${currentCeilingCm}cm`;
    }

    // Update Preset Buttons Active State
    presetBtns.forEach(btn => {
      const pVal = Number(btn.getAttribute('data-preset') || btn.getAttribute('data-height'));
      if (pVal === currentCeilingCm) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    // Update Mode Buttons Active State
    modeBtns.forEach(btn => {
      const mode = btn.getAttribute('data-mode');
      if (mode === currentMode) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    // Calculate SVG Y-Coordinates
    // Ground is Y=400. 1cm = 1.3px scale (210cm = 400 - 273 = 127)
    const groundY = 400;
    const scale = 1.3;
    const ceilingY = Math.round(groundY - (currentCeilingCm * scale));
    const tailgateY = Math.round(groundY - ((tailgateMm / 10) * scale));

    if (ceilingLine) {
      ceilingLine.setAttribute('y1', String(ceilingY));
      ceilingLine.setAttribute('y2', String(ceilingY));
    }
    if (pipeRect) {
      pipeRect.setAttribute('y', String(ceilingY - 20));
    }
    if (ceilingText) {
      ceilingText.setAttribute('y', String(ceilingY - 5));
      ceilingText.textContent = `천장 소방 배관 (${currentCeilingCm}cm)`;
    }

    if (tailgateBar) {
      tailgateBar.setAttribute('y2', String(tailgateY));
    }
    if (spoilerPoint) {
      spoilerPoint.setAttribute('cy', String(tailgateY));
    }
    if (tailgateMaxText) {
      tailgateMaxText.setAttribute('y', String(tailgateY + 5));
      tailgateMaxText.textContent = `트렁크 개방 높이 (${Math.round(tailgateMm / 10)}cm)`;
    }

    // Color theme & status updates
    let statusClass = 'status-danger';
    let icon = '💥';
    let title = '충돌 위험 경고: 천장 배관 직격!';
    let desc = `현재 설정에서 테일게이트 개방 높이(${Math.round(tailgateMm / 10)}cm)가 천장 배관(${currentCeilingCm}cm)보다 ${Math.abs(Math.round(result.clearance / 10))}cm 높아 상부 루프 스포일러가 직접 충돌합니다. 트렁크 높이를 '3단계'로 낮추거나 3초 롱프레스 메모리로 195cm 이하로 설정하세요.`;
    let colorHex = '#ff808b';

    if (result.status === 'WARNING') {
      statusClass = 'status-warning';
      icon = '⚠️';
      title = `주의: 여유 간극 부족 (+${result.clearance}mm)`;
      desc = `현재 안전 여유 간극이 ${result.clearance}mm (${Math.round(result.clearance / 10)}cm)에 불과합니다. 탑승자 승하차 시 서스펜션 반동이나 요철 경사로 인해 천장 배관과 접촉할 위험이 있습니다.`;
      colorHex = '#f59e0b';
    } else if (result.status === 'SAFE') {
      statusClass = 'status-success';
      icon = '🛡️';
      title = `안전: 충분한 안전 마진 확보 (+${result.clearance}mm)`;
      desc = `천장 배관과 테일게이트 사이에 ${result.clearance}mm (${Math.round(result.clearance / 10)}cm)의 안전 마진이 확보되어 있어 충돌 없이 안전하게 전동 트렁크를 개방할 수 있습니다.`;
      colorHex = '#10b981';
    }

    if (ceilingLine) ceilingLine.setAttribute('stroke', colorHex);
    if (spoilerPoint) spoilerPoint.setAttribute('fill', colorHex);

    if (statusBox) {
      statusBox.className = `status-callout ${statusClass}`;
      const iconEl = statusBox.querySelector('.status-icon');
      const titleEl = statusBox.querySelector('.status-title');
      const descEl = statusBox.querySelector('.status-desc');

      if (iconEl) iconEl.textContent = icon;
      if (titleEl) titleEl.textContent = title;
      if (descEl) descEl.textContent = desc;
    }
  }

  function scheduleUpdate() {
    if (rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId);
    }
    if (typeof requestAnimationFrame !== 'undefined') {
      rafId = requestAnimationFrame(() => {
        update();
        rafId = null;
      });
    } else {
      update();
    }
  }

  // Bind Slider Input with RAF throttling and state persistence
  if (slider) {
    slider.addEventListener('input', (e) => {
      currentCeilingCm = Number(e.target.value);
      saveSimulatorState(currentCeilingCm, currentMode);
      scheduleUpdate();
    });
  }

  // Bind Preset Buttons
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.getAttribute('data-preset') || btn.getAttribute('data-height'));
      if (!isNaN(val)) {
        currentCeilingCm = val;
        saveSimulatorState(currentCeilingCm, currentMode);
        update();
      }
    });
  });

  // Bind Tailgate Mode Buttons
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      if (mode && TAILGATE_PRESETS[mode]) {
        currentMode = mode;
        saveSimulatorState(currentCeilingCm, currentMode);
        update();
      }
    });
  });

  // Multi-tab synchronization
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === SIMULATOR_STORAGE_KEY) {
        const saved = loadSimulatorState();
        currentCeilingCm = saved.ceilingCm;
        currentMode = saved.mode;
        update();
      }
    });
  }

  // Initial render
  update();
}
