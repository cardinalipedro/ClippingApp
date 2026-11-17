// =====================================================================
//  aplicacao/gerar-lote.js — caso de uso "gerar vários clipes em fila".
//
//  Não sabe COMO abrir, legendar ou exportar: recebe essas ações
//  prontas. Só cuida da regra da fila: um por vez, na ordem, e se um
//  clipe falhar a fila continua.
// =====================================================================

/**
 * @template T
 * @param {T[]} fila
 * @param {{ abrir: (item: T, posicao: number, total: number) => void,
 *           legendar: (item: T) => Promise<unknown>,
 *           exportar: (item: T) => Promise<boolean> }} acoes
 * @returns {Promise<number>} quantos clipes ficaram prontos
 */
export async function gerarLote(fila, { abrir, legendar, exportar }) {
  let prontos = 0;
  for (const [posicao, item] of fila.entries()) {
    abrir(item, posicao, fila.length);
    await legendar(item);
    if (await exportar(item)) prontos += 1;
  }
  return prontos;
}
