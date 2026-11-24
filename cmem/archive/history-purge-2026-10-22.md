# history-purge.md — the 2026-10-22 history rewrite (workspace letter H19)

🔒 Owner, 2026-10-22: purge personal information from git history ("a necessary thing for
security"), following loader-dotnet's template. Done 2026-10-22 with the owner's go.

## What was found (measured over every commit, branch and tag)

- **The owner's personal address** as author AND committer on all 34 commits (65 fields; the one
  other committer was GitHub's web-flow noreply), and as the tagger of the annotated `v1.0.0`.
  Its source on this machine is recorded privately in `local/environment.md`.
- **A personal drive path**: `.vscode/settings.json` held an absolute local path in 11 commits
  (added by the 2026-10-20 "update" commit; made relative in `99a4bbb`, untracked in `bc3666f`).
  Neither release tag's tree contained it. No commit message held a path or the address.
- The Claude `Co-Authored-By` trailers use Anthropic's noreply address — not personal; kept.

## What was done

1. `bc3666f` untracked `.vscode/settings.json` and gitignored `.vscode/` and
   `.claude/settings.local.json` (workspace rule: IDE/tool settings are never tracked). This repo's
   local `user.email` is the owner's GitHub **noreply** (`81428316+jrmarcum@users.noreply.github.com`,
   the public account id, checked against the GitHub API).
2. Backup: `git bundle --all` (34 commits) to the session scratchpad before rewriting.
3. `git filter-branch --env-filter … --index-filter 'git rm --cached --ignore-unmatch
   .vscode/settings.json' --prune-empty --tag-name-filter cat -- --branches --tags`. The env-filter
   replaced ONLY the exact personal address (read from git config at run time, never written to a
   file) with the noreply. The "update" commit that only added the settings file became empty and
   was dropped (34 → 33). `v1.0.0` was re-created with the same message and date and a noreply
   tagger (filter-branch keeps a tag's tagger line).
4. Verified before pushing, on branches + tags: 0 personal-address hits in authors, committers,
   taggers and messages; 0 drive-path hits in any tree or message; no `.vscode/` in any tree; the
   `main`, `v1.0.0`, `v1.1.0` trees and their `ports/` trees **byte-identical** to before; all four
   `versions/` git-trees reachable; `surface-check`, self-test 50/50, `make clean test` 29/29,
   `make compat` green.
5. Force-pushed `main` and both tags, each with `--force-with-lease` on the exact old remote value
   (`main` 245564e, `v1.0.0` tag object 3eba7e6, `v1.1.0` 55b6244). Then confirmed the header and
   LICENSE served by raw.githubusercontent at the rewritten `v1.1.0` match the portfile sha512 pins.
6. Local cleanup: `refs/original` deleted, reflog expired, `gc --prune=now`; old objects gone.
   ⚠️ exFAT trap: the commit-graph written by the earlier H16 `gc` is read-only and git could not
   replace it, so `fsck` listed every pruned commit; deleting the stale file and
   `git commit-graph write --reachable` fixed it (`fsck` and full `fsck` clean).
7. The 12 hash citations in `CLAUDE.md` and `cmem/` were rewritten from the map below (a one-time
   script; every cited hash resolves afterwards).

## Not in our control

- **vcpkg registry consumers pin a `baseline` commit of this repo.** Every commit hash changed, so a
  consumer's old baseline stops resolving once GitHub garbage-collects the old commits; it must be
  replaced by the mapped commit (registry content is unchanged: same `versions/`, same port trees).
  The header and LICENSE at each tag are unchanged, so the sha512 pins hold.
- GitHub serves old commits by hash until its own GC; forks and PR refs keep them. A full purge is
  a GitHub Support request (owner).
- Old hashes stay in past CI runs, in the workspace letters (it updates them from this map), and in
  commit messages written before the rewrite.

## Old → new (every commit on `main`; tags: `v1.0.0` 0c6b596 → 4da2c0b, `v1.1.0` 55b6244 → 3aea7bd)

```text
14f0c5e -> a0adb0d  2026-05-19 Initial commit
5f0dfd8 -> 315b619  2026-05-20 update docs
91a8a27 -> 11b65cf  2026-05-20 update docs
ece71c6 -> 4d5692e  2026-06-15 Add portable cmem/ project memory + SPEC 3.0.0 conformance note
5750acb -> e246903  2026-06-15 cmem: record vcpkg as the C/C++ distribution target (owner decision 2026-06-15)
fc72839 -> c2e72b1  2026-06-17 Implement v1 header-only loader (SPEC 3.0.0) + reference suite (29/29)
ac7de26 -> b43bb01  2026-06-17 Add vcpkg port (git registry), consumer example, setup guide; fix license to MIT
1ab2493 -> 1dfe25b  2026-06-17 registry: add versions/ for universal-wasm-loader-c 1.0.0
b5b9e7a -> 0f81a0a  2026-06-17 port: fix CMake parse error + drop unused host dep (vcpkg-validated)
b43a16f -> 3375f8c  2026-06-17 registry: point 1.0.0 git-tree at the validated port tree
0c6b596 -> 4da2c0b  2026-06-17 docs: note manual versions/ maintenance (x-add-version needs full vcpkg root)
cbd18bd -> 9bfcf43  2026-06-19 update to simplify user interface calling the wasm module functions.
a120183 -> 8e9cb2c  2026-06-19 example addition
66bb8ec -> b71b496  2026-06-24 port: release universal-wasm-loader-c 1.1.0 (convenience call layer)
55b6244 -> 3aea7bd  2026-06-24 registry: publish universal-wasm-loader-c 1.1.0
ceba25e -> 7de173a  2026-06-24 port: bundle wasmtime license in copyright (1.1.0 port-version 1)
f80cafc -> 3777719  2026-06-24 registry: publish universal-wasm-loader-c 1.1.0 port-version 1
3ff3289 -> 013568d  2026-06-24 ci: add vcpkg release validation + cross-platform install gate
95f34f3 -> 5981bc1  2026-10-20 port: point at synapticforge1 org (1.1.0 port-version 2)
10880cf -> 0ca9938  2026-10-20 registry: publish universal-wasm-loader-c 1.1.0 port-version 2
411bb59 -> 1057d89  2026-10-20 memory: record move to synapticforge1 org
0052cee -> dropped  2026-10-20 update
835eb01 -> b7b8cdb  2026-10-20 memory: record cross-platform vcpkg install validation
ebcced1 -> 5fad372  2026-10-22 scripts: port fetch-wasmtime from bash to Bun
05b22fe -> e253123  2026-10-22 build: default the C compiler to zig cc
0271ef3 -> f1e14d1  2026-10-22 build: keep macOS on the system unwinder; align rules with workspace
6db2bc3 -> 8f7daf3  2026-10-22 memory: defer fixture refresh until the next wasmtk release
6ca86e9 -> e189da8  2026-10-22 memory: cut CLAUDE.md to a pointer (L2)
80647de -> 8d09333  2026-10-22 memory: record CI coverage gap and workspace letter status
7b7be45 -> e80d838  2026-10-22 memory: H6 best-practices copy and memory-layout audit
0f9b6e3 -> 0494969  2026-10-22 gate: SemVer compatibility gate (workspace letter H6)
dc32fd6 -> c2ad276  2026-10-22 repo: pin LF line endings in .gitattributes
245564e -> 99a4bbb  2026-10-22 memory: apply the 2026-10-22 workspace rules review
fe75abd -> bc3666f  2026-10-22 repo: untrack IDE settings
```
