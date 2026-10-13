#!/usr/bin/env node
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const required = [
  "package.json",
  "pnpm-lock.yaml",
  "client/src/App.tsx",
  "server/_core/index.ts",
  "server/routers.ts",
  "server/db.ts",
  "drizzle/schema.ts",
  "scripts/seed.ts",
  "scripts/backup-db.mjs",
  "scripts/restore-db.mjs",
  "config/env.example",
  "README-INDEPENDENT.md",
  "docs/portability-audit.md",
  "docs/independent-install.md",
  "docs/data-migration.md",
];

const root = process.cwd();
for (const item of required) await access(path.join(root, item));

const secretPattern = /(?:sk-[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY-----)/;
const proprietaryPattern = new RegExp([
  [109, 97, 110, 117, 115],
  [102, 111, 114, 103, 101],
  [79, 65, 85, 84, 72],
  [66, 85, 73, 76, 84, 95, 73, 78],
  [108, 111, 99, 97, 108, 45, 115, 116, 111, 114, 97, 103, 101],
  [118, 105, 116, 101, 45, 112, 108, 117, 103, 105, 110],
].map(chars => String.fromCharCode(...chars)).join("|"), "i");
const ignoredDirectories = new Set(["node_modules", ".git", ".logs", "dist"]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".css", ".html", ".yml", ".yaml", ".txt"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name) || entry.name === ".project-config.json") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(absolute)));
    else if (textExtensions.has(path.extname(entry.name)) || entry.name === ".gitignore") result.push(absolute);
  }
  return result;
}

for (const file of await walk(root)) {
  const relative = path.relative(root, file);
  const text = await readFile(file, "utf8");
  if (secretPattern.test(text)) throw new Error(`Possível segredo encontrado em ${relative}`);
  if (proprietaryPattern.test(text)) throw new Error(`Referência proprietária encontrada em ${relative}`);
}

console.log(`Exportação independente íntegra: ${required.length} arquivos essenciais conferidos; sem segredos ou referências proprietárias.`);
