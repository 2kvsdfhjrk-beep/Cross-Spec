/* provider.js — the single interface the UI talks to.
   Nothing in the views knows where data comes from. Swapping the sample feeds
   for a real odds/results provider means reimplementing these methods only. */
(function (BS) {
  'use strict';
  const C = BS.core;

  const LATENCY = [90, 260];          // simulated network, so loading states are real
  const cache = new Map();

  const delay = () => new Promise(res =>
    setTimeout(res, LATENCY[0] + Math.random() * (LATENCY[1] - LATENCY[0])));

  async function memo(key, fn) {
    if (cache.has(key)) return cache.get(key);
    await delay();
    const val = fn();
    cache.set(key, val);
    return val;
  }

  /* Feed health. The framework's first killer is a settlement job that fails
     quietly, so the app surfaces feed state rather than hiding it. */
  const health = {
    odds: { name: 'Odds feed', status: 'ok', lastSuccess: Date.now() - 42000, latencyMs: 180 },
    results: { name: 'Results feed', status: 'ok', lastSuccess: Date.now() - 118000, latencyMs: 240 },
    settlement: { name: 'Settlement job', status: 'ok', lastSuccess: Date.now() - 300000, pending: 0 }
  };

  const provider = {
    id: 'sample-feed',
    label: 'Sample feed',

    /** Race meetings for a day offset, grouped by region, empty cards removed. */
    async meetings(dayOffset) {
      const now = Date.now();
      const key = 'r:' + dayOffset + ':' + C.zonedDateParts(now, 'UTC', dayOffset).d;
      const list = await memo(key, () => BS.racing.meetingsFor(dayOffset, now));
      health.odds.lastSuccess = Date.now();
      return list;
    },

    async fixtures(dayOffset) {
      const now = Date.now();
      const key = 'f:' + dayOffset + ':' + C.zonedDateParts(now, 'UTC', dayOffset).d;
      const list = await memo(key, () => BS.football.fixturesFor(dayOffset, now));
      health.odds.lastSuccess = Date.now();
      return list;
    },

    /** Re-read the price at the instant a tip is submitted (the odds freeze). */
    freezeOdds(quotedOdds) {
      const drift = Math.random();
      let odds = quotedOdds;
      if (drift > 0.82) {                    // the market moved while you tapped
        const step = quotedOdds < 3 ? 0.05 : quotedOdds < 8 ? 0.25 : 1;
        odds = Math.max(1.05, quotedOdds + step * (Math.random() < 0.5 ? -1 : 1));
      }
      return { odds: Math.round(odds * 100) / 100, at: Date.now(), moved: odds !== quotedOdds };
    },

    /** Result lookup used by settlement. Never supplied by a user. */
    raceResult(race) { return BS.racing.resultFor(race); },
    fixtureResult(fx) { return BS.football.finalScore(fx); },

    health() { return health; },
    setPending(n) { health.settlement.pending = n; },
    invalidate() { cache.clear(); }
  };

  BS.provider = provider;
})(window.BS = window.BS || {});
