import { useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDados } from '../useDados'
import { comFiltros } from '../api'
import { comAlfa } from '../tema'
import Grafico, { FONTE } from '../componentes/Grafico'
import {
  Card, Carregando, ErroCarga, Filtro, IconeCanal, PillClasse, TituloBloco, Vazio,
} from '../componentes/Basicos'
import { dataBr, dataHoraBr, inteiro } from '../formato'

// Filtros que o painel entende. `funil` e `sinal` nao tem select: entram por
// clique no grafico e aparecem como chip removivel.
const CAMPOS = ['classe', 'status', 'uf', 'batedor', 'empresa', 'ano', 'funil', 'sinal']

const ROTULO_FUNIL = {
  contatados: 'Contatados', visualizaram: 'Visualizaram',
  responderam: 'Responderam', reativados: 'Reativados',
}
const ROTULO_SINAL = {
  email_enviado: 'E-mail enviado', email_visualizou: 'E-mail visualizado',
  email_respondeu: 'E-mail respondido', whats_enviado: 'WhatsApp enviado',
  whats_visualizou: 'WhatsApp visualizado', whats_respondeu: 'WhatsApp respondido',
}
const ROTULO_CAMPO = {
  classe: 'Classe', status: 'Status', uf: 'UF', batedor: 'Batedor',
  empresa: 'Empresa', ano: 'Ano da últ. compra', funil: 'Etapa', sinal: 'Sinal',
}

// cor de cada etapa do funil: segue a semantica ja usada no resto do sistema
// (ambar = visualizou, verde = respondeu)
const COR_FUNIL = ['--texto3', '--azul-sec', '--classe-b', '--classe-a', '--whats']

const OPACO = 0.22   // opacidade de quem nao esta selecionado

