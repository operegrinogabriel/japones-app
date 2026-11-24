// Utilidades gerais

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// O "dia de estudo" vira às 4h da manhã, como no Anki.
const DAY_CUTOFF_H = 4;
export function dayKey(ts = Date.now()) {
  const d = new Date(ts - DAY_CUTOFF_H * 3600e3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function endOfStudyDay(ts = Date.now()) {
  const d = new Date(ts - DAY_CUTOFF_H * 3600e3);
  d.setHours(24 + DAY_CUTOFF_H, 0, 0, 0);
  return d.getTime();
}
export function prevDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1, 12);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Normaliza para busca: minúsculas, sem acentos nem macrons.
export function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}
// Variante de romaji com vogais longas escritas por extenso (ō → ou, ū → uu).
export function romajiVariants(s) {
  const low = String(s ?? '').toLowerCase();
  return [norm(low), norm(low.replace(/ō/g, 'ou').replace(/ū/g, 'uu').replace(/ā/g, 'aa').replace(/ī/g, 'ii').replace(/ē/g, 'ei')), norm(low.replace(/ō/g, 'oo'))];
}

export function fmtInterval(ms) {
  const min = ms / 60e3;
  if (min < 60) return `${Math.max(1, Math.round(min))} min`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)} h`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)} d`;
  const mo = d / 30;
  if (mo < 12) return `${mo.toFixed(mo < 3 ? 1 : 0).replace('.', ',')} m`;
  return `${(d / 365).toFixed(1).replace('.', ',')} a`;
}

export function fmtSecs(ms) {
  return (ms / 1000).toFixed(1).replace('.', ',') + ' s';
}

export function toast(msg, ms = 2200) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

export function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

export const isKatakana = (c) => /[゠-ヿ]/.test(c);
export const isKanji = (c) => /[一-鿿々]/.test(c);
export const isHiragana = (c) => /[぀-ゟ]/.test(c);
