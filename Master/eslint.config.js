// Config mínima do ESLint (flat config) — preset recomendado do typescript-eslint.
// Objetivo: ter a ferramenta configurada e funcional; não corrige nem força
// zero-warnings no código já existente.
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    // client/comercial-futurista = build já minificado do site futurista, copiado pelo sync.
    ignores: ["dist/**", "node_modules/**", "drizzle/**", "**/*.d.ts", "client/comercial-futurista/**"],
  },
  ...tsPlugin.configs["flat/recommended"],
  {
    rules: {
      // Prefixo "_" = descartado de propósito (ex.: tirar apiKeyHash de um objeto com rest).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
];
