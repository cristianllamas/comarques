// Geometry helpers shared by the build scripts (fetch-geo.mjs, fetch-geo-ue.mjs).
//
// Everything here works on plain coordinate arrays and is projection-agnostic; the
// scripts decide the projection and what to do with the output.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { buildTopology, simplifyTopology } from './topology.mjs';

/** Read data/<name>.raw.geojson, downloading it from `url` the first time. */
export async function load(name, url) {
  const path = `data/${name}.raw.geojson`;
  if (!existsSync(path)) {
    process.stdout.write(`downloading ${name}… `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    mkdirSync('data', { recursive: true });
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
    console.log('ok');
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}


export const toRings = (geom) =>
  geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;

export function bbox(features) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of features) for (const poly of f.rings) for (const ring of poly) for (const [x, y] of ring) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}


export const ringArea = (pts) => {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};

export function ringToPoints(ring, arcs) {
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

export const toPath = (rings) =>
  rings.map((pts) => `M${pts.map((p) => p.join(' ')).join('L')}Z`).join('');

export function centroid(rings) {
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
export function labelAnchor(rings) {
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

export function pointInRings(pt, rings) {
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
export function dissolve(shapes, arcs, indexes) {
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
  return chainRings(segs, arcs);
}

/** Chain loose arc references end to end into closed rings. */
function chainRings(segs, arcs) {
  // Endpoints are compared on the same quantised grid the topology uses, never as raw
  // floats: the identical junction comes back as 2.4961408345561957 from one ring and
  // 2.496140834556191 from the other, so exact float equality never joins them.
  const at = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
  const ends = (r) => {
    const a = arcs[r.arc];
    const first = at(a[0]), last = at(a[a.length - 1]);
    return r.rev ? [last, first] : [first, last];
  };

  // Index the loose arcs by both endpoints, so finding the next one is a lookup rather
  // than a scan (an ocean is tens of thousands of arcs).
  const byEnd = new Map();
  const add = (k, i) => { let a = byEnd.get(k); if (!a) byEnd.set(k, (a = [])); a.push(i); };
  segs.forEach((r, i) => { const [a, b] = ends(r); add(a, i); add(b, i); });

  const pool = new Set(segs.keys());
  const rings = [];

  while (pool.size) {
    const seed = pool.values().next().value;
    pool.delete(seed);
    const chain = [segs[seed]];
    let [head, tail] = ends(segs[seed]);

    while (tail !== head) {
      const i = (byEnd.get(tail) || []).find((j) => pool.has(j));
      if (i === undefined) break;
      const [a, b] = ends(segs[i]);
      if (a === tail) { chain.push(segs[i]); tail = b; }
      else { chain.push({ arc: segs[i].arc, rev: !segs[i].rev }); tail = a; }
      pool.delete(i);
    }
    if (tail === head) rings.push(chain);
    else rings.unchained = (rings.unchained || 0) + chain.length;
  }
  // Arcs that never closed into a ring: a dissolve that loses some has torn the outline.
  rings.unchained ||= 0;
  return rings;
}

export function processLayer(geo, props, target, projection, minRingArea = 1.2) {
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
    const keepRings = sorted.filter((r, idx) => idx === 0 || r.a >= minRingArea).map((r) => r.pts);
    dropped += sorted.length - keepRings.length;
    kept += keepRings.reduce((n, r) => n + r.length, 0);
    return { ...f, rings: keepRings };
  });
  return { out, kept, dropped, arcs: simp.arcs.length, topo: simp };
}

/**
 * Sutherland–Hodgman clip of one closed ring to an axis-aligned rectangle.
 *
 * Intersections are computed with the segment's endpoints in a canonical order, so two
 * neighbours that share a border segment get bit-identical cut points and the topology
 * still welds them (see "Never compare coordinates as raw floats" in ARCHITECTURE.md).
 */
export function clipRing(ring, [x0, y0, x1, y1]) {
  const cut = (a, b, axis, v) => {
    const [p, q] = (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) ? [a, b] : [b, a];
    const t = (v - p[axis]) / (q[axis] - p[axis]);
    return axis === 0 ? [v, p[1] + t * (q[1] - p[1])] : [p[0] + t * (q[0] - p[0]), v];
  };
  const edges = [
    [(p) => p[0] >= x0, 0, x0], [(p) => p[0] <= x1, 0, x1],
    [(p) => p[1] >= y0, 1, y0], [(p) => p[1] <= y1, 1, y1],
  ];
  let pts = ring.slice(0, -1);
  for (const [inside, axis, v] of edges) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cut(a, b, axis, v));
    }
    pts = out;
    if (!pts.length) break;
  }
  return pts.length >= 3 ? [...pts, pts[0]] : null;
}

