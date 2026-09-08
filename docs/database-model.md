# Modelo de dados e camada de acesso

## Camadas

O frontend usa o cliente tRPC em `client/src/lib/trpc.ts` e não conhece credenciais nem SQL. O servidor expõe procedures em `server/routers.ts` e submódulos de `server/routers/`. As consultas e mutações de negócio acessam helpers em `server/db.ts`. O schema declarativo fica em `drizzle/schema.ts` e é consumido pelo Drizzle ORM com o driver `mysql2`.

## Tabelas

| Tabela | Finalidade |
|---|---|
| `users` | Identidade administrativa e papel (`admin`, `staff`, `user`) |
| `restaurant_staff_credentials` | Login local da equipe, username, hash e situação |
| `restaurant_settings` | Nome, contato, horário, regras e prazo do restaurante |
| `delivery_routes` | Áreas, taxa, prazo e disponibilidade de entrega |
| `categories` | Categorias do cardápio |
| `products` | Produtos, preço, imagem, disponibilidade e arquivamento |
| `promotions` | Ofertas e destaques da vitrine |
| `addon_groups` | Grupos de complementos e limites de seleção |
| `addon_options` | Opções e preços adicionais |
| `customers` | Cadastro por telefone |
| `customer_addresses` | Endereços associados aos clientes |
| `customer_change_logs` | Auditoria de alterações cadastrais |
| `orders` | Pedido, cliente, snapshot do endereço, totais e status |
| `order_items` | Itens e preço congelado no pedido |
| `order_item_addons` | Complementos congelados no item do pedido |
| `order_status_history` | Histórico de transições de status |
| `order_change_logs` | Auditoria de alterações administrativas |
| `print_jobs` | Fila e situação de impressão |
| `payments` | Método, valor, status e referência de pagamento |

As colunas, tipos, índices e constraints oficiais estão no arquivo `drizzle/schema.ts`, que deve ser a fonte de verdade. O ambiente atual reportou 19 tabelas e não possui migration SQL inicial versionada; gere a migration no ambiente independente e revise o SQL antes de aplicar.

## Troca futura de banco

O frontend não precisa ser alterado para trocar MySQL por outro banco. A substituição fica concentrada no driver, no schema Drizzle quando necessário e nos helpers de `server/db.ts`. O MySQL/TiDB é a escolha atual por compatibilidade com o template e `mysql2`; PostgreSQL exigiria converter tipos e gerar uma migration própria.
