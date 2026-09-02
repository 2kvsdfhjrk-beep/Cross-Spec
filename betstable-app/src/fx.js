/* fx.js — the app's motion and celebration layer.

   Two rules everything here obeys:
     1. Motion has to mean something. Things move because a race is coming, a
        tip landed, a score changed — never because a page loaded.
     2. Anyone who asks for reduced motion gets the end state instantly, not a
        slower version of the show. */
(function (BS) {
  'use strict';
  const C = BS.core;

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- staggered entrances ----------
     Rows cascade in rather than appearing as a slab. Capped, so a 60-row list
     does not take three seconds to finish arriving. */
  function stagger(root, selector, step, max) {
    if (reduced() || !root) return;
    const items = C.$$(selector ||
      '.rows > *, .mod, .stat, .door, .runner, .region, .fixture, .tip-row, .board tbody tr', root);
    const s = step || 26, cap = max == null ? 14 : max;
    items.forEach(function (el, i) {
      el.style.setProperty('--d', Math.min(i, cap) * s + 'ms');
      el.classList.add('fx-in');
    });
  }

  /* ---------- numbers that roll ---------- */
  function countUp(el, target, opts) {
    const o = opts || {};
    const dp = o.dp || 0, prefix = o.prefix || '', suffix = o.suffix || '';
    const fmt = v => prefix + (o.sign && v > 0 ? '+' : '') + v.toFixed(dp) + suffix;
    if (reduced()) { el.textContent = fmt(target); return; }
    const dur = o.dur || 700, from = o.from || 0, start = performance.now();
    (function frame(t) {
      const k = Math.min(1, (t - start) / dur);
      // ease-out-quart: fast off the mark, settles gently
      el.textContent = fmt(from + (target - from) * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(frame);
    })(start);
  }

  /* ---------- confetti ----------
     Used for exactly one thing: a tip of yours coming in. If it fires for
     anything less it stops meaning anything. */
  const CONFETTI = {
    racing: ['#E0A83B', '#AF6E4B', '#0B7A0D', '#7F4228', '#F6F0E1', '#1E9B22'],
    football: ['#4A9FDA', '#F5A524', '#FFFFFF', '#2680BE', '#7CBCE8', '#12805A']
  };
  function confetti(opts) {
    if (reduced()) return;
    const o = opts || {};
    const colors = CONFETTI[o.theme || BS.ui.state.product] || CONFETTI.racing;
    const cv = document.createElement('canvas');
    cv.className = 'fx-canvas';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    const originX = o.x == null ? W / 2 : o.x, originY = o.y == null ? H * 0.42 : o.y;
    const n = o.count || 90;
    const bits = Array.from({ length: n }, function () {
      const a = (-90 + (Math.random() - 0.5) * 130) * Math.PI / 180;
      const sp = 7 + Math.random() * 12;
      return {
        x: originX, y: originY,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        w: 5 + Math.random() * 6, h: 8 + Math.random() * 8,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        col: colors[Math.floor(Math.random() * colors.length)],
        wob: Math.random() * Math.PI * 2
      };
    });
    const t0 = performance.now();
    (function frame(t) {
      const age = t - t0;
      ctx.clearRect(0, 0, W, H);
      bits.forEach(function (b) {
        b.vy += 0.38;                 // gravity
        b.vx *= 0.995;
        b.wob += 0.14;
        b.x += b.vx + Math.sin(b.wob) * 0.7;
        b.y += b.vy;
        b.rot += b.vr;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.globalAlpha = Math.max(0, 1 - age / 2100);
        ctx.fillStyle = b.col;
        // A slight squash as it tumbles reads as paper rather than pixels.
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.rot)));
        ctx.restore();
      });
      if (age < 2200) requestAnimationFrame(frame);
      else cv.remove();
    })(t0);
  }

  /* ---------- the stamp ----------
     Posting a tip is the one irreversible act in the app, so it gets the one
     piece of theatre: a seal comes down on the record. */
  function stamp(opts) {
    const o = opts || {};
    return new Promise(function (resolve) {
      if (reduced()) { resolve(); return; }
      const wrap = document.createElement('div');
      wrap.className = 'fx-stamp';
      wrap.innerHTML =
        '<span class="fx-stamp-ring"></span>' +
        '<span class="fx-stamp-mark">' + C.unwrap(BS.ui.mark('', { simple: true })) + '</span>' +
        '<span class="fx-stamp-word">' + C.esc(o.word || 'SEALED') + '</span>';
      document.body.appendChild(wrap);
      setTimeout(function () { wrap.classList.add('go'); }, 10);
      setTimeout(function () { wrap.classList.add('out'); }, 780);
      setTimeout(function () { wrap.remove(); resolve(); }, 1050);
    });
  }

  /* ---------- typing out a hash ---------- */
  function typeOut(el, text, speed) {
    if (!el) return;
    if (reduced()) { el.textContent = text; return; }
    el.textContent = '';
    let i = 0;
    const step = speed || 18;
    (function tick() {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(tick, step);
    })();
  }

  /* ---------- the run-in ----------
     A track with a runner on it, positioned by how close the next event is.
     It is a countdown you can read at a glance from across the room. */
  function runIn(startTs, now, windowMs) {
    const win = windowMs || 30 * 60000;
    const left = Math.max(0, startTs - now);
    // Progress along the track: 0 at the far end of the window, 1 at the post.
    const p = Math.max(0, Math.min(1, 1 - left / win));
    return { pct: p * 100, imminent: left < 3 * 60000, off: left <= 0 };
  }

  /* ---------- pressable feedback ---------- */
  function press(el) {
    if (reduced() || !el) return;
    el.classList.remove('fx-press');
    void el.offsetWidth;
    el.classList.add('fx-press');
    setTimeout(function () { el.classList.remove('fx-press'); }, 260);
  }

  /** A burst of small dots from a point — used when you follow someone. */
  function pop(el, color) {
    if (reduced() || !el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 8; i++) {
      const d = document.createElement('span');
      d.className = 'fx-dot';
      const a = (i / 8) * Math.PI * 2;
      d.style.left = cx + 'px';
      d.style.top = cy + 'px';
      d.style.setProperty('--dx', Math.cos(a) * 26 + 'px');
      d.style.setProperty('--dy', Math.sin(a) * 26 + 'px');
      if (color) d.style.background = color;
      document.body.appendChild(d);
      setTimeout(function () { d.remove(); }, 620);
    }
  }

  /* ---------- the run-in banner ----------
     Rendered once, then driven on a one-second tick so the runner creeps along
     without re-rendering the page underneath it. */
  let runInTimer = null;
  function banner(ev, product) {
    if (!ev) return C.raw('');
    // The marker is the runner's own silks — an asset the app already draws —
    // rather than a stock glyph from someone else's type foundry.
    const glyph = BS.icons.marker(product, ev.silk);
    return C.html`
      <button class="runin" data-act="go" data-route="${ev.route}" data-start="${ev.startTs}"
        aria-label="Next up: ${ev.name}">
        <span class="runin-top">
          <span class="runin-k">${product === 'football' ? 'Next kick-off' : 'Next off'}</span>
          <span class="runin-name">${ev.name}</span>
          <span class="runin-cd" data-cd>${C.countdown(ev.startTs)}</span>
        </span>
        <span class="runin-track">
          <span class="runin-rail"></span>
          <span class="runin-post"></span>
          <span class="runin-runner" data-runner>${glyph}</span>
        </span>
        <span class="runin-foot"><span>${ev.sub}</span></span>
      </button>`;
  }
  function mountBanner(root) {
    clearInterval(runInTimer);
    const el = C.$('.runin', root || document);
    if (!el) return;
    const startTs = +el.dataset.start;
    const runner = C.$('[data-runner]', el), cd = C.$('[data-cd]', el);
    const tick = function () {
      const now = Date.now();
      const s = runIn(startTs, now);
      runner.style.left = s.pct.toFixed(2) + '%';
      cd.textContent = s.off ? 'OFF' : C.countdown(startTs, now);
      el.classList.toggle('imminent', s.imminent && !s.off);
    };
    tick();
    runInTimer = setInterval(tick, 1000);
  }

  /** A loading state that says which product you are waiting on. */
  const loader = product => C.raw(
    '<div class="loader"><div class="loader-track"><span class="loader-rail"></span>' +
    '<span class="loader-runner">' + C.unwrap(BS.icons.marker(product)) + '</span></div>' +
    '<div class="loader-label">' + (product === 'football' ? 'Pulling in fixtures…' : 'Pulling in the cards…') + '</div></div>');

  BS.fx = { reduced, stagger, countUp, confetti, stamp, typeOut, runIn, press, pop, banner, mountBanner, loader };
})(window.BS = window.BS || {});
