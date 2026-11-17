// =====================================================================
//  infraestrutura/armazenamento.js — localStorage com proteção.
//
//  Alguns navegadores (aba anônima, configurações rígidas) bloqueiam o
//  localStorage e ele lança erro. Aqui o erro vira "não tem nada salvo".
// =====================================================================

// Os nomes continuam os antigos pra ninguém perder o que já salvou
export const CHAVES = {
  gemini: 'clipador.chaveGemini',
  tema: 'clipador.tema', // o mesmo nome é lido pelo script no <head> do index.html
};

export const armazenamento = {
  ler(chave) {
    try { return localStorage.getItem(chave) || ''; } catch { return ''; }
  },
  gravar(chave, valor) {
    try {
      if (valor) localStorage.setItem(chave, valor);
      else localStorage.removeItem(chave);
    } catch { /* sem localStorage: vale só até fechar a aba */ }
  },
};
