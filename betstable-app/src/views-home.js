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
          <span class="mod-ic">${BS.icons.icon(opts.icon)}</span>
          <h2>${opts.title}</h2>
          ${opts.meta ? C.html`<span class="mod-meta">${opts.meta}</span>` : ''}
          ${opts.tools || ''}
        </div>
        ${opts.body}
        ${opts.cta ? C.html`<button class="mod-cta" data-act="go" data-route="${opts.ctaRoute}">${opts.cta}</button>` : ''}
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
    flame: 'hot', people: 'people', chart: 'trend', star: 'star', clock: 'clock'
  };
  const sportIcon = s => C.raw('<span class="row-ic ' + s + '">' +
    C.unwrap(BS.icons.icon(s === 'racing' ? 'racing' : 'football')) + '</span>');

  /* ---------- rows ---------- */
  function tipRow(g, now) {
    const n = g.tips.length, mine = g.followed.length;
    const soon = g.startTs - now < 15 * 60000;
    return C.html`
      <button class="row" data-act="go" data-route="${g.kind === 'race' ? 'racing/race/' : 'football/match/'}${g.eventId}">
        ${sportIcon(g.sport)}
        <span class="row-main">
          <span class="row-title">
            <span class="nm">${g.selection}</span>
            <span class="odds">${C.fmtOdds(g.odds)}</span>
          </span>
          <span class="row-sub">${U.time(g.startTs, g.tz)} ${g.flag} ${g.title.replace(/\s\d{2}:\d{2}$/, '')} · ${g.market}</span>
          <span class="backers ${mine ? 'mine' : ''}">
            <span class="avatars">${g.tips.slice(0, 3).map(t => U.avatar(t.tipster.silk, 'xs'))}</span>
            <span class="txt">${mine
              ? mine + (mine === 1 ? ' you follow' : ' you follow') + (n > mine ? ' of ' + n : '') + ' back this'
              : n + (n === 1 ? ' tipster backs' : ' tipsters back') + ' this'}</span>
          </span>
        </span>
        <span class="row-end">
          <span class="cd ${soon ? 'soon' : ''}">${C.countdown(g.startTs, now)}</span>
          <span class="heatpill" title="How much agreement there is, close to the off">${g.heat}</span>
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
        <button data-act="go" data-route="tipster/${t.handle}" aria-label="${t.handle}" style="flex:none">${U.avatar(t.silk, 'md')}</button>
        <button class="row-main" data-act="go" data-route="tipster/${t.handle}">
          <span class="row-title"><span class="nm">${t.handle}</span>${BS.viewsAccount.badgeChips(t.handle)}</span>
          <span class="row-sub">${t.followers.toLocaleString()} followers · ${t.n} settled
            ${t.ranked ? '' : C.raw('· <span class="mini-warn">unranked</span>')}</span>
        </button>
        <span class="stat-big ${v.good ? 'good' : 'bad'}"><b>${v.n}</b><small>${v.k}</small></span>
        <button class="follow-btn" data-act="follow" data-id="${t.handle}"
          aria-pressed="${String(T.isFollowing(t.handle))}"
          aria-label="${T.isFollowing(t.handle) ? 'Unfollow ' + t.handle : 'Follow ' + t.handle}"
          title="${T.isFollowing(t.handle) ? 'Unfollow' : 'Follow'}">${BS.icons.icon(T.isFollowing(t.handle) ? 'check' : 'follow')}</button>
      </div>`;
  }

  function eventRow(ev, now) {
    return C.html`
      <button class="row" data-act="go" data-route="${ev.kind === 'race' ? 'racing/race/' : 'football/match/'}${ev.id}">
        ${sportIcon(ev.sport)}
        <span class="row-main">
          <span class="row-title"><span class="nm">${ev.title}</span></span>
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

    // The next thing due to happen, drawn as a track you can read at a glance.
    const nextRace = racesToCome.slice().sort((a, b) => a.offTs - b.offTs)[0];
    const nextFx = matchesLeft.filter(f => f.koTs > now).sort((a, b) => a.koTs - b.koTs)[0];
    const useFootball = U.state.product === 'football' && nextFx;
    const banner = useFootball
      ? { route: 'football/match/' + nextFx.id, startTs: nextFx.koTs,
          name: nextFx.home + ' v ' + nextFx.away, sub: nextFx.comp }
      : nextRace
        ? { route: 'racing/race/' + nextRace.id, startTs: nextRace.offTs,
            name: nextRace.flag + ' ' + nextRace.venue,
            silk: nextRace.runners[0] && nextRace.runners[0].silk,
            sub: nextRace.name + ' · ' + nextRace.runners.length + ' runners' }
        : null;

    C.mount(root, C.html`
      ${BS.fx.banner(banner, useFootball ? 'football' : 'racing')}
      <div class="today-bar">
        <span><b data-n="${racesToCome.length}">0</b> races to come</span>
        <span><b data-n="${matchesLeft.length}">0</b> matches today</span>
        <span><b data-n="${hot.length}">0</b> live tips</span>
        <span><b data-n="${following.length}">0</b> followed</span>
      </div>

      <div class="doors">
        <button class="door racing" data-act="go" data-route="racing/today">
          <span class="kicker">Horse racing</span>
          <span class="name">BetStable</span>
          <span class="meta">${openMeetings.length} meetings · ${racesToCome.length} races</span>
        </button>
        <button class="door football" data-act="go" data-route="football/today">
          <span class="kicker">Football</span>
          <span class="name">ScoreMore</span>
          <span class="meta">${matchesLeft.length} today · ${fxTomorrow.length} tomorrow</span>
        </button>
      </div>

      ${mod({
        icon: ICONS.flame, title: 'Hot tips', meta: 'both sports',
        tools: select('sort-hot', sortState.hot,
          [['heat', 'Most agreed'], ['time', 'Off soonest'], ['price', 'Biggest price']]),
        body: hotTop.length
          ? C.html`<div class="rows">${hotTop.map(g => tipRow(g, now))}</div>`
          : C.html`<div class="rows"><p class="row-empty">No tipster has posted on an upcoming event yet. Tips cluster in the hour before the off.</p></div>`,
        cta: 'See all ' + hot.length + ' hot tips', ctaRoute: 'hot'
      })}

      ${mod({
        icon: ICONS.people, title: 'Your tipsters', meta: following.length ? following.length + ' followed' : '',
        body: following.length
          ? (consensus.length
            ? C.html`<div class="rows">${consensus.map(g => tipRow(g, now))}</div>`
            : C.html`<div class="rows"><p class="row-empty">Nobody you follow has posted yet. Their tips land here the moment they do.</p></div>`)
          : C.html`<div class="rows"><p class="row-empty">Follow a tipster and their tips appear here, on every table, and in the hot list. Records are public and permanent, so you can check before you follow.</p></div>`,
        cta: following.length ? 'Manage who you follow' : 'Browse tipsters', ctaRoute: following.length ? 'following' : 'tipsters'
      })}

      ${mod({
        icon: ICONS.chart, title: 'In form', meta: 'short-run, not a record',
        tools: select('sort-tipsters', sortState.tipsters,
          [['streak', 'Profit streak'], ['last7', 'Last 7 days'], ['last30', 'Last 30 days'],
           ['roi', 'ROI, all time'], ['followers', 'Most followed']]),
        body: C.html`<div class="rows">${inForm.map(t => tipsterRow(t, sortState.tipsters))}</div>`,
        cta: 'Browse all ' + T.all().length + ' tipsters', ctaRoute: 'tipsters'
      })}

      ${mod({
        icon: ICONS.star, title: 'Your favourites', meta: favs.length ? favs.length + ' upcoming' : '',
        body: favs.length
          ? C.html`<div class="rows">${favs.map(e => eventRow(e, now))}</div>`
          : C.html`<div class="rows"><p class="row-empty">Star a race or a match and it waits for you here. Look for ☆ on any racecard or fixture.</p></div>`,
        cta: favs.length ? 'All favourites' : null, ctaRoute: 'favourites'
      })}

      <p class="foot-note">
        Every tip is stamped by the server, its odds frozen on the spot and settled from a results feed.
        There is no edit and no delete — not for tipsters, not for us.
      </p>
    `);
    C.$$('[data-n]', root).forEach(el => BS.fx.countUp(el, +el.dataset.n, { dur: 800 }));
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
