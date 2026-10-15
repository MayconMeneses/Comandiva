# Comandiva — site comercial (versão futurista)

Projeto separado do site atual (`../Site comercial`, que não foi alterado).

```
npm install
npm run dev      # http://localhost:5180/comercial/
npm run build
```

Stack: Vite + React + TypeScript + Tailwind 4 + motion (rolagem nativa; a Lenis foi removida por pesar).
Fontes locais: Clash Grotesk e Satoshi (Fontshare, `public/fonts`), JetBrains Mono (@fontsource).
Imagens copiadas do `../Master/client/public` e convertidas para WebP.

Veja `PLANO.md` (plano), `REFERENCIAS.md` (de onde veio cada componente) e `VALIDACAO.md` (checklist das 20 regras, testes e pendências).

Planos, cadastro e envio do cardápio usam as mesmas rotas públicas do Master (`/api/trpc/public.*`). Rodando sozinho, o Vite repassa `/api` para mmsystem.tech; o servidor do Master é quem avisa o dono no Telegram.

## Publicação (dentro do Master)

O site mora em `/comercial/` (base do Vite). `npm run build` gera o `dist/`, que o
`Master/scripts/sync-site-comercial.mjs` copia para `Master/client/comercial-futurista`.
O Master só serve esta versão com `COMMERCIAL_SITE=futurista` no `.env`
(`legado` = site atual). Passo a passo e como voltar atrás: `PLANO-PUBLICACAO.md`.
