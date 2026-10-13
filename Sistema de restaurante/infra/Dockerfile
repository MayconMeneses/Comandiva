FROM node:22-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN npm install -g corepack@latest && corepack pnpm install
COPY . .
RUN corepack pnpm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Hash do commit no momento do build (passado de fora — o contexto de build
# não tem acesso ao .git, ver .dockerignore) — exposto em /version pra saber
# exatamente qual código está rodando em produção, sem precisar SSH na VPS.
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT
# mysqldump/mysql (scripts/backup-db.mjs e restore-db.mjs) — sem isso o backup
# documentado em docs/production-deploy.md falha com "mysqldump: not found".
RUN apt-get update && apt-get install -y --no-install-recommends default-mysql-client && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=build /app/drizzle ./drizzle
COPY --chown=node:node --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --chown=node:node --from=build /app/scripts ./scripts
COPY --chown=node:node --from=build /app/shared ./shared
COPY --chown=node:node --from=build /app/server ./server
COPY --chown=node:node --from=build /app/tsconfig.json ./tsconfig.json
COPY --chown=node:node infra/entrypoint.sh ./infra/entrypoint.sh
RUN chmod +x ./infra/entrypoint.sh
# Não rodar como root dentro do container — node:22-slim já traz o usuário
# "node" (uid 1000) pronto pra isso. Dono já vem certo de cada COPY acima
# (--chown) em vez de um `chown -R /app` no final: nesta máquina esse passo
# sozinho já chegou a levar mais de 11 minutos varrendo o node_modules
# inteiro por fora — copiar já com o dono certo evita essa segunda passada.
USER node
ENTRYPOINT ["./infra/entrypoint.sh"]
