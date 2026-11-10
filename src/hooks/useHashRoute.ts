import { useCallback, useEffect, useState } from 'react'
import { isRouteId, type RouteId } from '@/app/routes'

const read = (): RouteId => {
  const h = window.location.hash.replace(/^#/, '')
  return isRouteId(h) ? h : 'painel'
}

export function useHashRoute() {
  const [route, setRoute] = useState<RouteId>(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((id: RouteId) => {
    if (window.location.hash !== `#${id}`) window.location.hash = id
    else setRoute(id)
  }, [])
  return { route, go }
}
