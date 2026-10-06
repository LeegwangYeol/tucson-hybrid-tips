/**
 * ==============================================================================
 * Tucson Hybrid Smart Key Trunk Prevention Tips Website
 * File: js/app.js
 * Description: Main application entry point implementing accessible mobile
 * navigation toggle, keyboard trap protection, managed toast timers,
 * and IntersectionObserver scrollspy.
 * ==============================================================================
 */

// Top-level DOM guard for SSR, headless, and Node test environments
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}

/**
 * Initializes all primary application components.
 */
export function initApp() {
  initMobileNavigation();
  initScrollspy();
  initPrintTrigger();
  initDynamicModules();
}

/**
 * Accessible Mobile Navigation Drawer Controller
 * Compliant with WAI-ARIA Disclosure & Navigation Menu Patterns
 */
export function initMobileNavigation() {
  if (typeof document === 'undefined') return;

  const toggleBtn = document.getElementById('nav-toggle') || document.getElementById('nav-toggle-btn') || document.querySelector('.nav-toggle');
  const primaryNav = document.getElementById('primary-nav') || document.querySelector('.nav-menu');
  const header = document.getElementById('navbar') || document.querySelector('.site-header');

  if (!toggleBtn || !primaryNav) return;

  // Idempotency guard: prevent duplicate listeners and toggle cancellation
  if (toggleBtn.dataset.navBound === 'true') return;
  toggleBtn.dataset.navBound = 'true';

  function openMenu() {
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.setAttribute('aria-label', '주 탐색 메뉴 닫기');
    toggleBtn.classList.add('is-open');
    primaryNav.classList.add('is-open');
    if (header) header.classList.add('menu-open');
    document.body.classList.add('menu-open');

    // Transfer focus to first navigational link
    const firstLink = primaryNav.querySelector('a');
    if (firstLink) firstLink.focus();
  }

  function closeMenu(shouldFocusToggle = false) {
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-label', '주 탐색 메뉴 열기');
    toggleBtn.classList.remove('is-open');
    primaryNav.classList.remove('is-open');
    if (header) header.classList.remove('menu-open');
    document.body.classList.remove('menu-open');

    if (shouldFocusToggle) {
      toggleBtn.focus();
    }
  }

  // Toggle button click
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close menu on navigation link click
  const navLinks = primaryNav.querySelectorAll('a');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (toggleBtn.getAttribute('aria-expanded') === 'true') {
        closeMenu();
      }
    });
  });

  // Keyboard accessibility: Escape key closes menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggleBtn.getAttribute('aria-expanded') === 'true') {
      closeMenu(true);
    }
  });

  // Keyboard accessibility: Focus trap inside mobile navigation drawer
  primaryNav.addEventListener('keydown', (e) => {
    if (toggleBtn.getAttribute('aria-expanded') !== 'true') return;
    if (e.key === 'Tab') {
      const focusables = Array.from(primaryNav.querySelectorAll('a, button')).filter(
        el => !el.hasAttribute('disabled') && el.offsetParent !== null
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        toggleBtn.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        toggleBtn.focus();
      }
    }
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (toggleBtn.getAttribute('aria-expanded') === 'true' && !primaryNav.contains(e.target) && !toggleBtn.contains(e.target)) {
      closeMenu();
    }
  });

  // Auto-close drawer on viewport resize to desktop (>= 1024px)
  if (typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
      if (e.matches && toggleBtn.getAttribute('aria-expanded') === 'true') {
        closeMenu(false);
      }
    });
  }
}

/**
 * Accessible Scrollspy Navigation using IntersectionObserver
 * Highlights the current active section in the sticky navbar.
 */
