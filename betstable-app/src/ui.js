/* ui.js — shared pieces every view uses: silks, odds buttons, the tip sheet,
   toasts, and the time formatting that respects the user's clock preference. */
(function (BS) {
  'use strict';
  const C = BS.core;

  const state = BS.state = {
    view: 'home', sub: 'today', detailId: null, product: 'racing',
    day: 0, q: '', tzMode: 'local', showFinished: false,
    collapsed: {}, loading: false
  };

  /* Every race and fixture seen this session, so settlement and detail views
     can find an event after the user has navigated away. */
  const index = BS.index = { races: new Map(), fixtures: new Map(), meetings: new Map() };

  const tzFor = venueTz => state.tzMode === 'venue' ? venueTz : undefined;
  const time = (ts, venueTz) => C.fmtTime(ts, tzFor(venueTz));
  const day = (ts, venueTz) => C.fmtDay(ts, tzFor(venueTz));

  const SILK = {
    halved: (a, b) => '<rect width="13" height="26" fill="' + b + '"/>',
    hoops: (a, b) => '<rect y="4" width="26" height="5" fill="' + b + '"/><rect y="15" width="26" height="5" fill="' + b + '"/>',
    stripes: (a, b) => '<rect x="4" width="5" height="26" fill="' + b + '"/><rect x="15" width="5" height="26" fill="' + b + '"/>',
    chevron: (a, b) => '<path d="M0 20 13 8l13 12v6H0z" fill="' + b + '"/>',
    star: (a, b) => '<path d="M13 5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L4.4 11.4l6-.8z" fill="' + b + '"/>',
    sash: (a, b) => '<path d="M0 26 26 0v7L7 26z" fill="' + b + '"/>',
    solid: () => ''
  };
  function silkSvg(s) {
    const fn = SILK[s.pattern] || SILK.solid;
    return C.raw('<svg class="silk" viewBox="0 0 26 26" aria-hidden="true">' +
      '<rect width="26" height="26" fill="' + s.a + '"/>' + fn(s.a, s.b) + '</svg>');
  }


  /* ---------- brand mark ----------
     The logo, rebuilt as vector so it can be a favicon, a watermark, an empty
     state and a loading mark without ever going fuzzy. */
  function roundel(cls, opts) {
    const o = opts || {};
    const ring = o.ring || '#00231F';       // pine — the circle and the roof
    const ground = o.ground || '#F6F0E1';   // cream — the disc behind everything
    const wall = '#AF6E4B', plank = '#7F4228', door = '#065B07';
    const id = 'r' + (roundel._n = (roundel._n || 0) + 1);
    // Below ~40px the planks, horseshoe and fence turn to mud; the small mark
    // keeps only the shapes that still read.
    const small = !!o.simple;

    const planks = small ? '' :
      [37.5, 42, 58, 62.5].map(x =>
        '<rect x="' + x + '" y="41" width="1.6" height="16" fill="' + plank + '" opacity=".55"/>').join('') +
      '<path d="M34 36.5 50 30l16 6.5" fill="none" stroke="' + plank + '" stroke-width="1.4" opacity=".5"/>';

    const fence = small ? '' :
      '<g fill="' + ring + '">' +
        '<rect x="6" y="47.4" width="28" height="2.6" rx="1.3"/>' +
        '<rect x="66" y="47.4" width="28" height="2.6" rx="1.3"/>' +
        '<rect x="6" y="52.4" width="28" height="2.6" rx="1.3"/>' +
        '<rect x="66" y="52.4" width="28" height="2.6" rx="1.3"/>' +
        '<rect x="14.5" y="43" width="3.4" height="16" rx="1.5"/>' +
        '<rect x="82.1" y="43" width="3.4" height="16" rx="1.5"/>' +
      '</g>';

    const shoe = small ? '' :
      '<g fill="none" stroke="' + ground + '" stroke-width="2" stroke-linecap="round">' +
        '<path d="M46 38.6a4 4 0 0 1 8 0"/><path d="M45.9 38.4v2.4M54.1 38.4v2.4"/></g>';

    return C.raw('<svg class="roundel ' + (cls || '') + '" viewBox="0 0 100 100" aria-hidden="true">' +
      '<defs><clipPath id="' + id + '"><circle cx="50" cy="50" r="41"/></clipPath></defs>' +
      '<circle cx="50" cy="50" r="41" fill="' + ground + '"/>' +
      '<g clip-path="url(#' + id + ')">' +
        fence +
        // ground line the barn and fence stand on
        '<rect x="4" y="57" width="92" height="3.4" fill="' + ring + '"/>' +
        // walls
        '<rect x="' + (small ? 31 : 33) + '" y="41" width="' + (small ? 38 : 34) + '" height="16" fill="' + wall + '"/>' +
        planks +
        // the signature shape: a shallow gable with wide overhanging eaves
        '<path d="M50 22.5 87 44.5h-9.6L50 28.2 22.6 44.5H13z" fill="' + ring + '"/>' +
        '<path d="M50 29.4 74 43.4H26z" fill="' + wall + '"/>' +
        shoe +
        // doors
        '<rect x="' + (small ? 43 : 44.5) + '" y="' + (small ? 43 : 44) + '" width="' + (small ? 14 : 11) +
          '" height="' + (small ? 17 : 16) + '" fill="' + door + '"/>' +
        (small ? '' : '<path d="M44.5 44 55.5 60M55.5 44 44.5 60" stroke="' + ground + '" stroke-width="1.7"/>') +
      '</g>' +
      '<circle cx="50" cy="50" r="41" fill="none" stroke="' + ring + '" stroke-width="' + (small ? 9 : 7.5) + '"/>' +
      '</svg>');
  }

  /** A tipster's silks, doubling as their avatar. */
  const avatar = (silk, cls) => C.raw(
    C.unwrap(silkSvg(silk)).replace('class="silk"', 'class="silk avatar ' + (cls || '') + '"'));

  /** Wordmark lockup, coloured like the logo. */
  const wordmark = (a, b) => C.html`<span class="wordmark"><span class="a">${a}</span><span class="b">${b}</span></span>`;

  const empty = (title, body, action) => C.html`
    <div class="empty">${roundel()}<h3>${title}</h3><p>${body}</p>${action || ''}</div>`;
  /** Compact variant for a prompt sitting inside a busy page. */
  const emptyRow = (title, body, action) => C.html`
    <div class="empty row">${roundel()}<div><h3>${title}</h3><p>${body}</p></div>${action || ''}</div>`;

  const skeleton = n => C.raw(Array.from({ length: n || 4 },
    () => '<div class="skel skel-row"></div>').join(''));

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg, icon) {
    const old = C.$('.toast'); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = C.unwrap(C.html`<span>${icon || '✓'}</span><span>${msg}</span>`);
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 3200);
  }

  /* ---------- tip sheet ----------
     One flow for both products. The odds are re-read from the feed at the
     moment the sheet opens; that captured price is what gets written. */
  let sheetCtx = null;

  function openTipSheet(ctx) {
    if (ctx.startTs <= Date.now()) {
      toast('That event has started — tips are closed', '⛔');
      return;
    }
    const frozen = BS.provider.freezeOdds(ctx.quotedOdds);
    sheetCtx = Object.assign({}, ctx, { frozen: frozen });
    renderSheet();
  }
  function closeSheet() {
    const s = C.$('.sheet'), sc = C.$('.scrim');
    if (s) s.remove(); if (sc) sc.remove();
    sheetCtx = null;
    document.body.style.overflow = '';
  }

  function renderSheet() {
    closeSheetNodesOnly();
    const c = sheetCtx, f = c.frozen;
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.addEventListener('click', closeSheet);
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Post a tip');
    sheet.innerHTML = C.unwrap(C.html`
      <div class="grabber"></div>
      <h3>${c.selection}</h3>
      <p class="sheet-sub">${c.market} · ${c.event}</p>

      ${f.moved ? C.raw('<div class="warnbox"><span>⚡</span><span>The price moved while you were tapping. ' +
        C.fmtOdds(c.quotedOdds) + ' is gone — this is the live price, and it is the one that gets written.</span></div>') : ''}

      <div class="freeze">
        <div>
          <div class="lbl">Odds frozen</div>
          <div class="big">${C.fmtOdds(f.odds)}</div>
        </div>
        <div class="note">
          captured ${C.fmtTimeSec(f.at)}<br>
          <span class="mono">server clock</span>
        </div>
      </div>

      <dl style="margin:0 0 16px">
        <div class="kv"><dt>Stake</dt><dd>1.00 unit — flat, always</dd></div>
        <div class="kv"><dt>Starts</dt><dd>${time(c.startTs, c.tz)} · in ${C.countdown(c.startTs)}</dd></div>
        <div class="kv"><dt>Settles</dt><dd>From the results feed, automatically</dd></div>
        <div class="kv"><dt>After posting</dt><dd>Cannot be edited or deleted</dd></div>
      </dl>

      <div style="display:flex;gap:10px">
        <button class="btn secondary" data-act="sheet-cancel" style="flex:0 0 40%">Cancel</button>
        <button class="btn" data-act="sheet-confirm">Post tip at ${C.fmtOdds(f.odds)}</button>
      </div>
      <p style="font-size:11.5px;color:var(--ink-3);margin:12px 0 0;text-align:center">
        18+ · one unit per tip · this record is permanent
      </p>
    `);
    document.body.appendChild(scrim);
    document.body.appendChild(sheet);
    document.body.style.overflow = 'hidden';
    const btn = sheet.querySelector('[data-act="sheet-confirm"]');
    if (btn) btn.focus();
  }
  function closeSheetNodesOnly() {
    const s = C.$('.sheet'), sc = C.$('.scrim');
    if (s) s.remove(); if (sc) sc.remove();
  }

  function confirmTip() {
    const c = sheetCtx;
    if (!c) return;
    if (c.startTs <= Date.now()) { closeSheet(); toast('Event started — tip rejected', '⛔'); return; }
    const rec = BS.store.addTip({
      product: c.product, event: c.event, market: c.market, selection: c.selection,
      odds: c.frozen.odds, refId: c.refId, refKind: c.refKind, startTs: c.startTs
    });
    closeSheet();
    toast('Tip posted · ' + rec.hash.slice(0, 8) + ' · settles automatically', '🔒');
    BS.app.render();
  }

  const hasTipOn = (refId, selection) => BS.store.tips().some(
    t => t.refId === refId && t.selection === selection);

  /* ---------- odds button ---------- */
  function oddsButton(opts) {
    const taken = hasTipOn(opts.refId, opts.selection);
    const closed = opts.startTs <= Date.now();
    const attrs = 'data-act="tip" data-ref="' + C.esc(opts.refId) + '" data-sel="' + C.esc(opts.selection) +
      '" data-odds="' + opts.odds + '" data-market="' + C.esc(opts.market) + '" data-event="' + C.esc(opts.event) +
      '" data-start="' + opts.startTs + '" data-kind="' + C.esc(opts.refKind) + '" data-tz="' + C.esc(opts.tz || '') + '"';
    return C.raw('<button class="odds-btn' + (taken ? ' taken' : '') + '" ' + attrs +
      (closed || taken ? ' disabled' : '') + ' aria-label="Tip ' + C.esc(opts.selection) + ' at ' + C.fmtOdds(opts.odds) + '">' +
      (opts.label ? '<span class="lbl">' + C.esc(opts.label) + '</span>' : '') +
      (taken ? 'Tipped' : C.fmtOdds(opts.odds)) + '</button>');
  }

  BS.ui = {
    state, index, silk: silkSvg, silkSvg, roundel, avatar, wordmark, empty, emptyRow, skeleton, toast, time, day, tzFor,
    openTipSheet, closeSheet, confirmTip, oddsButton, hasTipOn
  };
})(window.BS = window.BS || {});
