# Comandiva — Sistema de pedidos (contexto do projeto)

Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão nesta pasta.
Serve para não precisar reexplicar o histórico do projeto a cada conversa nova.

## O que é

Sistema completo de pedidos online para o restaurante **Comandiva** (Croatá/CE), rodando de forma
independente (sem depender de nenhuma plataforma no-code). Cliente faz pedido pelo site público,
equipe gerencia tudo pelo painel administrativo.

## Stack técnica

- **Frontend**: React + Vite + Tailwind, roteamento com `wouter`, dados via `tRPC` + React Query.
- **Backend**: Express + tRPC (`server/routers/*.ts`).
- **Banco**: MySQL/MariaDB via Drizzle ORM (`drizzle/schema.ts`). Migrations em `drizzle/*.sql`,
  aplicadas automaticamente no boot do container (`infra/entrypoint.sh` → `drizzle-kit migrate`).
- **Storage de imagens**: S3-compatible (MinIO em produção própria), helper em `server/storage.ts`.
  O bucket é criado automaticamente no primeiro upload se não existir.
- **Autenticação**: JWT em cookie httpOnly (local, sem serviço externo). Ver `server/_core/sdk.ts`
  e `server/_core/cookies.ts`.
- **Pagamento**: Pix (chave/QR configurados pelo admin) + cartão via Mercado Pago Checkout Pro
  (redirect hospedado, nunca tocamos em número de cartão). Outras processadoras (PagSeguro, Stripe
  etc.) têm cadastro de credenciais pronto em Admin → Conta, mas só o Mercado Pago tem cobrança
  automática de fato implementada.
- **Deploy**: Docker Compose (`docker-compose.independent.yml`) com 3 serviços: `app`, `db` (MySQL),
  `storage` (MinIO). Subir tudo com `./iniciar.sh` (cria `.env` com segredos aleatórios na primeira
  vez, depois só builda e sobe).

## Estrutura de páginas

- `/` — cardápio público (`client/src/pages/Home.tsx`). Categorias aparecem como cards visuais
  (imagem + nome), com filtro automático por horário (almoço/janta, fuso de Croatá/CE calculado
  no servidor). Promoções e eventos aparecem juntos no topo, com destaque visual diferente pra
  eventos.
- `/checkout` — finalização de pedido, com validação de endereço x rota de entrega (bloqueia se
  não bater).
- `/acompanhar` — acompanhamento do pedido pelo telefone; mostra Pix de novo se ainda não pago.
- `/painel-pedidos` — kanban operacional pra equipe (aceitar, preparar, entregar), com barra de
  progresso de tempo de preparo (verde → laranja aos 30min → vermelho aos 50min).
- `/admin/*` — painel administrativo completo:
  - `Cardápio`: categorias e produtos em **accordion recolhível** (fechado por padrão), complementos
    e promoções também em accordion. Upload de imagem, disponibilidade, preço, tudo editável.
  - `Rotas de entrega`, `Clientes`, `Relatórios` (com filtro de dia específico).
  - `Conta`: Pix, gateways de pagamento, chave Pix/QR.
  - `Eventos`: cadastro de eventos com imagem grande (até 100MB) e descrição.

## Camada SaaS — `saas-core/` (billing, Painel Master, Modo Suporte)

Serviço central separado dentro deste mesmo repositório (pasta `saas-core/`), própria stack
(Express + tRPC + Drizzle + MySQL), próprio banco e próprio Docker Compose
(`saas-core/docker-compose.saas-core.yml`, containers `saas-core-app-1`/`saas-core-db-1`).
**Nunca guarda dado operacional de restaurante nenhum** (pedidos, cardápio, clientes) — só
planos/assinaturas/cobrança e o cadastro dos restaurantes-cliente. Cada restaurante (Comandiva
Creator, futuros clientes) continua com seu próprio deployment Docker isolado, exatamente como
hoje; o app principal consulta o `saas-core` via `server/_core/license.ts` (sync em background,
cache local com fail-open se o `saas-core` cair) e recursos pagos são bloqueados de fato no
backend por `featureProcedure`/`requireFeature` (nunca só escondendo botão no frontend).

