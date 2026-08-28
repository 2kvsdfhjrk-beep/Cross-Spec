/* app.js — shell, routing, the settlement job and the clock.
   The UI never settles a tip itself; it only reads what the results feed says. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui, S = BS.ui.state;

  const SECTIONS = [
    { id: 'today', label: 'Today', icon: '📅' },
    { id: 'week', label: 'Next 7 days', icon: '🗓' },
    { id: 'record', label: 'My tips', icon: '📒' },
    { id: 'rankings', label: 'Table', icon: '🏅' }
  ];
  const PRODUCTS = [
    { id: 'racing', name: 'BetStable', sub: 'Horse racing', icon: '🐴' },
    { id: 'football', name: 'ScoreMore', sub: 'Football', icon: '⚽' }
  ];

  /* ---------------- routing ---------------- */
  function readHash() {
    const parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!parts.length) return;
    if (parts[0] === 'racing' || parts[0] === 'football') S.product = parts[0];
    if (parts[1] === 'race' || parts[1] === 'match') {
      S.detail = { type: parts[1], id: parts.slice(2).join('/') };
      S.section = 'today';
    } else {
      S.detail = null;
      if (parts[1] && SECTIONS.some(s => s.id === parts[1])) S.section = parts[1];
    }
  }
  function writeHash() {
    const h = S.detail
      ? '#' + S.product + '/' + S.detail.type + '/' + S.detail.id
      : '#' + S.product + '/' + S.section;
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  /* ---------------- chrome ---------------- */
  function appbar() {
    const health = BS.provider.health();
    const bad = Object.keys(health).filter(k => health[k].status !== 'ok').length;
    return C.html`
      <div class="appbar">
        <div class="appbar-row">
          <div class="switch" role="tablist" aria-label="Choose a product">
            ${PRODUCTS.map(p => C.html`
              <button role="tab" aria-selected="${String(S.product === p.id)}" data-act="product" data-id="${p.id}">
                <span class="dot"></span>${p.name}
              </button>`)}
          </div>
          <span class="spacer"></span>
          <button class="health ${bad ? 'warn' : ''}" data-act="health" title="Feed status">
            <span class="led"></span><span class="hide-sm">${bad ? bad + ' degraded' : 'Feeds live'}</span>
          </button>
          <button class="icon-btn" data-act="theme" aria-label="Switch theme">◐</button>
        </div>
        <div class="tabs" role="tablist" aria-label="Sections">
          ${SECTIONS.map(s => C.html`
            <button role="tab" aria-selected="${String(S.section === s.id && !S.detail)}" data-act="section" data-id="${s.id}">
              ${s.label}${s.id === 'record' && pendingCount() ? C.html`<span class="count">${pendingCount()}</span>` : ''}
            </button>`)}
        </div>
      </div>`;
  }

  const pendingCount = () => BS.store.tips().filter(t => t.status === 'pending' && t.product === S.product).length;

  /** Next three events across every jurisdiction — the app's most-used strip. */
  function ticker() {
    const now = Date.now();
    let items;
    if (S.product === 'racing') {
      items = Array.from(U.index.races.values())
        .filter(r => r.offTs > now && r.declared)
        .sort((a, b) => a.offTs - b.offTs).slice(0, 6)
        .map(r => ({ id: r.id, kind: 'race', label: r.venue, flag: r.flag, ts: r.offTs, tz: r.tzRef }));
    } else {
      items = Array.from(U.index.fixtures.values())
        .filter(f => f.koTs > now)
        .sort((a, b) => a.koTs - b.koTs).slice(0, 6)
        .map(f => ({ id: f.id, kind: 'match', label: f.home + ' v ' + f.away, flag: '', ts: f.koTs, tz: f.tz }));
    }
    if (!items.length) return C.raw('');
    return C.html`
      <div class="ticker">
        <span class="ticker-label">${S.product === 'racing' ? 'Next off' : 'Next up'}</span>
        ${items.map(it => C.html`
          <button class="ticker-item ${it.ts - now < 6e5 ? 'imminent' : ''}" data-act="${it.kind}" data-id="${it.id}">
            <b>${U.time(it.ts, it.tz)}</b> ${it.flag} ${it.label}
            <span class="cd">${C.countdown(it.ts, now)}</span>
          </button>`)}
      </div>`;
  }

  function bottomnav() {
    return C.html`
      <nav class="bottomnav" aria-label="Sections">
        ${SECTIONS.map(s => C.html`
          <button aria-selected="${String(S.section === s.id && !S.detail)}" data-act="section" data-id="${s.id}">
            <span style="font-size:17px" aria-hidden="true">${s.icon}</span><span>${s.label}</span>
          </button>`)}
      </nav>`;
  }

  /* ---------------- render ---------------- */
  let rendering = false;
  async function render() {
    if (rendering) return;
    rendering = true;
    document.documentElement.setAttribute('data-product', S.product);
    writeHash();

    const app = C.$('#app');
    let shell = C.$('#shell');
    if (!shell) {
      app.innerHTML = '<div id="shell"></div><main id="view"></main>' + C.unwrap(bottomnav()) +
        '<div class="rg">18+ · Sample data, not a live feed · Betting involves a risk of loss · ' +
        '<a href="https://www.begambleaware.org" target="_blank" rel="noopener nofollow">BeGambleAware.org</a></div>';
      shell = C.$('#shell');
    }
    C.mount(shell, C.html`${appbar()}${S.detail ? '' : ticker()}`);
    C.$$('.bottomnav button').forEach(b =>
      b.setAttribute('aria-selected', String(b.dataset.id === S.section && !S.detail)));

    const view = C.$('#view');
    try {
      if (S.detail) {
        await ensureLoaded();
        if (S.detail.type === 'race') BS.viewsRacing.racecard(view, S.detail.id);
        else BS.viewsFootball.match(view, S.detail.id);
      } else if (S.section === 'record') {
        BS.viewsRecord.record(view);
      } else if (S.section === 'rankings') {
        BS.viewsRecord.rankings(view);
      } else if (S.product === 'racing') {
        await (S.section === 'week' ? BS.viewsRacing.week(view) : BS.viewsRacing.today(view));
      } else {
        await (S.section === 'week' ? BS.viewsFootball.week(view) : BS.viewsFootball.today(view));
      }
      C.mount(shell, C.html`${appbar()}${S.detail ? '' : ticker()}`);
    } finally { rendering = false; }
  }

  /** Deep links land before any list has loaded, so fill the index first. */
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
        BS.store.settle(t.id, won, won ? t.odds - 1 : -1, 'Won by ' + (race.runners.find(r => r.no === res.positions[0]) || {}).horse);
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
    h.settlement.lastSuccess = now;
    h.results.lastSuccess = now;
    if (settled) {
      U.toast(settled + (settled === 1 ? ' tip settled' : ' tips settled') + ' from the results feed', '⚙️');
      render();
    }
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', function (ev) {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;

    if (act === 'product') { S.product = el.dataset.id; S.detail = null; S.q = ''; render(); }
    else if (act === 'section') { S.section = el.dataset.id; S.detail = null; render(); }
    else if (act === 'race') { S.detail = { type: 'race', id: el.dataset.id }; render(); window.scrollTo(0, 0); }
    else if (act === 'match') { S.detail = { type: 'match', id: el.dataset.id }; render(); window.scrollTo(0, 0); }
    else if (act === 'back') { S.detail = null; render(); }
    else if (act === 'day') { S.day = +el.dataset.day; render(); }
    else if (act === 'tz') { S.tzMode = S.tzMode === 'local' ? 'venue' : 'local'; render(); }
    else if (act === 'finished') { S.showFinished = !S.showFinished; render(); }
    else if (act === 'band') { BS.viewsRecord.setBand(el.dataset.band); render(); }
    else if (act === 'toggle-region') {
      S.collapsed[el.dataset.id] = !S.collapsed[el.dataset.id];
      const sec = el.closest('.region');
      sec.dataset.open = String(!S.collapsed[el.dataset.id]);
      el.setAttribute('aria-expanded', sec.dataset.open);
    }
    else if (act === 'theme') cycleTheme();
    else if (act === 'health') showHealth();
    else if (act === 'tip') {
      U.openTipSheet({
        product: S.product, refId: el.dataset.ref, refKind: el.dataset.kind,
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

  document.addEventListener('input', function (ev) {
    const el = ev.target.closest('[data-act="search"]');
    if (!el) return;
    S.q = el.value;
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      const pos = el.selectionStart;
      render().then(() => {
        const again = C.$('[data-act="search"]');
        if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
      });
    }, 220);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && C.$('.sheet')) U.closeSheet();
  });
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

  /* ---------------- age gate ----------------
     A compliance requirement that belongs in code, not in a policy page. */
  function ageGate() {
    let seen = null;
    try { seen = localStorage.getItem('betstable.age.v1'); } catch (e) {}
    if (seen) return false;
    const el = document.createElement('div');
    el.id = 'agegate';
    el.innerHTML = '<div class="scrim"></div><div class="sheet" role="dialog" aria-label="Age check">' +
      '<div class="grabber"></div><h3>Are you 18 or over?</h3>' +
      '<p class="sheet-sub">BetStable and ScoreMore are for adults only. We store this answer on this device.</p>' +
      '<div class="warnbox"><span>⚠️</span><span>Betting involves a risk of loss. Never stake money you cannot ' +
      'afford to lose. Free, confidential help: BeGambleAware.org.</span></div>' +
      '<button class="btn" data-act="agegate">I am 18 or over</button>' +
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
    render().then(() => { runSettlement(); });

    setInterval(runSettlement, 15000);
    // Countdowns go stale fast; refresh the list views while nothing is in hand.
    setInterval(function () {
      if (document.hidden || C.$('.sheet')) return;
      const active = document.activeElement;
      if (active && active.matches && active.matches('input')) return;
      if (S.section === 'record' || S.section === 'rankings') return;
      const y = window.scrollY;
      render().then(() => window.scrollTo(0, y));
    }, 30000);
  }

  BS.app = { render, boot, runSettlement };
  document.addEventListener('DOMContentLoaded', function () {
    if (!ageGate()) boot();
  });
})(window.BS = window.BS || {});
