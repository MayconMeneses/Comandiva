# Migração de dados do MM System Creator

## O que deve ser migrado

A base contém as tabelas `users`, `restaurant_staff_credentials`, `restaurant_settings`, `delivery_routes`, `categories`, `products`, `promotions`, `addon_groups`, `addon_options`, `customers`, `customer_addresses`, `customer_change_logs`, `orders`, `order_items`, `order_item_addons`, `order_status_history`, `order_change_logs`, `print_jobs` e `payments`. O schema e os relacionamentos completos estão em `drizzle/schema.ts`.

A ordem de importação deve respeitar dependências: usuários e configurações; categorias e produtos; grupos e opções de adicionais; clientes e endereços; rotas; pedidos; itens e adicionais dos pedidos; histórico, auditoria, impressão e pagamentos.

## Exportação

A exportação deve ser executada por uma identidade com permissão somente leitura ou por um administrador de banco. Use `mysqldump` com `--single-transaction`, `--routines`, `--triggers` e `--events`, sem registrar a senha na linha de comando. O script `scripts/backup-db.mjs` lê `DATABASE_URL` e usa `MYSQL_PWD` apenas no processo filho.

O pacote não inclui automaticamente o dump da produção porque ele contém dados pessoais, credenciais protegidas, sessões e potencialmente informações comerciais. O dump precisa ser gerado em ambiente autorizado, criptografado e transferido por canal seguro.

## Importação

Crie uma base vazia no servidor novo, aplique o schema/migrations, restaure o dump e valide contagens. Não execute `scripts/seed.ts` sobre uma base de produção restaurada sem revisar a política de dados, pois o seed contém conteúdo inicial operacional e pode conflitar com registros existentes.

```bash
DATABASE_URL=mysql://novo_usuario:senha@novo_host:3306/pubx \
  node scripts/restore-db.mjs backups/pubx.sql
```

## Checklist de reconciliação

| Verificação | Critério |
|---|---|
| Contagem de tabelas | Todas as 19 tabelas esperadas existem |
| Integridade | Chaves estrangeiras e índices sem erro |
| Cardápio | Categorias, produtos, adicionais e promoções preservados |
| Clientes | Telefones normalizados e endereços associados |
| Pedidos | Totais, status e snapshots de endereço preservados |
| Auditoria | Históricos e logs mantidos |
| Assets | Cada `imageUrl` aponta para storage independente válido |
| Usuários | Administradores migrados sem copiar cookies ou tokens |

## Itens que não podem ser migrados por simples dump

Cookies, sessões autenticação externa, tokens Local, segredos serviço interno, URLs assinadas temporárias e objetos privados não devem ser tratados como dados relacionais. Eles expiram, são vinculados ao provedor ou são credenciais. Para esses itens, crie credenciais novas no ambiente independente e copie os objetos de storage por procedimento autenticado.

## Rollback

Mantenha a base original em modo somente leitura durante o corte. Faça um dump imediatamente antes da mudança, valide a nova base e só então troque DNS. Se a verificação falhar, reverta o DNS para a aplicação antiga e preserve os logs de migração para diagnóstico.
