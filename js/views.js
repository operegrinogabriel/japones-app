// Telas: início, meus erros, partículas, difíceis, katakana
import { esc, shuffle, fmtSecs, toast } from './util.js';
import { parse, plain, toHTML, rubyHTML } from './furigana.js';
import * as store from './store.js';
import * as data from './data.js';
import * as srs from './srs.js';
import * as review from './review.js';
import * as ui from './ui.js';

// ---------- Início ----------
export function home(root) {
  const c = review.counts('todos');
  const total = c.due + c.newToday;
  const st = store.streak();
  const ce = review.counts('erros');
  const hardN = data.DB.cards.filter((card) => srs.isHard(card.id)).length + Object.keys(store.get().hardParticles).length;
  const runs = store.get().katakanaRuns;
  const best = runs.length ? Math.min(...runs.map((r) => r.ms)) : null;
  const fl = data.filterLabel();
  root.innerHTML = `
    <header class="top home-top">
      <h1 class="logo" lang="ja">日本語</h1>
      <button class="filter-btn ${fl ? 'on' : ''}" data-open-filter>${ui.ICON.filter}<span>${fl ? esc(fl) : 'Filtros'}</span></button>
    </header>
    <main class="pad home">
      ${store.backupDue() ? `<a class="banner" href="#/ajustes">Faz mais de 2 semanas sem backup. Toque para exportar seu progresso.</a>` : ''}
      ${data.problems.length ? `<div class="banner warn">${data.problems.map(esc).join('<br>')}</div>` : ''}
      ${ui.voiceBanner()}
      <section class="stats">
        <div class="stat"><b>${total}</b><span>para hoje</span><small>${c.due} revisões · ${c.newToday} novos</small></div>
        <div class="stat"><b>${st}</b><span>${st === 1 ? 'dia seguido' : 'dias seguidos'}</span><small>${store.today().reviews} cards hoje</small></div>
      </section>
      <nav class="modes">
        <a href="#/erros" class="mode"><span class="mi">✗</span><b>Meus erros</b><small>${ce.due + ce.newToday} para hoje</small></a>
        <a href="#/particulas" class="mode"><span class="mi" lang="ja">は</span><b>Partículas</b><small>${data.DB.particleQs.filter((q) => data.matches(q)).length} lacunas</small></a>
        <a href="#/katakana" class="mode"><span class="mi" lang="ja">カ</span><b>Katakana ⏱</b><small>${best ? 'recorde ' + fmtSecs(best) : 'meta: 30 s'}</small></a>
        <a href="#/kanji" class="mode"><span class="mi" lang="ja">字</span><b>Kanji</b><small>${data.DB.kanji.filter((k) => data.matches(k)).length} kanji</small></a>
        <a href="#/haiku" class="mode"><span class="mi" lang="ja">句</span><b>Haiku</b><small>${data.DB.haiku.length} haiku</small></a>
        <a href="#/dificeis" class="mode"><span class="mi">★</span><b>Difíceis</b><small>${hardN} item(ns)</small></a>
        <a href="#/busca" class="mode"><span class="mi" lang="ja">検</span><b>Busca</b><small>tudo das aulas</small></a>
        <a href="#/ajustes" class="mode"><span class="mi">⚙</span><b>Ajustes</b><small>exibição, backup</small></a>
      </nav>
    </main>
    <footer class="actions">
      <a class="btn primary block xl" href="#/revisar">${total ? `Revisar agora · ${Math.min(total, store.settings().sessionMax)}` : 'Revisar agora'}</a>
    </footer>`;
}

