// =====================================================================
//  interface/navegacao.js — troca entre a tela inicial e o editor.
// =====================================================================

import { el } from './dom.js';
import { t, aoTrocarIdioma } from './i18n.js';
import { estado } from '../aplicacao/estado.js';

export function mostrarEtapa(qual) {
  el.etapaUpload.hidden = qual !== 'upload';
  el.etapaEditor.hidden = qual !== 'editor';
}

/** Mostra ao lado do "Voltar" em qual modo a pessoa está. */
export function atualizarModoAtual() {
  el.modoAtual.textContent = t(estado.modo === 'longo' ? 'modo.longo.titulo' : 'modo.curto.titulo');
}

/** Volta pra tela inicial. Durante um processamento não deixa sair no meio. */
function voltarAoInicio() {
  if (estado.ocupado) return;
  el.video.pause();
  mostrarEtapa('upload');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function iniciarNavegacao() {
  el.btnTrocar.addEventListener('click', voltarAoInicio);
  el.btnVoltar.addEventListener('click', voltarAoInicio);
  el.logo.addEventListener('click', (e) => {
    e.preventDefault(); // não recarrega a página: assim o FFmpeg já carregado continua na memória
    voltarAoInicio();
  });
  aoTrocarIdioma(atualizarModoAtual);
  atualizarModoAtual();
}
