// navigator.clipboard só existe em contexto seguro (HTTPS ou localhost) — em
// HTTP puro (ex.: acesso direto por IP, sem domínio/certificado ainda) o
// navegador não expõe a API, e chamar .writeText quebra o clique inteiro.
// Fallback: campo de texto temporário + document.execCommand("copy"), que
// funciona em qualquer contexto (API antiga, mas sem essa restrição).
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // cai pro fallback abaixo (ex.: permissão negada)
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
