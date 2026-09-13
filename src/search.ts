import type { Document } from './documents'

export interface SearchHit {
  id: string
  excerpt: string
}

export interface WordToken {
  word: string
  start: number
  end: number
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? []
}

export function tokenizeWords(text: string): WordToken[] {
  const tokens: WordToken[] = []
  const re = /[a-z0-9']+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text.toLowerCase())) !== null) {
    tokens.push({ word: m[0], start: m.index, end: m.index + m[0].length })
  }
  return tokens
}

export class DocumentIndex {
  private readonly tokens: WordToken[][] = []
  private readonly originals: string[] = []
  private readonly ids: string[] = []
  private readonly postings = new Map<string, number[]>()

  constructor(documents: Document[]) {
    documents.forEach((doc, idx) => {
      this.ids[idx] = doc.id
      this.originals[idx] = doc.text
      this.tokens[idx] = tokenizeWords(doc.text)
      const seen = new Set<string>()
      for (const t of this.tokens[idx]) {
        if (seen.has(t.word)) continue
        seen.add(t.word)
        const list = this.postings.get(t.word)
        if (list) list.push(idx)
        else this.postings.set(t.word, [idx])
      }
    })
  }

  search(query: string): SearchHit[] {
    const words = [...new Set(tokenize(query))].filter((w) => this.postings.has(w))
    if (words.length === 0) return []
    const scores = new Map<number, number>()
    for (const w of words) {
      for (const idx of this.postings.get(w)!) {
        scores.set(idx, (scores.get(idx) ?? 0) + 1)
      }
    }
    const ranked = [...scores.entries()].sort(
      (a, b) => b[1] - a[1] || this.ids[a[0]].localeCompare(this.ids[b[0]]),
    )
    return ranked.map(([idx]) => ({ id: this.ids[idx], excerpt: this.excerpt(idx, words) }))
  }

  private excerpt(docIdx: number, words: string[]): string {
    const toks = this.tokens[docIdx]
    const wanted = new Set(words)
    const hits: number[] = []
    toks.forEach((t, i) => {
      if (wanted.has(t.word)) hits.push(i)
    })
    if (hits.length === 0) return this.originals[docIdx].slice(0, 100)
    let best = { s: 0, e: 0, score: -1 }
    for (const i of hits) {
      const s = Math.max(0, i - 8)
      const e = Math.min(toks.length, i + 20)
      let score = 0
      for (const j of hits) if (j >= s && j < e) score++
      if (score > best.score) best = { s, e, score }
    }
    const text = this.originals[docIdx]
    const start = best.s === 0 ? 0 : toks[best.s - 1].start
    const end = best.e >= toks.length ? text.length : toks[best.e].end
    let excerpt = text.slice(start, end)
    if (start > 0) excerpt = `...${excerpt}`
    if (end < text.length) excerpt = `${excerpt}...`
    return excerpt
  }
}