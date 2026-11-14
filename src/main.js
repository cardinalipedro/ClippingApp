// =====================================================================
//  Clipador — main.js
//  Fluxo: escolher vídeo → marcar início/fim → escolher formato → exportar
//  O processamento é feito pelo FFmpeg compilado para WebAssembly,
//  rodando dentro do navegador do usuário (sem servidor).
// =====================================================================

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { encontrarMomentos, criarAjustador } from './momentos.js';
import { encontrarMomentosComIA } from './ia.js';
import { t, aplicarTraducoes, definirIdioma, idiomaAtual, aoTrocarIdioma } from './i18n.js';
import { agruparEmBlocos, aplicarTextoAoBloco, gerarASS, textoDoBloco } from './legenda.js';
import urlFonteLegenda from './fontes/Inter-ExtraBold.otf?url'; // o Vite troca isso pela URL do arquivo

// Onde baixar o "núcleo" do FFmpeg (~30 MB, baixado só na 1ª exportação)
const CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
const DURACAO_PADRAO = 30;            // segundos sugeridos ao abrir um vídeo
const LIMITE_COPIA_BYTES = 1.5e9;     // acima disso não dá pra copiar o vídeo pra memória
const LIMITE_LEGENDA_AUTO = 180;      // modo "clipe curto": legenda sozinho vídeos de até 3 min
const LIMITE_AUDIO_IA_BYTES = 14e6;    // o Gemini aceita pedidos de até 20 MB (o áudio cresce 1/3 ao ser enviado)
const CHAVE_GUARDADA = 'clipador.chaveGemini'; // nome usado no localStorage
const TAXA_ANALISE = 8000;            // qualidade do áudio usado pra achar momentos (baixa = rápido)

// ---------- Atalho para pegar elementos do HTML ----------
const $ = (id) => document.getElementById(id);
const el = {
  etapaUpload: $('etapaUpload'),
  etapaEditor: $('etapaEditor'),
  etapaClipes: $('etapaClipes'),
  video: $('video'),
  moldura: $('moldura'),
  btnInicio: $('btnInicio'),
  btnFim: $('btnFim'),
  btnOuvir: $('btnOuvir'),
  inicio: $('inicio'),
  fim: $('fim'),
  duracao: $('duracao'),
  posicao: $('posicao'),
  linhaPosicao: $('linhaPosicao'),
  resolucao: $('resolucao'),
  linhaResolucao: $('linhaResolucao'),
  btnExportar: $('btnExportar'),
  btnTrocar: $('btnTrocar'),
  progresso: $('progresso'),
  barra: $('barra'),
  status: $('status'),
  listaClipes: $('listaClipes'),
  videoWrap: $('videoWrap'),
  idioma: $('idioma'),
  btnLegenda: $('btnLegenda'),
  btnRemoverLegenda: $('btnRemoverLegenda'),
  dicaLegenda: $('dicaLegenda'),
  editorLegenda: $('editorLegenda'),
  listaLegenda: $('listaLegenda'),
  legendaPrevia: $('legendaPrevia'),
  idiomaInicial: $('idiomaInicial'),
  painelMomentos: $('painelMomentos'),
  duracaoClipe: $('duracaoClipe'),
  quantidadeClipes: $('quantidadeClipes'),
  legendarLote: $('legendarLote'),
  btnLote: $('btnLote'),
  listaMomentos: $('listaMomentos'),
  dicaMomentos: $('dicaMomentos'),
  metodoMomentos: $('metodoMomentos'),
  linhaChave: $('linhaChave'),
  chaveGemini: $('chaveGemini'),
  btnAnalisar: $('btnAnalisar'),
  idiomaMomentos: $('idiomaMomentos'),
  btnTema: $('btnTema'),
};

// ---------- Estado da aplicação (a "memória" do app) ----------
const estado = {
  arquivo: null,           // File escolhido pelo usuário
  urlVideo: null,          // URL temporária usada no <video>
  inicio: 0,
  fim: 0,
  tocandoTrecho: false,    // true enquanto o botão "Ver trecho" estiver tocando
  ocupado: false,          // true durante uma exportação
  arquivoNoFFmpeg: null,   // qual File já foi copiado pro FFmpeg (evita copiar de novo)
  nomeEntrada: null,       // nome desse arquivo dentro do FFmpeg
  duracaoExportando: 0,    // usado pra calcular a % da barra de progresso
  ultimosLogs: [],         // últimas linhas do FFmpeg (ajuda a explicar erros)
  contadorClipes: 0,
  legenda: null,           // { blocos, inicioTrecho, fimTrecho } depois de "Gerar legenda"
  fonteNoFFmpeg: false,    // a fonte da legenda já foi copiada pro FFmpeg?
  modo: 'curto',           // 'curto' (legendar um clipe) ou 'longo' (achar momentos e cortar)
  entradaMontada: false,   // o vídeo está "montado" no FFmpeg (lido direto do disco)?
  audioAnalise: null,      // áudio do vídeo inteiro em baixa qualidade (modo longo)
  audioIA: null,           // o mesmo áudio, comprimido e em base64, pra mandar pro Gemini
  momentos: [],            // [{ inicio, fim, forca, marcado }] sugeridos no modo longo
  momentoAtivo: null,      // índice do momento que está aberto no editor
  emLote: false,           // true enquanto "Gerar clipes" processa a fila
  prefixoStatus: '',       // ex.: "Clipe 2 de 5 — " na frente das mensagens
};

