// =====================================================================
//  interface/painel-momentos.js — modo "vídeo longo": opções da busca,
//  lista de momentos e o botão "Gerar clipes".
// =====================================================================

import { el, formatoAtual } from './dom.js';
import { t, aoTrocarIdioma } from './i18n.js';
import { ao } from './eventos.js';
import { relator, mostrarStatus, mensagemDoErro, definirOcupado, definirPrefixo } from './status.js';
import { definirTrecho } from './editor-trecho.js';
import { legendar } from './painel-legenda.js';
import { exportar } from './exportacao.js';
import { estado } from '../aplicacao/estado.js';

let casos;          // casos de uso, recebidos do main.js
let chaveGuardada;  // onde a chave do Gemini fica salva ({ ler, gravar }, vem do main.js)

const relogio = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function analisar() {
  if (estado.ocupado || !estado.arquivo) return;
  definirOcupado(true);
  try {
    const { momentos, aviso } = await casos.encontrarMomentos({
      arquivo: estado.arquivo,
      duracaoVideo: el.video.duration,
      metodo: el.metodoMomentos.value,
      chave: el.chaveGemini.value.trim(),
      idioma: el.idioma.value,
      duracaoClipe: Number(el.duracaoClipe.value),
      quantidade: Number(el.quantidadeClipes.value),
      cache: estado.cache,
    }, relator);

    estado.momentoAtivo = null;
    estado.momentos = momentos.map((m) => ({ ...m, marcado: true }));
    desenhar();

    if (estado.momentos.length) {
      selecionarMomento(0);
      const textoAviso = aviso && t(aviso.chave, { m: aviso.erro ? mensagemDoErro(aviso.erro) : '' });
      mostrarStatus(textoAviso || t('s.encontrei', { n: estado.momentos.length }), 1);
    } else {
      mostrarStatus(t('s.nada'), 0);
    }
  } catch (erro) {
    console.error(erro);
    mostrarStatus(t('s.erroAnalise', { m: mensagemDoErro(erro) }));
  } finally {
    definirOcupado(false);
  }
}

/** Abre um momento no editor: o trecho passa a ser o dele. */
function selecionarMomento(indice) {
  const momento = estado.momentos[indice];
  if (!momento) return;
  estado.momentoAtivo = null; // evita que o aviso de 'trecho' mexa no momento anterior
  definirTrecho({ inicio: momento.inicio, fim: momento.fim });
  estado.momentoAtivo = indice;
  el.video.currentTime = momento.inicio;
  desenhar();
}

export function limparMomentos() {
  estado.momentos = [];
  estado.momentoAtivo = null;
  desenhar();
}

function desenhar() {
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
      atualizarBotoes();
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
  atualizarBotoes();
}

function atualizarBotoes() {
  const marcados = estado.momentos.filter((m) => m.marcado).length;
  const temMomentos = estado.momentos.length > 0;
  el.btnLote.textContent = marcados === 1 ? t('mom.gerar1') : t('mom.gerarN', { n: marcados });
  el.btnLote.hidden = !temMomentos;          // só aparece depois da busca
  el.dicaMomentos.hidden = temMomentos;
  // Antes da busca, "Encontrar momentos" é a ação principal; depois, vira secundária
  el.btnAnalisar.textContent = t(temMomentos ? 'mom.denovo' : 'mom.encontrar');
  el.btnAnalisar.classList.toggle('primario', !temMomentos);
}

/** Pra cada momento marcado: abre, legenda (se pedido) e exporta. */
async function gerarClipes() {
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
    prontos = await casos.gerarLote(fila, {
      abrir: (indice, posicao, total) => {
        definirPrefixo(t('s.lote', { a: posicao + 1, b: total }));
        selecionarMomento(indice);
      },
      legendar: () => (el.legendarLote.checked && formatoAtual() !== 'original' ? legendar() : null),
      exportar,
    });
  } finally {
    estado.emLote = false;
    definirPrefixo('');
    definirOcupado(false);
  }
  mostrarStatus(t('s.loteFim', { a: prontos, b: fila.length }), 1);
}

export function iniciarPainelMomentos(casosDeUso, guardaChave) {
  casos = casosDeUso;
  chaveGuardada = guardaChave;

  // A chave fica guardada só neste navegador. Ela nunca entra no código.
  el.chaveGemini.value = chaveGuardada.ler();
  el.metodoMomentos.value = el.chaveGemini.value ? 'ia' : 'som';
  el.linhaChave.hidden = el.metodoMomentos.value !== 'ia';
  el.chaveGemini.addEventListener('change', () => {
    chaveGuardada.gravar(el.chaveGemini.value.trim());
  });
  el.metodoMomentos.addEventListener('change', () => {
    el.linhaChave.hidden = el.metodoMomentos.value !== 'ia';
  });

  // O idioma falado aparece em dois lugares (momentos e legenda): mantém os dois iguais
  el.idiomaMomentos.addEventListener('change', () => { el.idioma.value = el.idiomaMomentos.value; });
  el.idioma.addEventListener('change', () => { el.idiomaMomentos.value = el.idioma.value; });

  el.btnAnalisar.addEventListener('click', analisar); // a busca só roda com este clique
  el.btnLote.addEventListener('click', gerarClipes);

  // No modo longo, ajustar o trecho ajusta o momento que está aberto
  ao('trecho', (trecho) => {
    const momento = estado.momentos[estado.momentoAtivo];
    if (momento && (momento.inicio !== trecho.inicio || momento.fim !== trecho.fim)) {
      momento.inicio = trecho.inicio;
      momento.fim = trecho.fim;
      desenhar();
    }
  });
  aoTrocarIdioma(desenhar);
  desenhar();
}
