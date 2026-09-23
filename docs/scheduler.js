// Leitner scheduler, compressed to the exam window.
//
// Deliberately NOT FSRS/SM-2. Those schedule in days-to-months and optimise retention
// at six months; with an exam seven days out they would show most comarques once and
// then go quiet. Research on the lag effect puts the optimal gap for a ~7-day retention
// delay at roughly a day, so the boxes below top out at two days and every interval is
// clipped so nothing is ever scheduled to reappear after the exam.

const MIN = 60 * 1000;
const BOX_MINUTES = [20, 120, 480, 1440, 2880]; // 20m, 2h, 8h, 1d, 2d
const LEECH_WRONG = 3;      // failures before an item is force-fed
const CLIP_BEFORE_EXAM = 6 * 60; // minutes: last chance to resurface
const COOLDOWN = 12 * MIN;  // don't show the same item twice in one sitting

export const FACETS = ['lloc', 'capital'];
export const keyOf = (code, facet) => `${code}:${facet}`;

export function newItem() {
  return { box: 0, due: 0, seen: 0, wrong: 0, streak: 0, last: 0 };
}

/** Grade an answer and return the updated item. Pure — callers persist the result. */
export function grade(item, correct, now, examTime) {
  const next = { ...item, seen: item.seen + 1, last: now };
  if (correct) {
    next.box = Math.min(item.box + 1, BOX_MINUTES.length - 1);
    next.streak = item.streak + 1;
  } else {
    // Textbook Leitner sends a failure all the way back to box 1. Over a single week
    // that wipes out progress faster than it can be rebuilt and nothing ever reads as
    // learned, so a miss costs two boxes rather than all of them.
    next.box = Math.max(0, item.box - 2);
    next.wrong = item.wrong + 1;
    next.streak = 0;
  }
  let due = now + BOX_MINUTES[next.box] * MIN;

  // Nothing sleeps past the exam: if the interval would land after it, pull the item
  // back so he still sees it at least once beforehand.
  if (examTime) {
    const latest = examTime - CLIP_BEFORE_EXAM * MIN;
    if (due > latest) due = Math.max(now + 20 * MIN, latest);
  }
  next.due = due;
  return next;
}

/** Fase 1 exposure: counts as having been met, but does not move the box. */
export function markStudied(item, now) {
  return { ...item, seen: item.seen + 1, last: now };
}

export const isLeech = (item) => item.wrong >= LEECH_WRONG;
export const isSolid = (item) => item.box >= 3;

/**
 * Pick what to work on, most urgent first.
 *  - unseen items come first until everything has been met once (coverage before drill)
 *  - then leeches, then whatever is most overdue
 *  - if nothing is due, fall back to the items closest to due so a session is never empty
 */
export function selectDue(state, codes, limit, now) {
  const all = [];
  for (const code of codes) {
    for (const facet of FACETS) {
      const k = keyOf(code, facet);
      all.push({ key: k, code, facet, item: state.items[k] || newItem() });
    }
  }

  // Anything touched in the last few minutes is part of the sitting he is in now;
  // showing it again immediately is padding, not practice.
  const cool = (e) => now - e.item.last >= COOLDOWN;

  const unseen = all.filter((e) => e.item.seen === 0);
  const due = all.filter((e) => e.item.seen > 0 && e.item.due <= now && cool(e));
  const rest = all.filter((e) => e.item.seen > 0 && e.item.due > now && cool(e));

  // Coverage dominates, box is the tie-break. That ordering is specific to a one-week
  // cram: with only ~4 exposures per item available in the whole week, meeting every
  // comarca matters more than perfecting any one of them.
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

  // Interleave unseen with due work rather than front-loading all 86 new items, so a
  // session always mixes "meet something new" with "prove you still know the old".
  const out = [];
  let u = 0, d = 0;
  while (out.length < limit && (u < unseen.length || d < due.length)) {
    if (u < unseen.length && (out.length % 3 !== 2 || d >= due.length)) out.push(unseen[u++]);
    else if (d < due.length) out.push(due[d++]);
  }
  for (let i = 0; out.length < limit && i < rest.length; i++) out.push(rest[i]);
  return out;
}

/** Final day: forget scheduling, drill the weakest first. */
export function selectExamMode(state, codes, limit) {
  const all = [];
  for (const code of codes) for (const facet of FACETS) {
    const k = keyOf(code, facet);
    all.push({ key: k, code, facet, item: state.items[k] || newItem() });
  }
  all.sort((a, b) => {
    const score = (e) => e.item.box - (isLeech(e.item) ? 5 : 0) - (e.item.seen === 0 ? 3 : 0);
    return score(a) - score(b);
  });
  return all.slice(0, limit);
}

export function progress(state, codes) {
  let solid = 0, total = 0, seen = 0, leeches = 0;
  for (const code of codes) for (const facet of FACETS) {
    const it = state.items[keyOf(code, facet)] || newItem();
    total++;
    if (it.seen > 0) seen++;
    if (isSolid(it)) solid++;
    if (isLeech(it)) leeches++;
  }
  return { solid, total, seen, leeches, pct: Math.round((100 * solid) / total) };
}
