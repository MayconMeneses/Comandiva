/**
 * Áreas extras que uma conta STAFF pode ganhar além do básico (pedidos/mesas,
 * sempre disponível pra qualquer staff — não faz parte desta lista). Cada uma
 * corresponde a um router hoje admin-only (ver server/routers/admin/*.ts).
 * Áreas sensíveis (Pix/gateway de pagamento, gestão de outras contas,
 * plano/licença) NUNCA entram aqui de propósito — ficam permanentemente
 * admin-only, mesmo raciocínio já usado pro denylist do Modo Suporte
 * (adminOnlyProcedure) em server/_core/trpc.ts. Compartilhado entre client
 * (checkboxes de permissão) e server (validação/gate), igual shared/legal.ts.
 */
// "faq" ficou de fora de propósito: FaqManager vive dentro da mesma página de
// Configuração que edita a chave Pix (client/src/components/admin/SiteConfig.tsx)
// — não dá pra liberar só o FAQ pra staff sem também expor esse campo.
export const GRANTABLE_STAFF_AREAS = ["catalog", "customers", "promotions", "events", "deliveryRoutes", "reports"] as const;
export type StaffPermissionArea = (typeof GRANTABLE_STAFF_AREAS)[number];

export const STAFF_AREA_LABELS: Record<StaffPermissionArea, string> = {
  catalog: "Cardápio",
  customers: "Clientes",
  promotions: "Promoções",
  events: "Eventos",
  deliveryRoutes: "Rotas de entrega",
  reports: "Relatórios e métricas",
};
