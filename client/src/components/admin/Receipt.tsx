import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Loader2, Printer, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Loading, money } from "./shared";

/**
 * DANFE (comprovante da NFC-e) — impresso junto do comprovante do pedido
 * quando a nota já foi autorizada. Pedido avulso (delivery/retirada/balcão)
 * busca por orderId; mesa busca pela comanda consolidada (tableSessionId),
 * já que uma nota de mesa cobre várias rodadas — nunca as duas ao mesmo
 * tempo (ver server/_core/nfceEmission.ts).
 */
// A emissão na Focus NFe é síncrona (responde autorizado/rejeitado na hora),
// mas o disparo aqui é "fire and forget" (ver server/_core/nfceEmission.ts)
// — entre o pedido mudar de status e a linha em fiscal_documents existir, tem
// uma janela curta real onde a busca ainda não acha nada (`doc` undefined).
// Poll só nessa janela, e só por um tempo limitado: se o fiscal nem estiver
// configurado (comum — nenhuma linha nunca vai ser criada), não faz sentido
// martelar o servidor pra sempre toda vez que alguém abrir um comprovante
// (achado da auditoria de escalabilidade 2026-09-19).
const DANFE_POLL_WINDOW_MS = 40_000;
const DANFE_POLL_INTERVAL_MS = 5_000;

