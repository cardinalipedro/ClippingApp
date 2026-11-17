// =====================================================================
//  aplicacao/estado.js — a "memória" do app enquanto a aba está aberta.
//  Um objeto só, compartilhado pelas telas. Coisas puramente visuais
//  (ex.: "o vídeo está tocando o trecho?") ficam no módulo da tela.
// =====================================================================

export const estado = {
  arquivo: null,            // File escolhido pelo usuário
  modo: 'curto',            // 'curto' (legendar um clipe) ou 'longo' (achar momentos e cortar)
  trecho: { inicio: 0, fim: 0 },
  legenda: null,            // { blocos, trecho } depois de "Gerar legenda"
  momentos: [],             // [{ inicio, fim, forca, titulo?, motivo?, marcado }] no modo longo
  momentoAtivo: null,       // índice do momento aberto no editor
  cache: novoCache(),       // áudios já extraídos do vídeo atual (evita refazer)
  ocupado: false,           // true enquanto exporta, legenda ou analisa
  emLote: false,            // true enquanto "Gerar clipes" processa a fila
  contadorClipes: 0,
};

function novoCache() {
  return { audioAnalise: null, audioIA: null };
}

/** Troca de vídeo: tudo que era do vídeo anterior deixa de valer. */
export function comecarNovoVideo(arquivo, modo) {
  estado.arquivo = arquivo;
  estado.modo = modo;
  estado.legenda = null;
  estado.momentos = [];
  estado.momentoAtivo = null;
  estado.cache = novoCache();
}
