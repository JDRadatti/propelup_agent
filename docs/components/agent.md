Index: [Home](../index.md)

# Component: Agent control loop

## Overview

The agent is the single-entity brain of the CLI. It runs a plain while-loop:
send the user's question plus tool definitions to the model, let the model
decide between **calling a tool** and **answering**, execute the chosen tool,
feed its result back, and repeat until the model answers or a stopping limit is
hit. The loop enforces three independent stopping limits: **turn-based**,
**tool-call based**, and **token-based**. The first limit reached stops the
loop. Tool calls run **serially**, one per model turn. When a limit stops the
loop early, any partial answer is surfaced rather than discarded.

Tools are the extension point: any new tool registers with the loop and gets
advertised to the model without changing loop behavior.

## Diagram

```
        user question
              │
              ▼
     ┌─────────────────┐
     │   agent loop    │
     └───────┬─────────┘
             │  send: question + tool defs
             ▼
     ┌─────────────────┐   tool call   ┌──────────────┐
     │   model (LLM)   │ ────────────▶ │  tool runner │
     │                 │               │  (one shot)  │
     └───────┬─────────┘               └──────┬───────┘
             │ answer / stop                   │ result
             │                                 ▼
             ▼                                 │
     ┌─────────────────────┐                  │
     │  output + stats     │ ◀────────────────┘
     └─────────────────────┘
```

Loop exits when (a) the model answers, (b) any stopping limit is reached, or
(c) a terminal error occurs.

## Code structures

Planned TypeScript data model (subject to sign-off on the component's TODO
section). Minimal dependencies; only what TypeScript requires.

```ts
type StopReason = 'answer' | 'turn-limit' | 'tool-limit' | 'token-limit' | 'error'

interface Stats {
  tokensSent: number
  tokensReceived: number
  toolCalls: number
  reads: number
}

interface Limits {
  maxTurns: number      // hard cap on model calls in this turn
  maxToolCalls: number  // hard cap on tool executions in this turn
  maxTokens: number     // hard cap on cumulative tokens (sent + received)
}

interface ToolCall {
  name: string
  arguments: Record<string, unknown>
}

interface Source {
  id: string         // document ID
  quotes?: string[]  // verbatim passages that back the answer
}

type Step =
  | { kind: 'model'; content?: string; toolCalls?: ToolCall[]; tokensSent: number; tokensReceived: number }
  | { kind: 'tool'; name: string; arguments: Record<string, unknown>; result: string }

type Message =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls: ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string }
  | { role: 'assistant'; content: string } // final answer

// Thin adapter so providers can swap without touching the loop. OpenAI-only
// for now.
interface ModelClient {
  chat(messages: Message[]): Promise<{
    content?: string
    toolCalls?: ToolCall[]
    usage: { inputTokens: number; outputTokens: number }
  }>
}
```

## Input

The public entry point and everything it takes.

```ts
function runAgent(question: string, options: LoopConfig): Promise<TurnResult>

interface LoopConfig {
  model: ModelClient     // LLM client (provider + API key)
  tools: ToolDefinition[]  // tools advertised to the model; see tools component
  limits: Limits         // the three stopping limits
}
```

- `question` - the user's natural-language question
- `options.model` - the LLM client the loop calls each iteration
- `options.tools` - the tools the model may call; the built-in search and retrieve
- `options.limits` - the three stopping limits: `maxTurns` (turn-based),
  `maxToolCalls` (tool-call based), and `maxTokens` (token-based). The first
  limit reached stops the loop.

## Output

What the loop returns.

```ts
interface TurnResult {
  answer: string          // final answer text (partial if stopped early)
  sources: Source[]       // cited documents, with optional quotes
  stopReason: StopReason  // how the turn ended
  steps: Step[]           // every loop iteration, in order
  stats: Stats            // tokens, tool calls, reads
  error?: TurnResultError // present only when stopReason is 'error'; type from the errors component
}
```

- `answer` - the final text shown to the user; may be a partial answer if the
  loop stopped early
