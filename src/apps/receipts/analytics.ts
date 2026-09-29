// Reine Analyse-Logik für Kassenzettel: Monats-/Kategorie-/Supermarkt-Summen und automatisch
// generierte Tipps durch Vergleich des aktuellen mit dem vorherigen Kalendermonat. Kein
// React-/Supabase-Import, damit die Logik isoliert nachvollzieh- und testbar bleibt.

import { CATEGORIES } from './categories'

export interface ReceiptRow {
  id: string
  store: string
  purchased_at: string // 'YYYY-MM-DD'
  total: number
}

export interface ItemRow {
  id: string
  receipt_id: string
  name: string
  category: string
  quantity: number
  unit_price: number | null
  total_price: number
}

interface EnrichedItem extends ItemRow {
  monthKey: string // 'YYYY-MM', aus dem Kaufdatum des zugehörigen Kassenzettels
}

function enrich(items: ItemRow[], receipts: ReceiptRow[]): EnrichedItem[] {
  const byReceipt = new Map(receipts.map((r) => [r.id, r]))
  const result: EnrichedItem[] = []
  for (const it of items) {
    const r = byReceipt.get(it.receipt_id)
    if (!r) continue
    result.push({ ...it, monthKey: r.purchased_at.slice(0, 7) })
  }
  return result
}

export interface MonthTotal {
  monthKey: string
  total: number
}

