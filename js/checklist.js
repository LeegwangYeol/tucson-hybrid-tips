/**
 * ==============================================================================
 * Tucson Hybrid Smart Key Trunk Prevention Tips Website
 * File: js/checklist.js
 * Description: Interactive 7-Step Prevention Checklist with Resilient Multi-Tier Storage & Score Ring
 * Interface Contract: Exposes initChecklist(containerId), calculateChecklistScore(checkedIndices)
 * ==============================================================================
 */

import { showToast, announceToScreenReader } from './app.js';
import { SafeStorage } from './storage.js';

export const STORAGE_KEY = 'tucson_trunk_prevention_checklist_v1';
export const TOTAL_ITEMS = 7;

// In-memory fallback cache in case of total storage restriction
let memoryFallbackChecked = null;

/**
 * Calculates score metrics based on checked indices.
 * Defensively validates input against non-arrays, non-integers, and out-of-bounds indices.
 * 
 * @param {number[]|any} checkedIndices
 * @returns {object}
 */
export function calculateChecklistScore(checkedIndices) {
  const safeArray = Array.isArray(checkedIndices) ? checkedIndices : [];
  const valid = Array.from(new Set(safeArray)).filter(
    idx => typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx < TOTAL_ITEMS
  );
  const count = valid.length;
  const percentage = Math.round((count / TOTAL_ITEMS) * 100);

  let level = 'HIGH_RISK';
  let title = '위험: 즉시 점검 필요';
  let desc = '스마트키 오개방 및 천장 배관 충돌 위험이 매우 높습니다. 핵심 설정을 즉시 확인하세요.';
  let badgeClass = 'badge badge-danger';
  let ringColor = 'var(--nline-red, #ff808b)';

  if (count >= 6) {
    level = 'SAFE';
    title = '안전: 완벽 예방 완료';
    desc = '차량 설정과 물리 케이스 등 완벽한 다층 방어 체계를 갖추었습니다. 안심하고 주차하세요!';
    badgeClass = 'badge badge-emerald';
    ringColor = 'var(--success-emerald, #10b981)';
  } else if (count >= 3) {
    level = 'WARNING';
    title = '주의: 추가 점검 권장';
    desc = '기본적인 조치는 완료되었으나, 기계식 주차타워나 협소 공간에서의 충돌 위험이 일부 남아있습니다.';
    badgeClass = 'badge badge-warning';
    ringColor = 'var(--warning-amber, #f59e0b)';
  }

  return {
    count,
    total: TOTAL_ITEMS,
    percentage,
    level,
    title,
    desc,
    badgeClass,
    ringColor,
    checkedIndices: valid.sort((a, b) => a - b)
  };
}

/**
 * Loads checklist state using SafeStorage with automatic self-healing.
 * @returns {number[]}
 */
export function loadChecklistState() {
  return SafeStorage.getJSON(STORAGE_KEY, (parsed) => {
    let rawList = [];
    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && Array.isArray(parsed.checked)) {
      rawList = parsed.checked;
    } else {
      return null; // Invalid schema triggers auto-healing
    }

    return Array.from(new Set(rawList))
      .filter(idx => typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx < TOTAL_ITEMS)
      .sort((a, b) => a - b);
  }, memoryFallbackChecked || [], true);
}

/**
 * Persists checklist state using SafeStorage.
 * @param {number[]} checkedIndices
 */
export function saveChecklistState(checkedIndices) {
  const safeArray = Array.isArray(checkedIndices) ? checkedIndices : [];
  const sanitized = Array.from(new Set(safeArray))
    .filter(idx => typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx < TOTAL_ITEMS)
    .sort((a, b) => a - b);

  memoryFallbackChecked = [...sanitized];

  SafeStorage.setJSON(STORAGE_KEY, {
    version: 1,
    checked: sanitized,
    timestamp: Date.now()
  });
}

/**
 * Initializes the Prevention Checklist.
 * @param {string|HTMLElement} containerId - Target DOM selector or element
 */
