// =====================================================================
//  interface/status.js — barra de progresso, mensagens e o modo
//  "ocupado" (botões travados enquanto algo está processando).
// =====================================================================

import { el } from './dom.js';
import { t, aoTrocarIdioma } from './i18n.js';
import { ErroApp } from '../dominio/erros.js';
import { estado } from '../aplicacao/estado.js';

let prefixo = ''; // ex.: "Clipe 2 de 5 — " na frente das mensagens do lote

/** Transforma qualquer erro num texto pro usuário, no idioma da tela. */
export function mensagemDoErro(erro) {
  if (erro instanceof ErroApp) return t(erro.chave, erro.variaveis);
  return erro?.message || String(erro);
}

/** Erro que interrompe uma ação do usuário (ex.: trecho curto demais). */
export function avisar(erro) {
  alert(mensagemDoErro(erro));
}

export function mostrarStatus(texto, fracao) {
  el.progresso.hidden = false;
  el.status.textContent = prefixo + texto;
  if (fracao !== undefined) atualizarBarra(fracao);
}

export function atualizarBarra(fracao) {
  el.barra.style.width = `${Math.max(0, Math.min(1, fracao)) * 100}%`;
}

export function esconderStatus() {
  el.progresso.hidden = true;
}

export function definirPrefixo(texto) {
  prefixo = texto;
}

/**
 * O "Relator" que os casos de uso recebem (veja aplicacao/portas.js):
 * eles mandam a chave, a tela traduz e mostra.
 */
export const relator = {
  status: (chave, fracao) => mostrarStatus(t(chave), fracao),
  barra: atualizarBarra,
};

const CONTROLES_TRAVADOS = [
  'btnExportar', 'btnTrocar', 'btnVoltar', 'btnLegenda', 'btnLote', 'btnAnalisar',
  'duracaoClipe', 'quantidadeClipes', 'metodoMomentos', 'idiomaMomentos',
];

export function definirOcupado(ocupado) {
  estado.ocupado = ocupado;
  CONTROLES_TRAVADOS.forEach((nome) => { el[nome].disabled = ocupado; });
  el.btnExportar.textContent = t(ocupado ? 'aguarde' : 'exportar');
}

aoTrocarIdioma(() => definirOcupado(estado.ocupado));
