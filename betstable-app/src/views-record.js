/* views-record.js — the user's own ledger and the ranked tables.
   Everything here is drawn from settled tips only; pending tips are shown but
   never counted, because an unsettled tip is not evidence of anything. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui;

  /* ---------- equity curve ----------
     One series, so no legend: the panel title names it. Grid and axes stay
     recessive; the drawdown is shaded rather than given a second scale. */
  function equityChart(equity) {
    if (equity.length < 2) return C.raw('');
    const W = 720, H = 200, PL = 44, PR = 14, PT = 14, PB = 24;
    const xs = i => PL + (i / (equity.length - 1)) * (W - PL - PR);
    const vals = equity.map(e => e.cum);
    const lo = Math.min(0, Math.min.apply(null, vals)) - 1;
    const hi = Math.max(0, Math.max.apply(null, vals)) + 1;
    const ys = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);

    const line = equity.map((e, i) => (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(e.cum).toFixed(1)).join(' ');
    const area = line + ' L' + xs(equity.length - 1).toFixed(1) + ' ' + ys(0).toFixed(1) +
      ' L' + xs(0).toFixed(1) + ' ' + ys(0).toFixed(1) + ' Z';

    // Peak-to-trough: the number that tells you what holding this record felt like.
    let peak = -Infinity, peakI = 0, worst = 0, ddFrom = 0, ddTo = 0;
    equity.forEach((e, i) => {
      if (e.cum > peak) { peak = e.cum; peakI = i; }
      if (e.cum - peak < worst) { worst = e.cum - peak; ddFrom = peakI; ddTo = i; }
    });

    // Anchor the scale on zero — it is the only value on this axis that means
    // anything on its own — then one tick each side of it.
    const ticks = [Math.round(lo), 0, Math.round(hi)]
      .filter((v, i, a) => a.indexOf(v) === i);
    return C.raw(
      '<div class="chartwrap" style="position:relative">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;height:auto;overflow:visible" ' +
      'role="img" aria-label="Cumulative units returned over the settled record">' +
      ticks.map(t => '<g><line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + ys(t).toFixed(1) + '" y2="' + ys(t).toFixed(1) +
        '" stroke="var(--line)" stroke-width="1"/><text x="' + (PL - 8) + '" y="' + (ys(t) + 4).toFixed(1) +
        '" text-anchor="end" font-size="11" fill="var(--ink-3)">' + (t > 0 ? '+' : t < 0 ? '−' : '') + Math.abs(t) + '</text></g>').join('') +
      '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + ys(0).toFixed(1) + '" y2="' + ys(0).toFixed(1) +
        '" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="3 3"/>' +
      (worst < -0.5 ? '<rect x="' + xs(ddFrom).toFixed(1) + '" y="' + PT + '" width="' +
        Math.max(2, xs(ddTo) - xs(ddFrom)).toFixed(1) + '" height="' + (H - PT - PB) +
        '" fill="var(--bad)" opacity=".08"/>' : '') +
      '<path d="' + area + '" fill="var(--accent)" opacity=".12"/>' +
      '<path d="' + line + '" fill="none" stroke="var(--accent)" stroke-width="2" ' +
        'stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + xs(equity.length - 1).toFixed(1) + '" cy="' + ys(vals[vals.length - 1]).toFixed(1) +
        '" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>' +
      '<line class="cross" x1="0" x2="0" y1="' + PT + '" y2="' + (H - PB) + '" stroke="var(--ink-3)" stroke-width="1" opacity="0"/>' +
      '<circle class="crossdot" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" opacity="0"/>' +
      '<rect class="hit" x="' + PL + '" y="' + PT + '" width="' + (W - PL - PR) + '" height="' + (H - PT - PB) + '" fill="transparent"/>' +
      '</svg>' +
      '<div class="charttip" style="position:absolute;pointer-events:none;opacity:0;transform:translate(-50%,-120%);' +
      'background:var(--ink);color:var(--bg);padding:6px 9px;border-radius:8px;font-size:12px;font-weight:650;white-space:nowrap"></div>' +
      '<div style="display:flex;gap:14px;margin-top:8px;font-size:11.5px;color:var(--ink-3)">' +
      '<span><b style="color:var(--accent)">━</b> cumulative units</span>' +
      (worst < -0.5 ? '<span><b style="color:var(--bad)">▨</b> deepest drawdown ' + C.fmtSigned(worst) + ' units</span>' : '') +
      '</div></div>');
  }

  /** Wire the crosshair after the chart is in the document. */
  function initChart(root, equity) {
    const wrap = C.$('.chartwrap', root);
    if (!wrap || equity.length < 2) return;
    const svg = C.$('svg', wrap), hit = C.$('.hit', wrap);
    const cross = C.$('.cross', wrap), dot = C.$('.crossdot', wrap), tip = C.$('.charttip', wrap);
    const W = 720, PL = 44, PR = 14, PT = 14, PB = 24, H = 200;
    const vals = equity.map(e => e.cum);
    const lo = Math.min(0, Math.min.apply(null, vals)) - 1;
    const hi = Math.max(0, Math.max.apply(null, vals)) + 1;
    const xs = i => PL + (i / (equity.length - 1)) * (W - PL - PR);
    const ys = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);

    function move(ev) {
      const box = svg.getBoundingClientRect();
      const px = (ev.clientX - box.left) / box.width * W;
      let i = Math.round((px - PL) / (W - PL - PR) * (equity.length - 1));
      i = Math.max(0, Math.min(equity.length - 1, i));
      const e = equity[i];
      cross.setAttribute('x1', xs(i)); cross.setAttribute('x2', xs(i)); cross.setAttribute('opacity', '.4');
      dot.setAttribute('cx', xs(i)); dot.setAttribute('cy', ys(e.cum)); dot.setAttribute('opacity', '1');
      tip.style.opacity = '1';
      tip.style.left = (xs(i) / W * box.width) + 'px';
      tip.style.top = (ys(e.cum) / H * box.height) + 'px';
      tip.textContent = 'Tip ' + (i + 1) + ' · ' + C.fmtUnits(e.cum) + ' units · ' +
        new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(e.ts));
    }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerleave', () => {
      cross.setAttribute('opacity', '0'); dot.setAttribute('opacity', '0'); tip.style.opacity = '0';
    });
  }

  /* ---------- my record ---------- */
  function record(root) {
    const product = U.state.product;
    const all = BS.store.tips();
    const mine = all.filter(t => t.product === product);
    const s = BS.store.stats(mine);
    const pending = mine.filter(t => t.status === 'pending').sort((a, b) => b.postedAt - a.postedAt);
    const settled = mine.filter(t => t.status === 'settled').sort((a, b) => (b.settledAt || 0) - (a.settledAt || 0));

    // Today's tips, hashed into the day's published root.
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const todays = all.filter(t => t.postedAt >= startOfDay.getTime());
    const root32 = BS.store.merkleRoot(todays.map(t => t.hash));

    C.mount(root, C.html`
      <div class="statgrid">
        <div class="stat">
          <div class="k">ROI · 95% range</div>
          <div class="v ${s.roi >= 0 ? 'good' : 'bad'}">${s.n ? C.fmtPct(s.roi) : '—'}</div>
          <div class="sub">${s.n ? C.fmtPct(s.lo) + ' to ' + C.fmtPct(s.hi) : 'no settled tips yet'}</div>
        </div>
        <div class="stat">
          <div class="k">Settled tips</div>
          <div class="v">${s.n}</div>
          <div class="sub">${s.enough ? 'above the 100 ranking threshold' : (100 - s.n) + ' more to be ranked'}</div>
        </div>
        <div class="stat">
          <div class="k">Profit</div>
          <div class="v ${s.profit >= 0 ? 'good' : 'bad'}">${s.n ? C.fmtUnits(s.profit) : '—'}</div>
          <div class="sub">units, flat 1.00 stake</div>
        </div>
        <div class="stat">
          <div class="k">Max drawdown</div>
          <div class="v">${s.n ? C.fmtSigned(s.maxDD) : '—'}</div>
          <div class="sub">deepest peak-to-trough</div>
        </div>
      </div>

      ${s.n >= 2 ? C.html`
        <div class="panel">
          <div class="panel-head">
            <h3>Cumulative units</h3>
            <span class="meta">${s.n} settled · strike rate ${s.strike.toFixed(1)}%</span>
          </div>
          <div class="panel-body">${equityChart(s.equity)}</div>
        </div>` : ''}

      ${pending.length ? C.html`
        <div class="panel">
          <div class="panel-head"><h3>Pending</h3><span class="meta">${pending.length} awaiting the results feed</span></div>
          <div class="tiplist">
            ${pending.map(t => C.html`
              <div class="tip-row">
                <span class="badge pending">Pending</span>
                <span>
                  <div class="sel">${t.selection}</div>
                  <div class="ev">${t.market} · ${t.event} · frozen at ${C.fmtOdds(t.odds)}</div>
                </span>
                <span class="mono" style="font-size:10.5px;color:var(--ink-3)">${t.hash.slice(0, 8)}</span>
              </div>`)}
          </div>
        </div>` : ''}

      <div class="panel">
        <div class="panel-head">
          <h3>Settled record</h3>
          <span class="meta">newest first · nothing here can be removed</span>
        </div>
        ${settled.length ? C.html`<div class="tiplist">
          ${settled.slice(0, 40).map(t => C.html`
            <div class="tip-row">
              <span class="badge ${t.won ? 'won' : 'lost'}">${t.won ? 'Won' : 'Lost'}</span>
              <span>
                <div class="sel">${t.selection}</div>
                <div class="ev">${t.market} · ${t.event} · ${C.fmtOdds(t.odds)}</div>
              </span>
              <span class="ret ${t.ret >= 0 ? 'good' : 'bad'}">${C.fmtUnits(t.ret)}</span>
            </div>`)}
        </div>` : U.empty('Nothing settled yet', 'Post a tip from today\'s card and it will settle here automatically once the result comes in.')}
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Today's proof</h3><span class="meta">${todays.length} tips hashed</span></div>
        <div class="panel-body" style="font-size:13px;color:var(--ink-2)">
          ${root32 ? C.html`
            <div class="mono" style="font-size:12px;word-break:break-all;color:var(--ink)">${root32}</div>
            <p style="margin:8px 0 0">Every tip posted today is hashed and folded into this single root. Publish the
            root and anyone can check a tip existed, in exactly this form, on this date — without trusting us.</p>`
            : C.raw('<p style="margin:0">No tips posted today yet. The day\'s root is published once there are.</p>')}
        </div>
      </div>

      <div class="notice"><span>🔒</span><span><b>Append-only.</b> There is no edit and no delete in this app.
        A correction is published as a void that points at the original, and the original stays where it is.</span></div>
    `);
    if (s.n >= 2) initChart(root, s.equity);
  }

  /* ---------- rankings ----------
     The same roster as the tipster directory, so a follow made here shows up
     on the front page, and vice versa. */
  const BANDS = [['all', 'All prices'], ['short', '1.0 – 2.0'], ['mid', '2.0 – 5.0'], ['long', '5.0 +']];
  let band = 'all';

  function rankings(root) {
    const product = U.state.product;
    const rows = BS.tipsters.all().filter(t => t.sport === product && t.ranked)
      .map(t => Object.assign({}, t));
    const mine = BS.store.stats(BS.store.tips().filter(t => t.product === product));
    if (mine.enough) {
      rows.push({ handle: BS.store.handle(), n: mine.n, roi: mine.roi, lo: mine.lo, hi: mine.hi,
        maxDD: mine.maxDD, me: true });
    }
    rows.sort((a, b) => b.lo - a.lo);
    const SCALE = 34;
    const pos = v => Math.max(0, Math.min(100, (v + SCALE) / (2 * SCALE) * 100));

    C.mount(root, C.html`
      <div class="toolbar">
        ${BANDS.map(b => C.html`<button class="chip ${band === b[0] ? 'on' : ''}" data-act="band" data-id="${b[0]}">${b[1]}</button>`)}
      </div>

      <div class="notice"><span>📏</span><span>
        Ranked on the <b>bottom of the 95% range</b>, not the headline figure — a big number from a small sample
        does not outrank a solid one from a long record. Minimum 100 settled tips to appear at all.
      </span></div>

      <div class="panel">
        <div class="panel-head">
          <h3>${product === 'racing' ? 'BetStable' : 'ScoreMore'} · ROI table</h3>
          <span class="meta">${BANDS.find(b => b[0] === band)[1]} · ${rows.length} ranked</span>
        </div>
        <div style="overflow-x:auto">
          <table class="board">
            <thead><tr><th>#</th><th>Tipster</th><th>Settled</th><th>ROI · 95% range</th><th>Max DD</th><th></th></tr></thead>
            <tbody>
              ${rows.map((r, i) => C.html`
                <tr class="${r.me ? 'me' : ''}">
                  <td style="color:var(--ink-3);font-weight:800">${i + 1}</td>
                  <td>
                    ${r.me ? C.html`<span style="font-weight:800">${r.handle}</span><span class="badge won" style="margin-left:6px">you</span>`
                      : C.html`<button data-act="tipster" data-id="${r.handle}" style="display:flex;align-items:center;gap:9px;font-weight:800">
                          ${U.avatar(r.silk, 'sm')}${r.handle}</button>`}
                  </td>
                  <td>${r.n}</td>
                  <td>
                    <span class="range">
                      <i class="${r.lo > 0 ? 'up' : r.hi < 0 ? 'down' : ''}" style="left:${pos(r.lo).toFixed(1)}%;right:${(100 - pos(r.hi)).toFixed(1)}%"></i>
                      <span class="zero" style="left:50%"></span>
                      <b style="left:${pos(r.roi).toFixed(1)}%"></b>
                    </span>
                    <span class="rangeval">${C.fmtPct(r.lo)} to ${C.fmtPct(r.hi)}</span>
                  </td>
                  <td style="color:var(--ink-2)">${C.fmtSigned(r.maxDD)}</td>
                  <td>${r.me ? '' : C.html`<button class="follow-btn" data-act="follow" data-id="${r.handle}"
                    aria-pressed="${String(BS.tipsters.isFollowing(r.handle))}">${BS.tipsters.isFollowing(r.handle) ? '✓' : '+ Follow'}</button>`}</td>
                </tr>`)}
            </tbody>
          </table>
        </div>
      </div>
      ${!mine.enough ? C.html`<div class="notice"><span>🌱</span><span>
        Your ${product === 'racing' ? 'racing' : 'football'} record has <b>${mine.n} settled tips</b>.
        You appear in this table at 100.</span></div>` : ''}
    `);
  }

  BS.viewsRecord = { record, rankings, setBand: b => { band = b; } };
})(window.BS = window.BS || {});