// ---------------------------------------------------------------- world maps
//
// The comarques, Spain and the EU arrive in (or close to) a projection that suits them.
// The continents and the oceans come from world layers in plain longitude/latitude, so
// the builds project them here, to metres, before any topology or clipping happens —
// the same order the EU build follows with its ready-projected EPSG:3035.

const R = 6371008.8;
const RAD = Math.PI / 180;

/** Longitude relative to `lon0`, wrapped into [-180, 180): Chukotka sits just east of Japan. */
export const relLon = (lon, lon0) => ((((lon - lon0) % 360) + 540) % 360) - 180;

/** Lambert azimuthal equal-area, centred on (lon0, lat0). Good for a continent that is about as tall as it is wide. */
export function laea(lon0, lat0) {
  const s0 = Math.sin(lat0 * RAD), c0 = Math.cos(lat0 * RAD);
  return ([lon, lat]) => {
    const l = relLon(lon, lon0) * RAD, p = lat * RAD;
    const sp = Math.sin(p), cp = Math.cos(p), cl = Math.cos(l);
    const k = Math.sqrt(2 / Math.max(1e-12, 1 + s0 * sp + c0 * cp * cl));
    return [R * k * cp * Math.sin(l), R * k * (c0 * sp - s0 * cp * cl)];
  };
}

/** Albers equal-area conic: for wide, mid-latitude land masses (Asia, North America). */
export function albers(lon0, lat1, lat2, lat0) {
  const s1 = Math.sin(lat1 * RAD), s2 = Math.sin(lat2 * RAD);
  const n = (s1 + s2) / 2;
  const C = Math.cos(lat1 * RAD) ** 2 + 2 * n * s1;
  const rho0 = (R * Math.sqrt(C - 2 * n * Math.sin(lat0 * RAD))) / n;
  return ([lon, lat]) => {
    const rho = (R * Math.sqrt(Math.max(0, C - 2 * n * Math.sin(lat * RAD)))) / n;
    const t = n * relLon(lon, lon0) * RAD;
    return [rho * Math.sin(t), rho0 - rho * Math.cos(t)];
  };
}

/** Equal Earth (Šavrič, Patterson & Jenny, 2018): an equal-area world map that still looks familiar. */
export function equalEarth(lon0 = 0) {
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
  return ([lon, lat]) => {
    // Not relLon(): a world map needs +180° on the right edge and −180° on the left, not
    // both folded onto the left.
    let d = lon - lon0;
    if (d > 180) d -= 360; else if (d < -180) d += 360;
    const l = d * RAD;
    const t = Math.asin(M * Math.sin(lat * RAD)), t2 = t * t, t6 = t2 * t2 * t2;
    const x = (2 * Math.sqrt(3) * l * Math.cos(t)) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
    const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
    return [R * x, R * y];
  };
}

/**
 * Mean point of a polygon's outer ring, in absolute degrees. Longitudes are averaged
 * relative to `lon0` first, so an island chain on the antimeridian does not average to
 * the middle of the planet.
 */
export function polyCentre(poly, lon0 = 0) {
  let x = 0, y = 0;
  for (const [lon, lat] of poly[0]) { x += relLon(lon, lon0); y += lat; }
  const n = poly[0].length;
  return [relLon(x / n + lon0, 0), y / n];
}

/**
 * Dissolve any number of shapes into one outline: an arc used by two *different* shapes
 * of the group is internal and goes. Counting shapes, not references, matters for the
 * same reason as in dissolve(): one shape may legitimately use an arc twice.
 *
 * Arcs are matched by their (simplified) points, not only by id. The topology cuts arcs
 * where the set of owners changes, and that can go wrong when a vertex two shapes share
 * sits on different edges in each (the IHO's North and South Pacific near the
 * Galápagos): each side then gets its own copy of the same border, with its own id, and
 * the border would survive the dissolve as a line through the ocean. (Copies that end
 * a few metres apart still do; the water maps therefore draw no outlines, see
 * fetch-geo-mar.mjs.)
 */
