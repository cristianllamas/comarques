// Builds the questions for Fase 2.
//
// Four types, covering both directions of both facets — plus, for the seas, which ocean
// each one belongs to, asked in one direction only. Typing is the default because
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
/** "Sabadell / Terrassa" -> ['Sabadell', 'Terrassa']: two capitals (or three), all accepted. */
export const capitals = (place) => String(place.capital || '').split('/').map((s) => s.trim()).filter(Boolean);
/** ['A', 'B', 'C'] -> "A, B i C" */
export const andList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}` : xs.join(''));
/** A name as it opens a line: "mar Negre" -> "Mar Negre". Comarques and countries are unchanged. */
export const display = (name) => sentenceCase(String(name || ''));
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

  if (entry.facet === 'ocea') {
    // Only one direction: "which sea belongs to the Atlàntic?" has many right answers.
    return { kind: 'ocean-of', code: c.code,
      prompt: `A quin oceà pertany <b>${withArticle(c)}</b>?`,
      answer: c.ocea, accepta: [`oceà ${c.ocea}`], hint: c.hook };
  }

  // B: place -> capital.  C: capital -> place (the reverse is a separate memory).
  const caps = capitals(c);
  const capPrompt = caps.length > 1
    ? `${andList(caps.map((x) => `<b>${sentenceCase(x)}</b>`))} ${topic.words.capitalsOfWhich}`
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
  const field = { 'capital-of': 'capital', 'ocean-of': 'ocea' }[question.kind] || 'name';
  const pick = (code) => topic.byCode.get(code)[field];
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
