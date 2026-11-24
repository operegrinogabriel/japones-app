// Sessão de revisão (SRS)
import { esc, fmtInterval, shuffle, endOfStudyDay } from './util.js';
import { plain, toHTML, diffMask } from './furigana.js';
import * as store from './store.js';
import * as data from './data.js';
import * as srs from './srs.js';
import * as tts from './tts.js';
import * as ui from './ui.js';

const DECKS = {
  todos: 'Revisão',
  erros: 'Meus erros',
  dificeis: 'Difíceis',
  katakana: 'Katakana',
};

function candidates(deck) {
  let c = data.DB.cards.filter((card) => data.cardActive(card) && data.matches(card));
  if (deck === 'erros') c = c.filter((card) => card.kind === 'erro');
  if (deck === 'katakana') c = c.filter((card) => card.kind === 'kata');
  return c;
}

const startOfToday = () => endOfStudyDay() - 86400e3;

// Um card de produção (pt → jp) só aparece como novo depois que o de reconhecimento
// foi visto num dia anterior.
function newEligible(card) {
  if (card.kind !== 'vocab-prod') return true;
  const rec = srs.getCard(card.id.replace(/:prod$/, ':rec'));
  return !!rec && rec.state !== 'new' && rec.last < startOfToday();
}

export function newQuota() {
  const s = store.settings();
  const t = store.today();
  return Math.max(0, Number(s.newPerDay) + (t.extraNovos || 0) - t.novos);
}

export function counts(deck = 'todos') {
  const now = Date.now();
  const c = candidates(deck);
  const due = c.filter((card) => srs.isDue(card.id, now)).length;
  const laterToday = c.filter((card) => {
    const s = srs.getCard(card.id);
    return s && s.state !== 'new' && s.due > now && s.due < endOfStudyDay();
  }).length;
  const newAvail = c.filter((card) => srs.isNew(card.id) && newEligible(card)).length;
  return { due, laterToday, newAvail, newToday: Math.min(newAvail, newQuota()) };
}

// Cards novos em rodízio por tipo (vocabulário, frase, erro...), mantendo a ordem das aulas,
// para não passar dias só com vocabulário.
function mixKinds(cards) {
  const groups = {};
  for (const card of cards) {
    const k = card.kind === 'vocab-prod' ? 'vocab-rec' : card.kind;
    (groups[k] = groups[k] || []).push(card);
  }
  const weights = { 'vocab-rec': 3, frase: 1, erro: 1, kata: 1 };
  const out = [];
  const lists = Object.entries(groups);
  while (lists.some(([, l]) => l.length)) for (const [k, l] of lists) for (let n = 0; n < (weights[k] || 1) && l.length; n++) out.push(l.shift());
  return out;
}

function buildQueue(deck) {
  const now = Date.now();
  const max = Number(store.settings().sessionMax) || 20;
  const c = candidates(deck);
  if (deck === 'dificeis') return shuffle(c.filter((card) => srs.isHard(card.id))).slice(0, max);
  const due = c
    .filter((card) => srs.isDue(card.id, now))
    .sort((a, b) => (srs.isLearning(b.id) - srs.isLearning(a.id)) || srs.getCard(a.id).due - srs.getCard(b.id).due)
    .slice(0, max);
  const news = mixKinds(c.filter((card) => srs.isNew(card.id) && newEligible(card))).slice(0, Math.min(newQuota(), max - due.length));
  // Intercala os novos entre as revisões.
  if (!news.length) return due;
  const out = [];
  const step = Math.max(1, Math.floor(due.length / news.length));
  let n = 0;
  due.forEach((card, i) => {
    out.push(card);
    if ((i + 1) % step === 0 && n < news.length) out.push(news[n++]);
  });
  while (n < news.length) out.push(news[n++]);
  return out;
}

