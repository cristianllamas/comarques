// Simulates a week of study to prove the scheduler actually covers the material:
// every comarca must be met several times, and nothing may be scheduled to reappear
// only after the exam. Run: node build/sim-scheduler.mjs

import { COMARQUES } from '../docs/geo.js';
import { grade, markStudied, selectDue, selectExamMode, keyOf, newItem, progress, FACETS }
  from '../docs/scheduler.js';

const H = 3600e3, D = 24 * H;
const start = Date.UTC(2026, 8, 23, 7, 0);
const exam = start + 7 * D;
const codes = COMARQUES.map((c) => c.code);
const HOURS = (process.env.HOURS || '8,16,21').split(',').map(Number);

const state = { items: {} };
const shown = new Map();
let asked = 0, right = 0;

// A learner who actually learns: each item has a latent strength that grows with every
// exposure (more from a success than a failure) and a difficulty that decides how fast.
// Seeded so the run is reproducible.
let seed = 20260923;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const difficulty = new Map(codes.flatMap((c) => FACETS.map((f) =>
  [keyOf(c, f), 1.2 + rnd() * 2.6])));
const strength = new Map(codes.flatMap((c) => FACETS.map((f) => [keyOf(c, f), 0])));

function answer(key) {
  const s = strength.get(key), d = difficulty.get(key);
  const p = Math.max(0.05, Math.min(0.97, 0.1 + 0.88 * (1 - Math.exp(-s / d))));
  const ok = rnd() < p;
  strength.set(key, s + (ok ? 1 : 0.45)); // a corrected mistake still teaches
  return ok;
}

for (let day = 0; day < 7; day++) {
  for (const hour of HOURS) {
    const now = start + day * D + (hour - 7) * H;
    const examMode = exam - now <= D;
    // A real session is Fase 1 (6 study cards) then Fase 2 (12 questions).
    const picks = examMode
      ? selectExamMode(state, codes, 12)
      : selectDue(state, codes, 18, now);

    const study = examMode ? [] : picks.slice(0, 6);
    for (const p of study) {
      state.items[p.key] = markStudied(state.items[p.key] || newItem(), now);
      strength.set(p.key, strength.get(p.key) + 0.55); // seeing the answer helps
      shown.set(p.key, (shown.get(p.key) || 0) + 1);
    }

    for (const p of (examMode ? picks : picks.slice(0, 12))) {
      const it = state.items[p.key] || newItem();
      const ok = answer(p.key);
      state.items[p.key] = grade(it, ok, now, exam);
      shown.set(p.key, (shown.get(p.key) || 0) + 1);
      asked++; if (ok) right++;
    }
  }
}

const keys = codes.flatMap((c) => FACETS.map((f) => keyOf(c, f)));
const never = keys.filter((k) => !shown.has(k));
const thin = keys.filter((k) => (shown.get(k) || 0) < 3);
const late = keys.filter((k) => (state.items[k]?.due ?? 0) > exam);

const counts = keys.map((k) => shown.get(k) || 0);
const p = progress(state, codes);

console.log(`sessions      ${21 / 3 * HOURS.length} (${HOURS.length}/day x 7 days), ${asked} questions asked, ${Math.round(100 * right / asked)}% correct
items         ${keys.length} (${codes.length} comarques x ${FACETS.length} facets)
exposures     min ${Math.min(...counts)}, median ${counts.sort((a, b) => a - b)[counts.length >> 1]}, max ${Math.max(...counts)}
progress      ${p.solid}/${p.total} solid (${p.pct}%), ${p.seen} seen, ${p.leeches} leeches`);

const fail = [];
if (never.length) fail.push(`${never.length} item(s) never shown`);
if (thin.length) fail.push(`${thin.length} item(s) shown fewer than 3 times`);
if (late.length) fail.push(`${late.length} item(s) scheduled after the exam`);
if (p.seen !== p.total) fail.push(`${p.total - p.seen} item(s) never seen`);

if (process.env.DEBUG) {
  const worst = keys.map((k) => ({ k, n: shown.get(k) || 0, ...state.items[k] }))
    .sort((a, b) => a.n - b.n).slice(0, 12);
  console.log('\nleast-shown items:');
  for (const w of worst)
    console.log(`  ${w.k.padEnd(12)} shown ${w.n}  box ${w.box}  wrong ${w.wrong}  first-seen-session?`);
}

console.log(fail.length ? '\nFAIL: ' + fail.join('; ') : '\nPASS: every item covered >=3 times, nothing scheduled past the exam');
process.exit(fail.length ? 1 : 0);
