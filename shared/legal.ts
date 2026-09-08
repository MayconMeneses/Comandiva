/**
 * Versão vigente da Política de Privacidade / Termos de Uso
 * (client/src/pages/{PrivacyPolicy,TermsOfUse}.tsx). Suba esta constante
 * sempre que o TEXTO mudar de verdade (não a cada ajuste de digitação) —
 * cada pedido grava a versão vigente no momento em que foi feito, pra nunca
 * perder o rastro de "sob quais termos esse cliente consentiu", mesmo que o
 * texto mude depois (mesmo raciocínio de snapshot já usado pro preço do
 * pedido em shared/orderDomain.ts).
 */
export const CURRENT_TERMS_VERSION = "2026-09-06";

/**
 * Prazo de retenção de dados pessoais de pedido (LGPD, art. 15/16) antes de
 * anonimizar clientes inativos — ver scripts/anonymize-inactive-customers.ts.
 * 11 anos, não 5, porque o Ajuste SINIEF nº 2/2025 (CONFAZ, vigente desde
 * 01/05/2025, adotado pelo Ceará como todo estado do convênio ICMS) elevou a
 * guarda do XML de NF-e/NFC-e de 60 para 132 meses; o piso do CTN (art. 173 /
 * art. 150 §4º) continua em 5 anos, mas como o Pub X vincula o pedido ao
 * documento fiscal (ver Termos de Uso, seção 3), vale o prazo mais longo dos
 * dois. Revisar se a IN SEFAZ-CE nº 87/2025 ou o contador definirem outro
 * número quando a emissão de NFC-e for implementada de fato.
 */
export const DATA_RETENTION_YEARS = 11;
