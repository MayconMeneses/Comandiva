# Deploy em produção — Hostinger VPS + Docker

Guia passo a passo para colocar o Comandiva no ar numa VPS da Hostinger, com domínio próprio,
HTTPS e os dados protegidos. Todos os comandos abaixo são os mesmos scripts que já existem
no projeto — nada novo para aprender, só a ordem certa de rodar.

Arquitetura final:

```
Internet → domínio → HTTPS/reverse proxy (na VPS) → container "app" (Node/Express)
                                                          ↓
                                            container "db" (MySQL, só rede interna)
                                            container "storage" (MinIO, só rede interna)
```

`db` e `storage` nunca ficam expostos à internet — só `app` (e, na frente dela, o reverse
proxy). Isso já está garantido no `docker-compose.independent.yml` (portas do MySQL/MinIO
publicadas apenas em `127.0.0.1`).

---

## Etapa 1 — Criar a VPS na Hostinger

1. Contrate um plano **KVM** (VPS 1 ou 2 já atendem o Comandiva no começo).
2. Escolha o datacenter **São Paulo** (menor latência para os clientes).
3. No sistema operacional, escolha **Ubuntu 24.04 LTS** (ou 22.04).
4. Configure acesso por **chave SSH** (evite senha root pura). A Hostinger deixa isso pronto
   na criação da VPS.
5. Anote o **IP público** da VPS — vai precisar dele na Etapa 5 (DNS).

## Etapa 2 — Instalar Docker no Ubuntu

Conecte por SSH (`ssh root@SEU_IP`) e instale o Docker Engine + Compose v2 oficiais:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Saia e entre de novo no SSH para o grupo `docker` valer. Confirme:

```bash
docker --version
docker compose version
```

Configure o firewall para liberar só o essencial (SSH, HTTP, HTTPS):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Note que **nenhuma porta do MySQL (3306) ou do MinIO (9000/9001) precisa ser liberada aqui** —
o `docker-compose.independent.yml` já as mantém só em `127.0.0.1` dentro da própria VPS.

## Etapa 3 — Enviar o projeto para o servidor

Duas formas práticas (escolha uma):

**a) Com Git** (recomendado se o projeto for versionado em um repositório privado):

```bash
git clone <url-do-seu-repositorio-privado> /opt/mmsystemcreator
cd /opt/mmsystemcreator
```

**b) Sem Git, copiando direto do seu computador** (via `rsync`, a partir do seu Windows/WSL):

```bash
rsync -avz --exclude node_modules --exclude dist --exclude .env \
  "/mnt/c/Users/maico/OneDrive/Área de Trabalho/Nova pasta/Pubx/" \
  root@SEU_IP:/opt/mmsystemcreator/
```

`.env`, `node_modules` e `dist` nunca devem ser copiados — o `.env` de produção é criado
direto no servidor (Etapa 4), e os outros dois são gerados pelo próprio build do Docker.

## Etapa 4 — Criar o `.env` de produção

Na VPS, dentro de `/opt/mmsystemcreator`:

```bash
./iniciar.sh
```

Na primeira execução, o script cria um `.env` novo com senhas e chaves aleatórias fortes
(MySQL, MinIO, `JWT_SECRET`, senha do admin) e já sobe os containers. Ele mostra o usuário e
senha do administrador no final — **anote antes de fechar o terminal** (também fica salvo
dentro do `.env`).

Antes de seguir para o domínio, edite o `.env` gerado e ajuste manualmente:

```bash
nano .env
```

| Variável | Valor em produção |
|---|---|
| `NODE_ENV` | `production` |
| `FRONTEND_URL` / `BACKEND_URL` | `https://seudominio.com.br` (Etapa 5) |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY` | `true` — **obrigatório** atrás do reverse proxy da Etapa 6; sem isso, o limitador de tentativas de login (rate limit) passa a enxergar todo mundo com o mesmo IP (o do proxy) e perde o efeito |
| `S3_PUBLIC_BASE_URL` | a URL pública real das imagens (Etapa 9) |

Depois de editar, aplique com:

```bash
docker compose -f docker-compose.independent.yml up -d --build
```

## Etapa 5 — Configurar o domínio

No painel de DNS do seu domínio (Hostinger ou onde ele estiver registrado), crie um registro:

```
Tipo: A
Nome: @  (ou "pedidos", se for um subdomínio)
Valor: SEU_IP_DA_VPS
TTL: automático
```

Espere a propagação (geralmente minutos, pode levar até algumas horas). Teste com
`ping seudominio.com.br` — deve responder com o IP da VPS.

## Etapa 6 — Configurar HTTPS (reverse proxy)

A aplicação continua ouvindo internamente em `PORT=3000` — quem fala com a internet é um
reverse proxy na própria VPS, fora do `docker-compose.independent.yml`. O caminho mais simples
é o **Caddy**, que emite e renova o certificado HTTPS (Let's Encrypt) sozinho.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Edite `/etc/caddy/Caddyfile`:

```
seudominio.com.br {
    reverse_proxy 127.0.0.1:3000
}
```

Reinicie:

```bash
sudo systemctl restart caddy
```

Pronto — Caddy resolve HTTPS automaticamente (certificado + renovação) e encaminha tudo para
o container `app` na porta 3000. Se preferir Nginx + Certbot, o princípio é o mesmo: proxy
reverso para `127.0.0.1:3000` com os cabeçalhos `X-Forwarded-Proto`/`X-Forwarded-For`
encaminhados (Caddy já faz isso por padrão).

## Etapa 7 — Subir o Docker Compose

Se ainda não subiu (ou depois de qualquer alteração no `.env`):

```bash
cd /opt/mmsystemcreator
docker compose -f docker-compose.independent.yml up -d --build
```

Acompanhe:

```bash
docker compose -f docker-compose.independent.yml logs -f app
```

O `infra/entrypoint.sh` cuida sozinho de: esperar o MySQL responder, aplicar as migrations
(`drizzle-kit migrate`) e rodar o seed idempotente antes de iniciar o servidor.

## Etapa 8 — Verificar o banco

```bash
docker compose -f docker-compose.independent.yml ps db
docker compose -f docker-compose.independent.yml exec db mysql -u root -p -e "SHOW DATABASES;"
```

O status deve aparecer como `healthy`. Confirme que o schema foi aplicado:

```bash
docker compose -f docker-compose.independent.yml exec app node_modules/.bin/drizzle-kit migrate
```

(rodar de novo não tem efeito — as migrations já aplicadas são ignoradas).

## Etapa 9 — Verificar o MinIO

O console do MinIO (porta 9001) **não deve** ficar público. Para conferir o bucket, abra um
túnel SSH temporário do seu computador:

```bash
ssh -L 9001:127.0.0.1:9001 root@SEU_IP
```

E acesse `http://localhost:9001` no seu navegador local com as credenciais
`S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` do `.env`. Confirme que o bucket definido em
`S3_BUCKET` existe (ele é criado automaticamente no primeiro upload de imagem pelo painel).
Depois de conferir, feche o túnel — não deixe a porta 9001 aberta.

