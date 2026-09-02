/* experts.js — the two expert badges and the job that keeps them honest.

   Consistent expert  in profit across each of the last three 30-day periods
   Value expert       makes its money at a price, not from short-priced winners

   Both are recalculated once a week, and every award and every loss is written
   to an append-only log. A badge you can quietly keep after the record stops
   supporting it would be exactly the thing this product exists not to do. */
(function (BS) {
  'use strict';
  const C = BS.core;
  const KEY = 'betstable.experts.v1';
  const WEEK = 7 * 864e5;
  /* Monday 2024-01-01 as the epoch, so week boundaries land on a Monday. */
  const EPOCH = Date.UTC(2024, 0, 1);

  const BADGES = {
    consistent: {
      id: 'consistent', label: 'Consistent', full: 'Consistent expert', icon: 'trend',
      rule: 'In profit across each of the last three 30-day periods, on a profitable record of 100+ settled tips.'
    },
    value: {
      id: 'value', label: 'Value', full: 'Value expert', icon: 'gem',
      rule: 'Profitable with an average winning price of 4.5 or bigger, and at least 12 winners at those prices.'
    }
  };

  const weekIndex = now => Math.floor(((now || Date.now()) - EPOCH) / WEEK);
  const weekStart = wi => EPOCH + wi * WEEK;
  const nextRunTs = now => weekStart(weekIndex(now) + 1);

  /** Weekly profit series. Fixed per tipster per week, so history never moves. */
  function weeklyPL(t, wi) {
    const r = C.rng('wk|' + t.handle + '|' + wi);
    // Centred on the tipster's own edge, with a week's worth of variance on top.
    return C.gauss(r, (t.roi / 100) * 9, 4.6);
  }

  /** Three consecutive 30-day periods, as four-week blocks ending this week. */
  function periods(t, wi) {
    const out = [];
    for (let k = 0; k < 3; k++) {
      let sum = 0;
      for (let w = 0; w < 4; w++) sum += weeklyPL(t, wi - k * 4 - w);
      out.push(Math.round(sum * 10) / 10);
    }
    return out;                       // [most recent, previous, one before]
  }

  /** Evaluate both badges for one tipster in a given week. */
  function evaluate(t, wi) {
    const p = periods(t, wi);
    const consistent = t.n >= 100 && t.roi > 0 && p.every(x => x > 0);
    const value = t.n >= 100 && t.roi > 0 && t.avgWinOdds >= 4.5 && t.bigWinners >= 12;
    return { periods: p, consistent: consistent, value: value };
  }

  /* ---------- stored state and the append-only log ---------- */
  let state = null;
  function load() {
    if (state) return state;
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : null;
    } catch (e) { state = null; }
    if (!state) state = { week: null, lastRun: null, badges: {}, log: [], simOffset: 0 };
    if (typeof state.simOffset !== 'number') state.simOffset = 0;
    return state;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /** The weekly job. Idempotent: running twice in a week changes nothing. */
  function runIfDue(now) {
    const s = load();
    const wi = weekIndex(now) + s.simOffset;
    if (s.week === wi) return { ran: false, changes: [] };
    const changes = [];
    for (const t of BS.tipsters.all()) {
      const res = evaluate(t, wi);
      const prev = s.badges[t.handle] || {};
      for (const id of ['consistent', 'value']) {
        const had = !!prev[id], has = !!res[id];
        // The first run establishes a baseline rather than logging 40 awards.
        if (had !== has && s.week !== null) {
          changes.push({ ts: now, week: wi, handle: t.handle, badge: id, action: has ? 'awarded' : 'lost' });
        }
      }
      s.badges[t.handle] = { consistent: res.consistent, value: res.value, periods: res.periods };
    }
    s.log = changes.concat(s.log).slice(0, 200);
    s.week = wi;
    s.lastRun = now;
    save();
    return { ran: true, changes: changes };
  }

  /** Badges as of the last run — never recomputed on the fly for display. */
  function badgesFor(handle) {
    const b = load().badges[handle];
    if (!b) return { consistent: false, value: false, periods: [] };
    return b;
  }
  const holders = id => BS.tipsters.all().filter(t => badgesFor(t.handle)[id]);

  BS.experts = {
    BADGES, weekIndex, weekStart, nextRunTs, evaluate, periods, runIfDue, badgesFor, holders,
    lastRun: () => load().lastRun,
    week: () => load().week,
    log: () => load().log.slice(),
    /* Demo affordance only. The real job runs on the server every Monday and
       cannot be nudged; this walks the clock forward so the mechanism is
       visible without waiting a week. */
    simulateNextWeek: now => { const s = load(); s.simOffset += 1; save(); return runIfDue(now); },
    simOffset: () => load().simOffset,
    reset: () => { try { localStorage.removeItem(KEY); } catch (e) {} state = null; }
  };
})(window.BS = window.BS || {});
