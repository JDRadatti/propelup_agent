import type { Stats } from '../types'

export type ToolArgs = Record<string, unknown>

export type ToolResult = { ok: true; content: string } | { ok: false; message: string }

export interface JSONSchema {
  type: 'object'
  properties: Record<string, { type: string; description?: string }>
  required?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: JSONSchema
  countsRead?: boolean
  execute: (args: ToolArgs) => Promise<ToolResult> | ToolResult
}

export class ToolRunner {
  private readonly tools: Map<string, ToolDefinition>
  private readonly stats: Stats

  constructor(tools: ToolDefinition[], stats: Stats) {
    this.tools = new Map(tools.map((t) => [t.name, t]))
    this.stats = stats
  }

  async execute(name: string, args: ToolArgs): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) return { ok: false, message: `unknown tool '${name}'` }
    const invalid = validateArgs(tool, args)
    if (invalid) return { ok: false, message: invalid }
    try {
      const result = await tool.execute(args)
      if (result.ok && tool.countsRead) this.stats.reads++
      return result
    } catch (e) {
      return {
        ok: false,
        message: `tool '${name}' failed: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
  }
}

function validateArgs(tool: ToolDefinition, args: ToolArgs): string {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return `arguments for '${tool.name}' must be an object`
  }
  for (const [key, value] of Object.entries(args)) {
    const prop = tool.parameters.properties[key]
    if (prop && typeof value !== prop.type) {
      return `argument '${key}' must be a ${prop.type}`
    }
  }
  for (const req of tool.parameters.required ?? []) {
    if (!(req in args)) return `missing required argument '${req}'`
  }
  return ''
}