/**
 * Fonte única de copy sobre cada recurso de plano — reaproveitada em 3
 * lugares (PlanAdmin.tsx "Meu plano", LockedFeatureFullPage/Card
 * "Recursos" e UpgradeNudgeModal) pra nunca ter a mesma descrição escrita 3
 * vezes de formas diferentes. `benefits` é a "prévia controlada" pedida na
 * reestruturação de planos: o usuário entende o que ganharia, sem conseguir
 * usar de verdade (regra 11).
 */
export type FeatureCatalogEntry = { name: string; description: string; benefits: string[] };

export const FEATURE_CATALOG: Record<string, FeatureCatalogEntry> = {
  tables_qr: {
    name: "Mesas / QR Code",
    description: "Cliente pede pela própria mesa escaneando um QR Code.",
    benefits: ["Mapa de mesas com status ao vivo", "QR Code próprio por mesa, regenerável", "Cliente pede direto do celular, sem esperar garçom"],
  },
  call_waiter: { name: "Chamar garçom", description: "Botão de chamar a equipe direto da mesa.", benefits: ["Aviso em tempo real no painel", "Reduz o tempo de espera do cliente"] },
  request_bill: { name: "Solicitar conta", description: "Cliente pede a conta pela própria mesa.", benefits: ["Fechamento de comanda mais rápido", "Sem precisar chamar a equipe só pra isso"] },
  extra_rounds: { name: "Rodadas extras", description: "Lançar novos pedidos numa comanda de mesa já aberta.", benefits: ["Cliente pede mais sem abrir nova comanda", "Tudo somado automaticamente na conta"] },
  commands: {
    name: "Comandas e divisão de conta",
    description: "Abrir/fechar comanda de mesa, dividir a conta por pessoa ou forma de pagamento.",
    benefits: ["Divida a conta por pessoa ou por forma de pagamento", "Reabra uma comanda fechada por engano"],
  },
  reservations: { name: "Reservas", description: "Cadastrar reservas de mesa com aviso de horário próximo.", benefits: ["Organize o salão com antecedência", "Aviso automático quando o horário se aproxima"] },
  promotions: {
    name: "Promoções e combos",
    description: "Criar promoções e combos com preço promocional no cardápio.",
    benefits: ["Preço de/por com desconto calculado automaticamente", "Combos com vários produtos em um clique", "Aumente o ticket médio"],
  },
  kitchen: {
    name: "Cozinha e painel operacional",
    description: "Tela de fila da cozinha e o kanban de pedidos em /painel-pedidos.",
    benefits: ["Fila única por ordem real de chegada", "Kanban visual por etapa do pedido", "Menos erro de pedido esquecido"],
  },
  team_app: {
    name: "App da equipe",
    description: "Instalar o painel no celular/tablet da equipe pra acesso rápido à operação.",
    benefits: ["Acesso rápido direto da tela inicial do celular/tablet", "Sem precisar digitar o endereço toda vez"],
  },
  reports_complete: {
    name: "Relatórios completos",
    description: "Faturamento por dia/hora/forma de pagamento, produtos e categorias mais vendidos.",
    benefits: ["Responde \"quanto vendi e o que está vendendo?\"", "Faturamento por dia, hora, pagamento e tipo de atendimento", "Ranking de produtos e categorias"],
  },
  events: { name: "Eventos", description: "Divulgar eventos com imagem grande direto no cardápio.", benefits: ["Destaque visual diferenciado no cardápio", "Atraia clientes pra datas específicas"] },
  reports_advanced: {
    name: "Relatórios avançados",
    description: "Clientes novos x recorrentes, produtos em alta/queda, indicadores de cancelamento, exportação.",
    benefits: ["Responde \"por que estou vendendo assim e onde posso melhorar?\"", "Clientes novos x recorrentes, frequência de compra", "Produtos em crescimento/queda, exportação em CSV"],
  },
  advanced_team: {
    name: "Gestão avançada da equipe",
    description: "Permissões granulares por área para contas da equipe, além de acesso total.",
    benefits: ["Escolha exatamente quais áreas cada pessoa acessa", "Equipe ilimitada"],
  },
  audit: {
    name: "Auditoria",
    description: "Histórico completo de ações da equipe sobre os pedidos.",
    benefits: ["Veja quem fez o quê e quando em cada pedido", "Registro que nunca é editado ou apagado"],
  },
  custom_theme: {
    name: "Tema de cor personalizado",
    description: "Escolha a cor de marca do cardápio público e do painel administrativo, entre 7 opções.",
    benefits: ["7 paletas prontas, testadas pra boa leitura", "Aplica no site público e no admin ao mesmo tempo", "Troque quando quiser, sem custo extra"],
  },
};
