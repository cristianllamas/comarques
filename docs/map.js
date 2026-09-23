// The map: renders the comarques as tappable SVG paths, with pan and pinch-zoom.
//
// Zoom is not a nicety here — Barcelonès, the Pla de l'Estany and the Garraf are only a
// few millimetres across on a phone at full extent, and the exam expects him to find
// them. Everything is driven by the viewBox so strokes stay crisp at any scale
// (vector-effect:non-scaling-stroke in styles.css).

import { VIEWBOX, COMARQUES, PROVINCIES, OSONA_MERGED } from './geo.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (n, a = {}) => {
  const e = document.createElementNS(NS, n);
  for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
  return e;
};

const TAP_SLOP = 12;   // px of movement still counted as a tap, not a drag
const TAP_TIME = 600;  // ms

export class Mapa {
  constructor({ onPick } = {}) {
    const [, , w, h] = VIEWBOX.split(' ').map(Number);
    this.home = { x: 0, y: 0, w, h };
    this.view = { ...this.home };
    this.onPick = onPick;
    this.paths = new Map();

    this.svg = el('svg', { viewBox: VIEWBOX, class: 'mapa', role: 'img' });
    this.gCom = el('g');
    for (const c of COMARQUES) {
      const p = el('path', { d: c.d, class: 'comarca' });
      p.dataset.code = c.code;
      this.paths.set(c.code, p);
      this.gCom.append(p);
    }
    this.gProv = el('g', { 'aria-hidden': 'true' });
    for (const p of PROVINCIES) this.gProv.append(el('path', { d: p.d, class: 'provincia' }));

    // drawn last so a highlighted comarca is never hidden under a neighbour's border
    this.gTop = el('g', { 'aria-hidden': 'true' });
    this.gLabels = el('g', { class: 'etiquetes', 'aria-hidden': 'true' });
    this.svg.append(this.gCom, this.gProv, this.gTop, this.gLabels);
    this.labels = false;

    this.#bindGestures();
  }

  get element() { return this.svg; }

  /**
   * 42-comarca mode: swap Osona for the Osona+Lluçanès outline and drop Lluçanès, so no
   * stray border is left running through the middle of Osona.
   */
  setMerged(on) {
    const osona = this.paths.get(OSONA_MERGED.code);
    const lluc = this.paths.get('43');
    if (osona) osona.setAttribute('d', on ? OSONA_MERGED.d : this.#original(OSONA_MERGED.code));
    if (lluc) lluc.style.display = on ? 'none' : '';
  }

  #original(code) {
    return COMARQUES.find((c) => c.code === code).d;
  }

  setViewBox(v) {
    this.view = v;
    this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    if (this.labels) this.layoutLabels();
  }

  reset() { this.setViewBox({ ...this.home }); }

