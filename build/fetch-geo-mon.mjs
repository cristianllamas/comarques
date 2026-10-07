// Turns the Eurostat GISCO world countries layer into one continent map per topic:
//
//   afr  Àfrica                     54 states + the Sàhara Occidental
//   amn  Amèrica del Nord i Central 23 states + Groenlàndia and Puerto Rico
//   ams  Amèrica del Sud            12 states + the Guaiana Francesa
//   asi  Àsia                       49 states + Palestina and Taiwan, Rússia whole, Egipte
//
//   source: gisco-services.ec.europa.eu, CNTR_RG_10M_2024_4326 — every country at 1:10M
//           in longitude/latitude. Each continent is projected here, to metres, with an
//           equal-area projection centred on it (`proj` in TOPICS), and from then on the
//           build is the EU's: one topology for the places and the grey context around
//           them, the context clipped just outside the frame.
//
// The hand-written docs/data/<topic>-hints.js decides which places a topic has; the
// build refuses to run if a place in it has no geometry or lacks a name, capital or
// article, and asserts the expected count.
//
// Three adjustments to GISCO, each because a school map draws it differently:
//   - SPLIT: places GISCO folds into another country — Taiwan (inside CN) and the
//     Guaiana Francesa (inside FR) — are cut out by location.
//   - ADMIN: GISCO draws disputed areas as separate features, which would leave holes in
//     India or China. Each is drawn as part of the country that administers it (Caixmir
//     indià and Arunachal Pradesh with India, Aksai Chin with China…) and dissolved in,
//     so no internal line remains; the cards mention the disputes that matter.
//   - KEEP: far-off parts of a place (Hawaii, Easter Island, the Prince Edward Islands)
//     would stretch the frame over empty ocean, so each topic keeps only the polygons
//     whose centre falls inside its region. What is dropped is said on the card.
//
// Run: node build/fetch-geo-mon.mjs afr      (or amn, ams, asi; no argument: all four)

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { load, toRings, bbox, ringArea, ringToPoints, toPath, centroid, labelAnchor, pointInRings,
  processLayer, clipRing, dissolveMany, polyCentre, relLon, laea, albers } from './geo-lib.mjs';

const URL = 'https://gisco-services.ec.europa.eu/distribution/v2/countries/geojson/CNTR_RG_10M_2024_4326.geojson';

const WIDTH = 1000;            // SVG user units across
const MIN_RING_AREA = 1.2;     // units² — below this an island is invisible, so drop it
const SMALL = 400;             // units² — places smaller than this get a tap ring
const RING = 11;               // tap-ring radius, shrunk where rings would overlap (Antilles)

// Disputed areas GISCO draws separately, given to the country that administers them.
const ADMIN = {
  XH: 'IN',   // Jammu and Kashmir (Indian-administered)
  XD: 'IN',   // Arunachal Pradesh
  XC: 'CN',   // Aksai Chin
  HK: 'CN', MO: 'CN',   // Hong Kong and Macau: special administrative regions of China
  XI: 'RU',   // southern Kuril Islands
  XF: 'EG',   // Hala'ib Triangle
  XG: 'KE',   // Ilemi Triangle
  XXW: 'BZ', XXT: 'BZ',  // Belize–Guatemala claim, Sapodilla Cayes
  XXY: 'GY',  // Essequibo, claimed by Venezuela
};

const box = (x0, y0, x1, y1) => ([lon, lat]) => lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1;
const SPLIT = {
  // Taiwan, Penghu and the small islands off the east coast. The Fujian islands to the
  // north-west (Pingtan, Nanri) are the PRC's and fall outside.
  TW: { from: 'CN', test: ([lon, lat]) => box(119.2, 21.5, 122.5, 25.35)([lon, lat]) && !(lat > 24 && lon < 120.3) },
  GF: { from: 'FR', test: box(-55, 1.5, -51, 6.5) },
};

// roi: [west, south, east, north] — longitudes relative to lon0 — where context is taken from.
/**
 * The two sides of GISCO's antimeridian cut do not share a single vertex (Russia: 28
 * latitudes on one side, 51 on the other, none equal), so the topology cannot weld them
 * and the cut stays visible. Give every seam edge, on both sides, the union of the seam
 * latitudes: then the two sides are the same arc and dissolve away.
 */
