// Session orchestration: Fase 1 (repàs) then Fase 2 (recorda).
//
// Fase 1 shows answers — comarca, capital, hook, photo — with no demand on him. Fase 2
// makes him produce them. That order is the point: exposure primes, retrieval fixes.

import { COMARQUES } from './geo.js';
import { HINTS } from './hints.js';
import { PHOTOS } from './photos.js';
import { Mapa } from './map.js';
import { load, save, reset } from './store.js';
import { isCorrect, masked } from './answer.js';
import { buildQuestion, options, byCode } from './quiz.js';
import { grade, markStudied, selectDue, selectExamMode, keyOf, newItem, progress }
  from './scheduler.js';

const STUDY_CARDS = 6;
const QUIZ_CARDS = 12;
const DAY = 86400e3;

const app = document.getElementById('app');
let state = load();
let mapa, session;

const activeCodes = () =>
  COMARQUES.map((c) => c.code).filter((c) => state.includeLlucanes || c !== '43');

const examTime = () => (state.examDate ? new Date(`${state.examDate}T09:00`).getTime() : null);
const examMode = () => {
  const t = examTime();
  return t ? t - Date.now() <= DAY && t > Date.now() : false;
};

const h = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

function photoFor(code) {
  const src = PHOTOS[code];
  if (!src) return null;
  const img = h('img', 'foto');
  img.src = `img/capitals/${src}`;
  img.alt = '';
  img.loading = 'lazy';
  // Belt and braces: photos.js only lists files the build actually found, but if one
  // goes missing later the card must still render rather than show a broken image.
  img.onerror = () => img.remove();
  return img;
}

// ---------------------------------------------------------------- screens

function screenHome() {
  const p = progress(state, activeCodes());
  const t = examTime();
  const days = t ? Math.ceil((t - Date.now()) / DAY) : null;

  const wrap = h('div', 'pantalla');
  wrap.append(h('h1', null, 'Comarques'));

  const sub = days == null ? 'Encara no has posat la data de l’examen.'
    : days > 0 ? `Falten <b>${days}</b> dia${days === 1 ? '' : 's'} per l’examen.`
    : 'L’examen és avui. Molta sort!';
  wrap.append(h('p', 'sub', sub));

  const bar = h('div', 'barra');
  bar.append(h('span', null, ''));
  bar.firstChild.style.width = `${p.pct}%`;
  wrap.append(bar);
  wrap.append(h('p', 'sub',
    `<b>${p.solid}</b> de ${p.total} preguntes dominades · ${p.seen} vistes`
    + (p.leeches ? ` · <b>${p.leeches}</b> que es resisteixen` : '')));

  const go = h('button', 'primari', state.sessions ? 'Continua' : 'Comença');
  go.onclick = startSession;
  wrap.append(go);

  const look = h('button', 'secundari', 'Mira el mapa');
  look.onclick = () => render(screenStudyMap());
  wrap.append(look);

  const cfg = h('button', 'discret', 'Opcions');
  cfg.onclick = () => render(screenSettings());
  wrap.append(cfg);

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

  const lab = h('label', 'camp', 'Data de l’examen');
  const date = h('input');
  date.type = 'date';
  date.value = state.examDate || '';
  date.onchange = () => { state.examDate = date.value || null; save(state); };
  lab.append(date);
  wrap.append(lab);

  const tog = h('label', 'camp interruptor');
  const cb = h('input');
  cb.type = 'checkbox';
  cb.checked = !!state.includeLlucanes;
  cb.onchange = () => {
    state.includeLlucanes = cb.checked;
    save(state);
    mapa.setMerged(!state.includeLlucanes);
    count.textContent = `Ara estudia ${activeCodes().length} comarques.`;
  };
  tog.append(cb, h('span', null, 'Incloure el Lluçanès'));
  wrap.append(tog);
  const count = h('p', 'sub', `Ara estudia ${activeCodes().length} comarques.`);
  wrap.append(count);
  wrap.append(h('p', 'nota',
    'El Lluçanès es va crear el 2023 separant-se d’Osona. Molts llibres encara no el '
    + 'compten: si el seu és d’abans, deixa-ho desmarcat (42 comarques).'));

  const back = h('button', 'primari', 'Fet');
  back.onclick = () => render(screenHome());
  wrap.append(back);

  const wipe = h('button', 'discret perill', 'Esborra el progrés');
  wipe.onclick = () => {
    if (confirm('Segur? Es perd tot el progrés.')) {
      reset(); state = load(); render(screenHome());
    }
  };
  wrap.append(wipe);
  return wrap;
}