// =====================================================================
//  FFmpeg
// =====================================================================
const ffmpeg = new FFmpeg();
let carregamentoFFmpeg = null; // Promise compartilhada: carrega uma vez só

ffmpeg.on('log', ({ message }) => {
  console.debug('[ffmpeg]', message);
  estado.ultimosLogs.push(message);
  if (estado.ultimosLogs.length > 30) estado.ultimosLogs.shift();

  // O FFmpeg escreve "time=00:00:12.34" conforme processa; usamos isso pra barra
  const m = message.match(/time=(\d+):(\d+):([\d.]+)/);
  if (m && estado.duracaoExportando > 0) {
    const segundos = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    atualizarBarra(segundos / estado.duracaoExportando);
  }
});

function carregarFFmpeg() {
  if (!carregamentoFFmpeg) {
    carregamentoFFmpeg = (async () => {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    })().catch((erro) => {
      carregamentoFFmpeg = null; // permite tentar de novo
      throw erro;
    });
  }
  return carregamentoFFmpeg;
}

// =====================================================================
//  Etapa 1 — escolher o vídeo
// =====================================================================
// Cada área de upload sabe o seu modo pelo atributo data-modo do HTML
document.querySelectorAll('.dropzone').forEach((zona) => {
  const modo = zona.dataset.modo;
  const campo = zona.querySelector('input[type="file"]');

  campo.addEventListener('change', () => {
    abrirArquivo(campo.files[0], modo);
    campo.value = ''; // permite escolher o mesmo arquivo de novo depois
  });
  zona.addEventListener('dragover', (e) => {
    e.preventDefault(); // sem isso o navegador abre o arquivo numa aba nova
    zona.classList.add('arrastando');
  });
  zona.addEventListener('dragleave', () => zona.classList.remove('arrastando'));
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    zona.classList.remove('arrastando');
    abrirArquivo(e.dataTransfer.files[0], modo);
  });
});

function abrirArquivo(arquivo, modo) {
  if (!arquivo) return;
  const ehVideo = arquivo.type.startsWith('video/') || /\.(mp4|mov|m4v|mkv|webm)$/i.test(arquivo.name);
  if (!ehVideo) {
    alert(t('a.naoVideo'));
    return;
  }

  if (estado.urlVideo) URL.revokeObjectURL(estado.urlVideo); // libera o vídeo anterior
  estado.arquivo = arquivo;
  estado.modo = modo;
  removerLegenda(); // legenda e momentos do vídeo anterior não valem pro novo
  estado.audioAnalise = null;
  estado.audioIA = null;
  estado.momentos = [];
  estado.momentoAtivo = null;
  desenharMomentos();
  el.progresso.hidden = true;
  estado.urlVideo = URL.createObjectURL(arquivo);
  el.video.src = estado.urlVideo;
}

// Quando o navegador termina de ler as informações do vídeo (duração, tamanho)
el.video.addEventListener('loadedmetadata', () => {
  const duracao = el.video.duration;
  const curto = estado.modo === 'curto';
  const legendarSozinho = curto && duracao <= LIMITE_LEGENDA_AUTO;

  estado.inicio = 0;
  // Clipe curto: o trecho já é o vídeo inteiro. Senão, começa com uma sugestão de 30 s.
  estado.fim = legendarSozinho ? Math.floor(duracao * 10) / 10 : Math.min(duracao, DURACAO_PADRAO);
  el.idioma.value = el.idiomaInicial.value;
  el.idiomaMomentos.value = el.idiomaInicial.value;
  el.painelMomentos.hidden = curto;
  mostrarEtapa('editor');
  sincronizarTempos();
  atualizarFormato();

  // Clipe curto: já legenda. Vídeo longo: espera o clique em "Encontrar momentos".
  if (legendarSozinho) gerarLegenda();
  else if (curto) atualizarDicaLegenda(t('d.longoDemais'));
});

el.video.addEventListener('error', () => {
  alert(t('a.naoAbre'));
});

el.btnTrocar.addEventListener('click', () => {
  el.video.pause();
  mostrarEtapa('upload');
});

function mostrarEtapa(qual) {
  el.etapaUpload.hidden = qual !== 'upload';
  el.etapaEditor.hidden = qual !== 'editor';
}

// =====================================================================
//  Etapa 2 — marcar o trecho
// =====================================================================
const arredondar = (n) => Math.round(n * 10) / 10;

function marcarInicio() {
  estado.inicio = arredondar(el.video.currentTime);
  if (estado.fim <= estado.inicio) {
    estado.fim = Math.min(el.video.duration, estado.inicio + DURACAO_PADRAO);
  }
  sincronizarTempos();
}

function marcarFim() {
  const t = arredondar(el.video.currentTime);
  if (t <= estado.inicio) {
    alert(t('a.fimDepois'));
    return;
  }
  estado.fim = t;
  sincronizarTempos();
}

function verTrecho() {
  el.video.currentTime = estado.inicio;
  estado.tocandoTrecho = true;
  el.video.play();
}

// Para o vídeo automaticamente quando o "Ver trecho" chega no fim
el.video.addEventListener('timeupdate', () => {
  if (estado.tocandoTrecho && el.video.currentTime >= estado.fim) {
    el.video.pause();
    estado.tocandoTrecho = false;
  }
});
el.video.addEventListener('pause', () => { estado.tocandoTrecho = false; });

