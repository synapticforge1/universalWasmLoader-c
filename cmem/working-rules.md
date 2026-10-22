# working-rules.md — repo-local rules for universalWasmLoader-c

The workspace floor ([`../../../cmem/working-rules.md`](../../../cmem/working-rules.md)) applies here
in full. Scripting (workspace Tooling rule 1, 🔒 owner 2026-10-22, "Deno is going away", clarified
three times that day): a COMMITTED script kept for repeated use is written in the repo language's
scripting mechanism, and C has none (a mechanism that must build an executable would not count
anyway), so **committed scripts here are TypeScript run by Bun**. A one-time scratch probe deleted
after use may be shell, Bun or anything that fits — still written with `Write`, never a heredoc.
No host Python, no committed shell scripts. This file holds only what is specific to this repo.
**A repo's own rules govern inside that repo.**

## Scripts

- **In-tree scripts:** `scripts/fetch-wasmtime.ts` (called by `make fetch` as
  `bun run scripts/fetch-wasmtime.ts $(WASMTIME_VERSION) $(WASMTIME_PLATFORM)`). It replaced the bash
  `scripts/fetch-wasmtime.sh` on 2026-10-22; no shell scripts remain in the repo. The compatibility
  gate (2026-10-22): `scripts/surface.ts`, `compat.ts`, `bump.ts`, `check-compat-gate.ts`, run via
  `make surface | surface-check | compat | compat-selftest | bump KIND=…` ([compat-gate.md](compat-gate.md)).
  Besides C, Bun is the only scripting runtime here.
- **Releases go through `make bump`**, never a hand edit of the version line or the sha512 pins; a
  surface change is re-baselined (`make surface`) in its own commit before the bump.
- **External tools a script spawns run with a relative path and `cwd`**, never an absolute Windows
  path: GNU tar reads `<drive>:\…` as a remote `host:path`.
- **Machine facts and anything private go in `cmem/local/`** (gitignored, verified with
  `git check-ignore -v` 2026-10-22), never in a committed file (workspace § Records, 🔒 owner
  2026-10-22). Scan the diff before committing memory.

## C compiler: `zig cc` (owner, 2026-10-22)

The Makefile's default `CC` is `zig cc`, linked with Zig's `libunwind` everywhere except macOS; see
[overview.md](overview.md) § "Build / release flow". Other compilers stay supported via `CC=…`.
