// Marcação de furigana: {漢字|かんじ}
import { esc } from './util.js';

const RE = /\{([^|{}]+)\|([^{}]+)\}/g;

// Divide o texto em segmentos: {t:'ruby', base, rt} ou {t:'text', s}
export function parse(markup) {
  const out = [];
  const src = String(markup ?? '');
  let last = 0;
  for (const m of src.matchAll(RE)) {
    if (m.index > last) out.push({ t: 'text', s: src.slice(last, m.index) });
    out.push({ t: 'ruby', base: m[1], rt: m[2] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ t: 'text', s: src.slice(last) });
  return out;
}

// Texto sem furigana (só a base em kanji).
export const plain = (markup) => parse(markup).map((s) => (s.t === 'ruby' ? s.base : s.s)).join('');

// Leitura em kana (furigana no lugar dos kanji).
export const reading = (markup) => parse(markup).map((s) => (s.t === 'ruby' ? s.rt : s.s)).join('');

export function rubyHTML(base, rt) {
  return `<ruby>${esc(base)}<rt>${esc(rt)}</rt></ruby>`;
}

// HTML com <ruby>. `mark` (opcional) é uma máscara booleana por caractere do texto plano,
// usada para destacar diferenças.
export function toHTML(markup, mark = null) {
  let i = 0;
  return parse(markup)
    .map((seg) => {
      if (seg.t === 'ruby') {
        const len = [...seg.base].length;
        const changed = mark && mark.slice(i, i + len).some(Boolean);
        i += len;
        const r = rubyHTML(seg.base, seg.rt);
        return changed ? `<mark>${r}</mark>` : r;
      }
      return [...seg.s]
        .map((c) => {
          const changed = mark && mark[i];
          i++;
          return changed ? `<mark>${esc(c)}</mark>` : esc(c);
        })
        .join('');
    })
    .join('')
    .replace(/<\/mark><mark>/g, ''); // junta trechos destacados vizinhos
}

// Máscara de diferença: true nos caracteres de `b` que não fazem parte da maior
// subsequência comum com `a`.
export function diffMask(a, b) {
  const A = [...a];
  const B = [...b];
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const maskB = new Array(m).fill(true);
  const maskA = new Array(n).fill(true);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      maskA[i] = false;
      maskB[j] = false;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return { maskA, maskB };
}
