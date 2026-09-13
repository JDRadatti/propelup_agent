import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { resolve } from 'node:path'
import { AgentError } from './errors'
import type { Limits } from './types'

export interface AppConfig {
  provider: 'openai'
  model: string
  baseUrl: string
  docsDir: string
  limits: Limits
  mode: 'regular' | 'verbose'
}

export interface Secrets {
  apiKey?: string
  baseUrl?: string
}

export const DEFAULT_LIMITS: Limits = { maxTurns: 8, maxToolCalls: 8, maxTokens: 4000 }

const ENV_FILE = '.env'
const ENV_KEY = 'OPENAI_API_KEY'
const ENV_BASE_URL = 'OPENAI_BASE_URL'

export function defaultConfig(rootDir: string): AppConfig {
  return {
    provider: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    docsDir: resolve(rootDir, 'data/documents'),
    limits: { ...DEFAULT_LIMITS },
    mode: 'regular',
  }
}

export function loadEnv(rootDir: string): Secrets {
  const secrets: Secrets = {}
  const envPath = resolve(rootDir, ENV_FILE)
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (key === ENV_KEY && value) secrets.apiKey = value
      if (key === ENV_BASE_URL && value) secrets.baseUrl = value
    }
  }
  if (process.env[ENV_KEY]) secrets.apiKey = process.env[ENV_KEY]
  if (process.env[ENV_BASE_URL]) secrets.baseUrl = process.env[ENV_BASE_URL]
  return secrets
}

export function loadConfig(rootDir: string): { config: AppConfig; secrets: Secrets } {
  const config = defaultConfig(rootDir)
  const secrets = loadEnv(rootDir)
  if (secrets.baseUrl) config.baseUrl = secrets.baseUrl
  validateConfig(config)
  return { config, secrets }
}

export function validateConfig(config: AppConfig): void {
  if (config.provider !== 'openai') throw new AgentError('config', `unsupported provider '${config.provider}'`)
  if (!config.model) throw new AgentError('config', 'model must be a non-empty string')
  try {
    new URL(config.baseUrl)
  } catch {
    throw new AgentError('config', `invalid baseUrl '${config.baseUrl}'`)
  }
  if (!existsSync(config.docsDir)) throw new AgentError('config', `docsDir '${config.docsDir}' does not exist`)
  for (const [name, n] of Object.entries(config.limits)) {
    if (!Number.isInteger(n) || n <= 0) {
      throw new AgentError('config', `limit ${name} must be a positive integer, got ${n}`)
    }
  }
  if (config.mode !== 'regular' && config.mode !== 'verbose') {
    throw new AgentError('config', `invalid mode '${config.mode}'`)
  }
}

export function saveEnv(rootDir: string, secrets: Secrets): void {
  const envPath = resolve(rootDir, ENV_FILE)
  let out = ''
  if (secrets.apiKey) out += `${ENV_KEY}=${secrets.apiKey}\n`
  if (secrets.baseUrl) out += `${ENV_BASE_URL}=${secrets.baseUrl}\n`
  writeFileSync(envPath, out, { encoding: 'utf8', mode: 0o600 })
  chmodSync(envPath, 0o600)
}

export function apiKeyStatus(secrets: Secrets): string {
  return secrets.apiKey ? 'set' : 'missing'
}