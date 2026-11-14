// =====================================================================
//  transcricao.worker.js — roda o Whisper (reconhecimento de fala) num
//  Web Worker, ou seja, numa thread separada. Assim a página não trava
//  enquanto a IA trabalha.
//
//  Conversa com o main.js por mensagens:
//    recebe  { tipo: 'transcrever', audio: Float32Array (16 kHz mono), idioma }
//    envia   { tipo: 'progresso', etapa: 'modelo' | 'fala', fracao }
//            { tipo: 'pronto', palavras: [{ texto, inicio, fim }] }
//            { tipo: 'erro', mensagem }
// =====================================================================

import { pipeline } from '@huggingface/transformers';
import { dividirEmJanelas } from './legenda.js';

// Modelo com tempo por palavra, versão "small" (multilíngue: pt, en, es).
// Escolhido pra qualidade: é mais lento e tem download maior que o "base".
const MODELO = 'onnx-community/whisper-small_timestamped';
const TAXA = 16000;

let transcritor = null; // carregado uma vez e reaproveitado

async function carregarModelo() {
  if (transcritor) return transcritor;

  const arquivos = new Map(); // nome do arquivo → { baixado, total }
  transcritor = await pipeline('automatic-speech-recognition', MODELO, {
    device: 'wasm', // roda em qualquer PC; o tempo por palavra é mais confiável aqui que em 'webgpu'
    dtype: 'fp32', // precisão total: erra menos palavras que a versão quantizada (q8)
    progress_callback: (p) => {
      if (p.status !== 'progress' || !p.total) return;
      arquivos.set(p.file, { baixado: p.loaded, total: p.total });
      let baixado = 0;
      let total = 0;
      for (const a of arquivos.values()) { baixado += a.baixado; total += a.total; }
      self.postMessage({ tipo: 'progresso', etapa: 'modelo', fracao: baixado / total });
    },
  });
  return transcritor;
}

/** Converte a resposta do Whisper pra nossa lista de palavras, já conferindo os tempos. */
function extrairPalavras(saida, duracaoJanela, deslocamento) {
  const pedacos = (saida.chunks || []).filter((c) => c.text && c.text.trim());
  if (!pedacos.length) return [];

  const inicios = pedacos.map((c) => c.timestamp?.[0]);
  const temposValidos =
    inicios.every((t) => Number.isFinite(t)) &&
    (pedacos.length === 1 || new Set(inicios.map((t) => t.toFixed(2))).size > pedacos.length / 2);

  return pedacos.map((c, i) => {
    let inicio;
    let fim;
    if (temposValidos) {
      inicio = Math.min(Math.max(0, c.timestamp[0]), duracaoJanela);
      fim = Number.isFinite(c.timestamp[1]) ? c.timestamp[1] : inicio + 0.3;
      fim = Math.min(Math.max(fim, inicio + 0.05), duracaoJanela);
    } else {
      // Plano B: se o modelo não devolveu tempos úteis, espalha as palavras por igual
      inicio = (duracaoJanela * i) / pedacos.length;
      fim = (duracaoJanela * (i + 1)) / pedacos.length;
    }
    return { texto: c.text, inicio: inicio + deslocamento, fim: fim + deslocamento };
  });
}

self.onmessage = async ({ data }) => {
  if (data.tipo !== 'transcrever') return;
  try {
    const modelo = await carregarModelo();
    const janelas = dividirEmJanelas(data.audio, TAXA);
    const palavras = [];

    for (let i = 0; i < janelas.length; i++) {
      self.postMessage({ tipo: 'progresso', etapa: 'fala', fracao: i / janelas.length });
      const { inicio, fim } = janelas[i];
      const saida = await modelo(data.audio.subarray(inicio, fim), {
        language: data.idioma,   // 'portuguese' | 'english' | 'spanish'
        task: 'transcribe',      // transcrever no idioma falado (sem traduzir)
        return_timestamps: 'word',
      });
      palavras.push(...extrairPalavras(saida, (fim - inicio) / TAXA, inicio / TAXA));
    }

    self.postMessage({ tipo: 'pronto', palavras });
  } catch (erro) {
    console.error(erro);
    self.postMessage({ tipo: 'erro', mensagem: erro?.message || String(erro) });
  }
};
