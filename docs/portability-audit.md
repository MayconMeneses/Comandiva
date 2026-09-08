# Auditoria de independência do Pub X

## Resumo executivo

O Pub X é uma aplicação full-stack com frontend React, backend Express/tRPC, Drizzle ORM, MySQL/MariaDB, sessão JWT local e storage S3-compatible. O código executável exportável não registra rotas, clientes HTTP, SDKs, plugins ou serviços de uma plataforma externa proprietária.

| Área | Implementação independente |
|---|---|
| Autenticação | Usuário e senha locais, hash com scrypt e sessão JWT assinada por `JWT_SECRET`. |
| Banco | MySQL/MariaDB configurado por `DATABASE_URL`, acessado por `server/db.ts`. |
| Storage | S3-compatible/MinIO por `S3_ENDPOINT`, bucket e credenciais próprias. |
| Frontend | React/Vite configurado por `VITE_API_URL`, sem redirecionamento externo. |
| API | tRPC servido pelo próprio Express em `/api/trpc`. |
| Uploads | `storagePut` grava diretamente no bucket S3-compatible configurado. |
| Integrações opcionais | E-mail, mapas, SMS, WhatsApp e analytics podem ser configurados por provedores escolhidos pelo administrador. |

## Verificação realizada

A auditoria final removeu rotas de autenticação externa, proxy de storage, SDKs, tipos, plugins de runtime, coletores, módulos auxiliares não utilizados e variáveis proprietárias. A busca estrita nos arquivos exportáveis deve retornar zero ocorrências de nomes de plataformas, domínios de autenticação, variáveis proprietárias ou caminhos de proxy.

O build independente não exige modos de compatibilidade. Basta configurar as variáveis genéricas do arquivo `config/env.example`, instalar as dependências do lockfile, aplicar as migrations e executar o servidor.

## Banco e migração

O banco é MySQL/MariaDB, acessado pelo Drizzle ORM e pelo driver `mysql2`. O schema está em `drizzle/schema.ts`, as migrations em `drizzle/migrations/` e o seed em `scripts/seed.ts`. Para preservar dados de outra instalação, exporte um dump autenticado, aplique-o no banco novo e valide as relações antes de iniciar o serviço.

O código-fonte não contém banco de produção, sessões, tokens, credenciais ou objetos privados. Para preservar imagens existentes, copie os objetos para o bucket próprio e atualize os campos `imageUrl` para URLs S3 públicas ou assinadas. Essa etapa depende do acesso administrativo ao ambiente que armazena os dados e não deve ser simulada.

## Dependências open source

As dependências do `package.json` e do `pnpm-lock.yaml` são bibliotecas open source de interface, servidor, validação, banco, criptografia, S3, build e testes. A instalação requer acesso ao registry configurado, mas não exige conta ou serviço proprietário específico.

## Critério de independência

A aplicação opera no fluxo `domínio próprio → frontend próprio → API própria → MySQL/MariaDB próprio → S3/MinIO próprio`. O pacote não contém adaptadores de transição, chamadas obrigatórias a serviços externos de autenticação ou storage, nem credenciais reais.
