# working-rules.md — the standing rules for universalWasmLoader-c

Summary: the rules that hold in this repo, in the present tense, on top of the workspace floor
([`../../../workspace/cmem/working-rules.md`](../../../workspace/cmem/working-rules.md) and
[`tooling-rules.md`](../../../workspace/cmem/tooling-rules.md)), which apply in full. How a rule
changed is in [design-decisions.md](design-decisions.md). Last verified 2026-11-24.

## A session, start and end

- **Start:** read `STATE.md`, then `INDEX.md`, then the workspace correspondence
  (`../../../workspace/cmem/workspace-correspondence.md`) and only the letters
  (`../../../workspace/cmem/letters/<ID>.md`) addressed to this repo or touching the task.
- **Answer a letter** by appending ONE bullet under its `## Answers`:
  `- **loader-c, <date>:** <what was done, the commit, the check>`, lines under 200 characters.
  Never change its status or its index line; only the item's creator closes it (workspace H41).
- **A letter from this repo** is a new `letters/C<n>.md` plus its index line (next free `C`
  number, after re-reading the index and `archive/correspondence-closed.md`). Nothing else is
  ever written outside this repo.
- **End:** rewrite `STATE.md`; move items closed this session to `archive/`; record decisions in
  `design-decisions.md` and rules here; empty the scratchpad; run `make cmem-check` and fix what it
  reports (workspace memory guide, H38).

## The owner's words

🔒 Written into every project on the owner's direction (2026-11-10, workspace Tooling rule 12,
letter H34), with the review words of 2026-11-17 (Tooling rule 13, letter H37):

- **"commit"** — run "update the project memory files", then commit to the branch being worked on.
  Nothing is pushed.
- **"push"** — perform "commit", merge the branch into `main`, push `main` (and the working branch)
  to GitHub and read it back with `git ls-remote`.
- **"release"** — perform "push", then the release process ([release.md](release.md)): the review
  gate first, then `make release KIND=…`. The level (patch / minor / major) is the owner's: ask if
  it was not given.
- **"review"** runs all five required reviews in order — basic, hardening, licensing, security,
  privacy ([review-process.md](review-process.md)). **"basic review"**, **"hardening review"**,
  **"licensing review"**, **"security review"**, **"privacy review"** and **"efficiency review"**
  each run that one class.
- **"update the project memory"** (or "update memory", "record this") — audit every `cmem/` file
  for stale live claims (grep the old values, not only the files touched), revise them, keep
  dates absolute; then sync `README.md` / `docs/` only where the change is user-relevant.
- **"look for code issues"** (or "code audit") — audit tested AND untested paths for workarounds,
  dead code, bugs (ABI marshalling, pointer / length arithmetic, endianness, a missing
  `cabi_post`) and silent fall-throughs; report `file:line` and severity, fix the safe ones, and
  keep `make clean test` green.

Each command includes the one before it, and none goes further than its own word.

## Memory

- **`cmem/` is the single home of the project memory.** `README.md` and `docs/` are the public,
  user-facing docs; internal decision logs and post-mortems stay in `cmem/`.
- **Layout and limits are the workspace memory guide's** (H38): `STATE.md` ≤ 60 lines, `INDEX.md`
  a router ≤ 3 KB, any other live note ≤ 25 KB, lines ≤ 200 characters; `archive/` and `local/`
  are unlimited and read only when asked. The root `CLAUDE.md` is untracked and points at
  `STATE.md` and `INDEX.md` only.
- **The ★ rules are a copy** in `best-practices-shared.md` (owner, 2026-11-19, H38: keep it, in a
  file of its own), the one stated exception to "link, do not copy". It is never edited in place:
  re-copy from the workspace and compare the whitespace-normalized text by script.
- **Machine facts and anything private go in `cmem/local/`** (gitignored), never in a tracked file.

## Scripts and tools

- **Committed scripts are TypeScript run by Bun** (C has no scripting mechanism; workspace Tooling
  rule 1). A one-time script deleted after use may be shell or Bun, written with `Write`, never a
  heredoc. No host Python, no committed shell scripts.