Confira também que `S3_PUBLIC_BASE_URL` no `.env` aponta para uma URL que os clientes
conseguem acessar de fora (não `localhost`). Duas opções comuns:
- Expor o MinIO num subdomínio próprio atrás do mesmo reverse proxy (ex.:
  `https://storage.seudominio.com.br` → `127.0.0.1:9000`), ou
- Usar um provedor S3-compatible externo já com URL pública própria.

## Etapa 10 — Criar o primeiro administrador

Já foi criado automaticamente na Etapa 4 pelo seed, usando `BOOTSTRAP_ADMIN_USERNAME` e
`BOOTSTRAP_ADMIN_PASSWORD` do `.env`. Se quiser confirmar ou criar acessos adicionais depois,
use o próprio painel (`/admin` → Equipe/Acessos) já logado como esse administrador principal.

## Etapa 11 — Testar o menu público

Acesse `https://seudominio.com.br` e confirme: categorias aparecem, imagens carregam (via
`S3_PUBLIC_BASE_URL`), filtro de horário (almoço/janta) funciona, checkout completa um pedido
de teste e a página `/acompanhar` mostra o status.

## Etapa 12 — Testar o painel administrativo

Acesse `https://seudominio.com.br/admin`, faça login com o administrador da Etapa 10 e
confirme: cardápio (categorias/produtos/complementos/promoções), pedidos, clientes, rotas de
entrega, relatórios, conta (Pix/gateways) e eventos. Teste também `/painel-pedidos` (kanban
operacional).

## Etapa 13 — Configurar backup

O backup gera um único arquivo (banco + imagens do storage juntos, `.tar.gz` ou
`.tar.gz.enc` se `BACKUP_ENCRYPTION_KEY` estiver configurada em `.env` — recomendado em
produção). Rode um backup manual para validar:

```bash
docker compose -f docker-compose.independent.yml exec app node scripts/backup-db.mjs backups/manual-$(date +%F).tar.gz
docker compose -f docker-compose.independent.yml cp app:/app/backups ./backups
```

Para automatizar, adicione um cron na própria VPS (fora do container, rodando via `docker
compose exec`):

```bash
crontab -e
```

```
0 4 * * * cd /opt/mmsystemcreator && docker compose -f docker-compose.independent.yml exec -T app node scripts/backup-db.mjs backups/auto-$(date +\%F).tar.gz && find backups -name 'auto-*.tar.gz*' -mtime +14 -delete
```

Isso gera um backup diário às 4h e apaga automaticamente os com mais de 14 dias (retenção
simples, sem depender de serviço pago). **Preencha `BACKUP_OFFSITE_S3_*` em `.env`** (qualquer
destino compatível com S3 — ex.: Backblaze B2) para o backup ser enviado sozinho pra fora da
VPS a cada execução — sem isso, um backup que mora só no mesmo disco do servidor não protege
contra perda da VPS inteira.

Para restaurar (ex.: em caso de recuperação de desastre — funciona tanto com o novo formato
`.tar.gz`/`.tar.gz.enc` quanto com um `.sql` antigo, de antes desta mudança):

```bash
docker compose -f docker-compose.independent.yml exec -T app node scripts/restore-db.mjs backups/auto-2026-09-03.tar.gz.enc
```

O restore foi verificado de ponta a ponta (banco + storage, criptografado) restaurando num
banco descartável separado — não é só um script que existe, foi comprovado que funciona.

---

## Checklist final

- [ ] `.env` de produção com `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`
- [ ] `FRONTEND_URL`/`BACKEND_URL`/`S3_PUBLIC_BASE_URL` usando o domínio real em HTTPS
- [ ] DNS apontando para a VPS e HTTPS ativo (cadeado no navegador)
- [ ] `ufw` liberando só 22/80/443
- [ ] MySQL e MinIO acessíveis apenas em `127.0.0.1` (já garantido pelo compose)
- [ ] Backup diário agendado e testado (restore de verificação feito ao menos uma vez)
- [ ] Login administrativo, cardápio, checkout e impressão testados no domínio real
