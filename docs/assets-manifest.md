# Manifesto de assets do Comandiva

## Arquivos incluídos na exportação

Os arquivos abaixo foram recuperados do armazenamento de trabalho do projeto e são incluídos no ZIP em `assets/pubx/` para referência, migração e eventual publicação no storage independente:

| Arquivo | Uso/observação |
|---|---|
| `pub-x/pubx-logo-reference.png` | Logotipo de referência enviado para a marca Comandiva. |
| `pubx/pubx-header-logo.jpg` | Logotipo de cabeçalho recuperado do armazenamento de assets do ambiente. |
| `pub-x/hero-burger-pizza.jpeg` | Imagem de destaque da vitrine. |
| `pub-x/burger-fries.jpeg` | Referência visual de hambúrguer e acompanhamento. |
| `pub-x/burger-gourmet.jpg` | Referência visual de hambúrguer artesanal. |
| `pub-x/cardapio-hamburgueres-oficial.jpeg` | Material original de cardápio. |
| `pub-x/cardapio-pizzas-oficial.jpeg` | Material original de cardápio. |
| `pubx/bife-molho-madeira.jpeg` | Referência de prato executivo. |
| `pubx/tilapia-na-brasa-individual.jpeg` | Referência de prato executivo. |

## Exceções e procedimento

O banco atual pode conter URLs de objetos privados que apontam para o storage legado. Esses objetos não são exportados automaticamente pelo código-fonte: é necessário obter acesso autenticado ao storage de origem, baixar os objetos e reenviá-los ao bucket S3/MinIO independente. A relação e o procedimento estão descritos em `docs/data-migration.md` e `docs/portability-audit.md`.

A aplicação independente não depende desses objetos para iniciar. Produtos sem imagem disponível devem continuar funcionando com o placeholder visual; após a migração, atualize os campos de imagem dos produtos para as URLs do novo storage.

A pasta `assets/` presente no ZIP é um pacote de transferência para instalação independente. Ela não é copiada para `client/public` durante o desenvolvimento gerenciado, evitando incluir mídia binária no artefato de publicação do ambiente de desenvolvimento.
