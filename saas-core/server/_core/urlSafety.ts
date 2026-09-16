// Valida `deploymentUrl` (URL do deployment real de um restaurante-cliente,
// informada pelo operador no Painel Master) contra hosts que só serviriam
// pra abuso: redirect aberto no handoff do Modo Suporte (o token de curta
// duração viaja na query string dessa URL) ou, se essa URL for usada em
// fetch servidor-a-servidor (ver remoteLicenseSync.ts), SSRF contra a rede
// interna do próprio VPS. Checagem deliberadamente simples (não resolve
// DNS) — bloqueia os casos óbvios sem exigir I/O de rede numa mutation.
const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
];

export function assertSafeDeploymentUrl(rawUrl: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL de deployment inválida.");
  }
  if (url.protocol !== "https:") {
    throw new Error("A URL de deployment precisa começar com https://.");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (PRIVATE_HOST_PATTERNS.some(pattern => pattern.test(hostname))) {
    throw new Error("A URL de deployment não pode apontar para um endereço local/privado.");
  }
}
