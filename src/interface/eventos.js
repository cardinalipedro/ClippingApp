// =====================================================================
//  interface/eventos.js — um "quadro de avisos" entre as partes da tela.
//
//  Quando o trecho muda, o painel de momentos e o de legenda precisam
//  reagir. Em vez de o editor chamar os dois diretamente (e conhecer
//  todo mundo), ele só AVISA "o trecho mudou". Quem se interessa se
//  inscreveu antes. Isso é o padrão Observer (ou pub/sub).
//
//  Eventos usados no app:
//    'trecho'   → o trecho { inicio, fim } mudou
//    'formato'  → o formato ou o enquadramento mudou
// =====================================================================

const inscritos = new Map(); // nome do evento → lista de funções

/** Inscreve uma função pra rodar sempre que o evento acontecer. */
export function ao(evento, funcao) {
  if (!inscritos.has(evento)) inscritos.set(evento, []);
  inscritos.get(evento).push(funcao);
}

/** Avisa todos os inscritos do evento. */
export function emitir(evento, dados) {
  (inscritos.get(evento) || []).forEach((funcao) => funcao(dados));
}
