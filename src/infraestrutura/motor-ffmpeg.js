// =====================================================================
//  infraestrutura/motor-ffmpeg.js — o FFmpeg.wasm por trás do contrato
//  MotorVideo (veja aplicacao/portas.js).
//
//  É o único arquivo do app que conhece a biblioteca @ffmpeg/ffmpeg.
//  Se um dia o processamento for pra um servidor, basta escrever outro
//  motor com os mesmos métodos: os casos de uso nem ficam sabendo.
// =====================================================================

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import urlFonteLegenda from './fontes/Inter-ExtraBold.otf?url'; // o Vite troca isso pela URL do arquivo
import { ErroApp } from '../dominio/erros.js';
import { segundosDoLog } from '../dominio/comandos-ffmpeg.js';

// Onde baixar o "núcleo" do FFmpeg (~30 MB, baixado só na 1ª vez)
const CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
const LIMITE_COPIA_BYTES = 1.5e9; // acima disso não dá pra copiar o vídeo pra memória
const PASTA_ENTRADA = '/entrada';
const PASTA_FONTES = '/fontes';   // a fonte fica numa pasta só dela: o FFmpeg lê TUDO que estiver lá

export class MotorFFmpeg {
  // Campos com # são privados: só esta classe enxerga
  #ffmpeg = new FFmpeg();
  #carregamento = null;   // Promise compartilhada: carrega uma vez só
  #arquivo = null;        // qual File está aberto no FFmpeg
  #montado = false;       // o vídeo está "montado" (lido direto do disco)?
  #fonteCarregada = false;
  #logs = [];             // últimas linhas do FFmpeg (ajudam a explicar erros)
  #duracao = 0;           // duração do comando atual, pra calcular a %
  #aoProgresso = null;

  caminhoEntrada = null;  // nome do vídeo dentro do FFmpeg
  pastaFontes = PASTA_FONTES;

  constructor() {
    this.#ffmpeg.on('log', ({ message }) => {
      console.debug('[ffmpeg]', message);
      this.#logs.push(message);
      if (this.#logs.length > 30) this.#logs.shift();

      const segundos = segundosDoLog(message);
      if (segundos !== null && this.#duracao > 0 && this.#aoProgresso) {
        this.#aoProgresso(segundos / this.#duracao);
      }
    });
  }

  carregar() {
    if (!this.#carregamento) {
      this.#carregamento = (async () => {
        await this.#ffmpeg.load({
          coreURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      })().catch((erro) => {
        this.#carregamento = null; // permite tentar de novo
        throw erro;
      });
    }
    return this.#carregamento;
  }

  estaCom(arquivo) {
    return this.#arquivo === arquivo;
  }

  async abrir(arquivo) {
    const ff = this.#ffmpeg;
    const ext = (arquivo.name.split('.').pop() || 'mp4').toLowerCase();

    // Tira o vídeo anterior
    if (this.#montado) await ff.unmount(PASTA_ENTRADA).catch(() => {});
    else if (this.caminhoEntrada) await ff.deleteFile(this.caminhoEntrada).catch(() => {});
    this.#montado = false;
    this.#arquivo = null;

    try {
      // "Montar" = o FFmpeg lê o arquivo direto do disco, aos poucos.
      // É o que permite vídeos longos: nada é copiado pra memória.
      await ff.createDir(PASTA_ENTRADA).catch(() => {}); // ignora "já existe"
      await ff.mount('WORKERFS', { blobs: [{ name: `video.${ext}`, data: arquivo }] }, PASTA_ENTRADA);
      this.caminhoEntrada = `${PASTA_ENTRADA}/video.${ext}`;
      this.#montado = true;
    } catch (erro) {
      // Plano B (jeito antigo): copiar o vídeo inteiro pra memória
      console.warn('Não deu pra montar o arquivo; copiando pra memória.', erro);
      if (arquivo.size > LIMITE_COPIA_BYTES) throw new ErroApp('e.grande');
      this.caminhoEntrada = `entrada.${ext}`;
      await ff.writeFile(this.caminhoEntrada, await fetchFile(arquivo));
    }
    this.#arquivo = arquivo;
  }

  async prepararFonte() {
    if (this.#fonteCarregada) return;
    await this.#ffmpeg.createDir(PASTA_FONTES).catch(() => {}); // ignora "já existe"
    await this.#ffmpeg.writeFile(`${PASTA_FONTES}/Inter-ExtraBold.otf`, await fetchFile(urlFonteLegenda));
    this.#fonteCarregada = true;
  }

  async escrever(nome, conteudo) {
    const dados = typeof conteudo === 'string' ? new TextEncoder().encode(conteudo) : conteudo;
    await this.#ffmpeg.writeFile(nome, dados);
  }

  /**
   * Roda um comando. Se falhar, lança ErroApp com a chave pedida em `erro`,
   * ou uma mensagem genérica com as últimas linhas de erro do FFmpeg.
   */
  async executar(args, { duracao = 0, aoProgresso = null, erro = null } = {}) {
    console.info('ffmpeg', args.join(' '));
    this.#logs = [];
    this.#duracao = duracao;
    this.#aoProgresso = aoProgresso;
    try {
      const codigo = await this.#ffmpeg.exec(args);
      if (codigo !== 0) {
        if (erro) throw new ErroApp(erro);
        const pista = this.#logs.filter((l) => /error|invalid|failed/i.test(l)).slice(-2).join(' | ');
        throw new ErroApp('e.ffmpeg', { c: codigo, p: pista });
      }
    } finally {
      this.#duracao = 0;
      this.#aoProgresso = null;
    }
  }

  async lerEApagar(nome) {
    const dados = await this.#ffmpeg.readFile(nome);
    await this.#ffmpeg.deleteFile(nome);
    return dados;
  }
}
