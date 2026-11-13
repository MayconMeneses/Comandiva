/**
 * Textos reais, tirados do site comercial atual
 * (../Site comercial/src/pages/Home.tsx). Nada de número, depoimento ou
 * promessa nova aqui. Todas as páginas (planos, cadastro, termos,
 * privacidade) existem dentro deste site.
 */

export const HERO = {
  eyebrow: "Sistema para restaurantes",
  titleLines: ["Seu restaurante", "com sistema próprio."],
  /** Linha do título e trecho que recebe a cor de destaque. */
  titleKeyword: ["com sistema próprio.", "sistema próprio."] as const,
  titleMuted: "Não com o app do concorrente do lado.",
  /** Selo acima do título. Mesma condição de Planos.tsx e data/home.ts ("Sem comissão por pedido"). */
  badge: "Sem comissão por pedido",
  lead:
    "Cardápio digital, pedidos, entregas e relatórios com a marca do seu restaurante. Sem pagar comissão por venda, sem dividir vitrine com ninguém.",
  primaryCta: "Ver planos e começar",
  secondaryCta: "Ver por dentro",
  /** Selos de risco zero. Fontes: Planos.tsx:54, Termos.tsx:34-35, data/home.ts:30,54,120. */
  checks: ["7 dias grátis", "Sem cartão de crédito", "Sem comissão por pedido", "Cancele quando quiser"],
  previewTitle: "Veja o seu restaurante aqui",
  previewLabel: "Nome do seu restaurante",
  previewPlaceholder: "Ex.: Cantina do Bairro",
  previewEmpty: "Seu restaurante",
  previewNote: "Demonstração: o nome fica só na sua tela, nada é enviado nem guardado.",
  ticketsTitle: "O pedido entra no painel. A comissão fica em R$ 0.",
};

/** Pedidos de demonstração: os mesmos dados fictícios dos prints reais do painel. */
export const DEMO_ORDERS = [
  { code: "CD-UQQVTRS", name: "Fernanda Dias", items: "1× Picanha · 1× Pudim", total: 57, mode: "Entrega" },
  { code: "CD-3A7LQ9P", name: "Juliana Rocha", items: "2× X-Tudo · 2× Brownie", total: 60, mode: "Retirada" },
  { code: "CD-7T2QT5P", name: "Rafael Lima", items: "1× X-Bacon · 1× Coca-Cola 2L", total: 32, mode: "Entrega" },
  { code: "CD-3QMTPPN", name: "Mariana Costa", items: "2× X-Bacon · 2× Coca-Cola Lata", total: 40, mode: "Retirada" },
  { code: "CD-XWP43YE", name: "Pedro Santos", items: "1× X-Salada · 1× Coca-Cola Lata", total: 20, mode: "Retirada" },
];

/** Taxa usada só na simulação do hero; o site atual fala em "até 30%". */
export const APP_FEE_RATE = 0.3;

