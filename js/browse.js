// Telas: kanji, haiku, busca, ajustes
import { esc, shuffle, norm, romajiVariants, toast, download } from './util.js';
import { parse, plain, toHTML, rubyHTML } from './furigana.js';
import * as store from './store.js';
import * as data from './data.js';
import * as tts from './tts.js';
import * as ui from './ui.js';

const wordsWithKanji = (k) => data.DB.vocab.filter((v) => plain(v.jp).includes(k));

function kanjiDetail(k) {
  const words = wordsWithKanji(k.k);
  return `<div class="kanji-detail">
    <dl class="readings">
      <dt>on</dt><dd lang="ja">${esc(k.on || '—')}</dd>
      <dt>kun</dt><dd lang="ja">${esc(k.kun || '—')}</dd>
      <dt>significado</dt><dd>${esc(k.pt)}</dd>
    </dl>
    ${ui.chips({ nivel: k.nivel, tags: [] })}
    <p class="muted small">Aula(s): ${k.aulas.join(', ')}</p>
    ${words.length ? `<h3>Palavras das aulas</h3><ul class="list compact">${words.map((v) => `<li class="item row-item"><span><span class="jp jp-m" lang="ja">${toHTML(v.jp)}</span> ${esc(v.pt)}</span>${ui.audioBtn(v.kana || plain(v.jp))}</li>`).join('')}</ul>` : ''}
  </div>`;
}

// ---------- Kanji ----------
export function kanji(root, params) {
  const list = data.DB.kanji.filter((k) => data.matches(k));
  const mode = params.modo === 'treino' ? 'treino' : 'lista';
  const tabs = `<div class="tabs"><a href="#/kanji" class="${mode === 'lista' ? 'on' : ''}">Lista</a><a href="#/kanji?modo=treino" class="${mode === 'treino' ? 'on' : ''}">Treino</a></div>`;
  if (!list.length) {
    root.innerHTML = `${ui.header('Kanji')}${tabs}<main class="pad">${ui.empty('Nenhum kanji com esse filtro.')}</main>`;
    return;
  }
  if (mode === 'lista') {
    root.innerHTML = `${ui.header('Kanji')}${tabs}<main class="pad">
      <div class="kanji-grid">${list.map((k, i) => `<button class="kanji-cell" data-i="${i}"><span lang="ja">${esc(k.k)}</span><small>${esc(k.nivel || '')}</small></button>`).join('')}</div></main>`;
    root.querySelectorAll('[data-i]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = list[Number(b.dataset.i)];
        ui.openSheet(`<div class="kanji-big" lang="ja">${esc(k.k)}</div>${kanjiDetail(k)}<div class="sheet-actions"><button class="btn primary" onclick="this.closest('.sheet-wrap').remove()">Fechar</button></div>`);
      })
    );
    return;
  }
  const deck = shuffle(list);
  let i = 0;
  let known = 0;
  const draw = (revealed = false) => {
    const k = deck[i];
    if (!k) {
      root.innerHTML = `${ui.header('Kanji')}${tabs}<main class="pad">${ui.empty(`<div class="big-emoji">字</div><h2>${known} de ${deck.length}</h2><p>kanji que você sabia.</p><button class="btn primary" data-again>Treinar de novo</button>`)}</main>`;
      root.querySelector('[data-again]').onclick = () => kanji(root, params);
      return;
    }
    root.innerHTML = `${ui.header('Kanji')}${tabs}
      <div class="progress"><div style="width:${(i / deck.length) * 100}%"></div></div>
      <main class="study pad"><section class="card">
        <div class="kanji-big" lang="ja">${esc(k.k)}</div>
        ${revealed ? kanjiDetail(k) : '<p class="center muted">Lembra as leituras e o significado?</p>'}
      </section></main>
      <footer class="actions">${
        revealed
          ? `<div class="grades two"><button class="grade again" data-r="0"><span>Não sabia</span></button><button class="grade good" data-r="1"><span>Sabia</span></button></div>`
          : `<button class="btn primary block xl" data-show>Mostrar</button>`
      }</footer>`;
    root.querySelector('[data-show]')?.addEventListener('click', () => draw(true));
    root.querySelectorAll('[data-r]').forEach((b) =>
      b.addEventListener('click', () => {
        known += Number(b.dataset.r);
        i++;
        draw();
      })
    );
  };
  draw();
}

// ---------- Haiku ----------
const EXPECTED = [5, 7, 5];

