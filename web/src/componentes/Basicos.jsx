import { useEffect, useState } from 'react'
import { alternarTema, temaAtual } from '../tema'

/** Circulo colorido com a letra da classe (A, B ou C). */
export function PillClasse({ classe, tamanho }) {
  const estilo = tamanho
    ? { width: tamanho, height: tamanho, fontSize: tamanho <= 20 ? '.66rem' : '.78rem' }
    : undefined
  return <span className={`pill-classe pill-${classe}`} style={estilo}>{classe}</span>
}

/** Tag de status: ATIVO, LIMBO ou MORTO. */
export function TagStatus({ status }) {
  return <span className={`tag tag-${status}`}>{status}</span>
}

export function Tag({ children, tipo = 'neutra' }) {
  return <span className={`tag tag-${tipo}`}>{children}</span>
}

/** Titulo de secao dentro de um card. */
export function TituloBloco({ children, className = '' }) {
  return <div className={`titulo-bloco ${className}`}>{children}</div>
}

export function Card({ children, className = '', ...resto }) {
  return <div className={`card ${className}`} {...resto}>{children}</div>
}

export function Vazio({ children }) {
  return <div className="vazio">{children}</div>
}

/** Avisos vindos da API (mesmas categorias do flash do Jinja). */
export function Avisos({ avisos, aoFechar }) {
  if (!avisos || avisos.length === 0) return null
  return (
    <div>
      {avisos.map((a, i) => (
        <div key={i} className={`flash flash-${a.categoria}`}
             onClick={aoFechar} role={aoFechar ? 'button' : undefined}
             style={aoFechar ? { cursor: 'pointer' } : undefined}>
          {a.texto}
        </div>
      ))}
    </div>
  )
}

/** Botao de copiar que confirma no proprio rotulo por 1,4s. */
export function BotaoCopiar({ texto, children, className = 'btn' }) {
  const [copiado, setCopiado] = useState(false)
  useEffect(() => {
    if (!copiado) return
    const t = setTimeout(() => setCopiado(false), 1400)
    return () => clearTimeout(t)
  }, [copiado])

  async function copiar() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto)
      } else {
        // http em rede local nao tem clipboard: cai no textarea escondido
        const ta = document.createElement('textarea')
        ta.value = texto
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiado(true)
    } catch (e) { /* navegador bloqueou: nada a fazer */ }
  }

  return (
    <button type="button" className={className} onClick={copiar}>
      {copiado ? '✓ copiado' : children}
    </button>
  )
}

export function BotaoTema() {
  const [tema, setTema] = useState(temaAtual)
  return (
    <button type="button" className="btn-tema" onClick={() => setTema(alternarTema())}
            title="Alternar modo claro/escuro" aria-label="Alternar modo claro/escuro">
      {tema === 'escuro' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.2v2.2M12 19.6v2.2M2.2 12h2.2M19.6 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6" />
        </svg>
      )}
    </button>
  )
}

/** Select de filtro no formato pilula usado em todas as telas. */
export function Filtro({ valor, aoMudar, vazio, opcoes, rotulo }) {
  return (
    <select className="filtro-select" value={valor || ''}
            onChange={(e) => aoMudar(e.target.value)} aria-label={rotulo}>
      <option value="">{vazio}</option>
      {opcoes.map((o) => {
        const v = typeof o === 'string' ? o : o.valor
        const t = typeof o === 'string' ? o : o.rotulo
        return <option key={v} value={v}>{t}</option>
      })}
    </select>
  )
}

export function Carregando({ children = 'Carregando…' }) {
  return <div className="vazio">{children}</div>
}

export function ErroCarga({ erro, aoTentar }) {
  return (
    <Card className="p-6">
      <div className="flash flash-erro">{String(erro.message || erro)}</div>
      {aoTentar && (
        <button className="btn mt-2" onClick={aoTentar}>Tentar de novo</button>
      )}
    </Card>
  )
}

/** Icone de canal: verde respondeu, ambar so visualizou, cinza sem sinal. */
export function IconeCanal({ respondeu, visualizou, simbolo }) {
  if (respondeu) return <span className="canal canal-resp" title="Respondeu">{simbolo}</span>
  if (visualizou) {
    return <span className="canal canal-vis" title="Visualizou, nao respondeu">{simbolo}</span>
  }
  return <span className="canal canal-nada" title="Sem sinal">{simbolo}</span>
}
