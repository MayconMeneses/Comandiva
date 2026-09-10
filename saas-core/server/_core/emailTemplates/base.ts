import { PLATFORM_NAME } from "../../../shared/branding";

/**
 * Layout HTML compartilhado por todo e-mail transacional — tabelas em vez de
 * flex/grid (Outlook desktop ainda usa o motor do Word pra renderizar HTML,
 * só entende tabelas de verdade), estilo inline em vez de `<style>` externo
 * (Gmail remove `<style>` em algumas visualizações), sem nenhum
 * `<script>` (e-mail nunca executa JavaScript mesmo, e alguns clientes
 * rejeitam a mensagem inteira se detectam a tag). Ver auditoria/prompt do
 * dono — regras #32/#33 sobre design e personalização de e-mail.
 */
export function renderEmailLayout(params: { title: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string }): string {
  const cta = params.ctaUrl && params.ctaLabel
    ? `<tr><td style="padding:28px 0 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#b4472d;">
          <a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;padding:13px 28px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(params.ctaLabel)}</a>
        </td></tr></table>
      </td></tr>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(params.title)}</title></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2ddd3;">
        <tr><td style="background:#211d17;padding:24px 32px;">
          <span style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#ffffff;">${escapeHtml(PLATFORM_NAME)}</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:15px;line-height:1.6;color:#211d17;">
              ${params.bodyHtml}
            </td></tr>
            ${cta}
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#faf8f5;border-top:1px solid #e2ddd3;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#84796a;">Este é um e-mail automático — não é preciso responder. Dúvidas? Fale com o suporte pelo painel do seu restaurante.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Nunca interpolar variável de usuário/cliente direto no HTML sem passar por aqui — mesmo raciocínio de defesa em profundidade do resto do projeto (ver auditoria V-39). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;">${escapeHtml(text)}</p>`;
}

/** Bloco de destaque (valor/plano/data) — usado nos e-mails de pagamento/assinatura pra deixar o dado principal fácil de escanear. */
export function highlightBox(rows: Array<[label: string, value: string]>): string {
  const cells = rows.map(([label, value]) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#84796a;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;font-size:14px;font-weight:bold;color:#211d17;text-align:right;">${escapeHtml(value)}</td>
    </tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border:1px solid #e2ddd3;border-radius:10px;padding:14px 16px;margin:0 0 18px;">${cells}</table>`;
}
