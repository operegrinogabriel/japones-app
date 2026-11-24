// Relatório de estudo para colar na conversa com o tutor
import { esc, dayKey, fmtSecs, toast } from './util.js';
import { plain } from './furigana.js';
import * as store from './store.js';
import * as data from './data.js';
import * as srs from './srs.js';
import * as ui from './ui.js';

const DAY = 86400e3;
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const dateBR = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const KIND_LABEL = {
  'vocab-rec': 'Vocabulário japonês → português',
  'vocab-prod': 'Vocabulário português → japonês',
  frase: 'Frases japonês → português',
  'frase-prod': 'Frases português → japonês (falar)',
  erro: 'Meus erros de aula',
  kata: 'Katakana',
};
const KIND_TAG = { 'vocab-rec': 'reconhecer', 'vocab-prod': 'produzir', frase: 'entender', 'frase-prod': 'dizer em japonês', erro: 'corrigir', kata: 'ler' };

function cardText(card) {
  const it = card.item;
  switch (card.kind) {
    case 'vocab-rec':
    case 'vocab-prod':
      return `${plain(it.jp)}${it.kana && it.kana !== plain(it.jp) ? ` (${it.kana})` : ''} = ${it.pt}`;
    case 'frase':
    case 'frase-prod':
      return `${plain(it.jp)} = ${it.pt}`;
    case 'erro':
      return `${it.errado} → ${plain(it.certo)}${it.tipo ? ` (${it.tipo})` : ''}`;
    case 'kata':
      return `${it.jp} (${it.romaji})`;
  }
  return card.id;
}

