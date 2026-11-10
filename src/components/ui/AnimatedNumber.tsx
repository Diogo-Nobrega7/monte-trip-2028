import { useEffect, useRef, useState } from 'react'

/** Interpola até o novo valor (≈450 ms). Respeita redução de movimento. O valor final é sempre exato. */
export function AnimatedNumber({ value, format }: { value: number; format: (v: number) => string }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || from.current === value) { setShown(value); from.current = value; return }
    const start = performance.now(), a = from.current, d = 450
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / d), e = 1 - Math.pow(1 - k, 3)
      setShown(k === 1 ? value : a + (value - a) * e)
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = value }
  }, [value])
  return <span className="num">{format(Math.round(shown))}</span>
}
