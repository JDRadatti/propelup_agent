# PropelUp AI Take-home Exercise

A single-agent CLI that answers questions about a fictional startup using two
tools (keyword search + document retrieval). The model decides when to call
them, cites its sources, and openly admits when the documents don't answer.

## Setup

### 1. Install

```
npm install
```

### 2. Run the agent

```
npm run start
```

First run prompts for an API key and base URL, saved to .env (gitignored). Any OpenAI-compatible endpoint works; set OPENAI_BASE_URL / OPENAI_MODEL to switch, and OPENAI_MODE=verbose to include the full step trace in the output.

### 3. Tests and checks

```
npm run test        # Vitest; golden cases need OPENAI_API_KEY
npm run typecheck   # TypeScript check only (no emit)
```

### 4. Read the planning docs

```
npm run docs:dev
```

## Approach

Please refer to the [Planning Documentation](docs/index.md) for more information on each component's design and the tradeoffs considered while planning.

Agent Loop:
- send conversation + tool list -> model returns answer or tool calls -> run the tool, append result -> repeat.
- Agent loop finishes if one of the five conditions is met: 1) agent finished with no more tool calls, 2) token budget hit, 3) tool call limit hit, 4) max turn limit hit, or 5) fatal error.

CLI/Output:
- CLI consists of an input area where the user can prompt the agent about the documentation
- Outputs as a raw json object showing the resulting answer, sources, stopReason, stats (tokens, tool calls, reads); OPENAI_MODE=verbose also includes the full step trace (steps).

Security:
- The agent does not have any filesystem or shell scripting capabilities.
- Documents are read once at startup into memory, so the corpus is fixed for the session.
- The model never sees filesystem paths, only document ids.

Tools:
- All tools use the same interface, making it very easy to add more tools.
- All tools use an in-memory list of documents; the corpus ids are injected into the system prompt so the model can address them.
- A list of all tools is sent via JSON request body to the LLM provider. The agent decides which tools to call and the arguments.

Available Tools:
- search_documents: Searches a document by keyword and returns every document that
  matches. Uses DocumentIndex: tokenizes both sides,
  builds a postings map at startup, scores each doc by number of distinct query
  words it contains, ranks by score then by id (stable order).
- get_document: Returns full contents by document id (id = filename minus .txt) via an in-memory Map<string, string>.

Testing:
- Unit suite (Vitest): no network: the loop's three limits and tool-failure
  recovery, the tool runner (args validation, no-hit results that list
  available ids), config precedence and secret handling, and the system-prompt
  builder. Run with `npm run test`.
- Golden suite (real API): key-gated: skipped unless OPENAI_API_KEY is set.
  Checks the model really uses the tools: reads and sources on summarization
  (both phrasings), honesty (the agent admits when the documents don't contain
  an answer), no system-prompt leakage, and stops within limits. Run it against
  any OpenAI-compatible endpoint (OPENAI_BASE_URL).
- Checks: `npm run typecheck` for types, `npm run docs:build` for the docs site.
- Manual:  [Manual Testing](docs/manual-testing.md) has the interactive steps.
- [Testing Documentation](docs/components/testing.md) for more information.

Dependencies:
- No agent frameworks for simplicity.
- Dev dependencies for the Planning documentation and Vitest.

## Future Steps

- Add Session, Memory, and Caching
- Documents are assumed to be small and fit in memory. Once larger documents are required, we would need to rethink and optimize how the search feature works.
- Consider updating the agent loop to be declarative
- Add tools and other features based on specific use cases. For example, could add file system tools such as grep/glob/find or shell/python scripting. However, this would require much more testing.
- Update CLI UX
- Improve testing with more sample documents, examples, and LLM-as-judge, and CI/CD.

