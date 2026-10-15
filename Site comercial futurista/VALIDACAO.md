# Validação — checklist das 20 regras (2026-10-14)

Testado no build de produção (`npm run build` + `vite preview`, porta 5181), Chrome via MCP chrome-devtools e Playwright.

| # | Item | Estado | Evidência |
|---|---|---|---|
| 1 | Política de privacidade | OK | Link no rodapé → mmsystem.tech/comercial/privacidade (200). Coerente: o site não usa cookie; medição anônima sem cookie (`src/lib/track.ts`), como a política descreve |
| 2 | Termos | OK | Link no rodapé → /comercial/termos (200) |
| 3 | CTA limpa | OK | Uma ação principal por tela: "Ver planos e começar" (hero), "Ver planos" (menu), "Assinar <plano>" (Planos), CTA final |
| 4 | FAQ | OK | 5 perguntas reais do site atual + JSON-LD FAQPage |
| 5 | robots.txt | OK | `public/robots.txt` (200), libera tudo e aponta o sitemap |
| 6 | sitemap.xml | Parcial | `public/sitemap.xml` (200) com as 2 URLs canônicas. **Envio ao Search Console não feito** (precisa da sua conta) |
| 7 | 404 personalizado | Parcial | Página própria com volta ao início e aos planos, `noindex`. Status HTTP: 200 no preview isolado (fallback de SPA); no Master publicado, rota inexistente em /comercial já devolve **404** (conferido com curl) |
| 8 | Texto alternativo | OK | Prints com `alt` descritivo; ícones decorativos com `alt=""`; Lighthouse Acessibilidade 100 |
| 9 | Analytics | OK (desligado aqui) | Mesma medição própria do Master (page_view, cta_click, signup_start). Só envia com `VITE_TRACK_ENDPOINT` definido, para não gerar 404 rodando sozinho |
| 10 | Meta títulos | OK | Únicos: Home 49 car., Planos 54 car., 404 próprio |
| 11 | Meta descrições | OK | Únicas, ~140 car., com chamada (7 dias grátis) |
| 12 | Compartilhamento social | OK | OG + Twitter Card estáticos no index.html e por página; imagem nova `og-comandiva.png` 1200×630 com a marca Comandiva |
| 13 | Favicon | OK | .ico (16/32/48), PNG 16/32, apple-touch 180, ícones 192/512 + manifest — todos gerados do ícone Comandiva (não usam mais o monograma MM) |
| 14 | URL canônica | OK | `rel=canonical` por página (mmsystem.tech/comercial e /comercial/planos). Trocar `SITE_ORIGIN` em `src/lib/seo.ts` se o domínio mudar |
| 15 | Consentimento de cookies | Não se aplica | Nenhum cookie é criado; a medição é sem cookie e sem ID. `sessionStorage` só guarda "preloader já visto" (funcional) |
| 16 | Versão mobile | OK | 320, 390, 768, 1440 e 1920 px sem rolagem horizontal (scrollWidth = clientWidth); botões ≥ 44 px |
| 17 | Acessibilidade | OK | Lighthouse 100 (Home, Planos, 404); teclado percorre tudo com foco visível; `prefers-reduced-motion` respeitado |
| 18 | Formulários | Não se aplica | Este site não tem formulário; o cadastro continua no site atual (links testados, 200) |
| 19 | Links quebrados | OK | Todos os links internos e externos 200, sem redirecionamento; nenhuma imagem quebrada |
| 20 | Desempenho | OK | Celular simulado (4G lento + CPU 4×), tema Aurora: LCP 1,8–2,2 s (3 medições com preloader, 3 sem); teste A/B mostrou que o fundo em degradê não pesa; CLS 0. Lighthouse Acessibilidade 100, Boas práticas 100, SEO 100 |

## O que foi ajustado nesta validação
- LCP caiu de 4,6 s para ~2,5 s: preloader mais curto (0,85 s), hero anima durante a saída dele, parágrafo do hero sem animação de entrada (é o elemento do LCP), parte de baixo da Home e páginas Planos/404 carregadas sob demanda.
- Ícones, favicon e imagem de compartilhamento refeitos com a marca Comandiva.
- Metas, canonical, JSON-LD (SoftwareApplication, Organization, FAQPage, Product), robots, sitemap e 404 criados.

## Pendências fora do código
- Enviar o sitemap no Google Search Console.
- Ao publicar dentro do Master: definir `VITE_TRACK_ENDPOINT=/api/track`, servir `og-comandiva.png` na raiz do domínio e cadastrar `/comercial` e `/comercial/planos` como rotas conhecidas (para a 404 real continuar funcionando).
- Lighthouse "llms.txt" reprovado: o arquivo existe só no Master; não faz parte das 20 regras.

