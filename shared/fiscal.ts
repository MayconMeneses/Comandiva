/**
 * Validação de dígito verificador de CNPJ — algoritmo público e estável
 * (não muda com legislação tributária, ao contrário de alíquota/CST/CSOSN,
 * que nunca devem ser inventados aqui — ver server/db/fiscal.ts). Usado só
 * pra pegar erro de digitação antes de salvar, não substitui confirmação
 * junto à Receita/contador.
 */
export function isValidCnpjChecksum(digitsOnly: string): boolean {
  if (!/^\d{14}$/.test(digitsOnly)) return false;
  if (/^(\d)\1{13}$/.test(digitsOnly)) return false; // todos os dígitos iguais

  const calcDigit = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first12 = digitsOnly.slice(0, 12);
  const digit1 = calcDigit(first12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digit2 = calcDigit(first12 + digit1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digitsOnly === `${first12}${digit1}${digit2}`;
}
