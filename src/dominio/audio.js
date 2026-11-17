// =====================================================================
//  dominio/audio.js — constantes e conversões de áudio.
// =====================================================================

export const TAXA_ANALISE = 8000;          // qualidade do áudio usado pra achar momentos (baixa = rápido)
export const LIMITE_AUDIO_IA_BYTES = 14e6; // o Gemini aceita até 20 MB por pedido (o áudio cresce 1/3 em base64)

/** Bytes lidos do FFmpeg → números decimais de 32 bits (o formato que o Whisper quer). */
export function bytesParaFloat32(bytes) {
  const fim = bytes.byteOffset + bytes.byteLength - (bytes.byteLength % 4);
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, fim));
}

/** Bytes lidos do FFmpeg → inteiros de 16 bits (o formato do detector de volume). */
export function bytesParaInt16(bytes) {
  const fim = bytes.byteOffset + bytes.byteLength - (bytes.byteLength % 2);
  return new Int16Array(bytes.buffer.slice(bytes.byteOffset, fim));
}
