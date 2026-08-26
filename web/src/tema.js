// Troca de tema. O valor inicial ja foi escrito no <html> pelo script do
// index.html, antes da primeira pintura; aqui so lemos e alternamos.

export function temaAtual() {
  return document.documentElement.getAttribute('data-tema') === 'escuro' ? 'escuro' : 'claro'
}

export function alternarTema() {
  const novo = temaAtual() === 'escuro' ? 'claro' : 'escuro'
  document.documentElement.setAttribute('data-tema', novo)
  try { localStorage.setItem('tema', novo) } catch (e) { /* modo privado */ }
  // o canvas do Chart.js nao herda CSS: quem desenha precisa repintar
  document.dispatchEvent(new CustomEvent('temamudou', { detail: novo }))
  return novo
}

/** Le um token do tema (ex.: '--classe-a') resolvido no momento da chamada. */
export function token(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
}

/**
 * Mesma cor com opacidade. Usada para esmaecer o que nao esta selecionado nos
 * graficos: o Chart.js pinta em canvas, entao nao da para usar CSS.
 */
export function comAlfa(cor, alfa) {
  const m = /^#([0-9a-f]{6})$/i.exec(cor.trim())
  if (!m) return cor
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`
}
