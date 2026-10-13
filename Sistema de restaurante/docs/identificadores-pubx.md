# Identificadores "pubx" que continuam em produção (renomear só com janela de manutenção)

O nome de marca **Pub X** foi trocado por **Comandiva** em textos, telas e documentos. Os itens abaixo são
identificadores técnicos que **dados e serviços em produção usam hoje**; trocá-los sem migração quebra logins, imagens ou o banco.

| Onde | Identificador | O que quebra se trocar sem migrar |
|---|---|---|
| Banco de dados (compose, `.env`, `iniciar.sh`, `provision-client.mjs`) | `MYSQL_DATABASE=pubx`, `MYSQL_USER=pubx` | O banco existente tem esse nome; o app não conecta. |
| Volumes Docker (`docker-compose.independent.yml`) | `pubx_mysql_data`, `pubx_minio_data`, `pubx_backups` | Docker cria volumes novos e VAZIOS; os dados ficam órfãos. |
| Nome do projeto/containers na VPS | pasta `/opt/pubx` → containers `pubx-app-1`, `pubx-db-1`, `pubx-storage-1` | Comandos, backups e cron usam esses nomes. |
| Bucket de imagens | `S3_BUCKET=pubx-assets` | Imagens existentes ficam no bucket antigo. |
| Imagens gravadas no banco | `imageUrl` = `/assets/pubx/...` (produtos, categorias, logo) | Todas as imagens do cardápio quebram. Exige `UPDATE` no banco + mover a pasta `assets/pubx`. |
| Cookie de sessão | `SESSION_COOKIE_NAME=pubx_session`, `APP_ID=pubx` | Todos saem do login. |
| Domínio | `pubx.mmsystem.tech` (sitemap, Caddy) | Links e certificado. |
| Acesso à VPS | alias SSH `pubx-vps` (arquivo `~/.ssh/config`) | Scripts e permissões. |
| Migration inicial | `drizzle/migrations/0000_initial_pubx.sql` | Script `validate-migration.mjs` aponta pro nome. |

Quando for a hora: backup completo, janela combinada, renomear na ordem banco/volumes → bucket/imagens → cookie → domínio, e testar cada passo.
