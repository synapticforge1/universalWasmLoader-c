# release.md — how this repo releases, and every release so far

Summary: the release process as it runs here, slot by slot, then every release, newest first.
🔒 The ONE place releases are recorded (owner, 2026-11-10, workspace letter H33, D3: "release.md
… with the newest first in the 'Release History' with a summary of what changed in each one").
Last verified 2026-11-24.

## How a release works

🔒 The owner's order (2026-11-10, D1), with the 2026-11-17 amendment (H37): **the reviews and every
test run LOCALLY first; then "CI to verify the version, then tag, create the release page and
publish, and skip any version already published."** The workspace's shape
(`../../../workspace/cmem/release-process.md` § 5, slots U1–U12), filled for this repo:

- **U1 — the go, the level, the review set.** The owner's "release" with a level:
  `make release KIND=patch|minor|major`; there is no default. `release.ts`'s FIRST step is the
  review gate (`review-gate.ts`): the five required reviews were completed on this code
  ([review-process.md](review-process.md) § Last review).
- **U2 — merge first; the bump is its own commit.** Notes (a README "Breaking Changes" row for a
  major) are on `main` first. `release.ts` commits `bump to vX.Y.Z`, then
  `registry: X.Y.Z git-tree and baseline`.
- **U3 — the bump tool.** `bump.ts` refuses a dirty tree (untracked files count) and a stale
  surface, computes the floor from the surface diff since the last tag and refuses a lower level,
  runs the previous tag's tests for a patch or minor, and syncs the version and both sha512 pins
  from the committed blobs ([compat-gate.md](compat-gate.md)).
- **U4 — the release script.** `release.ts` guards: on `main`, a clean tree, `main` = GitHub's
  (`ls-remote`), the tag absent here and on GitHub, `versions/` without the version. It makes and
  pushes **no tag**; it pushes `main` once and reads it back. `--dry-run` stops after the gates.
- **U5 — the checks, LOCAL.** `release.ts`'s cold gate: the privacy gate (the tree and the commits
  since the last release), the gates' tests, the surface check, both self-tests, `make clean test`;
  `bump.ts` adds the floor and the previous tag's tests. It prints the `Tested on:` line. CI's
  `validate` only verifies the version: HEAD = the pushed commit, the pins, the port version and the
  registry entry agree, and "is this a release?" (`ci-tag.ts state`).
- **U6 — CI tags.** `tag` (needs `validate`): `ci-tag.ts create`, the annotated `vX.Y.Z` on
  `github.sha` through the REST API, read back; a no-op if the tag is already there, refused if it
  is elsewhere.
- **U7 — the page from the tag.** `release`: `github-release.ts`, in H32's order (the tag peels to
  `github.sha`; an existing page is done; POST with generated notes and a vcpkg note; read back;
  peel again).
- **U8 — publish.** For this git-tag registry the tag IS the publish: the port downloads the header
  from it. `publish` is the read-back: on 3 OSes it installs the version as a user does (manifest
  mode, this repo as a git registry, baseline = this commit) and FAILS unless vcpkg installs this
  version with the pinned header and the copyright. vcpkg verifies the sha512 pins itself.
- **U9 — pins.** No `uses:` anywhere; credential-less clones; Bun by version + sha256, vcpkg by
  commit (tag 2026.10.16); top-level `permissions: {}`, only `tag` and `release` write;
  `concurrency` per ref, never cancelled (the tag is known only after `validate`).
