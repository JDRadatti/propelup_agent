# PropelUp AI Take-home Exercise

A tiny, single-agent TypeScript CLI that answers questions about a fictional
startup from three sample documents. The agent is given two tools -
`search_documents` (keyword search) and `get_document` (retrieve full contents)
- and decides when to call them. Answers reference their sources and
acknowledge missing information. No UI, deployment, or external data
integrations.

## Setup

### 1. Install

```
npm install
```

### 2. Run the agent

```
npm run start
```

First run prompts for an OpenAI API key (hidden input) and an optional base URL,
then saves them to `.env` with mode 600. `.env` is gitignored. To skip the
prompts, export `OPENAI_API_KEY` (and optionally `OPENAI_BASE_URL`) first.

### 3. Tests and checks

```
npm run test        # Vitest; golden cases need OPENAI_API_KEY
npm run typecheck   # TypeScript check only (no emit)
```

### 4. Read the planning docs

```
npm run docs:dev
```

The planning site (VitePress) covers the full design:
`docs/index.md` indexes the per-component design docs, `docs/manual-testing.md`
explains how to drive the agent by hand, and `docs/future.md` tracks deferred
ideas.

## Approach

- Minimal dependencies: raw `fetch` to the Chat Completions API; no runtime
  deps, no SDK.
- Two composable tools on a small, constructor-injected tool runner that
  validates args, wraps failures into `{ ok: false }` results, and counts
  reads.
- In-memory `DocumentIndex` built at startup: token-overlap keyword scoring,
  stable ordering, and a verbatim best-match excerpt per hit.
- A serial while-loop with three hard limits (turns, tool calls, tokens),
  partial answers on stop, tool-failure recovery, and verbatim-quote extraction
  from retrieved documents into `sources`.
- Terminal errors fail fast into a stable `error.code`, JSON on stdout, exit
  code 1; secrets are confined to `.env`.