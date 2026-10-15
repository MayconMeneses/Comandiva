import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Mesmos cabeçalhos de segurança que o Master envia em produção
 * (Master/server/_core/index.ts). Aplicados aqui para o site já ser testado
 * sob as mesmas regras antes de ir para o Master — se algo violar a CSP,
 * aparece no console do preview.
 *
 * Como no Master, a CSP só vale no build (preview): o servidor de
 * desenvolvimento usa script inline do React Fast Refresh, que ela bloquearia.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://www.mercadopago.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://www.mercadopago.com https://api.mercadopago.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ')

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

// Mesma API do site comercial atual. Dentro do Master a chamada já é no
// mesmo endereço; rodando sozinho, o Vite repassa /api para o servidor real
// (a API não envia CORS, então o navegador não pode chamar direto).
const API_PROXY = { '/api': { target: 'https://mmsystem.tech', changeOrigin: true } }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // O site mora em mmsystem.tech/comercial/ (servido pelo Master). Rodando
  // sozinho: http://localhost:5180/comercial/
  base: '/comercial/',
  // Fontes nunca viram data: no CSS (a CSP font-src 'self' bloqueia data:).
  build: { assetsInlineLimit: file => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined) },
  server: { proxy: API_PROXY, headers: SECURITY_HEADERS },
  preview: { proxy: API_PROXY, headers: { ...SECURITY_HEADERS, 'Content-Security-Policy': CONTENT_SECURITY_POLICY } },
})
