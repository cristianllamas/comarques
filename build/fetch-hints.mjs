// Pulls the Catalan Wikipedia intro for every comarca and its capital, as raw material
// for the hand-written memory hooks in build/hints.js. Text only — no images are
// fetched (auto-picked photos proved unreliable: `Berguedà` returns the comarca flag,
// not a landmark). Output is a scratch file for me to read, never shipped to the app.
//
// Run: node build/fetch-hints.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { COMARQUES } from '../docs/geo.js';

const API = 'https://ca.wikipedia.org/w/api.php';

async function extracts(titles) {
  const url = `${API}?action=query&format=json&prop=extracts&exintro=1&explaintext=1&redirects=1`
    + `&titles=${titles.map(encodeURIComponent).join('|')}&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': 'comarques-study-app/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { query } = await res.json();
  const out = new Map();
  const norm = new Map((query.normalized || []).map((n) => [n.to, n.from]));
  const redir = new Map((query.redirects || []).map((r) => [r.to, r.from]));
  for (const p of Object.values(query.pages || {})) {
    const original = redir.get(p.title) ?? norm.get(p.title) ?? p.title;
    out.set(original, (p.extract || '').replace(/\s+/g, ' ').trim());
  }
  return out;
}

const chunk = (a, n) => a.length ? [a.slice(0, n), ...chunk(a.slice(n), n)] : [];

const wanted = [...new Set(COMARQUES.flatMap((c) => [c.name, c.capital]))];
const found = new Map();
for (const group of chunk(wanted, 20)) {
  for (const [k, v] of await extracts(group)) found.set(k, v);
  process.stdout.write('.');
}
console.log(` fetched ${found.size}/${wanted.length}`);

const lines = COMARQUES.map((c) => {
  const cm = found.get(c.name) || '';
  const cp = found.get(c.capital) || '';
  return `### ${c.name} — ${c.capital} (${c.provincia})\n`
    + `COMARCA: ${cm.slice(0, 700)}\n`
    + `CAPITAL: ${cp.slice(0, 500)}\n`;
});
writeFileSync('data/hints.raw.md', lines.join('\n'));
console.log('written data/hints.raw.md');

const missing = COMARQUES.filter((c) => !found.get(c.name));
if (missing.length) console.warn('no article for:', missing.map((m) => m.name).join(', '));
