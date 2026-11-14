// =====================================================================
//  legenda.js — funções "puras" de legenda (não mexem na tela).
//  Uma PALAVRA é { texto, inicio, fim } com tempos em segundos,
//  contados a partir do início do trecho.
//  Um BLOCO é o grupo de palavras que aparece junto na tela:
//  { inicio, fim, palavras: [...] }
// =====================================================================

export const FONTE_LEGENDA = 'Inter ExtraBold'; // precisa bater com o arquivo em src/fontes
const COR_TEXTO = '&HFFFFFF&';     // branco   (ASS usa a ordem azul-verde-vermelho)
const COR_DESTAQUE = '&H439FFF&';  // laranja #ff9f43

/** Tira pontuação das pontas (mantém ? e !), como nos clipes de rede social. */
export function limparPalavra(texto) {
  return String(texto)
    .trim()
    .replace(/^[\s.,;:"“”«»()\[\]…¿¡-]+/, '')
    .replace(/[\s.,;:"“”«»()\[\]…-]+$/, '');
}

/**
 * Junta as palavras em blocos curtos (bom pra tela vertical).
 * Quebra o bloco quando: enche, tem uma pausa na fala ou a frase termina.
 */
export function agruparEmBlocos(palavras, { maxPalavras = 3, maxLetras = 18, pausa = 0.6 } = {}) {
  const blocos = [];
  let atual = [];
  let fimDeFrase = false;

  const fechar = () => {
    if (atual.length) blocos.push({ palavras: atual });
    atual = [];
  };

  for (const bruta of palavras) {
    const texto = limparPalavra(bruta.texto);
    if (!texto) continue;
    const palavra = { texto, inicio: bruta.inicio, fim: Math.max(bruta.fim, bruta.inicio + 0.05) };

    const anterior = atual[atual.length - 1];
    const letras = atual.reduce((n, p) => n + p.texto.length + 1, 0) + texto.length;
    if (
      anterior &&
      (fimDeFrase || atual.length >= maxPalavras || letras > maxLetras || palavra.inicio - anterior.fim > pausa)
    ) {
      fechar();
    }
    atual.push(palavra);
    fimDeFrase = /[.?!…]\s*$/.test(String(bruta.texto));
  }
  fechar();

  // Define quando cada bloco entra e sai da tela
  blocos.forEach((bloco, i) => {
    const ultima = bloco.palavras[bloco.palavras.length - 1];
    const proximo = blocos[i + 1];
    bloco.inicio = bloco.palavras[0].inicio;
    bloco.fim = Math.max(ultima.fim + 0.1, bloco.inicio + 0.3);
    if (proximo) bloco.fim = Math.min(bloco.fim, proximo.palavras[0].inicio);
  });
  return blocos;
}

/**
 * Aplica um texto editado pelo usuário a um bloco.
 * Mesmo nº de palavras: mantém os tempos. Nº diferente: divide o tempo do bloco por igual.
 */
export function aplicarTextoAoBloco(bloco, texto) {
  const textos = String(texto).trim().split(/\s+/).filter(Boolean);
  if (textos.length === bloco.palavras.length) {
    bloco.palavras = bloco.palavras.map((p, i) => ({ ...p, texto: textos[i] }));
  } else {
    const fatia = (bloco.fim - bloco.inicio) / Math.max(textos.length, 1);
    bloco.palavras = textos.map((t, i) => ({
      texto: t,
      inicio: bloco.inicio + fatia * i,
      fim: bloco.inicio + fatia * (i + 1),
    }));
  }
  return bloco;
}

export const textoDoBloco = (bloco) => bloco.palavras.map((p) => p.texto).join(' ');

// ---------- Arquivo .ass (formato de legenda que o FFmpeg "queima" no vídeo) ----------

function tempoASS(segundos) {
  const cs = Math.max(0, Math.round(segundos * 100)); // centésimos
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

// { } e \ são comandos no formato ASS; trocamos pra ninguém quebrar a legenda sem querer
const escaparASS = (t) => t.replace(/\\/g, '/').replace(/[{}]/g, '').replace(/\r?\n/g, ' ');

/**
 * Gera o conteúdo do arquivo .ass.
 * Com `destacar`, cada bloco vira um evento por palavra: o texto é o mesmo,
 * só muda qual palavra está pintada — é isso que dá o efeito "karaokê".
 */
export function gerarASS(blocos, { largura, altura, destacar = true }) {
  const tamanho = Math.round(largura * 0.085);
  const contorno = Math.max(2, Math.round(largura * 0.006));
  const margemV = Math.round(altura * 0.2);     // distância do rodapé
  const margemH = Math.round(largura * 0.06);

  const cabecalho = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${largura}`,
    `PlayResY: ${altura}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Legenda,${FONTE_LEGENDA},${tamanho},&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,${contorno},${Math.round(contorno / 3)},2,${margemH},${margemH},${margemV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const eventos = [];
  const linha = (inicio, fim, texto) =>
    eventos.push(`Dialogue: 0,${tempoASS(inicio)},${tempoASS(fim)},Legenda,,0,0,0,,${texto}`);

  for (const bloco of blocos) {
    const palavras = bloco.palavras
      .map((p) => ({ ...p, texto: escaparASS(p.texto).toUpperCase() }))
      .filter((p) => p.texto);
    if (!palavras.length) continue;

    if (!destacar) {
      linha(bloco.inicio, bloco.fim, palavras.map((p) => p.texto).join(' '));
      continue;
    }
    palavras.forEach((palavra, i) => {
      const inicio = i === 0 ? bloco.inicio : palavra.inicio;
      const fim = i === palavras.length - 1 ? bloco.fim : palavras[i + 1].inicio;
      if (fim - inicio < 0.01) return;
      const texto = palavras
        .map((p, j) => (j === i ? `{\\c${COR_DESTAQUE}}${p.texto}{\\c${COR_TEXTO}}` : p.texto))
        .join(' ');
      linha(inicio, fim, texto);
    });
  }

  return [...cabecalho, ...eventos, ''].join('\n');
}

// ---------- Áudio ----------

/**
 * O Whisper entende no máximo 30 s por vez. Aqui dividimos o áudio em janelas
 * menores, cortando sempre no ponto mais silencioso do fim de cada janela
 * (pra não partir uma palavra no meio).
 * Devolve [{ inicio, fim }] em nº de amostras.
 */
export function dividirEmJanelas(audio, taxa = 16000, maxSegundos = 28, buscaSegundos = 6) {
  const max = Math.floor(maxSegundos * taxa);
  const busca = Math.floor(buscaSegundos * taxa);
  const quadro = Math.floor(0.2 * taxa);
  const janelas = [];
  let inicio = 0;

  while (audio.length - inicio > max) {
    let melhor = inicio + max;
    let menorEnergia = Infinity;
    for (let p = inicio + max - busca; p + quadro <= inicio + max; p += quadro / 2) {
      let energia = 0;
      for (let i = p; i < p + quadro; i++) energia += audio[i] * audio[i];
      if (energia < menorEnergia) {
        menorEnergia = energia;
        melhor = Math.floor(p + quadro / 2);
      }
    }
    janelas.push({ inicio, fim: melhor });
    inicio = melhor;
  }
  if (audio.length - inicio > taxa * 0.1) janelas.push({ inicio, fim: audio.length });
  return janelas;
}
