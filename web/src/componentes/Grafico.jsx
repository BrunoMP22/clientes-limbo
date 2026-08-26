import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'
import { token } from '../tema'

export const FONTE = '-apple-system, "Segoe UI", Roboto, sans-serif'

/**
 * Envolve o Chart.js.
 *
 * DECISAO: o canvas nao herda CSS, entao as cores sao lidas dos tokens do tema
 * no momento de desenhar e o grafico e refeito quando o tema muda. `config` e
 * uma funcao que recebe o leitor de token — memoize no componente pai para o
 * grafico nao ser destruido a cada render.
 */
export default function Grafico({ config, altura, rotulo }) {
  const canvas = useRef(null)
  const grafico = useRef(null)

  useEffect(() => {
    function desenhar() {
      if (grafico.current) grafico.current.destroy()
      if (!canvas.current) return
      Chart.defaults.font.family = FONTE
      Chart.defaults.color = token('--texto2')
      grafico.current = new Chart(canvas.current, config(token))
    }
    desenhar()
    document.addEventListener('temamudou', desenhar)
    return () => {
      document.removeEventListener('temamudou', desenhar)
      if (grafico.current) {
        grafico.current.destroy()
        grafico.current = null
      }
    }
  }, [config])

  return (
    <div className="relative" style={{ height: altura }}>
      <canvas ref={canvas} aria-label={rotulo} role="img" />
    </div>
  )
}
