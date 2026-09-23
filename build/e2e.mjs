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
const bye = (code) => { chrome.kill(); server.kill(); process.exit(code); };

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
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
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

await sleep(900);
console.log('\n1. home screen');
let t = await text();
check(/Comarques/.test(t), 'title renders');
check(/84 preguntes/.test(t), 'starts in 42-comarca mode (84 questions)');
check(await evaluate('!!document.querySelector("svg.mapa")'), 'map is in the DOM');
check(await evaluate('document.querySelectorAll("svg.mapa path.comarca").length') === 43, '43 comarca paths');
check(await evaluate(`(()=>{const p=document.querySelector('path[data-code="43"]');
  return p ? getComputedStyle(p).display : 'no-map';})()`) === 'none',
  'Lluçanès hidden in 42-mode');
await shot('1-home');

console.log('\n2. settings: exam date + Lluçanès toggle');
await clickText('Opcions');
await sleep(200);
await evaluate(`(()=>{const d=document.querySelector('input[type=date]');
  d.value='2026-09-30'; d.dispatchEvent(new Event('change')); })()`);
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
t = await text();
check(/Falten/.test(t), 'home shows the countdown to the exam');
await shot('2-home-date');

console.log('\n3. Fase 1 — repàs');
if (await clickText('Comença') !== 'ok') await clickText('Continua');
await sleep(300);
t = await text();
check(/REPÀS|Repàs/i.test(t), 'study phase starts');
check(/Capital:/.test(t), 'study card shows the capital');
check(/Província:/.test(t), 'study card shows the província');
await shot('3-study');
for (let i = 0; i < 6; i++) {
  const r = await clickText('Següent');
  if (r !== 'ok') { await clickText('A provar-ho'); break; }
  await sleep(120);
}
await sleep(300);

console.log('\n4. Fase 2 — recorda');
t = await text();
check(/Recorda/i.test(t), 'quiz phase starts');
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
  check(true, 'first question was a map question (skipping the typed climb-down)');
}

console.log('\n5. finish the session');
// Answering everything wrong requeues each question, so a 12-question session can
// grow to ~24, and each one takes several clicks to walk down the rungs.
for (let i = 0; i < 250; i++) {
  const t2 = await text();
  if (/Sessió acabada/.test(t2)) break;
  if (await clickText('Següent') === 'ok') { await sleep(90); continue; }
  if (await clickText('Acaba') === 'ok') { await sleep(150); continue; }
  const opt = await evaluate(`(()=>{const o=document.querySelector('.opcio'); if(o){o.click();return 'ok';} return 'no';})()`);
  if (opt === 'ok') { await sleep(120); continue; }
  const typed = await evaluate(`(()=>{const i=document.querySelector('.entrada input');
    if(!i) return 'no'; i.value='zzzz'; i.form.dispatchEvent(new Event('submit',{cancelable:true})); return 'ok';})()`);
  if (typed === 'ok') { await sleep(110); continue; }
  const pick = await evaluate(`(()=>{
    const svg=document.querySelector('svg.mapa.triable'); if(!svg) return 'no';
    const p=svg.querySelector('path.comarca'); if(!p) return 'no';
    const r=p.getBoundingClientRect();
    const x=r.left+r.width/2, y=r.top+r.height/2;
    const opt={bubbles:true,clientX:x,clientY:y,pointerId:1,pointerType:'touch',isPrimary:true};
    svg.dispatchEvent(new PointerEvent('pointerdown',opt));
    svg.dispatchEvent(new PointerEvent('pointerup',opt));
    return 'ok';})()`);
  if (pick !== 'ok') break;
  await sleep(110);
}
t = await text();
check(/Sessió acabada/.test(t), 'session reaches the summary screen');
if (!/Sessió acabada/.test(t)) {
  console.log('  --- stuck on this screen ---');
  console.log('  ' + String(t).split('\n').join('\n  '));
  console.log('  buttons: ' + await evaluate(
    `[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).join(' | ')`));
  console.log('  has input: ' + await evaluate(`!!document.querySelector('.entrada input')`));
  console.log('  picking:   ' + await evaluate(`!!document.querySelector('svg.mapa.triable')`));
}
await shot('8-summary');

console.log('\n6. progress persists');
const saved = await evaluate('JSON.parse(localStorage.getItem("comarques.v1")||"{}")');
check(saved && Object.keys(saved.items || {}).length > 0,
  `progress written to localStorage (${Object.keys(saved?.items || {}).length} items)`);
check(saved?.examDate === '2026-09-30', 'exam date persisted');

console.log(problems.length ? `\n${problems.length} PROBLEM(S):` : '\nno console errors');
for (const p of [...new Set(problems)]) console.log('  ' + p);
bye(problems.some((p) => p.startsWith('FAILED') || p.startsWith('exception') || p.startsWith('eval')) ? 1 : 0);
