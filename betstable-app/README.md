# BetStable · ScoreMore

A working prototype of the app: a cross-sport front page, two products, and a
feed interface a real odds/results provider can be dropped into.

- **Sign up** — claim a handle; a tip cannot be posted without one, because a
  record has to be attached to a name that is never reassigned
- **Home** — a stack of scannable modules: hot tips, your tipsters, who is in
  form, and the events you starred
- **BetStable** — horse racing across nine jurisdictions
- **ScoreMore** — football across eighteen competitions
- **Hot** — every live tip, ranked by agreement, filterable by sport
- **Experts** — two badges, awarded and removed by a weekly job
- **Me** — your own record: ROI with its interval, drawdown, the ledger

## Browsing to a race

Racing drills down the way punters navigate: **all courses → a country → a
meeting → the card**, with a flat **Next races** list across every jurisdiction
for when you just want whatever runs soonest. Football takes the same shape —
regions → competitions → fixtures, plus **Next kick-offs**.

## Experts, checked weekly

Two badges, both computed in `src/experts.js`:

| Badge | Rule |
|---|---|
| **Consistent** | In profit across each of the last three 30-day periods, on a profitable record of 100+ settled tips |
| **Value** | Profitable with an average winning price of 4.5 or bigger, and at least 12 winners at those prices |

A job re-evaluates every tipster once a week, on a Monday boundary. It is
idempotent — running twice in a week changes nothing — and every award and every
loss is appended to a log that is never rewritten. A badge nobody can lose is
not evidence of anything, so losing one is a first-class event.

The Experts page shows the last run, the next run, the current holders and the
recent changes. The "simulate next week" button is a demo affordance and says so;
the real job runs server-side and cannot be triggered by hand.

## Type

Three faces, three jobs, none of them the safe default:

| Role | Face | Why |
|---|---|---|
| Display | **Bricolage Grotesque** | Variable width and optical size; enough character to stop headings reading as a template |
| Data | **Archivo Narrow** | Every odd, time, price and figure — condensed with real tabular figures, the way a racecard sets numbers |
| Interface | **Instrument Sans** | Quiet, warm, stays out of the way |

Display tightens as it grows (−.032em at h1) and uppercase micro-labels open up
(+.1em at 11px) — the two moves that separate set type from default type.
Weights go through `font-weight`, `font-stretch` and `font-optical-sizing`
rather than `font-variation-settings`, which silently overrides `font-weight`.

Icons are one family (`src/icons.js`), drawn on a 24 grid at 1.7 stroke and
balanced against each other rather than each drawn alone. The emoji that were
doing this job came from a dozen different foundries and it showed. Country
flags stay as emoji — those are legitimately flags — and the run-in marker wears
the runner's own silks.

## Motion

`src/fx.js` is the motion and celebration layer, and everything in it obeys two
rules: motion has to mean something, and anyone who asks for reduced motion gets
the end state instantly rather than a slower show.

- **The run-in** — the front page opens on a track with a runner on it, placed by
  how close the next race or kick-off actually is. It creeps along on a one-second
  tick, breaks into a canter inside three minutes, and reads as a countdown from
  across the room. A ball replaces the jockey in ScoreMore.
- **The stamp** — posting a tip is the one irreversible act in the app, so it gets
  the one piece of theatre: the mark comes down on the record with a shockwave.
- **Confetti** — fires for exactly one thing, a tip of yours coming in. Anything
  more and it stops meaning anything.
- **Staggered entrances**, pressable feedback on every control, a dot burst when
  you follow someone, live countdowns that throb inside the last few minutes, and
  a themed loader that tells you which product you are waiting on.

Colour comes from a six-value accent set per product — hay, clay, moss, pine,
rust and wheat for BetStable; broadcast blues with one warm signal colour for
ScoreMore — used for module hues, heat meters, stat bars and confetti.

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
src/fx.js               motion: the run-in, the stamp, confetti, stagger, loaders
src/icons.js            one icon family, and the silks/ball run-in marker
src/account.js          claiming a handle, and the validation behind it
src/experts.js          the two badges and the weekly job that maintains them
src/views-browse.js     all courses → country → meeting → card, and next off
src/views-account.js    sign-up and the experts page
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
