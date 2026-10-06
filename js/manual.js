/**
 * ==============================================================================
 * Tucson Hybrid Simplified Owner's Manual ("눈높이 차량 설명서")
 * File: js/manual.js
 * Description: Interactive Category Tab Switching (WAI-ARIA Tabs pattern),
 * Keyboard Arrow Navigation, Expandable Accordion Cards, and Real-time Search Filter.
 * ==============================================================================
 */

import { announceToScreenReader } from './app.js';

/**
 * Initializes the Simplified Owner's Manual module.
 * @param {string|HTMLElement} containerOrSelector - Container element or selector
 */
export function initManual(containerOrSelector = '#manual') {
  if (typeof document === 'undefined') return;

  const container = typeof containerOrSelector === 'string'
    ? document.querySelector(containerOrSelector)
    : containerOrSelector;

  if (!container) return;

  // Idempotency guard: prevent duplicate listeners and state corruption
  if (container.dataset.manualBound === 'true') return;
  container.dataset.manualBound = 'true';

  const tabBtns = Array.from(container.querySelectorAll('.manual-tab-btn, [role="tab"]'));
  const panels = Array.from(container.querySelectorAll('.manual-panel, [role="tabpanel"]'));
  const accordionBtns = Array.from(container.querySelectorAll('.manual-accordion-btn'));
  const searchInput = container.querySelector('#manual-search-input');
  const searchClearBtn = container.querySelector('#manual-search-clear');
  const searchCount = container.querySelector('#manual-search-count');
  const emptyState = container.querySelector('#manual-empty-state');
  const cards = Array.from(container.querySelectorAll('.manual-card'));

  /**
   * Helper for accessible screen reader announcements
   * @param {string} msg
   */
  const announce = (msg) => {
    try {
      if (typeof announceToScreenReader === 'function') {
        announceToScreenReader(msg);
      }
    } catch {
      // Fallback silent catch
    }
  };

  // ============================================================================
  // 1. WAI-ARIA Tab Navigation & Keyboard Controller
  // ============================================================================
  function switchTab(targetBtn, focus = false) {
    if (!targetBtn) return;
    const targetControls = targetBtn.getAttribute('aria-controls');

    tabBtns.forEach((btn) => {
      const isSelected = btn === targetBtn;
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      btn.setAttribute('tabindex', isSelected ? '0' : '-1');
      btn.classList.toggle('active', isSelected);
    });

    panels.forEach((panel) => {
      const isTarget = panel.id === targetControls;
      if (isTarget) {
        panel.removeAttribute('hidden');
        panel.classList.add('active');
      } else {
        panel.setAttribute('hidden', '');
        panel.classList.remove('active');
      }
    });

    if (focus) {
      targetBtn.focus();
    }

    const tabLabel = targetBtn.textContent.replace(/\(\d+\)/, '').trim();
    announce(`${tabLabel} 탭이 선택되었습니다.`);

    // Re-apply search filtering for the newly activated panel
    if (searchInput && searchInput.value.trim().length > 0) {
      applySearchFilter(searchInput.value.trim());
    }
  }

  // Bind click & keyboard handlers to tab buttons
  tabBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      switchTab(btn, false);
    });

    btn.addEventListener('keydown', (e) => {
      let targetIndex = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        targetIndex = (index + 1) % tabBtns.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        targetIndex = (index - 1 + tabBtns.length) % tabBtns.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        targetIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        targetIndex = tabBtns.length - 1;
      }

      if (targetIndex >= 0) {
        switchTab(tabBtns[targetIndex], true);
      }
    });
  });

  // ============================================================================
  // 2. Expandable Accordion Controller
  // ============================================================================
  accordionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      const targetContentId = btn.getAttribute('aria-controls');
      const content = targetContentId ? document.getElementById(targetContentId) : null;
      const labelSpan = btn.querySelector('.manual-accordion-label');
      const iconSpan = btn.querySelector('.manual-accordion-icon');

      if (isExpanded) {
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('is-open');
        if (content) {
          content.setAttribute('hidden', '');
          content.classList.remove('is-open');
        }
        if (labelSpan) labelSpan.textContent = '상세 해설 & 실전 수칙 보기';
        if (iconSpan) iconSpan.textContent = '▼';
        announce('상세 내용이 접혔습니다.');
      } else {
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.add('is-open');
        if (content) {
          content.removeAttribute('hidden');
          content.classList.add('is-open');
        }
        if (labelSpan) labelSpan.textContent = '상세 해설 접기';
        if (iconSpan) iconSpan.textContent = '▲';
        announce('상세 내용이 펼쳐졌습니다.');
      }
    });
  });

  // ============================================================================
  // 3. Real-Time Search & Discovery Controller
  // ============================================================================
  let searchDebounceTimer = null;

  function applySearchFilter(query) {
    const rawQuery = query.toLowerCase().trim();

    if (!rawQuery) {
      // Reset search filter
      cards.forEach((card) => {
        card.removeAttribute('hidden');
        card.style.display = '';
      });

      if (emptyState) emptyState.setAttribute('hidden', '');
      if (searchCount) searchCount.textContent = '';
      if (searchClearBtn) searchClearBtn.setAttribute('hidden', '');
      return;
    }

    if (searchClearBtn) searchClearBtn.removeAttribute('hidden');

    let totalMatches = 0;
    let activePanelMatches = 0;
    const activePanel = panels.find((p) => p.classList.contains('active') && !p.hasAttribute('hidden'));

    cards.forEach((card) => {
      const text = (card.textContent || '').toLowerCase();
      const isMatch = text.includes(rawQuery);

      if (isMatch) {
        card.removeAttribute('hidden');
        card.style.display = '';
        totalMatches++;
        if (activePanel && activePanel.contains(card)) {
          activePanelMatches++;
        }
      } else {
        card.setAttribute('hidden', '');
        card.style.display = 'none';
      }
    });

    if (searchCount) {
      searchCount.textContent = `검색 결과: 총 ${totalMatches}건 (현재 탭: ${activePanelMatches}건)`;
    }

    if (emptyState) {
      if (totalMatches === 0) {
        emptyState.removeAttribute('hidden');
      } else {
        emptyState.setAttribute('hidden', '');
      }
    }

    announce(`총 ${totalMatches}개의 검색 결과가 발견되었습니다.`);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        applySearchFilter(query);
      }, 100);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        applySearchFilter('');
        searchInput.blur();
      }
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      applySearchFilter('');
    });
  }
}
