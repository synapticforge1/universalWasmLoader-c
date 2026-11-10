# release.md — how this repo releases, and every release so far

🔒 The ONE place releases are recorded (owner, 2026-11-10: "releases should be recorded in one
place in every project; … release.md should be the file name with the newest first in the
'Release History' with a summary of what changed in each one"; workspace letter H33, D3). Release
records that used to sit in `overview.md` § Current state and `compat-gate.md` § First tagged run
live here now; those places point here.

## How a release works (since 2026-11-10)

🔒 Owner, 2026-11-10 (D1): **"the CI to check first, then push the tag, and then create the release
page from the tag, then publish the package to the registry."** The workspace's uniform shape
(`../../../cmem/release-process.md` § 5, slots U1–U12), filled for this repo:

| Slot | Here |
| --- | --- |
| U1 the go and the level | The owner's "release" with a level. `make release KIND=patch\|minor\|major`; `release.ts` and `bump.ts` refuse a missing level. There is no default. |
| U2 merge first; the bump is its own commit | Notes (the README "Breaking Changes" row for a major) are merged into `main` first. `release.ts` makes the bump commit `bump to vX.Y.Z` itself, then a second commit for the registry entry (`registry: X.Y.Z git-tree and baseline`). |
| U3 the bump tool | `scripts/bump.ts` refuses a dirty tree (untracked files count) and a stale surface. It computes the floor from the surface diff since the last tag and refuses a lower level. For a patch or minor it runs the previous tag's tests. It syncs `vcpkg.json` and the portfile's version and both sha512 pins (from the COMMITTED blobs). [compat-gate.md](compat-gate.md) |
| U4 the release script | `scripts/release.ts`. Guards: on `main`, a clean tree, `main` = GitHub's (`ls-remote`), the tag absent here and on GitHub, `versions/` without the version, and the cold gate (surface check, both self-tests, `make clean test`). Then the bump, the registry entry, a re-check, ONE push of `main` and a read-back. **It makes and pushes no tag.** `--dry-run` stops after the guards. |
| U5 `checks` first | `validate` (every push and PR): pins, versions, git-tree, surface, both self-tests, and "is this a release?" (`ci-tag.ts state`). Then, for a release: `compat` (floor + previous-tag tests, Linux) and `install` (the port on 3 OSes from an overlay copy aimed at THIS commit, since the tag does not exist yet). All are token-less clones. |
| U6 CI tags | `tag`: `ci-tag.ts create`, the annotated `vX.Y.Z` on `github.sha` via the REST API, read back. It is a no-op if the tag is already there, and refuses if the tag is elsewhere. |
| U7 the page from the tag | `release`: `github-release.ts`, H32's order (tag peels to `github.sha` → an existing page is done → POST with generated notes and a vcpkg note → read back, peel again). |
| U8 publish | For this git-tag registry, U6's tag IS the publish: the port downloads the header from it. `publish` is the read-back: on 3 OSes it installs the version the way a user does (manifest mode, this repo as a git registry, baseline = this commit). It FAILS unless vcpkg installs exactly this version with the pinned header and the copyright. There is no registry credential and no provenance to read: vcpkg verifies the sha512 pins itself. |
| U9 pins | No `uses:` anywhere. Git clones are credential-less. Bun 1.4.4 and Zig 0.16.0 are pinned by version + sha256, vcpkg by commit (tag 2026.10.16). Top-level `permissions: {}`; only `tag` and `release` hold `contents: write`. `concurrency` is one group per ref, never cancelled (the tag is not known until `validate` runs, so the group is the ref, not the tag). |
| U10 install as a user | Done IN CI by `publish`. By hand: `docs/vcpkg.md` § 2a. |
| U11 record | This file, newest first. |
| U12 failure | "Re-run failed jobs" (owner, web UI). `ci-tag.ts state` treats a tag already on this commit as a re-run; `create`, the page and `publish` skip or repeat what is done. Never a new tag for the same code, never a moved tag (2.0.0's move, below, came before this rule and was the owner's word). |

The workflow is `.github/workflows/vcpkg-release.yml`. Its scripts are `scripts/ci-tag.ts`,
`scripts/github-release.ts` and `scripts/github-api.ts`, tested by `scripts/check-github-release.ts`
(`make release-selftest`). The design, rehearsal and measurements are in
[compat-gate.md](compat-gate.md) § The release page.

**Reading a run:** GitHub's public REST API allows 60 unauthenticated requests an hour. Poll a run
every 2–3 minutes, not faster; `releases.atom` and the page itself are not rate-limited.

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
