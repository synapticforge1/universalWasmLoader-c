/**
 * The review gate: the release tooling's FIRST step (workspace review standard § 9, letter H37 (d)).
 * A review is run by agents, not by a script; what a script can check is that one was completed on
 * the code being released. When the five required reviews end in an empty re-review and the full
 * suite passes, `cmem/review-process.md` § Last review records ONE line:
 *
 *   - Review complete: <commit>
 *
 * and this gate refuses a release unless that commit is an ancestor of the release candidate and
 * nothing outside `cmem/` changed since it. The candidate is HEAD, or HEAD's parent when HEAD is the
 * `bump to vX.Y.Z` commit. (This repo's release.ts runs the gate before it makes any commit, so the
 * candidate is HEAD; the bump case is kept for a gate run by hand after a bump.)
 *
 * Copied 2026-11-24 from rsxtk's `scripts/review-gate.ts`, unchanged in logic.
 *
 *   bun scripts/review-gate.ts   # prints what it found; exit 1 on a refusal
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

export const RECORD_FILE = "cmem/review-process.md";
const RECORD = /^\s*-\s*Review complete:\s*`?([0-9a-f]{7,40})`?\s*$/gm;

/** The commits recorded as reviewed; the gate wants exactly one. */
export function recordedCommits(text: string): string[] {
  return [...text.matchAll(RECORD)].map((m) => m[1]);
}

/** Paths that may change after a review without a new one: the project memory only. */
export function needsReview(changed: readonly string[]): string[] {
  return changed.filter((f) => !f.startsWith("cmem/"));
}

export interface GateInput {
  recorded: string[];
  /** Resolves the recorded commit; null when git does not know it. */
  resolved: string | null;
  isAncestor: boolean;
  changed: string[];
}

/** Why the release must stop, or [] when the review covers the candidate. */
export function refusals(g: GateInput): string[] {
  if (g.recorded.length === 0) {
    return [`no "Review complete: <commit>" in ${RECORD_FILE} — run "review" first (the five required reviews)`];
  }
  if (g.recorded.length > 1) return [`${g.recorded.length} "Review complete" lines in ${RECORD_FILE}; keep only the last review's`];
  if (g.resolved === null) return [`the reviewed commit ${g.recorded[0]} is not in this repository`];
  if (!g.isAncestor) return [`the reviewed commit ${g.recorded[0]} is not an ancestor of the release candidate`];
  const code = needsReview(g.changed);
  if (code.length > 0) {
    return [`changed since the review (${g.recorded[0]}), outside cmem/: ${code.join(", ")} — re-review the changes first`];
  }
  return [];
}

function git(root: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 60_000 });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim() };
}

/** Reads the record and the repository, and returns the refusals for this checkout. */
export function check(root: string): { reviewed: string | null; candidate: string; refusals: string[] } {
  let text = "";
  try {
    text = readFileSync(join(root, RECORD_FILE), "utf8");
  } catch {
    return { reviewed: null, candidate: "HEAD", refusals: [`${RECORD_FILE} is missing`] };
  }
  const recorded = recordedCommits(text);
  const subject = git(root, ["log", "-1", "--format=%s", "HEAD"]).out;
  const candidate = /^bump to v\d+\.\d+\.\d+$/.test(subject) ? "HEAD~1" : "HEAD";
  const r = recorded.length === 1 ? git(root, ["rev-parse", "--verify", "-q", `${recorded[0]}^{commit}`]) : null;
  const resolved = r?.ok ? r.out : null;
  const isAncestor = resolved !== null && git(root, ["merge-base", "--is-ancestor", resolved, candidate]).ok;
  const changed = resolved !== null && isAncestor
    ? git(root, ["diff", "--name-only", resolved, candidate]).out.split(/\r?\n/).filter(Boolean)
    : [];
  return { reviewed: resolved, candidate, refusals: refusals({ recorded, resolved, isAncestor, changed }) };
}

if (import.meta.main) {
  const result = check(join(import.meta.dir, ".."));
  if (result.refusals.length > 0) {
    for (const f of result.refusals) console.error(`review-gate: ${f}`);
    process.exit(1);
  }
  console.log(`review-gate: ${result.candidate} is covered by the review of ${result.reviewed}`);
}
