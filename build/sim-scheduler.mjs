// Simulates a week of study for every content pack, to prove the scheduler actually
// covers the material: every item must be met several times, and no session may show
// the same place twice. Run: node build/sim-scheduler.mjs
//
// HOURS=8,13,17,21 varies the sessions per day; PACK=comarques runs a single pack.

import { PACKS } from '../docs/packs.js';
import { loadTopic, activePairs } from '../docs/topics.js';
import { grade, markStudied, selectDue, ensureOrder, keyOf, newItem, progress }
  from '../docs/scheduler.js';

const H = 3600e3, D = 24 * H;
const start = Date.UTC(2026, 8, 23, 7, 0);
const HOURS = (process.env.HOURS || '8,16,21').split(',').map(Number);
const DAYS = 7;
const STUDY = 6, QUIZ = 12;

let failed = 0;

for (const pack of PACKS.filter((p) => !process.env.PACK || p.id === process.env.PACK)) {
  const topic = await loadTopic(pack.topic);
  const pairs = activePairs(topic, pack, false); // the default: toggle off
  const keys = pairs.map((p) => keyOf(p.code, p.facet));

  const state = { items: {}, order: [] };
  const shown = new Map();
  let asked = 0, right = 0, repeats = 0;

  // A learner who actually learns: each item has a latent strength that grows with every
  // exposure (more from a success than a failure) and a difficulty that decides how fast.
  // Seeded so the run is reproducible.
  let seed = 20260923;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  ensureOrder(state, keys, rnd);

  const difficulty = new Map(keys.map((k) => [k, 1.2 + rnd() * 2.6]));
  const strength = new Map(keys.map((k) => [k, 0]));

  const answer = (key) => {
    const s = strength.get(key), d = difficulty.get(key);
    const p = Math.max(0.05, Math.min(0.97, 0.1 + 0.88 * (1 - Math.exp(-s / d))));
    const ok = rnd() < p;
    strength.set(key, s + (ok ? 1 : 0.45)); // a corrected mistake still teaches
    return ok;
  };

  for (let day = 0; day < DAYS; day++) {
    for (const hour of HOURS) {
      const now = start + day * D + (hour - 7) * H;
      // A real session is Fase 1 (6 study cards) then Fase 2 (12 questions).
      const picks = selectDue(state, pairs, STUDY + QUIZ, now);
      if (new Set(picks.map((p) => p.code)).size !== picks.length) repeats++;

      for (const p of picks.slice(0, STUDY)) {
        state.items[p.key] = markStudied(state.items[p.key] || newItem(), now);
        strength.set(p.key, strength.get(p.key) + 0.55); // seeing the answer helps
        shown.set(p.key, (shown.get(p.key) || 0) + 1);
      }
      for (const p of picks.slice(STUDY)) {
        const ok = answer(p.key);
        state.items[p.key] = grade(state.items[p.key] || newItem(), ok, now);
        shown.set(p.key, (shown.get(p.key) || 0) + 1);
        asked++; if (ok) right++;
      }
    }
  }

  const never = keys.filter((k) => !shown.has(k));
  const thin = keys.filter((k) => (shown.get(k) || 0) < 3);
  const counts = keys.map((k) => shown.get(k) || 0).sort((a, b) => a - b);
  const p = progress(state, pairs);

  console.log(`\n${pack.title}  [${pack.id}]
  sessions    ${DAYS * HOURS.length} (${HOURS.length}/day x ${DAYS} days), ${asked} questions asked, ${Math.round(100 * right / asked)}% correct
  items       ${keys.length} (${new Set(pairs.map((x) => x.code)).size} places x ${pack.facets.join('+')})
  exposures   min ${counts[0]}, median ${counts[counts.length >> 1]}, max ${counts[counts.length - 1]}
  progress    ${p.solid}/${p.total} solid (${p.pct}%), ${p.seen} seen, ${p.leeches} leeches`);

  const fail = [];
  if (never.length) fail.push(`${never.length} item(s) never shown`);
  if (thin.length) fail.push(`${thin.length} item(s) shown fewer than 3 times`);
  if (repeats) fail.push(`${repeats} session(s) showed the same place twice`);

  if (process.env.DEBUG) {
    const worst = keys.map((k) => ({ k, n: shown.get(k) || 0, ...state.items[k] }))
      .sort((a, b) => a.n - b.n).slice(0, 12);
    console.log('  least-shown items:');
    for (const w of worst) console.log(`    ${w.k.padEnd(12)} shown ${w.n}  box ${w.box}  wrong ${w.wrong}`);
  }

  console.log(fail.length ? '  FAIL: ' + fail.join('; ')
    : '  PASS: every item covered >=3 times, no place twice in a session');
  if (fail.length) failed++;
}

process.exit(failed ? 1 : 0);
