import { useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { categoryByKey } from './categories'
import type { ItemRow, ReceiptRow } from './analytics'

interface Props {
  receipts: ReceiptRow[]
  items: ItemRow[]
  onChanged: () => void
}

export default function HistoryView({ receipts, items, onChanged }: Props) {
  const itemsByReceipt = useMemo(() => {
    const map = new Map<string, ItemRow[]>()
    for (const it of items) {
      const list = map.get(it.receipt_id) ?? []
      list.push(it)
      map.set(it.receipt_id, list)
    }
    return map
  }, [items])

  async function removeReceipt(id: string) {
    if (!confirm('Diesen Kassenzettel inkl. aller Positionen löschen?')) return
    const { error } = await supabase.from('receipts_receipts').delete().eq('id', id)
    if (error) return alert(error.message)
    onChanged()
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from('receipts_items').delete().eq('id', id)
    if (error) return alert(error.message)
    onChanged()
  }

  if (receipts.length === 0) {
    return <p className="empty">Noch keine Kassenzettel gescannt.</p>
  }

  return (
    <ul className="receipt-list">
      {receipts.map((r) => {
        const rItems = itemsByReceipt.get(r.id) ?? []
        const date = new Date(r.purchased_at).toLocaleDateString('de-DE')
        return (
          <li key={r.id}>
            <details>
              <summary>
                <span>
                  📅 {date} · 🏪 {r.store}
                </span>
                <span className="total">{r.total.toFixed(2)} €</span>
              </summary>
              <ul className="items">
                {rItems.map((it) => {
                  const cat = categoryByKey(it.category)
                  return (
                    <li key={it.id}>
                      <span className="name">
                        {cat.emoji} {it.name}
                      </span>
                      <span className="qty">
                        {it.quantity} × {(it.unit_price ?? it.total_price).toFixed(2)} €
                      </span>
                      <span className="total">{it.total_price.toFixed(2)} €</span>
                      <button onClick={() => removeItem(it.id)} aria-label="Position löschen">
                        ✕
                      </button>
                    </li>
                  )
                })}
                {rItems.length === 0 && <li className="empty">Keine Positionen.</li>}
              </ul>
              <button className="remove-receipt" onClick={() => removeReceipt(r.id)}>
                Kassenzettel löschen
              </button>
            </details>
          </li>
        )
      })}
    </ul>
  )
}
