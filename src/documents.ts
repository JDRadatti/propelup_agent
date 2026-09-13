import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface Document {
  id: string
  text: string
}

export async function loadDocs(docsDir: string): Promise<Document[]> {
  const entries = await readdir(docsDir, { withFileTypes: true })
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.txt'))
    .map((e) => e.name)
    .sort()
  const docs: Document[] = []
  for (const name of files) {
    const text = await readFile(join(docsDir, name), 'utf8')
    docs.push({ id: name.replace(/\.txt$/, ''), text })
  }
  return docs
}