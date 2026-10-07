// Fetches a recognisable landmark photo for every place in a topic, from Wikimedia
// Commons, with the author and licence needed to credit it.
//
// For each place the landmark is chosen by hand (LANDMARKS below, reviewed before
// fetching). The image is the one Wikidata's editors chose for that landmark (P18),
// falling back to the Wikipedia article's lead image; a landscape JPEG is preferred
// because the card crops to 4:3. Auto-picking the *place's* own lead image was tried
// for the comarques and gave flags and maps (see fetch-hints.mjs), hence landmarks.
//
// Writes photos/<topic>/<capital>.jpg and photos/<topic>/credits.json. Then run
// scan-photos.mjs, which resizes them into docs/ and ships the credits with them.
//
// `retall: 'cap'` shows that photo whole instead of cropped to 4:3 — for a tall photo
// whose bottom matters (León cathedral with the square in front of it).
//
// Existing files are kept; FORCE=1 refetches. To replace a rejected photo, set `file`
// on its entry to a specific Commons file name — an entry whose `file` no longer matches
// what was fetched is refetched automatically. The pinned files below replaced
// automatic picks that failed review (an empty square, a cropped tower, the wrong town).
//
// Run: node build/fetch-photos.mjs ue      (or esp, afr, amn, ams, asi)

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { loadTopic } from '../docs/topics.js';

