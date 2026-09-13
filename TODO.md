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
- [x] tooling scaffold (7867c08)
    - [x] add dev deps (typescript, tsx, vitest, @types/node) and scripts (start/test/typecheck) (7867c08)
    - [x] tsconfig (strict, ESM) and vitest config (7867c08)
    - [x] sample-docs fixture in data/documents + .gitignore (committed root files only) (7867c08)
    - [x] drop deprecated v1/ entry from .gitignore (7867c08)

## Agent (design doc: docs/components/agent.md)

- [x] shared data model in src/types.ts (6112875)
    - [x] StopReason, Limits, Stats (6112875)
    - [x] ToolCall, Source, Step, Message (6112875)
    - [x] TurnResult (+ error?), TurnResultError, ErrorCode (6112875)
- [x] system prompt and rules of engagement (src/agent/prompt.ts) (5f88518)
- [x] ModelClient interface + OpenAI adapter via raw fetch (src/agent/model.ts) (5f88518)
    - [x] schema serialization and tool-use parsing (5f88518)
    - [x] map model failures to AgentError('model') (5f88518)
- [x] while-loop control (src/agent/loop.ts) (e15c53b)
    - [x] serial tool execution, steps trace, partial answer on stop (e15c53b)
    - [x] three hard limits (maxTurns, maxToolCalls, maxTokens) -> partial answer (e15c53b)
    - [x] sources from retrieved docs, soft quotes, error mapping at boundary (e15c53b)
- [x] stub ModelClient + loop tests (48132c1)

## Tools (design doc: docs/components/tools.md)

- [x] ToolDefinition + ToolResult types (5956737)
- [x] tool runner (src/tools/runner.ts) (5956737)
    - [x] unknown tool / bad args -> failed result (5956737)
    - [x] wrap thrown exceptions into { ok:false } (5956737)
    - [x] countsRead increments Stats.reads on success only (5956737)
- [x] builtinTools(docsDir) wiring (5956737)

## Search (design doc: docs/components/search.md)

- [x] tokenizer with offsets (case-insensitive, strip punctuation) (a79ca6c)
- [x] DocumentIndex build once at startup (token -> postings, doc tokens) (a79ca6c)
- [x] scoring: token-overlap, stable tiebreak, all matches ordered (a79ca6c)
- [x] verbatim best-match excerpt per hit (a79ca6c)
- [x] blank query -> { ok:false }; no matches -> { ok:true, hits:[] } (5956737)
- [x] key unit tests (48132c1)

## Retrieve (design doc: docs/components/retrieve.md)

- [x] loadDocs(docsDir) -> Document[] (id = filename, sorted) (a79ca6c)
- [x] retrieve tool (verbatim text, returns by id from shared map) (5956737)
- [x] unknown/blank id -> { ok:false } with hint to search first (5956737)
- [x] key unit tests (verbatim, unknown, blank, empty docsDir, reads) (48132c1)

## Errors (design doc: docs/components/errors.md)

- [x] AgentError with ErrorCode union (model | tool | config | internal) (6112875)
- [x] TurnResult.error? only on stopReason 'error'; partial answer/steps/stats kept (e15c53b)
- [x] recoverable path: tool failures surface to the model via ToolResult (5956737)
- [x] terminal path: catch at loop boundary, classify, no retry (e15c53b)
- [x] CLI: JSON on stdout, stack to stderr, exit code 1 (0da1e0c)
- [x] key tests (throwing tool wrapped, model error -> stopReason 'error') (48132c1)

## Output & stats

- [x] output. should it show thinking? - decided: verbose mode includes the step trace
- [x] Stats recorded (tokens, tool calls, reads) and printed in the JSON result (e15c53b, 0da1e0c)

## Security (design doc: docs/components/security.md)

