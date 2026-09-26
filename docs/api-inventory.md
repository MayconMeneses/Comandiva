# Inventário de API

A aplicação expõe uma API tRPC em `/api/trpc`. O cliente é criado em `client/src/lib/trpc.ts`; o servidor monta o router em `server/routers.ts` e delega por módulos.

| Módulo | Arquivo | Escopo |
|---|---|---|
| `system` | `server/_core/systemRouter.ts` | Healthcheck (`/healthz`/`/readyz` são endpoints HTTP diretos, não tRPC — este módulo é o equivalente exposto via tRPC) |
| `auth` | `server/routers.ts` | Sessão, usuário atual e logout |
| `catalog` | `server/routers/catalog.ts` | Categorias, produtos, promoções e adicionais públicos |
| `customer` | `server/routers/customer.ts` | Identificação por telefone, cadastro e endereços |
| `dataRights` | `server/routers/dataRights.ts` | Autoatendimento LGPD (titular dos dados) — verificação por SMS, consulta e exclusão dos próprios dados |
| `order` | `server/routers/order.ts` | Checkout, criação, acompanhamento e status |
| `table` | `server/routers/table.ts` | Pedido pela mesa via QR Code — chamar garçom, pedir a conta, reservas (recurso pago, Profissional/Premium) |
| `admin` | `server/routers/admin.ts` | Visão geral, clientes, catálogo, pedidos, rotas, relatórios, equipe, gateways de pagamento, fiscal e auditoria |
| `team` | `server/routers/team.ts` | Login local e gestão de credenciais da equipe |
| `support` | `server/routers/support.ts` | Modo Suporte — resgate do handoff emitido pelo Painel Master do saas-core, visão somente-leitura/escrita limitada do restaurante pra diagnóstico (nunca acessa Pix/gateway/credenciais de equipe) |

A camada de licenciamento SaaS (sincronização periódica de plano/features com o serviço `saas-core`, ver `server/_core/license.ts`) não é um módulo tRPC próprio — é consumida internamente pelo middleware `requireFeature`/`featureProcedure` (`server/_core/trpc.ts`) que trava procedures específicas conforme o plano do restaurante. Detalhes em `docs/architecture.md`.

As procedures públicas não exigem sessão. Procedures protegidas dependem do contexto construído em `server/_core/context.ts`; procedures administrativas usam o middleware de autorização em `server/_core/trpc.ts`. No modo independente, mantenha os contratos tRPC e substitua somente a fonte de identidade/sessão e os helpers de persistência.

O frontend não chama SQL, não conhece `DATABASE_URL` e não deve acessar storage privado diretamente. Uploads são encaminhados ao backend e devem retornar uma URL do storage independente após a migração.
