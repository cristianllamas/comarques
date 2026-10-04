# Architecture & decisions

Written for whoever changes this next. The code is small; what is not obvious is *why*
several things are the way they are. Most entries under **Decisions** and **Traps** were
paid for with a bug, so please read before undoing one. For what the app does from the
learner's side, with screenshots, see [README.md](README.md).

---

## 1. Shape of the thing

A static site. No framework, no bundler, no runtime or build dependencies — plain ES
modules that run when `docs/index.html` is served. That began as a choice for a one-week
deadline (a toolchain is one more thing that can break the day before an exam) and it
has stayed that way on purpose.

- **`docs/` is the published site.** GitHub Pages serves `/docs` from `main`; pushing to
  `main` deploys. There is no staging.
- **`build/` is run by hand** and writes into `docs/`. Nothing in `build/` ships.
- **Catalan** for everything the learner sees; English for code and comments.

It started as a comarques-only app and became **content packs**. The core idea:

> A **pack** is a **topic** plus the **facets** it asks about.
> A **topic** is a map and the **places** on it.
> Everything below the pack layer is topic-agnostic.

So *Comarques i capitals* and *Comarques* are two packs on the same `cat` topic, one
asking `['lloc', 'capital']` and the other only `['lloc']`.

### Layers

```
                 packs.js        which packs exist, in picker order: topic + facets + title
                    │
                 topics.js       loads a topic's data files and normalises them into one
                    │            shape: places, context, borders, insets, words, toggle
                    │                 ▲
                    │            data/<topic>-geo.js    (generated)  geometry
                    │            data/<topic>-hints.js  (hand-written) names, articles, hooks
                    │            data/<topic>-photos.js (generated)  photo files + credits
                    ▼
   app.js  ── screens and session flow ──────────────────────────────────────┐
     │  uses                                                                  │
     ├── map.js        renders any topic as SVG; zoom, pan, picking, labels   │ DOM
     ├── quiz.js       builds a question from (place, facet), with grammar    ┘
     ├── answer.js     forgiving answer matching, masked first-letter hint    ┐
     ├── scheduler.js  Leitner boxes: grading and what to show next           │ pure,
     └── store.js      localStorage, one record per pack; old-data migration  │ no DOM
                                                                              ┘
```

`scheduler.js`, `answer.js`, `quiz.js`, `packs.js` and `topics.js` touch no DOM on
purpose — that is what lets `build/sim-scheduler.mjs` import and exercise them in Node.

### Files

```
docs/                     the published site
  index.html              shell; loads app.js
  app.js                  screens + session flow                 (start here)
  map.js                  Mapa: SVG layers, zoom/pan, hit-testing, labels
  quiz.js                 question construction + Catalan grammar  (pure)
  answer.js               answer matching, masked hints            (pure)
  scheduler.js            Leitner boxes, due-selection, intro order (pure)
  store.js                localStorage per pack; migrates comarques.v1
  packs.js                the content packs, in picker order       (pure)
  topics.js               topic loaders → one normalised shape      (pure)
  styles.css              all styling; light and dark themes
  sw.js                   offline cache
  manifest.json, icon.svg PWA install
  data/
    cat-geo.js   cat-hints.js   cat-photos.js     comarques
    esp-geo.js   esp-hints.js   esp-photos.js     comunitats autònomes
    ue-geo.js    ue-hints.js    ue-photos.js      Unió Europea
                 (*-geo.js and *-photos.js GENERATED — do not edit; *-hints.js hand-written)
  img/cat/ img/esp/ img/ue/   photos resized to 800 px

build/                    run by hand
  topology.mjs            shared-arc topology + Visvalingam simplification
  geo-lib.mjs             geometry helpers shared by the three geo builds
  fetch-geo.mjs           ICGC comarques + províncies     → data/cat-geo.js
  fetch-geo-esp.mjs       GISCO NUTS-2 Spain + context    → data/esp-geo.js
  fetch-geo-ue.mjs        GISCO countries                 → data/ue-geo.js
  fetch-hints.mjs         Wikipedia intros → data/hints.raw.md (raw material only)
  fetch-photos.mjs        landmark photos + credits from Commons → photos/<topic>/
  scan-photos.mjs         photos/<topic>/ → img/<topic>/ + data/<topic>-photos.js
  sim-scheduler.mjs       simulates a week of study for every pack
  e2e.mjs                 drives the real app in headless Chrome

photos/<topic>/           original photos (+ credits.json for Commons ones)
screenshots/              README screenshots, written by `SHOTS=screenshots node build/e2e.mjs`
data/                     downloaded raw sources (*.raw.geojson, gitignored)
```