- **Painel Master (Super Admin)** — login em `http://localhost:4000/login` (em produção, a porta/URL
  que for exposta do container `saas-core-app-1`; hoje mapeado só em `127.0.0.1:4000`). E-mail+senha
  de `platform_admins`, sem relação com login de admin de restaurante nem com o `OPERATOR_TOKEN` dos
  scripts de CLI. Primeira conta é criada automaticamente no boot a partir de
  `BOOTSTRAP_SUPERADMIN_{NAME,EMAIL,PASSWORD}` em `saas-core/.env` (hoje: Maycon,
  mayconprogramacao1@gmail.com — senha é a que estiver salva nessa variável nesse arquivo). Sem MFA
  (recusado de propósito, ver memória). Páginas: `Dashboard`, `Restaurantes` (lista + detalhe: plano,
  status, `deploymentUrl`, botão "Entrar em modo suporte"), `Planos`, `Auditoria`.
- **Modo Suporte** — a partir do detalhe de um restaurante no Painel Master, abre uma sessão com
  acesso completo de leitura E escrita (dashboard, pedidos, cardápio, mesas etc.) direto no
  deployment real daquele restaurante, sem precisar da senha dele: token de handoff de uso único,
  sessão local separada (cookie/JWT próprios, nunca a sessão real de admin/staff), banner fixo
  laranja "Modo Suporte ativo" sempre visível enquanto ativo. Fica de fora mesmo em Modo Suporte
  (bloqueado por `adminOnlyProcedure`, que nunca aceita `ctx.supportSession`): Pix/gateways de
  pagamento, gestão de outras contas admin/staff, e billing/assinatura — ver
  `server/_core/trpc.ts`. Toda entrada e toda mutation feita durante a sessão ficam gravadas em
  `platform_audit_log` (auditoria pós-fato, não bloqueio prévio).
- Planos atuais: Essencial (R$149,90), Profissional (R$249,90), Premium (R$299,90). Cobrança de
  assinatura via Mercado Pago (mesma processadora já usada pros pedidos dos clientes finais).

## Decisões importantes já tomadas (não refazer sem necessidade)

- **Categorias e produtos são reais, cadastrados via `scripts/seed-cardapio-mm.ts`** — um script
  idempotente que lê o cardápio real (extraído de fotos que o dono mandou) e popula o banco. Rodar
  de novo não duplica nada; também limpa dados de demonstração da instalação inicial
  (`scripts/seed.ts`, que só roda uma vez no primeiríssimo boot).
- Categorias e produtos têm campo `onPromotion` (produto) e a categoria virtual "Promoção" é
  montada no frontend juntando esses produtos — não é uma linha real na tabela `categories`.
- `timeAvailability` em categorias: `ALWAYS | LUNCH | DINNER | LUNCH_AND_DINNER`, comparado contra
  os horários globais configurados em `restaurantSettings` (`lunchStartTime` etc.), calculado com
  `Intl.DateTimeFormat` timezone `America/Fortaleza` (ver `shared/orderDomain.ts`,
  `isCategoryCurrentlyAvailable`).
- **Accordion no Admin > Cardápio**: implementado com o truque de CSS `grid-rows-[0fr]/[1fr]` +
  `overflow-hidden` (sem lib externa), fechado por padrão. Usado em `CatalogProductAvailability.tsx`
  (categorias, cada uma abre/fecha independente), `AddonManagerFull.tsx` (Complementos, seção
  inteira abre/fecha) e `PromotionManager` dentro de `Admin.tsx` (Promoções, idem). **Nunca aplicar
  esse padrão no cardápio público** — só no admin.
