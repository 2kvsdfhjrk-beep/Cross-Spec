/* menu.js — one navigation model, three presentations.
   Desktop gets a menu bar with dropdowns, phones get a bottom bar whose items
   raise popovers, and the hamburger opens a drawer holding everything. All of
   them render from MENU below, so a route added once appears in all three. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui;

  const P = {
    home: 'M3 10.6 12 3.2l9 7.4M5.6 9.6V20h12.8V9.6',
    racing: 'M8 20c-2-2.6-3.2-5-3.2-8a7.2 7.2 0 0 1 14.4 0c0 3-1.2 5.4-3.2 8M6.4 19.4h3.2M14.4 19.4h3.2',
    football: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.6l3.7 2.7-1.4 4.4H9.7L8.3 10.3zM12 3v4.6M19.6 9.6l-3.9.7M16.9 19l-2.6-4.3M7.1 19l2.6-4.3M4.4 9.6l3.9.7',
    hot: 'M12 3c3 4 6 5.5 6 9.5A6 6 0 0 1 6 12.5C6 9.5 8 8 9 5.5c1.6 1.2 2 3 3 4.5.5-2.5 0-5 0-7z',
    people: 'M9.4 11.2a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2zM3.6 19.4c0-3 2.6-5.2 5.8-5.2s5.8 2.2 5.8 5.2M16.6 11a2.6 2.6 0 1 0 0-5.2M17.2 14.4c2.4.3 4.2 2.2 4.2 4.8',
    me: 'M5 4h11l3 3v13H5zM8.5 9.5h7M8.5 13h7M8.5 16.5h4',
    star: 'M12 4l2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8z',
    calendar: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4',
    week: 'M4 5.5h16v14H4zM4 9.5h16M9 13h2M13 13h2M9 16.5h2M13 16.5h2',
    trophy: 'M7 4h10v4.5a5 5 0 0 1-10 0zM7 5.5H4.5V8A3 3 0 0 0 7 11M17 5.5h2.5V8A3 3 0 0 1 17 11M10 13.5h4l.6 3.5H9.4zM8 20h8',
    follow: 'M12 5.5v13M5.5 12h13',
    cog: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3.3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3.3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
    menu: 'M4 7h16M4 12h16M4 17h16',
    close: 'M6 6l12 12M18 6L6 18'
  };
  const icon = (k, cls) => C.raw('<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true"><path d="' + (P[k] || P.home) + '"/></svg>');

  /* ---------- the model ----------
     `route` is what the app navigates to; `items` turn an entry into a menu. */
  const MENU = [
    { id: 'home', label: 'Home', icon: 'home', route: 'home' },
    {
      id: 'racing', label: 'BetStable', sub: 'Horse racing', icon: 'racing', route: 'racing/today',
      items: [
        { label: 'Today\'s racing', sub: 'Every meeting, by country', route: 'racing/today', icon: 'calendar' },
        { label: 'Next 7 days', sub: 'Entries and declarations', route: 'racing/week', icon: 'week' },
        { label: 'Hot racing tips', sub: 'What tipsters agree on', route: 'hot/racing', icon: 'hot' },
        { label: 'Racing table', sub: 'ROI with intervals', route: 'racing/table', icon: 'trophy' }
      ]
    },
    {
      id: 'football', label: 'ScoreMore', sub: 'Football', icon: 'football', route: 'football/today',
      items: [
        { label: 'Today\'s football', sub: 'Fixtures worldwide', route: 'football/today', icon: 'calendar' },
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
        { label: 'Settings', route: 'settings', icon: 'cog' }
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
