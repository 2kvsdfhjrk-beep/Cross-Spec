/* menu.js — one navigation model, three presentations.
   Desktop gets a menu bar with dropdowns, phones get a bottom bar whose items
   raise popovers, and the hamburger opens a drawer holding everything. All of
   them render from MENU below, so a route added once appears in all three. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui;

  // The shared family; 'me' is the ledger glyph.
  const icon = (k, cls) => BS.icons.icon(k === 'me' ? 'ledger' : k, cls);

  /* ---------- the model ----------
     `route` is what the app navigates to; `items` turn an entry into a menu. */
  const MENU = [
    { id: 'home', label: 'Home', icon: 'home', route: 'home' },
    {
      id: 'racing', label: 'BetStable', sub: 'Horse racing', icon: 'racing', route: 'racing/today',
      items: [
        { label: 'All courses', sub: 'Every meeting, by country', route: 'racing/today', icon: 'calendar' },
        { label: 'Next races', sub: 'Every course, in time order', route: 'racing/next', icon: 'clock' },
        { label: 'Next 7 days', sub: 'Entries and declarations', route: 'racing/week', icon: 'week' },
        { label: 'Hot racing tips', sub: 'What tipsters agree on', route: 'hot/racing', icon: 'hot' },
        { label: 'Racing table', sub: 'ROI with intervals', route: 'racing/table', icon: 'trophy' }
      ]
    },
    {
      id: 'football', label: 'ScoreMore', sub: 'Football', icon: 'football', route: 'football/today',
      items: [
        { label: 'All competitions', sub: 'Fixtures worldwide', route: 'football/today', icon: 'calendar' },
        { label: 'Next kick-offs', sub: 'In time order', route: 'football/next', icon: 'clock' },
        { label: 'Next 7 days', sub: 'Line-ups as they firm up', route: 'football/week', icon: 'week' },
        { label: 'Hot football tips', sub: 'What tipsters agree on', route: 'hot/football', icon: 'hot' },
        { label: 'Football table', sub: 'ROI with intervals', route: 'football/table', icon: 'trophy' }
      ]
    },
    {
      id: 'tips', label: 'Tips', icon: 'hot', route: 'hot',
      items: [
        { label: 'Hot tips', sub: 'Both sports', route: 'hot', icon: 'hot' },
        { label: 'Racing only', route: 'hot/racing', icon: 'racing' },
        { label: 'Football only', route: 'hot/football', icon: 'football' },
        { label: 'My favourites', sub: 'Events you starred', route: 'favourites', icon: 'star' }
      ]
    },
    {
      id: 'tipsters', label: 'Tipsters', icon: 'people', route: 'tipsters',
      items: [
        { label: 'Browse tipsters', sub: 'Every record, unedited', route: 'tipsters', icon: 'people' },
        { label: 'Experts', sub: 'Consistent and value, checked weekly', route: 'experts', icon: 'trophy' },
        { label: 'Following', route: 'following', icon: 'follow' },
        { label: 'Racing table', route: 'racing/table', icon: 'trophy' },
        { label: 'Football table', route: 'football/table', icon: 'trophy' }
      ]
    },
    {
      id: 'me', label: 'You', icon: 'me', route: 'me',
      items: [
        { label: 'My tips', sub: 'Record, ROI and drawdown', route: 'me', icon: 'me' },
        { label: 'My favourites', route: 'favourites', icon: 'star' },
        { label: 'Following', route: 'following', icon: 'follow' },
        { label: 'Settings', route: 'settings', icon: 'cog' },
        { label: 'My handle', route: 'signup', icon: 'people' }
      ]
    }
  ];

  const byId = id => MENU.find(m => m.id === id);
  const badgeFor = route => {
    if (route === 'me') { const n = BS.store.tips().filter(t => t.status === 'pending').length; return n ? n : ''; }
    if (route === 'following') { const n = BS.tipsters.followingList().length; return n ? n : ''; }
    if (route === 'favourites') { const n = BS.store.favList().length; return n ? n : ''; }
    return '';
  };

  function item(it, current) {
    const badge = badgeFor(it.route);
    return C.html`
      <button class="mi" data-act="go" data-route="${it.route}"
        ${current === it.route ? C.raw('aria-current="page"') : ''}>
        <span class="mi-ic">${icon(it.icon || 'home')}</span>
        <span style="min-width:0">
          <span class="mi-label">${it.label}</span>
          ${it.sub ? C.html`<span class="mi-sub">${it.sub}</span>` : ''}
        </span>
        ${badge ? C.html`<span class="mi-badge">${badge}</span>` : ''}
      </button>`;
  }

  /* ---------- desktop menu bar ---------- */
  let openDropdown = null;
  function menubar(current, activeId) {
    return C.html`
      <nav class="menubar" aria-label="Main">
        ${MENU.filter(m => m.id !== 'me').map(m => m.items
          ? C.html`
            <span class="mb-item">
              <button class="mb-btn ${activeId === m.id ? 'on' : ''}" data-act="dropdown" data-id="${m.id}"
                aria-expanded="${String(openDropdown === m.id)}" aria-haspopup="true">
                ${m.label}<span class="caret">▾</span>
              </button>
              ${openDropdown === m.id ? C.html`<span class="dropdown" role="menu">
                ${m.items.map(it => item(it, current))}
              </span>` : ''}
            </span>`
          : C.html`
            <span class="mb-item">
              <button class="mb-btn ${activeId === m.id ? 'on' : ''}" data-act="go" data-route="${m.route}">${m.label}</button>
            </span>`)}
      </nav>`;
  }
  const setDropdown = id => { openDropdown = openDropdown === id ? null : id; };
  const closeDropdown = () => { openDropdown = null; };

  /* ---------- drawer ---------- */
  function openDrawer(current) {
    if (C.$('.drawer')) return;
    const scrim = document.createElement('div');
    scrim.className = 'drawer-scrim';
    scrim.addEventListener('click', closeDrawer);
    const el = document.createElement('aside');
    el.className = 'drawer';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Menu');
    const product = BS.ui.state.product;
    el.innerHTML = C.unwrap(C.html`
      <div class="drawer-head">
        ${U.mark('', { simple: true })}
        ${product === 'football' ? U.wordmark('Score', 'More') : U.wordmark('Bet', 'Stable')}
        <span class="spacer"></span>
        <button class="icon-btn" data-act="drawer-close" aria-label="Close menu">${icon('close')}</button>
      </div>
      <div class="drawer-body">
        <div class="drawer-products">
          <button class="dp racing" data-act="go" data-route="racing/today" aria-current="${String(product === 'racing')}">
            <span class="k">Horse racing</span><span class="n">BetStable</span>
          </button>
          <button class="dp football" data-act="go" data-route="football/today" aria-current="${String(product === 'football')}">
            <span class="k">Football</span><span class="n">ScoreMore</span>
          </button>
        </div>
        ${MENU.map(m => m.items
          ? C.html`<div class="menu-label">${m.label}</div>${m.items.map(it => item(it, current))}`
          : C.html`${item({ label: m.label, route: m.route, icon: m.icon }, current)}`)}
      </div>
      <div class="drawer-foot">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <button class="chip" data-act="theme">◐ Theme</button>
          <button class="chip" data-act="go" data-route="settings">Settings</button>
        </div>
        18+ · Sample data, not a live feed · Betting involves a risk of loss ·
        <a href="https://www.begambleaware.org" target="_blank" rel="noopener nofollow">BeGambleAware.org</a>
      </div>`);
    document.body.appendChild(scrim);
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    const first = el.querySelector('.mi, .dp');
    if (first) first.focus();
  }
  function closeDrawer() {
    const d = C.$('.drawer'), s = C.$('.drawer-scrim');
    if (d) d.remove(); if (s) s.remove();
    document.body.style.overflow = '';
  }

  /* ---------- bottom-bar popovers ---------- */
  const BOTTOM = [
    { id: 'home', label: 'Home', icon: 'home', route: 'home' },
    { id: 'tips', label: 'Tips', icon: 'hot', menu: 'tips' },
    { id: 'racing', label: 'Racing', icon: 'racing', route: 'racing/today' },
    { id: 'football', label: 'Football', icon: 'football', route: 'football/today' },
    { id: 'me', label: 'You', icon: 'me', menu: 'me' }
  ];

  function bottomnav(activeId) {
    return C.html`
      <nav class="bottomnav" aria-label="Main">
        ${BOTTOM.map(b => {
          const badge = b.menu === 'me' ? badgeFor('me') : '';
          return C.html`
            <button data-act="${b.menu ? 'popover' : 'go'}" ${b.menu ? C.html`data-id="${b.menu}"` : C.html`data-route="${b.route}"`}
              aria-selected="${String(activeId === b.id)}" ${b.menu ? C.raw('aria-haspopup="true"') : ''}>
              ${icon(b.icon, 'ic')}<span>${b.label}</span>
              ${badge ? C.raw('<span class="dot"></span>') : ''}
            </button>`;
        })}
      </nav>`;
  }

  function openPopover(anchor, menuId, current) {
    closePopover();
    const m = byId(menuId);
    if (!m) return;
    const scrim = document.createElement('div');
    scrim.className = 'pop-scrim';
    scrim.addEventListener('click', closePopover);
    const el = document.createElement('div');
    el.className = 'popover';
    el.setAttribute('role', 'menu');
    el.innerHTML = C.unwrap(C.html`
      <div class="menu-label">${m.label}</div>
      ${m.items.map(it => item(it, current))}`);
    document.body.appendChild(scrim);
    document.body.appendChild(el);
    anchor.setAttribute('aria-expanded', 'true');

    // Sit above the tapped item, nudged inside the viewport, arrow tracking it.
    const a = anchor.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = a.left + a.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    el.style.left = left + 'px';
    el.style.top = Math.max(8, a.top - h - 12) + 'px';
    el.style.setProperty('--arrow', (a.left + a.width / 2 - left) + 'px');
  }
  function closePopover() {
    const p = C.$('.popover'), s = C.$('.pop-scrim');
    if (p) p.remove(); if (s) s.remove();
    C.$$('[data-act="popover"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }

  const anyOpen = () => !!(C.$('.drawer') || C.$('.popover'));
  function closeAll() { closeDrawer(); closePopover(); closeDropdown(); }

  BS.menu = {
    MENU, BOTTOM, icon, item, menubar, bottomnav,
    setDropdown, closeDropdown, openDrawer, closeDrawer, openPopover, closePopover,
    anyOpen, closeAll, badgeFor
  };
})(window.BS = window.BS || {});
