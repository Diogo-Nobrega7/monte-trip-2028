import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

type Kind = 'success' | 'error'
interface T { id: number; kind: Kind; text: string }
const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {})

/** Avisos curtos de confirmação/erro. Lidos por leitores de tela (aria-live). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([])
  const push = useCallback((text: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s.slice(-2), { id, kind, text }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3200)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      {createPortal(
        <div aria-live="polite" className="fixed z-[70] left-1/2 -translate-x-1/2 bottom-[calc(88px+env(safe-area-inset-bottom,0px))] lg:bottom-6 flex flex-col gap-2 w-[min(92vw,380px)]">
          {items.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 rounded-md bg-ink text-bg shadow-lg animate-[pop-in_.22s_ease-out]">
              {t.kind === 'success' ? <CheckCircle2 size={18} className="text-ok shrink-0" /> : <AlertCircle size={18} className="text-bad shrink-0" />}
              <p className="flex-1 text-sm">{t.text}</p>
              <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} aria-label="Dispensar" className="opacity-60 hover:opacity-100"><X size={16} /></button>
            </div>
          ))}
        </div>, document.body)}
    </Ctx.Provider>
  )
}
export const useToast = () => useContext(Ctx)
