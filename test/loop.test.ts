import { describe, expect, it } from 'vitest'
import type { ChatModel } from '../src/agent/model'
import { runAgent } from '../src/agent/loop'
import { builtinTools } from '../src/tools/builtin'
import { AgentError } from '../src/errors'
import type { Document } from '../src/documents'
import type { Limits, Message, ToolCall } from '../src/types'

const corpus: Document[] = [
  {
    id: 'project-update',
    text: 'The pilot is planned for October 1. Development is complete, but security review and customer onboarding remain outstanding.',
  },
]
const tools = builtinTools(corpus)
const limits: Limits = { maxTurns: 8, maxToolCalls: 8, maxTokens: 4000 }

interface StubStep {
  content?: string
  toolCalls?: ToolCall[]
}

function stubModel(steps: StubStep[], usage = 10): ChatModel & { seen: Message[][] } {
  const seen: Message[][] = []
  let i = 0
  return {
    seen,
    complete: async (messages) => {
      seen.push([...messages])
      const step = steps[Math.min(i, steps.length - 1)]
      i++
      return {
        message: { role: 'assistant', content: step.content, toolCalls: step.toolCalls },
        sent: usage,
        received: usage,
      }
    },
  }
}

const searchCall: ToolCall = {
  id: 't0',
  name: 'search_documents',
  arguments: JSON.stringify({ query: 'pilot' }),
}
const getCall: ToolCall = {
  id: 't1',
  name: 'get_document',
  arguments: JSON.stringify({ id: 'project-update' }),
}

describe('runAgent', () => {
  it('answers with sources and verbatim quotes', async () => {
    const model = stubModel([
      { toolCalls: [searchCall] },
      { toolCalls: [getCall] },
      { content: 'The pilot is planned for October 1.' },
    ])
    const result = await runAgent({ model, tools, limits, input: 'When is the pilot?' })
    expect(result.stopReason).toBe('answer')
    expect(result.stats.toolCalls).toBe(2)
    expect(result.stats.reads).toBe(1)
    expect(result.sources).toEqual([
      { id: 'project-update', quotes: ['The pilot is planned for October 1.'] },
    ])
  })

  it('hits the maxToolCalls limit and returns a partial answer', async () => {
    const model = stubModel([{ toolCalls: [searchCall] }, { toolCalls: [getCall] }])
    const result = await runAgent({
      model,
      tools,
      limits: { maxTurns: 8, maxToolCalls: 1, maxTokens: 4000 },
      input: 'When is the pilot?',
    })
    expect(result.stopReason).toBe('maxToolCalls')
    expect(result.stats.toolCalls).toBe(1)
  })

  it('hits the maxTurns limit when the model never stops', async () => {
    const model = stubModel([{ toolCalls: [searchCall] }])
    const result = await runAgent({
      model,
      tools,
      limits: { maxTurns: 2, maxToolCalls: 8, maxTokens: 4000 },
      input: 'When is the pilot?',
    })
    expect(result.stopReason).toBe('maxTurns')
    expect(result.stats.toolCalls).toBe(2)
  })

  it('hits the maxTokens limit', async () => {
    const model = stubModel([{ toolCalls: [searchCall] }, { toolCalls: [getCall] }])
    const result = await runAgent({
      model,
      tools,
      limits: { maxTurns: 8, maxToolCalls: 8, maxTokens: 20 },
      input: 'When is the pilot?',
    })
    expect(result.stopReason).toBe('maxTokens')
  })

  it('surfaces a failed tool call to the model and does not count a read', async () => {
    const model = stubModel([
      { toolCalls: [{ id: 't0', name: 'get_document', arguments: JSON.stringify({ id: 'nope' }) }] },
      { content: 'not found' },
    ])
    const result = await runAgent({ model, tools, limits, input: 'fetch nope' })
    expect(result.stopReason).toBe('answer')
    expect(result.stats.reads).toBe(0)
    const toolMessage = model.seen[1].find((m) => m.role === 'tool')
    expect(toolMessage).toBeDefined()
    expect(toolMessage?.content).toMatch(/search_documents/)
    expect(toolMessage?.toolCallId).toBe('t0')
  })

  it('maps a thrown model error to stopReason error', async () => {
    const failing: ChatModel = {
      complete: async () => {
        throw new AgentError('model', 'boom')
      },
    }
    const result = await runAgent({ model: failing, tools, limits, input: 'hi' })
    expect(result.stopReason).toBe('error')
    expect(result.error?.code).toBe('model')
  })

  it('never throws; runtime errors become a terminal error result', async () => {
    const failing: ChatModel = {
      complete: async () => {
        throw new Error('unexpected')
      },
    }
    const result = await runAgent({ model: failing, tools, limits, input: 'hi' })
    expect(result.stopReason).toBe('error')
    expect(result.error?.code).toBe('internal')
  })
})