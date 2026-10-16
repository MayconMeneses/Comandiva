# Comandiva — pasta-mãe (SaaS Restaurante)

Lido automaticamente pelo Claude Code quando a sessão é aberta nesta pasta. Cada subpasta tem o seu próprio `CLAUDE.md` com os detalhes; este arquivo só explica como as três partes se encaixam e quais são as regras do dono.

## Estrutura (um repositório git, três projetos)

| Pasta | O que é | Detalhes |
|---|---|---|
| `Sistema de restaurante/` | App dos restaurantes: cardápio público, checkout, painel de pedidos, admin (Express + tRPC + React + MySQL + MinIO) | `Sistema de restaurante/CLAUDE.md` |
| `Master/` | Painel Master, cobrança (Mercado Pago), licenciamento, Modo Suporte. Nunca guarda dado operacional de restaurante | `Master/CLAUDE.md` |
| `Site comercial/` | Páginas de venda. O Master as copia para `Master/client/src/site-comercial` (`scripts/sync-site-comercial.mjs`; cópia ignorada pelo git) e as publica | `Site comercial/CLAUDE.md` |

Pastas só locais (fora do GitHub): `Backups/` (histórico git antigo, memória do Claude, imagens antigas), `Midia/` (imagens e reels), `Documentos/` (relatórios), `Senhas/` (chaves; **nunca** commitar nem mostrar o conteúdo).

Produção (VPS Hostinger, `ssh pubx-vps`): app em `/opt/pubx` (`https://comandiva.mmsystem.tech`, também `pubx.mmsystem.tech`), Master e site comercial em `/opt/saas-core` (`https://mmsystem.tech`, site em `/comercial`).

## Rodar localmente
- O sistema de teste roda em Docker: `docker compose -f docker-compose.independent.yml up -d` dentro de `Sistema de restaurante/` (app em `http://localhost:3000`, MinIO em `:9000`). O Master: `docker compose -f docker-compose.saas-core.yml up -d --build` dentro de `Master/` (`http://localhost:4000`).
- Servidores de desenvolvimento (sem Docker): `.claude/launch.json` desta pasta tem `sistema-dev` (porta 3000) e `master-dev` (porta 4000).
- Conferências antes de dar algo como pronto, em cada projeto: `npx tsc --noEmit`, `npx eslint server client/src shared`, `npx vitest run` (use `--maxWorkers=3` se oscilar por carga) e `pnpm run build`.
- `docker compose restart` ignora mudanças no `.env`; use `up -d <serviço>`.

## Regras do dono (valem sempre)
- **Responder em português (pt-BR)**, explicando passo a passo, sem supor conhecimento de terminal/Docker. O PowerShell dele é antigo: não aceita `&&`; passar comandos em linhas separadas.
- **Nada de commit, push ou deploy sem pedido.** Force push só ele faz, no PowerShell.
- **Deploy**: backup antes, Master primeiro e depois o app, nunca em paralelo. Procedimento completo e armadilhas (CRLF no `git archive`, `docker exec -T` dentro de `ssh bash -s` engole o script, `tar` no Windows) no Obsidian: `Procedimento de Deploy na VPS`.
- **Segredos nunca aparecem na tela.** Valores novos de `.env` são gerados na VPS; chaves guardadas ficam em `Senhas/`.
- **Preço anunciado = preço cobrado** (promoção de 1 produto também desconta).
- **Nenhuma marca "PUB X"** em imagens, telas ou textos. Identificadores técnicos `pubx` (banco, volumes, bucket, cookie, `/assets/pubx/`, `/opt/pubx`, alias SSH) **não** se renomeiam sem janela de manutenção (`Sistema de restaurante/docs/identificadores-pubx.md`).
- **Site comercial**: só mexer quando o pedido citar o site comercial de forma explícita.
- **Nota fiscal (NFC-e) foi removida** em 2026-10-07; não propor de volta. Sem MFA obrigatório no Master: a verificação (pergunta de segurança + código de 4 dígitos, só hash) é opcional; o TOTP foi removido em 2026-10-16.
- Migrations sempre aditivas (`drizzle-kit generate`); nunca destrutivas.
- O app de teste local usa o **Telegram real** do dono: testes que causem erro interno disparam alerta de verdade; avisar antes.
- Não sugerir funcionalidades novas sem ser pedido (o dono já recusou iFood, fidelidade, avaliações).
- Antes de criar qualquer site: consultar as referências de design e as 20 regras de site (arquivo global `~/.claude/rules/site-launch-checklist.md`).

## Onde está o contexto
- **Obsidian** (segundo cérebro): `C:\Users\maico\OneDrive\Área de Trabalho\Obisidian projetos\Projetos\MM System Creator\` — comece por `00 - Índice`, `CONTEXTO DE CONTINUIDADE`, `Decisões` e `Pendências`. Registrar ali novas decisões e correções.
- **Memória do Claude**: `~/.claude/projects/<esta pasta>/memory/` (cópia de segurança em `Backups/memoria-claude-2026-10-14/`).
- Relatórios: `Documentos/` (auditoria de segurança de 2026-10-10).
