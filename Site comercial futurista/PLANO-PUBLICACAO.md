# Plano — trocar o site comercial pelo site futurista na VPS

Objetivo: `mmsystem.tech/comercial` passa a mostrar o site futurista, **com o mesmo endereço, o mesmo acesso SSH à VPS, o mesmo Caddy e o mesmo comando de publicação** (`docker compose up -d --build app`). Nada é feito na VPS sem o seu ok em cada fase.

## Como é hoje (conferido no código)

- O Master (porta 4000, atrás do Caddy em `mmsystem.tech`) é quem publica o site comercial: `scripts/sync-site-comercial.mjs` copia `Site comercial/src` para `Master/client/src/site-comercial`, que entra no build do painel.
- O servidor (`server/_core/vite.ts`) responde todas as páginas com o mesmo `index.html`, injeta título/descrição/OG por rota e decide 200 ou 404 pela lista de `shared/commercialRoutes.ts`.
- URLs que existem hoje e **precisam continuar funcionando** (aparecem em e-mails, Telegram, Mercado Pago e no Google):
  `/comercial`, `/comercial/planos`, `/comercial/termos`, `/comercial/privacidade`, `/comercial/cadastro/:plano`, `/comercial/cadastro/sucesso`, `/comercial/cadastro/cardapio`, `/comercial/cadastro/confirmando` (retorno do Mercado Pago, usado em `server/db/signupPayments.ts`).
- Publicação na VPS (feita em 2026-10-14): backup do banco → `git archive "HEAD:Master"` + `tar -r` da cópia do site → `scp` → `/opt/saas-core-new` → copiar `.env` → trocar pasta (a antiga fica em `/opt/saas-core-old-<data>` para voltar) → `docker compose up -d --build app`.

## Abordagem escolhida

O site futurista vira um **app separado servido pelo Master dentro de `/comercial`**, em vez de misturar o código dele no painel:

- O CSS do futurista (fundo Aurora no `html`, fontes, Tailwind 4 próprio) não vaza para o Painel Master, e vice-versa.
- Mesmo domínio: as chamadas `/api/...` (planos, cadastro, cardápio, medição) funcionam sem repasse.
- **Chave de segurança:** o `.env` ganha `COMMERCIAL_SITE=futurista` ou `legado`. Trocar de volta é editar uma linha e reiniciar o container (segundos, sem rebuild).

## Fase 0 — Preparar no computador (não toca produção) — ✅ concluída em 2026-10-15

1. **Completar o futurista com as páginas que faltam:** Termos, Privacidade (mesmo texto do site atual) e Confirmando (retorno do Mercado Pago, mesma lógica de consultar `public.signupStatus`).
2. **Morar em `/comercial`:** `base: "/comercial/"` no Vite, `<Router base="/comercial">` no wouter e caminhos de imagens/fontes relativos à base. Links internos e canonical continuam como estão (já apontam para `/comercial/...`).
3. **Build de produção do futurista** com `VITE_TRACK_ENDPOINT=/api/track` (liga a medição anônima que hoje está desligada).
4. **Master:**
   - o script de sync passa a copiar também `Site comercial futurista/dist` para `client/public/comercial` (pasta gerada, fora do git);
   - `server/_core/vite.ts`: quando `COMMERCIAL_SITE=futurista`, rotas `/comercial/*` recebem o `index.html` do futurista, com o mesmo 200/404 de `commercialRoutes.ts` e o mesmo título/OG por rota (`og-comandiva.png`);
   - `shared/commercialRoutes.ts` e `commercialPageMeta.ts`: conferir que todas as URLs da lista acima estão lá.
5. **Testes:** `pnpm run check` e `pnpm run test` no Master (há testes que leem as páginas comerciais) + build do futurista.
6. **Teste local completo** com o Master rodando no computador: as 8 URLs, 404 real, planos vindo da API, cadastro e cardápio. ⚠️ O `.env` local usa o mesmo bot do Telegram, então um cadastro de teste local manda aviso de verdade (só com o seu ok).
7. Commit no branch `site-comercial-futurista` e envio ao GitHub. Nada é publicado aqui.

