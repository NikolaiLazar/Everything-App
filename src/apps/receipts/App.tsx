import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ScanView from './ScanView'
import HistoryView from './HistoryView'
import AnalyticsView from './AnalyticsView'
import type { ItemRow, ReceiptRow } from './analytics'

export default function ReceiptsApp() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [tab, setTab] = useState<'scan' | 'history' | 'analytics'>('scan')
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 2200)
  }

  async function load() {
    const [receiptsRes, itemsRes] = await Promise.all([
      supabase.from('receipts_receipts').select('id, store, purchased_at, total').order('purchased_at', { ascending: false }),
      supabase.from('receipts_items').select('id, receipt_id, name, category, quantity, unit_price, total_price'),
    ])
    if (receiptsRes.error) return setError(receiptsRes.error.message)
    if (itemsRes.error) return setError(itemsRes.error.message)
    setReceipts(receiptsRes.data)
    setItems(itemsRes.data)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="receipts">
      <h1>Kassenzettel</h1>
      {error && <p role="alert">{error}</p>}

      <nav className="tabs">
        <button className={tab === 'scan' ? 'active' : ''} onClick={() => setTab('scan')}>
          Scannen
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          Verlauf
        </button>
        <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>
          Analyse
        </button>
      </nav>

      {tab === 'scan' && (
        <ScanView
          onSaved={() => {
            flash('🧾 Kassenzettel gespeichert')
            load()
            setTab('history')
          }}
        />
      )}
      {tab === 'history' && <HistoryView receipts={receipts} items={items} onChanged={load} />}
      {tab === 'analytics' && <AnalyticsView receipts={receipts} items={items} />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
