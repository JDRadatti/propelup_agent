Index: [Home](../index.md)

# Component: Testing framework

## Overview

One primary testing strategy: **golden-example behavioral tests**. The real
agent runs against the three sample documents using a fixed set of golden
questions, and the result is checked with property assertions: what a good
answer contains (facts, sources, tool behavior) and what a bad answer must not
do (fabrication, wrong sources, unnecessary tool calls, leakage).

This follows a "good results vs. bad results" model. Because LLM outputs are
non-deterministic, checks assert *properties of the output*, not exact text.
Runs use temperature 0 and each critical case runs several times to keep flakes
measurable rather than silent.

Runner: **Vitest** (added dev dependency; ergonomics and watch mode outweigh the
extra dependency for the purpose of this project).

## Diagram

```
    sample docs (fixture)         golden cases (fixture)
              │                          │
              ▼                          ▼
        ┌────────────────────────────────────┐
        │  run agent (loop + tools)          │
        │  question -> TurnResult            │
        └───────────────────────┬────────────┘
                                │
                                ▼
        ┌────────────────────────────────────┐
        │  assertions on TurnResult          │
        │  good checks + bad checks          │
        └───────────────────────┬────────────┘
                                │
                                ▼
        ┌────────────────────────────────────┐
        │  Vitest report                     │
        │  pass/fail per case + reasons      │
        └────────────────────────────────────┘
```

## Code structures

Planned TypeScript data model (subject to sign-off on the component's TODO
section). Golden cases are a versioned fixture kept alongside the tests.

```ts
interface ExpectedSource {
  id: string
  quotes?: string[]  // passages the answer must quote
}

interface GoldenCase {
  id: string
  question: string
  category: 'direct' | 'tool' | 'missing-info' | 'edge' | 'adversarial'
  expects: {
    keyFacts: string[]        // answer must contain >= minRequired of these
    minRequired: number
    sources: ExpectedSource[] // citations the answer must carry
    toolTrajectory?: string[] // expected tool call sequence, e.g. ['search', 'retrieve']
  }
  grounding?: {
    // Every value extracted from the answer in these classes MUST be in these
    // sets, which are derived from the sample docs. Catches invented
    // dates/names generically: any date other than October 1 fails, no need to
    // foresee the exact lie.
    dates: string[]
    names: string[]
    other?: Record<string, string[]>
  }
  rejects?: {
    forbiddenPhrases: string[]  // leaked internals (system prompt, tool names); NOT fabricated values
    forbiddenSources?: string[]
    noUnnecessaryTools?: boolean
  }
}
```

## Input

- The three sample documents as a fixture (`docsDir`).
- The golden-case set: 10-15 handcrafted cases tagged by category (direct,
  tool, missing-info, edge, adversarial), versioned with the code.
- A configured model provider; eval runs use temperature 0.

## Output

- Vitest report: per-case pass/fail with the failing assertions and the actual
  values, plus an aggregate pass rate.

## Testing strategy

The single primary strategy, unfolded:

1. **Soft key-fact assertions** - the answer contains at least `minRequired` of
   `keyFacts` (no exact-match assertions; LLM wording varies).
2. **Source citations and quotes** - the cited document IDs match
   `expects.sources`, and any expected quotes appear verbatim inside the cited
   document's text (containment check), since the model may paraphrase rather
   than quote exactly.
3. **Tool trajectory** - `TurnResult.steps` reflects the expected sequence
   (for example search before retrieve), and no tool is called for a question
   that can be answered directly.
4. **Schema validity** - `TurnResult` is well-formed JSON matching the shape in
   the agent component.
5. **Missing-information handling** - out-of-scope questions produce an
   answer that acknowledges the gap instead of inventing one.
6. **Grounded values (fabrication check)** - date-like and name-like tokens are
   extracted from the answer, and every one must belong to `grounding`, the
   only dates and names that exist in the corpus. This catches fabricated
   values generically: `October 12`, `October 15`, or a made-up owner all fail
   with a single assertion, without foreseeing the exact value.
7. **Bad-result checks** - no leaked internals from
   `rejects.forbiddenPhrases`, no wrong document cited, and stopping limits
   are honored (no runaway loops).

Because the fixture is only three documents, the corpus vocabulary is small and
fully enumerable (`dates: ["October 1"]`, `names: ["Maya", "Daniel"]`, ...).
Extraction uses simple patterns (date-like and capitalized-name tokens), then
checks set membership. Guessing the wrong fake date in advance is not required
- any value outside the corpus is a failure.

Determinism handling: temperature 0 for eval runs, each critical case runs N
times (for example 3), and a flaky case is investigated rather than disabled.

## Error handling

- A failed test reports which assertion failed and what the agent actually
  produced, so the failure is actionable.
- A case that fails once but passes across reruns is flagged as flaky and
  investigated; a case that fails consistently is a real regression.

## Alternative approaches considered / tradeoffs

- **Golden property tests vs. exact-match snapshots.** Chosen: property tests.
  Snapshots flake on non-determinism; property checks answer "is this good
  enough and grounded enough?" instead of "is this byte-identical?".
- **Assertions only vs. LLM-as-judge now.** Chosen: assertions only. They are
  deterministic, cheap, and need no extra API spend; a judge is added later for
  open-ended quality grading.
- **Hardcoded forbidden phrases vs. grounded-value extraction.** Chosen:
  extraction plus membership in the corpus vocabulary for dates/names, because
  hardcoded phrases only catch the lies you predicted. Clearly wrong static
  strings (system prompt) still use phrase checks.
- **Doc-ID citations vs. quote-level grounding.** Chosen: both. Quotes are
  checked as verbatim containment within the cited documents, which is cheap
  to assert and catches misattribution; semantic quote verification is future
  work.
- **Assertions-only grounding vs. semantic grounding.** Chosen: assertion-based
  extraction for now. It cannot catch a paraphrased false claim; semantic
  grounding is deferred with LLM-as-judge.
- **Vitest vs. node:test.** Chosen: Vitest. It adds a dev dependency but buys
  assertion ergonomics, watch mode, and a cleaner report.
- **One primary strategy vs. many now.** Chosen: one, per project preference.
  Everything else stays deferred until the golden suite is green.