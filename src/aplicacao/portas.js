// =====================================================================
//  aplicacao/portas.js — os "contratos" que os casos de uso esperam.
//
//  Um caso de uso não importa o FFmpeg, o Whisper nem o Gemini. Ele
//  recebe um objeto que CUMPRE um destes contratos (injeção de
//  dependência). Quem cria os objetos de verdade é o main.js.
//  Nos testes, passamos objetos falsos com os mesmos métodos.
//
//  JavaScript não tem "interface" como Java ou C#, então os contratos
//  ficam documentados aqui em JSDoc. O VS Code usa isso no autocompletar.
// =====================================================================

/**
 * Motor de vídeo (implementado por infraestrutura/motor-ffmpeg.js).
 * @typedef {object} MotorVideo
 * @property {string|null} caminhoEntrada        nome do vídeo atual dentro do motor
 * @property {string} pastaFontes                 pasta onde fica a fonte da legenda
 * @property {() => Promise<void>} carregar       baixa e inicia o motor (uma vez só)
 * @property {(arquivo: File) => boolean} estaCom o vídeo já está aberto no motor?
 * @property {(arquivo: File) => Promise<void>} abrir
 * @property {() => Promise<void>} prepararFonte
 * @property {(nome: string, conteudo: string|Uint8Array) => Promise<void>} escrever
 * @property {(args: string[], opcoes?: { duracao?: number, aoProgresso?: (fracao: number) => void, erro?: string }) => Promise<void>} executar
 * @property {(nome: string) => Promise<Uint8Array>} lerEApagar
 */

/**
 * Reconhecimento de fala (implementado por infraestrutura/transcritor-whisper.js).
 * @typedef {object} Transcritor
 * @property {(audio: Float32Array, idioma: string, aoProgresso: (etapa: 'modelo'|'fala', fracao: number) => void) => Promise<{texto: string, inicio: number, fim: number}[]>} transcrever
 */

/**
 * IA que escolhe momentos (implementado por infraestrutura/gemini.js).
 * Devolve a resposta "crua"; quem confere os tempos é o domínio.
 * @typedef {object} BuscadorMomentosIA
 * @property {(pedido: { chave: string, audio: Uint8Array, duracaoTotal: number, duracaoClipe: number, quantidade: number, idioma: string }) => Promise<object[]>} buscar
 */

/**
 * Quem mostra o andamento pro usuário (implementado pela interface).
 * O caso de uso manda só a CHAVE do texto; a interface traduz.
 * @typedef {object} Relator
 * @property {(chave: string, fracao?: number) => void} status
 * @property {(fracao: number) => void} barra
 */

export {};
