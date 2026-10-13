# Comandiva

Monorepo com três projetos independentes:

- `Sistema de restaurante/` — app dos restaurantes (cardápio, pedidos, painel)
- `Master/` — Painel Master, cobrança e licenciamento (Mercado Pago)
- `Site comercial/` — páginas de venda; o Master as publica (ver `Master/scripts/sync-site-comercial.mjs`)

Cada pasta tem seu `package.json` e deploy próprios.

## Pastas só locais (não vão para o GitHub)

- `Backups/` — cópias de segurança (ex.: histórico git antigo em `.bundle`)
- `Midia/` — `Imagens/` e `Reels/` (vídeos e projeto de reels)
- `Documentos/` — relatórios e anotações (ex.: auditoria de segurança)
