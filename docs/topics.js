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
// (the countries around the EU), `borders`: thicker lines over them (províncies), and
// `insets`: framed boxes for places drawn away from their real position (Canàries).
//
// A capital written "A / B" is two capitals, both accepted (Canàries, Vallès Occidental).
//
// The world topics add: `markR`, a smaller tap ring where rings would overlap (the
// Antilles); `focus`, the box to zoom to for a place split by the map's edge (the
// Pacific); `ocea`, the ocean a sea belongs to; and, for the water maps, `water`, a
// `cover` layer (the land, drawn over the water) and a `credit` line for the data.

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
        capitalsOfWhich: 'són les capitals de quina comarca?',
        placeholder: 'La comarca…',
        tapToSee: 'Toca una comarca per veure-la de prop.',
        tapHelp: 'Toca-la al mapa. Pots fer zoom amb dos dits.',
        wrongTap: (name) => `Has tocat <b>${name}</b>. La que buscaves és aquesta.`,
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
        capitalsOfWhich: 'són les capitals de quin país?',
        placeholder: 'El país…',
        tapToSee: 'Toca un país per veure’l de prop.',
        tapHelp: 'Toca’l al mapa. Pots fer zoom amb dos dits.',
        wrongTap: (name) => `Has tocat <b>${name}</b>. El que buscaves és aquest.`,
      },
    };
  },

  async esp() {
    const [{ VIEWBOX, REGIONS, CONTEXT, INSET }, { HINTS }, { PHOTOS, CREDITS = {} }] = await Promise.all([
      import('./data/esp-geo.js'), import('./data/esp-hints.js'), import('./data/esp-photos.js'),
    ]);
    return {
      id: 'esp',
      viewBox: VIEWBOX,
      places: REGIONS.map((c) => {
        const h = HINTS[c.code];
        return {
          code: c.code, name: h.name, capital: h.capital,
          art: h.art, hook: h.hook, accepta: h.accepta || [], accNom: h.accNom || [],
          askCapital: h.preguntaCapital !== false, capitalLabel: h.etiqueta,
          photo: PHOTOS[c.code] ? `img/esp/${PHOTOS[c.code]}` : null, credit: CREDITS[c.code] || null,
          extra: h.nota || null,
          label: c.label, area: c.area, d: c.d, mark: c.mark,
        };
      }).sort((a, b) => a.name.localeCompare(b.name, 'ca')),
      context: [CONTEXT],
      insets: [INSET],
      borders: [],
      words: {
        many: 'comunitats i ciutats autònomes',
        // Neutral on purpose: "quina comunitat" would be wrong for Ceuta and Melilla, and
        // naming them "ciutat autònoma" would give the answer away.
        whichShape: 'Quina comunitat o ciutat autònoma és la destacada?',
        capitalOfWhich: 'és la capital de quina comunitat autònoma?',
        capitalsOfWhich: 'són les capitals de quina comunitat autònoma?',
        placeholder: 'La comunitat…',
        tapToSee: 'Toca una comunitat per veure-la de prop.',
        tapHelp: 'Toca-la al mapa. Pots fer zoom amb dos dits.',
        wrongTap: (name) => `Has tocat <b>${name}</b>. La que buscaves és aquesta.`,
      },
    };
  },
};

// ---------------------------------------------------------------- the world
//
// The continents share one shape of data (afr, amn, ams, asi: *-geo.js from
// build/fetch-geo-mon.mjs) and differ only in their words. Oceans and seas are water
// places on a world map, with the land drawn over them as `cover`.

const COUNTRY_WORDS = {
  many: 'països',
  whichShape: 'Quin país és el destacat?',
  capitalOfWhich: 'és la capital de quin país?',
  capitalsOfWhich: 'són les capitals de quin país?',
  placeholder: 'El país…',
  tapToSee: 'Toca un país per veure’l de prop.',
  tapHelp: 'Toca’l al mapa. Pots fer zoom amb dos dits.',
  wrongTap: (name) => `Has tocat <b>${name}</b>. El que buscaves és aquest.`,
};

// Neutral where a place is not a country: Groenlàndia, Puerto Rico, the Guaiana Francesa,
// the Sàhara Occidental. "Quin país" would be wrong for them, and calling them anything
// else would give the answer away — as with Ceuta and Melilla.
const TERRITORY_WORDS = {
  ...COUNTRY_WORDS,
  many: 'països i territoris',
  whichShape: 'Quin país o territori és el destacat?',
  capitalOfWhich: 'és la capital de quin país o territori?',
  capitalsOfWhich: 'són les capitals de quin país o territori?',
};

