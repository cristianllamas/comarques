// Topics: a map and the places on it, in one shape the rest of the app can use without
// knowing which map it is.
//
// Each topic is assembled from its files in data/: the generated geometry, the
// hand-written content (articles, hooks, accepted spellings) and the generated photo
// list. They are loaded on demand, so opening one pack does not download every map.
//
// A place looks like:
//   { code, name, capital, art, hook, accepta, photo, extra, label, area, d }
// `capital` may be null (a place that is its own capital is never asked about it).
// `extra` is a line of plain context for the card, e.g. the província.

const loaders = {
  async cat() {
    const [{ VIEWBOX, COMARQUES, PROVINCIES, OSONA_MERGED }, { HINTS }, { PHOTOS }] =
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
          art: h.art, hook: h.hook, accepta: h.accepta || [],
          photo: PHOTOS[c.code] ? `img/cat/${PHOTOS[c.code]}` : null,
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

/** The (code, facet) pairs a pack asks about. A place without a capital has no capital facet. */
export function activePairs(topic, pack, toggleOn) {
  return activeCodes(topic, toggleOn).flatMap((code) => pack.facets
    .filter((f) => f !== 'capital' || topic.byCode.get(code).capital)
    .map((facet) => ({ code, facet })));
}