/**
 * Free study: the whole map with the names on it, at his own pace.
 *
 * Deliberately does not touch the scheduler. Browsing is not retrieval, and counting it
 * as practice would inflate "dominades" and starve the items he actually cannot do.
 */
function screenStudyMap() {
  const wrap = h('div', 'pantalla');
  wrap.append(h('p', 'fase', 'Mapa d’estudi'));

  mapa.clearMarks();
  mapa.reset();
  wrap.append(mapa.element);

  const comptador = h('p', 'sub', '');
  const fitxa = h('div', 'fitxa buida');
  fitxa.innerHTML = '<p class="sub">Toca una comarca per veure-la de prop.</p>';

  mapa.onLabels = (shown, total) => {
    comptador.innerHTML = shown < total
      ? `Es veuen <b>${shown}</b> de ${total} noms. Fes zoom amb dos dits per veure’n més.`
      : `Es veuen tots <b>${total}</b> els noms.`;
  };

  mapa.enablePicking(true);
  mapa.onPick = (code) => {
    const c = byCode.get(code);
    if (!c) return;
    mapa.clearMarks();
    mapa.mark(code, 'destacat');
    mapa.raise(code, 'destacat');
    const hook = HINTS[code]?.hook;
    fitxa.className = 'fitxa';
    fitxa.innerHTML =
      `<h2>${c.name}</h2>`
      + `<p class="capital">Capital: <b>${c.capital}</b></p>`
      + (hook ? `<p class="pista">${hook}</p>` : '')
      + `<p class="prov">Província: ${c.provincia}`
      + (c.provinciaNota ? ` <span class="nota">(${c.provinciaNota})</span>` : '') + '</p>';
    const ph = photoFor(code);
    if (ph) fitxa.append(ph);
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

  afterRender = () => mapa.showLabels(true, !state.includeLlucanes);
  return wrap;
}

// ---------------------------------------------------------------- session

function startSession() {
  const now = Date.now();
  const codes = activeCodes();
  const hard = examMode();

  const picks = hard
    ? selectExamMode(state, codes, QUIZ_CARDS)
    : selectDue(state, codes, STUDY_CARDS + QUIZ_CARDS, now);

  // Fase 1 and Fase 2 work on *different* comarques. Testing what he has just been shown
  // measures short-term memory more than it builds long-term memory; the spacing effect
  // says the test should come later. What he studies now gets tested in a later session,
  // which the scheduler arranges on its own — these items are due again in 20 minutes.
  const study = hard ? [] : picks.slice(0, STUDY_CARDS);
  const quizEntries = hard ? picks : picks.slice(STUDY_CARDS, STUDY_CARDS + QUIZ_CARDS);

  session = {
    study, i: 0,
    queue: quizEntries.map((e) => ({ entry: e, q: buildQuestion(e), rung: 0, missed: false })),
    done: [], right: 0, hard,
  };

  for (const e of study) {
    state.items[e.key] = markStudied(state.items[e.key] || newItem(), now);
  }
  state.sessions++; state.lastSession = now;
  save(state);

  render(study.length ? screenStudy() : screenQuiz());
}

function screenStudy() {
  const e = session.study[session.i];
  const c = byCode.get(e.code);
  const hint = HINTS[e.code] || {};

  const wrap = h('div', 'pantalla');
  wrap.append(h('p', 'fase', `Repàs · ${session.i + 1}/${session.study.length}`));
  wrap.append(mapa.element);
  mapa.clearMarks();
  mapa.enablePicking(false);
  mapa.mark(e.code, 'destacat');
  afterRender = () => { mapa.focus(e.code); mapa.raise(e.code, 'destacat'); };

  const card = h('div', 'fitxa');
  card.append(h('h2', null, c.name));
  card.append(h('p', 'capital', `Capital: <b>${c.capital}</b>`));
  const photo = photoFor(e.code);
  if (photo) card.append(photo);
  if (hint.hook) card.append(h('p', 'pista', hint.hook));
  card.append(h('p', 'prov', `Província: ${c.provincia}`
    + (c.provinciaNota ? ` <span class="nota">(${c.provinciaNota})</span>` : '')));
  wrap.append(card);

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
  wrap.append(h('p', 'fase',
    `${session.hard ? 'Mode examen' : 'Recorda'} · ${session.done.length + 1}/${total}`));

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
    wrap.append(h('p', 'ajuda', 'Toca-la al mapa. Pots fer zoom amb dos dits.'));
    mapa.onPick = (code) => {
      mapa.enablePicking(false);
      const ok = code === q.code;
      if (!ok) { mapa.mark(code, 'error'); mapa.raise(code, 'error'); }
      mapa.mark(q.code, 'correcte'); mapa.raise(q.code, 'correcte');
      mapa.focus(q.code, 3.5);
      settle(cur, ok, feedback, wrap, ok ? null
        : `Aquesta és <b>${byCode.get(code).name}</b>. La que buscaves és aquesta.`);
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
  input.placeholder = q.kind === 'capital-of' ? 'La capital…' : 'La comarca…';
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
      for (const opt of options(q, activeCodes())) {
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
  const c = byCode.get(q.code);
  const now = Date.now();
  const key = cur.entry.key;
  state.items[key] = grade(state.items[key] || newItem(), correct, now, examTime());
  save(state);
  if (correct) session.right++;

  session.queue.shift();
  session.done.push(cur);
  // A miss goes back into the same session — the second attempt, minutes later, is where
  // it starts to stick.
  if (!correct && !cur.requeued) {
    session.queue.push({ ...cur, rung: 0, requeued: true, q: buildQuestion(cur.entry) });
  }

  wrap.querySelectorAll('form, .opcions, .discret').forEach((x) => { x.remove(); });
  feedback.className = `resposta ${correct ? 'be' : 'malament'}`;
  feedback.innerHTML =
    `<p class="veredicte">${correct ? 'Molt bé!' : 'Era…'}</p>`
    + `<p class="solucio"><b>${c.name}</b> — ${c.capital}</p>`
    + (extra ? `<p class="extra">${extra}</p>` : '')
    + (HINTS[q.code]?.hook ? `<p class="pista">${HINTS[q.code].hook}</p>` : '');

  if (q.kind !== 'tap-map') { mapa.mark(q.code, 'correcte'); mapa.raise(q.code, 'correcte'); mapa.focus(q.code, 3.5); }

  const next = h('button', 'primari', session.queue.length ? 'Següent' : 'Acaba');
  next.onclick = () => render(session.queue.length ? screenQuiz() : screenSummary());
  wrap.append(next);
  next.focus();
}

function screenSummary() {
  const p = progress(state, activeCodes());
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
    for (const d of list) {
      const c = byCode.get(d.q.code);
      ul.append(h('li', null, `<b>${c.name}</b> — ${c.capital}`));
    }
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

mapa = new Mapa({});
window.addEventListener('resize', () => mapa.refresh());
mapa.setMerged(!state.includeLlucanes);
render(screenHome());

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline is a bonus, not a requirement */ });
}
