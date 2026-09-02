/* views-extra.js — favourites and settings.
   Settings is not decoration: the time base, the default sport and the
   responsible-gambling controls all change how the app behaves. */
(function (BS) {
  'use strict';
  const C = BS.core, U = BS.ui, T = BS.tipsters;

  function favourites(root) {
    const now = Date.now();
    const events = BS.store.favList().map(id => {
      const race = U.index.races.get(id);
      if (race) return T.asEvent('race', race);
      const fx = U.index.fixtures.get(id);
      return fx ? T.asEvent('match', fx) : null;
    }).filter(Boolean);
    const upcoming = events.filter(e => e.startTs > now).sort((a, b) => a.startTs - b.startTs);
    const past = events.filter(e => e.startTs <= now);

    C.mount(root, C.html`
      <div class="page-head">
        <h1>Your favourites</h1>
        <span class="sub">${upcoming.length} to come</span>
      </div>
      ${upcoming.length
        ? C.html`<div class="mod"><div class="rows">${upcoming.map(e => BS.viewsHome.eventRow(e, now))}</div></div>`
        : U.empty('Nothing starred yet',
            'Star a race or a match from its page and it waits here, and on your front page, until it runs.',
            C.html`<button class="btn" data-act="go" data-route="racing/today">Browse today\'s racing</button>`)}
      ${past.length ? C.html`<p class="foot-note">${past.length} starred ${past.length === 1 ? 'event has' : 'events have'} already run.</p>` : ''}
    `);
  }

  function settings(root) {
    const S = U.state;
    const seg = (act, value, options) => C.html`
      <span class="segment">
        ${options.map(o => C.html`<button data-act="${act}" data-id="${o[0]}"
          aria-pressed="${String(o[0] === value)}">${o[1]}</button>`)}
      </span>`;
    const theme = document.documentElement.getAttribute('data-theme') || 'auto';
    const tips = BS.store.tips();
    const settled = tips.filter(t => t.status === 'settled').length;

    C.mount(root, C.html`
      <div class="page-head"><h1>Settings</h1></div>

      <div class="panel">
        <div class="panel-head"><h3>Display</h3></div>
        <div class="setting">
          <span class="s-main">
            <span class="s-title">Theme</span>
            <span class="s-sub">Auto follows your device</span>
          </span>
          ${seg('set-theme', theme, [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}
        </div>
        <div class="setting">
          <span class="s-main">
            <span class="s-title">Times</span>
            <span class="s-sub">Show race and kick-off times in your clock, or the venue's</span>
          </span>
          ${seg('set-tz', S.tzMode, [['local', 'My time'], ['venue', 'Venue time']])}
        </div>
        <div class="setting">
          <span class="s-main">
            <span class="s-title">Open on</span>
            <span class="s-sub">Which sport the app starts with</span>
          </span>
          ${seg('set-product', S.product, [['racing', 'BetStable'], ['football', 'ScoreMore']])}
        </div>
        <div class="setting">
          <span class="s-main">
            <span class="s-title">Finished events</span>
            <span class="s-sub">Keep meetings and competitions listed once they are done</span>
          </span>
          ${seg('set-finished', String(S.showFinished), [['false', 'Hide'], ['true', 'Show']])}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Your data</h3><span class="meta">on this device</span></div>
        <div class="setting">
          <span class="s-main">
            <span class="s-title">${tips.length} tips · ${settled} settled</span>
            <span class="s-sub">Following ${T.followingList().length} · ${BS.store.favList().length} starred</span>
          </span>
        </div>
        <div class="setting">
          <span class="s-main">
            <span class="s-title">Reset the sample record</span>
            <span class="s-sub">Clears tips, follows and stars on this device and starts again.
              A real ledger could not be reset — this one only exists in your browser.</span>
          </span>
          <button class="btn secondary" data-act="reset" style="flex:none">Reset</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Staying in control</h3></div>
        <div class="setting">
          <span class="s-main">
            <span class="s-title">18+ only</span>
            <span class="s-sub">You confirmed you are 18 or over on this device.</span>
          </span>
        </div>
        <div class="setting">
          <span class="s-main">
            <span class="s-title">Take a break</span>
            <span class="s-sub">Nothing here asks you to stake money. If betting has stopped being fun,
              free and confidential help is available.</span>
          </span>
        </div>
        <div class="setting" style="gap:8px;flex-wrap:wrap">
          <a class="chip" href="https://www.begambleaware.org" target="_blank" rel="noopener nofollow">BeGambleAware.org</a>
          <a class="chip" href="https://www.gamstop.co.uk" target="_blank" rel="noopener nofollow">GAMSTOP self-exclusion</a>
          <a class="chip" href="https://www.gamcare.org.uk" target="_blank" rel="noopener nofollow">GamCare</a>
        </div>
      </div>

      <p class="foot-note">Betting involves a risk of loss and is for adults only. Nothing in this app is a
        prediction of a certain outcome, and past results do not indicate future ones.</p>
    `);
  }

  BS.viewsExtra = { favourites, settings };
})(window.BS = window.BS || {});
