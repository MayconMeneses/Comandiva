#!/bin/bash
# ============================================================
#   PUB X — INICIAR TUDO COM UM ÚNICO COMANDO
# ============================================================
# Uso:
#   chmod +x iniciar.sh
#   ./iniciar.sh
#
# O que este script faz sozinho, sem precisar de mais nada:
#   1. Cria o arquivo .env (se ainda não existir), com senhas e
#      chaves aleatórias seguras já preenchidas.
#   2. Sobe banco de dados (MySQL), storage (MinIO) e a aplicação
#      via Docker Compose.
#   3. Dentro do container da aplicação, o entrypoint.sh cuida de:
#      aplicar as migrations do banco, rodar o seed inicial (menu
#      de exemplo + usuário admin) e então iniciar o servidor.
#
# Pré-requisito: ter Docker e Docker Compose instalados.
# ============================================================

set -e

cd "$(dirname "$0")"

ENV_FILE=".env"
ENV_EXAMPLE="config/env.example"

random_secret() {
  # gera uma string aleatória segura (hex) do tamanho pedido
  local length="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$length"
  else
    head -c "$((length * 2))" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

if [ ! -f "$ENV_FILE" ]; then
  echo "==> Nenhum .env encontrado. Criando um novo a partir de $ENV_EXAMPLE com segredos aleatórios..."
  cp "$ENV_EXAMPLE" "$ENV_FILE"

  JWT_SECRET_VALUE=$(random_secret 32)
  MYSQL_PASSWORD_VALUE=$(random_secret 12)
  MYSQL_ROOT_PASSWORD_VALUE=$(random_secret 12)
  S3_ACCESS_KEY_VALUE=$(random_secret 8)
  S3_SECRET_KEY_VALUE=$(random_secret 16)
  ADMIN_PASSWORD_VALUE=$(random_secret 6)

  # Ajusta os valores no .env recém-criado
  sed -i.bak \
    -e "s#^JWT_SECRET=.*#JWT_SECRET=${JWT_SECRET_VALUE}#" \
    -e "s#^DATABASE_URL=.*#DATABASE_URL=mysql://pubx:${MYSQL_PASSWORD_VALUE}@localhost:3306/pubx#" \
    -e "s#^BOOTSTRAP_ADMIN_PASSWORD=.*#BOOTSTRAP_ADMIN_PASSWORD=${ADMIN_PASSWORD_VALUE}#" \
    -e "s#^S3_ACCESS_KEY_ID=.*#S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_VALUE}#" \
    -e "s#^S3_SECRET_ACCESS_KEY=.*#S3_SECRET_ACCESS_KEY=${S3_SECRET_KEY_VALUE}#" \
    "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"

  {
    echo ""
    echo "# Usadas pelo docker-compose.independent.yml para subir o container do banco"
    echo "MYSQL_DATABASE=pubx"
    echo "MYSQL_USER=pubx"
    echo "MYSQL_PASSWORD=${MYSQL_PASSWORD_VALUE}"
    echo "MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD_VALUE}"
  } >> "$ENV_FILE"

  echo "==> .env criado."
  echo ""
  echo "    Usuário admin:  admin"
  echo "    Senha admin:    ${ADMIN_PASSWORD_VALUE}"
  echo ""
  echo "    (Essas informações também estão salvas dentro do arquivo .env)"
  echo ""
else
  echo "==> Arquivo .env já existe, usando o que já está configurado."
fi

echo "==> Subindo banco de dados, storage e aplicação..."
export GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
docker compose -f docker-compose.independent.yml up -d --build

echo ""
echo "============================================================"
echo " Pronto! O MM System Creator está subindo."
echo " Acesse em alguns segundos: http://localhost:3000"
echo ""
echo " Para acompanhar os logs em tempo real:"
echo "   docker compose -f docker-compose.independent.yml logs -f app"
echo ""
echo " Para parar tudo:"
echo "   docker compose -f docker-compose.independent.yml down"
echo "============================================================"

# ------------------------------------------------------------
# Smoke test pós-deploy (opcional): confere se a aplicação subiu
# de verdade (home + login) usando scripts/smoke-independent.mjs.
# Nunca aborta o script — só avisa se algo parecer errado, pra
# confirmação manual ficar por conta do usuário.
# ------------------------------------------------------------
echo ""
echo "==> Aguardando a aplicação inicializar para rodar o smoke test..."
sleep 8

if command -v node >/dev/null 2>&1; then
  SMOKE_USERNAME_VALUE=$(grep -m1 '^BOOTSTRAP_ADMIN_USERNAME=' "$ENV_FILE" 2>/dev/null | cut -d '=' -f2-)
  SMOKE_PASSWORD_VALUE=$(grep -m1 '^BOOTSTRAP_ADMIN_PASSWORD=' "$ENV_FILE" 2>/dev/null | cut -d '=' -f2-)
  APP_PORT_VALUE=$(grep -m1 '^APP_PORT=' "$ENV_FILE" 2>/dev/null | cut -d '=' -f2-)
  APP_PORT_VALUE="${APP_PORT_VALUE:-3000}"

  if SMOKE_BASE_URL="http://localhost:${APP_PORT_VALUE}" \
     SMOKE_USERNAME="${SMOKE_USERNAME_VALUE:-admin}" \
     SMOKE_PASSWORD="${SMOKE_PASSWORD_VALUE}" \
     node scripts/smoke-independent.mjs; then
    echo "==> Smoke test pós-deploy: OK (home e login responderam)."
  else
    echo "⚠️  Smoke test falhou, confirme login manualmente em http://localhost:${APP_PORT_VALUE}"
  fi
else
  echo "⚠️  Node não encontrado no host — pulando smoke test automático. Confirme login manualmente em http://localhost:${APP_PORT_VALUE:-3000}"
fi