// title: English Wikipedia article(s) for the landmark, tried in order.
// caption: shown under the photo — always names the city, so a landmark outside the
// capital (the Alhambra, the Guggenheim in Bilbao, León cathedral) is never mistaken
// for one in it. Several of these were chosen by the reviewer over a capital landmark.
const LANDMARKS = {
  ue: {
    DE: { title: 'Brandenburg Gate', caption: 'Porta de Brandenburg · Berlín' },
    AT: { title: 'Schönbrunn Palace', caption: 'Palau de Schönbrunn · Viena' },
    BE: { title: 'Atomium', caption: 'Atomium · Brussel·les' },
    BG: { title: 'Alexander Nevsky Cathedral, Sofia', caption: 'Catedral d’Alexandre Nevski · Sofia' },
    HR: { title: "St. Mark's Church, Zagreb", caption: 'Església de Sant Marc · Zagreb' },
    DK: { title: 'Nyhavn', caption: 'Nyhavn · Copenhaguen' },
    SK: { title: 'Bratislava Castle', caption: 'Castell de Bratislava' },
    SI: { title: 'Triple Bridge', caption: 'Pont Triple i església franciscana · Ljubljana',
          file: 'Franciscan Church of the Annunciation and the Triple Bridge in the Center of Ljubljana, Slovenia (36394158722).jpg' },
    ES: { title: 'Alhambra', caption: 'L’Alhambra · Granada' },
    EE: { title: 'Tallinn Town Hall', caption: 'Ajuntament · Tallinn', file: 'Tallinna Raekoda 11-06-2013.jpg' },
    FI: { title: 'Helsinki Cathedral', caption: 'Catedral de Hèlsinki' },
    FR: { title: 'Eiffel Tower', caption: 'Torre Eiffel · París', file: 'Eiffel tower from trocadero.jpg' },
    EL: { title: 'Acropolis of Athens', caption: 'L’Acròpoli · Atenes' },
    HU: { title: 'Hungarian Parliament Building', caption: 'Parlament d’Hongria · Budapest' },
    IE: { title: "Ha'penny Bridge", caption: 'Ha’penny Bridge · Dublín' },
    IT: { title: 'Colosseum', caption: 'Colosseu · Roma' },
    LV: { title: ['House of the Blackheads (Riga)', 'House of the Blackheads, Riga'], caption: 'Casa dels Caps Negres · Riga' },
    LT: { title: 'Vilnius Cathedral', caption: 'Catedral de Vílnius' },
    LU: { title: ['Bock (Luxembourg)', 'Casemates du Bock'], caption: 'El Grund i l’església de Sant Joan · Luxemburg',
          file: 'Luxembourg (LU), Grund und Église Saint-Jean -- 2023 -- 8133.jpg' },
    MT: { title: 'Grand Harbour', caption: 'La Valletta, vista des de Sliema',
          file: 'View of Valletta from across the bay at Sliema - panoramio.jpg' },
    NL: { title: ['Canals of Amsterdam', 'Grachtengordel'], caption: 'Cases del canal del Damrak · Amsterdam',
          file: 'Colorful canal houses at golden hour in Damrak avenue Amsterdam the Netherlands.jpg' },
    PL: { title: ['Old Town Market Place, Warsaw', 'Old Town Market Place (Warsaw)', 'Warsaw Old Town'], caption: 'Plaça del Mercat de la ciutat vella · Varsòvia' },
    PT: { title: 'Belém Tower', caption: 'Torre de Belém · Lisboa' },
    CZ: { title: 'Charles Bridge', caption: 'Pont de Carles · Praga' },
    RO: { title: 'Palace of the Parliament', caption: 'Palau del Parlament · Bucarest', file: 'Palace of the Parliament.jpg' },
    SE: { title: 'Gamla stan', caption: 'Gamla Stan · Estocolm' },
    CY: { title: ['Venetian walls of Nicosia', 'Walls of Nicosia'], caption: 'Muralles venecianes · Nicòsia' },
  },
  // The world packs: chosen without the owner's contact-sheet review (waived for this
  // round), then checked by eye. Natural landmarks name their region instead of a city.
  afr: {
    DZ: { title: 'Maqam Echahid', caption: 'Monument dels Màrtirs · Alger' },
    AO: { title: 'Fortress of São Miguel', caption: 'Fortalesa de São Miguel · Luanda' },
    BJ: { title: 'Ganvie', caption: 'Poble lacustre de Ganvié, vora Cotonou' },
    BW: { title: 'Okavango Delta', caption: 'Delta de l’Okavango' },
    BF: { title: 'Grand Mosque of Bobo-Dioulasso', caption: 'Gran Mesquita · Bobo-Dioulasso' },
    BI: { title: 'Lake Tanganyika', caption: 'Llac Tanganyika' },
    CV: { title: 'Pico do Fogo', caption: 'Volcà del Fogo · illa de Fogo' },
    CM: { title: 'Mount Cameroon', caption: 'Mont Camerun' },
    TD: { title: 'Ennedi Plateau', caption: 'Altiplà de l’Ennedi' },
    KM: { title: 'Mount Karthala', caption: 'Volcà Karthala · Gran Comora' },
    CG: { title: ['Basilica of Sainte-Anne-du-Congo', 'Basilique Sainte-Anne-du-Congo'], caption: 'Basílica de Santa Anna · Brazzaville' },
    CD: { title: 'Mount Nyiragongo', caption: 'Volcà Nyiragongo, vora Goma' },
    CI: { title: 'Basilica of Our Lady of Peace of Yamoussoukro', caption: 'Basílica de Nostra Senyora de la Pau · Yamoussoukro' },
    DJ: { title: 'Lake Assal (Djibouti)', caption: 'Llac Assal, el punt més baix d’Àfrica', file: 'Assal Lake, 2024.jpg' },
    EG: { title: 'Giza pyramid complex', caption: 'Piràmides de Gizeh, vora el Caire' },
    ER: { title: 'Fiat Tagliero Building', caption: 'Edifici Fiat Tagliero · Asmara' },
    SZ: { title: 'Sibebe', caption: 'Roca de Sibebe, vora Mbabane' },
    ET: { title: 'Church of Saint George, Lalibela', caption: 'Església de Sant Jordi · Lalibela' },
    GA: { title: 'Lopé National Park', caption: 'Parc Nacional de la Lopé' },
    GM: { title: 'Arch 22', caption: 'Arc 22 · Banjul' },
    GH: { title: 'Kwame Nkrumah Memorial Park', caption: 'Mausoleu de Kwame Nkrumah · Accra' },
    GN: { title: 'Grand Mosque of Conakry', caption: 'Gran Mesquita · Conakry' },
    GW: { title: 'Bissagos Islands', caption: 'Arxipèlag dels Bijagós' },
    GQ: { title: ['Malabo Cathedral', 'Santa Isabel Cathedral, Malabo', 'Malabo'], caption: 'Malabo, a l’illa de Bioko' },
    KE: { title: 'Maasai Mara', caption: 'Reserva de Masai Mara' },
    LS: { title: 'Maletsunyane Falls', caption: 'Cascades de Maletsunyane' },
    LR: { title: 'Ducor Hotel', caption: 'Antic hotel Ducor · Monròvia' },
    LY: { title: 'Leptis Magna', caption: 'Ruïnes romanes de Leptis Magna' },
    MG: { title: 'Avenue of the Baobabs', caption: 'Avinguda dels Baobabs' },
    MW: { title: 'Lake Malawi', caption: 'Llac Malawi' },
    ML: { title: 'Great Mosque of Djenné', caption: 'Gran Mesquita · Djenné' },
    MA: { title: 'Hassan Tower', caption: 'Torre Hassan · Rabat' },
    MU: { title: 'Le Morne Brabant', caption: 'Le Morne Brabant' },
    MR: { title: 'Chinguetti Mosque', caption: 'Mesquita de Chinguetti' },
    MZ: { title: 'Island of Mozambique', caption: 'Illa de Moçambic' },
    NA: { title: 'Sossusvlei', caption: 'Dunes de Sossusvlei, al desert del Namib' },
    NE: { title: ['Grand Mosque of Agadez', 'Agadez Mosque', 'Agadez'], caption: 'Gran Mesquita · Agadez' },
    NG: { title: 'Zuma Rock', caption: 'Roca Zuma, vora Abuja' },
    CF: { title: ['Boali Falls', 'Boali'], caption: 'Cascades de Boali' },
    RW: { title: 'Volcanoes National Park', caption: 'Parc Nacional dels Volcans' },
    EH: { title: ['Laayoune', 'Laâyoune'], caption: 'El Aaiun' },
    ST: { title: 'Pico Cão Grande', caption: 'Pico Cão Grande · illa de São Tomé' },
    SN: { title: 'African Renaissance Monument', caption: 'Monument de la Renaixença Africana · Dakar' },
    SC: { title: ["Anse Source d'Argent", 'La Digue'], caption: 'Anse Source d’Argent · illa de La Digue' },
    SL: { title: 'Freetown', caption: 'Freetown' },
    SO: { title: 'Laas Geel', caption: 'Pintures rupestres de Laas Geel' },
    ZA: { title: 'Table Mountain', caption: 'Muntanya de la Taula · Ciutat del Cap' },
    SS: { title: 'Juba', caption: 'Juba' },
    SD: { title: 'Meroë', caption: 'Piràmides de Meroe' },
    TZ: { title: 'Mount Kilimanjaro', caption: 'Kilimanjaro' },
    TG: { title: 'Koutammakou', caption: 'Koutammakou, terra dels batammariba' },
    TN: { title: 'Sidi Bou Said', caption: 'Sidi Bou Said, vora Tunis' },
    UG: { title: 'Murchison Falls', caption: 'Cascades Murchison' },
    ZM: { title: 'Victoria Falls', caption: 'Cascades Victòria' },
    ZW: { title: 'Great Zimbabwe', caption: 'Ruïnes del Gran Zimbàbue' },
  },
  amn: {
    AG: { title: "Nelson's Dockyard", caption: 'Drassanes de Nelson · English Harbour' },
    BS: { title: 'Exuma', caption: 'Illes Exuma' },
    BB: { title: 'Bathsheba, Barbados', caption: 'Bathsheba' },
    BZ: { title: 'Great Blue Hole', caption: 'Gran Forat Blau' },
    CA: { title: 'Parliament Hill', caption: 'Turó del Parlament · Ottawa' },
    CR: { title: 'Arenal Volcano', caption: 'Volcà Arenal' },
    CU: { title: 'El Capitolio', caption: 'El Capitoli · l’Havana' },
    DM: { title: 'Boiling Lake', caption: 'El llac que bull' },
    DO: { title: 'Alcázar de Colón', caption: 'Alcàsser de Colom · Santo Domingo' },
    SV: { title: 'Santa Ana Volcano', caption: 'Volcà de Santa Ana' },
    US: { title: 'United States Capitol', caption: 'El Capitoli · Washington' },
    GD: { title: ["St. George's, Grenada", 'Grand Anse Beach'], caption: 'Saint George’s' },
    GL: { title: 'Ilulissat Icefjord', caption: 'Fiord gelat d’Ilulissat' },
    GT: { title: 'Tikal', caption: 'Tikal' },
    HT: { title: 'Citadelle Laferrière', caption: 'Ciutadella Laferrière' },
    HN: { title: 'Copán', caption: 'Ruïnes maies de Copán' },
    JM: { title: "Dunn's River Falls", caption: 'Cascades de Dunn’s River' },
    MX: { title: 'Palacio de Bellas Artes', caption: 'Palau de Belles Arts · Ciutat de Mèxic' },
    NI: { title: 'Concepción (volcano)', caption: 'Volcà Concepción, a l’illa d’Ometepe' },
    PA: { title: 'Panama Canal', caption: 'Canal de Panamà' },
    PR: { title: 'Castillo San Felipe del Morro', caption: 'Castell del Morro · San Juan' },
    KN: { title: 'Brimstone Hill Fortress National Park', caption: 'Fortalesa de Brimstone Hill' },
    VC: { title: 'Tobago Cays', caption: 'Tobago Cays, a les Grenadines' },
    LC: { title: 'Pitons (Saint Lucia)', caption: 'Els Pitons' },
    TT: { title: 'Maracas Bay', caption: 'Badia de Maracas · Trinitat' },
  },
  ams: {
    AR: { title: 'Obelisco de Buenos Aires', caption: 'L’Obelisc · Buenos Aires' },
    BO: { title: 'Salar de Uyuni', caption: 'Salar d’Uyuni' },
    BR: { title: 'Christ the Redeemer (statue)', caption: 'Crist Redemptor · Rio de Janeiro' },
    CL: { title: 'Torres del Paine National Park', caption: 'Torres del Paine, a la Patagònia' },
    CO: { title: ['Walled City of Cartagena', 'Cartagena, Colombia'], caption: 'Cartagena d’Índies' },
    EC: { title: 'Galápagos Islands', caption: 'Illes Galápagos' },
    GF: { title: 'Guiana Space Centre', caption: 'Centre Espacial · Kourou' },
    GY: { title: 'Kaieteur Falls', caption: 'Cascades de Kaieteur' },
    PY: { title: 'Itaipu Dam', caption: 'Presa d’Itaipú' },
    PE: { title: 'Machu Picchu', caption: 'Machu Picchu' },
    SR: { title: 'Saint Peter and Paul Cathedral, Paramaribo', caption: 'Catedral de Sant Pere i Sant Pau · Paramaribo' },
    UY: { title: 'Palacio Salvo', caption: 'Palau Salvo · Montevideo' },
    VE: { title: 'Angel Falls', caption: 'Salto Ángel' },
  },
  asi: {
    AF: { title: 'Band-e Amir National Park', caption: 'Llacs de Band-e Amir' },
    SA: { title: 'Abraj Al Bait', caption: 'Torres Abraj al-Bait, al costat de la Gran Mesquita · la Meca' },
    AM: { title: 'Khor Virap', caption: 'Monestir de Khor Virap i el mont Ararat' },
    AZ: { title: 'Flame Towers', caption: 'Flame Towers · Bakú' },
    BH: { title: 'Bahrain World Trade Center', caption: 'World Trade Center · Manama' },
    BD: { title: 'Ahsan Manzil', caption: 'Ahsan Manzil · Dhaka' },
    BT: { title: 'Paro Taktsang', caption: 'Monestir del Niu del Tigre · Paro' },
    BN: { title: 'Omar Ali Saifuddien Mosque', caption: 'Mesquita d’Omar Ali Saifuddien · Bandar Seri Begawan' },
    KH: { title: 'Angkor Wat', caption: 'Angkor Wat' },
    CN: { title: 'Great Wall of China', caption: 'La Gran Muralla, vora Pequín' },
    CY: { title: ['Venetian walls of Nicosia', 'Walls of Nicosia'], caption: 'Muralles venecianes · Nicòsia' },
    KP: { title: 'Juche Tower', caption: 'Torre Juche · Pyongyang' },
    KR: { title: 'Gyeongbokgung', caption: 'Palau Gyeongbokgung · Seül' },
    EG: { title: "Saint Catherine's Monastery", caption: 'Monestir de Santa Caterina, al Sinaí' },
    AE: { title: 'Burj Khalifa', caption: 'Burj Khalifa · Dubai' },
    PH: { title: 'Banaue Rice Terraces', caption: 'Terrasses d’arròs de Banaue' },
    GE: { title: 'Gergeti Trinity Church', caption: 'Església de la Trinitat de Gergeti' },
    YE: { title: ['Old City of Sanaa', "Old City of Sana'a"], caption: 'Ciutat vella · Sanà' },
    IN: { title: 'Taj Mahal', caption: 'Taj Mahal · Agra' },
    ID: { title: 'Borobudur', caption: 'Temple de Borobudur · illa de Java' },
    IQ: { title: 'Ziggurat of Ur', caption: 'Ziggurat d’Ur' },
    IR: { title: 'Shah Mosque (Isfahan)', caption: 'Mesquita de l’Imam · Isfahan' },
    IL: { title: 'Masada', caption: 'Masada, vora el mar Mort' },
    JP: { title: 'Mount Fuji', caption: 'Mont Fuji' },
    JO: { title: 'Petra', caption: 'Petra' },
    KZ: { title: 'Baiterek (monument)', caption: 'Torre Baiterek · Astana' },
    KG: { title: 'Ala Archa National Park', caption: 'Parc Nacional d’Ala Artxa, vora Bixkek' },
    KW: { title: 'Kuwait Towers', caption: 'Torres de Kuwait' },
    LA: { title: 'Pha That Luang', caption: 'Pha That Luang · Vientiane' },
    LB: { title: 'Baalbek', caption: 'Temples romans de Baalbek' },
    MY: { title: 'Petronas Towers', caption: 'Torres Petronas · Kuala Lumpur' },
    MV: { title: 'Malé', caption: 'Male' },
    MN: { title: 'Genghis Khan Equestrian Statue', caption: 'Estàtua eqüestre de Gengis Khan' },
    MM: { title: 'Shwedagon Pagoda', caption: 'Pagoda Shwedagon · Rangun' },
    NP: { title: 'Mount Everest', caption: 'Everest' },
    OM: { title: 'Sultan Qaboos Grand Mosque', caption: 'Gran Mesquita del Sultà Qabus · Masqat' },
    PK: { title: 'Faisal Mosque', caption: 'Mesquita Faisal · Islamabad' },
    PS: { title: 'Church of the Nativity', caption: 'Basílica de la Nativitat · Betlem' },
    QA: { title: 'Museum of Islamic Art, Doha', caption: 'Museu d’Art Islàmic · Doha' },
    RU: { title: "Saint Basil's Cathedral", caption: 'Catedral de Sant Basili · Moscou' },
    SG: { title: 'Marina Bay Sands', caption: 'Marina Bay Sands · Singapur' },
    SY: { title: 'Umayyad Mosque', caption: 'Mesquita dels Omeies · Damasc' },
    LK: { title: 'Sigiriya', caption: 'Roca de Sigiriya' },
    TJ: { title: 'Pamir Mountains', caption: 'Muntanyes del Pamir' },
    TH: { title: 'Wat Arun', caption: 'Wat Arun · Bangkok' },
    TW: { title: 'Taipei 101', caption: 'Taipei 101 · Taipei' },
    TL: { title: 'Cristo Rei of Dili', caption: 'Crist Rei · Dili' },
    TM: { title: 'Darvaza gas crater', caption: 'Cràter de Darvaza, la «porta de l’infern»' },
    TR: { title: 'Hagia Sophia', caption: 'Santa Sofia · Istanbul' },
    UZ: { title: 'Registan', caption: 'Registan · Samarcanda' },
    VN: { title: 'Hạ Long Bay', caption: 'Badia de Ha Long' },
  },
  esp: {
    ES11: { title: 'Santiago de Compostela Cathedral', caption: 'Catedral · Santiago de Compostel·la' },
    ES12: { title: 'Oviedo Cathedral', caption: 'Catedral · Oviedo' },
    ES13: { title: 'El Sardinero', caption: 'Platja del Sardinero · Santander',
            file: 'Playa el sardinero santander - panoramio (17).jpg' },
    ES21: { title: 'Guggenheim Museum Bilbao', caption: 'Museu Guggenheim · Bilbao',
            file: 'Museo Guggenheim -- 2021 -- Bilbao, Euskadi, España.jpg' },
    ES22: { title: 'Pamplona Cathedral', caption: 'Catedral · Pamplona' },
    ES23: { title: ['Co-cathedral of Santa María de la Redonda', 'Logroño Cathedral'], caption: 'Concatedral de la Redonda · Logronyo' },
    ES24: { title: 'Basilica of Our Lady of the Pillar', caption: 'Basílica del Pilar · Saragossa' },
    ES30: { title: 'Puerta de Alcalá', caption: 'Puerta de Alcalá · Madrid' },
    ES41: { title: 'León Cathedral', caption: 'Catedral i plaça de Regla · Lleó', file: 'Catedral Gótica de León.jpg',
            retall: 'cap' },
    ES42: { title: 'Hanging Houses of Cuenca', caption: 'Cases Penjades · Conca', file: 'Casas Colgadas, Cuenca, España.jpg' },
    ES43: { title: 'Roman Theatre of Mérida', caption: 'Teatre romà · Mèrida' },
    ES51: { title: 'Sagrada Família', caption: 'Sagrada Família · Barcelona' },
    ES52: { title: 'City of Arts and Sciences', caption: 'Ciutat de les Arts i les Ciències · València' },
    ES53: { title: 'Palma Cathedral', caption: 'La Seu · Palma' },
    ES61: { title: 'Giralda', caption: 'La Giralda · Sevilla' },
    ES62: { title: 'La Manga del Mar Menor', caption: 'La Manga i el Mar Menor, des de l’Estació Espacial',
            file: 'ISS048-E-5924 - View of Earth.jpg' },
    ES63: { title: ['Royal Walls of Ceuta', 'Royal Walls'], caption: 'Muralles Reials · Ceuta' },
    ES64: { title: ['Melilla la Vieja', 'Old town of Melilla'], caption: 'Melilla la Vella · Melilla' },
    ES70: { title: 'Teide', caption: 'El Teide · Tenerife' },
  },
};

