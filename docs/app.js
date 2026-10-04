// Session orchestration: Fase 1 (repàs) then Fase 2 (recorda), for whichever content
// pack is active.
//
// Fase 1 shows answers — name, capital, hook, photo — with no demand on the learner.
// Fase 2 makes them produce them. That order is the point: exposure primes, retrieval
// fixes.

import { PACKS, packById } from './packs.js';
import { loadTopic, activeCodes, activePairs } from './topics.js';
import { Mapa } from './map.js';
import { load, save, packState, resetPack } from './store.js';
import { isCorrect, masked } from './answer.js';
import { buildQuestion, options } from './quiz.js';
import { grade, markStudied, selectDue, ensureOrder, keyOf, newItem, progress }
  from './scheduler.js';

const STUDY_CARDS = 6;
const QUIZ_CARDS = 12;

const app = document.getElementById('app');
const root = load();
// The active pack: its definition, its topic (map + places) and its saved progress.
let pack, topic, state;
let mapa, session;

const codes = () => activeCodes(topic, state.toggle);
const pairs = () => activePairs(topic, pack, state.toggle);
// The comarques-only pack never mentions capitals, not even on the cards.
const asksCapital = () => pack.facets.includes('capital');
const solution = (c) => `<b>${c.name}</b>` + (asksCapital() && c.capital ? ` — ${c.capital}` : '');

const h = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

function photoFor(code) {
  const src = topic.byCode.get(code)?.photo;
  if (!src) return null;
  const img = h('img', 'foto');
  img.src = src;
  img.alt = '';
  img.loading = 'lazy';
  // Belt and braces: the photo list only names files the build actually found, but if
  // one goes missing later the card must still render rather than show a broken image.
  img.onerror = () => img.remove();
  return img;
}

/** Name, capital (if the pack asks for it), photo, hook and context for one place. */
function placeCard(code, cls = 'fitxa') {
  const c = topic.byCode.get(code);
  const card = h('div', cls);
  card.append(h('h2', null, c.name));
  if (asksCapital() && c.capital) card.append(h('p', 'capital', `Capital: <b>${c.capital}</b>`));
  const photo = photoFor(code);
  if (photo) card.append(photo);
  if (c.hook) card.append(h('p', 'pista', c.hook));
  if (c.extra) card.append(h('p', 'prov', c.extra));
  return card;
}

// ---------------------------------------------------------------- packs

async function openPack(id) {
  pack = packById(id);
  topic = await loadTopic(pack.topic);
  state = packState(root, id);
  root.pack = id;
  save(root);
  mapa = new Mapa(topic);
  mapa.setToggle(state.toggle);
  render(screenHome());
}

/** First screen on a new device, and where "Packs de contingut" leads. */
function screenPacks() {
  const wrap = h('div', 'pantalla');
  wrap.append(h('p', 'fase', 'Estudia geografia'));
  wrap.append(h('h1', null, 'Packs de contingut'));
  wrap.append(h('p', 'sub', 'Què vols estudiar?'));
  for (const p of PACKS) {
    const b = h('button', 'tema');
    b.append(h('span', 'tema-titol', p.title), h('span', 'tema-desc', p.desc));
    const saved = root.packs[p.id];
    if (saved?.sessions) {
      b.append(h('span', 'tema-desc', `${saved.sessions} sessi${saved.sessions === 1 ? 'ó' : 'ons'} fetes`));
    }
    b.onclick = () => openPack(p.id);
    wrap.append(b);
  }
  return wrap;
}

// ---------------------------------------------------------------- screens

