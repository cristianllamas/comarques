// Hand-written content for the 17 comunitats autònomes and the 2 ciutats autònomes.
// Keyed by the Eurostat NUTS-2 code used in esp-geo.js.
//
// Names and capitals are the Catalan forms (Optimot / IEC). GISCO names are Spanish, so
// this file is the source of truth for them, and build/fetch-geo-esp.mjs refuses to build
// if a region in the geometry has no entry here.
//
// `art`: the article the name takes in a sentence (el País Basc, la Rioja, les Illes
// Balears; Catalunya and Aragó take none). `accepta` / `accNom`: extra accepted answers
// for the capital / the name, including the official long names.
// `capital: null` (Ceuta, Melilla): a city that is its own capital is never asked about it.
// `preguntaCapital: false`: the capital is on the card but never asked, because it is
// the same name as the comunitat (Madrid, Múrcia) — the same rule as Luxembourg.
// Two capitals separated by " / " are both accepted (Canàries); `etiqueta` is a shorter
// form for the study-map label, where both full names would not fit.
// `nota`: a line of context on the card.

export const HINTS = {
  ES11: { name: 'Galícia', capital: 'Santiago de Compostel·la', art: 'cap',
          accepta: ['Santiago de Compostela', 'Santiago'],
          hook: 'El Camí de Sant Jaume acaba a la catedral de Santiago. Pluja, marisc i el cap de Fisterra.' },
  ES12: { name: 'Astúries', capital: 'Oviedo', art: 'cap', accNom: ['Principat d’Astúries'],
          hook: 'Els Picos de Europa i la sidra que s’aboca des de dalt. Oviedo té una catedral gòtica.' },
  ES13: { name: 'Cantàbria', capital: 'Santander', art: 'cap',
          hook: 'Les pintures rupestres de la cova d’Altamira. Santander té la platja del Sardinero.' },
  ES21: { name: 'País Basc', capital: 'Vitòria', art: 'el',
          accNom: ['Euskadi', 'Comunitat Autònoma del País Basc'],
          accepta: ['Vitòria-Gasteiz', 'Vitoria', 'Gasteiz'],
          hook: 'El museu Guggenheim de Bilbao i l’euskera. La capital, Vitòria, és a l’interior, no a la costa.' },
  ES22: { name: 'Navarra', capital: 'Pamplona', art: 'cap', accNom: ['Comunitat Foral de Navarra'],
          accepta: ['Iruña', 'Iruñea'],
          hook: 'Els Sanfermines de Pamplona, al juliol, amb els encierros pels carrers.' },
  ES23: { name: 'Rioja', capital: 'Logronyo', art: 'la', accepta: ['Logroño'],
          hook: 'La comunitat més petita de la península, terra de vi. A Logronyo, el carrer del Laurel i les tapes.' },
  ES24: { name: 'Aragó', capital: 'Saragossa', art: 'cap', accepta: ['Zaragoza'],
          hook: 'La basílica del Pilar a Saragossa, vora l’Ebre. Fa frontera amb Catalunya, a l’oest.' },
  ES30: { name: 'Comunitat de Madrid', capital: 'Madrid', art: 'la', accNom: ['Madrid'],
          preguntaCapital: false,
          hook: 'Just al centre de la península, amb la capital d’Espanya: el Prado, el Retiro i la Puerta del Sol.' },
  ES41: { name: 'Castella i Lleó', capital: 'Valladolid', art: 'cap',
          hook: 'La comunitat més gran d’Espanya. L’aqüeducte de Segòvia, les muralles d’Àvila i la catedral de Burgos.' },
  ES42: { name: 'Castella-la Manxa', capital: 'Toledo', art: 'cap', accNom: ['Castella la Manxa'],
          hook: 'La terra del Quixot i dels molins de vent. Toledo, la ciutat de les tres cultures, damunt el Tajo.' },
  ES43: { name: 'Extremadura', capital: 'Mèrida', art: 'cap', accepta: ['Mérida'],
          hook: 'Fa frontera amb Portugal. Mèrida té un teatre romà on encara es fan espectacles.' },
  ES51: { name: 'Catalunya', capital: 'Barcelona', art: 'cap',
          hook: 'Quatre províncies: Barcelona, Girona, Lleida i Tarragona. A Barcelona, la Sagrada Família.' },
  ES52: { name: 'Comunitat Valenciana', capital: 'València', art: 'la', accNom: ['País Valencià'],
          accepta: ['Valencia'],
          hook: 'Les Falles, la paella i la Ciutat de les Arts i les Ciències de València.' },
  ES53: { name: 'Illes Balears', capital: 'Palma', art: 'les', accNom: ['Balears'],
          accepta: ['Palma de Mallorca'],
          hook: 'Mallorca, Menorca, Eivissa i Formentera. Palma té una catedral gòtica davant del mar.' },
  ES61: { name: 'Andalusia', capital: 'Sevilla', art: 'cap',
          hook: 'La comunitat més poblada. L’Alhambra de Granada i la Giralda de Sevilla.' },
  ES62: { name: 'Regió de Múrcia', capital: 'Múrcia', art: 'la', accNom: ['Múrcia'],
          preguntaCapital: false,
          hook: 'L’horta de Múrcia i el Mar Menor, una gran llacuna d’aigua salada.' },
  ES63: { name: 'Ceuta', capital: null, art: 'cap', nota: 'Ciutat autònoma',
          hook: 'Ciutat autònoma al nord de l’Àfrica, a l’altra banda de l’estret de Gibraltar.' },
  ES64: { name: 'Melilla', capital: null, art: 'cap', nota: 'Ciutat autònoma',
          hook: 'Ciutat autònoma a la costa nord de l’Àfrica, més a l’est que Ceuta, plena d’edificis modernistes.' },
  ES70: { name: 'Canàries', capital: 'Las Palmas de Gran Canaria / Santa Cruz de Tenerife', art: 'les',
          accNom: ['Illes Canàries'], accepta: ['Las Palmas', 'Santa Cruz'], etiqueta: 'Las Palmas i Santa Cruz',
          nota: 'Al mapa, en un requadre: de debò són a l’Atlàntic, davant de l’Àfrica.',
          hook: 'Illes volcàniques davant l’Àfrica, amb dues capitals. El Teide, a Tenerife, és el cim més alt d’Espanya.' },
};
