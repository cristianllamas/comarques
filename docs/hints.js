// Hand-written memory hooks, one per comarca. Keyed by the comarca code used in geo.js.
//
// These are deliberately short and concrete — a landmark, a river, a thing the place is
// known for. The point is to give the brain something to hang the name on, not to teach
// geography. Written from the Catalan Wikipedia intros pulled by build/fetch-hints.mjs.
//
// `accepta` lists extra answers the matcher should treat as correct for that capital.
// `art` is the comarca's definite article, which is irregular in Catalan and has to be
// stated rather than guessed: l'Alt Camp, el Berguedà, la Selva, les Garrigues — and
// Osona, which takes none at all ('cap').

export const HINTS = {
  '01': { art: 'l', hook: 'Els Xiquets de Valls, els castellers més antics. Terra de calçots.' },
  '02': { art: 'l', hook: 'El Teatre-Museu Dalí. Tramuntana, Costa Brava nord i frontera amb França.' },
  '03': { art: 'l', hook: 'Capital del vi i del cava. Els Castellers de Vilafranca.' },
  '04': { art: 'l', hook: "Catedral romànica de Santa Maria. El bisbe d'Urgell és copríncep d'Andorra." },
  '05': { art: 'l', hook: 'Les esglésies romàniques de la Vall de Boí, Patrimoni Mundial.' },
  '06': { art: 'l', hook: 'Ciutat de la pell i les adoberies. El Museu de la Pell.' },
  '07': { art: 'el', hook: 'La Seu i la cova de Sant Ignasi, damunt el Cardener. Montserrat i la sal de Cardona.' },
  '08': { art: 'el', hook: 'Gaudí hi va néixer. Ciutat del vermut i del modernisme.' },
  '09': { art: 'el', hook: "L'Ebre i el castell de la Suda. Porta del Delta." },
  '10': { art: 'el', hook: 'Terrissa i ceràmica. Darrere hi ha la Costa Brava: Palafrugell, Begur, Calella.' },
  '11': { art: 'el', hook: "El delta del Llobregat i l'aeroport. Corona industrial de Barcelona." },
  '12': { art: 'el', hook: 'Pau Casals hi va néixer. Platges de Coma-ruga i Sant Salvador.' },
  '13': { art: 'el', hook: 'La comarca més petita i la més poblada. Sagrada Família, Montjuïc, el Tibidabo.' },
  '14': { art: 'el', hook: 'La Patum, Patrimoni Immaterial de la Humanitat. Als peus del Pedraforca.' },
  '15': { art: 'la', hook: "Gran vall pirinenca i assolellada. Llívia és un enclavament dins França." },
  '16': { art: 'la', hook: 'Muralles medievals. A tocar hi ha el monestir de Poblet.' },
  '17': { art: 'el', hook: 'Al costat de Sitges i del massís del Garraf. Port i carnaval.' },
  '18': { art: 'les', hook: "Terra de l'oli d'oliva arbequina." },
  '19': { art: 'la', hook: 'La zona volcànica: més de quaranta volcans. A prop, Besalú medieval.' },
  '20': { art: 'el', hook: 'El Call jueu, la catedral i les cases de colors sobre l’Onyar.' },
  '21': { art: 'el', hook: "El primer ferrocarril de la península hi va arribar el 1848. Maduixes i flors." },
  '22': { art: 'el', hook: "El Delta de l'Ebre i els arrossars. Al fons, els Ports." },
  '23': { art: 'la', hook: 'El Segre i el Montsec, un dels millors cels estrellats del país.' },
  '24': { art: 'cap', hook: 'La plaça major i els embotits. La plana i la boira.' },
  '25': { art: 'el', hook: 'El congost de Mont-rebei i el pantà de Sant Antoni.' },
  '26': { art: 'el', hook: "Ràfting a la Noguera Pallaresa. Porta d'Aigüestortes." },
  '27': { art: 'el', hook: "Comarca ben plana, regada pel canal d'Urgell." },
  '28': { art: 'el', hook: "L'estany de Banyoles, on es va remar als Jocs del 92." },
  '29': { art: 'el', hook: 'Vins DOQ sobre llicorella, sota el Montsant. La cartoixa d’Escaladei.' },
  '30': { art: 'la', hook: "L'Ebre travessa la comarca de dalt a baix. Flix i Ascó." },
  '31': { art: 'el', hook: 'El monestir de Santa Maria, bressol de Catalunya. Amunt, la vall de Núria.' },
  '32': { art: 'la', hook: 'La vella universitat borbònica. Terra de secà i de cereal.' },
  '33': { art: 'el', hook: 'La Seu Vella dalt del turó. Fruita dolça i la plana del Segre.' },
  '34': { art: 'la', hook: 'Aigües termals a Caldes de Malavella. A la costa, Lloret i Blanes.' },
  '35': { art: 'el', hook: 'Els gegants més antics de Catalunya. Muntanya, sal i aigua.' },
  '36': { art: 'el', hook: 'Tàrraco romana: amfiteatre, muralles i el Pont del Diable.' },
  '37': { art: 'la', hook: "La batalla de l'Ebre i el celler modernista. Terra de vent." },
  '38': { art: 'l', hook: 'La Fira de Teatre al Carrer. Secà, oli i cereal.' },
  '39': { art: 'l', hook: "L'única comarca de vessant atlàntic. S'hi parla aranès." },
  '40': { art: 'el', hook: 'Dues capitals: Sabadell i Terrassa. El vapor i la indústria tèxtil.',
          accepta: ['Sabadell', 'Terrassa'] },
  '41': { art: 'el', hook: 'El Montseny a sobre i el circuit de Montmeló al mig.' },
  '42': { art: 'el', hook: 'Comarca nova (2015). Les coves del Toll; Rafael Casanova hi va néixer.' },
  '43': { art: 'el', hook: "La comarca més nova: es va separar d'Osona el 2023." },
};
