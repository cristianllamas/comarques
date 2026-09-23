// Topology-aware simplification.
//
// Neighbouring comarques in the ICGC data share identical vertices (verified: 149k
// vertices belong to exactly two features, plus 61 triple-junctions). Simplifying each
// polygon on its own would move those shared boundaries in different directions and
// tear visible gaps between neighbours. So we cut the rings into shared *arcs* first,
// simplify each arc exactly once, and reassemble. Borders then stay welded by
// construction.

const Q = 1e6; // quantisation grid, ~0.1 m — enough to make coincident vertices equal

const key = (p) => `${Math.round(p[0] * Q)},${Math.round(p[1] * Q)}`;

// --- binary min-heap over triangle areas -----------------------------------------
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) { this.a.push(n); n.heap = this.a.length - 1; this.up(n.heap); }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; last.heap = 0; this.down(0); }
    return top;
  }
  update(n) { this.up(n.heap); this.down(n.heap); }
  remove(n) {
    const a = this.a, i = n.heap, last = a.pop();
    if (i < a.length) { a[i] = last; last.heap = i; this.up(i); this.down(i); }
  }
  swap(i, j) {
    const a = this.a;
    [a[i], a[j]] = [a[j], a[i]];
    a[i].heap = i; a[j].heap = j;
  }
  up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].area <= this.a[i].area) break;
      this.swap(i, p); i = p;
    }
  }
  down(i) {
    const n = this.a.length;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < n && this.a[l].area < this.a[m].area) m = l;
      if (r < n && this.a[r].area < this.a[m].area) m = r;
      if (m === i) break;
      this.swap(i, m); i = m;
    }
  }
}

const triArea = (a, b, c) =>
  Math.abs((a[0] - c[0]) * (b[1] - a[1]) - (a[0] - b[0]) * (c[1] - a[1])) / 2;

// Visvalingam: assign every interior point the effective area at which it would be
// removed. Weights are forced monotonic so that thresholding never keeps a point whose
// neighbour was already dropped.
function weighArc(points) {
  const n = points.length;
  const w = new Float64Array(n).fill(Infinity); // endpoints pinned
  if (n < 3) return w;

  const nodes = points.map((p, i) => ({ p, i, prev: null, next: null, area: 0, heap: -1 }));
  for (let i = 1; i < n; i++) { nodes[i].prev = nodes[i - 1]; nodes[i - 1].next = nodes[i]; }

  const heap = new Heap();
  for (let i = 1; i < n - 1; i++) {
    nodes[i].area = triArea(nodes[i - 1].p, nodes[i].p, nodes[i + 1].p);
    heap.push(nodes[i]);
  }

  let last = 0;
  while (heap.size) {
    const node = heap.pop();
    last = Math.max(node.area, last);
    w[node.i] = last;
    const { prev, next } = node;
    if (prev) prev.next = next;
    if (next) next.prev = prev;
    for (const nb of [prev, next]) {
      if (nb && nb.prev && nb.next) {
        nb.area = triArea(nb.prev.p, nb.p, nb.next.p);
        heap.update(nb);
      }
    }
  }
  return w;
}

export function buildTopology(features) {
  // 1. which features touch each quantised point
  const owners = new Map();
  features.forEach((f, fi) => {
    for (const poly of f.rings) for (const ring of poly) for (const p of ring) {
      const k = key(p);
      let s = owners.get(k);
      if (!s) owners.set(k, (s = new Set()));
      s.add(fi);
    }
  });

  // signature = the set of features sharing a point; arcs are runs of equal signature
  const sig = new Map();
  for (const [k, s] of owners) sig.set(k, [...s].sort((a, b) => a - b).join('|'));

  const arcs = [];
  const arcIndex = new Map(); // canonical key -> arc id

  function addArc(points) {
    const fwd = points.map(key).join(';');
    const rev = points.map(key).reverse().join(';');
    if (arcIndex.has(fwd)) return { arc: arcIndex.get(fwd), rev: false };
    if (arcIndex.has(rev)) return { arc: arcIndex.get(rev), rev: true };
    const id = arcs.length;
    arcs.push(points);
    arcIndex.set(fwd, id);
    return { arc: id, rev: false };
  }

  // 2. cut each ring into arcs wherever the signature changes
  const shapes = features.map((f) => ({
    ...f,
    rings: f.rings.map((poly) => poly.map((ring) => {
      const r = ring.slice(0, -1); // drop the duplicated closing point
      const n = r.length;
      if (n < 3) return [];
      const sigs = r.map((p) => sig.get(key(p)));

      // A point is a junction when it sits at either end of a run of equal signature,
      // i.e. where a shared border starts or stops being shared. Arcs then run from one
      // junction to the next *inclusive*, so both neighbours describe the border between
      // them with exactly the same endpoints and it deduplicates to a single arc.
      //
      // (Cutting one point past the change instead — which is what this did first —
      // gives each neighbour a different last point, nothing ever matches, and every
      // border silently ends up stored and drawn twice.)
      const junctions = [];
      for (let i = 0; i < n; i++) {
        if (sigs[i] !== sigs[(i - 1 + n) % n] || sigs[i] !== sigs[(i + 1) % n]) junctions.push(i);
      }

      if (junctions.length === 0) return [addArc([...r, r[0]])]; // ring shared by nobody

      if (junctions.length === 1) { // one junction: a single arc closing on itself
        const a = junctions[0];
        const pts = [];
        for (let k = 0; k <= n; k++) pts.push(r[(a + k) % n]);
        return [addArc(pts)];
      }

      const out = [];
      for (let t = 0; t < junctions.length; t++) {
        const a = junctions[t], b = junctions[(t + 1) % junctions.length];
        const pts = [r[a]];
        for (let i = a; i !== b; ) { i = (i + 1) % n; pts.push(r[i]); }
        if (pts.length >= 2) out.push(addArc(pts));
      }
      return out;
    })),
  }));

  return { arcs, shapes };
}

// Simplify every arc once, choosing a global area threshold that hits `targetPoints`.
export function simplifyTopology({ arcs, shapes }, targetPoints) {
  const weights = arcs.map(weighArc);

  const all = [];
  for (const w of weights) for (const v of w) if (Number.isFinite(v)) all.push(v);
  all.sort((a, b) => a - b);

  const drop = Math.max(0, all.length - targetPoints);
  const threshold = drop > 0 ? all[Math.min(drop, all.length - 1)] : 0;

  const simplified = arcs.map((pts, i) =>
    pts.filter((_, j) => weights[i][j] >= threshold));

  return { arcs: simplified, shapes, threshold };
}
