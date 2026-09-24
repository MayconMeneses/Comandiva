import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  // Sem isso, o esbuild padrão do Vite transforma .tsx pro JSX clássico
  // (React.createElement) em vez do automático que o app de verdade usa
  // (vite.config.ts já tem esse mesmo plugin) — componentes que não
  // importam `React` explicitamente (a maioria deste projeto, já que o
  // build real nunca precisou disso) quebram com "React is not defined" ao
  // renderizar num teste, mesmo funcionando perfeitamente no app real.
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "shared/**/*.test.ts", "shared/**/*.spec.ts", "client/src/lib/**/*.test.ts"],
  },
});
