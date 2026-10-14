/**
 * Configurações da loja entregues a rotas PÚBLICAS (sem login).
 *
 * pixKey/pixQrCodeUrl ficam de fora: a chave Pix pode ser CPF/e-mail/celular pessoal
 * do dono, nenhuma tela pública usa esses campos (o Pix do cliente é uma cobrança
 * gerada no servidor) e só o admin os lê, via admin.getAccountSettings.
 * Usado por catalog.settings e order.preview — qualquer rota pública nova que
 * devolva a linha de restaurant_settings deve passar por aqui.
 */
export function withoutPixFields<T extends { pixKey?: unknown; pixQrCodeUrl?: unknown }>(settings: T): Omit<T, "pixKey" | "pixQrCodeUrl"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring só pra EXCLUIR essas 2 chaves do resto
  const { pixKey: _pixKey, pixQrCodeUrl: _pixQrCodeUrl, ...rest } = settings;
  return rest;
}
