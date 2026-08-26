import marca from '../assets/marca-bruno-primo.png'

/**
 * Marca do desenvolvedor. Aparece no rodape de todas as telas.
 *
 * DECISAO: e um link para o GitHub, nao so uma imagem — assinatura em sistema
 * de demonstracao serve para a pessoa que ve a tela conseguir chegar em quem
 * fez. Sem o link, vira enfeite.
 */
export default function Assinatura({ nome = 'Bruno Primo', url = 'https://github.com/BrunoMP22' }) {
  return (
    <a className="assinatura" href={url} target="_blank" rel="noreferrer"
       title={`Desenvolvido por ${nome} — abrir o GitHub`}>
      <img className="assinatura-marca" src={marca} alt="" width="34" height="34" />
      <span className="assinatura-texto">
        <span className="assinatura-rotulo">Desenvolvido por</span>
        <span className="assinatura-nome">{nome}</span>
      </span>
    </a>
  )
}
