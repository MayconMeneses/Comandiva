/**
 * Redimensiona/recomprime uma imagem no navegador antes do upload, para reduzir
 * o peso do arquivo (fotos de celular costumam vir com vários MB e resolução
 * muito maior do que o necessário para o site). Mantém o mesmo contentType da
 * imagem original (JPEG continua JPEG, PNG continua PNG — preserva transparência).
 *
 * Formatos que o canvas não sabe recodificar de forma confiável em todos os
 * navegadores (SVG, AVIF) passam direto, sem compressão.
 */

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = url;
  });
}

export type CompressedImage = { base64: string; contentType: string; filename: string };

export async function compressImageFile(
  file: File,
  { maxDimension = 1600, quality = 0.85 }: { maxDimension?: number; quality?: number } = {},
): Promise<CompressedImage> {
  if (!COMPRESSIBLE_TYPES.has(file.type)) {
    return { base64: await blobToBase64(file), contentType: file.type, filename: file.name };
  }

  try {
    const img = await loadImageElement(file);
    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    URL.revokeObjectURL(img.src);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível.");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, file.type, quality));
    if (!blob || blob.size >= file.size) {
      // Não piora o arquivo original — usa o original se a compressão não ajudou.
      return { base64: await blobToBase64(file), contentType: file.type, filename: file.name };
    }
    return { base64: await blobToBase64(blob), contentType: file.type, filename: file.name };
  } catch {
    // Qualquer falha na compressão não pode bloquear o envio — usa o arquivo original.
    return { base64: await blobToBase64(file), contentType: file.type, filename: file.name };
  }
}
