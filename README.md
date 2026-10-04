# Estudia geografia — study app

A small offline web app for school geography, organised in **content packs**: the
learner picks one on the first screen (*Comarques i capitals*, *Comarques*, *Unió
Europea*), each with
its own progress, and can switch with *Packs de contingut* in the header. Install it on a phone from
**https://cristianllamas.github.io/comarques/** (Chrome → *Afegeix a la pantalla d'inici*).

## How it works

Each session is two phases:

1. **Repàs** — six cards showing the comarca, its capital, a memory hook and a photo,
   with the comarca lit up on the map. No input required.
2. **Recorda** — twelve questions. Four types: tap the comarca on a blank map, name a
   highlighted shape, give a comarca's capital, and name the comarca from its capital.

The two phases work on **different** comarques. Testing what was just shown measures
short-term memory more than it builds long-term memory; what he studies now comes back
for testing in a later session, which the scheduler arranges by itself.

There is also a third mode, **Mira el mapa**: the whole map with the comarca and capital
written on each shape, for studying at his own pace. All 43 names cannot fit on a phone
at once, so labels are placed largest-comarca-first and anything that would collide is
dropped — zoom in and the rest appear. Where a full label will not fit, the comarca name
is shown on its own rather than nothing. Browsing here deliberately does not feed the
scheduler: looking is not retrieval, and counting it would inflate "dominades".

Typed answers come first because producing an answer is what makes retrieval practice
work. A wrong answer is not a dead end — it climbs down through a hint, then the first
letter, then four options, so the effort is always made but never ends in failure.

Scheduling is **Leitner with short boxes** (20 min → 2 h → 8 h → 1 day → 2 days → 4 days
→ 8 days), not SM-2 or FSRS: those optimise six-month retention and would show most
places once in the week or two before a school exam. New items are introduced in a
shuffled order (saved, so it does not change between visits), and a session never shows
the same place twice.

**Study 3–4 times a day.** `node build/sim-scheduler.mjs` simulates a week for every
pack: for *Comarques i capitals*, two sessions a day do not cover the material and three
just do; *Comarques* (half the items) is covered comfortably at two.

## Adding photos

Drop image files into `photos/<topic>/` (e.g. `photos/cat/`) and run
`node build/scan-photos.mjs cat`. The filename can be
the capital or the comarca, and accents, capitals, apostrophes, articles and hyphens are
all ignored (`Berga.jpg`, `la-seu-durgell.jpg`, `Alt Empordà.png` all work). Originals are
left alone; resized copies go to `docs/img/cat/`. Capitals without a photo simply
render as text. See `photos/README.md`.

## 42 or 43 comarques?

Lluçanès was split off from Osona in 2023. Textbooks printed before then list 42
(41 comarques + Aran). The app ships in **42 mode**, with Lluçanès dissolved back into
Osona — geometry included, so no stray border is left behind. Turn it on in *Opcions* if
his syllabus includes it.

## Changing it later

See **[ARCHITECTURE.md](ARCHITECTURE.md)** — module map, the reasoning behind the
non-obvious decisions, and the traps that cost real debugging time (detached `getBBox`,
float coordinate comparison, cache-first service worker). `CLAUDE.md` is the short version
for AI coding sessions.

## Building

```bash
node build/fetch-geo.mjs      # official ICGC boundaries -> docs/data/cat-geo.js
node build/fetch-geo-ue.mjs   # Eurostat GISCO countries -> docs/data/ue-geo.js
node build/fetch-hints.mjs    # Catalan Wikipedia intros -> data/hints.raw.md (raw material)
node build/scan-photos.mjs cat  # photos/cat/ -> docs/img/cat/ + docs/data/cat-photos.js
```

`docs/data/cat-hints.js` is hand-written and not generated — `fetch-hints.mjs` only produces the
source material to write from.

### Checks

```bash
node build/sim-scheduler.mjs  # simulates a week per pack; asserts coverage, no place twice a session
node build/e2e.mjs            # drives the real app in headless Chrome; SHOTS=1 for screenshots
```

## Data

Boundaries are the official ICGC layers via
[Dades Obertes de Catalunya](https://analisi.transparenciacatalunya.cat) — comarques
`aasi-gwnd` (which carries the capitals) and províncies `d2un-hz8w`. The províncies layer
is used directly rather than dissolving comarques, because **Cerdanya straddles Girona
and Lleida** and a dissolve would put that border in the wrong place.

The 25 MB source is reduced to ~9k vertices by topology-aware simplification
(`build/topology.mjs`): rings are cut into shared arcs, each arc is simplified once, and
neighbouring comarques therefore keep identical borders with no gaps.