### Resultado da Fase 0
- Páginas novas no futurista: Termos, Privacidade (mesmo texto) e Confirmando (consulta `public.signupStatus`).
- Site em `/comercial/` (base do Vite + roteador), links e imagens ajustados; medição ligada só no build de produção e nunca em localhost.
- Master: `COMMERCIAL_SITE` (`legado` padrão | `futurista`), `server/_core/commercialFuturista.ts` (static + HTML com 200/404 e meta por rota), injeção de meta movida para `commercialMeta.ts`, sync copia `dist` → `client/comercial-futurista` (fora do git), Dockerfile copia a pasta (e cria vazia se faltar → volta ao legado com aviso no log), `.env.example` documentado.
- Testes: futurista (tipos, lint, build) e Master (`pnpm run check`; `pnpm run test` 44 arquivos / 366 testes, com 6 novos para esta ligação).
- Master compilado rodando no computador (sem banco, alertas desligados): as 9 URLs com 200, `/comercial/nao-existe` 404, título/OG por rota com `og-comandiva.png`, CSP de produção sem violações, Planos usando a reserva quando a API não responde; com `legado`, o site atual igual a hoje. Docker Desktop estava desligado, então o teste com banco (cadastro real) fica para a Fase 2.

**Para a Fase 1, além do procedimento de sempre:** rodar `npm run build` no futurista e o sync (`pnpm run check` no Master) antes do `git archive`, e acrescentar `client/comercial-futurista` no `tar -r`.

## Fase 1 — Publicar na VPS (só com o seu ok, mesmo procedimento de sempre)

1. Backup do banco (`scripts/backup-db.mjs` dentro do container) e cópia da pasta atual.
2. `git archive "HEAD:Master"` + `tar -r` de `client/src/site-comercial` **e** `client/public/comercial`; conferir CRLF (`grep -P '\r'`) antes de enviar.
3. `scp` → extrair em `/opt/saas-core-new` → copiar o `.env` e acrescentar `COMMERCIAL_SITE=legado` (primeiro sobe com o site atual, para isolar risco).
4. Trocar a pasta (a atual vira `/opt/saas-core-old-<data>`) → `docker compose up -d --build app` em segundo plano → conferir `/healthz` e o painel.
5. Virar a chave: `COMMERCIAL_SITE=futurista` no `.env` → `docker compose up -d app` (sem rebuild).

**Não muda:** Caddy, domínio, certificado HTTPS, acesso SSH, banco, volumes, nome do projeto Docker (`saas-core`) e o comando de publicação.

**Vai junto nessa publicação:** o envio de cardápio de até 20MB (commit `b316887`). O commit de segurança `3d68d66` é do **Sistema de restaurante** (outro container) e **não** vai junto.

## Fase 2 — Conferir em produção

- As 8 URLs respondendo 200, endereço inexistente em `/comercial` com 404 real, `robots.txt` e `sitemap.xml` ok.
- Planos com os preços do banco; prévia do link no WhatsApp com a imagem nova.
- 1 cadastro real + 1 cardápio (até 20MB) com aviso no seu Telegram (com o seu ok; depois apagar o restaurante de teste).
- Lighthouse e fluidez da rolagem no celular.
- Enviar o sitemap ao Google Search Console.

## Como voltar atrás

1. **Rápido (segundos):** `COMMERCIAL_SITE=legado` no `.env` → `docker compose up -d app`. Volta o site atual, nada mais muda.
2. **Completo:** trocar `/opt/saas-core-old-<data>` de volta e subir (mesmo rollback de 2026-10-14). O banco não é alterado por esta mudança.

## Riscos e cuidados

- **Links antigos:** todos os endereços continuam iguais; o que muda é só o visual.
- **Página de retorno do Mercado Pago:** o fluxo com taxa saiu em 2026-10-09, mas o endereço ainda é gerado no código; por isso a Confirmando entra antes de publicar.
- **CRLF no Windows:** já resolvido com `.gitattributes`, mas conferido de novo antes do envio.
- **Memória do container:** o envio de 20MB passa pela RAM; o limite de tentativas por IP continua ativo.
- **Site comercial antigo:** fica no código como reserva (chave `legado`) até você decidir apagar.
