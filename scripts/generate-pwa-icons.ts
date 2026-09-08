// Gera os ícones do PWA (manifest.webmanifest + apple-touch-icon) a partir do
// logo já existente em client/public/pubx-logo.svg — não inventa nenhuma
// marca/forma nova. O círculo laranja e o glifo branco em forma de "P" usados
// aqui são os MESMOS paths/cores daquele arquivo (só recortamos o wordmark
// completo — que tem texto "Pub X" — para o selo circular, porque um ícone
// quadrado pequeno (192px) não tem espaço legível pra texto).
//
// Rodar de novo sempre que o logo mudar (troca de marca branca/cliente):
//   npx tsx scripts/generate-pwa-icons.ts
//
// Saída: client/public/icons/{icon-192,icon-512,maskable-512,apple-touch-icon}.png

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PWA_BRANDING } from "../pwa.config";

const OUT_DIR = path.resolve(import.meta.dirname, "../client/public/icons");

// viewBox quadrado (0,0,160,160) recortado do pubx-logo.svg original (320x160):
// mantém o fundo escuro, o círculo laranja (cx=80,cy=80,r=45) e o glifo "P"
// branco (mesmo path do original), que já ficam bem centralizados nesse
// recorte. O texto "Pub X" e o pedaço do "u" cor creme do wordmark original
// ficam de fora — não cabem de forma legível num ícone quadrado pequeno.
// A margem generosa ao redor do círculo (35px de 160, ~22%) já deixa esse
// desenho dentro da "safe zone" que ícones maskable exigem (conteúdo dentro
// de um raio de 40% a partir do centro), então o mesmo SVG serve tanto para
// os ícones normais quanto para o maskable.
function buildSquareIconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <rect width="160" height="160" fill="${PWA_BRANDING.backgroundColor}"/>
  <circle cx="80" cy="80" r="45" fill="#b4472d"/>
  <path d="M62 104V55h21c17 0 27 8 27 22s-10 22-27 22H74v5H62Zm12-17h9c10 0 15-3 15-10s-5-10-15-10h-9v20Z" fill="#fffaf3"/>
</svg>`;
}

async function renderPng(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const svg = buildSquareIconSvg();

  const targets: Array<{ file: string; size: number }> = [
    { file: "icon-192.png", size: 192 },
    { file: "icon-512.png", size: 512 },
    // Mesmo desenho, servido também como "maskable" no manifest — a margem
    // já existente ao redor do círculo cobre a safe zone exigida.
    { file: "maskable-512.png", size: 512 },
    // Tamanho recomendado pela Apple pra ícone de home screen no iOS.
    { file: "apple-touch-icon.png", size: 180 },
  ];

  for (const { file, size } of targets) {
    const png = await renderPng(svg, size);
    await writeFile(path.join(OUT_DIR, file), png);
    console.log(`[pwa-icons] gerado ${path.join("client/public/icons", file)} (${size}x${size}, ${(png.length / 1024).toFixed(1)} KB)`);
  }
}

main().catch(error => {
  console.error("[pwa-icons] falhou:", error);
  process.exit(1);
});
