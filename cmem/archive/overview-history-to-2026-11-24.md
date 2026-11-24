# archive: overview.md history, as it stood on 2026-11-24

Moved out of overview.md verbatim on 2026-11-24 (memory guide, letter H38): the workspace-letter status list (every letter there is answered or closed; the open ones are in STATE.md) and the 2026-10-20 repository move. Read only when asked about past work.

## Repository location — moved to the `synapticforge1` org (recorded 2026-10-20)

- **Canonical home:** `https://github.com/synapticforge1/universalWasmLoader-c` (an organization
  under the owner's control). Formerly `https://github.com/jrmarcum/universalWasmLoader-c`; GitHub
  redirects the old path, but a redirect is not a contract — new references use the org path.
- **The JSR package scope is a separate namespace and did NOT move:** the reference loader is still
  `@jrmarcum/universal-wasm-loader` on jsr.io; sibling repos (e.g. `wasmtk`) were not part of this move.
- **References repointed 2026-10-20** as **1.1.0 port-version 2** (header unchanged, so no version
  bump): port `homepage`, the portfile's raw-github header + LICENSE URLs (verified to resolve at
  `v1.1.0` under the org and to match the existing sha512 pins), and `docs/vcpkg.md`. `versions/`
  hand-updated (git-tree `f2df1575…`, baseline port-version 2). Local `origin` remote set to the org
  URL. Consumers' `vcpkg-configuration.json` registry `repository` should use the org URL, with a
  baseline at or after the `registry: … port-version 2` commit once it is pushed.

## Workspace letters — status for this repo (2026-11-10)

From the workspace ledger `../../../cmem/workspace-correspondence.md` (read first since 2026-10-26)
and the letters in `../../../cmem/handoffs.md`; the workspace sweep reads this section.

- **H15 (Bun scripting)** — done: `5fad372` (bash → Bun fetch script), `f1e14d1` (local rules
  trimmed to the workspace floor).
- **L2 (cut tracked `CLAUDE.md` to a pointer)** — done: `e189da8` (archive: `git show 1057d89:CLAUDE.md`).
- **H7 / C11 (reference fixtures)** — done 2026-10-26: the stamped set copied from loader-js
  `36aa661` (wasmtk `4a5c3cf668d`; history `f50c8e4` → `84b3e180eba` → `4a5c3cf668d`, wasmtk's
  maps), 12/12 sha256, 29/29, inverted (see Tests). Asked of loader-js by letter **C13**
  ([handoffs.md](handoffs.md)), verified and closed the same day. `wasi_io_50` and `init_check`
  exercised by `spec_tests.c` the same day (34/34, both inverted; see Tests) — H7 fully done here.
- **H17 part 3 (stale `jrmarcum/wasmtk` link)** — done 2026-10-26: `README.md:4` →
  `synapticforge1/wasmtk`.
- **H22 / H25 §3(d) (path test)** — recorded 2026-10-26 in [working-rules.md](working-rules.md).
  Scan at HEAD with binaries (`git grep -a`): no drive path.
- **H24 / H27 (★ re-copy, new stamp)** — done 2026-10-26: rule 5.2 re-copied, stamp now
  `Copied from synapticforge1/cmem/best-practices.md on 2026-10-26`; text check 0 differences
  ([best-practices.md](best-practices.md) § ★), including ★ 6.1's corrected id (C8).
- **H29 (three behaviour checks, S8 / S9 / S10)** — answered 2026-11-07: S8's typed-accessor
  defect FIXED (see § Typed accessors check the result kind), raw mode already correct; S9 and the
  `.wit` fallback measured and recorded, not changed (owner / -js); S10's HTTP half n/a (no HTTP
  path). Fix `83fbeda`, released in **1.1.2** (2026-11-07). S9 and the `.wit` fallback were then
  decided as SPEC 4.0.0 and carried here by C29.
- **C29 (re-align to SPEC 4.0.0; from loader-js)** — done 2026-11-07 (see § SPEC 4.0.0): items
  (1) to (4) done, (5) n/a (no http). **Released as 2.0.0** the same day (tag `v2.0.0` →
  `56217b6` after the owner-approved re-tag; CI run `42398823979` green). Answered in the ledger; loader-js verifies and closes.
- **C39 (a host callback needs a way to fail; from loader-v)** — done 2026-11-08: `uwl_err` /
  `UWL_ERR` (see § A host callback can fail), **released in 2.1.0** the same day. CLOSED by
  loader-v on 2026-11-09, after it re-derived the change on `origin` and adopted it (-v `ea08973`).
