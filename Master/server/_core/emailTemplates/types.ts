/**
 * Cada template define seu próprio formato de variáveis (tipado, não um
 * `Record<string, string>` genérico) — o TypeScript garante que quem chama
 * `emailService.send()` passou exatamente o que o template precisa, nunca
 * deixando um placeholder sem valor passar despercebido (ver regra #33 do
 * prompt do dono: "nunca permitir que placeholders apareçam para o cliente").
 */
export type EmailTemplateDefinition<TVars> = {
  subject: (vars: TVars) => string;
  render: (vars: TVars) => string;
};
