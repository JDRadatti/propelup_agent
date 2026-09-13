import { describe, expect, it } from 'vitest'
import type { Document } from '../src/documents'
import { DocumentIndex, tokenize } from '../src/search'
import { ToolRunner, type ToolDefinition } from '../src/tools/runner'
import { builtinTools } from '../src/tools/builtin'
import type { Stats } from '../src/types'

const corpus: Document[] = [
  {
    id: 'project-update',
    text: 'The pilot is planned for October 1. Development is complete, but security review and customer onboarding remain outstanding.',
  },
  {
    id: 'meeting-notes',
    text: "Maya owns the security review and is waiting for the vendor's questionnaire. Daniel owns onboarding and needs the customer contact list.",
  },
  {
    id: 'customer-update',
    text: 'The customer can provide its contact list next week and has asked whether the October 1 launch is still achievable.',
  },
]

function freshStats(): Stats {
  return { tokensSent: 0, tokensReceived: 0, toolCalls: 0, reads: 0 }
}

describe('DocumentIndex', () => {
  it('is case-insensitive and returns matches ordered by overlap then id', () => {
    const index = new DocumentIndex(corpus)
    const hits = index.search('OCTOBER LAUNCH')
    expect(hits.map((h) => h.id)).toEqual(['customer-update', 'project-update'])
  })

  it('returns a verbatim excerpt from the source document', () => {
    const index = new DocumentIndex(corpus)
    const hits = index.search('pilot planned october')
    expect(hits.length).toBeGreaterThan(0)
    const text = corpus[0].text
    expect(text.includes(hits[0].excerpt.replace(/^\.\.\./, '').replace(/\.\.\.$/, ''))).toBe(true)
  })

  it('returns an empty hit list when nothing matches', () => {
    const index = new DocumentIndex(corpus)
    expect(index.search('quantum teleportation')).toEqual([])
  })
})

describe('builtin search tool', () => {
  const tools = builtinTools(corpus)
  const stats = freshStats()
  const runner = new ToolRunner(tools, stats)

  it('rejects a blank query', async () => {
    const result = await runner.execute('search_documents', { query: '   ' })
    expect(result.ok).toBe(false)
  })

  it('reports no matches as a success with no hits, listing available ids', async () => {
    const result = await runner.execute('search_documents', { query: 'zebra unicorn' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.content).toMatch(/no documents matched/)
      expect(result.content).toContain('project-update')
      expect(result.content).toContain('meeting-notes')
      expect(result.content).toContain('customer-update')
    }
  })
})

describe('builtin retrieve tool', () => {
  const tools = builtinTools(corpus)

  it('returns verbatim document text and counts a read', async () => {
    const stats = freshStats()
    const runner = new ToolRunner(tools, stats)
    const result = await runner.execute('get_document', { id: 'meeting-notes' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.content).toBe(corpus[1].text)
    expect(stats.reads).toBe(1)
    expect(stats.toolCalls).toBe(0)
  })

  it('fails on an unknown id without counting a read, hinting to search first', async () => {
    const stats = freshStats()
    const runner = new ToolRunner(tools, stats)
    const result = await runner.execute('get_document', { id: 'sales-plan' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/search_documents/)
    expect(stats.reads).toBe(0)
  })

  it('rejects a blank id', async () => {
    const stats = freshStats()
    const runner = new ToolRunner(tools, stats)
    const result = await runner.execute('get_document', { id: '' })
    expect(result.ok).toBe(false)
  })
})

describe('ToolRunner', () => {
  it('reports an unknown tool as a failed result', async () => {
    const stats = freshStats()
    const runner = new ToolRunner([], stats)
    const result = await runner.execute('hack_the_planet', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/unknown tool/)
  })

  it('validates required arguments before executing', async () => {
    const boom: ToolDefinition = {
      name: 'boom',
      description: 'always fails',
      parameters: { type: 'object', properties: { n: { type: 'string' } }, required: ['n'] },
      execute: async () => ({ ok: true, content: 'never reached' }),
    }
    const stats = freshStats()
    const runner = new ToolRunner([boom], stats)
    const result = await runner.execute('boom', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/missing required argument/)
  })

  it('wraps a thrown exception into a failed result', async () => {
    const throwing: ToolDefinition = {
      name: 'crash',
      description: 'throws',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        throw new Error('disk on fire')
      },
    }
    const stats = freshStats()
    const runner = new ToolRunner([throwing], stats)
    const result = await runner.execute('crash', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/disk on fire/)
  })
})

describe('tokenize', () => {
  it('lowercases and strips punctuation', () => {
    expect(tokenize("Vendor's Questionnaire!")).toEqual(["vendor's", 'questionnaire'])
  })
})