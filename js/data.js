// Carrega as aulas (repositório + importadas), valida e monta os cards.
import * as store from './store.js';
import { parse, plain } from './furigana.js';
import { isKatakana, isKanji, isHiragana } from './util.js';
import * as srs from './srs.js';

export const NIVEIS = ['N5', 'N4', 'N3', 'N2', 'N1', 'extra'];
export const PARTICULAS = ['は', 'が', 'を', 'に', 'へ', 'と', 'で', 'の', 'な'];

export let DB = null; // dados montados
export const problems = []; // avisos de validação/carregamento

// ---------- Validação ----------
export function validateLesson(obj) {
  const errs = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['O conteúdo não é um objeto JSON.'];
  if (obj.formato !== 1) errs.push('Campo "formato" deve ser 1.');
  if (typeof obj.aula !== 'number' || !Number.isFinite(obj.aula)) errs.push('Campo "aula" deve ser um número.');
  const arr = (k) => obj[k] === undefined || Array.isArray(obj[k]) || errs.push(`"${k}" deve ser uma lista.`);
  ['vocab', 'katakana', 'kanji', 'frases', 'erros', 'haiku'].forEach(arr);
  const ids = new Set();
  const need = (sec, fields) =>
    (Array.isArray(obj[sec]) ? obj[sec] : []).forEach((it, i) => {
      for (const f of fields) if (it?.[f] === undefined || it[f] === '') errs.push(`${sec}[${i}] sem "${f}".`);
      if (it?.id) {
        if (ids.has(it.id)) errs.push(`id repetido: ${it.id}`);
        ids.add(it.id);
      }
      if (it?.nivel && !NIVEIS.includes(it.nivel)) errs.push(`${sec}[${i}] nível inválido: ${it.nivel}`);
    });
  need('vocab', ['id', 'jp', 'pt']);
  need('katakana', ['id', 'jp', 'romaji', 'pt']);
  need('kanji', ['k', 'pt']);
  need('frases', ['id', 'jp', 'pt']);
  need('erros', ['id', 'errado', 'certo']);
  need('haiku', ['id', 'versos']);
  (obj.haiku || []).forEach((h, i) => {
    if (!Array.isArray(h?.versos)) errs.push(`haiku[${i}] sem lista de versos.`);
  });
  return errs;
}

// ---------- Carregamento ----------
async function fetchRepoLessons() {
  const out = [];
  try {
    const idx = await (await fetch('data/aulas/index.json', { cache: 'no-cache' })).json();
    const files = Array.isArray(idx) ? idx : idx.aulas || [];
    for (const f of files) {
      try {
        const res = await fetch(`data/aulas/${f}`, { cache: 'no-cache' });
        const obj = await res.json();
        const errs = validateLesson(obj);
        if (errs.length) problems.push(`${f}: ${errs.join(' ')}`);
        else out.push({ ...obj, _origem: 'repositório', _arquivo: f });
      } catch (e) {
        problems.push(`Não consegui ler ${f}.`);
      }
    }
  } catch (e) {
    problems.push('Não consegui ler data/aulas/index.json.');
  }
  return out;
}

export async function load() {
  problems.length = 0;
  const repo = await fetchRepoLessons();
  const repoNums = new Set(repo.map((l) => l.aula));
  const imported = (store.get().importedLessons || []).map((l) => ({ ...l, _origem: 'importada', _ignorada: repoNums.has(l.aula) }));
  const lessons = [...repo, ...imported.filter((l) => !l._ignorada)].sort((a, b) => a.aula - b.aula);
  DB = build(lessons);
  DB.imported = imported;
  return DB;
}

export function importLesson(obj) {
  const errs = validateLesson(obj);
  if (errs.length) throw new Error(errs.slice(0, 6).join('\n') + (errs.length > 6 ? `\n(+${errs.length - 6})` : ''));
  const s = store.get();
  s.importedLessons = (s.importedLessons || []).filter((l) => l.aula !== obj.aula);
  s.importedLessons.push(obj);
  store.save();
}

export function removeImported(aula) {
  const s = store.get();
  s.importedLessons = (s.importedLessons || []).filter((l) => l.aula !== aula);
  store.save();
}

