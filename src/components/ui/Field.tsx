import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from './cx'

const control = 'w-full h-10 rounded-md bg-surface ring-1 ring-line px-3 text-sm text-ink placeholder:text-faint transition-shadow outline-none hover:ring-faint/50 focus:ring-2 focus:ring-accent'

export function Field({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink mb-1.5">{label}</label>
      {children(id)}
      {error ? <p role="alert" className="text-xs text-bad mt-1.5">{error}</p> : hint && <p className="text-xs text-faint mt-1.5">{hint}</p>}
    </div>
  )
}

export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} className={cx('w-full rounded-md bg-surface ring-1 ring-line px-3 py-2 text-sm text-ink placeholder:text-faint outline-none transition-shadow hover:ring-faint/50 focus:ring-2 focus:ring-accent', className)} {...p} />
}

/** Caixa de marcar com texto ao lado (o texto é o rótulo). */
export function Check({ label, hint, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input type="checkbox" className="mt-0.5 size-4 rounded-sm accent-[rgb(var(--accent))] cursor-pointer" {...p} />
      <span className="text-sm text-ink">{label}{hint && <span className="block text-xs text-faint mt-0.5">{hint}</span>}</span>
    </label>
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