- **The scripts:** `fetch-wasmtime.ts` (`make fetch`); the compatibility gate `surface.ts`,
  `compat.ts`, `bump.ts`, `check-compat-gate.ts` ([compat-gate.md](compat-gate.md)); the release
  `release.ts`; for CI only `ci-tag.ts`, `github-release.ts`, `github-api.ts`, with their self-test
  `check-github-release.ts`; the review-standard gates `review-gate.ts`, `check-privacy.ts` and
  their `*.test.ts` (`bun test scripts/`); the memory size check `check-cmem.ts`.
- **A tool a script spawns runs with a relative path and `cwd`**, never an absolute Windows path:
  GNU tar reads `<drive>:\…` as a remote `host:path`.
- **The C compiler is `zig cc`** by default, linked with Zig's `libunwind` everywhere except macOS
  ([overview.md](overview.md) § Build / release flow). `CC=…` overrides it.
- **Bun notations are the latest installed Bun** (🔒 owner, Tooling rule 10, letter H31): check
  `bun --version` before writing one. `vcpkg-release.yml`'s `BUN_VERSION` and `BUN_SHA256` (the
  sha256 of `bun-linux-x64.zip` in that release's `SHASUMS256.txt`) move together. A dated test
  result keeps its Bun until re-run. This repo declares no minimum Bun.
- **No `gh`, in CI too** (🔒 owner, Tooling rule 9, letter H30). Check the repo instead:
  `git ls-remote` for branches and tags; the served file hashed against its pin; GitHub's public
  REST API for CI results (60 unauthenticated requests an hour: poll every 2–3 minutes). A GitHub
  web-UI task ("Run workflow", "Re-run failed jobs") is an owner item.

## Releases

- **A release is `make release KIND=…`** ([release.md](release.md)): the review gate, the local
  gates, the bump and registry commits, ONE push of `main`. Never a hand edit of the version line,
  the sha512 pins or `versions/`; **never a hand-made tag** — CI tags (owner, 2026-11-10).
- **CI only publishes** (🔒 owner, 2026-11-17, H37): it verifies the version, tags, makes the page,
  and installs the version from the registry as a user. Every test and gate runs locally.
- **A surface change is re-baselined** (`make surface`) in its own commit before the release.
- **A failed CI job is re-run** ("Re-run failed jobs"); every job is safe to re-run. Never a new
  tag for the same code, never a moved tag.

## Reviews

- **The standard is the workspace's** (`../../../workspace/cmem/review-process.md`); this repo's
  slots are in [review-process.md](review-process.md).
- **Open review issues live in `cmem/review-issues.md`, which is gitignored**; the privacy gate
  refuses it if it is ever tracked.
- **Fixes go on a local review branch**, merged to `main` when the review completes; the
  completed review is recorded as `- Review complete: <commit>` in `review-process.md`.
- **A reviewing agent never commits, pushes or releases.** Its folder (clones, mutants) lives under
  the main session's scratchpad and is removed at triage.

## Privacy

- 🔒 **Nothing private is ever made public** (owner, 2026-10-22): no tokens, keys, passwords,
  personal emails or machine-specific paths in any tracked file, commit message or issue.
- **The path test is "is it machine-specific?"** (🔒 owner, 2026-10-23, H22). Not public: a path
  that records one machine's layout (a user profile, the project tree, other drives, scoop /
  AppData installs, scratchpad or session ids). Fine: repo- or sibling-relative paths, env vars,
  placeholders such as `<repo-root>`, and convention paths that name nothing about one machine.
- **No personal address anywhere here:** commits use the noreply address (H19), and no manifest
  here has a maintainer field.
- **The gate is `make privacy`** (`check-privacy.ts`: every tracked and new file in any encoding,
  optionally commit messages); `release.ts` runs it over the commits since the last release.

## Scratch space

🔒 Bounded and cleaned by the session that used it (owner, 2026-11-19; Tooling rule 15, letter H43):

- **Only the session's own scratchpad**, never another temp location or another session's folder;
  its path is a machine fact and never goes in a tracked file.
- **Delete when the item is cleared:** a one-time script after its run; a clone, mutant or build
  output when its finding is fixed and verified. Nothing lives only in scratch.
- **Budget: 200 MB per session folder.** Say so before making anything larger (a clone, a vcpkg
  install root), and remove it when the step is done.
- **"commit" ends with an empty scratchpad**, before the memory update.
- **Project data lives in the project folder** (`cmem/`, or `cmem/local/` when private), never only
  in the assistant's per-project memory folder; a fact found there is copied here and removed there.
