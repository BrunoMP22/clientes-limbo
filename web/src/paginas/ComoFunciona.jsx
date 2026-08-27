import { Link } from 'react-router-dom'
import { useDados } from '../useDados'
import { Card, Carregando, ErroCarga, PillClasse, TituloBloco } from '../componentes/Basicos'
import { inteiro } from '../formato'

// Conteudo fiel a regras.py. Se uma regra mudar la, muda aqui tambem — esta
// tela e o que a diretoria le para entender o sistema.

const STATUS = [
  { nome: 'ATIVO', criterio: 'Comprou de 2025 para cá', desc: 'Cliente vivo. Não entra na régua.' },
  { nome: 'LIMBO', criterio: 'Última compra entre 2019 e 2024', foco: true,
    desc: 'Parou de comprar, mas ainda é recuperável. É o alvo do sistema.' },
  { nome: 'MORTO', criterio: 'Parou antes de 2019', desc: 'Fora do esforço de reativação.' },
]

const CLASSES = [
  { letra: 'C', titulo: 'Ainda não deu sinal',
    desc: 'Recebeu contato e não abriu nada. Pode ser desinteresse ou cadastro desatualizado — ainda não dá para saber.',
    acao: 'Continua na régua até dar algum sinal.' },
  { letra: 'B', titulo: 'Abre, mas não responde',
    desc: 'Visualiza o e-mail ou o WhatsApp. O contato é válido e a pessoa certa está do outro lado — falta motivo para responder.',
    acao: 'Recebe oferta com prazo, não só lembrete.' },
  { letra: 'A', titulo: 'Abre e responde',
    desc: 'Canal aberto e interesse demonstrado. É o único grupo que vale o custo de uma visita.',
    acao: 'Atendido no mesmo dia e entregue ao vendedor de campo.' },
]

const EVENTOS = [
  { grupo: 'Sobem o cliente para B', cor: 'var(--classe-b)', itens: [
    ['✉', 'E-mail aberto'], ['💬', 'WhatsApp visualizado'],
  ] },
  { grupo: 'Sobem o cliente para A', cor: 'var(--classe-a)', itens: [
    ['🔗', 'Clique no link'], ['✉', 'E-mail respondido'], ['💬', 'WhatsApp respondido'],
    ['📋', 'Pediu orçamento'], ['🤝', 'Aceitou visita'],
  ] },
  { grupo: 'Não mexem na classe', cor: 'var(--texto3)', itens: [
    ['✉', 'E-mail enviado'], ['💬', 'WhatsApp enviado'], ['📞', 'Tentativa sem retorno'],
  ] },
  { grupo: 'Mudam a situação do cadastro', cor: 'var(--azul-sec)', itens: [
    ['🧾', 'Nota fiscal · volta a ser ATIVO'],
    ['🚫', 'Opt-out · sai da régua para sempre'],
    ['⚠', 'E-mail devolvido · marca o endereço como inválido'],
  ] },
]

const INVIOLAVEIS = [
  { icone: '🔒', titulo: 'Só evento registrado muda a classe',
    desc: 'Nada sobe por opinião ou achismo. Toda mudança tem um evento com data, canal e origem na linha do tempo do cliente.' },
  { icone: '↗', titulo: 'A classe só sobe, nunca desce',
    desc: 'Quem já respondeu uma vez provou que o canal funciona. Isso não se perde porque ficou um tempo quieto.' },
  { icone: '⏸', titulo: '3 tentativas sem sinal = 90 dias de quarentena',
    desc: 'Insistir em quem não responde queima o contato. O cliente sai da fila e volta depois.' },
  { icone: '🚫', titulo: 'Opt-out é definitivo',
    desc: 'Pediu para não receber, sai da régua para sempre. Sem exceção e sem reentrada.' },
  { icone: '⚡', titulo: 'Quem responde é atendido no mesmo dia',
    desc: 'Resposta tem validade curta. A tela Contatos do dia fixa esses clientes no topo por 48 horas.' },
  { icone: '🎯', titulo: 'Classe C nunca vai para o campo',
    desc: 'Visita custa caro. Só vai para a rua quem já demonstrou interesse — ou seja, classe A.' },
]

const SEMAFORO = [
  ['VERDE', 'var(--classe-a)', 'Tem pelo menos 1 cliente ativo'],
  ['AMARELA', 'var(--classe-b)', 'Só clientes limbo'],
  ['VERMELHA', 'var(--alerta)', 'Só clientes mortos'],
  ['BRANCA', 'var(--branca)', 'Nenhum cliente — território virgem'],
]

function Secao({ titulo, chamada, children }) {
  return (
    <section className="mb-8">
      <TituloBloco>{titulo}</TituloBloco>
      {chamada && (
        <p className="text-[.88rem] mt-1 mb-4 max-w-3xl" style={{ color: 'var(--texto2)' }}>
          {chamada}
        </p>
      )}
      {children}
    </section>
  )
}

