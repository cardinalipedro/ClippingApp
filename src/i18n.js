// =====================================================================
//  i18n.js — tradução da interface (pt, en, es).
//  "i18n" é o apelido de "internationalization" (i + 18 letras + n).
//
//  Como funciona:
//   - cada texto tem uma CHAVE (ex.: 'exportar') e uma versão por idioma
//   - no HTML, o elemento aponta pra chave:  <span data-i18n="exportar">
//   - no JavaScript, usa-se  t('exportar')
//   - trechos entre chaves viram variáveis:  t('s.pronto', { s: 12 })
//  Pra adicionar um idioma: copie um bloco inteiro e traduza os valores.
// =====================================================================

const TEXTOS = {
  pt: {
    'pagina.titulo': 'Clipador — cortes verticais no navegador',
    'header.sub': 'Corte, enquadre em 9:16 e baixe. Tudo roda no seu navegador — nada é enviado pra servidor.',
    'modo.curto.titulo': 'Clipe curto',
    'modo.curto.desc': 'Já tem o trecho pronto? A legenda é gerada sozinha.',
    'modo.curto.dica': 'Arraste ou clique · até 3 min',
    'modo.longo.titulo': 'Vídeo longo',
    'modo.longo.desc': 'O app acha os melhores momentos, corta e legenda cada um.',
    'modo.longo.dica': 'Arraste ou clique · 10 min ou mais',
    'idioma.falado': 'Idioma falado',
    'idioma.falado.titulo': 'Idioma falado no vídeo',

    'mom.rotulo': 'Momentos',
    'mom.metodo.titulo': 'Como escolher os momentos',
    'mom.ia': 'Por IA (Gemini)',
    'mom.som': 'Pelo som',
    'mom.dur.titulo': 'Duração de cada clipe',
    'mom.dur': 'Clipes de {n} s',
    'mom.qtd.titulo': 'Quantidade máxima de clipes',
    'mom.qtd': 'Até {n}',
    'mom.legendar': 'Legendar',
    'mom.chave': 'Chave do Gemini',
    'mom.chave.placeholder': 'Cole aqui a sua chave de API',
    'mom.chave.link': 'Criar chave grátis',
    'mom.dica': 'Escolha as opções acima e clique em Encontrar momentos.',
    'mom.encontrar': 'Encontrar momentos',
    'mom.denovo': 'Procurar de novo',
    'mom.gerar1': 'Gerar 1 clipe',
    'mom.gerarN': 'Gerar {n} clipes',

    'trecho': 'Trecho',
    'inicio': 'Início',
    'fim': 'Fim',
    'marcar': 'Marcar',
    'marcar.inicio.titulo': 'Usar o ponto atual do vídeo como início',
    'marcar.fim.titulo': 'Usar o ponto atual do vídeo como fim',
    'duracao': 'Duração: {s}s',
    'ver': 'Ver trecho',
    'formato': 'Formato',
    'fmt.vertical': 'Vertical 9:16',
    'fmt.desfocado': 'Fundo desfocado',
    'fmt.original': 'Original',
    'enquadramento': 'Enquadramento',
    'esq': 'Esq.',
    'dir': 'Dir.',
    'resolucao': 'Resolução',
    'res.720': '720 × 1280 (exporta mais rápido)',
    'legenda': 'Legenda',
    'legenda.gerar': 'Gerar legenda',
    'legenda.denovo': 'Gerar de novo',
    'legenda.remover': 'Remover',
    'exportar': 'Exportar clipe',
    'aguarde': 'Aguarde…',
    'trocar': 'Trocar vídeo',
    'clipes.titulo': 'Clipes exportados',
    'baixar': 'Baixar',
    'remover': 'Remover',
    'preparando': 'Preparando…',

    'a.naoVideo': 'Esse arquivo não parece ser um vídeo.',
    'a.naoAbre': 'O navegador não conseguiu abrir esse vídeo. Tente um .mp4 (H.264), que é o formato mais compatível.',
    'a.fimDepois': 'O fim precisa vir depois do início.',
    'a.curto': 'O trecho precisa ter pelo menos meio segundo.',
    'a.marque': 'Marque pelo menos um momento.',

    's.carregando': 'Carregando o motor de vídeo (só demora na primeira vez)…',
    's.lendo': 'Lendo o vídeo…',
    's.cortando': 'Cortando…',
    's.processando': 'Processando (pode levar alguns minutos)…',
    's.pronto': 'Pronto! Exportado em {s}s.',
    's.erro': 'Erro: {m}',
    's.baixandoIA': 'Baixando a IA de legendas (só na primeira vez)…',
    's.ouvindoTrecho': 'Ouvindo o trecho e escrevendo a legenda…',
    's.extraindo': 'Extraindo o áudio do trecho…',
    's.semFala': 'Não encontrei fala nesse trecho.',
    's.legendaPronta': 'Legenda pronta: {n} blocos. Revise o texto antes de exportar.',
    's.erroLegenda': 'Erro na legenda: {m}',
    's.ouvindoTudo': 'Ouvindo o vídeo inteiro pra achar os melhores momentos…',
    's.encontrei': 'Encontrei {n} momentos. Confira e clique em Gerar clipes.',
    's.nada': 'Não achei momentos que se destaquem pelo som. Marque os trechos na mão.',
    's.erroAnalise': 'Erro na análise: {m}',
    's.preparandoIA': 'Preparando o áudio pra IA…',
    's.iaOuvindo': 'A IA está ouvindo o vídeo e escolhendo os momentos…',
    's.lote': 'Clipe {a} de {b} — ',
    's.loteFim': '{a} de {b} clipes prontos. Eles estão em "Clipes exportados".',

    'd.longoDemais': 'Vídeo com mais de 3 min: marque o trecho e clique em Gerar legenda.',
    'd.trechoMudou': 'O trecho mudou — gere a legenda de novo.',
    'd.original': 'O formato Original não recodifica, então sai sem legenda.',

    'e.grande': 'esse vídeo é grande demais pra este navegador (mais de 1,5 GB)',
    'e.ffmpeg': 'o FFmpeg falhou (código {c}). {p}',
    'e.iaLegenda': 'a IA de legendas não carregou',
    'e.semAudio': 'não consegui extrair o áudio (o vídeo tem som?)',
    'e.comprimir': 'não consegui comprimir o áudio',
    'e.longoIA': 'vídeo longo demais pra IA, o limite é perto de 1h15',
    'e.prepararAudio': 'não consegui preparar o áudio',
    'e.chave': 'chave recusada (erro {c})',
    'e.semModelo': 'não achei um modelo Gemini Flash disponível pra essa chave',
    'e.demanda': 'o Gemini está com alta demanda agora. Tente de novo em alguns minutos.',
    'e.semResposta': 'a IA não devolveu resposta',

    'av.semChave': 'Cole sua chave do Gemini pra usar a IA. Por enquanto, sugeri pelo som.',
    'av.iaNada': 'A IA não achou bons momentos. Sugeri pelo som.',
    'av.iaFalhou': 'A IA falhou ({m}). Sugeri pelo som.',

    't.irPonto': 'Ir para este ponto do vídeo',
    't.legendaEm': 'Legenda em {t}',
    't.incluir': 'Incluir o momento {n}',
    't.abrirMomento': 'Abrir este momento no editor',
    't.notaIA': 'Nota que a IA deu pro momento',
    't.forcaSom': 'Quanto o som se destaca do resto do vídeo',
    't.interface': 'Idioma da interface',
    'tema.paraClaro': 'Mudar para o tema claro',
    'tema.paraEscuro': 'Mudar para o tema escuro',
  },

  en: {
    'pagina.titulo': 'Clipador — vertical clips in your browser',
    'header.sub': 'Cut, frame in 9:16 and download. Everything runs in your browser — nothing is uploaded to a server.',
    'modo.curto.titulo': 'Short clip',
    'modo.curto.desc': 'Already have the clip? Captions are generated automatically.',
    'modo.curto.dica': 'Drag or click · up to 3 min',
    'modo.longo.titulo': 'Long video',
    'modo.longo.desc': 'The app finds the best moments, cuts and captions each one.',
    'modo.longo.dica': 'Drag or click · 10 min or more',
    'idioma.falado': 'Spoken language',
    'idioma.falado.titulo': 'Language spoken in the video',

    'mom.rotulo': 'Moments',
    'mom.metodo.titulo': 'How to pick the moments',
    'mom.ia': 'By AI (Gemini)',
    'mom.som': 'By sound',
    'mom.dur.titulo': 'Length of each clip',
    'mom.dur': '{n} s clips',
    'mom.qtd.titulo': 'Maximum number of clips',
    'mom.qtd': 'Up to {n}',
    'mom.legendar': 'Captions',
    'mom.chave': 'Gemini key',
    'mom.chave.placeholder': 'Paste your API key here',
    'mom.chave.link': 'Get a free key',
    'mom.dica': 'Choose the options above and click Find moments.',
    'mom.encontrar': 'Find moments',
    'mom.denovo': 'Search again',
    'mom.gerar1': 'Generate 1 clip',
    'mom.gerarN': 'Generate {n} clips',

    'trecho': 'Range',
    'inicio': 'Start',
    'fim': 'End',
    'marcar': 'Mark',
    'marcar.inicio.titulo': 'Use the current video position as the start',
    'marcar.fim.titulo': 'Use the current video position as the end',
    'duracao': 'Length: {s}s',
    'ver': 'Preview',
    'formato': 'Format',
    'fmt.vertical': 'Vertical 9:16',
    'fmt.desfocado': 'Blurred background',
    'fmt.original': 'Original',
    'enquadramento': 'Framing',
    'esq': 'Left',
    'dir': 'Right',
    'resolucao': 'Resolution',
    'res.720': '720 × 1280 (faster export)',
    'legenda': 'Captions',
    'legenda.gerar': 'Generate captions',
    'legenda.denovo': 'Generate again',
    'legenda.remover': 'Remove',
    'exportar': 'Export clip',
    'aguarde': 'Please wait…',
    'trocar': 'Change video',
    'clipes.titulo': 'Exported clips',
    'baixar': 'Download',
    'remover': 'Remove',
    'preparando': 'Preparing…',

    'a.naoVideo': "This file doesn't look like a video.",
    'a.naoAbre': "The browser couldn't open this video. Try an .mp4 (H.264), the most compatible format.",
    'a.fimDepois': 'The end must come after the start.',
    'a.curto': 'The range must be at least half a second long.',
    'a.marque': 'Select at least one moment.',

    's.carregando': 'Loading the video engine (only slow the first time)…',
    's.lendo': 'Reading the video…',
    's.cortando': 'Cutting…',
    's.processando': 'Processing (this can take a few minutes)…',
    's.pronto': 'Done! Exported in {s}s.',
    's.erro': 'Error: {m}',
    's.baixandoIA': 'Downloading the captions AI (first time only)…',
    's.ouvindoTrecho': 'Listening to the range and writing the captions…',
    's.extraindo': 'Extracting the audio…',
    's.semFala': 'No speech found in this range.',
    's.legendaPronta': 'Captions ready: {n} blocks. Review the text before exporting.',
    's.erroLegenda': 'Captions error: {m}',
    's.ouvindoTudo': 'Listening to the whole video to find the best moments…',
    's.encontrei': 'Found {n} moments. Check them and click Generate clips.',
    's.nada': 'No moments stand out by sound. Mark the ranges by hand.',
    's.erroAnalise': 'Analysis error: {m}',
    's.preparandoIA': 'Preparing the audio for the AI…',
    's.iaOuvindo': 'The AI is listening to the video and picking the moments…',
    's.lote': 'Clip {a} of {b} — ',
    's.loteFim': '{a} of {b} clips ready. They are under "Exported clips".',

    'd.longoDemais': 'Video longer than 3 min: mark the range and click Generate captions.',
    'd.trechoMudou': 'The range changed — generate the captions again.',
    'd.original': "The Original format doesn't re-encode, so it exports without captions.",

    'e.grande': 'this video is too large for this browser (over 1.5 GB)',
    'e.ffmpeg': 'FFmpeg failed (code {c}). {p}',
    'e.iaLegenda': "the captions AI didn't load",
    'e.semAudio': "couldn't extract the audio (does the video have sound?)",
    'e.comprimir': "couldn't compress the audio",
    'e.longoIA': 'video too long for the AI, the limit is around 1h15',
    'e.prepararAudio': "couldn't prepare the audio",
    'e.chave': 'key rejected (error {c})',
    'e.semModelo': 'no Gemini Flash model is available for this key',
    'e.demanda': 'Gemini is under high demand right now. Try again in a few minutes.',
    'e.semResposta': 'the AI returned no answer',

    'av.semChave': 'Paste your Gemini key to use the AI. For now, I suggested moments by sound.',
    'av.iaNada': "The AI didn't find good moments. Suggested by sound instead.",
    'av.iaFalhou': 'The AI failed ({m}). Suggested by sound instead.',

    't.irPonto': 'Go to this point in the video',
    't.legendaEm': 'Caption at {t}',
    't.incluir': 'Include moment {n}',
    't.abrirMomento': 'Open this moment in the editor',
    't.notaIA': 'Score the AI gave this moment',
    't.forcaSom': 'How much the sound stands out from the rest of the video',
    't.interface': 'Interface language',
    'tema.paraClaro': 'Switch to the light theme',
    'tema.paraEscuro': 'Switch to the dark theme',
  },

  es: {
    'pagina.titulo': 'Clipador — clips verticales en el navegador',
    'header.sub': 'Corta, encuadra en 9:16 y descarga. Todo funciona en tu navegador — nada se envía a un servidor.',
    'modo.curto.titulo': 'Clip corto',
    'modo.curto.desc': '¿Ya tienes el fragmento listo? Los subtítulos se generan solos.',
    'modo.curto.dica': 'Arrastra o haz clic · hasta 3 min',
    'modo.longo.titulo': 'Video largo',
    'modo.longo.desc': 'La app encuentra los mejores momentos, corta y subtitula cada uno.',
    'modo.longo.dica': 'Arrastra o haz clic · 10 min o más',
    'idioma.falado': 'Idioma hablado',
    'idioma.falado.titulo': 'Idioma hablado en el video',

    'mom.rotulo': 'Momentos',
    'mom.metodo.titulo': 'Cómo elegir los momentos',
    'mom.ia': 'Por IA (Gemini)',
    'mom.som': 'Por sonido',
    'mom.dur.titulo': 'Duración de cada clip',
    'mom.dur': 'Clips de {n} s',
    'mom.qtd.titulo': 'Cantidad máxima de clips',
    'mom.qtd': 'Hasta {n}',
    'mom.legendar': 'Subtitular',
    'mom.chave': 'Clave de Gemini',
    'mom.chave.placeholder': 'Pega aquí tu clave de API',
    'mom.chave.link': 'Crear clave gratis',
    'mom.dica': 'Elige las opciones de arriba y haz clic en Buscar momentos.',
    'mom.encontrar': 'Buscar momentos',
    'mom.denovo': 'Buscar de nuevo',
    'mom.gerar1': 'Generar 1 clip',
    'mom.gerarN': 'Generar {n} clips',

    'trecho': 'Fragmento',
    'inicio': 'Inicio',
    'fim': 'Fin',
    'marcar': 'Marcar',
    'marcar.inicio.titulo': 'Usar el punto actual del video como inicio',
    'marcar.fim.titulo': 'Usar el punto actual del video como fin',
    'duracao': 'Duración: {s}s',
    'ver': 'Ver fragmento',
    'formato': 'Formato',
    'fmt.vertical': 'Vertical 9:16',
    'fmt.desfocado': 'Fondo desenfocado',
    'fmt.original': 'Original',
    'enquadramento': 'Encuadre',
    'esq': 'Izq.',
    'dir': 'Der.',
    'resolucao': 'Resolución',
    'res.720': '720 × 1280 (exporta más rápido)',
    'legenda': 'Subtítulos',
    'legenda.gerar': 'Generar subtítulos',
    'legenda.denovo': 'Generar de nuevo',
    'legenda.remover': 'Quitar',
    'exportar': 'Exportar clip',
    'aguarde': 'Espera…',
    'trocar': 'Cambiar video',
    'clipes.titulo': 'Clips exportados',
    'baixar': 'Descargar',
    'remover': 'Quitar',
    'preparando': 'Preparando…',

    'a.naoVideo': 'Este archivo no parece ser un video.',
    'a.naoAbre': 'El navegador no pudo abrir este video. Prueba con un .mp4 (H.264), el formato más compatible.',
    'a.fimDepois': 'El fin tiene que ir después del inicio.',
    'a.curto': 'El fragmento debe durar al menos medio segundo.',
    'a.marque': 'Marca al menos un momento.',

    's.carregando': 'Cargando el motor de video (solo tarda la primera vez)…',
    's.lendo': 'Leyendo el video…',
    's.cortando': 'Cortando…',
    's.processando': 'Procesando (puede tardar unos minutos)…',
    's.pronto': '¡Listo! Exportado en {s}s.',
    's.erro': 'Error: {m}',
    's.baixandoIA': 'Descargando la IA de subtítulos (solo la primera vez)…',
    's.ouvindoTrecho': 'Escuchando el fragmento y escribiendo los subtítulos…',
    's.extraindo': 'Extrayendo el audio del fragmento…',
    's.semFala': 'No encontré voz en este fragmento.',
    's.legendaPronta': 'Subtítulos listos: {n} bloques. Revisa el texto antes de exportar.',
    's.erroLegenda': 'Error en los subtítulos: {m}',
    's.ouvindoTudo': 'Escuchando el video completo para encontrar los mejores momentos…',
    's.encontrei': 'Encontré {n} momentos. Revísalos y haz clic en Generar clips.',
    's.nada': 'No encontré momentos que destaquen por el sonido. Marca los fragmentos a mano.',
    's.erroAnalise': 'Error en el análisis: {m}',
    's.preparandoIA': 'Preparando el audio para la IA…',
    's.iaOuvindo': 'La IA está escuchando el video y eligiendo los momentos…',
    's.lote': 'Clip {a} de {b} — ',
    's.loteFim': '{a} de {b} clips listos. Están en "Clips exportados".',

    'd.longoDemais': 'Video de más de 3 min: marca el fragmento y haz clic en Generar subtítulos.',
    'd.trechoMudou': 'El fragmento cambió — genera los subtítulos de nuevo.',
    'd.original': 'El formato Original no recodifica, así que sale sin subtítulos.',

    'e.grande': 'este video es demasiado grande para este navegador (más de 1,5 GB)',
    'e.ffmpeg': 'FFmpeg falló (código {c}). {p}',
    'e.iaLegenda': 'la IA de subtítulos no cargó',
    'e.semAudio': 'no pude extraer el audio (¿el video tiene sonido?)',
    'e.comprimir': 'no pude comprimir el audio',
    'e.longoIA': 'video demasiado largo para la IA, el límite es de cerca de 1h15',
    'e.prepararAudio': 'no pude preparar el audio',
    'e.chave': 'clave rechazada (error {c})',
    'e.semModelo': 'no encontré un modelo Gemini Flash disponible para esta clave',
    'e.demanda': 'Gemini tiene mucha demanda ahora. Inténtalo de nuevo en unos minutos.',
    'e.semResposta': 'la IA no devolvió respuesta',

    'av.semChave': 'Pega tu clave de Gemini para usar la IA. Por ahora, sugerí por el sonido.',
    'av.iaNada': 'La IA no encontró buenos momentos. Sugerí por el sonido.',
    'av.iaFalhou': 'La IA falló ({m}). Sugerí por el sonido.',

    't.irPonto': 'Ir a este punto del video',
    't.legendaEm': 'Subtítulo en {t}',
    't.incluir': 'Incluir el momento {n}',
    't.abrirMomento': 'Abrir este momento en el editor',
    't.notaIA': 'Nota que la IA le dio al momento',
    't.forcaSom': 'Cuánto destaca el sonido frente al resto del video',
    't.interface': 'Idioma de la interfaz',
    'tema.paraClaro': 'Cambiar al tema claro',
    'tema.paraEscuro': 'Cambiar al tema oscuro',
  },
};

