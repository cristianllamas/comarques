// Builds the questions for Fase 2.
//
// Four types, covering both directions of both facets. Typing is the default because
// generating an answer is what makes retrieval practice work; the climb-down in app.js
// is what stops that turning into repeated failure.

// Catalan articles are irregular, so they come from the data (the topic's hints), not a
// guess.
//   nominative: l'Alt Camp / el Berguedà / la Selva / les Garrigues / Osona
//   genitive:   de l'Alt Camp / del Berguedà / de la Selva / de les Garrigues / d'Osona
const ART = { l: "l'", el: 'el ', la: 'la ', les: 'les ', els: 'els ', cap: '' };
const GEN = { l: "de l'", el: 'del ', la: 'de la ', les: 'de les ', els: 'dels ' };

// No article: "de" elides before a vowel or a silent h — d'Osona, d'Alemanya, d'Hongria —
// but not before a consonant: de França, de Malta.
const de = (name) => (/^h?[aeiouàèéíïòóúü]/i.test(name) ? "d'" : 'de ');

const sentenceCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const withArticle = (place) => (ART[place.art] ?? '') + place.name;
/** "Sabadell / Terrassa" -> ['Sabadell', 'Terrassa']: two capitals, both accepted. */
export const capitals = (place) => String(place.capital || '').split('/').map((s) => s.trim()).filter(Boolean);
// Plural names take a plural verb: "On són les Garrigues?", "On són els Països Baixos?"
const isPlural = (place) => place.art === 'les' || place.art === 'els';
export const genitive = (place) => (GEN[place.art] ?? de(place.name)) + place.name;

export function buildQuestion(entry, topic, rnd = Math.random) {
  const c = topic.byCode.get(entry.code);

  if (entry.facet === 'lloc') {
    // A: name given, tap it on the map.  D: shape highlighted, name it.
    return rnd() < 0.65
      ? { kind: 'tap-map', code: c.code, prompt: `On ${isPlural(c) ? 'són' : 'és'} <b>${withArticle(c)}</b>?`,
          answer: c.name, hint: c.hook }
      : { kind: 'name-shape', code: c.code, prompt: topic.words.whichShape,
          answer: c.name, accepta: c.accNom, hint: c.hook };
  }

  // B: place -> capital.  C: capital -> place (the reverse is a separate memory).
  const caps = capitals(c);
  const capPrompt = caps.length > 1
    ? `${caps.map((x) => `<b>${sentenceCase(x)}</b>`).join(' i ')} ${topic.words.capitalsOfWhich}`
    : `<b>${sentenceCase(c.capital)}</b> ${topic.words.capitalOfWhich}`;
  return rnd() < 0.6
    ? { kind: 'capital-of', code: c.code,
        prompt: caps.length > 1 ? `Quines són les capitals <b>${genitive(c)}</b>? (n’hi ha prou amb una)`
          : `Quina és la capital <b>${genitive(c)}</b>?`,
        answer: c.capital, accepta: c.accepta, hint: c.hook }
    : { kind: 'comarca-of', code: c.code,
        // Place names keep their lowercase article ("el Pont de Suert"), but it still
        // has to be capitalised when it opens the sentence.
        prompt: capPrompt,
        answer: c.name, accepta: c.accNom, hint: c.hook };
}

/** Four plausible options for the final rung of the climb-down. */
export function options(question, topic, codes, rnd = Math.random) {
  const wantsCapital = question.kind === 'capital-of';
  const pick = (code) => (wantsCapital ? topic.byCode.get(code).capital : topic.byCode.get(code).name);
  const correct = pick(question.code);
  const pool = codes.filter((k) => k !== question.code).map(pick).filter(Boolean);

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
