# Painel Master — Comandiva (contexto do projeto)

Lido automaticamente pelo Claude Code ao abrir esta pasta. Resposta sempre em português (pt-BR); o dono (Maycon) está
aprendendo Docker/infra — explicar passo a passo.

## O que é

Serviço central (ex-`saas-core`) do SaaS: planos, assinaturas, cobrança (Mercado Pago), cadastro dos restaurantes-clientes,
Painel Master (Super Admin) com verificação opcional (pergunta + código de 4 dígitos), Modo Suporte e o **site comercial** (mmsystem.tech/comercial). **Nunca** guarda dado
operacional de restaurante (pedidos, cardápio, clientes). Stack: Express + tRPC + Drizzle + MySQL + React/Vite/Tailwind.

## Estrutura (3 projetos irmãos, cada um com seu git)

```
SaaS Restaurante\
├── Sistema de restaurante\   app dos restaurantes (consulta este serviço via SAAS_CORE_URL / chave de API)
├── Master\                    ← ESTE projeto
└── Site comercial\            páginas do site de venda; este projeto copia e publica
```

**Site comercial:** o código das páginas fica em `..\Site comercial\src`. O script `scripts/sync-site-comercial.mjs`
copia essa pasta para `client/src/site-comercial` (ignorada pelo git) antes de `dev`, `build`, `check` e `test`.
Para editar o site com recarga: `pnpm run dev:site` num terminal e `pnpm run dev` em outro. No deploy, a pasta
`client/src/site-comercial` precisa ser enviada junto (o build no Docker não enxerga a pasta irmã). Variável
`SITE_COMERCIAL_DIR` troca a origem.

## Detalhes do Painel Master, Modo Suporte e planos

Serviço central separado dentro deste mesmo repositório (pasta `saas-core/`), própria stack
(Express + tRPC + Drizzle + MySQL), próprio banco e próprio Docker Compose
(`saas-core/docker-compose.saas-core.yml`, containers `saas-core-app-1`/`saas-core-db-1`).
**Nunca guarda dado operacional de restaurante nenhum** (pedidos, cardápio, clientes) — só
planos/assinaturas/cobrança e o cadastro dos restaurantes-cliente. Cada restaurante (Comandiva,
futuros clientes) continua com seu próprio deployment Docker isolado, exatamente como
hoje; o app principal consulta o `saas-core` via `server/_core/license.ts` (sync em background,
cache local com fail-open se o `saas-core` cair) e recursos pagos são bloqueados de fato no
backend por `featureProcedure`/`requireFeature` (nunca só escondendo botão no frontend).

- **Painel Master (Super Admin)** — login em `http://localhost:4000/login` (em produção, a porta/URL
  que for exposta do container `saas-core-app-1`; hoje mapeado só em `127.0.0.1:4000`). E-mail+senha
  de `platform_admins`, sem relação com login de admin de restaurante nem com o `OPERATOR_TOKEN` dos
  scripts de CLI. Primeira conta é criada automaticamente no boot a partir de
  `BOOTSTRAP_SUPERADMIN_{NAME,EMAIL,PASSWORD}` em `saas-core/.env` (hoje: Maycon,
  mayconprogramacao1@gmail.com — senha é a que estiver salva nessa variável nesse arquivo). Segundo passo
  opcional por conta (tela Segurança): pergunta "Quem é o seu melhor amigo de infância?" + código de 4 dígitos, guardados só como hash
  (`server/_core/securityAnswers.ts`); substituiu o TOTP em 2026-10-16. Reset por CLI: `scripts/reset-platform-admin-2fa.ts`. Páginas: `Dashboard`, `Restaurantes` (lista + detalhe: plano,
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

## Regras gerais ao mexer neste projeto

- Migrations só aditivas (`drizzle/*.sql` + journal + snapshot); com mais de um statement usar `--> statement-breakpoint`.
- Segurança: ver `docs/` do Sistema de restaurante → `auditoria-seguranca-2026-10-10.md` (2FA, sessões revogáveis, Modo Suporte revalidado).
- Não publicar na VPS sem pedido explícito; backup antes.