// ---------- Faces dos cards ----------
function frontHTML(card) {
  const it = card.item;
  switch (card.kind) {
    case 'vocab-rec':
      return `<div class="prompt-label">O que significa?</div>${ui.jp(it.jp, { say: it.kana || plain(it.jp), romaji: it.romaji, size: 'xl' })}`;
    case 'vocab-prod':
      return `<div class="prompt-label">Como se diz em japonês?</div><div class="pt-big">${esc(it.pt)}</div>`;
    case 'frase':
      return `<div class="prompt-label">Traduza</div>${ui.jp(it.jp, { romaji: it.romaji, size: 'l' })}`;
    case 'erro':
      return `<div class="prompt-label">O que está errado?</div><div class="jp jp-l wrong" lang="ja">${toHTML(it.errado)}</div>`;
    case 'kata':
      return `<div class="prompt-label">Leia em voz alta</div><div class="jp-block"><div class="jp jp-xl" lang="ja">${esc(it.jp)}</div></div>`;
  }
  return '';
}

function backHTML(card) {
  const it = card.item;
  const nota = it.nota ? `<div class="nota">${esc(it.nota)}</div>` : '';
  switch (card.kind) {
    case 'vocab-rec':
      return `<div class="answer"><div class="pt-big">${esc(it.pt)}</div>${it.kana && it.kana !== plain(it.jp) ? `<div class="kana" lang="ja">${esc(it.kana)}</div>` : ''}${nota}${ui.chips(it)}</div>`;
    case 'vocab-prod':
      return `<div class="answer">${ui.jp(it.jp, { say: it.kana || plain(it.jp), romaji: it.romaji, size: 'xl' })}${it.kana && it.kana !== plain(it.jp) ? `<div class="kana" lang="ja">${esc(it.kana)}</div>` : ''}${nota}${ui.chips(it)}</div>`;
    case 'frase':
      return `<div class="answer"><div class="pt-med">${esc(it.pt)}</div>${nota}${ui.chips(it)}</div>`;
    case 'erro': {
      const { maskA, maskB } = diffMask(plain(it.errado), plain(it.certo));
      return `<div class="answer"><div class="prompt-label">Você escreveu</div><div class="jp jp-m strike" lang="ja">${toHTML(it.errado, maskA)}</div><div class="prompt-label">Natural</div>${ui.jp(it.certo, { mark: maskB, size: 'l' })}<div class="nota">${esc(it.explicacao || '')}</div>${ui.chips(it)}</div>`;
    }
    case 'kata':
      return `<div class="answer"><div class="romaji big">${esc(it.romaji)}</div><div class="pt-med">${esc(it.pt)}</div>${audioLine(it.jp)}${nota}</div>`;
  }
  return '';
}

const audioLine = (t) => `<div class="center">${ui.audioBtn(t)}</div>`;

function sayText(card) {
  const it = card.item;
  if (card.kind === 'vocab-rec' || card.kind === 'vocab-prod') return it.kana || plain(it.jp);
  if (card.kind === 'erro') return plain(it.certo);
  return plain(it.jp);
}

