// Turns Eurostat GISCO layers into SVG paths for the "Comunitats autònomes" pack.
//
//   regions : NUTS 2024 level 2 at 1:1M — in Spain, level 2 is exactly the 17 comunitats
//             plus the ciutats autònomes of Ceuta and Melilla
//   context : NUTS level 0 for Portugal and France (same dataset, so their borders with
//             Spain share vertices and weld), and the GISCO countries layer for Andorra,
//             Gibraltar, Morocco and Algeria
//
// The projection is the comarques one (equirectangular, longitude scaled by the cosine of
// the mid-latitude), not the EU's EPSG:3035: centred on 52°N 10°E, that one draws Spain
// visibly tilted.
//
// Canàries are drawn in an inset at the bottom left, the usual convention: their real
// position (some 1,000 km south-west) would leave most of the map empty sea. They are
// shifted as a block, so their shape and scale are untouched.
//
// Run: node build/fetch-geo-esp.mjs

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { load, toRings, bbox, ringArea, toPath, centroid, labelAnchor, pointInRings, processLayer,
  clipRing } from './geo-lib.mjs';
import { HINTS } from '../docs/data/esp-hints.js';

const GISCO = 'https://gisco-services.ec.europa.eu/distribution/v2';
const SRC = {
  nuts2: `${GISCO}/nuts/geojson/NUTS_RG_01M_2024_4326_LEVL_2.geojson`,
  nuts0: `${GISCO}/nuts/geojson/NUTS_RG_01M_2024_4326_LEVL_0.geojson`,
  countries: `${GISCO}/countries/geojson/CNTR_RG_03M_2024_4326.geojson`,
};
const OUT = 'docs/data/esp-geo.js';

const WIDTH = 1000;          // SVG user units across
const TARGET = 9000;         // vertices kept after simplification
const MIN_RING_AREA = 1.5;   // units² — below this an island is invisible, so drop it
const SMALL = 400;           // units² — places smaller than this get a tap ring
const CANARIES = 'ES70';
const CONTEXT_NUTS = ['PT', 'FR'];
const CONTEXT_CNTR = ['AD', 'GI', 'MA', 'DZ'];

const [nuts2, nuts0, cntr] = await Promise.all([
  load('esp-nuts2', SRC.nuts2), load('esp-nuts0', SRC.nuts0), load('esp-countries', SRC.countries),
]);

const regions = nuts2.features.filter((f) => f.properties.CNTR_CODE === 'ES')
  .map((f) => ({ code: f.properties.NUTS_ID, polys: toRings(f.geometry) }));

// Inset: move Canàries so their bounding box sits in the sea west of the Strait,
// below Portugal. The offset is in degrees and applied to every vertex alike.
const can = regions.find((r) => r.code === CANARIES);
const [cx0, cy0] = bbox([{ rings: can.polys }]);
const main = regions.filter((r) => r.code !== CANARIES);
const [mx0, my0] = bbox(main.map((r) => ({ rings: r.polys })));
const INSET_LEFT = mx0 - 1.2, INSET_BOTTOM = my0 - 1.3;   // degrees
const dx = INSET_LEFT - cx0, dy = INSET_BOTTOM - cy0;
can.polys = can.polys.map((poly) => poly.map((ring) => ring.map(([x, y]) => [x + dx, y + dy])));
const [ix0, iy0, ix1, iy1] = bbox([{ rings: can.polys }]);

// Frame: everything Spanish, inset included, with a little sea around it.
const [fx0, fy0, fx1, fy1] = bbox(regions.map((r) => ({ rings: r.polys })));
const m = 0.03 * (fx1 - fx0);
const FRAME = [fx0 - m, fy0 - m, fx1 + m, fy1 + m];
const WINDOW = [FRAME[0] - 2 * m, FRAME[1] - 2 * m, FRAME[2] + 2 * m, FRAME[3] + 2 * m];

const clipPolys = (polys) => polys
  .map((poly) => poly.map((r) => clipRing(r, WINDOW)).filter(Boolean))
  .filter((poly) => poly.length);
const context = [
  ...nuts0.features.filter((f) => CONTEXT_NUTS.includes(f.properties.CNTR_CODE)),
  ...cntr.features.filter((f) => CONTEXT_CNTR.includes(f.properties.CNTR_ID)),
].map((f) => ({ code: `ctx-${f.properties.NUTS_ID || f.properties.CNTR_ID}`, polys: clipPolys(toRings(f.geometry)) }))
  .filter((c) => c.polys.length);