---

## 2. Concepts and data model

| Term | Meaning | Example |
|---|---|---|
| **topic** | a map and its places | `cat`, `esp`, `ue` |
| **place** | one tappable region | Bages, Navarra, Malta |
| **facet** | one thing to know about a place | `lloc` (where it is), `capital` |
| **item** | a place × facet, tracked by the scheduler | `"07:capital"` |
| **pack** | a topic + the facets it asks | `comarques` = `cat` × `['lloc']` |

`code` is the key everything joins on: the official ICGC comarca code (`"01"`–`"43"`),
the NUTS-2 code for comunitats (`"ES51"`), the GISCO country code for the EU (`"FR"`;
note Greece is `"EL"`). Items are keyed `"<code>:<facet>"`.

### The normalised topic

`topics.js` turns each topic's three data files into one shape, so `map.js`, `quiz.js`
and `app.js` never know which map they are drawing:

```js
{
  id, viewBox,
  places: [{
    code, name, capital,      // capital may be null (Ceuta); "A / B" means two capitals
    art,                      // article: 'l' | 'el' | 'la' | 'les' | 'els' | 'cap' (none)
    hook,                     // the memory hook
    accepta, accNom,          // extra accepted answers for the capital / the name
    askCapital,               // false: shown on the card, never asked (Luxemburg)
    capitalLabel,             // optional shorter capital for the study-map label
    photo, credit,            // image path; { caption, author, license, source, retall? }
    extra,                    // a line of context for the card (província, "Ciutat autònoma")
    label, area, d, mark,     // label anchor, area (label priority), SVG path, tap-ring centre
  }],
  byCode,                     // Map code → place
  context: [d],               // grey, untappable surroundings (neighbouring countries)
  borders: [d],               // thick lines over the places (províncies)
  insets: [{ x, y, w, h }],   // framed boxes for places drawn elsewhere (Canàries)
  words: {                    // the topic's phrasing — gender and noun differ per topic
    many, whichShape, capitalOfWhich, capitalsOfWhich,
    placeholder, tapToSee, tapHelp, wrongTap(nameWithArticle),
  },
  toggle,                     // optional on/off option: { label, note, whenOff: { hide, replace } }
}
```

The hand-written hints files use Catalan field names (`preguntaCapital`, `nota`,
`etiqueta`) where an editor writes them; `topics.js` maps them to the names above.

### Data files per topic

| | `*-geo.js` exports | `*-hints.js` (keyed by code) |
|---|---|---|
| **cat** | `VIEWBOX`, `COMARQUES` (with name, capital, província from ICGC), `PROVINCIES`, `OSONA_MERGED` | `art`, `hook`, `accepta` |
| **esp** | `VIEWBOX`, `REGIONS`, `CONTEXT`, `INSET` | `name`, `capital`, `art`, `hook`, `accepta`, `accNom`, `preguntaCapital`, `nota`, `etiqueta` |
| **ue** | `VIEWBOX`, `COUNTRIES`, `CONTEXT` | `name`, `capital`, `art`, `hook`, `accepta`, `accNom`, `preguntaCapital` |

For the comarques, names and capitals come from the official geometry. For `esp` and
`ue` the GISCO names are Spanish/English, so the hints file is the source of truth and the
build refuses to run if it and the geometry disagree.

Every `*-photos.js` exports `PHOTOS` (code → file name) and, for Commons photos,
`CREDITS` (code → caption, author, licence, source URL, optional `retall`).

### Saved progress

In `localStorage` under `geografia.v2`, one record per pack:

```js
{ pack: "comarques-capitals",                     // last pack opened
  packs: {
    "comarques-capitals": {
      items: { "14:lloc": { box, due, seen, wrong, streak, last }, … },
      order: ["31:capital", "07:lloc", …],        // shuffled introduction order
      toggle: false,                              // the topic's option (Lluçanès)
      sessions, lastSession },
    … } }
```

