// Config mínima do ESLint (flat config) — preset recomendado do typescript-eslint.
// Objetivo: ter a ferramenta configurada e funcional; não corrige nem força
// zero-warnings no código já existente.
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "drizzle/**",
      // Projeto separado (próprio package.json/eslint config) dentro desta pasta.
      "saas-core/**",
      "**/*.d.ts",
      // Artefatos locais, gitignorados, que nunca existem num checkout
      // limpo do CI — sem essas duas linhas, um `pnpm lint` local inflava
      // a contagem de erros com código gerado (service worker do PWA) e
      // com cópias de árvores de trabalho temporárias, nenhum dos dois
      // código de verdade pra corrigir.
      "client/dev-dist/**",
      ".claude/**",
    ],
  },
  ...tsPlugin.configs["flat/recommended"],
  {
    // Plugin nunca tinha sido instalado, apesar do código já ter
    // comentários `eslint-disable-next-line react-hooks/exhaustive-deps`
    // (ESLint reclamava "regra não encontrada" nesses pontos). Registra só
    // as 2 regras que o código já pressupõe — não o preset `recommended`
    // inteiro do pacote (v7+), que traz um conjunto bem maior de regras
    // novas voltadas pro React Compiler (static-components, purity,
    // immutability etc.) fora do escopo desta correção.
    plugins: { "react-hooks": reactHooksPlugin },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
