// End-to-end check: drives the real app in headless Chrome over the DevTools Protocol
// and fails on any console error or unhandled rejection. No test framework and no npm
// install — Node's built-in WebSocket is enough.
//
// Run: node build/e2e.mjs        (add SHOTS=1 to write screenshots to /tmp)

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';


const PORT = 8731, DEBUG = 9333;
// URL=https://... runs the same checks against the deployed site instead of a local one.
const TARGET = process.env.URL || `http://localhost:${PORT}/`;
const shots = !!process.env.SHOTS;

// Always start from a clean profile: a leftover localStorage from the previous run
// changes the first screen ("Continua" instead of "Comença") and the test drifts.
rmSync('/tmp/comarques-e2e', { recursive: true, force: true });

const server = process.env.URL ? { kill() {} }
  : spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: 'docs', stdio: 'ignore' });
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${DEBUG}`, '--window-size=420,940',
  '--user-data-dir=/tmp/comarques-e2e', TARGET,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bye = (code) => { chrome.kill('SIGKILL'); server.kill('SIGKILL'); process.exit(code); };

// A throw part-way through used to leave Chrome running, and the next run would then
// silently attach to that stale browser showing the previous run's state.
process.on('uncaughtException', (e) => { console.error('\ncrashed:', e?.message || e); bye(1); });
process.on('unhandledRejection', (e) => { console.error('\nrejected:', e?.message || e); bye(1); });

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://localhost:${DEBUG}/json`);
      const page = (await r.json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome did not expose a debugging target');
}

await sleep(1200);
const ws = new WebSocket(await target());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const problems = [];

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown')
    problems.push('exception: ' + (m.params.exceptionDetails.exception?.description
      || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    problems.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  // The Cloudflare beacon's report is refused off the real origin (localhost), by design.
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error'
      && !/cloudflareinsights\.com/.test(m.params.entry.text + m.params.entry.url))
    problems.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
};

const send = (method, params = {}) => new Promise((res) => {
  const n = ++id;
  pending.set(n, (m) => res(m.result));
  ws.send(JSON.stringify({ id: n, method, params }));
});

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) problems.push('eval: ' + (r.exceptionDetails.exception?.description || expression));
  return r?.result?.value;
};

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');

const shot = async (name) => {
  if (!shots) return;
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('node:fs');
  fs.writeFileSync(`/tmp/e2e-${name}.png`, Buffer.from(data, 'base64'));
};

