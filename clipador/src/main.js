// =====================================================================
//  Clipador — main.js
//  Fluxo: escolher vídeo → marcar início/fim → escolher formato → exportar
//  O processamento é feito pelo FFmpeg compilado para WebAssembly,
//  rodando dentro do navegador do usuário (sem servidor).
// =====================================================================

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Onde baixar o "núcleo" do FFmpeg (~30 MB, baixado só na 1ª exportação)
const CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
const DURACAO_PADRAO = 30;            // segundos sugeridos ao abrir um vídeo
const LIMITE_AVISO_BYTES = 1.5e9;     // acima disso o navegador pode ficar sem memória

// ---------- Atalho para pegar elementos do HTML ----------
const $ = (id) => document.getElementById(id);
const el = {
  etapaUpload: $('etapaUpload'),
  etapaEditor: $('etapaEditor'),
  etapaClipes: $('etapaClipes'),
  dropzone: $('dropzone'),
  arquivo: $('arquivo'),
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
el.arquivo.addEventListener('change', () => abrirArquivo(el.arquivo.files[0]));

el.dropzone.addEventListener('dragover', (e) => {
  e.preventDefault(); // sem isso o navegador abre o arquivo numa aba nova
  el.dropzone.classList.add('arrastando');
});
el.dropzone.addEventListener('dragleave', () => el.dropzone.classList.remove('arrastando'));
el.dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  el.dropzone.classList.remove('arrastando');
  abrirArquivo(e.dataTransfer.files[0]);
});

function abrirArquivo(arquivo) {
  if (!arquivo) return;
  const ehVideo = arquivo.type.startsWith('video/') || /\.(mp4|mov|m4v|mkv|webm)$/i.test(arquivo.name);
  if (!ehVideo) {
    alert('Esse arquivo não parece ser um vídeo.');
    return;
  }
  if (arquivo.size > LIMITE_AVISO_BYTES) {
    alert('Vídeo muito grande (mais de 1,5 GB). A exportação pode falhar por falta de memória — se acontecer, corte o vídeo em partes menores antes.');
  }

  if (estado.urlVideo) URL.revokeObjectURL(estado.urlVideo); // libera o vídeo anterior
  estado.arquivo = arquivo;
  estado.urlVideo = URL.createObjectURL(arquivo);
  el.video.src = estado.urlVideo;
  el.arquivo.value = ''; // permite escolher o mesmo arquivo de novo depois
}

// Quando o navegador termina de ler as informações do vídeo (duração, tamanho)
el.video.addEventListener('loadedmetadata', () => {
  estado.inicio = 0;
  estado.fim = Math.min(el.video.duration, DURACAO_PADRAO);
  sincronizarTempos();
  atualizarFormato();
  mostrarEtapa('editor');
});

el.video.addEventListener('error', () => {
  alert('O navegador não conseguiu abrir esse vídeo. Tente um .mp4 (H.264), que é o formato mais compatível.');
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
    alert('O fim precisa vir depois do início.');
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
  el.duracao.textContent = `Duração: ${(estado.fim - estado.inicio).toFixed(1)}s`;
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
function montarArgumentos({ entrada, saida, inicio, duracao, formato, posicao, altura }) {
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
      '[fundo][frente]overlay=(W-w)/2:(H-h)/2[v]',
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
  return [...corte, '-vf', filtro, '-map', '0:v:0', '-map', '0:a:0?', ...codificacao, saida];
}

el.btnExportar.addEventListener('click', exportar);

async function exportar() {
  if (estado.ocupado || !estado.arquivo) return;

  const duracao = estado.fim - estado.inicio;
  if (duracao < 0.5) {
    alert('O trecho precisa ter pelo menos meio segundo.');
    return;
  }

  const formato = formatoAtual();
  const extEntrada = (estado.arquivo.name.split('.').pop() || 'mp4').toLowerCase();
  // No modo "original" mantemos o container quando ele não cabe em .mp4 (ex.: webm)
  const extSaida = formato === 'original' && !['mp4', 'mov', 'm4v'].includes(extEntrada) ? extEntrada : 'mp4';
  const saida = `saida.${extSaida}`;

  definirOcupado(true);
  try {
    mostrarStatus('Carregando o motor de vídeo (só demora na primeira vez)…', 0);
    await carregarFFmpeg();

    // Copia o vídeo pra dentro do FFmpeg só se ainda não estiver lá
    if (estado.arquivoNoFFmpeg !== estado.arquivo) {
      mostrarStatus('Lendo o vídeo…', 0);
      if (estado.nomeEntrada) await ffmpeg.deleteFile(estado.nomeEntrada).catch(() => {});
      estado.nomeEntrada = `entrada.${extEntrada}`;
      await ffmpeg.writeFile(estado.nomeEntrada, await fetchFile(estado.arquivo));
      estado.arquivoNoFFmpeg = estado.arquivo;
    }

    const args = montarArgumentos({
      entrada: estado.nomeEntrada,
      saida,
      inicio: estado.inicio,
      duracao,
      formato,
      posicao: Number(el.posicao.value),
      altura: Number(el.resolucao.value),
    });
    console.info('ffmpeg', args.join(' '));

    mostrarStatus(formato === 'original' ? 'Cortando…' : 'Processando (pode levar alguns minutos)…', 0);
    estado.duracaoExportando = duracao;
    estado.ultimosLogs = [];
    const inicioRelogio = performance.now();

    const codigo = await ffmpeg.exec(args);
    if (codigo !== 0) {
      const pista = estado.ultimosLogs.filter((l) => /error|invalid|failed/i.test(l)).slice(-2).join(' | ');
      throw new Error(`o FFmpeg falhou (código ${codigo}). ${pista}`);
    }

    const dados = await ffmpeg.readFile(saida);
    await ffmpeg.deleteFile(saida);

    const mime = extSaida === 'mp4' ? 'video/mp4' : extSaida === 'webm' ? 'video/webm' : 'video/x-matroska';
    const blob = new Blob([dados.buffer], { type: mime });
    adicionarClipe(blob, { duracao, formato, ext: extSaida });

    const segundos = ((performance.now() - inicioRelogio) / 1000).toFixed(1);
    atualizarBarra(1);
    mostrarStatus(`Pronto! Exportado em ${segundos}s.`);
  } catch (erro) {
    console.error(erro);
    mostrarStatus(`Erro: ${erro.message}`);
  } finally {
    estado.duracaoExportando = 0;
    definirOcupado(false);
  }
}

function definirOcupado(ocupado) {
  estado.ocupado = ocupado;
  el.btnExportar.disabled = ocupado;
  el.btnTrocar.disabled = ocupado;
  el.btnExportar.textContent = ocupado ? 'Exportando…' : 'Exportar clipe';
}

function mostrarStatus(texto, progresso) {
  el.progresso.hidden = false;
  el.status.textContent = texto;
  if (progresso !== undefined) atualizarBarra(progresso);
}

function atualizarBarra(fracao) {
  const pct = Math.max(0, Math.min(1, fracao)) * 100;
  el.barra.style.width = `${pct}%`;
}

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
      <a class="baixar">Baixar</a>
      <button type="button" class="remover" title="Remover">✕</button>
    </div>`;

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
