import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buscar, enviar } from '../api'
import {
  Avisos, BotaoCopiar, Card, Carregando, ErroCarga, PillClasse, TituloBloco, Vazio,
} from '../componentes/Basicos'
import { dataBr, dataHoraBr, moeda } from '../formato'

const VERDES = ['EMAIL_RESPONDIDO', 'WHATSAPP_RESPONDIDO', 'EMAIL_CLICADO',
                'PEDIU_ORCAMENTO', 'ACEITOU_VISITA']

function classeBotao(tipo) {
  if (VERDES.includes(tipo)) return 'btn btn-verde'
  if (tipo === 'NOTA_FISCAL') return 'btn btn-azul'
  if (tipo === 'OPT_OUT') return 'btn btn-alerta'
  return 'btn'
}

/** Avanco no funil do canal: enviado, visualizado, respondido. */
function funil(env, vis, resp) {
  if (resp) return { larg: 100, cor: 'var(--classe-a)', texto: 'respondeu' }
  if (vis) return { larg: 60, cor: 'var(--classe-b)', texto: 'visualizou, não respondeu' }
  if (env) return { larg: 25, cor: 'var(--texto3)', texto: 'sem sinal' }
  return { larg: 3, cor: 'var(--texto3)', texto: 'sem sinal' }
}

function Linha({ rotulo, children, className = '' }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: 'var(--texto2)' }}>{rotulo}</span>
      <span className={`font-semibold ${className}`}>{children}</span>
    </div>
  )
}

