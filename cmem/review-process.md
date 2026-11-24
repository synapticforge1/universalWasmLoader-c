# review-process.md — this repo's slots in the review standard

Summary: what the workspace review standard
([`../../../workspace/cmem/review-process.md`](../../../workspace/cmem/review-process.md), final,
2026-11-17, letter H37) needs to know about this repo, and the record of the last review. The
standard itself is not repeated here. Last verified 2026-11-24.

## Last review

- No review has been run under the final standard yet. `scripts/review-gate.ts` refuses a release
  until a completed review is recorded here as one bullet, `- Review complete: <commit>` (replace
  the previous one; nothing outside `cmem/` may change after it).

## Scope of a release review

- Everything since the last release tag: `universal_wasm_loader.h`, `tests/spec_tests.c`, the port
  (`ports/`, `versions/`), `scripts/`, `.github/workflows/`, `Makefile`, `README.md`, `docs/`,
  `examples/`. The gate scripts and review records are outside release reviews (standard § 10).

## Private-data paths (never given to a reviewer, never tracked)

- `cmem/local/` (machine facts), `cmem/review-issues.md` (open issues), the root `CLAUDE.md`.
- `vendor/` (the downloaded wasmtime SDK) and `.compat/` (the gate's scratch) are gitignored outputs.

## Reference results (measured 2026-11-24, dev machine, `zig cc`, wasmtime 45.0.2 x86_64-mingw)

- `make clean test`: 93 passed, 0 failed.
- `make compat-selftest` 50 / 50; `make release-selftest` 31 / 31; `make gates-test` 17 / 17.
- `make surface-check`: 54 symbols, SPEC 4.0.0.
- `make privacy`: clean, 64 files; all 64 commit messages before this session's clean.

## Platforms

- The support matrix and platform notes are in [platforms.md](platforms.md) (tier 3: the full
  matrix).

## Licence inventory and notices

- The project's own licence: `LICENSE` (MIT), and the port's `"license"` field
  (`MIT AND Apache-2.0 WITH LLVM-exception`, the second for the wasmtime C API it installs).
- The port's `copyright` file bundles both licence texts (`portfile.cmake`); CI's `publish` job
  fails if either is missing after a registry install.
- Not shipped by this repo but installed by the port: the wasmtime C API, downloaded per triplet
  and pinned by sha512 in `portfile.cmake`.
- Test fixtures: copied unmodified from loader-js (`tests/fixtures.json` records their provenance).
- No package-manager dependency: the scripts use only Bun's and Node's built-ins, so there is no
  lockfile. No inventory file exists yet beyond this list.

## Outputs that can carry user facts

- **Error strings** returned by `uwl_import` / `uwl_call` name the paths the caller passed
  (`cannot read .wit '<path>'`). They go to the caller only; the header sends nothing anywhere.
- **The WASI context** a guest gets inherits stdout and stderr only: no environment, no arguments,
  no preopened directories. No network access is made by the header.
- **The scripts** print commit ids, versions and file names of this repo; `check-privacy.ts` masks
  anything it finds.

## Gate scripts (run locally; none is repeated on GitHub)

- `make clean test` (the reference suite), `make surface-check`, `make compat` / `compat.ts
  --release` (floor + previous-tag tests), `make compat-selftest`, `make release-selftest`,
  `make privacy`, `make gates-test`, `make review-gate`; all run by `scripts/release.ts`.

## Items that apply only in part here

- **Hardening — fuzzing:** the WIT parser is the one text parser; there is no fuzzer yet
  (open-work.md OW8).
- **Security — sandbox boundary:** this is a host for wasmtime, not a runtime; the host-side
  items (pointer and length checks on string arguments in the import trampoline) apply.
- **Security — native library loading:** applies to the port's wasmtime download (sha512-pinned)
  and to `scripts/fetch-wasmtime.ts` (a developer download; open-work.md OW9).
- **Security — repository settings:** read in the GitHub web UI, an owner item.
- **Privacy — user side, third-party data:** not applicable; the library processes no one's files
  but the caller's own modules.
- **Licensing — lockfile inventory:** not applicable; there are no package dependencies.