// Equirectangular, longitude squeezed by cos(mid-latitude) of the peninsula.
const k = Math.cos(((my0 + fy1) / 2) * Math.PI / 180);
const s = WIDTH / ((FRAME[2] - FRAME[0]) * k);
const height = +((FRAME[3] - FRAME[1]) * s).toFixed(2);
const project = ([x, y]) => [+((x - FRAME[0]) * k * s).toFixed(1), +((FRAME[3] - y) * s).toFixed(1)];

const all = [...regions.map((r) => ({ ...r, member: true })), ...context];
const layer = processLayer(
  { features: all.map((c) => ({ properties: c, geometry: { type: 'MultiPolygon', coordinates: c.polys } })) },
  (p) => ({ code: p.code, member: !!p.member }),
  TARGET, { project }, MIN_RING_AREA);

const places = layer.out.filter((c) => c.member).map((c) => {
  const area = Math.round(c.rings.reduce((n, r) => n + ringArea(r), 0));
  const ctr = centroid(c.rings);
  const label = labelAnchor(c.rings) || ctr;
  return { code: c.code, centroid: ctr, label, area, d: toPath(c.rings), ...(area < SMALL ? { mark: label } : {}) };
}).sort((a, b) => a.code.localeCompare(b.code));

// The inset's frame, in SVG units, with some sea around the islands.
const [ax, ay] = project([ix0, iy1]), [bx, by] = project([ix1, iy0]);
const pad = 12;
const INSET = { x: +(ax - pad).toFixed(1), y: +(ay - pad).toFixed(1),
  w: +(bx - ax + 2 * pad).toFixed(1), h: +(by - ay + 2 * pad).toFixed(1) };

mkdirSync('docs/data', { recursive: true });
writeFileSync(OUT,
  `// GENERATED by build/fetch-geo-esp.mjs — do not edit.\n` +
  `// Source: Eurostat GISCO, NUTS 2024 level 2 (1:1M) and countries (1:3M). Names: esp-hints.js\n` +
  `export const VIEWBOX = "0 0 ${WIDTH} ${height}";\n` +
  `export const REGIONS = ${JSON.stringify(places)};\n` +
  `// Portugal, France, Andorra, Gibraltar, Morocco, Algeria: one untappable path.\n` +
  `export const CONTEXT = ${JSON.stringify(layer.out.filter((c) => !c.member).map((c) => toPath(c.rings)).join(''))};\n` +
  `// Canàries are drawn shifted into this box (SVG units), not at their real position.\n` +
  `export const INSET = ${JSON.stringify(INSET)};\n`);

const size = readFileSync(OUT).length;
console.log(`
regions     ${places.length}
context     ${layer.out.length - places.length} (${context.map((c) => c.code.slice(4)).join(', ')})
geometry    ${layer.arcs} arcs, ${layer.kept} pts kept, ${layer.dropped} tiny rings dropped
viewBox     0 0 ${WIDTH} ${height}
inset       ${JSON.stringify(INSET)}
small       ${places.filter((c) => c.mark).map((c) => `${c.code} (${c.area})`).join(', ')}
written     ${OUT}  (${(size / 1024).toFixed(0)} KB)`);

let bad = 0;
if (places.length !== 19) { console.warn(`!! expected 17 comunitats + 2 ciutats autònomes, got ${places.length}`); bad++; }
const codes = new Set(places.map((c) => c.code));
for (const c of places) {
  const h = HINTS[c.code];
  if (!h?.name || !h?.art || h.capital === undefined) { console.warn(`!! ${c.code}: missing name/capital/art in esp-hints.js`); bad++; }
  const rings = layer.out.find((x) => x.code === c.code).rings;
  if (!rings.length) { console.warn(`!! ${c.code}: no geometry left after simplification`); bad++; }
  else if (!pointInRings(c.label, rings)) { console.warn(`!! ${c.code}: label anchor falls outside the region`); bad++; }
}
for (const code of Object.keys(HINTS)) if (!codes.has(code)) { console.warn(`!! ${code} is in esp-hints.js but not in the geometry`); bad++; }
const withCapital = places.filter((c) => HINTS[c.code]?.capital).length;
if (withCapital !== 17) { console.warn(`!! expected 17 places with a capital (all but Ceuta and Melilla), got ${withCapital}`); bad++; }
if (bad) process.exitCode = 1;
console.log(bad ? `\n${bad} problem(s) above` : '\nchecks passed: 17 comunitats + Ceuta and Melilla, all named, 17 capitals');
