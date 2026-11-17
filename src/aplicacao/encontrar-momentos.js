// =====================================================================
//  aplicacao/encontrar-momentos.js — caso de uso "achar os melhores
//  momentos de um vídeo longo".
//
//  Com IA: o buscador (Gemini) escolhe pelo conteúdo e o domínio confere
//  os tempos. Se não der (sem chave, erro, resposta vazia), cai pro
//  detector pelo volume do som, que funciona sem internet.
// =====================================================================

import { encontrarMomentos as momentosPeloSom, criarAjustador } from '../dominio/momentos.js';
import { organizarMomentos } from '../dominio/momentos-ia.js';
import { argsAudioDeAnalise, argsAudioParaIA } from '../dominio/comandos-ffmpeg.js';
import { TAXA_ANALISE, LIMITE_AUDIO_IA_BYTES, bytesParaInt16 } from '../dominio/audio.js';
import { ErroApp } from '../dominio/erros.js';
import { prepararVideo } from './preparar-video.js';

/**
 * @param {{ motor: import('./portas.js').MotorVideo, buscadorIA: import('./portas.js').BuscadorMomentosIA }} deps
 * @param {{ arquivo: File, duracaoVideo: number, metodo: 'ia'|'som', chave: string, idioma: string,
 *           duracaoClipe: number, quantidade: number, cache: { audioAnalise: Int16Array|null, audioIA: Uint8Array|null } }} pedido
 * @param {import('./portas.js').Relator} relator
 * @returns {Promise<{ momentos: object[], aviso: { chave: string, erro?: Error } | null }>}
 */
export async function encontrarMomentos(deps, pedido, relator) {
  const { motor } = deps;
  const { arquivo, duracaoVideo, metodo, chave, cache } = pedido;
  const opcoes = { duracaoClipe: pedido.duracaoClipe, quantidade: pedido.quantidade };

  // O áudio é extraído uma vez só por vídeo; trocar duração/quantidade reaproveita
  if (!cache.audioAnalise) {
    await prepararVideo(motor, arquivo, relator);
    relator.status('s.ouvindoTudo', 0);
    await motor.executar(argsAudioDeAnalise(motor.caminhoEntrada, TAXA_ANALISE, 'analise.pcm'), {
      duracao: duracaoVideo, aoProgresso: relator.barra, erro: 'e.semAudio',
    });
    cache.audioAnalise = bytesParaInt16(await motor.lerEApagar('analise.pcm'));
  }

  let momentos = [];
  let aviso = null;
  if (metodo === 'ia') {
    if (!chave) {
      aviso = { chave: 'av.semChave' };
    } else {
      try {
        momentos = await momentosPorIA(deps, pedido, opcoes, relator);
        if (!momentos.length) aviso = { chave: 'av.iaNada' };
      } catch (erro) {
        console.error(erro);
        aviso = { chave: 'av.iaFalhou', erro };
      }
    }
  }
  if (!momentos.length) momentos = momentosPeloSom(cache.audioAnalise, TAXA_ANALISE, opcoes);

  return { momentos, aviso };
}

async function momentosPorIA({ motor, buscadorIA }, pedido, opcoes, relator) {
  const { duracaoVideo, chave, idioma, cache } = pedido;

  if (!cache.audioIA) {
    relator.status('s.preparandoIA', 0);
    await motor.executar(argsAudioParaIA(motor.caminhoEntrada, 'ia.aac'), {
      duracao: duracaoVideo, aoProgresso: relator.barra, erro: 'e.comprimir',
    });
    const bytes = await motor.lerEApagar('ia.aac');
    if (bytes.byteLength > LIMITE_AUDIO_IA_BYTES) throw new ErroApp('e.longoIA');
    cache.audioIA = bytes;
  }

  relator.status('s.iaOuvindo', 0.5);
  const brutos = await buscadorIA.buscar({ chave, audio: cache.audioIA, duracaoTotal: duracaoVideo, idioma, ...opcoes });
  const momentos = organizarMomentos(brutos, { duracaoTotal: duracaoVideo, ...opcoes });

  // A IA erra o tempo por 1 ou 2 segundos: encosta as pontas no silêncio mais próximo
  const ajustar = criarAjustador(cache.audioAnalise, TAXA_ANALISE);
  return momentos.map((m) => ({ ...m, ...ajustar(m.inicio, m.fim) }));
}
