/**
 * Reduz fotos de cardápio no navegador antes do envio: lado maior até 2400 px
 * e JPEG 85% — continua legível para a equipe e cai de 4–12MB (foto de
 * celular) para algo como 1–2MB. Envio mais rápido no 4G e quase nunca
 * esbarra no limite de 20MB. PDF e Word passam intactos.
 *
 * Se a foto já for leve, ou se a versão reduzida não ficar menor, devolve o
 * arquivo original.
 */
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIDE = 2400;
const SKIP_BELOW_BYTES = 1.5 * 1024 * 1024;

export async function compressImage(file: File): Promise<File> {
  if (!IMAGE_TYPES.has(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // formato que o navegador não lê: manda como veio
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= SKIP_BELOW_BYTES) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  // Fundo branco: PNG com transparência viraria preto no JPEG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
}

export const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")}MB`;
