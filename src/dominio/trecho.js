// =====================================================================
//  dominio/trecho.js — regras do trecho que vai virar clipe.
//
//  Um trecho é só { inicio, fim } em segundos. As funções daqui nunca
//  alteram o trecho recebido: devolvem um trecho NOVO. Isso deixa as
//  regras fáceis de testar (entra um valor, sai outro) e sem surpresas.
// =====================================================================

import { ErroApp } from './erros.js';

export const DURACAO_PADRAO = 30;      // segundos sugeridos ao abrir um vídeo
export const DURACAO_MINIMA = 0.5;     // menos que isso não vira clipe
export const LIMITE_LEGENDA_AUTO = 180; // modo "clipe curto": legenda sozinho vídeos de até 3 min

export const arredondar = (n) => Math.round(n * 10) / 10;
export const duracaoDo = (trecho) => trecho.fim - trecho.inicio;
export const mesmoTrecho = (a, b) => a.inicio === b.inicio && a.fim === b.fim;

/**
 * Trecho sugerido assim que o vídeo abre.
 * Clipe curto (até 3 min): o trecho é o vídeo inteiro e a legenda sai sozinha.
 * Senão: sugere os primeiros 30 s.
 */
export function trechoInicial(duracaoVideo, modo) {
  const legendarSozinho = modo === 'curto' && duracaoVideo <= LIMITE_LEGENDA_AUTO;
  const fim = legendarSozinho ? Math.floor(duracaoVideo * 10) / 10 : Math.min(duracaoVideo, DURACAO_PADRAO);
  return { trecho: { inicio: 0, fim }, legendarSozinho };
}

/** Botão "Marcar início": se o fim ficou pra trás, empurra o fim 30 s pra frente. */
export function marcarInicio(trecho, instante, duracaoVideo) {
  const inicio = arredondar(instante);
  const fim = trecho.fim <= inicio ? Math.min(duracaoVideo, inicio + DURACAO_PADRAO) : trecho.fim;
  return { inicio, fim };
}

/** Botão "Marcar fim": o fim precisa vir depois do início. */
export function marcarFim(trecho, instante) {
  const fim = arredondar(instante);
  if (fim <= trecho.inicio) throw new ErroApp('a.fimDepois');
  return { inicio: trecho.inicio, fim };
}

/** Início digitado no campo: fica entre 0 e o fim do vídeo. */
export function digitarInicio(trecho, valor, duracaoVideo) {
  const max = duracaoVideo || 0;
  const inicio = Math.min(Math.max(0, Number(valor) || 0), max);
  const fim = trecho.fim <= inicio ? Math.min(max, inicio + 1) : trecho.fim;
  return { inicio, fim };
}

/** Fim digitado no campo: fica entre o início e o fim do vídeo. */
export function digitarFim(trecho, valor, duracaoVideo) {
  const max = duracaoVideo || 0;
  const fim = Math.min(Math.max(trecho.inicio + 0.1, Number(valor) || 0), max);
  return { inicio: trecho.inicio, fim };
}

/** Lança erro se o trecho for curto demais pra virar clipe. */
export function validarDuracao(trecho) {
  if (duracaoDo(trecho) < DURACAO_MINIMA) throw new ErroApp('a.curto');
}
