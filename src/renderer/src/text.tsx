// Text helpers shared by the address bar and the command palette.

/** Lowercase without accents, so "jupiter" finds "Júpiter". */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Bolds every occurrence of the typed words (ignoring case and accents). */
export function highlight(text: string, words: string[]): React.ReactNode {
  const folded = fold(text)
  const needles = words.map(fold).filter(Boolean)
  // Folding keeps lengths for ordinary accented letters; if not, don't risk misaligned bold.
  if (needles.length === 0 || folded.length !== text.length) return text
  const bold = new Array<boolean>(text.length).fill(false)
  for (const needle of needles) {
    for (let at = folded.indexOf(needle); at !== -1; at = folded.indexOf(needle, at + 1)) {
      bold.fill(true, at, at + needle.length)
    }
  }
  const parts: React.ReactNode[] = []
  let start = 0
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || bold[i] !== bold[start]) {
      const chunk = text.slice(start, i)
      parts.push(bold[start] ? <strong key={start}>{chunk}</strong> : chunk)
      start = i
    }
  }
  return parts
}
