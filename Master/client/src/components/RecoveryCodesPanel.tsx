import { Button } from "@/components/ui/Button";
import { copyToClipboard } from "@/lib/clipboard";
import { useState } from "react";

/**
 * Mostra os códigos de recuperação UMA ÚNICA VEZ. O servidor só guarda o hash,
 * então se esta tela for fechada sem guardar, não há como ver os códigos de
 * novo (dá pra gerar uma lista nova, que invalida a anterior).
 */
export function RecoveryCodesPanel({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  async function copy() {
    setCopied(await copyToClipboard(codes.join("\n")));
  }

  function download() {
    const text = `Códigos de recuperação do Painel Master (Comandiva)\nCada código funciona UMA vez. Guarde em lugar seguro, fora deste computador.\n\n${codes.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "codigos-de-recuperacao-painel-master.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="font-semibold text-amber-900">Guarde estes códigos agora — eles não aparecem de novo.</p>
      <p className="mt-1 text-sm text-amber-900">
        Se você perder o celular, cada código deixa você entrar uma vez. Salve em um gerenciador de senhas ou imprima e guarde em lugar seguro. Quem tiver estes códigos e a sua senha consegue entrar.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-white p-3 font-mono text-sm tracking-wider text-ink">
        {codes.map(code => <li key={code}>{code}</li>)}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void copy()}>{copied ? "Copiado!" : "Copiar"}</Button>
        <Button variant="outline" onClick={download}>Baixar .txt</Button>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm text-amber-900">
        <input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} className="h-4 w-4 accent-accent" />
        Já guardei os códigos em um lugar seguro.
      </label>
      <Button className="mt-3" disabled={!saved} onClick={onDone}>Concluir</Button>
    </div>
  );
}
