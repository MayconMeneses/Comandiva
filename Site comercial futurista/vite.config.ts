import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Mesma API do site comercial atual. Dentro do Master a chamada já é no
  // mesmo endereço; rodando sozinho, o Vite repassa /api para o servidor real
  // (a API não envia CORS, então o navegador não pode chamar direto).
  server: { proxy: { "/api": { target: "https://mmsystem.tech", changeOrigin: true } } },
  preview: { proxy: { "/api": { target: "https://mmsystem.tech", changeOrigin: true } } },
})
