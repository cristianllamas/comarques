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
import { load, toRings, bbox, ringArea, ringToPoints, toPath, centroid, labelAnchor,
  pointInRings, dissolve, processLayer } from './geo-lib.mjs';

const SRC = {
  comarques: 'https://analisi.transparenciacatalunya.cat/api/geospatial/aasi-gwnd?method=export&format=GeoJSON',
  provincies: 'https://analisi.transparenciacatalunya.cat/api/geospatial/d2un-hz8w?method=export&format=GeoJSON',
};

const WIDTH = 1000;          // SVG user units across
const TARGET_COMARQUES = 9000; // vertices kept after simplification
const TARGET_PROVINCIES = 2500;

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


// ---------------------------------------------------------------------------------

const comGeo = await load('comarques', SRC.comarques);
const provGeo = await load('provincies', SRC.provincies);

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

mkdirSync('docs/data', { recursive: true });
writeFileSync('docs/data/cat-geo.js',
  `// GENERATED by build/fetch-geo.mjs — do not edit.\n` +
  `// Source: ICGC via analisi.transparenciacatalunya.cat (comarques aasi-gwnd, provincies d2un-hz8w)\n` +
  `export const VIEWBOX = "0 0 ${WIDTH} ${projection.height}";\n` +
  `export const COMARQUES = ${JSON.stringify(comarques)};\n` +
  `export const PROVINCIES = ${JSON.stringify(provincies)};\n` +
  `// Osona with Lluçanès dissolved in, used when the app runs in 42-comarca mode.\n` +
  `export const OSONA_MERGED = ${JSON.stringify(OSONA_MERGED)};\n`);

const size = readFileSync('docs/data/cat-geo.js').length;
console.log(`
comarques   ${com.out.length} features, ${com.arcs} arcs, ${com.kept} pts kept, ${com.dropped} tiny rings dropped
provincies  ${prov.out.length} features, ${prov.arcs} arcs, ${prov.kept} pts kept, ${prov.dropped} tiny rings dropped
viewBox     0 0 ${WIDTH} ${projection.height}
written     docs/data/cat-geo.js  (${(size / 1024).toFixed(0)} KB)`);

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
