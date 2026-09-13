import { AgentError } from '../errors'
import type { Message } from '../types'
import type { ToolDefinition } from '../tools/runner'

export interface CompletionResponse {
  message: Message
  sent: number
  received: number
}

export interface ChatModel {
  complete(messages: Message[], tools: ToolDefinition[]): Promise<CompletionResponse>
}

export interface ModelClientOptions {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs?: number
}

interface OpenAIChatMessage {
  role: string
  content?: string | null
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[]
  tool_call_id?: string
  name?: string
}

interface OpenAIResponse {
  choices?: { message?: OpenAIChatMessage }[]
  usage?: { prompt_tokens: number; completion_tokens: number }
}

export class OpenAIChatModel implements ChatModel {
  constructor(private readonly options: ModelClientOptions) {}

  async complete(messages: Message[], tools: ToolDefinition[]): Promise<CompletionResponse> {
    const body = {
      model: this.options.model,
      temperature: 0,
      messages: messages.map(toOpenAIMessage),
      tools: tools.map(toOpenAITool),
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 30000)
    let res: Response
    try {
      res = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (e) {
      throw new AgentError('model', `model request failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new AgentError('model', `model returned ${res.status}: ${text.slice(0, 500)}`)
    }
    const data = (await res.json()) as OpenAIResponse
    const choice = data.choices?.[0]
    if (!choice?.message) throw new AgentError('model', 'model response had no choice message')
    const m = choice.message
    const message: Message = {
      role: 'assistant',
      content: m.content ?? undefined,
      toolCalls: m.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments ?? '{}',
      })),
    }
    const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0 }
    return { message, sent: usage.prompt_tokens, received: usage.completion_tokens }
  }
}

function toOpenAIMessage(m: Message): OpenAIChatMessage {
  const api: OpenAIChatMessage = { role: m.role }
  if (m.content !== undefined) api.content = m.content
  if (m.role === 'assistant' && m.toolCalls?.length) {
    api.tool_calls = m.toolCalls.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name, arguments: tc.arguments },
    }))
  }
  if (m.role === 'tool') {
    api.tool_call_id = m.toolCallId
    api.name = m.name
  }
  return api
}

function toOpenAITool(t: ToolDefinition) {
  return { type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }
}