export default function Painel() {
  const [params, setParams] = useSearchParams()
  const navegar = useNavigate()
  const chave = params.toString()

  const filtros = useMemo(() => Object.fromEntries(params), [chave]) // eslint-disable-line react-hooks/exhaustive-deps
  const { dados, erro, carregando, recarregar } = useDados('/painel', filtros, chave)

  function aplicar(mudancas) {
    const novo = new URLSearchParams(params)
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === '' || v === null || v === undefined) novo.delete(k)
      else novo.set(k, v)
    }
    setParams(novo)
  }

  /** Clicar no valor ja filtrado remove o filtro — clicar de novo desliga. */
  function alternar(campo, valor) {
    aplicar({ [campo]: params.get(campo) === String(valor) ? '' : valor })
  }

  // DECISAO: o Chart.js guarda o onClick de quando o grafico foi criado. Sem
  // esta ref, o handler enxergaria os filtros da primeira renderizacao e o
  // "clicar de novo para remover" nunca funcionaria.
  const acao = useRef(null)
  acao.current = { alternar, params }

  const aoPassar = (ev, els) => {
    const alvo = ev?.native?.target
    if (alvo) alvo.style.cursor = els.length ? 'pointer' : 'default'
  }

  const cfgClasses = useCallback((tok) => {
    const c = dados.dados_graficos.classes
    const total = c.a + c.b + c.c
    const letras = ['A', 'B', 'C']
    const ativa = dados.filtros.classe
    const cor = (t, letra) => (!ativa || ativa === letra ? tok(t) : comAlfa(tok(t), OPACO))
    return {
      type: 'doughnut',
      data: {
        labels: ['Classe A', 'Classe B', 'Classe C'],
        datasets: [{
          data: [c.a, c.b, c.c],
          backgroundColor: [cor('--classe-a', 'A'), cor('--classe-b', 'B'), cor('--classe-c', 'C')],
          borderWidth: 2,
          borderColor: tok('--card'),
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { display: false } },
        onHover: aoPassar,
        onClick: (ev, els) => {
          if (els.length) acao.current.alternar('classe', letras[els[0].index])
        },
      },
      plugins: [{
        id: 'centro',
        afterDraw(gr) {
          const { ctx, chartArea } = gr
          if (!chartArea) return
          const x = (chartArea.left + chartArea.right) / 2
          const y = (chartArea.top + chartArea.bottom) / 2
          ctx.save()
          ctx.textAlign = 'center'
          ctx.fillStyle = tok('--destaque')
          ctx.font = `700 28px ${FONTE}`
          ctx.fillText(total, x, y + 4)
          ctx.fillStyle = tok('--texto2')
          ctx.font = `600 11px ${FONTE}`
          ctx.fillText('CLIENTES', x, y + 22)
          ctx.restore()
        },
      }],
    }
  }, [dados]) // eslint-disable-line react-hooks/exhaustive-deps

  const cfgCanais = useCallback((tok) => {
    // 2 canais x 3 etapas = as 6 chaves de `sinal` que o backend entende
    const chaves = [
      ['email_enviado', 'email_visualizou', 'email_respondeu'],
      ['whats_enviado', 'whats_visualizou', 'whats_respondeu'],
    ]
    const ativo = dados.filtros.sinal
    const cores = (linha, t) => chaves[linha].map(
      (k) => (!ativo || ativo === k ? tok(t) : comAlfa(tok(t), OPACO)))
    return {
      type: 'bar',
      data: {
        labels: ['Enviados', 'Visualizados', 'Respondidos'],
        datasets: [
          { label: 'E-mail', data: dados.dados_graficos.canais.email,
            backgroundColor: cores(0, '--azul-inst'), borderRadius: 4 },
          { label: 'WhatsApp', data: dados.dados_graficos.canais.whats,
            backgroundColor: cores(1, '--whats'), borderRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        // "Respondidos" e uma barra baixa perto de "Enviados": exigir o clique
        // dentro dela tornaria a barra pequena praticamente inalcancavel.
        // `nearest` sem intersect pega a barra mais proxima, mantendo a
        // distincao entre e-mail e WhatsApp.
        interaction: { mode: 'nearest', intersect: false, axis: 'x' },
        plugins: { legend: { position: 'bottom',
          labels: { boxWidth: 12, usePointStyle: true, pointStyle: 'circle' } } },
        scales: {
          y: { beginAtZero: true, grid: { color: tok('--grafico-grade') }, ticks: { precision: 0 } },
          x: { grid: { display: false } },
        },
        onHover: aoPassar,
        onClick: (ev, els) => {
          if (els.length) {
            acao.current.alternar('sinal', chaves[els[0].datasetIndex][els[0].index])
          }
        },
      },
    }
  }, [dados]) // eslint-disable-line react-hooks/exhaustive-deps

  const cfgFunil = useCallback((tok) => {
    const etapas = dados.dados_graficos.funil
    const ativo = dados.filtros.funil
    return {
      type: 'bar',
      data: {
        labels: etapas.map((e) => e.rotulo),
        datasets: [{
          data: etapas.map((e) => e.valor),
          backgroundColor: etapas.map((e, i) => {
            const c = tok(COR_FUNIL[i])
            // a carteira e a base do funil, nunca fica esmaecida
            const selecionada = !ativo || ativo === e.chave || e.chave === 'carteira'
            return selecionada ? c : comAlfa(c, OPACO)
          }),
          borderRadius: 4,
          barPercentage: 0.72,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        // "Reativados" e 2% da carteira: a barra vira um filete de poucos
        // pixels. Com `index` o clique vale para a linha inteira, entao a
        // etapa mais importante do funil nao fica inalcancavel.
        interaction: { mode: 'index', intersect: false, axis: 'y' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const base = etapas[0].valor || 1
                const pct = ((ctx.raw / base) * 100).toFixed(1)
                return `${ctx.raw} clientes · ${pct}% da carteira`
              },
            },
          },
        },
        scales: {
          x: { beginAtZero: true, grid: { color: tok('--grafico-grade') },
               ticks: { precision: 0 } },
          y: { grid: { display: false } },
        },
        onHover: aoPassar,
        onClick: (ev, els) => {
          if (!els.length) return
          const etapa = etapas[els[0].index]
          // clicar na carteira nao filtra nada: ela e o total
          if (etapa.chave !== 'carteira') acao.current.alternar('funil', etapa.chave)
        },
      },
    }
  }, [dados]) // eslint-disable-line react-hooks/exhaustive-deps

  if (erro) return <ErroCarga erro={erro} aoTentar={recarregar} />
  if (carregando || !dados) return <Carregando />

  const { kpis, responderam, total } = dados
  const c = dados.dados_graficos.classes
  const totalClasses = c.a + c.b + c.c
  const etapas = dados.dados_graficos.funil
  const carteira = etapas[0].valor || 1
  const ativos = CAMPOS.filter((f) => params.get(f))

  const cartoes = [
    ['CLIENTES LIMBO', kpis.limbo, 'parados há mais de 1 ano', 'kpi-azul', { status: 'LIMBO' }],
    ['CLASSE A', kpis.a, 'responderam o contato', 'kpi-a', { classe: 'A' }],
    ['CLASSE B', kpis.b, 'visualizaram, não responderam', 'kpi-b', { classe: 'B' }],
    ['CLASSE C', kpis.c, 'ainda não engajados', 'kpi-c', { classe: 'C' }],
    ['RESPONDERAM', kpis.responderam, 'por e-mail ou WhatsApp', 'kpi-resp', { funil: 'responderam' }],
    ['REATIVADOS', kpis.reativados, 'voltaram a comprar', 'kpi-reat', { funil: 'reativados' }],
  ]

  const legenda = [
    ['A', c.a, 'responderam'],
    ['B', c.b, 'só visualizaram'],
    ['C', c.c, 'sem sinal'],
  ]

  /** Texto do chip de filtro ativo. */
  function rotuloChip(campo) {
    const v = params.get(campo)
    if (campo === 'funil') return `${ROTULO_CAMPO.funil}: ${ROTULO_FUNIL[v] || v}`
    if (campo === 'sinal') return `${ROTULO_CAMPO.sinal}: ${ROTULO_SINAL[v] || v}`
    return `${ROTULO_CAMPO[campo]}: ${v}`
  }

  return (
    <>
      <Card className="p-3 mb-3 flex flex-wrap items-center gap-2">
        <TituloBloco className="mr-1">Filtros</TituloBloco>
        <Filtro rotulo="Classe" vazio="Classe ▾" valor={params.get('classe')}
                opcoes={['A', 'B', 'C'].map((v) => ({ valor: v, rotulo: `Classe ${v}` }))}
                aoMudar={(v) => aplicar({ classe: v })} />
        <Filtro rotulo="Status" vazio="Status ▾" valor={params.get('status')}
                opcoes={['LIMBO', 'ATIVO', 'MORTO']} aoMudar={(v) => aplicar({ status: v })} />
        <Filtro rotulo="UF" vazio="UF ▾" valor={params.get('uf')} opcoes={dados.ufs}
                aoMudar={(v) => aplicar({ uf: v })} />
        <Filtro rotulo="Batedor" vazio="Batedor ▾" valor={params.get('batedor')}
                opcoes={dados.batedores} aoMudar={(v) => aplicar({ batedor: v })} />
        <Filtro rotulo="Empresa" vazio="Empresa ▾" valor={params.get('empresa')}
                opcoes={dados.empresas} aoMudar={(v) => aplicar({ empresa: v })} />
        <Filtro rotulo="Ano da última compra" vazio="Ano últ. compra ▾" valor={params.get('ano')}
                opcoes={dados.anos} aoMudar={(v) => aplicar({ ano: v })} />
      </Card>

      {/* Sem esta faixa, filtrar por clique mudaria os numeros sem explicar por que. */}
      <div className="flex flex-wrap items-center gap-2 mb-4 min-h-[2rem]">
        {ativos.length > 0 ? (
          <>
            <span className="text-[.7rem] font-bold tracking-wider"
                  style={{ color: 'var(--texto2)' }}>FILTRANDO POR</span>
            {ativos.map((campo) => (
              <button key={campo} type="button" className="btn"
                      title="Remover este filtro"
                      onClick={() => aplicar({ [campo]: '' })}>
                {rotuloChip(campo)} <span style={{ color: 'var(--texto3)' }}>✕</span>
              </button>
            ))}
            <Link to="/" className="btn">Limpar tudo</Link>
            <Link to={comFiltros('/clientes', filtros)} className="btn btn-azul ml-auto">
              ver os {inteiro(total)} clientes →
            </Link>
          </>
        ) : (
          <span className="text-[.72rem]" style={{ color: 'var(--texto3)' }}>
            Clique numa fatia, barra ou indicador para filtrar o painel inteiro.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {cartoes.map(([rotulo, valor, sub, cor, filtro]) => {
          const campo = Object.keys(filtro)[0]
          const ativo = params.get(campo) === filtro[campo]
          return (
            <button key={rotulo} type="button"
                    onClick={() => alternar(campo, filtro[campo])}
                    title={ativo ? 'Clique para remover o filtro' : 'Clique para filtrar'}
                    className={`card kpi ${cor} p-4 text-left transition-shadow hover:shadow-md`}
                    style={ativo ? { outline: '2px solid var(--azul-sec)', outlineOffset: '1px' }
                                 : undefined}>
              <div className="text-[.66rem] font-bold tracking-wider"
                   style={{ color: 'var(--texto2)' }}>{rotulo}</div>
              <div className="text-3xl font-bold mt-1"
                   style={{ color: 'var(--destaque)' }}>{valor}</div>
              <div className="text-[.7rem] mt-1" style={{ color: 'var(--texto2)' }}>{sub}</div>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <Card className="p-4">
          <TituloBloco className="mb-3">Distribuição por classe</TituloBloco>
          <Grafico config={cfgClasses} altura={200} rotulo="Distribuição por classe" />
          <div className="mt-3 space-y-1.5">
            {legenda.map(([letra, qtd, txt]) => {
              const ativo = params.get('classe') === letra
              return (
                <button key={letra} type="button" onClick={() => alternar('classe', letra)}
                        className="flex items-center justify-between text-[.78rem] w-full rounded px-1 py-0.5"
                        style={{ background: ativo ? 'var(--superficie3)' : 'transparent' }}>
                  <span className="flex items-center gap-2">
                    <PillClasse classe={letra} tamanho={20} />
                    <span style={{ color: 'var(--texto2)' }}>{txt}</span>
                  </span>
                  <span className="font-semibold">
                    {qtd}{' '}
                    <span style={{ color: 'var(--texto3)' }}>
                      ({totalClasses ? ((qtd / totalClasses) * 100).toFixed(1) : '0.0'}%)
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="p-4">
          <TituloBloco className="mb-3">Engajamento por canal</TituloBloco>
          <Grafico config={cfgCanais} altura={250} rotulo="Engajamento por canal" />
          <div className="text-[.7rem] mt-2" style={{ color: 'var(--texto2)' }}>
            Compara e-mail e WhatsApp em enviados, visualizados e respondidos.
          </div>
        </Card>

        <Card className="p-4">
          <TituloBloco className="mb-3">Funil de reativação</TituloBloco>
          <Grafico config={cfgFunil} altura={250} rotulo="Funil de reativação" />
          <div className="text-[.7rem] mt-2 flex flex-wrap gap-x-4 gap-y-1"
               style={{ color: 'var(--texto2)' }}>
            <span>
              Taxa de resposta{' '}
              <span className="font-bold text-classea">
                {((etapas[3].valor / carteira) * 100).toFixed(1)}%
              </span>
            </span>
            <span>
              Reativação{' '}
              <span className="font-bold text-classea">
                {((etapas[4].valor / carteira) * 100).toFixed(1)}%
              </span>
            </span>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b flex items-center justify-between"
             style={{ borderColor: 'var(--borda)' }}>
          <div>
            <TituloBloco>Clientes que responderam</TituloBloco>
            <div className="text-[.72rem] mt-1" style={{ color: 'var(--texto2)' }}>
              Quem responde deve ser atendido no mesmo dia.
            </div>
          </div>
          <Link to={comFiltros('/clientes', { ...filtros, funil: 'responderam' })} className="btn">
            Ver todos
          </Link>
        </div>

        {responderam.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="grade">
              <thead>
                <tr>
                  <th>Cód.</th><th>Cliente</th><th>Cidade/UF</th><th>Classe</th>
                  <th>E-mail</th><th>WhatsApp</th><th>Respondeu em</th>
                  <th>Últ. compra</th><th>Batedor</th>
                </tr>
              </thead>
              <tbody>
                {responderam.map((cl) => (
                  <tr key={cl.id_cliente} onClick={() => navegar(`/cliente/${cl.id_cliente}`)}>
                    <td className="font-mono text-[.75rem]" style={{ color: 'var(--texto2)' }}>
                      {cl.empresa}-{cl.cod_cliente}
                    </td>
                    <td className="font-semibold">{cl.razao_social}</td>
                    <td>{cl.cidade}/{cl.uf}</td>
                    <td><PillClasse classe={cl.classe} /></td>
                    <td><IconeCanal respondeu={cl.respondeu_email}
                                    visualizou={cl.qtd_emails_abertos} simbolo="✉" /></td>
                    <td><IconeCanal respondeu={cl.respondeu_whatsapp}
                                    visualizou={cl.qtd_whats_visualizados} simbolo="💬" /></td>
                    <td>{dataHoraBr(cl.dt_ultima_resposta)}</td>
                    <td>{dataBr(cl.dt_ultima_compra)}</td>
                    <td>{cl.batedor || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vazio>
            Nenhum cliente respondeu dentro dos filtros atuais.<br />
            Tente limpar os filtros ou selecionar a classe A.
          </Vazio>
        )}
      </Card>
    </>
  )
}