- [x] secrets confined to .env: gitignored, masked prompts, chmod 600 at setup (53fe3e1, 0da1e0c)
- [x] masked startup status ('api key: set' / 'missing'), never the value (0da1e0c)
- [x] secrets excluded from TurnResult/steps/stats and stdout (test with sentinel key) (48132c1)
- [x] setup permission test (chmod 600) and trusted-corpus rules documented (48132c1, 60f14da)

## Configuration (design doc: docs/components/config.md)

- [x] code defaults (provider openai, model gpt-4o-mini, docsDir, limits, mode) (53fe3e1)
- [x] .env read only for apiKey/baseUrl; precedence defaults < .env (53fe3e1)
- [x] loadConfig -> frozen AppConfig + Secrets (apiKey never dumps to stdout) (53fe3e1)
- [x] eager validateConfig: mode enum, positive limits, known provider, valid baseUrl, readable docsDir (53fe3e1)
- [x] missing apiKey routes to CLI setup, not a config error (53fe3e1)
- [x] key tests (precedence, secrecy, validation failures, defaults) (48132c1)

## CLI (design doc: docs/components/cli.md)

- [x] print settings at startup (secrets masked) (0da1e0c)
- [x] first-run setup: masked prompts for api key (and base url), save to .env with chmod 600 (0da1e0c)
- [x] prompt for a question, run agent, print JSON (answer, sources, stopReason, stats) (0da1e0c)
- [x] mode: regular omits steps; verbose includes the step trace (0da1e0c)
- [x] REPL: repeat until the user exits or Ctrl-C (0da1e0c)
- [x] agent/config errors: JSON on stdout, stack to stderr, exit code 1 (0da1e0c)
- [x] docs/manual-testing.md with edge cases for the manual test pass (1cdfd57)

## Testing (design doc: docs/components/testing.md)

- [x] Vitest wired into `npm test` (7867c08)
- [x] super-important unit tests (tools, loop, config, security) - not a huge suite (48132c1)
- [x] golden-case suite, key-gated (real API, temperature 0, soft assertions) (48132c1)
    - [x] good-result case (key facts, sources, tool trajectory) (48132c1)
    - [x] bad-result cases (fabrication, wrong sources, prompt leakage, runaway guard) (48132c1)
    - [x] missing-information acknowledgment check (48132c1)

## Feedback fixes

- [x] support switching provider/model at launch (fadf073)
    - [x] OPENAI_MODEL process-env override on top of the code default (fadf073)
    - [x] document overrides (OpenRouter example) in manual-testing, README, config.md (4ee76a8)
- [x] stop tool-less answers for "loaded documents / summarize" (be320d8)
    - [x] buildSystemPrompt(ids) injects loaded corpus + grounding rules (be320d8)
    - [x] LoopOptions.systemPrompt threading; CLI and golden build from ids (be320d8)
    - [x] prompt unit tests and golden summarize case asserting reads (be320d8)
    - [x] re-verified summarization end-to-end: 4 calls, 3 reads, 3 sources (be320d8)
- [x] fix phrasing-sensitive summarization (plural vs singular) (643b9e2)
    - [x] rule 2/4: overviews skip search and get_document every listed id (643b9e2)
    - [x] forbid literal summarize/summary/overview as search terms (643b9e2)
    - [x] no-hit search output lists available ids as recovery path (643b9e2)
    - [x] golden summary case covers weak and strong phrasings, asserts reads (643b9e2)
    - [x] docs (agent.md, manual-testing.md) sync (80273f5)
- [x] OPENAI_MODE env override for verbose output (e7aa3d8)
    - [x] config reads OPENAI_MODE; invalid values fail eager validation (e7aa3d8)
    - [x] config tests: verbose override + invalid mode throws (e7aa3d8)
    - [x] README + config.md + manual-testing.md document the override (pending)

## Future work (backlog)

Deferred ideas are tracked in `docs/future.md` (sessions/memory, retrieval &
RAG, tool scale-out, multi-agent, UX, reliability, security hardening, testing
& evals, configuration additions). Nothing here is scheduled; an item moves
into implementation when pulled forward and given a design doc plus a sign-off
checklist above.
