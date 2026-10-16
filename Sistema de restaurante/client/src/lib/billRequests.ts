type TableRow = { table: { id: number; label: string }; session: { id: number; status: string; billRequestedAt?: number | null } | null; totalCents: number };

/**
 * "Pedir a conta" (QR Code da mesa) não cria um chamado de garçom: marca a comanda
 * como AWAITING_PAYMENT. Esta lista alimenta o quadro "Contas solicitadas" no topo do
 * mapa de mesas, na ordem em que foram pedidas (a mais antiga primeiro).
 */
export function tablesAwaitingBill<T extends TableRow>(rows: T[] | undefined): T[] {
  return (rows ?? []).filter(row => row.session?.status === "AWAITING_PAYMENT").sort((a, b) => (a.session?.billRequestedAt ?? 0) - (b.session?.billRequestedAt ?? 0));
}
