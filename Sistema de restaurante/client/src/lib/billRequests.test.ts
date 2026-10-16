import { describe, expect, it } from "vitest";
import { tablesAwaitingBill } from "./billRequests";

const row = (id: number, status: string | null, billRequestedAt: number | null = null) => ({ table: { id, label: `0${id}` }, session: status ? { id: id * 10, status, billRequestedAt } : null, totalCents: 1000 * id });

describe("tablesAwaitingBill (quadro 'Contas solicitadas' do painel)", () => {
  it("lista só as comandas que pediram a conta, a mais antiga primeiro", () => {
    const result = tablesAwaitingBill([row(1, "OPEN"), row(2, "AWAITING_PAYMENT", 200), row(3, null), row(4, "AWAITING_PAYMENT", 100)]);
    expect(result.map(item => item.table.label)).toEqual(["04", "02"]);
  });

  it("sem mesas ou sem nenhuma conta pedida: lista vazia (o quadro nem aparece)", () => {
    expect(tablesAwaitingBill(undefined)).toEqual([]);
    expect(tablesAwaitingBill([row(1, "OPEN"), row(2, null)])).toEqual([]);
  });
});
