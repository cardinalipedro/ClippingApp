// =====================================================================
//  interface/painel-legenda.js — botão "Gerar legenda", lista de blocos
//  editáveis e a prévia da legenda por cima do player.
// =====================================================================

import { el, formatoAtual } from './dom.js';
import { t, aoTrocarIdioma } from './i18n.js';
import { ao } from './eventos.js';
import { relator, mostrarStatus, mensagemDoErro, definirOcupado, avisar } from './status.js';
import { estado } from '../aplicacao/estado.js';
import { validarDuracao, mesmoTrecho } from '../dominio/trecho.js';
import { aplicarTextoAoBloco, textoDoBloco } from '../dominio/legenda.js';

let casos; // casos de uso, recebidos do main.js

const formatarTempo = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

/** Gera a legenda do trecho atual. Devolve true se deu certo. */
export async function legendar() {
  if ((estado.ocupado && !estado.emLote) || !estado.arquivo) return false;
  try {
    validarDuracao(estado.trecho);
  } catch (erro) {
    avisar(erro);
    return false;
  }

  definirOcupado(true);
  try {
    const legenda = await casos.gerarLegenda(
      { arquivo: estado.arquivo, trecho: { ...estado.trecho }, idioma: el.idioma.value },
      relator,
    );
    if (!legenda) {
      removerLegenda();
      mostrarStatus(t('s.semFala'), 0);
      return false;
    }
    estado.legenda = legenda;
    desenharEditor();
    mostrarStatus(t('s.legendaPronta', { n: legenda.blocos.length }), 1);
    return true;
  } catch (erro) {
    console.error(erro);
    mostrarStatus(t('s.erroLegenda', { m: mensagemDoErro(erro) }));
    return false;
  } finally {
    definirOcupado(estado.emLote); // no lote, continua ocupado até a fila acabar
  }
}

export function removerLegenda(aviso = '') {
  estado.legenda = null;
  el.editorLegenda.hidden = true;
  el.listaLegenda.replaceChildren();
  el.btnRemoverLegenda.hidden = true;
  el.btnLegenda.textContent = t('legenda.gerar');
  el.legendaPrevia.hidden = true;
  mostrarDica(aviso);
}

/** Texto pequeno embaixo da legenda (avisos). */
export function mostrarDica(aviso = '') {
  if (aviso) el.dicaLegenda.textContent = aviso;
  else if (estado.legenda && formatoAtual() === 'original') el.dicaLegenda.textContent = t('d.original');
  else el.dicaLegenda.textContent = '';
}

/** Monta a lista de blocos editáveis (um campo de texto por bloco). */
function desenharEditor() {
  el.listaLegenda.replaceChildren();
  for (const bloco of estado.legenda.blocos) {
    const li = document.createElement('li');

    const tempo = document.createElement('button');
    tempo.type = 'button';
    tempo.className = 'tempo';
    tempo.title = t('t.irPonto');
    tempo.textContent = formatarTempo(bloco.inicio);
    tempo.addEventListener('click', () => {
      el.video.currentTime = estado.legenda.trecho.inicio + bloco.inicio;
    });

    const campo = document.createElement('input');
    campo.type = 'text';
    campo.value = textoDoBloco(bloco);
    campo.setAttribute('aria-label', t('t.legendaEm', { t: formatarTempo(bloco.inicio) }));
    campo.addEventListener('change', () => {
      aplicarTextoAoBloco(bloco, campo.value); // texto vazio = bloco some do vídeo
      atualizarPrevia();
    });

    li.append(tempo, campo);
    el.listaLegenda.append(li);
  }
  el.editorLegenda.hidden = false;
  el.btnRemoverLegenda.hidden = false;
  el.btnLegenda.textContent = t('legenda.denovo');
  mostrarDica();
  atualizarPrevia();
}

/** Mostra, por cima do player, o bloco de legenda do instante atual (prévia aproximada). */
function atualizarPrevia() {
  const l = estado.legenda;
  const agora = l ? el.video.currentTime - l.trecho.inicio : -1;
  const bloco = l && formatoAtual() !== 'original'
    ? l.blocos.find((b) => agora >= b.inicio && agora < b.fim && b.palavras.length)
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

export function iniciarPainelLegenda(casosDeUso) {
  casos = casosDeUso;
  el.btnLegenda.addEventListener('click', legendar);
  el.btnRemoverLegenda.addEventListener('click', () => removerLegenda());
  el.video.addEventListener('timeupdate', atualizarPrevia);
  el.video.addEventListener('seeked', atualizarPrevia);

  // A legenda é feita pra um trecho específico: se o trecho mudou, ela não serve mais
  ao('trecho', (trecho) => {
    if (estado.legenda && !mesmoTrecho(estado.legenda.trecho, trecho)) removerLegenda(t('d.trechoMudou'));
  });
  ao('formato', () => {
    mostrarDica();
    atualizarPrevia();
  });
  aoTrocarIdioma(() => {
    el.btnLegenda.textContent = t(estado.legenda ? 'legenda.denovo' : 'legenda.gerar');
    mostrarDica();
  });
}
