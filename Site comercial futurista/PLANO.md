# Plano — Site comercial Comandiva (versão futurista)

Projeto novo e separado. **O site atual (`..\Site comercial`) não é tocado**: só leitura, para reaproveitar textos reais, FAQ, preços e imagens.

## 1. Ponto de partida (o que existe hoje)

- `Site comercial/src/pages/Home.tsx` (763 linhas) com 15 seções: hero, calculadora de economia, rotina, por que escolher, para quem, diferenciais, comparação com app de entrega, módulos, "veja por dentro" (5 prints reais), como funciona, suporte, sobre o Maycon, FAQ, CTA final.
- Tema escuro navy + azul `#008cfe` → roxo `#6146fd`, fonte padrão do sistema, animação só de "reveal" ao rolar.
- Não tem build próprio: depende do `..\Master` (`@/lib/track`, `usePageMeta`, `trpc`, Button, Input).
- Imagens reais em `Master/client/public/assets/{hero,demo}` (prints do sistema, fotos de rotina).

## 2. Decisão de arquitetura

Projeto **Vite + React + TypeScript + Tailwind + motion + lenis**, rodando sozinho com `npm run dev`.
- As dependências do Master (`track`, `usePageMeta`, `trpc`) viram *stubs* locais com a mesma assinatura → depois dá para portar as páginas de volta ao Master sem reescrever.
- Imagens copiadas (não movidas) do Master para `public/assets`.
- Primeiro só a **Home**; Planos, Cadastro etc. continuam no site atual e os links apontam para lá.

## 3. Direção visual — "cozinha em tempo real"

Futurista sem a "cara de IA" (sem fundo escuro + gradiente em tudo + partículas + muro de logos):
- **Conceito:** o painel de pedidos ao vivo é o protagonista. Linguagem gráfica de comanda/ticket de cozinha (linhas tracejadas, números monoespaçados, carimbo de horário) com acabamento de interface de controle.
- **Paleta (tokens em `:root`):** base grafite quase preta, texto off-white, 1 cor de destaque elétrica (manter o azul da marca `#008cfe`) e o roxo só em detalhes. Glow em **um único lugar** (hero).
- **Tipografia:** display de impacto + mono para números/preços (Fontshare, woff2 local). Proibidas: Inter, Roboto, Poppins, Montserrat, Open Sans, Arial.
- **Sem 3D/three.js** (decisão sua). WebGPU fora por enquanto.

## 4. Seções e componentes candidatos (pesquisa feita na 21st.dev)

Plano free da 21st: busca liberada, **só 2 downloads de código por dia**. Por isso: baixar os 2 mais complexos e recriar o resto com motion, usando os da 21st como referência visual.

| Seção | Animação | Candidatos 21st (id) | Uso |
|---|---|---|---|
| Preloader | ticket "imprimindo" + slide-up | Preloader (13967) | recriar |
| Hero | título com corte vertical por letra; print do painel inclinado em 3D que se endireita ao rolar | Vertical Cut Reveal (18595), Container Scroll Animation (1081), Phone Scroll Hero (27355) | **baixar 1081** |
| Faixa marquee | Pix · Cartão · Mesa QR · Delivery · Cozinha (não logos falsos) | Blurred Marquee (20147), Marquee diceui (27531) | recriar |
| Calculadora de comissão | número rolando (ticker) ao mudar o valor | Number Ticker Currency (21513) | recriar sobre o `SavingsCalculator` atual |
| Diferenciais | grid com spotlight que segue o cursor | Feature Grid Spotlight (26797), Spotlight Card (2220) | recriar |
| Módulos | bento grid com hover | Bento Grid kokonutd (622), Magnified Bento (10470) | recriar |
| Comparação | tabela com coluna destacada, linhas entrando em sequência | Comparison Table (26827) | recriar |
| Veja por dentro (5 prints) | cards empilhando ao rolar (sticky) | Scroll Cards (2077), Sticky Scroll Reveal (952) | **baixar 2077** |
| Como funciona | linha de progresso desenhada pelo scroll | Scroll animated timeline (35029) | recriar |
| Suporte / sobre o Maycon | reveal com blur | Reveal (19240) | recriar |
| FAQ | accordion com mola | Accordion ddoemonn (23530), FAQ blur-in (29774) | recriar |
| CTA final | botão magnético | Magnetic Button (26725) | recriar |

Antes de codar, conferir também Framer Marketplace / A1 Gallery / Curated Design (sua regra) e registrar tudo em `REFERENCIAS.md`.

## 5. Animações globais

Rolagem suave (lenis), revelação de texto por máscara, botões magnéticos, cursor customizado só no desktop. Tudo desligado com `prefers-reduced-motion`. Animações só em `transform`/`opacity` (60 fps).

## 6. Conteúdo

Só textos reais do site atual (FAQ, diferenciais, preço R$ 99,90, 7 dias grátis, limites de usuários). Nada de depoimento, número de clientes ou logo inventado.

## 7. Validação (antes de dizer que está pronto)

- Chrome DevTools: capturas em 1440 / 768 / 390, console sem erro, rede sem 404, Lighthouse (meta: LCP < 2,5 s, CLS < 0,1).
- Checklist das 20 regras com o estado de cada item.

## 8. Entregáveis

`npm run dev` funcionando + `REFERENCIAS.md` + notas do Lighthouse. Portar para o Master/produção só quando você pedir.

## Etapas

1. Referências (Framer/A1/Curated) + baixar 2 componentes da 21st.
2. Montar o projeto Vite, tokens, fontes, stubs.
3. Hero + preloader + marquee (para você aprovar o visual cedo).
4. Demais seções.
5. Validação e relatório.
