/* app.js — shell, routing, the settlement job and the clock.
   Everything navigable is a route string, so the drawer, the bottom-bar
   popovers and the desktop dropdowns all drive the same function. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui, S = BS.ui.state;

  const TITLES = {
    home: 'Home', hot: 'Hot tips', 'hot/racing': 'Hot racing tips', 'hot/football': 'Hot football tips',
    tipsters: 'Tipsters', following: 'Following', me: 'My tips',
    favourites: 'Favourites', settings: 'Settings',
    'racing/today': "Today's racing", 'racing/week': 'Racing · next 7 days', 'racing/table': 'Racing table',
    'football/today': "Today's football", 'football/week': 'Football · next 7 days', 'football/table': 'Football table'
  };

  /** Which top-level menu entry should look active for a given route. */
  function activeId(route) {
    if (route.indexOf('racing') === 0) return 'racing';
    if (route.indexOf('football') === 0) return 'football';
    if (route.indexOf('hot') === 0) return 'tips';
    if (route === 'tipsters' || route === 'following' || route.indexOf('tipster/') === 0) return 'tipsters';
    if (route === 'me' || route === 'settings' || route === 'favourites') return 'me';
    return 'home';
  }
  const bottomId = route => {
    const a = activeId(route);
    return a === 'tipsters' ? 'me' : a;
  };

  /* ---------------- routing ---------------- */
  function readHash() {
    const h = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
    S.route = h || 'home';
    syncProduct();
  }
  function syncProduct() {
    if (S.route.indexOf('racing') === 0 || S.route === 'hot/racing') S.product = 'racing';
    else if (S.route.indexOf('football') === 0 || S.route === 'hot/football') S.product = 'football';
  }
  function writeHash() {
    const h = '#' + S.route;
    if (location.hash !== h) history.replaceState(null, '', h);
  }
  function go(route) {
    if (!route) return;
    BS.menu.closeAll();
    S.route = route;
    S.q = '';
    syncProduct();
    render();
    window.scrollTo(0, 0);
  }

  /* ---------------- chrome ---------------- */
  function appbar() {
    const health = BS.provider.health();
    const bad = Object.keys(health).filter(k => health[k].status !== 'ok').length;
    const id = activeId(S.route);
    const pending = BS.store.tips().filter(t => t.status === 'pending').length;
    return C.html`
      <div class="appbar">
        <div class="appbar-row">
          <button class="icon-btn" data-act="drawer" aria-label="Open menu">${BS.menu.icon('menu')}</button>
          <button class="brandlink" data-act="go" data-route="home" aria-label="Home">
            ${U.mark('', { simple: true })}
            <span class="hide-sm">${S.product === 'football' ? U.wordmark('Score', 'More') : U.wordmark('Bet', 'Stable')}</span>
          </button>
          <span style="width:8px"></span>
          ${BS.menu.menubar(S.route, id)}
          <span class="spacer"></span>
          <button class="health" data-act="health" title="Feed status">
            <span class="led"></span><span class="hide-sm">${bad ? bad + ' degraded' : 'Feeds live'}</span>
          </button>
          <button class="icon-btn ${id === 'me' ? 'on' : ''}" data-act="go" data-route="me" aria-label="My record">
            ${BS.menu.icon('me')}${pending ? C.raw('<span class="dot"></span>') : ''}
          </button>
        </div>
      </div>`;
  }

  const TICKER_ON = ['home', 'racing/today', 'racing/week', 'football/today', 'football/week', 'hot', 'hot/racing', 'hot/football'];
  function ticker() {
    if (TICKER_ON.indexOf(S.route) < 0) return C.raw('');
    const now = Date.now();
    const racing = S.product !== 'football';
    const items = racing
      ? Array.from(U.index.races.values()).filter(r => r.offTs > now && r.declared)
          .sort((a, b) => a.offTs - b.offTs).slice(0, 6)
          .map(r => ({ id: r.id, route: 'racing/race/' + r.id, label: r.venue, flag: r.flag, ts: r.offTs, tz: r.tzRef }))
      : Array.from(U.index.fixtures.values()).filter(f => f.koTs > now)
          .sort((a, b) => a.koTs - b.koTs).slice(0, 6)
          .map(f => ({ id: f.id, route: 'football/match/' + f.id, label: f.home + ' v ' + f.away, flag: '', ts: f.koTs, tz: f.tz }));
    if (!items.length) return C.raw('');
    return C.html`
      <div class="ticker">
        <span class="ticker-label">${racing ? 'Next off' : 'Next up'}</span>
        ${items.map(it => C.html`
          <button class="ticker-item ${it.ts - now < 6e5 ? 'imminent' : ''}" data-act="go" data-route="${it.route}">
            <b>${U.time(it.ts, it.tz)}</b> ${it.flag} ${it.label}
            <span class="cd">${C.countdown(it.ts, now)}</span>
          </button>`)}
      </div>`;
  }

  /* ---------------- render ---------------- */
  let rendering = false;
  async function render() {
    if (rendering) return;
    rendering = true;
    document.documentElement.setAttribute('data-product', S.product);
    writeHash();
    document.title = (TITLES[S.route] || 'BetStable') + ' · ' +
      (S.product === 'football' ? 'ScoreMore' : 'BetStable');

    if (!C.$('#shell')) {
      C.$('#app').innerHTML = '<div id="shell"></div><main id="view"></main>' +
        '<div class="rg">18+ · Sample data, not a live feed · Betting involves a risk of loss · ' +
        '<a href="https://www.begambleaware.org" target="_blank" rel="noopener nofollow">BeGambleAware.org</a></div>' +
        '<div id="bnav"></div>';
    }
    const shell = C.$('#shell'), view = C.$('#view');
    const chrome = () => {
      C.mount(shell, C.html`${appbar()}${ticker()}`);
      C.mount(C.$('#bnav'), BS.menu.bottomnav(bottomId(S.route)));
    };
    chrome();

    const r = S.route, part = r.split('/');
    try {
      if (r === 'home') await BS.viewsHome.home(view);
      else if (r === 'hot' || r === 'hot/racing' || r === 'hot/football') {
        BS.viewsHot.setSport(part[1] || 'all');
        await BS.viewsHot.hot(view);
      }
      else if (r === 'tipsters') { BS.viewsHot.setDir('all'); BS.viewsHot.tipsters(view); }
      else if (r === 'following') { BS.viewsHot.setDir('following'); BS.viewsHot.tipsters(view); }
      else if (part[0] === 'tipster') await BS.viewsHot.profile(view, part.slice(1).join('/'));
      else if (r === 'me') BS.viewsRecord.record(view);
      else if (r === 'favourites') { await ensureLoaded(); BS.viewsExtra.favourites(view); }
      else if (r === 'settings') BS.viewsExtra.settings(view);
      else if (part[1] === 'race') { await ensureLoaded(); BS.viewsRacing.racecard(view, part.slice(2).join('/')); }
      else if (part[1] === 'match') { await ensureLoaded(); BS.viewsFootball.match(view, part.slice(2).join('/')); }
      else if (part[0] === 'racing') {
        if (part[1] === 'table') BS.viewsRecord.rankings(view);
        else await (part[1] === 'week' ? BS.viewsRacing.week(view) : BS.viewsRacing.today(view));
      }
      else if (part[0] === 'football') {
        if (part[1] === 'table') BS.viewsRecord.rankings(view);
        else await (part[1] === 'week' ? BS.viewsFootball.week(view) : BS.viewsFootball.today(view));
      }
      else await BS.viewsHome.home(view);
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

  /* ---------------- settlement job ---------------- */
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
        const runner = race.runners.find(x => x.horse === t.selection);
        const won = !!runner && res.positions[0] === runner.no;
        const winner = race.runners.find(x => x.no === res.positions[0]);
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
  document.addEventListener('click', function (ev) {
    const el = ev.target.closest('[data-act]');
    if (!el) {
      if (BS.menu.anyOpen()) BS.menu.closeAll();
      return;
    }
    const act = el.dataset.act, id = el.dataset.id;

    if (act === 'go') go(el.dataset.route);
    else if (act === 'drawer') BS.menu.openDrawer(S.route);
    else if (act === 'drawer-close') BS.menu.closeDrawer();
    else if (act === 'dropdown') { BS.menu.setDropdown(id); render(); }
    else if (act === 'popover') BS.menu.openPopover(el, id, S.route);
    else if (act === 'race') go('racing/race/' + id);
    else if (act === 'match') go('football/match/' + id);
    else if (act === 'tipster') go('tipster/' + id);
    else if (act === 'back') history.length > 1 ? history.back() : go('home');
    else if (act === 'day') { S.day = +el.dataset.day; render(); }
    else if (act === 'tz') { S.tzMode = S.tzMode === 'local' ? 'venue' : 'local'; render(); }
    else if (act === 'finished') { S.showFinished = !S.showFinished; render(); }
    else if (act === 'band') { BS.viewsRecord.setBand(id); render(); }
    else if (act === 'sport') { go(id === 'all' ? 'hot' : 'hot/' + id); }
    else if (act === 'sort') { BS.viewsHot.setSort(id); render(); }
    else if (act === 'dir') { BS.viewsHot.setDir(id); render(); }
    else if (act === 'fav') {
      const on = BS.store.toggleFav(id);
      U.toast(on ? 'Starred — it will wait for you on the front page' : 'Removed from favourites', on ? '★' : '☆');
      render();
    }
    else if (act === 'follow') {
      const on = BS.tipsters.toggleFollow(id);
      U.toast(on ? 'Following ' + id : 'Unfollowed ' + id, on ? '✓' : '·');
      render();
    }
    else if (act === 'toggle-region') {
      S.collapsed[id] = !S.collapsed[id];
      const sec = el.closest('.region');
      sec.dataset.open = String(!S.collapsed[id]);
      el.setAttribute('aria-expanded', sec.dataset.open);
    }
    else if (act === 'theme') cycleTheme();
    else if (act === 'set-theme') setTheme(id === 'auto' ? '' : id);
    else if (act === 'set-tz') { S.tzMode = id; render(); }
    else if (act === 'set-product') { S.product = id; render(); }
    else if (act === 'set-finished') { S.showFinished = id === 'true'; render(); }
    else if (act === 'reset') {
      BS.store.reset();
      try { localStorage.removeItem('betstable.following.v1'); localStorage.removeItem('betstable.favourites.v1'); } catch (e) {}
      location.reload();
    }
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

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (C.$('.sheet') && !C.$('#agegate')) U.closeSheet();
    else if (BS.menu.anyOpen()) BS.menu.closeAll();
    else if (C.$('.dropdown')) { BS.menu.closeDropdown(); render(); }
  });
  window.addEventListener('hashchange', () => { readHash(); render(); });

  function setTheme(next) {
    if (next) document.documentElement.setAttribute('data-theme', next);
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('betstable.theme', next); } catch (e) {}
    render();
  }
  function cycleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    setTheme(cur === 'dark' ? 'light' : cur === 'light' ? '' : 'dark');
  }
  function showHealth() {
    const h = BS.provider.health();
    const ago = ts => Math.max(0, Math.round((Date.now() - ts) / 1000)) + 's ago';
    U.toast('Odds ' + ago(h.odds.lastSuccess) + ' · Results ' + ago(h.results.lastSuccess) +
      ' · Settlement ' + ago(h.settlement.lastSuccess) + ' (' + h.settlement.pending + ' pending)', '📡');
  }

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

  function boot() {
    try {
      const t = localStorage.getItem('betstable.theme');
      if (t) document.documentElement.setAttribute('data-theme', t);
    } catch (e) {}
    readHash();
    render().then(runSettlement);
    setInterval(runSettlement, 15000);
    setInterval(function () {
      if (document.hidden || C.$('.sheet') || BS.menu.anyOpen()) return;
      const a = document.activeElement;
      if (a && a.matches && a.matches('input, select')) return;
      if (['me', 'settings', 'tipsters', 'following'].indexOf(S.route) >= 0) return;
      const y = window.scrollY;
      render().then(() => window.scrollTo(0, y));
    }, 30000);
  }

  BS.app = { render, boot, runSettlement, go };
  document.addEventListener('DOMContentLoaded', function () { if (!ageGate()) boot(); });
})(window.BS = window.BS || {});
