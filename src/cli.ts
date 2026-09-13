import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline'
import { AgentError, asTurnError } from './errors'
import { apiKeyStatus, loadConfig, saveEnv, type AppConfig, type Secrets } from './config'
import { loadDocs } from './documents'
import { builtinTools } from './tools/builtin'
import { OpenAIChatModel } from './agent/model'
import { runAgent } from './agent/loop'
import type { TurnResult } from './types'

const rootDir = process.cwd()

export function settingsLine(config: AppConfig, secrets: Secrets): string {
  return [
    `provider: ${config.provider}`,
    `model: ${config.model}`,
    `baseUrl: ${config.baseUrl}`,
    `docs: ${config.docsDir}`,
    `limits: maxTurns=${config.limits.maxTurns} maxToolCalls=${config.limits.maxToolCalls} maxTokens=${config.limits.maxTokens}`,
    `mode: ${config.mode}`,
    `api key: ${apiKeyStatus(secrets)}`,
  ].join('\n')
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function fail(what: 'config' | 'agent', message: string, stack?: string): never {
  if (stack) process.stderr.write(`${stack}\n`)
  printJson({ error: { code: what, message } })
  process.exit(1)
}

function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function maskedPrompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  const inner = rl as unknown as { _writeToOutput: (s: string) => void }
  const origWrite = inner._writeToOutput.bind(rl)
  inner._writeToOutput = (s: string) => {
    if (s.startsWith(question)) origWrite(s)
    else if (s.trim() === '' && s.includes('\n')) origWrite(s)
    else origWrite('*'.repeat(Math.max(s.trimEnd().length, 1)))
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function runSetup(config: AppConfig): Promise<Secrets> {
  console.log('\nFirst run: no API key found in .env.')
  const apiKey = await maskedPrompt('OpenAI API key (hidden): ')
  if (!apiKey) fail('config', 'no API key provided - nothing saved')
  const baseUrlAnswer = await promptLine(`OpenAI base URL [${config.baseUrl}]: `)
  const baseUrl = baseUrlAnswer || config.baseUrl
  saveEnv(rootDir, { apiKey, baseUrl })
  console.log('Saved to .env (mode 600; gitignored).')
  return { apiKey, baseUrl }
}

function toOutput(result: TurnResult, mode: AppConfig['mode']): unknown {
  if (mode === 'verbose') return result
  const { steps: _steps, ...rest } = result
  return rest
}

async function main(): Promise<void> {
  let config: AppConfig
  let secrets: Secrets
  try {
    ;({ config, secrets } = loadConfig(rootDir))
  } catch (e) {
    if (e instanceof AgentError) fail('config', e.message, e.stack)
    fail('config', asTurnError(e).message)
  }
  console.log(settingsLine(config, secrets))
  if (!secrets.apiKey) secrets = await runSetup(config)
  if (!secrets.apiKey) fail('config', 'no API key available')
  const model = new OpenAIChatModel({
    apiKey: secrets.apiKey,
    baseUrl: secrets.baseUrl ?? config.baseUrl,
    model: config.model,
  })
  const docs = await loadDocs(config.docsDir)
  const tools = builtinTools(docs)
  console.log(`Loaded ${docs.length} document(s). Ask a question (Ctrl-C to exit).`)
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  rl.setPrompt('> ')
  rl.prompt()
  rl.on('line', async (line) => {
    const input = line.trim()
    if (!input) {
      rl.prompt()
      return
    }
    let result: TurnResult
    try {
      result = await runAgent({ model, tools, limits: config.limits, input })
    } catch (e) {
      fail('agent', asTurnError(e).message, e instanceof Error ? e.stack : undefined)
    }
    printJson(toOutput(result, config.mode))
    if (result.stopReason === 'error') fail('agent', result.error?.message ?? 'agent failed')
    rl.prompt()
  })
  rl.on('SIGINT', () => {
    console.log('\nBye.')
    process.exit(0)
  })
}

const runDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (runDirectly) void main()