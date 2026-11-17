// =====================================================================
//  aplicacao/gerar-legenda.js — caso de uso "legendar um trecho".
//  1) o motor extrai o áudio do trecho  2) o transcritor transforma a
//  fala em palavras com tempo  3) o domínio agrupa em blocos editáveis.
// =====================================================================

import { validarDuracao } from '../dominio/trecho.js';
import { agruparEmBlocos } from '../dominio/legenda.js';
import { argsAudioDaFala } from '../dominio/comandos-ffmpeg.js';
import { bytesParaFloat32 } from '../dominio/audio.js';
import { prepararVideo } from './preparar-video.js';

/**
 * @param {{ motor: import('./portas.js').MotorVideo, transcritor: import('./portas.js').Transcritor }} deps
 * @param {{ arquivo: File, trecho: {inicio:number, fim:number}, idioma: string }} pedido
 * @param {import('./portas.js').Relator} relator
 * @returns {Promise<{ blocos: object[], trecho: {inicio:number, fim:number} } | null>} null = não tem fala
 */
export async function gerarLegenda({ motor, transcritor }, { arquivo, trecho, idioma }, relator) {
  validarDuracao(trecho);
  await prepararVideo(motor, arquivo, relator);

  relator.status('s.extraindo', 0);
  await motor.executar(argsAudioDaFala(motor.caminhoEntrada, trecho, 'audio.pcm'), { erro: 'e.semAudio' });
  const audio = bytesParaFloat32(await motor.lerEApagar('audio.pcm'));

  const palavras = await transcritor.transcrever(audio, idioma, (etapa, fracao) => {
    relator.status(etapa === 'modelo' ? 's.baixandoIA' : 's.ouvindoTrecho', fracao);
  });

  const blocos = agruparEmBlocos(palavras);
  return blocos.length ? { blocos, trecho: { ...trecho } } : null;
}
