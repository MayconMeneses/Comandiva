import { claimTotpStep, consumeRecoveryCode } from "../db/platformAdminSecurity";
import { findMatchingTotpStep } from "./totp";
import { decryptTotpSecret, hashRecoveryCode, normalizeRecoveryCode } from "./totpCrypto";

/**
 * Valida o "segundo fator" de uma conta com 2FA ligado: código de 6 dígitos
 * do app (TOTP, uso único por passo de 30s) OU código de recuperação
 * (XXXXX-XXXXX, uso único). Devolve qual dos dois valeu, ou null. Quem chama
 * é responsável pelo rate limit (reserveSecondFactorAttempt).
 */
export async function verifySecondFactorCode(admin: { id: number; email: string; totpSecret: string | null }, rawCode: string): Promise<"totp" | "recovery" | null> {
  const code = rawCode.trim();
  if (/^\d{6}$/.test(code)) {
    if (!admin.totpSecret) return null;
    const step = findMatchingTotpStep(code, decryptTotpSecret(admin.totpSecret), admin.email);
    if (step === null) return null;
    // Anti-replay atômico: código de passo já usado (ou mais antigo) é recusado.
    return (await claimTotpStep(admin.id, step)) ? "totp" : null;
  }
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return null;
  return (await consumeRecoveryCode(admin.id, hashRecoveryCode(normalized))) ? "recovery" : null;
}
