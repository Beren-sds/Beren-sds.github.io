/* Homepage effects. Every effect respects prefers-reduced-motion. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = document.querySelector('.site-header');
  root.classList.add('fx');

  /* ---- A: aurora behind the header ---- */

  if (header) {
    var aurora = document.createElement('div');
    aurora.className = 'aurora';
    aurora.setAttribute('aria-hidden', 'true');
    aurora.innerHTML = '<i></i><i></i><i></i><i></i>';
    header.insertBefore(aurora, header.firstChild);
  }

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

  /* ---- C: publications fade in on scroll; figures tilt toward the cursor ---- */

  var pubs = Array.prototype.slice.call(document.querySelectorAll('.pub-list > li'));
  if (reduce || !('IntersectionObserver' in window)) {
    pubs.forEach(function (li) { li.classList.add('is-in'); });
  } else {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          seen.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    pubs.forEach(function (li, i) {
      li.style.transitionDelay = (i % 5) * 70 + 'ms';
      seen.observe(li);
    });
  }

  if (!reduce) {
    Array.prototype.slice.call(document.querySelectorAll('.pub-teaser')).forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        card.style.transform = 'perspective(600px) rotateX(' + (0.5 - py) * 14 + 'deg) rotateY(' + (px - 0.5) * 16 + 'deg) scale(1.06)';
        card.style.setProperty('--gx', px * 100 + '%');
        card.style.setProperty('--gy', py * 100 + '%');
        card.classList.add('is-tilted');
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
        card.classList.remove('is-tilted');
      });
    });
  }

  /* ---- D: attention network in the header ----
     Nodes drift slowly; within reach of the cursor each node gets an edge
     whose weight falls off with distance, like one row of an attention map. */

  if (header && window.HTMLCanvasElement) {
    var canvas = document.createElement('canvas');
    canvas.className = 'attn';
    canvas.setAttribute('aria-hidden', 'true');
    header.insertBefore(canvas, aurora ? aurora.nextSibling : header.firstChild);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 0, H = 0, nodes = [], query = { x: -999, y: -999 }, running = false;

    var size = function () {
      W = header.clientWidth;
      H = header.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = [];
      for (var i = 0, n = Math.round(W / 22); i < n; i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25
        });
      }
    };

    var rgba = function (a) {
      var hex = getComputedStyle(root).getPropertyValue('--key').trim();
      var v = parseInt(hex.slice(1), 16);
      return 'rgba(' + (v >> 16) + ',' + (v >> 8 & 255) + ',' + (v & 255) + ',' + a.toFixed(3) + ')';
    };

    var draw = function () {
      ctx.clearRect(0, 0, W, H);
      var reach = 150, i, j, a, b, d, w;
      if (!reduce) {
        nodes.forEach(function (p) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > W) p.vx *= -1;
          if (p.y < 0 || p.y > H) p.vy *= -1;
        });
      }
      ctx.lineWidth = 1;
      for (i = 0; i < nodes.length; i++) {
        for (j = i + 1; j < nodes.length; j++) {
          a = nodes[i]; b = nodes[j];
          d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 70) {
            ctx.strokeStyle = rgba(0.10 * (1 - d / 70));
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      nodes.forEach(function (p) {
        d = Math.hypot(p.x - query.x, p.y - query.y);
        w = d < reach ? Math.pow(1 - d / reach, 1.6) : 0;
        if (w > 0) {
          ctx.strokeStyle = rgba(0.55 * w);
          ctx.lineWidth = 0.6 + 2.2 * w;
          ctx.beginPath(); ctx.moveTo(query.x, query.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        }
        ctx.fillStyle = rgba(0.22 + 0.6 * w);
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 + 2.4 * w, 0, 2 * Math.PI); ctx.fill();
      });
      if (running) requestAnimationFrame(draw);
    };

    header.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = header.getBoundingClientRect();
      query.x = e.clientX - r.left;
      query.y = e.clientY - r.top;
      if (reduce) draw();
    });
    header.addEventListener('pointerleave', function () {
      query.x = query.y = -999;
      if (reduce) draw();
    });
    /* The header changes height when the mobile menu opens, so follow the
       header itself; a window resize alone would leave the canvas stretched. */
    var resized = function () { size(); if (reduce) draw(); };
    if ('ResizeObserver' in window) new ResizeObserver(resized).observe(header);
    else window.addEventListener('resize', resized);

    /* Animate only while the header is on screen. */
    if ('IntersectionObserver' in window && !reduce) {
      new IntersectionObserver(function (entries) {
        var visible = entries[0].isIntersecting;
        if (visible && !running) { running = true; requestAnimationFrame(draw); }
        if (!visible) running = false;
      }).observe(header);
    }

    size();
    draw();
  }

  /* ---- E: aurora ring around the profile photo ---- */

  var avatar = document.querySelector('.profile-avatar');
  if (avatar) {
    var ring = document.createElement('span');
    ring.className = 'avatar-ring';
    var glow = document.createElement('span');
    glow.className = 'avatar-glow';
    glow.setAttribute('aria-hidden', 'true');
    avatar.parentNode.insertBefore(ring, avatar);
    ring.appendChild(glow);
    ring.appendChild(avatar);
  }

  /* ---- I: snow over the page in dark mode ----
     The loop runs only while the dark theme is on and the tab is visible. */

  if (!reduce && window.HTMLCanvasElement) {
    var snow = document.createElement('canvas');
    snow.className = 'snow';
    snow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(snow);

    var sctx = snow.getContext('2d');
    var sdpr = Math.min(2, window.devicePixelRatio || 1);
    var SW = 0, SH = 0, flakes = [], snowing = false;

    var snowSize = function () {
      SW = window.innerWidth;
      SH = window.innerHeight;
      snow.width = SW * sdpr;
      snow.height = SH * sdpr;
      sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
      var n = Math.round(SW * SH / 9000);
      while (flakes.length < n) {
        flakes.push({
          x: Math.random() * SW, y: Math.random() * SH,
          r: 0.6 + Math.random() * 2.2, v: 0.25 + Math.random() * 0.8, phase: Math.random() * 6
        });
      }
      flakes.length = n;
    };

    var fall = function (t) {
      if (!snowing) return;
      sctx.clearRect(0, 0, SW, SH);
      flakes.forEach(function (f) {
        f.y += f.v;
        f.x += Math.sin(t / 1400 + f.phase) * 0.35;
        if (f.y > SH + 4) { f.y = -4; f.x = Math.random() * SW; }
        sctx.fillStyle = 'rgba(235, 240, 255, ' + (0.3 + f.r / 4.6).toFixed(3) + ')';
        sctx.beginPath();
        sctx.arc(f.x, f.y, f.r, 0, 2 * Math.PI);
        sctx.fill();
      });
      requestAnimationFrame(fall);
    };

    var updateSnow = function () {
      var want = root.getAttribute('data-theme') === 'dark' && !document.hidden;
      if (want && !snowing) { snowing = true; requestAnimationFrame(fall); }
      if (!want && snowing) { snowing = false; sctx.clearRect(0, 0, SW, SH); }
    };

    snowSize();
    window.addEventListener('resize', snowSize);
    document.addEventListener('visibilitychange', updateSnow);
    new MutationObserver(updateSnow).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    updateSnow();
  }
})();