`store.js` reads defensively — a corrupt or half-written value must never stop anyone
studying — and on first load copies the comarques-only app's `comarques.v1` into the
*Comarques i capitals* pack (see Decisions).

---

## 3. How it runs

### Boot and screens

```
load()  ── a pack remembered? ──yes──► openPack(id) ─► Home
   │                                       ▲
   no                                      │
   ▼                                       │
Packs (picker) ────────── choose ──────────┘

Home ── Comença ─► startSession ─► Repàs ×6 ─► Recorda ×12 (+ requeued misses) ─► Summary
  │                                                                                │
  ├── Mira el mapa ─► Study map (browsing; never touches the scheduler)            │
  ├── Opcions ─► toggle, reset this pack                                           │
  └── ☰ Packs de contingut ─► Packs                     ◄── Una altra sessió / Inici ┘
```

`openPack` loads the topic (dynamic `import()`, so opening one pack does not download
every map), creates one `Mapa` for it, and applies the pack's toggle. Every screen is a
function returning a fresh DOM tree that `render()` swaps in; the one `Mapa` element is
moved between screens rather than rebuilt.

**`afterRender`.** Anything that needs real geometry — `getBBox`, and therefore every
zoom — is deferred until the screen is in the document (see Traps).

### A session

1. `ensureOrder` gives the pack a shuffled introduction order the first time (and
   appends new items, e.g. Lluçanès switched on).
2. `selectDue(state, pairs, 18, now)` picks 18 items, at most one per place.
3. The first 6 become **Repàs** cards (`markStudied`: seen, but no box change); the next
   12 become **Recorda** questions (`buildQuestion`, random kind within the facet).
4. Each answer is `grade`d and saved immediately. A miss is requeued once at the end.
5. Typed answers climb down: hint → first letter → four options. Reaching the answer
   only at the options is graded as a miss.

### Scheduling

Leitner boxes with short intervals — `20m, 2h, 8h, 1d, 2d, 4d, 8d`. A right answer moves
up one box; a miss drops two. An item in box ≥ 3 counts as *dominada*; three misses make
it a *leech* (*es resisteix*).

`selectDue` builds a session from three pools:
- **unseen** items, in the saved shuffled order;
- **due** items (past their time and not touched in the last 12 minutes), sorted by
  `urgency = seen*10 + box*4 − leech*15` — least-seen first;
- if both run dry, the items **closest to due**, so a session is never empty.

Unseen and due are interleaved two-to-one, and a place already picked is skipped.

### The map

One SVG, layered bottom to top:

| Layer | Class | Source | Tappable |
|---|---|---|---|
| context | `.contexte` | `topic.context` — neighbouring countries | no |
| insets | `.requadre` | `topic.insets` — opaque box hiding context | no |
| places | `.zona` | `topic.places[].d` | **yes** |
| borders | `.provincia` | `topic.borders` | no |
| highlights | copies of `.zona` | `raise()` — so a highlight is never under a neighbour's border | no |
| tap rings | `.anella` | `topic.places[].mark` | **yes** |
| labels | `.etiqueta` | study map only | no |

Zoom and pan only change the `viewBox`; strokes use `vector-effect: non-scaling-stroke`
so they stay crisp. A tap is resolved with `elementFromPoint` → `.zona, .anella` →
`data-code`. The toggle (`setToggle`) hides the codes in `whenOff.hide` and swaps in the
`whenOff.replace` outline (Osona with Lluçanès dissolved).

Study-map labels are laid out on every zoom: largest place first, measured with
`getBBox`, nudged inside the view, dropped on collision — and if name + capital does not
fit, the name alone is tried.

---

## 4. Building the data

All three geo builds share `topology.mjs` (cut rings into shared arcs, simplify each arc
once) and `geo-lib.mjs` (download/cache, rings, area, centroid, label anchor,
point-in-polygon, dissolve, clipping, and `processLayer` which runs the whole chain).