export function initChecklist(containerId = '#checklist-container') {
  if (typeof document === 'undefined') return;

  const container = typeof containerId === 'string'
    ? document.querySelector(containerId)
    : containerId;

  if (!container) return;

  // Idempotency guard: prevent duplicate listeners and toggle cancellation
  if (container.dataset.chkBound === 'true') return;
  container.dataset.chkBound = 'true';

  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  const scoreVal = container.querySelector('#checklist-score');
  const scoreRingProgress = container.querySelector('#score-ring-progress');
  const statusTitle = container.querySelector('#checklist-status-title');
  const statusDesc = container.querySelector('#checklist-status-desc');
  const badge = container.querySelector('#checklist-badge');
  const resetBtn = container.querySelector('#btn-reset-checklist');
  const shareBtn = container.querySelector('#share-score-btn');
  const announcer = container.querySelector('#checklist-announcer');

  const RING_CIRCUMFERENCE = 251.2; // 2 * PI * 40

  function render(checkedIndices) {
    const result = calculateChecklistScore(checkedIndices);

    // Update checkboxes
    checkboxes.forEach((cb, idx) => {
      cb.checked = result.checkedIndices.includes(idx);
    });

    // Update score number
    if (scoreVal) {
      scoreVal.textContent = `${result.percentage}%`;
    }

    // Update score ring SVG progress
    if (scoreRingProgress) {
      const offset = RING_CIRCUMFERENCE - (result.percentage / 100) * RING_CIRCUMFERENCE;
      scoreRingProgress.style.strokeDashoffset = String(offset);
      scoreRingProgress.style.stroke = result.ringColor;
    }

    // Update text
    if (statusTitle) statusTitle.textContent = result.title;
    if (statusDesc) statusDesc.textContent = result.desc;
    if (badge) {
      badge.className = result.badgeClass;
      badge.textContent = result.title;
    }

    if (announcer) {
      announcer.textContent = `체크리스트 점검 완료율 ${result.percentage}%, 상태: ${result.title}`;
    }
  }

  function getCheckedIndicesFromDOM() {
    const checked = [];
    checkboxes.forEach((cb, idx) => {
      if (cb.checked) checked.push(idx);
    });
    return checked;
  }

  // Handle Checkbox Toggles
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = getCheckedIndicesFromDOM();
      saveChecklistState(checked);
      render(checked);
    });
  });

  // Handle Reset Button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      SafeStorage.removeItem(STORAGE_KEY);
      memoryFallbackChecked = [];
      render([]);
      showToast('자가진단 체크리스트가 초기화되었습니다.');
      announceToScreenReader('자가진단 체크리스트가 초기화되었습니다.');
    });
  }

  // Handle Share Button
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const checked = getCheckedIndicesFromDOM();
      const result = calculateChecklistScore(checked);
      const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
      const shareText = `[현대 투싼 하이브리드 트렁크 안전 진단]\n- 나의 안전 지수: ${result.percentage}점 (${result.title})\n- 점검 완료 항목: ${result.count}/${TOTAL_ITEMS}개\n\n투싼 NX4 스마트키 오개방 방지 가이드 확인하기:\n${shareUrl}`;

      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(shareText);
        } else if (typeof document !== 'undefined') {
          const textarea = document.createElement('textarea');
          textarea.value = shareText;
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          textarea.style.opacity = '0';
          textarea.setAttribute('aria-hidden', 'true');
          textarea.tabIndex = -1;
          document.body.appendChild(textarea);
          try {
            textarea.select();
            document.execCommand('copy');
          } finally {
            if (textarea.parentNode) {
              textarea.parentNode.removeChild(textarea);
            }
          }
        }
        showToast('진단 결과가 클립보드에 복사되었습니다! 📋');
        announceToScreenReader('진단 결과가 클립보드에 복사되었습니다.');
      } catch (err) {
        showToast('클립보드 복사에 실패했습니다.');
      }
    });
  }

  // Multi-tab synchronization and pagehide persistence
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) {
        const updated = loadChecklistState();
        render(updated);
      }
    });

    window.addEventListener('pagehide', () => {
      saveChecklistState(getCheckedIndicesFromDOM());
    });
  }

  // Initial load
  const initialChecked = loadChecklistState();
  render(initialChecked);
}
