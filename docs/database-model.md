# Modelo de dados e camada de acesso

## Camadas

O frontend usa o cliente tRPC em `client/src/lib/trpc.ts` e não conhece credenciais nem SQL. O servidor expõe procedures em `server/routers.ts` e submódulos de `server/routers/`. As consultas e mutações de negócio acessam helpers em `server/db.ts`. O schema declarativo fica em `drizzle/schema.ts` e é consumido pelo Drizzle ORM com o driver `mysql2`.

## Tabelas

Atualizado em 2026-09 (auditoria de segurança) — 36 tabelas ao todo (`drizzle/schema.ts` é sempre a fonte de verdade sobre colunas/tipos/índices; esta lista é só um mapa de navegação).

**Identidade e acesso**

| Tabela | Finalidade |
|---|---|
| `users` | Identidade administrativa e papel (`admin`, `staff`, `user`) |
| `restaurant_staff_credentials` | Login local da equipe, username, hash e situação |
| `account_audit_log` | Auditoria de ações administrativas sensíveis — equipe/permissões, gateway de pagamento, chave Pix (nunca grava o valor de uma credencial) |

**Restaurante e cardápio**

| Tabela | Finalidade |
|---|---|
| `restaurant_settings` | Nome, contato, horário, regras, tema visual e Pix do restaurante |
| `delivery_routes` | Áreas, taxa, prazo e disponibilidade de entrega |
| `categories` | Categorias do cardápio |
| `products` | Produtos, preço, imagem, disponibilidade e arquivamento |
| `events` | Eventos divulgados no cardápio público |
| `faq_items` | Perguntas frequentes exibidas no site |

**Promoções**

| Tabela | Finalidade |
|---|---|
| `promotions` | Ofertas e destaques da vitrine |
| `promotion_products` | Produtos incluídos em cada promoção |
| `promotion_addon_defaults` | Complementos padrão de uma promoção |
| `addon_groups` | Grupos de complementos e limites de seleção |
| `addon_options` | Opções e preços adicionais |

**Clientes**

| Tabela | Finalidade |
|---|---|
| `customers` | Cadastro por telefone |
| `customer_addresses` | Endereços associados aos clientes |
| `customer_change_logs` | Auditoria de alterações cadastrais |
| `phone_verification_codes` | Códigos de verificação por SMS (autoatendimento LGPD, ver `server/routers/dataRights.ts`) |

**Pedidos**

| Tabela | Finalidade |
|---|---|
| `orders` | Pedido, cliente, snapshot do endereço, totais e status |
| `order_items` | Itens e preço congelado no pedido |
| `order_item_addons` | Complementos congelados no item do pedido |
| `order_status_history` | Histórico de transições de status |
| `order_change_logs` | Auditoria de alterações administrativas em pedidos |
| `print_jobs` | Fila e situação de impressão |

**Pagamentos**

| Tabela | Finalidade |
|---|---|
| `payments` | Método, valor, status e referência de pagamento do cliente final |
| `payment_gateways` | Credenciais dos gateways de pagamento configurados (Mercado Pago etc.) |
| `webhook_events` | Idempotência de notificações de webhook já processadas |

**Fiscal (NFC-e)**

| Tabela | Finalidade |
|---|---|
| `fiscal_settings` | Configuração fiscal do restaurante (CNPJ, certificado A1 cifrado, CSC) |
| `fiscal_documents` | Documentos fiscais emitidos |
| `fiscal_tax_categories` | Categorias tributárias usadas na emissão |

**Mesas / QR Code** (recurso pago, ver `server/routers/table.ts`)

| Tabela | Finalidade |
|---|---|
| `restaurant_tables` | Mesas cadastradas e seus QR Codes |
| `table_sessions` | Sessão ativa de uma mesa (cliente sentado, pedidos em aberto) |
| `table_service_requests` | Chamar garçom / pedir a conta pela mesa |
| `table_bill_payments` | Pagamento da conta de uma mesa |
| `table_reservations` | Reservas de mesa |

**Camada de licenciamento (SaaS)**

| Tabela | Finalidade |
|---|---|
| `subscription_cache` | Cache local (fail-open) do plano/features/limites sincronizados do saas-core — ver `server/_core/license.ts` e `docs/architecture.md` |

As colunas, tipos, índices e constraints oficiais estão no arquivo `drizzle/schema.ts`, que é a fonte de verdade. O histórico de migrations versionadas vive em `drizzle/*.sql` (aplicado via `drizzle-kit migrate`, inclusive no CI real contra MySQL — ver `.github/workflows/ci.yml`).

## Troca futura de banco

O frontend não precisa ser alterado para trocar MySQL por outro banco. A substituição fica concentrada no driver, no schema Drizzle quando necessário e nos helpers de `server/db.ts`. O MySQL/TiDB é a escolha atual por compatibilidade com o template e `mysql2`; PostgreSQL exigiria converter tipos e gerar uma migration própria.
