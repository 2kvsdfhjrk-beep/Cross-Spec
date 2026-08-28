/* views-home.js — the front page.
   A stack of plain, scannable modules: what is hot, what the people you follow
   are on, who is in form, and what you starred. No hero, no scroll-jacking —
   the fastest possible route to a tip and to the card it sits on. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui, T = BS.tipsters;

  const sortState = { hot: 'heat', tipsters: 'streak' };

  /* ---------- module frame ---------- */
  function mod(opts) {
    return C.html`
      <section class="mod">
        <div class="mod-head">
          <span class="mod-ic ${opts.tone ? 't-' + opts.tone : ''}">${C.raw(opts.icon)}</span>
          <h2>${opts.title}</h2>
          ${opts.meta ? C.html`<span class="mod-meta">${opts.meta}</span>` : ''}
          ${opts.tools || ''}
        </div>
        ${opts.body}
        ${opts.cta ? C.html`<button class="mod-cta" data-act="${opts.ctaAct}" data-id="${opts.ctaId || ''}">${opts.cta}</button>` : ''}
      </section>`;
  }

  const select = (act, value, options) => C.html`
    <label class="sel">
      <select data-act="${act}">
        ${options.map(o => C.html`<option value="${o[0]}" ${o[0] === value ? C.raw('selected') : ''}>${o[1]}</option>`)}
      </select>
      <span class="chev" aria-hidden="true">▾</span>
    </label>`;

  const ICONS = {
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 3c3 4 6 5.5 6 9.5A6 6 0 0 1 6 12.5C6 9.5 8 8 9 5.5c1.6 1.2 2 3 3 4.5.5-2.5 0-5 0-7z"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2c2.6.2 4.5 2.1 4.5 4.8"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15l4.5-5 3.5 3.2L20 6"/><path d="M4 20h16"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 4l2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>'
  };
  const sportIcon = s => C.raw('<span class="row-ic ' + s + '">' + (s === 'racing' ? '🐴' : '⚽') + '</span>');

  /* ---------- rows ---------- */
  function tipRow(g, now) {
    const who = g.tips.slice(0, 3).map(t => t.tipster.handle);
    const others = g.tips.length - 1;
    const followed = g.followed.length;
    return C.html`
      <button class="row" data-act="${g.kind}" data-id="${g.eventId}">
        ${sportIcon(g.sport)}
        <span class="row-main">
          <span class="row-title">${g.selection} <b>@ ${C.fmtOdds(g.odds)}</b></span>
          <span class="row-sub">${U.time(g.startTs, g.tz)} ${g.flag} ${g.title.replace(/\s\d{2}:\d{2}$/, '')} · ${g.market}</span>
          <span class="consensus ${followed ? 'mine' : ''}">
            <span class="avatars">${g.tips.slice(0, 3).map(t => U.avatar(t.tipster.silk, 'xs'))}</span>
            ${followed
              ? C.html`${g.followed[0].tipster.handle}${followed > 1 ? ' and ' + (followed - 1) + ' more you follow' : ''} back this`
              : C.html`${who[0]}${others ? ' and ' + others + ' more' : ''} back this`}
          </span>
        </span>
        <span class="row-end">
          <span class="cd">${C.countdown(g.startTs, now)}</span>
          <span class="heatpill" title="Agreement between tipsters with a record">${g.heat}</span>
        </span>
      </button>`;
  }

  function tipsterRow(t, metric) {
    const v = metric === 'streak' ? { n: t.streak, k: t.streak === 1 ? 'day' : 'days', good: t.streak > 0 }
      : metric === 'last7' ? { n: C.fmtUnits(t.last7), k: 'units, 7d', good: t.last7 >= 0 }
      : metric === 'last30' ? { n: C.fmtUnits(t.last30), k: 'units, 30d', good: t.last30 >= 0 }
      : metric === 'followers' ? { n: t.followers.toLocaleString(), k: 'followers', good: true }
      : { n: C.fmtPct(t.roi), k: 'ROI', good: t.roi >= 0 };
    return C.html`
      <div class="row row-static">
        <button class="row-av" data-act="tipster" data-id="${t.handle}" aria-label="${t.handle}">${U.avatar(t.silk)}</button>
        <button class="row-main" data-act="tipster" data-id="${t.handle}">
          <span class="row-title">${t.handle}</span>
          <span class="row-sub">${t.followers.toLocaleString()} followers · ${t.n} settled
            ${t.ranked ? '' : C.raw('· <span class="mini-warn">unranked</span>')}</span>
        </button>
        <span class="stat-big ${v.good ? 'good' : 'bad'}"><b>${v.n}</b><small>${v.k}</small></span>
        <button class="follow-btn" data-act="follow" data-id="${t.handle}"
          aria-pressed="${String(T.isFollowing(t.handle))}"
          aria-label="${T.isFollowing(t.handle) ? 'Unfollow ' + t.handle : 'Follow ' + t.handle}"
          title="${T.isFollowing(t.handle) ? 'Unfollow' : 'Follow'}">${T.isFollowing(t.handle) ? '✓' : '+'}</button>
      </div>`;
  }

  function eventRow(ev, now) {
    return C.html`
      <button class="row" data-act="${ev.kind}" data-id="${ev.id}">
        ${sportIcon(ev.sport)}
        <span class="row-main">
          <span class="row-title">${ev.title}</span>
          <span class="row-sub">${U.time(ev.startTs, ev.tz)} · ${ev.subtitle}</span>
        </span>
        <span class="row-end"><span class="cd">${C.countdown(ev.startTs, now)}</span><span class="chev">›</span></span>
      </button>`;
  }

  /* ---------- page ---------- */
  async function home(root) {
    const now = Date.now();
    C.mount(root, C.html`${U.skeleton(4)}`);

    const [meetings, fxToday, fxTomorrow] = await Promise.all([
      BS.provider.meetings(0), BS.provider.fixtures(0), BS.provider.fixtures(1)
    ]);
    meetings.forEach(m => {
      U.index.meetings.set(m.id, m);
      m.races.forEach(r => { r.tzRef = m.tz; r.venue = m.venue; r.flag = m.flag; U.index.races.set(r.id, r); });
    });
    fxToday.concat(fxTomorrow).forEach(f => U.index.fixtures.set(f.id, f));

    const racesToCome = meetings.reduce((a, m) =>
      a.concat(m.races.filter(r => BS.racing.raceState(r, now) === 'upcoming')), []);
    const openMeetings = meetings.filter(m => m.races.some(r => BS.racing.raceState(r, now) !== 'result'));
    const matchesLeft = fxToday.filter(f => BS.football.fixtureState(f, now).state !== 'ft');

    let hot = T.hotTips(now);
    if (sortState.hot === 'time') hot = hot.slice().sort((a, b) => a.startTs - b.startTs);
    if (sortState.hot === 'price') hot = hot.slice().sort((a, b) => b.odds - a.odds);
    const hotTop = balanced(hot.slice(0, 40), 5);

    const consensus = T.hotTips(now, { followingOnly: true }).slice(0, 4);
    const following = T.followingList();
    const inForm = T.sorted(sortState.tipsters).slice(0, 5);

    const favIds = BS.store.favList();
    const favs = favIds.map(id => {
      const race = U.index.races.get(id);
      if (race) return T.asEvent('race', race);
      const fx = U.index.fixtures.get(id);
      return fx ? T.asEvent('match', fx) : null;
    }).filter(e => e && e.startTs > now).sort((a, b) => a.startTs - b.startTs).slice(0, 5);

    C.mount(root, C.html`
      <div class="today-bar">
        <span><b>${racesToCome.length}</b> races to come</span>
        <span><b>${matchesLeft.length}</b> matches today</span>
        <span><b>${hot.length}</b> live tips</span>
        <span><b>${following.length}</b> followed</span>
      </div>

      <div class="doors">
        <button class="door racing" data-act="nav" data-id="racing">
          <span class="kicker">Horse racing</span>
          <span class="name">BetStable</span>
          <span class="meta">${openMeetings.length} meetings · ${racesToCome.length} races</span>
        </button>
        <button class="door football" data-act="nav" data-id="football">
          <span class="kicker">Football</span>
          <span class="name">ScoreMore</span>
          <span class="meta">${matchesLeft.length} today · ${fxTomorrow.length} tomorrow</span>
        </button>
      </div>

      ${mod({
        icon: ICONS.flame, tone: 'hot', title: 'Hot tips', meta: 'both sports',
        tools: select('sort-hot', sortState.hot,
          [['heat', 'Most agreed'], ['time', 'Off soonest'], ['price', 'Biggest price']]),
        body: hotTop.length
          ? C.html`<div class="rows">${hotTop.map(g => tipRow(g, now))}</div>`
          : C.html`<div class="rows"><p class="row-empty">No tipster has posted on an upcoming event yet. Tips cluster in the hour before the off.</p></div>`,
        cta: 'See all ' + hot.length + ' hot tips', ctaAct: 'nav', ctaId: 'hot'
      })}

      ${mod({
        icon: ICONS.people, tone: 'follow', title: 'Your tipsters', meta: following.length ? following.length + ' followed' : '',
        body: following.length
          ? (consensus.length
            ? C.html`<div class="rows">${consensus.map(g => tipRow(g, now))}</div>`
            : C.html`<div class="rows"><p class="row-empty">Nobody you follow has posted yet. Their tips land here the moment they do.</p></div>`)
          : C.html`<div class="rows"><p class="row-empty">Follow a tipster and their tips appear here, on every table, and in the hot list. Records are public and permanent, so you can check before you follow.</p></div>`,
        cta: following.length ? 'Manage who you follow' : 'Browse tipsters', ctaAct: 'nav', ctaId: 'tipsters'
      })}

      ${mod({
        icon: ICONS.chart, tone: 'form', title: 'In form', meta: 'short-run, not a record',
        tools: select('sort-tipsters', sortState.tipsters,
          [['streak', 'Profit streak'], ['last7', 'Last 7 days'], ['last30', 'Last 30 days'],
           ['roi', 'ROI, all time'], ['followers', 'Most followed']]),
        body: C.html`<div class="rows">${inForm.map(t => tipsterRow(t, sortState.tipsters))}</div>`,
        cta: 'Browse all ' + T.all().length + ' tipsters', ctaAct: 'nav', ctaId: 'tipsters'
      })}

      ${mod({
        icon: ICONS.star, tone: 'fav', title: 'Your favourites', meta: favs.length ? favs.length + ' upcoming' : '',
        body: favs.length
          ? C.html`<div class="rows">${favs.map(e => eventRow(e, now))}</div>`
          : C.html`<div class="rows"><p class="row-empty">Star a race or a match and it waits for you here. Look for ☆ on any racecard or fixture.</p></div>`,
        cta: favs.length ? '' : null
      })}

      <p class="foot-note">
        Every tip is stamped by the server, its odds frozen on the spot and settled from a results feed.
        There is no edit and no delete — not for tipsters, not for us.
      </p>
    `);
  }

  /** Keep both sports present even though racing carries far more volume. */
  function balanced(hot, n) {
    const racing = hot.filter(g => g.sport === 'racing');
    const football = hot.filter(g => g.sport === 'football');
    const out = [];
    for (let i = 0; i < n; i++) {
      const from = i % 2 === 1 ? football : racing;
      const other = i % 2 === 1 ? racing : football;
      const pick = from.shift() || other.shift();
      if (!pick) break;
      out.push(pick);
    }
    return out;
  }

  BS.viewsHome = {
    home, mod, select, tipRow, tipsterRow, eventRow, balanced, ICONS, sportIcon,
    setSort: (which, v) => { sortState[which] = v; },
    tipsterCard: t => tipsterRow(t, 'roi')
  };
})(window.BS = window.BS || {});
