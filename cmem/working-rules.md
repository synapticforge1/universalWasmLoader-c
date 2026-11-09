# working-rules.md — repo-local rules for universalWasmLoader-c

The workspace floor ([`../../../cmem/working-rules.md`](../../../cmem/working-rules.md)) applies here
in full. Scripting (workspace Tooling rule 1, 🔒 owner 2026-10-22, "Deno is going away", clarified
three times that day): a COMMITTED script kept for repeated use is written in the repo language's
scripting mechanism, and C has none (a mechanism that must build an executable would not count
anyway), so **committed scripts here are TypeScript run by Bun**. A one-time scratch probe deleted
after use may be shell, Bun or anything that fits — still written with `Write`, never a heredoc.
No host Python, no committed shell scripts. This file holds only what is specific to this repo.
**A repo's own rules govern inside that repo.**

## Scripts

- **In-tree scripts:** `scripts/fetch-wasmtime.ts` (called by `make fetch` as
  `bun run scripts/fetch-wasmtime.ts $(WASMTIME_VERSION) $(WASMTIME_PLATFORM)`). It replaced the bash
  `scripts/fetch-wasmtime.sh` on 2026-10-22; no shell scripts remain in the repo. The compatibility
  gate (2026-10-22): `scripts/surface.ts`, `compat.ts`, `bump.ts`, `check-compat-gate.ts`, run via
  `make surface | surface-check | compat | compat-selftest | bump KIND=…` ([compat-gate.md](compat-gate.md)).
  The release page (2026-11-09): `scripts/github-release.ts` (CI only) and
  `check-github-release.ts` (`make release-selftest`).
  Besides C, Bun is the only scripting runtime here.
- **Releases go through `make bump`**, never a hand edit of the version line or the sha512 pins; a
  surface change is re-baselined (`make surface`) in its own commit before the bump.
- **External tools a script spawns run with a relative path and `cwd`**, never an absolute Windows
  path: GNU tar reads `<drive>:\…` as a remote `host:path`.
- **Machine facts and anything private go in `cmem/local/`** (gitignored, verified with
  `git check-ignore -v` 2026-10-22), never in a committed file (workspace § Records, 🔒 owner
  2026-10-22). Scan the diff before committing memory.
- **The path test is "is it machine-specific?", not "is it absolute?"** (🔒 owner, 2026-10-23;
  workspace letter H22, full text in the floor's § Records). Not public: any path that records the
  owner's machine layout — a user profile, the project tree, other drives, scoop / AppData installs,
  scratchpad or session ids. Fine: repo- or sibling-relative paths, env vars, placeholders
  (`<repo-root>`), and a CONVENTION path that names nothing about one machine and works on any
  comparable host. A scan hit is a CANDIDATE judged by that test, so convention paths are not
  scrubbed. Scans include binaries (`git grep -a`; workspace C3: Zig/Rust debug info embeds paths).
  The one email allowed is the maintainer contact as commit author/committer (owner, 2026-10-26);
  this repo's history already uses noreply (H19) and keeps it.

## No `gh`, in CI too (🔒 owner, 2026-11-08; workspace Tooling rule 9, letter H30)

`gh` is not installed and is not to be. **Check the repo instead.**

- Branches and tags: `git ls-remote origin`.
- A served file: raw GitHub at the tag, hashed against the portfile's sha512 pin.
- CI results: GitHub's public REST API, read-only and without a token (`actions/runs`, `/jobs`).
  That is how every tag run here has been read since 2026-10-26.

A GitHub web-UI task is an OWNER item, never "blocked on gh". Here that means a
`workflow_dispatch` run of `vcpkg-release.yml` ("Run workflow"). The GitHub Release page is made
by CI's `release` job through the REST API, never by hand (H32, 2026-11-09; see the next section).

## The release is the CI-made Release page (🔒 owner, 2026-11-09; letter H32)

"yes. From this point forward it is the release page." A release is the tag PLUS its Release
page. The page is made by the `release` job after every other job is green on the tag; how it
works is in [compat-gate.md](compat-gate.md) § The release page. "Only new tags will get release
pages": no backfill, so v1.0.0 … v2.1.0 stay without one. If the job fails, the release is
incomplete. Re-run the failed job (an owner web-UI item); the script is safe to re-run.

## Bun version: always the latest installed (🔒 owner, 2026-11-09; Tooling rule 10, letter H31)

"Update any notations on bun version to the latest installed version always." Before writing a
Bun version, check `bun --version`. It was 1.4.4 on 2026-11-09, so `vcpkg-release.yml`'s
`BUN_VERSION` moved 1.4.3 → 1.4.4 that day. `BUN_SHA256` is the sha256 of `bun-linux-x64.zip`
from that release's `SHASUMS256.txt`, so move the two together. A dated test result keeps its
Bun until the test is re-run. This repo declares no minimum Bun.

Measured 2026-11-09: `git grep -n -w gh -- . ':!cmem'` on `main` gives 0 hits (only memory names
the rule). `vcpkg-release.yml` calls no `gh`, and no script does. If a workflow ever needs what `gh` did, it uses the REST API from a Bun
step with `GITHUB_TOKEN`, landed before a release and proven by its next real run.

## C compiler: `zig cc` (owner, 2026-10-22)

The Makefile's default `CC` is `zig cc`, linked with Zig's `libunwind` everywhere except macOS; see
[overview.md](overview.md) § "Build / release flow". Other compilers stay supported via `CC=…`.
