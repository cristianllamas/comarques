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
  return { out, kept, dropped, arcs: simp.arcs.length };
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

const comarques = com.out.map((c) => ({
  code: c.code, name: c.name, capital: c.capital, provincia: c.provincia,
  provinciaNota: c.provinciaNota, centroid: c.centroid, d: toPath(c.rings),
})).sort((a, b) => a.code.localeCompare(b.code));

const provincies = prov.out.map((p) => ({ code: p.code, name: p.name, d: toPath(p.rings) }));

mkdirSync('docs', { recursive: true });
writeFileSync('docs/geo.js',
  `// GENERATED by build/fetch-geo.mjs — do not edit.\n` +
  `// Source: ICGC via analisi.transparenciacatalunya.cat (comarques aasi-gwnd, provincies d2un-hz8w)\n` +
  `export const VIEWBOX = "0 0 ${WIDTH} ${projection.height}";\n` +
  `export const COMARQUES = ${JSON.stringify(comarques)};\n` +
  `export const PROVINCIES = ${JSON.stringify(provincies)};\n`);

const size = readFileSync('docs/geo.js').length;
console.log(`
comarques   ${com.out.length} features, ${com.arcs} arcs, ${com.kept} pts kept, ${com.dropped} tiny rings dropped
provincies  ${prov.out.length} features, ${prov.arcs} arcs, ${prov.kept} pts kept, ${prov.dropped} tiny rings dropped
viewBox     0 0 ${WIDTH} ${projection.height}
written     docs/geo.js  (${(size / 1024).toFixed(0)} KB)`);

let bad = 0;
for (const c of comarques) {
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
