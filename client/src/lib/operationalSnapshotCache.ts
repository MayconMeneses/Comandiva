import type { AppRouter } from "../../../server/routers";
import type { inferRouterOutputs } from "@trpc/server";
import { del, get, set } from "idb-keyval";

export type OperationalSnapshot = inferRouterOutputs<AppRouter>["admin"]["operationalSnapshot"];

/**
 * Fase A do offline-first do painel operacional (ver plano em
 * C:\Users\maico\.claude\plans\curried-sprouting-wirth.md): espelho local só
 * do ÚLTIMO `admin.operationalSnapshot` bem-sucedido — pedidos, mesas e
 * solicitações pendentes, pra Kitchen/RestaurantOrders/TableMapManager terem
 * algo pra mostrar quando a internet cai, em vez de tela em branco/erro.
 *
 * Não usa o `PersistQueryClientProvider` (client/src/lib/catalogPersistence.ts)
 * de propósito: aquele provider tem UM `maxAge` global de 6h pra todo o app,
 * pensado pro cardápio (dado público, de baixo risco). Pedido/mesa precisa de
 * uma janela bem mais curta — ver `MAX_AGE_MS` abaixo — então fica fora do
 * mecanismo automático, com controle explícito de TTL por leitura.
 */

const KEY = "mm-operational-snapshot";

/**
 * 2h, não as 6h do cardápio: dado de pedido/mesa desatualizado por mais tempo
 * que isso é mais perigoso que útil pra equipe operar em cima dele — melhor a
 * tela mostrar "sem conexão, sem dado recente" do que a operação de ontem.
 */
export const OPERATIONAL_SNAPSHOT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

type StoredSnapshot = { snapshot: OperationalSnapshot; savedAt: number };

// idb-keyval pode falhar (modo privado antigo, quota) — mesmo padrão de
// degradação segura já usado em pendingOrderQueue.ts: sem cache offline, o
// resto do app continua funcionando normalmente enquanto online.
export async function saveOperationalSnapshot(snapshot: OperationalSnapshot): Promise<void> {
  try {
    await set(KEY, { snapshot, savedAt: Date.now() } satisfies StoredSnapshot);
  } catch {
    // sem persistência — a tela continua funcionando online normalmente.
  }
}

export async function loadOperationalSnapshot(now: number = Date.now()): Promise<StoredSnapshot | null> {
  try {
    const stored = await get<StoredSnapshot>(KEY);
    if (!stored) return null;
    if (now - stored.savedAt > OPERATIONAL_SNAPSHOT_MAX_AGE_MS) return null;
    return stored;
  } catch {
    return null;
  }
}

// Chamado no logout — a tela tem nome/telefone de cliente em alguns casos,
// não deve sobreviver troca de usuário no mesmo tablet.
export async function clearOperationalSnapshot(): Promise<void> {
  try {
    await del(KEY);
  } catch {
    // nada a fazer — pior caso é um cache velho que o TTL já cobre.
  }
}
