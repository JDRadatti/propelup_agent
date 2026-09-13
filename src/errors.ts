import type { ErrorCode, TurnResultError } from './types'

export class AgentError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'AgentError'
    this.code = code
  }
}

export function asTurnError(e: unknown): TurnResultError {
  if (e instanceof AgentError) return { code: e.code, message: e.message }
  const message = e instanceof Error ? e.message : String(e)
  return { code: 'internal', message }
}