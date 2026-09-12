Index: [Home](../index.md)

# Component: Tool interface

## Overview

Tools are plain local functions behind one uniform interface. The agent loop
drives every tool the same way: it validates the model's arguments, calls the
tool, and turns whatever comes back into a message the model can read next.
Tools never crash the loop - every outcome, including failure, is a result.

This document defines the contract; the two built-ins (document search and
document retrieve) are specified in their own docs. Tools are the extension
point: adding a tool is appending a `ToolDefinition` to the array passed into
`runAgent`, with no change to loop behavior.

## Diagram

```
        model (LLM)
           │
           │  ToolCall { name, arguments }
           ▼
   ┌────────────────────┐
   │  tool runner       │  validate arguments (schema)
   │  runTool(tool)     │  execute
   │                    │  wrap unexpected exceptions
   └─────────┬──────────┘
             │
             │  ToolResult { ok:true; content } | { ok:false; message }
             ▼
   Message.tool (content)  +  Step { kind:'tool', name, arguments, result }
             │
             ▼
        model (LLM)
```

## Code structures

Planned TypeScript data model (subject to sign-off on the component's TODO
section). Minimal dependencies; only what TypeScript requires.

```ts
interface ToolDefinition<TArgs = Record<string, unknown>> {
  name: string                 // unique id the model calls
  description: string          // when to use the tool, what it returns
  parameters: Record<string, unknown>  // JSON schema for `arguments`
  countsRead?: boolean         // true when a success should increment Stats.reads
  execute(args: TArgs): Promise<ToolResult>
}

type ToolResult =
  | { ok: true; content: string }
  | { ok: false; message: string }
```

The runner sits between the loop and the tools:

```ts
function runTool(tool: ToolDefinition, call: ToolCall): Promise<ToolResult>
```

- validates `call.arguments` against `tool.parameters`; invalid arguments
  produce `{ ok: false, message }` without calling `execute`
- calls `execute`, and wraps any thrown exception into a failed result
- an unknown tool name produces a failed result
- a successful execute on a tool with `countsRead: true` increments
  `Stats.reads`; failures never do
- return value becomes `Message.tool`'s content (see the agent component) and
  the `Step { kind: 'tool' }` trace entry

Built-ins share the same shape:

```ts
function builtinTools(docsDir: string): ToolDefinition[]
// search - ordered candidate documents; see search component
// retrieve - full text of one document; see retrieve component
```

## Input

- Tools are registered via the `ToolDefinition[]` passed to `runAgent` in
  `LoopConfig.tools`; the loop advertises each as a JSON-schema tool
  definition to the model.
- Dependencies (like `docsDir`) are injected when the tool is constructed
  (`builtinTools(docsDir)`), never per call. `execute` receives only the
  model's arguments.
- Tool calls arrive as `ToolCall { name, arguments }`; `arguments` must match
  the declared `parameters` schema.

## Output

- A `ToolResult`: success carries the text content shown to the model (search
  candidate list, retrieved document text, and so on); failure carries a
  short message the model can act on.
- The loop copies the result into the next `Message.tool` and records it in
  the `Step` trace, so verbose CLI output shows every tool execution.
- Search results are ordered previews (`{ id, excerpt }` list) that let the
  model pick a document to retrieve; the ranking algorithm is defined in the
  search component.

## Testing strategy

- Unit tests per tool: search returns the expected document set and excerpts,
  retrieve returns the full text, unknown document id and empty `docsDir`
  return `{ ok: false, message }`.
- Runner tests: valid arguments execute; invalid arguments return a failed
  result without executing; a throwing tool is wrapped, not propagated.
- Composability is covered by the golden case suite (search-before-retrieve
  trajectories).

## Error handling

- Tools never throw into the loop. Everything is a `ToolResult`:
  - missing/invalid arguments - validation failure, tool not executed
  - unknown tool name - runner-level failure surfaced to the model
  - unexpected exception inside `execute` - caught and wrapped
- The model sees the failure message and can react (retry, rephrase, or
  answer with what it has); this matches the agent component's rule that tool
  failures surface to the model rather than crashing.

## Alternative approaches considered / tradeoffs

- **Plain object vs. class-based tools.** Chosen: plain object. Two built-ins
  do not justify a base class; the object is declarative and matches
  `LoopConfig.tools`.
- **Typed result union vs. raw strings / thrown errors.** Chosen: typed union.
  A failed tool call is a normal outcome (the model should recover), so it is
  first-class instead of an exception the loop must catch.
- **Model quotes from retrieved text vs. tool-layer auto-citation.** Chosen:
  model-side quoting. Retrieve returns full text; the model picks verbatim
  passages and tests soft-match them. Keeps the tool layer dumb.
- **Constructor-injected dependencies vs. per-call context.** Chosen:
  constructor-injected. `builtinTools(docsDir)`, `execute(args)` only. Less
  plumbing, trivially testable.
- **Explicit `ToolDefinition[]` vs. global registry.** Chosen: explicit array.
  Adding a tool is a local, reviewable change; a registry hides wiring.