export function monthlyTotals(items: ItemRow[], receipts: ReceiptRow[]): MonthTotal[] {
  const sums = new Map<string, number>()
  for (const it of enrich(items, receipts)) {
    sums.set(it.monthKey, (sums.get(it.monthKey) ?? 0) + it.total_price)
  }
  return [...sums.entries()]
    .map(([monthKey, total]) => ({ monthKey, total: round2(total) }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
}

export interface CategoryTotal {
  category: string
  label: string
  emoji: string
  total: number
}

export function totalsByCategory(items: ItemRow[], receipts: ReceiptRow[], monthKey?: string): CategoryTotal[] {
  const enriched = enrich(items, receipts).filter((it) => !monthKey || it.monthKey === monthKey)
  const sums = new Map<string, number>()
  for (const it of enriched) sums.set(it.category, (sums.get(it.category) ?? 0) + it.total_price)
  return CATEGORIES.map((c) => ({ category: c.key, label: c.label, emoji: c.emoji, total: round2(sums.get(c.key) ?? 0) })).filter(
    (c) => c.total > 0,
  )
}

export interface StoreTotal {
  store: string
  total: number
}

export function totalsByStore(items: ItemRow[], receipts: ReceiptRow[]): StoreTotal[] {
  const byReceipt = new Map(receipts.map((r) => [r.id, r]))
  const sums = new Map<string, number>()
  for (const it of items) {
    const r = byReceipt.get(it.receipt_id)
    if (!r) continue
    sums.set(r.store, (sums.get(r.store) ?? 0) + it.total_price)
  }
  return [...sums.entries()].map(([store, total]) => ({ store, total: round2(total) })).sort((a, b) => b.total - a.total)
}

const MONTH_NAMES_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

export function monthLabel(monthKey: string): string {
  return MONTH_NAMES_DE[Number(monthKey.slice(5, 7)) - 1] ?? monthKey
}

/** Liefert die Monats-Keys ('YYYY-MM') des aktuellen und des vorherigen Kalendermonats. */
export function currentAndPreviousMonthKeys(now = new Date()): { current: string; previous: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const current = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previous = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`
  return { current, previous }
}

export interface Tip {
  text: string
  kind: 'positive' | 'negative' | 'neutral'
}

const normalizeName = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')

interface NameGroup {
  quantity: number
  totalPrice: number
  displayName: string
}

function groupByName(items: EnrichedItem[]): Map<string, NameGroup> {
  const map = new Map<string, NameGroup>()
  for (const it of items) {
    const key = normalizeName(it.name)
    const g = map.get(key) ?? { quantity: 0, totalPrice: 0, displayName: it.name }
    g.quantity += it.quantity
    g.totalPrice += it.total_price
    map.set(key, g)
  }
  return map
}

/**
 * Vergleicht den aktuellen mit dem vorherigen Kalendermonat und erzeugt deutsche Tipps
 * (Gesamtausgaben, pro Kategorie, pro Artikel). Der Artikel-Namensvergleich ist bewusst
 * simpel gehalten (nur exakter Match nach Normalisierung, kein Fuzzy-Matching): OCR-Namen
 * variieren leicht zwischen Kassenzetteln (Abkürzungen, Tippfehler) – das ist ein bewusster
 * Scope-Cut für v1. Die robustere Kategorie-Ebene liefert trotzdem verlässliche Trends.
 */
export function generateTips(items: ItemRow[], receipts: ReceiptRow[], now = new Date()): Tip[] {
  const enriched = enrich(items, receipts)
  const { current, previous } = currentAndPreviousMonthKeys(now)
  const currentItems = enriched.filter((it) => it.monthKey === current)
  const previousItems = enriched.filter((it) => it.monthKey === previous)

  if (previousItems.length === 0) {
    return [
      {
        text: 'Noch nicht genug Daten für einen Monatsvergleich – scanne weiter fleißig deine Kassenzettel! 🧾',
        kind: 'neutral',
      },
    ]
  }
  if (currentItems.length === 0) {
    return [{ text: 'Diesen Monat hast du noch keinen Kassenzettel erfasst.', kind: 'neutral' }]
  }

  const tips: Tip[] = []
  const prevLabel = monthLabel(previous)

  const curTotal = sum(currentItems.map((i) => i.total_price))
  const prevTotal = sum(previousItems.map((i) => i.total_price))
  const totalDiff = round2(curTotal - prevTotal)
  if (Math.abs(totalDiff) >= 1) {
    tips.push(
      totalDiff < 0
        ? {
            text: `Du hast diesen Monat insgesamt ${Math.abs(totalDiff).toFixed(2)}€ weniger ausgegeben als im ${prevLabel}. Weiter so! 😀`,
            kind: 'positive',
          }
        : {
            text: `Du hast diesen Monat insgesamt ${totalDiff.toFixed(2)}€ mehr ausgegeben als im ${prevLabel}.`,
            kind: 'negative',
          },
    )
  }

  for (const cat of CATEGORIES) {
    const curCat = sum(currentItems.filter((i) => i.category === cat.key).map((i) => i.total_price))
    const prevCat = sum(previousItems.filter((i) => i.category === cat.key).map((i) => i.total_price))
    if (curCat === 0 && prevCat === 0) continue
    const catDiff = round2(curCat - prevCat)
    if (Math.abs(catDiff) < 2) continue // Rauschen unterhalb von 2€ ignorieren
    tips.push(
      catDiff < 0
        ? {
            text: `Bei "${cat.label}" hast du ${Math.abs(catDiff).toFixed(2)}€ weniger ausgegeben als im ${prevLabel}. ${cat.emoji}`,
            kind: 'positive',
          }
        : {
            text: `Bei "${cat.label}" hast du ${catDiff.toFixed(2)}€ mehr ausgegeben als im ${prevLabel}. ${cat.emoji}`,
            kind: 'negative',
          },
    )
  }

  const curByName = groupByName(currentItems)
  const prevByName = groupByName(previousItems)
  for (const [key, curGroup] of curByName) {
    const prevGroup = prevByName.get(key)
    if (!prevGroup) continue // neuer Artikel ohne Vormonats-Basis: kein sinnvoller Vergleich
    const qtyDiff = round2(curGroup.quantity - prevGroup.quantity)
    if (Math.abs(qtyDiff) < 1) continue
    const avgPrice = curGroup.quantity > 0 ? curGroup.totalPrice / curGroup.quantity : prevGroup.totalPrice / prevGroup.quantity
    const moneyDiff = round2(Math.abs(qtyDiff) * (Number.isFinite(avgPrice) ? avgPrice : 0))
    tips.push(
      qtyDiff < 0
        ? {
            text: `Du hast diesen Monat ${formatCount(Math.abs(qtyDiff))}x "${curGroup.displayName}" weniger gekauft als im ${prevLabel}. Das hat dir ca. ${moneyDiff.toFixed(2)}€ gespart. Glückwunsch! 😀`,
            kind: 'positive',
          }
        : {
            text: `Du hast diesen Monat ${formatCount(qtyDiff)}x "${curGroup.displayName}" mehr gekauft als im ${prevLabel}.`,
            kind: 'negative',
          },
    )
  }

  if (tips.length === 0) {
    tips.push({ text: 'Deine Ausgaben sind diesen Monat stabil geblieben – keine auffälligen Änderungen.', kind: 'neutral' })
  }

  return tips.slice(0, 6) // Liste nicht überladen
}

function formatCount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
