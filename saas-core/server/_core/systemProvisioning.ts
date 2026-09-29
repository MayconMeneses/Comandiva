import { buildProvisionCommandMessage, sendTelegramMessageAsync } from "./telegramService";

/** Só letras minúsculas, números e hífen — mesma regra de nome de projeto/container do Docker Compose. */
export function slugifyRestaurantName(name: string, restaurantId: number): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  // Sufixo com o id garante unicidade sempre, sem precisar checar colisão
  // (dois restaurantes com o mesmo nome social nunca geram o mesmo slug).
  return `${base || "restaurante"}-${restaurantId}`;
}

export type DeploymentPorts = { appPort: number; mysqlPort: number; s3Port: number; s3ConsolePort: number };

/**
 * Portas derivadas direto do id do restaurante (determinístico, sem
 * precisar de contador/tabela própria) — base 5000 fica bem longe de tudo
 * que já roda nesta máquina (3000, 3011, 3306/3308, 4000, 5173, 9000/9001,
 * 9013/9014). Cada restaurante ganha uma faixa de 10 portas pra si.
 */
export function computeDeploymentPorts(restaurantId: number): DeploymentPorts {
  const appPort = 5000 + restaurantId * 10;
  return { appPort, mysqlPort: appPort + 100, s3Port: appPort + 200, s3ConsolePort: appPort + 201 };
}

/**
 * Provisionamento fica MANUAL de propósito (decisão do dono, 2026-09-29,
 * depois de pesar as opções) — automatizar de verdade (rodar `docker
 * compose`/`node scripts/provision-client.mjs` direto daqui) exigiria dar
 * ao container do saas-core acesso ao socket do Docker do host, ou montar
 * uma peça nova de infraestrutura só pra isso. Nenhum dos dois se justifica
 * pro volume atual (~1 cliente real) — e o primeiro, em especial, seria um
 * risco real: este processo fica exposto à internet e processa pagamento,
 * então comprometê-lo daria controle equivalente a root sobre a VPS
 * inteira. Fica pra quando o volume justificar (ver Pendências).
 *
 * Em vez disso, esta função só monta o comando PRONTO (mesmas variáveis
 * que scripts/provision-client.mjs sempre esperou) e manda pro Telegram —
 * a equipe cola na VPS e roda na hora que quiser. Nunca lança (mesma regra
 * de sendEmailAsync/sendTelegramMessageAsync) — mandar a notificação nunca
 * pode atrapalhar o restaurante/pagamento já confirmado.
 */
export function provisionSystemInstance(params: { restaurantId: number; restaurantName: string; apiKey: string }): void {
  const slug = slugifyRestaurantName(params.restaurantName, params.restaurantId);
  const ports = computeDeploymentPorts(params.restaurantId);
  const command = [
    `CLIENT_SLUG=${slug}`,
    `APP_PORT=${ports.appPort}`,
    `MYSQL_PORT=${ports.mysqlPort}`,
    `S3_PORT=${ports.s3Port}`,
    `S3_CONSOLE_PORT=${ports.s3ConsolePort}`,
    `SAAS_CORE_API_KEY=${params.apiKey}`,
    `OUT_DIR=~/deployments/${slug}`,
    "node scripts/provision-client.mjs",
  ].join(" ");

  sendTelegramMessageAsync(buildProvisionCommandMessage({ restaurantId: params.restaurantId, restaurantName: params.restaurantName, command }));
}
