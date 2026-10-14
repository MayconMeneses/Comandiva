/**
 * Validação de segredos no boot (auditoria de segurança 2026-10-10).
 *
 * `fatal` impede o servidor de subir (segredo que assina sessão fraco ou ainda
 * com o texto de exemplo do .env.example); `warnings` só avisam no log.
 * Função pura, sem ler process.env, pra poder ser testada.
 */
const MIN_SECRET_LENGTH = 32;

// Textos de exemplo que já passariam do tamanho mínimo se alguém copiasse o
// .env.example sem trocar (ex.: "gere-um-segredo-aleatorio-com-pelo-menos-32-caracteres").
const PLACEHOLDER_PATTERN = /(gere-um|troque-por|troque-essa|change-?me|your-secret|seu-segredo|exemplo|example|test-only)/i;

type SecretCheckInput = {
  cookieSecret: string;
  supportSessionSecret: string;
  // Opcional: chave que criptografa segredos no banco (secretBox). Vazia = texto puro (aviso em produção).
  dataEncryptionKey?: string;
  saasCoreUrl: string;
  isProduction: boolean;
};

function checkSigningSecret(name: string, value: string, required: boolean, fatal: string[]) {
  if (!value) {
    if (required) fatal.push(`${name} ausente (precisa de pelo menos ${MIN_SECRET_LENGTH} caracteres aleatórios).`);
    return;
  }
  if (value.length < MIN_SECRET_LENGTH) fatal.push(`${name} fraco (${value.length} caracteres; precisa de pelo menos ${MIN_SECRET_LENGTH}).`);
  else if (PLACEHOLDER_PATTERN.test(value)) fatal.push(`${name} ainda está com o texto de exemplo do .env.example — gere um valor aleatório de verdade.`);
}

export function checkSecrets(input: SecretCheckInput): { fatal: string[]; warnings: string[] } {
  const fatal: string[] = [];
  const warnings: string[] = [];

  checkSigningSecret("JWT_SECRET", input.cookieSecret, true, fatal);
  // Vazio = Modo Suporte desligado (falha fechada), mas se estiver preenchido precisa ser forte:
  // quem o conhece forja uma sessão de suporte com acesso quase total ao restaurante.
  checkSigningSecret("SUPPORT_SESSION_SECRET", input.supportSessionSecret, false, fatal);
  // Vazia = chaves de gateway ficam em texto puro no banco (só aviso, pra não derrubar quem ainda não configurou).
  // Preenchida e fraca = fatal: criptografar com chave curta dá falsa sensação de segurança.
  checkSigningSecret("DATA_ENCRYPTION_KEY", input.dataEncryptionKey ?? "", false, fatal);
  if (input.isProduction && !input.dataEncryptionKey) {
    warnings.push("DATA_ENCRYPTION_KEY não configurada: as chaves dos gateways de pagamento ficam em texto puro no banco. Gere uma chave e rode scripts/encrypt-gateway-keys.ts.");
  }

  if (input.isProduction && /^http:\/\//i.test(input.saasCoreUrl) && !/^http:\/\/(localhost|127\.0\.0\.1|[a-z0-9-]+(:\d+)?(\/|$))/i.test(input.saasCoreUrl)) {
    warnings.push("SAAS_CORE_URL usa http:// (sem criptografia): a chave de API do restaurante e os tokens do Modo Suporte trafegam em texto puro. Use https://.");
  }
  return { fatal, warnings };
}
