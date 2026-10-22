# The compatibility gate (workspace letter H6, built 2026-10-22)

🔒 Binding (owner, 2026-09-20; workspace `../../../cmem/layout-and-packaging.md` § "The
compatibility gate"): "backward compatible" is a gate result, never a judgment made at bump time.
Modelled on loader-js's (`../universalWasmLoader-js/cmem/compat-gate.md`).

## What runs where

| Piece | File | Runs in |
| --- | --- | --- |
| Rule 1, the SURFACE | `scripts/surface.ts` → `api-surface.json` (committed) | `make surface` writes it; `make surface-check` / `--check` in CI `validate` on every push, and in `bump` / `compat` |
| Rule 2, the FLOOR | `scripts/compat.ts` `floorOf` | `make bump` (refuses below it), `make compat` (report), `compat.ts --release` on a tag (CI `compat` job, blocking) |
| Rule 3, BEHAVIOUR | `scripts/compat.ts` `previousTests` | same places; required green for a patch or minor |
| Rule 4, deprecate first | README `### ⚠️ Breaking Changes` table | by hand, when a deprecation lands |
| Rule 5, re-baseline alone | `surface-check` | an intended surface change is its own commit (`make surface`), with the reason |
| Self-test | `scripts/check-compat-gate.ts` (50 checks, 2026-10-22) | `make compat-selftest`, CI `validate` |

**The surface of this loader:** the header's public region (between `#define
UNIVERSAL_WASM_LOADER_H` and `#ifdef UWL_IMPLEMENTATION`, comments and `__cplusplus` guards
removed): every function signature with parameter names dropped (`static inline` included, its
BODY not); every typedef — struct/union LAYOUT including member names, function-pointer shape,
opaque handles; every enum constant with its integer VALUE (C integers are frozen, so a constant
inserted mid-list is major, appended is minor); public `#define`s and `#include`s; and the `SPEC
vX.Y.Z` the header's leading comment states (exactly once). The generator FAILS on a form it cannot
key (bare struct, extern variable, enum value expression, `#if`) rather than skipping it. **52
symbols, SPEC 3.0.0, on 2026-10-22.**

**The floor:** removed or changed → major; added → minor; nothing → patch; the SPEC version moves it
by its own level (lowered → major). ⚠️ A changed signature is major even when it only widens; the
gate cannot tell widening from narrowing and errs high (same as -js).

**The version line** is `ports/universal-wasm-loader-c/vcpkg.json` `version` (+ `UWL_VERSION` in
the portfile, which CI checks agree). It stays at the last released tag; `bump` refuses otherwise.
`bump` rewrites both, drops `port-version`, and recomputes `UWL_HEADER_SHA512` /
`UWL_LICENSE_SHA512` from the COMMITTED blobs (`git cat-file blob HEAD:…`) — that is what
raw.githubusercontent serves at the tag; a working file can differ from it (line-ending conversion),
so hashing the working file could be wrong. It does not commit, edit `versions/`, tag or push.

**Previous-tag tests:** `git archive <tag> tests` into `.compat/` (gitignored, deleted after;
`--keep` keeps it) beside a copy of the CURRENT header, built with `make -f ../Makefile
WASMTIME_SDK=<abs> clean test` (so `zig cc` and `-lunwind` apply), verdict from the OUTPUT ("N
passed, M failed", M = 0 and N > 0) and the exit code. The SDK path comes from `make print-sdk`,
so `WASMTIME_PLATFORM` / `WASMTIME_SDK` in the environment are honoured. Measured 2026-10-22:
v1.1.0's tests 29/29 and v1.0.0's tests 29/29 against today's header.

**Consumers (Rule 3, second half):** none known that run a suite against this header. Revisit if
one appears.

## Inverted end to end, 2026-10-22 (a scratch clone; nothing in the repo was broken)

| Mutant | Command | Result |
| --- | --- | --- |
| clean tree | `make compat` | floor patch; v1.1.0 tests GREEN 29/29 |
| `uwl_pool_free` removed, surface NOT re-baselined | `bump patch` | refused: stale snapshot; `surface-check` names `removed: fn uwl_pool_free` |
| same, re-baselined | `bump patch` / `minor` / `major` | refused (floor major) / refused / allowed 1.1.0 → 2.0.0, `port-version` dropped |
| bool RESULT decoding inverted (`uwl_call`), surface unchanged | `bump patch` | refused: floor patch, previous-tag tests RED 23 pass / 6 fail |
| `uwl_pool_busy` declared, re-baselined | `bump patch` / `minor` | refused (floor minor) / allowed → 1.2.0; header sha512 = committed blob's |
| tagged v1.2.0 with that addition | `compat --release` | passes (minor ≥ minor) |
| tagged v1.1.1 with that addition | `compat --release` | BLOCKED: patch below the floor (minor) |
| version line 1.1.5, last tag v1.1.0 | `bump patch` | refused |
| dirty tree | `bump patch` | refused |
| `floorOf` with "added" → patch | self-test | RED (`function added`) |
| history | `floorOf(v1.0.0, v1.1.0)` | minor, 8 reasons, all `added:` (the convenience layer) |

The self-test's first run found a real bug: the SPEC regex matched an implementation comment
("SPEC v3.0.0 callee-allocated return"), so deleting the conformance line went unnoticed; it now
reads only the leading comment.

## Not yet verified

- The CI `compat` job (tags only) has never run: it is the first native Linux `zig cc` build and
  run of the suite (Zig 0.16.0 via `mlugg/setup-zig@v2`, Bun 1.4.3 via `oven-sh/setup-bun@v2`).
  The `validate` additions (surface `--check`, self-test) ran green on Linux first in run
  `39804596951` (`0494969`; GitHub shows the pre-H19 hash `0f9b6e3`), and again in run
  `39823105880` on `77cf808` after the history rewrite (2026-10-22).

## Traps met building it

- Cloning the repo for a scratch run can need per-command git options on some filesystems; the
  specifics for this machine are in the gitignored `local/environment.md`.
- `String.prototype.replace` with a STRING replacement expands `$$`, `$'`, `$&`: the ★ copy for
  `best-practices.md` corrupted two rules that way until the splice used a function replacer.
