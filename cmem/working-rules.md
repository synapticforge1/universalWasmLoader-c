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
  The release (2026-11-10, H33): `scripts/release.ts` (`make release KIND=…`, `release-dry-run`);
  CI only: `ci-tag.ts`, `github-release.ts`, `github-api.ts`; their self-test
  `check-github-release.ts` (`make release-selftest`). Besides C, Bun is the only scripting
  runtime here.
- **Releases go through `make release KIND=…`** ([release.md](release.md)), which runs `make
  bump`; never a hand edit of the version line, the sha512 pins or `versions/`, and **never a
  hand-made tag** (CI tags, owner's order 2026-11-10). A surface change is re-baselined (`make
  surface`) in its own commit before the release.
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

## The release: CI checks, CI tags, the page, the registry (🔒 owner, 2026-11-09 / 11-10; H32, H33)

"yes. From this point forward it is the release page" (2026-11-09). "The CI to check first, then
push the tag, and then create the release page from the tag, then publish the package to the
registry" (2026-11-10). A release is CI's tag PLUS its Release page PLUS a green registry
read-back, all from one workflow run on the pushed `main`. How it works, slot by slot, and every
release so far: [release.md](release.md). "Only new tags will get release pages": no backfill.
If a job fails, the release is incomplete. "Re-run failed jobs" (an owner web-UI item); every
job is safe to re-run. Never a new tag for the same code, never a moved tag.

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

## Owner commands: "commit", "push", "release" (owner, 2026-11-10)

🔒 Written into every project by the workspace session on the owner's direction (2026-11-10:
"please write that into each project"; workspace `cmem/working-rules.md` Tooling rule 12, letter
H34). When the owner says:

- **"commit"** — first run "update the project memory files" (re-derive this repo's `cmem/` from
  its current state), then commit to the branch being worked on. Nothing is pushed.
- **"push"** — perform "commit", then merge the branch into `main`, then push `main` (and the
  working branch) to GitHub (`origin`) and read it back with `git ls-remote`.
- **"release"** — perform "push", then the release process: the workspace's
  `cmem/release-process.md` §§ 5–8 — CI checks first, then CI pushes the tag, then the GitHub
  Release page from the tag, then the publish to the registry — recorded in `cmem/release.md`
  § "Release History" (newest first, a summary of what changed). The level (patch / minor /
  major) is the owner's: ask if it was not given.

Each command includes the one before it, and none goes further than its own word (a "commit"
never pushes, a "push" never releases). This repo's own gate and merge rules apply at each step.
