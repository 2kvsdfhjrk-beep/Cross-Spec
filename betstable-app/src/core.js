/* core.js — primitives shared by every module.
   Deterministic randomness, timezone maths, formatting, tiny DOM helpers. */
(function (BS) {
  'use strict';

  /* ---------- deterministic randomness ----------
     Every generated card is seeded from a stable string (date + venue), so the
     same day always renders the same racecard no matter how often you reload. */
  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = hashStr(String(seed));
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  function pickN(r, arr, n) {
    const pool = arr.slice(), out = [];
    n = Math.min(n, pool.length);
    for (let i = 0; i < n; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  }
  function gauss(r, mean, sd) {
    const u = Math.max(r(), 1e-9), v = Math.max(r(), 1e-9);
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------- timezones ----------
     A global racing app lives or dies on times. Venue-local times are converted
     to real instants through Intl, so DST is handled rather than guessed. */
  function tzOffsetMs(utcMs, tz) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const p = {};
    for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day,
      p.hour === '24' ? 0 : +p.hour, +p.minute, +p.second);
    return asUTC - utcMs;
  }
  /** Venue-local wall clock -> epoch ms. */
  function zonedToUtc(y, mo, d, h, mi, tz) {
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    let ts = guess - tzOffsetMs(guess, tz);
    ts = guess - tzOffsetMs(ts, tz);
    return ts;
  }
  /** Calendar date in a given zone, offset by `dayShift` days. */
  function zonedDateParts(ts, tz, dayShift) {
    const d = new Date(ts + (dayShift || 0) * 864e5);
    const p = {};
    for (const part of new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(d)) p[part.type] = part.value;
    return { y: +p.year, mo: +p.month, d: +p.day };
  }
  const fmtTime = (ts, tz) => new Intl.DateTimeFormat(undefined, {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
  }).format(new Date(ts));
  const fmtTimeSec = (ts, tz) => new Intl.DateTimeFormat(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz
  }).format(new Date(ts));
  const fmtDay = (ts, tz) => new Intl.DateTimeFormat(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: tz
  }).format(new Date(ts));
  const fmtDateFull = (ts, tz) => new Intl.DateTimeFormat(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: tz
  }).format(new Date(ts));
  const tzAbbr = (ts, tz) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date(ts));
    const p = parts.find(x => x.type === 'timeZoneName');
    return p ? p.value : '';
  };
  const localTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

  /** "in 4m" / "in 2h 15m" / "3d" — the app's universal urgency cue. */
  function countdown(ts, now) {
    const diff = ts - (now || Date.now());
    if (diff <= 0) return 'off';
    const m = Math.floor(diff / 60000);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ' + (m % 60) + 'm';
    return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  }

  /* ---------- odds ---------- */
  /** Decimal odds from probabilities, with a realistic book overround. */
  function priceUp(probs, overround) {
    const total = probs.reduce((a, b) => a + b, 0);
    return probs.map(p => {
      const implied = (p / total) * (overround || 1.16);
      const dec = 1 / implied;
      const step = dec < 3 ? 0.05 : dec < 8 ? 0.25 : dec < 20 ? 1 : 5;
      return Math.max(1.05, Math.round(dec / step) * step);
    });
  }
  const fmtOdds = o => o >= 10 ? o.toFixed(0) : o.toFixed(2);
  const fmtUnits = u => (u >= 0 ? '+' : '−') + Math.abs(u).toFixed(2);
  const fmtPct = p => (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(1) + '%';
  /** Typographic minus, so a column of figures lines up and reads as one set. */
  const fmtSigned = (v, dp) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(dp == null ? 1 : dp);

  /* ---------- safe templating ----------
     Tagged template that escapes every interpolation unless wrapped in raw(). */
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const raw = v => ({ __raw: true, v: v });
  const unwrap = v => v == null ? '' : (v.__raw ? v.v : esc(v));
  function html(strings) {
    const vals = Array.prototype.slice.call(arguments, 1);
    let out = strings[0];
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      out += Array.isArray(v) ? v.map(unwrap).join('') : unwrap(v);
      out += strings[i + 1];
    }
    return raw(out);
  }

  /* ---------- dom ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  function mount(node, tpl) { node.innerHTML = unwrap(tpl); return node; }

  BS.core = {
    hashStr, rng, rint, pick, pickN, gauss,
    zonedToUtc, zonedDateParts, fmtTime, fmtTimeSec, fmtDay, fmtDateFull, tzAbbr, localTz, countdown,
    priceUp, fmtOdds, fmtUnits, fmtPct, fmtSigned,
    html, raw, esc, unwrap, $, $$, mount
  };
})(window.BS = window.BS || {});
