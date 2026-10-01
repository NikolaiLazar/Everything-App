// Heuristischer Parser: wandelt rohen OCR-Text eines Kassenzettels in Positionsvorschläge um.
// Kassenzettel-Zeilen enden i. d. R. mit einem Preis wie "1,99" (seltener "1.99" oder "-0,50"
// bei Rabatten), teils mit vorangestellter Menge ("2x Apfel 1,50"). OCR ist fehleranfällig,
// daher wird hier bewusst nur "sieht aus wie eine Preiszeile" gefiltert – der Rest (falsch
// erkannte Namen, nicht erkannte Gewichtsware o. Ä.) bleibt der manuellen Korrektur in der
// Review-Tabelle überlassen. Liefert diese Funktion nichts, blockiert der Scan-Flow trotzdem
// nicht: die Review-Tabelle startet dann einfach leer.

export interface ParsedItem {
  name: string
  quantity: number
  unitPrice: number | null
  totalPrice: number
}

const PRICE_RE = /(-?\d{1,4}[,.]\d{2})\s*(?:€|EUR)?\s*$/
const QTY_PREFIX_RE = /^(\d+(?:[,.]\d+)?)\s*[xX×]\s*(.+)$/

// Zeilen, die typischerweise keine Artikel sind (Summen, Zahlungsinfos, Steuer, Bon-Fußzeile).
const NOISE_RE =
  /\b(summe|gesamt|zwischensumme|total|bar(?:zahlung)?|karte|ec-?cash|giro-?card|rückgeld|geg(?:eben)?\.?|mwst|ust\.?|tse|beleg|kassenbon|pfand\s*rückgabe|kundenkarte|bonnummer|steuer)\b/i

export function parseReceiptText(rawText: string): ParsedItem[] {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const items: ParsedItem[] = []

  for (const line of lines) {
    if (NOISE_RE.test(line)) continue
    const priceMatch = line.match(PRICE_RE)
    if (!priceMatch) continue

    const totalPrice = parseGermanNumber(priceMatch[1])
    if (!Number.isFinite(totalPrice) || totalPrice === 0) continue

    const idx = priceMatch.index ?? 0
    let rest = line.slice(0, idx).trim()
    if (rest.length < 2) continue // reine Preiszeile ohne Artikeltext, z. B. TSE-Fußzeile

    let quantity = 1
    let unitPrice: number | null = null

    const qtyMatch = rest.match(QTY_PREFIX_RE)
    if (qtyMatch) {
      const qty = parseGermanNumber(qtyMatch[1])
      if (Number.isFinite(qty) && qty > 0) {
        quantity = qty
        rest = qtyMatch[2].trim()
        unitPrice = round2(totalPrice / qty)
      }
    }

    items.push({ name: cleanName(rest), quantity, unitPrice, totalPrice })
  }

  return items
}

function parseGermanNumber(raw: string): number {
  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')
  let s = raw
  if (hasComma && hasDot) {
    // Tausenderpunkt + Dezimalkomma, z. B. "1.234,56"
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    s = s.replace(',', '.')
  }
  // sonst: bereits Punkt-Dezimal (z. B. "1.99") oder eine Ganzzahl
  return Number(s)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function cleanName(raw: string): string {
  // OCR-Artefakte entfernen: führende Rabatt-/Artikelmarkierungen (*), doppelte Leerzeichen.
  return raw.replace(/^\*+\s*/, '').replace(/\s{2,}/g, ' ').trim()
}
