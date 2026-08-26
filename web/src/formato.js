// Portados dos filtros Jinja (moeda, data_br, datahora_br) do app.py.
// DECISAO: a API devolve valor cru e a formatacao acontece aqui. O mesmo JSON
// serve tela, export e teste, e o servidor nao precisa saber do idioma da tela.

const NUMERO_BR = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 61879.39 -> "R$ 61.879,39" */
export function moeda(v) {
  const n = Number(v)
  return `R$ ${NUMERO_BR.format(Number.isFinite(n) ? n : 0)}`
}

/** "2024-03-21" -> "21/03/2024". Vazio vira travessao, como no Jinja. */
export function dataBr(v) {
  if (!v) return '—'
  const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v)
}

/** "2026-08-19 14:53:14" -> "19/08/2026 14:53" */
export function dataHoraBr(v) {
  if (!v) return '—'
  const m = String(v).slice(0, 16).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : dataBr(v)
}

/** Inteiro com separador de milhar: 1234 -> "1.234" */
export function inteiro(v) {
  return new Intl.NumberFormat('pt-BR').format(Number(v) || 0)
}

/** Digitos do WhatsApp para o link wa.me, sem parenteses nem hifen. */
export function digitosWhats(v) {
  const d = String(v || '').replace(/\D/g, '')
  if (!d) return ''
  return d.startsWith('55') ? d : `55${d}`
}
