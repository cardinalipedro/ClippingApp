// =====================================================================
//  interface/editor-trecho.js — player, marcação de início/fim,
//  formato e o retângulo do enquadramento vertical.
//
//  As regras (o que acontece ao marcar, limites) vêm de dominio/trecho.js.
//  Aqui só se lê a tela, chama a regra e desenha o resultado.
// =====================================================================

import { el, formatoAtual } from './dom.js';
import { t, aoTrocarIdioma } from './i18n.js';
import { emitir } from './eventos.js';
import { avisar } from './status.js';
import { estado } from '../aplicacao/estado.js';
import * as regras from '../dominio/trecho.js';
import { ehMaisLargoQueVertical, faixaVertical } from '../dominio/enquadramento.js';

let tocandoTrecho = false; // true enquanto o botão "Ver trecho" estiver tocando

/** Único jeito de mudar o trecho: atualiza o estado, redesenha e avisa quem se interessa. */
export function definirTrecho(novo) {
  estado.trecho = novo;
  desenharTrecho();
  emitir('trecho', novo);
}

function desenharTrecho() {
  const { inicio, fim } = estado.trecho;
  el.inicio.value = inicio.toFixed(1);
  el.fim.value = fim.toFixed(1);
  el.inicio.max = el.fim.max = el.video.duration || 0;
  el.duracao.textContent = t('duracao', { s: (fim - inicio).toFixed(1) });
}

export function videoMaisLargo() {
  return ehMaisLargoQueVertical(el.video.videoWidth, el.video.videoHeight);
}

export function atualizarFormato() {
  const formato = formatoAtual();
  el.linhaPosicao.hidden = formato !== 'vertical' || !videoMaisLargo();
  el.linhaResolucao.hidden = formato === 'original';
  atualizarMoldura();
  emitir('formato', formato);
}

/** Desenha o retângulo mostrando o que vai entrar no clipe vertical. */
function atualizarMoldura() {
  if (formatoAtual() !== 'vertical' || !videoMaisLargo()) {
    el.moldura.hidden = true;
    return;
  }
  const { larguraPct, esquerdaPct } = faixaVertical(el.video.videoWidth, el.video.videoHeight, Number(el.posicao.value));
  el.moldura.style.width = `${larguraPct}%`;
  el.moldura.style.left = `${esquerdaPct}%`;
  el.moldura.hidden = false;
}

function marcarInicio() {
  definirTrecho(regras.marcarInicio(estado.trecho, el.video.currentTime, el.video.duration));
}

function marcarFim() {
  try {
    definirTrecho(regras.marcarFim(estado.trecho, el.video.currentTime));
  } catch (erro) {
    avisar(erro);
  }
}

function verTrecho() {
  el.video.currentTime = estado.trecho.inicio;
  tocandoTrecho = true;
  el.video.play();
}

export function iniciarEditorTrecho() {
  el.btnInicio.addEventListener('click', marcarInicio);
  el.btnFim.addEventListener('click', marcarFim);
  el.btnOuvir.addEventListener('click', verTrecho);

  // Para o vídeo automaticamente quando o "Ver trecho" chega no fim
  el.video.addEventListener('timeupdate', () => {
    if (tocandoTrecho && el.video.currentTime >= estado.trecho.fim) {
      el.video.pause();
      tocandoTrecho = false;
    }
  });
  el.video.addEventListener('pause', () => { tocandoTrecho = false; });

  // Digitação manual nos campos de tempo
  el.inicio.addEventListener('change', () => {
    definirTrecho(regras.digitarInicio(estado.trecho, el.inicio.value, el.video.duration));
  });
  el.fim.addEventListener('change', () => {
    definirTrecho(regras.digitarFim(estado.trecho, el.fim.value, el.video.duration));
  });

  // Atalhos de teclado: I = início, O = fim, P = ver trecho
  document.addEventListener('keydown', (e) => {
    if (el.etapaEditor.hidden) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return; // está digitando
    const tecla = e.key.toLowerCase();
    if (tecla === 'i') marcarInicio();
    else if (tecla === 'o') marcarFim();
    else if (tecla === 'p') verTrecho();
  });

  document.querySelectorAll('input[name="formato"]').forEach((radio) => {
    radio.addEventListener('change', atualizarFormato);
  });
  el.posicao.addEventListener('input', () => {
    atualizarMoldura();
    emitir('formato', formatoAtual());
  });

  aoTrocarIdioma(desenharTrecho); // "Duração: 9.0s" muda de idioma
}
