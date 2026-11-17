// =====================================================================
//  dominio/comandos-ffmpeg.js — monta as "linhas de comando" do FFmpeg.
//
//  Aqui só se MONTA o comando (um array de palavras). Quem executa é
//  infraestrutura/motor-ffmpeg.js. Separar os dois permite testar os
//  comandos no Node, sem navegador e sem baixar o FFmpeg.
// =====================================================================

import { tamanhoSaida } from './enquadramento.js';

export const ARQUIVO_LEGENDA = 'legenda.ass';

/**
 * Comando de exportação de um clipe.
 * Dica: cada item do array é uma palavra que você digitaria no terminal.
 */
export function argsExportacao({ entrada, saida, inicio, duracao, formato, posicao, resolucao, comLegenda, pastaFontes, maisLargo }) {
  // Filtro que "queima" a legenda na imagem (entra no fim da cadeia de filtros)
  const queimar = comLegenda ? `,ass=${ARQUIVO_LEGENDA}:fontsdir=${pastaFontes}` : '';
  const corte = ['-ss', inicio.toFixed(3), '-i', entrada, '-t', duracao.toFixed(3)];

  if (formato === 'original') {
    // Só copia os dados, sem recodificar: quase instantâneo.
    // Limitação: o corte "gruda" no keyframe mais próximo (pode variar ~1-2s).
    return [...corte, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-avoid_negative_ts', 'make_zero', saida];
  }

  const { largura: L, altura: A } = tamanhoSaida(resolucao);
  const codificacao = [
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart', // o vídeo começa a tocar antes de baixar inteiro
  ];

  if (formato === 'desfocado') {
    // Fundo: o próprio vídeo ampliado e borrado. Frente: o vídeo inteiro centralizado.
    // (o borrão é feito em tamanho pequeno e depois ampliado — bem mais rápido)
    const filtro = [
      '[0:v]split=2[a][b]',
      `[a]scale=${L / 4}:${A / 4}:force_original_aspect_ratio=increase,crop=${L / 4}:${A / 4},boxblur=8:2,scale=${L}:${A},setsar=1[fundo]`,
      `[b]scale=${L}:${A}:force_original_aspect_ratio=decrease,setsar=1[frente]`,
      `[fundo][frente]overlay=(W-w)/2:(H-h)/2${queimar}[v]`,
    ].join(';');
    return [...corte, '-filter_complex', filtro, '-map', '[v]', '-map', '0:a:0?', ...codificacao, saida];
  }

  // formato === 'vertical'
  let filtro;
  if (maisLargo) {
    // Recorta uma faixa 9:16 (largura par, exigência do H.264) na posição escolhida
    const p = (posicao / 100).toFixed(3);
    filtro = `crop=trunc(ih*9/16/2)*2:ih:(iw-ow)*${p}:0,scale=${L}:${A},setsar=1`;
  } else {
    // Vídeo já é vertical (ou mais estreito): só ajusta o tamanho e completa com preto
    filtro = `scale=${L}:${A}:force_original_aspect_ratio=decrease,pad=${L}:${A}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
  }
  return [...corte, '-vf', filtro + queimar, '-map', '0:v:0', '-map', '0:a:0?', ...codificacao, saida];
}

/** Áudio "cru" do trecho pro Whisper: 16 kHz, mono, um número decimal por amostra. */
export function argsAudioDaFala(entrada, trecho, saida) {
  return [
    '-ss', trecho.inicio.toFixed(3), '-i', entrada, '-t', (trecho.fim - trecho.inicio).toFixed(3),
    '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-c:a', 'pcm_f32le', saida,
  ];
}

/** Áudio do vídeo inteiro em baixa qualidade, pro detector de momentos pelo volume. */
export function argsAudioDeAnalise(entrada, taxa, saida) {
  return ['-i', entrada, '-vn', '-ac', '1', '-ar', String(taxa), '-f', 's16le', '-c:a', 'pcm_s16le', saida];
}

/** Voz comprimida pra mandar pra IA: 1 hora de vídeo vira ~11 MB. */
export function argsAudioParaIA(entrada, saida) {
  return ['-i', entrada, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', '24k', '-f', 'adts', saida];
}

/** Extensão do clipe. No "original" mantém o container quando ele não cabe em .mp4 (ex.: webm). */
export function extensaoDeSaida(nomeArquivo, formato) {
  const ext = (nomeArquivo.split('.').pop() || 'mp4').toLowerCase();
  return formato === 'original' && !['mp4', 'mov', 'm4v'].includes(ext) ? ext : 'mp4';
}

export function tipoMime(ext) {
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  return 'video/x-matroska';
}

/** O FFmpeg escreve "time=00:00:12.34" enquanto trabalha. Devolve os segundos, ou null. */
export function segundosDoLog(linha) {
  const m = linha.match(/time=(\d+):(\d+):([\d.]+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}
