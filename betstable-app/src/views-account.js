/* views-account.js — claiming a handle, and the expert badges that a weekly
   job awards and takes away. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui, X = BS.experts;

  /* ---------- sign up ---------- */
  function signup(root) {
    const acct = BS.account.get();
    if (acct) {
      C.mount(root, C.html`
        <div class="page-head"><h1>Your handle</h1></div>
        <div class="panel">
          <div class="panel-body" style="display:flex;gap:14px;align-items:center">
            ${U.mark('', { simple: true })}
            <div style="flex:1;min-width:0">
              <div style="font-family:'Montserrat',sans-serif;font-weight:900;font-size:20px">${acct.handle}</div>
              <div style="font-size:13px;color:var(--ink-3)">${acct.email} · joined ${C.fmtDay(acct.createdAt)}</div>
            </div>
            <button class="btn secondary" data-act="signout">Sign out</button>
          </div>
        </div>
        <div class="notice"><span>🔒</span><span>Your handle is permanent. Records are published under it and
          cannot be edited, deleted, or moved to a different name.</span></div>
      `);
      return;
    }

    C.mount(root, C.html`
      <div class="page-head narrow"><h1>Claim your handle</h1></div>
      <div class="notice narrow"><span>🔒</span><span>
        A handle is claimed once and never reassigned, because a record is attached to it forever.
        Pick one you are happy to be judged by.</span></div>

      <div class="panel narrow">
        <div class="panel-body">
          <form id="signup-form" novalidate>
            <label class="field">
              <span class="field-label">Handle</span>
              <span class="field-wrap">
                <span class="field-prefix">@</span>
                <input id="su-handle" type="text" autocomplete="username" autocapitalize="none"
                  spellcheck="false" placeholder="quietfurlong" maxlength="20">
              </span>
              <span class="field-hint" id="su-handle-hint">3–20 characters. Letters, numbers and underscores.</span>
            </label>

            <label class="field">
              <span class="field-label">Email</span>
              <span class="field-wrap"><input id="su-email" type="email" autocomplete="email"
                placeholder="you@example.com"></span>
              <span class="field-hint" id="su-email-hint">Used to reach you about your record. Nothing else.</span>
            </label>

            <label class="check">
              <input type="checkbox" id="su-age">
              <span>I am 18 or over, and I understand betting involves a risk of loss.</span>
            </label>
            <label class="check">
              <input type="checkbox" id="su-marketing">
              <span>Send me an email when something changes. Off by default — ask to stop once and
                you are off every list, permanently.</span>
            </label>

            <button class="btn block" type="submit" style="margin-top:14px">Create my handle</button>
            <p class="field-hint" id="su-error" style="color:var(--bad);margin-top:10px"></p>
          </form>
        </div>
      </div>

      <p class="foot-note narrow">18+ only. Free, confidential help is available at
        <a href="https://www.begambleaware.org" target="_blank" rel="noopener nofollow">BeGambleAware.org</a>.</p>
    `);
    wireSignup(root);
  }

  /** Bound directly rather than re-rendered, so typing never loses the caret. */
  function wireSignup(root) {
    const form = C.$('#signup-form', root);
    if (!form) return;
    const handle = C.$('#su-handle', root), email = C.$('#su-email', root);
    const hHint = C.$('#su-handle-hint', root), eHint = C.$('#su-email-hint', root);
    const err = C.$('#su-error', root);

    handle.addEventListener('input', function () {
      const v = handle.value.trim();
      if (!v) { hHint.textContent = '3–20 characters. Letters, numbers and underscores.'; hHint.className = 'field-hint'; return; }
      const problem = BS.account.checkHandle(v);
      hHint.textContent = problem || '@' + v.toLowerCase() + ' is available.';
      hHint.className = 'field-hint ' + (problem ? 'bad' : 'good');
    });
    email.addEventListener('blur', function () {
      if (!email.value.trim()) return;
      const problem = BS.account.checkEmail(email.value);
      eHint.textContent = problem || 'Looks good.';
      eHint.className = 'field-hint ' + (problem ? 'bad' : 'good');
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const res = BS.account.create({
        handle: handle.value, email: email.value,
        age: C.$('#su-age', root).checked, marketing: C.$('#su-marketing', root).checked
      });
      if (res.error) {
        err.textContent = res.error;
        const target = C.$('#su-' + res.field, root);
        if (target) target.focus();
        return;
      }
      U.toast('Welcome, ' + res.account.handle + ' — your record starts now', '🔒');
      BS.app.go('me');
    });
  }

  /* ---------- experts ---------- */
  let tab = 'consistent';

  function badgeChips(handle) {
    const b = X.badgesFor(handle);
    const out = [];
    if (b.consistent) out.push(X.BADGES.consistent);
    if (b.value) out.push(X.BADGES.value);
    if (!out.length) return C.raw('');
    return C.raw(out.map(x => '<span class="xbadge ' + x.id + '" title="' + C.esc(x.rule) + '">' +
      x.icon + ' ' + C.esc(x.label) + '</span>').join(''));
  }

  function experts(root) {
    const now = Date.now();
    const badge = X.BADGES[tab];
    const holders = X.holders(tab).sort((a, b) => b.lo - a.lo);
    const last = X.lastRun(), next = X.nextRunTs(now);
    const log = X.log().slice(0, 12);
    const fmt = ts => ts ? new Intl.DateTimeFormat(undefined,
      { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ts)) : '—';

    C.mount(root, C.html`
      <div class="page-head"><h1>Experts</h1><span class="sub">recalculated every Monday</span></div>

      <div class="mod">
        <div class="mod-head"><span class="mod-ic">${C.raw('⚙️')}</span><h2>Weekly check</h2></div>
        <div class="rows">
          <div class="row row-static">
            <span class="row-main">
              <span class="row-title"><span class="nm">Last run</span></span>
              <span class="row-sub">${fmt(last)}${X.week() !== null ? ' · week ' + X.week() : ''}</span>
            </span>
          </div>
          <div class="row row-static">
            <span class="row-main">
              <span class="row-title"><span class="nm">Next run</span></span>
              <span class="row-sub">${fmt(next)}</span>
            </span>
            <span class="row-end"><span class="cd">in ${C.countdown(next, now)}</span></span>
          </div>
        </div>
        <button class="mod-cta" data-act="run-experts">Simulate next week's check (demo)</button>
      </div>

      <div class="tabs" role="tablist" style="margin-bottom:14px">
        ${Object.keys(X.BADGES).map(k => C.html`
          <button role="tab" aria-selected="${String(tab === k)}" data-act="expert-tab" data-id="${k}">
            ${X.BADGES[k].icon} ${X.BADGES[k].full}
          </button>`)}
      </div>

      <div class="notice"><span>📏</span><span><b>${badge.full}.</b> ${badge.rule}
        Badges are awarded and removed by the weekly job — nobody can keep one that the record stopped supporting.</span></div>
      ${X.simOffset() ? C.html`<div class="notice"><span>🧪</span><span>
        You have simulated <b>${X.simOffset()} ${X.simOffset() === 1 ? 'week' : 'weeks'}</b> ahead of the real clock.
        In the live product this job runs on the server every Monday and cannot be triggered by hand.</span></div>` : ''}

      <div class="mod">
        <div class="mod-head"><h2>${holders.length} ${holders.length === 1 ? 'tipster' : 'tipsters'}</h2></div>
        <div class="rows">
          ${holders.length ? holders.map(t => {
            const b = X.badgesFor(t.handle);
            return C.html`
              <div class="row row-static">
                <button data-act="go" data-route="tipster/${t.handle}" style="flex:none">${U.avatar(t.silk, 'md')}</button>
                <button class="row-main" data-act="go" data-route="tipster/${t.handle}">
                  <span class="row-title"><span class="nm">${t.handle}</span></span>
                  <span class="row-sub">${tab === 'consistent'
                    ? 'Periods: ' + b.periods.map(x => C.fmtUnits(x)).join(' · ')
                    : 'Average winning price ' + t.avgWinOdds.toFixed(1) + ' · ' + t.bigWinners + ' winners at 4.5+'}</span>
                </button>
                <span class="stat-big ${t.roi >= 0 ? 'good' : 'bad'}"><b>${C.fmtPct(t.roi)}</b><small>ROI</small></span>
                <button class="follow-btn" data-act="follow" data-id="${t.handle}"
                  aria-pressed="${String(BS.tipsters.isFollowing(t.handle))}"
                  aria-label="${BS.tipsters.isFollowing(t.handle) ? 'Unfollow' : 'Follow'} ${t.handle}"
                  >${BS.tipsters.isFollowing(t.handle) ? '✓' : '+'}</button>
              </div>`;
          }) : C.html`<p class="row-empty">Nobody holds this badge after the latest check. That is the point of
            checking: the list is allowed to be empty.</p>`}
        </div>
      </div>

      <div class="mod">
        <div class="mod-head"><h2>Recent changes</h2><span class="mod-meta">append-only</span></div>
        <div class="rows">
          ${log.length ? log.map(e => C.html`
            <div class="row row-static">
              <span class="row-ic">${e.action === 'awarded' ? '↑' : '↓'}</span>
              <span class="row-main">
                <span class="row-title"><span class="nm">${e.handle}</span></span>
                <span class="row-sub">${e.action === 'awarded' ? 'Awarded' : 'Lost'} ${X.BADGES[e.badge].full.toLowerCase()} · week ${e.week}</span>
              </span>
              <span class="row-end"><span class="cd" style="color:${e.action === 'awarded' ? 'var(--good)' : 'var(--bad)'}">${e.action}</span></span>
            </div>`)
            : C.html`<p class="row-empty">No changes recorded yet. The first run sets a baseline; from the
              second run on, every award and every loss is written here.</p>`}
        </div>
      </div>
    `);
  }

  BS.viewsAccount = { signup, experts, badgeChips, setTab: t => { tab = t; } };
})(window.BS = window.BS || {});
