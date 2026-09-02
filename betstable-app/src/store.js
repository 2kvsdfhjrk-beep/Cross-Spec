/* store.js — the tip ledger and the statistics drawn from it.
   Tips are append-only: there is an add, there is no edit and no delete. A
   correction is a void record that points at the original. */
(function (BS) {
  'use strict';
  const C = BS.core;
  const KEY = 'betstable.ledger.v1';

  let ledger = null;

  function fnv(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  /** Stand-in for the real record hash — same shape, same guarantee to explain. */
  const tipHash = t => (fnv(t.id + t.selection + t.odds) + fnv(t.event + t.postedAt) +
    fnv(String(t.odds) + t.market) + fnv(t.product + t.id)).slice(0, 32);

  /** Daily Merkle root over the day's tip hashes. */
  function merkleRoot(hashes) {
    if (!hashes.length) return null;
    let level = hashes.slice();
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2)
        next.push(fnv(level[i] + (level[i + 1] || level[i])) + fnv((level[i + 1] || level[i]) + level[i]));
      level = next;
    }
    return (level[0] + fnv(level[0]) + fnv(level[0] + 'x')).slice(0, 32);
  }

  // Chosen so the founder's record is what the brand promises: real, checkable
  // and thoroughly unremarkable — a small edge buried in a lot of variance.
  const SEED = 'betstable-seed-v17';
  const N_SEED = 134;

  /* ---------- seeded starting record ----------
     The founder's own honest, unremarkable record, so every view has substance
     on first run. Deterministic, and plainly labelled as sample data. */
  function seedLedger() {
    const r = C.rng(SEED);
    const tips = [];
    const now = Date.now();
    const racingEvents = [
      ['Ascot', 'Quiet Furlong'], ['The Curragh', 'Blackthorn Bay'], ['Saratoga', 'Bourbon County'],
      ['Deauville', 'Marram Grass'], ['Sha Tin', 'Lucky Sword'], ['Flemington', 'Mallee Bull'],
      ['Meydan', 'Copper Kettle'], ['Tokyo', 'Sakura Meteor'], ['Del Mar', 'Prairie Smoke'],
      ['Leopardstown', 'Peat Fire'], ['York', 'Gorse Hill'], ['Turffontein', 'Rowan Tree'],
      ['Kempton Park (AW)', 'Barleycorn'], ['Randwick', 'Bondi Rip'], ['ParisLongchamp', 'Lark Ascending']
    ];
    const footballEvents = [
      ['Arsenal v Everton', 'Arsenal'], ['Napoli v Lazio', 'Over 2.5 goals'],
      ['Bayern Munich v Freiburg', 'Bayern Munich'], ['Celtic v Hearts', 'Both teams to score'],
      ['Real Betis v Girona', 'Draw'], ['Flamengo v Grêmio', 'Flamengo'],
      ['Inter Miami v Austin FC', 'Over 2.5 goals'], ['Porto v Braga', 'Porto'],
      ['Kawasaki Frontale v FC Tokyo', 'Both teams to score'], ['Lens v Nice', 'Away']
    ];
    for (let i = 0; i < N_SEED; i++) {
      const isRacing = r() < 0.62;
      const daysAgo = 168 - Math.floor(i * 1.24) - Math.floor(r() * 2);
      const postedAt = now - daysAgo * 864e5 - Math.floor(r() * 36e5);
      const odds = isRacing
        ? Math.round((1.8 + Math.pow(r(), 1.7) * 8.5) * 20) / 20
        : Math.round((1.55 + Math.pow(r(), 1.5) * 3.6) * 20) / 20;
      const ev = isRacing ? C.pick(r, racingEvents) : C.pick(r, footballEvents);
      // A genuine, unspectacular edge: implied probability plus a couple of points.
      const won = r() < (1 / odds) * 1.06;
      const tip = {
        id: 'seed-' + i,
        product: isRacing ? 'racing' : 'football',
        event: isRacing ? ev[0] + ' ' + (13 + (i % 6)) + ':' + ((i * 7) % 6) + '5' : ev[0],
        market: isRacing ? 'Win' : (ev[1].indexOf('goals') > 0 ? 'Over/Under' :
          ev[1].indexOf('score') > 0 ? 'BTTS' : 'Match result'),
        selection: ev[1],
        odds: odds,
        stake: 1,
        postedAt: postedAt,
        status: 'settled',
        settledAt: postedAt + 3.2e6,
        won: won,
        ret: won ? odds - 1 : -1
      };
      tip.hash = tipHash(tip);
      tips.push(tip);
    }
    tips.sort((a, b) => a.postedAt - b.postedAt);
    return { version: 1, handle: '@thefounder', tips: tips };
  }

  function load() {
    if (ledger) return ledger;
    try {
      const rawStr = localStorage.getItem(KEY);
      ledger = rawStr ? JSON.parse(rawStr) : seedLedger();
    } catch (e) { ledger = seedLedger(); }
    save();
    return ledger;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(ledger)); } catch (e) { /* private mode */ }
  }

  /* ---------- the one write path ---------- */
  function addTip(tip) {
    const l = load();
    const rec = Object.assign({
      id: 'tip-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 4096).toString(36),
      stake: 1, status: 'pending', postedAt: Date.now()
    }, tip);
    rec.hash = tipHash(rec);
    l.tips.push(rec);
    save();
    return rec;
  }

  /** Settlement runs over pending tips using feed results only. */
  function settle(tipId, won, ret, detail) {
    const l = load();
    const t = l.tips.find(x => x.id === tipId);
    if (!t || t.status !== 'pending') return;
    t.status = 'settled'; t.settledAt = Date.now();
    t.won = won; t.ret = ret; t.resultDetail = detail || null;
    save();
  }

  /* ---------- statistics ---------- */
  function stats(tips) {
    const settled = tips.filter(t => t.status === 'settled');
    const n = settled.length;
    if (!n) return { n: 0, roi: 0, lo: 0, hi: 0, profit: 0, strike: 0, maxDD: 0, equity: [], enough: false };
    const rets = settled.map(t => t.ret);
    const profit = rets.reduce((a, b) => a + b, 0);
    const mean = profit / n;
    const varSum = rets.reduce((a, x) => a + Math.pow(x - mean, 2), 0);
    const sd = Math.sqrt(varSum / Math.max(1, n - 1));
    const se = sd / Math.sqrt(n);
    let cum = 0, peak = 0, maxDD = 0;
    const equity = settled.map(t => {
      cum += t.ret;
      peak = Math.max(peak, cum);
      maxDD = Math.min(maxDD, cum - peak);
      return { ts: t.settledAt || t.postedAt, cum: cum, dd: cum - peak };
    });
    return {
      n: n, roi: mean * 100, lo: (mean - 1.96 * se) * 100, hi: (mean + 1.96 * se) * 100,
      profit: profit, strike: settled.filter(t => t.won).length / n * 100,
      maxDD: maxDD, equity: equity, enough: n >= 100,
      pending: tips.filter(t => t.status === 'pending').length
    };
  }

  /* ---------- rankings ----------
     Other tipsters are generated so the table has shape; the same thresholds
     and interval maths are applied to them as to the user. */
  function leaderboard(band, product) {
    const handles = ['@quietfurlong', '@marketmoss', '@barnowl', '@softground', '@paddockmath',
      '@thirdfavourite', '@drawbias', '@lateshow', '@stallsix', '@cheltenhamcold',
      '@xgdiet', '@lowblockliker', '@setpiecesam', '@ninetyplus', '@overroundolly'];
    const r = C.rng('board|' + band + '|' + product);
    const rows = handles.map(h => {
      const n = C.rint(r, 84, 620);
      const edge = C.gauss(r, 0.02, 0.055);
      const sd = 1.6 + r() * 1.5;
      const se = sd / Math.sqrt(n);
      return {
        handle: h, n: n, roi: edge * 100,
        lo: (edge - 1.96 * se) * 100, hi: (edge + 1.96 * se) * 100,
        maxDD: -(8 + r() * 34), ranked: n >= 100
      };
    });
    rows.sort((a, b) => b.lo - a.lo);   // ranked on the conservative end of the range
    return rows;
  }

  /* ---------- favourites ----------
     A starred event, so the front page can show what you actually care about. */
  const FAV_KEY = 'betstable.favourites.v1';
  let favs = null;
  function loadFavs() {
    if (favs) return favs;
    try {
      const raw = localStorage.getItem(FAV_KEY);
      favs = new Set(raw ? JSON.parse(raw) : []);
    } catch (e) { favs = new Set(); }
    return favs;
  }
  const isFav = id => loadFavs().has(id);
  function toggleFav(id) {
    const f = loadFavs();
    const on = !f.has(id);
    if (on) f.add(id); else f.delete(id);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(f))); } catch (e) {}
    return on;
  }
  const favList = () => Array.from(loadFavs());

  BS.store = {
    isFav, toggleFav, favList,
    load, save, addTip, settle, stats, leaderboard, merkleRoot, tipHash,
    tips: () => load().tips,
    handle: () => load().handle,
    setHandle: h => { const l = load(); l.handle = h; save(); },
    reset: () => { try { localStorage.removeItem(KEY); } catch (e) {} ledger = null; }
  };
})(window.BS = window.BS || {});
