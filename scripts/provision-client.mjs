#!/usr/bin/env node
// Sobe uma instância Docker isolada e nova do MM System Creator (Pubx) pra
// um cliente específico, nesta mesma máquina — chamado pelo MMSystemCreator
// (server/modules/companies/provisioning.ts) logo após o pagamento ser
// confirmado. Reaproveita o mesmo docker-compose.independent.yml/imagem de
// sempre; o isolamento vem só de rodar com um nome de projeto (`-p`) e um
// .env próprios por cliente — nada é copiado.
//
// Variáveis de entrada (todas obrigatórias):
//   CLIENT_SLUG, APP_PORT, MYSQL_PORT, S3_PORT, S3_CONSOLE_PORT,
//   SAAS_CORE_API_KEY, OUT_DIR (pasta onde este script escreve o .env do
//   cliente — fica FORA do repositório, nunca commitado).
//
// Saída: uma única linha JSON no stdout, sempre por último:
//   sucesso -> {"ok":true,"url":...,"adminUsername":...,"adminPassword":...}
//   falha   -> {"ok":false,"error":"..."}
// O ruído do build/docker compose vai todo pro stderr, de propósito, pra
// quem chama este script poder confiar que a ÚLTIMA linha do stdout é
// sempre o resultado.

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function randomSecret(bytes) {
  return randomBytes(bytes).toString("hex");
}

function buildEnvFile({ appPort, mysqlPort, s3Port, s3ConsolePort, saasCoreApiKey, clientSlug }) {
  const examplePath = join(repoRoot, "config", "env.example");
  let content = readFileSync(examplePath, "utf8");

  const adminUsername = "admin";
  const adminPassword = randomSecret(6);

  // MYSQL_PASSWORD/MYSQL_ROOT_PASSWORD/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY
  // bastam pra isolar este cliente — DATABASE_URL e S3_ENDPOINT internos são
  // reconstruídos pelo próprio docker-compose.independent.yml a partir deles
  // (usam sempre os hostnames de rede "db"/"storage", nunca o valor daqui).
  const singleLineReplacements = {
    JWT_SECRET: randomSecret(32),
    BOOTSTRAP_ADMIN_USERNAME: adminUsername,
    BOOTSTRAP_ADMIN_PASSWORD: adminPassword,
    S3_ACCESS_KEY_ID: randomSecret(8),
    S3_SECRET_ACCESS_KEY: randomSecret(16),
    SAAS_CORE_URL: "http://host.docker.internal:4000",
    SAAS_CORE_API_KEY: saasCoreApiKey,
    APP_ID: clientSlug,
  };

  for (const [key, value] of Object.entries(singleLineReplacements)) {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    content = pattern.test(content) ? content.replace(pattern, `${key}=${value}`) : `${content}\n${key}=${value}`;
  }

  content += [
    "",
    "# Gerado por scripts/provision-client.mjs — não editar à mão.",
    `MYSQL_DATABASE=pubx`,
    `MYSQL_USER=pubx`,
    `MYSQL_PASSWORD=${randomSecret(12)}`,
    `MYSQL_ROOT_PASSWORD=${randomSecret(12)}`,
    `APP_PORT=${appPort}`,
    `MYSQL_PORT=${mysqlPort}`,
    `S3_PORT=${s3Port}`,
    `S3_CONSOLE_PORT=${s3ConsolePort}`,
    "",
  ].join("\n");

  return { content, adminUsername, adminPassword };
}

function runComposeUp(envPath, projectName) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      ["compose", "-f", "docker-compose.independent.yml", "--env-file", envPath, "-p", projectName, "up", "-d", "--build"],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] },
    );
    child.stdout.on("data", (chunk) => process.stderr.write(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`docker compose up saiu com código ${code}`))));
  });
}

async function waitUntilReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // ainda subindo — tenta de novo
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Timeout esperando ${url} responder.`);
}

async function main() {
  const clientSlug = requiredEnv("CLIENT_SLUG");
  const appPort = requiredEnv("APP_PORT");
  const mysqlPort = requiredEnv("MYSQL_PORT");
  const s3Port = requiredEnv("S3_PORT");
  const s3ConsolePort = requiredEnv("S3_CONSOLE_PORT");
  const saasCoreApiKey = requiredEnv("SAAS_CORE_API_KEY");
  const outDir = requiredEnv("OUT_DIR");
  const projectName = `pubx-${clientSlug}`;

  mkdirSync(outDir, { recursive: true });

  const { content, adminUsername, adminPassword } = buildEnvFile({ appPort, mysqlPort, s3Port, s3ConsolePort, saasCoreApiKey, clientSlug });
  const envPath = join(outDir, ".env");
  writeFileSync(envPath, content, "utf8");

  await runComposeUp(envPath, projectName);
  await waitUntilReady(`http://localhost:${appPort}/readyz`, 5 * 60 * 1000);

  console.log(JSON.stringify({ ok: true, url: `http://localhost:${appPort}`, adminUsername, adminPassword }));
}

main().catch((error) => {
  console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