function screenHome() {
  const p = progress(state, pairs());

  const wrap = h('div', 'pantalla');

  // The pack is the top of the hierarchy — everything else on this screen belongs to
  // it — so switching packs lives in the header, not among the screen's own options.
  const top = h('header', 'capcalera');
  top.append(h('span', 'marca', 'Estudia geografia'));
  const packs = h('button', 'secundari petit', '☰ Packs de contingut');
  packs.onclick = () => render(screenPacks());
  top.append(packs);
  wrap.append(top);

  wrap.append(h('h1', null, pack.title));

  const bar = h('div', 'barra');
  bar.append(h('span', null, ''));
  bar.firstChild.style.width = `${p.pct}%`;
  wrap.append(bar);
  wrap.append(h('p', 'sub',
    `<b>${p.solid}</b> de ${p.total} preguntes dominades · ${p.seen} ${p.seen === 1 ? 'vista' : 'vistes'}`
    + (p.leeches ? ` · <b>${p.leeches}</b> que es resisteixen` : '')));

  const go = h('button', 'primari', state.sessions ? 'Continua' : 'Comença');
  go.onclick = startSession;
  wrap.append(go);

  const look = h('button', 'secundari', 'Mira el mapa');
  look.onclick = () => render(screenStudyMap());
  wrap.append(look);

  const cfg = h('button', 'discret', 'Opcions');
  cfg.onclick = () => render(screenSettings());
  const links = h('div', 'enllacos');
  links.append(cfg);
  wrap.append(links);

  wrap.append(mapa.element);
  mapa.enablePicking(false);
  mapa.showLabels(false);
  mapa.clearMarks();
  mapa.reset();
  return wrap;
}

function screenSettings() {
  const wrap = h('div', 'pantalla');
  wrap.append(h('h1', null, 'Opcions'));
  wrap.append(h('p', 'sub', pack.title));

  const t = topic.toggle;
  if (t) {
    const count = h('p', 'sub', '');
    const showCount = () => { count.textContent = `Ara estudies ${codes().length} ${topic.words.many}.`; };
    const tog = h('label', 'camp interruptor');
    const cb = h('input');
    cb.type = 'checkbox';
    cb.checked = !!state.toggle;
    cb.onchange = () => {
      state.toggle = cb.checked;
      save(root);
      mapa.setToggle(state.toggle);
      showCount();
    };
    tog.append(cb, h('span', null, t.label));
    showCount();
    wrap.append(tog, count, h('p', 'nota', t.note));
  }

  const back = h('button', 'primari', 'Fet');
  back.onclick = () => render(screenHome());
  wrap.append(back);

  const wipe = h('button', 'discret perill', 'Esborra el progrés d’aquest pack');
  wipe.onclick = () => {
    if (confirm(`Segur? Es perd tot el progrés de «${pack.title}».`)) {
      resetPack(root, pack.id);
      openPack(pack.id);
    }
  };
  wrap.append(wipe);
  return wrap;
}


/**
 * Free study: the whole map with the names on it, at the learner's own pace.
 *
 * Deliberately does not touch the scheduler. Browsing is not retrieval, and counting it
 * as practice would inflate "dominades" and starve the items that genuinely are weak.
 */
function screenStudyMap() {
  const wrap = h('div', 'pantalla');
  wrap.append(h('p', 'fase', 'Mapa d’estudi'));

  mapa.clearMarks();
  mapa.reset();
  wrap.append(mapa.element);

  const comptador = h('p', 'sub', '');
  let fitxa = h('div', 'fitxa buida');
  fitxa.innerHTML = `<p class="sub">${topic.words.tapToSee}</p>`;

  mapa.onLabels = (shown, total) => {
    comptador.innerHTML = shown < total
      ? `Es veuen <b>${shown}</b> de ${total} noms. Fes zoom amb dos dits per veure’n més.`
      : `Es veuen tots <b>${total}</b> els noms.`;
  };

  mapa.enablePicking(true);
  mapa.onPick = (code) => {
    if (!topic.byCode.has(code)) return;
    mapa.clearMarks();
    mapa.mark(code, 'destacat');
    mapa.raise(code, 'destacat');
    const card = placeCard(code);
    fitxa.replaceWith(card);
    fitxa = card;
  };

  wrap.append(comptador, fitxa);

  const zoomOut = h('button', 'secundari', 'Torna a veure-ho tot');
  zoomOut.onclick = () => { mapa.reset(); mapa.clearMarks(); };
  wrap.append(zoomOut);

  const home = h('button', 'discret', 'Inici');
  home.onclick = () => {
    mapa.showLabels(false);
    mapa.onLabels = null;
    mapa.onPick = null;
    render(screenHome());
  };
  wrap.append(home);

  afterRender = () => mapa.showLabels(true, asksCapital());
  return wrap;
}

// ---------------------------------------------------------------- session

