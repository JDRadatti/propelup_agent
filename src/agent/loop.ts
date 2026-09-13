import { asTurnError } from '../errors'
import type { Limits, Message, Source, Stats, Step, StopReason, TurnResult } from '../types'
import { ToolRunner, type ToolDefinition } from '../tools/runner'
import { tokenizeWords } from '../search'
import { buildSystemPrompt } from './prompt'
import type { ChatModel } from './model'

export interface LoopOptions {
  model: ChatModel
  tools: ToolDefinition[]
  limits: Limits
  input: string
  systemPrompt?: string
}

export async function runAgent(opts: LoopOptions): Promise<TurnResult> {
  const steps: Step[] = []
  const stats: Stats = { tokensSent: 0, tokensReceived: 0, toolCalls: 0, reads: 0 }
  const runner = new ToolRunner(opts.tools, stats)
  const messages: Message[] = [
    { role: 'system', content: opts.systemPrompt ?? buildSystemPrompt([]) },
    { role: 'user', content: opts.input },
  ]
  let answer = ''
  let stopReason: StopReason = 'answer'
  let stopped = false

  try {
    for (let turn = 0; turn < opts.limits.maxTurns; turn++) {
      const spent = stats.tokensSent + stats.tokensReceived
      if (spent >= opts.limits.maxTokens) {
        stopReason = 'maxTokens'
        stopped = true
        break
      }
      const resp = await opts.model.complete(messages, opts.tools)
      stats.tokensSent += resp.sent
      stats.tokensReceived += resp.received
      messages.push(resp.message)
      const calls = resp.message.toolCalls ?? []
      steps.push({ kind: 'model', usage: { sent: resp.sent, received: resp.received }, toolCalls: calls })
      answer = resp.message.content ?? answer
      if (calls.length === 0) {
        stopReason = 'answer'
        stopped = true
        break
      }
      let hitCap = false
      for (const call of calls) {
        if (stats.toolCalls >= opts.limits.maxToolCalls) {
          stopReason = 'maxToolCalls'
          hitCap = true
          break
        }
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.arguments)
        } catch {
          args = {}
        }
        const outcome = await runner.execute(call.name, args)
        stats.toolCalls++
        steps.push({
          kind: 'tool',
          toolCallId: call.id,
          name: call.name,
          ok: outcome.ok,
          content: outcome.ok ? outcome.content : outcome.message,
          docId:
            call.name === 'get_document' && outcome.ok && typeof args.id === 'string' ? args.id : undefined,
        })
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          name: call.name,
          content: outcome.ok ? outcome.content : outcome.message,
        })
      }
      if (hitCap) {
        stopped = true
        break
      }
    }
    if (!stopped) stopReason = 'maxTurns'
  } catch (e) {
    return { answer, sources: sourcesFrom(steps, answer), stopReason: 'error', steps, stats, error: asTurnError(e) }
  }
  return { answer, sources: sourcesFrom(steps, answer), stopReason, steps, stats }
}

function sourcesFrom(steps: Step[], answer: string): Source[] {
  const seen = new Map<string, string>()
  for (const s of steps) {
    if (s.kind === 'tool' && s.docId !== undefined) seen.set(s.docId, s.content)
  }
  return [...seen.entries()].map(([id, text]) => {
    const quotes = matchingQuotes(text, answer, 3)
    return quotes.length ? { id, quotes } : { id }
  })
}

function matchingQuotes(text: string, answer: string, maxQuotes: number): string[] {
  const aWords = tokenizeWords(answer)
  const a = aWords.map((w) => w.word)
  const tTokens = tokenizeWords(text)
  const t = tTokens.map((w) => w.word)
  const minLen = 4
  if (a.length < minLen || t.length < minLen) return []
  const runs: { s: number; e: number }[] = []
  for (let start = 0; start < a.length; start++) {
    for (let i = 0; i < t.length; i++) {
      let k = 0
      while (i + k < t.length && start + k < a.length && t[i + k] === a[start + k]) k++
      if (k >= minLen) runs.push({ s: i, e: i + k })
    }
  }
  runs.sort((x, y) => x.s - y.s || y.e - y.s - (x.e - x.s))
  const merged: { s: number; e: number }[] = []
  for (const run of runs) {
    const last = merged[merged.length - 1]
    if (last && run.s <= last.e) last.e = Math.max(last.e, run.e)
    else merged.push({ s: run.s, e: run.e })
  }
  return merged
    .sort((x, y) => y.e - y.s - (x.e - x.s))
    .slice(0, maxQuotes)
    .map(({ s, e }) => {
      let end = tTokens[e - 1].end
      const cap = end + 2
      while (end < text.length && end < cap && /[.,;:!?)\]]/.test(text[end])) end++
      return text.slice(tTokens[s].start, end).trim()
    })
}