- `sources` - the cited documents, each with its ID and optional verbatim
  quotes backing the answer. Quotes are soft-matched (contained in the
  document's text), since the model may paraphrase.
- `stopReason` - `'answer'` (normal exit), `'turn-limit'`, `'tool-limit'`, or
  `'token-limit'` (a stopping limit was hit, and which one), or `'error'`
  (terminal failure)
- `steps` - the full per-iteration trace: one entry per model call and per tool
  execution, in order. Always recorded by the loop; whether the CLI exposes it
  is a presentation choice (see the CLI component).
- `stats` - tokens sent/received, `toolCalls`, `reads`
- `error` - present only when `stopReason` is `'error'`: a `{ code, message }`
  pair classifying the terminal failure (see the errors component)

## Error handling

- Tool failures surface as tool-result errors to the model, not crashes, so the
  model can react (retry, ask for clarification, or answer with what it knows).
- Model/timeout failures are caught at the loop boundary and reported with a
  clear stop reason.
- The three limits are hard caps; the first one reached stops the loop
  gracefully with its specific `stopReason` and any partial answer.

## System prompt and rules

The system prompt is an instruction block sent with every conversation (it is
the only system message; the user question is data, see the security
component). It is built per run by `buildSystemPrompt(ids)` in
`src/agent/prompt.ts`, which injects the loaded document id list so the agent
knows what the CLI actually has. It is the behavioral contract the golden test
suite asserts against, so its rules map one-to-one onto the testing component's
checks.

Draft:

```text
You are the assistant for PropelUp, a fictional startup. You answer questions
about the company using two tools:

- search_documents: keyword search over the company documents. Returns
  matching document ids with a verbatim excerpt.
- get_document: retrieve the full verbatim contents of one document by id.

The CLI loaded a fixed set of documents at startup: <ids>. You only ever see
them through the two tools - you have no other access, and the tools always
work. Never claim the documents are unavailable or that you have not loaded
them.

Rules:
1. Ground every factual claim in the document text returned by the tools.
   Verify facts with the tools before answering.
2. Decide what the request wants before using tools:
   - Whole-corpus overview: if asked to summarize, list, or give an overview
     of "the documents", "the document", "the company", or "what you loaded",
     skip search_documents and get_document every id listed above (those ids
     always exist), then synthesize with citations.
   - Anything else: search first with search_documents, then get_document the
     matching ids, and answer from the retrieved text - never from search
     excerpts alone.
   Never search for the literal words summarize, summary, or overview. Treat a
   no-hit search as "broaden your terms", never as "the corpus is empty". Never
   answer such a request without using the tools.
3. Cite your sources, e.g. "according to project-update (meeting-notes,
   customer-update)". Prefer short quoted snippets from the documents.
4. If the documents do not contain an answer, say so plainly instead of
   guessing. A keyword search with no hits is not proof of absence - try other
   terms, or for whole-corpus requests read the listed ids directly.
5. Do not invent document ids. If get_document fails, search again for the
   correct id.
6. Be concise. If a tool call fails, fix it and continue instead of stopping.
```

Why each rule exists:

1. **Grounding** - backs the testing component's grounded-value and
   fabrication checks (a date or name outside the corpus fails).
2. **Tool use** - the model decides when to call tools (the chosen tradeoff)
   but is steered toward search-then-retrieve; the summarization instruction
   routes whole-corpus overviews straight to the listed ids (guaranteeing
   reads and sources) and forbids searching for the literal word "summary".
   Backs the tool-trajectory assertions.
3. **Citations** - produces the `sources` on `TurnResult` that the CLI prints
   and the golden cases assert (ids plus quotes).
4. **Missing-info acknowledgment** - required by the exercise; backed by the
   missing-information golden case. A no-hit search is explicitly not "proof of
   absence", so the model broadens or reads the listed ids instead of giving
   boilerplate.
5. **Doc-ids not invented** - keeps the model honest about ids and encodes the
   recoverable tool-failure path.
6. **Concision** - keeps answers cheap and readable.

The prompt is built once per CLI run from the loaded documents, so it is not
recorded in `steps`; the trace stays focused on model calls and tool
executions.

## Alternative approaches considered / tradeoffs

Architecture:

- **Single agent vs. multi-agent.** Chosen: single agent. The exercise calls
  for one agent, and "simple" is a stated principle. Sub-agents/planner styles
  are future work if the scope grows.
- **Plain while-loop vs. declarative step list.** Chosen: while-loop, for
  simplicity. A step list makes loop features declarative but adds an
  abstraction; revisit only if the loop outgrows itself.
- **Serial tool calls vs. parallel tool calls per turn.** Chosen: serial. One
  tool per model turn keeps each trace easy to reason about and test; parallel
  calls are future work.
- **Remote model for the LLM vs. external services for tools.** Chosen: the LLM
  is a remote hosted call; the tools are plain local functions. Search and
  retrieve need no network access, keeping the prototype simple and the
  security surface small.

Control:

- **One global stopping limit vs. three independent limits.** Chosen: three
  limits (turn, tool-call, token). Each bounds a distinct resource, so a model
  that never settles cannot silently balloon a different dimension. The lowest
  threshold's `stopReason` reports which limit fired.
- **Partial answer on stop vs. discarding it.** Chosen: surface the partial
  answer. The last model output before a stop is still useful, and it is cheap
  because the loop already holds it.
- **Model decides freely vs. forced search-first policy.** Chosen: the model
  decides when to call tools, guided by rules of engagement. A forced
  search-first policy would guarantee grounding but contradicts the
  requirement that the model choose when to call the tools.

Model & I/O:

- **Remote hosted model vs. local model.** Chosen: remote hosted. OpenAI models
  only for now, via a thin client; more providers can be added later.
- **Thin `ModelClient` adapter vs. direct provider SDK.** Chosen: thin adapter.
  One `chat(messages)` surface means a provider swap does not touch the loop.
- **Full message history resend vs. window/compaction.** Chosen: full resend
  each iteration for the prototype. The conversation is small; compaction is
  future work.

Output:

- **Doc-ID sources vs. quote-level citations.** Chosen: both. Sources carry the
  document ID and optional verbatim quotes. Quotes are soft-matched (contained
  in the cited document) because the model may paraphrase; semantic quote
  matching is future work.

Robustness:

- **Fail-fast on malformed tool calls vs. surface to the model.** Chosen:
  surface as a tool error so the model can self-correct instead of crashing.
- **Sources-accuracy enforcement: rules now, hard stop later.** Chosen: prompt
  rules and tests for now; hard automated enforcement is the future
  LLM-as-judge's job.