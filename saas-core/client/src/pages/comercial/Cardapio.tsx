import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { ChangeEvent, FormEvent, useState } from "react";
import { Link, useSearch } from "wouter";
import { ComercialHeader } from "./ComercialHeader";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp";

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      // "data:<mime>;base64,<...>" — só a parte depois da vírgula interessa.
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

export default function Cardapio() {
  const search = useSearch();
  const restaurantId = Number(new URLSearchParams(search).get("ref"));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const upload = trpc.public.uploadMenuReference.useMutation({
    onSuccess: () => setSent(true),
    onError: e => setError(e.message),
  });

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const selected = event.target.files?.[0] ?? null;
    if (selected && selected.size > MAX_FILE_BYTES) {
      setError("Arquivo maior que 8MB. Envie uma versão mais leve.");
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !Number.isFinite(restaurantId) || restaurantId <= 0) return;
    setError(null);
    const fileBase64 = await readFileAsBase64(file);
    upload.mutate({ restaurantId, fileName: file.name, mimeType: file.type, fileBase64 });
  }

  return (
    <div className="comercial-dark min-h-screen bg-paper text-ink">
      <ComercialHeader showNav={false} />
      <div className="mx-auto max-w-md px-6 py-12">
        <Link href="/comercial" className="text-sm text-ink-soft hover:text-ink">
          ← Voltar para a página inicial
        </Link>

        <div className="mt-6 rounded-2xl border border-border bg-paper-raised p-6 shadow-sm">
          {!Number.isFinite(restaurantId) || restaurantId <= 0 ? (
            <p className="text-sm text-red-400">Link inválido — não encontramos a referência do seu cadastro.</p>
          ) : sent ? (
            <div className="text-center">
              <span className="text-4xl">📎</span>
              <h1 className="mt-4 text-xl font-bold text-ink">Cardápio recebido!</h1>
              <p className="mt-2 text-sm text-ink-soft">
                Nossa equipe já tem seu arquivo em mãos e vai usar ele pra organizar seu sistema.
              </p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h1 className="text-xl font-bold text-ink">Envie seu cardápio</h1>
              <p className="mt-1 text-sm text-ink-soft">
                PDF, Word ou foto — o que você já tiver serve. Isso adianta a organização do seu sistema.
              </p>

              <input
                type="file"
                accept={ACCEPT}
                onChange={onFileChange}
                className="mt-5 block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-accent"
              />

              {(error || upload.error) && (
                <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-sm text-red-400">
                  {error ?? upload.error?.message}
                </p>
              )}

              <Button
                type="submit"
                disabled={!file || upload.isPending}
                className="mt-5 w-full !bg-gradient-to-r !from-[#008cfe] !to-[#6146fd] shadow-lg shadow-[#6146fd]/20 transition-all duration-200 hover:!brightness-110"
              >
                {upload.isPending ? "Enviando..." : "Enviar cardápio"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
