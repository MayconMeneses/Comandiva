/**
 * Título + descrição por página do site comercial (/comercial/*) — fonte
 * única, usada tanto pelo client (usePageMeta.ts, pra quem executa JS)
 * quanto pelo servidor (server/_core/vite.ts, injetado direto no HTML
 * antes de mandar a resposta). Sem essa segunda parte, bots que não
 * executam JS de verdade — o preview do WhatsApp/Instagram/LinkedIn ao
 * colar um link, por exemplo — só viam o título/descrição estáticos e
 * genéricos do Painel Master (ver client/index.html), porque a SPA inteira
 * usa o mesmo HTML pra qualquer rota. Só as páginas listadas aqui recebem
 * essa injeção server-side. O fluxo de cadastro (Cadastro/Sucesso/
 * Confirmando/Cardapio) fica de fora DE PROPÓSITO — são páginas
 * transacionais, dependentes do estado de quem está no meio do cadastro
 * ("Cadastro recebido!", "Confirmando seu pagamento..."), nunca destinadas
 * a busca/compartilhamento — dar OG/título de busca a elas não faz sentido
 * e poderia até confundir (uma dessas páginas "rankeando" no Google).
 */
export const COMMERCIAL_PAGE_META: Record<string, { title: string; description: string }> = {
  "/comercial": {
    // Títulos até ~60 caracteres e descrições até ~155 (acima disso o Google corta).
    title: "Sistema para Restaurante sem Comissão | Comandiva",
    description: "Sistema para restaurante com cardápio digital, pedidos online e Pix, sem comissão por venda. Teste 7 dias grátis, sem cartão de crédito.",
  },
  "/comercial/planos": {
    title: "Planos e Preços — Sistema para Restaurante | Comandiva",
    description: "Compare os planos do Comandiva: cardápio digital, pedidos e mesas com QR Code. A partir de R$ 99,90/mês, sem comissão. 7 dias grátis.",
  },
  "/comercial/termos": {
    title: "Termos de Uso | Comandiva",
    description: "Termos de uso do Comandiva: como funciona a assinatura mensal, o que está incluído e as condições de uso do sistema para restaurantes.",
  },
  "/comercial/privacidade": {
    title: "Política de Privacidade e LGPD | Comandiva",
    description: "Política de privacidade do Comandiva: quais dados coletamos, para que usamos, como protegemos e como exercer seus direitos pela LGPD.",
  },
};
