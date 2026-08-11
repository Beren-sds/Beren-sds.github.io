(function () {
  'use strict';

  /* ---- theme ----
     The page is light for every first-time visitor, whatever the operating
     system is set to. Clicking the toggle pins a choice under 'theme-choice'
     in localStorage; the inline script in <head> re-applies it on the next
     page load before anything paints. That script also deletes the older
     'theme' key, so browsers still holding a value from before the light
     default was introduced start over at light. */

  var root = document.documentElement;
  var themeBtn = document.getElementById('theme-toggle');

  function activeTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function labelToggle() {
    var next = activeTheme() === 'dark' ? 'light' : 'dark';
    var text = 'Switch to ' + next + ' theme';
    themeBtn.setAttribute('aria-label', text);
    themeBtn.setAttribute('title', text);
  }

  if (themeBtn) {
    labelToggle();

    themeBtn.addEventListener('click', function () {
      var next = activeTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme-choice', next); } catch (e) {}
      labelToggle();
    });
  }

  /* ---- mobile nav ---- */

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---- lightbox ---- */

  var box = document.getElementById('lightbox');
  if (!box) return;

  var img = document.getElementById('lightbox-img');
  var caption = document.getElementById('lightbox-caption');
  var links = Array.prototype.slice.call(
    document.querySelectorAll('[data-lightbox-group] a')
  );
  if (!links.length) return;

  var index = -1;

  function show(i) {
    index = (i + links.length) % links.length;
    var link = links[index];
    img.src = link.getAttribute('href');
    img.alt = link.querySelector('img') ? link.querySelector('img').alt : '';
    caption.textContent = link.getAttribute('data-caption') || '';
  }

  function open(i) {
    show(i);
    box.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    box.classList.remove('is-open');
    document.body.style.overflow = '';
    img.src = '';
    index = -1;
  }

  links.forEach(function (link, i) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      open(i);
    });
  });

  box.querySelector('.lightbox-close').addEventListener('click', close);

  box.querySelector('.lightbox-prev').addEventListener('click', function (e) {
    e.stopPropagation();
    show(index - 1);
  });

  box.querySelector('.lightbox-next').addEventListener('click', function (e) {
    e.stopPropagation();
    show(index + 1);
  });

  box.addEventListener('click', function (e) {
    if (e.target === box || e.target === img) close();
  });

  document.addEventListener('keydown', function (e) {
    if (!box.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
  });
})();
