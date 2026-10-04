// Topics: a map and the places on it, in one shape the rest of the app can use without
// knowing which map it is.
//
// Each topic is assembled from its files in data/: the generated geometry, the
// hand-written content (articles, hooks, accepted spellings) and the generated photo
// list. They are loaded on demand, so opening one pack does not download every map.
//
// A place looks like:
//   { code, name, capital, art, hook, accepta, accNom, photo, credit, extra, label, area, d, mark? }
// `capital` may be null (a place that is its own capital is never asked about it), and
// `askCapital: false` shows the capital on the card without ever asking it.
// `accepta` / `accNom` are extra accepted answers for the capital / the place's name.
// `credit` is { caption, author, license, source } for a photo from Wikimedia Commons.
// `extra` is a line of plain context for the card, e.g. the província.
// `mark` is set on places too small to see or tap at full extent; the map draws a ring.
//
// A topic may also carry `context`: non-tappable shapes drawn in grey around the places
// (the countries around the EU), and `borders`: thicker lines over them (províncies).

const loaders = {
  async cat() {
    // The photo module is imported whole: CREDITS only exists once photos come with one.
    const [{ VIEWBOX, COMARQUES, PROVINCIES, OSONA_MERGED }, { HINTS }, { PHOTOS, CREDITS = {} }] =
      await Promise.all([
        import('./data/cat-geo.js'), import('./data/cat-hints.js'), import('./data/cat-photos.js'),
      ]);
    return {
      id: 'cat',
      viewBox: VIEWBOX,
      places: COMARQUES.map((c) => {
        const h = HINTS[c.code] || {};
        return {
          code: c.code, name: c.name, capital: c.capital,
          art: h.art, hook: h.hook, accepta: h.accepta || [], accNom: [],
          photo: PHOTOS[c.code] ? `img/cat/${PHOTOS[c.code]}` : null, credit: CREDITS[c.code] || null,
          extra: `Província: ${c.provincia}`
            + (c.provinciaNota ? ` <span class="nota">(${c.provinciaNota})</span>` : ''),
          label: c.label, area: c.area, d: c.d,
        };
      }),
      // drawn over the places as thicker lines, never tappable
      borders: PROVINCIES.map((p) => p.d),
      words: {
        many: 'comarques',
        whichShape: 'Quina comarca és la destacada?',
        capitalOfWhich: 'és la capital de quina comarca?',
        placeholder: 'La comarca…',
        tapToSee: 'Toca una comarca per veure-la de prop.',
        tapHelp: 'Toca-la al mapa. Pots fer zoom amb dos dits.',
        wrongTap: (name) => `Aquesta és <b>${name}</b>. La que buscaves és aquesta.`,
      },
      // Lluçanès only exists since 2023. Off means the pre-2023 map: Lluçanès hidden and
      // Osona drawn with it dissolved back in, so no stray border is left behind.
      toggle: {
        label: 'Incloure el Lluçanès',
        note: 'El Lluçanès es va crear el 2023 separant-se d’Osona. Molts llibres encara no el '
          + 'compten: si el teu és d’abans, deixa-ho desmarcat (42 comarques).',
        whenOff: { hide: ['43'], replace: OSONA_MERGED },
      },
    };
  },

  async ue() {
    const [{ VIEWBOX, COUNTRIES, CONTEXT }, { HINTS }, { PHOTOS, CREDITS = {} }] = await Promise.all([
      import('./data/ue-geo.js'), import('./data/ue-hints.js'), import('./data/ue-photos.js'),
    ]);
    return {
      id: 'ue',
      viewBox: VIEWBOX,
      places: COUNTRIES.map((c) => {
        const h = HINTS[c.code];
        return {
          code: c.code, name: h.name, capital: h.capital,
          art: h.art, hook: h.hook, accepta: h.accepta || [], accNom: h.accNom || [],
          askCapital: h.preguntaCapital !== false,
          photo: PHOTOS[c.code] ? `img/ue/${PHOTOS[c.code]}` : null, credit: CREDITS[c.code] || null,
          extra: null,
          label: c.label, area: c.area, d: c.d, mark: c.mark,
        };
      }).sort((a, b) => a.name.localeCompare(b.name, 'ca')),
      context: [CONTEXT],
      borders: [],
      words: {
        many: 'països',
        whichShape: 'Quin país és el destacat?',
        capitalOfWhich: 'és la capital de quin país?',
        placeholder: 'El país…',
        tapToSee: 'Toca un país per veure’l de prop.',
        tapHelp: 'Toca’l al mapa. Pots fer zoom amb dos dits.',
        wrongTap: (name) => `Aquest és <b>${name}</b>. El que buscaves és aquest.`,
      },
    };
  },
};

const cache = new Map();

export function loadTopic(id) {
  if (!loaders[id]) return Promise.reject(new Error(`unknown topic ${id}`));
  if (!cache.has(id)) {
    cache.set(id, loaders[id]().then((t) => ({ ...t, byCode: new Map(t.places.map((p) => [p.code, p])) })));
  }
  return cache.get(id);
}

/** Codes in play right now: everything, minus what the topic's toggle hides when off. */
export function activeCodes(topic, toggleOn) {
  const hidden = new Set(!toggleOn && topic.toggle ? topic.toggle.whenOff.hide : []);
  return topic.places.map((p) => p.code).filter((c) => !hidden.has(c));
}

/** The (code, facet) pairs a pack asks about. A place whose capital is not asked has no capital facet. */
export function activePairs(topic, pack, toggleOn) {
  return activeCodes(topic, toggleOn).flatMap((code) => pack.facets
    .filter((f) => f !== 'capital'
      || (topic.byCode.get(code).capital && topic.byCode.get(code).askCapital !== false))
    .map((facet) => ({ code, facet })));
}
