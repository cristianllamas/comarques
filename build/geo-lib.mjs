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
