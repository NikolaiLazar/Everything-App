import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { CATEGORIES, suggestCategory } from './categories'
import { parseReceiptText } from './receiptParser'
import { ocrStatusLabel, recognizeReceipt, type OcrProgress } from './ocr'

interface Row {
  id: string
  name: string
  quantity: number
  unitPrice: number | null
  totalPrice: number
  category: string
}

const todayKey = () => new Date().toLocaleDateString('sv') // YYYY-MM-DD in lokaler Zeit

let rowSeq = 0
const newRowId = () => `row-${++rowSeq}`

function emptyRow(): Row {
  return { id: newRowId(), name: '', quantity: 1, unitPrice: null, totalPrice: 0, category: CATEGORIES[CATEGORIES.length - 1].key }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export default function ScanView({ onSaved }: { onSaved: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'review'>('idle')
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [store, setStore] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(todayKey())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPhase('idle')
    setProgress(null)
    setPreviewUrl(null)
    setRows([])
    setStore('')
    setPurchasedAt(todayKey())
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setPreviewUrl(URL.createObjectURL(file))
    setPhase('scanning')
    setProgress({ status: 'loading tesseract core', progress: 0 })
    try {
      const text = await recognizeReceipt(file, setProgress)
      const parsed = parseReceiptText(text)
      setRows(
        parsed.length > 0
          ? parsed.map((p) => ({
              id: newRowId(),
              name: p.name,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              totalPrice: p.totalPrice,
              category: suggestCategory(p.name),
            }))
          : [emptyRow()],
      )
      setPhase('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR fehlgeschlagen.')
      setPhase('idle')
    }
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id))
  }

  const total = rows.reduce((sum, r) => sum + (Number.isFinite(r.totalPrice) ? r.totalPrice : 0), 0)

  async function save(e: FormEvent) {
    e.preventDefault()
    const validRows = rows.filter((r) => r.name.trim() && r.totalPrice > 0)
    if (validRows.length === 0) {
      setError('Mindestens eine Position mit Name und Preis wird benötigt.')
      return
    }
    setSaving(true)
    setError('')
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts_receipts')
      .insert({ store: store.trim() || 'Unbekannt', purchased_at: purchasedAt, total: round2(total) })
      .select('id')
      .single()
    if (receiptError || !receipt) {
      setError(receiptError?.message ?? 'Kassenzettel konnte nicht gespeichert werden.')
      setSaving(false)
      return
    }
    const { error: itemsError } = await supabase.from('receipts_items').insert(
      validRows.map((r) => ({
        receipt_id: receipt.id,
        name: r.name.trim(),
        category: r.category,
        quantity: r.quantity,
        unit_price: r.unitPrice,
        total_price: r.totalPrice,
      })),
    )
    if (itemsError) {
      // Keine echte Transaktion ohne Backend möglich: verwaisten Kassenzettel wieder entfernen.
      await supabase.from('receipts_receipts').delete().eq('id', receipt.id)
      setError(itemsError.message)
      setSaving(false)
      return
    }
    setSaving(false)
    reset()
    onSaved()
  }

  return (
    <div className="scan">
      {error && <p role="alert">{error}</p>}

      {phase === 'idle' && (
        <label className="scan-drop">
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
          <span className="icon">📸</span>
          <span>Kassenzettel fotografieren oder Bild auswählen</span>
        </label>
      )}

      {phase === 'scanning' && (
        <div className="scanning">
          {previewUrl && <img src={previewUrl} alt="Kassenzettel-Vorschau" className="preview" />}
          <div className="bar">
            <div className="fill" style={{ width: `${(progress?.progress ?? 0) * 100}%` }} />
          </div>
          <p>
            {ocrStatusLabel(progress?.status ?? '')} {Math.round((progress?.progress ?? 0) * 100)}%
          </p>
        </div>
      )}

      {phase === 'review' && (
        <form onSubmit={save}>
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
            <button type="button" onClick={reset}>
              Abbrechen
            </button>
            <button type="submit" disabled={saving}>
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
