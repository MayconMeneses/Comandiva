# Instalação e operação independente

## Estado de portabilidade

O pacote contém o código-fonte e os arquivos versionados do Pub X, já auditado e sem dependências obrigatórias de uma plataforma externa (veja `docs/portability-audit.md`). Para operar de forma independente, use `DATABASE_URL` (MySQL/MariaDB próprio) e `S3_ENDPOINT`/`S3_*` (S3-compatible/MinIO próprio); não há autenticação externa nem proxy de storage obrigatório na versão exportada. O banco pode ser trocado sem alterar o frontend porque as procedures tRPC acessam os helpers centralizados em `server/db.ts`.

## Caminho mais simples: um único comando

Se você tem Docker instalado, não precisa seguir os passos manuais abaixo — rode:

```bash
./iniciar.sh
```

Esse script cria o `.env` com segredos aleatórios (se ainda não existir), sobe banco de dados, storage e aplicação, e dentro do container o próprio `infra/entrypoint.sh` aplica as migrations e roda o seed antes de iniciar o servidor. O restante desta página descreve o que acontece por baixo dos panos e como fazer manualmente, caso precise.

## Pré-requisitos

São necessários Node.js 22 ou superior, pnpm 10, MySQL 8 ou MariaDB compatível, um bucket S3-compatible/MinIO e um domínio com DNS controlável. Para o modo Docker, instale Docker Engine e Docker Compose v2.

## Instalação sem Docker

```bash
cp config/env.example .env
# Defina ,  e credenciais próprias
pnpm install --frozen-lockfile
pnpm check
pnpm db:validate-migration # opcional, apontando MIGRATION_DATABASE_URL para uma base vazia
pnpm drizzle-kit migrate
pnpm run seed
pnpm dev
```

A aplicação de desenvolvimento fica em `http://localhost:3000`. Para produção, execute `pnpm build` e depois `NODE_ENV=production pnpm start`. O servidor lê `PORT` e nunca deve depender de uma porta fixa do provedor.

## Instalação com Docker Compose

O arquivo fornecido é `docker-compose.independent.yml`. Copie `config/env.example` para `.env`, defina senhas fortes para `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY`, revise `DATABASE_URL` e execute:

```bash
docker compose -f docker-compose.independent.yml up -d --build
```

O serviço `db` usa volume persistente MySQL, `storage` usa volume persistente MinIO e `app` executa o build completo do frontend e backend. O container `app` roda `infra/entrypoint.sh`, que sozinho espera o banco ficar disponível, aplica as migrations (`drizzle-kit migrate`) e roda o seed (`scripts/seed.ts`) antes de iniciar o servidor — não é preciso rodar `exec` manualmente. O seed é idempotente: ele verifica se já existem dados e não duplica nada, incluindo em reinícios do container.

Se precisar rodar migration ou seed manualmente por algum motivo (ex.: depuração), ainda é possível:

```bash
docker compose -f docker-compose.independent.yml exec app node_modules/.bin/drizzle-kit migrate
docker compose -f docker-compose.independent.yml exec app node_modules/.bin/tsx scripts/seed.ts
```

## Banco, migrations e dados existentes

A conexão é `DATABASE_URL`. O schema TypeScript está em `drizzle/schema.ts`; o ORM é Drizzle e o driver é `mysql2`. Para uma base vazia, aplique `drizzle/migrations/0000_initial_pubx.sql` ou `database/schema.mysql.sql`; o comando `pnpm db:validate-migration` testa a migration em `MIGRATION_DATABASE_URL`. O inventário dos contratos tRPC está em `docs/api-inventory.md`.

Para preservar dados existentes, faça um dump autenticado da base atual, valide o arquivo e restaure-o na nova base antes de executar seeds. Não misture seed demonstrativo com uma base restaurada sem revisar conflitos de chaves e duplicidades.

```bash
node scripts/backup-db.mjs backups/pubx-before-migration.sql
DATABASE_URL=mysql://usuario:senha@novo-host:3306/pubx node scripts/restore-db.mjs backups/pubx-before-migration.sql
```

Faça um backup completo, um backup de verificação e uma restauração de ensaio antes de apontar o domínio para a nova aplicação.

## Storage

O caminho recomendado é MinIO local ou S3-compatible em produção. Configure endpoint, região, bucket, credenciais e URL pública em `.env`. Copie os objetos atuais para o bucket novo e atualize as referências de `imageUrl` no banco. URLs `/assets/pubx/...` não são arquivos locais exportados; elas precisam de cópia autenticada ou substituição por URLs S3 próprias.

## Autenticação

A vitrine pública funciona sem conta tradicional. No painel administrativo, administradores usam credenciais locais com senha derivada por hash, sessão JWT assinada por `JWT_SECRET` e bootstrap opcional no seed. O administrador principal deve ser criado com `BOOTSTRAP_ADMIN_*`; depois, os demais acessos podem ser geridos no painel. Não copie cookies ou tokens da Local para o novo ambiente. Para produção, adicione rate limiting, rotação de sessão e recuperação segura de senha.

## Domínio e HTTPS

Aponte o registro DNS do domínio para o balanceador ou servidor do provedor escolhido. Use um reverse proxy como Caddy ou Nginx, emita certificado TLS com ACME/Let's Encrypt e configure `FRONTEND_URL` e `BACKEND_URL` com HTTPS. Se frontend e backend ficarem no mesmo Express, uma origem reduz CORS e simplifica cookies; em origens separadas, configure CORS e `SameSite` de forma explícita.

## E-mail e serviços externos

Não há envio de e-mail obrigatório identificado na versão atual. SMTP, SMS, WhatsApp e mapas são pontos opcionais e devem ser configurados somente com provedores oficiais e credenciais próprias. Antes do go-live, valide pedido, login administrativo, upload, impressão e acompanhamento em uma base de teste.

## Backup e restauração

Use `scripts/backup-db.mjs` em um job externo ao processo HTTP, armazene os dumps criptografados fora do servidor e teste restaurações periodicamente. O storage deve ter versionamento e política de retenção. Mantenha pelo menos uma cópia offline ou em uma segunda região, sem colocar segredos no repositório.
