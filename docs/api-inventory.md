# Inventário de API

A aplicação expõe uma API tRPC em `/api/trpc`. O cliente é criado em `client/src/lib/trpc.ts`; o servidor monta o router em `server/routers.ts` e delega por módulos.

| Módulo | Arquivo | Escopo |
|---|---|---|
| `auth` | `server/routers.ts` | Sessão, usuário atual e logout |
| `catalog` | `server/routers/catalog.ts` | Categorias, produtos, promoções e adicionais públicos |
| `customer` | `server/routers/customer.ts` | Identificação por telefone, cadastro e endereços |
| `order` | `server/routers/order.ts` | Checkout, criação, acompanhamento e status |
| `admin` | `server/routers/admin.ts` | Visão geral, clientes, catálogo, pedidos, rotas e relatórios |
| `team` | `server/routers/team.ts` | Login local e gestão de credenciais da equipe |

As procedures públicas não exigem sessão. Procedures protegidas dependem do contexto construído em `server/_core/context.ts`; procedures administrativas usam o middleware de autorização em `server/_core/trpc.ts`. No modo independente, mantenha os contratos tRPC e substitua somente a fonte de identidade/sessão e os helpers de persistência.

O frontend não chama SQL, não conhece `DATABASE_URL` e não deve acessar storage privado diretamente. Uploads são encaminhados ao backend e devem retornar uma URL do storage independente após a migração.