// Divide um verso em palavras usando o glossário (maior trecho primeiro).
function tokenize(verso, glossario) {
  const units = [];
  for (const seg of parse(verso.jp)) {
    if (seg.t === 'ruby') units.push({ text: seg.base, html: rubyHTML(seg.base, seg.rt) });
    else for (const ch of seg.s) units.push({ text: ch, html: esc(ch) });
  }
  const gl = [...(glossario || [])].sort((a, b) => b.jp.length - a.jp.length);
  const tokens = [];
  let i = 0;
  while (i < units.length) {
    let matched = null;
    let end = i;
    for (const g of gl) {
      let s = '';
      let j = i;
      while (j < units.length && s.length < g.jp.length) s += units[j++].text;
      if (s === g.jp) {
        matched = g;
        end = j;
        break;
      }
    }
    if (matched) {
      tokens.push({ text: matched.jp, html: units.slice(i, end).map((u) => u.html).join(''), g: matched });
      i = end;
    } else {
      tokens.push({ text: units[i].text, html: units[i].html, g: null });
      i++;
    }
  }
  return tokens;
}

// Texto para a voz: kana do glossário, com a partícula は lida como わ.
function verseSpeech(verso, tokens) {
  if (tokens.every((t) => t.g?.kana)) return tokens.map((t) => (t.g.jp === 'は' && /partícula/i.test(t.g.pt) ? 'わ' : t.g.kana)).join('');
  return verso.kana || plain(verso.jp);
}

function moraLabel(n, idx) {
  const exp = EXPECTED[idx];
  if (n === exp) return '';
  return n > exp ? ` <span class="chip chip-erro" lang="ja">字余り +${n - exp}</span>` : ` <span class="chip chip-erro" lang="ja">字足らず −${exp - n}</span>`;
}

export function haiku(root, params) {
  const list = data.DB.haiku.filter((h) => data.matches(h));
  if (params.id) return haikuDetail(root, list.find((h) => h.id === params.id) || data.DB.haiku.find((h) => h.id === params.id), params);
  root.innerHTML = `${ui.header('Haiku')}<main class="pad">
    ${list.length ? `<ul class="list">${list.map((h) => `<li><a class="item haiku-item" href="#/haiku?id=${esc(h.id)}">
      <div class="jp jp-m" lang="ja">${h.versos.map((v) => toHTML(v.jp)).join('<br>')}</div>
      <div class="muted small">${esc(h.autor || '')}${h.ano ? ` · ${esc(h.ano)}` : ''}</div></a></li>`).join('')}</ul>` : ui.empty('Nenhum haiku com esse filtro.')}
    </main>`;
}

