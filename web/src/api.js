// Cliente HTTP da API Flask. Em desenvolvimento o Vite faz proxy de /api para
// a porta 5000; em producao o Flask serve o build, entao a origem e a mesma.

async function resposta(r) {
  const tipo = r.headers.get('content-type') || ''
  if (!tipo.includes('application/json')) {
    throw new Error(`Resposta inesperada do servidor (${r.status})`)
  }
  const dados = await r.json()
  if (!r.ok) {
    throw Object.assign(new Error(dados.erro || `Erro ${r.status}`), { status: r.status, dados })
  }
  return dados
}

/** Monta ?a=1&b=2 ignorando valores vazios, para a URL nao encher de lixo. */
export function comFiltros(caminho, filtros = {}) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== '' && v !== null && v !== undefined) p.set(k, v)
  }
  const q = p.toString()
  return q ? `${caminho}?${q}` : caminho
}

export async function buscar(caminho, filtros) {
  return resposta(await fetch(comFiltros(`/api${caminho}`, filtros)))
}

export async function enviar(caminho, corpo) {
  return resposta(await fetch(`/api${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo || {}),
  }))
}

export async function enviarArquivo(caminho, arquivo) {
  const form = new FormData()
  form.append('arquivo', arquivo)
  return resposta(await fetch(`/api${caminho}`, { method: 'POST', body: form }))
}
