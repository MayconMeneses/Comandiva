import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compressImageFile } from "@/lib/imageCompression";
import { trpc } from "@/lib/trpc";
import { FormEvent, useState } from "react";

export default function PixSettings({ settings }: { settings: { isAcceptingOrders: boolean; deliveryFeeCents: number; minimumOrderCents: number; estimatedDeliveryMin: number; estimatedDeliveryMax: number; openingHours: string | null; logoUrl?: string | null; pixKey?: string | null; pixQrCodeUrl?: string | null } | null | undefined }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState(() => ({ pixKey: settings?.pixKey ?? "", pixQrCodeUrl: settings?.pixQrCodeUrl ?? "" }));
  const [fileError, setFileError] = useState("");
  const update = trpc.admin.updateSettings.useMutation({ onSuccess: () => { void utils.admin.dashboard.invalidate(); void utils.catalog.settings.invalidate(); } });
  const uploadPixQr = trpc.admin.uploadPixQr.useMutation({ onSuccess: result => setForm(current => ({ ...current, pixQrCodeUrl: result.url })) });
  const handlePixQrFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20_000_000) { setFileError("Escolha uma imagem de até 20 MB."); return; }
    setFileError("");
    void compressImageFile(file, { maxDimension: 800 }).then(({ base64, contentType }) => { uploadPixQr.mutate({ filename: file.name, contentType: contentType as "image/jpeg" | "image/png" | "image/webp", dataBase64: base64 }); });
  };
  if (!settings) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({ isAcceptingOrders: settings.isAcceptingOrders, deliveryFeeCents: settings.deliveryFeeCents, minimumOrderCents: settings.minimumOrderCents, estimatedDeliveryMin: settings.estimatedDeliveryMin, estimatedDeliveryMax: settings.estimatedDeliveryMax, openingHours: settings.openingHours ?? "", logoUrl: settings.logoUrl ?? "", pixKey: form.pixKey, pixQrCodeUrl: form.pixQrCodeUrl });
  };
  return <section className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-6">
    <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b4472d]">Recebimento</p>
    <h2 className="mt-1 font-display text-2xl font-bold">Pix</h2>
    <p className="mt-1 text-sm text-muted-foreground">Preencha a chave e/ou envie o QR Code para exibir na tela de pagamento quando o cliente escolher Pix.</p>
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div><Label>Chave Pix</Label><Input value={form.pixKey} onChange={event => setForm({ ...form, pixKey: event.target.value })} placeholder="CPF, e-mail, telefone ou chave aleatória" className="mt-1.5 h-11 rounded-xl bg-white" /></div>
      <div>
        <Label>QR Code</Label>
        <div className="mt-1.5 flex items-center gap-4">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-[#d8c7b0] bg-[#fffdfa]">{form.pixQrCodeUrl ? <img src={form.pixQrCodeUrl} alt="QR Code Pix" className="h-full w-full object-contain" /> : <span className="text-[10px] text-muted-foreground">Sem QR</span>}</div>
          <div className="flex-1">
            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => handlePixQrFile(event.target.files?.[0])} className="h-10 rounded-xl bg-white file:mr-3 file:rounded-lg file:border-0 file:bg-[#f3eadf] file:px-3 file:py-1.5 file:text-xs file:font-semibold" />
            {uploadPixQr.isPending && <p className="mt-1 text-xs text-muted-foreground">Enviando imagem…</p>}
            {fileError && <p className="mt-1 text-xs text-red-700">{fileError}</p>}
            {uploadPixQr.error && <p className="mt-1 text-xs text-red-700">{uploadPixQr.error.message}</p>}
            {form.pixQrCodeUrl && <button type="button" onClick={() => setForm({ ...form, pixQrCodeUrl: "" })} className="mt-1 text-xs font-semibold text-[#b4472d] hover:underline">Remover QR Code</button>}
          </div>
        </div>
      </div>
      {update.error && <p className="text-sm text-red-700">{update.error.message}</p>}
      <Button disabled={update.isPending || uploadPixQr.isPending} className="h-11 rounded-xl bg-[#b4472d] hover:bg-[#943722]">{update.isPending ? "Salvando…" : update.isSuccess ? "Salvo!" : "Salvar Pix"}</Button>
    </form>
  </section>;
}
