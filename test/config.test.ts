import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { AgentError } from '../src/errors'
import { apiKeyStatus, loadConfig, saveEnv, validateConfig, type AppConfig } from '../src/config'

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'propelup-'))
  mkdirSync(join(dir, 'data/documents'), { recursive: true })
  return dir
}

describe('config', () => {
  it('applies defaults and reads only apiKey/baseUrl from .env', () => {
    const root = tempRoot()
    writeFileSync(
      join(root, '.env'),
      'OPENAI_API_KEY=sk-secret-123\nOPENAI_BASE_URL=https://proxy.example.com/v1\nOTHER=ignored\n',
    )
    const { config, secrets } = loadConfig(root)
    expect(secrets.apiKey).toBe('sk-secret-123')
    expect(secrets.baseUrl).toBe('https://proxy.example.com/v1')
    expect(config.baseUrl).toBe('https://proxy.example.com/v1')
    expect(config.model).toBe('gpt-4o-mini')
    expect(config.limits).toEqual({ maxTurns: 8, maxToolCalls: 8, maxTokens: 4000 })
    expect(config.mode).toBe('regular')
    rmSync(root, { recursive: true })
  })

  it('supports a process-env API key as a fallback', () => {
    const root = tempRoot()
    process.env.OPENAI_API_KEY = 'sk-proc-fallback'
    const { secrets } = loadConfig(root)
    expect(secrets.apiKey).toBe('sk-proc-fallback')
    delete process.env.OPENAI_API_KEY
    rmSync(root, { recursive: true })
  })

  it('keeps the api key out of the config object by construction', () => {
    const root = tempRoot()
    writeFileSync(join(root, '.env'), 'OPENAI_API_KEY=sk-top-secret\n')
    const { config, secrets } = loadConfig(root)
    expect(JSON.stringify(config)).not.toContain('sk-top-secret')
    expect(JSON.stringify({ config, secrets })).toContain('sk-top-secret')
    expect(apiKeyStatus(secrets)).toBe('set')
    rmSync(root, { recursive: true })
  })

  it('reports a missing api key as missing, not an error', () => {
    const root = tempRoot()
    const { secrets } = loadConfig(root)
    expect(secrets.apiKey).toBeUndefined()
    expect(apiKeyStatus(secrets)).toBe('missing')
    rmSync(root, { recursive: true })
  })

  it('validates config eagerly and fails on each breakage', () => {
    const root = tempRoot()
    const good = loadConfig(root).config

    const badDocs = { ...good, docsDir: resolve('/definitely/missing/dir') }
    expect(() => validateConfig(badDocs)).toThrowError(AgentError)
    expect(() => validateConfig(badDocs)).toThrowError(/docsDir/)

    const badBaseUrl = { ...good, baseUrl: 'not a url' }
    expect(() => validateConfig(badBaseUrl)).toThrowError(/baseUrl/)

    const badMode = { ...good, mode: 'loud' as AppConfig['mode'] }
    expect(() => validateConfig(badMode)).toThrowError(/mode/)

    const badLimit = { ...good, limits: { maxTurns: 0, maxToolCalls: 8, maxTokens: 4000 } }
    expect(() => validateConfig(badLimit)).toThrowError(/maxTurns/)

    const badProvider = { ...good, provider: 'anthropic' as AppConfig['provider'] }
    expect(() => validateConfig(badProvider)).toThrowError(/provider/)
    rmSync(root, { recursive: true })
  })

  it('sets the .env file mode to 600 on save', () => {
    const root = tempRoot()
    saveEnv(root, { apiKey: 'sk-x', baseUrl: 'https://api.openai.com/v1' })
    const mode = statSync(join(root, '.env')).mode & 0o777
    expect(mode).toBe(0o600)
    rmSync(root, { recursive: true })
  })
})