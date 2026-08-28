# BetStable · ScoreMore

A working prototype of the app: a cross-sport front page, two products, and a
feed interface a real odds/results provider can be dropped into.

- **Home** — a stack of scannable modules: hot tips, your tipsters, who is in
  form, and the events you starred
- **BetStable** — horse racing across nine jurisdictions
- **ScoreMore** — football across eighteen competitions
- **Hot** — every live tip, ranked by agreement, filterable by sport
- **Me** — your own record: ROI with its interval, drawdown, the ledger

## Navigation

One model, three presentations, all rendering from `MENU` in `src/menu.js`, so a
route added once appears in all of them:

- **Drawer** — hamburger, top left. Everything grouped, with the product switch
  at the top and theme/settings in the footer.
- **Bottom bar popovers** — on a phone, Tips and You raise a menu above the bar;
  Home, Racing and Football go straight there.
- **Top dropdowns** — from 900px the menu bar takes over, one dropdown per
  section.

## Design

The front page is a stack of plain modules — header, optional sort, rows, one
action — so the whole thing is scannable in a single pass and every route to a
tip is two taps. The design effort goes into rhythm, hierarchy and tap targets
rather than decoration.

Two products, two visual worlds, one app. Every colour, radius and shadow is a
token, so setting `data-product` on the root element repaints the interface:

- **BetStable** — pine `#00231F`, grass `#065B07`, barn tan `#AF6E4B`, cream
  `#F6F0E1`, straight off the logo. Rounded, warm, a little agricultural.
- **ScoreMore** — light blue on white, cooler ink, tighter corners and more air.
  A broadcast scoreboard rather than a stable yard.

Each has its own mark: the barn for BetStable, a football for ScoreMore, so the
two are never confused at 32px in a tab bar. Both have full dark variants. The roundel is redrawn from the logo —
wide overhanging dark roof, planked tan walls, green cross-braced door, fence
rails running out to the ring — with a simplified variant below 40px where the
planks, horseshoe and fence turn to mud. Dark grounds carry
grain and a warm glow; cream surfaces carry a paper highlight above a warm
shadow. Montserrat 900 carries the wordmark and every figure; Figtree runs the
interface.

## Run it

```
open index.html            # no build step, no server, no dependencies
python3 build.py           # optional: inline everything into dist/
```

Every script is a classic `<script>` tag, so the app runs straight off the file
system as well as from a server.

## What is real and what is sample data

The **mechanism** is real: server-side timestamps, an odds freeze at the moment
of posting, an append-only ledger with no edit or delete path, a scheduled
settlement job the user cannot reach, per-tip hashes and a daily Merkle root,
ROI with confidence intervals, and drawdown.

The **data** is generated. There is no odds API and no results API yet, so
`src/feed-racing.js` and `src/feed-football.js` synthesise cards and fixtures
from a seeded PRNG. The same day always produces the same card, and times are
converted from venue-local to real instants through `Intl`, so DST is handled
rather than assumed.

Horse, jockey and trainer names are **invented** — a fabricated record should
never be attached to a real person or animal. Club and competition names are
real; every price, score and line-up attached to them is not.

## Swapping in real feeds

`src/provider.js` is the only module that knows where data comes from. Nothing
in the views touches a feed directly. Reimplement these and the app is live:

| Method | Returns |
|---|---|
| `meetings(dayOffset)` | race meetings for a day, each with its races and runners |
| `fixtures(dayOffset)` | football fixtures for a day |
| `freezeOdds(quoted)` | the authoritative price at this instant, plus its timestamp |
| `raceResult(race)` / `fixtureResult(fx)` | settlement input, from the results feed only |
| `health()` | per-feed status, surfaced in the header |

Keep the shapes and the rest of the app is unchanged. This is the abstraction
that lets a provider be swapped without touching a view.

## Layout

```
index.html              shell and script order
assets/app.css          design system: tokens, light + dark, components
src/core.js             seeded PRNG, timezone maths, formatting, safe templating
src/feed-racing.js      jurisdictions, venues, racecard generation
src/feed-football.js    competitions, fixture and in-play generation
src/provider.js         the feed interface — the swap-in point
src/store.js            append-only ledger, ROI/CI/drawdown, hashes, Merkle root
src/tipsters.js         the roster, following, and the heat score behind Hot
src/ui.js               tip sheet, silks, odds buttons, toasts
src/views-racing.js     today, next 7 days, racecard
src/views-football.js   today, next 7 days, match page
src/views-record.js     my record with equity curve, ranked tables
src/views-home.js       the front page
src/views-hot.js        hot tips, tipster directory, tipster profile
src/views-extra.js      favourites and settings
src/menu.js             the navigation model and its three presentations
src/app.js              routing, settlement job, clock, age gate
```

## Product rules that live in the code

- A course or competition only appears while it still has an event to come.
- Runners and riders publish about 48 hours out; before that a race shows
  entries, no jockeys and no prices — you cannot tip what has no price.
- Tips are rejected once an event has started.
- Stakes are fixed at one unit. There is no stake field.
- The ledger has `addTip` and `settle`. There is no update and no delete.
- Rankings sort on the **bottom** of the 95% interval, with a 100-tip minimum.
- Heat is agreement between tipsters with a record, close to the off — never a
  confidence score, and the app says so where it is shown.
- Following is one list, so a follow made in a table shows on the front page.
- Short-run form (streak, last 7, last 30) is kept separate from the record, so
  a good fortnight is never presented as an edge.
- Prices are capped at realistic maxima — 150 for a horse, 26 for a 1X2 line.
- Age gate on first load, stored on the device; 18+ and BeGambleAware on every
  screen.

## Known gaps

- Settlement resolves against events loaded in the current session. With a real
  results feed this becomes a server-side job over the whole ledger.
- The ledger is `localStorage`, so it is per-device and per-browser.
- Odds bands in the ranked table re-seed the sample rather than filtering a real
  tip history.
- Tipster records are generated, and their live tips are attached to real events
  from the feed so they open and settle like your own.
