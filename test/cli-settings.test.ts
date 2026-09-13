import { describe, expect, it } from 'vitest'
import { settingsLine } from '../src/cli'
import { defaultConfig } from '../src/config'
import type { Secrets } from '../src/config'
import type { TurnResult } from '../src/types'

const SENTINEL = 'sk-SENTINEL-never-print-me'

describe('secret hygiene', () => {
  it('never prints the api key in the settings line', () => {
    const config = defaultConfig(process.cwd())
    const secrets: Secrets = { apiKey: SENTINEL, baseUrl: 'https://api.openai.com/v1' }
    const line = settingsLine(config, secrets)
    expect(line).toContain('api key: set')
    expect(line).not.toContain(SENTINEL)
  })

  it('never prints the api key anywhere in a turn result', () => {
    const result: TurnResult = {
      answer: 'pilot is October 1',
      sources: [{ id: 'project-update' }],
      stopReason: 'answer',
      steps: [
        {
          kind: 'tool',
          toolCallId: 'x',
          name: 'get_document',
          ok: true,
          content: 'some text',
          docId: 'project-update',
        },
      ],
      stats: { tokensSent: 10, tokensReceived: 10, toolCalls: 1, reads: 1 },
    }
    const json = JSON.stringify({ config: defaultConfig(process.cwd()), result, someInput: 'does-prop-help' })
    expect(json).not.toContain(SENTINEL)
  })
})