/* views-browse.js — drilling down to a race the way punters actually navigate:
   all courses → a country → a meeting → the card. Football takes the same
   shape: regions → competitions → fixtures. Plus a flat "next off" list for
   when you just want whatever runs soonest. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui;

  /* ---------- shared list row ---------- */
  function navRow(opts) {
    return C.html`
      <button class="row" data-act="go" data-route="${opts.route}">
        ${opts.lead || ''}
        <span class="row-main">
          <span class="row-title"><span class="nm">${opts.title}</span></span>
          ${opts.sub ? C.html`<span class="row-sub">${opts.sub}</span>` : ''}
        </span>
        <span class="row-end">
          ${opts.right ? C.html`<span class="cd ${opts.soon ? 'soon' : ''}">${opts.right}</span>` : ''}
          ${opts.rightSub ? C.html`<span class="row-sub">${opts.rightSub}</span>` : ''}
        </span>
        <span class="chev">›</span>
      </button>`;
  }
  const timeChip = (ts, tz) => C.raw('<span class="timechip">' + C.esc(U.time(ts, tz)) + '</span>');

  const liveRaces = (m, now) => m.races.filter(r => BS.racing.raceState(r, now) !== 'result');

  async function loadDays(kind, n) {
    const out = [];
    for (let d = 0; d < n; d++) out.push(kind === 'racing' ? BS.provider.meetings(d) : BS.provider.fixtures(d));
    const lists = await Promise.all(out);
    lists.forEach(list => list.forEach(x => {
      if (kind === 'racing') {
        U.index.meetings.set(x.id, x);
        x.races.forEach(r => { r.tzRef = x.tz; r.venue = x.venue; r.flag = x.flag; U.index.races.set(r.id, r); });
      } else U.index.fixtures.set(x.id, x);
    }));
    return lists;
  }

  /* ================= RACING ================= */

  /** All courses: the index every other racing screen hangs off. */
  async function racingIndex(root) {
    const now = Date.now();
    C.mount(root, C.html`${U.skeleton(4)}`);
    const [today, tomorrow] = await loadDays('racing', 2);

    const open = today.filter(m => liveRaces(m, now).length);
    const byRegion = new Map();
    open.forEach(m => {
      if (!byRegion.has(m.region)) byRegion.set(m.region, []);
      byRegion.get(m.region).push(m);
    });
    const nextOff = open.reduce((a, m) => a.concat(liveRaces(m, now)), []).sort((a, b) => a.offTs - b.offTs)[0];

    C.mount(root, C.html`
      <div class="page-head">
        <h1>All courses</h1>
        <span class="sub">${open.length} meetings today</span>
      </div>

      <div class="mod">
        <div class="rows">
          ${navRow({
            route: 'racing/next', title: 'Next races',
            sub: 'Every course, in time order',
            lead: C.raw('<span class="row-ic">⏱</span>'),
            right: nextOff ? C.countdown(nextOff.offTs, now) : '',
            soon: nextOff && nextOff.offTs - now < 9e5
          })}
        </div>
      </div>

      <div class="mod">
        <div class="mod-head"><span class="mod-ic">${C.raw(ICON.globe)}</span><h2>Racing today</h2>
          <span class="mod-meta">by country</span></div>
        <div class="rows">
          ${BS.racing.REGIONS.filter(r => byRegion.has(r.id)).map(r => {
            const ms = byRegion.get(r.id);
            const races = ms.reduce((a, m) => a + liveRaces(m, now).length, 0);
            const next = ms.reduce((a, m) => a.concat(liveRaces(m, now)), []).sort((a, b) => a.offTs - b.offTs)[0];
            return navRow({
              route: 'racing/region/' + r.id, title: r.name,
              sub: ms.length + (ms.length === 1 ? ' course · ' : ' courses · ') + races + ' races to come',
              lead: C.raw('<span class="row-ic">' + r.flag + '</span>'),
              right: next ? U.time(next.offTs, next.tzRef) : '',
              rightSub: next ? C.countdown(next.offTs, now) : ''
            });
          })}
        </div>
        ${!byRegion.size ? C.html`<p class="row-empty">Every meeting has finished for the day. Tomorrow's cards are below.</p>` : ''}
      </div>

      <div class="mod">
        <div class="mod-head"><span class="mod-ic">${C.raw(ICON.cal)}</span><h2>Tomorrow</h2></div>
        <div class="rows">
          ${tomorrow.slice(0, 6).map(m => navRow({
            route: 'racing/meeting/' + m.id, title: m.venue,
            sub: m.races.length + ' races · first off ' + U.time(m.firstOff, m.tz),
            lead: C.raw('<span class="row-ic">' + m.flag + '</span>')
          }))}
        </div>
        <button class="mod-cta" data-act="go" data-route="racing/week">All seven days</button>
      </div>
    `);
  }

  /** One country: its courses. */
  async function racingRegion(root, regionId) {
    const now = Date.now();
    const region = BS.racing.REGIONS.find(r => r.id === regionId);
    C.mount(root, C.html`${U.skeleton(3)}`);
    await loadDays('racing', 2);
    const meetings = Array.from(U.index.meetings.values())
      .filter(m => m.region === regionId && m.dayOffset === 0)
      .sort((a, b) => a.firstOff - b.firstOff);
    const open = meetings.filter(m => liveRaces(m, now).length);

    C.mount(root, C.html`
      <button class="back" data-act="go" data-route="racing/today">← All courses</button>
      <div class="page-head">
        <h1>${region ? region.flag + ' ' + region.name : regionId}</h1>
        <span class="sub">${open.length} meetings</span>
      </div>
      <div class="mod">
        <div class="rows">
          ${open.length ? open.map(m => {
            const rest = liveRaces(m, now);
            return navRow({
              route: 'racing/meeting/' + m.id, title: m.venue,
              sub: rest.length + ' races to come · ' + m.going + ' · ' + (m.surface === 'aw' ? 'all-weather' : m.surface),
              lead: C.raw('<span class="row-ic">' + m.flag + '</span>'),
              right: rest.length ? U.time(rest[0].offTs, m.tz) : '',
              rightSub: rest.length ? C.countdown(rest[0].offTs, now) : '',
              soon: rest.length && rest[0].offTs - now < 9e5
            });
          }) : C.html`<p class="row-empty">Every meeting in ${region ? region.name : 'this country'} has finished for the day.</p>`}
        </div>
      </div>
    `);
  }

  /** One meeting: its race times, the way a racecard index reads. */
  async function racingMeeting(root, meetingId) {
    const now = Date.now();
    if (!U.index.meetings.has(meetingId)) { C.mount(root, C.html`${U.skeleton(3)}`); await loadDays('racing', 7); }
    const m = U.index.meetings.get(meetingId);
    if (!m) { C.mount(root, U.empty('Meeting not found', 'Go back and pick the course again.')); return; }
    const region = BS.racing.REGIONS.find(r => r.id === m.region);

    C.mount(root, C.html`
      <button class="back" data-act="go" data-route="racing/region/${m.region}">← ${region ? region.name : 'Back'}</button>
      <div class="page-head">
        <h1>${m.flag} ${m.venue}</h1>
        <span class="sub">${m.races.length} races · ${m.going}</span>
        <span class="right">
          ${C.raw('<button class="fav-btn" data-act="fav" data-id="' + C.esc(m.id) + '" aria-pressed="' +
            String(BS.store.isFav(m.id)) + '" aria-label="Star this meeting"><svg viewBox="0 0 24 24" fill="' +
            (BS.store.isFav(m.id) ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" ' +
            'stroke-linejoin="round"><path d="M12 4l2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8z"/></svg></button>')}
        </span>
      </div>
      <div class="mod">
        <div class="rows">
          ${m.races.map(r => {
            const st = BS.racing.raceState(r, now);
            return C.html`
              <button class="row" data-act="go" data-route="racing/race/${r.id}">
                ${timeChip(r.offTs, m.tz)}
                <span class="row-main">
                  <span class="row-title"><span class="nm">${r.name}</span></span>
                  <span class="row-sub">${r.distance} · ${r.cls} · ${r.declared ? r.runners.length + ' runners' : 'entries only'}</span>
                </span>
                <span class="row-end">
                  ${st === 'result' ? C.raw('<span class="cd" style="color:var(--ink-3)">Result</span>')
                    : st === 'off' ? C.raw('<span class="livechip"><span class="pulse"></span>OFF</span>')
                    : C.html`<span class="cd ${r.offTs - now < 9e5 ? 'soon' : ''}">${C.countdown(r.offTs, now)}</span>`}
                </span>
                <span class="chev">›</span>
              </button>`;
          })}
        </div>
      </div>
    `);
  }

  /** Flat next-off list across every jurisdiction. */
  async function racingNext(root) {
    const now = Date.now();
    C.mount(root, C.html`${U.skeleton(4)}`);
    await loadDays('racing', 2);
    const all = Array.from(U.index.races.values())
      .filter(r => r.offTs > now && r.declared)
      .sort((a, b) => a.offTs - b.offTs).slice(0, 60);
    const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
    const today = all.filter(r => r.offTs < midnight.getTime());
    const later = all.filter(r => r.offTs >= midnight.getTime());

    const group = (label, list) => list.length ? C.html`
      <div class="mod">
        <div class="mod-head"><h2>${label}</h2><span class="mod-meta">${list.length} races</span></div>
        <div class="rows">
          ${list.map(r => C.html`
            <button class="row" data-act="go" data-route="racing/race/${r.id}">
              ${timeChip(r.offTs, r.tzRef)}
              <span class="row-main">
                <span class="row-title"><span class="nm">${r.flag} ${r.venue}</span></span>
                <span class="row-sub">${r.distance} · ${r.runners.length} runners</span>
              </span>
              <span class="row-end"><span class="cd ${r.offTs - now < 9e5 ? 'soon' : ''}">${C.countdown(r.offTs, now)}</span></span>
              <span class="chev">›</span>
            </button>`)}
        </div>
      </div>` : '';

    C.mount(root, C.html`
      <button class="back" data-act="go" data-route="racing/today">← All courses</button>
      <div class="page-head"><h1>Next races</h1><span class="sub">every course, in time order</span></div>
      ${group('Today', today)}
      ${group('Tomorrow', later)}
      ${!all.length ? U.empty('Nothing left to run', 'Every declared race has gone. Tomorrow\'s cards are in Next 7 days.') : ''}
    `);
  }

  /* ================= FOOTBALL ================= */

  async function footballIndex(root) {
    const now = Date.now();
    C.mount(root, C.html`${U.skeleton(4)}`);
    const [today, tomorrow] = await loadDays('football', 2);
    const live = today.filter(f => BS.football.fixtureState(f, now).state !== 'ft');
    const byRegion = new Map();
    live.forEach(f => {
      if (!byRegion.has(f.region)) byRegion.set(f.region, []);
      byRegion.get(f.region).push(f);
    });
    const next = live.filter(f => f.koTs > now).sort((a, b) => a.koTs - b.koTs)[0];

    C.mount(root, C.html`
      <div class="page-head"><h1>All competitions</h1><span class="sub">${live.length} matches today</span></div>

      <div class="mod">
        <div class="rows">
          ${navRow({
            route: 'football/next', title: 'Next kick-offs', sub: 'Every competition, in time order',
            lead: C.raw('<span class="row-ic">⏱</span>'),
            right: next ? C.countdown(next.koTs, now) : ''
          })}
        </div>
      </div>

      <div class="mod">
        <div class="mod-head"><span class="mod-ic">${C.raw(ICON.globe)}</span><h2>Football today</h2>
          <span class="mod-meta">by region</span></div>
        <div class="rows">
          ${BS.football.REGIONS.filter(r => byRegion.has(r.id)).map(r => {
            const fx = byRegion.get(r.id);
            const comps = new Set(fx.map(f => f.compId));
            const nx = fx.filter(f => f.koTs > now).sort((a, b) => a.koTs - b.koTs)[0];
            const nLive = fx.filter(f => BS.football.fixtureState(f, now).state === 'live').length;
            return navRow({
              route: 'football/region/' + r.id, title: r.name,
              sub: comps.size + (comps.size === 1 ? ' competition · ' : ' competitions · ') + fx.length + ' matches',
              lead: C.raw('<span class="row-ic">' + r.flag + '</span>'),
              right: nLive ? C.raw('<span class="livechip"><span class="pulse"></span>' + nLive + ' live</span>')
                : nx ? U.time(nx.koTs, nx.tz) : '',
              rightSub: !nLive && nx ? C.countdown(nx.koTs, now) : ''
            });
          })}
        </div>
        ${!byRegion.size ? C.html`<p class="row-empty">Every match today has finished.</p>` : ''}
      </div>

      <div class="mod">
        <div class="mod-head"><span class="mod-ic">${C.raw(ICON.cal)}</span><h2>Tomorrow</h2>
          <span class="mod-meta">${tomorrow.length} matches</span></div>
        <button class="mod-cta" data-act="go" data-route="football/week">All seven days</button>
      </div>
    `);
  }

  async function footballRegion(root, regionId) {
    const now = Date.now();
    const region = BS.football.REGIONS.find(r => r.id === regionId);
    C.mount(root, C.html`${U.skeleton(3)}`);
    await loadDays('football', 2);
    const fx = Array.from(U.index.fixtures.values()).filter(f => f.region === regionId && f.dayOffset === 0);
    const byComp = new Map();
    fx.forEach(f => { if (!byComp.has(f.compId)) byComp.set(f.compId, []); byComp.get(f.compId).push(f); });

    C.mount(root, C.html`
      <button class="back" data-act="go" data-route="football/today">← All competitions</button>
      <div class="page-head">
        <h1>${region ? region.flag + ' ' + region.name : regionId}</h1>
        <span class="sub">${byComp.size} competitions</span>
      </div>
      <div class="mod">
        <div class="rows">
          ${Array.from(byComp.entries()).map(e => {
            const comp = BS.football.COMPS.find(c => c.id === e[0]);
            const list = e[1].sort((a, b) => a.koTs - b.koTs);
            const nx = list.filter(f => f.koTs > now)[0];
            return navRow({
              route: 'football/comp/' + e[0], title: comp ? comp.name : e[0],
              sub: list.length + (list.length === 1 ? ' match' : ' matches'),
              lead: C.raw('<span class="row-ic">⚽</span>'),
              right: nx ? U.time(nx.koTs, nx.tz) : 'all played',
              rightSub: nx ? C.countdown(nx.koTs, now) : ''
            });
          })}
          ${!byComp.size ? C.html`<p class="row-empty">Nothing scheduled in this region today.</p>` : ''}
        </div>
      </div>
    `);
  }

  async function footballComp(root, compId) {
    const now = Date.now();
    if (!U.index.fixtures.size) { C.mount(root, C.html`${U.skeleton(3)}`); await loadDays('football', 7); }
    const comp = BS.football.COMPS.find(c => c.id === compId);
    const list = Array.from(U.index.fixtures.values())
      .filter(f => f.compId === compId && f.dayOffset === 0).sort((a, b) => a.koTs - b.koTs);

    C.mount(root, C.html`
      <button class="back" data-act="go" data-route="football/region/${comp ? comp.region : ''}">← Back</button>
      <div class="page-head"><h1>${comp ? comp.name : compId}</h1><span class="sub">${list.length} matches today</span></div>
      <div class="mod">
        <div class="rows">
          ${list.map(f => {
            const st = BS.football.fixtureState(f, now);
            return C.html`
              <button class="row" data-act="go" data-route="football/match/${f.id}">
                ${st.state === 'upcoming' ? timeChip(f.koTs, f.tz)
                  : C.raw('<span class="timechip">' + (st.state === 'live' ? st.minute + "'" : 'FT') + '</span>')}
                <span class="row-main">
                  <span class="row-title"><span class="nm">${f.home} v ${f.away}</span></span>
                  <span class="row-sub">${st.state === 'upcoming'
                    ? 'form ' + f.form.home + ' · ' + f.form.away
                    : st.score[0] + '–' + st.score[1] + (st.state === 'live' ? ' · in play' : ' · full time')}</span>
                </span>
                <span class="row-end">${st.state === 'upcoming'
                  ? C.html`<span class="cd">${C.countdown(f.koTs, now)}</span>`
                  : st.state === 'live' ? C.raw('<span class="livechip"><span class="pulse"></span>LIVE</span>') : ''}</span>
                <span class="chev">›</span>
              </button>`;
          })}
          ${!list.length ? C.html`<p class="row-empty">No matches in this competition today.</p>` : ''}
        </div>
      </div>
    `);
  }

  async function footballNext(root) {
    const now = Date.now();
    C.mount(root, C.html`${U.skeleton(4)}`);
    await loadDays('football', 2);
    const all = Array.from(U.index.fixtures.values()).filter(f => f.koTs > now)
      .sort((a, b) => a.koTs - b.koTs).slice(0, 50);
    const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
    const group = (label, list) => list.length ? C.html`
      <div class="mod">
        <div class="mod-head"><h2>${label}</h2><span class="mod-meta">${list.length} matches</span></div>
        <div class="rows">
          ${list.map(f => C.html`
            <button class="row" data-act="go" data-route="football/match/${f.id}">
              ${timeChip(f.koTs, f.tz)}
              <span class="row-main">
                <span class="row-title"><span class="nm">${f.home} v ${f.away}</span></span>
                <span class="row-sub">${f.comp}</span>
              </span>
              <span class="row-end"><span class="cd">${C.countdown(f.koTs, now)}</span></span>
              <span class="chev">›</span>
            </button>`)}
        </div>
      </div>` : '';
    C.mount(root, C.html`
      <button class="back" data-act="go" data-route="football/today">← All competitions</button>
      <div class="page-head"><h1>Next kick-offs</h1></div>
      ${group('Today', all.filter(f => f.koTs < midnight.getTime()))}
      ${group('Tomorrow', all.filter(f => f.koTs >= midnight.getTime()))}
      ${!all.length ? U.empty('Nothing left today', 'Tomorrow\'s fixtures are in Next 7 days.') : ''}
    `);
  }

  const ICON = {
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.3 3.6 8.5S14.4 18.1 12 20.5c-2.4-2.4-3.6-5.3-3.6-8.5S9.6 5.9 12 3.5z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10h16M9 4v4M15 4v4"/></svg>'
  };

  BS.viewsBrowse = {
    racingIndex, racingRegion, racingMeeting, racingNext,
    footballIndex, footballRegion, footballComp, footballNext
  };
})(window.BS = window.BS || {});
