> **⚠️ PORTABLE PROJECT MEMORY NOW LIVES IN `cmem/`** — start at [`cmem/INDEX.md`](cmem/INDEX.md).

> **At session start, read `../../cmem/handoffs.md` for letters addressed to this repo.** The workspace
> session (`../../cmem/INDEX.md`) reviews across the sibling repos and reports there; nothing is ever
> written into this repo from outside. (owner directive, 2026-09-20)

> When saving new project memory, write it into the matching `cmem/` topic file (and refresh its
> pointer in `cmem/INDEX.md`). The **"update the project memory"** and **"look for code issues"**
> triggers are defined in `cmem/INDEX.md` and are binding. This `CLAUDE.md` remains as the auto-loaded
> historical archive; `cmem/` is the source of truth.

# universalWasmLoader-c

Universal WebAssembly loader for C/C++/Zig/V.

Repository: `https://github.com/synapticforge1/universalWasmLoader-c` (moved from the `jrmarcum`
account to the `synapticforge1` org; recorded 2026-10-20 — see `cmem/overview.md`).

## Project goal

Provide a single, reusable C library (or set of headers) that can load and execute `.wasm` modules from code written in C, C++, Zig, or V — without requiring each language's ecosystem-specific WASM runtime boilerplate.

## Repository state

Early-stage project. As of the initial commit the repo contains only `README.md`, `.gitignore`, and `LICENSE`. No source tree exists yet.

## Toolchain & build

- Target languages / consumers: C, C++, Zig, V
- Compiled output types: static library (`.a`/`.lib`), shared library (`.so`/`.dll`/`.dylib`), or header-only — TBD
- `.gitignore` covers standard C/C++ artefacts: object files, libraries, executables, debug files, and kernel-module build artefacts

## Conventions

- No conventions established yet — update this file as the project grows.

## All project context lives here

All Claude Code project context, conventions, and decisions are kept in this file.
No machine-local memory is needed.
