// Turns the two official ICGC layers into SVG paths for the app.
//
//   comarques : analisi.transparenciacatalunya.cat  dataset aasi-gwnd  (43 features,
//               carries nomcomar + capcomar, so names and capitals come straight from
//               the geometry file rather than being retyped)
//   provincies: dataset d2un-hz8w (4 features) — used as its own layer rather than
//               dissolving comarques together, because Cerdanya straddles Girona and
//               Lleida and a dissolve would draw that border in the wrong place.
//
// Run: node build/fetch-geo.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { buildTopology, simplifyTopology } from './topology.mjs';

const SRC = {
  comarques: 'https://analisi.transparenciacatalunya.cat/api/geospatial/aasi-gwnd?method=export&format=GeoJSON',
  provincies: 'https://analisi.transparenciacatalunya.cat/api/geospatial/d2un-hz8w?method=export&format=GeoJSON',
};

const WIDTH = 1000;          // SVG user units across
const TARGET_COMARQUES = 9000; // vertices kept after simplification
const TARGET_PROVINCIES = 2500;
const MIN_RING_AREA = 1.2;   // px² — below this an island is invisible, so drop it

async function load(name) {
  const path = `data/${name}.raw.geojson`;
  if (!existsSync(path)) {
    process.stdout.write(`downloading ${name}… `);
    const res = await fetch(SRC[name]);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    mkdirSync('data', { recursive: true });
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
    console.log('ok');
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

const toRings = (geom) =>
  geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;

function bbox(features) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of features) for (const poly of f.rings) for (const ring of poly) for (const [x, y] of ring) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

// Equirectangular with longitude squeezed by cos(mid-latitude), so Catalunya keeps its
// true proportions without pulling in a projection library.
function makeProjection([x0, y0, x1, y1]) {
  const k = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
  const w = (x1 - x0) * k, h = y1 - y0;
  const s = WIDTH / w;
  return {
    height: +(h * s).toFixed(2),
    project: ([lon, lat]) => [
      +(((lon - x0) * k) * s).toFixed(1),
      +(((y1 - lat)) * s).toFixed(1),
    ],
  };
}

const ringArea = (pts) => {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};

function ringToPoints(ring, arcs) {
  const pts = [];
  for (const { arc, rev } of ring) {
    const a = rev ? [...arcs[arc]].reverse() : arcs[arc];
    for (const p of a) {
      const last = pts[pts.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
    }
  }
  if (pts.length > 1) {
    const f = pts[0], l = pts[pts.length - 1];
    if (f[0] === l[0] && f[1] === l[1]) pts.pop();
  }
  return pts;
}

const toPath = (rings) =>
  rings.map((pts) => `M${pts.map((p) => p.join(' ')).join('L')}Z`).join('');

function centroid(rings) {
  // area-weighted centroid of the largest ring — good enough for placing a marker
  let best = null, bestA = -1;
  for (const pts of rings) {
    const a = ringArea(pts);
    if (a > bestA) { bestA = a; best = pts; }
  }
  let x = 0, y = 0, a = 0;
  for (let i = 0, n = best.length; i < n; i++) {
    const [x1, y1] = best[i], [x2, y2] = best[(i + 1) % n];
    const f = x1 * y2 - x2 * y1;
    a += f; x += (x1 + x2) * f; y += (y1 + y2) * f;
  }
  a *= 3;
  return a ? [+(x / a).toFixed(1), +(y / a).toFixed(1)] : [best[0][0], best[0][1]];
}


/**
 * Best anchor point for a label: the point furthest from the comarca's own boundary
 * ("pole of inaccessibility") rather than the centroid.
 *
 * For these 43 shapes every centroid does land inside its own comarca, so this is not
 * about correctness — it is about room. A centroid can sit close to an edge or in a
 * narrow waist, and the label then crosses the border and reads as belonging to the
 * neighbour. This anchor maximises the clear space around the text.
 *
 * Coarse grid, then a local refinement around the winner. Exact enough for placing text
 * and it runs once at build time.
 */
function labelAnchor(rings) {
  const ring = rings.reduce((a, b) => (ringArea(b) > ringArea(a) ? b : a));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }

  const inside = (px, py) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };

  const edgeDist = (px, py) => {
    let best = Infinity;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      const dx = xj - xi, dy = yj - yi;
      const t = dx || dy ? Math.max(0, Math.min(1, ((px - xi) * dx + (py - yi) * dy) / (dx * dx + dy * dy))) : 0;
      const d = Math.hypot(px - (xi + t * dx), py - (yi + t * dy));
      if (d < best) best = d;
    }
    return best;
  };

  const scan = (ax0, ay0, ax1, ay1, n) => {
    let best = null, bestD = -1;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const px = ax0 + ((ax1 - ax0) * i) / n;
        const py = ay0 + ((ay1 - ay0) * j) / n;
        if (!inside(px, py)) continue;
        const d = edgeDist(px, py);
        if (d > bestD) { bestD = d; best = [px, py]; }
      }
    }
    return { best, bestD };
  };

  let { best, bestD } = scan(x0, y0, x1, y1, 40);
  if (!best) return null;
  const step = Math.max((x1 - x0), (y1 - y0)) / 40;
  const fine = scan(best[0] - step, best[1] - step, best[0] + step, best[1] + step, 12);
  if (fine.best && fine.bestD > bestD) best = fine.best;
  return [+best[0].toFixed(1), +best[1].toFixed(1)];
}

