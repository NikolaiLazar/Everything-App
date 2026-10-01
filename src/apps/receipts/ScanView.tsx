import { useRef, useState, type ChangeEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { suggestCategory } from './categories'
import { parseReceiptText } from './receiptParser'
import { ocrStatusLabel, recognizeReceipt, type OcrProgress } from './ocr'
import ReceiptForm, { emptyRow, newRowId, type ReceiptFormPayload, type Row } from './ReceiptForm'

const todayKey = () => new Date().toLocaleDateString('sv') // YYYY-MM-DD in lokaler Zeit

export default function ScanView({ onSaved }: { onSaved: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'review'>('idle')
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [initialRows, setInitialRows] = useState<Row[]>([])
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPhase('idle')
    setProgress(null)
    setPreviewUrl(null)
    setInitialRows([])
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  function startManual() {
    setError('')
    setPreviewUrl(null)
    setInitialRows([emptyRow()])
    setPhase('review')
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
      setInitialRows(
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

  async function handleSave(payload: ReceiptFormPayload): Promise<string | null> {
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts_receipts')
      .insert({ store: payload.store, purchased_at: payload.purchasedAt, total: payload.total })
      .select('id')
      .single()
    if (receiptError || !receipt) {
      return receiptError?.message ?? 'Kassenzettel konnte nicht gespeichert werden.'
    }
    const { error: itemsError } = await supabase.from('receipts_items').insert(
      payload.rows.map((r) => ({
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
      return itemsError.message
    }
    reset()
    onSaved()
    return null
  }

  return (
    <div className="scan">
      {error && <p role="alert">{error}</p>}

      {phase === 'idle' && (
        <>
          <label className="scan-drop">
            <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
            <span className="icon">📸</span>
            <span>Kassenzettel fotografieren oder Bild auswählen</span>
          </label>
          <p className="manual-hint">
            Kein Foto zur Hand?{' '}
            <button type="button" className="link" onClick={startManual}>
              Kassenzettel manuell erfassen
            </button>
          </p>
        </>
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
        <ReceiptForm
          initialStore=""
          initialDate={todayKey()}
          initialRows={initialRows}
          previewUrl={previewUrl}
          submitLabel="Speichern"
          onCancel={reset}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
