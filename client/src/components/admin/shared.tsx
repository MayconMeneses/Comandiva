import { Loader2 } from "lucide-react";
import React from "react";

export const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
export const labels: Record<string, string> = { PENDING: "Aguardando aceite", ACCEPTED: "Aceito", PREPARING: "Em preparo", OUT_FOR_DELIVERY: "Saiu para entrega", READY_FOR_PICKUP: "Pronto para retirada", COMPLETED: "Concluído", CANCELLED: "Cancelado" };
export const tone: Record<string, string> = { PENDING: "bg-amber-100 text-amber-800", ACCEPTED: "bg-sky-100 text-sky-800", PREPARING: "bg-violet-100 text-violet-800", OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-800", READY_FOR_PICKUP: "bg-emerald-100 text-emerald-800", COMPLETED: "bg-stone-200 text-stone-700", CANCELLED: "bg-red-100 text-red-800" };
export const nextAction: Record<string, { status: "ACCEPTED" | "PREPARING" | "OUT_FOR_DELIVERY" | "READY_FOR_PICKUP" | "COMPLETED"; label: string } | undefined> = { PENDING: { status: "ACCEPTED", label: "Aceitar pedido" }, ACCEPTED: { status: "PREPARING", label: "Iniciar preparo" }, OUT_FOR_DELIVERY: { status: "COMPLETED", label: "Concluir" }, READY_FOR_PICKUP: { status: "COMPLETED", label: "Concluir" } };

export function Loading() { return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#b4472d]" /></div>; }

export function Header({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#b4472d]">{eyebrow}</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-[#231d18]">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>{action}</div>; }