function weldSeam(polys) {
  const lats = new Set();
  for (const poly of polys) for (const r of poly) for (const [lon, lat] of r) if (Math.abs(lon) === 180) lats.add(lat);
  if (!lats.size) return polys;
  const all = [...lats].sort((a, b) => a - b);
  return polys.map((poly) => poly.map((r) => {
    const out = [r[0]];
    for (let i = 1; i < r.length; i++) {
      const [a, b] = [r[i - 1], r[i]];
      if (Math.abs(a[0]) === 180 && a[0] === b[0]) {
        const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
        const mid = all.filter((y) => y > lo && y < hi);
        if (a[1] > b[1]) mid.reverse();
        for (const y of mid) out.push([a[0], y]);
      }
      out.push(b);
    }
    return out;
  }));
}

const TOPICS = {
  afr: {
    count: 55, proj: laea(17, 2), lon0: 17, target: 13000,
    // Cap Verd to Rodrigues (Maurici); leaves out the Prince Edward Islands (Sud-àfrica).
    keep: box(-26, -37, 64, 38),
    roi: [-60, -45, 60, 50],
  },
  amn: {
    count: 25, proj: albers(-96, 20, 60, 40), lon0: -96, target: 14000,
    // Leaves out Hawaii and the far end of the Aleutians, across the antimeridian.
    keep: ([lon, lat]) => lon >= -172 && lon <= -10 && lat >= 5 && !(lon < -150 && lat < 30),
    roi: [-90, -5, 95, 90],
  },
  ams: {
    count: 13, proj: laea(-62, -18), lon0: -62, target: 11000,
    // Galápagos are in; Easter Island (Xile) and Trindade (Brasil) are not.
    keep: box(-92, -57, -30, 13.5),
    roi: [-50, -62, 45, 25],
  },
  asi: {
    count: 51, proj: albers(95, 15, 60, 40), lon0: 95, target: 16000,
    // Every part of Rússia (Kaliningrad to Chukotka), Turquia and Egipte; relative to
    // lon0, so the far side of the antimeridian counts as east.
    keep: ([lon, lat]) => relLon(lon, 95) >= -80 && relLon(lon, 95) <= 100 && lat >= -12,
    roi: [-100, -25, 115, 90],
  },
};

const geo = await load('mon-countries', URL);
const asked = process.argv[2] ? [process.argv[2]] : Object.keys(TOPICS);
let bad = 0;

for (const id of asked) {
  const T = TOPICS[id];
  if (!T) { console.error(`unknown topic ${id}: one of ${Object.keys(TOPICS).join(', ')}`); process.exit(2); }
  bad += await build(id, T);
}
if (bad) process.exitCode = 1;

