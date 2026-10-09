// Branding do PWA (Progressive Web App) — usado por `vite.config.ts` (injeta o
// manifest.webmanifest e as meta tags de tema) e por `scripts/generate-pwa-icons.mjs`
// (gera os ícones a partir do logo em client/public/comandiva-icon.png).
//
// Este é o ÚNICO lugar que deve mudar ao adaptar este mesmo código para um
// cliente-restaurante diferente: troque os valores abaixo, troque
// `client/public/comandiva-icon.png` pelo logo do
// cliente e rode `node scripts/generate-pwa-icons.mjs` de novo. Não é preciso
// mexer em nenhum outro arquivo para isso.
//
// Observação: `client/index.html` também tem um `<meta name="theme-color">` e
// um `<link rel="apple-touch-icon">` fixos (HTML puro não é templável pelo
// Vite sem um sistema de build extra) — se mudar `themeColor` ou os ícones
// aqui, atualize aquelas duas linhas também. É a única duplicação aceita.
export const PWA_BRANDING = {
  /** Nome completo — aparece na tela de instalação e no splash screen. */
  name: "Comandiva — Peça online",
  /** Nome curto — aparece embaixo do ícone na home screen (máx. ~12 chars). */
  shortName: "Comandiva",
  /** Descrição curta usada no manifest. */
  description: "Peça online no Comandiva: hambúrgueres artesanais, pizzas, porções e bebidas. Delivery ou retirada, com acompanhamento do pedido em tempo real.",
  /** Cor da barra de status/tema do navegador e do splash screen. */
  themeColor: "#15120f",
  /** Cor de fundo do splash screen mostrado durante o carregamento do app instalado. */
  backgroundColor: "#15120f",
} as const;
