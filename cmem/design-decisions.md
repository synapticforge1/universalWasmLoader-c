# design-decisions.md — decisions, and how the rules changed

Summary: each decision with its date, its reason and the letter it came from, newest first. The
rules themselves, as they hold now, are in [working-rules.md](working-rules.md). Last verified
2026-11-24. Release decisions are in [release.md](release.md); the SPEC decisions in
[overview.md](overview.md).

## D-2026-11-24 — the review standard, the memory guide and the moved workspace

- **CI stopped testing** (H37 (e), owner 2026-11-17: "We want the CI to verify the version, then tag,
  create the release page and publish"). `vcpkg-release.yml` lost `compat` (the floor and the
  previous release's tests on Linux), `install` (the port built on 3 OSes from an overlay aimed at
  the commit, before the tag) and `validate`'s surface and self-test steps. They run in
  `release.ts`'s local gate; the post-tag registry install on 3 OSes stays, as the publish
  read-back.
- **The release tooling's first step is the review gate** (H37 (d)): `review-gate.ts`, copied from
  rsxtk. A release needs `Review complete: <commit>` recorded on the code being released.
- **A privacy gate was added** (H37 (b)): `check-privacy.ts`, copied from rsxtk, set to no
  maintainer address (none is used here). Measured clean on 56 files and all 64 commit messages.
- **The root `CLAUDE.md` became untracked** (H38 step 3). It had been in `.gitignore` since
  2026-05-20 but stayed tracked; the privacy gate refuses a tracked `CLAUDE.md`.
- **The memory moved to the guide's layout** (H38): `STATE.md`, a router `INDEX.md`, this file,
  `open-work.md`, `testing.md`, `review-process.md`, `platforms.md`; `overview.md` was split (31.7
  KB → 18 KB); `handoffs.md` and `history-purge.md` were archived as closed.
- **The ★ copy moved to `best-practices-shared.md`** (owner, 2026-11-19, H38: "I agree with that" —
  keep it, in a file of its own). Its text is unchanged: one line was rewrapped where the canonical
  breaks it, and the whitespace-normalized text was compared identical by script.
- **The workspace memory moved** from `../../cmem/` to `../../workspace/cmem/` (H42), and
  correspondence became one file per item (H41).
- **Bun 1.4.4 → 1.4.5** in CI (Tooling rule 10): `bun --version` read 1.4.5 on 2026-11-24; the
  sha256 matched `SHASUMS256.txt` and a re-hash of the download.

## D-2026-11-10 — CI tags; one release record (H33, D1–D3)

- **Nobody tags by hand.** `release.ts` pushes `main` only; CI makes the tag, the page and the
  registry read-back (owner: "the CI to check first, then push the tag, and then create the release
  page from the tag, then publish").
- **The one release record is `release.md` § Release History**, newest first (D3).
- **The owner's words "commit", "push", "release"** were written in (H34).

## D-2026-11-09 — the Release page is the release (H32); Bun 1.4.3 → 1.4.4 (H31)

- "yes. From this point forward it is the release page." CI makes it through the REST API; old tags
  get none ("only new tags will get release pages").

## D-2026-11-08 — no `gh` (H30)

- `gh` is not installed and is not to be; measured 0 uses in this repo's scripts and CI.

## D-2026-11-07 — SPEC 4.0.0 (C29): released as 2.0.0, a major

- The SPEC's loud failures were adopted in full; the http items do not apply (local files only).

## D-2026-10-23 — the path test is "is it machine-specific?" (H22)

- A convention path that names nothing about one machine is not scrubbed.

## D-2026-10-22 — scripts on Bun, `zig cc`, the compatibility gate, the history purge

- **Bun replaced the bash fetch script** (Tooling rule 1: C has no scripting mechanism).
- **`zig cc` became the default compiler**, with Zig's `libunwind` except on macOS.
- **"Backward compatible" became a gate result** (H6): surface snapshot, floor, previous-tag tests.
- **The git history was rewritten** to remove personal information (H19):
  [archive/history-purge-2026-10-22.md](archive/history-purge-2026-10-22.md).
