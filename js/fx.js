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

  /* ---- E + Q: aurora ring around the profile photo; it flips on hover ---- */

  var avatar = document.querySelector('.profile-avatar');
  if (avatar) {
    var ring = document.createElement('span');
    ring.className = 'avatar-ring';
    var glow = document.createElement('span');
    glow.className = 'avatar-glow';
    glow.setAttribute('aria-hidden', 'true');
    var flip = document.createElement('span');
    flip.className = 'avatar-flip';
    var back = document.createElement('span');
    back.className = 'avatar-back';
    back.setAttribute('aria-hidden', 'true');
    back.innerHTML = '<img src="images/albums/arctic/thumb/me-aurora.jpg" alt="" loading="lazy"><span>UNDER THE AURORA</span>';
    avatar.parentNode.insertBefore(flip, avatar);
    flip.appendChild(ring);
    ring.appendChild(glow);
    ring.appendChild(avatar);
    ring.appendChild(back);
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

  /* ---- J: reading progress along the top edge ---- */

  var bar = document.createElement('div');
  bar.className = 'read-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var updateProgress = function () {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty('--progress', max > 0 ? Math.min(1, window.scrollY / max) : 0);
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  /* ---- K: section heading rules draw in when the heading is in view ---- */

  var headings = Array.prototype.slice.call(document.querySelectorAll('.prose h2'));
  if (reduce || !('IntersectionObserver' in window)) {
    headings.forEach(function (h) { h.classList.add('is-drawn'); });
  } else {
    var drawn = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-drawn');
          drawn.unobserve(e.target);
        }
      });
    }, { threshold: 1 });
    headings.forEach(function (h) { drawn.observe(h); });
  }

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

  /* ---- P: mountain ridge and aurora in the footer ---- */

  var footer = document.querySelector('.site-footer');
  if (footer) {
    var ridge = document.createElement('div');
    ridge.className = 'ridge';
    ridge.setAttribute('aria-hidden', 'true');
    ridge.innerHTML =
      '<div class="ridge-sky"><i></i><i></i><i></i></div>' +
      '<svg viewBox="0 0 1200 120" preserveAspectRatio="none">' +
      '<path class="ridge-far" d="M0 120V82L70 60L130 74L210 34L280 66L350 48L430 72L520 26L580 50L640 40L720 68L800 30L860 54L930 44L1010 70L1090 40L1150 60L1200 50V120Z"/>' +
      '<path class="ridge-near" d="M0 120V98L90 84L170 100L260 76L330 94L420 82L500 102L590 74L660 92L760 80L840 100L930 78L1010 94L1110 82L1200 96V120Z"/>' +
      '</svg>' +
      '<div class="ridge-band"></div>';
    footer.insertBefore(ridge, footer.firstChild);
  }

  /* ---- R: sheen on CORE A* / CCF A venue pills, staggered ---- */

  Array.prototype.slice.call(document.querySelectorAll('.pub-tag')).forEach(function (tag, i) {
    if (/A\*/.test(tag.textContent)) {
      tag.classList.add('is-top');
      tag.style.setProperty('--sheen-delay', (i * 0.4) + 's');
    }
  });

  /* ---- S: spotlight that follows the mouse over a paper ---- */

  pubs.forEach(function (li) {
    li.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = li.getBoundingClientRect();
      li.style.setProperty('--sx', (e.clientX - r.left + 12) + 'px');
      li.style.setProperty('--sy', (e.clientY - r.top + 10) + 'px');
      li.classList.add('is-spot');
    });
    li.addEventListener('pointerleave', function () { li.classList.remove('is-spot'); });
  });

  /* ---- U: easter egg, type "beren" ---- */

  var egg = document.createElement('div');
  egg.className = 'egg';
  egg.setAttribute('aria-hidden', 'true');
  egg.innerHTML = '<div class="egg-sky"></div>' +
    '<blockquote>Not all those who wander are lost.<cite>J.R.R. TOLKIEN</cite></blockquote>';
  document.body.appendChild(egg);
  var typed = '';
  var eggTimer = null;
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    typed = (typed + e.key.toLowerCase()).slice(-5);
    if (typed !== 'beren') return;
    egg.classList.add('is-on');
    clearTimeout(eggTimer);
    eggTimer = setTimeout(function () { egg.classList.remove('is-on'); }, 4200);
  });

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

  /* ---- X: live time in Amsterdam ----
     Sunrise and sunset come from the NOAA sunrise equation for Amsterdam
     (52.37 N, 4.90 E): daytime between them, evening from sunset until 22:00,
     night otherwise. */

  var contactList = document.querySelector('.contact-list');
  if (contactList && window.Intl) {
    var sunTimes = function (date, lat, lon) {
      var rad = Math.PI / 180;
      var J2000 = Date.UTC(2000, 0, 1, 12);
      var n = Math.round((date.getTime() - J2000) / 864e5 - lon / 360);
      var Jstar = n - lon / 360;
      var M = (357.5291 + 0.98560028 * Jstar) % 360;
      var C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
      var L = (M + C + 180 + 102.9372) % 360;
      var Jtransit = Jstar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
      var dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
      var cosH = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
      var H = Math.acos(Math.max(-1, Math.min(1, cosH))) / rad;
      return { rise: J2000 + (Jtransit - H / 360) * 864e5, set: J2000 + (Jtransit + H / 360) * 864e5 };
    };
    var clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

    var timeRow = document.createElement('li');
    timeRow.innerHTML = '<span><i class="lt-dot" aria-hidden="true"></i><span class="lt-text"></span></span>';
    contactList.appendChild(timeRow);
    var timeText = timeRow.querySelector('.lt-text');

    var tick = function () {
      var now = new Date();
      var hm = clock.format(now);
      var sun = sunTimes(now, 52.37, 4.90);
      var phase;
      if (now.getTime() >= sun.rise && now.getTime() < sun.set) phase = ['daytime', '#f5b94a'];
      else if (now.getTime() >= sun.set && +hm.slice(0, 2) < 22 && +hm.slice(0, 2) >= 12) phase = ['evening', '#c3a2f5'];
      else phase = ['night', '#8fb4ff'];
      timeRow.style.setProperty('--lt-color', phase[1]);
      timeText.textContent = hm + ' in Amsterdam, ' + phase[0];
    };
    tick();
    setInterval(tick, 30000);
  }
})();
