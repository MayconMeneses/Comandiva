import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./env";

/**
 * Proteção do envio público de cardápio (public.uploadMenuReference),
 * auditoria de segurança 2026-10-10.
 *
 * Antes qualquer visitante mandava arquivo pro Telegram do dono em nome de
 * QUALQUER restaurante, só trocando o restaurantId sequencial (1, 2, 3...) —
 * e a resposta "não encontrado" x "enviado" ainda enumerava os ids. Agora o
 * cadastro devolve um token assinado, amarrado àquele restaurante e com
 * validade curta; só quem acabou de se cadastrar o tem. Sem tabela nova: é um
 * HMAC (mesmo segredo de sessão do Painel Master), nada fica guardado.
 */
export const MENU_UPLOAD_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

function sign(restaurantId: number, expiresAt: number): string {
  return createHmac("sha256", ENV.platformJwtSecret).update(`menu-upload:${restaurantId}:${expiresAt}`).digest("hex");
}

export function createMenuUploadToken(restaurantId: number, now = Date.now()): string {
  const expiresAt = now + MENU_UPLOAD_TOKEN_TTL_MS;
  return `${expiresAt}.${sign(restaurantId, expiresAt)}`;
}

export function verifyMenuUploadToken(restaurantId: number, token: string, now = Date.now()): boolean {
  if (!ENV.platformJwtSecret) return false;
  const [expiresRaw, signature, ...rest] = token.split(".");
  if (!expiresRaw || !signature || rest.length > 0) return false;
  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < now) return false;
  const expected = Buffer.from(sign(restaurantId, expiresAt));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

const hasPrefix = (bytes: Buffer, prefix: number[], offset = 0) => prefix.every((value, index) => bytes[offset + index] === value);

/**
 * Confere os primeiros bytes do arquivo contra o tipo declarado — o mimeType
 * vem do navegador de quem envia, então sozinho não prova nada (um executável
 * podia chegar ao celular do dono como "application/pdf").
 */
export function fileMatchesDeclaredType(bytes: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case "application/pdf":
      return hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case "image/png":
      return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
    case "image/webp":
      return hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) && hasPrefix(bytes, [0x57, 0x45, 0x42, 0x50], 8); // RIFF....WEBP
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04]); // zip (docx)
    case "application/msword":
      return hasPrefix(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // OLE2 (doc)
    default:
      return false;
  }
}
