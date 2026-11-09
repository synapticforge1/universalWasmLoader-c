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
| Release page | `scripts/github-release.ts` + its self-test (13 checks, 2026-11-09) | CI `release` job on a tag; `make release-selftest` (§ The release page) |

**The surface of this loader:** the header's public region (between `#define
UNIVERSAL_WASM_LOADER_H` and `#ifdef UWL_IMPLEMENTATION`, comments and `__cplusplus` guards
removed): every function signature with parameter names dropped (`static inline` included, its
BODY not); every typedef — struct/union LAYOUT including member names, function-pointer shape,
opaque handles; every enum constant with its integer VALUE (C integers are frozen, so a constant
inserted mid-list is major, appended is minor); public `#define`s and `#include`s; and the `SPEC
vX.Y.Z` the header's leading comment states (exactly once). The generator FAILS on a form it cannot
key (bare struct, extern variable, enum value expression, `#if`) rather than skipping it. **52
symbols, SPEC 3.0.0, on 2026-10-22; 52 symbols, SPEC 4.0.0 since `e97218f` (2026-11-07, C29).**
That re-baseline is the gate's first MAJOR floor: `make compat` → `major: SPEC 3.0.0 -> 4.0.0`,
with v1.1.2's 43 tests green on the 4.0.0 header (they use only conformant input). The behaviour
commit before it (`c7cc259`) measured floor patch: the gate sees a behaviour break only through
the SPEC line, or through a previous-tag test that turns red.

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

## First tagged run — v1.1.1, 2026-10-26

- Run `40382759953` on tag `v1.1.1` (`6cda558`): **all green** — `validate`, `compat`, and
  `install` on `x64-windows`, `arm64-osx`, `x64-linux`. The `compat` job's first run was the first
  native Linux `zig cc` build and run of a suite here (Zig 0.16.0 via `mlugg/setup-zig@v2`, Bun
  1.4.3 via `oven-sh/setup-bun@v2`): `compat.ts --release` = floor patch, v1.1.0's 29 tests against
  the 1.1.1 header. Read from the run's job conclusions (public API); the job log was not read.
- Run `42391904762` on tag `v1.1.2` (`22f9eac`, 2026-11-07): all green again — `validate`,
  `compat` (v1.1.1's 34 tests against the 1.1.2 header, Linux), `install` on the same three
  triplets; `main`'s run `42391902045` green. Job conclusions read from the public API.
- Run `42398405077` on tag `v2.0.0` (`126d361`, 2026-11-07): **RED, and the release itself is
  not at fault.** `validate` passed every pin, version and git-tree step and the surface check;
  the gate SELF-TEST failed, so `compat` and `install` were skipped. Cause: the self-test's SPEC
  mutations hard-coded `SPEC v3.0.0`, and `e97218f` moved the header to v4.0.0 (the self-test was
  run before that commit, not after it). Fixed on `main` (`scripts/check-compat-gate.ts` now reads
  the version from the header's conformance line; 50/50; inverted, one case → 49/1). The tag was
  NOT moved. Covered instead: raw GitHub serves `v2.0.0`'s header and LICENSE with the pinned
  sha512 (all 128 digits); `compat.ts --release` run locally → "a major step from v1.1.2", exit 0.
  **Then RE-TAGGED (owner: "option 3", 2026-11-07):** `v2.0.0` moved from `126d361` to `56217b6`,
  which is byte-identical in header, LICENSE, `ports/` and `versions/`, so the pins and the
  git-tree held. Run `42398823979` on the new tag: **all green**, i.e. `validate`, `compat`, and
  `install` on `x64-windows`, `arm64-osx`, `x64-linux`. The served header was re-hashed after the
  move and equals the pin. Anyone who fetched the tag in the minutes before holds the old
  annotated tag object (`1ba8761`), whose files are the same.
- Run `42563162790` on tag `v2.1.0` (`edc6993`, 2026-11-08): all green — `validate`, `compat`
  (floor minor; v2.0.0's 84 tests against the 2.1.0 header), `install` ×3. Every one of those
  checks was run locally before the tag was pushed, as the lesson below says.
  **Lesson:** after any header edit, run `make surface-check compat-selftest`, not only `make test`.
- Still not covered: CI runs the PREVIOUS tag's tests, never the current `tests/spec_tests.c` (34
  since 2026-10-26) — see overview § Known gaps. The `validate` additions (surface `--check`,
  self-test) have run green on Linux since run `39804596951` (2026-10-22).

## The release page (workspace H32, added 2026-11-09)

🔒 Owner, 2026-11-09: **"yes. From this point forward it is the release page."** From the first
tag cut after this landed, a release here is its GitHub Release page, made by CI. Earlier tags
(v1.0.0 … v2.1.0, six of them) keep no page: "only new tags will get release pages."

| Piece | File | Runs in |
| --- | --- | --- |
| The job | `vcpkg-release.yml` `release`: tags only, `needs: [validate, compat, install]`, `contents: write` only, no `uses:` | after every other job is green on the tag |
| The script | `scripts/github-release.ts` (Bun, REST API, `GITHUB_TOKEN`) | that job |
| Its self-test | `scripts/check-github-release.ts` (mock API on `Bun.serve`, 13 checks) | `make release-selftest`, CI `validate` |

The job clones without credentials and checks HEAD = `github.sha`. It installs Bun itself, pinned
by sha256, because `oven-sh/setup-bun` takes `github.token` by default (C30). The script follows
H32's order:

1. The tag exists on GitHub and peels, annotated tags followed, to `GITHUB_SHA`. This comes first
   because `POST /releases` would CREATE a missing tag (loader-rs's hazard).
2. If a release already exists, the script exits 0 without writing anything.
3. It POSTs `generate_release_notes` with a vcpkg note on top, reads the page back, and peels the
   tag again.

Every request has a 30 s limit (`UWL_HTTP_TIMEOUT_MS`), covering the body too. The script is
adapted from loader-rs's.

**Measured 2026-11-09:**

- Self-test 13/13.
- Inverted with three one-line mutants, each catching only its own case:
  - no sha check → 11 / 2 (both "another commit" cases POST);
  - no existing-release check → 12 / 1;
  - no time limit → 12 / 1 (a stalled API).
- Real GitHub, read-only `--dry-run` without a token:
  - `v2.1.0` + its commit → passes and stops before the POST;
  - `v2.1.0` + 2.0.0's commit → refused;
  - `v9.9.9` → refused.
- `Bun.YAML` parse: `release` needs the three jobs, `{"contents":"write"}`, 0 `uses:`.

**UNMEASURED on GitHub until the next tag run.** Record that run's id and the page's
`author.login` (expected `github-actions[bot]`) here and in the H32 ledger row.

## Traps met building it

- Cloning the repo for a scratch run can need per-command git options on some filesystems; the
  specifics for this machine are in the gitignored `local/environment.md`.
- `String.prototype.replace` with a STRING replacement expands `$$`, `$'`, `$&`: the ★ copy for
  `best-practices.md` corrupted two rules that way until the splice used a function replacer.
