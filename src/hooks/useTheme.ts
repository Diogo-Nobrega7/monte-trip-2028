import { useEffect, useRef, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'mt28-theme' // só preferência visual; nenhum dado do sistema fica no navegador

function load(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch { return 'system' }
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(load)
  const first = useRef(true)
  useEffect(() => {
    const root = document.documentElement
    if (!first.current) {
      root.classList.add('theme-switching')
      window.setTimeout(() => root.classList.remove('theme-switching'), 350)
    }
    first.current = false
    if (pref === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', pref)
    try { pref === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, pref) } catch { /* sem storage */ }
  }, [pref])
  return { pref, setPref }
}
