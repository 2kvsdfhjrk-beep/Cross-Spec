/* views-hot.js — the cross-sport hot list, the tipster directory and a single
   tipster's page. Following is the thread running through all three. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui, T = BS.tipsters;

  let sportFilter = 'all';
  let sortBy = 'heat';

  /* ---------- hot tips ---------- */
  async function hot(root) {
    const now = Date.now();
    C.mount(root, C.html`<div>${U.skeleton(4)}</div>`);
    await ensureEvents();

    let list = T.hotTips(now, { sport: sportFilter === 'all' ? undefined : sportFilter });
    if (sportFilter !== 'all') list = list.filter(g => g.sport === sportFilter);
    if (sortBy === 'time') list = list.slice().sort((a, b) => a.startTs - b.startTs);
    if (sortBy === 'price') list = list.slice().sort((a, b) => b.odds - a.odds);
    const shown = list.slice(0, 48);
    const followedCount = list.filter(g => g.followed.length).length;

    C.mount(root, C.html`
      <div class="toolbar">
        <button class="chip ${sportFilter === 'all' ? 'on' : ''}" data-act="sport" data-id="all">Both sports</button>
        <button class="chip ${sportFilter === 'racing' ? 'on' : ''}" data-act="sport" data-id="racing">${BS.icons.icon('racing')} Racing</button>
        <button class="chip ${sportFilter === 'football' ? 'on' : ''}" data-act="sport" data-id="football">${BS.icons.icon('football')} Football</button>
        <span style="flex:1"></span>
        <button class="chip ${sortBy === 'heat' ? 'on' : ''}" data-act="sort" data-id="heat">Hottest</button>
        <button class="chip ${sortBy === 'time' ? 'on' : ''}" data-act="sort" data-id="time">Off soonest</button>
        <button class="chip ${sortBy === 'price' ? 'on' : ''}" data-act="sort" data-id="price">Biggest price</button>
      </div>

      <div class="notice">${BS.icons.icon('hot')}<span>
        <b>Heat is agreement, not confidence.</b> It rises when several tipsters with a real record land on the
        same selection close to the off. It is not a prediction, and a hot tip loses as often as its price says it will.
        ${followedCount ? C.raw('<b>' + followedCount + '</b> of these include someone you follow.') : ''}
      </span></div>

      ${shown.length
        ? C.html`<div class="mod"><div class="rows">${shown.map(g => BS.viewsHome.tipRow(g, now))}</div></div>`
        : U.empty('Nothing live in this filter',
            'No tipster has posted on an upcoming ' + (sportFilter === 'all' ? 'event' : sportFilter + ' event') +
            ' yet. Tips cluster in the hour before the off.')}
    `);
  }

  /** Hot tips need both feeds in the index, whichever page you arrived from. */
  async function ensureEvents() {
    const jobs = [];
    if (!U.index.races.size) jobs.push(BS.provider.meetings(0).then(list => list.forEach(m => {
      U.index.meetings.set(m.id, m);
      m.races.forEach(r => { r.tzRef = m.tz; r.venue = m.venue; r.flag = m.flag; U.index.races.set(r.id, r); });
    })));
    if (!U.index.fixtures.size) {
      jobs.push(BS.provider.fixtures(0).then(l => l.forEach(f => U.index.fixtures.set(f.id, f))));
      jobs.push(BS.provider.fixtures(1).then(l => l.forEach(f => U.index.fixtures.set(f.id, f))));
    }
    await Promise.all(jobs);
  }

  /* ---------- tipster directory ---------- */
  let dirFilter = 'all';
  let dirSort = 'roi';
  function tipsters(root) {
    let list = T.all();
    if (dirFilter === 'racing' || dirFilter === 'football') list = list.filter(t => t.sport === dirFilter);
    if (dirFilter === 'following') list = list.filter(t => T.isFollowing(t.handle));
    const cmp = T.SORTS[dirSort] || T.SORTS.roi;
    list = list.slice().sort(cmp);
    const followed = T.followingList();

    C.mount(root, C.html`
      <div class="toolbar">
        <button class="chip ${dirFilter === 'all' ? 'on' : ''}" data-act="dir" data-id="all">All ${T.all().length}</button>
        <button class="chip ${dirFilter === 'racing' ? 'on' : ''}" data-act="dir" data-id="racing">${BS.icons.icon('racing')} Racing</button>
        <button class="chip ${dirFilter === 'football' ? 'on' : ''}" data-act="dir" data-id="football">${BS.icons.icon('football')} Football</button>
        <button class="chip ${dirFilter === 'following' ? 'on' : ''}" data-act="dir" data-id="following">Following ${followed.length}</button>
        <span style="flex:1"></span>
        ${BS.viewsHome.select('sort-dir', dirSort,
          [['roi', 'ROI, all time'], ['streak', 'Profit streak'], ['last7', 'Last 7 days'],
           ['last30', 'Last 30 days'], ['followers', 'Most followed']])}
      </div>
      <div class="notice">${BS.icons.icon('ruler')}<span>
        Sorted by the <b>bottom of each 95% range</b>, with unranked tipsters last. Anyone under 100 settled tips
        is shown but never ranked — a short hot run is not a record.
      </span></div>
      ${list.length
        ? C.html`<div class="mod"><div class="rows">${list.map(t => BS.viewsHome.tipsterRow(t, dirSort))}</div></div>`
        : U.empty('You are not following anyone yet',
            'Follow a tipster and they appear here, on your front page, and highlighted in every table.',
            C.html`<button class="btn" data-act="go" data-route="tipsters">Browse everyone</button>`)}
    `);
  }

  /* ---------- one tipster ---------- */
  async function profile(root, handle) {
    const t = T.get(handle);
    if (!t) { C.mount(root, U.empty('No such tipster', 'That handle is not on the roster.')); return; }
    const now = Date.now();
    C.mount(root, C.html`<button class="back" data-act="back">← Tipsters</button><div>${U.skeleton(2)}</div>`);
    await ensureEvents();

    const open = T.openTipsFor(handle, now);
    const following = T.isFollowing(handle);
    const curve = T.curveFor(t);

    C.mount(root, C.html`
      <button class="back" data-act="back">← Tipsters</button>
      <div class="profile-head">
        ${U.avatar(t.silk, 'lg')}
        <div style="min-width:0;flex:1">
          <h1>${t.handle}${BS.viewsAccount.badgeChips(t.handle)}</h1>
          <div class="b">${t.bio}</div>
          <div style="display:flex;gap:14px;margin-top:9px;font-size:12.5px;color:var(--on-dark-2);font-weight:650">
            <span>${BS.icons.icon(t.sport === 'racing' ? 'racing' : 'football')} ${t.sport === 'racing' ? 'Racing' : 'Football'}</span>
            <span>${t.followers.toLocaleString()} followers</span>
            <span>since ${t.since}</span>
          </div>
        </div>
        <button class="follow-btn" data-act="follow" data-id="${t.handle}" aria-pressed="${String(following)}"
          style="${following ? '' : 'background:var(--grass-500);border-color:var(--grass-500);color:#08201B'}">
          ${following ? C.html`${BS.icons.icon('check')} Following` : C.html`${BS.icons.icon('follow')} Follow`}
        </button>
      </div>

      <div class="statgrid">
        <div class="stat">
          <div class="k">ROI · 95% range</div>
          <div class="v ${t.roi >= 0 ? 'good' : 'bad'}">${C.fmtPct(t.roi)}</div>
          <div class="sub">${C.fmtPct(t.lo)} to ${C.fmtPct(t.hi)}</div>
        </div>
        <div class="stat">
          <div class="k">Settled tips</div><div class="v">${t.n}</div>
          <div class="sub">${t.ranked ? 'ranked' : (100 - t.n) + ' more to be ranked'}</div>
        </div>
        <div class="stat">
          <div class="k">Strike rate</div><div class="v">${t.strike.toFixed(1)}%</div>
          <div class="sub">winners per 100 tips</div>
        </div>
        <div class="stat">
          <div class="k">Max drawdown</div><div class="v">${C.fmtSigned(t.maxDD)}</div>
          <div class="sub">deepest peak-to-trough</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Cumulative units</h3><span class="meta">last 60 settled</span></div>
        <div class="panel-body">${sparkline(curve)}</div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h3>Live tips</h3>
          <span class="meta">${open.length} open · settle automatically</span>
        </div>
        ${open.length ? C.html`<div class="tiplist">
          ${open.map(o => C.html`
            <div class="tip-row">
              <span class="badge pending">${C.countdown(o.event.startTs, now)}</span>
              <button data-act="${o.event.kind}" data-id="${o.event.id}" style="text-align:left;min-width:0">
                <span class="sel2" style="display:block">${o.selection}</span>
                <span class="ev">${o.market} · ${o.event.title} · ${o.event.subtitle}</span>
              </button>
              <span class="ret">${C.fmtOdds(o.odds)}</span>
            </div>`)}
        </div>` : U.empty('Nothing live', t.handle + ' has no open tips right now. They post on a slice of the card, not all of it.')}
      </div>

      <div class="notice">${BS.icons.icon('lock')}<span>
        This record is append-only. ${t.handle} cannot edit a tip, delete a loser, or change a price after posting —
        and the bad months stay visible for exactly that reason.</span></div>
    `);
  }

  /** Small single-series sparkline: same rules as the big chart, less furniture. */
  function sparkline(pts) {
    const W = 720, H = 120, P = 10;
    const lo = Math.min(0, Math.min.apply(null, pts)), hi = Math.max(0, Math.max.apply(null, pts));
    const xs = i => P + (i / (pts.length - 1)) * (W - P * 2);
    const ys = v => P + (1 - (v - lo) / (hi - lo || 1)) * (H - P * 2);
    const d = pts.map((v, i) => (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(v).toFixed(1)).join(' ');
    return C.raw('<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;height:auto" ' +
      'role="img" aria-label="Cumulative units over the last 60 settled tips">' +
      '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + ys(0).toFixed(1) + '" y2="' + ys(0).toFixed(1) +
        '" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="3 3"/>' +
      '<path d="' + d + ' L' + xs(pts.length - 1).toFixed(1) + ' ' + ys(0).toFixed(1) + ' L' + xs(0).toFixed(1) +
        ' ' + ys(0).toFixed(1) + 'Z" fill="var(--accent)" opacity=".12"/>' +
      '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" ' +
        'vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + xs(pts.length - 1).toFixed(1) + '" cy="' + ys(pts[pts.length - 1]).toFixed(1) +
        '" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/></svg>');
  }

  BS.viewsHot = {
    hot, tipsters, profile,
    setSport: s => { sportFilter = s; },
    setSort: s => { sortBy = s; },
    setDir: d => { dirFilter = d; },
    setDirSort: v => { dirSort = v; }
  };
})(window.BS = window.BS || {});
