/**
 * Versão vigente da Política de Privacidade / Termos de Uso
 * (client/src/pages/{PrivacyPolicy,TermsOfUse}.tsx). Suba esta constante
 * sempre que o TEXTO mudar de verdade (não a cada ajuste de digitação) —
 * cada pedido grava a versão vigente no momento em que foi feito, pra nunca
 * perder o rastro de "sob quais termos esse cliente consentiu", mesmo que o
 * texto mude depois (mesmo raciocínio de snapshot já usado pro preço do
 * pedido em shared/orderDomain.ts).
 */
export const CURRENT_TERMS_VERSION = "2026-10-07";

/**
 * Prazo de retenção de dados pessoais de pedido (LGPD, art. 15/16) antes de
 * anonimizar clientes inativos — ver scripts/anonymize-inactive-customers.ts.
 * 11 anos. O número nasceu da guarda do XML de NF-e/NFC-e (Ajuste SINIEF nº
 * 2/2025, 132 meses). Em 2026-10-07 a emissão de nota fiscal saiu do produto
 * (restaurante não emite), então a base original deixou de existir: o piso do
 * CTN (art. 173 / art. 150 §4º) é de 5 anos. NÃO reduzi o prazo por conta
 * própria — é decisão jurídica/contábil; revisar com o contador antes de mexer.
 */
export const DATA_RETENTION_YEARS = 11;