export default function ComoFunciona() {
  const { dados, erro, carregando, recarregar } = useDados('/painel', undefined, 'como-funciona')

  if (erro) return <ErroCarga erro={erro} aoTentar={recarregar} />
  if (carregando || !dados) return <Carregando />

  const { kpis, total } = dados
  const funil = dados.dados_graficos.funil
  const responderam = funil.find((e) => e.chave === 'responderam')?.valor ?? 0

  return (
    <>
      {/* ---------------------------------------------------------- abertura */}
      <Card className="p-0 overflow-hidden mb-8">
        <div className="px-6 py-7 md:px-9 md:py-9" style={{ background: 'var(--header-bg)' }}>
          <div className="text-[.7rem] font-bold tracking-[.18em]"
               style={{ color: 'var(--header-sub)' }}>BI · REATIVAÇÃO DE CARTEIRA</div>
          <h1 className="text-[1.7rem] md:text-[2.1rem] font-bold mt-2 leading-tight text-white">
            Cliente parado não é cliente perdido.
          </h1>
          <p className="text-[.95rem] mt-3 max-w-3xl leading-relaxed"
             style={{ color: 'var(--header-sub)' }}>
            Milhares de clientes já compraram na distribuidora e hoje estão parados. Este sistema
            organiza a volta deles: separa quem dá para contatar de quem não dá, conduz a régua
            de e-mail e WhatsApp, e leva ao vendedor de campo <strong className="text-white">só
            quem já demonstrou interesse</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x"
             style={{ borderColor: 'var(--borda)' }}>
          {[
            [inteiro(total), 'clientes na base', 'todas as unidades'],
            [inteiro(kpis.limbo), 'parados há mais de 1 ano', 'o alvo do sistema'],
            [inteiro(responderam), 'já responderam', 'canal aberto, prontos para o campo'],
          ].map(([valor, rotulo, sub]) => (
            <div key={rotulo} className="px-6 py-5" style={{ borderColor: 'var(--borda)' }}>
              <div className="text-3xl font-bold" style={{ color: 'var(--destaque)' }}>{valor}</div>
              <div className="text-[.82rem] font-semibold mt-0.5">{rotulo}</div>
              <div className="text-[.72rem]" style={{ color: 'var(--texto2)' }}>{sub}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ---------------------------------------------------- status por ano */}
      <Secao titulo="Primeiro: o cliente está vivo, parado ou morto?"
             chamada="A separação é só pela data da última compra. Sem interpretação, sem exceção manual.">
        {/* DECISAO: o destaque do LIMBO vem da borda e do selo, nao de esmaecer
            os outros — opacidade derruba o contraste do texto. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {STATUS.map((s) => (
            <Card key={s.nome} className="p-4"
                  style={s.foco ? { borderColor: 'var(--classe-b)', borderWidth: 2 } : undefined}>
              <div className="flex items-center gap-2">
                <span className={`tag tag-${s.nome}`}>{s.nome}</span>
                {s.foco && (
                  <span className="text-[.66rem] font-bold tracking-wider"
                        style={{ color: 'var(--classe-b)' }}>← O FOCO</span>
                )}
              </div>
              <div className="text-[.86rem] font-semibold mt-2">{s.criterio}</div>
              <div className="text-[.78rem] mt-1" style={{ color: 'var(--texto2)' }}>{s.desc}</div>
            </Card>
          ))}
        </div>
        <p className="text-[.76rem] mt-3" style={{ color: 'var(--texto3)' }}>
          O corte é recalculado uma vez por ano, em 1º de janeiro.{' '}
          <strong style={{ color: 'var(--texto2)' }}>Exceção:</strong> cliente limbo que emite
          nota fiscal volta a ATIVO na hora, sem esperar a virada do ano.
        </p>
      </Secao>

      {/* -------------------------------------------------------- as classes */}
      <Secao titulo="Depois: dá para falar com ele?"
             chamada="As classes A, B e C não medem o tamanho do cliente — medem a facilidade de contato. Um cliente grande que nunca abre um e-mail é classe C.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CLASSES.map((c, i) => (
            <Card key={c.letra} className="p-5 flex flex-col"
                  style={{ borderLeft: `5px solid var(--pill-${c.letra.toLowerCase()}-bg)` }}>
              <div className="flex items-center gap-3">
                <PillClasse classe={c.letra} tamanho={38} />
                <div>
                  <div className="text-[.66rem] font-bold tracking-wider"
                       style={{ color: 'var(--texto2)' }}>CLASSE {c.letra}</div>
                  <div className="text-[.95rem] font-bold"
                       style={{ color: 'var(--destaque)' }}>{c.titulo}</div>
                </div>
              </div>
              <p className="text-[.82rem] mt-3 flex-1" style={{ color: 'var(--texto2)' }}>
                {c.desc}
              </p>
              <div className="text-[.78rem] mt-3 pt-3 border-t font-semibold"
                   style={{ borderColor: 'var(--borda)' }}>
                {c.acao}
              </div>
              <div className="text-[.7rem] mt-2" style={{ color: 'var(--texto3)' }}>
                {i === 0 ? 'Todo cliente começa aqui.' : `Sobe de ${CLASSES[i - 1].letra} para ${c.letra}.`}
              </div>
            </Card>
          ))}
        </div>
        <Card className="p-4 mt-3" style={{ background: 'var(--superficie2)' }}>
          <div className="text-[.84rem]">
            <strong style={{ color: 'var(--destaque)' }}>Não existe score, RFV ou percentil.</strong>{' '}
            <span style={{ color: 'var(--texto2)' }}>
              A classificação é só engajamento, e a simplicidade é proposital: qualquer pessoa da
              equipe consegue olhar um cliente e dizer por que ele está na classe em que está.
            </span>
          </div>
        </Card>
      </Secao>

      {/* -------------------------------------------------------- os eventos */}
      <Secao titulo="O que faz um cliente mudar de classe"
             chamada="Cada ação registrada no sistema é um evento com data, canal e origem. É o evento que move o cliente — nunca alguém decidindo por conta.">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {EVENTOS.map((g) => (
            <Card key={g.grupo} className="p-4" style={{ borderTop: `4px solid ${g.cor}` }}>
              <div className="text-[.74rem] font-bold mb-3" style={{ color: g.cor }}>
                {g.grupo}
              </div>
              <ul className="space-y-2">
                {g.itens.map(([icone, texto]) => (
                  <li key={texto} className="text-[.8rem] flex items-start gap-2">
                    <span className="shrink-0">{icone}</span>
                    <span style={{ color: 'var(--texto2)' }}>{texto}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Secao>

      {/* --------------------------------------------------- regras que não se quebra */}
      <Secao titulo="As regras que o sistema não deixa quebrar"
             chamada="Estas seis não dependem de disciplina de ninguém: estão no código.">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {INVIOLAVEIS.map((r) => (
            <Card key={r.titulo} className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0 leading-none mt-0.5">{r.icone}</span>
                <div>
                  <div className="text-[.86rem] font-bold"
                       style={{ color: 'var(--destaque)' }}>{r.titulo}</div>
                  <div className="text-[.78rem] mt-1" style={{ color: 'var(--texto2)' }}>
                    {r.desc}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Secao>

      {/* ------------------------------------------------------ semáforo */}
      <Secao titulo="O semáforo de cidades"
             chamada="Cada município ganha uma cor pela situação da carteira ali. Serve para decidir onde vale mandar um vendedor.">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {SEMAFORO.map(([nome, cor, criterio]) => (
            <Card key={nome} className="p-4"
                  style={{ borderLeft: `6px solid ${cor}`,
                           borderLeftStyle: nome === 'BRANCA' ? 'dashed' : 'solid' }}>
              <div className="text-[.8rem] font-bold" style={{ color: 'var(--destaque)' }}>{nome}</div>
              <div className="text-[.76rem] mt-1" style={{ color: 'var(--texto2)' }}>{criterio}</div>
            </Card>
          ))}
        </div>
        <p className="text-[.76rem] mt-3" style={{ color: 'var(--texto3)' }}>
          A cor branca só existe porque há uma tabela de municípios de referência. Sem ela, uma
          cidade sem nenhum cliente jamais apareceria em relatório algum — e é justamente onde
          não há carteira que mora a prospecção.
        </p>
      </Secao>

      {/* ------------------------------------------------------ por onde começar */}
      <Card className="p-5">
        <TituloBloco className="mb-1">Por onde navegar</TituloBloco>
        <p className="text-[.84rem] mb-4" style={{ color: 'var(--texto2)' }}>
          As quatro telas na ordem em que o trabalho acontece.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['/', 'Painel', 'Os números da carteira. Clique em qualquer gráfico para filtrar tudo.'],
            ['/clientes', 'Clientes', 'A carteira inteira, com busca, filtros rápidos e exportação.'],
            ['/regua', 'Contatos do dia', 'Com quem falar hoje, com a mensagem já pronta para copiar.'],
            ['/cidades', 'Cidades', 'O semáforo territorial e onde a viagem se justifica.'],
          ].map(([para, nome, desc]) => (
            <Link key={para} to={para} className="card p-4 block hover:shadow-md transition-shadow"
                  style={{ background: 'var(--superficie2)' }}>
              <div className="text-[.9rem] font-bold" style={{ color: 'var(--azul-sec)' }}>
                {nome} →
              </div>
              <div className="text-[.76rem] mt-1" style={{ color: 'var(--texto2)' }}>{desc}</div>
            </Link>
          ))}
        </div>
      </Card>
    </>
  )
}