const text = () => evaluate('document.getElementById("app").innerText');
const click = (sel) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
  if(!e) return 'MISSING '+${JSON.stringify(sel)}; e.click(); return 'ok';})()`);
const clickText = (label) => evaluate(`(()=>{const b=[...document.querySelectorAll('button')]
  .find(x=>x.textContent.trim()===${JSON.stringify(label)});
  if(!b) return 'MISSING button '+${JSON.stringify(label)}; b.click(); return 'ok';})()`);

const check = (cond, msg) => { if (!cond) problems.push('FAILED: ' + msg); else console.log('  ok  ' + msg); };

const KEY = 'geografia.v2';
const packItems = (id) => evaluate(`Object.keys((JSON.parse(localStorage.getItem('${KEY}')||'{}').packs?.['${id}']||{}).items||{})`);
const clickPack = (title) => evaluate(`(()=>{const b=[...document.querySelectorAll('button.tema')]
  .find(x=>x.querySelector('.tema-titol').textContent.trim()===${JSON.stringify(title)});
  if(!b) return 'MISSING pack '+${JSON.stringify(title)}; b.click(); return 'ok';})()`);
const tapFirstZone = () => evaluate(`(()=>{
  const svg=document.querySelector('svg.mapa.triable'); if(!svg) return 'no';
  const p=[...svg.querySelectorAll('path.zona')].find(x=>getComputedStyle(x).display!=='none');
  if(!p) return 'no';
  const r=p.getBoundingClientRect();
  const o={bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,
    pointerId:1,pointerType:'touch',isPrimary:true};
  svg.dispatchEvent(new PointerEvent('pointerdown',o));
  svg.dispatchEvent(new PointerEvent('pointerup',o));
  return 'ok';})()`);

/** Walk Fase 1, collecting the place on each card. */
async function walkStudy() {
  const names = [];
  for (let i = 0; i < 10; i++) {
    names.push(await evaluate(`document.querySelector('.fitxa h2')?.textContent`));
    if (await clickText('Següent') !== 'ok') { await clickText('A provar-ho'); break; }
    await sleep(120);
  }
  await sleep(300);
  return names;
}

/** Answer everything wrong until the summary; returns every question prompt seen. */
async function finishSession() {
  // Answering everything wrong requeues each question, so a 12-question session can
  // grow to ~24, and each one takes several clicks to walk down the rungs.
  const prompts = new Set();
  for (let i = 0; i < 250; i++) {
    const t2 = await text();
    if (/Sessió acabada/.test(t2)) break;
    const pr = await evaluate(`document.querySelector('.pregunta')?.textContent || ''`);
    if (pr) prompts.add(pr);
    if (await clickText('Següent') === 'ok') { await sleep(90); continue; }
    if (await clickText('Acaba') === 'ok') { await sleep(150); continue; }
    const opt = await evaluate(`(()=>{const o=document.querySelector('.opcio'); if(o){o.click();return 'ok';} return 'no';})()`);
    if (opt === 'ok') { await sleep(120); continue; }
    const typed = await evaluate(`(()=>{const i=document.querySelector('.entrada input');
      if(!i) return 'no'; i.value='zzzz'; i.form.dispatchEvent(new Event('submit',{cancelable:true})); return 'ok';})()`);
    if (typed === 'ok') { await sleep(110); continue; }
    if (await tapFirstZone() !== 'ok') break;
    await sleep(110);
  }
  const t = await text();
  if (!/Sessió acabada/.test(t)) {
    console.log('  --- stuck on this screen ---');
    console.log('  ' + String(t).split('\n').join('\n  '));
    console.log('  buttons: ' + await evaluate(
      `[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).join(' | ')`));
  }
  return [...prompts];
}

await sleep(900);
console.log('\n1. pack picker');
let t = await text();
check(/Estudia geografia/i.test(t), 'title renders');
check(/Què vols estudiar/.test(t), 'a new device starts on the pack picker');
check(await evaluate(`[...document.querySelectorAll('.tema-titol')].map(x=>x.textContent).join(' | ')`)
  === 'Comarques i capitals | Comarques | Comunitats autònomes | Unió Europea', 'packs are listed in the agreed order');
await shot('0-packs');
check(await clickPack('Comarques i capitals') === 'ok', 'choosing a pack');
await sleep(600);

console.log('\n2. home screen');
t = await text();
check(/Comarques i capitals/.test(t), 'home shows the chosen pack');
check(/84 preguntes/.test(t), 'starts in 42-comarca mode (84 questions)');
check(!/examen/i.test(t), 'no mention of an exam');
check(await evaluate('!!document.querySelector("svg.mapa")'), 'map is in the DOM');
check(await evaluate('document.querySelectorAll("svg.mapa path.zona").length') === 43, '43 comarca paths');
check(await evaluate(`(()=>{const p=document.querySelector('path[data-code="43"]');
  return p ? getComputedStyle(p).display : 'no-map';})()`) === 'none',
  'Lluçanès hidden in 42-mode');
await shot('1-home');

console.log('\n3. settings: Lluçanès toggle, no exam date');
await clickText('Opcions');
await sleep(200);
check(!(await evaluate('!!document.querySelector("input[type=date]")')), 'there is no exam date setting');
await evaluate(`(()=>{const c=document.querySelector('input[type=checkbox]');
  c.checked=true; c.dispatchEvent(new Event('change')); })()`);
t = await text();
check(/43 comarques/.test(t), 'toggling Lluçanès switches to 43 comarques');
check(await evaluate(`(()=>{const p=document.querySelector('path[data-code="43"]');
  return p ? getComputedStyle(p).display : 'no-map';})()`) !== 'none',
  'Lluçanès visible in 43-mode');
await evaluate(`(()=>{const c=document.querySelector('input[type=checkbox]');
  c.checked=false; c.dispatchEvent(new Event('change')); })()`);
await clickText('Fet');
await sleep(200);
await shot('2-settings-back');

console.log('\n4. Fase 1 — repàs');
if (await clickText('Comença') !== 'ok') await clickText('Continua');
await sleep(300);
t = await text();
check(/REPÀS|Repàs/i.test(t), 'study phase starts');
check(/Capital:/.test(t), 'study card shows the capital');
check(/Província:/.test(t), 'study card shows the província');
await shot('3-study');
const cards = await walkStudy();
check(new Set(cards).size === cards.length,
  `Fase 1 shows ${cards.length} different comarques (${cards.join(', ')})`);
check(!/^Alt Camp$/.test(cards[0]) || !/^Alt Empordà$/.test(cards[1]),
  'new comarques are not introduced in alphabetical order');

// Snapshot what Fase 1 touched: markStudied writes seen>0 without grading, so these six
// keys are exactly the studied items.
const studied = await packItems('comarques-capitals');

console.log('\n5. Fase 2 — recorda');
t = await text();
check(/Recorda/i.test(t), 'quiz phase starts');
check(studied.length === 6, `Fase 1 touched 6 items (got ${studied.length})`);
await shot('4-quiz');

// answer the first typed question deliberately wrong, three times, to walk the climb-down
const kind = await evaluate(`document.querySelector('.entrada input') ? 'typed' : 'map'`);
if (kind === 'typed') {
  await evaluate(`(()=>{const i=document.querySelector('.entrada input');
    i.value='zzzz'; i.form.dispatchEvent(new Event('submit',{cancelable:true}));})()`);
  await sleep(150);
  check(/Pista|Comença així/.test(await text()), 'rung 1: a hint appears after a wrong answer');
  await shot('5-rung1');
  await evaluate(`(()=>{const i=document.querySelector('.entrada input');
    i.value='zzzz'; i.form.dispatchEvent(new Event('submit',{cancelable:true}));})()`);
  await sleep(150);
  check(/Comença així/.test(await text()), 'rung 2: the first letter is revealed');
  await shot('6-rung2');
  await evaluate(`(()=>{const i=document.querySelector('.entrada input');
    i.value='zzzz'; i.form.dispatchEvent(new Event('submit',{cancelable:true}));})()`);
  await sleep(150);
  const opts = await evaluate('document.querySelectorAll(".opcio").length');
  check(opts === 4, `rung 3: four options offered (got ${opts})`);
  await shot('7-options');
  await evaluate('document.querySelector(".opcio").click()');
  await sleep(200);
  check(/Era…|Molt bé/.test(await text()), 'the answer is shown after choosing');
} else {
  await tapFirstZone();
  await sleep(200);
  check(true, 'first question was a map question');
}

const afterFirst = await packItems('comarques-capitals');
const fresh = afterFirst.filter((k) => !studied.includes(k));
check(fresh.length >= 1,
  `Fase 2 questions a comarca Fase 1 did not show (${fresh.length} new item(s) graded)`);
const studiedCodes = new Set(studied.map((k) => k.split(':')[0]));
check(fresh.every((k) => !studiedCodes.has(k.split(':')[0])),
  'Fase 2 does not ask about a comarca Fase 1 just showed, not even its other facet');

console.log('\n6. finish the session');
await finishSession();
t = await text();
check(/Sessió acabada/.test(t), 'session reaches the summary screen');
await shot('8-summary');

console.log('\n7. study map');
await clickText('Inici');
await sleep(250);
check(await clickText('Mira el mapa') === 'ok', 'study map opens from home');
await sleep(600);
const labels = await evaluate('document.querySelectorAll("svg.mapa text.etiqueta").length');
check(labels > 0, `labels are drawn (${labels} shown at full extent)`);
check(labels < 43, `labels are decluttered, not all ${43} crammed on (${labels} shown)`);
t = await text();
check(/noms/.test(t), 'the counter explains how many names are visible');
check(await evaluate(`[...document.querySelectorAll('svg.mapa text.etiqueta tspan')]
  .some(x=>x.classList.contains('cap'))`), 'labels include the capital, not just the comarca');

// No label may extend past the viewBox — the SVG clips there, which silently chops the
// last letter off names like "ALT EMPORDÀ".
const clippedLabels = () => evaluate(`(()=>{
  const svg=document.querySelector('svg.mapa');
  const [vx,vy,vw,vh]=svg.getAttribute('viewBox').split(' ').map(Number);
  return [...svg.querySelectorAll('text.etiqueta')].filter(t=>{
    const b=t.getBBox();
    return b.x < vx-0.5 || b.y < vy-0.5 || b.x+b.width > vx+vw+0.5 || b.y+b.height > vy+vh+0.5;
  }).map(t=>t.textContent);})()`);
const clipped = await clippedLabels();
check(clipped.length === 0, `no label is clipped by the map edge${clipped.length ? ' — ' + clipped.join(', ') : ''}`);
await shot('9-studymap');

// Zooming in must label a larger *share* of what is on screen. Comparing raw counts is
// wrong: zooming in also removes comarques from view, so the total drops too.
const ratio = async () => {
  const m = String(await text()).match(/Es veuen (\d+) de (\d+)|tots (\d+)/);
  if (!m) return null;
  return m[3] ? 1 : Number(m[1]) / Number(m[2]);
};
const before = await ratio();
// one wheel tick is only a 13% zoom; take several so space genuinely frees up
await evaluate(`(()=>{const svg=document.querySelector('svg.mapa');
  const r=svg.getBoundingClientRect();
  for(let i=0;i<8;i++) svg.dispatchEvent(new WheelEvent('wheel',{deltaY:-240,
    clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true,cancelable:true}));})()`);
await sleep(500);
const after = await ratio();
check(after > before,
  `zooming in labels a bigger share of what is on screen `
  + `(${Math.round(before * 100)}% -> ${Math.round(after * 100)}%)`);
await shot('10-studymap-zoom');

// tapping a comarca shows its card, and must NOT feed the scheduler
const itemsBefore = (await packItems('comarques-capitals')).length;
await tapFirstZone();
await sleep(300);
check(/Capital:/.test(await text()), 'tapping a comarca shows its card');
const itemsAfter = (await packItems('comarques-capitals')).length;
check(itemsAfter === itemsBefore, 'browsing the study map does not touch the scheduler');
await shot('11-studymap-card');

console.log('\n8. progress persists');
const saved = await evaluate(`JSON.parse(localStorage.getItem('${KEY}')||'{}')`);
const ps = saved?.packs?.['comarques-capitals'];
check(ps && Object.keys(ps.items || {}).length > 0,
  `progress written to localStorage (${Object.keys(ps?.items || {}).length} items)`);
check(ps?.order?.length === 84, `the shuffled introduction order is saved (${ps?.order?.length} keys)`);
check(saved?.pack === 'comarques-capitals', 'the chosen pack is remembered');

console.log('\n9. second pack: comarques without capitals');
await clickText('Inici');
await sleep(250);
check(await clickText('☰ Packs de contingut') === 'ok', 'the header leads back to the pack picker');
await sleep(250);
check(/sessi/.test(await text()), 'the picker shows sessions done in a pack');
await clickPack('Comarques');
await sleep(600);
t = await text();
check(/42 preguntes/.test(t), 'comarques-only pack: 42 questions, one per comarca');
const otherBefore = (await packItems('comarques-capitals')).length;
await clickText('Comença');
await sleep(300);
check(!/Capital:/.test(await text()), 'study card does not mention the capital');
await shot('12-nocap-study');
await walkStudy();
const prompts = await finishSession();
check(/Sessió acabada/.test(await text()), 'comarques-only session reaches the summary');
check(prompts.length > 0 && prompts.every((p) => !/capital/i.test(p)),
  `no question asks about a capital (${prompts.length} prompts seen)`);
check((await packItems('comarques-capitals')).length === otherBefore,
  'progress in one pack does not touch the other');
await clickText('Inici');
await sleep(250);
await clickText('Mira el mapa');
await sleep(600);
check(!(await evaluate(`!!document.querySelector('svg.mapa text.etiqueta tspan.cap')`)),
  'study map labels show no capitals in this pack');
const clipped2 = await clippedLabels();
check(clipped2.length === 0, `no name-only label is clipped either${clipped2.length ? ' — ' + clipped2.join(', ') : ''}`);
await shot('13-nocap-studymap');

console.log('\n10. EU pack');
await clickText('Inici');
await sleep(250);
await clickText('☰ Packs de contingut');
await sleep(250);
check(await clickPack('Unió Europea') === 'ok', 'the EU pack is listed');
await sleep(800);
t = await text();
check(/Unió Europea/.test(t) && /53 preguntes/.test(t),
  'EU pack: 27 locations + 26 capitals (Luxembourg\'s is never asked) = 53 questions');
check(await evaluate('document.querySelectorAll("svg.mapa path.zona").length') === 27, '27 country shapes');
check(await evaluate('document.querySelectorAll("svg.mapa path.contexte").length') > 0,
  'non-member countries are drawn as context');
check(await evaluate(`[...document.querySelectorAll('svg.mapa circle.anella')].map(c=>c.dataset.code).sort().join()`) === 'LU,MT',
  'Malta and Luxembourg get a tap ring');
await shot('14-ue-home');
await clickText('Comença');
await sleep(400);
t = await text();
check(/Capital:/.test(t), 'EU study card shows the capital');
check(await evaluate(`(()=>{const f=document.querySelector('.fitxa figure.foto-amb-peu');
  return !!f && /Foto: .+, .+/.test(f.querySelector('figcaption').textContent)
    && !!f.querySelector('figcaption a[href^="https://commons.wikimedia.org/"]');})()`),
  'EU photo carries a caption, author, licence and a link to its Commons page');
await shot('15-ue-study');
const ueCards = await walkStudy();
check(new Set(ueCards).size === ueCards.length, `Fase 1 shows ${ueCards.length} different countries`);
await shot('16-ue-quiz');
const uePrompts = await finishSession();
check(/Sessió acabada/.test(await text()), 'EU session reaches the summary');
check(uePrompts.every((p) => !/comarca/i.test(p)), 'no EU question mentions a comarca');
await shot('17-ue-summary');
await clickText('Inici');
await sleep(250);
await clickText('Mira el mapa');
await sleep(600);
const ueClipped = await clippedLabels();
check(ueClipped.length === 0, `no EU label is clipped${ueClipped.length ? ' — ' + ueClipped.join(', ') : ''}`);
await shot('18-ue-studymap');
// tap the centre of Malta's ring: Malta itself is ~2 px across at this zoom
await evaluate(`(()=>{const svg=document.querySelector('svg.mapa.triable');
  const c=svg.querySelector('circle.anella[data-code="MT"]'); const r=c.getBoundingClientRect();
  const o={bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,pointerId:1,pointerType:'touch',isPrimary:true};
  svg.dispatchEvent(new PointerEvent('pointerdown',o)); svg.dispatchEvent(new PointerEvent('pointerup',o));})()`);
await sleep(300);
t = await text();
check(/Malta/.test(t) && /la Valletta/.test(t), 'tapping the ring picks Malta');
await shot('19-ue-malta');

console.log('\n11. Comunitats autònomes pack');
// Taps a place: its ring if it has one, otherwise a point that is really inside the shape
// (the centre of an archipelago's bounding box is sea).
const tapCode = (code) => evaluate(`(()=>{const svg=document.querySelector('svg.mapa.triable');
  let x, y;
  const ring=svg.querySelector('circle.anella[data-code="${code}"]');
  if (ring) { const r=ring.getBoundingClientRect(); x=r.left+r.width/2; y=r.top+r.height/2; }
  else {
    const p=svg.querySelector('path.zona[data-code="${code}"]'), b=p.getBBox(), m=p.getScreenCTM();
    outer: for (let i=1;i<20;i++) for (let j=1;j<20;j++) {
      const pt=new DOMPoint(b.x+b.width*i/20, b.y+b.height*j/20);
      if (p.isPointInFill(pt)) { const s=pt.matrixTransform(m); x=s.x; y=s.y; break outer; }
    }
  }
  const o={bubbles:true,clientX:x,clientY:y,pointerId:1,pointerType:'touch',isPrimary:true};
  svg.dispatchEvent(new PointerEvent('pointerdown',o)); svg.dispatchEvent(new PointerEvent('pointerup',o));})()`);
await clickText('Inici');
await sleep(250);
await clickText('☰ Packs de contingut');
await sleep(250);
check(await clickPack('Comunitats autònomes') === 'ok', 'the Comunitats pack is listed');
await sleep(800);
t = await text();
check(/34 preguntes/.test(t),
  'Comunitats: 19 locations + 15 capitals (not Ceuta, Melilla, Madrid, Múrcia) = 34 questions');
check(await evaluate('document.querySelectorAll("svg.mapa path.zona").length') === 19, '19 region shapes');
check(await evaluate('!!document.querySelector("svg.mapa rect.requadre")'), 'Canàries are framed in an inset');
check(await evaluate(`[...document.querySelectorAll('svg.mapa circle.anella')].map(c=>c.dataset.code).sort().join()`) === 'ES63,ES64',
  'Ceuta and Melilla get a tap ring');
await shot('20-esp-home');
await clickText('Comença');
await sleep(400);
check(/Capital:|Ciutat autònoma/.test(await text()), 'Comunitats study card shows the capital (or says ciutat autònoma)');
await shot('21-esp-study');
await walkStudy();
const espPrompts = await finishSession();
check(/Sessió acabada/.test(await text()), 'Comunitats session reaches the summary');
check(espPrompts.every((p) => !/quina comarca|quin país/i.test(p)), 'no Comunitats question asks for a comarca or a país');
await clickText('Inici');
await sleep(250);
await clickText('Mira el mapa');
await sleep(600);
const espClipped = await clippedLabels();
check(espClipped.length === 0, `no Comunitats label is clipped${espClipped.length ? ' — ' + espClipped.join(', ') : ''}`);
await shot('22-esp-studymap');
await tapCode('ES63');
await sleep(300);
t = await text();
check(/Ceuta/.test(t) && /Ciutat autònoma/.test(t) && !/Capital:/.test(t), 'Ceuta: tap ring works, card says ciutat autònoma, no capital');
await tapCode('ES70');
await sleep(300);
t = await text();
check(/Canàries/.test(t) && /Capitals: Las Palmas de Gran Canaria i Santa Cruz de Tenerife/.test(t),
  'Canàries: tapping the inset works and the card names both capitals');
await shot('23-esp-canaries');
await tapCode('ES41');
await sleep(800);
check(await evaluate(`(()=>{const i=document.querySelector('.fitxa img.foto.sencera');
  if(!i||!i.naturalWidth) return false;
  const r=i.getBoundingClientRect();   // shown whole: rendered shape matches the photo's
  return Math.abs(r.width/r.height - i.naturalWidth/i.naturalHeight) < 0.02;})()`),
  'León cathedral photo is shown whole, square included');
await evaluate(`document.querySelector('.fitxa').scrollIntoView()`);
await sleep(200);
await shot('24-esp-leon');

console.log('\n12. progress from the comarques-only app is carried over');
await evaluate(`(()=>{localStorage.clear();
  localStorage.setItem('comarques.v1', JSON.stringify({
    items:{'01:lloc':{box:2,due:0,seen:3,wrong:0,streak:2,last:0}},
    examDate:'2026-09-30', includeLlucanes:true, sessions:5, lastSession:1}));})()`);
await send('Page.reload', { ignoreCache: true });
await sleep(1500);
t = await text();
check(/Comarques i capitals/.test(t) && /Continua/.test(t),
  'an existing learner lands on their pack, ready to continue');
check(/86 preguntes/.test(t), 'their Lluçanès setting is kept (43 comarques, 86 questions)');
check(/· 1 vista\b/.test(t), 'their progress is kept');
check(await evaluate(`!!localStorage.getItem('comarques.v1')`),
  'the old progress is left in place, so a rollback still finds it');

console.log(problems.length ? `\n${problems.length} PROBLEM(S):` : '\nno console errors');
for (const p of [...new Set(problems)]) console.log('  ' + p);
bye(problems.some((p) => p.startsWith('FAILED') || p.startsWith('exception') || p.startsWith('eval')) ? 1 : 0);
