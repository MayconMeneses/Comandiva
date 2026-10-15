/**
 * Planos, preços, recursos e limites — copiados de
 * ../Master/scripts/seed-plans.ts (fonte real, conferida em 2026-10-14) e
 * dos textos de ../Site comercial/src/pages/Planos.tsx.
 *
 * São a RESERVA: a página de Planos busca os dados vivos na mesma API do
 * site atual (`public.plans`, ver lib/usePlans.ts) e só usa estes se a API
 * não responder — preço exibido = preço cobrado.
 */
export type PlanKey = "essencial" | "profissional" | "premium";

export type Plan = {
  key: PlanKey;
  name: string;
  priceCents: number;
  tagline: string;
  users: number | null;
  tables: number | null;
  maintenance: string;
  /** Recursos liberados (ids), quando vierem da API. Sem isso, vale o `minPlan` do catálogo. */
  features?: string[];
};

export const PLANS: Plan[] = [
  {
    key: "essencial",
    name: "Entrada",
    priceCents: 9990,
    tagline: "Quero receber pedidos e ter meu próprio canal de vendas.",
    users: 3,
    tables: 0,
    maintenance: "Sob consulta (R$ 100 por acionamento)",
  },
  {
    key: "profissional",
    name: "Profissional",
    priceCents: 14990,
    tagline: "Quero organizar meu restaurante, cozinha e salão.",
    users: 8,
    tables: 12,
    maintenance: "Inclusa",
  },
  {
    key: "premium",
    name: "Premium",
    priceCents: 19990,
    tagline: "Quero tudo do Comandiva, sem limitações e com gestão avançada.",
    users: null,
    tables: null,
    maintenance: "Inclusa",
  },
];

/** Lançamento: 20% de desconto na mensalidade nos 2 primeiros meses (texto da página atual). */
export const LAUNCH_DISCOUNT = 0.2;

export type Feature = { id: string; name: string; description: string; minPlan: PlanKey };

/** Agrupado por categoria para a tabela ficar fácil de ler. */
export const FEATURE_GROUPS: { title: string; features: Feature[] }[] = [
  {
    title: "Vendas e pagamento",
    features: [
      { id: "menu", name: "Cardápio digital", description: "Prato, foto e preço sempre em dia, com a sua marca.", minPlan: "essencial" },
      { id: "orders", name: "Pedidos online", description: "Cada pedido chega pronto pra produção, sem comissão.", minPlan: "essencial" },
      { id: "payments", name: "Pagamento por Pix e cartão", description: "Processado pelo Mercado Pago, direto na sua conta.", minPlan: "essencial" },
      {
        id: "offline_resilience",
        name: "Pedido resistente a conexão instável",
        description: "Se a internet do cliente cair no meio do pedido, o sistema tenta de novo sozinho, sem duplicar.",
        minPlan: "essencial",
      },
    ],
  },
  {
    title: "Cozinha e operação",
    features: [
      { id: "kitchen", name: "Cozinha / Kanban de pedidos", description: "Tela de fila da cozinha e o kanban de pedidos.", minPlan: "profissional" },
      { id: "team_app", name: "App da equipe (celular/tablet)", description: "Painel instalado no aparelho da equipe pra acesso rápido.", minPlan: "profissional" },
    ],
  },
  {
    title: "Salão e mesas",
    features: [
      { id: "tables_qr", name: "Mesas / QR Code", description: "Cliente pede pela própria mesa escaneando um QR Code.", minPlan: "profissional" },
      { id: "call_waiter", name: "Chamar garçom", description: "Botão de chamar a equipe direto da mesa.", minPlan: "profissional" },
      { id: "request_bill", name: "Solicitar conta", description: "Cliente pede a conta pela própria mesa.", minPlan: "profissional" },
      { id: "extra_rounds", name: "Rodadas extras", description: "Lançar novos pedidos numa comanda de mesa já aberta.", minPlan: "profissional" },
      { id: "commands", name: "Comandas e divisão de conta", description: "Abrir/fechar comanda, dividir a conta por pessoa ou forma de pagamento.", minPlan: "profissional" },
      { id: "reservations", name: "Reservas", description: "Reservas de mesa com aviso de horário próximo.", minPlan: "profissional" },
    ],
  },
  {
    title: "Marketing",
    features: [
      { id: "promotions", name: "Promoções e combos", description: "Preço promocional no cardápio pra girar os dias fracos.", minPlan: "profissional" },
      { id: "custom_theme", name: "Tema de cor personalizado", description: "Cor da marca no cardápio e no painel, entre 7 opções.", minPlan: "profissional" },
      { id: "events", name: "Eventos", description: "Divulgar eventos com imagem grande direto no cardápio.", minPlan: "premium" },
    ],
  },
  {
    title: "Relatórios e gestão",
    features: [
      { id: "reports_complete", name: "Relatórios completos", description: "Faturamento por dia/hora/pagamento, produtos e categorias mais vendidos.", minPlan: "profissional" },
      { id: "reports_advanced", name: "Relatórios avançados", description: "Clientes novos x recorrentes, produtos em alta/queda, exportação.", minPlan: "premium" },
      { id: "advanced_team", name: "Gestão avançada da equipe", description: "Permissões por área para as contas da equipe.", minPlan: "premium" },
      { id: "audit", name: "Auditoria", description: "Histórico completo de ações da equipe sobre os pedidos.", minPlan: "premium" },
    ],
  },
];

const ORDER: Record<PlanKey, number> = { essencial: 0, profissional: 1, premium: 2 };

/** Base de todo plano (não vem como recurso na API: é o produto em si). */
const BASE_IDS = new Set(["menu", "orders", "payments"]);

export function includes(plan: Plan, feature: Feature): boolean {
  if (BASE_IDS.has(feature.id)) return true;
  if (plan.features) return plan.features.includes(feature.id);
  return ORDER[plan.key] >= ORDER[feature.minPlan];
}

/** O que o plano acrescenta em relação ao anterior (cartões ficam curtos e comparáveis). */
export function addedIn(plans: Plan[], index: number, groups = FEATURE_GROUPS): Feature[] {
  const plan = plans[index];
  const prev = plans[index - 1];
  return groups.flatMap(g => g.features).filter(f => includes(plan, f) && !(prev && includes(prev, f)));
}

/** Cadastro dentro deste site (chama a mesma API do Master, que avisa o dono no Telegram). */
export const SIGNUP_URL = (plan: PlanKey) => `/cadastro/${plan}`;
