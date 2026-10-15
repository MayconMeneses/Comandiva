# Referências usadas

| Seção | Componente / fonte | Como foi adaptado |
|---|---|---|
| Preloader | Preloader (21st.dev, id 13967) — referência visual | Recriado como comanda "imprimindo" (clip-path), sai com cortina para cima; 1x por sessão; desligado com movimento reduzido |
| Hero — título | Vertical Cut Reveal (21st.dev, id 18595) — referência | `CutReveal.tsx`: palavra a palavra sob máscara, texto completo para leitor de tela |
| Hero — CTA | Magnetic Button (21st.dev, id 26725) — referência | `MagneticLink.tsx`: só mouse, mola do motion |
| Hero — comandas ao vivo | Number Ticker Currency (21st.dev, id 21513) — referência | `LiveTickets.tsx`: pedidos fictícios dos prints reais + medidor de comissão (simulação avisada na tela) |
| Marquee | Blurred Marquee (21st.dev, id 20147) e Marquee diceui (id 27531) — referência | CSS puro, 2 linhas em sentidos opostos (1 no celular), pausa no hover, picote tracejado |
| Veja por dentro | Container Scroll Animation (21st.dev, id 1081) + Kanban Board (21st.dev, id 26936) + Motion `layoutId` (MCP motion) | `KitchenBoard.tsx`: substituiu o print estático (que tinha barra de rolagem falsa) por recriação do painel guiada pela rolagem: o pedido anda de coluna em 5 passos |
| Planos — descubra seu plano | Plan Finder Pricing Comparison Table (21st.dev, id 37514) — referência | `PlanFinder.tsx`: 3 perguntas, plano indicado acende com selo animado (layoutId) |
| Planos — tabela | Dark Matrix Pricing Table (21st.dev, id 29260) — referência | `CompareTable.tsx`: agrupada por categoria, cabeçalho fixo, cabe em 320 px sem arrastar |
| Menu e cartões | Skill high-end-visual-design + Floating Navbar (21st.dev, id 18090) | Menu em pílula flutuante, cartões com dupla borda, botão com ícone encaixado |
| Telas reais — 3D | Container Scroll Animation (21st.dev, id 1081) — código baixado | `PanelShowcase.tsx` (voltou a pedido do dono): print sem a barra falsa, degradê no corte |
| Telas reais — pilha | **Scroll Cards** (21st.dev, id 2077) — código baixado | `ScreenStack.tsx`: cartões fixos que empilham e encolhem ao rolar |
| Calculadora | Receipt Pricing (26309), Receipt Printer (31601), Amount Slider (22007) — referência | `SavingsReceipt.tsx`: extrato impresso com valores rolando; mesmo cálculo do site atual |
| Comparativo | Side By Side Slide (18095), Compare Slider (20282) — referência | `CompareSlider.tsx`: divisória arrastável (mouse, toque e setas), varrida de dica ao entrar |
| Diferenciais | Bento Grid (37507), Spotlight Card (2220) — referência | `bento/`: bento assimétrico com mini demonstração viva em cada cartão |
| Como funciona | Scroll animated timeline (35029) — referência | `HowItWorks.tsx`: linha desenhada pela rolagem |
| Suporte / criador | Text Highlighter (18774) — referência | `SupportFounder.tsx`: marca-texto em "100% autoral" |
| FAQ | Accordion (23530), Animated Line Accordion (27711) — referência | `Faq.tsx`: mola + destaque deslizante (layoutId) |
| CTA final | Giant Wordmark Footer (35508), Worth Keeping CTA (26705) — referência | `FinalCta.tsx`: frase gigante revelada + palavra-marca vazada |
| Padrões gerais | A1 Gallery (categoria AI) | Evitar o clichê "fundo escuro + gradiente + partículas + chat"; mostrar o produto real na primeira tela; glow em um só lugar |

## Coleção Kitchen (dqnamo.com) — só referência visual, código reescrito do zero (a coleção não declara licença)

| Componente nosso | Referência Kitchen | Onde está |
|---|---|---|
| `ui/ReceiptPrinter.tsx` | Receipt Printer | Calculadora: o extrato sai da fenda da impressora e reimprime quando o valor para de mudar |
| `ui/Stamp.tsx` | Stamp | "Comissão R$ 0" no extrato; "Recomendado para você" no plano indicado |
| `ui/Signature.tsx` | Animated Signature | Assinatura do Maycon em "Suporte e quem criou" (fonte Mrs Saint Delafield, OFL, só as letras do nome — 1,5 KB) |
| `ui/Ticket.tsx` | Ticket | Planos como ingressos picotados com inclinação que segue o mouse |

Os quatro ficam em `src/components/ui/` e não dependem do site: podem ser levados para o sistema (ex.: carimbo "Pago" em pedidos, impressora no pagamento confirmado).