// ---------- Meus erros ----------
export function erros(root) {
  const DB = data.DB;
  const list = DB.erros.filter((e) => data.matches(e));
  const byType = {};
  for (const e of DB.erros) {
    const t = e.tipo || 'outro';
    byType[t] = byType[t] || { n: 0, fails: 0 };
    byType[t].n++;
    byType[t].fails += srs.getCard(e.id)?.fails || 0;
  }
  const types = Object.entries(byType).sort((a, b) => b[1].n + b[1].fails - (a[1].n + a[1].fails));
  const max = Math.max(1, ...types.map(([, v]) => v.n + v.fails));
  const c = review.counts('erros');
  root.innerHTML = `${ui.header('Meus erros')}
    <main class="pad">
      <section class="panel">
        <h2>Tipos de erro mais frequentes</h2>
        <p class="muted small">Barra cheia: erros cometidos em aula. Parte clara: vezes que você errou o card na revisão.</p>
        <div class="bars">${types
          .map(
            ([t, v]) => `<div class="bar-row"><span class="bar-label" lang="ja">${esc(t)}</span>
              <span class="bar"><i style="width:${(v.n / max) * 100}%"></i><i class="light" style="width:${(v.fails / max) * 100}%"></i></span>
              <span class="bar-n">${v.n}${v.fails ? ` +${v.fails}` : ''}</span></div>`
          )
          .join('')}</div>
      </section>
      <h2 class="section-title">${list.length} erro(s)</h2>
      <ul class="list">${list
        .map(
          (e) => `<li class="item"><div class="jp jp-s strike" lang="ja">${toHTML(e.errado)}</div>
          <div class="jp jp-m" lang="ja">${toHTML(e.certo)} ${ui.audioBtn(plain(e.certo))}</div>
          <div class="muted small">${esc(e.explicacao || '')}</div>${ui.chips(e)}</li>`
        )
        .join('')}</ul>
    </main>
    <footer class="actions"><a class="btn primary block xl" href="#/revisar?deck=erros">Revisar meus erros · ${c.due + c.newToday}</a></footer>`;
}

// ---------- Quiz de partículas ----------
export function particulas(root, params) {
  const hardOnly = params.modo === 'dificeis';
  const hp = store.get().hardParticles;
  let pool = data.DB.particleQs.filter((q) => data.matches(q));
  if (hardOnly) pool = pool.filter((q) => hp[q.key]);
  if (!pool.length) {
    root.innerHTML = `${ui.header('Partículas')}<main class="pad">${ui.empty(hardOnly ? '<h2>Nenhuma partícula difícil</h2><p>As que você errar no quiz aparecem aqui.</p>' : '<h2>Nenhuma frase com partícula</h2><p>Mude o filtro.</p>')}</main>`;
    return;
  }
  // Uma lacuna por frase em cada rodada, até 10 perguntas.
  const byFrase = {};
  shuffle(pool).forEach((q) => (byFrase[q.frase.id] = byFrase[q.frase.id] || q));
  const qs = shuffle(Object.values(byFrase)).slice(0, 10);
  let i = 0;
  let score = 0;

  const sentenceHTML = (q, fill = null, cls = '') => {
    const segs = parse(q.frase.jp);
    return segs
      .map((seg, si) => {
        if (seg.t === 'ruby') return rubyHTML(seg.base, seg.rt);
        return [...seg.s]
          .map((ch, ci) => (si === q.si && ci === q.ci ? `<span class="blank ${cls}">${fill ? esc(fill) : '？'}</span>` : esc(ch)))
          .join('');
      })
      .join('');
  };

  const draw = () => {
    const q = qs[i];
    if (!q) return finish();
    const opts = data.particleOptions(q.p);
    root.innerHTML = `${ui.header(hardOnly ? 'Partículas difíceis' : 'Partículas')}
      <div class="progress"><div style="width:${(i / qs.length) * 100}%"></div></div>
      <main class="study pad">
        <div class="card-meta"><span class="muted small">${i + 1} de ${qs.length}</span><span class="muted small">acertos: ${score}</span></div>
        <section class="card"><div class="prompt-label">Qual partícula completa a frase?</div>
          <div class="jp jp-l" lang="ja">${sentenceHTML(q)}</div>
          <div class="feedback"></div>
        </section>
      </main>
      <footer class="actions"><div class="opts">${opts.map((o) => `<button class="opt" data-o="${esc(o)}" lang="ja">${esc(o)}</button>`).join('')}</div></footer>`;
    root.querySelectorAll('[data-o]').forEach((b) =>
      b.addEventListener('click', () => {
        const ok = b.dataset.o === q.p;
        if (ok) {
          score++;
          if (hp[q.key]) {
            hp[q.key]--;
            if (hp[q.key] <= 0) delete hp[q.key];
          }
        } else hp[q.key] = (hp[q.key] || 0) + 1;
        store.save();
        root.querySelectorAll('[data-o]').forEach((x) => {
          x.disabled = true;
          if (x.dataset.o === q.p) x.classList.add('right');
          else if (x === b) x.classList.add('wrong');
        });
        root.querySelector('.card .jp').innerHTML = sentenceHTML(q, q.p, ok ? 'right' : 'wrong');
        root.querySelector('.feedback').innerHTML = `
          <div class="pt-med">${esc(q.frase.pt)}</div>
          ${q.frase.romaji ? (store.settings().romaji ? `<div class="romaji">${esc(q.frase.romaji)}</div>` : `<button class="link romaji-btn" data-romaji="${esc(q.frase.romaji)}">mostrar romaji</button>`) : ''}
          ${q.frase.nota ? `<div class="nota">${esc(q.frase.nota)}</div>` : ''}
          <div class="center">${ui.audioBtn(plain(q.frase.jp))}</div>
          ${ok ? '' : '<p class="muted small">Foi para a lista de difíceis.</p>'}`;
        const foot = root.querySelector('footer.actions');
        foot.insertAdjacentHTML('beforeend', `<button class="btn primary block xl next-btn" data-next>${i + 1 < qs.length ? 'Próxima' : 'Ver resultado'}</button>`);
        foot.querySelector('[data-next]').onclick = () => {
          i++;
          draw();
        };
      })
    );
  };

  const finish = () => {
    root.innerHTML = `${ui.header('Partículas')}<main class="pad">${ui.empty(`<div class="big-emoji">${score === qs.length ? '🎯' : '📝'}</div>
      <h2>${score} de ${qs.length}</h2>
      <button class="btn primary" data-again>Outra rodada</button>
      ${Object.keys(hp).length ? `<a class="btn ghost" href="#/particulas?modo=dificeis">Treinar as difíceis (${Object.keys(hp).length})</a>` : ''}
      <a class="btn ghost" href="#/">Início</a>`)}</main>`;
    root.querySelector('[data-again]').onclick = () => particulas(root, params);
  };
  draw();
}

