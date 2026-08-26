// Verificacao de fumaca da SPA num Chrome real.
//
// Parte 1: percorre todas as telas nos dois temas e falha se alguma nao
//          renderizar, ficar com texto invisivel, estourar a largura da
//          janela, deixar grafico em branco ou soltar erro no console.
// Parte 2: clica nos graficos do painel e confere que o filtro entra na URL,
//          que clicar de novo remove e que o drill-through leva ao mesmo
//          conjunto que o grafico mostrava.
//
// So leitura: nao grava nada no banco.
// Uso: npm run verifica [-- http://127.0.0.1:5000]
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')

const TELAS = [
  { rota: '/', nome: 'Painel', espera: '.kpi' },
  { rota: '/clientes', nome: 'Clientes', espera: 'table.grade tbody tr' },
  { rota: '/clientes?classe=A&uf=MG', nome: 'Clientes (filtrado)', espera: '.card' },
  { rota: '/cliente/1', nome: 'Ficha do cliente', espera: '.linha-tempo, .vazio' },
  { rota: '/regua', nome: 'Contatos do dia', espera: '.card' },
  { rota: '/cidades', nome: 'Cidades', espera: '.card' },
  { rota: '/como-funciona', nome: 'Como funciona', espera: '.pill-classe' },
]

const navegador = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const pagina = await navegador.newPage()
await pagina.setViewport({ width: 1500, height: 1100 })

let errosGlobais = []
pagina.on('console', (m) => { if (m.type() === 'error') errosGlobais.push(m.text()) })
pagina.on('pageerror', (e) => errosGlobais.push('pageerror: ' + e.message))
pagina.on('response', (r) => {
  if (r.status() >= 400) errosGlobais.push(`HTTP ${r.status()} ${r.url()}`)
})

async function medir() {
  return pagina.evaluate(() => {
    const canvas = [...document.querySelectorAll('canvas')]
    const pintados = canvas.filter((c) => {
      if (!c.width || !c.height) return false
      const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) return true
      return false
    }).length
    const est = getComputedStyle(document.body)
    return {
      fundo: est.backgroundColor,
      cards: document.querySelectorAll('.card').length,
      linhas: document.querySelectorAll('table.grade tbody tr').length,
      pilulas: document.querySelectorAll('.pill-classe').length,
      canvas: canvas.length,
      canvasPintados: pintados,
      // texto invisivel = mesma cor do fundo (erro classico de tema)
      textoIgualAoFundo: [...document.querySelectorAll('.card *')].filter((el) => {
        if (!el.textContent?.trim() || el.children.length) return false
        const s = getComputedStyle(el)
        return s.color === s.backgroundColor
      }).length,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      vazio: document.body.innerText.trim().length < 50,
      // a marca do rodape tem que carregar de verdade, nao virar icone quebrado
      marcaOk: (() => {
        const img = document.querySelector('.assinatura-marca')
        return !!img && img.complete && img.naturalWidth > 0
      })(),
    }
  })
}

// ---------------------------------------------------------------- parte 1
const resultados = []
for (const tela of TELAS) {
  errosGlobais = []
  await pagina.goto(BASE + tela.rota, { waitUntil: 'networkidle0', timeout: 30000 })
  let achou = true
  try {
    await pagina.waitForSelector(tela.espera, { timeout: 12000 })
  } catch { achou = false }
  const claro = await medir()
  await pagina.click('.btn-tema')
  await new Promise((r) => setTimeout(r, 500))
  const escuro = await medir()
  await pagina.click('.btn-tema')
  await new Promise((r) => setTimeout(r, 300))
  resultados.push({ ...tela, achou, claro, escuro, erros: [...errosGlobais] })
}

let falhas = 0
console.log('tela                      cards linhas pilul canvas  fundo claro        ok')
console.log('-'.repeat(78))
for (const r of resultados) {
  const p = []
  if (!r.achou) p.push('seletor ausente')
  if (r.claro.vazio) p.push('tela vazia')
  if (r.claro.overflowX || r.escuro.overflowX) p.push('overflow horizontal')
  if (r.claro.textoIgualAoFundo || r.escuro.textoIgualAoFundo) p.push('texto invisivel')
  if (r.claro.fundo === r.escuro.fundo) p.push('tema nao mudou')
  if (r.claro.canvas !== r.claro.canvasPintados) p.push('canvas em branco')
  if (r.escuro.canvas !== r.escuro.canvasPintados) p.push('canvas escuro em branco')
  if (!r.claro.marcaOk) p.push('marca do rodape nao carregou')
  if (r.erros.length) p.push(`erros: ${r.erros.join(' | ')}`)
  if (p.length) falhas++
  console.log(
    `${r.nome.padEnd(25)} ${String(r.claro.cards).padStart(5)} ` +
    `${String(r.claro.linhas).padStart(6)} ${String(r.claro.pilulas).padStart(5)} ` +
    `${String(r.claro.canvasPintados + '/' + r.claro.canvas).padStart(6)}  ` +
    `${r.claro.fundo.replace(/\s/g, '')}`.padEnd(19) +
    (p.length ? '<<< ' + p.join('; ') : 'ok'))
}