function haikuDetail(root, h, params) {
  if (!h) {
    root.innerHTML = `${ui.header('Haiku', { back: '#/haiku' })}<main class="pad">${ui.empty('Haiku não encontrado.')}</main>`;
    return;
  }
  const quiz = params.modo === 'completar';
  const hidden = quiz ? Number(params.v ?? Math.floor(Math.random() * h.versos.length)) : -1;
  const kigoWord = (h.kigo || '').split(/[ (（,、]/)[0].trim();
  const kireji = (h.kireji || '').trim();
  const lines = h.versos.map((v, idx) => {
    const tokens = tokenize(v, h.glossario);
    const computed = data.countMoras(v.kana);
    const n = v.moras ?? computed;
    const mismatch = v.moras != null && computed && computed !== v.moras;
    const html = tokens
      .map((t, ti) => {
        const cls = ['tok'];
        if (t.g) cls.push('has-g');
        if (kigoWord && t.text === kigoWord) cls.push('kigo');
        if (kireji && t.text === kireji) cls.push('kireji');
        return t.g ? `<button class="${cls.join(' ')}" data-v="${idx}" data-t="${ti}">${t.html}</button>` : `<span class="${cls.join(' ')}">${t.html}</span>`;
      })
      .join('');
    return { v, idx, tokens, n, mismatch, computed, html };
  });

  root.innerHTML = `${ui.header('Haiku', { back: '#/haiku', filter: false })}
    <main class="pad">
      <section class="card haiku-card">
        ${lines
          .map(
            (l) => `<div class="verse">
            <div class="verse-text jp jp-l" lang="ja">${l.idx === hidden ? `<button class="hidden-verse" data-reveal>？？？ · ${l.n} moras</button>` : l.html}</div>
            <div class="verse-meta">${l.idx === hidden ? '' : ui.audioBtn(verseSpeech(l.v, l.tokens), 'Ouvir verso')}
              <span class="moras">${l.n}</span>${moraLabel(l.n, l.idx)}
              ${l.mismatch ? `<span class="chip chip-erro" title="A contagem nos dados não bate com a contagem do kana">dados: ${l.v.moras}, kana: ${l.computed}</span>` : ''}</div>
          </div>`
          )
          .join('')}
        <div class="gloss" aria-live="polite"><span class="muted small">Toque numa palavra para ver a glosa.</span></div>
      </section>
      <div class="pattern muted small">Padrão: ${lines.map((l) => l.n).join('-')}${lines.map((l) => l.n).join('-') === '5-7-5' ? ' ✓' : ' (o clássico é 5-7-5)'}</div>
      <p class="muted">${esc(h.autor || '')}${h.ano ? ` · ${esc(h.ano)}` : ''}</p>
      <div class="legend"><span class="tok kigo">kigo</span> ${esc(h.kigo || '—')}</div>
      <div class="legend"><span class="tok kireji">kireji</span> <span lang="ja">${esc(h.kireji || '—')}</span></div>
      ${h.literal ? `<h3>Tradução literal</h3><p>${esc(h.literal)}</p>` : ''}
      ${h.notas ? `<h3>Notas</h3><p>${esc(h.notas)}</p>` : ''}
      ${(h.traducoes || []).length ? `<h3>Traduções publicadas</h3>${h.traducoes.map((t) => `<blockquote>${esc(t.texto)}<footer>${esc(t.tradutor || '')}${t.fonte ? `, ${esc(t.fonte)}` : ''}</footer></blockquote>`).join('')}` : ''}
    </main>
    <footer class="actions">${
      quiz
        ? `<div class="grades two"><button class="btn ghost" data-reveal>Revelar</button><a class="btn primary" href="#/haiku?id=${esc(h.id)}&modo=completar&r=${Date.now()}">Outro verso</a></div>`
        : `<a class="btn primary block xl" href="#/haiku?id=${esc(h.id)}&modo=completar">Completar o verso</a>`
    }</footer>`;

  root.querySelectorAll('[data-reveal]').forEach((b) =>
    b.addEventListener('click', () => {
      const l = lines[hidden];
      const box = root.querySelectorAll('.verse')[hidden];
      box.querySelector('.verse-text').innerHTML = l.html;
      box.querySelector('.verse-meta').insertAdjacentHTML('afterbegin', ui.audioBtn(verseSpeech(l.v, l.tokens), 'Ouvir verso'));
      bindTokens();
    })
  );
  const bindTokens = () =>
    root.querySelectorAll('.tok.has-g').forEach((b) => {
      b.onclick = () => {
        root.querySelectorAll('.tok.sel').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        const t = lines[Number(b.dataset.v)].tokens[Number(b.dataset.t)];
        root.querySelector('.gloss').innerHTML = `<span class="jp jp-m" lang="ja">${esc(t.g.jp)}</span> <span class="kana" lang="ja">${esc(t.g.kana || '')}</span> — ${esc(t.g.pt)} ${ui.audioBtn(t.g.kana || t.g.jp)}`;
      };
    });
  bindTokens();
}

// ---------- Busca ----------
export function busca(root, params) {
  root.innerHTML = `${ui.header('Busca')}
    <main class="pad">
      <input class="search" type="search" placeholder="japonês, kana, romaji ou português" value="${esc(params.q || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" lang="ja">
      <div class="results"></div>
    </main>`;
  const input = root.querySelector('.search');
  const out = root.querySelector('.results');
  const DB = data.DB;
  const hit = (q, ...fields) => fields.some((f) => f && romajiVariants(f).some((v) => v.includes(q)));
  const run = () => {
    const raw = input.value.trim();
    history.replaceState(null, '', raw ? `#/busca?q=${encodeURIComponent(raw)}` : '#/busca');
    if (!raw) {
      out.innerHTML = '<p class="muted small center">Digite para buscar em todas as aulas.</p>';
      return;
    }
    const q = norm(raw);
    const f = (arr) => arr.filter((i) => data.matches(i));
    const vocab = f(DB.vocab).filter((v) => hit(q, plain(v.jp), v.kana, v.romaji, v.pt, v.nota));
    const kata = f(DB.katakana).filter((v) => hit(q, v.jp, v.romaji, v.pt));
    const frases = f(DB.frases).filter((v) => hit(q, plain(v.jp), v.romaji, v.pt));
    const kanji = f(DB.kanji).filter((k) => hit(q, k.k, k.on, k.kun, k.pt));
    const erros = f(DB.erros).filter((e) => hit(q, e.errado, plain(e.certo), e.explicacao, e.tipo));
    const haiku = f(DB.haiku).filter((h) => hit(q, ...h.versos.map((v) => plain(v.jp)), ...h.versos.map((v) => v.kana), h.literal, h.autor));
    const sec = (title, items, fn) => (items.length ? `<h2 class="section-title">${title} <span class="muted">${items.length}</span></h2><ul class="list">${items.map(fn).join('')}</ul>` : '');
    const html =
      sec('Vocabulário', vocab, (v) => `<li class="item">${ui.jp(v.jp, { say: v.kana || plain(v.jp), romaji: v.romaji, size: 'm' })}<div>${esc(v.pt)}</div>${v.nota ? `<div class="nota">${esc(v.nota)}</div>` : ''}${ui.chips(v)}</li>`) +
      sec('Katakana', kata, (v) => `<li class="item">${ui.jp(v.jp, { romaji: v.romaji, size: 'm' })}<div>${esc(v.pt)}</div></li>`) +
      sec('Kanji', kanji, (k) => `<li class="item row-item"><span class="kanji-mid" lang="ja">${esc(k.k)}</span><span><span lang="ja">${esc(k.on)} · ${esc(k.kun)}</span><br>${esc(k.pt)}</span></li>`) +
      sec('Frases', frases, (v) => `<li class="item">${ui.jp(v.jp, { romaji: v.romaji, size: 'm' })}<div>${esc(v.pt)}</div></li>`) +
      sec('Meus erros', erros, (e) => `<li class="item"><div class="jp jp-s strike" lang="ja">${esc(e.errado)}</div>${ui.jp(e.certo, { size: 'm' })}<div class="muted small">${esc(e.explicacao || '')}</div></li>`) +
      sec('Haiku', haiku, (h) => `<li><a class="item haiku-item" href="#/haiku?id=${esc(h.id)}"><div class="jp jp-m" lang="ja">${h.versos.map((v) => toHTML(v.jp)).join('<br>')}</div></a></li>`);
    out.innerHTML = html || `<p class="muted center">Nada encontrado para “${esc(raw)}”${data.filterActive() ? ` com o filtro ${esc(data.filterLabel())}` : ''}.</p>`;
  };
  input.addEventListener('input', run);
  run();
  if (!params.q) setTimeout(() => input.focus(), 50);
}

// ---------- Ajustes ----------
export function ajustes(root, params, reload) {
  const s = store.settings();
  const DB = data.DB;
  const sel = (name, opts) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(s[name]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const lastB = store.get().lastBackup;
  root.innerHTML = `${ui.header('Ajustes', { filter: false })}
    <main class="pad settings">
      <section class="panel">
        <h2>Exibição</h2>
        <label class="field row">Furigana ${sel('furigana', [['sempre', 'Sempre'], ['verso', 'Só no verso'], ['nunca', 'Nunca']])}</label>
        <p class="muted small">Com furigana escondido, toque num kanji para ver a leitura.</p>
        <label class="field row">Romaji <input type="checkbox" name="romaji" ${s.romaji ? 'checked' : ''}></label>
      </section>
      <section class="panel">
        <h2>Áudio</h2>
        <p class="muted small">Voz sintética do aparelho, não é a voz de um falante nativo.</p>
        <label class="field row">Velocidade ${sel('rate', [['0.7', '0,7×'], ['1', '1×']])}</label>
        <label class="field row">Tocar ao virar o card <input type="checkbox" name="autoplay" ${s.autoplay ? 'checked' : ''}></label>
        <div class="row-item"><span class="muted small">${tts.hasJapanese() ? `Voz: ${esc(tts.voiceName())}` : 'Nenhuma voz japonesa encontrada.'}</span>
          <button class="btn ghost small" data-say="こんにちは。にほんごをべんきょうしています。">Testar voz</button></div>
        ${tts.hasJapanese() ? '' : `<details><summary>Como instalar a voz japonesa</summary>${tts.VOICE_HELP}</details>`}
      </section>
      <section class="panel">
        <h2>Revisão</h2>
        <label class="field row">Cards novos por dia <input type="number" name="newPerDay" min="0" max="100" value="${esc(s.newPerDay)}" inputmode="numeric"></label>
        <label class="field row">Cards por sessão <input type="number" name="sessionMax" min="5" max="100" value="${esc(s.sessionMax)}" inputmode="numeric"></label>
      </section>
      <section class="panel">
        <h2>Aulas</h2>
        <ul class="list compact">${DB.lessons.map((l) => `<li class="item row-item"><span><b>Aula ${l.aula}</b> · ${esc(l.titulo || '')}<br><span class="muted small">${esc(l.data || '')} · ${l._origem}</span></span>${l._origem === 'importada' ? `<button class="btn ghost small" data-rm="${l.aula}">Remover</button>` : ''}</li>`).join('')}
          ${DB.imported.filter((l) => l._ignorada).map((l) => `<li class="item row-item"><span class="muted small">Cópia importada da aula ${l.aula} ignorada: a versão do app tem prioridade.</span><button class="btn ghost small" data-rm="${l.aula}">Remover</button></li>`).join('')}</ul>
        <h3>Importar aula</h3>
        <p class="muted small">Escolha o arquivo <code>aula-NN.json</code> ou cole o conteúdo. Seu histórico de revisão não é apagado.</p>
        <input type="file" accept=".json,application/json" data-file>
        <textarea data-paste rows="4" placeholder='{"formato": 1, "aula": 2, ...}'></textarea>
        <button class="btn primary block" data-import>Importar aula</button>
      </section>
      <section class="panel">
        <h2>Backup do progresso</h2>
        <p class="muted small">O navegador pode apagar os dados do app. Exporte de vez em quando.${lastB ? ` Último backup: ${new Date(lastB).toLocaleDateString('pt-BR')}.` : ' Nenhum backup feito ainda.'}</p>
        <button class="btn primary block" data-export>Exportar progresso</button>
        <label class="btn ghost block file-btn">Importar progresso<input type="file" accept=".json,application/json" data-restore hidden></label>
        <button class="btn danger block" data-reset>Apagar todo o progresso</button>
      </section>
      <p class="muted small center">日本語 · app de estudo pessoal · funciona sem internet</p>
    </main>`;

  root.querySelectorAll('select, input[type=checkbox], input[type=number]').forEach((el) =>
    el.addEventListener('change', () => {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number') v = Math.max(Number(el.min), Math.min(Number(el.max), Number(v) || 0));
      if (el.name === 'rate') v = Number(v);
      store.setSetting(el.name, v);
      document.body.dataset.furigana = store.settings().furigana;
      toast('Salvo');
    })
  );

  const doImport = (text) => {
    try {
      const obj = JSON.parse(text);
      data.importLesson(obj);
      toast(`Aula ${obj.aula} importada.`);
      reload();
    } catch (e) {
      alert('Não consegui importar:\n' + (e instanceof SyntaxError ? 'O texto não é um JSON válido.' : e.message));
    }
  };
  root.querySelector('[data-import]').onclick = async () => {
    const file = root.querySelector('[data-file]').files[0];
    const text = file ? await file.text() : root.querySelector('[data-paste]').value.trim();
    if (!text) return alert('Escolha um arquivo ou cole o JSON da aula.');
    doImport(text);
  };
  root.querySelectorAll('[data-rm]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!confirm(`Remover a aula ${b.dataset.rm} importada? Seu histórico de revisão fica guardado.`)) return;
      data.removeImported(Number(b.dataset.rm));
      reload();
    })
  );
  root.querySelector('[data-export]').onclick = () => {
    const d = new Date().toISOString().slice(0, 10);
    download(`japones-progresso-${d}.json`, store.exportJSON());
    store.markBackup();
    toast('Backup exportado.');
  };
  root.querySelector('[data-restore]').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Substituir o progresso deste aparelho pelo do arquivo?')) return;
    try {
      store.importJSON(await file.text());
      toast('Progresso restaurado.');
      reload();
    } catch (err) {
      alert('Não consegui restaurar: ' + err.message);
    }
  };
  root.querySelector('[data-reset]').onclick = () => {
    if (!confirm('Apagar todo o histórico de revisão, sequência e tempos de katakana? Isso não pode ser desfeito (a não ser que você tenha um backup).')) return;
    store.resetProgress();
    toast('Progresso apagado.');
    reload();
  };
}
