import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { ENV } from "./env";
import { setRestaurantDeploymentUrl } from "../db/restaurants";
import { buildEnvironmentProvisionedMessage, buildEnvironmentProvisioningFailedMessage, sendTelegramMessageAsync } from "./telegramService";

const execFileAsync = promisify(execFile);

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
 * Sobe uma instância Docker isolada e nova do sistema (mesmo repositório e
 * imagem de sempre, isolado só por nome de projeto + portas próprias — ver
 * scripts/provision-client.mjs no repositório do sistema) pra um
 * restaurante-cliente que acabou de pagar. Fogo-e-esquece: chamado logo
 * depois do restaurante ser criado, nunca bloqueia a resposta do webhook —
 * subir um container do zero (build incluído) pode levar minutos.
 *
 * Nunca lança — falha aqui não pode desfazer o restaurante/pagamento já
 * confirmado (mesma regra de sendEmailAsync/sendTelegramMessageAsync). Em
 * branco = desligado: a equipe sobe o ambiente na mão, como já fazia antes
 * desta automação existir.
 */
export async function provisionSystemInstance(params: { restaurantId: number; restaurantName: string; apiKey: string }): Promise<void> {
  if (!ENV.systemRepoPath || !ENV.systemDeploymentsDir) {
    console.log(`[system-provisioning] SYSTEM_REPO_PATH/SYSTEM_DEPLOYMENTS_DIR não configurados — provisionamento automático desligado pro restaurante #${params.restaurantId}.`);
    return;
  }

  const slug = slugifyRestaurantName(params.restaurantName, params.restaurantId);
  const ports = computeDeploymentPorts(params.restaurantId);
  const outDir = join(ENV.systemDeploymentsDir, slug);

  try {
    const { stdout } = await execFileAsync(
      "node",
      ["scripts/provision-client.mjs"],
      {
        cwd: ENV.systemRepoPath,
        env: {
          ...process.env,
          CLIENT_SLUG: slug,
          APP_PORT: String(ports.appPort),
          MYSQL_PORT: String(ports.mysqlPort),
          S3_PORT: String(ports.s3Port),
          S3_CONSOLE_PORT: String(ports.s3ConsolePort),
          SAAS_CORE_API_KEY: params.apiKey,
          OUT_DIR: outDir,
        },
        // Build do zero (primeira vez) pode levar vários minutos, ainda mais
        // com a máquina sob carga — timeout generoso de propósito, não é bug.
        // Medido ao vivo: só o passo `chown -R node:node /app` da imagem
        // chegou a levar 11+ min sozinho nesta máquina (mesmo gargalo já
        // visto antes no Pubx), então 15 min cortava o build bem na reta
        // final (na hora de exportar a imagem). 30 min dá folga de verdade.
        timeout: 30 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    // O script só garante que a ÚLTIMA linha do stdout é o resultado —
    // tudo antes é ruído de build/docker compose, jogado no stderr por ele
    // mesmo, mas alguma ferramenta no meio do caminho pode vazar linha extra.
    const lastLine = stdout.trim().split("\n").pop() ?? "";
    const result = JSON.parse(lastLine) as
      | { ok: true; url: string; adminUsername: string; adminPassword: string }
      | { ok: false; error: string };

    if (!result.ok) throw new Error(result.error);

    await setRestaurantDeploymentUrl(params.restaurantId, result.url);
    sendTelegramMessageAsync(
      buildEnvironmentProvisionedMessage({
        restaurantId: params.restaurantId,
        restaurantName: params.restaurantName,
        url: result.url,
        adminUsername: result.adminUsername,
        adminPassword: result.adminPassword,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[system-provisioning] Falha ao provisionar restaurante #${params.restaurantId}:`, message);
    sendTelegramMessageAsync(buildEnvironmentProvisioningFailedMessage({ restaurantId: params.restaurantId, restaurantName: params.restaurantName, error: message }));
  }
}
