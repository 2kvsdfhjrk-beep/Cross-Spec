/* The homepage film. Everything is driven by the scroll position, frame by frame; with reduced motion
   (no .motion class) the page stays a plain, readable layout and only the header logic runs. */
import { initLightbox } from './lightbox.js';
import { setPoster, lazyPosters } from './posters.js';

function init() {
  'use strict';
  var doc = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return v < a ? a : v > b ? b : v; };
  var seg = function (v, a, b) { return clamp((v - a) / (b - a)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var E = {
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    in: function (t) { return t * t * t; },
    inOut: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    sine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    back: function (t) { var c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };
  function f1(n) { return n.toFixed(1); }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var motion = doc.classList.contains('motion');
  var archMQ = window.matchMedia('(min-width: 900px) and (min-aspect-ratio: 1/1)');
  var hoverMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
  var arch = archMQ.matches;

  initLightbox('.tile-btn[data-full]');

  /* ---------- videos: nothing streams until the page has loaded, so the first screen arrives first ---------- */
  var vHero = $('.hero-video'), vOven = $('.win-oven video'), vDessert = $('.win-dessert video'), vInside = $('.gal-video');
  var autoplayBlocked = false, pageLoaded = document.readyState === 'complete';
  function play(v, on) {
    if (!v) return;
    if (on) {
      if (!v.paused || v._pending || autoplayBlocked) return;
      v._pending = true;
      var p = v.play();
      if (p && p.then) p.then(function () { v._pending = false; }, function (err) { v._pending = false; if (err && err.name === 'NotAllowedError') autoplayBlocked = true; });
      else v._pending = false;
    } else if (!v.paused) v.pause();
  }
  function warm(v) { if (v && v.preload !== 'auto') { setPoster(v); v.preload = 'auto'; } }
  ['touchstart', 'pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { autoplayBlocked = false; }, { passive: true }); });
  if (vHero) vHero.addEventListener('playing', function () { vHero.classList.add('on'); });

  /* ---------- in-page links ---------- */
  var story = $('.story'), stage = $('.stage'), loyal = $('.loyal'), gal = $('.gallery'), menu = $('.teaser'), hero = $('.hero'), cta = $('.cta');
  var vh = window.innerHeight, storyTop = 0, storyLen = 720, loyalTop = 0, loyalH = 0, galTop = 0, galDist = 0, galH = 0;
  var menuTop = 0, menuBottom = 0, heroH = 0, ctaTop = 0, ctaH = 0, docH = 0, innerH = window.innerHeight;
  var STOPS = { story: 150, kitchen: 385, desserts: 590 };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1), y = null;
    if (!id) return;
    if (id === 'top') y = 0;
    else if (motion && STOPS[id] !== undefined) y = storyTop + (STOPS[id] - 100) / 100 * vh;
    else if (motion && id === 'loyalty') y = loyalTop + (loyalH - vh) * 0.62;
    else {
      var el = document.getElementById(id);
      if (el) y = el.getBoundingClientRect().top + window.scrollY;
    }
    if (y === null) return;
    e.preventDefault();
    window.scrollTo({ top: Math.max(0, y), behavior: motion ? 'smooth' : 'auto' });
  });

  /* ---------- reveals ---------- */
  if (motion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.rv, .rise, .foot-word').forEach(function (el) { io.observe(el); });
  } else $$('.rv, .rise, .foot-word').forEach(function (el) { el.classList.add('in'); });
  /* looping animations (badge, banner, waving mascot, button shine) stop while their section is off screen */
  if ('IntersectionObserver' in window) {
    var animIO = new IntersectionObserver(function (es) { es.forEach(function (en) { en.target.classList.toggle('anim-off', !en.isIntersecting); }); });
    $$('.hero, .cta, .foot').forEach(function (el) { animIO.observe(el); });
  }

  var nav = $('#nav'), heroContent = $('.hero-content'), navPz = $('.nav-pz'), eatenShown = -1;
  var S = null, L = 0, G = 0;
  function navState(sy) {
    var y = typeof sy === 'number' ? sy : window.scrollY, line = y + 40;
    doc.classList.toggle('scrolled', y > heroH * 0.7);
    /* the little pizza in the bar gets eaten a slice at a time as you scroll down */
    var eaten = Math.min(8, Math.floor(clamp(y / Math.max(1, docH - innerH)) * 8 + 0.02));
    if (eaten !== eatenShown && navPz) { navPz.style.setProperty('--left', (360 - eaten * 45) + 'deg'); eatenShown = eaten; }
    var light = (line > menuTop && line < menuBottom) || (line > loyalTop && line < loyalTop + loyalH) || (motion && S !== null && S > 86 && S < 300);
    nav.classList.toggle('on-paper', light);
  }

  if (!motion) {
    if (vInside) vInside.controls = true;
    lazyPosters();
    var measureStatic = function () {
      heroH = hero.offsetHeight;
      menuTop = menu.getBoundingClientRect().top + window.scrollY; menuBottom = menuTop + menu.offsetHeight;
      loyalTop = loyal.getBoundingClientRect().top + window.scrollY; loyalH = loyal.offsetHeight;
      docH = document.documentElement.scrollHeight; innerH = window.innerHeight;
      navState();
    };
    measureStatic();
    window.addEventListener('scroll', function () { navState(); }, { passive: true });
    window.addEventListener('resize', measureStatic);
    return;
  }

  /* ---------- the film: elements ---------- */
  var pzWrap = $('.pizza-wrap'), pzMove = $('.pz-move'), pzTilt = $('.pz-tilt'), pzSpin = $('.pz-spin'), ring = $('.ring');
  var lots = $('.lots'), stBg = $('.st-bg'), chKick = $('.ch-kicker'), letters = $$('.word .ch'), pzInfo = $('.pz-info');
  var ovenWin = $('.win-oven'), ovenIn = $('.win-oven .win-in');
  var desWin = $('.win-dessert'), desIn = $('.win-dessert .win-in'), drip = $('.drip'), dripTop = $('.drip .drip-top'), dripSh = $('.drip .drip-sh');
  var domeEl = $('.dome'), lastDome = -1;
  var copyK = $('.copy-k'), copyD = $('.copy-d');
  var linesK = $$('.copy-k .ln').concat([$('.copy-k .copy-side')]), linesD = $$('.copy-d .ln');
  var statEls = $$('.stats b'), flavs = $$('.flavours li'), sideD = $('.copy-d .copy-side');
  var tkEls = $$('.tk'), wordEl = $('.word'), tbProbe = $('.tb-probe');
  var W = 0, H = 0, winW = 0, winH = 0, pzR = 0, drips = [], wavePh = 0;
  /* TB: height hidden behind the phone's browser bars. PCX/PCY: where the pizza rests. The band is the free space
     between the headline and the name panel, which the pizza, its tags and the loose pepperoni must stay inside. */
  var TB = 0, PCX = 0, PCY = 0, bandTop = 0, bandBottom = 0, panel = null;
  statEls.forEach(function (el) { el.textContent = '0'; });

  /* pepperoni that falls onto the pizza (12) or hangs in the air at the edges (5) */
  var sprites = $$('.spr').map(function (el, si) {
    var land = si < 12;
    return { el: el, land: land, soft: !land && si % 3 === 0 };
  });
  /* menu tags: desktop arcs them over the pizza, phones stick them on its rim (offsets in pizza radii) */
  var TK_DESK = [{ a: -2.64, r: 1.4 }, { a: -1.57, r: 1.25 }, { a: -0.5, r: 1.4 }];
  var TK_PHONE = [{ x: -0.5, y: -0.8 }, { x: 0.58, y: 0.04 }, { x: -0.56, y: 0.78 }];
  var FLOAT_PHONE = [{ side: 1, y: -0.78 }, { side: -1, y: 0.04 }, { side: 1, y: 0.84 }];
  var TK = [
    { from: [-1, -0.5], fromP: [-1, -0.45], s0: 62, rot: -7 },
    { from: [0.3, -1], fromP: [1, -0.05], s0: 74, rot: 4 },
    { from: [1, 0.6], fromP: [-1, 0.55], s0: 86, rot: 6 }
  ];
  /* keep a centre-relative y inside the band for an item of height h */
  function inBand(y, h) {
    var lo = bandTop - PCY + h / 2 + 2, hi = bandBottom - PCY - h / 2 - 2;
    return lo > hi ? (lo + hi) / 2 : clamp(y, lo, hi);
  }
  function hitsPanel(x, y, d) {
    if (!panel) return false;
    return x + d / 2 > panel.x0 && x - d / 2 < panel.x1 && y + d / 2 > panel.y0 && y - d / 2 < panel.y1;
  }
  function layoutChapter() {
    if (arch) {
      stage.style.removeProperty('--pz'); pzWrap.style.top = ''; lots.style.top = '';
      PCX = W / 2; PCY = H / 2; bandTop = 0; bandBottom = H;
    } else {
      var wb = wordEl.offsetTop + wordEl.offsetHeight;
      lots.style.top = f1(wb - 4) + 'px';
      var top = Math.max(wb, wb - 4 + lots.offsetHeight) + 8, bot = pzInfo.offsetTop - 14, band = bot - top, size;
      if (band >= 190) size = Math.min(W * 0.76, band * 0.84);
      else { size = Math.min(W * 0.5, (H - TB) * 0.5); top = (H - TB) / 2 - size * 0.62; bot = (H - TB) / 2 + size * 0.62; }
      stage.style.setProperty('--pz', f1(size) + 'px');
      PCX = W / 2; PCY = (top + bot) / 2; bandTop = top; bandBottom = bot;
      pzWrap.style.top = f1(PCY) + 'px';
    }
    panel = { x0: pzInfo.offsetLeft - PCX - 18, x1: pzInfo.offsetLeft + pzInfo.offsetWidth - PCX + 18,
              y0: pzInfo.offsetTop - PCY - 18, y1: pzInfo.offsetTop + pzInfo.offsetHeight - PCY + 18 };
  }
  function layoutSprites() {
    var rnd = rng(91), fl = 0;
    sprites.forEach(function (sp, i) {
      sp.skip = false;
      sp.el.style.display = '';
      sp.el.classList.toggle('soft', sp.soft && arch);
      if (sp.land) {
        sp.d = pzR * (0.21 + rnd() * 0.05);
        var a = rnd() * 6.283, r = Math.sqrt(0.06 + rnd() * 0.94) * pzR * 0.6;
        sp.x1 = Math.cos(a) * r; sp.y1 = Math.sin(a) * r;
        sp.x0 = sp.x1 * 0.3 + (rnd() - 0.5) * W * 0.95; sp.y0 = -H * 0.55 - pzR * 0.5 - rnd() * H * 0.4;
        sp.s0 = 2 + i * 7 + rnd() * 6; sp.s1 = sp.s0 + 64 + rnd() * 22;
        sp.k0 = 1.7 + rnd() * 0.9;
      } else {
        var side;
        if (!arch) {
          var slot = FLOAT_PHONE[fl++];
          if (!slot) { sp.skip = true; sp.el.style.display = 'none'; return; }
          sp.d = pzR * (0.34 + rnd() * 0.08); side = slot.side;
          sp.x1 = side * (W * 0.5 - sp.d * 0.3);
          sp.y1 = inBand(slot.y * pzR, sp.d);
        } else {
          sp.d = pzR * (0.3 + rnd() * 0.2) * (sp.soft ? 1.6 : 1); side = i % 2 ? 1 : -1;
          sp.x1 = side * (W * 0.5 - sp.d * (0.15 + rnd() * 0.45));
          for (var tries = 0; tries < 12; tries++) { sp.y1 = (rnd() - 0.3) * H * 0.42; if (!hitsPanel(sp.x1, sp.y1, sp.d)) break; }
          if (hitsPanel(sp.x1, sp.y1, sp.d)) { sp.skip = true; sp.el.style.display = 'none'; }
        }
        sp.x0 = sp.x1 + side * W * 0.25; sp.y0 = -H * 0.8 - rnd() * H * 0.3;
        sp.s0 = 6 + rnd() * 46; sp.s1 = sp.s0 + 95;
        sp.k0 = 1;
      }
      sp.rx = (rnd() - 0.5) * 150; sp.ry = (rnd() - 0.5) * 150; sp.rz0 = rnd() * 360; sp.rz1 = sp.rz0 + (rnd() - 0.5) * 220;
      sp.sway = (rnd() - 0.5) * pzR * 0.9; sp.ph = rnd() * 6.283;
      sp.el.style.width = sp.el.style.height = f1(sp.d) + 'px';
    });
    TK.forEach(function (tk, i) {
      var el = tkEls[i], x, y; tk.w = el.offsetWidth; tk.h = el.offsetHeight;
      if (arch) { var pd = TK_DESK[i]; x = Math.cos(pd.a) * pd.r * pzR; y = Math.sin(pd.a) * pd.r * pzR; }
      else { var pp = TK_PHONE[i]; x = pp.x * pzR; y = inBand(pp.y * pzR, tk.h); }
      var lim = W / 2 - tk.w / 2 - 10;
      tk.x = clamp(x, -lim, lim); tk.y = y;
    });
  }

  function makeDrips(Wd) {
    var rnd = rng(31), n = Wd < 560 ? 5 : 6, weights = [], sum = 0, i;
    for (i = 0; i < n; i++) { var wv = 0.7 + rnd() * 0.9; weights.push(wv); sum += wv; }
    drips = []; var x = 0;
    for (i = 0; i < n; i++) {
      var cell = Wd * weights[i] / sum, w = cell * (0.34 + rnd() * 0.17);
      drips.push({ cx: x + cell / 2 + (rnd() - 0.5) * cell * 0.12, r: w / 2, L: 0.18 + rnd() * 0.82 });
      x += cell;
    }
    drips.reverse();
    wavePh = rnd() * 6.28;
  }
  function edge(Wd, yb, maxL, grow, rK, lenK) {
    var wave = function (x) { return 9 * Math.sin(x / Wd * 9.4 + wavePh); };
    var px = Wd + 6, py = yb + wave(px), s = 'L' + f1(px) + ',' + f1(py);
    for (var i = 0; i < drips.length; i++) {
      var k = drips[i], r = k.r * rK, len = Math.max(r * 1.25, k.L * maxL * grow * lenK), neck = r * 0.9;
      var xR = k.cx + r, xL = k.cx - r, y0 = yb + wave(k.cx), x2 = xR + neck, dx = (px - x2) / 2;
      var yN = y0 + Math.min(len - r, neck), yE = y0 + len - r;
      s += 'C' + f1(px - dx) + ',' + f1(py) + ' ' + f1(x2 + dx) + ',' + f1(y0) + ' ' + f1(x2) + ',' + f1(y0) +
        'C' + f1(xR) + ',' + f1(y0) + ' ' + f1(xR) + ',' + f1(y0 + neck * 0.3) + ' ' + f1(xR) + ',' + f1(yN) +
        'L' + f1(xR) + ',' + f1(yE) + 'A' + f1(r) + ',' + f1(r) + ' 0 0 1 ' + f1(xL) + ',' + f1(yE) +
        'L' + f1(xL) + ',' + f1(yN) + 'C' + f1(xL) + ',' + f1(y0 + neck * 0.3) + ' ' + f1(xL) + ',' + f1(y0) + ' ' + f1(xL - neck) + ',' + f1(y0);
      px = xL - neck; py = y0;
    }
    var ex = -6, ey = yb + wave(ex), ddx = (px - ex) / 2;
    return s + 'C' + f1(px - ddx) + ',' + f1(py) + ' ' + f1(ex + ddx) + ',' + f1(ey) + ' ' + f1(ex) + ',' + f1(ey);
  }
  function buildDrip(Wd, Hd, d) {
    var maxL = Math.min(Hd * 0.3, 300), band = Math.max(70, Math.min(Hd * 0.15, 150));
    var grow = 0.2 + 0.8 * E.out(seg(d, 0, 0.55));
    var ybA = lerp(-maxL - 40, Hd + band + 40, E.inOut(d)), ybB = ybA - band;
    var top = 'M-6,-6L' + f1(Wd + 6) + ',-6';
    return { cream: top + edge(Wd, ybA, maxL, grow, 1, 1) + 'Z', clip: top + edge(Wd, ybB, maxL, grow, 0.78, 0.42) + 'Z' };
  }
  function setClip(el, v) { el.style.clipPath = v; el.style.webkitClipPath = v; }

  /* ---------- loyalty card ---------- */
  var card3d = $('.card3d'), scene = $('.card-scene'), freeSlot = $('.free'), burst = $('.burst'), lcN = $('.lc-n');
  var loyalCopy = $$('.loyal-copy > *');
  var stamps = $$('.slots .stamp').map(function (el, i) { return { el: el, rot: [-14, 9, -5, 16, -10, 6, -17, 11, -3][i % 9] }; });
  var confetti = (function () {
    var rnd = rng(5);
    return $$('.confetti').map(function (el, i) {
      return { el: el, a: -2.9 + i * 0.36 + (rnd() - 0.5) * 0.3, dist: 0.32 + rnd() * 0.3, spin: (rnd() - 0.5) * 540, r0: rnd() * 360 };
    });
  })();
  var tiltX = 0, tiltY = 0, tiltTX = 0, tiltTY = 0, shownCount = -1;
  loyal.addEventListener('pointermove', function (e) {
    if (!hoverMQ.matches) return;
    var r = scene.getBoundingClientRect();
    tiltTY = clamp((e.clientX - (r.left + r.width / 2)) / r.width, -1, 1) * 12;
    tiltTX = clamp((e.clientY - (r.top + r.height / 2)) / r.height, -1, 1) * -10;
  });
  loyal.addEventListener('pointerleave', function () { tiltTX = tiltTY = 0; });

  /* ---------- gallery ---------- */
  var track = $('.gal-track'), tiles = $$('.tile'), tileImgs = tiles.map(function (t) { return t.querySelector('img, video'); }), tileC = [];
  var tileBtns = $$('.tile-btn'), gPrev = 0, skew = 0, lastDt = 0.016, lastSkew = '', galEager = false;
  /* sizes read once per resize, never inside the animation loop (reading them there forces a full layout every frame) */
  var sceneW = 0, sceneH = 0, viewW = 0;
  var ctaBg = $('.cta-bg');

  /* ---------- desktop: cursor ring and magnetic buttons ---------- */
  var cur = $('.cursor'), curOn = false, curX = -200, curY = -200, curTX = -200, curTY = -200;
  if (cur && hoverMQ.matches) {
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      curTX = e.clientX; curTY = e.clientY;
      if (!curOn) { curX = curTX; curY = curTY; curOn = true; cur.classList.add('on'); }
      var tgt = e.target, v = tgt.closest && tgt.closest('.tile-btn[data-full]');
      var l = !v && tgt.closest && tgt.closest('a, button, input, textarea, label, select, summary');
      cur.classList.toggle('view', !!v); cur.classList.toggle('link', !!l);
    }, { passive: true });
    doc.addEventListener('mouseleave', function () { curOn = false; cur.classList.remove('on'); });
    $$('.eq').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = b.getBoundingClientRect();
        b.style.translate = f1((e.clientX - r.left - r.width / 2) * 0.22) + 'px ' + f1((e.clientY - r.top - r.height / 2) * 0.32) + 'px';
      });
      b.addEventListener('pointerleave', function () { b.style.translate = ''; });
    });
  }

  function measure() {
    arch = archMQ.matches;
    vh = stage.offsetHeight || window.innerHeight;
    track.style.transform = 'none';
    galDist = Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
    gal.style.height = Math.round(galDist + vh) + 'px';
    tileC = tiles.map(function (t) { return t.offsetLeft + t.offsetWidth / 2; });
    storyTop = story.getBoundingClientRect().top + window.scrollY;
    storyLen = story.offsetHeight / vh * 100;
    W = stage.offsetWidth; H = vh;
    TB = tbProbe ? tbProbe.offsetHeight : 0;
    winW = ovenWin.offsetWidth; winH = ovenWin.offsetHeight;
    layoutChapter();
    pzR = pzWrap.offsetWidth / 2;
    heroH = hero.offsetHeight;
    docH = document.documentElement.scrollHeight; innerH = window.innerHeight;
    menuTop = menu.getBoundingClientRect().top + window.scrollY; menuBottom = menuTop + menu.offsetHeight;
    loyalTop = loyal.getBoundingClientRect().top + window.scrollY; loyalH = loyal.offsetHeight;
    galTop = gal.getBoundingClientRect().top + window.scrollY; galH = gal.offsetHeight;
    ctaTop = cta.getBoundingClientRect().top + window.scrollY; ctaH = cta.offsetHeight;
    sceneW = scene.offsetWidth; sceneH = scene.offsetHeight; viewW = document.documentElement.clientWidth;
    drip.setAttribute('viewBox', '0 0 ' + winW + ' ' + winH);
    makeDrips(winW);
    layoutSprites();
    dirty = true;
  }

  var last = performance.now(), dirty = true, statShown = statEls.map(function () { return -1; });
  var lastDrip = -1, lastClip = '', lastS = null;

  function renderStory(S, t) {
    /* the cream edge swells into a dome as it rises over the kiosk, then lands flat; nothing shows at rest */
    var ds = seg(S, 0, 100), dome = 6.8 * ds * (1 - ds) * (1 - ds);
    if (dome !== lastDome) { domeEl.style.transform = 'translateY(-100%) scaleY(' + dome.toFixed(4) + ')'; lastDome = dome; }
    stBg.style.opacity = arch ? (1 - seg(S, 258, 322)).toFixed(3) : '1';

    /* the pizza: rises tilted, turns a full 360 and lies flat */
    var y = (1 - E.out(seg(S, 0, 100))) * vh * 0.6;
    var tilt = 58 * (1 - E.inOut(seg(S, 0, 175)));
    var spin = -360 * (1 - E.inOut(seg(S, 0, 205))) + 46 * seg(S, 205, 335);
    var fly = E.in(seg(S, 236, 330)), bump = 0;
    sprites.forEach(function (sp) { if (!sp.land) return; var b = (S - sp.s1) / 9; if (b > 0 && b < 1) bump += Math.sin(b * Math.PI) * (1 - b); });
    var sc = lerp(0.56, 1, E.inOut(seg(S, 0, 175))) * (1 + 0.045 * E.sine(seg(S, 175, 236))) * (1 + 3.7 * fly) * (1 + 0.016 * Math.min(bump, 1.5));
    pzMove.style.transform = 'translate3d(0,' + f1(y) + 'px,0) scale(' + sc.toFixed(4) + ')';
    pzTilt.style.transform = 'rotateX(' + tilt.toFixed(2) + 'deg)';
    pzSpin.style.transform = 'rotate(' + spin.toFixed(2) + 'deg)';
    pzWrap.style.opacity = (1 - (arch ? seg(S, 272, 308) : seg(S, 298, 330))).toFixed(3);
    pzWrap.style.visibility = S > 332 ? 'hidden' : 'visible';
    ring.style.opacity = (seg(S, 30, 110) * (1 - seg(S, 178, 222))).toFixed(3);
    ring.style.transform = 'rotate(' + (-spin * 0.4 + t * 0.005).toFixed(2) + 'deg)';

    /* chapter label, giant word, "(lots)" and the name card */
    chKick.style.opacity = (seg(S, 40, 90) * (1 - seg(S, 212, 248))).toFixed(3);
    letters.forEach(function (el, i) {
      var a = E.out(seg(S, 14 + i * 6, 70 + i * 6)), o = E.in(seg(S, 196 + i * 2, 230 + i * 2));
      el.style.transform = 'translate3d(0,' + ((1 - a) * 108 + o * 60).toFixed(1) + '%,0)';
      el.style.opacity = (1 - o).toFixed(3);
    });
    var ci = E.back(seg(S, 104, 142)), co = seg(S, 186, 218);
    lots.style.opacity = (seg(S, 104, 122) * (1 - co)).toFixed(3);
    lots.style.transform = 'translate3d(0,' + f1((1 - ci) * 34 - co * 20) + 'px,0) rotate(-9deg) scale(' + ((0.55 + 0.45 * ci) * (1 + co * 0.25)).toFixed(3) + ')';
    var pin = E.out(seg(S, 108, 150)), pout = E.in(seg(S, 180, 212));
    pzInfo.style.opacity = (pin * (1 - pout)).toFixed(3);
    pzInfo.style.transform = 'translate3d(0,' + f1((1 - pin) * 30 - pout * 24) + 'px,0)';
    pzInfo.style.visibility = S > 104 && S < 214 ? 'visible' : 'hidden';

    /* pepperoni rain */
    var cx = PCX, cy = PCY + y, tc = Math.cos(tilt * Math.PI / 180), fo = E.in(seg(S, 186, 252));
    sprites.forEach(function (sp) {
      if (sp.skip) return;
      var tt = seg(S, sp.s0, sp.s1), x, yy, k, op, rx, ry, rz;
      if (sp.land) {
        if (tt <= 0 || tt >= 1) { if (sp.on) { sp.el.style.opacity = '0'; sp.on = false; } return; }
        var e = E.inOut(tt);
        x = lerp(sp.x0, sp.x1 * sc, E.out(tt)) + Math.sin(tt * 3.2 + sp.ph) * sp.sway * (1 - tt);
        yy = lerp(sp.y0, sp.y1 * sc * tc, e);
        k = lerp(sp.k0, sc, e); op = 1 - seg(tt, 0.86, 1);
        rx = sp.rx * (1 - e) + tilt * e; ry = sp.ry * (1 - e); rz = lerp(sp.rz0, sp.rz1, e);
      } else {
        if (tt <= 0 || fo >= 1) { if (sp.on) { sp.el.style.opacity = '0'; sp.on = false; } return; }
        var e2 = E.out(tt);
        x = lerp(sp.x0, sp.x1, e2) + Math.sin(t * 0.0007 + sp.ph) * 7 * tt + Math.sign(sp.x1 || 1) * fo * W * 0.45;
        yy = lerp(sp.y0, sp.y1, e2) + Math.cos(t * 0.0009 + sp.ph) * 10 * tt - fo * H * 0.15;
        k = 1 + fo * 0.5; op = 1 - fo;
        rx = sp.rx * (1 - e2) + Math.sin(t * 0.0006 + sp.ph) * 14; ry = sp.ry * (1 - e2); rz = lerp(sp.rz0, sp.rz1, e2) + t * 0.004;
      }
      sp.on = true;
      sp.el.style.opacity = op.toFixed(3);
      sp.el.style.transform = 'translate3d(' + f1(cx + x - sp.d / 2) + 'px,' + f1(cy + yy - sp.d / 2) + 'px,0) rotateX(' + rx.toFixed(1) + 'deg) rotateY(' + ry.toFixed(1) + 'deg) rotate(' + rz.toFixed(1) + 'deg) scale(' + k.toFixed(3) + ')';
    });

    /* menu tags orbiting the pizza */
    TK.forEach(function (tk, i) {
      var el = tkEls[i], tin = E.out(seg(S, tk.s0, tk.s0 + 46)), tout = E.in(seg(S, 176 + i * 5, 212 + i * 5));
      if (tin <= 0 || tout >= 1) { el.style.opacity = '0'; return; }
      var fr = arch ? tk.from : tk.fromP, fx = fr[0] * W * 0.75, fy = fr[1] * H * 0.6;
      var x = lerp(fx, tk.x, tin) + Math.sin(t * 0.0009 + i) * 5 + fr[0] * tout * W * 0.6;
      var yy = lerp(fy, tk.y * sc, tin) + Math.cos(t * 0.0011 + i * 2) * 6 - tout * 50;
      el.style.opacity = (tin * (1 - tout)).toFixed(3);
      el.style.transform = 'translate3d(' + f1(cx + x - tk.w / 2) + 'px,' + f1(cy + yy - tk.h / 2) + 'px,0) rotate(' + lerp(tk.rot * 3, tk.rot, tin).toFixed(2) + 'deg)';
    });

    /* the toppings open into the oven, the crust flies past */
    var open = E.out(seg(S, 182, 242));
    var r = 0.8 * pzR * sc * open, cover, at;
    if (arch) { cover = Math.sqrt(winW * winW + winH * winH) / 2 + 2; at = '50% 50%'; }
    else { var ddx = Math.max(PCX, winW - PCX), ddy = Math.max(cy, winH - cy); cover = Math.sqrt(ddx * ddx + ddy * ddy) + 2; at = f1(PCX) + 'px ' + f1(cy) + 'px'; }
    ovenWin.style.visibility = r > 0.5 && S < 545 ? 'visible' : 'hidden';
    var clip = r >= cover ? 'none' : 'circle(' + f1(r) + 'px at ' + at + ')';
    if (clip !== lastClip) { setClip(ovenIn, clip); lastClip = clip; }
    if (S > 5) setPoster(vOven);
    if (S > 40) warm(vOven);
    play(vOven, S > 150 && S < 545);

    /* kitchen copy */
    var kOut = E.in(seg(S, 432, 470));
    linesK.forEach(function (el, i) {
      var a = E.out(seg(S, 318 + i * 9, 356 + i * 9));
      el.style.opacity = (a * (1 - kOut)).toFixed(3);
      el.style.transform = 'translate3d(0,' + f1((1 - a) * 44 - kOut * 56) + 'px,0)';
    });
    copyK.style.visibility = S > 312 && S < 472 ? 'visible' : 'hidden';
    var cnt = E.out(seg(S, 336, 405));
    statEls.forEach(function (el, i) {
      var n = Math.round(cnt * +el.getAttribute('data-n'));
      if (n !== statShown[i]) { el.textContent = n; statShown[i] = n; }
    });

    /* white-chocolate drip onto the dessert tray */
    var d = seg(S, 440, 530);
    desWin.style.visibility = d > 0 ? 'visible' : 'hidden';
    if (d !== lastDrip) {
      lastDrip = d;
      if (d >= 1) { setClip(desIn, 'none'); dripTop.setAttribute('d', 'M0 0'); dripSh.setAttribute('d', 'M0 0'); }
      else if (d > 0) { var dp = buildDrip(winW, winH, d); setClip(desIn, "path('" + dp.clip + "')"); dripTop.setAttribute('d', dp.cream); dripSh.setAttribute('d', dp.cream); }
    }
    if (S > 200) setPoster(vDessert);
    if (S > 330) warm(vDessert);
    play(vDessert, S > 425);

    /* dessert copy */
    linesD.forEach(function (el, i) {
      var a = E.out(seg(S, 508 + i * 9, 548 + i * 9));
      el.style.opacity = a.toFixed(3);
      el.style.transform = 'translate3d(0,' + f1((1 - a) * 44) + 'px,0)';
    });
    var sa = E.out(seg(S, 530, 566));
    sideD.style.opacity = sa.toFixed(3);
    sideD.style.transform = 'translate3d(0,' + f1((1 - sa) * 30) + 'px,0)';
    flavs.forEach(function (el, i) {
      var a = E.out(seg(S, 532 + i * 6, 566 + i * 6));
      el.style.transform = 'translate3d(' + f1((1 - a) * (arch ? 40 : 0)) + 'px,' + f1((1 - a) * (arch ? 0 : 16)) + 'px,0)';
      el.style.opacity = a.toFixed(3);
    });
    copyD.style.visibility = S > 502 ? 'visible' : 'hidden';
  }

  function renderLoyal(L) {
    var ein = E.out(seg(L, 0, 0.2)), flip = E.inOut(seg(L, 0.22, 0.42)) * 180, thud = 0, count = 0;
    loyalCopy.forEach(function (el, i) {
      var a = E.out(seg(L, 0.02 + i * 0.03, 0.17 + i * 0.03));
      el.style.opacity = a.toFixed(3); el.style.transform = 'translate3d(0,' + f1((1 - a) * 30) + 'px,0)';
    });
    stamps.forEach(function (st, i) {
      var s0 = 0.46 + i * 0.044, a = seg(L, s0, s0 + 0.022);
      st.el.style.opacity = a > 0 ? '1' : '0';
      st.el.style.transform = 'translate(-50%,-50%) rotate(' + st.rot + 'deg) scale(' + lerp(2.1, 1, E.out(a)).toFixed(3) + ')';
      var b = L - (s0 + 0.022);
      if (b > 0 && b < 0.03) thud += Math.sin(b / 0.03 * Math.PI) * (1 - b / 0.03);
      if (a >= 1) count++;
    });
    var won = seg(L, 0.87, 0.91);
    card3d.style.transform = 'translate3d(0,' + f1((1 - ein) * 150 + thud * 7) + 'px,0) rotateX(' + (lerp(26, 6, ein) + tiltX).toFixed(2) + 'deg) rotateY(' + (flip + tiltY).toFixed(2) + 'deg) rotateZ(' + lerp(-15, -4, ein).toFixed(2) + 'deg) scale(' + lerp(0.78, 1, ein).toFixed(3) + ')';
    freeSlot.classList.toggle('won', won > 0.5);
    burst.style.transform = 'rotate(' + (L * 240).toFixed(1) + 'deg) scale(' + (1 + won * 0.28).toFixed(3) + ')';
    if (count !== shownCount) { lcN.textContent = count; shownCount = count; }
    var cf = seg(L, 0.87, 1), cw = sceneW, ch = sceneH, ox = cw * 0.83, oy = ch * 0.6;
    confetti.forEach(function (c) {
      if (cf <= 0) { c.el.style.opacity = '0'; return; }
      var e = E.out(cf), dd = c.dist * cw * e;
      c.el.style.opacity = (1 - seg(cf, 0.72, 1)).toFixed(3);
      c.el.style.transform = 'translate3d(' + f1(ox + Math.cos(c.a) * dd - cw * 0.035) + 'px,' + f1(oy + Math.sin(c.a) * dd + cf * cf * ch * 0.5 - cw * 0.035) + 'px,0) rotate(' + (c.r0 + cf * c.spin).toFixed(1) + 'deg) scale(' + lerp(0.3, 1, e).toFixed(3) + ')';
    });
  }

  function renderGallery(G) {
    var x = -G * galDist, vw = viewW;
    track.style.transform = 'translate3d(' + f1(x) + 'px,0,0)';
    /* photos lean into the direction of travel, then settle */
    var vel = (G - gPrev) * galDist / Math.max(lastDt, 0.008); gPrev = G;
    skew += (clamp(-vel * 0.004, -7, 7) - skew) * 0.18;
    if (Math.abs(skew) < 0.02) skew = 0;
    var sk = skew ? 'skewX(' + skew.toFixed(2) + 'deg)' : '';
    if (sk !== lastSkew) { tileBtns.forEach(function (b) { b.style.transform = sk; }); lastSkew = sk; }
    tiles.forEach(function (tile, i) {
      var off = (tileC[i] + x - vw / 2) / vw, im = tileImgs[i];
      if (im) im.style.transform = 'translate3d(' + (-off * 7).toFixed(2) + '%,0,0)';
    });
  }

  /* only touch what actually changed this frame; an idle page does no style work at all */
  var lastSy = -1, lastL = -1, lastG = -1, lastTX = 0, lastTY = 0;
  function render(S, L, G, t, sy) {
    var moved = sy !== lastSy || dirty;
    if (moved) {
      var hy = clamp(sy / vh);
      if (hy < 1 || dirty || lastSy < vh) {
        heroContent.style.transform = 'translate3d(0,' + f1(-hy * 70) + 'px,0)' + (arch ? ' translateY(-50%)' : '');
        heroContent.style.opacity = clamp(1 - hy * 1.8).toFixed(3);
      }
      if (pageLoaded) play(vHero, sy < heroH * 0.98 && !document.hidden);
    }

    var inStory = S > -2 && S < storyLen + 2;
    if (inStory || dirty) {
      if (S !== lastS || dirty || (S > 0 && S < 262)) { renderStory(S, t); lastS = S; }
    } else { play(vOven, false); play(vDessert, false); }

    if ((sy + vh > loyalTop && sy < loyalTop + loyalH) || dirty) {
      if (L !== lastL || tiltX !== lastTX || tiltY !== lastTY || dirty) { renderLoyal(L); lastL = L; lastTX = tiltX; lastTY = tiltY; }
    }
    var galIn = sy + vh > galTop && sy < galTop + galH;
    /* the strip moves sideways, so photos at its far end are fetched before the section arrives */
    if (!galEager && sy + vh * 2.5 > galTop) { galEager = true; setPoster(vInside); tileImgs.forEach(function (im) { if (im && im.tagName === 'IMG') im.loading = 'eager'; }); }
    if (galIn || dirty) { if (G !== lastG || skew !== 0 || dirty) { renderGallery(G); lastG = G; } }
    if (galIn) warm(vInside);
    play(vInside, galIn && !document.hidden);
    if (moved && sy + vh > ctaTop && sy < ctaTop + ctaH && ctaBg) {
      var cp = ((sy + vh - ctaTop) / (ctaH + vh) - 0.5);
      ctaBg.style.transform = 'translate3d(0,' + f1(cp * -70) + 'px,0)';
    }
    lastSy = sy;
    dirty = false;
  }

  function frame(t) {
    /* read the scroll position before changing anything this frame: reading it after a change makes the browser lay the page out again on the spot */
    var sy = window.scrollY;
    var dt = Math.min(0.064, (t - last) / 1000); last = t; lastDt = dt || 0.016;
    /* every scene follows the scroll position exactly, frame by frame; nothing eases towards it, so nothing trails the wheel */
    S = (sy + vh - storyTop) / vh * 100;
    L = clamp((sy - loyalTop) / Math.max(1, loyalH - vh));
    G = galDist ? clamp((sy - galTop) / galDist) : 0;
    var k = 1 - Math.exp(-dt * 9);
    tiltX += (tiltTX - tiltX) * k; tiltY += (tiltTY - tiltY) * k;
    if (Math.abs(tiltTX - tiltX) < 0.01) tiltX = tiltTX;
    if (Math.abs(tiltTY - tiltY) < 0.01) tiltY = tiltTY;
    render(S, L, G, t, sy);
    navState(sy);
    if (curOn) {
      var ck = 1 - Math.exp(-dt * 20);
      curX += (curTX - curX) * ck; curY += (curTY - curY) * ck;
      cur.style.transform = 'translate3d(' + f1(curX) + 'px,' + f1(curY) + 'px,0)';
    }
    requestAnimationFrame(frame);
  }

  measure();
  var rT;
  window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(measure, 120); });
  /* the pizza and pepperoni images wait until the first screen has loaded, or until the visitor starts scrolling */
  var filmReady = function () { doc.classList.add('film-ready'); };
  window.addEventListener('scroll', filmReady, { passive: true, once: true });
  if (window.scrollY > 0) filmReady();
  window.addEventListener('load', function () {
    measure();
    filmReady();
    /* start the kiosk video once everything on the first screen is in */
    var go = function () { pageLoaded = true; warm(vHero); dirty = true; };
    if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 1200 }); else setTimeout(go, 200);
  });
  if (pageLoaded) { warm(vHero); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  $$('.gal-track img').forEach(function (im) { if (!im.complete) im.addEventListener('load', function () { clearTimeout(rT); rT = setTimeout(measure, 200); }, { once: true }); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) [vHero, vOven, vDessert, vInside].forEach(function (v) { play(v, false); }); });
  requestAnimationFrame(frame);
}

init();
