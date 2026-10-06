/**
 * ==============================================================================
 * Tucson Hybrid Smart Key Trunk Prevention Tips Website
 * File: js/secrets.js
 * Description: Interactive Category Filtering, WAI-ARIA Tab Navigation, and
 * Resilient Bookmark State Management for Advanced Tips & Hidden Features (#secrets)
 * ==============================================================================
 */

import { showToast, announceToScreenReader } from './app.js';
import { SafeStorage } from './storage.js';

export const SECRETS_BOOKMARKS_KEY = 'tucson_bookmarked_secrets_v1';
export const SECRETS_STORAGE_KEY = 'tucson_bookmarked_secrets_v1';
export const SECRETS_FILTER_KEY = 'tucson_secrets_filter_v1';

/**
 * Loads stored bookmarked secret IDs with self-healing fallback.
 * @returns {string[]}
 */
export function loadBookmarks() {
  return SafeStorage.getJSON(SECRETS_BOOKMARKS_KEY, (parsed) => {
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(id => typeof id === 'string' && id.trim().length > 0);
  }, [], true);
}

/**
 * Saves bookmarked secret IDs to SafeStorage.
 * @param {string[]} bookmarks
 */
export function saveBookmarks(bookmarks) {
  const safeList = Array.isArray(bookmarks) ? bookmarks : [];
  SafeStorage.setJSON(SECRETS_BOOKMARKS_KEY, safeList);
}

/**
 * Initializes the Advanced Tips & Hidden Features Module.
 * @param {string|HTMLElement} containerId - Target section container selector or element
 */
export function initSecretsModule(containerId = '#secrets') {
  if (typeof document === 'undefined') return;

  const container = typeof containerId === 'string'
    ? document.querySelector(containerId)
    : containerId;

  if (!container) return;

  // Strict Idempotency Guard (avoids duplicate listeners and state corruption)
  if (container.dataset.secretsBound === 'true') return;
  container.dataset.secretsBound = 'true';

  const filterBtns = Array.from(container.querySelectorAll('.secrets-filter-btn, .secrets-tab-btn'));
  const cards = Array.from(container.querySelectorAll('.secret-card'));
  const bookmarkBtns = Array.from(container.querySelectorAll('.secret-bookmark-btn, .btn-bookmark'));

  // Toast dispatch helper supporting window.showToast or imported showToast
  const notifyToast = (msg) => {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(msg);
    } else if (typeof showToast === 'function') {
      showToast(msg);
    }
  };

  // Hydrate initial bookmarks from storage
  const activeBookmarks = new Set(loadBookmarks());
  bookmarkBtns.forEach(btn => {
    const id = btn.dataset.secretId;
    if (id && activeBookmarks.has(id)) {
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.add('is-bookmarked');
      const textEl = btn.querySelector('.bookmark-text');
      if (textEl) {
        textEl.textContent = '저장 완료';
      } else {
        btn.textContent = '⭐ 저장 완료';
      }
    }
  });

  /**
   * Applies category filtering across cards.
   * @param {string} filterCategory - 'all' | 'hidden' | 'hybrid' | 'accessory'
   */
  function applyFilter(filterCategory) {
    let visibleCount = 0;

    cards.forEach(card => {
      const cardCategory = card.dataset.category;
      if (filterCategory === 'all' || cardCategory === filterCategory) {
        card.classList.remove('is-hidden');
        card.removeAttribute('hidden');
        visibleCount++;
      } else {
        card.classList.add('is-hidden');
        card.setAttribute('hidden', 'true');
      }
    });

    filterBtns.forEach(btn => {
      const isMatch = btn.dataset.filter === filterCategory;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      btn.setAttribute('tabindex', isMatch ? '0' : '-1');
    });

    SafeStorage.setItem(SECRETS_FILTER_KEY, filterCategory);

    // Announce filter change to Screen Reader
    const categoryNames = {
      all: '전체 13개 항목',
      hidden: '차량 숨은 기능 5개 항목',
      hybrid: '하이브리드 연비 3개 항목',
      accessory: '추천 용품 5개 항목'
    };
    const catName = categoryNames[filterCategory] || filterCategory;
    if (typeof announceToScreenReader === 'function') {
      announceToScreenReader(`${catName}이 표시됩니다.`);
    }
  }

  // Filter Buttons Click & WAI-ARIA Keyboard Navigation
  filterBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.filter || 'all';
      applyFilter(category);
    });

    // WAI-ARIA Tabs Keyboard Pattern (ArrowRight, ArrowLeft, Home, End)
    btn.addEventListener('keydown', (e) => {
      let targetIndex = -1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        targetIndex = (index + 1) % filterBtns.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        targetIndex = (index - 1 + filterBtns.length) % filterBtns.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        targetIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        targetIndex = filterBtns.length - 1;
      }

      if (targetIndex >= 0) {
        const targetBtn = filterBtns[targetIndex];
        targetBtn.focus();
        targetBtn.click();
      }
    });
  });

  // Bookmark Button Listeners
  bookmarkBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.secretId;
      if (!id) return;

      const isPressed = btn.getAttribute('aria-pressed') === 'true';
      const textEl = btn.querySelector('.bookmark-text');
      const card = btn.closest('.secret-card');
      const titleEl = card ? card.querySelector('.secret-title') : null;
      const title = titleEl ? titleEl.textContent.trim() : '팁';

      if (isPressed) {
        activeBookmarks.delete(id);
        btn.setAttribute('aria-pressed', 'false');
        btn.classList.remove('is-bookmarked');
        if (textEl) {
          textEl.textContent = '유용한 팁 저장';
        } else {
          btn.textContent = '⭐ 유용한 팁 저장';
        }
        notifyToast(`'${title}' 보관이 해제되었습니다.`);
      } else {
        activeBookmarks.add(id);
        btn.setAttribute('aria-pressed', 'true');
        btn.classList.add('is-bookmarked');
        if (textEl) {
          textEl.textContent = '저장 완료';
        } else {
          btn.textContent = '⭐ 저장 완료';
        }
        notifyToast(`⭐ '${title}' 보관함에 저장되었습니다!`);
      }

      saveBookmarks(Array.from(activeBookmarks));
    });
  });

  // Restore saved filter from SafeStorage if present
  const savedFilter = SafeStorage.getItem(SECRETS_FILTER_KEY);
  if (savedFilter && ['hidden', 'hybrid', 'accessory'].includes(savedFilter)) {
    applyFilter(savedFilter);
  }
}

// Alias for ui_arch_report contract
export const initSecretsSection = initSecretsModule;
