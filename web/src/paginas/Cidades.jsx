import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDados } from '../useDados'
import { Card, Carregando, ErroCarga, Filtro, TituloBloco, Vazio } from '../componentes/Basicos'
import { dataBr, moeda } from '../formato'

const CORES = [
  ['VERDE', 'Cidade com pelo menos 1 cliente ativo'],
  ['AMARELA', 'Só clientes limbo (2019–2024)'],
  ['VERMELHA', 'Só clientes mortos (antes de 2019)'],
  ['BRANCA', 'Nenhum cliente — território virgem'],
]

// mesma cor da borda do semaforo, agora lida do token do tema
const COR_TOKEN = {
  VERDE: 'var(--classe-a)',
  AMARELA: 'var(--classe-b)',
  VERMELHA: 'var(--alerta)',
  BRANCA: 'var(--branca)',
}

function CartaoCidade({ c }) {
  return (
    <Card className={`semaforo-${c.cor_semaforo} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-[.92rem]" style={{ color: 'var(--destaque)' }}>
            {c.cidade}
          </div>
          <div className="text-[.72rem]" style={{ color: 'var(--texto2)' }}>
            {c.uf} · IBGE {c.cod_ibge}
          </div>
        </div>
        {c.qtd_classe_a >= 5 && <span className="tag tag-ATIVO">VIAGEM JUSTIFICADA</span>}
      </div>

      {c.qtd_clientes ? (
        <>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div>
              <div className="text-lg font-bold">{c.qtd_clientes}</div>
              <div className="text-[.62rem]" style={{ color: 'var(--texto2)' }}>CLIENTES</div>
            </div>
            <div>
              <div className="text-lg font-bold text-classea">{c.qtd_classe_a}</div>
              <div className="text-[.62rem]" style={{ color: 'var(--texto2)' }}>CLASSE A</div>
            </div>
            <div>
              <div className="text-lg font-bold text-classeb">{c.qtd_classe_b}</div>
              <div className="text-[.62rem]" style={{ color: 'var(--texto2)' }}>CLASSE B</div>
            </div>
          </div>
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {c.qtd_ativos ? <span className="tag tag-ATIVO">{c.qtd_ativos} ativo(s)</span> : null}
            {c.qtd_limbo ? <span className="tag tag-LIMBO">{c.qtd_limbo} limbo</span> : null}
            {c.qtd_mortos ? <span className="tag tag-MORTO">{c.qtd_mortos} morto(s)</span> : null}
          </div>
          <div className="mt-3 pt-3 border-t text-[.76rem] space-y-1"
               style={{ borderColor: 'var(--borda)' }}>
            <div className="flex justify-between">
              <span style={{ color: 'var(--texto2)' }}>Valor histórico</span>
              <span className="font-semibold">{moeda(c.vlr_historico)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--texto2)' }}>Últ. faturamento</span>
              <span className="font-semibold">{dataBr(c.dt_ultimo_faturamento)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--texto2)' }}>Batedor da região</span>
              <span className="font-semibold">{c.batedor_regiao}</span>
            </div>
          </div>
          <Link to={`/clientes?uf=${c.uf}&q=${encodeURIComponent(c.cidade)}`}
                className="btn w-full justify-center mt-3">Ver clientes</Link>
        </>
      ) : (
        <>
          <div className="text-[.78rem] mt-3" style={{ color: 'var(--texto2)' }}>
            Nenhum cliente cadastrado. Território virgem — candidato a prospecção.
          </div>
          <div className="text-[.76rem] mt-2" style={{ color: 'var(--texto2)' }}>
            Batedor da região: <span className="font-semibold">{c.batedor_regiao}</span>
          </div>
        </>
      )}
    </Card>
  )
}

export default function Cidades() {
  const [params, setParams] = useSearchParams()
  const chave = params.toString()
  const filtros = useMemo(() => Object.fromEntries(params), [chave]) // eslint-disable-line react-hooks/exhaustive-deps
  const { dados, erro, carregando, recarregar } = useDados('/cidades', filtros, chave)

  function mudar(campo, valor) {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(campo, valor)
    else novo.delete(campo)
    setParams(novo)
  }

  if (erro) return <ErroCarga erro={erro} aoTentar={recarregar} />
  if (carregando || !dados) return <Carregando />

  const { coloridas, brancas, resumo, ufs, sem_ibge: semIbge } = dados
  const temFiltro = params.get('cor') || params.get('uf')

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {CORES.map(([cor, desc]) => (
          <Link key={cor} to={`/cidades?cor=${cor}${params.get('uf') ? `&uf=${params.get('uf')}` : ''}`}
                className="card p-4 block"
                style={{ borderLeft: `6px solid ${COR_TOKEN[cor]}` }}>
            <div className="text-[.66rem] font-bold tracking-wider"
                 style={{ color: 'var(--texto2)' }}>{cor}</div>
            <div className="text-2xl font-bold mt-1"
                 style={{ color: 'var(--destaque)' }}>{resumo[cor] || 0}</div>
            <div className="text-[.68rem] mt-1" style={{ color: 'var(--texto2)' }}>{desc}</div>
          </Link>
        ))}
      </div>

      <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
        <TituloBloco className="mr-1">Filtros</TituloBloco>
        <Filtro rotulo="Cor" vazio="Cor ▾" valor={params.get('cor')}
                opcoes={CORES.map(([c]) => c)} aoMudar={(v) => mudar('cor', v)} />
        <Filtro rotulo="UF" vazio="UF ▾" valor={params.get('uf')} opcoes={ufs}
                aoMudar={(v) => mudar('uf', v)} />
        {temFiltro && <Link to="/cidades" className="btn">Limpar filtros</Link>}
        {semIbge > 0 && (
          <span className="ml-auto text-[.72rem]" style={{ color: 'var(--texto2)' }}>
            {semIbge} cliente(s) sem código IBGE não entram no semáforo.
          </span>
        )}
      </Card>

      {coloridas.length > 0 ? (
        <>
          <TituloBloco className="mb-3">Cidades com carteira · {coloridas.length}</TituloBloco>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {coloridas.map((c) => <CartaoCidade key={c.cod_ibge} c={c} />)}
          </div>
        </>
      ) : brancas.length === 0 && (
        <Card>
          <Vazio>
            Nenhuma cidade atende a esses filtros.<br />
            Tente outra cor ou{' '}
            <Link to="/cidades" className="underline font-semibold">limpe os filtros</Link>.
          </Vazio>
        </Card>
      )}

      {brancas.length > 0 && (
        <>
          <Card className="p-4 mb-3" style={{ background: 'var(--superficie2)' }}>
            <TituloBloco>
              Território virgem — prospecção · {brancas.length} cidade(s)
            </TituloBloco>
            <div className="text-[.76rem] mt-1" style={{ color: 'var(--texto2)' }}>
              Cidades da tabela de municípios que não têm nenhum cliente cadastrado. Só
              aparecem porque existe uma base de referência de municípios — sem ela, uma
              cidade sem cliente jamais apareceria em relatório algum.
            </div>
          </Card>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {brancas.map((c) => <CartaoCidade key={c.cod_ibge} c={c} />)}
          </div>
        </>
      )}
    </>
  )
}