- **H32 (CI-made Release pages; loader-c: "a `release` job")** — done 2026-11-09 (`b794dd2`): the
  job and `scripts/github-release.ts` with its mock-API self-test (13/13, inverted by three
  mutants). **Measured on GitHub by `v2.1.1`: the page was made by `github-actions[bot]`.** See
  [compat-gate.md](compat-gate.md) § The release page. No backfill (owner).
- **H31 (Bun notations = the latest installed)** — done 2026-11-09 (`b794dd2`): `vcpkg-release.yml`
  1.4.3 → **1.4.4** (`bun --version` here), now one `BUN_VERSION` plus its sha256. That was the
  only Bun version in the tree. Proven by `main`'s run `42648553716` (green).
- **H30 (no `gh`, in CI too; record-only for this repo)** — recorded 2026-11-09 in
  [working-rules.md](working-rules.md) § "No `gh`". Nothing to change: 0 `gh` hits outside `cmem/`
  (`git grep -n -w gh -- . ':!cmem'`). The one web-UI task is the owner's "Re-run failed jobs" /
  `workflow_dispatch`. Answered in the ledger; the workspace verifies and closes.
- **H33 (the release process, semi-uniform; D1–D3)** — done 2026-11-10, pushed (`0d3e6d1`;
  `main`'s run `42856737050` green on the non-release path), unreleased: the card's "To converge" list. U4 is `scripts/release.ts` (pushes `main` only).
  D1 is the workflow: checks → CI's tag (`ci-tag.ts`) → the page → `publish`. U10 is the
  registry-mode install as a user, in CI. U9: no `uses:`, Bun / Zig by sha256, vcpkg by commit,
  `permissions: {}`, `concurrency`. D3 is [release.md](release.md). Rehearsed before landing
  ([compat-gate.md](compat-gate.md) § The release page); first measured by the next release.
- **H34 (the owner's words "commit", "push", "release")** — the workspace's section in
  [working-rules.md](working-rules.md), kept as written, committed 2026-11-10.
- **C30 / C34 (release-workflow hazards; from S3D-ReportCompiler, record-only)** — read
  2026-11-08 (reasoned, not measured). Neither applies as written: `vcpkg-release.yml` has no
  `id-token`, uses no secret, and publishes to no registry (the tag is the release, which a person
  pushes). It has no `permissions:` block either, so its `GITHUB_TOKEN` gets the repo's default
  scope, and its `uses:` are tag-pinned (`@v4`, `@v2`). Not changed; a `permissions: contents:
  read` line would narrow the token, and that is the owner's call.
- **H28 (maintainer address in one `cmem/` note; wabt-ts / binaryen-ts retired)** — record-only,
  nothing to change: this repo's history and commits use noreply (H19), it carries no contact note,
  and no tracked file cites either retired repo (★ rule tags name them as origins, not locations).
- **H16 (`.git` growth)** — applied 2026-10-22 with the owner's OK (gc, fsck clean,
  `maintenance.strategy gc`, 1 pack); details in the gitignored `local/environment.md`.
- **H18 (personal drive paths)** — not addressed here, but the scan pattern found the old
  `.vscode/settings.json` path; fixed in `99a4bbb`, untracked in `bc3666f`.
- **H19 (purge personal information from history)** — done 2026-10-22 with the owner's go: the
  personal address (all 34 commits + the `v1.0.0` tagger) → GitHub noreply, the `.vscode` path
  removed from every commit (34 → 33), tagged trees byte-identical, force-pushed with leases.
  **Every hash changed** — old → new map for the workspace's citations and for vcpkg registry
  `baseline` pins: [history-purge.md](history-purge.md). The rewritten head was `bc3666f`; the
  record landed in `77cf808` (CI green, run `39823105880`). ⚠️ CI runs from before the rewrite show
  the OLD hashes on GitHub; translate them with the map.
- **For the workspace sweep — drift W7 / layout-and-packaging P5 (org Actions policy):** MEASURED
  2026-10-22: run `39804596951` on `0494969` (GitHub shows its pre-H19 hash `0f9b6e3`) executed
  `oven-sh/setup-bun@v2` in this repo's
  `validate` job and succeeded — the `synapticforge1` org permits third-party `uses:` for this repo.
  (`mlugg/setup-zig@v2` is in the tags-only `compat` job, not yet run.)
- **H6** — done 2026-10-22: ★ copy + § L in `best-practices.md` and the memory-layout audit
  (`e80d838`); the SemVer compatibility gate ([compat-gate.md](compat-gate.md)). Only the CI
  `compat` job first ran on the `v1.1.1` tag, 2026-10-26: green ([compat-gate.md](compat-gate.md)). The ★ copy was re-copied 2026-10-26 (H24 / H27 above).
