// Feste Kategorien für Kassenzettel-Positionen, ähnlich DIFFICULTIES in todo/gamification.ts.
// Jede Kategorie trägt Stichwörter zur automatischen Vorschlags-Zuordnung beim Scannen
// (suggestCategory) sowie eine feste Position, die auch die Balkenfarbe in den Charts
// bestimmt (categoryColorVar, siehe --cat-1..6 in index.css).

export interface Category {
  key: string
  label: string
  emoji: string
  keywords: string[]
}

export const CATEGORIES: Category[] = [
  {
    key: 'lebensmittel',
    label: 'Lebensmittel',
    emoji: '🥦',
    keywords: [
      'brot', 'brötchen', 'milch', 'käse', 'butter', 'ei', 'eier', 'obst', 'gemüse',
      'fleisch', 'wurst', 'joghurt', 'nudeln', 'reis', 'mehl', 'apfel', 'banane',
      'tomate', 'kartoffel', 'hähnchen', 'fisch', 'quark', 'sahne', 'zwiebel',
    ],
  },
  {
    key: 'suessigkeiten',
    label: 'Süßigkeiten & Snacks',
    emoji: '🍫',
    keywords: [
      'schokolade', 'schoko', 'keks', 'gummibärchen', 'chips', 'bonbon', 'riegel',
      'snack', 'eis', 'kuchen', 'gebäck', 'nuss', 'nüsse',
    ],
  },
  {
    key: 'getraenke',
    label: 'Getränke',
    emoji: '🥤',
    keywords: ['wasser', 'cola', 'saft', 'bier', 'wein', 'limo', 'kaffee', 'tee', 'sprudel', 'energy', 'schorle'],
  },
  {
    key: 'drogerie',
    label: 'Drogerie',
    emoji: '🧴',
    keywords: [
      'shampoo', 'seife', 'zahnpasta', 'deo', 'creme', 'duschgel', 'windel', 'binden',
      'tampon', 'rasier', 'hygiene', 'pflaster',
    ],
  },
  {
    key: 'haushalt',
    label: 'Haushalt',
    emoji: '🧽',
    keywords: [
      'waschmittel', 'spülmittel', 'putzmittel', 'küchenrolle', 'toilettenpapier',
      'müllbeutel', 'batterie', 'glühbirne', 'schwamm', 'reiniger',
    ],
  },
  { key: 'sonstiges', label: 'Sonstiges', emoji: '🛒', keywords: [] },
]

const UMLAUT_MAP: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }
const normalize = (s: string) => s.toLowerCase().replace(/[äöüß]/g, (c) => UMLAUT_MAP[c] ?? c)

/** Schlägt anhand von Schlüsselwort-Treffern im Artikelnamen eine Kategorie vor (Fallback: 'sonstiges'). */
export function suggestCategory(name: string): string {
  const n = normalize(name)
  for (const cat of CATEGORIES) {
    if (cat.key === 'sonstiges') continue
    if (cat.keywords.some((kw) => n.includes(normalize(kw)))) return cat.key
  }
  return 'sonstiges'
}

export function categoryByKey(key: string): Category {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1]
}

/** CSS-Variable für die Kategoriefarbe (--cat-1..6 in index.css, feste Reihenfolge = CATEGORIES-Index). */
export function categoryColorVar(key: string): string {
  const idx = CATEGORIES.findIndex((c) => c.key === key)
  return `var(--cat-${idx >= 0 ? idx + 1 : CATEGORIES.length})`
}
