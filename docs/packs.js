// Content packs: what the learner picked on the first screen.
//
// A pack is a topic (the map and the places on it, see topics.js) plus the facets it
// asks about. Two packs can share a topic — "Comarques" is the comarques map without the
// capital questions — and each pack keeps its own progress, because knowing where the
// Bages is says nothing about whether you know its capital.

// Listed in this order on the pack picker, under the heading of their `group`.
export const GROUPS = ['Catalunya', 'Espanya', 'Europa', 'Món'];

export const PACKS = [
  {
    id: 'comarques-capitals', topic: 'cat', facets: ['lloc', 'capital'], group: 'Catalunya',
    title: 'Comarques i capitals',
    desc: 'On és cada comarca de Catalunya i quina és la seva capital.',
  },
  {
    id: 'comarques', topic: 'cat', facets: ['lloc'], group: 'Catalunya',
    title: 'Comarques',
    desc: 'On és cada comarca de Catalunya.',
  },
  {
    id: 'comunitats', topic: 'esp', facets: ['lloc', 'capital'], group: 'Espanya',
    title: 'Comunitats autònomes',
    desc: 'Les comunitats autònomes d’Espanya i les seves capitals, amb Ceuta i Melilla.',
  },
  {
    id: 'ue', topic: 'ue', facets: ['lloc', 'capital'], group: 'Europa',
    title: 'Unió Europea',
    desc: 'Els 27 països de la Unió Europea i les seves capitals.',
  },
  {
    id: 'africa', topic: 'afr', facets: ['lloc', 'capital'], group: 'Món',
    title: 'Àfrica',
    desc: 'Els 54 països d’Àfrica i les seves capitals, amb el Sàhara Occidental.',
  },
  {
    id: 'america-nord', topic: 'amn', facets: ['lloc', 'capital'], group: 'Món',
    title: 'Amèrica del Nord i Central',
    desc: 'Els països d’Amèrica del Nord, l’Amèrica Central i el Carib, amb Groenlàndia i Puerto Rico, i les seves capitals.',
  },
  {
    id: 'america-sud', topic: 'ams', facets: ['lloc', 'capital'], group: 'Món',
    title: 'Amèrica del Sud',
    desc: 'Els 12 països d’Amèrica del Sud i la Guaiana Francesa, amb les seves capitals.',
  },
  {
    id: 'asia', topic: 'asi', facets: ['lloc', 'capital'], group: 'Món',
    title: 'Àsia',
    desc: 'Els països d’Àsia i les seves capitals, de Turquia al Japó i de Rússia a Indonèsia.',
  },
  {
    id: 'oceans', topic: 'oce', facets: ['lloc'], group: 'Món',
    title: 'Oceans',
    desc: 'Els cinc oceans del món.',
  },
  {
    id: 'mars', topic: 'mar', facets: ['lloc', 'ocea'], group: 'Món',
    title: 'Mars i golfs',
    desc: 'Els principals mars i golfs del món, i l’oceà al qual pertany cadascun.',
  },
];

export const packById = (id) => PACKS.find((p) => p.id === id) || null;
