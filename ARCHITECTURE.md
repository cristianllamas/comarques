# Architecture & decisions

Written for whoever changes this next. The code is small; what is not obvious is *why*
several things are the way they are. Most of the entries under **Decisions** and
**Traps** were paid for with a bug, so please read before undoing one.

---

## Shape of the thing

A static site. No framework, no bundler, no runtime dependencies — open `docs/index.html`
and it runs. That is a deliberate choice for a one-week deadline: a toolchain is one more
thing that can break the day before the exam.

```
build/          run by hand; writes into docs/
  topology.mjs      shared-arc topology + Visvalingam simplification
  fetch-geo.mjs     ICGC layers -> docs/geo.js          (the only generated data file)
  fetch-hints.mjs   Wikipedia intros -> data/hints.raw.md  (raw material, not shipped)
  scan-photos.mjs   photos/ -> docs/img/capitals/ + docs/photos.js
  sim-scheduler.mjs simulates a week; asserts coverage
  e2e.mjs           drives real Chrome over DevTools Protocol

docs/           this directory IS the published site (GitHub Pages, /docs on main)
  index.html    shell; everything else is ES modules
  app.js        screens + session flow          (largest file, start here)
  map.js        Mapa class: SVG, zoom/pan, hit-testing, labels
  scheduler.js  Leitner boxes, due-selection    (pure, no DOM)
  answer.js     answer matching, masked hints   (pure, no DOM)
  quiz.js       question construction           (pure, no DOM)
  store.js      localStorage read/write
  geo.js        GENERATED — do not edit
  hints.js      hand-written memory hooks + articles
  photos.js     GENERATED — do not edit
  sw.js         offline cache
```

`scheduler.js`, `answer.js` and `quiz.js` touch no DOM on purpose — that is what lets
`sim-scheduler.mjs` import and exercise them directly in Node.

## Data

`docs/geo.js` exports:

```js
VIEWBOX      // "0 0 1000 986.85"
COMARQUES    // [{ code, name, capital, provincia, provinciaNota?, centroid, label, area, d }]
PROVINCIES   // [{ code, name, d }]
OSONA_MERGED // { code, d } — Osona with Lluçanès dissolved in, for 42-comarca mode
```

`code` is the official ICGC comarca code (`"01"`–`"43"`) and is the key everything else
joins on: `HINTS[code]`, `PHOTOS[code]`, and the scheduler's `"<code>:<facet>"`.

`label` is where the study-map text goes; `centroid` is kept separately because the two
are not the same point (see Decisions). `area` breaks ties when labels collide.

Progress in `localStorage` under `comarques.v1`:

```js
{ items: { "14:lloc": { box, due, seen, wrong, streak, last }, … },
  examDate, includeLlucanes, sessions, lastSession }
```

Two **facets** per comarca — `lloc` (where it is) and `capital` (what its capital is) —
because they are genuinely different memories. 43 × 2 = 86 items.

## Tunables

| Where | Constant | Now | Notes |
|---|---|---|---|
| `app.js` | `STUDY_CARDS` / `QUIZ_CARDS` | 6 / 12 | session length |
| `scheduler.js` | `BOX_MINUTES` | 20m, 2h, 8h, 1d, 2d | intervals per box |
| `scheduler.js` | `LEECH_WRONG` | 3 | failures before force-feeding |
| `scheduler.js` | `COOLDOWN` | 12 min | no repeat within a sitting |
| `scheduler.js` | `CLIP_BEFORE_EXAM` | 6 h | last chance to resurface |
| `fetch-geo.mjs` | `TARGET_COMARQUES` | 9000 | vertices kept (≈225 KB output) |

After changing any scheduler constant, run `node build/sim-scheduler.mjs` — it will tell
you if coverage broke.

---

## Decisions

**Leitner, not SM-2 or FSRS.** Those optimise six-month retention and schedule in
days-to-months; with an exam a week out they would show most comarques once. Intervals
here top out at two days and are clipped so nothing is scheduled after `examDate`. If
this app is ever repurposed for long-term study, this is the first thing to revisit.

**Coverage outranks box level in `selectDue`.** `urgency = seen*10 + box*4 − leech*15`.
Two earlier orderings both failed `sim-scheduler.mjs`:
- `box` first → a few leeches monopolised every session; one item appeared 21 times while
  61 others were shown fewer than 3 times.
- `box*10 + seen*4` → anything answered right once climbed to box 1 and was then
  permanently outranked by the crowd of box-0 items; 16 items were shown once all week.

**A miss costs two boxes, not all of them.** Textbook Leitner resets to box 1. Over a
single week that wipes progress faster than it can be rebuilt and nothing ever reads as
learned.

**Fase 1 and Fase 2 use different comarques.** `study = picks[0..6]`,
`quiz = picks[6..18]`. Testing what was just shown measures short-term memory; studied
items come back for testing in a later session via the scheduler. These overlapped
completely at first — it was a bug, not a design.

**Typed answers with a climb-down.** Generating an answer is what makes retrieval
practice work, but the benefit disappears if he keeps failing, so wrong answers descend
hint → first letter → four options. He always makes the effort and always ends up
succeeding.