// ---------- Difíceis ----------
export function dificeis(root) {
  const DB = data.DB;
  const cards = DB.cards.filter((c) => srs.isHard(c.id) && data.matches(c));
  const hp = store.get().hardParticles;
  const pqs = DB.particleQs.filter((q) => hp[q.key]);
  const label = (c) => {
    const it = c.item;
    if (c.kind === 'vocab-rec') return `<span class="jp jp-s" lang="ja">${toHTML(it.jp)}</span> → ${esc(it.pt)}`;
    if (c.kind === 'vocab-prod') return `${esc(it.pt)} → <span class="jp jp-s" lang="ja">${toHTML(it.jp)}</span>`;
    if (c.kind === 'erro') return `<span class="jp jp-s" lang="ja">${toHTML(it.certo)}</span>`;
    return `<span class="jp jp-s" lang="ja">${toHTML(it.jp)}</span>`;
  };
  root.innerHTML = `${ui.header('Difíceis')}
    <main class="pad">
      <p class="muted small">Cards que você errou 3 vezes ou mais, ou marcou com ★.</p>
      ${
        cards.length
          ? `<ul class="list">${cards
              .map((c) => {
                const s = srs.getCard(c.id);
                return `<li class="item row-item"><div>${label(c)}<div class="muted small">${s.fails || 0} erro(s)</div></div>
                <button class="icon-btn star ${s.star ? 'on' : ''}" data-star="${esc(c.id)}" aria-label="Estrela">${ui.ICON.star}</button></li>`;
              })
              .join('')}</ul>`
          : ui.empty('Nenhum card difícil por enquanto.')
      }
      <h2 class="section-title">Partículas erradas no quiz</h2>
      ${
        pqs.length
          ? `<ul class="list">${pqs.map((q) => `<li class="item"><span class="jp jp-s" lang="ja">${toHTML(q.frase.jp)}</span><div class="muted small">partícula <b lang="ja">${esc(q.p)}</b> · ${hp[q.key]} erro(s)</div></li>`).join('')}</ul>
             <a class="btn ghost block" href="#/particulas?modo=dificeis">Treinar partículas difíceis</a>`
          : ui.empty('Nenhuma partícula errada.')
      }
    </main>
    ${cards.length ? `<footer class="actions"><a class="btn primary block xl" href="#/revisar?deck=dificeis">Treinar difíceis · ${cards.length}</a></footer>` : ''}`;
  root.querySelectorAll('[data-star]').forEach((b) =>
    b.addEventListener('click', () => {
      b.classList.toggle('on', srs.toggleStar(b.dataset.star));
    })
  );
}

