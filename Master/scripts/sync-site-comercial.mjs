// Copia o código do Site comercial (pasta irmã "Site comercial/src") para dentro do
// Master (client/src/site-comercial), que é quem compila e publica o site.
//
//   node scripts/sync-site-comercial.mjs           copia uma vez (roda sozinho antes de dev/build/check/test)
//   node scripts/sync-site-comercial.mjs --watch   copia de novo a cada alteração no Site comercial
//
// Se a pasta irmã NÃO existir (build no Docker/VPS), mantém a cópia que já está em
// client/src/site-comercial — o deploy envia essa pasta junto com o Master.
import { cpSync, existsSync, mkdirSync, rmSync, watch } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const masterDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.SITE_COMERCIAL_DIR
  ? resolve(process.env.SITE_COMERCIAL_DIR)
  : resolve(masterDir, "..", "Site comercial", "src");
const target = resolve(masterDir, "client", "src", "site-comercial");

function sync() {
  if (!existsSync(source)) {
    if (existsSync(target)) {
      console.log(`[site-comercial] Pasta de origem não encontrada (${source}); usando a cópia já presente em client/src/site-comercial.`);
      return true;
    }
    console.error(`[site-comercial] ERRO: pasta de origem não encontrada: ${source}\n` +
      "  Defina SITE_COMERCIAL_DIR ou coloque o projeto 'Site comercial' ao lado do Master.");
    return false;
  }
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  console.log("[site-comercial] Sincronizado: Site comercial/src -> client/src/site-comercial");
  return true;
}

if (!sync()) process.exit(1);

if (process.argv.includes("--watch")) {
  let timer;
  watch(source, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 150);
  });
  console.log("[site-comercial] Observando alterações em", source);
}
