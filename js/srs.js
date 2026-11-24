// Repetição espaçada: SM-2 com etapas de aprendizado (como o Anki).
import * as store from './store.js';

const MIN = 60e3;
const DAY = 86400e3;
const LEARN_STEPS = [1 * MIN, 10 * MIN];
const RELEARN_STEPS = [10 * MIN];
const GRAD_GOOD = 1; // dias
const GRAD_EASY = 4;
const START_EASE = 2.5;
const MIN_EASE = 1.3;

export const GRADES = [
  { g: 1, label: 'De novo', cls: 'again' },
  { g: 2, label: 'Difícil', cls: 'hard' },
  { g: 3, label: 'Bom', cls: 'good' },
  { g: 4, label: 'Fácil', cls: 'easy' },
];

export function getCard(id) {
  return store.get().cards[id];
}

export function isNew(id) {
  const c = getCard(id);
  return !c || c.state === 'new';
}

export function isDue(id, now = Date.now()) {
  const c = getCard(id);
  return !!c && c.state !== 'new' && c.due <= now;
}

const fuzz = (days) => (days < 3 ? days : days * (0.95 + Math.random() * 0.1));

// Calcula o próximo estado sem salvar (usado também para mostrar o intervalo nos botões).
export function next(prev, grade, now = Date.now()) {
  const c = prev ? { ...prev } : { state: 'new', ease: START_EASE, interval: 0, reps: 0, lapses: 0, fails: 0, step: 0 };
  c.last = now;
  if (grade === 1) c.fails = (c.fails || 0) + 1;

  if (c.state === 'new' || c.state === 'learning' || c.state === 'relearning') {
    const relearn = c.state === 'relearning';
    const steps = relearn ? RELEARN_STEPS : LEARN_STEPS;
    if (c.state === 'new') {
      c.state = 'learning';
      c.step = 0;
    }
    if (grade === 1) {
      c.step = 0;
      c.due = now + steps[0];
    } else if (grade === 2) {
      const cur = steps[Math.min(c.step, steps.length - 1)];
      const nxt = steps[c.step + 1] ?? cur * 1.5;
      c.due = now + (c.step === 0 ? (cur + nxt) / 2 : cur);
    } else if (grade === 3) {
      c.step += 1;
      if (c.step >= steps.length) {
        c.state = 'review';
        c.interval = relearn ? Math.max(1, c.interval) : GRAD_GOOD;
        c.due = now + c.interval * DAY;
      } else c.due = now + steps[c.step];
    } else {
      c.state = 'review';
      c.interval = relearn ? Math.max(2, c.interval * 1.5) : GRAD_EASY;
      c.due = now + c.interval * DAY;
    }
    c.reps++;
    return c;
  }

  // Revisão
  const overdueDays = Math.max(0, (now - c.due) / DAY);
  if (grade === 1) {
    c.lapses++;
    c.ease = Math.max(MIN_EASE, c.ease - 0.2);
    c.interval = Math.max(1, Math.round(c.interval * 0.5));
    c.state = 'relearning';
    c.step = 0;
    c.due = now + RELEARN_STEPS[0];
  } else {
    let iv;
    if (grade === 2) {
      c.ease = Math.max(MIN_EASE, c.ease - 0.15);
      iv = Math.max(c.interval + 1, c.interval * 1.2);
    } else if (grade === 3) {
      iv = Math.max(c.interval + 1, (c.interval + overdueDays / 2) * c.ease);
    } else {
      c.ease += 0.15;
      iv = Math.max(c.interval + 2, (c.interval + overdueDays) * c.ease * 1.3);
    }
    c.interval = Math.min(3650, fuzz(iv));
    c.due = now + c.interval * DAY;
  }
  c.reps++;
  return c;
}

export function preview(id, grade) {
  const now = Date.now();
  return next(getCard(id), grade, now).due - now;
}

export function answer(id, grade) {
  const s = store.get();
  const wasNew = isNew(id);
  const keep = s.cards[id] || {};
  s.cards[id] = { ...next(s.cards[id], grade), star: keep.star, active: keep.active };
  const t = store.today();
  t.reviews++;
  if (wasNew) t.novos++;
  store.save();
  return s.cards[id];
}

export function isLearning(id) {
  const c = getCard(id);
  return !!c && (c.state === 'learning' || c.state === 'relearning');
}

export function toggleStar(id) {
  const s = store.get();
  s.cards[id] = { ...(s.cards[id] || { state: 'new' }), star: !s.cards[id]?.star };
  store.save();
  return s.cards[id].star;
}

export function activate(id) {
  const s = store.get();
  s.cards[id] = { ...(s.cards[id] || { state: 'new' }), active: true };
  store.save();
}

export function addFail(id) {
  const s = store.get();
  const c = s.cards[id] || { state: 'new' };
  s.cards[id] = { ...c, fails: (c.fails || 0) + 1 };
  store.save();
}

export const isHard = (id) => {
  const c = getCard(id);
  return !!c && ((c.fails || 0) >= 3 || !!c.star);
};
