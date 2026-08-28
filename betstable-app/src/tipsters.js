/* tipsters.js — the people you can follow, the tips they have live, and the
   heat score that decides what reaches the front page.
   Records are generated but obey the same rules as yours: settled tips only,
   intervals not point estimates, and a 100-tip floor before anyone is ranked. */
(function (BS) {
  'use strict';
  const C = BS.core;
  const FOLLOW_KEY = 'betstable.following.v1';

  const HANDLES = [
    ['@quietfurlong', 'Flat handicaps, mostly northern tracks. Bets less than you would think.'],
    ['@marketmoss', 'Follows the money. Posts late, posts rarely.'],
    ['@barnowl', 'Evening all-weather. Awake when nobody else is.'],
    ['@softground', 'Ground-dependent. Disappears in a dry summer.'],
    ['@paddockmath', 'Prices up every race by hand before looking at the board.'],
    ['@thirdfavourite', 'Never backs a favourite. It is a whole personality.'],
    ['@drawbias', 'Sprint draws and nothing else.'],
    ['@lateshow', 'Last two races on the card. Long record, thin edge.'],
    ['@stallsix', 'Two-year-olds and first-time headgear.'],
    ['@cheltenhamcold', 'Jumps only. Silent for five months a year.'],
    ['@furlongfinish', 'Staying handicaps. Patient to a fault.'],
    ['@theringcraft', 'Watches the parade ring, ignores the form book.'],
    ['@xgdiet', 'Underlying numbers, not results. Will tell you about it.'],
    ['@lowblockliker', 'Away sides at big prices. Suffers loudly.'],
    ['@setpiecesam', 'Corners, cards and the odd correct score.'],
    ['@ninetyplus', 'Late goals. Over 2.5 as a lifestyle.'],
    ['@bttsbrenda', 'Both teams to score, six days a week.'],
    ['@overroundolly', 'Shops for price. Will not take under fair odds.'],
    ['@promotionpush', 'Second tier only. Championship and below.'],
    ['@derbyday', 'Big matches, small volume, honest about it.'],
    ['@cleansheetclive', 'Unders and defensive sides. Deeply unfashionable.'],
    ['@thefarpost', 'Continental leagues nobody else covers.']
  ];
  const SILK_COLORS = ['#AF6E4B', '#065B07', '#00231F', '#7F4228', '#E0B057', '#F6F0E1',
    '#0B7A0D', '#3D1F12', '#1E9B22', '#8A5439', '#B23A2E', '#2F6E8A'];
  const PATTERNS = ['solid', 'halved', 'hoops', 'stripes', 'chevron', 'star', 'sash'];

  /* ---------- the roster ---------- */
  const ROSTER = HANDLES.map(function (h, i) {
    const r = C.rng('tipster|v2|' + h[0]);
    const racing = i < 12 || r() < 0.25;
    const n = C.rint(r, 62, 640);
    const edge = C.gauss(r, 0.021, 0.052);
    const sd = 1.7 + r() * 1.4;
    const se = sd / Math.sqrt(n);
    return {
      handle: h[0],
      bio: h[1],
      sport: racing ? 'racing' : 'football',
      silk: { a: C.pick(r, SILK_COLORS), b: C.pick(r, SILK_COLORS), pattern: C.pick(r, PATTERNS) },
      n: n,
      roi: edge * 100,
      lo: (edge - 1.96 * se) * 100,
      hi: (edge + 1.96 * se) * 100,
      maxDD: -(7 + r() * 36),
      strike: 18 + r() * 26,
      followers: C.rint(r, 40, 9400),
      since: 2023 + C.rint(r, 0, 2),
      ranked: n >= 100
    };
  });

  const byHandle = new Map(ROSTER.map(t => [t.handle, t]));

  /* ---------- following ---------- */
  let following = null;
  function loadFollowing() {
    if (following) return following;
    try {
      const raw = localStorage.getItem(FOLLOW_KEY);
      following = new Set(raw ? JSON.parse(raw) : []);
    } catch (e) { following = new Set(); }
    return following;
  }
  function saveFollowing() {
    try { localStorage.setItem(FOLLOW_KEY, JSON.stringify(Array.from(loadFollowing()))); } catch (e) {}
  }
  const isFollowing = h => loadFollowing().has(h);
  function toggleFollow(h) {
    const f = loadFollowing();
    const now = !f.has(h);
    if (now) f.add(h); else f.delete(h);
    saveFollowing();
    return now;
  }
  const followingList = () => ROSTER.filter(t => isFollowing(t.handle));

  /* ---------- what they have live ----------
     Tips are attached to real events from the feed, so a hot tip opens the
     actual racecard and settles on the same results the rest of the app uses. */
  function tipsForEvent(ev) {
    const out = [];
    for (const t of ROSTER) {
      if (t.sport !== ev.sport) continue;
      const r = C.rng('t|' + t.handle + '|' + ev.id);
      // A tipster posts on a small slice of the card, not everything.
      if (r() > 0.085) continue;
      const picks = ev.selections;
      if (!picks.length) continue;
      // Weighted toward the front of the market, but far from always the favourite.
      const idx = Math.min(picks.length - 1, Math.floor(Math.pow(r(), 1.7) * picks.length));
      const pick = picks[idx];
      out.push({
        tipster: t, selection: pick.selection, odds: pick.odds, market: pick.market,
        postedAt: ev.startTs - (30 + Math.floor(r() * 260)) * 60000
      });
    }
    return out;
  }

  /** Normalise a race or fixture into the shape tipsForEvent expects. */
  function asEvent(kind, obj) {
    if (kind === 'race') {
      return {
        id: obj.id, sport: 'racing', kind: 'race', startTs: obj.offTs,
        title: obj.venue + ' ' + C.fmtTime(obj.offTs, undefined),
        subtitle: obj.name, flag: obj.flag, tz: obj.tzRef,
        selections: obj.runners.filter(x => x.odds).map(x => ({
          selection: x.horse, odds: x.odds, market: 'Win'
        }))
      };
    }
    return {
      id: obj.id, sport: 'football', kind: 'match', startTs: obj.koTs,
      title: obj.home + ' v ' + obj.away, subtitle: obj.comp, flag: '', tz: obj.tz,
      selections: [
        { selection: obj.home, odds: obj.odds.home, market: 'Match result' },
        { selection: 'Draw', odds: obj.odds.draw, market: 'Match result' },
        { selection: obj.away, odds: obj.odds.away, market: 'Match result' },
        { selection: 'Over 2.5 goals', odds: obj.ou25[0], market: 'Over/Under' },
        { selection: 'Both teams to score', odds: obj.btts[0], market: 'BTTS' }
      ]
    };
  }

  /** Every upcoming event in the window, as normalised events. */
  function upcomingEvents(now, opts) {
    const o = opts || {};
    const out = [];
    if (o.sport !== 'football') {
      for (const race of BS.ui.index.races.values()) {
        if (!race.declared || race.offTs <= now) continue;
        if (race.offTs - now > 8 * 3600e3) continue;
        out.push(asEvent('race', race));
      }
    }
    if (o.sport !== 'racing') {
      for (const fx of BS.ui.index.fixtures.values()) {
        if (fx.koTs <= now) continue;
        if (fx.koTs - now > 30 * 3600e3) continue;
        out.push(asEvent('match', fx));
      }
    }
    return out;
  }

  /* ---------- heat ----------
     What makes a tip hot is agreement between people with a record, on
     something that is about to happen — not the size of the price. */
  function heatFor(group, now) {
    const consensus = group.tips.length;
    const quality = group.tips.reduce((a, t) => a + Math.max(0, t.tipster.lo + 12), 0) / consensus;
    const reach = Math.log10(1 + group.tips.reduce((a, t) => a + t.tipster.followers, 0)) * 6;
    const mins = Math.max(1, (group.startTs - now) / 60000);
    const imminence = Math.max(0, 34 - Math.log2(mins) * 4.4);
    const followed = group.tips.some(t => isFollowing(t.tipster.handle)) ? 9 : 0;
    return Math.max(1, Math.min(99, Math.round(consensus * 11 + quality * 0.9 + reach + imminence + followed)));
  }

  /** Grouped by event + selection: the app's cross-sport front page ranking. */
  function hotTips(now, opts) {
    const o = opts || {};
    const groups = new Map();
    for (const ev of upcomingEvents(now, o)) {
      for (const tip of tipsForEvent(ev)) {
        const key = ev.id + '|' + tip.selection;
        if (!groups.has(key)) {
          groups.set(key, {
            key: key, event: ev, eventId: ev.id, kind: ev.kind, sport: ev.sport,
            title: ev.title, subtitle: ev.subtitle, flag: ev.flag, tz: ev.tz,
            startTs: ev.startTs, selection: tip.selection, market: tip.market,
            odds: tip.odds, tips: []
          });
        }
        groups.get(key).tips.push(tip);
      }
    }
    const list = Array.from(groups.values());
    for (const g of list) {
      g.heat = heatFor(g, now);
      g.followed = g.tips.filter(t => isFollowing(t.tipster.handle));
      g.tips.sort((a, b) => b.tipster.lo - a.tipster.lo);
    }
    if (o.followingOnly) return list.filter(g => g.followed.length).sort((a, b) => b.heat - a.heat);
    return list.sort((a, b) => b.heat - a.heat);
  }

  /** Everything a single tipster has live right now. */
  function openTipsFor(handle, now) {
    const t = byHandle.get(handle);
    if (!t) return [];
    const out = [];
    for (const ev of upcomingEvents(now, { sport: t.sport })) {
      for (const tip of tipsForEvent(ev)) {
        if (tip.tipster.handle !== handle) continue;
        out.push(Object.assign({ event: ev }, tip));
      }
    }
    return out.sort((a, b) => a.event.startTs - b.event.startTs);
  }

  /** A short equity curve for the profile sparkline. */
  function curveFor(t) {
    const r = C.rng('curve|' + t.handle);
    const pts = [];
    let cum = 0;
    const per = t.roi / 100;
    for (let i = 0; i < 60; i++) {
      cum += per + C.gauss(r, 0, 1.5);
      pts.push(cum);
    }
    return pts;
  }

  BS.tipsters = {
    all: () => ROSTER.slice(),
    get: h => byHandle.get(h),
    isFollowing, toggleFollow, followingList,
    hotTips, openTipsFor, curveFor, upcomingEvents, asEvent
  };
})(window.BS = window.BS || {});