- **Auditoria de segurança já feita** (não repetir do zero, só revisar incrementalmente):
  - Portas do MySQL/MinIO no `docker-compose.independent.yml` só em `127.0.0.1` (não expor pra
    internet num VPS real).
  - `JWT_SECRET` com guarda de mínimo 32 caracteres no boot (`server/_core/index.ts`), senão o
    servidor recusa iniciar.
  - Rate limit simples em memória no login (`server/_core/rateLimit.ts`), 8 tentativas/10min por
    IP+usuário.
  - Chaves de gateway de pagamento (`apiKey`, `secretKey`) nunca voltam pro navegador — só um
    booleano indicando se já foram configuradas. Editar sem preencher de novo mantém o valor salvo.
  - Cabeçalhos de segurança básicos (`X-Frame-Options`, `X-Content-Type-Options` etc.) no Express.
- **`docker compose up --build` pode ficar muito lento (10-20min+) ou parecer travado** quando a
  máquina já tem muitos containers/dev servers rodando ao mesmo tempo (visto em sessão de
  2026-09-15/16: builds concorrentes disputando o builder do Docker Desktop, e o passo `chown -R
  /app` — sozinho, sobre `node_modules` — ficou parado por 8+ minutos sob carga pesada). Não é bug
  do Dockerfile: o mesmo build, sem concorrência e com a máquina mais livre, completa em ~3-4min.
  Se um build parecer travado, primeiro feche dev servers/containers não essenciais (ou reinicie o
  Docker Desktop) antes de investigar o Dockerfile.

## Como rodar localmente (o usuário já sabe fazer isso, é referência)

```bash
./iniciar.sh                       # sobe tudo (cria .env na primeira vez)
docker compose -f docker-compose.independent.yml down    # para
docker compose -f docker-compose.independent.yml logs app --tail=60   # ver logs
docker compose -f docker-compose.independent.yml exec app node_modules/.bin/tsx scripts/seed-cardapio-mm.ts   # recadastrar cardápio real
```

O `saas-core` (Painel Master) sobe separado, de dentro da própria pasta:

```bash
cd saas-core
docker compose -f docker-compose.saas-core.yml up -d --build    # sobe (precisa de saas-core/.env já preenchido)
docker compose -f docker-compose.saas-core.yml down              # para
docker compose -f docker-compose.saas-core.yml logs app --tail=60   # ver logs
```

## Sobre o usuário (Maycon)

- Está aprendendo Docker/infra na prática — explicações de erro devem ser passo a passo, sem supor
  conhecimento prévio de terminal/Docker.
- Ambiente: Windows + WSL2 + Docker Desktop, pasta do projeto dentro do OneDrive
  (`/mnt/c/Users/maico/OneDrive/Área de Trabalho/Nova pasta/Pubx` no WSL).
- Planeja hospedar em VPS (Hostinger, plano KVM, datacenter São Paulo). A revenda pra outros
  restaurantes já saiu do "avaliando" e está construída: camada `saas-core/` (ver seção própria
  acima).
- Prefere respostas diretas com o próximo passo prático; já passou por bastante troubleshooting de
  Docker/WSL/BIOS nesta jornada.

## Regras gerais ao mexer neste projeto

- Não fazer alterações destrutivas no banco — sempre migrations aditivas (`drizzle/000X_*.sql`,
  registradas em `drizzle/meta/_journal.json` e `drizzle/meta/000X_snapshot.json`).
- Migrations com mais de um `ALTER TABLE`/`CREATE TABLE` precisam do separador
  `--> statement-breakpoint` entre eles, senão o drizzle-kit falha ao aplicar.
- Reaproveitar componentes/rotas existentes em vez de recriar — o projeto já tem bastante
  funcionalidade construída incrementalmente ao longo de várias sessões.
- Qualquer mudança visual/estrutural no Admin não deve vazar pro cardápio público, e vice-versa.
