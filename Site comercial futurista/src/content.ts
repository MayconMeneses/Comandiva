/**
 * Textos e links reais, tirados do site comercial atual
 * (../Site comercial/src/pages/Home.tsx). Nada de número, depoimento ou
 * promessa nova aqui.
 *
 * As páginas Planos/Cadastro continuam no site atual; os links apontam
 * para lá até esta versão ser portada para o Master.
 */
export const SITE_URL = "https://mmsystem.tech/comercial";
export const PLANOS_URL = `${SITE_URL}/planos`;
export const TERMOS_URL = `${SITE_URL}/termos`;
export const PRIVACIDADE_URL = `${SITE_URL}/privacidade`;

export const HERO = {
  eyebrow: "Sistema para restaurantes",
  titleLines: ["Seu restaurante", "com sistema próprio."],
  titleMuted: "Não com o app do concorrente do lado.",
  lead:
    "Cardápio digital, pedidos, entregas e relatórios com a marca do seu restaurante. Sem pagar comissão por venda, sem dividir vitrine com ninguém.",
  primaryCta: "Ver planos e começar",
  secondaryCta: "Ver por dentro",
  checks: ["7 dias grátis", "Sem cartão de crédito", "Cancele quando quiser"],
};

/** Pedidos de demonstração: os mesmos dados fictícios dos prints reais do painel. */
export const DEMO_ORDERS = [
  { code: "PX-UQQVTRS", name: "Fernanda Dias", items: "1× Picanha · 1× Pudim", total: 57, mode: "Entrega" },
  { code: "PX-3A7LQ9P", name: "Juliana Rocha", items: "2× X-Tudo · 2× Brownie", total: 60, mode: "Retirada" },
  { code: "PX-7T2QT5P", name: "Rafael Lima", items: "1× X-Bacon · 1× Coca-Cola 2L", total: 32, mode: "Entrega" },
  { code: "PX-3QMTPPN", name: "Mariana Costa", items: "2× X-Bacon · 2× Coca-Cola Lata", total: 40, mode: "Retirada" },
  { code: "PX-XWP43YE", name: "Pedro Santos", items: "1× X-Salada · 1× Coca-Cola Lata", total: 20, mode: "Retirada" },
];

/** Taxa usada só na simulação do hero; o site atual fala em "até 30%". */
export const APP_FEE_RATE = 0.3;

export const MARQUEE_ITEMS = [
  "Zero comissão por pedido",
  "Pix e cartão via Mercado Pago",
  "Mesas com QR Code",
  "Cardápio com a sua marca",
  "Fila da cozinha sem papel",
  "Aguenta internet ruim",
  "7 dias grátis, sem cartão",
  "WhatsApp direto com quem fez o sistema",
];
