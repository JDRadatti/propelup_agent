import type { Document } from '../documents'
import { DocumentIndex } from '../search'
import type { ToolDefinition } from './runner'

export function builtinTools(documents: Document[]): ToolDefinition[] {
  const index = new DocumentIndex(documents)
  const byId = new Map(documents.map((d) => [d.id, d.text]))
  return [
    {
      name: 'search_documents',
      description:
        'Search the company documents by keyword. Returns every document that matches, with a verbatim excerpt.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Keywords to search for' } },
        required: ['query'],
      },
      execute: async (args) => {
        const query = String(args.query ?? '').trim()
        if (!query) return { ok: false, message: 'query must be a non-empty string' }
        const hits = index.search(query)
        if (hits.length === 0) {
          const available = documents.map((d) => d.id).join(', ')
          return {
            ok: true,
            content: `no documents matched the query. Available ids: ${available}. Use get_document with one of these ids.`,
          }
        }
        return { ok: true, content: hits.map((h) => `${h.id}: ${h.excerpt}`).join('\n') }
      },
    },
    {
      name: 'get_document',
      description:
        'Retrieve the full verbatim contents of one document by id. Use the ids returned by search_documents.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Document id' } },
        required: ['id'],
      },
      countsRead: true,
      execute: async (args) => {
        const id = String(args.id ?? '').trim()
        if (!id) return { ok: false, message: 'id must be a non-empty string' }
        const text = byId.get(id)
        if (text === undefined) {
          return {
            ok: false,
            message: `no document with id '${id}' - run search_documents first`,
          }
        }
        return { ok: true, content: text }
      },
    },
  ]
}