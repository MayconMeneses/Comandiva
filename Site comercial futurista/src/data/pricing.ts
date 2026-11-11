/**
 * Preço de entrada anunciado (centavos). Fonte única do site: plans.ts, home.ts,
 * JSON-LD e metas leem daqui. O valor cobrado nasce em Master/scripts/seed-plans.ts
 * (plano "essencial") e depois é editado no Painel Master; um teste no Master
 * compara os dois. Ao mudar o preço, altere aqui e no seed.
 */
export const ENTRY_PRICE_CENTS = 9990;

/** "R$ 99,90" */
export const ENTRY_PRICE_BRL = `R$ ${(ENTRY_PRICE_CENTS / 100).toFixed(2).replace(".", ",")}`;

/** "99.90" (schema.org) */
export const ENTRY_PRICE_DECIMAL = (ENTRY_PRICE_CENTS / 100).toFixed(2);
