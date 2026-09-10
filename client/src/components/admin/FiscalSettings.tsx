import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, FileKey, Landmark, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import FiscalTaxCategories from "./FiscalTaxCategories";
import { LockedFeatureFullPage } from "./LockedFeature";
import { Header, Loading } from "./shared";

const REGIME_LABELS: Record<string, string> = { SIMPLES_NACIONAL: "Simples Nacional", LUCRO_PRESUMIDO: "Lucro Presumido", LUCRO_REAL: "Lucro Real", MEI: "MEI" };
const ENVIRONMENT_LABELS: Record<string, string> = { HOMOLOGACAO: "Homologação (testes, não vale como nota fiscal)", PRODUCAO: "Produção (nota fiscal real)" };

function formatCnpj(digits: string) {
  const clean = digits.replace(/\D/g, "").slice(0, 14);
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5");
}

export default function FiscalSettings() {
  const utils = trpc.useUtils();
  const snapshot = trpc.admin.mySnapshot.useQuery();
  const locked = snapshot.data?.lockedFeatures.fiscal;
  const query = trpc.admin.fiscalSettings.useQuery(undefined, { enabled: !snapshot.isLoading && !locked });
  const settings = query.data;

  const [cnpj, setCnpj] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [regimeTributario, setRegimeTributario] = useState("");
  const [environment, setEnvironment] = useState("HOMOLOGACAO");
  const [nfceSeries, setNfceSeries] = useState(1);
  const [nfceNextNumber, setNfceNextNumber] = useState(1);
  const [cscId, setCscId] = useState("");
  const [cscToken, setCscToken] = useState("");
  const [certPassword, setCertPassword] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);

  const saveCadastral = trpc.admin.saveFiscalCadastral.useMutation({ onSuccess: () => { toast.success("Dados cadastrais salvos."); void utils.admin.fiscalSettings.invalidate(); } });
  const saveCsc = trpc.admin.saveFiscalCscToken.useMutation({ onSuccess: () => { toast.success("Token CSC salvo."); setCscToken(""); void utils.admin.fiscalSettings.invalidate(); } });
  const uploadCert = trpc.admin.uploadFiscalCertificate.useMutation({ onSuccess: () => { toast.success("Certificado salvo com segurança."); setCertPassword(""); setCertFile(null); void utils.admin.fiscalSettings.invalidate(); } });

  const startCadastral = () => {
    if (!settings) return;
    setCnpj(settings.cnpj ? formatCnpj(settings.cnpj) : "");
    setInscricaoEstadual(settings.inscricaoEstadual ?? "");
    setRegimeTributario(settings.regimeTributario ?? "");
    setEnvironment(settings.environment);
    setNfceSeries(settings.nfceSeries);
    setNfceNextNumber(settings.nfceNextNumber);
  };

  const submitCadastral = (event: FormEvent) => {
    event.preventDefault();
    if (!regimeTributario) { toast.error("Selecione o regime tributário."); return; }
    saveCadastral.mutate({ cnpj: cnpj.replace(/\D/g, ""), inscricaoEstadual, regimeTributario: regimeTributario as never, environment: environment as never, nfceSeries, nfceNextNumber });
  };

  const submitCsc = (event: FormEvent) => {
    event.preventDefault();
    saveCsc.mutate({ cscId, token: cscToken });
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

  if (snapshot.isLoading) return <Loading />;
  if (locked) return <LockedFeatureFullPage requiredPlanName={locked.requiredPlanName} />;
  if (query.isLoading) return <Loading />;
  if (query.error || !settings) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{query.error?.message ?? "Não foi possível carregar as configurações fiscais."}</p>;

  const pending: string[] = [];
  if (!settings.cnpj) pending.push("CNPJ");
  if (!settings.inscricaoEstadual) pending.push("Inscrição Estadual");
  if (!settings.regimeTributario) pending.push("Regime tributário");
  if (!settings.hasCertificate) pending.push("Certificado digital A1");
  if (!settings.hasCscToken) pending.push("Token CSC");

  return (
    <>
      <Header eyebrow="Fiscal" title="Emissão de NFC-e (SEFAZ-CE)" description="Configuração para emitir nota fiscal de consumidor eletrônica diretamente com a SEFAZ-CE." />

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Emissão de nota ainda não está ativa.</p>
          <p className="mt-1 leading-5">Esta tela guarda a configuração com segurança, mas nenhum pedido gera NFC-e de verdade até {pending.length ? "todos os itens abaixo estarem preenchidos" : "o cálculo de imposto ser implementado"} e testado em homologação primeiro.</p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="mb-6 rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-4">
          <p className="text-sm font-semibold">Pendente: {pending.join(", ")}.</p>
        </div>
      )}

      <div className="space-y-8">
        <section className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-6">
          <div className="flex items-center gap-2"><Landmark className="h-5 w-5 text-[#b4472d]" /><h2 className="font-display text-xl font-bold">Dados cadastrais</h2></div>
          <form onSubmit={submitCadastral} onFocus={startCadastral} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><Label>CNPJ</Label><Input value={cnpj} onChange={event => setCnpj(formatCnpj(event.target.value))} placeholder="00.000.000/0000-00" className="mt-1.5 h-10 rounded-xl bg-white" /></div>
            <div><Label>Inscrição Estadual</Label><Input value={inscricaoEstadual} onChange={event => setInscricaoEstadual(event.target.value)} placeholder="Número da IE no Ceará" className="mt-1.5 h-10 rounded-xl bg-white" /></div>
            <div>
              <Label>Regime tributário</Label>
              <select value={regimeTributario} onChange={event => setRegimeTributario(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#b4472d]">
                <option value="">Selecione (confirme com seu contador)</option>
                {Object.entries(REGIME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <Label>Ambiente</Label>
              <select value={environment} onChange={event => setEnvironment(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#b4472d]">
                {Object.entries(ENVIRONMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div><Label>Série da NFC-e</Label><Input type="number" min={1} value={nfceSeries} onChange={event => setNfceSeries(Number(event.target.value) || 1)} className="mt-1.5 h-10 rounded-xl bg-white" /></div>
            <div><Label>Próximo número</Label><Input type="number" min={1} value={nfceNextNumber} onChange={event => setNfceNextNumber(Number(event.target.value) || 1)} className="mt-1.5 h-10 rounded-xl bg-white" /><p className="mt-1 text-xs text-muted-foreground">Só altere se estiver migrando de outro sistema — pular ou repetir número gerado gera problema na SEFAZ.</p></div>
            {saveCadastral.error && <p className="sm:col-span-2 text-sm text-red-700">{saveCadastral.error.message}</p>}
            <Button disabled={saveCadastral.isPending} className="sm:col-span-2 h-10 rounded-xl bg-[#b4472d] hover:bg-[#943722]">{saveCadastral.isPending ? "Salvando…" : "Salvar dados cadastrais"}</Button>
          </form>
        </section>

        <section className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-6">
          <div className="flex items-center gap-2"><FileKey className="h-5 w-5 text-[#b4472d]" /><h2 className="font-display text-xl font-bold">Certificado digital A1</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Arquivo .pfx/.p12 emitido no CNPJ do restaurante por uma autoridade certificadora (ICP-Brasil). Fica criptografado no banco — nunca volta pra tela depois de salvo.</p>
          {settings.hasCertificate && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />Certificado configurado: {settings.certificateFilename}
            </div>
          )}
          <form onSubmit={submitCertificate} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><Label>Arquivo (.pfx ou .p12)</Label><Input type="file" accept=".pfx,.p12" onChange={event => setCertFile(event.target.files?.[0] ?? null)} className="mt-1.5 h-10 rounded-xl bg-white file:mr-3 file:rounded-lg file:border-0 file:bg-[#f3eadf] file:px-3 file:py-1.5 file:text-xs file:font-semibold" /></div>
            <div><Label>Senha do certificado</Label><Input type="password" value={certPassword} onChange={event => setCertPassword(event.target.value)} placeholder={settings.hasCertificate ? "Deixe em branco para manter o atual" : "Senha do arquivo"} className="mt-1.5 h-10 rounded-xl bg-white" /></div>
            {uploadCert.error && <p className="sm:col-span-2 text-sm text-red-700">{uploadCert.error.message}</p>}
            <Button disabled={uploadCert.isPending} className="sm:col-span-2 h-10 rounded-xl bg-[#b4472d] hover:bg-[#943722]">{uploadCert.isPending ? "Enviando…" : "Salvar certificado"}</Button>
          </form>
        </section>

        <section className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-6">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#b4472d]" /><h2 className="font-display text-xl font-bold">Token CSC</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Código de Segurança do Contribuinte, gerado no portal da SEFAZ-CE — usado para montar o QR Code do cupom (DANFE NFC-e).</p>
          {settings.hasCscToken && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />Token CSC configurado (ID: {settings.cscId})
            </div>
          )}
          <form onSubmit={submitCsc} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><Label>ID do CSC</Label><Input value={cscId} onChange={event => setCscId(event.target.value)} placeholder="Ex.: 000001" className="mt-1.5 h-10 rounded-xl bg-white" /></div>
            <div><Label>Token CSC</Label><Input type="password" value={cscToken} onChange={event => setCscToken(event.target.value)} placeholder={settings.hasCscToken ? "Deixe em branco para manter o atual" : "Token gerado no portal da SEFAZ"} className="mt-1.5 h-10 rounded-xl bg-white" /></div>
            {saveCsc.error && <p className="sm:col-span-2 text-sm text-red-700">{saveCsc.error.message}</p>}
            <Button disabled={saveCsc.isPending} className="sm:col-span-2 h-10 rounded-xl bg-[#b4472d] hover:bg-[#943722]">{saveCsc.isPending ? "Salvando…" : "Salvar token CSC"}</Button>
          </form>
        </section>

        <FiscalTaxCategories />
      </div>
    </>
  );
}
