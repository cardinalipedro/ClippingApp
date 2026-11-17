# Los Angeles Clippers ✂️

Editor de clipes verticais (TikTok, Shorts, Reels) que roda **100% no navegador**.
O vídeo nunca sai do computador do usuário: o processamento é feito pelo
[FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), uma versão do FFmpeg compilada para WebAssembly.

## Funcionalidades (v0.8)

- **Dois modos de entrada:**
  - *Clipe curto*: o vídeo abre já com a legenda sendo gerada
  - *Vídeo longo*: o app sugere os melhores momentos e gera todos os clipes em fila, já legendados. A escolha pode ser **por IA** (o Gemini ouve o áudio e escolhe pelo conteúdo, com título pra cada clipe) ou **pelo som** (trechos mais agitados, sem internet)
- **Interface em português, inglês e espanhol** (botões PT / EN / ES no canto superior direito; a escolha fica salva)
- **Tema escuro e claro** (botão ao lado dos idiomas): escuro em rosa e laranja, claro em bege com azul ciano. A escolha fica salva
- No modo vídeo longo, a busca por momentos só começa quando você clica em **Encontrar momentos**
- Vídeos longos são lidos direto do disco (WORKERFS), sem copiar o arquivo pra memória
- Marcação de início e fim (botões ou atalhos **I** / **O**, prévia com **P**)
- 3 formatos de saída:
  - **Vertical 9:16**: recorte com posição ajustável e prévia do enquadramento
  - **Vertical com fundo desfocado**: o vídeo inteiro centralizado sobre uma versão borrada dele
  - **Original**: corte instantâneo, sem recodificar
- Saída em 1080×1920 ou 720×1280 (H.264 + AAC, `faststart`)
- **Legenda automática** em português, inglês ou espanhol (no idioma falado), com destaque palavra por palavra e texto editável antes de exportar. A fala é reconhecida pelo [Whisper](https://github.com/openai/whisper) (versão *small*, para mais precisão) rodando no navegador via [Transformers.js](https://huggingface.co/docs/transformers.js)
- Lista de clipes exportados com prévia e download

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) 18 ou mais novo.

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente http://localhost:5173).

## Chave do Gemini (opcional)

O modo por IA usa a API do Gemini com uma chave sua, criada no [Google AI Studio](https://aistudio.google.com/apikey).
A chave fica salva só no `localStorage` do seu navegador: ela não faz parte do código e não vai pro repositório.
O áudio do vídeo é enviado ao Google pra análise.

## Como funciona

1. O vídeo escolhido é exibido num `<video>` através de uma URL temporária (`URL.createObjectURL`).
2. Na primeira exportação o app baixa o núcleo do FFmpeg (~30 MB) e o inicializa num Web Worker.
3. O arquivo é copiado para o sistema de arquivos virtual do FFmpeg (uma vez só por vídeo).
4. `montarArgumentos()` (em `src/main.js`) monta o comando do FFmpeg conforme o formato.
5. O resultado vira um `Blob`, que é exibido e baixado pelo navegador.

## Limitações conhecidas

- A legenda baixa um modelo de IA na primeira vez (dezenas de MB) e pode errar nomes próprios e gírias: sempre revise.
- O formato "Original" não recodifica o vídeo, então sai sem legenda.
- A detecção de momentos olha só o volume do som: acha gritos, risadas e explosões, mas não entende o que foi dito.
- Recodificar é mais lento que num programa nativo (o FFmpeg.wasm usa uma thread só).
- O formato "Original" corta no keyframe mais próximo, então pode variar 1 a 2 s.

## Roadmap

- [x] Legenda automática (pt, en, es)
- [ ] Estilos de legenda (cor, posição, tamanho)
- [ ] Layout dividido (momento em cima, zoom ou reação embaixo)
- [x] Detecção de momentos pelos picos de áudio + exportação em fila
- [x] IA (Gemini) escolhendo momentos e sugerindo títulos, com a chave do próprio usuário
- [ ] Backend pra esconder a chave e abrir o site ao público
- [ ] Backend opcional para processar no servidor

## Deploy

`npm run build` gera a pasta `dist/`. A forma mais simples de publicar é importar o
repositório na [Vercel](https://vercel.com) ou na [Netlify](https://netlify.com):
elas detectam o Vite sozinhas.
