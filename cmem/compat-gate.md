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
| Release (D1) | `scripts/release.ts`; CI `ci-tag.ts` + `github-release.ts` + their self-test (31 checks, 2026-11-10) | `make release KIND=…`; CI on the pushed `main` (§ The release page; [release.md](release.md)) |

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

## Tagged runs

Every release's CI run, with what was read back, is recorded in [release.md](release.md) §
Release History (moved there 2026-11-10, H33 D3).

- **Lesson (2.0.0's red tag run):** after any header edit, run `make surface-check
  compat-selftest`, not only `make test`. The gate's self-test matches header lines literally, and
  `release.ts`'s cold gate now runs it before every release.
- **Still not covered:** CI runs the PREVIOUS tag's tests (`compat`), never the current
  `tests/spec_tests.c`. See overview § Known gaps.

## The release page, and CI's tag (H32 2026-11-09; H33 / D1 2026-11-10)

🔒 Owner, 2026-11-09: **"yes. From this point forward it is the release page."** Earlier tags
(v1.0.0 … v2.1.0) keep no page: "only new tags will get release pages." 🔒 Owner, 2026-11-10
(D1): CI checks first, then CI makes the tag, then the page from the tag, then the publish. How
the whole release runs, slot by slot, is in [release.md](release.md) § How a release works. This
section holds the design and the measurements.

| Piece | File | Runs in |
| --- | --- | --- |
| The release script | `scripts/release.ts` (bump commit, registry commit, ONE push of `main`, no tag) | `make release KIND=…`, the owner's machine |
| "Is this a release?" + the tag | `scripts/ci-tag.ts state` / `create` (REST API) | CI `validate` / `tag` |
| The page | `scripts/github-release.ts` (REST API; the tag from `RELEASE_TAG`) | CI `release`, after `tag` |
| Shared HTTP + peel | `scripts/github-api.ts` (30 s per request, the body included) | both scripts |
| Their self-test | `scripts/check-github-release.ts` (mock API on `Bun.serve`, 31 checks) | `make release-selftest`, CI `validate`, `release.ts`'s cold gate |
| The publish read-back | `vcpkg-release.yml` `publish` (registry-mode install as a user, 3 OSes, fatal) | CI, after `release` |

Every job clones without credentials and checks HEAD = `github.sha`. No job runs a `uses:` action:
`oven-sh/setup-bun` would take `github.token` by default (C30), so Bun, Zig and vcpkg are fetched
pinned instead. `github-release.ts` follows H32's order:

1. The tag exists on GitHub and peels, annotated tags followed, to `GITHUB_SHA`. This comes first
   because `POST /releases` would CREATE a missing tag (loader-rs's hazard).
2. If a release already exists, the script exits 0 without writing anything.
3. It POSTs `generate_release_notes` with a vcpkg note on top, reads the page back, and peels the
   tag again.

Every request has a 30 s limit (`UWL_HTTP_TIMEOUT_MS`), covering the body too. The script is
adapted from loader-rs's.

**Measured 2026-11-09 (H32, the page alone, then tag-triggered):**

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

**MEASURED on GitHub, 2026-11-09, by the first tag after it landed, `v2.1.1` (→ `dc81b25`).**

- The Release page `v2.1.1` exists: `releases/tag/v2.1.1` answers 200.
- The repo's `releases.atom` names its author **`github-actions[bot]`**, updated 16:09:11Z.
- The tag was not moved: `ls-remote` gives `v2.1.1^{}` = `dc81b25` afterwards.
- `release` needs validate, compat and install, so its success implies all three passed.

The per-job conclusions were NOT read: the public REST API's 60-per-hour unauthenticated limit
was spent, because a 20 s poller is too fast. Poll at 2–3 minutes, or read `releases.atom` and
the page, which are not rate-limited. The `main` run before the tag (`42648553716`, on `b794dd2`)
was green, the first run of Bun 1.4.4 and the release self-test in `validate`.

**Rehearsed 2026-11-10, before landing (H33 / D1; best-practices 7.22):**

- **Self-test:** 31/31 (13 page cases, 6 `state`, 9 `create`, plus 3 output checks).
- **Six one-line mutants, each caught only by its own case:**
  - `create` without the "tag elsewhere" refusal → 30 / 1;
  - `state` calling an already-released version a release → 30 / 1;
  - `create` without its read-back → 30 / 1;
  - the page without its sha check → 29 / 2;
  - the page without its existing-page check → 30 / 1;
  - no time limit → 30 / 1.
- **`ci-tag.ts` read-only against real GitHub:**
  - `state`: `dc81b25` (v2.1.1's commit) → `release=true`, "a re-run"; `2bbf89e` → `release=false`,
    "an ordinary push"; a pull request → `release=false`.
  - `create --dry-run`: at `dc81b25`, "nothing to do"; at `2bbf89e`, refused ("a tag never
    moves").
- **The workflow's install steps, run locally with the same commands (x64-mingw-dynamic):**
  - the overlay port aimed at commit `2bbf89e` (2 URLs rewritten) installed; vcpkg checked the pins;
    copyright OK;
  - the registry-mode install as a user (baseline `2bbf89e`, vcpkg baseline tag 2026.10.16) installed
    2.1.1; the read-back passed;
  - inverted: an expected 9.9.9 → fails; a one-byte header change → fails.
- **`release.ts` against a scratch bare remote** (GitHub untouched):
  - refused: no level; an untracked file; `main` ahead of the remote; the tag already on the remote;
  - `--dry-run`: the cold gate ran (93/93, floor patch), nothing edited;
  - a real `patch`: two commits (`bump to v2.1.2` touching only `ports/`; the registry entry
    touching only `versions/`), ONE push, remote `main` = HEAD, **no tag anywhere**;
  - its files pass every `validate` check: version 2.1.2 in both, `versions[0]` git-tree = the
    port tree, baseline 2.1.2, header pin = HEAD blob.
- **`Bun.YAML` parse of the workflow:** six jobs; `permissions: {}`; only `tag` / `release` write;
  0 `uses:`, 0 `gh`, 0 `1.4.3`.
- **The first real run is the next release.** UNMEASURED on GitHub until then: the `tag` job's
  POSTs, the `publish` job on three OSes, and the `install` job's overlay aimed at a commit on
  macOS / Windows.

## Traps met building it

- Cloning the repo for a scratch run can need per-command git options on some filesystems; the
  specifics for this machine are in the gitignored `local/environment.md`.
- `String.prototype.replace` with a STRING replacement expands `$$`, `$'`, `$&`: the ★ copy for
  `best-practices.md` corrupted two rules that way until the splice used a function replacer.
