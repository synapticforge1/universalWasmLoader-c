/**
 * CI's tag (workspace letter H33, U6; owner 2026-11-10: "the CI to check first, then push the tag,
 * and then create the release page from the tag, then publish"). Nobody tags by hand any more:
 * `scripts/release.ts` pushes `main` only, and the workflow tags the commit once its checks pass.
 * For this git-tag registry the tag IS the publish (the port downloads the header from it).
 *
 *   bun scripts/ci-tag.ts state              # read-only: is this run a release? (validate job)
 *   bun scripts/ci-tag.ts create [--dry-run] # make the annotated tag vX.Y.Z on GITHUB_SHA (tag job)
 *
 * The version is the port manifest's (`ports/universal-wasm-loader-c/vcpkg.json`) at this checkout.
 *
 * `state` writes `release=true|false`, `tag=vX.Y.Z`, `version=X.Y.Z` to $GITHUB_OUTPUT (and prints
 * them). A release is a push (or a manual run) on refs/heads/main whose version has
 *   - no tag yet → a new release, or
 *   - its tag already on THIS commit → a re-run of a release (every later job skips what is done).
 * A tag on another commit means that version is already out: an ordinary push, not a release.
 *
 * `create`: the tag already on GITHUB_SHA → done, exit 0 (re-run safe); on another commit → refuse;
 * absent → POST /git/tags (annotated) + POST /git/refs, then read it back (it must peel to
 * GITHUB_SHA). A tag is never moved or forced (U4, U12).
 *
 * Environment: GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_REF, GITHUB_EVENT_NAME, GITHUB_RUN_ID,
 * GITHUB_OUTPUT (optional), GITHUB_TOKEN (contents: write for `create`), RELEASE_TAG (optional:
 * must equal the manifest's), plus GITHUB_API_URL / UWL_HTTP_TIMEOUT_MS (github-api.ts).
 */
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { api, fail as failWith } from "./github-api.ts";

const WHO = "ci-tag";
const fail = (msg: string): never => failWith(WHO, msg);

const [mode, ...rest] = process.argv.slice(2);
if (mode !== "state" && mode !== "create") fail(`usage: ci-tag.ts state | create [--dry-run] (got "${mode ?? ""}")`);
for (const a of rest) if (a !== "--dry-run" || mode !== "create") fail(`unknown argument "${a}"`);
const dryRun = rest.includes("--dry-run");

const root = process.env.UWL_REPO_ROOT || join(import.meta.dir, "..");
let version = "";
try {
  version = JSON.parse(readFileSync(join(root, "ports", "universal-wasm-loader-c", "vcpkg.json"), "utf8")).version;
} catch (e) {
  fail(`cannot read the port manifest's version: ${(e as Error).message}`);
}
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`the port manifest's version "${version}" is not X.Y.Z`);
const tag = `v${version}`;
if (process.env.RELEASE_TAG && process.env.RELEASE_TAG !== tag) {
  fail(`RELEASE_TAG ${process.env.RELEASE_TAG} is not the manifest's ${tag}`);
}
const sha = process.env.GITHUB_SHA ?? "";
if (!/^[0-9a-f]{40}$/.test(sha)) fail(`GITHUB_SHA "${sha}" is not a full commit id`);
const github = api(WHO);

function output(release: boolean, why: string) {
  const lines = [`release=${release}`, `tag=${tag}`, `version=${version}`];
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
  console.log(`${lines.join(" ")} — ${why}`);
}

if (mode === "state") {
  const ref = process.env.GITHUB_REF ?? "";
  const event = process.env.GITHUB_EVENT_NAME ?? "";
  if (ref !== "refs/heads/main" || (event !== "push" && event !== "workflow_dispatch")) {
    output(false, `${event || "?"} on ${ref || "?"}: only a push or a manual run on main releases`);
    process.exit(0);
  }
  const at = await github.peel(tag);
  if (at === null) output(true, `${tag} does not exist yet: a new release`);
  else if (at === sha) output(true, `${tag} is already on this commit: a re-run of the release`);
  else output(false, `${tag} is already released at ${at}: an ordinary push`);
  process.exit(0);
}

// create
const at = await github.peel(tag);
if (at === sha) {
  console.log(`tag ${tag} is already on ${sha}; nothing to do`);
  process.exit(0);
}
if (at !== null) fail(`tag ${tag} already exists at ${at}, not ${sha}; a tag never moves — refusing`);
const tagBody = {
  tag,
  message: `universalWasmLoader-c ${version}\n\nTagged by CI after its checks passed on ${sha}` +
    (process.env.GITHUB_RUN_ID ? ` (run ${process.env.GITHUB_RUN_ID})` : "") + ".\n",
  object: sha,
  type: "commit",
};
if (dryRun) {
  console.log(`dry-run: would POST /repos/${github.repo}/git/tags ${JSON.stringify(tagBody)} and the ref refs/tags/${tag}`);
  process.exit(0);
}
if (!github.token) fail("GITHUB_TOKEN is not set; cannot create the tag");
const obj = await github.call("POST", `/repos/${github.repo}/git/tags`, tagBody);
if (obj.status !== 201 || !/^[0-9a-f]{40}$/.test(obj.json?.sha ?? "")) {
  fail(`POST tag object ${tag}: HTTP ${obj.status} ${JSON.stringify(obj.json)}`);
}
const ref = await github.call("POST", `/repos/${github.repo}/git/refs`, { ref: `refs/tags/${tag}`, sha: obj.json.sha });
if (ref.status !== 201) fail(`POST ref refs/tags/${tag}: HTTP ${ref.status} ${JSON.stringify(ref.json)}`);
const back = await github.peel(tag);
if (back !== sha) fail(`read-back: tag ${tag} peels to ${back}, not ${sha}`);
console.log(`tag ${tag} created on ${sha} (annotated, object ${obj.json.sha})`);
