export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          {i.dashed
            ? <span className="w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} aria-hidden />
            : <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden />}
          {i.label}
        </li>
      ))}
    </ul>
  )
}