// Digitação manual nos campos de tempo
el.inicio.addEventListener('change', () => {
  const max = el.video.duration || 0;
  estado.inicio = Math.min(Math.max(0, Number(el.inicio.value) || 0), max);
  if (estado.fim <= estado.inicio) estado.fim = Math.min(max, estado.inicio + 1);
  sincronizarTempos();
});
el.fim.addEventListener('change', () => {
  const max = el.video.duration || 0;
  estado.fim = Math.min(Math.max(estado.inicio + 0.1, Number(el.fim.value) || 0), max);
  sincronizarTempos();
});

// Mantém campos e texto de duração iguais ao estado
function sincronizarTempos() {
  el.inicio.value = estado.inicio.toFixed(1);
  el.fim.value = estado.fim.toFixed(1);
  el.inicio.max = el.fim.max = el.video.duration || 0;
  el.duracao.textContent = t('duracao', { s: (estado.fim - estado.inicio).toFixed(1) });

  // No modo longo, ajustar o trecho ajusta o momento que está aberto
  const momento = estado.momentos[estado.momentoAtivo];
  if (momento && (momento.inicio !== estado.inicio || momento.fim !== estado.fim)) {
    momento.inicio = estado.inicio;
    momento.fim = estado.fim;
    desenharMomentos();
  }

  // A legenda é feita pra um trecho específico: se o trecho mudou, ela não serve mais
  const l = estado.legenda;
  if (l && (l.inicioTrecho !== estado.inicio || l.fimTrecho !== estado.fim)) {
    removerLegenda(t('d.trechoMudou'));
  }
}

el.btnInicio.addEventListener('click', marcarInicio);
el.btnFim.addEventListener('click', marcarFim);
el.btnOuvir.addEventListener('click', verTrecho);

// Atalhos de teclado: I = início, O = fim, P = ver trecho
document.addEventListener('keydown', (e) => {
  if (el.etapaEditor.hidden) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return; // está digitando
  const tecla = e.key.toLowerCase();
  if (tecla === 'i') marcarInicio();
  else if (tecla === 'o') marcarFim();
  else if (tecla === 'p') verTrecho();
});

// =====================================================================
//  Formato e enquadramento
// =====================================================================
const formatoAtual = () => document.querySelector('input[name="formato"]:checked').value;

document.querySelectorAll('input[name="formato"]').forEach((radio) => {
  radio.addEventListener('change', atualizarFormato);
});
el.posicao.addEventListener('input', atualizarMoldura);

function atualizarFormato() {
  const formato = formatoAtual();
  el.linhaPosicao.hidden = formato !== 'vertical' || !videoEhMaisLargoQueVertical();
  el.linhaResolucao.hidden = formato === 'original';
  atualizarMoldura();
  atualizarDicaLegenda();
}

function videoEhMaisLargoQueVertical() {
  const { videoWidth: w, videoHeight: h } = el.video;
  return w > 0 && h > 0 && w / h > 9 / 16;
}

// Desenha o retângulo laranja mostrando o que vai entrar no clipe vertical
function atualizarMoldura() {
  if (formatoAtual() !== 'vertical' || !videoEhMaisLargoQueVertical()) {
    el.moldura.hidden = true;
    return;
  }
  const { videoWidth: w, videoHeight: h } = el.video;
  const larguraPct = ((h * 9) / 16 / w) * 100;     // largura da faixa 9:16 em %
  const pos = Number(el.posicao.value) / 100;      // 0 = esquerda, 1 = direita
  el.moldura.style.width = `${larguraPct}%`;
  el.moldura.style.left = `${(100 - larguraPct) * pos}%`;
  el.moldura.hidden = false;
}

// =====================================================================
//  Etapa 3 — exportar
// =====================================================================

/**
 * Monta a "linha de comando" do FFmpeg para cada formato.
 * Dica: cada item do array é uma palavra que você digitaria no terminal.
 */
