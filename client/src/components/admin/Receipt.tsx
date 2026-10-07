import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Printer } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Loading, money } from "./shared";

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
    // antes do diálogo de impressão abrir.
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [autoprint, query.data]);

  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) return <p className="p-6 text-sm text-red-700">{query.error?.message ?? "Pedido não encontrado."}</p>;
  const order = query.data;
  return <div className="mx-auto max-w-md"><div className="print:hidden mb-6 flex items-center justify-between"><Button variant="outline" onClick={() => setLocation(backTo)} className="rounded-xl">Voltar aos pedidos</Button><Button onClick={() => window.print()} className="rounded-xl bg-primary hover:bg-primary-hover"><Printer className="mr-2 h-4 w-4" />Imprimir</Button></div><article className="bg-white p-7 text-[#17120e] shadow-lg print:shadow-none" style={{ maxWidth: "80mm" }}><div className="border-b-2 border-dashed border-[#4a3d30] pb-4 text-center"><p className="font-display text-3xl font-bold">MM System Creator</p><p className="mt-1 text-xs">COMPROVANTE DE PEDIDO</p><p className="mt-3 font-mono text-xl font-bold">{order.publicCode}</p></div><div className="space-y-1 border-b border-dashed border-[#817364] py-4 text-xs"><p><strong>Data:</strong> {new Date(order.createdAt).toLocaleString("pt-BR")}</p><p><strong>Cliente:</strong> {order.customerName}</p><p><strong>Telefone:</strong> {order.customerPhone}</p><p><strong>Tipo:</strong> {order.fulfillmentType === "DELIVERY" ? "Entrega" : order.fulfillmentType === "DINE_IN" ? `Mesa${order.tableLabel ? ` — ${order.tableLabel}` : ""}` : "Retirada"}</p>{order.fulfillmentType === "DELIVERY" && <p><strong>Endereço:</strong> {order.deliveryStreet}, {order.deliveryNumber} — {order.deliveryNeighborhood}</p>}{order.deliveryReference && <p><strong>Referência:</strong> {order.deliveryReference}</p>}</div><div className="border-b border-dashed border-[#817364] py-4">{order.items.map(item => <div key={item.id} className="mb-3 text-xs last:mb-0"><div className="flex justify-between gap-3 font-bold"><span>{item.quantity}× {item.productName}</span><span>{money(item.lineTotalCents)}</span></div>{item.addons.map(addon => <p key={addon.id} className="pl-2 pt-1 text-[11px]">+ {addon.addonOptionName}</p>)}{item.note && <p className="pl-2 pt-1 text-[11px] italic">Obs.: {item.note}</p>}</div>)}</div><div className="space-y-2 border-b border-dashed border-[#817364] py-4 text-xs"><p className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotalCents)}</span></p><p className="flex justify-between"><span>Entrega</span><span>{money(order.deliveryFeeCents)}</span></p><p className="flex justify-between text-base font-bold"><span>TOTAL</span><span>{money(order.totalCents)}</span></p></div><div className="pt-4 text-center text-xs"><p>Pagamento: {!order.paymentMethod ? "Fechamento na comanda" : order.paymentMethod === "CARD_ON_DELIVERY" ? "Cartão" : order.paymentMethod === "CASH" ? "Dinheiro" : order.paymentMethod === "CARD_ONLINE" ? "Cartão online" : "Pix"}</p>{order.customerNote && <p className="mt-3 rounded bg-background p-2 text-left"><strong>Observação:</strong> {order.customerNote}</p>}<p className="mt-5">Obrigado pela preferência.</p></div></article></div>;
}
