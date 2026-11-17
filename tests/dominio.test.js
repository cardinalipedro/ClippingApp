// =====================================================================
//  Testes do domínio: regras puras, rodam no Node sem navegador.
//  Rode com:  npm test
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as trecho from '../src/dominio/trecho.js';
import { ErroApp } from '../src/dominio/erros.js';
import { ehMaisLargoQueVertical, faixaVertical, tamanhoSaida } from '../src/dominio/enquadramento.js';
import { argsExportacao, extensaoDeSaida, segundosDoLog } from '../src/dominio/comandos-ffmpeg.js';
import { nomeDoClipe, ehVideo } from '../src/dominio/clipe.js';
import { paraSegundos, organizarMomentos } from '../src/dominio/momentos-ia.js';
import { agruparEmBlocos } from '../src/dominio/legenda.js';

test('trecho: clipe curto de até 3 min vira o vídeo inteiro e legenda sozinho', () => {
  const r = trecho.trechoInicial(95.37, 'curto');
  assert.deepEqual(r.trecho, { inicio: 0, fim: 95.3 });
  assert.equal(r.legendarSozinho, true);
});

test('trecho: vídeo longo começa com uma sugestão de 30 s', () => {
  const r = trecho.trechoInicial(1800, 'longo');
  assert.deepEqual(r.trecho, { inicio: 0, fim: 30 });
  assert.equal(r.legendarSozinho, false);
});

test('trecho: marcar início depois do fim empurra o fim 30 s', () => {
  assert.deepEqual(trecho.marcarInicio({ inicio: 0, fim: 10 }, 42.04, 600), { inicio: 42, fim: 72 });
});

test('trecho: marcar fim antes do início lança erro com chave de tradução', () => {
  assert.throws(
    () => trecho.marcarFim({ inicio: 20, fim: 50 }, 10),
    (e) => e instanceof ErroApp && e.chave === 'a.fimDepois',
  );
});

test('trecho: não deixa digitar fora do vídeo', () => {
  assert.deepEqual(trecho.digitarInicio({ inicio: 0, fim: 30 }, 999, 120), { inicio: 120, fim: 120 });
  assert.deepEqual(trecho.digitarFim({ inicio: 10, fim: 30 }, 5, 120), { inicio: 10, fim: 10.1 });
});

test('trecho: menos de meio segundo não vira clipe', () => {
  assert.throws(() => trecho.validarDuracao({ inicio: 1, fim: 1.2 }), ErroApp);
  assert.doesNotThrow(() => trecho.validarDuracao({ inicio: 1, fim: 2 }));
});

test('enquadramento: 16:9 é mais largo que 9:16, vertical não', () => {
  assert.equal(ehMaisLargoQueVertical(1920, 1080), true);
  assert.equal(ehMaisLargoQueVertical(1080, 1920), false);
});

test('enquadramento: faixa centralizada num vídeo 16:9', () => {
  const { larguraPct, esquerdaPct } = faixaVertical(1920, 1080, 50);
  assert.ok(Math.abs(larguraPct - 31.640625) < 1e-9);
  assert.ok(Math.abs(esquerdaPct - (100 - larguraPct) / 2) < 1e-9);
  assert.deepEqual(tamanhoSaida(720), { largura: 720, altura: 1280 });
});

test('ffmpeg: formato original só copia, sem recodificar', () => {
  const args = argsExportacao({ entrada: 'in.mp4', saida: 'out.mp4', inicio: 5, duracao: 10, formato: 'original' });
  assert.ok(args.includes('copy'));
  assert.ok(!args.includes('libx264'));
});

test('ffmpeg: vertical com legenda recorta e queima o .ass', () => {
  const args = argsExportacao({
    entrada: 'in.mp4', saida: 'out.mp4', inicio: 0, duracao: 30, formato: 'vertical',
    posicao: 50, resolucao: 1080, comLegenda: true, pastaFontes: '/fontes', maisLargo: true,
  });
  const filtro = args[args.indexOf('-vf') + 1];
  assert.match(filtro, /^crop=/);
  assert.match(filtro, /scale=1080:1920/);
  assert.match(filtro, /ass=legenda\.ass:fontsdir=\/fontes$/);
});

test('ffmpeg: extensão de saída e leitura do progresso', () => {
  assert.equal(extensaoDeSaida('live.webm', 'original'), 'webm');
  assert.equal(extensaoDeSaida('live.webm', 'vertical'), 'mp4');
  assert.equal(segundosDoLog('frame=10 time=00:01:02.50 bitrate=1'), 62.5);
  assert.equal(segundosDoLog('qualquer outra linha'), null);
});

test('clipe: nome do arquivo e tipos aceitos', () => {
  assert.equal(nomeDoClipe('gameplay.mp4', 3, 'vertical', 'mp4'), 'gameplay_clipe03_vertical.mp4');
  assert.equal(ehVideo('video.MKV', ''), true);
  assert.equal(ehVideo('foto.png', 'image/png'), false);
});

test('ia: converte MM:SS e H:MM:SS', () => {
  assert.equal(paraSegundos('12:34'), 754);
  assert.equal(paraSegundos('1:02:03'), 3723);
  assert.ok(Number.isNaN(paraSegundos('abc')));
});

test('ia: descarta tempos inválidos e momentos sobrepostos', () => {
  const brutos = [
    { inicio: '01:00', fim: '01:30', titulo: 'A', motivo: '', nota: 9 },
    { inicio: '01:10', fim: '01:40', titulo: 'B (sobreposto)', motivo: '', nota: 7 },
    { inicio: 'xx', fim: '02:00', titulo: 'C (inválido)', motivo: '', nota: 10 },
    { inicio: '03:00', fim: '03:30', titulo: 'D', motivo: '', nota: 5 },
  ];
  const r = organizarMomentos(brutos, { duracaoTotal: 600, duracaoClipe: 30, quantidade: 5 });
  assert.deepEqual(r.map((m) => m.titulo), ['A', 'D']);
});

test('legenda: agrupa palavras em blocos curtos', () => {
  const palavras = ['olha', 'isso', 'aqui', 'mano', 'que', 'absurdo'].map((texto, i) => ({ texto, inicio: i * 0.3, fim: i * 0.3 + 0.25 }));
  const blocos = agruparEmBlocos(palavras);
  assert.ok(blocos.length >= 2);
  assert.ok(blocos.every((b) => b.palavras.length <= 3));
});
