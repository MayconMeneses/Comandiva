import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const ISSUER = "MM System Creator";

/** Segredo novo em base32 — cada tentativa de setup gera um, só é salvo de vez quando o primeiro código bate (ver masterPanel/auth.ts). */
export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function buildTotp(email: string, secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({ issuer: ISSUER, label: email, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
}

/** `window: 1` tolera 1 período (±30s) de dessincronia de relógio do celular — mesmo padrão comum de apps de autenticador. */
export function verifyTotpToken(token: string, secret: string, email: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  return buildTotp(email, secret).validate({ token, window: 1 }) !== null;
}

export async function buildTotpQrCodeDataUrl(email: string, secret: string): Promise<string> {
  const uri = buildTotp(email, secret).toString();
  return QRCode.toDataURL(uri, { margin: 1, width: 240 });
}
