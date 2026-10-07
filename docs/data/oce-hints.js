// Hand-written content for the five oceans. The shapes are built by
// build/fetch-geo-mar.mjs from the IHO sea areas, each ocean with its marginal seas.
//
// Names keep the generic noun in lower case, as in running Catalan text (l'oceà Pacífic);
// the app capitalises it where it opens a line, and accepts the bare name ("Pacífic").

export const HINTS = {
  PAC: { name: 'oceà Pacífic', art: 'l',
         hook: 'El més gran i el més profund: ocupa un terç del planeta. Hi ha la fossa de les Marianes, a 11 km de fondària.' },
  ATL: { name: 'oceà Atlàntic', art: 'l',
         hook: 'El segon més gran, entre Amèrica i Europa i Àfrica. El van travessar Colom i el Titanic. Hi pertany el Mediterrani.' },
  IND: { name: 'oceà Índic', art: 'l',
         hook: 'El tercer, i el més càlid: entre Àfrica, Àsia i Austràlia. Banya l’Índia, que li dona nom.' },
  ART: { name: 'oceà Àrtic', art: 'l',
         hook: 'El més petit i el més fred, al voltant del pol Nord. Gran part de l’any està cobert de gel.' },
  ANT: { name: 'oceà Antàrtic', art: 'l', accNom: ['oceà Austral', 'Austral', 'oceà Glacial Antàrtic'],
         hook: 'Envolta l’Antàrtida, al sud del paral·lel 60. També es diu oceà Austral; és el més nou a ser reconegut com a oceà.' },
};
