/**
 * Create the GitHub Release page for a tag through GitHub's REST API (workspace letters H30 and
 * H32; owner 2026-11-09: "From this point forward it is the release page"). Run by the `release`
 * job of `.github/workflows/vcpkg-release.yml`, after CI made the tag (`ci-tag.ts`) and before the
 * registry read-back (owner's order, 2026-11-10: checks → tag → page → publish; H33 U7):
 *
 *   bun scripts/github-release.ts            # create the page (or find it already there)
 *   bun scripts/github-release.ts --dry-run  # every check, no POST
 *
 * Environment (GitHub Actions sets all but the token and the tag, which the job passes in):
 *   GITHUB_REPOSITORY  owner/repo
 *   RELEASE_TAG        the tag, e.g. v2.1.2 (CI runs on `main`, so GITHUB_REF_NAME is the
 *                      branch; it is used only when RELEASE_TAG is unset)
 *   GITHUB_SHA         the commit the run is for
 *   GITHUB_TOKEN       contents: write (needed only for the POST; reads work without it)
 *   GITHUB_API_URL, UWL_HTTP_TIMEOUT_MS — see github-api.ts
 *
 * The order (H32; keep it), each step refusing with exit 1 on anything unexpected:
 *   1. The tag exists on GitHub and peels (annotated tags followed) to GITHUB_SHA.
 *      `POST /releases` would CREATE a missing tag from the default branch.
 *   2. A release for the tag already exists → done, exit 0, no write (a re-run is safe).
 *   3. POST {tag_name, name, body: the vcpkg note, generate_release_notes}, then read the
 *      release back and check the tag again.
 */
import process from "node:process";
import { api, fail as failWith } from "./github-api.ts";

const WHO = "github-release";
const fail = (msg: string): never => failWith(WHO, msg);

const args = process.argv.slice(2);
for (const arg of args) {
  if (arg !== "--dry-run") fail(`unknown argument "${arg}" — use --dry-run or nothing`);
}
const dryRun = args.includes("--dry-run");

const tag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || "";
const sha = process.env.GITHUB_SHA ?? "";
if (!/^v\d+\.\d+\.\d+$/.test(tag)) fail(`the tag "${tag}" (RELEASE_TAG, else GITHUB_REF_NAME) is not a vX.Y.Z tag`);
if (!/^[0-9a-f]{40}$/.test(sha)) fail(`GITHUB_SHA "${sha}" is not a full commit id`);
const github = api(WHO);
const repo = github.repo;

// 1. The tag exists and peels to the commit this run is for.
const peeled = await github.peel(tag);
if (peeled === null) fail(`tag ${tag} does not exist on GitHub; refusing (a release would create it)`);
if (peeled !== sha) fail(`tag ${tag} is ${peeled}, this run is for ${sha}; refusing`);
console.log(`tag ${tag} = ${sha}`);

// 2. Already released?
const existing = await github.call("GET", `/repos/${repo}/releases/tags/${tag}`);
if (existing.status === 200) {
  console.log(`GitHub Release ${tag} already exists: ${existing.json?.html_url}`);
  process.exit(0);
}
if (existing.status !== 404) fail(`GET release ${tag}: HTTP ${existing.status} ${JSON.stringify(existing.json)}`);

// 3. Create it, then read it back and check the tag again.
const version = tag.slice(1);
const note = [
  `**universal-wasm-loader-c ${version}** — install from this repo's vcpkg registry ` +
  `(\`ports/\`, \`versions/\`; a \`vcpkg-configuration.json\` baseline at or after this tag's commit), ` +
  `or take \`universal_wasm_loader.h\` from this tag. See \`docs/vcpkg.md\` and the README's ` +
  `"Breaking Changes" table.`,
  "",
  `Commit: ${sha}`,
].join("\n");
const body = { tag_name: tag, name: tag, body: note, generate_release_notes: true, draft: false, prerelease: false };
if (dryRun) {
  console.log(`dry-run: would POST /repos/${repo}/releases ${JSON.stringify(body)}`);
  process.exit(0);
}
if (!github.token) fail("GITHUB_TOKEN is not set; cannot create the release");
const created = await github.call("POST", `/repos/${repo}/releases`, body);
if (created.status !== 201) fail(`POST release ${tag}: HTTP ${created.status} ${JSON.stringify(created.json)}`);
const back = await github.call("GET", `/repos/${repo}/releases/tags/${tag}`);
if (back.status !== 200 || back.json?.tag_name !== tag) fail(`read-back of release ${tag}: HTTP ${back.status}`);
const after = await github.peel(tag);
if (after !== sha) fail(`after the POST, tag ${tag} is ${after}, not ${sha}`);
console.log(`GitHub Release ${tag} created by ${back.json?.author?.login ?? "?"}: ${back.json?.html_url}`);
