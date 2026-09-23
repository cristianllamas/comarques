// Forgiving answer matching.
//
// The point of the exercise is recalling the place, not spelling it under pressure on a
// phone keyboard. So accents, capitals, apostrophes and leading articles are all
// ignored, and a small edit distance is tolerated — but only enough to absorb a typo,
// never enough to let a different place through (`Vic` must not pass for `Berga`).

export const normalise = (s) => String(s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/^(els|les|el|la|l)['’\s_-]+/, '')
  .replace(/['’·.,]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

function distance(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** How much misspelling to forgive: short names get less slack than long ones. */
const tolerance = (n) => (n <= 4 ? 0 : n <= 7 ? 1 : 2);

/**
 * @param input  what he typed
 * @param answer the official name (may be a dual capital, "Sabadell / Terrassa")
 * @param extra  additional accepted spellings from hints.js
 */
export function isCorrect(input, answer, extra = []) {
  const got = normalise(input);
  if (!got) return false;
  const accepted = [...String(answer).split('/').map((s) => s.trim()), ...extra]
    .map(normalise).filter(Boolean);
  return accepted.some((a) => got === a || distance(got, a) <= tolerance(a.length));
}

/**
 * Progressive reveal:  "Berga" -> "B _ _ _ _"
 * A leading article is shown in full and the reveal moves to the next word, because
 * uncovering the "l" of "la Seu d'Urgell" tells him nothing.
 */
export function masked(answer) {
  const first = String(answer).split('/')[0].trim();
  const m = first.match(/^(els|les|el|la|l['’])\s*/i);
  const head = m ? m[0] : '';
  const body = first.slice(head.length);
  const revealed = body.split('').map((ch, i) =>
    (i === 0 ? ch : /\s/.test(ch) ? '\u00a0\u00a0' : '_')).join(' ');
  return (head + revealed).trim();
}
