Index: [TODO.md](TODO.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [docs](docs/index.md)

# AGENTS.md - propelup

## About

PropelUp take-home exercise: build a simple, single-agent TypeScript CLI that
answers questions about a fictional startup using two tools (one to search
documents, one to retrieve a document's contents). The model decides when to
call the tools, and answers reference sources and acknowledge missing
information.

Current status: implementation phase. Design is complete; code lives in
`src/` and is being built component by component.

## Workflow

1. **Plan first.** Every component gets a design doc at
   `docs/components/<name>.md` before any code is written for it. Use relevant
   sections: overview, diagram, data model, APIs/inputs/outputs, testing
   strategies, error handling, future work, and alternative
   approaches/tradeoffs. Use code blocks where relevant.
2. **TODO section.** Each component has its own section in `TODO.md`, using
   nested checklists:

   ```
   ## <Component>

   - [ ] task 1
       - [ ] subtask 1
       - [ ] subtask 2
   - [ ] task 2
   ```
3. **Approve every change.** Draft the component's TODO section *before*
   implementing it, present it, and wait for explicit approval before writing
   code for that component. Pause for approval on any change to the agreed
   design, cli/output behavior, or plans. Nothing user-visible is implemented
   or changed without explicit go-ahead.
4. **Docs sync.** After every approved change, update the relevant planning
   docs (`docs/components/*.md`, `ARCHITECTURE.md`, `docs/index.md`) so they
   stay the source of truth. Record, don't duplicate.
5. **Consult on changes & failures.** Always stop and consult the user before
   proceeding if:
   - Implementation requires changing the agreed plan or design doc.
   - Tests fail or unexpected errors break the build during execution.
   - You encounter architectural edge cases not covered in the original sign-off.
6. **Check off as you go.** Mark subtasks `[x]` as they are completed and append
   the commit hash that completed them. Items added during implementation that
   belong to future work stay `[ ]` and are listed in `docs/future.md`.

## Commits

- One commit per subtask when practical; short, single-subject commits that
  TypeScript and the tests stay green after.
- Commit message format - a short subject line, then labeled sections. The
  subject's leading verb is one of `change`, `update`, `testing`, `rename`,
  `remove`, `delete`, etc.:

  ```
  short, concise description

  change:
  - change 1
  - change 2

  update:
  - update 1
  - update 2
  ```
- Record the resulting commit hash next to the subtask in `TODO.md`.

## Commands

- `npm run start` - run the agent CLI
- `npm run test` - run tests (Vitest); golden cases run only with an API key set
- `npm run typecheck` - TypeScript check only (no emit)
- `npm run docs:dev` - run the planning site locally (VitePress)
- `npm run docs:build` - build the planning site
- `npm run docs:preview` - preview the built site

## Repo structure

- `docs/` - VitePress planning site
- `docs/components/<name>.md` - per-component design docs
- `docs/future.md` - deferred ideas / roadmap
- `docs/manual-testing.md` - how to test the finished agent by hand
- `TODO.md` - requirements and per-component checklists (status source of truth)
- `ARCHITECTURE.md` - repo-level design doc and component index
- `src/` - agent implementation (TypeScript, ESM)
- `data/documents/` - the three sample documents (the agent's corpus)

## Design principles

- **Extensible** - easily add tools; composable control loop
- **Secure** - security defaults defined and enforced
- **Testing from the start** - testability designed in, not bolted on
- **Simple** - a single agent, no premature complexity
- **Transparent** - shows thinking, API stats, and reads

## Conventions

- TypeScript with minimal external dependencies.
- Requirements live in `TODO.md`; design decisions land in `docs/` (repo-level
  in `ARCHITECTURE.md`, per-component in `docs/components/`). Record, don't
  duplicate.
- `.env` holds secrets. Never read, log, echo, or commit it.
- If commands in docs disagree with `package.json`, `package.json` wins - fix the doc.
- Minimal code comments.
