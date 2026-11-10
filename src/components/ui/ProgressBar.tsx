import { cx } from './cx'
export function ProgressBar({ value, label, tone = 'accent', className }: { value: number; label: string; tone?: 'accent' | 'gold'; className?: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}
      className={cx('h-2 rounded-full bg-sunken overflow-hidden', className)}>
      <div className={cx('h-full rounded-full transition-[width] duration-700 ease-out', tone === 'gold' ? 'bg-gold' : 'bg-accent')} style={{ width: `${v * 100}%` }} />
    </div>
  )
}
