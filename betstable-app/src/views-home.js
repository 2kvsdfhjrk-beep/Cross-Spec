/* views-home.js — the front page. Cross-sport, opinionated about what matters
   right now: what is hot, who you follow, and what is about to go off. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui, T = BS.tipsters;

  /* ---------- shared hot-tip card ----------
     Used on the front page rail and on the Hot page grid, so a tip looks the
     same wherever you meet it. */
  function hotCard(g, now) {
    const names = g.tips.slice(0, 3).map(t => t.tipster.handle);
    const extra = g.tips.length - names.length;
    return C.html`
      <button class="hot sport-${g.sport}" data-act="${g.kind}" data-id="${g.eventId}">
        <span class="hot-top">
          <span class="sportdot ${g.sport}">${g.sport === 'racing' ? '🐴' : '⚽'}</span>
          <span class="ev">${g.flag ? g.flag + ' ' : ''}${g.title}</span>
          <span class="cd">${C.countdown(g.startTs, now)}</span>
        </span>
        <span>
          <span class="sel" style="display:block">${g.selection}</span>
          <span class="mkt">${g.market} · ${g.subtitle}</span>
        </span>
        <span class="heat">
          <span class="heat-bar"><i style="width:${g.heat}%"></i></span>
          <span class="n">HEAT ${g.heat}</span>
        </span>
        <span class="hot-bottom">
          <span class="avatars">${g.tips.slice(0, 3).map(t => U.avatar(t.tipster.silk))}</span>
          <span class="who">${names[0]}${extra > 0 ? ' +' + (g.tips.length - 1) + ' more' : (g.tips.length > 1 ? ' +' + (g.tips.length - 1) : '')}</span>
          <span class="price">${C.fmtOdds(g.odds)}</span>
        </span>
      </button>`;
  }

  /** Keep both sports on the front page even when racing has ten times the volume. */
  function balanced(hot, n) {
    const racing = hot.filter(g => g.sport === 'racing');
    const football = hot.filter(g => g.sport === 'football');
    const out = [];
    for (let i = 0; i < n; i++) {
      const wantFootball = i % 2 === 1;
      const from = wantFootball ? football : racing;
      const other = wantFootball ? racing : football;
      const pick = from.shift() || other.shift();
      if (!pick) break;
      out.push(pick);
    }
    return out.sort((a, b) => b.heat - a.heat);
  }

  /* A paddock fence at the horizon: two rails, widely spaced posts, and the
     page colour beneath, so the dark hero resolves into the cream body. */
  const fence = C.raw(
    '<svg class="fenceline" viewBox="0 0 1200 54" preserveAspectRatio="none" aria-hidden="true">' +
    '<g fill="var(--bg)">' +
    Array.from({ length: 12 }, (_, i) =>
      '<rect x="' + (i * 108 + 26) + '" y="12" width="9" height="30" rx="3"/>').join('') +
    '<rect x="0" y="19" width="1200" height="6" rx="3"/>' +
    '<rect x="0" y="31" width="1200" height="6" rx="3"/>' +
    '<rect x="0" y="41" width="1200" height="13"/>' +
    '</g></svg>');

  async function home(root) {
    const now = Date.now();
    C.mount(root, C.html`<div class="wrap" style="padding-top:16px">${U.skeleton(3)}</div>`);

    const [meetings, fixturesToday, fixturesTomorrow] = await Promise.all([
      BS.provider.meetings(0), BS.provider.fixtures(0), BS.provider.fixtures(1)
    ]);
    meetings.forEach(m => {
      U.index.meetings.set(m.id, m);
      m.races.forEach(r => { r.tzRef = m.tz; r.venue = m.venue; r.flag = m.flag; U.index.races.set(r.id, r); });
    });
    fixturesToday.concat(fixturesTomorrow).forEach(f => U.index.fixtures.set(f.id, f));

    const upcomingRaces = meetings.reduce((a, m) =>
      a.concat(m.races.filter(r => BS.racing.raceState(r, now) === 'upcoming')), []);
    const openMeetings = meetings.filter(m => m.races.some(r => BS.racing.raceState(r, now) !== 'result'));
    const liveFixtures = fixturesToday.filter(f => BS.football.fixtureState(f, now).state !== 'ft');

    const hot = T.hotTips(now);
    const featured = balanced(hot.slice(0, 40), 8);
    const followed = T.followingList();
    const followFeed = T.hotTips(now, { followingOnly: true }).slice(0, 6);
    const ranked = T.all().filter(t => t.ranked).sort((a, b) => b.lo - a.lo).slice(0, 4);
    const myPending = BS.store.tips().filter(t => t.status === 'pending').length;

    C.mount(root, C.html`
      <section class="hero">
        ${U.roundel('hero-watermark', { ground: '#0B4038', ring: '#F6F0E1' })}
        <div class="hero-inner">
          <span class="eyebrow">Sample data, live mechanism<span class="pip"></span></span>
          <h1>Be <span class="g">stable.</span></h1>
          <p class="lede">Every tip here is stamped by the server, its odds frozen on the spot and settled
            by machine. Nothing can be edited, deleted or quietly forgotten — not by tipsters, not by us.</p>
          <div class="hero-cta">
            <button class="btn" data-act="nav" data-id="hot">See what's hot →</button>
            <button class="btn secondary" data-act="nav" data-id="racing">Today's racing</button>
          </div>
          <div class="counters">
            <div class="counter"><div class="n" data-count="${upcomingRaces.length}">0</div><div class="k">Races to come</div></div>
            <div class="counter"><div class="n" data-count="${liveFixtures.length}">0</div><div class="k">Matches today</div></div>
            <div class="counter"><div class="n" data-count="${hot.length}">0</div><div class="k">Live tips</div></div>
            <div class="counter"><div class="n" data-count="${T.all().filter(t => t.ranked).length}">0</div><div class="k">Ranked tipsters</div></div>
          </div>
        </div>
        ${fence}
      </section>

      <div class="wrap">
        <div class="sec-head">
          <h2>Hot right now</h2>
          <span class="sub">most agreed-on tips, both sports</span>
          <button class="more" data-act="nav" data-id="hot">See all ${hot.length} →</button>
        </div>
        ${featured.length
          ? C.html`<div class="rail">${featured.map(g => hotCard(g, now))}</div>`
          : U.empty('Nothing live yet', 'Tips appear here as tipsters post on today\'s card. Check back closer to the first race.')}

        <div class="sec-head"><h2>Where to</h2></div>
        <div class="doors">
          <button class="door racing" data-act="nav" data-id="racing">
            ${U.roundel('door-art', { ground: '#8A5439', ring: '#F6F0E1' })}
            <span class="kicker">Horse racing</span>
            <span class="name">BetStable</span>
            <span class="meta">${openMeetings.length} meetings · ${upcomingRaces.length} races to come · 9 jurisdictions</span>
            <span class="go">Open the card →</span>
          </button>
          <button class="door football" data-act="nav" data-id="football">
            ${U.roundel('door-art', { ground: '#054B06', ring: '#F6F0E1' })}
            <span class="kicker">Football</span>
            <span class="name">ScoreMore</span>
            <span class="meta">${liveFixtures.length} matches today · ${fixturesTomorrow.length} tomorrow · 18 competitions</span>
            <span class="go">Open the fixtures →</span>
          </button>
        </div>

        <div class="sec-head">
          <h2>Following</h2>
          <span class="sub">${followed.length ? followed.length + ' tipsters' : 'nobody yet'}</span>
          ${followed.length ? C.html`<button class="more" data-act="nav" data-id="following">Manage →</button>` : ''}
        </div>
        ${followed.length
          ? (followFeed.length
            ? C.html`<div class="hotgrid">${followFeed.map(g => hotCard(g, now))}</div>`
            : U.emptyRow('Nobody you follow has posted yet',
                'You follow ' + followed.length + ' ' + (followed.length === 1 ? 'tipster' : 'tipsters') +
                '. Their tips land here the moment they post.',
                C.html`<button class="btn secondary" data-act="nav" data-id="tipsters">Find more tipsters</button>`))
          : U.emptyRow('Follow a few tipsters',
              'Their tips land on your front page and they are marked in every table. Records are public and permanent, so you can check before you follow.',
              C.html`<button class="btn" data-act="nav" data-id="tipsters">Browse tipsters</button>`)}

        <div class="sec-head">
          <h2>Top of the table</h2>
          <span class="sub">ranked on the bottom of their 95% range</span>
          <button class="more" data-act="nav" data-id="tipsters">All tipsters →</button>
        </div>
        <div class="tipster-grid">${ranked.map(t => tipsterCard(t))}</div>

        <div class="sec-head"><h2>Why the record holds</h2></div>
        <div class="doors" style="grid-template-columns:repeat(3,1fr)">
          ${[['Frozen on arrival', 'The price is re-read from the feed and stamped by the server clock the instant you post — not your device, not later.'],
             ['Settled by machine', 'Results come from a feed on a schedule. No tipster marks their own bet, and neither do we.'],
             ['Published daily', 'Every tip is hashed into one root each day, so anyone can check a tip existed exactly as stated.']]
            .map((x, i) => C.html`
              <div class="card" style="padding:17px">
                <div style="font-family:'Montserrat',sans-serif;font-weight:900;font-size:13px;color:var(--accent);letter-spacing:.06em">0${i + 1}</div>
                <h3 style="margin:6px 0 5px;font-size:16px">${x[0]}</h3>
                <p style="margin:0;font-size:13px;color:var(--ink-2)">${x[1]}</p>
              </div>`)}
        </div>
        ${myPending ? C.html`<div class="notice" style="margin-top:16px"><span>⏳</span><span>
          You have <b>${myPending} tip${myPending === 1 ? '' : 's'}</b> waiting on the results feed.
          <button data-act="nav" data-id="me" style="color:var(--accent);font-weight:750">Open my record →</button></span></div>` : ''}
      </div>
    `);
    countUp(root);
  }

  function tipsterCard(t) {
    const following = T.isFollowing(t.handle);
    return C.html`
      <div class="tipster">
        <button data-act="tipster" data-id="${t.handle}" aria-label="${t.handle}">${U.avatar(t.silk)}</button>
        <div class="tipster-body">
          <div class="tipster-top">
            <button data-act="tipster" data-id="${t.handle}" class="h">${t.handle}</button>
            ${t.ranked ? '' : C.raw('<span class="badge pending">unranked</span>')}
            <button class="follow-btn" data-act="follow" data-id="${t.handle}" aria-pressed="${String(following)}">
              ${following ? '✓ Following' : '+ Follow'}
            </button>
          </div>
          <p class="b">${t.bio}</p>
          <div class="stats">
            <span><b>${C.fmtPct(t.roi)}</b> ROI</span>
            <span><b>${t.n}</b> settled</span>
            <span><b>${t.followers.toLocaleString()}</b> followers</span>
          </div>
        </div>
      </div>`;
  }

  /** Counters tick up once, on arrival — the only motion on the page. */
  function countUp(root) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      C.$$('[data-count]', root).forEach(el => { el.textContent = el.dataset.count; });
      return;
    }
    C.$$('[data-count]', root).forEach(function (el) {
      const target = +el.dataset.count, dur = 620, start = performance.now();
      (function frame(t) {
        const k = Math.min(1, (t - start) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(frame);
      })(start);
    });
  }

  BS.viewsHome = { home, hotCard, tipsterCard, balanced };
})(window.BS = window.BS || {});
