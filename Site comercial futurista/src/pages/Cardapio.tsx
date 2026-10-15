import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { uploadMenuReference, ApiError } from "../lib/api";
import { track } from "../lib/track";
import { usePageMeta } from "../lib/seo";
import { Stamp } from "../components/ui/Stamp";
import { compressImage, formatMB } from "../lib/compressImage";

// Mesmo limite do servidor (Master: MAX_MENU_FILE_BYTES = 20MB). Fotos são reduzidas antes.
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp";
/** Mesmos formatos aceitos pelo servidor (ALLOWED_MENU_MIME_TYPES no Master). */
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    // "data:<mime>;base64,<...>" — só a parte depois da vírgula interessa.
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

/**
 * Envio do cardápio logo após o cadastro. Chama `public.uploadMenuReference`
 * no Master — o servidor NÃO guarda o arquivo: repassa como anexo para o
 * TELEGRAM DO DONO. Mesmo fluxo e formatos do site atual; limite de 20MB e
 * fotos reduzidas no navegador antes do envio (lib/compressImage.ts).
 */
export default function Cardapio() {
  usePageMeta("/cadastro/cardapio", { noindex: true });
  const params = new URLSearchParams(useSearch());
  const restaurantId = Number(params.get("ref"));
  const uploadToken = params.get("t") ?? "";
  const validLink = Number.isFinite(restaurantId) && restaurantId > 0 && uploadToken.length > 0;

  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [sizeNote, setSizeNote] = useState<string | null>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setSizeNote(null);
    const input = e.target;
    const original = input.files?.[0] ?? null;
    if (!original) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.has(original.type)) {
      setError("Formato não aceito. Envie PDF, Word, PNG, JPG ou WEBP.");
      setFile(null);
      input.value = "";
      return;
    }
    setPreparing(true);
    const f = await compressImage(original);
    setPreparing(false);
    if (f.size > MAX_FILE_BYTES) {
      setError(`Arquivo com ${formatMB(f.size)} — o limite é 20MB. Envie uma versão mais leve.`);
      setFile(null);
      input.value = "";
      return;
    }
    if (f !== original) setSizeNote(`Foto otimizada para envio: ${formatMB(original.size)} → ${formatMB(f.size)}`);
    setFile(f);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file || !validLink || sending) return;
    setError(null);
    setSending(true);
    try {
      const fileBase64 = await readFileAsBase64(file);
      await uploadMenuReference({ restaurantId, uploadToken, fileName: file.name, mimeType: file.type, fileBase64, notes: notes.trim() || undefined });
      track("signup_step");
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar agora. Tente de novo em instantes.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg px-4 pb-24 pt-14 sm:px-6" aria-labelledby="cardapio-title">
      <Link href="/" className="text-sm text-ink-soft hover:text-ink">
        ← Voltar para a página inicial
      </Link>
      <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5">
        <div className="rounded-[calc(2rem-0.375rem)] bg-bg-raised p-6 sm:p-8">
          {!validLink ? (
            <p role="alert" className="text-sm text-[#ff9a9a]">
              Link inválido — não encontramos a referência do seu cadastro. Fale com a nossa equipe pelo WhatsApp para enviar o cardápio.
            </p>
          ) : sent ? (
            <div className="py-6 text-center" role="status">
              <Stamp text="Cardápio recebido" sub="Comandiva" tone="light" rotate={-6} />
              <h1 id="cardapio-title" className="mt-8 font-display text-3xl font-semibold tracking-tight">
                Cardápio recebido!
              </h1>
              <p className="mt-2 text-sm text-ink-soft">Nossa equipe já tem seu arquivo em mãos e vai usar ele pra organizar seu sistema.</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h1 id="cardapio-title" className="font-display text-3xl font-semibold tracking-tight">
                Envie seu cardápio
              </h1>
              <p className="mt-2 text-sm text-ink-soft">PDF, Word ou foto — o que você já tiver serve. Isso adianta a organização do seu sistema.</p>

              <label htmlFor="arquivo" className="mt-6 block text-sm font-medium text-ink">
                Arquivo do cardápio <span className="font-normal text-ink-soft">(até 20MB — fotos são reduzidas automaticamente)</span>
              </label>
              <input
                id="arquivo"
                type="file"
                accept={ACCEPT}
                onChange={onFile}
                className="mt-1.5 block w-full rounded-xl border border-dashed border-line bg-bg p-3 text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-accent-strong file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />

              {(preparing || sizeNote) && (
                <p className="mt-2 font-mono text-[11px] text-accent-text" role="status">
                  {preparing ? "Otimizando foto…" : sizeNote}
                </p>
              )}

              <label htmlFor="notes" className="mt-5 block text-sm font-medium text-ink">
                Observações <span className="font-normal text-ink-soft">(opcional)</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Horário de funcionamento, preferências de cores, algo que devemos saber..."
                className="mt-1.5 block w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink placeholder:text-ink-soft/60 focus:border-accent-text focus:outline-none"
              />

              {error && (
                <p role="alert" className="mt-4 rounded-xl border border-[#ff7a7a]/30 bg-[#ff7a7a]/10 p-3 text-sm text-[#ff9a9a]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!file || sending || preparing}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-accent-strong font-semibold text-white transition-colors hover:bg-[#0076e0] disabled:opacity-50"
              >
                {sending ? "Enviando…" : "Enviar cardápio"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
