// YMPRESSME — Homepage cinematic interactivity
// Cursor spotlight, sticky-nav state, hero parallax, scroll reveal,
// and marquee track generation. Loaded only on index.html.

(function () {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  // ---------- Cursor spotlight ----------
  // Skip on touch devices and when reduced motion is preferred.
  var glow = document.getElementById('cursorGlow');
  if (glow && !prefersReduced && !isTouch) {
    window.addEventListener('mousemove', function (e) {
      glow.style.setProperty('--mx', e.clientX + 'px');
      glow.style.setProperty('--my', e.clientY + 'px');
    }, { passive: true });
  }

  // ---------- Sticky-nav backdrop on scroll ----------
  var nav = document.getElementById('navbar') || document.querySelector('.navbar');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 30);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------- Hero parallax ----------
  // Disabled on touch and when reduced motion is preferred.
  var stage = document.getElementById('heroStage');
  if (stage && !prefersReduced && !isTouch) {
    stage.addEventListener('mousemove', function (e) {
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      stage.querySelectorAll('[data-depth]').forEach(function (el) {
        var d = parseFloat(el.dataset.depth || 0);
        el.style.setProperty('--px', (x * 60 * d * 10) + 'px');
        el.style.setProperty('--py', (y * 60 * d * 10) + 'px');
      });
    }, { passive: true });
    stage.addEventListener('mouseleave', function () {
      stage.querySelectorAll('[data-depth]').forEach(function (el) {
        el.style.setProperty('--px', '0px');
        el.style.setProperty('--py', '0px');
      });
    });
  }

  // ---------- Reveal-on-scroll ----------
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) {
      io.observe(el);
    });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('in');
    });
  }

  // ---------- Marquee track ----------
  var track = document.getElementById('marqueeTrack');
  if (track) {
    var items = [
      { star: true,  text: 'No Setup Fees on Gang Sheets' },
      { star: false, text: 'Premium Quality Prints That Last' },
      { star: true,  text: 'Ships Nationwide Fast' },
      { star: false, text: 'Vibrant Colors That Pop & Last' },
      { star: true,  text: '48-Hour Rush Available' },
      { star: false, text: 'Friendly Local Service' },
      { star: true,  text: '100% Satisfaction Guarantee' }
    ];
    var html = items.map(function (i) {
      return '<div class="marquee-item">' +
        (i.star ? '<span class="star">★</span>' : '') +
        '<span>' + i.text + '</span>' +
      '</div>';
    }).join('');
    track.innerHTML = html + html;
  }
})();