function pointInRings(pt, rings) {
  let inside = false;
  for (const pts of rings) {
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > pt[1]) !== (yj > pt[1]) &&
          pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}


/**
 * Dissolve two adjacent comarques into one outline.
 *
 * Needed for the "42 comarques" mode: Lluçanès was carved out of Osona in 2023, so when
 * it is switched off the border between them has to disappear rather than linger as a
 * stray line through Osona. Because rings are built from shared arcs, the dissolve is
 * "drop the arcs the two have in common, then chain what is left back into rings" — no
 * polygon-clipping library needed.
 *
 * The shared arcs are found by intersecting the two arc *sets*. Counting how often each
 * arc reference appears instead is wrong: an arc can legitimately occur twice inside a
 * single comarca, and dropping those tears the outline into fragments.
 */
function dissolve(shapes, arcs, indexes) {
  const setOf = (i) => {
    const s = new Set();
    for (const poly of shapes[i].rings) for (const ring of poly) for (const r of ring) s.add(r.arc);
    return s;
  };
  const sets = indexes.map(setOf);
  const internal = new Set([...sets[0]].filter((a) => sets.slice(1).every((s) => s.has(a))));

  const segs = [];
  for (const i of indexes)
    for (const poly of shapes[i].rings)
      for (const ring of poly)
        for (const ref of ring)
          if (!internal.has(ref.arc)) segs.push(ref);

  // Endpoints are compared on the same quantised grid the topology uses, never as raw
  // floats: the identical junction comes back as 2.4961408345561957 from one ring and
  // 2.496140834556191 from the other, so exact float equality never joins them.
  const at = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
  const ends = (r) => {
    const a = arcs[r.arc];
    const first = at(a[0]), last = at(a[a.length - 1]);
    return r.rev ? [last, first] : [first, last];
  };

  const pool = new Set(segs.keys());
  const rings = [];

  while (pool.size) {
    const seed = pool.values().next().value;
    pool.delete(seed);
    const chain = [segs[seed]];
    let [head, tail] = ends(segs[seed]);

    for (let grew = true; grew && tail !== head; ) {
      grew = false;
      for (const i of pool) {
        const [a, b] = ends(segs[i]);
        if (a === tail) { chain.push(segs[i]); tail = b; }
        else if (b === tail) { chain.push({ arc: segs[i].arc, rev: !segs[i].rev }); tail = a; }
        else continue;
        pool.delete(i); grew = true; break;
      }
    }
    if (tail === head) rings.push(chain);
  }
  return rings;
}

function processLayer(geo, props, target, projection) {
  const features = geo.features.map((f) => ({ ...props(f.properties), rings: toRings(f.geometry) }));
  const topo = buildTopology(features);
  const simp = simplifyTopology(topo, target);

  let kept = 0, dropped = 0;
  const out = features.map((f, i) => {
    const rings = simp.shapes[i].rings
      .flat()
      .map((ring) => ringToPoints(ring, simp.arcs).map(projection.project))
      .filter((pts) => pts.length >= 3);
    const sorted = rings.map((pts) => ({ pts, a: ringArea(pts) })).sort((p, q) => q.a - p.a);
    const keepRings = sorted.filter((r, idx) => idx === 0 || r.a >= MIN_RING_AREA).map((r) => r.pts);
    dropped += sorted.length - keepRings.length;
    kept += keepRings.reduce((n, r) => n + r.length, 0);
    return { ...f, rings: keepRings };
  });
  return { out, kept, dropped, arcs: simp.arcs.length, topo: simp };
}

// ---------------------------------------------------------------------------------

const comGeo = await load('comarques');
const provGeo = await load('provincies');

const comFeatures = comGeo.features.map((f) => ({ rings: toRings(f.geometry) }));
const projection = makeProjection(bbox(comFeatures));

const com = processLayer(
  comGeo,
  (p) => ({ code: p.codicomar, name: p.nomcomar, capital: p.capcomar }),
  TARGET_COMARQUES, projection);

const prov = processLayer(
  provGeo,
  (p) => ({ code: p.codiprov, name: p.nomprov }),
  TARGET_PROVINCIES, projection);

// Assign each comarca to a província by testing its centroid.
//
// Cerdanya is overridden: it genuinely straddles the border (11 municipalities in
// Girona, 6 in Lleida — area-sampling puts it 54% Lleida), so the centroid test lands
// in Lleida, but its *official* província is Girona. Everything else matches the
// official table, verified against ca.wikipedia: Barcelona 13, Girona 8, Lleida 12,
// Tarragona 10.
const PROVINCIA_OVERRIDE = { Cerdanya: 'Girona' };

