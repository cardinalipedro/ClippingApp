// =====================================================================
//  Teste da arquitetura: confere quem importa quem.
//  Se alguém (você, eu ou um colega) importar o FFmpeg dentro do
//  domínio, por exemplo, este teste falha e avisa.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname;

// Para cada camada: quais pastas ela PODE importar
const PERMITIDO = {
  dominio: ['dominio'],
  aplicacao: ['dominio', 'aplicacao'],
  infraestrutura: ['dominio', 'infraestrutura'],
  interface: ['dominio', 'aplicacao', 'interface'],
};

function importsDe(camada) {
  const pasta = join(SRC, camada);
  return readdirSync(pasta).filter((f) => f.endsWith('.js')).flatMap((arquivo) => {
    const codigo = readFileSync(join(pasta, arquivo), 'utf8');
    return [...codigo.matchAll(/^import\s.*?from\s+['"](.+?)['"]/gms)].map((m) => ({ arquivo, de: m[1] }));
  });
}

for (const [camada, pode] of Object.entries(PERMITIDO)) {
  test(`arquitetura: ${camada} só importa ${pode.join(', ')}`, () => {
    for (const { arquivo, de } of importsDe(camada)) {
      if (!de.startsWith('.')) {
        // biblioteca externa (npm): só a infraestrutura pode usar
        assert.equal(camada, 'infraestrutura', `${camada}/${arquivo} importa a biblioteca "${de}"`);
        continue;
      }
      const destino = de.startsWith('./') ? camada : de.split('/')[1];
      assert.ok(pode.includes(destino), `${camada}/${arquivo} importa ${de}`);
    }
  });
}
