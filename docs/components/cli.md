Index: [Home](../index.md)

# Component: CLI interaction

## Overview

The CLI is the entry point to the product. It starts by printing the current
config/settings (secrets masked), then runs a first-run setup step that prompts
for anything essential and missing (like the API key and, if needed, a base
URL) and saves those values to `.env`. Once setup is complete, it asks the user
to ask a question, runs the agent, and returns the result as JSON. The session
is a REPL: it keeps asking questions and printing JSON until the user exits.
A `mode` setting controls output: `regular` (default) prints each answer as a
single JSON result; `verbose` adds the full per-iteration trace of the loop
(model turns, tool calls, and reads) to that JSON.

## Diagram

```
        start
          │
          ▼
        print config/settings (secrets masked)
          │
          ▼
   setup needed? ───yes─▶ prompt api key / base url
          │  (no)             │
          ▼                   ▼
   prompt: ask a question  save to .env
          │                   │
          ▼                   │
   run agent (loop +       ───┘
   tools)
          │
          ▼
   print result as JSON (answer, sources, stopReason, stats)
          │
          ▼
   another question? ───yes─▶ (loop)
          │  (exit: Ctrl-D / 'exit')
          ▼
        end
```

## Code structures

Planned TypeScript data model (subject to sign-off on the component's TODO
section).

```ts
interface AppConfig {
  provider: string
  model: string
  apiBaseUrl?: string   // only present when a custom endpoint is needed
  docsDir: string
  limits: Limits        // from the agent control loop component
  mode: 'regular' | 'verbose'  // how much the result JSON shows
}

interface CliResult {   // printed as JSON
  question: string
  answer: string
  sources: Source[]     // cited documents, with optional quotes
  stopReason: StopReason
  stats: Stats
  steps?: Step[]        // per-iteration trace, included only in verbose mode
}
```

## Input

- Invocation: `propelup` (interactive, no arguments in this version).
- Reads `.env` for existing values; prompts only for essentials that are
  missing:
  - **API key** - required; input is masked while typing; never echoed.
  - **Base URL** - asked only if a custom endpoint is needed; skipped when the
    default provider endpoint is used.
- Reads the `mode` setting (`regular` default, or `verbose`) from config; it is
  not prompted for.
- Prompts the user for the **question** once setup is complete.

### No added context, on purpose

The CLI intentionally passes the question through as-is. It does not inject
background about the fictional startup, document summaries, or framing meant to
steer the model. Answers therefore reflect only what the agent retrieves, and
the agent must acknowledge when the documents lack the information.

## Output

- At startup, prints config/settings: provider, model, docs directory, limits,
  output mode, and masked secret status (for example `api key: set` or
  `api key: missing`).
- For each question, prints a single JSON object on stdout. **Regular mode**
  (default) omits the step trace. **Verbose mode** includes `steps`, one entry
  per model call and per tool execution, in order.

Regular mode:

```json
{
  "question": "What is blocking our pilot launch?",
  "answer": "Security review and customer onboarding are outstanding.",
  "sources": [
    { "id": "project-update", "quotes": ["security review and customer onboarding remain outstanding"] },
    { "id": "meeting-notes", "quotes": ["Maya owns the security review"] }
  ],
  "stopReason": "answer",
  "stats": {
    "tokensSent": 321,
    "tokensReceived": 87,
    "toolCalls": 2,
    "reads": 2
  }
}
```

Verbose mode:

```json
{
  "question": "What is blocking our pilot launch?",
  "answer": "Security review and customer onboarding are outstanding.",
  "sources": [
    { "id": "project-update", "quotes": ["security review and customer onboarding remain outstanding"] },
    { "id": "meeting-notes", "quotes": ["Maya owns the security review"] }
  ],
  "stopReason": "answer",
  "steps": [
    {
      "kind": "model",
      "toolCalls": [{ "name": "search", "arguments": { "query": "pilot launch blockers" } }],
      "tokensSent": 180,
      "tokensReceived": 24
    },
    {
      "kind": "tool",
      "name": "search",
      "arguments": { "query": "pilot launch blockers" },
      "result": "project-update: security review and onboarding remain outstanding"
    },
    {
      "kind": "model",
      "content": "Security review and customer onboarding are outstanding.",
      "tokensSent": 96,
      "tokensReceived": 41
    }
  ],
  "stats": {
    "tokensSent": 276,
    "tokensReceived": 65,
    "toolCalls": 1,
    "reads": 1
  }
}
```

Output is currently compact JSON; an indented (`--pretty`) format is deferred
(see [docs/future.md](../future.md)).

- On failure, prints a JSON error payload (see Error handling) and exits
  non-zero.

## Error handling

- Missing or invalid API key re-prompts until provided or the user aborts.
- Invalid base URL prints a message and re-prompts.
- Agent failure (`stopReason: 'error'`) prints the full result JSON - answer,
  steps, stats, and an `error: { code, message }` field - on stdout and exits
  with code 1. The stack trace goes to stderr only.
- Ctrl-C aborts cleanly mid-prompts or mid-question.

## Alternative approaches considered / tradeoffs

- **Compact JSON now vs. pretty printing now.** Chosen: compact JSON always. It
  is the stated requirement and keeps a single output format; indented
  `--pretty` output is future work so the prototype produces one stable format.
- **Trace inside the result JSON vs. on stderr.** Chosen: inside the result
  JSON, only in verbose mode. This keeps verbose output machine-readable and
  self-contained; a separate stderr/progress channel could be added later.
- **Interactive `.env` setup vs. a config file.** Chosen: `.env` for the
  secrets, because it is the standard location and already gitignored; a
  structured config file is future work as non-secret settings accumulate.
- **REPL vs. one-shot per invocation.** Chosen: REPL, so setup happens once and
  follow-up questions are cheap. A `question` argument for one-shot scripted
  use is future work.