for (const c of com.out) {
  c.centroid = centroid(c.rings);
  const hit = prov.out.find((p) => pointInRings(c.centroid, p.rings));
  c.provincia = PROVINCIA_OVERRIDE[c.name] ?? (hit ? hit.name : null);
  // Cerdanya is the only comarca split by a província border; flag it so the app can
  // say so rather than looking wrong to anyone who knows.
  if (c.name === 'Cerdanya') c.provinciaNota = 'a cavall de Girona i Lleida';
}

const EXPECTED = { Barcelona: 13, Girona: 8, Lleida: 12, Tarragona: 10 };

const comarques = com.out.map((c) => {
  const area = c.rings.reduce((n, r) => n + ringArea(r), 0);
  return {
    code: c.code, name: c.name, capital: c.capital, provincia: c.provincia,
    provinciaNota: c.provinciaNota, centroid: c.centroid,
    // anchor for the study-map label, and area so bigger comarques win a collision
    label: labelAnchor(c.rings) || c.centroid,
    area: Math.round(area),
    d: toPath(c.rings),
  };
}).sort((a, b) => a.code.localeCompare(b.code));

const provincies = prov.out.map((p) => ({ code: p.code, name: p.name, d: toPath(p.rings) }));

// Osona with Lluçanès dissolved back in, for the 42-comarca mode.
const iOsona = com.out.findIndex((c) => c.name === 'Osona');
const iLluc = com.out.findIndex((c) => c.name === 'Lluçanès');
const merged = dissolve(com.topo.shapes, com.topo.arcs, [iOsona, iLluc])
  .map((ring) => ringToPoints(ring, com.topo.arcs).map(projection.project))
  .filter((pts) => pts.length >= 3)
  .sort((a, b) => ringArea(b) - ringArea(a));
const OSONA_MERGED = { code: com.out[iOsona].code, d: toPath(merged) };

// The dissolve must conserve area exactly — it only removes a shared border, it does not
// reshape anything. Anything else means the chaining dropped or duplicated a piece.
const areaOf = (rs) => rs.reduce((n, r) => n + ringArea(r), 0);
const wantArea = areaOf(com.out[iOsona].rings) + areaOf(com.out[iLluc].rings);
const gotArea = areaOf(merged);
const drift = Math.abs(gotArea - wantArea) / wantArea;
console.log(`osona+lluçanès dissolved into ${merged.length} ring(s), `
  + `${merged.reduce((n, r) => n + r.length, 0)} pts, area drift ${(drift * 100).toFixed(3)}%`);
if (drift > 0.001) {
  console.error(`!! dissolve lost area: expected ${wantArea.toFixed(1)}, got ${gotArea.toFixed(1)}`);
  process.exitCode = 1;
}

mkdirSync('docs', { recursive: true });
writeFileSync('docs/geo.js',
  `// GENERATED by build/fetch-geo.mjs — do not edit.\n` +
  `// Source: ICGC via analisi.transparenciacatalunya.cat (comarques aasi-gwnd, provincies d2un-hz8w)\n` +
  `export const VIEWBOX = "0 0 ${WIDTH} ${projection.height}";\n` +
  `export const COMARQUES = ${JSON.stringify(comarques)};\n` +
  `export const PROVINCIES = ${JSON.stringify(provincies)};\n` +
  `// Osona with Lluçanès dissolved in, used when the app runs in 42-comarca mode.\n` +
  `export const OSONA_MERGED = ${JSON.stringify(OSONA_MERGED)};\n`);

const size = readFileSync('docs/geo.js').length;
console.log(`
comarques   ${com.out.length} features, ${com.arcs} arcs, ${com.kept} pts kept, ${com.dropped} tiny rings dropped
provincies  ${prov.out.length} features, ${prov.arcs} arcs, ${prov.kept} pts kept, ${prov.dropped} tiny rings dropped
viewBox     0 0 ${WIDTH} ${projection.height}
written     docs/geo.js  (${(size / 1024).toFixed(0)} KB)`);

let bad = 0;
for (const c of comarques) {
  const rings = com.out.find((x) => x.code === c.code).rings;
  if (!pointInRings(c.label, rings)) {
    console.warn(`!! ${c.name}: label anchor falls outside the comarca`); bad++;
  }
  if (!c.capital) { console.warn(`!! ${c.name} has no capital`); bad++; }
  if (!c.provincia) { console.warn(`!! ${c.name} has no província`); bad++; }
}
if (comarques.length !== 43) { console.warn(`!! expected 43 comarques, got ${comarques.length}`); bad++; }

const counts = {};
for (const c of comarques) counts[c.provincia] = (counts[c.provincia] || 0) + 1;
for (const [p, n] of Object.entries(EXPECTED)) {
  const got = counts[p] || 0;
  if (got !== n) { console.warn(`!! ${p}: expected ${n} comarques, got ${got}`); bad++; }
}
console.log(bad ? `\n${bad} problem(s) above` : '\nchecks passed: 43 comarques, all with capital + província, counts match the official table');
