import { useCallback, useEffect, useState } from 'react'
import { buscar } from './api'

/**
 * Carrega um endpoint da API e reexecuta quando `chave` muda.
 * `chave` costuma ser a querystring ja montada, para nao recarregar a cada
 * render por causa de um objeto de filtros recriado.
 */
export function useDados(caminho, filtros, chave) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [gatilho, setGatilho] = useState(0)

  const recarregar = useCallback(() => setGatilho((n) => n + 1), [])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    setErro(null)
    buscar(caminho, filtros)
      .then((d) => { if (vivo) { setDados(d); setCarregando(false) } })
      .catch((e) => { if (vivo) { setErro(e); setCarregando(false) } })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminho, chave, gatilho])

  return { dados, erro, carregando, recarregar, setDados }
}
