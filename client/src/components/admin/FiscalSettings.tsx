import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, FileKey, Landmark, Rocket, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import FiscalTaxCategories from "./FiscalTaxCategories";
import { Header, Loading } from "./shared";

const REGIME_LABELS: Record<string, string> = { SIMPLES_NACIONAL: "Simples Nacional", LUCRO_PRESUMIDO: "Lucro Presumido", LUCRO_REAL: "Lucro Real", MEI: "MEI" };

function formatCnpj(digits: string) {
  const clean = digits.replace(/\D/g, "").slice(0, 14);
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5");
}

export default function FiscalSettings() {
  const utils = trpc.useUtils();
  const query = trpc.admin.fiscalSettings.useQuery();
  const settings = query.data;

  const [cnpj, setCnpj] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [regimeTributario, setRegimeTributario] = useState("");
  const [providerToken, setProviderToken] = useState("");
  const [certPassword, setCertPassword] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);

  const saveCadastral = trpc.admin.saveFiscalCadastral.useMutation({ onSuccess: () => { toast.success("Dados cadastrais salvos."); void utils.admin.fiscalSettings.invalidate(); } });
  const saveProviderToken = trpc.admin.saveFiscalProviderToken.useMutation({ onSuccess: () => { toast.success("Token salvo."); setProviderToken(""); void utils.admin.fiscalSettings.invalidate(); } });
  const uploadCert = trpc.admin.uploadFiscalCertificate.useMutation({ onSuccess: () => { toast.success("Certificado salvo com segurança."); setCertPassword(""); setCertFile(null); void utils.admin.fiscalSettings.invalidate(); } });
  const confirmProduction = trpc.admin.confirmFiscalProductionReady.useMutation({ onSuccess: () => { toast.success("Emissão de notas reais ativada."); void utils.admin.fiscalSettings.invalidate(); }, onError: error => toast.error(error.message) });

  const startCadastral = () => {
    if (!settings) return;
    setCnpj(settings.cnpj ? formatCnpj(settings.cnpj) : "");
    setInscricaoEstadual(settings.inscricaoEstadual ?? "");
    setRegimeTributario(settings.regimeTributario ?? "");
  };

  const submitCadastral = (event: FormEvent) => {
    event.preventDefault();
    if (!regimeTributario) { toast.error("Selecione o regime tributário."); return; }
    saveCadastral.mutate({ cnpj: cnpj.replace(/\D/g, ""), inscricaoEstadual, regimeTributario: regimeTributario as never });
  };

  const submitProviderToken = (event: FormEvent) => {
    event.preventDefault();
    saveProviderToken.mutate({ token: providerToken });
  };

  const submitCertificate = (event: FormEvent) => {
    event.preventDefault();
    if (!certFile) { toast.error("Selecione o arquivo do certificado (.pfx ou .p12)."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] ?? "";
      uploadCert.mutate({ filename: certFile.name, dataBase64: base64, password: certPassword });
    };
    reader.readAsDataURL(certFile);
  };

  if (query.isLoading) return <Loading />;
  if (query.error || !settings) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{query.error?.message ?? "Não foi possível carregar as configurações fiscais."}</p>;

  const pending: string[] = [];
  if (!settings.cnpj) pending.push("CNPJ");
  if (!settings.inscricaoEstadual) pending.push("Inscrição Estadual");
  if (!settings.regimeTributario) pending.push("Regime tributário");
  if (!settings.hasCertificate) pending.push("Certificado digital A1");
  if (!settings.hasProviderApiToken) pending.push("Token da conta Focus NFe");

  const isProduction = settings.environment === "PRODUCAO";

  return (
    <>
      <Header eyebrow="Fiscal" title="Emissão de NFC-e" description="Configuração para emitir nota fiscal de consumidor eletrônica automaticamente a cada venda." />

      {isProduction ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Emissão de notas reais está ativa.</p>
            <p className="mt-1 leading-5">Toda venda concluída gera uma NFC-e de verdade automaticamente.</p>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Emissão de nota ainda não está ativa.</p>
            <p className="mt-1 leading-5">Esta tela guarda a configuração com segurança, mas nenhum pedido gera NFC-e de verdade até {pending.length ? "todos os itens abaixo estarem preenchidos" : "você testar e confirmar abaixo"}.</p>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Pendente: {pending.join(", ")}.</p>
        </div>
      )}

      {!pending.length && !isProduction && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm"><Rocket className="h-4 w-4 text-primary" /><span>Tudo configurado. Emita uma nota de teste (homologação) e, quando confirmar que funcionou, ative as notas reais.</span></div>
          <Button onClick={() => confirmProduction.mutate()} disabled={confirmProduction.isPending} className="h-9 rounded-xl bg-primary hover:bg-primary-hover">{confirmProduction.isPending ? "Ativando…" : "Já testei, começar a emitir notas de verdade"}</Button>
        </div>
      )}

      <div className="space-y-8">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">Dados cadastrais</h2></div>
          <form onSubmit={submitCadastral} onFocus={startCadastral} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><Label>CNPJ</Label><Input value={cnpj} onChange={event => setCnpj(formatCnpj(event.target.value))} placeholder="00.000.000/0000-00" className="mt-1.5 h-10 rounded-xl bg-card" /></div>
            <div><Label>Inscrição Estadual</Label><Input value={inscricaoEstadual} onChange={event => setInscricaoEstadual(event.target.value)} placeholder="Número da IE" className="mt-1.5 h-10 rounded-xl bg-card" /></div>
            <div className="sm:col-span-2">
              <Label>Regime tributário</Label>
              <select value={regimeTributario} onChange={event => setRegimeTributario(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <option value="">Selecione (confirme com seu contador)</option>
                {Object.entries(REGIME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            {saveCadastral.error && <p className="sm:col-span-2 text-sm text-red-700">{saveCadastral.error.message}</p>}
            <Button disabled={saveCadastral.isPending} className="sm:col-span-2 h-10 rounded-xl bg-primary hover:bg-primary-hover">{saveCadastral.isPending ? "Salvando…" : "Salvar dados cadastrais"}</Button>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2"><FileKey className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">Certificado digital A1</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Arquivo .pfx/.p12 emitido no CNPJ do restaurante por uma autoridade certificadora (ICP-Brasil). Fica criptografado no banco — nunca volta pra tela depois de salvo.</p>
          {settings.hasCertificate && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />Certificado configurado: {settings.certificateFilename}
            </div>
          )}
          <form onSubmit={submitCertificate} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><Label>Arquivo (.pfx ou .p12)</Label><Input type="file" accept=".pfx,.p12" onChange={event => setCertFile(event.target.files?.[0] ?? null)} className="mt-1.5 h-10 rounded-xl bg-card file:mr-3 file:rounded-lg file:border-0 file:bg-[#f3eadf] file:px-3 file:py-1.5 file:text-xs file:font-semibold" /></div>
            <div><Label>Senha do certificado</Label><Input type="password" value={certPassword} onChange={event => setCertPassword(event.target.value)} placeholder={settings.hasCertificate ? "Deixe em branco para manter o atual" : "Senha do arquivo"} className="mt-1.5 h-10 rounded-xl bg-card" /></div>
            {uploadCert.error && <p className="sm:col-span-2 text-sm text-red-700">{uploadCert.error.message}</p>}
            <Button disabled={uploadCert.isPending} className="sm:col-span-2 h-10 rounded-xl bg-primary hover:bg-primary-hover">{uploadCert.isPending ? "Enviando…" : "Salvar certificado"}</Button>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">Conta Focus NFe</h2></div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Quem realmente conversa com a Receita/SEFAZ pra emitir a nota. Crie uma conta gratuita em <a href="https://focusnfe.com.br" target="_blank" rel="noreferrer" className="font-semibold text-primary underline">focusnfe.com.br</a>, cadastre o CNPJ do restaurante lá e cole o token de acesso abaixo.</p>
          {settings.hasProviderApiToken && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />Token configurado
            </div>
          )}
          <form onSubmit={submitProviderToken} className="mt-4 grid gap-3">
            <div><Label>Token da conta Focus NFe</Label><Input type="password" value={providerToken} onChange={event => setProviderToken(event.target.value)} placeholder={settings.hasProviderApiToken ? "Deixe em branco para manter o atual" : "Token de acesso (homologação ou produção)"} className="mt-1.5 h-10 rounded-xl bg-card" /></div>
            {saveProviderToken.error && <p className="text-sm text-red-700">{saveProviderToken.error.message}</p>}
            <Button disabled={saveProviderToken.isPending} className="h-10 rounded-xl bg-primary hover:bg-primary-hover">{saveProviderToken.isPending ? "Salvando…" : "Salvar token"}</Button>
          </form>
        </section>

        <FiscalTaxCategories />
      </div>
    </>
  );
}