// ---------------------------------------------------------------- parte 2
const caixa = (i) => pagina.evaluate((k) => {
  const r = document.querySelectorAll('canvas')[k].getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
}, i)
const busca = () => pagina.evaluate(() => location.search)

async function painelLimpo() {
  await pagina.goto(BASE + '/', { waitUntil: 'networkidle0' })
  await pagina.waitForSelector('canvas')
  await new Promise((r) => setTimeout(r, 400))
}

/** Clica na barra `i` do funil (grafico 3, barras horizontais). */
async function clicarFunil(i) {
  const b = await caixa(2)
  const y = b.y + b.h * 0.10 + b.h * 0.78 * ((i + 0.5) / 5)
  await pagina.mouse.click(b.x + b.w * 0.45, y)
  await new Promise((r) => setTimeout(r, 450))
}

const cliques = []
errosGlobais = []

// rosca: varre o anel ate acertar uma fatia
await painelLimpo()
{
  const b = await caixa(0)
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  const raio = Math.min(b.w, b.h) * 0.42 * 0.84
  let achou = null
  for (let g = 0; g < 360 && !achou; g += 15) {
    const rad = (g - 90) * Math.PI / 180
    await pagina.mouse.click(cx + raio * Math.cos(rad), cy + raio * Math.sin(rad))
    await new Promise((r) => setTimeout(r, 320))
    if ((await busca()).includes('classe=')) achou = await busca()
  }
  cliques.push({ o: 'clique na rosca aplica classe', ok: !!achou, obtido: achou || '(nada)' })
}

// funil: barra 0 e a carteira (nao filtra), 1 a 4 filtram
for (const [i, esperado] of [[0, ''], [1, '?funil=contatados'], [2, '?funil=visualizaram'],
                             [3, '?funil=responderam'], [4, '?funil=reativados']]) {
  await painelLimpo()
  await clicarFunil(i)
  const u = await busca()
  cliques.push({ o: `funil barra ${i}`, ok: u === esperado, obtido: u || '(nada)' })
}

// clicar de novo na mesma barra remove o filtro
await painelLimpo()
await clicarFunil(3)
const um = await busca()
await clicarFunil(3)
const dois = await busca()
cliques.push({ o: 'clicar 2x remove o filtro', ok: um !== '' && dois === '', obtido: `${um} -> ${dois || '(vazio)'}` })

// canal: as 6 barras viram as 6 chaves de sinal
await painelLimpo()
{
  const b = await caixa(1)
  const alvo = [['email_enviado', 'whats_enviado'], ['email_visualizou', 'whats_visualizou'],
                ['email_respondeu', 'whats_respondeu']]
  for (let g = 0; g < 3; g++) {
    for (const [k, lado] of [[0, -1], [1, 1]]) {
      await painelLimpo()
      const x = b.x + b.w * 0.12 + b.w * 0.82 * ((g + 0.5) / 3) + lado * b.w * 0.06
      await pagina.mouse.click(x, b.y + b.h * 0.72)
      await new Promise((r) => setTimeout(r, 400))
      const u = await busca()
      cliques.push({ o: `canal grupo ${g} ${lado < 0 ? 'e-mail' : 'whats'}`,
                     ok: u === `?sinal=${alvo[g][k]}`, obtido: u || '(nada)' })
    }
  }
}

// drill-through: o botao leva a lista com o mesmo total do painel
await pagina.goto(BASE + '/?funil=responderam', { waitUntil: 'networkidle0' })
await pagina.waitForSelector('.kpi')
const doPainel = await pagina.evaluate(() => {
  const a = [...document.querySelectorAll('a.btn-azul')].find((e) => e.textContent.includes('ver os'))
  return a ? a.textContent.replace(/\D/g, '') : null
})
const alvoLink = await pagina.evaluate(() => {
  const a = [...document.querySelectorAll('a.btn-azul')].find((e) => e.textContent.includes('ver os'))
  return a ? a.getAttribute('href') : null
})
if (alvoLink) {
  await pagina.goto(BASE + alvoLink, { waitUntil: 'networkidle0' })
  await pagina.waitForSelector('.card')
  const daLista = await pagina.evaluate(() =>
    document.querySelector('.text-sm .font-bold')?.textContent?.replace(/\D/g, ''))
  cliques.push({ o: 'drill-through mantem o total', ok: doPainel === daLista,
                 obtido: `painel ${doPainel} / lista ${daLista}` })
} else {
  cliques.push({ o: 'drill-through mantem o total', ok: false, obtido: 'botao nao encontrado' })
}

console.log('\ninteratividade do painel')
console.log('-'.repeat(78))
for (const c of cliques) {
  if (!c.ok) falhas++
  console.log(`${c.o.padEnd(34)} ${c.ok ? 'ok' : '<<< FALHOU'}  ${c.obtido}`)
}
if (errosGlobais.length) {
  falhas++
  console.log('erros de console:', errosGlobais.join(' | '))
}

console.log('-'.repeat(78))
console.log(`verificacoes com problema: ${falhas}`)
await navegador.close()
process.exit(falhas ? 1 : 0)
