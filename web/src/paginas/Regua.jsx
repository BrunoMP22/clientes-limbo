import { useState } from 'react'
import { Link } from 'react-router-dom'
import { enviar } from '../api'
import { useDados } from '../useDados'
import {
  Avisos, BotaoCopiar, Card, Carregando, ErroCarga, PillClasse, TituloBloco, Vazio,
} from '../componentes/Basicos'
import { dataBr, dataHoraBr, moeda } from '../formato'

const DIA_DA_REGUA = { 0: 0, 1: 3, 2: 10, 3: 20, 4: 30, 5: 45 }
const LIMITE_POR_ETAPA = 40

function CartaoCliente({ c, mensagem, urgente, aoContatar, ocupado }) {
  return (
    <div className="p-3 rounded-lg"
         style={{ background: urgente ? 'var(--card)' : 'var(--superficie2)',
                  border: '1px solid var(--borda)' }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5">
          <PillClasse classe={c.classe} />
          <div>
            <Link to={`/cliente/${c.id_cliente}`}
                  className="font-semibold text-[.86rem] hover:underline"
                  style={{ color: 'var(--destaque)' }}>{c.razao_social}</Link>
            <div className="text-[.72rem]" style={{ color: 'var(--texto2)' }}>
              {c.nome_contato || 'sem contato'} · {c.cidade}/{c.uf} ·{' '}
              {c.whatsapp || 'sem whatsapp'} ·{' '}
              {c.email ? c.email.split(';')[0] : <span className="text-alerta">sem e-mail</span>}
            </div>
            <div className="text-[.7rem] mt-1" style={{ color: 'var(--texto3)' }}>
              Últ. compra {dataBr(c.dt_ultima_compra)} · {moeda(c.vlr_historico)} ·{' '}
              tentativas {c.qtd_tentativas}/3 · batedor {c.batedor || '—'}
              {urgente && (
                <> · <span className="text-classea font-bold">
                  respondeu em {dataHoraBr(c.dt_ultima_resposta)}
                </span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BotaoCopiar texto={mensagem}>Copiar mensagem</BotaoCopiar>
          {c.whatsapp_e164 && c.whatsapp_valido && (
            <a className="btn btn-whats" target="_blank" rel="noreferrer"
               href={`https://wa.me/${c.whatsapp_e164}?text=${encodeURIComponent(mensagem)}`}>
              💬 Abrir WhatsApp
            </a>
          )}
          <button className="btn btn-azul" disabled={ocupado}
                  onClick={() => aoContatar(c.id_cliente)}>
            Marcar como contatado
          </button>
        </div>
      </div>
      <details className="mt-2">
        <summary className="text-[.72rem] cursor-pointer font-semibold"
                 style={{ color: 'var(--azul-sec)' }}>ver mensagem sugerida</summary>
        <pre className="text-[.74rem] mt-2 p-3 rounded whitespace-pre-wrap"
             style={{ background: 'var(--superficie3)', color: 'var(--texto)' }}>{mensagem}</pre>
      </details>
    </div>
  )
}

export default function Regua() {
  const { dados, erro, carregando, recarregar } = useDados('/regua', undefined, 'regua')
  const [avisos, setAvisos] = useState([])
  const [ocupado, setOcupado] = useState(false)

  async function contatar(id) {
    setOcupado(true)
    try {
      const res = await enviar(`/regua/${id}/contatado`)
      setAvisos(res.avisos || [])
      recarregar()   // o cliente sai da fila ou muda de etapa
    } catch (e) {
      setAvisos([{ categoria: 'erro', texto: e.message }])
    } finally { setOcupado(false) }
  }

  if (erro) return <ErroCarga erro={erro} aoTentar={recarregar} />
  if (carregando || !dados) return <Carregando />

  const { urgentes, grupos, mensagens, acao_etapa: acaoEtapa } = dados
  const hoje = new Date().toISOString().slice(0, 10)
  const totalFila = Object.values(grupos).reduce((s, l) => s + l.length, 0)

  return (
    <>
      <Avisos avisos={avisos} aoFechar={() => setAvisos([])} />

      <div className="mb-4">
        <h1 className="text-lg font-bold" style={{ color: 'var(--destaque)' }}>Contatos do dia</h1>
        <div className="text-[.8rem]" style={{ color: 'var(--texto2)' }}>
          Fila operacional de hoje ({dataBr(hoje)}): clientes LIMBO, sem opt-out,
          fora de quarentena e com menos de 3 tentativas.
        </div>
      </div>

      <Card className="mb-5" style={{ border: '2px solid var(--classe-a)' }}>
        <div className="p-4 border-b"
             style={{ borderColor: 'var(--borda)', background: 'var(--ok-fundo)' }}>
          <div className="font-bold text-[.9rem]" style={{ color: 'var(--ok-texto)' }}>
            ⚡ RESPONDERAM — ATENDER HOJE
          </div>
          <div className="text-[.75rem] mt-1" style={{ color: 'var(--ok-texto)' }}>
            Responderam nas últimas 48h. Pela regra do processo, quem responde é
            atendido no mesmo dia.
          </div>
        </div>
        <div className="p-4 space-y-2">
          {urgentes.length > 0 ? urgentes.map((c) => (
            <CartaoCliente key={c.id_cliente} c={c} urgente
                           mensagem={mensagens[c.id_cliente] || ''}
                           aoContatar={contatar} ocupado={ocupado} />
          )) : (
            <Vazio>
              Ninguém respondeu nas últimas 48 horas.<br />
              Trabalhe a fila da régua abaixo para gerar novas respostas.
            </Vazio>
          )}
        </div>
      </Card>

      {totalFila === 0 && (
        <Card>
          <Vazio>
            Nenhum cliente vencido na régua hoje.<br />
            Isso acontece quando todos já foram contatados ou estão em quarentena.
            Volte amanhã ou registre eventos na ficha de um cliente.
          </Vazio>
        </Card>
      )}

      {[0, 1, 2, 3, 4, 5].map((etapa) => {
        const lista = grupos[String(etapa)] || []
        if (lista.length === 0) return null
        const info = acaoEtapa[String(etapa)] || { canal: 'EMAIL', rotulo: '' }
        return (
          <Card key={etapa} className="mb-4">
            <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2"
                 style={{ borderColor: 'var(--borda)' }}>
              <div>
                <TituloBloco>Etapa {etapa} · {info.rotulo}</TituloBloco>
                <div className="text-[.72rem] mt-1" style={{ color: 'var(--texto2)' }}>
                  Canal: <span className="font-semibold">{info.canal}</span> ·{' '}
                  D+{DIA_DA_REGUA[etapa]} da régua
                </div>
              </div>
              <span className="tag tag-neutra">{lista.length} cliente(s)</span>
            </div>
            <div className="p-4 space-y-2 max-h-[520px] overflow-y-auto">
              {lista.slice(0, LIMITE_POR_ETAPA).map((c) => (
                <CartaoCliente key={c.id_cliente} c={c}
                               mensagem={mensagens[c.id_cliente] || ''}
                               aoContatar={contatar} ocupado={ocupado} />
              ))}
              {lista.length > LIMITE_POR_ETAPA && (
                <div className="text-[.75rem] text-center pt-2" style={{ color: 'var(--texto2)' }}>
                  + {lista.length - LIMITE_POR_ETAPA} cliente(s) nesta etapa.
                  Trabalhe estes primeiro.
                </div>
              )}
            </div>
          </Card>
        )
      })}

      <Card className="p-4">
        <TituloBloco className="mb-2">Modelos de mensagem</TituloBloco>
        <div className="text-[.78rem]" style={{ color: 'var(--texto2)' }}>
          A mensagem sugerida de cada cliente é escolhida automaticamente:{' '}
          <span className="font-semibold">classe C</span> recebe o e-mail de primeiro contato,{' '}
          <span className="font-semibold">classe B</span> o WhatsApp de quem já visualizou,{' '}
          <span className="font-semibold">classe A</span> o WhatsApp com condição por linha de
          produto, e quem está <span className="font-semibold">na fila do batedor</span> recebe
          a passagem de bastão. As variáveis {'{nome}'}, {'{razao_social}'}, {'{cidade}'},{' '}
          {'{mes_ano}'}, {'{link}'}, {'{batedor}'} e {'{data_limite}'} já vêm substituídas.
        </div>
      </Card>
    </>
  )
}
