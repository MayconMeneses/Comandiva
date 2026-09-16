import { assertSafeDeploymentUrl } from "./urlSafety";

/**
 * Pede ao deployment real de um restaurante pra sincronizar plano/features
 * agora (em vez de esperar o polling periódico dele) — usado pelo botão
 * "Forçar sincronização" no Painel Master, principalmente depois de trocar
 * o plano de um restaurante ou rotacionar a API key dele.
 */
export async function triggerRemoteLicenseSync(deploymentUrl: string): Promise<{ triggered: boolean; error?: string }> {
  try {
    assertSafeDeploymentUrl(deploymentUrl);
  } catch (error) {
    return { triggered: false, error: error instanceof Error ? error.message : "URL de deployment inválida." };
  }
  try {
    const response = await fetch(`${deploymentUrl.replace(/\/+$/, "")}/api/webhooks/license-refresh`, {
      method: "POST",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { triggered: false, error: `O deployment respondeu ${response.status}.` };
    return { triggered: true };
  } catch {
    return { triggered: false, error: "Não foi possível alcançar o deployment agora (pode estar fora do ar)." };
  }
}
