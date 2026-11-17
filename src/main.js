// =====================================================================
//  main.js — "raiz de composição" do app.
//
//  É o ÚNICO arquivo que conhece todas as camadas. Ele:
//    1) cria os adaptadores de infraestrutura (FFmpeg, Whisper, Gemini)
//    2) entrega esses adaptadores aos casos de uso (injeção de dependência)
//    3) entrega os casos de uso às telas
//
//  Camadas (as setas mostram quem pode importar quem):
//
//    interface ──► aplicacao ──► dominio
//                     ▲
//    infraestrutura ──┘ (cumpre os contratos de aplicacao/portas.js)
//
//  O domínio não importa ninguém. Por isso dá pra testar as regras no
//  Node, sem navegador (veja a pasta tests/).
// =====================================================================

// ---------- Infraestrutura ----------
import { MotorFFmpeg } from './infraestrutura/motor-ffmpeg.js';
import { TranscritorWhisper } from './infraestrutura/transcritor-whisper.js';
import { BuscadorGemini } from './infraestrutura/gemini.js';
import { armazenamento, CHAVES } from './infraestrutura/armazenamento.js';

// ---------- Casos de uso ----------
import { exportarClipe } from './aplicacao/exportar-clipe.js';
import { gerarLegenda } from './aplicacao/gerar-legenda.js';
import { encontrarMomentos } from './aplicacao/encontrar-momentos.js';
import { gerarLote } from './aplicacao/gerar-lote.js';

// ---------- Interface ----------
import { aplicarTraducoes, definirIdioma, idiomaAtual } from './interface/i18n.js';
import { definirOcupado } from './interface/status.js';
import { iniciarNavegacao } from './interface/navegacao.js';
import { iniciarEditorTrecho } from './interface/editor-trecho.js';
import { iniciarPainelLegenda } from './interface/painel-legenda.js';
import { iniciarExportacao } from './interface/exportacao.js';
import { iniciarPainelMomentos } from './interface/painel-momentos.js';
import { iniciarUpload } from './interface/upload.js';
import { iniciarTema } from './interface/tema.js';

// 1) Adaptadores: um de cada, compartilhados pelo app inteiro
const motor = new MotorFFmpeg();
const transcritor = new TranscritorWhisper();
const buscadorIA = new BuscadorGemini();

// 2) Casos de uso já "ligados" aos adaptadores.
//    A tela chama casos.exportarClipe(pedido, relator) sem saber que existe FFmpeg.
const casos = {
  exportarClipe: (pedido, relator) => exportarClipe({ motor }, pedido, relator),
  gerarLegenda: (pedido, relator) => gerarLegenda({ motor, transcritor }, pedido, relator),
  encontrarMomentos: (pedido, relator) => encontrarMomentos({ motor, buscadorIA }, pedido, relator),
  gerarLote,
};

// Preferências salvas no navegador, já com o nome de cada uma
const chaveGemini = {
  ler: () => armazenamento.ler(CHAVES.gemini),
  gravar: (valor) => armazenamento.gravar(CHAVES.gemini, valor),
};
const temaGuardado = { gravar: (valor) => armazenamento.gravar(CHAVES.tema, valor) };

// 3) Telas. A ordem importa pouco: cada uma só registra seus cliques e avisos.
aplicarTraducoes(); // primeira pintura no idioma certo
iniciarNavegacao();
iniciarEditorTrecho();
iniciarPainelLegenda(casos);
iniciarExportacao(casos);
iniciarPainelMomentos(casos, chaveGemini);
iniciarUpload();
iniciarTema(temaGuardado);
definirOcupado(false);

// Botões PT / EN / ES
document.querySelectorAll('input[name="interface"]').forEach((opcao) => {
  opcao.checked = opcao.value === idiomaAtual();
  opcao.addEventListener('change', () => definirIdioma(opcao.value));
});
