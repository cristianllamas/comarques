// Builds the two world maps where the places are water:
//
//   oce  the five oceans                       → docs/data/oce-geo.js
//   mar  24 seas and gulfs, and the Caspi       → docs/data/mar-geo.js
//   and the land drawn over both               → docs/data/terra-geo.js
//
//   sources: Marine Regions, IHO Sea Areas v3 (CC BY 4.0) — the 101 sea areas of the
//              International Hydrographic Organization, a partition of the world ocean
//              with shared borders. Seas and oceans are built by dissolving them.
//            Natural Earth 1:50M marine polygons (public domain) — for the Caspi, which the IHO
//              does not count as a sea.
//            Eurostat GISCO, CNTR_RG_10M_2024 — the land.
//
// Land is drawn *over* the water, so where the IHO coastline and GISCO's disagree the
// land wins and nothing shows; the water only has to reach under it. That is also why
// the land is its own layer rather than context: it must cover a highlighted sea.
//
// Projection: Gall stereographic centred on Greenwich, as on classroom wall maps. It was
// Equal Earth at first, which is 2.1:1 however the poles are cropped — a thin strip on a
// phone; this is 1.6:1. The Pacific and the mar de Bering come out in two pieces, one at
// each edge; such a place gets a `focus` box around its larger piece, so zooming to it
// does not show the whole world.
//
// Run: node build/fetch-geo-mar.mjs      (the first run downloads 250 MB from Marine Regions)

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { load, toRings, bbox, ringArea, ringToPoints, toPath, centroid, labelAnchor, pointInRings,
  processLayer, clipRing, dissolveMany, gallStereographic, weldTJunctions } from './geo-lib.mjs';
import { HINTS as OCEANS } from '../docs/data/oce-hints.js';
import { HINTS as SEAS } from '../docs/data/mar-hints.js';

const IHO_URL = 'https://geo.vliz.be/geoserver/MarineRegions/wfs?service=WFS&version=1.0.0'
  + '&request=GetFeature&typeName=MarineRegions:iho&outputFormat=application/json&propertyName=name,id,mrgid,the_geom';
const CASPIAN_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_geography_marine_polys.geojson';
const LAND_URL = 'https://gisco-services.ec.europa.eu/distribution/v2/countries/geojson/CNTR_RG_10M_2024_4326.geojson';

const WIDTH = 1000;
// Degrees. North of 84° there is only Arctic ice; at 72°S the Southern Ocean still shows
// as a band along Antarctica. A cylindrical map must be cropped somewhere.
const SOUTH = -72, NORTH = 84;
const GRID = 0.01;               // degrees: the IHO coastline is far finer than the map needs
// The water's coastline is hidden under the land, so it can be simplified much harder.
const TARGET_WATER = 8000, TARGET_LAND = 12000;
const MIN_RING_AREA = 0.8;     // units², for the land
// Islands are holes in the water, and the land is drawn over them anyway: only the big
// ones are worth keeping (they still show if a highlighted sea's island is tapped).
const MIN_WATER_RING = 12;
const SMALL = 400, RING = 11;

