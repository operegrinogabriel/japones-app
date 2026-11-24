// Componentes de interface compartilhados
import { esc } from './util.js';
import { toHTML, plain } from './furigana.js';
import * as store from './store.js';
import * as data from './data.js';
import * as tts from './tts.js';

export const ICON = {
  audio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor"/></svg>',
};

// Botão de áudio. `text` é o que a voz vai ler.
export const audioBtn = (text, label = 'Ouvir') =>
  text ? `<button class="icon-btn audio" data-say="${esc(text)}" aria-label="${esc(label)}" title="${esc(label)} (voz sintética)">${ICON.audio}</button>` : '';

// Bloco de texto japonês com furigana, áudio e romaji opcional.
export function jp(markup, { say, romaji, size = 'l', mark = null } = {}) {
  const sayText = say ?? plain(markup);
  const showRomaji = store.settings().romaji;
  const r = romaji
    ? showRomaji
      ? `<div class="romaji">${esc(romaji)}</div>`
      : `<button class="link romaji-btn" data-romaji="${esc(romaji)}">mostrar romaji</button>`
    : '';
  return `<div class="jp-block"><div class="jp jp-${size}" lang="ja">${toHTML(markup, mark)}</div>${audioBtn(sayText)}</div>${r}`;
}

export function chips(item) {
  const out = [];
  if (item.nivel) out.push(`<span class="chip lvl lvl-${esc(item.nivel)}">${esc(item.nivel)}</span>`);
  if (item.aula) out.push(`<span class="chip">Aula ${esc(item.aula)}</span>`);
  for (const t of item.tags || []) if (t !== 'vocab' && t !== 'frase') out.push(`<span class="chip ${t === 'erro' ? 'chip-erro' : ''}">#${esc(t)}</span>`);
  return `<div class="chips">${out.join('')}</div>`;
}

// Cabeçalho das telas internas.
export function header(title, { back = '#/', filter = true } = {}) {
  const fl = data.filterLabel();
  return `<header class="top">
    <a class="icon-btn" href="${back}" aria-label="Voltar">${ICON.back}</a>
    <h1>${esc(title)}</h1>
    ${filter ? `<button class="filter-btn ${fl ? 'on' : ''}" data-open-filter aria-label="Filtros">${ICON.filter}<span>${fl ? esc(fl) : 'Filtros'}</span></button>` : '<span></span>'}
  </header>`;
}

export function openFilterSheet(onChange) {
  const f = store.get().filter;
  const DB = data.DB;
  const aulas = DB.lessons.map((l) => l.aula);
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(label)}</option>`;
  const html = `
    <h2>Filtros</h2>
    <p class="muted small">Valem para todas as telas: revisão, listas, kanji, quiz e katakana.</p>
    <label class="field">Aula
      <select name="aula">${opt('', 'Todas', f.aula)}${aulas.map((a) => opt(a, `Aula ${a}`, f.aula)).join('')}</select></label>
    <label class="field">Nível
      <select name="nivel">${opt('', 'Todos', f.nivel)}${data.NIVEIS.map((n) => opt(n, n, f.nivel)).join('')}</select></label>
    <p class="muted small">O filtro de nível só mostra o que tem nível (vocabulário e kanji).</p>
    <label class="field">Etiqueta
      <select name="tag">${opt('', 'Todas', f.tag)}${DB.tags.map((t) => opt(t, '#' + t, f.tag)).join('')}</select></label>
    <div class="sheet-actions">
      <button class="btn ghost" data-clear>Limpar</button>
      <button class="btn primary" data-close>Aplicar</button>
    </div>`;
  const sheet = openSheet(html);
  const apply = () => {
    const s = store.get();
    s.filter = {
      aula: sheet.querySelector('[name=aula]').value,
      nivel: sheet.querySelector('[name=nivel]').value,
      tag: sheet.querySelector('[name=tag]').value,
    };
    store.save();
  };
  sheet.querySelector('[data-clear]').onclick = () => {
    store.get().filter = { aula: '', nivel: '', tag: '' };
    store.save();
    closeSheet();
    onChange?.();
  };
  sheet.querySelector('[data-close]').onclick = () => {
    apply();
    closeSheet();
    onChange?.();
  };
}

export function openSheet(innerHTML) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${innerHTML}</div>`;
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) closeSheet();
  });
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  return wrap.querySelector('.sheet');
}

export function closeSheet() {
  document.querySelectorAll('.sheet-wrap').forEach((w) => w.remove());
}

export function voiceBanner() {
  if (!tts.supported()) return `<div class="banner warn">Este navegador não tem síntese de voz, então os botões de áudio não funcionam.</div>`;
  if (tts.voicesChecked() && !tts.hasJapanese())
    return `<details class="banner warn"><summary>Sem voz japonesa no aparelho. Como instalar</summary>${tts.VOICE_HELP}</details>`;
  return '';
}

export function empty(msg) {
  return `<div class="empty">${msg}</div>`;
}
