Index: [Home](../index.md)

# Component: Security model

## Overview

The prototype's security posture is: **defaults defined, enforced by
construction, and verified by a test**. The threat model is small - this is a
local CLI over three trusted documents - so the defaults stay lean but are
never implicit.

Defaults:

1. **Secrets stay in `.env`**, gitignored, with file permissions pinned to
   `600` at setup.
2. **Only the configured model API is contacted.** The tools are plain local
   functions and never touch the network.
3. **No arbitrary file access.** Retrieve reads an in-memory id-to-document
   map; it never resolves a file path from model input, so it cannot be aimed
   at files outside the corpus.
4. **Secrets never leave the trusted path.** The API key is masked at the
   prompt, reported to the user only as `api key: set` / `api key: missing`,
   and a test asserts it never appears on stdout.
5. **Prompt-injection posture: trusted corpus + rules.** The corpus is our own
   three documents; defense is a system prompt with rules of engagement.
   UPIA/XPIA red teaming is future work (listed in the testing component).

## Diagram

```
          trust boundaries
   ┌──────────────────────────────────────────────┐
   │ trusted                                     │
   │   .env (secrets, chmod 600, gitignored)     │
   │   docs/ corpus (static, id map at startup)  │
   │   configured model API (only network call)  │
   │   system prompt (rules of engagement)       │
   └───────┬──────────────────────┬──────────────┘
           │ user input (data)    │ model responses (data)
           ▼                      ▼
        CLI prompt            stdout JSON
        (never echo key)  (no secret, verified by test)
```

## Code structures

Planned TypeScript utilities (subject to sign-off on the component's TODO
section). Security-relevant helpers live with the CLI/config layer.

```ts
// read non-secret-safe settings and mark which secrets are present
function readEnvSecrets(env: NodeJS.ProcessEnv): {
  apiKey?: string
  baseUrl?: string
}

// startup line: 'api key: set' / 'api key: missing'; never the value
function maskedStatus(apiKey: string | undefined): string

// enforce .env permissions on write (chmod 600)
function enforceEnvPermissions(envPath: string): void
```

- Secrets are read only at config load and passed directly to the model
  client; they never flow through `TurnResult`, `steps`, or `stats`.
- The tool runner has no access to secrets by construction: tools receive only
  their constructor-injected `docsDir` and the model's `arguments`.
- The corpus is the only thing search/retrieve can see; retrieve looks up a
  `Map<id, Document>`, never a filesystem path.

## Input

- `.env` - secret settings, read once, gitignored, `chmod 600`.
- `docsDir` - pinned at construction; tools cannot read outside it.
- User question - treated as data, combined with tool output and system rules
  in the model context; no instructions in user input are ever privileged.

## Output

- Startup status prints masked secret state, never values.
- Result JSON (regular/verbose) has no secrets; a test asserts this.
- Stack traces on stderr for `internal` errors still leak no secrets (see the
  errors component for the stderr/stdout split).

## Testing strategy

- **No-secret-on-stdout test** - run the CLI with a sentinel API key and assert
  the sentinel appears nowhere in stdout (regular and verbose output).
- **Setup test** - creating/updating `.env` yields `600` permissions, and a
  gitignore check ensures it is not commit-able.
- **Boundary tests** - search/retrieve never attempt network or file access
  outside `docsDir` (assert corpus map confinement).
- Adversarial prompt-injection cases (UPIA/XPIA) are future work (testing
  component); the golden suite currently assumes a trusted, static corpus.

## Error handling

- Unreadable or unwritable `.env` at setup - clear message, re-prompt, or
  abort non-zero (config error, per the errors component).
- `chmod` failure - treated as a config error; setup aborts rather than
  writing a loose-permission secrets file.
- No other runtime security errors exist: boundaries are structural, so they
  cannot fail "at runtime" and instead fail closed at setup.

## Alternative approaches considered / tradeoffs

- **.env + chmod 600 vs. OS keychain vs. plain config.** Chosen: `.env` with
  `600` and gitignore. Standard, auditable, matches the existing AGENTS.md
  rule; keychain storage is future work.
- **Masked + output test vs. runtime redaction layer vs. trust only.** Chosen:
  masking plus a stdout sentinel test. Redaction layers are redundant and easy
  to get wrong; trust alone fails the "enforced defaults" principle.
- **Trusted corpus + rules vs. content filtering now vs. full mitigation
  suite.** Chosen: trusted corpus with system-prompt rules for the prototype;
  injection tooling is future work because our own three docs are trusted.
- **Enforcement by construction vs. runtime allowlist.** Chosen: by
  construction. Local tools, an id-map retrieve, and one configured API URL
  make the boundaries structural rather than a layer to maintain.