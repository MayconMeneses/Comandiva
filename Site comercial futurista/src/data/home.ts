import { asset } from "../lib/asset";

/**
 * Textos das seções da Home, tirados de ../Site comercial/src/pages/Home.tsx
 * e SavingsCalculator.tsx. Nada novo prometido aqui.
 */

export const SAVINGS = {
  commissionRate: 0.3, // "até 30%", o mesmo número usado no site atual
  basePlanCents: 9990, // plano de entrada (seed-plans.ts)
  minCents: 300_000,
  maxCents: 10_000_000,
  stepCents: 100_000,
  defaultCents: 2_000_000,
};

export const COMPARISON = [
  { label: "Comissão por pedido", us: "R$ 0, mensalidade fixa", them: "Até 30% por venda" },
  { label: "Marca exibida pro cliente", us: "A sua", them: "A do aplicativo" },
  { label: "Dados de contato do seu cliente", us: "Seus, pra sempre", them: "Do aplicativo" },
  { label: "Personalização do cardápio/visual", us: "Total", them: "Definida pelo aplicativo" },
];

export type DiferencialKey = "comissao" | "marca" | "testado" | "internet" | "pagamento" | "gratis";

export const DIFERENCIAIS: { key: DiferencialKey; title: string; description: string }[] = [
  {
    key: "comissao",
    title: "Zero comissão por pedido",
    description: "Aplicativo de entrega costuma cobrar até 30% em cima de cada venda. Aqui a mensalidade é fixa — o resto da venda é seu.",
  },
  {
    key: "internet",
    title: "Aguenta internet ruim na hora do pedido",
    description: "Se a conexão do cliente cair no meio do pedido, o sistema tenta enviar de novo sozinho — sem duplicar e sem perder a venda. Em todos os planos.",
  },
  {
    key: "marca",
    title: "A marca é do seu restaurante",
    description: "Cardápio, checkout e acompanhamento de pedido com a cara do seu negócio — não a de um concorrente na mesma vitrine.",
  },
  {
    key: "pagamento",
    title: "Pagamento pronto pra usar",
    description: "Pix e cartão via Mercado Pago, caindo direto na sua conta, sem integração manual. As taxas do Mercado Pago são informadas por ele.",
  },
  {
    key: "testado",
    title: "Sistema testado de verdade",
    description: "Não é protótipo nem MVP de vitrine: é o mesmo sistema que roda a operação real de um restaurante, todo santo dia.",
  },
  {
    key: "gratis",
    title: "7 dias grátis, sem cartão",
    description: "Organizamos seu cardápio e sua configuração em até 10 dias úteis — só depois disso, com tudo pronto, o teste grátis de 7 dias começa a contar.",
  },
];

export const TELAS = [
  {
    src: asset("/assets/cardapio-pizzas.webp"),
    w: 1352,
    h: 633,
    alt: "Cardápio público com a categoria Pizza Tradicional, cada pizza com foto, descrição e preço",
    title: "Cardápio que dá vontade de pedir",
    caption: "O cliente navega por categorias, vê foto, descrição e preço de cada item e personaliza o pedido sozinho.",
  },
  {
    src: asset("/assets/visao-geral.webp"),
    w: 1356,
    h: 637,
    alt: "Visão geral do painel administrativo com pedidos do dia, faturamento e ticket médio",
    title: "Visão geral do dia",
    caption: "Pedidos de hoje, faturamento e ticket médio assim que você abre o painel.",
  },
  {
    src: asset("/assets/cozinha.webp"),
    w: 1353,
    h: 577,
    alt: "Tela da cozinha com a fila de pedidos em ordem de chegada",
    title: "Fila da cozinha",
    caption: "Os pedidos aceitos aparecem em ordem de chegada, sem papel e sem gritaria.",
  },
  {
    src: asset("/assets/comanda.webp"),
    w: 685,
    h: 613,
    alt: "Comanda digital de uma mesa com rodadas pedidas, total, valor pago e saldo",
    title: "Comanda da mesa",
    caption: "Rodadas lançadas, total, o que já foi pago e o saldo, com busca de produto para lançar a próxima rodada.",
  },
];

export const STEPS = [
  { title: "Escolha o plano", description: "Compare os recursos e escolha o que faz sentido pro tamanho do seu restaurante." },
  { title: "Cadastre seu restaurante", description: "Leva menos de 2 minutos — sem cartão de crédito, sem burocracia." },
  {
    title: "Comece a vender",
    description: "Nossa equipe organiza seu cardápio e sua configuração em até 10 dias úteis. Pronto, seu teste grátis de 7 dias começa a valer.",
  },
];

export const SUPORTE = [
  { title: "WhatsApp direto comigo", description: "Resposta rápida, sem robô e sem fila de espera." },
  { title: "Acesso remoto", description: "Se travar, eu entro no seu painel pra resolver junto com você — sem pedir sua senha." },
  { title: "Treinamento ao vivo", description: "Chamada de vídeo ensinando a usar o sistema, junto com a entrega do seu restaurante." },
];

