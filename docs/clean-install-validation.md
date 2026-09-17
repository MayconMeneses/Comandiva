# Validação de instalação limpa

Em 28/08/2026 foi criada uma cópia limpa do pacote em `/tmp/mmsystemcreator-clean-final`, sem `node_modules` e sem `dist`. Foram executados `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm run verify:export` e `pnpm build`, com conclusão bem-sucedida.

Também foi instalado e iniciado um MariaDB local temporário, separado de qualquer ambiente gerenciado. A migration inicial foi aplicada por uma conexão independente e a estrutura SQL foi conferida. Nenhuma operação foi executada em uma base de produção.

O servidor da cópia limpa iniciou e serviu o HTML da vitrine em uma porta local de teste. O smoke test confirmou a API, o frontend e o login local por usuário e senha. O adaptador S3-compatible foi testado com MinIO local, incluindo criação de bucket, upload, leitura e URL assinada.

A auditoria estrita dos arquivos exportáveis não encontrou nomes de plataformas proprietárias, domínios de autenticação, variáveis de ambiente de terceiros, plugins proprietários, proxies de storage ou caminhos legados. O pacote contém somente configuração genérica e opcional por ambiente.
