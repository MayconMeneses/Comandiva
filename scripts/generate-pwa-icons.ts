// Gera os ícones do PWA + favicon a partir da logo oficial em
// client/public/mm-logo-icon.png (marca "MM System Creator", já um PNG
// quadrado com fundo próprio — nenhuma forma é desenhada aqui).
//
// Rodar de novo sempre que a logo mudar (troca de marca/cliente):
//   npx tsx scripts/generate-pwa-icons.ts
//
// Saída: client/public/icons/{icon-192,icon-512,maskable-512,apple-touch-icon}.png
//        client/public/{favicon-32,favicon-16}.png

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = path.resolve(import.meta.dirname, "../client/public");
const SOURCE = path.join(PUBLIC_DIR, "mm-logo-icon.png");
const ICONS_DIR = path.join(PUBLIC_DIR, "icons");

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });

  const targets: Array<{ file: string; size: number; dir: string; safeZonePad?: number }> = [
    { file: "icon-192.png", size: 192, dir: ICONS_DIR },
    { file: "icon-512.png", size: 512, dir: ICONS_DIR },
    // Ícone "maskable" — sistemas Android recortam até 40% das bordas, então
    // precisa de margem extra além da que a própria logo já tem.
    { file: "maskable-512.png", size: 512, dir: ICONS_DIR, safeZonePad: 0.2 },
    // Tamanho recomendado pela Apple pra ícone de home screen no iOS.
    { file: "apple-touch-icon.png", size: 180, dir: ICONS_DIR },
    { file: "favicon-32.png", size: 32, dir: PUBLIC_DIR },
    { file: "favicon-16.png", size: 16, dir: PUBLIC_DIR },
  ];

  const bg = await sampleCornerColor();

  for (const { file, size, dir, safeZonePad = 0 } of targets) {
    const png = await renderSquare(size, bg, safeZonePad);
    await sharp(png).toFile(path.join(dir, file));
    console.log(`[pwa-icons] gerado ${path.relative(PUBLIC_DIR, path.join(dir, file))} (${size}x${size})`);
  }
}

async function sampleCornerColor(): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sharp(SOURCE).raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = [data[0], data[1], data[2]];
  void info;
  return { r, g, b };
}

async function renderSquare(size: number, bg: { r: number; g: number; b: number }, safeZonePad: number): Promise<Buffer> {
  const inner = Math.round(size * (1 - safeZonePad));
  const resized = await sharp(SOURCE).resize(inner, inner, { fit: "contain", background: bg }).png().toBuffer();
  if (safeZonePad === 0) return resized;
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

main().catch(error => {
  console.error("[pwa-icons] falhou:", error);
  process.exit(1);
});
