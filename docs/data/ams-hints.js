// Hand-written content for South America: 12 states plus the Guaiana Francesa. Keyed by
// the GISCO country code used in ams-geo.js (GF is cut out of France by the build).
//
// Field meanings as in afr-hints.js.

export const HINTS = {
  AR: { name: 'Argentina', capital: 'Buenos Aires', art: 'l',
        hook: 'El tango, les pampes i la Patagònia. L’Aconcagua, a prop de la frontera amb Xile, és la muntanya més alta d’Amèrica.',
        nota: 'L’Argentina reclama les illes Malvines, administrades pel Regne Unit, que surten en gris al mapa.' },
  BO: { name: 'Bolívia', capital: 'Sucre / La Paz', art: 'cap',
        hook: 'Sense mar, als Andes. El llac Titicaca i el salar d’Uyuni, el desert de sal més gran del món.',
        nota: 'Sucre és la capital segons la Constitució; La Paz és la seu del govern i del Parlament, i molts mapes la posen com a capital. Les dues respostes valen.' },
  BR: { name: 'Brasil', capital: 'Brasília', art: 'el',
        hook: 'El país més gran d’Amèrica del Sud, amb la selva de l’Amazones. La capital és Brasília, una ciutat nova, no Rio de Janeiro.' },
  CL: { name: 'Xile', capital: 'Santiago de Xile', art: 'cap', accepta: ['Santiago'],
        hook: 'Una franja llarguíssima i estreta entre els Andes i el Pacífic. Al nord, el desert d’Atacama, el més sec del món fora dels pols.' },
  CO: { name: 'Colòmbia', capital: 'Bogotà', art: 'cap', accepta: ['Bogota'],
        hook: 'Té costa a l’oceà Pacífic i al mar Carib, i és famós pel cafè. Rep el nom de Cristòfor Colom.' },
  EC: { name: 'Equador', capital: 'Quito', art: 'l',
        hook: 'Rep el nom de la línia de l’equador, que el travessa. Les illes Galápagos, on Darwin va estudiar les tortugues i els pinsans.' },
  GF: { name: 'Guaiana Francesa', capital: 'Caiena', art: 'la', accepta: ['Cayenne'], accNom: ['Guaiana', 'Guayana Francesa'],
        hook: 'Des de Kourou s’enlairen els coets europeus Ariane. Hi fan servir l’euro.',
        nota: 'No és un país independent: és una regió de França, i per tant part de la Unió Europea.' },
  GY: { name: 'Guyana', capital: 'Georgetown', art: 'cap',
        hook: 'L’únic país d’Amèrica del Sud on la llengua oficial és l’anglès. Les cascades de Kaieteur.',
        nota: 'Veneçuela reclama la regió de l’Essequibo, a l’oest del riu del mateix nom, que Guyana administra.' },
  PY: { name: 'Paraguai', capital: 'Asunción', art: 'el', accepta: ['Asunció', 'Assumpció'],
        hook: 'Sense mar, al cor del continent. Hi parlen guaraní a més d’espanyol, i la presa d’Itaipú és de les més grans del món.' },
  PE: { name: 'Perú', capital: 'Lima', art: 'el',
        hook: 'El Machu Picchu, la ciutat dels inques dalt dels Andes. Comparteix el llac Titicaca amb Bolívia.' },
  SR: { name: 'Surinam', capital: 'Paramaribo', art: 'cap', accNom: ['Suriname'],
        hook: 'El país més petit d’Amèrica del Sud. Va ser colònia holandesa i hi parlen neerlandès.' },
  UY: { name: 'Uruguai', capital: 'Montevideo', art: 'l', accNom: ['Uruguay'],
        hook: 'Un país petit entre l’Argentina i el Brasil, vora el Riu de la Plata. Va guanyar el primer Mundial de futbol, el 1930.' },
  VE: { name: 'Veneçuela', capital: 'Caracas', art: 'cap', accNom: ['Venezuela'],
        hook: 'El Salto Ángel, la cascada més alta del món, i les reserves de petroli més grans. Té costa al Carib.' },
};
