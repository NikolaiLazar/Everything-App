import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { categoryByKey } from './categories'
import ReceiptForm, { type ReceiptFormPayload, type Row } from './ReceiptForm'
import type { ItemRow, ReceiptRow } from './analytics'

interface Props {
  receipts: ReceiptRow[]
  items: ItemRow[]
  onChanged: () => void
}

function toRows(items: ItemRow[]): Row[] {
  return items.map((it) => ({
    id: it.id,
    name: it.name,
    quantity: it.quantity,
    unitPrice: it.unit_price,
    totalPrice: it.total_price,
    category: it.category,
  }))
}

export default function HistoryView({ receipts, items, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

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

  async function updateReceipt(receiptId: string, payload: ReceiptFormPayload): Promise<string | null> {
    const { error: updateError } = await supabase
      .from('receipts_receipts')
      .update({ store: payload.store, purchased_at: payload.purchasedAt, total: payload.total })
      .eq('id', receiptId)
    if (updateError) return updateError.message

    // Kein Diffing der einzelnen Positionen nötig: einfach komplett ersetzen (wie beim
    // fehlgeschlagenen Insert in ScanView ist das ohne Backend-Transaktion die simpelste
    // robuste Lösung).
    const { error: deleteError } = await supabase.from('receipts_items').delete().eq('receipt_id', receiptId)
    if (deleteError) return deleteError.message

    const { error: insertError } = await supabase.from('receipts_items').insert(
      payload.rows.map((r) => ({
        receipt_id: receiptId,
        name: r.name.trim(),
        category: r.category,
        quantity: r.quantity,
        unit_price: r.unitPrice,
        total_price: r.totalPrice,
      })),
    )
    if (insertError) return insertError.message

    setEditingId(null)
    onChanged()
    return null
  }

  if (receipts.length === 0) {
    return <p className="empty">Noch keine Kassenzettel gescannt.</p>
  }

  return (
    <ul className="receipt-list">
      {receipts.map((r) => {
        const rItems = itemsByReceipt.get(r.id) ?? []
        const date = new Date(r.purchased_at).toLocaleDateString('de-DE')
        const isEditing = editingId === r.id
        return (
          <li key={r.id}>
            <details open={isEditing ? true : undefined}>
              <summary>
                <span>
                  📅 {date} · 🏪 {r.store}
                </span>
                <span className="total">{r.total.toFixed(2)} €</span>
              </summary>

              {isEditing ? (
                <ReceiptForm
                  key={r.id}
                  initialStore={r.store}
                  initialDate={r.purchased_at}
                  initialRows={toRows(rItems)}
                  submitLabel="Änderungen speichern"
                  onCancel={() => setEditingId(null)}
                  onSave={(payload) => updateReceipt(r.id, payload)}
                />
              ) : (
                <>
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
                  <div className="receipt-actions">
                    <button onClick={() => setEditingId(r.id)}>Bearbeiten</button>
                    <button className="remove-receipt" onClick={() => removeReceipt(r.id)}>
                      Kassenzettel löschen
                    </button>
                  </div>
                </>
              )}
            </details>
          </li>
        )
      })}
    </ul>
  )
}
