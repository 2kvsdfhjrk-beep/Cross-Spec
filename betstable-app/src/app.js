/* app.js — shell, routing, the settlement job and the clock.
   The UI never settles a tip itself; it only reads what the results feed says. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui, S = BS.ui.state;

  const ICON = {
    home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
    racing: 'M8 20c-2-2.6-3.2-5-3.2-8a7.2 7.2 0 0 1 14.4 0c0 3-1.2 5.4-3.2 8M6.4 19.4h3.2M14.4 19.4h3.2',
    football: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.6l3.7 2.7-1.4 4.4H9.7L8.3 10.3zM12 3v4.6M19.6 9.6l-3.9.7M16.9 19l-2.6-4.3M7.1 19l2.6-4.3M4.4 9.6l3.9.7',
    hot: 'M12 3c3 4 6 5.5 6 9.5A6 6 0 0 1 6 12.5C6 9.5 8 8 9 5.5c1.6 1.2 2 3 3 4.5.5-2.5 0-5 0-7z',
    me: 'M5 4h11l3 3v13H5zM8.5 9.5h7M8.5 13h7M8.5 16.5h4',
    people: 'M9.4 11.2a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2zM3.6 19.4c0-3 2.6-5.2 5.8-5.2s5.8 2.2 5.8 5.2M16.6 11a2.6 2.6 0 1 0 0-5.2M17.2 14.4c2.4.3 4.2 2.2 4.2 4.8',
    star: 'M12 4l2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8z'
  };
  const icon = k => C.raw('<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
    ICON[k] + '"/></svg>');

  const NAV = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'hot', label: 'Hot tips', icon: 'hot' },
    { id: 'racing', label: 'BetStable', icon: 'racing' },
    { id: 'football', label: 'ScoreMore', icon: 'football' },
    { id: 'tipsters', label: 'Tipsters', icon: 'people' }
  ];
  const SUBS = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Next 7 days' },
    { id: 'table', label: 'Table' }
  ];

  /* ---------------- routing ---------------- */
  function readHash() {
    const p = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!p.length) { S.view = 'home'; return; }
    const head = decodeURIComponent(p[0]);
    if (head === 'racing' || head === 'football') {
      S.product = head;
      if (p[1] === 'race' || p[1] === 'match') { S.view = p[1]; S.detailId = decodeURIComponent(p.slice(2).join('/')); }
      else { S.view = head; S.sub = SUBS.some(s => s.id === p[1]) ? p[1] : 'today'; }
      return;
    }
    if (head === 'tipster' && p[1]) { S.view = 'tipster'; S.detailId = decodeURIComponent(p[1]); return; }
    if (['home', 'hot', 'me', 'tipsters', 'following'].indexOf(head) >= 0) { S.view = head; return; }
    S.view = 'home';
  }
  function writeHash() {
    let h = '#' + S.view;
    if (S.view === 'racing' || S.view === 'football') h = '#' + S.view + '/' + S.sub;
    else if (S.view === 'race' || S.view === 'match') h = '#' + S.product + '/' + S.view + '/' + S.detailId;
    else if (S.view === 'tipster') h = '#tipster/' + encodeURIComponent(S.detailId);
    if (location.hash !== h) history.replaceState(null, '', h);
  }
  const navFor = v => (v === 'race' || v === 'match') ? S.product
    : (v === 'tipster' || v === 'following') ? 'tipsters' : v;

  /* ---------------- chrome ---------------- */
  function appbar() {
    const health = BS.provider.health();
    const bad = Object.keys(health).filter(k => health[k].status !== 'ok').length;
    const inProduct = S.view === 'racing' || S.view === 'football';
    const active = navFor(S.view);
    return C.html`
      <div class="appbar">
        <div class="appbar-row">
          <button class="brandlink" data-act="nav" data-id="home" aria-label="Home">
            ${U.roundel("", { simple: true })}
            ${S.product === 'football' && S.view !== 'home' ? U.wordmark('Score', 'More') : U.wordmark('Bet', 'Stable')}
          </button>
          <span class="spacer"></span>
          ${inProduct ? C.html`<div class="tabs hide-sm" role="tablist" aria-label="Section">
            ${SUBS.map(s => C.html`<button role="tab" aria-selected="${String(S.sub === s.id)}" data-act="sub" data-id="${s.id}">${s.label}</button>`)}
          </div>` : ''}
          <button class="health ${bad ? 'warn' : ''}" data-act="health" title="Feed status">
            <span class="led"></span><span class="hide-sm">${bad ? bad + ' degraded' : 'Feeds live'}</span>
          </button>
          <button class="icon-btn" data-act="theme" aria-label="Switch theme">◐</button>
          <button class="icon-btn profile ${navFor(S.view) === 'me' ? 'on' : ''}" data-act="nav" data-id="me"
            aria-label="My record">${icon('me')}${pendingCount() ? C.raw('<span class="dot"></span>') : ''}</button>
        </div>
        <div class="mainnav" role="tablist" aria-label="Main">
          ${NAV.map(n => C.html`
            <button role="tab" aria-selected="${String(active === n.id)}" data-act="nav" data-id="${n.id}">
              ${n.label}
            </button>`)}
        </div>
        ${inProduct ? C.html`<div class="mainnav subnav" style="border-top:1px solid var(--line-soft)">
          ${SUBS.map(s => C.html`<button class="sub-sm" role="tab" aria-selected="${String(S.sub === s.id)}" data-act="sub" data-id="${s.id}">${s.label}</button>`)}
        </div>` : ''}
      </div>`;
  }

  const pendingCount = () => BS.store.tips().filter(t => t.status === 'pending').length;

  function ticker() {
    const now = Date.now();
    const showRacing = S.view !== 'football' && S.view !== 'match';
    let items = [];
    if (showRacing) {
      items = Array.from(U.index.races.values())
        .filter(r => r.offTs > now && r.declared)
        .sort((a, b) => a.offTs - b.offTs).slice(0, 6)
        .map(r => ({ id: r.id, kind: 'race', label: r.venue, flag: r.flag, ts: r.offTs, tz: r.tzRef }));
    } else {
      items = Array.from(U.index.fixtures.values())
        .filter(f => f.koTs > now).sort((a, b) => a.koTs - b.koTs).slice(0, 6)
        .map(f => ({ id: f.id, kind: 'match', label: f.home + ' v ' + f.away, flag: '', ts: f.koTs, tz: f.tz }));
    }
    if (!items.length) return C.raw('');
    return C.html`
      <div class="ticker">
        <span class="ticker-label">${showRacing ? 'Next off' : 'Next up'}</span>
        ${items.map(it => C.html`
          <button class="ticker-item ${it.ts - now < 6e5 ? 'imminent' : ''}" data-act="${it.kind}" data-id="${it.id}">
            <b>${U.time(it.ts, it.tz)}</b> ${it.flag} ${it.label}
            <span class="cd">${C.countdown(it.ts, now)}</span>
          </button>`)}
      </div>`;
  }

  const bottomnav = () => C.html`
    <nav class="bottomnav" aria-label="Main">
      ${NAV.map(n => C.html`
        <button aria-selected="${String(navFor(S.view) === n.id)}" data-act="nav" data-id="${n.id}">
          ${icon(n.icon)}<span>${n.label}</span>
        </button>`)}
    </nav>`;

  /* ---------------- render ---------------- */
  let rendering = false;
  async function render() {
    if (rendering) return;
    rendering = true;
    document.documentElement.setAttribute('data-product', S.product);
    writeHash();

    const app = C.$('#app');
    if (!C.$('#shell')) {
      app.innerHTML = '<div id="shell"></div><main id="view"></main>' +
        '<div class="rg">18+ · Sample data, not a live feed · Betting involves a risk of loss · ' +
        '<a href="https://www.begambleaware.org" target="_blank" rel="noopener nofollow">BeGambleAware.org</a></div>' +
        '<div id="bnav"></div>';
    }
    const shell = C.$('#shell');
    const chrome = () => {
      C.mount(shell, C.html`${appbar()}${['home', 'me', 'tipsters', 'tipster', 'following'].indexOf(S.view) >= 0 ? '' : ticker()}`);
      C.mount(C.$('#bnav'), bottomnav());
    };
    chrome();

    const view = C.$('#view');
    try {
      switch (S.view) {
        case 'home': await BS.viewsHome.home(view); break;
        case 'hot': await BS.viewsHot.hot(view); break;
        case 'tipsters':
        case 'following': BS.viewsHot.tipsters(view); break;
        case 'tipster': await BS.viewsHot.profile(view, S.detailId); break;
        case 'me': BS.viewsRecord.record(view); break;
        case 'race': await ensureLoaded(); BS.viewsRacing.racecard(view, S.detailId); break;
        case 'match': await ensureLoaded(); BS.viewsFootball.match(view, S.detailId); break;
        case 'racing':
          if (S.sub === 'table') BS.viewsRecord.rankings(view);
          else await (S.sub === 'week' ? BS.viewsRacing.week(view) : BS.viewsRacing.today(view));
          break;
        case 'football':
          if (S.sub === 'table') BS.viewsRecord.rankings(view);
          else await (S.sub === 'week' ? BS.viewsFootball.week(view) : BS.viewsFootball.today(view));
          break;
      }
      chrome();
    } finally { rendering = false; }
  }

  let loadedOnce = false;
  async function ensureLoaded() {
    if (loadedOnce) return;
    const days = [0, 1, 2, 3, 4, 5, 6];
    const [meets, fixes] = await Promise.all([
      Promise.all(days.map(d => BS.provider.meetings(d))),
      Promise.all(days.map(d => BS.provider.fixtures(d)))
    ]);
    meets.forEach(list => list.forEach(m => {
      U.index.meetings.set(m.id, m);
      m.races.forEach(r => { r.tzRef = m.tz; r.venue = m.venue; r.flag = m.flag; U.index.races.set(r.id, r); });
    }));
    fixes.forEach(list => list.forEach(f => U.index.fixtures.set(f.id, f)));
    loadedOnce = true;
  }

  /* ---------------- settlement job ----------------
     Scheduled, never user-triggered. A tipster cannot reach this code. */
  function runSettlement() {
    const now = Date.now();
    const pending = BS.store.tips().filter(t => t.status === 'pending');
    BS.provider.setPending(pending.length);
    let settled = 0;
    for (const t of pending) {
      if (t.refKind === 'race') {
        const race = U.index.races.get(t.refId);
        if (!race || BS.racing.raceState(race, now) !== 'result') continue;
        const res = BS.provider.raceResult(race);
        const runner = race.runners.find(r => r.horse === t.selection);
        const won = !!runner && res.positions[0] === runner.no;
        const winner = race.runners.find(r => r.no === res.positions[0]);
        BS.store.settle(t.id, won, won ? t.odds - 1 : -1, 'Won by ' + (winner ? winner.horse : '—'));
        settled++;
      } else if (t.refKind === 'fixture') {
        const fx = U.index.fixtures.get(t.refId);
        if (!fx || BS.football.fixtureState(fx, now).state !== 'ft') continue;
        const sc = BS.provider.fixtureResult(fx);
        const total = sc[0] + sc[1];
        let won = false;
        if (t.market === 'Match result') {
          won = t.selection === 'Draw' ? sc[0] === sc[1]
            : t.selection === fx.home ? sc[0] > sc[1] : sc[1] > sc[0];
        } else if (t.market === 'Over/Under') {
          won = t.selection.indexOf('Over') === 0 ? total > 2.5 : total < 2.5;
        } else if (t.market === 'BTTS') {
          const btts = sc[0] > 0 && sc[1] > 0;
          won = t.selection.indexOf('Not') === 0 ? !btts : btts;
        }
        BS.store.settle(t.id, won, won ? t.odds - 1 : -1, sc[0] + '–' + sc[1]);
        settled++;
      }
    }
    const h = BS.provider.health();
    h.settlement.lastSuccess = now; h.results.lastSuccess = now;
    if (settled) {
      U.toast(settled + (settled === 1 ? ' tip settled' : ' tips settled') + ' from the results feed', '⚙️');
      render();
    }
  }

  /* ---------------- events ---------------- */
  function go(view, id) {
    S.view = view;
    if (id) S.detailId = id;
    if (view === 'racing' || view === 'football') S.product = view;
    if (view === 'race' || view === 'match') S.product = view === 'race' ? 'racing' : 'football';
    S.q = '';
    render();
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (ev) {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;

    if (act === 'nav') go(id === 'following' ? 'tipsters' : id, null);
    else if (act === 'sub') { S.sub = id; render(); }
    else if (act === 'race') go('race', id);
    else if (act === 'match') go('match', id);
    else if (act === 'tipster') go('tipster', id);
    else if (act === 'back') history.length > 1 ? history.back() : go('home');
    else if (act === 'day') { S.day = +el.dataset.day; render(); }
    else if (act === 'tz') { S.tzMode = S.tzMode === 'local' ? 'venue' : 'local'; render(); }
    else if (act === 'finished') { S.showFinished = !S.showFinished; render(); }
    else if (act === 'band') { BS.viewsRecord.setBand(id); render(); }
    else if (act === 'sport') { BS.viewsHot.setSport(id); render(); }
    else if (act === 'sort') { BS.viewsHot.setSort(id); render(); }
    else if (act === 'dir') { BS.viewsHot.setDir(id); render(); }
    else if (act === 'fav') {
      const on = BS.store.toggleFav(id);
      U.toast(on ? 'Starred — it will wait for you on the front page' : 'Removed from favourites', on ? '★' : '☆');
      render();
    }
    else if (act === 'follow') {
      const nowFollowing = BS.tipsters.toggleFollow(id);
      U.toast(nowFollowing ? 'Following ' + id + ' — their tips are on your front page' : 'Unfollowed ' + id,
        nowFollowing ? '✓' : '·');
      render();
    }
    else if (act === 'toggle-region') {
      S.collapsed[id] = !S.collapsed[id];
      const sec = el.closest('.region');
      sec.dataset.open = String(!S.collapsed[id]);
      el.setAttribute('aria-expanded', sec.dataset.open);
    }
    else if (act === 'theme') cycleTheme();
    else if (act === 'health') showHealth();
    else if (act === 'tip') {
      U.openTipSheet({
        product: el.dataset.kind === 'race' ? 'racing' : 'football',
        refId: el.dataset.ref, refKind: el.dataset.kind,
        selection: el.dataset.sel, market: el.dataset.market, event: el.dataset.event,
        quotedOdds: parseFloat(el.dataset.odds), startTs: +el.dataset.start, tz: el.dataset.tz
      });
    }
    else if (act === 'sheet-cancel') U.closeSheet();
    else if (act === 'sheet-confirm') U.confirmTip();
    else if (act === 'agegate') {
      try { localStorage.setItem('betstable.age.v1', String(Date.now())); } catch (e) {}
      C.$('#agegate').remove();
      boot();
    }
  });

  document.addEventListener('change', function (ev) {
    const el = ev.target.closest('select[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'sort-hot') BS.viewsHome.setSort('hot', el.value);
    else if (act === 'sort-tipsters') BS.viewsHome.setSort('tipsters', el.value);
    else if (act === 'sort-dir') BS.viewsHot.setDirSort(el.value);
    render();
  });

  document.addEventListener('input', function (ev) {
    const el = ev.target.closest('[data-act="search"]');
    if (!el) return;
    S.q = el.value;
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      const pos = el.selectionStart;
      render().then(function () {
        const again = C.$('[data-act="search"]');
        if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
      });
    }, 220);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && C.$('.sheet')) U.closeSheet(); });
  window.addEventListener('hashchange', () => { readHash(); render(); });

  function cycleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : cur === 'light' ? '' : 'dark';
    if (next) document.documentElement.setAttribute('data-theme', next);
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('betstable.theme', next); } catch (e) {}
    U.toast(next ? next[0].toUpperCase() + next.slice(1) + ' theme' : 'Matching your system', '◐');
  }
  function showHealth() {
    const h = BS.provider.health();
    const ago = ts => Math.max(0, Math.round((Date.now() - ts) / 1000)) + 's ago';
    U.toast('Odds ' + ago(h.odds.lastSuccess) + ' · Results ' + ago(h.results.lastSuccess) +
      ' · Settlement ' + ago(h.settlement.lastSuccess) + ' (' + h.settlement.pending + ' pending)', '📡');
  }

  /* ---------------- age gate ---------------- */
  function ageGate() {
    let seen = null;
    try { seen = localStorage.getItem('betstable.age.v1'); } catch (e) {}
    if (seen) return false;
    const el = document.createElement('div');
    el.id = 'agegate';
    el.innerHTML = '<div class="scrim"></div><div class="sheet" role="dialog" aria-label="Age check">' +
      '<div class="grabber"></div>' +
      '<div style="display:flex;justify-content:center;margin-bottom:10px">' +
      C.unwrap(U.roundel('', {})).replace('class="roundel "', 'style="width:64px;height:64px"') + '</div>' +
      '<h3 style="text-align:center">Are you 18 or over?</h3>' +
      '<p class="sheet-sub" style="text-align:center">BetStable and ScoreMore are for adults only. ' +
      'We store this answer on this device.</p>' +
      '<div class="warnbox"><span>⚠️</span><span>Betting involves a risk of loss. Never stake money you cannot ' +
      'afford to lose. Free, confidential help: BeGambleAware.org.</span></div>' +
      '<button class="btn block" data-act="agegate">I am 18 or over</button>' +
      '<p style="font-size:11.5px;color:var(--ink-3);margin:12px 0 0;text-align:center">' +
      'If you are under 18, please close this page.</p></div>';
    document.body.appendChild(el);
    return true;
  }

  /* ---------------- boot ---------------- */
  function boot() {
    try {
      const t = localStorage.getItem('betstable.theme');
      if (t) document.documentElement.setAttribute('data-theme', t);
    } catch (e) {}
    readHash();
    render().then(runSettlement);
    setInterval(runSettlement, 15000);
    setInterval(function () {
      if (document.hidden || C.$('.sheet')) return;
      const a = document.activeElement;
      if (a && a.matches && a.matches('input')) return;
      if (['me', 'tipsters', 'tipster'].indexOf(S.view) >= 0) return;
      const y = window.scrollY;
      render().then(() => window.scrollTo(0, y));
    }, 30000);
  }

  BS.app = { render, boot, runSettlement, go };
  document.addEventListener('DOMContentLoaded', function () { if (!ageGate()) boot(); });
})(window.BS = window.BS || {});