// ---------- Montagem ----------
function build(lessons) {
  const db = { lessons, vocab: [], katakana: [], kanji: [], frases: [], erros: [], haiku: [], cards: [], byCard: {} };
  const kanjiMap = new Map();
  for (const L of lessons) {
    const aula = L.aula;
    for (const v of L.vocab || []) db.vocab.push({ ...v, aula, tags: v.tags || [] });
    for (const k of L.katakana || []) db.katakana.push({ ...k, aula, tags: ['katakana', ...(k.erro ? ['erro'] : [])] });
    for (const f of L.frases || []) db.frases.push({ ...f, aula, tags: f.tags || [] });
    for (const e of L.erros || []) db.erros.push({ ...e, aula, tags: ['erro', ...(e.tipo ? [e.tipo] : [])] });
    for (const h of L.haiku || []) db.haiku.push({ ...h, aula, tags: ['haiku'] });
    for (const k of L.kanji || []) {
      if (kanjiMap.has(k.k)) kanjiMap.get(k.k).aulas.push(aula);
      else kanjiMap.set(k.k, { ...k, aulas: [aula], aula, tags: ['kanji'] });
    }
  }
  db.kanji = [...kanjiMap.values()];

  // Palavras em katakana puro do vocabulário também entram no treino de katakana.
  const kataVocab = db.vocab.filter((v) => [...plain(v.jp)].every((c) => isKatakana(c)) && v.romaji);
  db.katakanaPool = [...db.katakana, ...kataVocab.map((v) => ({ ...v, _vocab: true }))];

  const add = (card) => {
    db.cards.push(card);
    db.byCard[card.id] = card;
  };
  for (const v of db.vocab) {
    add({ id: `${v.id}:rec`, kind: 'vocab-rec', item: v, aula: v.aula, nivel: v.nivel, tags: ['vocab', ...v.tags] });
    add({ id: `${v.id}:prod`, kind: 'vocab-prod', item: v, aula: v.aula, nivel: v.nivel, tags: ['vocab', ...v.tags] });
  }
  for (const f of db.frases) add({ id: f.id, kind: 'frase', item: f, aula: f.aula, nivel: null, tags: ['frase', ...f.tags] });
  for (const e of db.erros) add({ id: e.id, kind: 'erro', item: e, aula: e.aula, nivel: null, tags: e.tags });
  for (const k of db.katakana) add({ id: `${k.id}:kata`, kind: 'kata', item: k, aula: k.aula, nivel: null, tags: k.tags, dormant: true });

  const tagSet = new Set();
  [...db.vocab, ...db.frases, ...db.erros, ...db.katakana, ...db.haiku].forEach((i) => i.tags.forEach((t) => tagSet.add(t)));
  tagSet.add('vocab');
  tagSet.add('frase');
  tagSet.add('kanji');
  db.tags = [...tagSet].sort((a, b) => a.localeCompare(b, 'pt'));
  db.particleQs = buildParticleQs(db.frases);
  return db;
}

// Cards de katakana só entram no SRS se marcados como erro na aula ou errados no treino cronometrado.
export function cardActive(card) {
  if (!card.dormant) return true;
  return !!card.item.erro || !!srs.getCard(card.id)?.active;
}

// ---------- Filtros ----------
export function matches(item, f = store.get().filter) {
  if (f.aula && !(item.aulas ? item.aulas.includes(Number(f.aula)) : item.aula === Number(f.aula))) return false;
  if (f.nivel && item.nivel !== f.nivel) return false;
  if (f.tag && !(item.tags || []).includes(f.tag)) return false;
  return true;
}

export const filterActive = () => {
  const f = store.get().filter;
  return !!(f.aula || f.nivel || f.tag);
};

export function filterLabel() {
  const f = store.get().filter;
  const p = [];
  if (f.aula) p.push(`Aula ${f.aula}`);
  if (f.nivel) p.push(f.nivel);
  if (f.tag) p.push(`#${f.tag}`);
  return p.join(' · ');
}

// ---------- Partículas ----------
// Acha partículas soltas nas frases: hiragana da lista logo depois de um kanji (com furigana)
// ou de katakana. で seguido de す/し (です, でした) não conta. な só conta antes de substantivo em kanji.
export function findParticles(markup) {
  const segs = parse(markup);
  const found = [];
  segs.forEach((seg, si) => {
    if (seg.t !== 'text') return;
    const chars = [...seg.s];
    chars.forEach((c, ci) => {
      if (!PARTICULAS.includes(c)) return;
      const prevIsNoun = ci === 0 ? segs[si - 1]?.t === 'ruby' : isKatakana(chars[ci - 1]) || isKanji(chars[ci - 1]);
      const nextChar = chars[ci + 1];
      const nextIsRuby = ci === chars.length - 1 && segs[si + 1]?.t === 'ruby';
      if (c === 'な') {
        if (nextIsRuby && ci > 0 && isHiragana(chars[ci - 1])) found.push({ si, ci, p: c });
        return;
      }
      if (!prevIsNoun) return;
      if (c === 'で' && nextChar && 'すし'.includes(nextChar)) return;
      found.push({ si, ci, p: c });
    });
  });
  return found;
}

function buildParticleQs(frases) {
  const qs = [];
  for (const f of frases) {
    findParticles(f.jp).forEach((pos, n) => qs.push({ key: `${f.id}#${n}`, frase: f, ...pos, aula: f.aula, nivel: null, tags: ['frase', ...f.tags] }));
  }
  return qs;
}

// Pares que as duas opções podem estar certas na mesma frase: não viram distratores um do outro.
const AMBIGUOS = { は: ['が'], が: ['は'], に: ['へ'], へ: ['に'] };
export function particleOptions(correct) {
  const pool = PARTICULAS.filter((p) => p !== correct && !(AMBIGUOS[correct] || []).includes(p));
  const pick = [];
  const copy = [...pool];
  while (pick.length < 3 && copy.length) pick.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  return [correct, ...pick].sort(() => Math.random() - 0.5);
}

// ---------- Moras ----------
const PEQUENOS = new Set([...'ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ']);
export function countMoras(kana) {
  return [...String(kana || '')].filter((c) => (isHiragana(c) || isKatakana(c)) && !PEQUENOS.has(c) && c !== '・').length;
}