## Tema Aurora (2026-10-14)
- Fundo fixo em degradê (azul do logo → violeta → roxo claro do logo MM System Creator) trocando com a rolagem; granulado em PNG pequeno (filtro SVG de ruído na tela inteira foi trocado por custar caro na pintura).
- Contraste: cinza da vitrine ilustrativa do comparativo escurecido para #66615b (6,1:1).
- Imagem de compartilhamento, theme-color e manifest atualizados para o novo fundo.

## Rolagem mais leve (2026-10-14)
Medido num notebook com Intel UHD 620 (placa integrada): a rolagem travava.
- Removida a rolagem suave (Lenis): lia a posição da página a cada quadro e forçava recálculo de layout (764 ms de trava num trace de rolagem). Agora é a rolagem nativa.
- Fundo Aurora deixou de ser camada fixa de tela inteira (4 camadas → 0): o degradê é pintado no próprio `html`, ao longo da página. Teste A/B válido: sem a camada fixa, topo 38 → 60 fps e travadas 56 → 25.
- Entradas das seções sem desfoque (blur animado) e menu sem vidro desfocado.
- Pacote JS principal: 136 → 127,5 KB (gzip).
- Observação: medições de fps no Chrome de teste variam muito quando a janela perde o foco (o Chrome desacelera janelas encobertas); só foram consideradas rodadas com a janela à frente.

## Paridade com o site comercial atual (2026-10-15)
- Comparado seção por seção com o site no ar (mmsystem.tech/comercial). Entraram as 4 que faltavam: "Seu tempo vale mais que planilha…" (rotina, fotos recortadas sem o logo/texto embutido), "Por que escolher o Comandiva?", "Serve pro seu restaurante…" e "Um sistema completo…" (módulos).
- Telegram: não existe no site atual nem na API de planos. No sistema ele é só alerta interno do dono da plataforma (erros, cadastros, pagamentos, suporte), não um recurso para o restaurante — por isso não entrou como funcionalidade no site.
- Planos agora vêm da MESMA API do site atual (`/api/trpc/public.plans`): nome, preço, limites e recursos do banco; reserva local se a API falhar. Rodando sozinho, o Vite repassa `/api` para mmsystem.tech (a API não envia CORS); dentro do Master a chamada é no mesmo endereço.

## Cadastro e aviso no Telegram (2026-10-15)
- Cadastro, "Cadastro recebido" e envio do cardápio agora ficam DENTRO deste site (/cadastro/:plano, /cadastro/sucesso, /cadastro/cardapio), chamando as MESMAS rotas do Master que o site atual usa: `public.signup` (servidor cria o restaurante e manda a mensagem no Telegram do dono) e `public.uploadMenuReference` (servidor manda o arquivo anexado no Telegram). O aviso continua sendo responsabilidade do servidor: não depende de qual site o cliente usou.
- Testado sem criar cadastro: e-mail inválido (400, nada gravado) e token de cardápio inválido (403, nada enviado). O teste ponta a ponta (cadastro real + aviso no Telegram) depende de autorização do dono, porque cria um restaurante na produção.
- Teste real autorizado pelo dono (2026-10-15): cadastro "TESTE Claude - apagar" (plano Entrada, e-mail teste.claude@example.com) criou o restaurante nº 7 (`public.signup` 200) e o envio de um PDF de teste com observação (`public.uploadMenuReference` 200). O envio ao Telegram é feito pelo servidor em segundo plano; o dono confirmou que as 2 mensagens chegaram no Telegram. Restaurante nº 7 a apagar no Painel Master.

## Cardápio até 20MB (2026-10-15)
- Master: `MAX_MENU_FILE_BYTES` 8MB → 20MB (`server/routers/public.ts`) e `MENU_UPLOAD_BODY_LIMIT` 12mb → 28mb (`server/_core/bodyLimits.ts`, só no envio de cardápio). Teto do Telegram para bot é 50MB; 20MB por causa da memória do container. `pnpm run check` ok e `pnpm run test` 43 arquivos / 360 testes passando.
- Site futurista: limite 20MB e fotos (JPG/PNG/WEBP) reduzidas no navegador (lado maior 2400 px, JPEG 85%). Testado sem envio: foto de 21,8MB → 2,5MB; PDF de 25MB bloqueado; PDF de 15MB aceito.
- Pendente: publicar o Master. Até lá o servidor em produção continua recusando arquivos acima de 8MB.