function startSession() {
  const now = Date.now();
  const ps = pairs();
  ensureOrder(state, ps.map((p) => keyOf(p.code, p.facet)));
  const picks = selectDue(state, ps, STUDY_CARDS + QUIZ_CARDS, now);

  // Fase 1 and Fase 2 work on *different* places (selectDue never returns the same
  // place twice). Testing what was just shown measures short-term memory more than it
  // builds long-term memory; the spacing effect says the test should come later. What is
  // studied now gets tested in a later session — these items are due again in 20 minutes.
  const study = picks.slice(0, STUDY_CARDS);
  const quizEntries = picks.slice(STUDY_CARDS, STUDY_CARDS + QUIZ_CARDS);

  session = {
    study, i: 0,
    queue: quizEntries.map((e) => ({ entry: e, q: buildQuestion(e, topic), rung: 0, missed: false })),
    done: [], right: 0,
  };

  for (const e of study) {
    state.items[e.key] = markStudied(state.items[e.key] || newItem(), now);
  }
  state.sessions++; state.lastSession = now;
  save(root);

  render(study.length ? screenStudy() : screenQuiz());
}

function screenStudy() {
  const e = session.study[session.i];

  const wrap = h('div', 'pantalla');
  wrap.append(h('p', 'fase', `Repàs · ${session.i + 1}/${session.study.length}`));
  wrap.append(mapa.element);
  mapa.clearMarks();
  mapa.enablePicking(false);
  mapa.mark(e.code, 'destacat');
  afterRender = () => { mapa.focus(e.code); mapa.raise(e.code, 'destacat'); };

  wrap.append(placeCard(e.code));

  const next = h('button', 'primari', session.i + 1 < session.study.length ? 'Següent' : 'A provar-ho');
  next.onclick = () => {
    session.i++;
    render(session.i < session.study.length ? screenStudy() : screenQuiz());
  };
  wrap.append(next);
  return wrap;
}

