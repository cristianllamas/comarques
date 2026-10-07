// Leitner scheduler with short boxes.
//
// Deliberately NOT FSRS/SM-2. Those schedule in days-to-months and optimise retention
// at six months; for school geography studied over a week or two they would show most
// places once and then go quiet. The boxes below start at minutes and top out at eight
// days, so a session always has something worth asking.

const MIN = 60 * 1000;
const BOX_MINUTES = [20, 120, 480, 1440, 2880, 5760, 11520]; // 20m, 2h, 8h, 1d, 2d, 4d, 8d
const LEECH_WRONG = 3;      // failures before an item is force-fed
const COOLDOWN = 12 * MIN;  // don't show the same item twice in one sitting

// A session: up to 6 study cards (Fase 1) and 12 questions (Fase 2), on different places.
export const STUDY_CARDS = 6;
export const QUIZ_CARDS = 12;
// A session picks each place at most once, so a small pack (the five oceans) gets fewer
// than 18 picks. Fase 1 then takes a third of them, never all: otherwise the oceans would
// be all study and no questions. Every pack of 18 places or more is unaffected.
export const studyCount = (picks) => Math.min(STUDY_CARDS, Math.floor(picks / 3));

export const keyOf = (code, facet) => `${code}:${facet}`;

export function newItem() {
  return { box: 0, due: 0, seen: 0, wrong: 0, streak: 0, last: 0 };
}

/** Grade an answer and return the updated item. Pure — callers persist the result. */
export function grade(item, correct, now) {
  const next = { ...item, seen: item.seen + 1, last: now };
  if (correct) {
    next.box = Math.min(item.box + 1, BOX_MINUTES.length - 1);
    next.streak = item.streak + 1;
  } else {
    // Textbook Leitner sends a failure all the way back to box 1. Over a week or two
    // that wipes out progress faster than it can be rebuilt and nothing ever reads as
    // learned, so a miss costs two boxes rather than all of them.
    next.box = Math.max(0, item.box - 2);
    next.wrong = item.wrong + 1;
    next.streak = 0;
  }
  next.due = now + BOX_MINUTES[next.box] * MIN;
  return next;
}

/** Fase 1 exposure: counts as having been met, but does not move the box. */
export function markStudied(item, now) {
  return { ...item, seen: item.seen + 1, last: now };
}

export const isLeech = (item) => item.wrong >= LEECH_WRONG;
export const isSolid = (item) => item.box >= 3;

/**
 * The order new items are introduced in, shuffled once and then kept.
 *
 * Without it new items came out in code order, which is alphabetical: every learner
 * started with the Alt Camp and the Alts, and the two facets of a place came out back
 * to back. Kept in the pack's state so reopening the app does not reshuffle; keys that
 * appear later (a toggle switched on) are shuffled in at the end.
 */
export function ensureOrder(state, keys, rnd = Math.random) {
  const have = new Set(state.order || []);
  const fresh = keys.filter((k) => !have.has(k));
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }
  state.order = [...(state.order || []), ...fresh];
  return state.order;
}

/**
 * Pick what to work on, most urgent first, never the same place twice.
 *  - unseen items come first until everything has been met once (coverage before drill)
 *  - then leeches, then whatever is most overdue
 *  - if nothing is due, fall back to the items closest to due so a session is never empty
 *
 * `pairs` is the list of { code, facet } the pack asks about. One place appears at most
 * once per session: Fase 1 and Fase 2 must work on different places, and a session that
 * shows the same card twice is padding.
 */
export function selectDue(state, pairs, limit, now) {
  const all = pairs.map(({ code, facet }) => {
    const key = keyOf(code, facet);
    return { key, code, facet, item: state.items[key] || newItem() };
  });

  // Anything touched in the last few minutes is part of the sitting he is in now;
  // showing it again immediately is padding, not practice.
  const cool = (e) => now - e.item.last >= COOLDOWN;

  const rank = new Map((state.order || []).map((k, i) => [k, i]));
  const unseen = all.filter((e) => e.item.seen === 0)
    .sort((a, b) => (rank.get(a.key) ?? Infinity) - (rank.get(b.key) ?? Infinity));
  const due = all.filter((e) => e.item.seen > 0 && e.item.due <= now && cool(e));
  const rest = all.filter((e) => e.item.seen > 0 && e.item.due > now && cool(e));

  // Coverage dominates, box is the tie-break. With only a handful of exposures per item
  // available, meeting every place matters more than perfecting any one of them.
  //
  // Two earlier orderings failed the simulation in build/sim-scheduler.mjs:
  //   box*10 + seen*4  — anything answered right once climbed to box 1 and was then
  //                      permanently outranked by the crowd of box-0 items, so 16 items
  //                      were shown only once all week.
  //   box first        — a few leeches monopolised every session (one item appeared 21
  //                      times while 61 others were shown fewer than 3 times).
  const urgency = (e) =>
    e.item.seen * 10
    + e.item.box * 4
    - (isLeech(e.item) ? 15 : 0);

  const byUrgency = (a, b) => (urgency(a) - urgency(b)) || (a.item.due - b.item.due);
  due.sort(byUrgency);
  rest.sort((a, b) => a.item.due - b.item.due);

  const out = [];
  const used = new Set();
  const skipUsed = (list, i) => { while (i < list.length && used.has(list[i].code)) i++; return i; };
  const take = (e) => { out.push(e); used.add(e.code); };

  // Interleave unseen with due work rather than front-loading every new item, so a
  // session always mixes "meet something new" with "prove you still know the old".
  let u = 0, d = 0;
  while (out.length < limit) {
    u = skipUsed(unseen, u); d = skipUsed(due, d);
    const haveU = u < unseen.length, haveD = d < due.length;
    if (!haveU && !haveD) break;
    take(haveU && (out.length % 3 !== 2 || !haveD) ? unseen[u++] : due[d++]);
  }
  for (const e of rest) {
    if (out.length >= limit) break;
    if (!used.has(e.code)) take(e);
  }
  return out;
}

export function progress(state, pairs) {
  let solid = 0, seen = 0, leeches = 0;
  for (const { code, facet } of pairs) {
    const it = state.items[keyOf(code, facet)] || newItem();
    if (it.seen > 0) seen++;
    if (isSolid(it)) solid++;
    if (isLeech(it)) leeches++;
  }
  const total = pairs.length;
  return { solid, total, seen, leeches, pct: total ? Math.round((100 * solid) / total) : 0 };
}
