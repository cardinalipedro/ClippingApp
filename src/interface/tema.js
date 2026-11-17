// =====================================================================
//  interface/tema.js — botão de tema claro/escuro.
//  O tema é só um atributo no <html>: data-tema="claro". O CSS faz o resto.
// =====================================================================

import { el } from './dom.js';
import { t, aoTrocarIdioma } from './i18n.js';

const temaClaro = () => document.documentElement.dataset.tema === 'claro';

function atualizarBotao() {
  const rotulo = t(temaClaro() ? 'tema.paraEscuro' : 'tema.paraClaro');
  el.btnTema.title = rotulo;
  el.btnTema.setAttribute('aria-label', rotulo);
}

/** @param {{ gravar: (tema: string) => void }} temaGuardado vem do main.js */
export function iniciarTema(temaGuardado) {
  el.btnTema.addEventListener('click', () => {
    const novo = temaClaro() ? 'escuro' : 'claro';
    if (novo === 'claro') document.documentElement.dataset.tema = 'claro';
    else delete document.documentElement.dataset.tema;
    temaGuardado.gravar(novo);
    atualizarBotao();
  });
  aoTrocarIdioma(atualizarBotao);
  atualizarBotao();
}
