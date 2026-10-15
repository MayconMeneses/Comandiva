/**
 * Dados da recriação do painel de pedidos (seção "Veja por dentro").
 * Pedidos fictícios iguais aos dos prints reais; textos dos passos tirados
 * do site comercial atual.
 */
export type CardState = { label: string; meta: string; progress: number; action: string; tone?: "late" };
export type BoardOrder = { code: string; name: string; total: number; items: string; mode: string; state: CardState };

const WAITING: CardState = { label: "Aceite", meta: "10 min · 25%", progress: 0.25, action: "Aceitar pedido" };
const IN_PREP: CardState = { label: "Produção", meta: "15 min · 38%", progress: 0.38, action: "Enviar para entrega" };

export const FEATURED_ORDER: BoardOrder = {
  code: "PX-UQQVTRS",
  name: "Fernanda Dias",
  total: 57,
  items: "1× Picanha · 1× Pudim",
  mode: "Entrega",
  state: WAITING,
};

export const BOARD_COLUMNS: { title: string; hint: string; bg: string; orders: BoardOrder[] }[] = [
  {
    title: "Aguardando aceite",
    hint: "Pedidos novos aguardando confirmação.",
    bg: "bg-[#fbf6e4]",
    orders: [{ code: "PX-3QMTPPN", name: "Mariana Costa", total: 40, items: "2× X-Bacon · 2× Coca-Cola Lata", mode: "Retirada", state: WAITING }],
  },
  {
    title: "Aceitos",
    hint: "Pedidos confirmados, prontos para iniciar.",
    bg: "bg-[#eef4fb]",
    orders: [
      {
        code: "PX-3A7LQ9P",
        name: "Juliana Rocha",
        total: 60,
        items: "2× X-Tudo · 2× Brownie",
        mode: "Retirada",
        state: { label: "Preparo", meta: "9 min · 23%", progress: 0.23, action: "Iniciar produção" },
      },
    ],
  },
  {
    title: "Em produção",
    hint: "Pedidos em preparo na cozinha.",
    bg: "bg-[#f1eefb]",
    orders: [{ code: "PX-7T2QT5P", name: "Rafael Lima", total: 32, items: "1× X-Bacon · 1× Coca-Cola 2L", mode: "Entrega", state: IN_PREP }],
  },
];

/** column = índice da coluna onde o pedido em destaque está; null = já saiu. */
export const BOARD_STEPS: { title: string; text: string; column: number | null; card: CardState }[] = [
  {
    title: "O pedido chega sozinho",
    text: "O pedido entra sozinho, já com o valor certo. Ninguém precisa copiar comanda à mão.",
    column: 0,
    card: { label: "Aceite", meta: "2 min · 8%", progress: 0.08, action: "Aceitar pedido" },
  },
  {
    title: "Você aceita em um toque",
    text: "Aceite, coloque em produção e envie para entrega em poucos toques.",
    column: 1,
    card: { label: "Preparo", meta: "4 min · 15%", progress: 0.15, action: "Iniciar produção" },
  },
  {
    title: "A cozinha vê a fila",
    text: "Os pedidos aceitos aparecem em ordem de chegada, sem papel e sem gritaria.",
    column: 2,
    card: { label: "Produção", meta: "12 min · 45%", progress: 0.45, action: "Enviar para entrega" },
  },
  {
    title: "Atrasou? Fica vermelho",
    text: "A barra de tempo de preparo fica vermelha quando atrasa.",
    column: 2,
    card: { label: "Produção", meta: "Atrasado · 14 min", progress: 1, action: "Enviar para entrega", tone: "late" },
  },
  {
    title: "Saiu para entrega",
    text: "Cardápio, mesa, entrega e relatório do mês reunidos no mesmo lugar.",
    column: null,
    card: { label: "Entrega", meta: "", progress: 1, action: "Entregue" },
  },
];