**Províncies come from their own layer**, not from dissolving comarques, because
**Cerdanya straddles Girona and Lleida** (54/46 by area) and a dissolve would put that
border in the wrong place. For the same reason Cerdanya's província is an explicit
override (`PROVINCIA_OVERRIDE` in `fetch-geo.mjs`) — the centroid test puts it in Lleida,
but its official província is Girona. `EXPECTED` in the same file asserts the per-província
counts against the official table so a data refresh cannot quietly change them.

**Topology-aware simplification.** Neighbouring comarques share vertices in the source
(149k belong to exactly two features, plus 61 triple-junctions). Simplifying each polygon
independently would move shared borders in different directions and tear visible gaps, so
rings are cut into shared arcs, each arc is simplified once, and borders stay welded by
construction.

**Study-map labels: largest comarca first, collisions dropped.** All 43 cannot fit on a
phone. Where a full two-line label will not fit, the comarca name is shown alone before
giving up (this lifted full-extent coverage from 48% to 55%). Browsing the study map
deliberately does **not** feed the scheduler — looking is not retrieval, and counting it
would inflate "dominades" and starve genuinely weak items.

**No notifications.** A product decision, not a technical one: background notifications
from an Android PWA are unreliable. The consequence is that spacing depends on him
opening the app. `sim-scheduler.mjs` quantifies it — at 2 sessions/day the material is
not covered, at 3 it just is, at 6 about 80% ends up solid.

---

## Traps

Each of these cost real debugging time.

**`getBBox()` returns zeros on a detached element.** `Mapa.focus()` was called before the
screen was in the document, producing a degenerate viewBox and a blank map for the whole
session — and it looked fine in code review. `app.js` defers anything needing geometry via
`afterRender`, and `focus()` refuses a zero-sized bbox. If you add a screen that zooms,
set `afterRender`, do not call `focus()` inline.

**Never compare coordinates as raw floats.** The same junction comes back as
`2.4961408345561957` from one ring and `2.496140834556191` from another. Arc endpoints are
matched on a quantised grid (`Math.round(x * 1e6)`). The Osona/Lluçanès dissolve silently
produced fragments until this was fixed; it now asserts area is conserved to within 0.1%.

**Arc cutting must split *at* junctions, inclusive.** An earlier version ended each arc one
point past the signature change, so neighbours described the same border with different
endpoints, nothing deduplicated, and every border was stored and drawn twice. It looked
correct on screen, which is why `dissolve()` — which needs real shared arcs — was what
exposed it.

**Do not estimate text width from character count.** It undershoots for wide capitals and
accented glyphs, which left "ALT EMPORDÀ" clipped against the map edge. `layoutLabels()`
measures with `getBBox()`. There is an e2e assertion that no label crosses the viewBox,
because this is very hard to judge from a screenshot.

**The service worker serves cache-first.** After deploying, an already-installed client
keeps the old version until it refreshes in the background. Bump `CACHE` in `docs/sw.js`
when you change any shipped file, or you will test the old build and believe it.

**`localStorage` is per browser.** Laptop progress and phone progress are separate, and
neither reaches the other. Wrapped in try/catch everywhere: private mode throws.

**`e2e.mjs` must clean up after itself.** A crash used to leave Chrome running, and the
next run silently attached to that stale browser and reported failures that were not real.
It now kills its children on `uncaughtException`/`unhandledRejection`. If results look
impossible, check for an orphan on port 9333.

---

## Changing things

**Running it locally**

```bash
cd docs && python3 -m http.server 8000     # then open localhost:8000
```

Opening `index.html` as a `file://` URL will not work — ES modules need a real origin.

**The checks**

```bash
node build/sim-scheduler.mjs     # coverage over a simulated week; HOURS=8,13,17,21 to vary
node build/e2e.mjs               # real browser, full session; SHOTS=1 writes /tmp/e2e-*.png
URL=https://cristianllamas.github.io/comarques/ node build/e2e.mjs   # against production
```

`e2e.mjs` needs `google-chrome` and `python3` on PATH (it serves `docs/` itself) and
nothing else — no npm install, no test framework. It talks to Chrome over the
DevTools Protocol using Node's built-in `WebSocket`.

**Adding a question type.** Add a `kind` in `quiz.js:buildQuestion`, then handle it in
`app.js:screenQuiz`. If it is answered by tapping the map, follow `tap-map`: set
`mapa.enablePicking(true)` and assign `mapa.onPick`. If typed, the existing climb-down
works unchanged. Decide which `facet` it belongs to so the scheduler tracks it sensibly.

**Adding a field per comarca** (population, rivers, …). Emit it in `fetch-geo.mjs` where
`comarques` is built, or hand-write it in `docs/hints.js` if it is editorial. `hints.js`
is the right home for anything written rather than derived — `fetch-hints.mjs` only
produces raw material to write *from* and its output is not shipped.

**Refreshing the boundaries.** `rm data/*.raw.geojson && node build/fetch-geo.mjs`. The
integrity checks at the end (43 features, every capital present, província counts) are
there to catch an upstream change; if they fire, believe them.

**If a new comarca is ever created**, it will arrive in the ICGC data automatically, but
`docs/hints.js` needs a `hook` and an `art` (the Catalan article is irregular and must be
stated, not guessed), and `EXPECTED` in `fetch-geo.mjs` needs updating. The Lluçanès
toggle and the `dissolve()` call are specific to Osona/Lluçanès and would need
generalising.