- **U10 — install as a user:** in CI by `publish`; by hand, `docs/vcpkg.md` § 2a.
- **U11 — record:** this file, newest first, with the `Tested on:` line of each release.
- **U12 — failure:** "Re-run failed jobs" (an owner web-UI item); each job skips or repeats what is
  done. Never a new tag for the same code, never a moved tag (2.0.0's move, below, came before this
  rule and was the owner's word).

The workflow is `.github/workflows/vcpkg-release.yml`; its scripts `ci-tag.ts`, `github-release.ts`
and `github-api.ts` are tested by `check-github-release.ts` (`make release-selftest`). The design
and its measurements: [compat-gate.md](compat-gate.md) § The release page.

**Reading a run:** the public REST API allows 60 unauthenticated requests an hour; poll every 2–3
minutes. `releases.atom` and the page itself are not rate-limited.

## Release History

### 2.1.1 — 2026-11-09 (patch)

**What changed:** the header is byte-identical to 2.1.0, with the same pins. It is the first release
whose GitHub Release page CI made (the `release` job, workspace H32), and the first with Bun 1.4.4
in CI (H31).

- **Made:** `make bump KIND=patch` (floor patch, v2.1.0's 93 tests green); `release: 2.1.1`
  `85ecd89`; registry `dc81b25` (git-tree `2b4ab75a…`, baseline 2.1.1). The tag `v2.1.1` (→
  `dc81b25`) was pushed by hand, the last one before D1.
- **Read back:** `main`'s run `42648553716` (on `b794dd2`) was green before tagging. The page
  `v2.1.1` answers 200, and `releases.atom` names its author `github-actions[bot]`. The served
  header and LICENSE equal the pins. Per-job conclusions were not read: the API limit was spent.
- **Tested on:** Windows (`win-x64`), the dev machine: the suite 93 / 93 before tagging. The tag run
  installed the overlay port on the `x64-linux`, `x64-windows` and `arm64-osx` runners (the
  `release` job needs those, and ran); no suite ran there. Other platforms: not yet tested.

### 2.1.0 — 2026-11-08 (minor)

**What changed:** a host callback can FAIL. It returns `uwl_err("why")` (new kind `UWL_ERR`), and for
every import, void ones included, the WASM stops at the import and the export's `uwl_call` fails
with the callback's message (workspace C39, from loader-v). Tests 84 → 93.

- **Made:** floor minor (`added: const UWL_ERR`, `added: fn uwl_err`); `release: 2.1.0` `edb7b3f`;
  registry `edc6993` (git-tree `b9ac75ef…`), which the tag points at. Every CI check ran locally
  before tagging.
- **Read back:** tag run `42563162790` all green (validate, compat with v2.0.0's 84 tests, install
  ×3). The served header and LICENSE equal the pins.

### 2.0.0 — 2026-11-07 (major)

**What changed:** SPEC 4.0.0, "loud failures" (workspace C29):

- only an ABSENT `.wit` gives raw exports;
- a strict `.wit` parser;
- every WIT import needs a callback, whose return kind is checked;
- typed `uwl_call` checks argument kinds;
- a WIT export the module lacks fails the load.

Also: the implementation compiles as C++. Tests 43 → 84. README "Breaking Changes" row.

- **Made:** floor major (`SPEC 3.0.0 -> 4.0.0`); `release: 2.0.0` `921b96b`; registry `126d361`
  (git-tree `1b38345e…`).
- **The first tag run (`42398405077`) was RED.** The gate's self-test had hard-coded `SPEC v3.0.0`;
  the release itself was not at fault. Fixed in `56217b6`, and the tag was MOVED there on the
  owner's word ("option 3"; header, LICENSE, `ports/` and `versions/` are byte-identical).
- **Read back:** run `42398823979` all green, install ×3 included. The served header equals the pin.

### 1.1.2 — 2026-11-07 (patch)

**What changed:** the typed accessors (`uwl_call_i32` / `_i64` / `_f32` / `_f64` / `_bool`) fail on a
result-kind mismatch, with the sentinel and `uwl_last_error()`, instead of reading the wrong union
member (workspace H29 / S8). Tests 34 → 43.

- **Made:** `83fbeda` (the fix); `release: 1.1.2` `65b40ec`; registry `22f9eac`, which the tag
  points at. Floor patch; v1.1.1's 34 tests green.
- **Read back:** tag run `42391904762` all green (validate, compat, install ×3); `main`'s run
  `42391902045` green.

### 1.1.1 — 2026-10-26 (patch)

**What changed:** the header is byte-identical to 1.1.0. It carries the workspace reference fixtures
(copied from loader-js, stamp wasmtk `4a5c3cf668d`) and the suite exercising `wasi_io_50` and
`init_check` (SPEC §10); tests 29 → 34. It is the first release through `make bump`.

- **Made:** floor patch; v1.1.0's 29 tests green; tag `v1.1.1` → `6cda558`.
- **Read back:** tag run `40382759953` all green. It was the first `compat` job, and the first
  native Linux `zig cc` build of a suite here.

### 1.1.0 — 2026-06-24 (minor)

**What changed:** the convenience call layer: `uwl_call_i32` / `_i64` / `_f32` / `_f64` / `_bool` /
`_str` / `_void`, which read native C arguments per the WIT signature, and the thread-local
`uwl_last_error()`. The reference suite moved onto them (29/29).

- **Made:** tag `v1.1.0` → `3aea7bd` (as recorded). vcpkg port-version 2 on 2026-10-20 (the
  `synapticforge1` org URLs). Installs were validated that day by dispatch run `39518063717`
  (x64-linux, x64-windows, arm64-osx).

### 1.0.0 — 2026-06-17 (first release)

**What changed:** the first release. A single STB-style header on the wasmtime C API v45.0.2, SPEC
3.0.0 (callee-allocated string returns + `cabi_post_<name>`): `uwl_import`, `uwl_call`, host
callbacks, `@N` version pinning, singleton and pool. The repo is its own vcpkg registry.

- **Made:** tag `v1.0.0` → `4da2c0b` (as recorded).
- **Read back:** validated end to end that day on `x64-mingw-dynamic` (an overlay install with
  pre-seeded downloads, then the consumer example `add(3,4)=7`).
