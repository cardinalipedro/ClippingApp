// =====================================================================
//  ia.js — pede pro Gemini (IA do Google) ouvir o áudio do vídeo e
//  escolher os momentos com mais potencial, pelo CONTEÚDO (o que foi
//  dito, o tom de voz, risadas, sustos), não só pelo volume.
//
//  A chamada sai direto do navegador com a chave do próprio usuário.
//  Isso é ok pra uso pessoal. Num site público, a chave teria que
//  ficar escondida num backend.
// =====================================================================

import { t } from './i18n.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';

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

const NOMES_IDIOMA = { portuguese: 'português', english: 'inglês', spanish: 'espanhol' };

function montarPedido({ duracaoTotal, duracaoClipe, quantidade, idioma }) {
  const total = `${Math.floor(duracaoTotal / 60)}:${String(Math.floor(duracaoTotal % 60)).padStart(2, '0')}`;
  return [
    'Você é um editor de clipes para TikTok, Shorts e Reels.',
    `Este é o áudio completo de um vídeo (provavelmente gameplay ou live), com ${total} de duração, falado em ${NOMES_IDIOMA[idioma] || 'português'}.`,
    `Escolha até ${quantidade} momentos com mais potencial de viralizar: piadas, reações fortes, sustos, jogadas absurdas, frases de efeito, discussões, risadas.`,
    'Regras:',
    `- Cada momento dura cerca de ${duracaoClipe} segundos (entre ${Math.round(duracaoClipe * 0.6)} e ${Math.round(duracaoClipe * 1.4)}).`,
    '- Cada momento precisa fazer sentido sozinho: comece no início da ideia e termine logo depois do desfecho.',
    '- Os momentos não podem se sobrepor.',
    '- "inicio" e "fim" no formato MM:SS, contados desde o começo do áudio (os minutos podem passar de 59).',
    '- "titulo": chamada curta pro clipe, no idioma falado, com no máximo 60 caracteres.',
    '- "motivo": uma frase dizendo por que esse momento é bom.',
    '- "nota": de 1 a 10, o potencial do momento.',
    'Se o vídeo não tiver bons momentos, devolva menos itens em vez de inventar.',
  ].join('\n');
}

/** "12:34" ou "1:02:03" → segundos. Devolve NaN se não entender. */
export function paraSegundos(texto) {
  const partes = String(texto).trim().split(':').map(Number);
  if (!partes.length || partes.length > 3 || partes.some((n) => !Number.isFinite(n))) return NaN;
  return partes.reduce((total, n) => total * 60 + n, 0);
}

/** Confere e arruma a resposta da IA: tempos válidos, sem sobreposição, melhores primeiro. */
export function organizarMomentos(brutos, { duracaoTotal, duracaoClipe, quantidade }) {
  const validos = (Array.isArray(brutos) ? brutos : [])
    .map((b) => {
      const inicio = Math.max(0, paraSegundos(b.inicio));
      let fim = Math.min(duracaoTotal, paraSegundos(b.fim));
      if (fim - inicio < 5) fim = Math.min(duracaoTotal, inicio + duracaoClipe);  // curto demais
      if (fim - inicio > duracaoClipe * 2) fim = inicio + duracaoClipe * 2;       // longo demais
      return {
        inicio,
        fim,
        titulo: String(b.titulo || '').trim().slice(0, 80),
        motivo: String(b.motivo || '').trim().slice(0, 200),
        forca: Math.min(10, Math.max(1, Number(b.nota) || 5)) / 10,
      };
    })
    .filter((m) => Number.isFinite(m.inicio) && Number.isFinite(m.fim) && m.fim - m.inicio >= 3);

  const escolhidos = [];
  for (const m of validos.sort((a, b) => b.forca - a.forca)) {
    if (escolhidos.length >= quantidade) break;
    if (escolhidos.every((e) => m.fim <= e.inicio || m.inicio >= e.fim)) escolhidos.push(m);
  }
  return escolhidos.sort((a, b) => a.inicio - b.inicio);
}

/**
 * Descobre quais modelos "Flash" (rápidos e com plano grátis) a chave pode usar.
 * Os nomes mudam a cada versão, então perguntamos pra API em vez de fixar um nome no código.
 */
async function listarModelosFlash(chave) {
  const resposta = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': chave } });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.error?.message || t('e.chave', { c: resposta.status }));

  return (dados.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((nome) => /^gemini-\d+(\.\d+)?-flash$/.test(nome))            // ex.: gemini-2.5-flash
    .sort((a, b) => parseFloat(b.split('-')[1]) - parseFloat(a.split('-')[1])); // mais novo primeiro
}

/**
 * @param {{chave:string, audioBase64:string, duracaoTotal:number, duracaoClipe:number, quantidade:number, idioma:string}} p
 * @returns {Promise<{inicio:number, fim:number, titulo:string, motivo:string, forca:number}[]>}
 */
export async function encontrarMomentosComIA(p) {
  const modelos = await listarModelosFlash(p.chave);
  if (!modelos.length) throw new Error(t('e.semModelo'));

  const corpo = JSON.stringify({
    contents: [{
      parts: [
        { inlineData: { mimeType: 'audio/aac', data: p.audioBase64 } },
        { text: montarPedido(p) },
      ],
    }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: FORMATO_RESPOSTA,
    },
  });

  let ultimoErro = t('e.semResposta');
  for (const modelo of modelos.slice(0, 3)) {
    const resposta = await fetch(`${API}/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': p.chave },
      body: corpo,
    });
    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      ultimoErro = dados.error?.message || `erro ${resposta.status}`;
      // 503: Google com alta demanda, espera um pouco e tenta de novo o mesmo modelo
      if (resposta.status === 503) {
        await new Promise((r) => setTimeout(r, 4000));
        const nova = await fetch(`${API}/models/${modelo}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': p.chave },
          body: corpo,
        });
        if (nova.ok) {
          const dadosNova = await nova.json().catch(() => ({}));
          return finalizarResposta(dadosNova, modelo, p);
        }
        ultimoErro = t('e.demanda');
        continue;
      }
      // 403/404/429: modelo fora do plano grátis ou cota estourada → tenta o modelo anterior
      if ([403, 404, 429].includes(resposta.status)) continue;
      throw new Error(ultimoErro);
    }

    const resultado = finalizarResposta(dados, modelo, p);
    if (resultado) return resultado;
    ultimoErro = t('e.semResposta');
  }
  throw new Error(ultimoErro.slice(0, 160));
}

/** Lê o texto da resposta e transforma em momentos. Devolve null se não tiver texto. */
function finalizarResposta(dados, modelo, p) {
  const texto = (dados.candidates?.[0]?.content?.parts || [])
    .filter((parte) => !parte.thought)
    .map((parte) => parte.text || '')
    .join('');
  if (!texto) return null;
  console.info(`[ia] modelo usado: ${modelo}`);
  return organizarMomentos(JSON.parse(texto), p);
}