| | `fetch-geo.mjs` (cat) | `fetch-geo-esp.mjs` | `fetch-geo-ue.mjs` |
|---|---|---|---|
| Source | ICGC via Dades Obertes: comarques `aasi-gwnd`, províncies `d2un-hz8w` | GISCO NUTS 2024 L2 1:1M (Spain), L0 (PT, FR), countries 1:3M (AD, GI, MA, DZ) | GISCO countries 2024 1:10M, EPSG:3035 |
| Projection | equirectangular, × cos(mid-lat) | the same | EPSG:3035 as delivered (scale + flip) |
| Special | Osona+Lluçanès dissolve; Cerdanya override | Canàries inset; context clipped | overseas parts dropped; context clipped |
| Asserts | 43 comarques, capital + província each, per-província counts | 19 regions, 17 capitals, all in hints | 27 members (`EU_STAT`), all in hints |
| Output | ≈225 KB | ≈155 KB | ≈150 KB |

Raw downloads are cached in `data/*.raw.geojson` (gitignored); delete one to refetch.

### Photos

```
fetch-photos.mjs <topic>  ──►  photos/<topic>/<capital>.jpg + credits.json
                                       │   (or: drop your own files into photos/<topic>/)
scan-photos.mjs <topic>   ──►  docs/img/<topic>/<code>.jpg (800 px)  +  data/<topic>-photos.js
```

`fetch-photos.mjs` holds a hand-reviewed `LANDMARKS` table per topic: the landmark's
English Wikipedia title, the Catalan caption, and optionally a pinned Commons `file` and
`retall: 'cap'` (show uncropped). It takes Wikidata's chosen image (P18), falling back to
the article's lead image, preferring landscape JPEGs, and records author and licence.
`scan-photos.mjs` matches files to places by name or capital (accents, case, articles
and hyphens ignored), resizes with ImageMagick, and ships the credits.

The comarques photos were supplied by hand and have no credits.

---

## 5. Offline, deploy, testing

**Service worker** (`sw.js`): precaches the shell, the modules and every topic's data on
install; serves cache-first and refreshes in the background, so a deploy reaches an
installed phone on its next launch or the one after. Photos are cached the first time they
are shown. Third-party requests (the analytics beacon) bypass it. **Bump `CACHE` whenever
a shipped file changes.**

**Deploy:** push to `main`. Then confirm what is actually live:

```bash
gh api repos/cristianllamas/comarques/pages/builds/latest --jq '.status + " " + .commit'
URL=https://cristianllamas.github.io/comarques/ node build/e2e.mjs
```

**`sim-scheduler.mjs`** simulates a learner who genuinely learns (seeded, reproducible)
through 7 days at 3 sessions a day, for every pack, and fails unless every item is shown
at least 3 times and no session shows a place twice. `HOURS=8,13,17,21` varies the
sessions per day, `PACK=<id>` runs one pack, `DEBUG=1` lists the least-shown items. At 3
a day each item is shown, at minimum / median: *Comarques i capitals* 3 / 4,
*Comarques* 7 / 9, *Unió Europea* 5 / 7, *Comunitats* 7 / 11.

**`e2e.mjs`** serves `docs/` itself and drives headless Chrome over the DevTools
Protocol with Node's built-in `WebSocket` — no npm, no test framework. It fails on any
console error. It walks: the picker and its order; home; options and the Lluçanès toggle;
a full session including the climb-down; the study map (labels, decluttering, clipping,
zoom, tapping); every other pack (no capitals anywhere in *Comarques*; EU tap rings and
photo credits; the Canàries inset, Ceuta, two capitals, the uncropped León photo); and the
migration of old progress. `SHOTS=1` writes `/tmp/e2e-*.png`; `SHOTS=screenshots`
regenerates the README's screenshots.

---

## 6. Tunables

| Where | Constant | Now | Notes |
|---|---|---|---|
| `app.js` | `STUDY_CARDS` / `QUIZ_CARDS` | 6 / 12 | session length |
| `scheduler.js` | `BOX_MINUTES` | 20m, 2h, 8h, 1d, 2d, 4d, 8d | intervals per box |
| `scheduler.js` | `LEECH_WRONG` | 3 | misses before an item is a leech |
| `scheduler.js` | `COOLDOWN` | 12 min | no repeat within a sitting |
| `fetch-geo*.mjs` | `TARGET*` | 9000 / 9000 / 12000 | vertices kept after simplification |
| `fetch-geo-*.mjs` | `SMALL` | 400 units² | below this a place gets a tap ring |

