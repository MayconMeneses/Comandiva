# Comandiva

Sistema de pedidos para restaurantes, lanchonetes e estabelecimentos com atendimento por mesa e/ou delivery — **sem comissão por pedido** e com a marca do próprio restaurante.

Cada restaurante roda o seu próprio ambiente isolado (não é um marketplace compartilhado). O cliente faz o pedido pelo site público; a equipe opera tudo pelo painel.

## O que o sistema faz

**Para o cliente**
- Cardápio digital com fotos, categorias, complementos, promoções e eventos, com filtro automático por horário (almoço/janta).
- Pedido para delivery ou retirada, com validação de endereço contra as rotas de entrega.
- Pagamento por Pix (chave/QR do restaurante) ou cartão online (Mercado Pago Checkout Pro — nunca tocamos em número de cartão).
- Acompanhamento do pedido pelo telefone.
- Mesa com QR Code: pedir rodadas, chamar o garçom e pedir a conta pelo celular.
- O pedido não se perde se a internet cair: ele fica guardado e segue quando a conexão volta.

**Para a equipe**
- Painel de pedidos em tempo real (aceitar, preparar, entregar) com barra de tempo de preparo, e fila da cozinha.
- Comanda digital das mesas, reservas e app instalável (PWA) para celular/tablet.
- Admin completo: cardápio, complementos, promoções, eventos, rotas de entrega, clientes, relatórios, equipe e permissões, auditoria e pagamentos.
- Funciona em planos: recursos como mesas/QR, cozinha, relatórios avançados e gestão de equipe são liberados por plano (bloqueio no backend, não só no botão).

## Arquitetura

| Parte | Onde | Stack |
|---|---|---|
| Frontend | `client/` | React + Vite + Tailwind, `wouter`, tRPC + React Query |
| Backend | `server/` | Express + tRPC |
| Banco | `drizzle/` | MySQL/MariaDB via Drizzle ORM (migrations aditivas, aplicadas no boot) |
| Compartilhado | `shared/` | Regras de domínio e contratos usados por cliente e servidor |
| Storage de imagens | `server/storage.ts` | S3-compatível (MinIO) |
| Autenticação | `server/_core/` | JWT em cookie httpOnly, local, sem serviço externo |
| Camada SaaS | `saas-core/` | Serviço central separado: planos, cobrança, Painel Master e Modo Suporte |
| Infra | `infra/`, `docker-compose.independent.yml` | 3 serviços: `app`, `db` (MySQL) e `storage` (MinIO) |

O `saas-core/` **nunca guarda dado operacional de restaurante** (pedidos, cardápio, clientes) — só planos, assinaturas, cobrança e o cadastro dos restaurantes-cliente. O app de cada restaurante consulta o saas-core para saber o plano (com cache local que continua funcionando se o saas-core cair). O site comercial público de venda também é servido pelo saas-core.

## Como rodar

Só precisa de Docker. Um comando:

```bash
./iniciar.sh
```

Ele cria o `.env` com segredos aleatórios (na primeira vez), sobe app, banco e storage, aplica as migrations e roda o seed inicial. O site abre em `http://localhost:3000` (o usuário e a senha do admin aparecem no final).

```bash
docker compose -f docker-compose.independent.yml logs app --tail=60   # ver logs
docker compose -f docker-compose.independent.yml down                  # parar
```

O Painel Master (saas-core) sobe separado:

```bash
cd saas-core
docker compose -f docker-compose.saas-core.yml up -d --build   # precisa de saas-core/.env preenchido
```

Sem Docker (Node e MySQL já prontos):

```bash
cp config/env.example .env      # ajuste DATABASE_URL, JWT_SECRET, S3_* e BOOTSTRAP_ADMIN_*
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm run seed
pnpm dev
```

## Testes e verificação

```bash
pnpm check        # tipos (TypeScript)
pnpm lint
pnpm test         # vitest; com DATABASE_URL definido, roda também os testes contra MySQL de verdade
```

Rode `pnpm check`, `pnpm lint` e `pnpm test` (nos dois projetos: raiz e `saas-core/`) antes de subir qualquer mudança.

## Regras do projeto

- Banco: **só migrations aditivas** (`drizzle/000X_*.sql`, registradas em `drizzle/meta`). Nada destrutivo.
- Migrations com mais de um `ALTER`/`CREATE` precisam do separador `--> statement-breakpoint`.
- Mudanças visuais no Admin não podem vazar para o cardápio público, e vice-versa.
- Segredos nunca vão para o repositório: use `config/env.example` como modelo e mantenha o `.env` fora do git.

## Documentação

- `docs/independent-install.md` — instalar do zero
- `docs/production-deploy.md` — publicação em servidor
- `docs/database-model.md` — modelo de dados
- `docs/api-inventory.md` — mapa das rotas tRPC
- `docs/data-migration.md` — preservar dados de outra instalação
- `README-INDEPENDENT.md` — visão do pacote independente
- `CLAUDE.md` — contexto de projeto para sessões do Claude Code

Criado por Maycon Meneses.
