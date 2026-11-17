// =====================================================================
//  interface/dom.js — atalhos pros elementos do HTML.
//  Se um id mudar no index.html, só este arquivo precisa mudar.
// =====================================================================

const $ = (id) => document.getElementById(id);

export const el = {
  // etapas e navegação
  etapaUpload: $('etapaUpload'),
  etapaEditor: $('etapaEditor'),
  etapaClipes: $('etapaClipes'),
  logo: $('logo'),
  btnVoltar: $('btnVoltar'),
  btnTrocar: $('btnTrocar'),
  modoAtual: $('modoAtual'),
  idiomaInicial: $('idiomaInicial'),

  // player e trecho
  video: $('video'),
  videoWrap: $('videoWrap'),
  moldura: $('moldura'),
  btnInicio: $('btnInicio'),
  btnFim: $('btnFim'),
  btnOuvir: $('btnOuvir'),
  inicio: $('inicio'),
  fim: $('fim'),
  duracao: $('duracao'),

  // formato e exportação
  posicao: $('posicao'),
  linhaPosicao: $('linhaPosicao'),
  resolucao: $('resolucao'),
  linhaResolucao: $('linhaResolucao'),
  btnExportar: $('btnExportar'),
  listaClipes: $('listaClipes'),

  // andamento
  progresso: $('progresso'),
  barra: $('barra'),
  status: $('status'),

  // legenda
  idioma: $('idioma'),
  btnLegenda: $('btnLegenda'),
  btnRemoverLegenda: $('btnRemoverLegenda'),
  dicaLegenda: $('dicaLegenda'),
  editorLegenda: $('editorLegenda'),
  listaLegenda: $('listaLegenda'),
  legendaPrevia: $('legendaPrevia'),

  // momentos (vídeo longo)
  painelMomentos: $('painelMomentos'),
  metodoMomentos: $('metodoMomentos'),
  duracaoClipe: $('duracaoClipe'),
  quantidadeClipes: $('quantidadeClipes'),
  idiomaMomentos: $('idiomaMomentos'),
  legendarLote: $('legendarLote'),
  btnAnalisar: $('btnAnalisar'),
  btnLote: $('btnLote'),
  listaMomentos: $('listaMomentos'),
  dicaMomentos: $('dicaMomentos'),
  linhaChave: $('linhaChave'),
  chaveGemini: $('chaveGemini'),

  // topo
  btnTema: $('btnTema'),
};

export const formatoAtual = () => document.querySelector('input[name="formato"]:checked').value;
