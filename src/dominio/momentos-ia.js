// =====================================================================
//  dominio/momentos-ia.js — o que pedimos pra IA e como conferimos a
//  resposta. A chamada HTTP fica em infraestrutura/gemini.js; aqui só
//  estão as regras: o texto do pedido e a validação dos tempos.
// =====================================================================

const NOMES_IDIOMA = { portuguese: 'português', english: 'inglês', spanish: 'espanhol' };

/** Texto do pedido ("prompt") com as regras de um bom clipe. */
export function montarPedido({ duracaoTotal, duracaoClipe, quantidade, idioma }) {
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
