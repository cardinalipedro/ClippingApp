// =====================================================================
//  infraestrutura/transcritor-whisper.js — o Whisper por trás do
//  contrato Transcritor (veja aplicacao/portas.js).
//
//  O modelo roda em transcricao.worker.js, numa thread separada, pra
//  página não travar. Esta classe só conversa com o worker por mensagens.
// =====================================================================

import { ErroApp } from '../dominio/erros.js';

export class TranscritorWhisper {
  #worker = null; // criado na primeira legenda e reaproveitado

  /**
   * @param {Float32Array} audio  16 kHz mono
   * @param {string} idioma       'portuguese' | 'english' | 'spanish'
   * @param {(etapa: 'modelo'|'fala', fracao: number) => void} aoProgresso
   */
  transcrever(audio, idioma, aoProgresso = () => {}) {
    if (!this.#worker) {
      this.#worker = new Worker(new URL('./transcricao.worker.js', import.meta.url), { type: 'module' });
    }
    const worker = this.#worker;

    return new Promise((resolver, rejeitar) => {
      worker.onmessage = ({ data }) => {
        if (data.tipo === 'progresso') aoProgresso(data.etapa, data.fracao);
        else if (data.tipo === 'pronto') resolver(data.palavras);
        else if (data.tipo === 'erro') rejeitar(new Error(data.mensagem));
      };
      worker.onerror = (e) => {
        this.#worker = null; // cria um worker novo na próxima tentativa
        rejeitar(e.message ? new Error(e.message) : new ErroApp('e.iaLegenda'));
      };
      // O 2º argumento "transfere" o áudio pro worker em vez de copiar (mais rápido)
      worker.postMessage({ tipo: 'transcrever', audio, idioma }, [audio.buffer]);
    });
  }
}
