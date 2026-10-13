/**
 * Rotas válidas do site comercial — fonte única para o servidor decidir
 * entre HTTP 200 e 404 (server/_core/vite.ts). Deve refletir as <Route
 * path="/comercial..."> de client/src/App.tsx; ao criar uma página comercial
 * nova, adicione aqui também (senão ela responderia 404 no servidor).
 */
export const COMMERCIAL_EXACT_PATHS: readonly string[] = [
  "/comercial",
  "/comercial/planos",
  "/comercial/termos",
  "/comercial/privacidade",
  "/comercial/cadastro/sucesso",
  "/comercial/cadastro/confirmando",
  "/comercial/cadastro/cardapio",
];

/** `/comercial/cadastro/:planKey` — exatamente um segmento. */
const CADASTRO_PLAN_PATTERN = /^\/comercial\/cadastro\/[^/]+$/;

/** Extrai só o pathname (sem query/hash) e remove barra final (exceto raiz). */
function normalizePath(url: string): string {
  const raw = url.split("?")[0]?.split("#")[0] ?? url;
  return raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
}

/** true quando o caminho pertence ao site comercial (/comercial ou /comercial/...). */
export function isCommercialPath(url: string): boolean {
  const p = normalizePath(url);
  return p === "/comercial" || p.startsWith("/comercial/");
}

/**
 * Status HTTP pro HTML da SPA: 404 só pra caminhos sob /comercial que não
 * são uma página comercial real; todo o resto (Painel Master, etc.) segue 200.
 */
export function resolveSpaStatus(url: string): 200 | 404 {
  if (!isCommercialPath(url)) return 200;
  const p = normalizePath(url);
  if (COMMERCIAL_EXACT_PATHS.includes(p) || CADASTRO_PLAN_PATTERN.test(p)) return 200;
  return 404;
}
