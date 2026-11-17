// =====================================================================
//  aplicacao/exportar-clipe.js — caso de uso "exportar um clipe".
//
//  Recebe tudo por parâmetro (nada de ler a tela) e devolve o clipe
//  pronto. Quem decide o que fazer com ele (mostrar na lista, baixar)
//  é a interface.
// =====================================================================

import { validarDuracao, duracaoDo } from '../dominio/trecho.js';
import { tamanhoSaida } from '../dominio/enquadramento.js';
import { gerarASS } from '../dominio/legenda.js';
import { argsExportacao, extensaoDeSaida, tipoMime, ARQUIVO_LEGENDA } from '../dominio/comandos-ffmpeg.js';
import { prepararVideo } from './preparar-video.js';

/**
 * @param {{ motor: import('./portas.js').MotorVideo }} deps
 * @param {{ arquivo: File, trecho: {inicio:number, fim:number}, formato: string, posicao: number,
 *           resolucao: number, legenda: {blocos: object[]}|null, maisLargo: boolean }} pedido
 * @param {import('./portas.js').Relator} relator
 * @returns {Promise<{ blob: Blob, duracao: number, formato: string, ext: string, segundos: number }>}
 */
export async function exportarClipe({ motor }, pedido, relator) {
  const { arquivo, trecho, formato, posicao, resolucao, legenda, maisLargo } = pedido;
  validarDuracao(trecho);
  const duracao = duracaoDo(trecho);
  const ext = extensaoDeSaida(arquivo.name, formato);
  const saida = `saida.${ext}`;

  await prepararVideo(motor, arquivo, relator);

  // Legenda: escreve o arquivo .ass e a fonte dentro do motor
  const comLegenda = Boolean(legenda) && formato !== 'original';
  if (comLegenda) {
    await motor.prepararFonte();
    await motor.escrever(ARQUIVO_LEGENDA, gerarASS(legenda.blocos, tamanhoSaida(resolucao)));
  }

  const args = argsExportacao({
    entrada: motor.caminhoEntrada,
    saida,
    inicio: trecho.inicio,
    duracao,
    formato,
    posicao,
    resolucao,
    comLegenda,
    pastaFontes: motor.pastaFontes,
    maisLargo,
  });

  relator.status(formato === 'original' ? 's.cortando' : 's.processando', 0);
  const comeco = performance.now();
  await motor.executar(args, { duracao, aoProgresso: relator.barra });
  const dados = await motor.lerEApagar(saida);

  return {
    blob: new Blob([dados], { type: tipoMime(ext) }),
    duracao,
    formato,
    ext,
    segundos: (performance.now() - comeco) / 1000,
  };
}