export function dissolveMany(shapes, arcs, indexes) {
  const q = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
  const canon = new Map();   // arc id -> canonical id
  const seen = new Map();    // point sequence -> canonical id
  const canonOf = (a) => {
    if (!canon.has(a)) {
      const fwd = arcs[a].map(q).join(';'), rev = arcs[a].map(q).reverse().join(';');
      const c = seen.get(fwd) ?? seen.get(rev) ?? a;
      seen.set(fwd, c);
      canon.set(a, c);
    }
    return canon.get(a);
  };
  const users = new Map();
  for (const i of indexes) {
    const own = new Set();
    for (const poly of shapes[i].rings) for (const ring of poly) for (const r of ring) own.add(canonOf(r.arc));
    for (const a of own) users.set(a, (users.get(a) || 0) + 1);
  }
  const internal = new Set([...users].filter(([, n]) => n > 1).map(([a]) => a));
  const segs = [];
  for (const i of indexes)
    for (const poly of shapes[i].rings)
      for (const ring of poly)
        for (const ref of ring)
          if (!internal.has(canonOf(ref.arc))) segs.push(ref);
  return chainRings(segs, arcs);
}

/**
 * Make neighbours share vertices along their common borders ("T-junctions").
 *
 * The topology welds two borders only where both sides have the same vertices. GISCO
 * and the ICGC data do; the IHO sea areas often do not: the North Atlantic describes the
 * equator off Africa with a vertex every 0.09°, the South Atlantic with one straight
 * segment. Unwelded, both are drawn and the line between them stays visible inside a
 * dissolved ocean. So every vertex of one feature lying on another feature's segment is
 * inserted into that segment.
 *
 * Only segments longer than `minLen` are examined: borders drawn in open water are long
 * straight runs, coastlines are dense short ones, and checking those would be slow and
 * pointless (`polys` per feature, in degrees; returns the same structure).
 */
export function weldTJunctions(features, { minLen = 0.05, eps = 1e-7, cell = 0.5 } = {}) {
  const xs = [], ys = [], owner = [];
  features.forEach((polys, fi) => {
    for (const poly of polys) for (const r of poly) for (const [x, y] of r) { xs.push(x); ys.push(y); owner.push(fi); }
  });
  const key = (cx, cy) => cx * 100000 + cy;
  const grid = new Map();
  for (let i = 0; i < xs.length; i++) {
    const k = key(Math.floor(xs[i] / cell), Math.floor(ys[i] / cell));
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(i);
  }
  let inserted = 0;
  const out = features.map((polys, fi) => polys.map((poly) => poly.map((r) => {
    const res = [r[0]];
    for (let j = 1; j < r.length; j++) {
      const [ax, ay] = r[j - 1], [bx, by] = r[j];
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      if (len2 > minLen * minLen) {
        const hits = [];
        const cx0 = Math.floor(Math.min(ax, bx) / cell), cx1 = Math.floor(Math.max(ax, bx) / cell);
        const cy0 = Math.floor(Math.min(ay, by) / cell), cy1 = Math.floor(Math.max(ay, by) / cell);
        const len = Math.sqrt(len2);
        for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
          for (const i of grid.get(key(cx, cy)) || []) {
            if (owner[i] === fi) continue;
            const px = xs[i] - ax, py = ys[i] - ay;
            const t = (px * dx + py * dy) / len2;
            if (t <= 0 || t >= 1) continue;
            if (Math.abs(px * dy - py * dx) / len > eps) continue;
            hits.push([t, xs[i], ys[i]]);
          }
        }
        hits.sort((p, q) => p[0] - q[0]);
        let last = null;
        for (const [, x, y] of hits) {
          if (last && last[0] === x && last[1] === y) continue;
          res.push((last = [x, y])); inserted++;
        }
      }
      res.push(r[j]);
    }
    return res;
  })));
  out.inserted = inserted;
  return out;
}

/**
 * Gall stereographic: a cylindrical world map, as on many classroom walls. Not
 * equal-area (Greenland and Antarctica grow), but about 1.6:1 once the poles are cropped,
 * against Equal Earth's 2.1:1 — which on a phone is the difference between a strip and a
 * map. Used for the oceans and seas, where finding the place matters more than its size.
 */
export function gallStereographic(lon0 = 0) {
  const k = 1 + Math.SQRT2 / 2;
  return ([lon, lat]) => {
    let d = lon - lon0;
    if (d > 180) d -= 360; else if (d < -180) d += 360;
    return [(R * d * RAD) / Math.SQRT2, R * k * Math.tan((lat * RAD) / 2)];
  };
}
