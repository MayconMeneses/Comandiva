// Lembra, só neste aparelho, quem já pediu: telefone, nome e último endereço.
// O servidor continua devolvendo só o primeiro nome por telefone (anti-enumeração,
// auditoria 2026-10-10) — este cache local é o que evita pedir tudo de novo.
const KEY = "comandiva.savedCustomer.v1";

export type SavedAddress = { postalCode: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string; reference: string };
export type SavedCustomer = { phone: string; name: string; address?: SavedAddress };

export function loadSavedCustomer(): SavedCustomer | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedCustomer;
    return typeof data?.phone === "string" && typeof data?.name === "string" ? data : null;
  } catch { return null; }
}

export function saveCustomer(customer: SavedCustomer) {
  try {
    const previous = loadSavedCustomer();
    const keepAddress = !customer.address && previous?.phone === customer.phone ? previous.address : customer.address;
    window.localStorage.setItem(KEY, JSON.stringify({ ...customer, address: keepAddress }));
  } catch { /* navegação privada ou armazenamento bloqueado: segue sem lembrar */ }
}
