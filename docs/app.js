import { VIEWBOX, COMARQUES, PROVINCIES } from './geo.js';

const app = document.getElementById('app');
const svgns = 'http://www.w3.org/2000/svg';
const el = (n, attrs = {}) => {
  const e = document.createElementNS(svgns, n);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

const svg = el('svg', { viewBox: VIEWBOX, class: 'mapa' });
const gCom = el('g');
for (const c of COMARQUES) {
  const p = el('path', { d: c.d, class: 'comarca' });
  p.dataset.code = c.code;
  gCom.append(p);
}
const gProv = el('g');
for (const p of PROVINCIES) gProv.append(el('path', { d: p.d, class: 'provincia' }));
svg.append(gCom, gProv);

app.replaceChildren(svg);
console.log(`${COMARQUES.length} comarques carregades`);
