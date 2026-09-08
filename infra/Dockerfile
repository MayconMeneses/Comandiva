FROM node:22-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
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
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/shared ./shared
COPY --from=build /app/server ./server
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY infra/entrypoint.sh ./infra/entrypoint.sh
RUN chmod +x ./infra/entrypoint.sh
ENTRYPOINT ["./infra/entrypoint.sh"]
