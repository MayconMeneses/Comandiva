/**
 * Dados da narrativa "a vida de um pedido" (seção "Veja por dentro").
 * Restaurante de DEMONSTRAÇÃO. Os preços do cardápio fecham com os pedidos
 * fictícios de data/board.ts (ex.: Picanha + Pudim = R$ 57, o pedido em destaque).
 * Os nomes de status do celular são os do app (OrderTracking.tsx).
 */
import { SAVINGS } from "./home";
import { FEATURED_ORDER } from "./board";

export type MenuItem = { id: string; name: string; hint: string; price: number };

export const DEMO_RESTAURANT = "Restaurante Demonstração";

export const MENU: MenuItem[] = [
  { id: "picanha", name: "Picanha", hint: "Com arroz e farofa", price: 45 },
  { id: "xbacon", name: "X-Bacon", hint: "Hambúrguer artesanal", price: 16 },
  { id: "pudim", name: "Pudim", hint: "Sobremesa da casa", price: 12 },
  { id: "coca", name: "Coca-Cola Lata", hint: "350 ml", price: 4 },
];

/** Itens que o cursor fantasma toca (são os do FEATURED_ORDER: 1× Picanha · 1× Pudim). */
export const PICKS = ["picanha", "pudim"] as const;
export const PICK_TOTALS = PICKS.reduce<number[]>((acc, id) => {
  const price = MENU.find(m => m.id === id)?.price ?? 0;
  acc.push((acc[acc.length - 1] ?? 0) + price);
  return acc;
}, []);
export const CART_TOTAL = PICK_TOTALS[PICK_TOTALS.length - 1];
export const ORDER_TOTAL = FEATURED_ORDER.total;

/** Fases da cena. Cada "beat" é um quadro; o quadro 5 (índice 4) tem dois beats (aceito, em produção). */
export const BEAT_FRAME = [0, 1, 2, 3, 4, 4, 5, 6] as const;
/** Índice em BOARD_STEPS usado em cada beat (null = painel ainda não apareceu). */
export const BEAT_BOARD_STEP = [null, null, null, 0, 1, 2, 4, null] as const;
/** Status do celular do cliente em cada beat (nomes do app). */
export const BEAT_STATUS = [null, null, null, "Pedido recebido", "Pedido aceito", "Em preparo", "Saiu para entrega", null] as const;
export const STATUS_FLOW = ["Pedido recebido", "Pedido aceito", "Em preparo", "Saiu para entrega"] as const;

export type Frame = { title: string; text: string; detail: string };

export const FRAMES: Frame[] = [
  {
    title: "O cliente abre o seu cardápio",
    text: "Ele abre o link do seu cardápio direto no celular. Aqui, um restaurante de demonstração.",
    detail: "Cardápio de demonstração com picanha, X-Bacon, pudim e refrigerante.",
  },
  {
    title: "Escolhe sem baixar nada",
    text: "Toca nos itens e o carrinho soma o total na hora. Tudo pelo navegador, sem instalar aplicativo.",
    detail: "Carrinho: 1× Picanha e 1× Pudim, total R$ 57,00.",
  },
  {
    title: "Paga no Pix",
    text: "Na tela do pedido aparecem o QR Code e o Pix copia e cola. Com a cobrança automática ativa, o pedido atualiza sozinho assim que o cliente paga.",
    detail: "Tela de acompanhamento com QR Code, Pix copia e cola e o botão Copiar.",
  },
  {
    title: "A comanda cai na cozinha",
    text: "O pedido entra sozinho em Aguardando aceite, já com os itens e o valor certos. Ninguém copia comanda à mão.",
    detail: "Painel: pedido CD-UQQVTRS de Fernanda Dias em Aguardando aceite. No celular: Pedido recebido.",
  },
  {
    title: "Você aceita e acompanha",
    text: "Aceite e passe para produção em poucos toques. O cliente vê cada mudança de status na tela de acompanhamento.",
    detail: "O pedido passa por Aceitos e Em produção. No celular: Pedido aceito, depois Em preparo.",
  },
  {
    title: "Saiu para entrega",
    text: "Ao enviar para entrega, o status muda no painel e também na tela do cliente.",
    detail: "Painel com o carimbo de saída para entrega. No celular: Saiu para entrega.",
  },
  {
    title: "No fim do mês, sem comissão",
    text: "Um app de entrega cobra até 30% por venda (simulação). Na Comandiva a mensalidade é fixa e a comissão é R$ 0.",
    detail: "Extrato simulado: app de entrega com comissão de até 30%; Comandiva com comissão R$ 0.",
  },
];

/** Extrato do último quadro: mesmas constantes (SAVINGS) da calculadora. */
const sales = SAVINGS.defaultCents / 100;
const commission = Math.round(sales * SAVINGS.commissionRate);
export const EXTRATO = {
  sales,
  commission,
  plan: SAVINGS.basePlanCents / 100,
  receivedApp: sales - commission,
  receivedUs: sales - SAVINGS.basePlanCents / 100,
  note: "Simulação com comissão de até 30%, o teto cobrado por apps de entrega. Na Comandiva a mensalidade é fixa.",
};
