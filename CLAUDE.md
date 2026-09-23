# CLAUDE.md

Study app for the comarques of Catalunya. Built for a specific deadline; correctness of
the content matters more than polish.

**Read `ARCHITECTURE.md` before changing anything.** It records why several
non-obvious things are the way they are, and most of those entries were paid for with a
bug. In particular, do not "simplify" the scheduler's urgency formula, the arc-cutting
rule, or the deferred `afterRender` map focus without reading the corresponding entry.

## Ground rules

- **No dependencies.** No framework, no bundler, no npm packages at build or runtime.
  Plain ES modules that run by opening the page. Keep it that way.
- **`docs/` is the published site** (GitHub Pages serves `/docs` on `main`). Pushing to
  `main` deploys. There is no staging.
- **`docs/geo.js` and `docs/photos.js` are generated.** Edit the scripts in `build/`, not
  the output. `docs/hints.js` is hand-written and *is* the right place for editorial
  content.
- **Catalan throughout** for anything user-facing. Comarca articles are irregular
  (*l'Alt Camp*, *el Berguedà*, *la Selva*, *les Garrigues*, and *Osona* takes none) and
  live in the `art` field in `hints.js` — never derive them from the name.
- **Bump `CACHE` in `docs/sw.js`** whenever a shipped file changes, or installed clients
  keep serving the old build.

## Before saying something works

```bash
node build/sim-scheduler.mjs   # scheduler coverage over a simulated week
node build/e2e.mjs             # real Chrome, full session, fails on any console error
```

Both are fast and need no setup beyond `google-chrome` and `python3`. `SHOTS=1` on the
e2e writes screenshots to `/tmp/e2e-*.png` — worth looking at, since two real bugs (a
blank map, clipped labels) were invisible in code and obvious in a screenshot.

To check what is actually deployed rather than what is local:

```bash
URL=https://cristianllamas.github.io/comarques/ node build/e2e.mjs
```

## Content accuracy

This teaches a child facts for an exam, so wrong data is worse than a missing feature.
The build asserts 43 comarques, every one with a capital and a província, and the
per-província counts against the official table. If those fire, investigate rather than
adjust the expectation.

Two known subtleties, both handled — see `ARCHITECTURE.md`: Cerdanya straddles two
províncies, and Lluçanès only exists as a comarca since 2023 (the app ships in 42-comarca
mode with it dissolved back into Osona).