const TOPIC = process.argv[2];
if (!LANDMARKS[TOPIC]) { console.error(`usage: node build/fetch-photos.mjs <topic>   (one of: ${Object.keys(LANDMARKS).join(', ')})`); process.exit(2); }
const { places, byCode } = await loadTopic(TOPIC);

const DIR = `photos/${TOPIC}`;
const CREDITS = `${DIR}/credits.json`;
const WIDTH = 1600;   // download size; scan-photos resizes to 800 for the app
// Wikimedia asks every API client to identify itself.
const UA = 'EstudiaGeografia/1.0 (https://github.com/cristianllamas/comarques)';

const api = async (host, params) => {
  const url = `https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', ...params });
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if (attempt >= 2) throw new Error(`${host}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
};

/** Candidate Commons file names for a landmark, best first, and the title they came from. */
async function candidates(spec) {
  if (spec.file) return { files: [spec.file], title: null };
  for (const title of [].concat(spec.title)) {
    const q = await api('en.wikipedia.org', {
      action: 'query', redirects: 1, prop: 'pageprops|pageimages', piprop: 'name', titles: title,
    });
    const page = Object.values(q.query.pages)[0];
    if (page.missing !== undefined) continue;
    const out = [];
    const qid = page.pageprops?.wikibase_item;
    if (qid) {
      const c = await api('www.wikidata.org', { action: 'wbgetclaims', entity: qid, property: 'P18' });
      for (const s of c.claims?.P18 || []) out.push(s.mainsnak.datavalue.value);
    }
    if (page.pageimage) out.push(page.pageimage.replace(/_/g, ' '));
    if (out.length) return { files: [...new Set(out)], title };
  }
  return { files: [], title: null };
}