After changing any scheduler constant, run `node build/sim-scheduler.mjs`.

---

## 7. Decisions

### Learning

**Leitner, not SM-2 or FSRS.** Those optimise six-month retention and schedule in
days-to-months; for school geography studied over a week or two they would show most
places once. Intervals here top out at eight days. If the app is ever repurposed for
long-term study, this is the first thing to revisit.

**Coverage outranks box level in `selectDue`.** `urgency = seen*10 + box*4 − leech*15`.
Two earlier orderings both failed `sim-scheduler.mjs`:
- `box` first → a few leeches monopolised every session; one item appeared 21 times while
  61 others were shown fewer than 3 times.
- `box*10 + seen*4` → anything answered right once climbed to box 1 and was then
  permanently outranked by the crowd of box-0 items; 16 items were shown once all week.

**A miss costs two boxes, not all of them.** Textbook Leitner resets to box 1. Over a
week or two that wipes progress faster than it can be rebuilt and nothing ever reads as
learned.

**Repàs and Recorda use different places.** Testing what was just shown measures
short-term memory; studied items come back as questions in a later session. These
overlapped completely at first — it was a bug, not a design.

**One place at most once per session.** `selectDue` skips a place already picked. Before
this, both facets of a place came out together: Repàs showed the same card twice in a row,
and Recorda could ask the capital of a comarca Repàs had just shown.

**New items arrive in a shuffled order that is saved.** Without it they came out in code
order — alphabetical — so every learner started with the Alt Camp and the Alts. The
shuffle happens once per pack (`ensureOrder`) and is kept, so reopening does not reshuffle.

**Typed answers with a climb-down.** Producing an answer is what makes retrieval practice
work, but the benefit disappears with repeated failure, so wrong answers descend
hint → first letter → four options. The effort is always made and it always ends in
success.

**No exam date.** The first version took an exam date, showed a countdown, clipped every
interval to land before it and switched to a drill-the-weakest "exam mode" on the last
day. Nobody set it in practice, so it was removed with the clipping, and the boxes grew
4d and 8d so well-known items stop crowding out weak ones.

**Browsing does not count.** The study map never feeds the scheduler — looking is not
retrieval, and counting it would inflate *dominades* and starve genuinely weak items.

**No notifications.** A product decision: background notifications from an Android PWA
are unreliable, so spacing depends on the learner opening the app. The simulation
quantifies it — two sessions a day do not cover *Comarques i capitals*; three do.

### Packs and storage

**Packs keep separate progress, even when they share a map.** Knowing where the Bages is
says nothing about its capital, and merging the two would make one pack's *dominades*
leak into the other.

**No profiles.** Each learner uses their own device; `localStorage` is per device anyway.

**Old progress is copied, never moved.** `store.js` copies `comarques.v1` into the new
shape on first load and leaves the original in place. The tag `pre-packs` marks the last
comarques-only version; rolled back to it, that version finds its data where it left it.

**Switching packs lives in the header.** The pack sits above everything else on the home
screen, so *☰ Packs de contingut* is in the header rather than among the screen's own
options (chosen from three mockups).

### Content and language

