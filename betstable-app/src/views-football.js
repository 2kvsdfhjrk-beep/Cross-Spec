/* views-football.js — ScoreMore. Global fixture list grouped by region and
   competition, live scores, and the match page with its markets. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui;
  const F = BS.football;

  const done = (fx, now) => F.fixtureState(fx, now).state === 'ft';

  function fixtureRow(fx, now) {
    const st = F.fixtureState(fx, now);
    const live = st.state === 'live', ft = st.state === 'ft';
    return C.html`
      <div class="fixture">
        <span class="ko">
          ${live ? C.html`<span class="livechip"><span class="pulse"></span>${st.minute}'</span>`
            : ft ? C.raw('<span style="color:var(--ink-3)">FT</span>') : U.time(fx.koTs, fx.tz)}
          ${!live && !ft ? C.html`<small>${C.countdown(fx.koTs, now)}</small>` : ''}
        </span>
        <button class="teams" data-act="match" data-id="${fx.id}" style="text-align:left;width:100%">
          <span class="team">${fx.home}${(live || ft) ? C.html`<span class="sc">${st.score[0]}</span>` : ''}</span>
          <span class="team">${fx.away}${(live || ft) ? C.html`<span class="sc">${st.score[1]}</span>` : ''}</span>
          <span class="form">${fx.form.home} · ${fx.form.away}</span>
        </button>
        ${st.state === 'upcoming' ? C.html`
          <span class="mkt">
            ${U.oddsButton({ refId: fx.id, refKind: 'fixture', selection: fx.home, label: '1', odds: fx.odds.home, market: 'Match result', event: fx.home + ' v ' + fx.away, startTs: fx.koTs, tz: fx.tz })}
            ${U.oddsButton({ refId: fx.id, refKind: 'fixture', selection: 'Draw', label: 'X', odds: fx.odds.draw, market: 'Match result', event: fx.home + ' v ' + fx.away, startTs: fx.koTs, tz: fx.tz })}
            ${U.oddsButton({ refId: fx.id, refKind: 'fixture', selection: fx.away, label: '2', odds: fx.odds.away, market: 'Match result', event: fx.home + ' v ' + fx.away, startTs: fx.koTs, tz: fx.tz })}
          </span>` : C.raw('<span style="font-size:12px;color:var(--ink-3);font-weight:600">' +
            (live ? 'in play' : 'settled') + '</span>')}
      </div>`;
  }

  function compBlock(compId, list, now) {
    const comp = F.COMPS.find(c => c.id === compId);
    const upcoming = list.filter(f => !done(f, now)).length;
    return C.html`
      <div class="comp-block">
        <div class="comp-head">
          <h3>${comp ? comp.name : compId}</h3>
          <span class="meta">${list.length} ${list.length === 1 ? 'match' : 'matches'}${upcoming ? ' · ' + upcoming + ' to come' : ''}</span>
        </div>
        ${list.sort((a, b) => a.koTs - b.koTs).map(f => fixtureRow(f, now))}
      </div>`;
  }

  function regionBlock(regionId, fixtures, now) {
    const region = F.REGIONS.find(r => r.id === regionId);
    const open = U.state.collapsed['f:' + regionId] !== true;
    const byComp = new Map();
    for (const f of fixtures) {
      if (!byComp.has(f.compId)) byComp.set(f.compId, []);
      byComp.get(f.compId).push(f);
    }
    const next = fixtures.filter(f => F.fixtureState(f, now).state === 'upcoming').sort((a, b) => a.koTs - b.koTs)[0];
    const liveN = fixtures.filter(f => F.fixtureState(f, now).state === 'live').length;
    return C.html`
      <section class="region" data-open="${String(open)}">
        <button class="region-head" data-act="toggle-region" data-id="f:${regionId}" aria-expanded="${String(open)}">
          <span class="flag">${region.flag}</span>
          <span>
            <h2>${region.name}</h2>
            <span class="meta">${byComp.size} ${byComp.size === 1 ? 'competition' : 'competitions'} · ${fixtures.length} matches</span>
          </span>
          <span class="next">
            ${liveN ? C.html`<span class="livechip"><span class="pulse"></span>${liveN} live</span>` :
              next ? C.html`<span>next <b>${U.time(next.koTs, next.tz)}</b></span>` : C.raw('<span style="color:var(--ink-3)">all played</span>')}
            <span class="caret">▾</span>
          </span>
        </button>
        <div class="region-body" style="grid-template-columns:1fr">
          ${Array.from(byComp.entries()).map(e => compBlock(e[0], e[1], now))}
        </div>
      </section>`;
  }

  function group(fixtures) {
    const g = new Map();
    for (const f of fixtures) {
      if (!g.has(f.region)) g.set(f.region, []);
      g.get(f.region).push(f);
    }
    return F.REGIONS.filter(r => g.has(r.id)).map(r => ({ id: r.id, fixtures: g.get(r.id) }));
  }

  function toolbar(isWeek) {
    return C.html`
      <div class="toolbar">
        <label class="search">
          <span aria-hidden="true">🔍</span>
          <input type="search" placeholder="Team, competition or country" value="${U.state.q}" data-act="search" aria-label="Search fixtures">
        </label>
        <button class="chip" data-act="tz" aria-pressed="${String(U.state.tzMode === 'venue')}">
          🕑 ${U.state.tzMode === 'venue' ? 'Local kick-off' : 'My time'}
        </button>
        ${isWeek ? '' : C.html`<button class="chip" data-act="finished" aria-pressed="${String(U.state.showFinished)}">Show finished</button>`}
      </div>`;
  }

  const hit = (f, q) => !q || (f.home + ' ' + f.away + ' ' + f.comp).toLowerCase().indexOf(q) >= 0;

  async function today(root) {
    const now = Date.now();
    C.mount(root, C.html`${toolbar(false)}<div>${U.skeleton(4)}</div>`);
    const all = await BS.provider.fixtures(0);
    all.forEach(f => U.index.fixtures.set(f.id, f));

    const q = U.state.q.toLowerCase();
    let visible = all.filter(f => hit(f, q));
    if (!U.state.showFinished) visible = visible.filter(f => !done(f, now));
    const groups = group(visible);
    const hidden = all.length - visible.length;

    C.mount(root, C.html`
      ${toolbar(false)}
      ${groups.length ? groups.map(g => regionBlock(g.id, g.fixtures, now)) :
        U.empty('⚽', 'No matches match', q ? 'Nothing today matches “' + U.state.q + '”.' :
          'Every match on today\'s feed has finished. Tomorrow\'s fixtures are in Next 7 days.')}
      ${hidden > 0 ? C.html`<div class="notice"><span>🌙</span><span><b>${hidden} finished ${hidden === 1 ? 'match' : 'matches'}</b> hidden. A competition only shows while it still has a match to come.</span></div>` : ''}
    `);
  }

  async function week(root) {
    const now = Date.now();
    C.mount(root, C.html`${toolbar(true)}<div>${U.skeleton(3)}</div>`);
    const days = await Promise.all(Array.from({ length: 7 }, (_, d) => BS.provider.fixtures(d)));
    days.forEach(list => list.forEach(f => U.index.fixtures.set(f.id, f)));

    const sel = U.state.day, q = U.state.q.toLowerCase();
    let list = days[sel].filter(f => hit(f, q));
    if (sel === 0) list = list.filter(f => !done(f, now));
    const groups = group(list);

    C.mount(root, C.html`
      ${toolbar(true)}
      <div class="daystrip" role="tablist" aria-label="Choose a day">
        ${Array.from({ length: 7 }, (_, d) => C.html`
          <button class="day" role="tab" aria-selected="${String(sel === d)}" data-act="day" data-day="${d}">
            <span class="dow">${d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : C.fmtDay(now + d * 864e5).split(' ')[0]}</span>
            <span class="dnum">${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(now + d * 864e5))}</span>
            <span class="dmeta">${days[d].length} matches</span>
          </button>`)}
      </div>
      ${sel > 0 ? C.html`<div class="notice"><span>📋</span><span>
        <b>Line-ups firm up closer to kick-off.</b> Expected XIs appear inside 48 hours and are confirmed about an hour before.
      </span></div>` : ''}
      ${groups.length ? groups.map(g => regionBlock(g.id, g.fixtures, now)) :
        U.empty('📅', 'No fixtures', 'Nothing scheduled on the feed for this day.')}
    `);
  }

  function match(root, id) {
    const fx = U.index.fixtures.get(id);
    if (!fx) { C.mount(root, U.empty('🤷', 'Match not loaded', 'Go back and pick the fixture again.')); return; }
    const now = Date.now();
    const st = F.fixtureState(fx, now);
    const ls = F.lineupState(fx, now);
    const open = st.state === 'upcoming';
    const ev = fx.home + ' v ' + fx.away;
    const mk = (sel, odds, market, label) => U.oddsButton({
      refId: fx.id, refKind: 'fixture', selection: sel, odds: odds, market: market,
      event: ev, startTs: fx.koTs, tz: fx.tz, label: label
    });

    C.mount(root, C.html`
      <button class="back" data-act="back">← ${fx.comp}</button>
      <div class="detail-head">
        <div>
          <h1>${fx.home} v ${fx.away}</h1>
          <div class="sub">${fx.comp} · ${U.day(fx.koTs, fx.tz)} · form ${fx.form.home} v ${fx.form.away}</div>
        </div>
        <div class="when">
          <div class="t">${st.state === 'upcoming' ? U.time(fx.koTs, fx.tz) : st.score[0] + '–' + st.score[1]}</div>
          <div class="cd">${st.state === 'live' ? st.minute + "' live" : st.state === 'ft' ? 'Full time' : 'in ' + C.countdown(fx.koTs, now)}</div>
        </div>
      </div>

      ${open ? C.html`
        <div class="panel">
          <div class="panel-head"><h3>Match result</h3><span class="meta">1 unit, flat</span></div>
          <div class="panel-body" style="display:flex;gap:8px">
            ${mk(fx.home, fx.odds.home, 'Match result', 'Home')}
            ${mk('Draw', fx.odds.draw, 'Match result', 'Draw')}
            ${mk(fx.away, fx.odds.away, 'Match result', 'Away')}
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Goals</h3></div>
          <div class="panel-body" style="display:flex;gap:8px;flex-wrap:wrap">
            ${mk('Over 2.5 goals', fx.ou25[0], 'Over/Under', 'Over 2.5')}
            ${mk('Under 2.5 goals', fx.ou25[1], 'Over/Under', 'Under 2.5')}
            ${mk('Both teams to score', fx.btts[0], 'BTTS', 'BTTS yes')}
            ${mk('Not both teams to score', fx.btts[1], 'BTTS', 'BTTS no')}
          </div>
        </div>` : C.html`<div class="notice"><span>🏁</span><span>
          <b>Betting closed.</b> ${st.state === 'live' ? 'The match is in play.' : 'Tips on this match have been settled from the results feed.'}
        </span></div>`}

      <div class="panel">
        <div class="panel-head">
          <h3>${ls === 'confirmed' ? 'Confirmed line-ups' : ls === 'probable' ? 'Probable line-ups' : 'Squads'}</h3>
          <span class="meta">${ls === 'squad' ? 'XIs published 48h out' : fx.lineups.home.formation + ' v ' + fx.lineups.away.formation}</span>
        </div>
        <div class="panel-body" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;font-size:13.5px">
          ${[['home', fx.home], ['away', fx.away]].map(side => C.html`
            <div>
              <div style="font-weight:700;margin-bottom:6px">${side[1]}</div>
              ${ls === 'squad' ? C.raw('<div style="color:var(--ink-3)">Not yet published</div>') :
                fx.lineups[side[0]].players.map(p => C.html`<div style="color:var(--ink-2);padding:1px 0">${p}</div>`)}
            </div>`)}
        </div>
      </div>`);
  }

  BS.viewsFootball = { today, week, match, done };
})(window.BS = window.BS || {});
