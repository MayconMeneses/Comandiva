// Config mínima do ESLint (flat config) — preset recomendado do typescript-eslint.
// Objetivo: ter a ferramenta configurada e funcional; não corrige nem força
// zero-warnings no código já existente.
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "drizzle/**",
      // Projeto separado (próprio package.json/eslint config) dentro desta pasta.
      "saas-core/**",
      "**/*.d.ts",
    ],
  },
  ...tsPlugin.configs["flat/recommended"],
];
