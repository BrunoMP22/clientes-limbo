import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDados } from '../useDados'
import { comFiltros } from '../api'
import {
  Card, Carregando, ErroCarga, Filtro, PillClasse, Vazio,
} from '../componentes/Basicos'
import { dataBr, moeda } from '../formato'

const RAPIDOS = [
  ['resp_email', 'Respondeu e-mail'],
  ['resp_whats', 'Respondeu WhatsApp'],
  ['so_visualizou', 'Só visualizou'],
  ['sem_sinal', 'Sem nenhum sinal'],
  ['sem_email', 'Sem e-mail cadastrado'],
  ['opt_out', 'Opt-out'],
]

// rotulos dos filtros que chegam por clique num grafico do painel
const ROTULOS_PAINEL = {
  contatados: 'Contatados', visualizaram: 'Visualizaram',
  responderam: 'Responderam', reativados: 'Reativados',
  email_enviado: 'E-mail enviado', email_visualizou: 'E-mail visualizado',
  email_respondeu: 'E-mail respondido', whats_enviado: 'WhatsApp enviado',
  whats_visualizou: 'WhatsApp visualizado', whats_respondeu: 'WhatsApp respondido',
}

const COLUNAS = [
  ['cod', 'Código'], ['razao', 'Razão social'], ['cidade', 'Cidade/UF'], ['classe', 'Classe'],
  [null, 'E-mail'], [null, 'WhatsApp'], ['ultima', 'Últ. compra'], ['valor', 'Valor histórico'],
  ['tentativas', 'Tent.'], ['batedor', 'Batedor'],
]

