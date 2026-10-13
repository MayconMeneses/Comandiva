// Barrel: mantém `import ... from "./db"` / `"../db"` funcionando em todo o
// resto do servidor, enquanto a implementação real fica dividida por domínio
// em `server/db/*.ts` (evita um único arquivo "god file" com tudo junto).
export { getDb, cached, CATALOG_CACHE_TTL_MS } from "./db/client";
export type { Db, DbOrTx } from "./db/client";
export * from "./db/audit";
export * from "./db/accountAudit";
export * from "./db/dataRights";
export * from "./db/users";
export * from "./db/settings";
export * from "./db/deliveryRoutes";
export * from "./db/catalog";
export * from "./db/customers";
export * from "./db/orders";
export * from "./db/reports";
export * from "./db/tables";
export * from "./db/tableSessions";
export * from "./db/tableServiceRequests";
export * from "./db/tableReservations";
export * from "./db/license";
