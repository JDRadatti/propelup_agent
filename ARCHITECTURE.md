Index: [AGENTS.md](AGENTS.md) · [TODO.md](TODO.md) · [docs](docs/index.md)

# Architecture - PropelUp take-home agent

## Status

Planning phase. Requirements live in `TODO.md`; implementation has not started.

## Goals

A simple, single-agent TypeScript CLI that answers questions about a fictional
startup's documents. The agent has two tools - search the documents, and
retrieve a document's contents - and the model decides when to call them.
Answers reference sources and acknowledge missing information.

## Design principles

See `AGENTS.md` for the full set. In short: extensible, secure, testing
designed in from the start, simple (single agent), and transparent (shows
thinking, API stats, and reads).

## Scope

- Two base tools: document search and document retrieval. Simple keyword search
  is sufficient.
- Tools are composable - the model must know when to call which tool.
- Basic tool-error handling and stopping limits (turn, tool-call, and token
  based).
- Record useful stats (tokens sent/received, tool calls, reads).
- Answer source references and acknowledge gaps in the documents.

## Component index

Each component's design doc lives at `docs/components/<name>.md` and its
checklist in `TODO.md`. Docs marked *(planned)* are placeholders not yet
written; components follow the sign-off flow in `AGENTS.md`.

| Component              | Design doc                         | Status      |
| ---------------------- | ---------------------------------- | ----------- |
| Agent control loop     | `docs/components/agent.md`         | In progress |
| CLI interaction        | `docs/components/cli.md`           | In progress |
| Tool interface         | `docs/components/tools.md`         | In progress |
| Document search tool   | `docs/components/search.md`        | In progress |
| Document retrieve tool | `docs/components/retrieve.md`      | In progress |
| Error handling         | `docs/components/errors.md`        | In progress |
| Security model         | `docs/components/security.md`      | In progress |
| Configuration          | `docs/components/config.md`        | In progress |
| Testing strategy       | `docs/components/testing.md`       | In progress |

Stats (tokens, tool calls, reads) are owned by the agent component. A separate
Output & stats doc was dropped; anything surplus lives in the
[future work](docs/future.md) roadmap.

## Open design questions

Tracked in `TODO.md`. Notable ones awaiting decisions:

- Rules of engagement: the agent's decision rules live in the agent component
  (the model decides when to call tools); injection posture is set in the
  security component.