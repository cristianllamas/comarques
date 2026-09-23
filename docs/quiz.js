// Builds the questions for Fase 2.
//
// Four types, covering both directions of both facets. Typing is the default because
// generating an answer is what makes retrieval practice work; the climb-down in app.js
// is what stops that turning into repeated failure.

import { COMARQUES } from './geo.js';
import { HINTS } from './hints.js';

export const byCode = new Map(COMARQUES.map((c) => [c.code, c]));

// Catalan articles are irregular, so they come from the data (hints.js), not a guess.
//   nominative: l'Alt Camp / el Berguedà / la Selva / les Garrigues / Osona
//   genitive:   de l'Alt Camp / del Berguedà / de la Selva / de les Garrigues / d'Osona
const ART = { l: "l'", el: 'el ', la: 'la ', les: 'les ', cap: '' };
const GEN = { l: "de l'", el: 'del ', la: 'de la ', les: 'de les ', cap: "d'" };

const sentenceCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const withArticle = (code, name) => (ART[HINTS[code]?.art] ?? '') + name;
const genitive = (code, name) => (GEN[HINTS[code]?.art] ?? 'de ') + name;

export function buildQuestion(entry, rnd = Math.random) {
  const c = byCode.get(entry.code);
  const hint = HINTS[entry.code] || {};

  if (entry.facet === 'lloc') {
    // A: name given, tap it on the map.  D: shape highlighted, name it.
    return rnd() < 0.65
      ? { kind: 'tap-map', code: c.code, prompt: `On és <b>${withArticle(c.code, c.name)}</b>?`,
          answer: c.name, hint: hint.hook }
      : { kind: 'name-shape', code: c.code, prompt: 'Quina comarca és la destacada?',
          answer: c.name, accepta: [], hint: hint.hook };
  }

  // B: comarca -> capital.  C: capital -> comarca (the reverse is a separate memory).
  return rnd() < 0.6
    ? { kind: 'capital-of', code: c.code,
        prompt: `Quina és la capital <b>${genitive(c.code, c.name)}</b>?`,
        answer: c.capital, accepta: hint.accepta || [], hint: hint.hook }
    : { kind: 'comarca-of', code: c.code,
        // Place names keep their lowercase article ("el Pont de Suert"), but it still
        // has to be capitalised when it opens the sentence.
        prompt: `<b>${sentenceCase(c.capital)}</b> és la capital de quina comarca?`,
        answer: c.name, accepta: [], hint: hint.hook };
}

/** Four plausible options for the final rung of the climb-down. */
export function options(question, codes, rnd = Math.random) {
  const wantsCapital = question.kind === 'capital-of';
  const correct = wantsCapital ? byCode.get(question.code).capital : byCode.get(question.code).name;
  const pool = codes.filter((k) => k !== question.code)
    .map((k) => (wantsCapital ? byCode.get(k).capital : byCode.get(k).name));

  const picked = new Set([correct]);
  let guard = 0;
  while (picked.size < 4 && guard++ < 500) picked.add(pool[Math.floor(rnd() * pool.length)]);

  const out = [...picked];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