const strip = (html) => String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function info(file) {
  const q = await api('commons.wikimedia.org', {
    action: 'query', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: WIDTH, titles: `File:${file}`,
  });
  const ii = Object.values(q.query.pages)[0].imageinfo?.[0];
  if (!ii) return null;
  const m = ii.extmetadata || {};
  return {
    file, width: ii.width, height: ii.height, mime: ii.mime,
    thumb: ii.thumburl || ii.url, page: ii.descriptionurl,
    author: strip(m.Artist?.value).slice(0, 80) || 'Autor desconegut',
    license: strip(m.LicenseShortName?.value) || 'vegeu la font',
    licenseUrl: m.LicenseUrl?.value || null,
  };
}

mkdirSync(DIR, { recursive: true });
const credits = existsSync(CREDITS) ? JSON.parse(readFileSync(CREDITS, 'utf8')) : {};
const problems = [];

for (const [code, spec] of Object.entries(LANDMARKS[TOPIC])) {
  const place = byCode.get(code);
  if (!place) { problems.push(`${code}: not a place in topic ${TOPIC}`); continue; }
  // Named after the capital so scan-photos can match it; the first of two, or the name.
  const out = `${DIR}/${(place.capital || place.name).split('/')[0].trim()}.jpg`;
  const stale = spec.file && credits[code]?.file !== spec.file;
  if (existsSync(out) && credits[code] && !stale && !process.env.FORCE) {
    // The caption always follows the table, so correcting one needs no refetch.
    credits[code].caption = spec.caption;
    credits[code].retall = spec.retall;
    console.log(`  keep  ${code} ${out}`);
    continue;
  }

  const found = [];
  const cand = await candidates(spec);
  // The caption is written for the first title. A photo found through a fallback title
  // may show something else — Navarra once got the cathedral captioned "Plaça del Castell".
  if (cand.title && cand.title !== [].concat(spec.title)[0]) {
    problems.push(`${code}: found via fallback title "${cand.title}" — check the caption still fits`);
  }
  for (const f of cand.files) {
    const i = await info(f);
    if (i && i.mime === 'image/jpeg') found.push(i);
  }
  // A landscape photo survives the 4:3 crop on the card; a tall one loses the top.
  const pick = found.find((i) => i.width >= 1000 && i.width >= i.height * 1.15)
    || found.find((i) => i.width >= 800) || found[0];
  if (!pick) { problems.push(`${code}: no usable JPEG for ${[].concat(spec.title)[0]}`); continue; }

  const res = await fetch(pick.thumb, { headers: { 'User-Agent': UA } });
  if (!res.ok) { problems.push(`${code}: download failed, HTTP ${res.status}`); continue; }
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  credits[code] = {
    caption: spec.caption, author: pick.author, license: pick.license,
    licenseUrl: pick.licenseUrl, source: pick.page, file: pick.file, retall: spec.retall,
    portrait: pick.width < pick.height,
  };
  console.log(`  got   ${code} ${pick.width}x${pick.height} ${pick.license.padEnd(14)} ${pick.file}`);
}

writeFileSync(CREDITS, JSON.stringify(credits, null, 2) + '\n');
const missing = places.filter((p) => !credits[p.code]);
console.log(`\n${places.length - missing.length}/${places.length} places have a photo  (${CREDITS})`);
if (missing.length) console.log('without: ' + missing.map((p) => p.name).join(', '));
for (const p of problems) console.warn('!! ' + p);
console.log(`\nnext: node build/scan-photos.mjs ${TOPIC}`);
