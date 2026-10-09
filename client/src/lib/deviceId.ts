import { generateClientId } from "./randomId";

const STORAGE_KEY = "comandiva-device-id-v1";

/**
 * Identifica este NAVEGADOR (não a pessoa nem a conta) pro painel operacional
 * da equipe (`/painel-pedidos`, `/cozinha`) — usado só pra dizer "esse pedido
 * foi atualizado em outro dispositivo" quando duas telas mexem no mesmo
 * pedido quase ao mesmo tempo (ver `updateOrderStatus` em
 * server/routers/admin/orders.ts). Diferente do `operationId` da Fase 3
 * (gerado por TENTATIVA de pedido, descartado a cada nova tentativa), este é
 * persistido em `localStorage` — sobrevive fechar a aba, porque o objetivo
 * aqui é identificar o aparelho ao longo do turno, não uma única ação.
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = generateClientId();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // localStorage indisponível (modo privado, storage bloqueado) — gera um
    // id novo por chamada; só perde a persistência entre telas, a
    // funcionalidade principal (detectar conflito) continua funcionando.
    return generateClientId();
  }
}
