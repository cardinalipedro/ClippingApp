// =====================================================================
//  aplicacao/preparar-video.js — passo comum a todos os casos de uso:
//  garantir que o motor está carregado e com o vídeo atual aberto.
// =====================================================================

/**
 * @param {import('./portas.js').MotorVideo} motor
 * @param {File} arquivo
 * @param {import('./portas.js').Relator} relator
 */
export async function prepararVideo(motor, arquivo, relator) {
  relator.status('s.carregando', 0);
  await motor.carregar();
  if (motor.estaCom(arquivo)) return;
  relator.status('s.lendo', 0);
  await motor.abrir(arquivo);
}
