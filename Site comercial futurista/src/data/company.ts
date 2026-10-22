/**
 * Identificação de quem oferece o serviço. Dados informados pelo dono em 2026-10-21.
 * O dono decidiu NÃO publicar CPF, e-mail nem WhatsApp: só nome e cidade. Quando abrir CNPJ (MEI),
 * preencha `document` e ele aparece sozinho no rodapé, nos Termos e na Privacidade.
 * Contato é feito pelo dono com quem se cadastra.
 */
export const COMPANY: { name: string; place: string; document: { label: string; value: string } | null } = {
  name: "Maycon Meneses",
  place: "Croatá, Ceará",
  document: null,
};

/** "Maycon Meneses · CNPJ 00.000.000/0001-00 · Croatá, Ceará" para o rodapé (o documento só entra se existir). */
export const companyFooter = () =>
  [COMPANY.name, COMPANY.document ? `${COMPANY.document.label} ${COMPANY.document.value}` : null, COMPANY.place].filter(Boolean).join(" · ");

/** "Maycon Meneses, CNPJ 00.000.000/0001-00, Croatá, Ceará" (o documento só entra se existir). */
export const companyIdentity = () =>
  [COMPANY.name, COMPANY.document ? `${COMPANY.document.label} ${COMPANY.document.value}` : null, COMPANY.place].filter(Boolean).join(", ");
