// =====================================================================
//  interface/upload.js — tela inicial: escolher ou arrastar o vídeo.
// =====================================================================

import { el } from './dom.js';
import { t } from './i18n.js';
import { esconderStatus } from './status.js';
import { mostrarEtapa, atualizarModoAtual } from './navegacao.js';
import { definirTrecho, atualizarFormato } from './editor-trecho.js';
import { legendar, removerLegenda, mostrarDica } from './painel-legenda.js';
import { limparMomentos } from './painel-momentos.js';
import { estado, comecarNovoVideo } from '../aplicacao/estado.js';
import { trechoInicial } from '../dominio/trecho.js';
import { ehVideo } from '../dominio/clipe.js';

let urlVideo = null; // URL temporária usada no <video>

function abrirArquivo(arquivo, modo) {
  if (!arquivo) return;
  if (!ehVideo(arquivo.name, arquivo.type)) {
    alert(t('a.naoVideo'));
    return;
  }

  if (urlVideo) URL.revokeObjectURL(urlVideo); // libera o vídeo anterior
  comecarNovoVideo(arquivo, modo);
  atualizarModoAtual();
  removerLegenda(); // legenda e momentos do vídeo anterior não valem pro novo
  limparMomentos();
  esconderStatus();
  urlVideo = URL.createObjectURL(arquivo);
  el.video.src = urlVideo;
}

/** Quando o navegador termina de ler a duração e o tamanho do vídeo. */
function aoCarregarVideo() {
  const curto = estado.modo === 'curto';
  const { trecho, legendarSozinho } = trechoInicial(el.video.duration, estado.modo);

  el.idioma.value = el.idiomaInicial.value;
  el.idiomaMomentos.value = el.idiomaInicial.value;
  el.painelMomentos.hidden = curto;
  mostrarEtapa('editor');
  definirTrecho(trecho);
  atualizarFormato();

  // Clipe curto: já legenda. Vídeo longo: espera o clique em "Encontrar momentos".
  if (legendarSozinho) legendar();
  else if (curto) mostrarDica(t('d.longoDemais'));
}

export function iniciarUpload() {
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

  el.video.addEventListener('loadedmetadata', aoCarregarVideo);
  el.video.addEventListener('error', () => alert(t('a.naoAbre')));
}
