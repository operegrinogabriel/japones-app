// Áudio com a voz sintética do aparelho (speechSynthesis)
import * as store from './store.js';

let voice = null;
let checked = false;
const listeners = new Set();

export const supported = () => 'speechSynthesis' in window;

function pickVoice() {
  if (!supported()) return;
  const vs = speechSynthesis.getVoices();
  const ja = vs.filter((v) => /^ja(-|_|$)/i.test(v.lang));
  voice = ja.find((v) => /kyoko|otoya|o-ren|google/i.test(v.name)) || ja[0] || null;
  if (vs.length) checked = true;
  listeners.forEach((fn) => fn());
}

if (supported()) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  // Alguns navegadores demoram a listar as vozes.
  setTimeout(() => {
    pickVoice();
    checked = true;
    listeners.forEach((fn) => fn());
  }, 1500);
}

export const hasJapanese = () => !!voice;
export const voiceName = () => voice?.name || '';
export const voicesChecked = () => checked;
export const onChange = (fn) => listeners.add(fn);

export function speak(text) {
  if (!supported() || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  if (voice) u.voice = voice;
  u.rate = Number(store.settings().rate) || 1;
  speechSynthesis.speak(u);
}

export const VOICE_HELP = `
  <p>Seu aparelho não tem uma voz em japonês instalada (ou o navegador não a encontrou).</p>
  <ul>
    <li><b>iPhone:</b> Ajustes › Acessibilidade › Conteúdo Falado › Vozes › Japonês. Baixe a voz (Kyoko ou Otoya) e reabra o app.</li>
    <li><b>Android:</b> Configurações › Conversão de texto em voz (ou "Saída de conversão de texto em voz") › Mecanismo do Google › instalar dados de voz › Japonês.</li>
  </ul>`;
