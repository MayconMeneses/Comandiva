/**
 * Caminho (arquivo da pasta public/ ou href de link comum) respeitando a base do site.
 * O site mora em /comercial/ (dentro do Master), então "/assets/x.webp"
 * vira "/comercial/assets/x.webp". Caminhos em CSS e no index.html o Vite
 * já ajusta sozinho; strings no código TS/TSX precisam passar por aqui.
 */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
