# Validação do seletor de tema

O seletor **Tema do site** foi colocado imediatamente abaixo da marca Pub X no cabeçalho da tela inicial. Ele oferece os botões **Claro** e **Escuro**, com estado ativo visível, `aria-pressed` para acessibilidade e ícones de sol e lua.

A preferência é persistida pelo `ThemeProvider` em `localStorage` e a vitrine usa as classes `theme-light` e `theme-dark` para adaptar o fundo, cardápio, seção de atendimento, carrinho e diálogos.

A revisão visual confirmou que o controle permanece compacto e legível em desktop e celular, sem deslocar o botão da sacola.

A validação funcional no navegador confirmou que o botão **Escuro** alterna o estado ativo do seletor e aplica a apresentação escura à vitrine, mantendo o conteúdo e os controles legíveis. O estado escolhido foi salvo no navegador pelo `localStorage`, conforme também coberto pelo teste de interação em jsdom.

Após recarregar a página no navegador, o botão **Escuro** permaneceu ativo e a vitrine continuou com a apresentação escura. Isso confirma o fluxo completo de alternância e persistência da preferência em execução.

Asserts executados no navegador após recarregar a página retornaram: `darkClass: true`, `darkPressed: "true"`, `storedTheme: "dark"`, fundo da vitrine `rgb(18, 14, 12)`, título `rgb(255, 250, 243)` e `contrastReady: true`. Isso comprova a persistência, a aplicação da classe escura, o estado ativo do botão e a diferença de cores entre fundo e título.

A sessão do navegador confirmou a persistência e o contraste em execução. A tentativa de redimensionar a janela por script foi bloqueada pelo ambiente (a viewport permaneceu em 1280×1100); por isso, a responsividade móvel foi validada separadamente pela captura dedicada de 390×844 e pelo teste automatizado do componente, sem atribuir ao navegador uma viewport móvel que ele não assumiu.

Como o navegador sandbox não permite alterar a viewport real por `resizeTo`, foi executada também uma checagem lógica com viewport de 390×844: `mobileLayout: true`, `darkClass: true`, `storedTheme: "dark"`, `darkPressed: "true"` e `readableText: true`. A captura dedicada de 390×844 complementa essa verificação visual.

Assert final em viewport lógica de 390×844: fundo computado `[18, 14, 12]`, texto do título `[255, 250, 243]`, razão de contraste `18.49` e `contrastReady: true`. No mesmo assert, `storedTheme: "dark"`, `darkClass: true` e `darkPressed: "true"`. A checagem confirma contraste superior ao mínimo WCAG AA para texto normal no cenário móvel simulado.

Na segunda revisão visual da tentativa, o seletor **Tema do site** apareceu abaixo do logotipo e do nome Pub X tanto em 1280×720 quanto em 390×844. Os botões Claro e Escuro permaneceram legíveis e o controle não ocupou o espaço do botão da sacola.
