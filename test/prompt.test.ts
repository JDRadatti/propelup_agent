import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '../src/agent/prompt'

describe('buildSystemPrompt', () => {
  it('lists the loaded document ids', () => {
    const prompt = buildSystemPrompt(['project-update', 'meeting-notes'])
    expect(prompt).toContain('project-update')
    expect(prompt).toContain('meeting-notes')
  })

  it('instructs that the tools are the only window and summaries require tools', () => {
    const prompt = buildSystemPrompt(['project-update'])
    expect(prompt).toMatch(/only ever see them through the two tools/i)
    expect(prompt).toMatch(/never answer such a request without using the tools/i)
    expect(prompt).toMatch(/never claim the documents are unavailable/i)
  })

  it('handles an empty corpus', () => {
    expect(buildSystemPrompt([])).toContain('none')
  })
})