export default function Clientes() {
  const [params, setParams] = useSearchParams()
  const navegar = useNavigate()
  const chave = params.toString()

  const filtros = useMemo(() => Object.fromEntries(params), [chave]) // eslint-disable-line react-hooks/exhaustive-deps
  const { dados, erro, carregando, recarregar } = useDados('/clientes', filtros, chave)

  // a busca e digitada, entao so vai para a URL ao enviar o formulario
  const [busca, setBusca] = useState(params.get('q') || '')
  useEffect(() => { setBusca(params.get('q') || '') }, [chave]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Mescla mudancas na querystring e sempre volta para a pagina 1. */
  function aplicar(mudancas, manterPagina = false) {
    const novo = new URLSearchParams(params)
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === '' || v === null || v === undefined) novo.delete(k)
      else novo.set(k, v)
    }
    if (!manterPagina) novo.delete('page')
    setParams(novo)
  }

  function ordenar(coluna) {
    const mesma = params.get('sort') === coluna
    aplicar({ sort: coluna, dir: mesma && params.get('dir') !== 'desc' ? 'desc' : 'asc' })
  }

  function setaOrdem(coluna) {
    if (params.get('sort') !== coluna) return ''
    return params.get('dir') === 'desc' ? ' ▼' : ' ▲'
  }

  if (erro) return <ErroCarga erro={erro} aoTentar={recarregar} />
  if (carregando || !dados) return <Carregando />

  const { clientes, total, pagina, paginas } = dados
  const rapidoAtivo = params.get('rapido') || ''

  return (
    <>
      <Card className="p-4 mb-4">
        <form className="flex flex-wrap items-center gap-2 mb-3"
              onSubmit={(e) => { e.preventDefault(); aplicar({ q: busca }) }}>
          <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Buscar por nome, código, e-mail ou telefone"
                 aria-label="Buscar clientes"
                 className="flex-1 min-w-[260px] px-3 py-2 border rounded-lg text-sm"
                 style={{ borderColor: 'var(--borda)' }} />
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
          <Filtro rotulo="Canal preferencial" vazio="Canal pref. ▾" valor={params.get('canal')}
                  opcoes={['EMAIL', 'WHATSAPP']} aoMudar={(v) => aplicar({ canal: v })} />
          <button type="submit" className="btn btn-azul">Filtrar</button>
          <Link to="/clientes" className="btn">Limpar</Link>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t"
             style={{ borderColor: 'var(--borda)' }}>
          <span className="text-[.7rem] font-bold tracking-wider"
                style={{ color: 'var(--texto2)' }}>FILTROS RÁPIDOS</span>
          {RAPIDOS.map(([chaveR, rotulo]) => {
            const ativo = rapidoAtivo === chaveR
            return (
              <button key={chaveR} type="button" className={`btn ${ativo ? 'btn-azul' : ''}`}
                      onClick={() => aplicar({ rapido: ativo ? '' : chaveR })}>
                {rotulo}
              </button>
            )
          })}
        </div>
      </Card>

      {/* funil e sinal chegam do clique num grafico do painel e nao tem select
          aqui: sem o chip, a lista viria filtrada sem dizer por que. */}
      {(params.get('funil') || params.get('sinal')) && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[.7rem] font-bold tracking-wider"
                style={{ color: 'var(--texto2)' }}>VINDO DO PAINEL</span>
          {['funil', 'sinal'].filter((f) => params.get(f)).map((campo) => (
            <button key={campo} type="button" className="btn" title="Remover este filtro"
                    onClick={() => aplicar({ [campo]: '' })}>
              {ROTULOS_PAINEL[params.get(campo)] || params.get(campo)}{' '}
              <span style={{ color: 'var(--texto3)' }}>✕</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="text-sm" style={{ color: 'var(--texto2)' }}>
          <span className="font-bold" style={{ color: 'var(--texto)' }}>{total}</span>{' '}
          cliente(s) encontrado(s)
          {paginas > 1 && ` · página ${pagina} de ${paginas}`}
        </div>
        <a href={comFiltros('/clientes/export', filtros)} className="btn btn-verde">
          ⭳ Exportar CSV
        </a>
      </div>

      <Card className="overflow-hidden">
        {clientes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="grade">
              <thead>
                <tr>
                  {COLUNAS.map(([coluna, rotulo]) => (
                    <th key={rotulo}>
                      {coluna ? (
                        <button type="button" className="hover:underline"
                                onClick={() => ordenar(coluna)}>
                          {rotulo}{setaOrdem(coluna)}
                        </button>
                      ) : rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id_cliente} onClick={() => navegar(`/cliente/${c.id_cliente}`)}>
                    <td className="font-mono text-[.72rem]" style={{ color: 'var(--texto2)' }}>
                      {c.empresa}-{c.cod_cliente}-{c.loja}
                    </td>
                    <td className="font-semibold">
                      {c.razao_social}
                      {c.opt_out ? <span className="tag tag-MORTO ml-1">opt-out</span> : null}
                      <span className={`tag tag-${c.status} ml-1`}>{c.status}</span>
                    </td>
                    <td>{c.cidade}/{c.uf}</td>
                    <td><PillClasse classe={c.classe} /></td>
                    <td className="text-[.75rem]">
                      {c.email ? (
                        <span className={c.email_valido ? '' : 'line-through text-alerta'}>
                          {c.email.split(';')[0]}
                        </span>
                      ) : <span style={{ color: 'var(--texto3)' }}>sem e-mail</span>}
                    </td>
                    <td className="text-[.75rem]">
                      {c.whatsapp_valido ? c.whatsapp
                        : <span className="text-alerta">{c.whatsapp} (inválido)</span>}
                    </td>
                    <td>{dataBr(c.dt_ultima_compra)}</td>
                    <td className="whitespace-nowrap">{moeda(c.vlr_historico)}</td>
                    <td className="text-center">{c.qtd_tentativas}</td>
                    <td>{c.batedor || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vazio>
            Nenhum cliente atende a esses filtros.<br />
            Remova um dos filtros ou use{' '}
            <Link to="/clientes" className="underline font-semibold">Limpar</Link>{' '}
            para ver a carteira inteira.
          </Vazio>
        )}
      </Card>

      {paginas > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {pagina > 1 && (
            <button className="btn" onClick={() => aplicar({ page: pagina - 1 }, true)}>
              ← Anterior
            </button>
          )}
          <span className="text-sm" style={{ color: 'var(--texto2)' }}>{pagina} / {paginas}</span>
          {pagina < paginas && (
            <button className="btn" onClick={() => aplicar({ page: pagina + 1 }, true)}>
              Próxima →
            </button>
          )}
        </div>
      )}
    </>
  )
}