export const FAQ = [
  {
    question: "Preciso saber mexer em sistema?",
    answer:
      "Não. Nossa equipe organiza seu cardápio e sua configuração inicial, e você ainda tem WhatsApp direto com quem construiu o sistema, acesso remoto pra resolver travas (sem pedir sua senha) e treinamento ao vivo por chamada de vídeo.",
  },
  {
    question: "Como funciona o teste grátis de 7 dias?",
    answer: "Assim que sua configuração estiver pronta (em até 10 dias úteis), o teste de 7 dias começa a valer — sem cartão de crédito.",
  },
  { question: "Posso cancelar ou trocar de plano quando quiser?", answer: "Sim, direto no seu painel, sem multa e sem fidelidade." },
  {
    question: "Meus dados ficam seguros?",
    answer:
      "Cada restaurante roda num deployment isolado — seus dados de cardápio, pedidos e clientes nunca ficam misturados com os de outro restaurante. Conexão sempre criptografada, senhas nunca guardadas em texto puro.",
  },
  {
    question: "Como funciona o pagamento?",
    answer: "Pix e cartão, processados com segurança pelo Mercado Pago. Nunca pedimos dados de cartão diretamente.",
  },
];

/** "Seu tempo vale mais que planilha e comanda de papel" (site atual). Fotos recortadas sem o logo/texto embutido. */
export const ROTINA = [
  {
    title: "Pense no crescimento, não na correria",
    image: asset("/assets/rotina-crescimento.webp"),
    w: 800,
    h: 711,
    description: "Troque hora apagando incêndio por hora pensando em cardápio novo, horário de pico e como girar mais nos dias fracos.",
  },
  {
    title: "Menos trabalho repetitivo",
    image: asset("/assets/rotina-menos-trabalho.webp"),
    w: 800,
    h: 630,
    description: "O pedido entra sozinho, já com o valor certo. Ninguém mais precisa copiar comanda à mão nem discutir troco no balcão.",
  },
  {
    title: "Tudo numa tela só",
    image: asset("/assets/rotina-tudo-tela.webp"),
    w: 800,
    h: 741,
    description: "Cardápio, mesa, entrega e relatório do mês reunidos no mesmo lugar — chega de abrir três sistemas diferentes pra fechar o caixa.",
  },
];

/** "Por que escolher o Comandiva?" (site atual). */
export const RESUMO = [
  {
    figure: "∞",
    title: "Sem limite de faturamento",
    description: "A mensalidade é fixa — não importa quanto seu restaurante venda, não tem cobrança extra por cima do seu faturamento.",
  },
  {
    figure: "R$ 0",
    title: "Sem comissão no delivery",
    description: "Receba os pedidos direto no seu próprio sistema, sem pagar taxa por venda como nos aplicativos de entrega.",
  },
  {
    figure: "3·8·∞",
    title: "Limites claros, sem pegadinha",
    description: "Cada plano já vem com o número de usuários definido, sem letra miúda: Entrada até 3, Profissional até 8, Premium sem limite de usuários.",
  },
];

/** "Serve pro seu restaurante, seja qual for o formato" (site atual) + plano que costuma servir (mesma regra do "Descubra seu plano"). */
export const PARA_QUEM = [
  {
    title: "Tem salão e mesas",
    description: "Cliente pede pela própria mesa com QR Code, chama a equipe e fecha a conta pelo celular, sem levantar.",
    plan: "Profissional ou Premium",
  },
  {
    title: "Trabalha só com delivery",
    description: "Cardápio e pedidos direto no seu sistema, com a sua marca — sem comissão por venda.",
    plan: "A partir do Entrada",
  },
  {
    title: "Está começando agora",
    description: "Plano de entrada pra até 3 usuários, com 7 dias grátis pra testar sem compromisso.",
    plan: "Entrada",
  },
  {
    title: "Já tem uma equipe maior",
    description: "Planos com até 8 usuários ou sem limite nenhum, com permissões separadas por área.",
    plan: "Profissional ou Premium",
  },
];

/** "Um sistema completo, sem juntar outros por fora" (site atual). */
export const MODULOS: { title: string; description: string; badge?: string }[] = [
  { title: "Cardápio digital", description: "Mantém prato, foto e preço sempre em dia, sem depender de ninguém pra atualizar." },
  { title: "Pedidos e entregas", description: "Cada pedido chega pronto pra produção, sem intermediário levando fatia da venda." },
  { title: "Pagamentos", description: "Pix ou cartão: o Mercado Pago processa tudo e repassa pro seu bolso, sem você mexer em nada." },
  {
    title: "Mesas e QR Code",
    badge: "Profissional e Premium",
    description: "O cliente chama o garçom, pede rodada extra e fecha a conta pelo celular, sem levantar da mesa.",
  },
  {
    title: "Promoções e eventos",
    badge: "Profissional e Premium",
    description: "Monta combos e datas especiais pra girar o movimento nos dias mais fracos da semana.",
  },
];
