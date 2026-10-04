// Hand-written content for the 27 member states of the European Union. Keyed by the
// Eurostat/GISCO country code used in ue-geo.js (note Greece is EL, not GR).
//
// Names and capitals are the Catalan forms (Optimot / IEC). Unlike the comarques they do
// not come from the geometry file — GISCO names are English — so this file is the
// source of truth for them, and build/fetch-geo-ue.mjs refuses to build if a country in
// the geometry has no entry here.
//
// `art` is the article the name takes in a sentence. Almost every country takes none
// (França, d'Alemanya), but a few do: els Països Baixos, la República Txeca.
// `accepta` lists extra accepted answers for the capital; `accNom` for the country.

export const HINTS = {
  DE: { name: 'Alemanya', capital: 'Berlín', art: 'cap',
        hook: 'El país més poblat de la UE. A Berlín, la porta de Brandenburg i les restes del Mur.' },
  AT: { name: 'Àustria', capital: 'Viena', art: 'cap',
        hook: 'Els Alps, els valsos i la Sachertorte. A Viena, el palau de Schönbrunn.' },
  BE: { name: 'Bèlgica', capital: 'Brussel·les', art: 'cap',
        hook: "Xocolata, gofres i còmics com Tintín. A Brussel·les hi ha l'Atomium i la Comissió Europea." },
  BG: { name: 'Bulgària', capital: 'Sofia', art: 'cap',
        hook: "El iogurt búlgar i l'oli de rosa. A Sofia, la catedral d'Alexandre Nevski, de cúpules daurades." },
  CY: { name: 'Xipre', capital: 'Nicòsia', art: 'cap',
        hook: "Illa del Mediterrani oriental, on la llegenda diu que va néixer Afrodita. Nicòsia és una capital dividida en dues." },
  HR: { name: 'Croàcia', capital: 'Zagreb', art: 'cap',
        hook: "Les muralles de Dubrovnik i mil illes a l'Adriàtic. A Zagreb, l'església de Sant Marc té la teulada de colors." },
  DK: { name: 'Dinamarca', capital: 'Copenhaguen', art: 'cap',
        hook: 'El país del Lego. A Copenhaguen, la Sireneta i les cases de colors de Nyhavn.' },
  SK: { name: 'Eslovàquia', capital: 'Bratislava', art: 'cap',
        hook: 'Amb Txèquia formava Txecoslovàquia. Bratislava, sobre el Danubi, té un castell blanc de quatre torres.' },
  SI: { name: 'Eslovènia', capital: 'Ljubljana', art: 'cap',
        hook: 'El llac de Bled, amb una illa i una església al mig. Ljubljana té un drac com a símbol.' },
  ES: { name: 'Espanya', capital: 'Madrid', art: 'cap',
        hook: 'Ocupa la major part de la península Ibèrica. Madrid és just al centre: el Prado i la Puerta del Sol.' },
  EE: { name: 'Estònia', capital: 'Tallinn', art: 'cap',
        hook: 'La més al nord de les tres repúbliques bàltiques. Tallinn conserva la muralla i les torres medievals.' },
  FI: { name: 'Finlàndia', capital: 'Hèlsinki', art: 'cap',
        hook: 'Terra de llacs i de saunes. A Lapònia, Rovaniemi diu ser el poble del Pare Noel.' },
  FR: { name: 'França', capital: 'París', art: 'cap',
        hook: 'El veí del nord, a l’altra banda dels Pirineus. A París, la torre Eiffel i el Louvre.' },
  EL: { name: 'Grècia', capital: 'Atenes', art: 'cap',
        hook: "Bressol dels Jocs Olímpics i de la democràcia. A Atenes, l'Acròpoli i el Partenó." },
  HU: { name: 'Hongria', capital: 'Budapest', art: 'cap',
        hook: 'Budapest són dues ciutats unides pel Danubi: Buda i Pest. El cub de Rubik és hongarès.' },
  IE: { name: 'Irlanda', capital: 'Dublín', art: 'cap',
        hook: "L'illa verda: el trèvol i Sant Patrici. Dublín mira cap a la Gran Bretanya, a l'est." },
  IT: { name: 'Itàlia', capital: 'Roma', art: 'cap',
        hook: 'Té forma de bota. A Roma hi ha el Colosseu, i dins la ciutat, un altre país: el Vaticà.' },
  LV: { name: 'Letònia', capital: 'Riga', art: 'cap',
        hook: 'La del mig de les tres repúbliques bàltiques. Riga és la ciutat més gran dels països bàltics.' },
  LT: { name: 'Lituània', capital: 'Vílnius', art: 'cap',
        hook: "La més al sud de les tres repúbliques bàltiques. El bàsquet hi és l'esport nacional." },
  LU: { name: 'Luxemburg', capital: 'Luxemburg', art: 'cap', accepta: ['Ciutat de Luxemburg'],
        hook: 'Un dels països més petits de la UE, i la capital es diu igual que el país.' },
  MT: { name: 'Malta', capital: 'la Valletta', art: 'cap',
        hook: 'El país més petit de la UE: unes illes al mig del Mediterrani. La Valletta és tota emmurallada.' },
  NL: { name: 'Països Baixos', capital: 'Amsterdam', art: 'els', accNom: ['Holanda'],
        hook: 'Molins, tulipes i bicicletes, i una quarta part del país sota el nivell del mar. Amsterdam és plena de canals.' },
  PL: { name: 'Polònia', capital: 'Varsòvia', art: 'cap',
        hook: 'Marie Curie i Chopin hi van néixer. Varsòvia es va reconstruir després de la Segona Guerra Mundial.' },
  PT: { name: 'Portugal', capital: 'Lisboa', art: 'cap',
        hook: "El veí de l'oest, a la costa atlàntica. A Lisboa, els tramvies grocs i la torre de Belém." },
  CZ: { name: 'República Txeca', capital: 'Praga', art: 'la', accNom: ['Txèquia'],
        hook: 'Amb Eslovàquia formava Txecoslovàquia. Praga té el pont de Carles i un rellotge astronòmic medieval.' },
  RO: { name: 'Romania', capital: 'Bucarest', art: 'cap',
        hook: 'Els Carpats i la llegenda de Dràcula, a Transsilvània. A Bucarest, el Palau del Parlament, enorme.' },
  SE: { name: 'Suècia', capital: 'Estocolm', art: 'cap',
        hook: 'IKEA, ABBA i els premis Nobel. Estocolm està construïda sobre catorze illes.' },
};
