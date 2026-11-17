// =====================================================================
//  dominio/erros.js — erro "de negócio" com uma chave de tradução.
//
//  O domínio não sabe em que idioma a tela está (isso é coisa da
//  interface). Então, em vez de escrever a mensagem, ele lança a CHAVE
//  (ex.: 'a.curto') e a interface traduz na hora de mostrar.
// =====================================================================

export class ErroApp extends Error {
  /**
   * @param {string} chave      chave do dicionário em interface/i18n.js
   * @param {object} variaveis  valores pra trocar no texto, ex.: { c: 403 }
   */
  constructor(chave, variaveis = {}) {
    super(chave);
    this.name = 'ErroApp';
    this.chave = chave;
    this.variaveis = variaveis;
  }
}
