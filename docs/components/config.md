Index: [Home](../index.md)

# Component: Configuration

## Overview

Configuration is **defaults plus `.env` / process-env overrides**, merged once
at startup and validated eagerly. The split is by sensitivity: secrets (api
key, optional custom base URL) live in `.env`; non-secret settings (provider,
model, limits, mode, `docsDir`) default in code. The model can be switched per
run with the `OPENAI_MODEL` env var, and the endpoint with
`OPENAI_BASE_URL`; everything else changes by editing the defaults until a
config file exists (future work).

Precedence is flat and predictable: `code defaults < .env < process env`. The
resulting `AppConfig` is immutable after load. Validation runs at startup so every
misconfiguration surfaces as a clear `AgentError('config')` before the user is
prompted for anything; a missing api key is not an error but a trigger for the
CLI's first-run setup.

## Diagram

```
   code defaults ────────┐
                          ▼
   .env (apiKey, baseUrl) ──▶ merge ──▶ validate ──▶ AppConfig (frozen)
                                          │
              invalid e.g. bad mode/limits/baseUrl
                                          ▼
                               AgentError('config')
                                          │
                                          ▼
                               CLI: message + non-zero exit
```

## Code structures

Planned TypeScript data model (subject to sign-off on the component's TODO
section).

```ts
interface AppConfig {
  provider: string           // 'openai'
  model: string              // 'gpt-4o-mini'
  apiBaseUrl?: string        // only when a custom endpoint is needed
  docsDir: string            // default: bundled sample docs
  limits: Limits             // the three stopping limits
  mode: 'regular' | 'verbose'
}

type Secrets = {
  apiKey?: string            // never in config dumps, logs, or stdout
  baseUrl?: string
}

function loadConfig(env: NodeJS.ProcessEnv): { config: AppConfig; secrets: Secrets }

function validateConfig(config: AppConfig): void   // throws AgentError('config')
```

Defaults:

```ts
const DEFAULTS = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  docsDir: <bundled sample docs>,
  limits: { maxTurns: 8, maxToolCalls: 8, maxTokens: 4000 },
  mode: 'regular',
}
```

- `.env` is read only for `apiKey` and `baseUrl`; `apiKey` presence maps to the
  masked startup status in the CLI component, and a missing one routes to
  first-run setup rather than failing validation.
- `apiBaseUrl`/`baseUrl` is the only secret-adjacent setting that can be a
  custom endpoint; it must validate as an `https?` URL when present.
- The model name can be overridden per run via `OPENAI_MODEL` (process env
  only, not `.env`), e.g. `OPENAI_MODEL=openai/gpt-4o-mini npm run start` when
  pointing at OpenRouter. `apiKey` and `baseUrl` are read from `.env` first and
  may be overridden by `OPENAI_API_KEY` / `OPENAI_BASE_URL` process env vars.

## Input

- `.env` (secrets), the in-code defaults, and optional process-env overrides
  (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`); nothing else. There is
  no config file in this version.
- Validation inputs: `mode` (enum), `limits` (positive integers), provider
  (recognized), `baseUrl` (URL shape if present), `docsDir` (exists, readable).

## Output

- A frozen `AppConfig` handed to the CLI for startup printing (secrets masked,
  see the CLI and security components) and to the agent loop / `builtinTools`
  for construction.
- The `Secrets` value is passed directly to the model client and never flows
  into `TurnResult`, `steps`, `stats`, or stdout.

## Testing strategy

- **Precedence**: a `.env` override wins over a default; absent `.env` values
  leave defaults intact.
- **Secrecy**: `loadConfig` produces no `toString`/dump that includes
  `apiKey`; a sentinel key never appears in any printed output (overlaps the
  security component's stdout test).
- **Validation**: bad `mode`, zero/negative limits, unknown provider, invalid
  `baseUrl`, and a missing `docsDir` each raise `AgentError('config')` with a
  message naming the offending field.
- **Defaults**: no `.env` yields provider `openai`, model `gpt-4o-mini`,
  `mode: 'regular'`, and positive default limits.
- **Missing api key**: flagged as needing setup (not a config error).

## Error handling

- Any validation failure is `AgentError('config')` at startup; the CLI prints
  the offending field and exits non-zero (errors component).
- An unreadable `.env` is a config error, not a prompt (see security: setup
  enforces permissive failures closed).
- A missing `apiKey` is the one non-terminal state; it hands control to the
  CLI's first-run setup prompt.

## Alternative approaches considered / tradeoffs

- **.env + code defaults vs. config file now vs. env vars only.** Chosen:
  defaults plus a secret-only `.env`. One file to manage, matches the CLI setup
  flow, and keeps the config file as documented future work.
- **Validate at startup vs. lazily vs. never.** Chosen: eager startup
  validation. Misconfigurations surface deterministically before any prompt;
  lazy checks make failures contextual and confusing.
- **defaults < .env vs. single source vs. layered env precedence.** Chosen:
  flat `defaults < .env`. Predictable and trivially testable; a priority chain
  buys nothing at this scope.
- **Default model gpt-4o-mini vs. gpt-4o vs. prompt-for-it.** Chosen:
  `gpt-4o-mini`. Cheap and sufficient for retrieval-style answers over three
  short documents; a stronger default adds cost without correctness value.