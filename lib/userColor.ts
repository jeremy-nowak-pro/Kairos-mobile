const PALETTE = [
  { bg: '#dbeafe', text: '#1d4ed8' }, // bleu
  { bg: '#e0e7ff', text: '#4338ca' }, // indigo
  { bg: '#ede9fe', text: '#6d28d9' }, // violet
  { bg: '#f3e8ff', text: '#7e22ce' }, // pourpre
  { bg: '#fce7f3', text: '#be185d' }, // rose
  { bg: '#cffafe', text: '#0e7490' }, // cyan
  { bg: '#ccfbf1', text: '#0f766e' }, // teal
  { bg: '#c7d2fe', text: '#3730a3' }, // indigo clair
]

export function userColor(assignedTo: string | null | undefined): { bg: string; text: string } {
  const name = assignedTo?.split(',')[0].trim() ?? ''
  if (!name) return PALETTE[0]
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PALETTE[hash % PALETTE.length]
}
