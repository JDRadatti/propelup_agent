Index: [TODO.md](TODO.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [docs](docs/index.md)

# AGENTS.md - propelup

## About

PropelUp take-home exercise: build a simple, single-agent TypeScript CLI that
answers questions about a fictional startup using two tools (one to search
documents, one to retrieve a document's contents). The model decides when to
call the tools, and answers reference sources and acknowledge missing
information.

Current status: planning phase. Implementation has not started.

## Workflow

1. **Plan first.** Every component gets a design doc at
   `docs/components/<name>.md` before any code is written for it. Use relevant
   sections: overview, diagram, data model, APIs/inputs/outputs, testing
   strategies, error handling, future work, and alternative
   approaches/tradeoffs. Use code blocks where relevant.
2. **TODO section.** Each component has its own section in `TODO.md`, following
   the existing style (`## <Component>` heading + `- [ ]` checklist lines).
3. **Sign-off gate.** Draft the component's TODO section *before* implementing.
   Present it to the user and wait for explicit approval before writing code
   for that component. Nothing is implemented without a signed-off checklist.
4. **Consult on changes & failures.** Always stop and consult the user before proceeding if:
   - Implementation requires changing the agreed plan or design doc.
   - Tests fail or unexpected errors break the build during execution.
   - You encounter architectural edge cases not covered in the original sign-off.
5. **Check off as you go.** Mark items `[x]` as they are completed. Items added
   during implementation that belong to future work stay `[ ]` and are listed
   under that component doc's **Future work** section.

## Commands

- `npm run docs:dev` - run the planning site locally (VitePress)
- `npm run docs:build` - build the planning site
- `npm run docs:preview` - preview the built site

## Repo structure

- `docs/` - VitePress planning site
- `docs/components/<name>.md` - per-component design docs
- `TODO.md` - requirements and per-component checklists (status source of truth)
- `ARCHITECTURE.md` - repo-level design doc and component index
- `src/` - agent implementation (not yet created)

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
