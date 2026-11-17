// =====================================================================
//  momentos.js — acha os trechos mais "agitados" de um vídeo longo
//  olhando só pro SOM (gritos, risadas, explosões, gente falando alto).
//
//  Ideia: momento bom costuma ser barulhento. Então:
//   1) mede o volume a cada 0,25 s
//   2) calcula quanto cada instante passa do volume "normal" do vídeo
//   3) procura as janelas (do tamanho do clipe) com mais agitação somada
//   4) ajusta início e fim pro ponto mais silencioso por perto,
//      pra não cortar ninguém no meio da frase
//
//  Não é adivinhação de viral: é um atalho pra não assistir o vídeo inteiro.
// =====================================================================

const QUADRO = 0.25; // segundos por medição de volume

/** Volume (em decibéis) de cada quadro de 0,25 s. `amostras` é um Int16Array mono. */
function medirVolume(amostras, taxa) {
  const tamanho = Math.floor(QUADRO * taxa);
  const total = Math.floor(amostras.length / tamanho);
  const volume = new Float32Array(total);
  for (let q = 0; q < total; q++) {
    let soma = 0;
    const base = q * tamanho;
    for (let i = 0; i < tamanho; i++) {
      const a = amostras[base + i] / 32768;
      soma += a * a;
    }
    volume[q] = 10 * Math.log10(soma / tamanho + 1e-10);
  }
  return volume;
}

function mediana(valores) {
  const ordenado = Float32Array.from(valores).sort();
  return ordenado[Math.floor(ordenado.length / 2)] ?? 0;
}

/** Índice do quadro mais silencioso entre `de` e `ate` (inclusive). */
function quadroMaisSilencioso(volume, de, ate) {
  let melhor = Math.min(Math.max(0, de), volume.length - 1);
  for (let q = melhor; q <= Math.min(ate, volume.length - 1); q++) {
    if (volume[q] < volume[melhor]) melhor = q;
  }
  return melhor;
}

/**
 * @param {Int16Array} amostras  áudio mono
 * @param {number} taxa          amostras por segundo
 * @param {{duracaoClipe:number, quantidade:number}} opcoes
 * @returns {{inicio:number, fim:number, forca:number}[]} em ordem de tempo; forca vai de 0 a 1
 */
export function encontrarMomentos(amostras, taxa, { duracaoClipe = 30, quantidade = 5 } = {}) {
  const volume = medirVolume(amostras, taxa);
  const duracaoTotal = volume.length * QUADRO;
  if (volume.length < 4) return [];
  if (duracaoTotal <= duracaoClipe + 1) return [{ inicio: 0, fim: duracaoTotal, forca: 1 }];

  // 2) agitação = quanto passa do volume normal + bônus pra subida repentina (susto, grito)
  const normal = mediana(volume);
  const agitacao = new Float32Array(volume.length);
  for (let q = 0; q < volume.length; q++) {
    const acima = Math.max(0, volume[q] - normal);
    const subida = q >= 4 ? Math.max(0, volume[q] - volume[q - 4]) : 0;
    agitacao[q] = acima + 0.5 * subida;
  }

  // 3) soma da agitação em cada janela possível (soma acumulada = conta rápida)
  const janela = Math.round(duracaoClipe / QUADRO);
  const acumulada = new Float64Array(volume.length + 1);
  for (let q = 0; q < volume.length; q++) acumulada[q + 1] = acumulada[q] + agitacao[q];
  const inicios = volume.length - janela + 1;
  const pontos = new Float64Array(inicios);
  for (let q = 0; q < inicios; q++) pontos[q] = acumulada[q + janela] - acumulada[q];

  // Escolhe as melhores janelas sem sobreposição (a melhor, depois a melhor que sobrou…)
  const escolhidos = [];
  const livre = new Uint8Array(inicios).fill(1);
  let melhorPontuacao = 0;
  while (escolhidos.length < quantidade) {
    let melhor = -1;
    for (let q = 0; q < inicios; q++) {
      if (livre[q] && (melhor < 0 || pontos[q] > pontos[melhor])) melhor = q;
    }
    if (melhor < 0 || pontos[melhor] <= 0) break;
    if (!escolhidos.length) melhorPontuacao = pontos[melhor];
    else if (pontos[melhor] < melhorPontuacao * 0.25) break; // o resto é fraco demais
    escolhidos.push({ quadro: melhor, pontos: pontos[melhor] });
    for (let q = Math.max(0, melhor - janela); q < Math.min(inicios, melhor + janela); q++) livre[q] = 0;
  }

  // 4) ajusta as pontas pro silêncio mais próximo (até 1,5 s de folga)
  const folga = Math.round(1.5 / QUADRO);
  return escolhidos
    .sort((a, b) => a.quadro - b.quadro)
    .map(({ quadro, pontos: p }, i, lista) => {
      const anterior = lista[i - 1];
      const minimo = anterior ? anterior.quadro + janela : 0; // não invadir o clipe de trás
      const qInicio = quadroMaisSilencioso(volume, Math.max(minimo, quadro - folga), quadro + folga);
      const qFim = quadroMaisSilencioso(volume, quadro + janela - folga, quadro + janela + folga);
      return {
        inicio: Math.round(qInicio * QUADRO * 10) / 10,
        fim: Math.round(Math.min(duracaoTotal, (qFim + 1) * QUADRO) * 10) / 10,
        forca: p / melhorPontuacao,
      };
    });
}

/**
 * Devolve uma função que empurra início e fim de um trecho pro silêncio mais
 * próximo (até 1,5 s de folga). Usada pra dar acabamento nos momentos da IA.
 */
export function criarAjustador(amostras, taxa) {
  const volume = medirVolume(amostras, taxa);
  const total = volume.length * QUADRO;
  const folga = Math.round(1.5 / QUADRO);
  return (inicio, fim) => {
    if (volume.length < 4) return { inicio, fim };
    const qInicio = Math.round(inicio / QUADRO);
    const qFim = Math.round(fim / QUADRO);
    const a = quadroMaisSilencioso(volume, qInicio - folga, qInicio + folga);
    const b = quadroMaisSilencioso(volume, qFim - folga, qFim + folga);
    return {
      inicio: Math.round(a * QUADRO * 10) / 10,
      fim: Math.round(Math.min(total, (b + 1) * QUADRO) * 10) / 10,
    };
  };
}
