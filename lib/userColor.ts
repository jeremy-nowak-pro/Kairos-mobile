const USER_PALETTE = [
  { bg: '#EFF6FF', text: '#2563EB' },
  { bg: '#ECFDF5', text: '#059669' },
  { bg: '#FFF7ED', text: '#C2410C' },
  { bg: '#F5F3FF', text: '#7C3AED' },
]

export function userColor(assignedTo: string | null | undefined) {
  const name = assignedTo?.split(',')[0].trim() ?? ''
  if (!name) return USER_PALETTE[0]
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return USER_PALETTE[hash % USER_PALETTE.length]
}
