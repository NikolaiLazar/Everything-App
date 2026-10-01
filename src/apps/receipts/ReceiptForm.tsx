import { useState, type FormEvent } from 'react'
import { CATEGORIES } from './categories'

export interface Row {
  id: string
  name: string
  quantity: number
  unitPrice: number | null
  totalPrice: number
  category: string
}

let rowSeq = 0
export const newRowId = () => `row-${++rowSeq}`

export function emptyRow(): Row {
  return { id: newRowId(), name: '', quantity: 1, unitPrice: null, totalPrice: 0, category: CATEGORIES[CATEGORIES.length - 1].key }
}

export interface ReceiptFormPayload {
  store: string
  purchasedAt: string
  rows: Row[]
  total: number
}

interface Props {
  initialStore: string
  initialDate: string
  initialRows: Row[]
  previewUrl?: string | null
  submitLabel: string
  onCancel: () => void
  /** Gibt bei Fehler eine Fehlermeldung zurück, bei Erfolg null. */
  onSave: (payload: ReceiptFormPayload) => Promise<string | null>
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Gemeinsames Formular für Kassenzettel: wird sowohl für die Review-Tabelle nach einem
 * OCR-Scan als auch für die manuelle Neuerfassung und das nachträgliche Bearbeiten eines
 * gespeicherten Kassenzettels verwendet (ScanView bzw. HistoryView). Die Komponente selbst
 * kennt kein Insert/Update – das entscheidet der aufrufende View über onSave.
 */
export default function ReceiptForm({ initialStore, initialDate, initialRows, previewUrl, submitLabel, onCancel, onSave }: Props) {
  const [store, setStore] = useState(initialStore)
  const [purchasedAt, setPurchasedAt] = useState(initialDate)
  const [rows, setRows] = useState<Row[]>(initialRows.length > 0 ? initialRows : [emptyRow()])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id))
  }

  const total = rows.reduce((sum, r) => sum + (Number.isFinite(r.totalPrice) ? r.totalPrice : 0), 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const validRows = rows.filter((r) => r.name.trim() && r.totalPrice > 0)
    if (validRows.length === 0) {
      setError('Mindestens eine Position mit Name und Preis wird benötigt.')
      return
    }
    setSaving(true)
    setError('')
    const result = await onSave({ store: store.trim() || 'Unbekannt', purchasedAt, rows: validRows, total: round2(total) })
    setSaving(false)
    if (result) setError(result)
  }

  return (
    <form className="receipt-form" onSubmit={submit}>
      {error && <p role="alert">{error}</p>}
      <div className="review-head">
        {previewUrl && <img src={previewUrl} alt="Kassenzettel-Vorschau" className="preview" />}
        <div className="fields">
          <label>
            Supermarkt
            <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="z. B. Rewe" />
          </label>
          <label>
            Datum
            <input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="table-wrap">
        <table className="review">
          <thead>
            <tr>
              <th>Position</th>
              <th>Menge</th>
              <th>Einzelpreis</th>
              <th>Gesamt</th>
              <th>Kategorie</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input value={r.name} onChange={(e) => updateRow(r.id, { name: e.target.value })} placeholder="Artikel…" />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.quantity}
                    onChange={(e) => updateRow(r.id, { quantity: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.unitPrice ?? ''}
                    onChange={(e) => updateRow(r.id, { unitPrice: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.totalPrice}
                    onChange={(e) => updateRow(r.id, { totalPrice: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <select value={r.category} onChange={(e) => updateRow(r.id, { category: e.target.value })}>
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button type="button" onClick={() => removeRow(r.id)} aria-label="Position entfernen">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="review-footer">
        <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
          + Position hinzufügen
        </button>
        <span className="total">Summe: {total.toFixed(2)} €</span>
      </div>

      <div className="actions">
        <button type="button" onClick={onCancel}>
          Abbrechen
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Speichert…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
