import type { ReactNode } from 'react'
import { cx } from './cx'

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'gold' | 'accent'
const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-muted ring-line',
  ok: 'bg-ok/10 text-ok ring-ok/20',
  warn: 'bg-warn/10 text-warn ring-warn/20',
  bad: 'bg-bad/10 text-bad ring-bad/20',
  gold: 'bg-gold/15 text-ink ring-gold/30',
  accent: 'bg-accent/10 text-accent ring-accent/20',
}

export function Badge({ tone = 'neutral', dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-xs font-medium whitespace-nowrap ring-1 ring-inset', tones[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}
