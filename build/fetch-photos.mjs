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
// Existing files are kept; FORCE=1 refetches. To replace a rejected photo, set `file`
// on its entry to a specific Commons file name — an entry whose `file` no longer matches
// what was fetched is refetched automatically. The pinned files below replaced
// automatic picks that failed review (an empty square, a cropped tower, the wrong town).
//
// Run: node build/fetch-photos.mjs ue

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { loadTopic } from '../docs/topics.js';

// title: English Wikipedia article(s) for the landmark, tried in order.
// caption: shown under the photo — always names the city, so a landmark outside the
// capital (the Alhambra) is never mistaken for one in it.
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

/** Candidate Commons file names for a landmark, best first. */
async function candidates(spec) {
  if (spec.file) return [spec.file];
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
    if (out.length) return [...new Set(out)];
  }
  return [];
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
  const out = `${DIR}/${place.capital || place.name}.jpg`;
  const stale = spec.file && credits[code]?.file !== spec.file;
  if (existsSync(out) && credits[code] && !stale && !process.env.FORCE) { console.log(`  keep  ${code} ${out}`); continue; }

  const found = [];
  for (const f of await candidates(spec)) {
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
    licenseUrl: pick.licenseUrl, source: pick.page, file: pick.file,
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
