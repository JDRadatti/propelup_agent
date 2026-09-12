Index: [Home](../index.md)

# Component: Document retrieve tool

## Overview

Retrieve is the second concrete tool on the `ToolDefinition` contract. The
model calls `retrieve(id)` after search has picked a candidate, and the tool
returns that document's full text verbatim so the model can read it and quote
from it. Answers cite sources from these retrieved texts; quotes are
soft-matched against the returned text in tests.

Retrieve shares the corpus loaded once at startup with search (same
`builtinTools(docsDir)` construction), looked up by id. It returns the whole
document, so reading cost is bounded by `maxTokens`, not by a truncation
policy. It never fabricates: an id that is not a real document is a failed
result that tells the model to search first.

## Diagram

```
        model
          │  retrieve({ id })
          ▼
   ┌──────────────────────┐
   │  retrieve tool       │
   │  corpus: id -> text  │
   │  (shared with search)│
   └──────────┬───────────┘
              │
              ▼
   known id ──yes──▶ { ok:true; content: text }   (verbatim, pure)
      │ (no)
      ▼
   { ok:false; message: 'no document with id X; try search first' }
              │
              ▼
        model answers / quotes from text
```

## Code structures

Planned TypeScript data model (subject to sign-off on the component's TODO
section). Built with the shared tool contract from the tool interface
component.

```ts
interface RetrieveArgs {
  id: string
}
```

- `builtinTools(docsDir)` loads the corpus once and shares it between search
  and retrieve (a `Map<id, Document>` lookup, plus the search index).
- Retrieve is registered as a `ToolDefinition` named `retrieve` with
  `countsRead: true`, so the runner increments `Stats.reads` on success.
- No truncation, no metadata: success output is the document text exactly as
  read from the source.

## Input

- `RetrieveArgs.id` - a document id. Valid ids come from search results; the
  model may also guess.
- The corpus is the same static three-document set loaded at startup; there is
  no per-call file system access.

## Output

- `{ ok: true, content: string }` - the document's full text, verbatim and
  alone (no id header, no wrapped metadata). Quotes in the answer should be
  substrings of this content.
- `{ ok: false, message: string }` - an unknown or blank id, with a hint to
  search first, so the model can recover: `no document with id '<id>'; try
  search first`.
- A successful retrieve increments `Stats.reads`; a failed one does not.

## Testing strategy

Unit tests against the sample docs (fixture matches the exercise corpus):

- A valid id (`project-update`, `meeting-notes`, `customer-update`) returns
  that document's exact text, byte-identical to the fixture.
- The content contains no id header or added metadata.
- An unknown id (`"billing"`) returns `{ ok: false, message }` with the search
  hint and does not increment `reads`.
- A blank id returns `{ ok: false, message }`.
- An empty `docsDir` makes every id unknown (`{ ok: false }`).
- Multiple successful retrieves increment `reads` by that count.

Quote soft-containment (expected quotes appear in the retrieved text) is
covered by the golden case suite.

## Error handling

- Unknown or blank id - failed result with a search hint; the tool never
  throws, matching the tool interface contract.
- Empty `docsDir` - surfaced at construction by `builtinTools`; a retrieve
  over an empty corpus finds every id unknown.
- `reads` is incremented by the runner only on success, so failure stats stay
  honest.

## Alternative approaches considered / tradeoffs

- **Full text always vs. truncation.** Chosen: full text. The documents are a
  few sentences and `maxTokens` already bounds reading cost; a truncation
  policy adds parameters for no current benefit.
- **Failed unknown-id result vs. not-found text vs. closest doc.** Chosen:
  failed result with a hint to search first. It fits the typed-result contract
  and coaches the model; returning fake content would hide a bad id.
- **Pure text vs. inline id header.** Chosen: pure text. Soft-matched quotes
  land directly against returned content, and search already labeled the id.
- **Runner counts reads now vs. deferring to output/stats.** Chosen: count now.
  A `countsRead` flag on the tool keeps deps constructor-injected while the
  runner owns the counter.