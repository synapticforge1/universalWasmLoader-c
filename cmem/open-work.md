# open-work.md — open items only

Summary: what is known to be missing or unproven, each with a stable ID. Closed items move to
`archive/` with their IDs. Last verified 2026-11-24.

## Open items

- **OW1 — host imports returning `string` are not supported.** It would need allocating into WASM
  memory from the trampoline; no fixture needs it. Since 2.0.0 such an import is refused at load
  (SPEC 4.0.0 § 4), not mis-encoded.
- **OW2 — no URL loading:** file paths only. Adding it brings SPEC § 11 (a time limit,
  cancellation, one request per file) and an `options` parameter.
- **OW3 — the C++ compile of the implementation is checked by hand only** (`zig c++ -fsyntax-only
  -Wall -Wextra`, clean since 2.0.0). No gate compiles it as C++; add one to `make test` if it
  regresses.
- **OW4 — the instance pool is single-threaded;** a blocking acquire would need a mutex and a
  condition variable behind a compile flag.
- **OW5 — the full suite has run on `win-x64` only** (the dev machine, `x86_64-mingw`). Tier 3
  wants every platform ([platforms.md](platforms.md)); the others are `pending` until a machine
  exists. A native macOS build and run of the suite has never happened.
- **OW6 — four vcpkg triplets were never install-tested:** `x64-windows-static`,
  `x64-mingw-static`, `arm64-linux`, `x64-osx`. CI's `publish` installs `x64-linux`, `x64-windows`
  and `arm64-osx` after each release.
- **OW7 — the scripts are never type-checked.** Bun does not type-check, and a `tsc --noEmit` check
  would need `typescript` and Bun's types (a `package.json` in a C repo). Owner, 2026-10-22:
  record, do not add yet.
- **OW8 — no fuzzer for the WIT parser,** the one text parser (the hardening review's fuzzing item).
- **OW9 — `scripts/fetch-wasmtime.ts` verifies no hash** of the SDK it downloads (the developer
  path; the vcpkg port pins its download by sha512). A candidate for the security review's
  native-library-loading item, not yet a reviewed finding.
- **OW10 — the fixtures stamp waits on loader-js** (workspace C49): wasmtk's history was rewritten
  on 2026-11-20 and the stamp `4a5c3cf668d` became `5ea81976`. loader-js re-stamps first; this repo
  then copies the new `tests/fixtures.json`.
- **OW11 — the release path changed again (H37) and is unmeasured on GitHub:** `tag` now needs
  only `validate`; the first real run is the next release.
- **OW12 — tag the header's and the portfile's platform settings** (`win-x64` MinGW block;
  the per-triplet wasmtime selection) with the next release's bump: editing either before then breaks
  the 2.1.1 pins or git-tree that CI checks ([platforms.md](platforms.md)).
