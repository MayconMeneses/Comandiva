/*
 * Política de indexação do site comercial futurista (decisão do dono, 2026-11-11):
 * o portfólio (www.mmsystem.tech/sistemas/comandiva) é a porta de entrada.
 * - /comercial: vitrine secundária; canonical e og:url apontam para o portfólio, noindex, follow.
 * - /comercial/planos e /comercial/cadastro/*: noindex, follow (canonical própria).
 * - /comercial/termos e /comercial/privacidade: indexáveis, canonical própria (já vem de commercialMeta).
 * Só vale para o site futurista; o legado não passa por aqui.
 */
export const PORTFOLIO_COMANDIVA_URL = "https://www.mmsystem.tech/sistemas/comandiva";

const ROBOTS_NOINDEX = "noindex, follow";
const ROBOTS_INDEX = "index, follow";

function robotsFor(requestPath: string): string | null {
  if (requestPath === "/comercial" || requestPath === "/comercial/planos") return ROBOTS_NOINDEX;
  if (requestPath === "/comercial/cadastro" || requestPath.startsWith("/comercial/cadastro/")) return ROBOTS_NOINDEX;
  if (requestPath === "/comercial/termos" || requestPath === "/comercial/privacidade") return ROBOTS_INDEX;
  return null;
}

function canonicalFor(requestPath: string): string | null {
  if (requestPath === "/comercial") return PORTFOLIO_COMANDIVA_URL;
  if (requestPath === "/comercial/cadastro" || requestPath.startsWith("/comercial/cadastro/")) return `https://mmsystem.tech${requestPath}`;
  return null; // planos, termos e privacidade: commercialMeta já define a canônica própria
}

export function injectFuturistaSeo(html: string, url: string): string {
  const requestPath = url.split("?")[0]?.split("#")[0] ?? url;
  let out = html;
  const robots = robotsFor(requestPath);
  if (robots) {
    const tag = `<meta name="robots" content="${robots}" />`;
    out = /<meta name="robots" content="[^"]*"\s*\/?>/.test(out)
      ? out.replace(/<meta name="robots" content="[^"]*"\s*\/?>/, tag)
      : out.replace("</head>", `${tag}</head>`);
  }
  const canonical = canonicalFor(requestPath);
  if (canonical) {
    out = out
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`);
  }
  return out;
}