# Comarques — study app

A small offline web app for learning the comarques of Catalunya and their capitals,
built for a geography exam. Install it on a phone from
**https://cristianllamas.github.io/comarques/** (Chrome → *Afegeix a la pantalla d'inici*).

## How it works

Each session is two phases:

1. **Repàs** — six cards showing the comarca, its capital, a memory hook and a photo,
   with the comarca lit up on the map. No input required.
2. **Recorda** — twelve questions. Four types: tap the comarca on a blank map, name a
   highlighted shape, give a comarca's capital, and name the comarca from its capital.

Typed answers come first because producing an answer is what makes retrieval practice
work. A wrong answer is not a dead end — it climbs down through a hint, then the first
letter, then four options, so the effort is always made but never ends in failure.

Scheduling is **Leitner with intervals compressed to the exam window** (20 min → 2 h →
8 h → 1 day → 2 days), not SM-2 or FSRS: those optimise six-month retention and would
show most comarques once before the exam. Set the exam date in *Opcions* and nothing
will ever be scheduled to reappear after it.

**Study 3–4 times a day.** `node build/sim-scheduler.mjs` simulates the week: at two
sessions a day the material is not covered, at three it just is, and at six about 80% of
it ends up solid.

## Adding photos

Drop image files into `photos/` and run `node build/scan-photos.mjs`. The filename can be
the capital or the comarca, and accents, capitals, apostrophes, articles and hyphens are
all ignored (`Berga.jpg`, `la-seu-durgell.jpg`, `Alt Empordà.png` all work). Originals are
left alone; resized copies go to `docs/img/capitals/`. Capitals without a photo simply
render as text. See `photos/README.md`.

## 42 or 43 comarques?

Lluçanès was split off from Osona in 2023. Textbooks printed before then list 42
(41 comarques + Aran). The app ships in **42 mode**, with Lluçanès dissolved back into
Osona — geometry included, so no stray border is left behind. Turn it on in *Opcions* if
his syllabus includes it.

## Building

```bash
node build/fetch-geo.mjs      # official ICGC boundaries -> docs/geo.js
node build/fetch-hints.mjs    # Catalan Wikipedia intros -> data/hints.raw.md (raw material)
node build/scan-photos.mjs    # photos/ -> docs/img/capitals/ + docs/photos.js
```

`docs/hints.js` is hand-written and not generated — `fetch-hints.mjs` only produces the
source material to write from.

### Checks

```bash
node build/sim-scheduler.mjs  # simulates a week; asserts coverage and no post-exam scheduling
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
