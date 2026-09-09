#!/usr/bin/env node
// Smoke test pós-deploy do saas-core (Painel Master).
// Propositalmente simples e sem login real: só confirma que o serviço subiu
// e está respondendo, sem depender de credenciais do superadmin de bootstrap.
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4000";

const home = await fetch(`${baseUrl}/`);
if (!home.ok) throw new Error(`Página inicial não respondeu: ${home.status}`);

const version = await fetch(`${baseUrl}/version`);
if (!version.ok) throw new Error(`/version não respondeu: ${version.status}`);
const versionBody = await version.json().catch(() => null);
if (!versionBody || typeof versionBody.version !== "string") {
  throw new Error(`/version respondeu sem o campo "version" esperado: ${JSON.stringify(versionBody)}`);
}

console.log(`Smoke saas-core aprovado: home=${home.status}, version=${versionBody.version} (commit=${versionBody.commit ?? "unknown"})`);
