import { useMemo } from 'react'
import { categoryColorVar } from './categories'
import {
  currentAndPreviousMonthKeys,
  generateTips,
  monthlyTotals,
  totalsByCategory,
  totalsByStore,
  type ItemRow,
  type MonthTotal,
  type ReceiptRow,
} from './analytics'

interface Props {
  receipts: ReceiptRow[]
  items: ItemRow[]
}

const TIP_ICON = { positive: '✅', negative: '⚠️', neutral: 'ℹ️' } as const

export default function AnalyticsView({ receipts, items }: Props) {
  const monthly = useMemo(() => monthlyTotals(items, receipts), [items, receipts])
  const categories = useMemo(() => totalsByCategory(items, receipts), [items, receipts])
  const stores = useMemo(() => totalsByStore(items, receipts).slice(0, 5), [items, receipts])
  const tips = useMemo(() => generateTips(items, receipts), [items, receipts])

  const { current, previous } = currentAndPreviousMonthKeys()
  const currentTotal = monthly.find((m) => m.monthKey === current)?.total ?? 0
  const previousTotal = monthly.find((m) => m.monthKey === previous)?.total ?? 0
  const maxCategoryTotal = Math.max(1, ...categories.map((c) => c.total))

  if (receipts.length === 0) {
    return <p className="empty">Noch keine Daten – scanne zuerst ein paar Kassenzettel.</p>
  }

  return (
    <div className="analytics">
      <div className="stats">
        <div className="stat">
          <span className="big">{currentTotal.toFixed(2)} €</span>
          <small>Diesen Monat</small>
        </div>
        <div className="stat">
          <span className="big">{previousTotal.toFixed(2)} €</span>
          <small>Letzten Monat</small>
        </div>
        <div className="stat">
          <span className="big">{receipts.length}</span>
          <small>Kassenzettel</small>
        </div>
      </div>

      <ul className="tips">
        {tips.map((tip, i) => (
          <li key={i} className={tip.kind}>
            <span className="tip-icon">{TIP_ICON[tip.kind]}</span>
            <span>{tip.text}</span>
          </li>
        ))}
      </ul>

      <MonthlyChart data={monthly} />

      {categories.length > 0 && (
        <div className="chart chart-categories">
          <h3>Ausgaben nach Kategorie</h3>
          <ul className="cat-bars">
            {categories.map((c) => (
              <li key={c.category}>
                <span className="cat-label">
                  {c.emoji} {c.label}
                </span>
                <span className="cat-track">
                  <span
                    className="cat-fill"
                    style={{ width: `${Math.max((c.total / maxCategoryTotal) * 100, 4)}%`, background: categoryColorVar(c.category) }}
                  />
                </span>
                <span className="cat-value">{c.total.toFixed(2)} €</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stores.length > 0 && (
        <div className="chart chart-stores">
          <h3>Top-Supermärkte</h3>
          <ul className="stores">
            {stores.map((s) => (
              <li key={s.store}>
                <span>🏪 {s.store}</span>
                <span>{s.total.toFixed(2)} €</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Rundet nur die obere Kante eines Balkens ab (quadratisch an der Grundlinie), siehe dataviz-Skill. */
function roundedTopRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, Math.max(h, 0))
  if (h <= 0) return `M${x},${y} L${x + w},${y} Z`
  return `M${x},${y + h} L${x},${y + radius} Q${x},${y} ${x + radius},${y} L${x + w - radius},${y} Q${x + w},${y} ${x + w},${y + radius} L${x + w},${y + h} Z`
}

function monthShortLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

function MonthlyChart({ data }: { data: MonthTotal[] }) {
  if (data.length === 0) return null
  const w = 320
  const h = 140
  const padTop = 20
  const padBottom = 22
  const barGap = 8
  const barWidth = Math.min(24, (w - barGap * (data.length - 1)) / data.length)
  const innerW = barWidth * data.length + barGap * (data.length - 1)
  const offsetX = (w - innerW) / 2
  const max = Math.max(...data.map((d) => d.total), 1)

  return (
    <figure className="chart chart-months">
      <figcaption>Ausgaben pro Monat</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Monatliche Ausgaben">
        <line x1={0} y1={h - padBottom} x2={w} y2={h - padBottom} className="baseline" />
        {data.map((d, i) => {
          const barH = ((h - padTop - padBottom) * d.total) / max
          const x = offsetX + i * (barWidth + barGap)
          const y = h - padBottom - barH
          return (
            <g key={d.monthKey}>
              <path d={roundedTopRectPath(x, y, barWidth, barH, 4)} className="bar" />
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="value">
                {d.total.toFixed(0)}€
              </text>
              <text x={x + barWidth / 2} y={h - 6} textAnchor="middle" className="axis-label">
                {monthShortLabel(d.monthKey)}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