function montarArgumentos({ entrada, saida, inicio, duracao, formato, posicao, altura, legenda }) {
  // Filtro que "queima" a legenda na imagem (entra no fim da cadeia de filtros)
  const queimar = legenda ? `,ass=legenda.ass:fontsdir=${PASTA_FONTES}` : '';
  const corte = ['-ss', inicio.toFixed(3), '-i', entrada, '-t', duracao.toFixed(3)];

  if (formato === 'original') {
    // Só copia os dados, sem recodificar: quase instantâneo.
    // Limitação: o corte "gruda" no keyframe mais próximo (pode variar ~1-2s).
    return [...corte, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-avoid_negative_ts', 'make_zero', saida];
  }

  const L = altura === 720 ? 720 : 1080;  // largura de saída
  const A = altura === 720 ? 1280 : 1920; // altura de saída
  const codificacao = [
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart', // o vídeo começa a tocar antes de baixar inteiro
  ];

  if (formato === 'desfocado') {
    // Fundo: o próprio vídeo ampliado e borrado. Frente: o vídeo inteiro centralizado.
    // (o borrão é feito em tamanho pequeno e depois ampliado — bem mais rápido)
    const filtro = [
      '[0:v]split=2[a][b]',
      `[a]scale=${L / 4}:${A / 4}:force_original_aspect_ratio=increase,crop=${L / 4}:${A / 4},boxblur=8:2,scale=${L}:${A},setsar=1[fundo]`,
      `[b]scale=${L}:${A}:force_original_aspect_ratio=decrease,setsar=1[frente]`,
      `[fundo][frente]overlay=(W-w)/2:(H-h)/2${queimar}[v]`,
    ].join(';');
    return [...corte, '-filter_complex', filtro, '-map', '[v]', '-map', '0:a:0?', ...codificacao, saida];
  }

  // formato === 'vertical'
  let filtro;
  if (videoEhMaisLargoQueVertical()) {
    // Recorta uma faixa 9:16 (largura par, exigência do H.264) na posição escolhida
    const p = (posicao / 100).toFixed(3);
    filtro = `crop=trunc(ih*9/16/2)*2:ih:(iw-ow)*${p}:0,scale=${L}:${A},setsar=1`;
  } else {
    // Vídeo já é vertical (ou mais estreito): só ajusta o tamanho e completa com preto
    filtro = `scale=${L}:${A}:force_original_aspect_ratio=decrease,pad=${L}:${A}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
  }
  return [...corte, '-vf', filtro + queimar, '-map', '0:v:0', '-map', '0:a:0?', ...codificacao, saida];
}

/** Garante que o FFmpeg está carregado e que o vídeo atual está copiado dentro dele. */
const PASTA_ENTRADA = '/entrada';
async function prepararEntrada() {
  mostrarStatus(t('s.carregando'), 0);
  await carregarFFmpeg();
  if (estado.arquivoNoFFmpeg === estado.arquivo) return;

  mostrarStatus(t('s.lendo'), 0);
  const ext = (estado.arquivo.name.split('.').pop() || 'mp4').toLowerCase();

  // Tira o vídeo anterior
  if (estado.entradaMontada) await ffmpeg.unmount(PASTA_ENTRADA).catch(() => {});
  else if (estado.nomeEntrada) await ffmpeg.deleteFile(estado.nomeEntrada).catch(() => {});
  estado.entradaMontada = false;
  estado.arquivoNoFFmpeg = null;

  try {
    // "Montar" = o FFmpeg lê o arquivo direto do disco, aos poucos.
    // É o que permite vídeos longos: nada é copiado pra memória.
    await ffmpeg.createDir(PASTA_ENTRADA).catch(() => {}); // ignora "já existe"
    await ffmpeg.mount('WORKERFS', { blobs: [{ name: `video.${ext}`, data: estado.arquivo }] }, PASTA_ENTRADA);
    estado.nomeEntrada = `${PASTA_ENTRADA}/video.${ext}`;
    estado.entradaMontada = true;
  } catch (erro) {
    // Plano B (jeito antigo): copiar o vídeo inteiro pra memória
    console.warn('Não deu pra montar o arquivo; copiando pra memória.', erro);
    if (estado.arquivo.size > LIMITE_COPIA_BYTES) {
      throw new Error(t('e.grande'));
    }
    estado.nomeEntrada = `entrada.${ext}`;
    await ffmpeg.writeFile(estado.nomeEntrada, await fetchFile(estado.arquivo));
  }
  estado.arquivoNoFFmpeg = estado.arquivo;
}

// A fonte fica numa pasta só dela: o FFmpeg lê TUDO que estiver na pasta de fontes
const PASTA_FONTES = '/fontes';
async function prepararFonteLegenda() {
  if (estado.fonteNoFFmpeg) return;
  await ffmpeg.createDir(PASTA_FONTES).catch(() => {}); // ignora "já existe"
  await ffmpeg.writeFile(`${PASTA_FONTES}/Inter-ExtraBold.otf`, await fetchFile(urlFonteLegenda));
  estado.fonteNoFFmpeg = true;
}

el.btnExportar.addEventListener('click', exportar);

async function exportar() {
  if ((estado.ocupado && !estado.emLote) || !estado.arquivo) return false;

  const duracao = estado.fim - estado.inicio;
  if (duracao < 0.5) {
    alert(t('a.curto'));
    return;
  }

  const formato = formatoAtual();
  const extEntrada = (estado.arquivo.name.split('.').pop() || 'mp4').toLowerCase();
  // No modo "original" mantemos o container quando ele não cabe em .mp4 (ex.: webm)
  const extSaida = formato === 'original' && !['mp4', 'mov', 'm4v'].includes(extEntrada) ? extEntrada : 'mp4';
  const saida = `saida.${extSaida}`;

  definirOcupado(true);
  try {
    await prepararEntrada();

    // Legenda: escreve o arquivo .ass e a fonte dentro do FFmpeg
    const comLegenda = Boolean(estado.legenda) && formato !== 'original';
    const largura = Number(el.resolucao.value) === 720 ? 720 : 1080;
    if (comLegenda) {
      await prepararFonteLegenda();
      const ass = gerarASS(estado.legenda.blocos, { largura, altura: (largura * 16) / 9 });
      await ffmpeg.writeFile('legenda.ass', new TextEncoder().encode(ass));
    }

    const args = montarArgumentos({
      legenda: comLegenda,
      entrada: estado.nomeEntrada,
      saida,
      inicio: estado.inicio,
      duracao,
      formato,
      posicao: Number(el.posicao.value),
      altura: Number(el.resolucao.value),
    });
    console.info('ffmpeg', args.join(' '));

    mostrarStatus(t(formato === 'original' ? 's.cortando' : 's.processando'), 0);
    estado.duracaoExportando = duracao;
    estado.ultimosLogs = [];
    const inicioRelogio = performance.now();

    const codigo = await ffmpeg.exec(args);
    if (codigo !== 0) {
      const pista = estado.ultimosLogs.filter((l) => /error|invalid|failed/i.test(l)).slice(-2).join(' | ');
      throw new Error(t('e.ffmpeg', { c: codigo, p: pista }));
    }

    const dados = await ffmpeg.readFile(saida);
    await ffmpeg.deleteFile(saida);

    const mime = extSaida === 'mp4' ? 'video/mp4' : extSaida === 'webm' ? 'video/webm' : 'video/x-matroska';
    const blob = new Blob([dados.buffer], { type: mime });
    adicionarClipe(blob, { duracao, formato, ext: extSaida });

    const segundos = ((performance.now() - inicioRelogio) / 1000).toFixed(1);
    atualizarBarra(1);
    mostrarStatus(t('s.pronto', { s: segundos }));
    return true;
  } catch (erro) {
    console.error(erro);
    mostrarStatus(t('s.erro', { m: erro.message }));
    return false;
  } finally {
    estado.duracaoExportando = 0;
    definirOcupado(estado.emLote); // no lote, continua ocupado até a fila acabar
  }
}

function definirOcupado(ocupado) {
  estado.ocupado = ocupado;
  el.btnExportar.disabled = ocupado;
  el.btnTrocar.disabled = ocupado;
  el.btnLegenda.disabled = ocupado;
  el.btnLote.disabled = ocupado;
  el.duracaoClipe.disabled = ocupado;
  el.quantidadeClipes.disabled = ocupado;
  el.metodoMomentos.disabled = ocupado;
  el.btnAnalisar.disabled = ocupado;
  el.idiomaMomentos.disabled = ocupado;
  el.btnExportar.textContent = t(ocupado ? 'aguarde' : 'exportar');
}

function mostrarStatus(texto, progresso) {
  el.progresso.hidden = false;
  el.status.textContent = estado.prefixoStatus + texto;
  if (progresso !== undefined) atualizarBarra(progresso);
}

function atualizarBarra(fracao) {
  const pct = Math.max(0, Math.min(1, fracao)) * 100;
  el.barra.style.width = `${pct}%`;
}

// =====================================================================
//  Legenda automática
//  1) o FFmpeg extrai o áudio do trecho  2) o Whisper (num Web Worker)
//  transforma a fala em palavras com tempo  3) agrupamos em blocos
//  editáveis  4) na exportação, os blocos viram um arquivo .ass
// =====================================================================
let workerTranscricao = null;

/** Envia o áudio pro worker e devolve uma Promise com as palavras. */
function transcrever(audio, idioma) {
  if (!workerTranscricao) {
    workerTranscricao = new Worker(new URL('./transcricao.worker.js', import.meta.url), { type: 'module' });
  }
  const worker = workerTranscricao;
  return new Promise((resolver, rejeitar) => {
    worker.onmessage = ({ data }) => {
      if (data.tipo === 'progresso') {
        mostrarStatus(t(data.etapa === 'modelo' ? 's.baixandoIA' : 's.ouvindoTrecho'), data.fracao);
      } else if (data.tipo === 'pronto') {
        resolver(data.palavras);
      } else if (data.tipo === 'erro') {
        rejeitar(new Error(data.mensagem));
      }
    };
    worker.onerror = (e) => {
      workerTranscricao = null; // cria um worker novo na próxima tentativa
      rejeitar(new Error(e.message || t('e.iaLegenda')));
    };
    worker.postMessage({ tipo: 'transcrever', audio, idioma }, [audio.buffer]);
  });
}

el.btnLegenda.addEventListener('click', gerarLegenda);
el.btnRemoverLegenda.addEventListener('click', () => removerLegenda());

async function gerarLegenda() {
  if ((estado.ocupado && !estado.emLote) || !estado.arquivo) return false;
  const inicio = estado.inicio;
  const fim = estado.fim;
  if (fim - inicio < 0.5) {
    alert(t('a.curto'));
    return;
  }

  definirOcupado(true);
  try {
    await prepararEntrada();

    // Whisper quer áudio "cru": 16 kHz, mono, um número decimal por amostra
    mostrarStatus(t('s.extraindo'), 0);
    estado.ultimosLogs = [];
    const codigo = await ffmpeg.exec([
      '-ss', inicio.toFixed(3), '-i', estado.nomeEntrada, '-t', (fim - inicio).toFixed(3),
      '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-c:a', 'pcm_f32le', 'audio.pcm',
    ]);
    if (codigo !== 0) throw new Error(t('e.semAudio'));
    const bytes = await ffmpeg.readFile('audio.pcm');
    await ffmpeg.deleteFile('audio.pcm');
    const audio = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength - (bytes.byteLength % 4)));

    const palavras = await transcrever(audio, el.idioma.value);
    const blocos = agruparEmBlocos(palavras);
    if (!blocos.length) {
      removerLegenda();
      mostrarStatus(t('s.semFala'), 0);
      return;
    }

    estado.legenda = { blocos, inicioTrecho: inicio, fimTrecho: fim };
    desenharEditorLegenda();
    mostrarStatus(t('s.legendaPronta', { n: blocos.length }), 1);
  } catch (erro) {
    console.error(erro);
    mostrarStatus(t('s.erroLegenda', { m: erro.message }));
  } finally {
    definirOcupado(estado.emLote); // no lote, continua ocupado até a fila acabar
  }
}

function removerLegenda(aviso = '') {
  estado.legenda = null;
  el.editorLegenda.hidden = true;
  el.listaLegenda.replaceChildren();
  el.btnRemoverLegenda.hidden = true;
  el.btnLegenda.textContent = t('legenda.gerar');
  el.legendaPrevia.hidden = true;
  atualizarDicaLegenda(aviso);
}

function atualizarDicaLegenda(aviso = '') {
  if (aviso) el.dicaLegenda.textContent = aviso;
  else if (estado.legenda && formatoAtual() === 'original') {
    el.dicaLegenda.textContent = t('d.original');
  } else el.dicaLegenda.textContent = '';
}

const formatarTempo = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

/** Monta a lista de blocos editáveis (um campo de texto por bloco). */
function desenharEditorLegenda() {
  el.listaLegenda.replaceChildren();
  for (const bloco of estado.legenda.blocos) {
    const li = document.createElement('li');

    const tempo = document.createElement('button');
    tempo.type = 'button';
    tempo.className = 'tempo';
    tempo.title = t('t.irPonto');
    tempo.textContent = formatarTempo(bloco.inicio);
    tempo.addEventListener('click', () => {
      el.video.currentTime = estado.legenda.inicioTrecho + bloco.inicio;
    });

    const campo = document.createElement('input');
    campo.type = 'text';
    campo.value = textoDoBloco(bloco);
    campo.setAttribute('aria-label', t('t.legendaEm', { t: formatarTempo(bloco.inicio) }));
    campo.addEventListener('change', () => {
      aplicarTextoAoBloco(bloco, campo.value); // texto vazio = bloco some do vídeo
      atualizarPreviaLegenda();
    });

    li.append(tempo, campo);
    el.listaLegenda.append(li);
  }
  el.editorLegenda.hidden = false;
  el.btnRemoverLegenda.hidden = false;
  el.btnLegenda.textContent = t('legenda.denovo');
  atualizarDicaLegenda();
  atualizarPreviaLegenda();
}

/** Mostra, por cima do player, o bloco de legenda do instante atual (prévia aproximada). */
function atualizarPreviaLegenda() {
  const l = estado.legenda;
  const t = l ? el.video.currentTime - l.inicioTrecho : -1;
  const bloco = l && formatoAtual() !== 'original'
    ? l.blocos.find((b) => t >= b.inicio && t < b.fim && b.palavras.length)
    : null;
  if (!bloco) {
    el.legendaPrevia.hidden = true;
    return;
  }
  // Largura do clipe vertical dentro do player, pra letra ficar proporcional
  const recorte = !el.moldura.hidden;
  const larguraClipe = recorte ? el.moldura.offsetWidth : (el.videoWrap.clientHeight * 9) / 16;
  const centro = recorte ? el.moldura.offsetLeft + el.moldura.offsetWidth / 2 : el.videoWrap.clientWidth / 2;
  el.legendaPrevia.style.left = `${centro}px`;
  el.legendaPrevia.style.width = `${larguraClipe * 0.9}px`;
  el.legendaPrevia.style.fontSize = `${Math.max(9, larguraClipe * 0.085)}px`;
  el.legendaPrevia.textContent = textoDoBloco(bloco).toUpperCase();
  el.legendaPrevia.hidden = false;
}
el.video.addEventListener('timeupdate', atualizarPreviaLegenda);
el.video.addEventListener('seeked', atualizarPreviaLegenda);
el.posicao.addEventListener('input', atualizarPreviaLegenda);

// =====================================================================
//  Modo "vídeo longo": achar momentos, cortar e legendar em fila
// =====================================================================
const relogio = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function analisarMomentos() {
  if (estado.ocupado || !estado.arquivo) return;
  definirOcupado(true);
  try {
    // O áudio é extraído uma vez só; trocar duração/quantidade reaproveita
    if (!estado.audioAnalise) {
      await prepararEntrada();
      mostrarStatus(t('s.ouvindoTudo'), 0);
      estado.duracaoExportando = el.video.duration;
      const codigo = await ffmpeg.exec([
        '-i', estado.nomeEntrada, '-vn', '-ac', '1', '-ar', String(TAXA_ANALISE),
        '-f', 's16le', '-c:a', 'pcm_s16le', 'analise.pcm',
      ]);
      if (codigo !== 0) throw new Error(t('e.semAudio'));
      const bytes = await ffmpeg.readFile('analise.pcm');
      await ffmpeg.deleteFile('analise.pcm');
      const fim = bytes.byteOffset + bytes.byteLength - (bytes.byteLength % 2);
      estado.audioAnalise = new Int16Array(bytes.buffer.slice(bytes.byteOffset, fim));
    }

    const opcoes = {
      duracaoClipe: Number(el.duracaoClipe.value),
      quantidade: Number(el.quantidadeClipes.value),
    };

    // Com IA: o Gemini escolhe pelo conteúdo. Se não der, cai pro método do som.
    let momentos = null;
    let aviso = '';
    if (el.metodoMomentos.value === 'ia') {
      const chave = el.chaveGemini.value.trim();
      if (!chave) {
        aviso = t('av.semChave');
      } else {
        try {
          momentos = await momentosPorIA(chave, opcoes);
          if (!momentos.length) aviso = t('av.iaNada');
        } catch (erro) {
          console.error(erro);
          aviso = t('av.iaFalhou', { m: erro.message });
        }
      }
    }
    if (!momentos || !momentos.length) momentos = encontrarMomentos(estado.audioAnalise, TAXA_ANALISE, opcoes);

    estado.momentoAtivo = null;
    estado.momentos = momentos.map((m) => ({ ...m, marcado: true }));
    desenharMomentos();

    if (estado.momentos.length) {
      selecionarMomento(0);
      mostrarStatus(aviso || t('s.encontrei', { n: estado.momentos.length }), 1);
    } else {
      mostrarStatus(t('s.nada'), 0);
    }
  } catch (erro) {
    console.error(erro);
    mostrarStatus(t('s.erroAnalise', { m: erro.message }));
  } finally {
    estado.duracaoExportando = 0;
    definirOcupado(false);
  }
}

/** Comprime o áudio, manda pro Gemini e dá acabamento nos tempos que ele devolver. */
async function momentosPorIA(chave, opcoes) {
  if (!estado.audioIA) {
    mostrarStatus(t('s.preparandoIA'), 0);
    estado.duracaoExportando = el.video.duration;
    // Voz em baixa qualidade: 1 hora de vídeo vira ~11 MB
    const codigo = await ffmpeg.exec([
      '-i', estado.nomeEntrada, '-vn', '-ac', '1', '-ar', '16000',
      '-c:a', 'aac', '-b:a', '24k', '-f', 'adts', 'ia.aac',
    ]);
    if (codigo !== 0) throw new Error(t('e.comprimir'));
    const bytes = await ffmpeg.readFile('ia.aac');
    await ffmpeg.deleteFile('ia.aac');
    if (bytes.byteLength > LIMITE_AUDIO_IA_BYTES) throw new Error(t('e.longoIA'));
    estado.audioIA = await paraBase64(bytes);
  }

  mostrarStatus(t('s.iaOuvindo'), 0.5);
  const momentos = await encontrarMomentosComIA({
    chave,
    audioBase64: estado.audioIA,
    duracaoTotal: el.video.duration,
    idioma: el.idioma.value,
    ...opcoes,
  });
  // A IA erra o tempo por 1 ou 2 segundos: encosta as pontas no silêncio mais próximo
  const ajustar = criarAjustador(estado.audioAnalise, TAXA_ANALISE);
  return momentos.map((m) => ({ ...m, ...ajustar(m.inicio, m.fim) }));
}

/** Bytes → texto base64 (o formato em que arquivos viajam dentro de um JSON). */
function paraBase64(bytes) {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result).split(',')[1]);
    leitor.onerror = () => rejeitar(new Error(t('e.prepararAudio')));
    leitor.readAsDataURL(new Blob([bytes]));
  });
}

// A chave fica guardada só neste navegador (localStorage). Ela nunca entra no código.
function lerChaveGuardada() {
  try { return localStorage.getItem(CHAVE_GUARDADA) || ''; } catch { return ''; }
}
el.chaveGemini.value = lerChaveGuardada();
el.metodoMomentos.value = el.chaveGemini.value ? 'ia' : 'som';
el.linhaChave.hidden = el.metodoMomentos.value !== 'ia';

el.chaveGemini.addEventListener('change', () => {
  const chave = el.chaveGemini.value.trim();
  try {
    if (chave) localStorage.setItem(CHAVE_GUARDADA, chave);
    else localStorage.removeItem(CHAVE_GUARDADA);
  } catch { /* navegador sem localStorage: a chave vale só até fechar a aba */ }
});
el.metodoMomentos.addEventListener('change', () => {
  el.linhaChave.hidden = el.metodoMomentos.value !== 'ia';
});

// O idioma falado aparece em dois lugares (painel de momentos e legenda): mantém os dois iguais
el.idiomaMomentos.addEventListener('change', () => { el.idioma.value = el.idiomaMomentos.value; });
el.idioma.addEventListener('change', () => { el.idiomaMomentos.value = el.idioma.value; });

/** Abre um momento no editor: o trecho passa a ser o dele. */
function selecionarMomento(indice) {
  const momento = estado.momentos[indice];
  if (!momento) return;
  estado.momentoAtivo = null; // evita que sincronizarTempos mexa no momento anterior
  estado.inicio = momento.inicio;
  estado.fim = momento.fim;
  sincronizarTempos();
  estado.momentoAtivo = indice;
  el.video.currentTime = momento.inicio;
  desenharMomentos();
}

function desenharMomentos() {
  el.listaMomentos.replaceChildren();
  estado.momentos.forEach((momento, i) => {
    const li = document.createElement('li');
    if (i === estado.momentoAtivo) li.className = 'ativo';

    const marca = document.createElement('input');
    marca.type = 'checkbox';
    marca.checked = momento.marcado;
    marca.setAttribute('aria-label', t('t.incluir', { n: i + 1 }));
    marca.addEventListener('change', () => {
      momento.marcado = marca.checked;
      atualizarBotaoLote();
    });

    const faixa = document.createElement('button');
    faixa.type = 'button';
    faixa.className = 'faixa';
    faixa.title = t('t.abrirMomento');
    faixa.textContent = `${relogio(momento.inicio)} – ${relogio(momento.fim)}`;
    faixa.addEventListener('click', () => { if (!estado.ocupado) selecionarMomento(i); });

    const duracao = document.createElement('span');
    duracao.className = 'duracao';
    duracao.textContent = `${Math.round(momento.fim - momento.inicio)}s`;

    const forca = document.createElement('div');
    forca.className = 'forca';
    forca.title = t(momento.titulo ? 't.notaIA' : 't.forcaSom');
    forca.innerHTML = '<div></div>';
    forca.firstChild.style.width = `${Math.round(momento.forca * 100)}%`;

    const titulo = document.createElement('span');
    titulo.className = 'titulo';
    titulo.textContent = momento.titulo || '';   // só os momentos da IA têm título
    titulo.title = momento.motivo || '';

    li.append(marca, faixa, duracao, titulo, forca);
    el.listaMomentos.append(li);
  });
  atualizarBotaoLote();
}

function atualizarBotaoLote() {
  const marcados = estado.momentos.filter((m) => m.marcado).length;
  const temMomentos = estado.momentos.length > 0;
  el.btnLote.textContent = marcados === 1 ? t('mom.gerar1') : t('mom.gerarN', { n: marcados });
  el.btnLote.hidden = !temMomentos;          // só aparece depois da busca
  el.dicaMomentos.hidden = temMomentos;
  // Antes da busca, "Encontrar momentos" é a ação principal; depois, vira secundária
  el.btnAnalisar.textContent = t(temMomentos ? 'mom.denovo' : 'mom.encontrar');
  el.btnAnalisar.classList.toggle('primario', !temMomentos);
}

/** Processa a fila: pra cada momento marcado, legenda (se pedido) e exporta. */
async function gerarLote() {
  if (estado.ocupado) return;
  const fila = estado.momentos.map((_, i) => i).filter((i) => estado.momentos[i].marcado);
  if (!fila.length) {
    alert(t('a.marque'));
    return;
  }

  estado.emLote = true;
  definirOcupado(true);
  let prontos = 0;
  try {
    for (const [posicao, indice] of fila.entries()) {
      estado.prefixoStatus = t('s.lote', { a: posicao + 1, b: fila.length });
      selecionarMomento(indice);
      if (el.legendarLote.checked && formatoAtual() !== 'original') await gerarLegenda();
      if (await exportar()) prontos += 1; // se um clipe falhar, a fila continua
    }
  } finally {
    estado.emLote = false;
    estado.prefixoStatus = '';
    definirOcupado(false);
  }
  mostrarStatus(t('s.loteFim', { a: prontos, b: fila.length }), 1);
}

el.btnLote.addEventListener('click', gerarLote);
el.btnAnalisar.addEventListener('click', analisarMomentos); // a busca só roda com este clique

// =====================================================================
//  Lista de clipes exportados
// =====================================================================
const NOMES_FORMATO = { vertical: 'vertical', desfocado: 'desfocado', original: 'original' };

function adicionarClipe(blob, { duracao, formato, ext }) {
  estado.contadorClipes += 1;
  const numero = String(estado.contadorClipes).padStart(2, '0');
  const base = estado.arquivo.name.replace(/\.[^.]+$/, '').slice(0, 40);
  const nomeArquivo = `${base}_clipe${numero}_${NOMES_FORMATO[formato]}.${ext}`;
  const url = URL.createObjectURL(blob);
  const mb = (blob.size / 1024 / 1024).toFixed(1);

  const li = document.createElement('li');
  li.innerHTML = `
    <video src="${url}" controls playsinline preload="metadata"></video>
    <div class="info">#${numero} · ${duracao.toFixed(1)}s · ${NOMES_FORMATO[formato]} · ${mb} MB</div>
    <div class="acoes">
      <a class="baixar" data-i18n="baixar"></a>
      <button type="button" class="remover" data-i18n-title="remover">✕</button>
    </div>`;

  aplicarTraducoes(li);
  const link = li.querySelector('a.baixar');
  link.href = url;
  link.download = nomeArquivo; // atribuído via JS pra não quebrar com nomes estranhos

  li.querySelector('.remover').addEventListener('click', () => {
    URL.revokeObjectURL(url); // libera a memória do clipe
    li.remove();
    if (!el.listaClipes.children.length) el.etapaClipes.hidden = true;
  });

  el.listaClipes.prepend(li); // mais recente primeiro
  el.etapaClipes.hidden = false;
}

// =====================================================================
//  Idioma da interface (botões PT / EN / ES no canto superior direito)
// =====================================================================

/** Refaz os textos que são montados pelo JavaScript (os do HTML o i18n.js já troca). */
function atualizarTextosDinamicos() {
  sincronizarTempos();                       // "Duração: 9.0s"
  desenharMomentos();                        // lista de momentos e botões do painel
  definirOcupado(estado.ocupado);            // "Exportar clipe" / "Aguarde…"
  el.btnLegenda.textContent = t(estado.legenda ? 'legenda.denovo' : 'legenda.gerar');
  atualizarDicaLegenda();
  atualizarBotaoTema();
}

// ---------- Tema claro / escuro ----------
// O tema é só um atributo no <html>: data-tema="claro". O CSS faz o resto.
const TEMA_GUARDADO = 'clipador.tema';
const temaClaro = () => document.documentElement.dataset.tema === 'claro';

function atualizarBotaoTema() {
  const rotulo = t(temaClaro() ? 'tema.paraEscuro' : 'tema.paraClaro');
  el.btnTema.title = rotulo;
  el.btnTema.setAttribute('aria-label', rotulo);
}

el.btnTema.addEventListener('click', () => {
  const novo = temaClaro() ? 'escuro' : 'claro';
  if (novo === 'claro') document.documentElement.dataset.tema = 'claro';
  else delete document.documentElement.dataset.tema;
  try { localStorage.setItem(TEMA_GUARDADO, novo); } catch { /* sem localStorage */ }
  atualizarBotaoTema();
});

document.querySelectorAll('input[name="interface"]').forEach((opcao) => {
  opcao.checked = opcao.value === idiomaAtual();
  opcao.addEventListener('change', () => definirIdioma(opcao.value));
});
aoTrocarIdioma(atualizarTextosDinamicos);

// Primeira pintura da tela no idioma certo
aplicarTraducoes();
atualizarTextosDinamicos();
