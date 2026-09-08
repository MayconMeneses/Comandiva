/**
 * Áreas do Painel Master que um admin "member" (não-owner) pode ganhar,
 * marcadas uma a uma na hora do cadastro — mesmo raciocínio de
 * shared/permissions.ts no app principal (GRANTABLE_STAFF_AREAS): "owner"
 * sempre tem tudo, "member" só o que foi marcado, aditivo e nunca o
 * contrário. Compartilhado entre client (checkboxes) e server (validação).
 */
export const GRANTABLE_MASTER_AREAS = ["restaurantes", "planos", "auditoria", "modo_suporte", "billing", "equipe", "manutencao"] as const;
export type MasterPermissionArea = (typeof GRANTABLE_MASTER_AREAS)[number];

export const MASTER_AREA_LABELS: Record<MasterPermissionArea, string> = {
  restaurantes: "Restaurantes (ver/editar clientes)",
  planos: "Planos e features",
  auditoria: "Auditoria",
  modo_suporte: "Modo Suporte (acessar o painel de um restaurante)",
  billing: "Cobrança (configurar/ajustar assinatura de um restaurante)",
  equipe: "Equipe (gerenciar outras contas do Painel Master)",
  // Hoje é só leitura (versão rodando) — deploy/rollback disparado por aqui
  // ainda não existe de verdade, precisa de decisão de arquitetura antes
  // (como o Master alcançaria a VPS com segurança).
  manutencao: "Manutenção (ver versão/saúde do sistema)",
};