export function buildReport(days = 7) {
  const DB = data.DB;
  const s = store.get();
  const now = Date.now();
  const since = now - days * DAY;
  const L = [];
  const hist = (s.hist || []).filter((h) => h.at >= since);
  const ph = (s.particleHist || []).filter((h) => h.at >= since);
  const runs = (s.katakanaRuns || []).filter((r) => r.at >= since);

  L.push(`Relatório de estudo de japonês: ${dateBR(since)} a ${dateBR(now)} (${days} dias)`);
  const firstHist = (s.hist || [])[0]?.at;
  if (!firstHist || firstHist > since) L.push(`(O histórico detalhado começou ${firstHist ? `em ${dateBR(firstHist)}` : 'agora'}; períodos antes disso aparecem incompletos.)`);

  // Resumo
  const sinceKey = dayKey(since);
  const studied = Object.entries(s.log).filter(([k, v]) => k > sinceKey && v.reviews > 0).length;
  const again = hist.filter((h) => h.g === 1).length;
  L.push('', 'RESUMO');
  L.push(`- Estudei ${studied} de ${days} dias (sequência atual: ${store.streak()} dia(s))`);
  L.push(`- ${hist.length} respostas na revisão, ${hist.filter((h) => h.novo).length} cards novos`);
  if (hist.length) L.push(`- Acerto: ${pct(hist.length - again, hist.length)} (apertei "De novo" ${again} vez(es))`);

  // Por tipo de card
  const byKind = {};
  for (const h of hist) {
    const card = DB.byCard[h.id];
    if (!card) continue;
    const k = (byKind[card.kind] = byKind[card.kind] || { n: 0, ok: 0 });
    k.n++;
    if (h.g > 1) k.ok++;
  }
  if (Object.keys(byKind).length) {
    L.push('', 'ACERTO POR TIPO DE CARD');
    for (const [kind, label] of Object.entries(KIND_LABEL)) if (byKind[kind]) L.push(`- ${label}: ${pct(byKind[kind].ok, byKind[kind].n)} (${byKind[kind].n} respostas)`);
  }

  // O que mais errei
  const fails = {};
  for (const h of hist) if (h.g === 1 && DB.byCard[h.id]) fails[h.id] = (fails[h.id] || 0) + 1;
  const top = Object.entries(fails).sort((a, b) => b[1] - a[1]).slice(0, 12);
  L.push('', 'O QUE MAIS ERREI NA REVISÃO');
  if (top.length) top.forEach(([id, n], i) => L.push(`${i + 1}. ${cardText(DB.byCard[id])} [${KIND_TAG[DB.byCard[id].kind]}]: ${n}×`));
  else L.push('- (nenhum erro no período)');

  // Erros de aula por tipo
  const byTipo = {};
  for (const [id, n] of Object.entries(fails)) {
    const card = DB.byCard[id];
    if (card.kind === 'erro') byTipo[card.item.tipo || 'outro'] = (byTipo[card.item.tipo || 'outro'] || 0) + n;
  }
  if (Object.keys(byTipo).length) {
    L.push('', 'ERROS DE AULA QUE AINDA COMETO (por tipo)');
    Object.entries(byTipo)
      .sort((a, b) => b[1] - a[1])
      .forEach(([t, n]) => L.push(`- ${t}: ${n}×`));
  }

  // Partículas
  L.push('', 'PARTÍCULAS (quiz de lacunas)');
  if (ph.length) {
    const ok = ph.filter((h) => h.p === h.escolhida).length;
    L.push(`- Acerto: ${pct(ok, ph.length)} (${ph.length} perguntas)`);
    const perP = {};
    const conf = {};
    for (const h of ph) {
      const p = (perP[h.p] = perP[h.p] || { n: 0, ok: 0 });
      p.n++;
      if (h.p === h.escolhida) p.ok++;
      else conf[`${h.escolhida}|${h.p}`] = (conf[`${h.escolhida}|${h.p}`] || 0) + 1;
    }
    const weak = Object.entries(perP)
      .filter(([, v]) => v.ok < v.n)
      .sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n);
    if (weak.length) L.push(`- Mais difíceis: ${weak.map(([p, v]) => `${p} (${v.ok}/${v.n})`).join(', ')}`);
    const confs = Object.entries(conf).sort((a, b) => b[1] - a[1]);
    for (const [k, n] of confs.slice(0, 6)) {
      const [chosen, right] = k.split('|');
      L.push(`- Usei ${chosen} no lugar de ${right}: ${n}×`);
    }
    const wrongQs = {};
    for (const h of ph) if (h.p !== h.escolhida) wrongQs[h.key] = (wrongQs[h.key] || 0) + 1;
    const qMap = Object.fromEntries(DB.particleQs.map((q) => [q.key, q]));
    const wq = Object.entries(wrongQs)
      .filter(([k]) => qMap[k])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (wq.length) {
      L.push('- Frases em que errei a partícula:');
      wq.forEach(([k]) => L.push(`  · ${plain(qMap[k].frase.jp)} (partícula ${qMap[k].p})`));
    }
  } else L.push('- (não fiz o quiz no período)');

  // Katakana
  L.push('', 'KATAKANA CRONOMETRADO (meta: 10 palavras em 30 s)');
  if (runs.length) {
    const per10 = runs.map((r) => (r.ms / r.n) * 10);
    L.push(`- ${runs.length} rodada(s) · melhor ${fmtSecs(Math.min(...per10))} · última ${fmtSecs(per10[per10.length - 1])} · média ${fmtSecs(per10.reduce((a, b) => a + b, 0) / per10.length)} (tempo para 10 palavras)`);
    const missed = {};
    runs.forEach((r) => r.erros.forEach((id) => (missed[id] = (missed[id] || 0) + 1)));
    const byId = Object.fromEntries(DB.katakanaPool.map((k) => [k.id, k]));
    const m = Object.entries(missed)
      .filter(([id]) => byId[id])
      .sort((a, b) => b[1] - a[1]);
    if (m.length) L.push(`- Palavras que li errado: ${m.map(([id, n]) => `${plain(byId[id].jp)} (${byId[id].romaji}) ${n}×`).join(', ')}`);
  } else L.push('- (não treinei no período)');

  // Difíceis (acumulado)
  const hard = DB.cards.filter((c) => srs.isHard(c.id));
  L.push('', 'MINHA LISTA DE DIFÍCEIS (errei 3+ vezes no total ou marquei com estrela)');
  if (hard.length)
    hard
      .sort((a, b) => (srs.getCard(b.id).fails || 0) - (srs.getCard(a.id).fails || 0))
      .slice(0, 15)
      .forEach((c) => L.push(`- ${cardText(c)} [${KIND_TAG[c.kind]}]${srs.getCard(c.id).star ? ' ★' : ''}`));
  else L.push('- (vazia)');

  L.push('', 'Pode usar isso para montar a próxima aula, focando no que eu mais estou errando?');
  return L.join('\n');
}

export function render(root, params) {
  const days = [7, 14, 30].includes(Number(params.dias)) ? Number(params.dias) : 7;
  const text = buildReport(days);
  const canShare = typeof navigator.share === 'function';
  root.innerHTML = `${ui.header('Relatório', { filter: false })}
    <div class="tabs">${[7, 14, 30].map((d) => `<a href="#/relatorio?dias=${d}" class="${d === days ? 'on' : ''}">${d} dias</a>`).join('')}</div>
    <main class="pad">
      <p class="muted small">Copie e cole na conversa com o seu tutor antes da aula. Ele monta a aula em cima do que você mais está errando.</p>
      <pre class="report" lang="pt-BR">${esc(text)}</pre>
    </main>
    <footer class="actions">${
      canShare
        ? '<div class="grades two"><button class="btn ghost" data-copy>Copiar</button><button class="btn primary" data-share>Compartilhar</button></div>'
        : '<button class="btn primary block xl" data-copy>Copiar relatório</button>'
    }</footer>`;
  root.querySelector('[data-copy]').onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('Relatório copiado. Agora é só colar na conversa com o tutor.');
  };
  root.querySelector('[data-share]')?.addEventListener('click', () => navigator.share({ title: 'Relatório de japonês', text }).catch(() => {}));
}