// Places imported from a continent's geo file, whose geo export is COUNTRIES.
function continent(id, words) {
  return async () => {
    const [{ VIEWBOX, COUNTRIES, CONTEXT }, { HINTS }, { PHOTOS, CREDITS = {} }] = await Promise.all([
      import(`./data/${id}-geo.js`), import(`./data/${id}-hints.js`), import(`./data/${id}-photos.js`),
    ]);
    return {
      id,
      viewBox: VIEWBOX,
      places: COUNTRIES.map((c) => fromHints(id, c, HINTS[c.code], PHOTOS, CREDITS))
        .sort((a, b) => a.name.localeCompare(b.name, 'ca')),
      context: [CONTEXT],
      borders: [],
      words,
    };
  };
}

function fromHints(id, c, h, PHOTOS = {}, CREDITS = {}) {
  return {
    code: c.code, name: h.name, capital: h.capital ?? null,
    art: h.art, hook: h.hook, accepta: h.accepta || [], accNom: [...(h.accNom || []), ...bareName(h.name)],
    askCapital: h.preguntaCapital !== false, capitalLabel: h.etiqueta,
    ocea: h.ocea ?? null,
    photo: PHOTOS[c.code] ? `img/${id}/${PHOTOS[c.code]}` : null, credit: CREDITS[c.code] || null,
    extra: h.nota || null,
    label: c.label, area: c.area, d: c.d, mark: c.mark, markR: c.markR, focus: c.focus,
  };
}

/** "mar de Barents" also accepts "Barents"; "oceà Pacífic", "Pacífic". */
function bareName(name) {
  const m = String(name).match(/^(?:mar|golf|oceà)\s+(?:de la |de l['’]|del |de |d['’])?(.+)$/i);
  return m ? [m[1]] : [];
}

// The IHO sea areas are CC BY, so the water maps carry a credit line.
const WATER_CREDIT = 'Límits dels oceans i mars: Marine Regions (IHO Sea Areas), CC BY 4.0.';

Object.assign(loaders, {
  afr: continent('afr', TERRITORY_WORDS),
  amn: continent('amn', TERRITORY_WORDS),
  ams: continent('ams', TERRITORY_WORDS),
  asi: continent('asi', TERRITORY_WORDS),

  async oce() {
    const [{ VIEWBOX, OCEANS, CONTEXT, BORDERS }, { HINTS }, { LAND }] = await Promise.all([
      import('./data/oce-geo.js'), import('./data/oce-hints.js'), import('./data/terra-geo.js'),
    ]);
    return {
      id: 'oce', water: true, credit: WATER_CREDIT,
      viewBox: VIEWBOX,
      places: OCEANS.map((c) => fromHints('oce', c, HINTS[c.code])),
      context: [CONTEXT],
      cover: [LAND],
      borders: [BORDERS],
      words: {
        many: 'oceans',
        whichShape: 'Quin oceà és el destacat?',
        placeholder: 'L’oceà…',
        tapToSee: 'Toca un oceà per veure’l de prop.',
        tapHelp: 'Toca’l al mapa. Pots fer zoom amb dos dits.',
        wrongTap: (name) => `Has tocat <b>${name}</b>. El que buscaves és aquest.`,
      },
    };
  },

  async mar() {
    const [{ VIEWBOX, SEAS, BORDERS }, { OCEANS }, { HINTS }, { LAND }] = await Promise.all([
      import('./data/mar-geo.js'), import('./data/oce-geo.js'), import('./data/mar-hints.js'),
      import('./data/terra-geo.js'),
    ]);
    return {
      id: 'mar', water: true, credit: WATER_CREDIT,
      viewBox: VIEWBOX,
      places: SEAS.map((c) => fromHints('mar', c, HINTS[c.code]))
        .sort((a, b) => a.name.localeCompare(b.name, 'ca')),
      // The oceans, drawn as untappable water under the seas.
      context: OCEANS.map((o) => o.d),
      cover: [LAND],
      borders: [BORDERS],
      words: {
        many: 'mars i golfs',
        // Neutral: "quin mar" would be wrong for the gulfs, and give the answer away.
        whichShape: 'Quin mar o golf és el destacat?',
        placeholder: 'El mar…',
        oceanPlaceholder: 'L’oceà…',
        tapToSee: 'Toca un mar per veure’l de prop.',
        tapHelp: 'Toca’l al mapa. Pots fer zoom amb dos dits.',
        wrongTap: (name) => `Has tocat <b>${name}</b>. El que buscaves és aquest.`,
      },
    };
  },
});

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

/**
 * The (code, facet) pairs a pack asks about. A place whose capital is not asked has no
 * capital facet; a sea with no ocean (the Caspi) has no ocean facet.
 */
export function activePairs(topic, pack, toggleOn) {
  const asks = (place, f) => (f === 'capital' ? place.capital && place.askCapital !== false
    : f === 'ocea' ? !!place.ocea : true);
  return activeCodes(topic, toggleOn).flatMap((code) => pack.facets
    .filter((f) => asks(topic.byCode.get(code), f))
    .map((facet) => ({ code, facet })));
}