// Every IHO sea area, by the ocean it belongs to (the IHO's own grouping, 1953 edition;
// the Southern Ocean as Marine Regions adds it from the 2002 draft). Used for the oceans
// map, where an ocean is all of its seas.
const OCEAN_OF = {
  ART: ['Arctic Ocean', 'Barentsz Sea', 'White Sea', 'Kara Sea', 'Laptev Sea', 'East Siberian Sea',
    'Chukchi Sea', 'Beaufort Sea', 'Lincoln Sea', 'Greenland Sea', 'Norwegian Sea', 'Baffin Bay',
    'The Northwestern Passages'],
  ATL: ['North Atlantic Ocean', 'South Atlantic Ocean', 'Mediterranean Sea - Western Basin',
    'Mediterranean Sea - Eastern Basin', 'Adriatic Sea', 'Aegean Sea', 'Ionian Sea', 'Tyrrhenian Sea',
    'Ligurian Sea', 'Alboran Sea', 'Balearic (Iberian Sea)', 'Sea of Marmara', 'Black Sea', 'Sea of Azov',
    'Strait of Gibraltar', 'Baltic Sea', 'Gulf of Bothnia', 'Gulf of Finland', 'Gulf of Riga', 'Kattegat',
    'Skagerrak', 'North Sea', 'English Channel', 'Bay of Biscay', 'Celtic Sea',
    "Irish Sea and St. George's Channel", 'Bristol Channel', 'Inner Seas off the West Coast of Scotland',
    'Caribbean Sea', 'Gulf of Mexico', 'Gulf of Guinea', 'Rio de La Plata', 'Labrador Sea', 'Davis Strait',
    'Hudson Bay', 'Hudson Strait', 'Gulf of St. Lawrence', 'Bay of Fundy'],
  IND: ['Indian Ocean', 'Arabian Sea', 'Red Sea', 'Gulf of Suez', 'Gulf of Aqaba', 'Gulf of Aden',
    'Persian Gulf', 'Gulf of Oman', 'Bay of Bengal', 'Andaman or Burma Sea', 'Laccadive Sea',
    'Mozambique Channel', 'Great Australian Bight', 'Bass Strait', 'Timor Sea', 'Savu Sea', 'Malacca Strait'],
  PAC: ['North Pacific Ocean', 'South Pacific Ocean', 'Bering Sea', 'Sea of Okhotsk', 'Japan Sea',
    'Seto Naikai or Inland Sea', 'Yellow Sea', 'Eastern China Sea', 'South China Sea', 'Philippine Sea',
    'Gulf of Thailand', 'Singapore Strait', 'Celebes Sea', 'Sulu Sea', 'Molukka Sea', 'Halmahera Sea',
    'Ceram Sea', 'Banda Sea', 'Flores Sea', 'Bali Sea', 'Java Sea', 'Makassar Strait', 'Gulf of Boni',
    'Gulf of Tomini', 'Arafura Sea', 'Coral Sea', 'Solomon Sea', 'Bismarck Sea', 'Tasman Sea',
    'Gulf of Alaska', 'Gulf of California', 'The Coastal Waters of Southeast Alaska and British Columbia'],
  ANT: ['Southern Ocean'],
};

// The seas asked about, as the IHO areas they are made of.
const SEA_AREAS = {
  MED: ['Mediterranean Sea - Western Basin', 'Mediterranean Sea - Eastern Basin', 'Adriatic Sea',
    'Aegean Sea', 'Ionian Sea', 'Tyrrhenian Sea', 'Ligurian Sea', 'Alboran Sea', 'Balearic (Iberian Sea)'],
  CAN: ['Bay of Biscay'], NOR: ['North Sea'],
  BAL: ['Baltic Sea', 'Gulf of Bothnia', 'Gulf of Finland', 'Gulf of Riga'],
  NEG: ['Black Sea'], CAR: ['Caribbean Sea'], MEX: ['Gulf of Mexico'], GUI: ['Gulf of Guinea'],
  BAR: ['Barentsz Sea'], BEA: ['Beaufort Sea'],
  ROI: ['Red Sea', 'Gulf of Suez', 'Gulf of Aqaba'], ARA: ['Arabian Sea'], PER: ['Persian Gulf'],
  ADE: ['Gulf of Aden'], BEN: ['Bay of Bengal'],
  BER: ['Bering Sea'], OKH: ['Sea of Okhotsk'], JAP: ['Japan Sea'], GRO: ['Yellow Sea'],
  XOR: ['Eastern China Sea'], XME: ['South China Sea'], COR: ['Coral Sea'], TAS: ['Tasman Sea'],
  CAS: [],   // from Natural Earth
};
const OCEAN_NAME = { ART: 'Àrtic', ATL: 'Atlàntic', IND: 'Índic', PAC: 'Pacífic', ANT: 'Antàrtic' };

const proj = gallStereographic(0);

