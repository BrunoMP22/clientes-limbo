import { NavLink, Outlet } from 'react-router-dom'
import { BotaoTema } from './Basicos'
import Assinatura from './Assinatura'

const ABAS = [
  { para: '/', rotulo: 'Painel', fim: true },
  { para: '/clientes', rotulo: 'Clientes' },
  { para: '/regua', rotulo: 'Contatos do dia' },
  { para: '/cidades', rotulo: 'Cidades' },
  { para: '/como-funciona', rotulo: 'Como funciona' },
]

export default function Layout() {
  return (
    <>
      <header className="barra-topo">
        <div className="max-w-[1400px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div>
            <div className="text-[1.05rem] font-bold leading-tight">Gestão de Clientes Limbo</div>
            <div className="text-[.72rem] barra-topo-sub">
              Reativação de carteira · distribuição de peças
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-bold tracking-wide">BRUNO PRIMO · BI</div>
              <div className="text-[.7rem] barra-topo-sub">Belo Horizonte/MG</div>
            </div>
            <BotaoTema />
          </div>
        </div>
      </header>

      <nav className="barra-nav">
        <div className="max-w-[1400px] mx-auto px-6 flex gap-1 overflow-x-auto">
          {ABAS.map((a) => (
            <NavLink key={a.para} to={a.para} end={a.fim}
                     className={({ isActive }) => `menu-item ${isActive ? 'menu-ativo' : ''}`}>
              {a.rotulo}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <Outlet />
      </main>

      <footer className="rodape">
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex flex-wrap items-center
                        justify-between gap-4">
          <div className="text-[.72rem]" style={{ color: 'var(--texto2)' }}>
            Projeto de demonstração · dados fictícios · não conectado ao ERP Protheus.
          </div>
          <Assinatura />
        </div>
      </footer>
    </>
  )
}