**Grammar comes from the article, never from the name.** `art` drives the article itself
(*els Països Baixos*), the genitive (*dels*, *de la*, *de l'*) and the verb — plural names
take *són* ("On són les Garrigues?"; the first version asked "On és les Garrigues?").
With no article, *de* elides before a vowel or silent h (*d'Hongria*), not before a
consonant (*de França*). Wrong-tap feedback says "Has tocat …" so it never has to agree in
gender with the place tapped.

**Capitals that are never asked.** `capital: null` (Ceuta, Melilla) means no capital
facet at all. `preguntaCapital: false` keeps the capital on the card but never asks it,
where the question would answer itself (Luxemburg, Madrid, Múrcia).

**Two capitals.** A capital written `"A / B"` (Canàries, Vallès Occidental) accepts
either, reads "A i B" everywhere it is shown, and switches prompts to the plural
("Quines són les capitals…", "… són les capitals de quina…").

**No official capital.** The País Basc and Castella i Lleó have none in law; the app uses
the seats of government (Vitòria, Valladolid) — the textbook answer — and the hook says so.

**Neutral prompt for the comunitats.** *"Quina comunitat o ciutat autònoma és la
destacada?"* for every place: "comunitat" is wrong for Ceuta and Melilla, and naming
those two "ciutat autònoma" would give the answer away.

**Províncies come from their own layer**, not from dissolving comarques, because
**Cerdanya straddles Girona and Lleida** (54/46 by area) and a dissolve would put that
border in the wrong place. For the same reason Cerdanya's província is an explicit
override (`PROVINCIA_OVERRIDE`) — the centroid test puts it in Lleida, but officially it
is Girona. `EXPECTED` asserts the per-província counts so a data refresh cannot quietly
change them.

**42 comarques by default.** Lluçanès split from Osona in 2023 and many textbooks still
list 42. The toggle is off by default, and Osona is drawn with Lluçanès dissolved back in.

### Maps

**Topology-aware simplification.** Neighbouring places share vertices in the source (for
the comarques, 149k belong to exactly two features, plus 61 triple-junctions).
Simplifying each polygon independently would move shared borders in different directions
and tear visible gaps, so rings are cut into shared arcs, each simplified once, and
borders stay welded by construction. Context countries go through the same topology as
the places so their shared borders weld too.

**The EU map: GISCO in its own projection, neighbours as context.** EPSG:3035 is the
EU's own equal-area projection and arrives ready-projected. Overseas territories are
dropped by fitting the frame to the European parts of the member states. Every non-member
inside the frame is drawn grey, because a country floating in white space is hard to
recognise; they are clipped to a window slightly larger than the frame so cut edges are
never visible. Cyprus is drawn as the whole island, as the EU treats it.

**The Spain map: NUTS-2, its own projection, Canàries in an inset.** In Spain, NUTS
level 2 is exactly the 17 comunitats plus Ceuta and Melilla. EPSG:3035, centred on
52°N 10°E, draws Spain visibly tilted, so it uses the comarques projection instead.
Portugal and France come from NUTS level 0 of the same dataset so their borders weld with
Spain's. Canàries are shifted as a block into a framed box at the bottom left, the usual
convention; their card says so, so nobody learns they sit off Portugal.

**Tap rings for tiny places.** Malta is about two pixels across at full extent; Ceuta
and Melilla are similar. Places under `SMALL` units² get a `mark`, drawn as a ring that can
be seen, tapped, and highlighted with the same classes as the shape.

**Study-map labels: largest place first, collisions dropped.** Not every name fits on a
phone. Where name + capital will not fit, the name alone is tried before giving up (this
lifted full-extent coverage of the comarques from 48% to 55%). A place can give a shorter
capital for its label (`etiqueta`: "Las Palmas i Santa Cruz").

### Photos

**Landmarks chosen by hand, fetched with their credits.** Auto-picking a place's own
lead image gave flags and maps. Instead each place has a reviewed landmark; the image is
the one Wikidata's editors chose for it. Even so, many automatic picks failed visual
review (an empty square, a cropped tower, the wrong town) and are pinned to a specific
Commons file. Several landmarks outside the capital were chosen on purpose (the Alhambra,
the Guggenheim, León cathedral).

**Every Commons photo has a caption that names the city**, so a landmark outside the
capital is never taken for one in it, plus the author and licence its licence requires,
linked to the original. The caption always follows the `LANDMARKS` table, and a photo
found through a fallback title is flagged — Navarra once showed the cathedral captioned
"Plaça del Castell".

**Cropped from near the top.** Cards crop photos to 4:3 at `object-position: 50% 15%`:
on a tall photo the top is the spire or tower that makes it recognisable. A photo whose
bottom matters too is shown whole (`retall: 'cap'` — León cathedral with its square).

---

## 8. Traps

Each of these cost real debugging time.

**`getBBox()` returns zeros on a detached element.** `Mapa.focus()` was called before the
screen was in the document, producing a degenerate viewBox and a blank map for the whole
session — and it looked fine in code review. `app.js` defers anything needing geometry via
`afterRender`, and `focus()` refuses a zero-sized bbox. If you add a screen that zooms,
set `afterRender`; do not call `focus()` inline.

**Never compare coordinates as raw floats.** The same junction comes back as
`2.4961408345561957` from one ring and `2.496140834556191` from another. Arc endpoints are
matched on a quantised grid (`Math.round(x * 1e6)`). The Osona/Lluçanès dissolve silently
produced fragments until this was fixed; it now asserts area is conserved to within 0.1%.
`clipRing` computes cut points with the segment's endpoints in a canonical order for the
same reason: two neighbours must get bit-identical points.

**Arc cutting must split *at* junctions, inclusive.** An earlier version ended each arc one
point past the signature change, so neighbours described the same border with different
endpoints, nothing deduplicated, and every border was stored and drawn twice. It looked
correct on screen, which is why `dissolve()` — which needs real shared arcs — exposed it.

**Do not estimate text width from character count.** It undershoots for wide capitals and
accented glyphs, which left "ALT EMPORDÀ" clipped against the map edge. `layoutLabels()`
measures with `getBBox()`, and the e2e asserts no label crosses the viewBox in any pack,
because this is very hard to judge from a screenshot.

**The service worker serves cache-first.** After deploying, an installed client keeps the
old version until it refreshes in the background. Bump `CACHE` in `docs/sw.js` when you
change any shipped file, or you will test the old build and believe it.

**A data module may not export what you import.** `import { CREDITS }` fails the whole
module graph if the generated file predates `CREDITS`. Optional exports are destructured
with a default from the namespace (`{ PHOTOS, CREDITS = {} }`).

**`localStorage` is per browser.** Laptop and phone progress are separate. Wrapped in
try/catch everywhere: private mode throws.

**`e2e.mjs` must clean up after itself.** A crash used to leave Chrome running, and the
next run silently attached to that stale browser and reported failures that were not
real. It now kills its children on `uncaughtException`/`unhandledRejection`. If results
look impossible, check for an orphan on port 9333.

**The e2e can be wrong too.** Twice while adding the packs a failure was the test, not the app: tapping
the centre of an archipelago's bounding box lands in the sea, and "País Basc" matches a
naive /país/ check. Read the failure before changing the app.

---

## 9. Changing things

**Run it locally:** `cd docs && python3 -m http.server 8000`. Opening `index.html` as a
`file://` URL will not work — ES modules need a real origin.

**Add a pack on an existing topic** — one entry in `packs.js` (position = picker order),
then run both checks.

**Add a topic:**
1. A build script writing `docs/data/<id>-geo.js` — reuse `geo-lib.mjs`; assert the
   expected count and that every place has a hints entry.
2. `docs/data/<id>-hints.js` by hand: `name`, `capital`, `art`, `hook`, accepted
   alternatives. Never derive articles from names.
3. An empty `docs/data/<id>-photos.js` (`export const PHOTOS = {};`), then photos via
   `fetch-photos.mjs` (add a `LANDMARKS` table) and `scan-photos.mjs`.
4. A loader in `topics.js` with the topic's `words`.
5. The pack in `packs.js`, the three data files in `sw.js`, a `CACHE` bump.
6. `node build/sim-scheduler.mjs` (it simulates every pack) and a section in `e2e.mjs`.

**Replace a photo** — set `file:` on its `LANDMARKS` entry (it is refetched
automatically), adjust the caption if needed, run `fetch-photos.mjs` and
`scan-photos.mjs`, and look at the result: an automatic pick is not a reviewed one.

**Add a question type** — a `kind` in `quiz.js:buildQuestion`, handled in
`app.js:screenQuiz`. Map-answered kinds follow `tap-map` (`enablePicking(true)`,
`mapa.onPick`); typed kinds get the climb-down for free. Decide which facet it belongs to.

**Add a field per place** (population, rivers, …) — emit it from the geo build if it is
derived, or write it in the hints file if it is editorial; carry it through `topics.js`.

**Refresh boundaries** — delete the topic's `data/*.raw.geojson` and rerun its build.
The integrity checks are there to catch an upstream change; if they fire, believe them.

**If a new comarca is ever created**, it arrives in the ICGC data automatically, but
`cat-hints.js` needs a `hook` and an `art`, and `EXPECTED` in `fetch-geo.mjs` needs
updating. The `dissolve()` call is specific to Osona/Lluçanès; the toggle itself is
generic.