  /** Zoom so one comarca fills a comfortable part of the screen. */
  focus(code, pad = 2.2) {
    const p = this.paths.get(code);
    if (!p) return;
    const b = p.getBBox();
    // getBBox returns zeros while the SVG is detached from the document; zooming to that
    // leaves an empty viewBox and a blank map, so refuse rather than render nothing.
    if (!b.width || !b.height) return;
    const size = Math.max(b.width, b.height) * pad;
    const w = Math.min(this.home.w, Math.max(size, 60));
    const h = w * (this.home.h / this.home.w);
    this.setViewBox(this.#clamp({
      x: b.x + b.width / 2 - w / 2,
      y: b.y + b.height / 2 - h / 2,
      w, h,
    }));
  }

  mark(code, cls) {
    const p = this.paths.get(code);
    if (p) p.classList.add(cls);
  }

  /**
   * Study map: show comarca + capital on every shape that has room for them.
   *
   * All 43 labels cannot fit at full extent — the Barcelona cluster alone would be an
   * unreadable pile — so labels are placed largest-comarca-first and any that would
   * collide with one already placed is dropped. Zooming in frees space and the rest
   * appear, which makes the zoom the way you read the crowded parts of the map.
   */
  showLabels(on, merged = false) {
    this.labels = on;
    this.mergedLabels = merged;
    this.gLabels.style.display = on ? '' : 'none';
    if (on) this.layoutLabels();
  }

  layoutLabels() {
    const r = this.svg.getBoundingClientRect();
    if (!r.width) return; // not laid out yet — setViewBox will call again
    const perUnit = r.width / this.view.w;   // screen px per user unit
    const u = (px) => px / perUnit;          // screen px -> user units
    const NAME_PX = 11, CAP_PX = 9.5, LINE = 1.15;

    const inView = (c) => {
      const [x, y] = c.label;
      return x >= this.view.x && x <= this.view.x + this.view.w
        && y >= this.view.y && y <= this.view.y + this.view.h;
    };

    const candidates = COMARQUES
      .filter((c) => !(this.mergedLabels && c.code === '43'))
      .filter(inView)
      .sort((a, b) => b.area - a.area);   // big comarques win a collision

    // Build them all first, then measure. Estimating text width from the character count
    // undershoots for wide capitals and accented glyphs, which left labels like
    // "ALT EMPORDÀ" clipped against the edge of the map.
    const made = candidates.map((c) => {
      const [ax, ay] = c.label;
      const t = el('text', { x: ax, y: ay, 'text-anchor': 'middle', class: 'etiqueta',
        'font-size': u(NAME_PX) });
      const l1 = el('tspan', { x: ax, dy: u(-1) });
      l1.textContent = c.name.toUpperCase();
      const l2 = el('tspan', { x: ax, dy: u(NAME_PX * LINE), class: 'cap',
        'font-size': u(CAP_PX) });
      l2.textContent = c.capital;
      t.append(l1, l2);
      return { c, t, l1, l2, ax, ay };
    });
    this.gLabels.replaceChildren(...made.map((m) => m.t));

    const placed = [];
    const margin = u(2);

    const pad = u(3);

    // Try the full label first; if it will not fit, try the comarca name on its own
    // before giving up. Half the map was going unlabelled at full extent purely because
    // the capital line made every label twice as tall.
    for (const m of made) {
      let fitted = null;

      for (const attempt of ['complet', 'nomes-nom']) {
        if (attempt === 'nomes-nom') {
          m.l2.remove();
          m.l1.setAttribute('dy', u(NAME_PX * 0.35));
        }
        const b = m.t.getBBox();
        const halfW = b.width / 2, halfH = b.height / 2;

        // Nudge back inside the visible area; the SVG clips anything past the viewBox.
        const x = Math.max(this.view.x + halfW + margin,
          Math.min(m.ax, this.view.x + this.view.w - halfW - margin));
        const y = Math.max(this.view.y + halfH + margin,
          Math.min(m.ay, this.view.y + this.view.h - halfH - margin));

        // If it would have to travel far enough to sit over a neighbour, drop it and let
        // zooming bring it back rather than label the wrong comarca.
        if (Math.hypot(x - m.ax, y - m.ay) > Math.max(b.width, b.height) * 0.45) continue;

        const box = { x: x - halfW, y: y - halfH, w: b.width, h: b.height };
        const clash = placed.some((q) =>
          box.x < q.x + q.w + pad && box.x + box.w + pad > q.x
          && box.y < q.y + q.h + pad && box.y + box.h + pad > q.y);
        if (clash) continue;

        fitted = { x, y, box };
        break;
      }

      if (!fitted) { m.t.remove(); continue; }
      m.t.setAttribute('x', fitted.x); m.t.setAttribute('y', fitted.y);
      m.l1.setAttribute('x', fitted.x);
      if (m.l2.isConnected) m.l2.setAttribute('x', fitted.x);
      placed.push(fitted.box);
    }

    this.placedCount = placed.length;
    if (this.onLabels) this.onLabels(placed.length, candidates.length);
  }

  clearMarks() {
    for (const p of this.paths.values()) p.classList.remove('correcte', 'error', 'destacat', 'apagat');
    this.gTop.replaceChildren();
  }

  /** Re-run the label layout after a resize or an orientation change. */
  refresh() { if (this.labels) this.layoutLabels(); }

  /** Lift one comarca above its neighbours' borders. */
  raise(code, cls) {
    const src = this.paths.get(code);
    if (!src) return;
    const copy = el('path', { d: src.getAttribute('d'), class: `comarca ${cls}` });
    this.gTop.append(copy);
  }

  dim(except) {
    for (const [code, p] of this.paths) if (code !== except) p.classList.add('apagat');
  }

  enablePicking(on) {
    this.picking = on;
    this.svg.classList.toggle('triable', !!on);
  }

  #clamp(v) {
    const w = Math.min(v.w, this.home.w), h = Math.min(v.h, this.home.h);
    return {
      w, h,
      x: Math.max(this.home.x, Math.min(v.x, this.home.x + this.home.w - w)),
      y: Math.max(this.home.y, Math.min(v.y, this.home.y + this.home.h - h)),
    };
  }

  #toUser(clientX, clientY) {
    const r = this.svg.getBoundingClientRect();
    return {
      x: this.view.x + ((clientX - r.left) / r.width) * this.view.w,
      y: this.view.y + ((clientY - r.top) / r.height) * this.view.h,
    };
  }

  #bindGestures() {
    const pts = new Map();
    let start = null, moved = 0, t0 = 0;

    const dist = () => {
      const [a, b] = [...pts.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const mid = () => {
      const [a, b] = [...pts.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    this.svg.addEventListener('pointerdown', (e) => {
      // Capture is an optimisation, not a requirement: it throws for a pointer the
      // browser does not consider active, and losing it must not break tapping.
      try { this.svg.setPointerCapture(e.pointerId); } catch { /* fine without it */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0; t0 = Date.now();
      start = pts.size === 2
        ? { view: { ...this.view }, d: dist(), c: this.#toUser(mid().x, mid().y) }
        : { view: { ...this.view }, u: this.#toUser(e.clientX, e.clientY) };
    });

    this.svg.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      moved += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!start) return;

      if (pts.size === 2 && start.d) {
        const k = start.d / dist();
        const w = start.view.w * k, h = start.view.h * k;
        const m = mid();
        const r = this.svg.getBoundingClientRect();
        const fx = (m.x - r.left) / r.width, fy = (m.y - r.top) / r.height;
        this.setViewBox(this.#clamp({ x: start.c.x - w * fx, y: start.c.y - h * fy, w, h }));
      } else if (pts.size === 1) {
        const u = this.#toUser(e.clientX, e.clientY);
        // pan only once zoomed in; at full extent a drag would just fight the clamp
        if (this.view.w < this.home.w - 1) {
          this.setViewBox(this.#clamp({
            ...this.view,
            x: start.view.x + (start.u.x - u.x),
            y: start.view.y + (start.u.y - u.y),
          }));
        }
      }
      e.preventDefault();
    }, { passive: false });

    const end = (e) => {
      const wasTap = pts.size === 1 && moved < TAP_SLOP && Date.now() - t0 < TAP_TIME;
      pts.delete(e.pointerId);
      if (!pts.size) start = null;
      if (!wasTap || !this.picking) return;
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const path = hit && hit.closest && hit.closest('path.comarca');
      if (path && this.onPick) this.onPick(path.dataset.code);
    };
    this.svg.addEventListener('pointerup', end);
    this.svg.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); start = null; });

    // wheel zoom, so it is testable on a laptop too
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      const u = this.#toUser(e.clientX, e.clientY);
      const w = this.view.w * k, h = this.view.h * k;
      const r = this.svg.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      this.setViewBox(this.#clamp({ x: u.x - w * fx, y: u.y - h * fy, w, h }));
    }, { passive: false });
  }
}
