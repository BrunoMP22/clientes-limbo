import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// DECISAO: o proxy manda /api para o Flask em vez de habilitar CORS no Python.
// Assim o backend continua com uma unica dependencia (flask) e o navegador
// enxerga tudo na mesma origem, em desenvolvimento e em producao.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // estilo.css mora em ../static/css e e a fonte unica do tema enquanto as
    // telas Jinja ainda existem; sem isso o Vite recusa ler fora da raiz.
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://127.0.0.1:5000',
      // o export CSV continua sendo servido pelo Flask
      '/clientes/export': 'http://127.0.0.1:5000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
