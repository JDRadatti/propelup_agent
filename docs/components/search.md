Index: [Home](../index.md)

# Component: Document search tool

## Overview

Search is the first concrete tool on the `ToolDefinition` contract. The model
calls `search(query)` to find candidate documents before deciding which one to
retrieve. It searches an in-memory index built once at startup, scores each
document by how many query terms match, and returns every matching document
ordered by that score with a stable tiebreak.

The corpus here is only three documents, so search is deliberately simple:
token-overlap scoring, no ranking refinements beyond ordering, no result cap.
Its job is to answer "which documents are relevant?" with a faithful preview;
relevance answers are the model's, not the search engine's.

## Diagram

```
        model
          │  search(query)
          ▼
   ┌──────────────────────────────┐
   │  search tool                 │
   │  DocumentIndex (in memory)   │
   │  tokenize query              │
   │  score docs by term overlap  │
   │  order by score, tiebreak    │
   └──────────────┬───────────────┘
                  │  ToolResult
                  ▼
   { ok:true; hits: [{ id, excerpt, matched }] }
   (or { ok:false; message } on a blank query)
                  │
                  ▼
        model decides: retrieve / answer
```

## Code structures

Planned TypeScript data model (subject to sign-off on the component's TODO
section). Built with the shared tool contract from the tool interface
component.

```ts
interface SearchArgs {
  query: string
}

interface SearchHit {
  id: string        // document id
  excerpt: string   // verbatim passage around the best match
  matched: string[] // query terms found in the document
}

interface Document {
  id: string
  text: string
}
```

Indexing and matching:

```ts
function loadDocs(docsDir: string): Document[]

class DocumentIndex {
  constructor(docs: Document[])   // build inverted index once
  search(query: string): SearchHit[]  // ordered, stable tiebreak
}
```

- `builtinTools(docsDir)` builds a `DocumentIndex` at construction from
  `loadDocs(docsDir)` and exposes it as a `ToolDefinition` named `search`.
- Tokenization: lowercase, strip punctuation, collapse whitespace. Applied to
  query and documents the same way.
- Scoring: a document scores by the number of distinct query terms it
  contains. Higher is better; equal scores tiebreak on document order
  (stable, deterministic).
- A hit's `excerpt` is a short verbatim window around the best-scoring match
  inside the document, so the model sees the exact passage before retrieving.

## Algorithm

### Data structures

- `Document[]` - the corpus, loaded once at construction (`id`, `text`).
- Per-document token arrays with text offsets (`{ term, start, end }[][]`) so
  excerpts are sliced from the original text, never re-joined, keeping them
  verbatim.
- Inverted index: `Map<term, number[]>` mapping each normalized term to the
  document indices that contain it, built once at startup.
- Per-search accumulator `Map<number, number>` (document index to score), reset
  each query and bounded by corpus size.

Scoring is distinct-term overlap with a stable tiebreak, as signed off in this
component. TF-IDF and BM25 would slot into the same index as swappable
scorers; they are deliberately deferred (see [docs/future.md](../future.md)).

### Expected runtime

- Index build: O(T) time and O(T) space, where T is the total number of tokens
  in the corpus. Runs once at construction.
- Search:
  - tokenize the query: O(q), q = query token count
  - look up each query term in the inverted index: O(q) hash lookups
  - score by walking matched posting lists: worst case O(q * N), N = documents
  - sort the k <= N hits: O(k log k)
  - passage window per matched document: O(t), t = tokens in that document
- Overall search is O(q + q*N + k log k). At this corpus size (three short
  documents) every term is effectively constant.

### Data constraints

- Static three-document corpus loaded at startup; no live documents, no
  persistence, no network.
- Tokens are lowercase, punctuation-stripped, whitespace-collapsed, applied
  identically to queries and documents.
- All matching documents are returned (k <= 3); there is no result cap.
- Search is a deterministic pure function of the query: identical input always
  yields the same ordered hits.

## Input

- `SearchArgs.query` - the user's natural-language question or phrase, passed
  by the model.
- A blank or whitespace-only query is invalid and returns
  `{ ok: false, message }` without searching.

## Output

- `{ ok: true, hits: SearchHit[] }` with hits ordered by score (document order
  on ties). Every matching document is returned; there is no cap.
- `{ ok: true, hits: [] }` when nothing matches - a valid outcome, not an
  error. The model should answer that the information is not in the documents.
- `{ ok: false, message }` only for a blank query.

## Testing strategy

Unit tests against the sample docs (fixture matches the exercise corpus):

- `"October 1"` hits `project-update` (and `customer-update`, which mentions
  the launch date).
- `"security review"` hits `project-update` and `meeting-notes`, in stable
  order.
- `"pilot"` hits `project-update` and `customer-update`.
- Case-insensitivity: `"OCTOBER 1"` matches `"October 1"`.
- `excerpt` is always a verbatim substring of the cited document.
- Equal-score documents return in deterministic order across runs.
- Blank query returns `{ ok: false, message }`; `"pricing"` (no match) returns
  `{ ok: true, hits: [] }`.

Composability (search-then-retrieve trajectories) is covered by the golden
case suite.

## Error handling

- Blank query - validation failure, tool not executed.
- Missing/empty `docsDir` - surfaced at construction by `builtinTools`;
  a search over an empty index simply returns `{ ok: true, hits: [] }`.
- No other failure modes: matching is pure local computation, so the tool
  never crashes and never talks to the network.

## Alternative approaches considered / tradeoffs

- **In-memory index at startup vs. scanning every call vs. persisted index.**
  Chosen: in-memory index built once. Fast, simple, and correct for a static
  three-document corpus; a persisted index adds invalidation complexity with
  no payoff at this size.
- **Token-overlap scoring vs. substring match vs. term-count only.** Chosen:
  token-overlap scoring with a stable tiebreak. Substring matching is blind to
  slight rewording; term-count alone makes ties less predictable.
- **Best-match excerpt vs. full text vs. first-N characters.** Chosen:
  best-match excerpt. Full text is redundant with retrieve; first-N characters
  can miss the matched passage. A verbatim excerpt previews relevance without
  replacing retrieve.
- **Success with empty hits vs. failed result vs. default-to-something.**
  Chosen: success with `{ ok: true, hits: [] }`. "Nothing matches" is a normal
  search outcome the model should acknowledge, not a tool failure.
- **All matches vs. configurable limit.** Chosen: all matches. With three
  documents a cap is unneeded; a `limit` argument is future work if the corpus
  grows.