// ---------- Katakana cronometrado ----------
export function katakana(root) {
  // Aqui só o filtro de aula vale: o deck de katakana não tem nível nem etiquetas próprias.
  const fAula = store.get().filter.aula;
  const pool = data.DB.katakanaPool.filter((k) => !fAula || k.aula === Number(fAula));
  const runs = store.get().katakanaRuns;
  const GOAL = 30000;

  const intro = () => {
    const last = runs.slice(-12);
    const max = Math.max(GOAL * 1.8, ...last.map((r) => r.ms));
    const best = runs.length ? Math.min(...runs.map((r) => r.ms)) : null;
    root.innerHTML = `${ui.header('Katakana ⏱')}
      <main class="pad">
        <section class="panel">
          <p>Leia as palavras em voz alta, o mais rápido que conseguir, e toque em <b>Terminei</b>. Meta: <b>10 palavras em 30 s</b>.</p>
          <div class="stats"><div class="stat"><b>${best ? fmtSecs(best) : '—'}</b><span>recorde</span></div>
          <div class="stat"><b>${runs.length ? fmtSecs(runs[runs.length - 1].ms) : '—'}</b><span>última</span></div></div>
          ${
            last.length
              ? `<div class="spark" aria-label="Histórico de tempos">${last
                  .map((r) => `<div class="sb ${r.ms <= GOAL * (r.n / 10) ? 'ok' : ''}" style="height:${(r.ms / max) * 100}%" title="${fmtSecs(r.ms)}"><span>${Math.round(r.ms / 1000)}</span></div>`)
                  .join('')}<div class="goal" style="bottom:${(GOAL / max) * 100}%"><span>30 s</span></div></div>`
              : ''
          }
        </section>
        <p class="muted small">${pool.length} palavra(s) em katakana nas aulas.${pool.length < 10 ? ' Cada rodada usa todas.' : ''}</p>
      </main>
      <footer class="actions"><button class="btn primary block xl" data-start ${pool.length ? '' : 'disabled'}>Começar</button></footer>`;
    root.querySelector('[data-start]').onclick = run;
  };

  const run = () => {
    const words = shuffle(pool).slice(0, 10);
    const t0 = performance.now();
    root.innerHTML = `${ui.header('Katakana ⏱', { filter: false })}
      <main class="pad"><div class="timer" data-timer>0,0 s</div>
        <ol class="kata-grid">${words.map((w) => `<li lang="ja">${esc(plain(w.jp))}</li>`).join('')}</ol></main>
      <footer class="actions"><button class="btn primary block xl" data-stop>Terminei</button></footer>`;
    const tEl = root.querySelector('[data-timer]');
    const iv = setInterval(() => {
      if (!tEl.isConnected) return clearInterval(iv);
      tEl.textContent = fmtSecs(performance.now() - t0);
    }, 100);
    root.querySelector('[data-stop]').onclick = () => {
      clearInterval(iv);
      check(words, performance.now() - t0);
    };
  };

  const check = (words, ms) => {
    const goal = GOAL * (words.length / 10);
    root.innerHTML = `${ui.header('Katakana ⏱', { filter: false })}
      <main class="pad">
        <div class="timer ${ms <= goal ? 'ok' : ''}">${fmtSecs(ms)}</div>
        <p class="center muted">${ms <= goal ? 'Dentro da meta!' : `Meta: ${fmtSecs(goal)} para ${words.length} palavra(s)`}</p>
        <p>Confira e marque as que você leu errado:</p>
        <ul class="list check-list">${words
          .map(
            (w, i) => `<li class="item"><label class="check"><input type="checkbox" data-i="${i}">
            <span class="jp jp-m" lang="ja">${esc(plain(w.jp))}</span><span class="romaji">${esc(w.romaji)}</span><span class="muted small">${esc(w.pt)}</span></label>
            ${ui.audioBtn(plain(w.jp))}</li>`
          )
          .join('')}</ul>
      </main>
      <footer class="actions"><button class="btn primary block xl" data-save>Salvar</button></footer>`;
    root.querySelector('[data-save]').onclick = () => {
      const wrong = [...root.querySelectorAll('input[data-i]:checked')].map((x) => words[Number(x.dataset.i)]);
      for (const w of wrong) {
        if (w._vocab) {
          srs.addFail(`${w.id}:rec`);
        } else {
          srs.activate(`${w.id}:kata`);
          srs.addFail(`${w.id}:kata`);
        }
      }
      store.get().katakanaRuns.push({ at: Date.now(), ms: Math.round(ms), n: words.length, erros: wrong.map((w) => w.id) });
      store.save();
      toast(wrong.length ? `${wrong.length} palavra(s) viraram cards de revisão.` : 'Salvo. Nenhum erro!');
      intro();
    };
  };

  intro();
}