function DanfeSection({ order }: { order: { id: number; fulfillmentType: "DELIVERY" | "PICKUP" | "DINE_IN"; tableSessionId: number | null } }) {
  const utils = trpc.useUtils();
  const isDineIn = order.fulfillmentType === "DINE_IN" && order.tableSessionId;
  const mountedAt = useRef(Date.now());
  const pollWhileMissing = (query: { state: { data?: unknown } }) => (!query.state.data && Date.now() - mountedAt.current < DANFE_POLL_WINDOW_MS ? DANFE_POLL_INTERVAL_MS : false);
  // Só um dos dois fica habilitado — a nota é buscada por pedido OU por
  // comanda, nunca por ambos (mesmo raciocínio de fiscal_documents.orderId
  // XOR tableSessionId).
  const byOrder = trpc.admin.fiscalDocumentForOrder.useQuery({ orderId: order.id }, { enabled: !isDineIn, refetchInterval: pollWhileMissing });
  const byTable = trpc.admin.fiscalDocumentForTableSession.useQuery({ sessionId: order.tableSessionId ?? 0 }, { enabled: Boolean(isDineIn), refetchInterval: pollWhileMissing });
  const doc = isDineIn ? byTable.data : byOrder.data;
  const isLoading = isDineIn ? byTable.isLoading : byOrder.isLoading;

  const retryOrder = trpc.admin.retryNfceForOrder.useMutation({ onSuccess: () => void utils.admin.fiscalDocumentForOrder.invalidate({ orderId: order.id }) });
  const retryTable = trpc.admin.retryNfceForTableSession.useMutation({ onSuccess: () => void utils.admin.fiscalDocumentForTableSession.invalidate({ sessionId: order.tableSessionId ?? 0 }) });
  const retry = () => (isDineIn ? retryTable.mutate({ sessionId: order.tableSessionId! }) : retryOrder.mutate({ orderId: order.id }));
  const retrying = retryOrder.isPending || retryTable.isPending;

  if (isLoading) return null;
  if (!doc) return null; // emissão ainda nem foi disparada (fiscal não configurado, ou pedido ainda não chegou no ponto de emitir) — nada a mostrar

  if (doc.status === "PENDING" || doc.status === "CONTINGENCY") {
    return <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 print:hidden"><Loader2 className="h-4 w-4 shrink-0 animate-spin" />Nota fiscal processando — a página atualiza sozinha quando ficar pronta.</div>;
  }
  if (doc.status === "ERROR" || doc.status === "REJECTED") {
    return (
      <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900 print:hidden">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 shrink-0" />Não foi possível emitir a nota fiscal.</p>
        {doc.rejectionReason && <p className="mt-1 leading-5">{doc.rejectionReason}</p>}
        <Button size="sm" variant="outline" disabled={retrying} onClick={retry} className="mt-2 h-8 rounded-lg border-red-400 bg-white text-xs text-red-900 hover:bg-red-100"><RefreshCw className="mr-1.5 h-3.5 w-3.5" />{retrying ? "Tentando…" : "Tentar emitir nota de novo"}</Button>
      </div>
    );
  }
  // AUTHORIZED
  return (
    <div className="mt-4 border-t-2 border-dashed border-[#4a3d30] pt-4 text-center text-xs">
      <p className="font-display text-lg font-bold">DANFE NFC-e</p>
      <p className="mt-1">Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</p>
      {doc.chaveAcesso && <p className="mt-2 break-all font-mono text-[10px]">Chave de acesso: {doc.chaveAcesso}</p>}
      {doc.numero && <p className="mt-1">NFC-e nº {doc.numero}{doc.serie ? ` · Série ${doc.serie}` : ""}</p>}
      {doc.qrCodeUrl && <img src={doc.qrCodeUrl} alt="QR Code da NFC-e — consulte pela chave de acesso" className="mx-auto mt-3 h-28 w-28" />}
      {doc.danfeUrl && <a href={doc.danfeUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-primary underline print:hidden">Ver DANFE completo</a>}
    </div>
  );
}

export default function Receipt() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const orderId = Number(location.split("/")[3]);
  const autoprint = new URLSearchParams(location.split("?")[1] ?? "").get("autoprint") === "1" || new URLSearchParams(window.location.search).get("autoprint") === "1";
  const query = trpc.admin.orderDetail.useQuery({ orderId }, { enabled: Number.isInteger(orderId) && orderId > 0 });
  const backTo = user?.role === "admin" ? "/admin/pedidos" : "/painel-pedidos";
  const hasAutoPrinted = useRef(false);

  useEffect(() => {
    if (!autoprint || hasAutoPrinted.current || !query.data) return;
    hasAutoPrinted.current = true;
    // Pequeno atraso só pra garantir que o layout terminou de renderizar
    // (imagem do QR Code, se a nota já estiver pronta) antes do diálogo de
    // impressão abrir — não é uma espera pela emissão em si, essa parte é
    // tratada pelo polling do DanfeSection.
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [autoprint, query.data]);

  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) return <p className="p-6 text-sm text-red-700">{query.error?.message ?? "Pedido não encontrado."}</p>;
  const order = query.data;
  return <div className="mx-auto max-w-md"><div className="print:hidden mb-6 flex items-center justify-between"><Button variant="outline" onClick={() => setLocation(backTo)} className="rounded-xl">Voltar aos pedidos</Button><Button onClick={() => window.print()} className="rounded-xl bg-primary hover:bg-primary-hover"><Printer className="mr-2 h-4 w-4" />Imprimir</Button></div><article className="bg-white p-7 text-[#17120e] shadow-lg print:shadow-none" style={{ maxWidth: "80mm" }}><div className="border-b-2 border-dashed border-[#4a3d30] pb-4 text-center"><p className="font-display text-3xl font-bold">MM System Creator</p><p className="mt-1 text-xs">COMPROVANTE DE PEDIDO</p><p className="mt-3 font-mono text-xl font-bold">{order.publicCode}</p></div><div className="space-y-1 border-b border-dashed border-[#817364] py-4 text-xs"><p><strong>Data:</strong> {new Date(order.createdAt).toLocaleString("pt-BR")}</p><p><strong>Cliente:</strong> {order.customerName}</p><p><strong>Telefone:</strong> {order.customerPhone}</p><p><strong>Tipo:</strong> {order.fulfillmentType === "DELIVERY" ? "Entrega" : order.fulfillmentType === "DINE_IN" ? `Mesa${order.tableLabel ? ` — ${order.tableLabel}` : ""}` : "Retirada"}</p>{order.fulfillmentType === "DELIVERY" && <p><strong>Endereço:</strong> {order.deliveryStreet}, {order.deliveryNumber} — {order.deliveryNeighborhood}</p>}{order.deliveryReference && <p><strong>Referência:</strong> {order.deliveryReference}</p>}</div><div className="border-b border-dashed border-[#817364] py-4">{order.items.map(item => <div key={item.id} className="mb-3 text-xs last:mb-0"><div className="flex justify-between gap-3 font-bold"><span>{item.quantity}× {item.productName}</span><span>{money(item.lineTotalCents)}</span></div>{item.addons.map(addon => <p key={addon.id} className="pl-2 pt-1 text-[11px]">+ {addon.addonOptionName}</p>)}{item.note && <p className="pl-2 pt-1 text-[11px] italic">Obs.: {item.note}</p>}</div>)}</div><div className="space-y-2 border-b border-dashed border-[#817364] py-4 text-xs"><p className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotalCents)}</span></p><p className="flex justify-between"><span>Entrega</span><span>{money(order.deliveryFeeCents)}</span></p><p className="flex justify-between text-base font-bold"><span>TOTAL</span><span>{money(order.totalCents)}</span></p></div><div className="pt-4 text-center text-xs"><p>Pagamento: {!order.paymentMethod ? "Fechamento na comanda" : order.paymentMethod === "CARD_ON_DELIVERY" ? "Cartão" : order.paymentMethod === "CASH" ? "Dinheiro" : order.paymentMethod === "CARD_ONLINE" ? "Cartão online" : "Pix"}</p>{order.customerNote && <p className="mt-3 rounded bg-background p-2 text-left"><strong>Observação:</strong> {order.customerNote}</p>}<p className="mt-5">Obrigado pela preferência.</p></div><DanfeSection order={order} /></article></div>;
}