export default function ClienteFicha() {
  const { id } = useParams()
  const [estado, setEstado] = useState({ carregando: true, erro: null, dados: null })
  const [avisos, setAvisos] = useState([])
  const [opcoes, setOpcoes] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [batedor, setBatedor] = useState('')
  const [visita, setVisita] = useState({ resultado: 'COMPROU', motivo: '', observacao: '' })

  useEffect(() => {
    let vivo = true
    setEstado({ carregando: true, erro: null, dados: null })
    setAvisos([])
    Promise.all([buscar(`/cliente/${id}`), buscar('/opcoes')])
      .then(([d, o]) => {
        if (!vivo) return
        setEstado({ carregando: false, erro: null, dados: d })
        setOpcoes(o)
        setBatedor(d.cliente.batedor || o.batedores_fixos[0])
      })
      .catch((e) => { if (vivo) setEstado({ carregando: false, erro: e, dados: null }) })
    return () => { vivo = false }
  }, [id])

  /** Aplica a resposta de uma mutacao: avisos + estado novo do cliente. */
  function aplicar(res) {
    setAvisos(res.avisos || [])
    setEstado((e) => ({
      ...e,
      dados: {
        cliente: res.cliente ?? e.dados.cliente,
        eventos: res.eventos ?? e.dados.eventos,
        visitas: res.visitas ?? e.dados.visitas,
      },
    }))
  }

  async function acao(tipo) {
    setSalvando(true)
    try {
      aplicar(await enviar(`/cliente/${id}/acao`, { tipo_evento: tipo }))
    } catch (e) {
      setAvisos([{ categoria: 'erro', texto: e.message }])
    } finally { setSalvando(false) }
  }

  async function salvarBatedor(ev) {
    ev.preventDefault()
    setSalvando(true)
    try {
      aplicar(await enviar(`/cliente/${id}/batedor`, { batedor }))
    } catch (e) {
      setAvisos([{ categoria: 'erro', texto: e.message }])
    } finally { setSalvando(false) }
  }

  async function registrarVisita(ev) {
    ev.preventDefault()
    setSalvando(true)
    try {
      aplicar(await enviar(`/cliente/${id}/visita`, visita))
      setVisita({ resultado: 'COMPROU', motivo: '', observacao: '' })
    } catch (e) {
      setAvisos([{ categoria: 'erro', texto: e.message }])
    } finally { setSalvando(false) }
  }

  if (estado.erro) return <ErroCarga erro={estado.erro} />
  if (estado.carregando || !estado.dados || !opcoes) return <Carregando />

  const { cliente: c, eventos, visitas } = estado.dados
  const link = `${window.location.origin}/r/${c.token_rastreio}`

  const paineis = [
    ['✉ E-MAIL', c.qtd_emails_enviados, c.qtd_emails_abertos, c.qtd_emails_respondidos,
      'Abertos', 'var(--destaque)'],
    ['💬 WHATSAPP', c.qtd_whats_enviados, c.qtd_whats_visualizados, c.qtd_whats_respondidos,
      'Visualizados', 'var(--whats)'],
  ]

  return (
    <>
      <Link to="/clientes" className="text-[.78rem] font-semibold mb-3 inline-block"
            style={{ color: 'var(--azul-sec)' }}>← voltar para a lista</Link>

      <Avisos avisos={avisos} aoFechar={() => setAvisos([])} />

      <Card className="p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <PillClasse classe={c.classe} tamanho={36} />
              <h1 className="text-xl font-bold" style={{ color: 'var(--destaque)' }}>
                {c.razao_social}
              </h1>
              <span className={`tag tag-${c.status}`}>{c.status}</span>
              {c.opt_out ? <span className="tag tag-MORTO">OPT-OUT</span> : null}
              {c.na_fila_batedor ? <span className="tag tag-ATIVO">NA FILA DO BATEDOR</span> : null}
            </div>
            <div className="text-[.8rem] mt-2" style={{ color: 'var(--texto2)' }}>
              Código <span className="font-mono font-semibold">
                {c.empresa}-{c.cod_cliente}-{c.loja}
              </span>
              {' · '}{c.cidade}/{c.uf}
              {c.cod_ibge ? ` · IBGE ${c.cod_ibge}` : <> · <span className="text-alerta">sem código IBGE</span></>}
              {c.dt_mudanca_classe ? ` · classe alterada em ${dataBr(c.dt_mudanca_classe)}` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[.66rem] font-bold tracking-wider"
                 style={{ color: 'var(--texto2)' }}>VALOR HISTÓRICO</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--destaque)' }}>
              {moeda(c.vlr_historico)}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">

          <Card className="p-4" style={{ borderLeft: '5px solid var(--azul-sec)' }}>
            <TituloBloco className="mb-3">Contato</TituloBloco>

            <div className="mb-3">
              <div className="text-[.68rem] font-bold" style={{ color: 'var(--texto2)' }}>E-MAIL</div>
              {c.email ? (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[.82rem] font-semibold ${c.email_valido ? '' : 'line-through'}`}>
                    {c.email}
                  </span>
                  <span className={`tag ${c.email_valido ? 'tag-ATIVO' : 'tag-MORTO'}`}>
                    {c.email_valido ? 'válido' : 'devolvido'}
                  </span>
                  <BotaoCopiar texto={c.email}>copiar</BotaoCopiar>
                </div>
              ) : (
                <div className="text-[.82rem] mt-1" style={{ color: 'var(--texto3)' }}>
                  sem e-mail cadastrado — contatar por WhatsApp
                </div>
              )}
            </div>

            <div className="mb-3">
              <div className="text-[.68rem] font-bold" style={{ color: 'var(--texto2)' }}>WHATSAPP</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[.82rem] font-semibold">{c.whatsapp || '—'}</span>
                {!c.whatsapp_valido && <span className="tag tag-MORTO">inválido</span>}
                {c.whatsapp_e164 && (
                  <>
                    <a className="btn btn-whats" target="_blank" rel="noreferrer"
                       href={`https://wa.me/${c.whatsapp_e164}`}>💬 abrir no WhatsApp</a>
                    <BotaoCopiar texto={c.whatsapp}>copiar</BotaoCopiar>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[.8rem] mb-3">
              <div>
                <div className="text-[.68rem] font-bold" style={{ color: 'var(--texto2)' }}>CONTATO</div>
                <div className="font-semibold">{c.nome_contato || '—'}</div>
              </div>
              <div>
                <div className="text-[.68rem] font-bold" style={{ color: 'var(--texto2)' }}>
                  CANAL PREFERENCIAL
                </div>
                <div className="font-semibold">{c.canal_pref || '—'}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[.68rem] font-bold" style={{ color: 'var(--texto2)' }}>
                  BATEDOR RESPONSÁVEL
                </div>
                <div className="font-semibold">{c.batedor || 'não atribuído'}</div>
              </div>
            </div>

            <div className="pt-3 border-t" style={{ borderColor: 'var(--borda)' }}>
              <div className="text-[.68rem] font-bold" style={{ color: 'var(--texto2)' }}>
                LINK RASTREÁVEL INDIVIDUAL
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <code className="text-[.72rem] px-2 py-1 rounded"
                      style={{ background: 'var(--superficie3)' }}>{link}</code>
                <BotaoCopiar texto={link}>copiar</BotaoCopiar>
                <a className="btn" target="_blank" rel="noreferrer"
                   href={`/r/${c.token_rastreio}`}>abrir</a>
              </div>
              <div className="text-[.68rem] mt-1.5" style={{ color: 'var(--texto3)' }}>
                Um clique nesse link registra EMAIL_CLICADO e promove o cliente para classe A.
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <TituloBloco className="mb-3">Engajamento</TituloBloco>
            <div className="grid grid-cols-2 gap-3">
              {paineis.map(([titulo, env, vis, resp, rotVis, cor]) => {
                const f = funil(env, vis, resp)
                return (
                  <div key={titulo} className="p-3 rounded-lg"
                       style={{ background: 'var(--superficie2)', border: '1px solid var(--borda)' }}>
                    <div className="text-[.72rem] font-bold mb-2" style={{ color: cor }}>{titulo}</div>
                    <div className="space-y-1 text-[.78rem]">
                      <Linha rotulo="Enviados:">{env}</Linha>
                      <Linha rotulo={`${rotVis}:`}>{vis}</Linha>
                      <Linha rotulo="Respondidos:">{resp}</Linha>
                    </div>
                    <div className="barra-fundo mt-2">
                      <div className="barra" style={{ width: `${f.larg}%`, background: f.cor }} />
                    </div>
                    <div className="text-[.66rem] mt-1.5" style={{ color: 'var(--texto3)' }}>
                      {f.texto}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="text-[.72rem] mt-3" style={{ color: 'var(--texto2)' }}>
              Última resposta:{' '}
              <span className="font-semibold">{dataHoraBr(c.dt_ultima_resposta)}</span>
            </div>
          </Card>

          <Card className="p-4">
            <TituloBloco className="mb-3">Histórico comercial</TituloBloco>
            <div className="space-y-2 text-[.82rem]">
              <Linha rotulo="Última compra">{dataBr(c.dt_ultima_compra)}</Linha>
              <Linha rotulo="Anos inativo">{c.anos_inativo}</Linha>
              <Linha rotulo="Valor histórico">{moeda(c.vlr_historico)}</Linha>
              <Linha rotulo="Qtd. notas">{c.qtd_notas}</Linha>
              {c.dt_reativacao && (
                <Linha rotulo="Reativado em" className="text-classea">
                  {dataBr(c.dt_reativacao)}
                </Linha>
              )}
              <div className="pt-2 border-t" style={{ borderColor: 'var(--borda)' }}>
                <div style={{ color: 'var(--texto2)' }}>Linhas que costumava comprar</div>
                <div className="font-semibold mt-1">{c.linhas_compradas || '—'}</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <TituloBloco className="mb-3">Situação na régua</TituloBloco>
            <div className="space-y-2 text-[.82rem]">
              <Linha rotulo="Etapa atual">
                {c.etapa_regua}{c.etapa_regua > 5 ? ' (ciclo encerrado)' : ''}
              </Linha>
              <Linha rotulo="Tentativas sem retorno">{c.qtd_tentativas}/3</Linha>
              <Linha rotulo="Último contato">{dataBr(c.dt_ultimo_contato)}</Linha>
              <Linha rotulo="Próximo contato">{dataBr(c.dt_proximo_contato)}</Linha>
              {c.dt_fim_quarentena && (
                <Linha rotulo="Quarentena até" className="text-classeb">
                  {dataBr(c.dt_fim_quarentena)}
                </Linha>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <TituloBloco className="mb-1">Ações</TituloBloco>
            <div className="text-[.72rem] mb-3" style={{ color: 'var(--texto2)' }}>
              Cada botão grava um evento e recalcula a classe na hora. A classe só sobe, nunca desce.
            </div>
            <div className="flex flex-wrap gap-2">
              {opcoes.acoes_ficha.map((a) => (
                <button key={a.tipo} type="button" className={classeBotao(a.tipo)}
                        disabled={salvando} onClick={() => acao(a.tipo)}>
                  {a.rotulo}
                </button>
              ))}
            </div>
            <form onSubmit={salvarBatedor}
                  className="flex items-center gap-2 mt-4 pt-4 border-t"
                  style={{ borderColor: 'var(--borda)' }}>
              <span className="text-[.78rem] font-semibold" style={{ color: 'var(--texto2)' }}>
                Atribuir batedor:
              </span>
              <select className="filtro-select" value={batedor} aria-label="Batedor"
                      onChange={(e) => setBatedor(e.target.value)}>
                {opcoes.batedores_fixos.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <button className="btn btn-azul" disabled={salvando}>Salvar</button>
            </form>
          </Card>

          <Card className="p-4">
            <TituloBloco className="mb-3">
              Linha do tempo · {eventos.length} evento(s)
            </TituloBloco>
            {eventos.length > 0 ? (
              <ul className="linha-tempo max-h-[420px] overflow-y-auto pr-2">
                {eventos.map((e) => {
                  const info = opcoes.rotulos[e.tipo_evento]
                    || { icone: '•', rotulo: e.tipo_evento, classe: 'text-cinza' }
                  return (
                    <li key={e.id_evento}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className={`${info.classe} font-semibold text-[.84rem]`}>
                            {info.icone} {info.rotulo}
                          </span>
                          <div className="text-[.72rem] mt-1" style={{ color: 'var(--texto3)' }}>
                            {e.canal || '—'} · origem: {e.origem || '—'}
                            {e.detalhe && <><br />{e.detalhe}</>}
                          </div>
                        </div>
                        <div className="text-[.72rem] whitespace-nowrap"
                             style={{ color: 'var(--texto2)' }}>
                          {dataHoraBr(e.dt_evento)}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Vazio>
                Nenhum evento registrado ainda.<br />
                Use os botões de ação acima para começar a régua deste cliente.
              </Vazio>
            )}
          </Card>

          <Card className="p-4">
            <TituloBloco className="mb-3">Visitas do batedor</TituloBloco>
            {visitas.length > 0 ? (
              <table className="grade mb-4">
                <thead>
                  <tr><th>Data</th><th>Batedor</th><th>Resultado</th><th>Motivo</th><th>Observação</th></tr>
                </thead>
                <tbody>
                  {visitas.map((v) => (
                    <tr key={v.id_visita} style={{ cursor: 'default' }}>
                      <td>{dataBr(v.dt_visita)}</td>
                      <td>{v.batedor || '—'}</td>
                      <td>
                        <span className={`tag ${v.resultado === 'COMPROU' ? 'tag-ATIVO'
                          : v.resultado === 'NAO_COMPROU' ? 'tag-MORTO' : 'tag-LIMBO'}`}>
                          {v.resultado}
                        </span>
                      </td>
                      <td>{v.motivo || '—'}</td>
                      <td>{v.observacao || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Vazio>
                Nenhuma visita registrada.<br />
                Use o formulário abaixo para lançar o retorno do batedor.
              </Vazio>
            )}

            <form onSubmit={registrarVisita}
                  className="pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-2 items-end"
                  style={{ borderColor: 'var(--borda)' }}>
              <div>
                <label className="text-[.68rem] font-bold block mb-1"
                       style={{ color: 'var(--texto2)' }} htmlFor="v-resultado">RESULTADO</label>
                <select id="v-resultado" className="filtro-select w-full" value={visita.resultado}
                        onChange={(e) => setVisita({ ...visita, resultado: e.target.value })}>
                  <option value="COMPROU">COMPROU</option>
                  <option value="NAO_COMPROU">NÃO COMPROU</option>
                  <option value="REMARCADO">REMARCADO</option>
                </select>
              </div>
              <div>
                <label className="text-[.68rem] font-bold block mb-1"
                       style={{ color: 'var(--texto2)' }} htmlFor="v-motivo">MOTIVO</label>
                <input id="v-motivo" value={visita.motivo}
                       onChange={(e) => setVisita({ ...visita, motivo: e.target.value })}
                       className="w-full px-3 py-2 border rounded-lg text-sm"
                       style={{ borderColor: 'var(--borda)' }}
                       placeholder="obrigatório se não comprou" />
              </div>
              <div>
                <label className="text-[.68rem] font-bold block mb-1"
                       style={{ color: 'var(--texto2)' }} htmlFor="v-obs">OBSERVAÇÃO</label>
                <input id="v-obs" value={visita.observacao}
                       onChange={(e) => setVisita({ ...visita, observacao: e.target.value })}
                       className="w-full px-3 py-2 border rounded-lg text-sm"
                       style={{ borderColor: 'var(--borda)' }} />
              </div>
              <button className="btn btn-azul justify-center" disabled={salvando}>
                Registrar visita
              </button>
            </form>
            <div className="text-[.68rem] mt-2" style={{ color: 'var(--texto3)' }}>
              Retorno obrigatório em até 5 dias úteis após a visita. Resultado COMPROU reativa o cliente.
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
