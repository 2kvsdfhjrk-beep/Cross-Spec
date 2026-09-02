/* icons.js — one icon family.

   Drawn on a 24 grid, 1.7 stroke, round caps and joins, and optically balanced
   against each other rather than each one drawn in isolation. Emoji were doing
   this job before; they came from a dozen different type designers and it
   showed. Country flags stay as emoji — those are legitimately flags. */
(function (BS) {
  'use strict';
  const C = BS.core;

  const P = {
    /* navigation */
    home: 'M3.5 10.8 12 3.6l8.5 7.2M5.9 9.9v9.4a1 1 0 0 0 1 1h10.2a1 1 0 0 0 1-1V9.9',
    menu: 'M4 7.2h16M4 12h16M4 16.8h11',
    close: 'M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6',
    chevron: 'M9.5 5.5 16 12l-6.5 6.5',
    back: 'M14.5 5.5 8 12l6.5 6.5',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16.2 16.2 20.5 20.5',

    /* the two products */
    racing: 'M7.8 20.2c-1.9-2.6-3-5-3-8a7.2 7.2 0 0 1 14.4 0c0 3-1.1 5.4-3 8M6.3 19.6h3M14.7 19.6h3',
    football: 'M12 20.8a8.8 8.8 0 1 0 0-17.6 8.8 8.8 0 0 0 0 17.6zM12 7.7l3.6 2.6-1.4 4.3H9.8L8.4 10.3zM12 3.2v4.5M20.4 10.1l-4.8.2M17.5 19.1l-3.1-4M6.5 19.1l3.1-4M3.6 10.1l4.8.2',

    /* content */
    hot: 'M12 3.4c2.9 3.8 5.8 5.3 5.8 9.2a5.8 5.8 0 1 1-11.6 0c0-2.9 1.9-4.3 2.9-6.7 1.5 1.1 1.9 2.9 2.9 4.3.5-2.4 0-4.8 0-6.8z',
    clock: 'M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2zM12 7.3V12l3.1 1.9',
    calendar: 'M5.2 6.4h13.6a1 1 0 0 1 1 1v11.2a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1V7.4a1 1 0 0 1 1-1zM4.2 10.4h15.6M8.6 4v4.2M15.4 4v4.2',
    week: 'M4.4 5.6h15.2a1 1 0 0 1 1 1v11.8a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1V6.6a1 1 0 0 1 1-1zM3.4 9.6h17.2M8.6 12.8h2M13.4 12.8h2M8.6 16.2h2M13.4 16.2h2',
    globe: 'M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2zM3.6 12h16.8M12 3.4c2.2 2.4 3.4 5.3 3.4 8.6S14.2 18.2 12 20.6C9.8 18.2 8.6 15.3 8.6 12S9.8 5.8 12 3.4z',
    star: 'M12 3.9l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z',
    people: 'M9.3 11.4a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3.4 19.6c0-3.1 2.7-5.4 5.9-5.4s5.9 2.3 5.9 5.4M16.6 11.1a2.7 2.7 0 1 0 0-5.4M17.3 14.5c2.5.3 4.3 2.3 4.3 5',
    follow: 'M12 5.4v13.2M5.4 12h13.2',
    ledger: 'M6 3.6h9.2L19 7.4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15.8a1 1 0 0 1 1-1zM14.8 3.8v3.8h3.8M8.4 11.4h7.2M8.4 14.6h7.2M8.4 17.8h4',
    trophy: 'M7.4 4.2h9.2v4.4a4.6 4.6 0 0 1-9.2 0zM7.4 5.6H4.8v2.2a3 3 0 0 0 2.6 3M16.6 5.6h2.6v2.2a3 3 0 0 1-2.6 3M10.2 13.6h3.6l.6 3.6H9.6zM8 20.4h8',
    chart: 'M4 19.6h16M4.6 15.4l4.4-5 3.5 3.2 6.7-7.2',
    gem: 'M7.4 4.4h9.2l3.4 4.8L12 20 4 9.2zM4 9.2h16M9.6 9.2 12 20l2.4-10.8M7.4 4.4 9.6 9.2M16.6 4.4 14.4 9.2',
    trend: 'M4 17.2l5.2-5.4 3.4 3.2 6.2-6.8M15.6 8h3.6v3.6',
    cog: 'M12 15.1a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2zM19.1 14.2a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a1.9 1.9 0 1 1-3.8 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a1.9 1.9 0 1 1 0-3.8h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1A1.9 1.9 0 1 1 7.3 4l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.3a1.9 1.9 0 1 1 3.8 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1A1.9 1.9 0 1 1 19.4 6.6l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a1.9 1.9 0 1 1 0 3.8h-.2a1.6 1.6 0 0 0-1.4.9z',
    lock: 'M6.6 10.6h10.8a1 1 0 0 1 1 1v7.4a1 1 0 0 1-1 1H6.6a1 1 0 0 1-1-1v-7.4a1 1 0 0 1 1-1zM8.6 10.4V7.8a3.4 3.4 0 0 1 6.8 0v2.6',
    ruler: 'M3.8 14.4 14.4 3.8l5.8 5.8L9.6 20.2zM7.6 10.6l1.8 1.8M10.4 7.8l1.8 1.8M13.2 5l1.8 1.8M4.9 13.3l1.8 1.8',
    signal: 'M4.6 12.6a10.4 10.4 0 0 1 14.8 0M7.6 15.6a6.2 6.2 0 0 1 8.8 0M12 19.4h.01',
    flag: 'M6 20.4V4.2M6 5.2h11.4l-2 3.4 2 3.4H6',
    info: 'M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2zM12 11.2v5M12 7.9h.01',
    check: 'M5.4 12.6 10 17.2 18.6 6.8',
    sparkle: 'M12 3.6l1.7 4.9 4.9 1.7-4.9 1.7L12 16.8l-1.7-4.9-4.9-1.7 4.9-1.7zM18.4 15.2l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z'
  };

  /** Stroked icon. `size` is a CSS length; the stroke stays optically even. */
  function icon(name, cls, opts) {
    const o = opts || {};
    return C.raw('<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="' + (o.w || 1.7) + '" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true"><path d="' + (P[name] || P.info) + '"/></svg>');
  }

  /** The marker that runs along the run-in track and the loader rail. */
  function marker(product, silk) {
    if (product === 'football') {
      return C.raw('<span class="marker marker-ball">' +
        C.unwrap(BS.ui.ballMark('', { simple: true, ring: '#FFFFFF', ground: '#FFFFFF', panel: '#134B74' })) +
        '</span>');
    }
    const s = silk || { a: '#E0A83B', b: '#7F4228', pattern: 'hoops' };
    return C.raw('<span class="marker marker-silk">' + C.unwrap(BS.ui.silkSvg(s)) + '</span>');
  }

  BS.icons = { P, icon, marker, has: n => !!P[n] };
})(window.BS = window.BS || {});
