// Kapselt den Lebenszyklus des Tesseract-Workers, damit ScanView sich nicht mit der
// tesseract.js-API befassen muss. Der Worker wird pro Scan neu erzeugt und danach beendet;
// das Foto selbst wird nirgends dauerhaft gespeichert (siehe Architekturentscheidung: kein
// Supabase-Storage-Bucket, nur die extrahierten Daten werden persistiert). Das deutsche
// Sprachpaket ('deu') lädt tesseract.js beim ersten Scan automatisch von seinem Standard-CDN
// und cacht es im Browser (IndexedDB) – dafür ist einmalig Netzwerkzugriff nötig.

import { createWorker } from 'tesseract.js'

export interface OcrProgress {
  status: string
  progress: number // 0..1
}

export async function recognizeReceipt(
  file: File | Blob,
  onProgress: (progress: OcrProgress) => void,
): Promise<string> {
  const worker = await createWorker('deu', 1, {
    logger: (m) => onProgress({ status: m.status, progress: m.progress }),
  })
  try {
    const { data } = await worker.recognize(file)
    return data.text
  } finally {
    await worker.terminate()
  }
}

// Grobe deutsche Beschriftung der von tesseract.js gemeldeten Status-Strings.
const STATUS_LABELS: Record<string, string> = {
  'loading tesseract core': 'Modul wird geladen…',
  'initializing tesseract': 'Wird initialisiert…',
  'loading language traineddata': 'Sprachpaket wird geladen…',
  'initializing api': 'Wird vorbereitet…',
  'recognizing text': 'Text wird erkannt…',
}

export function ocrStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}
