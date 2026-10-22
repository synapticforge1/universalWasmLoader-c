# working-rules.md — repo-local rules for universalWasmLoader-c

The workspace floor ([`../../../cmem/working-rules.md`](../../../cmem/working-rules.md)) applies here
except where this file overrides it. **A repo's own rules govern inside that repo.**

## Scripting runtime: Bun, not Deno (owner, 2026-10-22)

Deno is going away; this repo's scripting moves to **Bun**. This overrides workspace Tooling rule 1
("Scripting is Deno/TypeScript only") inside this repo. Every other workspace tooling rule stands.

- **Scripting is Bun/TypeScript only**, plus C for in-tree tools. No Python. No bash, PowerShell or
  `.bat` scripts. CI YAML `run:` steps are the one accepted shell.
- **Ad-hoc probes** are `.ts` files in the session scratchpad, run with `bun run <file>`.
- **No heredocs, ever** — that includes `bun -e "…"` / `bun --eval`, as well as `deno eval`,
  `node -e`, `python -c`, `<<'EOF'`, `@'…'@` and `-F -`. Content goes through `Write`/`Edit`.
- **In-tree scripts:** `scripts/fetch-wasmtime.ts` (called by `make fetch` as
  `bun run scripts/fetch-wasmtime.ts $(WASMTIME_VERSION) $(WASMTIME_PLATFORM)`). It replaced the bash
  `scripts/fetch-wasmtime.sh` on 2026-10-22; no shell scripts remain in the repo.
- **External tools a script spawns run with a relative path and `cwd`**, never an absolute Windows
  path: GNU tar reads `D:\…` as a remote `host:path`.

## Not yet propagated (2026-10-22)

The Bun rule is local to this repo. The workspace floor and the other repos still say Deno; changing
those belongs to the workspace session (`../../cmem/`), not to this one.