function screenQuiz() {
  if (!session.queue.length) return screenSummary();
  const cur = session.queue[0];
  const q = cur.q;

  const wrap = h('div', 'pantalla');
  const total = session.queue.length + session.done.length;
  wrap.append(h('p', 'fase', `Recorda · ${session.done.length + 1}/${total}`));

  wrap.append(mapa.element);
  mapa.clearMarks();
  mapa.reset();
  mapa.enablePicking(q.kind === 'tap-map');

  if (q.kind === 'name-shape') {
    mapa.mark(q.code, 'destacat');
    afterRender = () => { mapa.raise(q.code, 'destacat'); mapa.focus(q.code, 4); };
  }

  wrap.append(h('p', 'pregunta', q.prompt));
  const feedback = h('div', 'resposta');

  if (q.kind === 'tap-map') {
    wrap.append(h('p', 'ajuda', topic.words.tapHelp));
    mapa.onPick = (code) => {
      mapa.enablePicking(false);
      const ok = code === q.code;
      if (!ok) { mapa.mark(code, 'error'); mapa.raise(code, 'error'); }
      mapa.mark(q.code, 'correcte'); mapa.raise(q.code, 'correcte');
      mapa.focus(q.code, 3.5);
      settle(cur, ok, feedback, wrap, ok ? null : topic.words.wrongTap(topic.byCode.get(code).name));
    };
    wrap.append(feedback);
    return wrap;
  }

  // typed answer, with the climb-down
  const form = h('form', 'entrada');
  const input = h('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.autocapitalize = 'words';
  input.spellcheck = false;
  input.placeholder = q.kind === 'capital-of' ? 'La capital…' : topic.words.placeholder;
  const send = h('button', 'primari', 'Comprova');
  form.append(input, send);
  form.onsubmit = (ev) => { ev.preventDefault(); check(); };
  wrap.append(form, feedback);

  const giveUp = h('button', 'discret', 'No ho sé');
  giveUp.onclick = () => climbDown();
  wrap.append(giveUp);

  function check() {
    const ok = isCorrect(input.value, q.answer, q.accepta);
    if (ok) {
      // Reaching the answer only after the options appeared is not a clean success.
      settle(cur, cur.rung < 3, feedback, wrap, null);
    } else {
      cur.missed = true;
      climbDown();
    }
  }

  function climbDown() {
    cur.missed = true;
    cur.rung++;
    input.value = '';
    if (cur.rung === 1 && q.hint) {
      feedback.className = 'resposta ajuda-rung';
      feedback.innerHTML = `<b>Pista:</b> ${q.hint}`;
      const ph = photoFor(q.code);
      if (ph) feedback.append(ph);
      input.focus();
    } else if (cur.rung <= 2) {
      feedback.className = 'resposta ajuda-rung';
      feedback.innerHTML = `<b>Comença així:</b> <span class="mascara">${masked(q.answer)}</span>`;
      input.focus();
    } else {
      form.remove(); giveUp.remove();
      feedback.className = 'resposta';
      feedback.innerHTML = '<p class="ajuda">Tria la bona:</p>';
      const box = h('div', 'opcions');
      for (const opt of options(q, topic, codes())) {
        const b = h('button', 'opcio', opt);
        b.onclick = () => {
          box.querySelectorAll('button').forEach((x) => { x.disabled = true; });
          const ok = isCorrect(opt, q.answer, q.accepta);
          b.classList.add(ok ? 'bo' : 'dolent');
          settle(cur, false, feedback, wrap, null);
        };
        box.append(b);
      }
      feedback.append(box);
    }
  }

  setTimeout(() => input.focus(), 50);
  return wrap;
}

/** Record the result, show the answer, and move on. */
function settle(cur, correct, feedback, wrap, extra) {
  const q = cur.q;
  const c = topic.byCode.get(q.code);
  const now = Date.now();
  const key = cur.entry.key;
  state.items[key] = grade(state.items[key] || newItem(), correct, now);
  save(root);
  if (correct) session.right++;

  session.queue.shift();
  session.done.push(cur);
  // A miss goes back into the same session — the second attempt, minutes later, is where
  // it starts to stick.
  if (!correct && !cur.requeued) {
    session.queue.push({ ...cur, rung: 0, requeued: true, q: buildQuestion(cur.entry, topic) });
  }

  wrap.querySelectorAll('form, .opcions, .discret').forEach((x) => { x.remove(); });
  feedback.className = `resposta ${correct ? 'be' : 'malament'}`;
  feedback.innerHTML =
    `<p class="veredicte">${correct ? 'Molt bé!' : 'Era…'}</p>`
    + `<p class="solucio">${solution(c)}</p>`
    + (extra ? `<p class="extra">${extra}</p>` : '')
    + (c.hook ? `<p class="pista">${c.hook}</p>` : '');

  if (q.kind !== 'tap-map') { mapa.mark(q.code, 'correcte'); mapa.raise(q.code, 'correcte'); mapa.focus(q.code, 3.5); }

  const next = h('button', 'primari', session.queue.length ? 'Següent' : 'Acaba');
  next.onclick = () => render(session.queue.length ? screenQuiz() : screenSummary());
  wrap.append(next);
  next.focus();
}

function screenSummary() {
  const p = progress(state, pairs());
  const asked = session.done.length;
  const wrap = h('div', 'pantalla');
  wrap.append(h('h1', null, 'Sessió acabada'));
  wrap.append(h('p', 'marcador', `${session.right} / ${asked}`));

  const wrong = session.done.filter((d) => d.missed);
  const seen = new Set();
  const list = wrong.filter((d) => !seen.has(d.q.code) && seen.add(d.q.code));
  if (list.length) {
    wrap.append(h('p', 'sub', 'Per mirar-te un altre cop:'));
    const ul = h('ul', 'repas');
    for (const d of list) ul.append(h('li', null, solution(topic.byCode.get(d.q.code))));
    wrap.append(ul);
  } else {
    wrap.append(h('p', 'sub', 'Totes bé. '));
  }

  wrap.append(h('p', 'sub', `<b>${p.solid}</b> de ${p.total} dominades.`));
  const again = h('button', 'primari', 'Una altra sessió');
  again.onclick = startSession;
  const home = h('button', 'discret', 'Inici');
  home.onclick = () => render(screenHome());
  wrap.append(again, home);
  mapa.clearMarks(); mapa.reset(); mapa.enablePicking(false);
  return wrap;
}

// ---------------------------------------------------------------- boot

// Anything that needs real geometry (getBBox, and therefore every zoom) has to wait
// until the screen is actually in the document: on a detached node getBBox() returns
// zeros, which silently produced a degenerate viewBox and a blank map.
let afterRender = null;

function render(screen) {
  app.replaceChildren(screen);
  window.scrollTo(0, 0);
  const fn = afterRender;
  afterRender = null;
  if (fn) requestAnimationFrame(fn);
}

window.addEventListener('resize', () => mapa?.refresh());
if (packById(root.pack)) openPack(root.pack);
else render(screenPacks());

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline is a bonus, not a requirement */ });
}
