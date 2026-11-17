// =====================================================================
//  interface/exportacao.js — botão "Exportar clipe" e a lista de
//  clipes prontos.
// =====================================================================

import { el, formatoAtual } from './dom.js';
import { t, aplicarTraducoes } from './i18n.js';
import { relator, mostrarStatus, atualizarBarra, mensagemDoErro, definirOcupado, avisar } from './status.js';
import { videoMaisLargo } from './editor-trecho.js';
import { estado } from '../aplicacao/estado.js';
import { validarDuracao } from '../dominio/trecho.js';
import { nomeDoClipe } from '../dominio/clipe.js';

let casos; // casos de uso, recebidos do main.js

/** Exporta o trecho atual. Devolve true se deu certo. */
export async function exportar() {
  if ((estado.ocupado && !estado.emLote) || !estado.arquivo) return false;
  try {
    validarDuracao(estado.trecho);
  } catch (erro) {
    avisar(erro);
    return false;
  }

  definirOcupado(true);
  try {
    const clipe = await casos.exportarClipe({
      arquivo: estado.arquivo,
      trecho: { ...estado.trecho },
      formato: formatoAtual(),
      posicao: Number(el.posicao.value),
      resolucao: Number(el.resolucao.value),
      legenda: estado.legenda,
      maisLargo: videoMaisLargo(),
    }, relator);

    adicionarClipe(clipe);
    atualizarBarra(1);
    mostrarStatus(t('s.pronto', { s: clipe.segundos.toFixed(1) }));
    return true;
  } catch (erro) {
    console.error(erro);
    mostrarStatus(t('s.erro', { m: mensagemDoErro(erro) }));
    return false;
  } finally {
    definirOcupado(estado.emLote); // no lote, continua ocupado até a fila acabar
  }
}

function adicionarClipe({ blob, duracao, formato, ext }) {
  estado.contadorClipes += 1;
  const numero = String(estado.contadorClipes).padStart(2, '0');
  const url = URL.createObjectURL(blob);
  const mb = (blob.size / 1024 / 1024).toFixed(1);

  const li = document.createElement('li');
  li.innerHTML = `
    <video src="${url}" controls playsinline preload="metadata"></video>
    <div class="info">#${numero} · ${duracao.toFixed(1)}s · ${formato} · ${mb} MB</div>
    <div class="acoes">
      <a class="baixar" data-i18n="baixar"></a>
      <button type="button" class="remover" data-i18n-title="remover">✕</button>
    </div>`;

  aplicarTraducoes(li);
  const link = li.querySelector('a.baixar');
  link.href = url;
  link.download = nomeDoClipe(estado.arquivo.name, estado.contadorClipes, formato, ext);

  li.querySelector('.remover').addEventListener('click', () => {
    URL.revokeObjectURL(url); // libera a memória do clipe
    li.remove();
    if (!el.listaClipes.children.length) el.etapaClipes.hidden = true;
  });

  el.listaClipes.prepend(li); // mais recente primeiro
  el.etapaClipes.hidden = false;
}

export function iniciarExportacao(casosDeUso) {
  casos = casosDeUso;
  el.btnExportar.addEventListener('click', exportar);
}
