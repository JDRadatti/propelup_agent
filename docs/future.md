Index: [Home](index.md)

# Future work (roadmap)

Nothing here is scheduled for the prototype. Each item is deferred until a
trigger fires - a real need, a growth in scope, or an explicit decision to pull
it forward. When an item is picked up, it gets its own design doc under
`docs/components/` and a sign-off checklist in `TODO.md`, per the workflow in
`AGENTS.md`.

This document is the single registry for deferred ideas, threaded by theme.
When an item is picked up, it gets its own design doc under `docs/components/`
and a sign-off checklist in `TODO.md`.

## Sessions and memory

- **Multi-turn conversations and session persistence** - resume a conversation
  across CLI sessions. Deferred: single-question turns suffice today. Trigger:
  users ask follow-ups. Source: cli, agent.
- **Conversation trees and forking** - branch, resume, and compare conversation
  states (linear -> tree -> fork). Deferred: it builds on persistence. Trigger:
  exploration-style sessions. Source: cli.
- **Cross-session memory** - durable facts learned across sessions. Deferred:
  a design problem of its own. Trigger: sessions exist and prove worth.
- **Multi-turn tests** - golden cases spanning sessions; they depend on
  sessions existing. Source: testing.

## Retrieval and RAG

- **Embedding/vector search** - semantic (not keyword) matching. Deferred:
  keyword search meets the requirement. Trigger: corpus grows or queries
  paraphrase. Source: search.
- **Hybrid search** - keyword + vector fused; builds on vector search.
- **Reranking** - a second scoring pass over top hits. Source: search.
- **Stemming and typo tolerance** - normalize morphological variants and
  spelling errors. Source: search.
- **Truncation with a marker** - cap long document text. Deferred: corpus is
  tiny and `maxTokens` bounds reads. Source: retrieve.
- **Persisted index** - cache the built index to skip rebuild. Source: search.
- **Live or synced corpus, batch retrieve, metadata surface** - re-load
  changed documents; fetch several at once. Source: retrieve.

## Tool scale-out

- **More tools: filesystem and external tools** - grows the extension surface;
  each new tool gets its own security review. Source: tools, security.
- **Parallel tool calls per turn** - run independent calls together. Deferred:
  serial keeps traces simple. Source: agent, tools.
- **Generated, validated argument schemas** as the tool set grows. Source:
  tools.

## Multi-agent

- **Sub-agents and planners** - a planner that delegates work. Deferred: single
  agent is a stated principle. Trigger: scope grows enough to warrant it.
  Source: agent.
- **Parallel agent exploration** - several agents working separate strands.

## Interaction and UX

- **Streaming** the model's answer to the terminal. Source: cli, agent.
- **`--pretty`** indented result JSON. Source: cli.
- **CLI flags and one-shot question arguments** (`--config`, `question`).
  Source: cli.
- **Config file** for non-secret settings (model, limits, mode). Source: cli,
  configuration.
- **REPL polish** - history, line editing, multi-line input.

## Reliability

- **Retry with backoff** for transient model failures (fails fast today).
  Source: errors.
- **Configurable model request timeout** - currently a fixed value. Source:
  errors.
- **Granular exit codes** per `error.code` (single exit 1 today). Source:
  errors, cli.
- **Structured stderr logging** and a diagnostics stream. Source: errors.
- **Error telemetry** distilled into saved stats. Source: errors, output.

## Security hardening

- **UPIA/XPIA tooling** - scripted injection cases and content sanitation once
  untrusted documents are supported. Source: testing, security.
- **OS keychain** for the API key. Source: security.
- **Key rotation and re-setup flows.** Source: security, configuration.
- **Spend/rate caps** in configuration. Source: security, configuration.
- **Custom CA / TLS pinning** for custom base URLs. Source: security.
- **Sandboxing** model/tool execution if tools ever leave local reads. Source:
  security.

## Testing and evals

- **LLM-as-judge** - weighted rubric with hard-fail hallucination caps.
  Source: testing, agent.
- **Red teaming** - manual plus scripted injection sessions. Source: testing,
  security.
- **Synthetic golden queries** for coverage beyond handcrafted cases. Source:
  testing.
- **Reference-free production evals** on real traffic. Source: testing.
- **Performance tests** - tokens, latency, stopping-limit behavior. Source:
  testing.

## Configuration additions

- **Config file** for non-secret settings - see Interaction and UX.
- **CLI flags and environment-variable precedence** layered over merged
  config. Source: configuration.
- **Model/limits/mode overrides** without editing code defaults. Source:
  configuration.
- **Key rotation** - see Security hardening.