async function build(id, T) {
  const { HINTS } = await import(`../docs/data/${id}-hints.js`);
  const OUT = `docs/data/${id}-geo.js`;
  const codes = new Set(Object.keys(HINTS));

  // 1. Polygons per (possibly re-assigned) country code, in degrees.
  const parts = [];   // { code, group, polys }   group = the place it belongs to, or null
  for (const f of geo.features) {
    const src = f.properties.CNTR_ID;
    // GISCO's cut sits at ±179.99998°, not ±180: snap it, so both sides of the seam
    // project to the same points and weld.
    const polys = weldSeam(toRings(f.geometry).map((poly) => poly.map((r) => r.map(([lon, lat]) =>
      [Math.abs(lon) > 179.9999 ? Math.sign(lon) * 180 : lon, lat]))));
    const split = Object.entries(SPLIT).filter(([, s]) => s.from === src);
    const rest = [];
    for (const poly of polys) {
      const hit = split.find(([, s]) => s.test(polyCentre(poly)));
      if (hit) parts.push({ code: hit[0], polys: [poly] });
      else rest.push(poly);
    }
    parts.push({ code: src, polys: rest });
  }

  // 2. What is a place, what is context. A disputed area joins its administrator's
  //    group when that administrator is a place here.
  // Context comes from a region around the continent (longitudes relative to its
  // centre). A polygon that crosses the far-side meridian would wrap across the whole
  // map once projected, so it is left out; nothing that close to the frame does.
  const inRoi = (poly) => {
    const [x0, y0, x1, y1] = T.roi;
    const ls = poly[0].map(([lon]) => relLon(lon, T.lon0));
    for (let i = 1; i < ls.length; i++) if (Math.abs(ls[i] - ls[i - 1]) > 180) return false;
    return poly[0].some(([, lat], i) => ls[i] >= x0 && ls[i] <= x1 && lat >= y0 && lat <= y1);
  };
  const merged = new Map();   // code -> polys
  for (const p of parts) {
    if (!p.polys.length) continue;
    merged.set(p.code, [...(merged.get(p.code) || []), ...p.polys]);
  }
  const places = [], context = [];
  for (const [code, polys] of merged) {
    const group = codes.has(code) ? code : (codes.has(ADMIN[code]) ? ADMIN[code] : null);
    const kept = group ? polys.filter((poly) => T.keep(polyCentre(poly, T.lon0))) : [];
    const ctx = polys.filter((poly) => !kept.includes(poly) && inRoi(poly));
    // GISCO cuts Russia (and Alaska's Aleutians) at the 180° meridian. Pieces of one
    // country drawn as one shape would show that cut as a line across Chukotka, so a
    // country touching it enters the topology one polygon at a time and is dissolved.
    const seam = kept.some((poly) => poly[0].some(([lon]) => Math.abs(lon) === 180));
    if (seam) kept.forEach((poly, i) => places.push({ code: `${code}#${i}`, group, polys: [poly] }));
    else if (kept.length) places.push({ code, group, polys: kept });
    if (ctx.length) context.push({ code: `ctx-${code}`, polys: ctx });
  }

  // 3. Project to metres; frame = the places plus a little sea; clip the context to a
  //    window slightly larger, so its cut edges are never visible.
  const proj = (polys) => polys.map((poly) => poly.map((r) => r.map(T.proj)));
  for (const p of [...places, ...context]) p.polys = proj(p.polys);
  const [ex0, ey0, ex1, ey1] = bbox(places.map((p) => ({ rings: p.polys })));
  const m = 0.025 * Math.max(ex1 - ex0, ey1 - ey0);
  const FRAME = [ex0 - m, ey0 - m, ex1 + m, ey1 + m];
  const m2 = 0.04 * (ex1 - ex0);
  const WINDOW = [FRAME[0] - m2, FRAME[1] - m2, FRAME[2] + m2, FRAME[3] + m2];
  const overlaps = (r, [x0, y0, x1, y1]) => {
    const [a, b, c, d] = bbox([{ rings: [[r]] }]);
    return a < x1 && c > x0 && b < y1 && d > y0;
  };
  const within = (r, [x0, y0, x1, y1]) => {
    const [a, b, c, d] = bbox([{ rings: [[r]] }]);
    return a >= x0 && c <= x1 && b >= y0 && d <= y1;
  };
  for (const c of context) {
    c.polys = c.polys
      .filter((poly) => overlaps(poly[0], WINDOW))
      .map((poly) => (within(poly[0], WINDOW) ? poly : poly.map((r) => clipRing(r, WINDOW)).filter(Boolean)))
      .filter((poly) => poly.length);
  }
  const ctxKept = context.filter((c) => c.polys.length);

  // 4. One topology for everything, so shared borders weld; then dissolve each place's
  //    group (India with Caixmir and Arunachal) into a single outline.
  const s = WIDTH / (FRAME[2] - FRAME[0]);
  const height = +((FRAME[3] - FRAME[1]) * s).toFixed(2);
  const projection = { project: ([x, y]) => [+((x - FRAME[0]) * s).toFixed(1), +((FRAME[3] - y) * s).toFixed(1)] };
  const all = [...places.map((p) => ({ ...p, place: true })), ...ctxKept];
  const layer = processLayer(
    { features: all.map((c) => ({ properties: c, geometry: { type: 'MultiPolygon', coordinates: c.polys } })) },
    (p) => ({ code: p.code, group: p.group, place: !!p.place }),
    T.target, projection, MIN_RING_AREA);

  const groups = new Map();
  layer.out.forEach((f, i) => { if (f.place) groups.set(f.group, [...(groups.get(f.group) || []), i]); });

  const areaOf = (rs) => rs.reduce((n, r) => n + ringArea(r), 0);
  const out = [];
  let n = 0;   // problems found
  for (const [code, idx] of groups) {
    let rings;
    if (process.env.DEBUG && idx.length > 1) console.log(`  dissolve ${code}: ${idx.length} parts`);
    if (idx.length === 1) rings = layer.out[idx[0]].rings;
    else {
      rings = dissolveMany(layer.topo.shapes, layer.topo.arcs, idx)
        .map((ring) => ringToPoints(ring, layer.topo.arcs).map(projection.project))
        .filter((pts) => pts.length >= 3)
        .filter((pts, _, a) => ringArea(pts) >= MIN_RING_AREA || a.length === 1);
      // A dissolve only removes shared borders; any change in area means the chaining
      // dropped or duplicated a piece.
      const want = idx.reduce((n, i) => n + areaOf(layer.out[i].rings), 0);
      const drift = Math.abs(areaOf(rings) - want) / want;
      if (drift > 0.002) { console.warn(`!! ${id} ${code}: dissolve changed the area by ${(drift * 100).toFixed(2)}%`); n++; }
    }
    rings.sort((a, b) => ringArea(b) - ringArea(a));
    const area = Math.round(areaOf(rings));
    const label = labelAnchor(rings) || centroid(rings);
    out.push({ code, label, area, d: toPath(rings), rings, ...(area < SMALL ? { mark: label } : {}) });
  }

  // Rings must not overlap, or a tap on one lands on its neighbour: in the Lesser
  // Antilles they are closer than two radii.
  const marked = out.filter((c) => c.mark);
  for (const c of marked) {
    const near = Math.min(Infinity, ...marked.filter((o) => o !== c)
      .map((o) => Math.hypot(o.mark[0] - c.mark[0], o.mark[1] - c.mark[1])));
    const r = Math.max(4, Math.min(RING, near * 0.48));
    if (r < RING) c.markR = +r.toFixed(1);
  }
  out.sort((a, b) => a.code.localeCompare(b.code));

  const contextD = layer.out.filter((c) => !c.place).map((c) => toPath(c.rings)).join('');
  mkdirSync('docs/data', { recursive: true });
  writeFileSync(OUT,
    `// GENERATED by build/fetch-geo-mon.mjs ${id} — do not edit.\n` +
    `// Source: Eurostat GISCO, CNTR_RG_10M_2024 (EPSG:4326), projected in the build. Names and capitals: ${id}-hints.js\n` +
    `export const VIEWBOX = "0 0 ${WIDTH} ${height}";\n` +
    `export const COUNTRIES = ${JSON.stringify(out.map(({ rings, ...c }) => c))};\n` +
    `// Every other country inside the frame, as one untappable path.\n` +
    `export const CONTEXT = ${JSON.stringify(contextD)};\n`);

  const size = readFileSync(OUT).length;
  console.log(`
${id}
  places      ${out.length}
  context     ${ctxKept.length} countries
  geometry    ${layer.arcs} arcs, ${layer.kept} pts kept, ${layer.dropped} tiny rings dropped
  viewBox     0 0 ${WIDTH} ${height}
  small       ${marked.map((c) => `${c.code} (${c.area}${c.markR ? `, r${c.markR}` : ''})`).join(', ')}
  written     ${OUT}  (${(size / 1024).toFixed(0)} KB)`);

  // Integrity: the hand-written list, the content and the geometry must agree.
  const have = new Set(out.map((c) => c.code));
  if (out.length !== T.count) { console.warn(`!! ${id}: expected ${T.count} places, got ${out.length}`); n++; }
  for (const code of codes) {
    const h = HINTS[code];
    if (!have.has(code)) { console.warn(`!! ${id} ${code}: in the hints but no geometry`); n++; }
    if (!h.name || !('capital' in h) || !h.art || !h.hook) { console.warn(`!! ${id} ${code}: missing name/capital/art/hook`); n++; }
  }
  for (const c of out) {
    if (!c.d) { console.warn(`!! ${id} ${c.code}: no geometry left after simplification`); n++; }
    if (!pointInRings(c.label, c.rings)) { console.warn(`!! ${id} ${c.code}: label anchor falls outside the place`); n++; }
  }
  console.log(n ? `  ${n} problem(s) above` : `  checks passed: ${out.length} places, all named, all with geometry`);
  return n;
}
