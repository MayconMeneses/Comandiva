# MM System Creator — sistema independente de pedidos

Este pacote contém o código-fonte do sistema de pedidos do MM System Creator, organizado em frontend React, backend Express/tRPC, schema Drizzle/MariaDB, scripts, assets e documentação.

| Área | Local | Responsabilidade |
|---|---|---|
| Frontend | `client/` | Vitrine, checkout, acompanhamento, painel e componentes |
| Backend/API | `server/` | Express, tRPC, autenticação, regras, consultas e storage |
| Banco | `drizzle/` e `server/db.ts` | Schema, relações, migrations e acesso ao banco |
| Tipos compartilhados | `shared/` | Contratos e domínio compartilhado |
| Scripts | `scripts/` | Seed, importação, reconciliação, backup e restauração |
| Infraestrutura | `infra/` e `docker-compose.independent.yml` | Container da aplicação e serviços locais |
| Configuração | `config/env.example` | Modelo de ambiente sem segredos |
| Documentação | `docs/` | Arquitetura, instalação, migração e validação |

## Execução com um único comando (recomendado)

Só precisa ter Docker instalado. Depois é um comando só:

```bash
./iniciar.sh
```

Esse script sozinho: cria o `.env` com senhas aleatórias seguras (se ainda não existir e mostra o usuário/senha do admin no final), sobe o banco de dados, o storage (MinIO) e a aplicação, aplica as migrations e roda o seed inicial. Quando terminar, o site estará em `http://localhost:3000`.

Para acompanhar o andamento: `docker compose -f docker-compose.independent.yml logs -f app`
Para parar tudo: `docker compose -f docker-compose.independent.yml down`
Para rodar de novo depois: `./iniciar.sh` novamente (ele reaproveita o `.env` já existente).

## Execução manual (sem Docker, ambiente já com Node e MySQL prontos)

```bash
cp config/env.example .env
# Ajuste DATABASE_URL, JWT_SECRET, S3_* e BOOTSTRAP_ADMIN_*.
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm run seed
pnpm dev
```

A aplicação usa autenticação local com sessão JWT e storage S3-compatible/MinIO configurado por ambiente. O frontend conhece somente `VITE_API_URL`; o backend conhece somente `DATABASE_URL` e as variáveis S3. Não há login externo, proxy de storage ou serviço proprietário obrigatório.

## Banco e dados

O banco utilizado é MySQL/MariaDB por meio de Drizzle ORM e `mysql2`. O frontend não acessa o banco diretamente. Procedures tRPC chamam helpers em `server/db.ts`, e o schema completo está em `drizzle/schema.ts`. Dados de produção, sessões, tokens, segredos e objetos privados não são incluídos no ZIP.

## Documentos principais

Leia `docs/independent-install.md` para instalar do zero, `docs/portability-audit.md` para a auditoria de independência e `docs/data-migration.md` para preservar dados de outra instalação. Use `config/env.example` como base e nunca versione o arquivo `.env` real.