// ---------- Tela ----------
export function render(root, params) {
  const deck = DECKS[params.deck] ? params.deck : 'todos';
  const queue = buildQueue(deck);
  const sess = { queue, i: 0, flipped: false, done: 0, ok: 0, seen: new Set(), shownAt: Date.now() };

  if (!queue.length) {
    const c = counts(deck);
    root.innerHTML = `${ui.header(DECKS[deck])}<main class="pad">
      ${ui.empty(`<div class="big-emoji">🌸</div><h2>Nada para revisar agora</h2>
      <p>${c.laterToday ? `${c.laterToday} card(s) voltam mais tarde hoje.` : 'Volte amanhã.'}</p>
      ${deck !== 'dificeis' && c.newAvail > c.newToday ? `<button class="btn primary" data-more>Estudar mais 10 novos</button>` : ''}
      ${data.filterActive() ? `<p class="muted small">Filtro ativo: ${esc(data.filterLabel())}</p>` : ''}`)}
      </main>`;
    root.querySelector('[data-more]')?.addEventListener('click', () => {
      store.today().extraNovos = (store.today().extraNovos || 0) + 10;
      store.save();
      render(root, params);
    });
    return;
  }

  const draw = () => {
    const card = sess.queue[sess.i];
    if (!card) return finish();
    const remaining = sess.queue.length - sess.i;
    const pct = Math.round((sess.done / (sess.done + remaining)) * 100);
    const state = srs.getCard(card.id);
    const isNew = !state || state.state === 'new';
    const star = !!state?.star;
    root.innerHTML = `${ui.header(DECKS[deck])}
      <div class="progress"><div style="width:${pct}%"></div></div>
      <main class="study ${sess.flipped ? 'flipped' : ''}">
        <div class="card-meta">
          <span class="chip ${isNew ? 'chip-new' : ''}">${isNew ? 'novo' : srs.isLearning(card.id) ? 'aprendendo' : 'revisão'}</span>
          <span class="muted small">${remaining} restante(s)</span>
          <button class="icon-btn star ${star ? 'on' : ''}" data-star aria-label="Marcar como difícil">${ui.ICON.star}</button>
        </div>
        <section class="card">
          ${sess.flipped && card.kind === 'erro' ? '' : `<div class="face front">${frontHTML(card)}</div>`}
          ${sess.flipped ? `${card.kind === 'erro' ? '' : '<hr>'}<div class="face back">${backHTML(card)}</div>` : ''}
        </section>
      </main>
      <footer class="actions">
        ${
          sess.flipped
            ? `<div class="grades">${srs.GRADES.map((g) => `<button class="grade ${g.cls}" data-grade="${g.g}"><span>${g.label}</span><small>${fmtInterval(srs.preview(card.id, g.g))}</small></button>`).join('')}</div>`
            : `<button class="btn primary block xl" data-flip>Mostrar resposta</button>`
        }
      </footer>`;
    root.querySelector('[data-flip]')?.addEventListener('click', flip);
    root.querySelectorAll('[data-grade]').forEach((b) => b.addEventListener('click', () => grade(Number(b.dataset.grade))));
    root.querySelector('[data-star]').addEventListener('click', (e) => {
      const on = srs.toggleStar(card.id);
      e.currentTarget.classList.toggle('on', on);
    });
    if (!sess.flipped && store.settings().autoplay && card.kind !== 'vocab-prod' && card.kind !== 'erro' && card.kind !== 'kata') tts.speak(sayText(card));
  };

  const flip = () => {
    if (sess.flipped) return;
    sess.flipped = true;
    draw();
    const card = sess.queue[sess.i];
    if (store.settings().autoplay) tts.speak(sayText(card));
  };

  const grade = (g) => {
    const card = sess.queue[sess.i];
    const after = srs.answer(card.id, g);
    if (!sess.seen.has(card.id)) {
      sess.seen.add(card.id);
      if (g > 1) sess.ok++;
    }
    sess.done++;
    // Cards ainda em aprendizado voltam alguns cards depois, na mesma sessão.
    if ((after.state === 'learning' || after.state === 'relearning') && after.due - Date.now() <= 15 * 60e3) {
      const pos = Math.min(sess.queue.length, sess.i + 1 + (g === 1 ? 3 : 6));
      sess.queue.splice(pos, 0, card);
    }
    sess.i++;
    sess.flipped = false;
    draw();
  };

  const finish = () => {
    const n = sess.seen.size;
    const pct = n ? Math.round((sess.ok / n) * 100) : 0;
    const c = counts(deck);
    root.innerHTML = `${ui.header(DECKS[deck])}<main class="pad">
      ${ui.empty(`<div class="big-emoji">🎉</div><h2>Sessão concluída</h2>
        <p>${n} card(s), ${pct}% de primeira.</p>
        <p class="muted">Sequência: ${store.streak()} dia(s)</p>
        ${c.due + c.newToday > 0 ? `<button class="btn primary" data-again>Mais uma sessão (${c.due + c.newToday})</button>` : ''}
        <a class="btn ghost" href="#/">Voltar ao início</a>`)}
      </main>`;
    root.querySelector('[data-again]')?.addEventListener('click', () => render(root, params));
  };

  // Atalhos de teclado (computador): espaço vira, 1–4 avaliam.
  const onKey = (e) => {
    if (!root.isConnected || !document.body.contains(root.querySelector('.study'))) return;
    if (e.target.matches?.('input, textarea, select')) return;
    if ((e.key === ' ' || e.key === 'Enter') && !sess.flipped) {
      e.preventDefault();
      flip();
    } else if (sess.flipped && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key));
  };
  document.addEventListener('keydown', onKey);
  root._cleanup = () => document.removeEventListener('keydown', onKey);

  draw();
}
