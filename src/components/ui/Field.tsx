import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from './cx'

const control = 'w-full h-10 rounded-md bg-surface ring-1 ring-line px-3 text-sm text-ink placeholder:text-faint transition-shadow outline-none hover:ring-faint/50 focus:ring-2 focus:ring-accent'

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink mb-1.5">{label}</label>
      {children(id)}
      {hint && <p className="text-xs text-faint mt-1.5">{hint}</p>}
    </div>
  )
}

export function Input({ className, prefix, ...p }: InputHTMLAttributes<HTMLInputElement> & { prefix?: string }) {
  if (!prefix) return <input className={cx(control, className)} {...p} />
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint pointer-events-none">{prefix}</span>
      <input className={cx(control, 'pl-9', className)} {...p} />
    </div>
  )
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cx(control, 'appearance-none pr-9 cursor-pointer', className)} {...p}>{children}</select>
      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" aria-hidden />
    </div>
  )
}
