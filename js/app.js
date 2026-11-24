// Roteador e eventos globais
import * as store from './store.js';
import * as data from './data.js';
import * as tts from './tts.js';
import * as ui from './ui.js';
import * as review from './review.js';
import * as views from './views.js';
import * as browse from './browse.js';
import * as report from './report.js';
import { esc } from './util.js';

const root = document.getElementById('app');

const ROUTES = {
  '': views.home,
  revisar: review.render,
  erros: views.erros,
  particulas: views.particulas,
  dificeis: views.dificeis,
  katakana: views.katakana,
  kanji: browse.kanji,
  haiku: browse.haiku,
  busca: browse.busca,
  ajustes: browse.ajustes,
  relatorio: report.render,
};

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  return { path: path || '', params: Object.fromEntries(new URLSearchParams(qs || '')) };
}

function route() {
  root._cleanup?.();
  root._cleanup = null;
  ui.closeSheet();
  const { path, params } = parseHash();
  const view = ROUTES[path] || views.home;
  view(root, params, reload);
  window.scrollTo(0, 0);
}

async function reload() {
  await data.load();
  route();
}

// Cliques globais: áudio, romaji, furigana escondido, filtros.
document.addEventListener('click', (e) => {
  const say = e.target.closest('[data-say]');
  if (say) {
    e.preventDefault();
    tts.speak(say.dataset.say);
    return;
  }
  const rom = e.target.closest('[data-romaji]');
  if (rom) {
    rom.outerHTML = `<div class="romaji">${esc(rom.dataset.romaji)}</div>`;
    return;
  }
  const ruby = e.target.closest('ruby');
  if (ruby) ruby.classList.toggle('show');
  if (e.target.closest('[data-open-filter]')) ui.openFilterSheet(route);
});

window.addEventListener('hashchange', route);
tts.onChange(() => {
  // Atualiza o aviso de voz na tela inicial quando as vozes terminam de carregar.
  if (parseHash().path === '' && document.querySelector('.home')) route();
});

document.body.dataset.furigana = store.settings().furigana;

reload();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW não registrado', e));
}