// Snap to a grid, then drop repeated points. Coincident vertices of two neighbours land
// on the same grid point, so the topology still welds them; 9 million points become a
// few hundred thousand.
const thin = (ring) => {
  const out = [];
  for (const [lon, lat] of ring) {
    const p = [Math.round(lon / GRID) * GRID, Math.round(lat / GRID) * GRID];
    const q = out[out.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
  }
  return out.length >= 4 ? out : null;
};
const prep = (polys) => polys
  .map((poly) => poly.map(thin).filter(Boolean))
  .filter((poly) => poly.length)
  .map((poly) => poly.map((r) => r.map(proj)));

const [x0] = proj([-180, 0]), [x1] = proj([180, 0]);
const [, y0] = proj([0, SOUTH]), [, y1] = proj([0, NORTH]);
const FRAME = [x0, y0, x1, y1];
const clip = (polys) => polys
  .map((poly) => poly.map((r) => clipRing(r, FRAME)).filter(Boolean))
  .filter((poly) => poly.length);

const s = WIDTH / (x1 - x0);
const height = +((y1 - y0) * s).toFixed(2);
const projection = { project: ([x, y]) => [+((x - x0) * s).toFixed(1), +((y1 - y) * s).toFixed(1)] };

// ---------------------------------------------------------------- water
const iho = await load('mon-iho', IHO_URL);
const marine = await load('mon-marine', CASPIAN_URL);

const oceanOf = new Map(Object.entries(OCEAN_OF).flatMap(([o, names]) => names.map((n) => [n, o])));
const seaOf = new Map(Object.entries(SEA_AREAS).flatMap(([c, names]) => names.map((n) => [n, c])));
let bad = 0;
const names = iho.features.map((f) => f.properties.name);
for (const n of names) if (!oceanOf.has(n)) { console.warn(`!! IHO area "${n}" has no ocean in OCEAN_OF`); bad++; }
for (const n of oceanOf.keys()) if (!names.includes(n)) { console.warn(`!! "${n}" in OCEAN_OF is not an IHO area`); bad++; }
for (const n of seaOf.keys()) if (!names.includes(n)) { console.warn(`!! "${n}" in SEA_AREAS is not an IHO area`); bad++; }

const caspian = marine.features.find((f) => /caspian/i.test(f.properties.name || f.properties.NAME || ''));
if (!caspian) { console.warn('!! no Caspian Sea in the Natural Earth marine polygons'); bad++; }

const welded = weldTJunctions(iho.features.map((f) => toRings(f.geometry)), { minLen: 0.005 });
console.log(`welded      ${welded.inserted} vertices inserted where neighbouring sea areas did not share them`);
const water = [
  ...iho.features.map((f, i) => ({ name: f.properties.name, ocean: oceanOf.get(f.properties.name),
    sea: seaOf.get(f.properties.name) || null, polys: clip(prep(welded[i])) })),
  ...(caspian ? [{ name: 'Caspian Sea', ocean: null, sea: 'CAS', polys: clip(prep(toRings(caspian.geometry))) }] : []),
].filter((w) => w.polys.length);

const wl = processLayer(
  { features: water.map((w) => ({ properties: w, geometry: { type: 'MultiPolygon', coordinates: w.polys } })) },
  (p) => ({ name: p.name, ocean: p.ocean, sea: p.sea }), TARGET_WATER, projection, MIN_WATER_RING);

const areaOf = (rs) => rs.reduce((n, r) => n + ringArea(r), 0);

/** One place from several IHO areas: dissolved, with a label, a ring if small, a focus box if split. */
function place(code, idx) {
  let rings = wl.out[idx[0]].rings;
  if (idx.length > 1) {
    // Area cannot be the check here, as it is for the comarques: islands are holes, and
    // an island on the border between two IHO areas is two half-holes that merge. What
    // must hold is that every remaining arc closes into a ring.
    const chained = dissolveMany(wl.topo.shapes, wl.topo.arcs, idx);
    if (chained.unchained) { console.warn(`!! ${code}: ${chained.unchained} arc(s) did not close into a ring`); bad++; }
    rings = chained.map((ring) => ringToPoints(ring, wl.topo.arcs).map(projection.project))
      .filter((pts) => pts.length >= 3);
  }
  rings = rings.filter((r, i, a) => ringArea(r) >= MIN_WATER_RING || a.length === 1)
    .sort((a, b) => ringArea(b) - ringArea(a));
  const area = Math.round(areaOf(rings));
  const label = labelAnchor(rings) || centroid(rings);
  const [bx0, , bx1] = bbox([{ rings: [rings] }]);
  const out = { code, label, area, d: toPath(rings), rings };
  if (area < SMALL) out.mark = label;
  // Split by the map's edge (the Pacific, the mar de Bering): focus on the larger piece.
  if (bx1 - bx0 > WIDTH * 0.6) {
    const [fx0, fy0, fx1, fy1] = bbox([{ rings: [[rings[0]]] }]);
    if (fx1 - fx0 < WIDTH * 0.6) out.focus = [fx0, fy0, fx1 - fx0, fy1 - fy0].map((v) => +v.toFixed(1));
  }
  return out;
}

function rings(list) {
  const marked = list.filter((c) => c.mark);
  for (const c of marked) {
    const near = Math.min(Infinity, ...marked.filter((o) => o !== c)
      .map((o) => Math.hypot(o.mark[0] - c.mark[0], o.mark[1] - c.mark[1])));
    const r = Math.max(4, Math.min(RING, near * 0.48));
    if (r < RING) c.markR = +r.toFixed(1);
  }
  return list;
}

const indexesBy = (key) => {
  const m = new Map();
  wl.out.forEach((w, i) => { if (w[key]) m.set(w[key], [...(m.get(w[key]) || []), i]); });
  return m;
};

/**
 * The lines between places, as their own layer. Water places are drawn without an
 * outline: the IHO areas do not always weld (two copies of one border, a few metres
 * apart, survive the dissolve), and an outline would draw those as lines through the
 * middle of an ocean. Instead, an arc is a border when it separates two *different*
 * places — the Atlàntic from the Índic, or a sea from the open ocean (`other`). Arcs with
 * one side only are coastline, which the land covers.
 */
function borders(placeOf) {
  const sides = new Map();
  wl.topo.shapes.forEach((sh, i) => {
    const p = placeOf(wl.out[i]);
    for (const poly of sh.rings) for (const ring of poly) for (const r of ring) {
      let s = sides.get(r.arc);
      if (!s) sides.set(r.arc, (s = new Set()));
      s.add(p);
    }
  });
  return [...sides].filter(([, s]) => s.size > 1)
    .map(([a]) => wl.topo.arcs[a].map(projection.project))
    .filter((pts) => pts.length > 1)
    .map((pts) => `M${pts.map((p) => p.join(' ')).join('L')}`).join('');
}

const oceans = rings([...indexesBy('ocean')].map(([code, idx]) => place(code, idx)));
const seas = rings([...indexesBy('sea')].map(([code, idx]) => place(code, idx)));
const lakeWater = wl.out.filter((w) => !w.ocean).map((w) => toPath(w.rings)).join('');

// ---------------------------------------------------------------- land
const land = await load('mon-countries', LAND_URL);
const ll = processLayer(
  { features: land.features.map((f) => ({ properties: f.properties, geometry: { type: 'MultiPolygon', coordinates: clip(prep(toRings(f.geometry))) } }))
    .filter((f) => f.geometry.coordinates.length) },
  (p) => ({ code: p.CNTR_ID }), TARGET_LAND, projection, MIN_RING_AREA);
const landD = ll.out.map((c) => toPath(c.rings)).join('');

// ---------------------------------------------------------------- write
const strip = (list) => list.map(({ rings: _, ...c }) => c).sort((a, b) => a.code.localeCompare(b.code));
const HEAD = (id) => `// GENERATED by build/fetch-geo-mar.mjs — do not edit.\n`
  + `// Source: Marine Regions, IHO Sea Areas v3 (CC BY 4.0)${id === 'mar' ? ' and Natural Earth (the Caspi)' : ''}, `
  + `in Gall stereographic. Names: ${id}-hints.js\n`;
mkdirSync('docs/data', { recursive: true });
writeFileSync('docs/data/oce-geo.js', HEAD('oce')
  + `export const VIEWBOX = "0 0 ${WIDTH} ${height}";\n`
  + `export const OCEANS = ${JSON.stringify(strip(oceans))};\n`
  + `// The lines between oceans (the water is drawn without outlines).\n`
  + `export const BORDERS = ${JSON.stringify(borders((w) => w.ocean || 'cap'))};\n`
  + `// The Caspi and any other water that belongs to no ocean.\n`
  + `export const CONTEXT = ${JSON.stringify(lakeWater)};\n`);
writeFileSync('docs/data/mar-geo.js', HEAD('mar')
  + `export const VIEWBOX = "0 0 ${WIDTH} ${height}";\n`
  + `export const SEAS = ${JSON.stringify(strip(seas))};\n`
  + `// The lines between each sea and the rest of the water.\n`
  + `export const BORDERS = ${JSON.stringify(borders((w) => w.sea || 'other'))};\n`
  + `// The rest of the water is not repeated here: the seas map draws oce-geo.js underneath.\n`);
writeFileSync('docs/data/terra-geo.js',
  `// GENERATED by build/fetch-geo-mar.mjs — do not edit.\n`
  + `// Source: Eurostat GISCO, CNTR_RG_10M_2024, in Gall stereographic. Drawn over the water of the oceans and seas maps.\n`
  + `export const LAND = ${JSON.stringify(landD)};\n`);

const kb = (f) => `${(readFileSync(f).length / 1024).toFixed(0)} KB`;
console.log(`
water       ${water.length} areas, ${wl.arcs} arcs, ${wl.kept} pts kept, ${wl.dropped} tiny rings dropped
land        ${ll.out.length} countries, ${ll.kept} pts kept
viewBox     0 0 ${WIDTH} ${height}
oceans      ${oceans.map((c) => c.code + (c.focus ? '*' : '')).join(', ')}
seas        ${seas.map((c) => c.code + (c.mark ? `(o${c.markR || ''})` : '') + (c.focus ? '*' : '')).join(', ')}
written     oce-geo.js ${kb('docs/data/oce-geo.js')}, mar-geo.js ${kb('docs/data/mar-geo.js')}, terra-geo.js ${kb('docs/data/terra-geo.js')}`);

// Integrity: every ocean and sea in the hints has a shape, and each sea's ocean agrees
// with the IHO grouping of the areas it is made of.
const check = (list, hints, what) => {
  const have = new Set(list.map((c) => c.code));
  for (const code of Object.keys(hints)) {
    if (!have.has(code)) { console.warn(`!! ${what} ${code}: no geometry`); bad++; }
    if (!hints[code].name || !hints[code].art || !hints[code].hook) { console.warn(`!! ${what} ${code}: missing name/art/hook`); bad++; }
  }
  for (const c of list) {
    if (!hints[c.code]) { console.warn(`!! ${what} ${c.code}: not in the hints`); bad++; }
    if (!pointInRings(c.label, c.rings)) { console.warn(`!! ${what} ${c.code}: label anchor outside`); bad++; }
  }
};
check(oceans, OCEANS, 'ocean');
check(seas, SEAS, 'sea');
if (oceans.length !== 5) { console.warn(`!! expected 5 oceans, got ${oceans.length}`); bad++; }
if (seas.length !== Object.keys(SEAS).length) { console.warn(`!! expected ${Object.keys(SEAS).length} seas, got ${seas.length}`); bad++; }
for (const [code, names] of Object.entries(SEA_AREAS)) {
  const want = SEAS[code]?.ocea ?? null;
  const got = names.length ? OCEAN_NAME[oceanOf.get(names[0])] : null;
  if (want !== got) { console.warn(`!! ${code}: mar-hints says ${want}, the IHO says ${got}`); bad++; }
}
if (bad) process.exitCode = 1;
console.log(bad ? `\n${bad} problem(s) above` : `\nchecks passed: 5 oceans, ${seas.length} seas, every IHO area in an ocean, every sea's ocean agrees with the IHO`);
