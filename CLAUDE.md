# CLAUDE.md

Geography study app ("Estudia geografia"): content packs for the comarques of
Catalunya (with or without capitals), the comunitats autònomes of Spain, the EU member
states, the countries of Àfrica, Amèrica (North and Central / South) and Àsia, all with
their capitals, and the oceans and seas. Correctness of the content matters
more than polish.

`README.md` describes the app from the learner's side, screen by screen.
**Read `ARCHITECTURE.md` before changing anything.** It records why several
non-obvious things are the way they are, and most of those entries were paid for with a
bug. In particular, do not "simplify" the scheduler's urgency formula, the arc-cutting
rule, or the deferred `afterRender` map focus without reading the corresponding entry.

## Ground rules

- **No dependencies.** No framework, no bundler, no npm packages at build or runtime.
  Plain ES modules that run by opening the page. Keep it that way.
- **`docs/` is the published site** (GitHub Pages serves `/docs` on `main`). Pushing to
  `main` deploys. There is no staging.
- **`docs/data/*-geo.js` and `docs/data/*-photos.js` are generated.** Edit the scripts in
  `build/`, not the output. `docs/data/*-hints.js` are hand-written and *are* the right
  place for editorial content.
- **Catalan throughout** for anything user-facing. Comarca articles are irregular
  (*l'Alt Camp*, *el Berguedà*, *la Selva*, *les Garrigues*, and *Osona* takes none) and
  live in the `art` field in the hints file — never derive them from the name.
- **Bump `CACHE` in `docs/sw.js`** whenever a shipped file changes, or installed clients
  keep serving the old build.
- **Content is reviewed by the owner before it ships** — names, capitals, hooks and every
  photo (via a contact sheet). Work on a branch; `main` deploys.

## Before saying something works

```bash
node build/sim-scheduler.mjs   # scheduler coverage over a simulated week
node build/e2e.mjs             # real Chrome, full session, fails on any console error
```

Both are fast and need no setup beyond `google-chrome` and `python3`. `SHOTS=1` on the
e2e writes screenshots to `/tmp/e2e-*.png` — worth looking at, since two real bugs (a
blank map, clipped labels) were invisible in code and obvious in a screenshot.
`SHOTS=screenshots` regenerates the README's screenshots after a UI change.

To check what is actually deployed rather than what is local:

```bash
URL=https://cristianllamas.github.io/comarques/ node build/e2e.mjs
```

A push to `main` has once failed to start a Pages build at all: check that
`gh api repos/cristianllamas/comarques/pages/builds/latest` names your commit before
testing the live site (and see the Traps in `ARCHITECTURE.md` if it does not).

## Content accuracy

This teaches children facts for school exams, so wrong data is worse than a missing
feature.
The build asserts 43 comarques, every one with a capital and a província, and the
per-província counts against the official table. If those fire, investigate rather than
adjust the expectation.

For the EU, `build/fetch-geo-ue.mjs` asserts 27 member states (from GISCO's `EU_STAT`
flag) and that each one has a Catalan name, capital and article in `ue-hints.js`;
`build/fetch-geo-esp.mjs` asserts 17 comunitats + Ceuta and Melilla, 17 with a capital.
`build/fetch-geo-mon.mjs` asserts the place count per continent (Àfrica 55, Amèrica del
Nord 25, del Sud 13, Àsia 51) and that each has a hints entry; `build/fetch-geo-mar.mjs`
asserts 5 oceans, every sea, and that each sea's `ocea` matches the IHO grouping.

Two known subtleties, both handled — see `ARCHITECTURE.md`: Cerdanya straddles two
províncies, and Lluçanès only exists as a comarca since 2023 (the app ships in 42-comarca
mode with it dissolved back into Osona).
