# handoffs.md — letters FROM this repo to its siblings

Outgoing letters, full text. Each is indexed by one row in the workspace ledger
(`../../../cmem/workspace-correspondence.md`), which the recipient reads at session start. Nothing is
written into a sibling's tree from here (workspace ★ 8.1); the recipient acts under its own rules and
writes its commit into the ledger row as the answer; this repo, as the creator, verifies and closes.

## C13 — to universalWasmLoader-js: re-stamp the reference fixtures from wasmtk `4a5c3cf668d` (2026-10-26)

**From:** universalWasmLoader-c. **To:** universalWasmLoader-js (and, for the copy step, -dart and
-dotnet, which carry the same stamp). **Concerns:** workspace letters H7 (fixtures) and H17 part 3
(stale links), ledger C11 (wasmtk's second history rewrite), drift X8.

**What is wrong.** Your `tests/fixtures.json` stamps the reference set from a commit that no longer
exists, at a URL that is stale:

- `generator.repository` = `https://github.com/jrmarcum/wasmtk` — wasmtk moved to
  `https://github.com/synapticforge1/wasmtk` on 2026-10-23 (GitHub redirects today; do not rely on it).
- `generator.commit` = `f50c8e419a0652558a902e6fc2332915184cae3b` — wasmtk rewrote its history twice
  (2026-10-23, 2026-10-26). The same commit is now **`4a5c3cf668da2c5c6e2cde444851773b5d4f4a08`**
  (`f50c8e4` → `84b3e180eba` → `4a5c3cf668d`; maps `../wasmtk/cmem/history-purge-2026-10-23.md`
  and `history-purge-2026-10-26.md`, which names this stamp explicitly).
- The same URL is hard-coded in `scripts/regen-fixtures.ts:80`, and your memory quotes `f50c8e4` as
  the live stamp: `cmem/fixtures.md:18-28`, `cmem/overview.md:71`, `cmem/open-work.md:61-64,81`.

**What I measured (read-only, 2026-10-26).**

- `4a5c3cf668d` is on wasmtk's `origin/main` (and `origin/release/v3.0.0`):
  `git branch -r --contains 4a5c3cf668d`. So your H7 condition, "the owner pushes wasmtk `main` so
  the stamped commit is pinnable", **now holds.**
- Its commit date is `2026-10-09T20:13:12-04:00`, identical to your stamp's `committed`;
  `git describe --tags --always` gives `v2.0.3-64-g4a5c3cf6`, the same position as your
  `v2.0.3-64-gf50c8e419a0`.
- **All five source blob ids are unchanged:** `git rev-parse 4a5c3cf668d:tests/module/bindgen_fixtures/<name>.ts`
  for `math_50`, `booleans_50`, `strings_50`, `imports_50`, `wasi_io_50` equal your `sources` entries
  exactly (`244f2b1…`, `9661fd8…`, `72e29a2…`, `7184bfc…`, `935a867…`).
- **UNMEASURED:** that `modc` at `4a5c3cf668d` rebuilds your `files` byte for byte. Matching sources
  and position make it likely, not proved — the rewrites changed history, and the 2026-10-26 one
  changed a committed binary's bytes.

**What is asked (your session, your rules).**

1. Fix the URL in `scripts/regen-fixtures.ts:80` → `synapticforge1/wasmtk`.
2. Re-run `bun run fixtures` against a CLEAN wasmtk checkout at `4a5c3cf668d` — not wasmtk HEAD,
   which is now past 3.0.0 with breaking changes and the owner's 2026-10-26 number-type direction
   (ledger C10). Whether to stay on `4a5c3cf668d` or move to a released wasmtk is the owner's call;
   this letter asks only for the re-stamp of the set you already chose.
3. **The proof:** every `files` sha256 unchanged (only `generator.repository`, `commit`, `describe`
   change). If any `.wasm` differs, stop and record it: that is a finding about wasmtk's rewrite,
   not a fixture refresh. Invert it: corrupt one output byte and watch the verify step fail.
4. Update the live claims in your memory (the lines listed above); keep `f50c8e4` once as history,
   "`4a5c3cf668d` (was `f50c8e4`)" (H21's form).
5. Write the commit into ledger row C13 as your answer. Whether to push is the owner's.

**What this unblocks.** The ports copy your set unmodified once the stamp names a pushed commit:
loader-c's four `tests/*_50.wasm` have differed from your set since 2026-10-22 (`.wit` identical), so
loader-c's H7 has been deferred on exactly this. -dart (`test/fixtures/fixtures.json`) and -dotnet
carry the same stale stamp and re-copy after you. loader-c will then copy `tests/*.wasm`,
`tests/*.wit`, `tests/fixtures.json` and `init_check.wat`, verify every sha256 and run `make clean test`.

**Status:** ✅ closed 2026-10-26 by this repo (creator), after verifying loader-js's answer
(`36aa661`, merge `16f75de`): `36aa661` is on loader-js `origin/main` (`git branch -r --contains`);
its `tests/fixtures.json` diff is the three `generator` lines only, and it touches no fixture
binary; all ten `.wasm`/`.wit` match their `files` sha256. Followed here by the copy: 12/12 sha256,
`make clean test` 29/29, inverted (overview § Tests).
