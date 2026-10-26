# CLAUDE.md — universalWasmLoader-c (pointer)

> **At session start, and before each new work item, read `../../cmem/workspace-correspondence.md`**
> (the ledger: one row per inter-project item) for every row addressed to this repo or touching the
> work, then the letter it points to in `../../cmem/handoffs.md`. The workspace session
> (`../../cmem/INDEX.md`) reviews across the sibling repos and reports there; nothing is ever
> written into this repo from outside. (owner directive, 2026-09-20; ledger first, owner 2026-10-26)

**All project memory lives in [`cmem/`](cmem/INDEX.md).** Start at `cmem/INDEX.md`; state and open
gaps are in [`cmem/overview.md`](cmem/overview.md). This file is only the pointer (the pre-2026-10-22
archive is `git show 1057d89:CLAUDE.md`).

## What this is

The C port of the Universal WASM Loader: a single STB-style header, `universal_wasm_loader.h`, on the
wasmtime C API, for C, C++, Zig, V and Julia consumers. Conformant to the loader `SPEC.md` 3.0.0.
Distributed through the repo's own vcpkg registry (`ports/`, `versions/`).

## Triggers (defined in `cmem/INDEX.md`, binding)

- **"update the project memory"** — revise the `cmem/` files; sync `README.md` only where
  user-relevant.
- **"look for code issues"** — the comprehensive audit; keep `make clean test` at 29/29.

## Three things that bite immediately

1. **Build:** `make fetch` (Bun runs `scripts/fetch-wasmtime.ts`), then `make clean test`. The default
   compiler is `zig cc` (plus Zig's `libunwind`); a plain `make test` can pass on a stale binary.
2. **Scripting is Bun/TypeScript**, no shell scripts, no heredocs; commit messages go through a file
   (`git commit -F`). Rules: workspace floor + `cmem/working-rules.md`.
3. **Nothing is pushed, tagged or published unless the owner says so.** Releases go through
   `make bump KIND=…` (the compatibility gate, `cmem/compat-gate.md`). The vcpkg port downloads
   the header from the `v<version>` tag, so a tag IS a release; CI (`vcpkg-release.yml`) validates
   the port but does not run the C tests.

**Current state:** v1.1.0 (vcpkg port-version 2), 29/29. GitHub:
`synapticforge1/universalWasmLoader-c`.
