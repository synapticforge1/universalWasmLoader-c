# cmem — Portable Project Memory for universalWasmLoader-c

This folder is the **authoritative, portable project memory** for `universalWasmLoader-c`. It lives
inside the project tree, so it travels with the repo and is committed to git. Keep files small and
single-topic.

## Policy

- **`cmem/` is the single home for ALL project memory.** When the owner says "**update the project
  memory**," update the matching `cmem/` topic file with the latest decisions, found bugs, design
  changes, and current state — then add/refresh its one-line pointer in the table below. Convert
  relative dates to absolute; update existing entries rather than duplicating.
- **`README.md` and `docs/` are NOT project memory.** They are the public, user-facing docs. Keep
  internal decision logs / bug post-mortems out of them — those live here in `cmem/`. This repo has
  no `SPEC.md`: the cross-language spec is loader-js's (`../universalWasmLoader-js/SPEC.md`).
- **Layout** (workspace `../../../cmem/memory-conventions.md`): a small loader port, so
  `overview.md` carries what-it-is, state, release flow, known gaps AND the open list (the status
  narrative exists once, there); `working-rules.md` the repo-specific rules; `best-practices.md`
  method rules; `compat-gate.md` the release gate. `CLAUDE.md` is a pointer only. **`local/` is
  gitignored** (machine facts, anything private; absent in a clone) — nothing private in a
  committed file.

### The "update the project memory" trigger (binding on every agent)
When the owner says **"update the project memory"** (or a synonym — "update memory", "record this"),
do BOTH: (1) AUDIT all `cmem/` files for stale live claims — grep the old values, not just the files
you touched — revise them and refresh the Files-table pointers (absolute dates; update, don't
duplicate); and (2) sync the user-facing README / `docs/` only where the change is user-relevant —
never copy internal decision logs into them.

### The "look for code issues" trigger (binding on every agent)
When the owner says **"look for code issues"** (or "code audit" / "audit the code"), perform a
comprehensive audit across tested AND untested paths for: (1) workarounds / temporary hacks;
(2) dead code; (3) bugs (wrong ABI marshalling, off-by-one pointer/length math, endianness, missing
`cabi_post` calls); and (4) silent fall-throughs (returning a default instead of erroring). Report
`file:line` + severity, fix the safe ones, and keep the test suite green (`make clean test` → 34/34; default compiler is `zig cc`).

## Files

| File | What it holds |
| --- | --- |
| [overview.md](overview.md) | What this loader port is, where the repo lives (`synapticforge1` org since 2026-10-20), its language/runtime, API surface, ABI/SPEC conformance status, tests, release flow, known gaps (CI runs no C tests; scripts not type-checked), and the status of workspace letters for this repo — all done (2026-10-26) |
| [handoffs.md](handoffs.md) | Letters FROM this repo to siblings, full text; each indexed by a row in the workspace ledger. C13 (2026-10-26, closed the same day): loader-js, re-stamp the H7 fixtures from wasmtk `4a5c3cf668d` |
| [compat-gate.md](compat-gate.md) | The SemVer compatibility gate (letter H6, 2026-10-22): surface snapshot, floor, previous-tag tests, `make bump`, CI, the end-to-end inversion table |
| [history-purge.md](history-purge.md) | The 2026-10-22 history rewrite (letter H19): what was purged, how it was verified, what is out of our control, and the full old → new commit hash map |
| [best-practices.md](best-practices.md) | METHOD rules: this repo's own (§ L1–L4) + the workspace's 28 ★ convergent rules, copied verbatim and stamped 2026-10-26 (letters H6, H24, H27, C8; text-checked, 0 differences) |
| [working-rules.md](working-rules.md) | Repo-specific rules on top of the workspace floor: committed scripts are TypeScript on Bun (C has no scripting mechanism); the in-tree scripts and their `make` targets; releases only via `make bump`; machine facts only in the gitignored `local/`; C compiler defaults to `zig cc` (all 2026-10-22) |
