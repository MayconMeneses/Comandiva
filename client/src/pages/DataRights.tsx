import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { STATUS_LABELS } from "@shared/orderDomain";
import { ArrowLeft, CheckCircle2, Download, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useLocation } from "wouter";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

type Step = "phone" | "code" | "data" | "deleted";

export default function DataRights() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [smsWarning, setSmsWarning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const normalizedPhone = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  const validPhone = normalizedPhone.length === 10 || normalizedPhone.length === 11;

  const requestCode = trpc.dataRights.requestCode.useMutation({
    onSuccess: result => { setSmsWarning(!result.sent); setStep("code"); },
  });
  const verifyCode = trpc.dataRights.verifyCode.useMutation({
    onSuccess: result => { setToken(result.token); setStep("data"); },
  });
  const myData = trpc.dataRights.myData.useQuery({ phone: normalizedPhone, token }, { enabled: step === "data" && Boolean(token) });
  const deleteMyData = trpc.dataRights.deleteMyData.useMutation({
    onSuccess: () => setStep("deleted"),
  });

  const submitPhone = (event: FormEvent) => {
    event.preventDefault();
    if (!validPhone) { setPhoneError("Informe um telefone válido com DDD e 10 ou 11 dígitos."); return; }
    setPhoneError(null);
    requestCode.mutate({ phone: normalizedPhone });
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    verifyCode.mutate({ phone: normalizedPhone, code });
  };

  const downloadData = () => {
    if (!myData.data) return;
    const blob = new Blob([JSON.stringify(myData.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mm-meus-dados-${normalizedPhone}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-[#fffdf8] text-[#231d18]">
        <div className="page-shell flex h-16 items-center justify-between">
          <button onClick={() => setLocation("/politica-de-privacidade")} className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Política de Privacidade</button>
          <span className="font-display text-xl font-bold">MM System Creator</span>
          <span className="w-40" />
        </div>
      </header>

      <main className="page-shell max-w-2xl py-10">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">LGPD — autoatendimento</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Seus dados, na sua mão.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Confirme que o telefone é seu com um código de verificação e veja, baixe ou apague os dados que temos sobre você.</p>

        {step === "phone" && (
          <form onSubmit={submitPhone} noValidate className="mt-7 grid gap-3 rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_12px_35px_rgba(53,34,17,.06)] sm:grid-cols-[1fr_auto]">
            <div>
              <Label htmlFor="dr-phone">Telefone usado nos seus pedidos</Label>
              <Input id="dr-phone" value={phone} onChange={event => { setPhone(event.target.value); setPhoneError(null); }} inputMode="tel" autoComplete="tel" placeholder="(85) 99999-9999" className="mt-2 h-10 rounded-xl bg-[#fffdfa] text-[#231d18]" />
              {phoneError && <p role="alert" className="mt-2 text-sm font-medium text-[#a43720]">{phoneError}</p>}
              {requestCode.error && <p className="mt-2 text-sm font-medium text-[#a43720]">{requestCode.error.message}</p>}
            </div>
            <Button disabled={requestCode.isPending} className="h-10 self-end rounded-xl bg-primary hover:bg-primary-hover"><KeyRound className="mr-2 h-4 w-4" />{requestCode.isPending ? "Enviando…" : "Enviar código"}</Button>
          </form>
        )}

        {step === "code" && (
          <div className="mt-7 rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_12px_35px_rgba(53,34,17,.06)]">
            {smsWarning && <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Não conseguimos confirmar o envio do SMS agora. Se o código não chegar, use o botão de WhatsApp na Política de Privacidade para falar com a gente diretamente.</p>}
            <p className="text-sm leading-6 text-[#8a7a68]">Enviamos um código de 6 dígitos por SMS para <strong className="text-[#231d18]">{phone}</strong>. Ele vale por 10 minutos.</p>
            <form onSubmit={submitCode} noValidate className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <Label htmlFor="dr-code">Código recebido</Label>
                <Input id="dr-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="mt-2 h-10 rounded-xl bg-[#fffdfa] text-[#231d18] tracking-[0.3em]" />
                {verifyCode.error && <p role="alert" className="mt-2 text-sm font-medium text-[#a43720]">{verifyCode.error.message}</p>}
              </div>
              <Button disabled={code.length !== 6 || verifyCode.isPending} className="h-10 self-end rounded-xl bg-primary hover:bg-primary-hover">{verifyCode.isPending ? "Confirmando…" : "Confirmar código"}</Button>
            </form>
            <button type="button" onClick={() => setStep("phone")} className="mt-3 text-xs font-semibold text-primary hover:underline">Usar outro telefone</button>
          </div>
        )}

        {step === "data" && (
          <div className="mt-7 space-y-5">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900"><ShieldCheck className="h-4 w-4" />Telefone confirmado — esta sessão vale por 15 minutos.</div>

            {myData.isLoading ? <p className="text-sm text-muted-foreground">Carregando seus dados…</p> : myData.error ? (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{myData.error.message}</p>
            ) : (
              <>
                <section className="rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_12px_35px_rgba(53,34,17,.06)]">
                  <h2 className="font-display text-xl font-bold">Seus dados cadastrados</h2>
                  {myData.data?.customer ? (
                    <div className="mt-3 space-y-1 text-sm text-[#8a7a68]">
                      <p><strong className="text-[#231d18]">Nome:</strong> {myData.data.customer.name}</p>
                      <p><strong className="text-[#231d18]">Telefone:</strong> {phone}</p>
                      {myData.data.customer.addresses?.[0] && <p><strong className="text-[#231d18]">Endereço mais recente:</strong> {myData.data.customer.addresses[0].street}, {myData.data.customer.addresses[0].number} — {myData.data.customer.addresses[0].neighborhood}, {myData.data.customer.addresses[0].city}/{myData.data.customer.addresses[0].state}</p>}
                    </div>
                  ) : <p className="mt-3 text-sm text-[#8a7a68]">Não encontramos um cadastro salvo para este telefone.</p>}

                  <h3 className="mt-5 font-semibold">Pedidos ({myData.data?.orders.length ?? 0})</h3>
                  {myData.data?.orders.length ? (
                    <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto text-sm">
                      {myData.data.orders.map(order => (
                        <div key={order.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#eee4d8] px-3 py-1.5 text-xs">
                          <span className="font-semibold">{order.publicCode}</span>
                          <span className="text-[#8a7a68]">{new Date(order.createdAt).toLocaleDateString("pt-BR")}</span>
                          <span className="text-[#8a7a68]">{STATUS_LABELS[order.status as keyof typeof STATUS_LABELS] ?? order.status}</span>
                          <span className="font-semibold">{money(order.totalCents)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-2 text-sm text-[#8a7a68]">Nenhum pedido encontrado para este telefone.</p>}

                  <Button type="button" variant="outline" onClick={downloadData} className="mt-4 h-9 rounded-lg border-[#d8c7b0] bg-white text-[#231d18]"><Download className="mr-1.5 h-3.5 w-3.5" />Baixar meus dados (JSON)</Button>
                </section>

                <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <h3 className="font-semibold text-red-900">Apagar meus dados</h3>
                  <p className="mt-1 text-xs leading-5 text-red-800">Seu nome, telefone e endereço são anonimizados. Os pedidos continuam existindo (sem te identificar) pelo prazo que a lei exige para fins fiscais — essa parte não pode ser apagada antes disso.</p>
                  {!confirmDelete ? (
                    <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)} className="mt-3 h-9 rounded-lg border-red-200 bg-white text-red-700 hover:bg-red-100"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Quero apagar meus dados</Button>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button type="button" disabled={deleteMyData.isPending} onClick={() => deleteMyData.mutate({ phone: normalizedPhone, token })} className="h-9 rounded-lg bg-red-700 hover:bg-red-800">{deleteMyData.isPending ? "Apagando…" : "Confirmar exclusão definitiva"}</Button>
                      <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)} className="h-9 text-red-700">Cancelar</Button>
                    </div>
                  )}
                  {deleteMyData.error && <p className="mt-2 text-xs text-red-700">{deleteMyData.error.message}</p>}
                </section>
              </>
            )}
          </div>
        )}

        {step === "deleted" && (
          <div className="mt-7 flex flex-col items-center gap-3 rounded-2xl bg-[#fffdf8] p-8 text-center text-[#231d18] shadow-[0_12px_35px_rgba(53,34,17,.06)]">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <h2 className="font-display text-2xl font-bold">Dados removidos</h2>
            <p className="max-w-sm text-sm leading-6 text-[#8a7a68]">Seu nome, telefone e endereço foram anonimizados. Obrigado por usar o MM System Creator.</p>
            <Button onClick={() => setLocation("/")} className="mt-2 h-10 rounded-xl bg-primary hover:bg-primary-hover">Voltar ao cardápio</Button>
          </div>
        )}
      </main>
    </div>
  );
}