export const IDIOMAS = Object.keys(TEXTOS); // ['pt', 'en', 'es']
const GUARDADO = 'clipador.idiomaInterface';
const LANG_HTML = { pt: 'pt-BR', en: 'en', es: 'es' };

/** Idioma inicial: o que o usuário escolheu antes; senão, o do navegador; senão, português. */
function idiomaInicial() {
  try {
    const salvo = localStorage.getItem(GUARDADO);
    if (IDIOMAS.includes(salvo)) return salvo;
  } catch { /* sem localStorage */ }
  const doNavegador = (typeof navigator !== 'undefined' ? navigator.language || '' : '').slice(0, 2).toLowerCase();
  return IDIOMAS.includes(doNavegador) ? doNavegador : 'pt';
}

let atual = idiomaInicial();
const ouvintes = [];

export const idiomaAtual = () => atual;

/** Devolve o texto da chave no idioma atual, trocando {variaveis}. */
export function t(chave, variaveis = {}) {
  const texto = TEXTOS[atual][chave] ?? TEXTOS.pt[chave] ?? chave;
  return texto.replace(/\{(\w+)\}/g, (_, nome) => (nome in variaveis ? variaveis[nome] : `{${nome}}`));
}

/** Preenche todo elemento do HTML marcado com data-i18n (e variações pra atributos). */
export function aplicarTraducoes(raiz = document) {
  raiz.querySelectorAll('[data-i18n]').forEach((no) => {
    no.textContent = t(no.dataset.i18n, no.dataset); // data-n="20" vira a variável {n}
  });
  raiz.querySelectorAll('[data-i18n-title]').forEach((no) => { no.title = t(no.dataset.i18nTitle); });
  raiz.querySelectorAll('[data-i18n-placeholder]').forEach((no) => { no.placeholder = t(no.dataset.i18nPlaceholder); });
  raiz.querySelectorAll('[data-i18n-aria]').forEach((no) => { no.setAttribute('aria-label', t(no.dataset.i18nAria)); });
  document.documentElement.lang = LANG_HTML[atual];
  document.title = t('pagina.titulo');
}

/** Troca o idioma, salva a escolha e avisa quem pediu pra ser avisado. */
export function definirIdioma(idioma) {
  if (!IDIOMAS.includes(idioma) || idioma === atual) return;
  atual = idioma;
  try { localStorage.setItem(GUARDADO, idioma); } catch { /* sem localStorage */ }
  aplicarTraducoes();
  ouvintes.forEach((avisar) => avisar(idioma));
}

/** Registra uma função pra rodar sempre que o idioma mudar (pra textos montados via JS). */
export function aoTrocarIdioma(funcao) {
  ouvintes.push(funcao);
}

/** Uso em testes: confere se todos os idiomas têm as mesmas chaves. */
export function chavesFaltando() {
  const base = Object.keys(TEXTOS.pt);
  return Object.fromEntries(IDIOMAS.map((i) => [i, [
    ...base.filter((c) => !(c in TEXTOS[i])),
    ...Object.keys(TEXTOS[i]).filter((c) => !(c in TEXTOS.pt)).map((c) => `+${c}`),
  ]]));
}
