/* views-racing.js — BetStable. Today's cards grouped by jurisdiction, the week
   ahead, and the racecard itself. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui;
  const S = BS.racing;

  const matches = (m, q) => !q || (m.venue + ' ' + m.regionName).toLowerCase().indexOf(q) >= 0;

  /** A meeting is only shown while it still has a race to come. */
  function liveRaces(meeting, now) {
    return meeting.races.filter(r => S.raceState(r, now) !== 'result');
  }

  function meetingCard(m, now, opts) {
    const remaining = liveRaces(m, now);
    const next = remaining[0];
    return C.html`
      <div class="meeting">
        <div class="meeting-head">
          <span class="flag">${m.flag}</span>
          <span class="venue">${m.venue}</span>
          <span class="tag ${m.surface}">${m.surface === 'aw' ? 'All-weather' : m.surface}</span>
          <span class="going">${m.going}</span>
        </div>
        <div class="race-times">
          ${m.races.map(r => {
            const st = S.raceState(r, now);
            const cls = st === 'result' ? 'rt done' : st === 'off' ? 'rt off' : (next && r.id === next.id ? 'rt next' : 'rt');
            // Countdown where it matters — the next race here, or anything close
            // to the off. Everything else shows its field size instead.
            const soon = next && (r.id === next.id || r.offTs - now < 30 * 60000);
            const sub = st === 'result' ? 'result' : st === 'off' ? 'off' :
              (soon && (!opts || opts.showCountdown !== false)
                ? C.countdown(r.offTs, now)
                : (r.declared ? r.runners.length + ' rnr' : 'entries'));
            return C.html`<button class="${cls}" data-act="race" data-id="${r.id}">
              ${U.time(r.offTs, m.tz)}<small>${sub}</small></button>`;
          })}
        </div>
      </div>`;
  }

  function regionBlock(regionId, meetings, now, opts) {
    const region = S.REGIONS.find(r => r.id === regionId);
    const races = meetings.reduce((a, m) => a + m.races.length, 0);
    const upcoming = meetings.reduce((a, m) => a.concat(liveRaces(m, now)), []).sort((a, b) => a.offTs - b.offTs);
    const open = U.state.collapsed['r:' + regionId] !== true;
    return C.html`
      <section class="region" data-open="${String(open)}">
        <button class="region-head" data-act="toggle-region" data-id="r:${regionId}" aria-expanded="${String(open)}">
          <span class="flag">${region.flag}</span>
          <span>
            <h2>${region.name}</h2>
            <span class="meta">${meetings.length} ${meetings.length === 1 ? 'meeting' : 'meetings'} · ${races} races</span>
          </span>
          <span class="next">
            ${upcoming.length ? C.html`<span>next off <b>${U.time(upcoming[0].offTs, upcoming[0].tzRef || '')}</b> · ${C.countdown(upcoming[0].offTs, now)}</span>` : C.raw('<span style="color:var(--ink-3)">card complete</span>')}
            <span class="caret">▾</span>
          </span>
        </button>
        <div class="region-body">
          ${meetings.map(m => meetingCard(m, now, opts))}
        </div>
      </section>`;
  }

  /** Group meetings into the regional buckets the user actually thinks in. */
  function groupByRegion(meetings) {
    const groups = new Map();
    for (const m of meetings) {
      if (!groups.has(m.region)) groups.set(m.region, []);
      groups.get(m.region).push(m);
    }
    return S.REGIONS.filter(r => groups.has(r.id)).map(r => ({
      id: r.id,
      meetings: groups.get(r.id).sort((a, b) => a.firstOff - b.firstOff)
    }));
  }

  async function today(root) {
    const now = Date.now();
    C.mount(root, C.html`${toolbar(false)}<div>${U.skeleton(4)}</div>`);
    const all = await BS.provider.meetings(0);
    all.forEach(m => {
      U.index.meetings.set(m.id, m);
      m.races.forEach(r => { r.tzRef = m.tz; r.venue = m.venue; r.flag = m.flag; U.index.races.set(r.id, r); });
    });

    const q = U.state.q.toLowerCase();
    let visible = all.filter(m => matches(m, q));
    if (!U.state.showFinished) visible = visible.filter(m => liveRaces(m, now).length > 0);

    const groups = groupByRegion(visible);
    const hidden = all.length - visible.length;

    C.mount(root, C.html`
      ${toolbar(false)}
      ${groups.length ? groups.map(g => regionBlock(g.id, g.meetings, now)) :
        U.empty('No cards match', q ? 'Nothing here matches “' + U.state.q + '”. Try a course or a country.' :
          'Every meeting on the feed has finished for the day. Tomorrow\'s cards are in Next 7 days.')}
      ${hidden > 0 ? C.html`<div class="notice"><span>🌙</span><span><b>${hidden} ${hidden === 1 ? 'meeting has' : 'meetings have'} finished</b> and ${hidden === 1 ? 'is' : 'are'} hidden. A course only appears while it still has a race to come.</span></div>` : ''}
    `);
  }

  function toolbar(isWeek) {
    return C.html`
      <div class="toolbar">
        <label class="search">
          <span aria-hidden="true">🔍</span>
          <input type="search" placeholder="Course, country or region" value="${U.state.q}" data-act="search" aria-label="Search meetings">
        </label>
        <button class="chip" data-act="tz" aria-pressed="${String(U.state.tzMode === 'venue')}">
          🕑 ${U.state.tzMode === 'venue' ? 'Course time' : 'My time'}
        </button>
        ${isWeek ? '' : C.html`<button class="chip" data-act="finished" aria-pressed="${String(U.state.showFinished)}">Show finished</button>`}
      </div>`;
  }

  /* ---------- next 7 days ---------- */
  async function week(root) {
    const now = Date.now();
    C.mount(root, C.html`${toolbar(true)}${daystrip(now, [])}<div>${U.skeleton(3)}</div>`);
    const counts = [];
    for (let d = 0; d <= 6; d++) counts.push(BS.provider.meetings(d));
    const days = await Promise.all(counts);
    days.forEach(list => list.forEach(m => {
      U.index.meetings.set(m.id, m);
      m.races.forEach(r => { r.tzRef = m.tz; r.venue = m.venue; r.flag = m.flag; U.index.races.set(r.id, r); });
    }));

    const sel = U.state.day;
    const q = U.state.q.toLowerCase();
    let list = days[sel].filter(m => matches(m, q));
    if (sel === 0) list = list.filter(m => liveRaces(m, now).length > 0);

    const groups = groupByRegion(list);
    const declared = list.reduce((a, m) => a + m.races.filter(r => r.declared).length, 0);
    const total = list.reduce((a, m) => a + m.races.length, 0);

    C.mount(root, C.html`
      ${toolbar(true)}
      ${daystrip(now, days)}
      ${sel > 0 ? C.html`<div class="notice"><span>📋</span><span>
        <b>${declared} of ${total} races declared.</b> Runners and riders are published about 48 hours out —
        until then a race shows its entries and expected field size, with no jockeys and no prices.
      </span></div>` : ''}
      ${groups.length ? groups.map(g => regionBlock(g.id, g.meetings, now, { showCountdown: sel === 0 })) :
        U.empty('Nothing scheduled', 'No meetings on the feed for this day yet.')}
    `);
  }

  function daystrip(now, days) {
    return C.html`
      <div class="daystrip" role="tablist" aria-label="Choose a day">
        ${Array.from({ length: 7 }, (_, d) => {
          const ts = now + d * 864e5;
          const list = days[d] || [];
          const nRaces = list.reduce((a, m) => a + m.races.length, 0);
          return C.html`
            <button class="day" role="tab" aria-selected="${String(U.state.day === d)}" data-act="day" data-day="${d}">
              <span class="dow">${d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : C.fmtDay(ts).split(' ')[0]}</span>
              <span class="dnum">${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(ts))}</span>
              <span class="dmeta">${days.length ? (list.length + ' mtgs · ' + nRaces + ' races') : '—'}</span>
            </button>`;
        })}
      </div>`;
  }

  /* ---------- racecard ---------- */
  function racecard(root, raceId) {
    const race = U.index.races.get(raceId);
    if (!race) { C.mount(root, U.empty('Race not loaded', 'Go back and pick the meeting again.')); return; }
    const meeting = U.index.meetings.get(race.meetingId);
    const now = Date.now();
    const st = S.raceState(race, now);
    const result = st === 'result' ? S.resultFor(race) : null;

    C.mount(root, C.html`
      <button class="back" data-act="back">← ${meeting ? meeting.venue : 'Back'}</button>
      <div class="detail-head">
        <div>
          <h1>${race.no}. ${race.name}</h1>
          <div class="sub">
            ${meeting ? meeting.flag + ' ' + meeting.venue : ''} · ${race.distance} · ${race.cls} ·
            ${race.going} · £${race.prize.toLocaleString()} · ${race.runners.length} runners
          </div>
        </div>
        <div class="when">
          <div class="t">${U.time(race.offTs, race.tzRef)}</div>
          <div class="cd">${st === 'result' ? 'Result' : st === 'off' ? 'Off' : 'in ' + C.countdown(race.offTs, now)}</div>
        </div>
      </div>

      ${!race.declared ? C.html`<div class="notice"><span>⏳</span><span>
        <b>Not yet declared.</b> These are entries. Final runners, riders and prices arrive about 48 hours
        before the off — you can't post a tip until then, because there is no price to freeze.</span></div>` : ''}

      ${st === 'result' ? C.html`<div class="notice"><span>🏁</span><span>
        <b>Result in.</b> Any tip on this race has been settled from the results feed. Nobody marked it by hand.</span></div>` : ''}

      <div class="runners">
        ${race.runners.map(r => {
          const pos = result ? result.positions.indexOf(r.no) + 1 : 0;
          return C.html`
            <div class="runner">
              <span class="num">${pos ? C.html`<span class="pos ${pos === 1 ? 'p1' : ''}">${pos}</span>` : r.no}</span>
              ${U.silk(r.silk)}
              <span>
                <div class="name">${r.horse}</div>
                <div class="who">
                  ${r.jockey ? C.html`${r.jockey}<span class="sep">·</span>` : C.raw('<span style="color:var(--ink-3)">Rider TBC</span><span class="sep">·</span>')}
                  ${r.trainer}
                </div>
                <div class="form">${r.age}yo · ${r.weight} · form ${r.form}</div>
              </span>
              ${race.declared && st === 'upcoming'
                ? U.oddsButton({
                    refId: race.id, refKind: 'race', selection: r.horse, odds: r.odds,
                    market: 'Win', event: (meeting ? meeting.venue : '') + ' ' + U.time(race.offTs, race.tzRef),
                    startTs: race.offTs, tz: race.tzRef
                  })
                : C.raw('<span style="font-weight:700;color:var(--ink-3)">' + (r.odds ? C.fmtOdds(r.odds) : '—') + '</span>')}
            </div>`;
        })}
      </div>`);
  }

  BS.viewsRacing = { today, week, racecard, liveRaces };
})(window.BS = window.BS || {});
