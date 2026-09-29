/**
 * Título + descrição por página do site comercial (/comercial/*) — fonte
 * única, usada tanto pelo client (usePageMeta.ts, pra quem executa JS)
 * quanto pelo servidor (server/_core/vite.ts, injetado direto no HTML
 * antes de mandar a resposta). Sem essa segunda parte, bots que não
 * executam JS de verdade — o preview do WhatsApp/Instagram/LinkedIn ao
 * colar um link, por exemplo — só viam o título/descrição estáticos e
 * genéricos do Painel Master (ver client/index.html), porque a SPA inteira
 * usa o mesmo HTML pra qualquer rota. Só as páginas listadas aqui recebem
 * essa injeção server-side; o resto (Termos, Privacidade, fluxo de
 * cadastro) continua com o fallback padrão — são páginas que ninguém
 * compartilha fora do funil, sem necessidade de OG próprio ainda.
 */
export const COMMERCIAL_PAGE_META: Record<string, { title: string; description: string }> = {
  "/comercial": {
    title: "Sistema para Restaurante sem Comissão — Cardápio Digital e Pedidos Online | MM System Creator",
    description: "Sistema completo para restaurante: cardápio digital, pedidos online, entregas e pagamento por Pix e cartão, sem comissão por venda. 7 dias grátis, sem cartão de crédito.",
  },
  "/comercial/planos": {
    title: "Planos e Preços — Sistema para Restaurante a partir de R$ 99,99/mês | MM System Creator",
    description: "Compare os planos do MM System Creator: cardápio digital, pedidos online, mesas com QR Code, cozinha e relatórios. A partir de R$ 99,99/mês, sem comissão por pedido. 7 dias grátis.",
  },
};
