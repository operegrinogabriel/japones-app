// Progresso salvo no aparelho (localStorage)
import { dayKey, prevDayKey } from './util.js';

const KEY = 'japones-app:v1';

const DEFAULTS = () => ({
  version: 1,
  createdAt: Date.now(),
  cards: {}, // id → estado SRS
  log: {}, // 'AAAA-MM-DD' → { reviews, novos, extraNovos }
  settings: {
    furigana: 'sempre', // sempre | verso | nunca
    romaji: false,
    rate: 1,
    autoplay: false,
    newPerDay: 10,
    sessionMax: 20,
  },
  filter: { aula: '', nivel: '', tag: '' },
  katakanaRuns: [], // { at, ms, n, erros: [ids] }
  hardParticles: {}, // chave da pergunta → nº de erros
  hist: [], // respostas da revisão { at, id, g, novo }, para o relatório
  particleHist: [], // respostas do quiz de partículas { at, key, p, escolhida }
  importedLessons: [], // JSON de aulas importadas pelo app
  lastBackup: 0,
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    return merge(DEFAULTS(), JSON.parse(raw));
  } catch (e) {
    console.error('Falha ao ler progresso', e);
    return DEFAULTS();
  }
}

function merge(base, obj) {
  const out = { ...base, ...obj };
  out.settings = { ...base.settings, ...(obj.settings || {}) };
  out.filter = { ...base.filter, ...(obj.filter || {}) };
  return out;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Falha ao salvar progresso', e);
    alert('Não consegui salvar o progresso neste aparelho. Exporte um backup em Ajustes.');
  }
}

export const get = () => state;
export const settings = () => state.settings;

export function setSetting(k, v) {
  state.settings[k] = v;
  save();
}

// Guarda um evento num histórico, mantendo só os últimos 120 dias. Não salva sozinho.
const KEEP_MS = 120 * 86400e3;
export function logEvent(list, entry) {
  const arr = (state[list] = state[list] || []);
  const now = Date.now();
  arr.push({ at: now, ...entry });
  if (arr.length && arr[0].at < now - KEEP_MS) state[list] = arr.filter((e) => e.at >= now - KEEP_MS);
}

export function today() {
  const k = dayKey();
  if (!state.log[k]) state.log[k] = { reviews: 0, novos: 0, extraNovos: 0 };
  return state.log[k];
}

export function streak() {
  let k = dayKey();
  let n = 0;
  if (!(state.log[k]?.reviews > 0)) k = prevDayKey(k); // hoje ainda não estudou: conta até ontem
  while (state.log[k]?.reviews > 0) {
    n++;
    k = prevDayKey(k);
  }
  return n;
}

export function exportJSON() {
  return JSON.stringify({ app: 'japones-app', tipo: 'backup', exportadoEm: new Date().toISOString(), state }, null, 1);
}

export function importJSON(text) {
  const obj = JSON.parse(text);
  if (obj?.app !== 'japones-app' || obj?.tipo !== 'backup' || typeof obj.state !== 'object') throw new Error('Este arquivo não é um backup do app.');
  state = merge(DEFAULTS(), obj.state);
  save();
}

export function resetProgress() {
  const keep = { settings: state.settings, importedLessons: state.importedLessons, filter: state.filter };
  state = { ...DEFAULTS(), ...keep };
  save();
}

export function markBackup() {
  state.lastBackup = Date.now();
  save();
}

export function backupDue() {
  const ref = state.lastBackup || state.createdAt;
  const hasProgress = Object.keys(state.cards).length > 0;
  return hasProgress && Date.now() - ref > 14 * 86400e3;
}
