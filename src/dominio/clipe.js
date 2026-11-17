// =====================================================================
//  dominio/clipe.js — regras sobre arquivos de vídeo e clipes.
// =====================================================================

const EXTENSOES_VIDEO = /\.(mp4|mov|m4v|mkv|webm)$/i;

/** O arquivo escolhido é um vídeo? Olha o tipo e, se ele vier vazio, a extensão. */
export function ehVideo(nome, tipo = '') {
  return tipo.startsWith('video/') || EXTENSOES_VIDEO.test(nome);
}

/** Ex.: ("gameplay.mp4", 3, "vertical", "mp4") → "gameplay_clipe03_vertical.mp4" */
export function nomeDoClipe(nomeOriginal, numero, formato, ext) {
  const base = nomeOriginal.replace(/\.[^.]+$/, '').slice(0, 40);
  return `${base}_clipe${String(numero).padStart(2, '0')}_${formato}.${ext}`;
}
