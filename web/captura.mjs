// Gera as capturas de tela usadas no README, para nao ficarem desatualizadas
// quando a interface muda.
//
//   node captura.mjs                       # usa http://127.0.0.1:5000
//   node captura.mjs http://127.0.0.1:5000
//
// Requer o Flask no ar servindo o build (`npm run build` antes).
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = (process.argv[2] || 'http://127.0.0.1:5000').replace(/\/$/, '')
const DESTINO = '../docs'

const TELAS = [
  { arquivo: 'painel.png', rota: '/', tema: 'escuro', altura: 900 },
  { arquivo: 'como-funciona.png', rota: '/como-funciona', tema: 'claro', altura: 950 },
  { arquivo: 'clientes.png', rota: '/clientes', tema: 'escuro', altura: 900 },
  { arquivo: 'contatos-do-dia.png', rota: '/regua', tema: 'claro', altura: 900 },
  { arquivo: 'ficha-cliente.png', rota: '/cliente/1', tema: 'escuro', altura: 950 },
]

await mkdir(DESTINO, { recursive: true })
const nav = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
})

for (const t of TELAS) {
  const pg = await nav.newPage()
  await pg.setViewport({ width: 1440, height: t.altura, deviceScaleFactor: 1 })
  await pg.goto(BASE + t.rota, { waitUntil: 'networkidle0' })
  await pg.waitForSelector('.card')
  if (t.tema === 'escuro') {
    await pg.click('.btn-tema')
    await new Promise((r) => setTimeout(r, 700))
  }
  await new Promise((r) => setTimeout(r, 600))   // deixa o Chart.js terminar
  await pg.screenshot({ path: `${DESTINO}/${t.arquivo}` })
  await pg.close()
  console.log(`  ${t.arquivo.padEnd(22)} ${t.rota} (${t.tema})`)
}

await nav.close()
console.log('capturas geradas em docs/')