export function initScrollspy() {
  if (typeof document === 'undefined') return;

  const sectionIds = [
    'hero',
    'reality-check',
    'scenarios',
    'tips',
    'manual',
    'secrets',
    'simulator-section',
    'checklist-section',
    'cheat-sheet-section'
  ];

  const sections = sectionIds
    .map(id => document.getElementById(id))
    .filter(Boolean);

  const navLinks = document.querySelectorAll('.nav-link');
  if (sections.length === 0 || navLinks.length === 0) return;

  function setActiveLink(activeId) {
    navLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      const targetId = href.replace('#', '');

      if (targetId === activeId) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }

  if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };

    let activeSectionId = sections[0].id;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          activeSectionId = entry.target.id;
          setActiveLink(activeSectionId);
        }
      });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
  } else if (typeof window !== 'undefined') {
    // Fallback scroll listener for older environments
    window.addEventListener('scroll', () => {
      const scrollPos = window.scrollY + 160;
      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = sections[i];
        if (sec.offsetTop <= scrollPos) {
          setActiveLink(sec.id);
          break;
        }
      }
    }, { passive: true });
  }
}

/**
 * Print Button Trigger Handler
 */
export function initPrintTrigger() {
  if (typeof document === 'undefined') return;

  const printBtns = document.querySelectorAll('#print-trigger-btn, #btn-print-card, .print-btn');
  printBtns.forEach(btn => {
    if (btn.dataset.printBound === 'true') return;
    btn.dataset.printBound = 'true';
    btn.addEventListener('click', () => {
      if (typeof window !== 'undefined') {
        window.print();
      }
    });
  });
}

// Timer handles for clean lifecycle cancellation
let announcerTimer = null;
let toastTimer = null;

/**
 * Screen Reader Live Announcer Utility with Timer Debouncing
 * @param {string} message
 */
export function announceToScreenReader(message) {
  if (typeof document === 'undefined') return;

  const announcer = document.getElementById('global-announcer');
  if (!announcer) return;

  if (announcerTimer) {
    clearTimeout(announcerTimer);
    announcerTimer = null;
  }

  announcer.textContent = '';
  announcerTimer = setTimeout(() => {
    announcer.textContent = String(message);
    announcerTimer = null;
  }, 50);
}

/**
 * Global Toast Notification Utility with Container Placement & Managed Timers
 * @param {string} message
 * @param {number} [duration=3000]
 */
export function showToast(message, duration = 3000) {
  if (typeof document === 'undefined') return;

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    container.appendChild(toast);
  }

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  toast.textContent = String(message);
  toast.classList.add('show');
  announceToScreenReader(message);

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastTimer = null;
  }, duration);
}

/**
 * Dynamic Hydration for Interactive Modules (Simulator & Checklist)
 * Gracefully imports modules when containers exist in DOM, preventing 404s.
 */
export async function initDynamicModules() {
  if (typeof document === 'undefined') return;

  const simContainer = document.querySelector('#simulator-container');
  if (simContainer) {
    try {
      const simModule = await import('./simulator.js');
      if (typeof simModule.initTailgateSimulator === 'function') {
        simModule.initTailgateSimulator(simContainer);
      }
    } catch (err) {
      console.debug('[app.js] Simulator module hydration deferred:', err.message);
    }
  }

  const chkContainer = document.querySelector('#checklist-container');
  if (chkContainer) {
    try {
      const chkModule = await import('./checklist.js');
      if (typeof chkModule.initChecklist === 'function') {
        chkModule.initChecklist(chkContainer);
      }
    } catch (err) {
      console.debug('[app.js] Checklist module hydration deferred:', err.message);
    }
  }

  const manualContainer = document.querySelector('#manual');
  if (manualContainer) {
    try {
      const manualModule = await import('./manual.js');
      if (typeof manualModule.initManual === 'function') {
        manualModule.initManual(manualContainer);
      }
    } catch (err) {
      console.debug('[app.js] Manual module hydration deferred:', err.message);
    }
  }

  const secretsContainer = document.querySelector('#secrets');
  if (secretsContainer) {
    try {
      const secretsModule = await import('./secrets.js');
      if (typeof secretsModule.initSecretsModule === 'function') {
        secretsModule.initSecretsModule(secretsContainer);
      } else if (typeof secretsModule.initSecretsSection === 'function') {
        secretsModule.initSecretsSection(secretsContainer);
      }
    } catch (err) {
      console.debug('[app.js] Secrets module hydration deferred:', err.message);
    }
  }
}
