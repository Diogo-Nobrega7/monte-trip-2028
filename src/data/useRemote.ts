import { useCallback, useEffect, useState } from 'react'

/** Carrega dados do banco com estado de carregamento/erro e permite recarregar após gravar. */
export function useRemote<T>(load: () => Promise<T>, enabled: boolean, initial: T) {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    let alive = true
    setLoading(true)
    load().then(
      (d) => { if (alive) { setData(d); setError(null) } },
      (e: Error) => { if (alive) setError(e.message) },
    ).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // `load` é sempre uma função estável do repositório
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload }
}

export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const newKey = () => crypto.randomUUID()

/** 2027-03-10 → 10/03/2027 */
export const dateBR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
