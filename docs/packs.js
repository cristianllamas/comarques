// Content packs: what the learner picked on the first screen.
//
// A pack is a topic (the map and the places on it, see topics.js) plus the facets it
// asks about. Two packs can share a topic — "Comarques" is the comarques map without the
// capital questions — and each pack keeps its own progress, because knowing where the
// Bages is says nothing about whether you know its capital.

export const PACKS = [
  {
    id: 'comarques-capitals', topic: 'cat', facets: ['lloc', 'capital'],
    title: 'Comarques i capitals',
    desc: 'On és cada comarca de Catalunya i quina és la seva capital.',
  },
  {
    id: 'comarques', topic: 'cat', facets: ['lloc'],
    title: 'Comarques',
    desc: 'On és cada comarca de Catalunya.',
  },
];

export const packById = (id) => PACKS.find((p) => p.id === id) || null;
