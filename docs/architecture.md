# Arquitetura do Sistema de Pedidos — Pub X

O sistema foi implementado como uma aplicação web full-stack com frontend React, backend TypeScript e banco de dados relacional. As interfaces pública e administrativa compartilham os mesmos contratos tipados, porém usam permissões distintas: o cardápio e o checkout são públicos, enquanto a operação do restaurante requer autenticação e perfil administrativo.

| Camada | Responsabilidade principal | Implementação atual |
|---|---|---|
| Loja pública | Cardápio, personalização, carrinho, checkout e rastreio | React, Tailwind e chamadas tipadas |
| Painel administrativo | Operação de pedidos, cardápio, clientes, relatórios e configurações | Rotas protegidas por perfil `admin` |
| Regras de negócio | Precificação, validação, transições de status e geração de comprovante | Procedimentos TypeScript com Zod |
| Persistência | Dados de cardápio, clientes, endereços, pedidos, pagamentos e auditoria | Drizzle ORM e banco relacional |
| Recursos visuais | Logo e paleta do Pub X, além de imagens de apoio do cardápio | Arquivos publicados no armazenamento do projeto |

## Modelo operacional

Um pedido começa em `PENDING` e pode ser aceito, preparado e concluído pelo painel. Para delivery, o fluxo segue de `PREPARING` para `OUT_FOR_DELIVERY`; para retirada, segue para `READY_FOR_PICKUP`. O status `CANCELLED` pode ser aplicado enquanto o pedido estiver pendente, aceito ou em preparo. Cada alteração é registrada em histórico, permitindo rastreio pelo cliente com o código e telefone usados no checkout.

O endereço usado em um pedido é copiado para o próprio registro do pedido. Assim, alterações posteriores feitas no cadastro do cliente não mudam o histórico de entregas realizadas.

## Segurança e acesso

O painel administrativo exige autenticação e as operações sensíveis usam autorização específica de administrador no servidor. O cadastro público usa o telefone como identificador operacional, sem senha. A estrutura contém o campo de confirmação futura de telefone; enquanto um provedor oficial de SMS ou WhatsApp não estiver configurado, o fluxo exige confirmação explícita dos dados encontrados antes de finalizar um novo pedido.

| Recurso | Estado atual | Próximo passo recomendado |
|---|---|---|
| Autorização administrativa | Implementada por perfil `admin` | Promover os responsáveis do restaurante pelo painel de dados quando necessário |
| Validação de entrada | Implementada para checkout e cadastros operacionais | Adicionar limites de taxa e desafio de verificação quando o volume crescer |
| Confirmação de telefone | Estrutura preparada, confirmação no fluxo atual | Integrar fornecedor oficial de SMS ou WhatsApp Business |
| Pagamentos | Registro financeiro por pedido, com método e status | Conectar adquirente ou provedor Pix oficial quando necessário |

## Impressão de pedidos

Ao aceitar um pedido, o sistema registra uma tarefa na fila de impressão com o conteúdo do comprovante. O painel já oferece comprovante em layout estreito, adequado à impressão térmica pelo navegador. A interface de integração também disponibiliza tarefas pendentes e confirmação de impressão para ser usada por um agente local instalado no computador do restaurante.

> Para impressão automática física, o computador do restaurante deverá executar um componente local autorizado, como uma aplicação desktop, conectado à impressora térmica. Esse componente consulta a fila autenticada, envia o comprovante à impressora e confirma o resultado. A aplicação web não tenta acessar a impressora remota diretamente, o que preserva as restrições de segurança do navegador.
