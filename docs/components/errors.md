Index: [Home](../index.md)

# Component: Error handling

## Overview

One error model spans the loop, the tools, and the CLI. Failures split into two
classes:

- **Recoverable** - anything the model can act on. Malformed tool calls,
  unknown tool names, and tool-level failures become `ToolResult`
  `{ ok: false, message }` and are surfaced to the model, which may self-correct
  (retry, rephrase, or answer with what it has).
- **Terminal** - anything the loop cannot proceed from. Model API failures,
  configuration errors, and unexpected internal exceptions stop the loop with
  `stopReason: 'error'`, carry an `error` field on the result, and make the CLI
  exit non-zero.

Terminal errors still produce a full `TurnResult` (partial answer, steps,
stats, and the error), so the CLI emits one uniform JSON shape whether the turn
succeeded, stopped on a limit, or failed. Stopping limits are not errors; they
are normal exits and keep their own `stopReason`.

## Diagram

```
   recoverable path                     terminal path
   ─────────────────                    ─────────────────
   tool call                             ModelClient throws
        │                                / timeout / 5xx
        ▼                                      │
   runTool validates+executes                  ▼
        │                              AgentError('model')
        ▼                                      │
   ToolResult { ok:false, message }            ▼
        │                              catch at loop boundary
        ▼                                      │
   fed back to model (self-correct)            ▼
        │                               TurnResult {
        └──► loop continues               stopReason: 'error'
                                           error: { code, message },
                                           answer, steps, stats }
                                                  │
                                                  ▼
                                           CLI: print JSON on stdout,
                                                stack to stderr,
                                                exit 1
```

## Code structures

Planned TypeScript data model (subject to sign-off on the component's TODO
section).

```ts
type ErrorCode = 'model' | 'tool' | 'config' | 'internal'

class AgentError extends Error {
  constructor(code: ErrorCode, message: string)
  readonly code: ErrorCode
}

interface TurnResultError {
  code: ErrorCode
  message: string
}
```

- `model` - the model API failed: timeout, HTTP error, malformed response.
- `tool` - a tool cannot run at all (for example an unreadable `docsDir` at
  construction). Normal tool failures do not use this; they are recoverable
  `ToolResult` failures.
- `config` - invalid settings or environment (largely prevented by CLI setup,
  so it rarely reaches the loop).
- `internal` - an unexpected exception: a bug. The stack goes to stderr; the
  JSON contract on stdout stays intact.

`TurnResult` gains an optional field (extending the agent component):

```ts
interface TurnResult {
  answer: string
  sources: Source[]
  stopReason: StopReason
  steps: Step[]
  stats: Stats
  error?: TurnResultError   // present only when stopReason is 'error'
}
```

## Input

- Recoverable errors enter through `ToolResult` failure messages; the loop
  feeds them to the model as the eleventh decision documented in the agent
  component (malformed calls surface to the model).
- Terminal errors enter through thrown `AgentError`s, caught at the loop
  boundary.

## Output

- On a terminal error: a full `TurnResult` with `stopReason: 'error'` and an
  `error: { code, message }` field, plus whatever partial answer, steps, and
  stats were accumulated.
- The CLI prints that JSON on stdout (the machine contract) and any stack trace
  on stderr, then exits 1. All failures exit 1; the `error.code` in the JSON is
  what distinguishes them.
- Configuration problems caught during CLI setup also exit non-zero (see the
  CLI component), before any JSON is produced.

## Testing strategy

- Runner: a throwing tool is wrapped into `{ ok: false, message }` (recoverable
  path), never rethrown.
- Loop boundary: a stubbed `ModelClient` that throws `AgentError('model')`
  yields `stopReason: 'error'`, `error.code === 'model'`, and the partial
  answer preserved.
- CLI: an agent `stopReason: 'error'` prints a single JSON object containing
  the `error` field and the process exits with code 1 (spawn-level or unit
  test).
- Setup failures exit non-zero with a readable message and no JSON.
- Limits still end with their own `stopReason` and no `error` field - assert
  limits are not misreported as errors.

## Error handling

- Recoverable tool errors are never rethrown or logged as failures; they are
  model input.
- Model API failures fail fast: no retry. Predictable and simple; retries are
  future work.
- Unexpected exceptions are caught once at the loop boundary, classified
  `internal`, and crash nothing - the CLI still exits cleanly with JSON.
- Stopping limits are hard caps and normal exits, not errors.

## Alternative approaches considered / tradeoffs

- **Single error class with codes vs. class hierarchy vs. bare strings.**
  Chosen: single class plus a code union. Callers switch on a string, the loop
  maps it to `stopReason`/exit behavior, and the taxonomy never overshoots the
  scope.
- **Fail fast vs. retry.** Chosen: fail fast. Retrying adds timing state to a
  deterministic prototype; transient retries are future work once the model
  client exists.
- **Single exit code vs. granular codes.** Chosen: single exit 1. Scripts only
  need success/failure now; `error.code` in the JSON carries the detail.
- **Full `TurnResult` on error vs. thrown minimal JSON vs. stripped result.**
  Chosen: full result. One uniform output shape, and the trace is preserved
  exactly when debugging is hardest.