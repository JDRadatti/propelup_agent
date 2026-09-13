export type StopReason = 'answer' | 'maxTurns' | 'maxToolCalls' | 'maxTokens' | 'error'

export type ErrorCode = 'model' | 'tool' | 'config' | 'internal'

export interface Limits {
  maxTurns: number
  maxToolCalls: number
  maxTokens: number
}

export interface Stats {
  tokensSent: number
  tokensReceived: number
  toolCalls: number
  reads: number
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface Source {
  id: string
  quotes?: string[]
}

export type Step =
  | { kind: 'model'; usage: { sent: number; received: number }; toolCalls: ToolCall[] }
  | {
      kind: 'tool'
      toolCallId: string
      name: string
      ok: boolean
      content: string
      docId?: string
    }

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface Message {
  role: MessageRole
  content?: string
  toolCalls?: ToolCall[]
  toolCallId?: string
  name?: string
}

export interface TurnResultError {
  code: ErrorCode
  message: string
}

export interface TurnResult {
  answer: string
  sources: Source[]
  stopReason: StopReason
  steps: Step[]
  stats: Stats
  error?: TurnResultError
}