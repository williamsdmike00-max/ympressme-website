/**
 * YMPRESSME — main.js
 * Shared utilities: navigation, mobile menu, scroll animations, toast notifications
 */

/* ---- Mobile Navigation ---- */
(function initNav() {
  const hamburger = document.getElementById('navHamburger');
  const mobileNav = document.getElementById('navMobile');
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', function () {
    const isOpen = mobileNav.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!hamburger.contains(e.target) && !mobileNav.contains(e.target)) {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });

  // Close on link click
  mobileNav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
})();

/* ---- Active Nav Link ---- */
(function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(function (a) {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

/* ---- Scroll Fade-In Animation ---- */
(function initScrollAnimations() {
  const els = document.querySelectorAll('.fade-in');
  if (!els.length) return;

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  els.forEach(function (el) { observer.observe(el); });
})();

/* ---- Toast Notification ---- */
window.showToast = function (message, type) {
  type = type || 'success';
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.className = 'toast toast-' + type;
  toast.innerHTML = (type === 'success' ? '✅' : '❌') + ' <span>' + message + '</span>';
  // Force reflow
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () { toast.classList.remove('show'); }, 4000);
};

/* ---- Accordion (FAQ) ---- */
window.initAccordion = function (containerSelector) {
  const container = document.querySelector(containerSelector || '.accordion');
  if (!container) return;

  container.querySelectorAll('.accordion-header').forEach(function (header) {
    header.addEventListener('click', function () {
      const body = this.nextElementSibling;
      const isOpen = this.classList.contains('open');

      // Close all in this accordion
      container.querySelectorAll('.accordion-header').forEach(function (h) {
        h.classList.remove('open');
        h.nextElementSibling.classList.remove('open');
        h.setAttribute('aria-expanded', 'false');
      });

      // Toggle current
      if (!isOpen) {
        this.classList.add('open');
        body.classList.add('open');
        this.setAttribute('aria-expanded', 'true');
      }
    });
  });
};

/* ---- Tab Switcher ---- */
window.initTabs = function (containerSelector) {
  const container = document.querySelector(containerSelector || '.tabs-container');
  if (!container) return;

  const tabBtns   = container.querySelectorAll('.tab-btn');
  const tabPanels = container.querySelectorAll('.tab-panel');

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const target = this.dataset.tab;
      tabBtns.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      tabPanels.forEach(function (p) { p.classList.remove('active'); });
      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');
      const panel = document.getElementById(target);
      if (panel) panel.classList.add('active');
    });
  });
};

/* ---- Quantity Stepper ---- */
window.initStepper = function (wrapperId, onChangeCallback) {
  const wrap = document.getElementById(wrapperId);
  if (!wrap) return;

  const minusBtn = wrap.querySelector('.qty-btn[data-dir="-1"]');
  const plusBtn  = wrap.querySelector('.qty-btn[data-dir="1"]');
  const input    = wrap.querySelector('.qty-input');

  function update(val) {
    const min = parseInt(input.min) || 1;
    const max = parseInt(input.max) || 9999;
    val = Math.max(min, Math.min(max, val));
    input.value = val;
    if (onChangeCallback) onChangeCallback(val);
  }

  minusBtn && minusBtn.addEventListener('click', function () { update(parseInt(input.value) - 1); });
  plusBtn  && plusBtn.addEventListener('click',  function () { update(parseInt(input.value) + 1); });
  input.addEventListener('change', function () { update(parseInt(this.value) || 1); });
  input.addEventListener('input',  function () { if (onChangeCallback) onChangeCallback(parseInt(this.value) || 1); });
};

/* ---- Smooth Scroll for anchor links ---- */
document.querySelectorAll('a[href^="#"]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
