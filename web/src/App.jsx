import { Link, Route, Routes } from 'react-router-dom'
import Layout from './componentes/Layout'
import Painel from './paginas/Painel'
import Clientes from './paginas/Clientes'
import ClienteFicha from './paginas/ClienteFicha'
import Regua from './paginas/Regua'
import Cidades from './paginas/Cidades'
import ComoFunciona from './paginas/ComoFunciona'
import { Card, Vazio } from './componentes/Basicos'

function NaoEncontrada() {
  return (
    <Card>
      <Vazio>
        Página não encontrada.<br />
        Volte para o <Link to="/" className="underline font-semibold">painel</Link>.
      </Vazio>
    </Card>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Painel />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="cliente/:id" element={<ClienteFicha />} />
        <Route path="regua" element={<Regua />} />
        <Route path="cidades" element={<Cidades />} />
        <Route path="como-funciona" element={<ComoFunciona />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  )
}
