// =====================================================================
//  Testes dos casos de uso com adaptadores FALSOS.
//
//  Aqui aparece a vantagem da arquitetura: o caso de uso não sabe que
//  existe FFmpeg ou Gemini. Então passamos objetos de mentira com os
//  mesmos métodos e conferimos o comportamento, em milissegundos.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { exportarClipe } from '../src/aplicacao/exportar-clipe.js';
import { encontrarMomentos } from '../src/aplicacao/encontrar-momentos.js';
import { gerarLote } from '../src/aplicacao/gerar-lote.js';
import { ErroApp } from '../src/dominio/erros.js';

/** Motor de vídeo falso: anota os comandos e devolve bytes inventados. */
function criarMotorFalso({ codigoFalha = null } = {}) {
  const motor = {
    caminhoEntrada: null,
    pastaFontes: '/fontes',
    comandos: [],
    escritos: {},
    aberto: null,
    async carregar() {},
    estaCom(arquivo) { return this.aberto === arquivo; },
    async abrir(arquivo) { this.aberto = arquivo; this.caminhoEntrada = '/entrada/video.mp4'; },
    async prepararFonte() {},
    async escrever(nome, conteudo) { this.escritos[nome] = conteudo; },
    async executar(args, opcoes = {}) {
      this.comandos.push(args);
      if (codigoFalha) throw new ErroApp(opcoes.erro || 'e.ffmpeg', { c: codigoFalha });
    },
    async lerEApagar(nome) {
      if (nome === 'analise.pcm') return new Uint8Array(8000 * 2 * 120); // 2 min de silêncio
      return new Uint8Array([1, 2, 3, 4]);
    },
  };
  return motor;
}

const relatorMudo = { status() {}, barra() {} };
const arquivo = { name: 'gameplay.mp4', size: 1000 };

test('exportarClipe: monta o comando, queima a legenda e devolve o clipe', async () => {
  const motor = criarMotorFalso();
  const legenda = { blocos: [{ palavras: [{ texto: 'oi', inicio: 0, fim: 0.5 }] }] };

  const clipe = await exportarClipe({ motor }, {
    arquivo, trecho: { inicio: 10, fim: 40 }, formato: 'vertical', posicao: 50,
    resolucao: 1080, legenda, maisLargo: true,
  }, relatorMudo);

  assert.equal(clipe.ext, 'mp4');
  assert.equal(clipe.duracao, 30);
  assert.equal(clipe.blob.type, 'video/mp4');
  assert.ok('legenda.ass' in motor.escritos, 'escreveu o arquivo de legenda');
  assert.ok(motor.comandos[0].includes('/entrada/video.mp4'));
});

test('exportarClipe: trecho curto demais nem chega no motor', async () => {
  const motor = criarMotorFalso();
  await assert.rejects(
    exportarClipe({ motor }, { arquivo, trecho: { inicio: 0, fim: 0.2 }, formato: 'vertical' }, relatorMudo),
    (e) => e.chave === 'a.curto',
  );
  assert.equal(motor.comandos.length, 0);
});

test('encontrarMomentos: sem chave do Gemini, avisa e usa o detector pelo som', async () => {
  const motor = criarMotorFalso();
  const buscadorIA = { buscar: () => assert.fail('não devia chamar a IA sem chave') };
  const cache = { audioAnalise: null, audioIA: null };

  const r = await encontrarMomentos({ motor, buscadorIA }, {
    arquivo, duracaoVideo: 120, metodo: 'ia', chave: '', idioma: 'portuguese',
    duracaoClipe: 30, quantidade: 3, cache,
  }, relatorMudo);

  assert.equal(r.aviso.chave, 'av.semChave');
  assert.ok(cache.audioAnalise instanceof Int16Array, 'guardou o áudio pra próxima busca');
});

test('encontrarMomentos: se a IA falhar, avisa e não quebra', async () => {
  const motor = criarMotorFalso();
  const buscadorIA = { buscar: async () => { throw new Error('503'); } };

  const r = await encontrarMomentos({ motor, buscadorIA }, {
    arquivo, duracaoVideo: 120, metodo: 'ia', chave: 'abc', idioma: 'portuguese',
    duracaoClipe: 30, quantidade: 3, cache: { audioAnalise: null, audioIA: null },
  }, relatorMudo);

  assert.equal(r.aviso.chave, 'av.iaFalhou');
  assert.ok(Array.isArray(r.momentos));
});

test('encontrarMomentos: usa os momentos da IA já conferidos pelo domínio', async () => {
  const motor = criarMotorFalso();
  const buscadorIA = {
    buscar: async () => [
      { inicio: '00:10', fim: '00:40', titulo: 'Bom', motivo: '', nota: 8 },
      { inicio: '00:20', fim: '00:50', titulo: 'Sobreposto', motivo: '', nota: 6 },
    ],
  };

  const r = await encontrarMomentos({ motor, buscadorIA }, {
    arquivo, duracaoVideo: 120, metodo: 'ia', chave: 'abc', idioma: 'portuguese',
    duracaoClipe: 30, quantidade: 3, cache: { audioAnalise: null, audioIA: null },
  }, relatorMudo);

  assert.equal(r.aviso, null);
  assert.deepEqual(r.momentos.map((m) => m.titulo), ['Bom']);
});

test('gerarLote: se um clipe falhar, a fila continua', async () => {
  const abertos = [];
  const prontos = await gerarLote(['a', 'b', 'c'], {
    abrir: (item) => abertos.push(item),
    legendar: async () => {},
    exportar: async (item) => item !== 'b',
  });
  assert.deepEqual(abertos, ['a', 'b', 'c']);
  assert.equal(prontos, 2);
});
