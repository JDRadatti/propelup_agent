Index: [AGENTS.md](AGENTS.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [docs](docs/index.md)

# Take-home exercise

Build a simple agent that answers questions about a fictional startup using
these three sample documents:

    Project update: The pilot is planned for October 1. Development is
    complete, but security review and customer onboarding remain outstanding.

    Meeting notes: Maya owns the security review and is waiting for the
    vendor’s questionnaire. Daniel owns onboarding and needs the customer
    contact list.

    Customer update: The customer can provide its contact list next week and
    has asked whether the October 1 launch is still achievable.

Give the agent two tools: one to search the documents and one to retrieve a
document’s contents. Simple keyword search is fine. The model should choose
when to call the tools and answer a question such as: “What is blocking our
pilot launch, and what should we do next?” Its answer should reference its
sources and acknowledge missing information.

Please include a stopping limit and basic tool-error handling. Any language or
framework is welcome, and using AI coding tools is encouraged. A command-line
prototype is sufficient. No UI, deployment, or external data integrations
needed.

design principles
- extensible 
- secure
- testing considered from start
- simple. single agent
- transparent. shows thinking, api stats, etc

# Component TODO lists

Per-component checklists. Each component is planned in `docs/components/<name>.md`
and implemented only after its checklist is signed off (see `AGENTS.md`).

## Tooling & research

- [x] setup AGENTS.md and ARCHITECTURE.md
- [x] pick tooling - TypeScript, minimal dependencies
- [ ] tooling scaffold
    - [ ] add dev deps (typescript, tsx, vitest, @types/node) and scripts (start/test/typecheck)
    - [ ] tsconfig (strict, ESM) and vitest config
    - [ ] sample-docs fixture in data/documents + .gitignore (committed root files only)
    - [ ] drop deprecated v1/ entry from .gitignore

## Agent (design doc: docs/components/agent.md)

- [ ] shared data model in src/types.ts
    - [ ] StopReason, Limits, Stats
    - [ ] ToolCall, Source, Step, Message
    - [ ] TurnResult (+ error?), TurnResultError, ErrorCode
- [ ] system prompt and rules of engagement (src/agent/prompt.ts)
- [ ] ModelClient interface + OpenAI adapter via raw fetch (src/agent/model.ts)
    - [ ] schema serialization and tool-use parsing
    - [ ] map model failures to AgentError('model')
- [ ] while-loop control (src/agent/loop.ts)
    - [ ] serial tool execution, steps trace, partial answer on stop
    - [ ] three hard limits (maxTurns, maxToolCalls, maxTokens) -> partial answer
    - [ ] sources from retrieved docs, soft quotes, error mapping at boundary
- [ ] stub ModelClient + loop tests

## Tools (design doc: docs/components/tools.md)

- [ ] ToolDefinition + ToolResult types
- [ ] tool runner (src/tools/runner.ts)
    - [ ] unknown tool / bad args -> failed result
    - [ ] wrap thrown exceptions into { ok:false }
    - [ ] countsRead increments Stats.reads on success only
- [ ] builtinTools(docsDir) wiring

## Search (design doc: docs/components/search.md)

- [ ] tokenizer with offsets (case-insensitive, strip punctuation)
- [ ] DocumentIndex build once at startup (token -> postings, doc tokens)
- [ ] scoring: token-overlap, stable tiebreak, all matches ordered
- [ ] verbatim best-match excerpt per hit
- [ ] blank query -> { ok:false }; no matches -> { ok:true, hits:[] }
- [ ] key unit tests

## Retrieve (design doc: docs/components/retrieve.md)

- [ ] loadDocs(docsDir) -> Document[] (id = filename, sorted)
- [ ] retrieve tool (verbatim text, returns by id from shared map)
- [ ] unknown/blank id -> { ok:false } with hint to search first
- [ ] key unit tests (verbatim, unknown, blank, empty docsDir, reads)

## Errors (design doc: docs/components/errors.md)

- [ ] AgentError with ErrorCode union (model | tool | config | internal)
- [ ] TurnResult.error? only on stopReason 'error'; partial answer/steps/stats kept
- [ ] recoverable path: tool failures surface to the model via ToolResult
- [ ] terminal path: catch at loop boundary, classify, no retry
- [ ] CLI: JSON on stdout, stack to stderr, exit code 1
- [ ] key tests (throwing tool wrapped, model error -> stopReason 'error')

## Output & stats

- [x] output. should it show thinking? - decided: verbose mode includes the step trace
- [ ] Stats recorded (tokens, tool calls, reads) and printed in the JSON result

## Security (design doc: docs/components/security.md)

- [ ] secrets confined to .env: gitignored, masked prompts, chmod 600 at setup
- [ ] masked startup status ('api key: set' / 'missing'), never the value
- [ ] secrets excluded from TurnResult/steps/stats and stdout (test with sentinel key)
- [ ] setup permission test (chmod 600) and trusted-corpus rules documented

## Configuration (design doc: docs/components/config.md)

- [ ] code defaults (provider openai, model gpt-4o-mini, docsDir, limits, mode)
- [ ] .env read only for apiKey/baseUrl; precedence defaults < .env
- [ ] loadConfig -> frozen AppConfig + Secrets (apiKey never dumps to stdout)
- [ ] eager validateConfig: mode enum, positive limits, known provider, valid baseUrl, readable docsDir
- [ ] missing apiKey routes to CLI setup, not a config error
- [ ] key tests (precedence, secrecy, validation failures, defaults)

## CLI (design doc: docs/components/cli.md)

- [ ] print settings at startup (secrets masked)
- [ ] first-run setup: masked prompts for api key (and base url), save to .env with chmod 600
- [ ] prompt for a question, run agent, print JSON (answer, sources, stopReason, stats)
- [ ] mode: regular omits steps; verbose includes the step trace
- [ ] REPL: repeat until the user exits or Ctrl-C
- [ ] agent/config errors: JSON on stdout, stack to stderr, exit code 1
- [ ] docs/manual-testing.md with edge cases for the manual test pass

## Testing (design doc: docs/components/testing.md)

- [ ] Vitest wired into `npm test`
- [ ] super-important unit tests (tools, loop, config, security) - not a huge suite
- [ ] golden-case suite, key-gated (real API, temperature 0, soft assertions)
    - [ ] good-result case (key facts, sources, tool trajectory)
    - [ ] bad-result cases (fabrication, wrong sources, prompt leakage, runaway guard)
    - [ ] missing-information acknowledgment check

## Future work (backlog)

Deferred ideas are tracked in `docs/future.md` (sessions/memory, retrieval &
RAG, tool scale-out, multi-agent, UX, reliability, security hardening, testing
& evals, configuration additions). Nothing here is scheduled; an item moves
into implementation when pulled forward and given a design doc plus a sign-off
checklist above.
