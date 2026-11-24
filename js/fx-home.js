/* Homepage-only effects; js/fx.js runs first and sets up the shared ones. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- B: masked-diffusion unmasking ----
     Each word starts as a [M] token and is revealed in random order,
     the way a masked diffusion language model fills in a sequence. */

  function tokenize(el) {
    var spans = [];
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType !== 3) return;
      var frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var s = document.createElement('span');
        s.setAttribute('data-word', part);
        s.textContent = part;
        frag.appendChild(s);
        spans.push(s);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return spans;
  }

  function unmask(spans, duration) {
    if (reduce) return;
    spans.forEach(function (s) {
      s.textContent = '[M]';
      s.classList.add('dm-mask');
    });
    var order = spans.map(function (s, i) { return i; });
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = order[i]; order[i] = order[j]; order[j] = t;
    }
    order.forEach(function (idx, k) {
      setTimeout(function () {
        var s = spans[idx];
        s.classList.remove('dm-mask');
        s.textContent = s.getAttribute('data-word');
      }, 120 + duration * (k + 1) / order.length);
    });
  }

  var nameLink = document.querySelector('.site-header h1 a');
  if (nameLink) {
    var nameTokens = tokenize(nameLink);
    unmask(nameTokens, 900);
    nameLink.addEventListener('mouseenter', function () { unmask(nameTokens, 700); });
  }
  Array.prototype.slice.call(document.querySelectorAll('.prose .kw')).forEach(function (el, i) {
    unmask(tokenize(el), 1400 + i * 60);
  });

  /* ---- N: highlighter sweep over key phrases, one after another ---- */

  var marks = Array.prototype.slice.call(document.querySelectorAll('.hl'));
  if (reduce || !('IntersectionObserver' in window)) {
    marks.forEach(function (m) { m.classList.add('is-lit'); });
  } else {
    var lit = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        setTimeout(function () { e.target.classList.add('is-lit'); }, 300 + marks.indexOf(e.target) * 450);
        lit.unobserve(e.target);
      });
    }, { threshold: 1 });
    marks.forEach(function (m) { lit.observe(m); });
  }

  /* ---- V: "Hello world!" types itself out ---- */

  var hello = document.querySelector('.hello');
  if (hello) {
    var greeting = hello.textContent;
    var caret = document.createElement('span');
    caret.className = 'hello-caret';
    caret.setAttribute('aria-hidden', 'true');
    hello.parentNode.insertBefore(caret, hello.nextSibling);
    if (!reduce) {
      hello.setAttribute('aria-label', greeting);
      hello.textContent = '';
      var shown = 0;
      var typeNext = function () {
        hello.textContent = greeting.slice(0, ++shown);
        if (shown < greeting.length) setTimeout(typeNext, 70 + Math.random() * 60);
      };
      setTimeout(typeNext, 450);
    }
  }

  /* ---- W: the gallery strip loops; the copy is hidden from assistive tech ---- */

  var stripTrack = document.querySelector('.strip-track');
  if (stripTrack && !reduce) {
    var stripRow = stripTrack.querySelector('.strip-row');
    Array.prototype.slice.call(stripRow.children).forEach(function (a) {
      var copy = a.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.setAttribute('tabindex', '-1');
      copy.querySelector('img').alt = '';
      stripRow.appendChild(copy);
    });
    stripTrack.classList.add('is-looping');
  }
})();
