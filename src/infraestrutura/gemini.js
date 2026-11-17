// =====================================================================
//  infraestrutura/gemini.js — a API do Gemini por trás do contrato
//  BuscadorMomentosIA (veja aplicacao/portas.js).
//
//  Aqui fica só o que é "conversa HTTP": endereço, cabeçalhos, formato
//  da resposta, novas tentativas. O texto do pedido e a conferência dos
//  tempos são regras do domínio (dominio/momentos-ia.js).
//
//  A chamada sai direto do navegador com a chave do próprio usuário.
//  Isso é ok pra uso pessoal. Num site público, a chave teria que
//  ficar escondida num backend.
// =====================================================================

import { ErroApp } from '../dominio/erros.js';
import { montarPedido } from '../dominio/momentos-ia.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const ESPERA_ALTA_DEMANDA_MS = 4000;

// Formato que a IA é obrigada a devolver ("saída estruturada")
const FORMATO_RESPOSTA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      inicio: { type: 'STRING', description: 'MM:SS' },
      fim: { type: 'STRING', description: 'MM:SS' },
      titulo: { type: 'STRING' },
      motivo: { type: 'STRING' },
      nota: { type: 'INTEGER' },
    },
    required: ['inicio', 'fim', 'titulo', 'motivo', 'nota'],
  },
};

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export class BuscadorGemini {
  /** @returns {Promise<object[]>} lista "crua" de momentos, como a IA mandou */
  async buscar(pedido) {
    const modelos = await this.#listarModelosFlash(pedido.chave);
    if (!modelos.length) throw new ErroApp('e.semModelo');

    const corpo = JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType: 'audio/aac', data: await paraBase64(pedido.audio) } },
          { text: montarPedido(pedido) },
        ],
      }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: FORMATO_RESPOSTA,
      },
    });

    let ultimoErro = new ErroApp('e.semResposta');
    for (const modelo of modelos.slice(0, 3)) {
      let resposta = await this.#gerar(modelo, pedido.chave, corpo);

      // 503: Google com alta demanda, espera um pouco e tenta de novo o mesmo modelo
      if (resposta.status === 503) {
        await esperar(ESPERA_ALTA_DEMANDA_MS);
        resposta = await this.#gerar(modelo, pedido.chave, corpo);
        if (!resposta.ok) {
          ultimoErro = new ErroApp('e.demanda');
          continue;
        }
      }

      const dados = await resposta.json().catch(() => ({}));
      if (resposta.ok) {
        const momentos = lerMomentos(dados, modelo);
        if (momentos) return momentos;
        ultimoErro = new ErroApp('e.semResposta');
        continue;
      }

      ultimoErro = new Error((dados.error?.message || `erro ${resposta.status}`).slice(0, 160));
      // 403/404/429: modelo fora do plano grátis ou cota estourada → tenta o próximo modelo
      if ([403, 404, 429].includes(resposta.status)) continue;
      throw ultimoErro;
    }
    throw ultimoErro;
  }

  #gerar(modelo, chave, corpo) {
    return fetch(`${API}/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
      body: corpo,
    });
  }

  /**
   * Descobre quais modelos "Flash" (rápidos e com plano grátis) a chave pode usar.
   * Os nomes mudam a cada versão, então perguntamos pra API em vez de fixar um nome no código.
   */
  async #listarModelosFlash(chave) {
    const resposta = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': chave } });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      throw dados.error?.message ? new Error(dados.error.message) : new ErroApp('e.chave', { c: resposta.status });
    }
    return (dados.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace('models/', ''))
      .filter((nome) => /^gemini-\d+(\.\d+)?-flash$/.test(nome))            // ex.: gemini-2.5-flash
      .sort((a, b) => parseFloat(b.split('-')[1]) - parseFloat(a.split('-')[1])); // mais novo primeiro
  }
}

/** Lê o texto JSON da resposta. Devolve null se a IA não mandou texto. */
function lerMomentos(dados, modelo) {
  const texto = (dados.candidates?.[0]?.content?.parts || [])
    .filter((parte) => !parte.thought)
    .map((parte) => parte.text || '')
    .join('');
  if (!texto) return null;
  console.info(`[ia] modelo usado: ${modelo}`);
  return JSON.parse(texto);
}

/** Bytes → texto base64 (o formato em que arquivos viajam dentro de um JSON). */
function paraBase64(bytes) {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result).split(',')[1]);
    leitor.onerror = () => rejeitar(new ErroApp('e.prepararAudio'));
    leitor.readAsDataURL(new Blob([bytes]));
  });
}
