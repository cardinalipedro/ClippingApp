// =====================================================================
//  dominio/enquadramento.js — contas do recorte vertical 9:16.
// =====================================================================

export const PROPORCAO_VERTICAL = 9 / 16;

/** O vídeo é mais "deitado" que 9:16? (aí dá pra escolher onde recortar) */
export function ehMaisLargoQueVertical(largura, altura) {
  return largura > 0 && altura > 0 && largura / altura > PROPORCAO_VERTICAL;
}

/**
 * Onde fica a faixa 9:16 dentro do vídeo, em porcentagem.
 * @param {number} posicao 0 = encostada na esquerda, 100 = na direita
 */
export function faixaVertical(largura, altura, posicao) {
  const larguraPct = ((altura * 9) / 16 / largura) * 100;
  const esquerdaPct = (100 - larguraPct) * (posicao / 100);
  return { larguraPct, esquerdaPct };
}

/** Tamanho final do clipe. A opção "720" do seletor gera 720×1280; o resto, 1080×1920. */
export function tamanhoSaida(resolucao) {
  return resolucao === 720 ? { largura: 720, altura: 1280 } : { largura: 1080, altura: 1920 };
}
