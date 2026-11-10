// Self-test of the CI release scripts — `ci-tag.ts` (U6: is this a release? make the tag) and
// `github-release.ts` (U7: the page) — against a mock GitHub REST API (Bun.serve). Each case sets
// the mock's state, runs a script as a subprocess with GITHUB_API_URL pointing at the mock, and
// asserts the exit code, the writes (POSTs) sent, and a fragment of the output.
// A check that has never been seen to fail is not a check: inverted by mutants
// (cmem/compat-gate.md § The release page).
//
// Usage: bun run scripts/check-github-release.ts [path/to/github-release.ts] [path/to/ci-tag.ts]
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./surface.ts";

const PAGE = process.argv[2] ?? join(ROOT, "scripts", "github-release.ts");
const TAGGER = process.argv[3] ?? join(ROOT, "scripts", "ci-tag.ts");
const REPO = "acme/widget";
const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);
const TAGOBJ = "c".repeat(40);
const NEWOBJ = "d".repeat(40);

// A scratch checkout holding only the port manifest ci-tag.ts reads (version 1.2.3).
const fakeRoot = mkdtempSync(join(tmpdir(), "uwl-ci-tag-"));
mkdirSync(join(fakeRoot, "ports", "universal-wasm-loader-c"), { recursive: true });
writeFileSync(join(fakeRoot, "ports", "universal-wasm-loader-c", "vcpkg.json"), JSON.stringify({ version: "1.2.3" }));

type Tag = { kind: "lightweight" | "annotated"; commit: string } | null;
interface State {
  tag: Tag;
  tagAfterPost?: Tag;     // what the tag looks like once anything was POSTed
  release: boolean;       // a release page already exists for the tag
  postStatus: number;     // what POST /releases answers
  refStatus: number;      // what POST /git/refs answers
  stall: boolean;         // never answer the ref request
}
let state: State;
let posts: { path: string; body: any }[] = [];

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const tag = posts.length && state.tagAfterPost !== undefined ? state.tagAfterPost : state.tag;
    if (req.method === "POST") {
      const body = await req.json();
      posts.push({ path, body });
      if (path === `/repos/${REPO}/releases`) return Response.json({ id: 1 }, { status: state.postStatus });
      if (path === `/repos/${REPO}/git/tags`) return Response.json({ sha: NEWOBJ }, { status: 201 });
      if (path === `/repos/${REPO}/git/refs`) {
        if (state.refStatus === 201 && state.tagAfterPost === undefined) state.tag = { kind: "annotated", commit: SHA };
        return Response.json({ ref: body.ref }, { status: state.refStatus });
      }
    }
    if (path === `/repos/${REPO}/git/ref/tags/v1.2.3`) {
      if (state.stall) await new Promise((r) => setTimeout(r, 5000));
      if (!tag) return Response.json({ message: "Not Found" }, { status: 404 });
      const object = tag.kind === "annotated" ? { type: "tag", sha: TAGOBJ } : { type: "commit", sha: tag.commit };
      return Response.json({ ref: "refs/tags/v1.2.3", object });
    }
    if (path === `/repos/${REPO}/git/tags/${TAGOBJ}` && tag) {
      return Response.json({ object: { type: "commit", sha: tag.commit } });
    }
    if (path === `/repos/${REPO}/releases/tags/v1.2.3`) {
      const made = posts.some((p) => p.path.endsWith("/releases")) && state.postStatus === 201;
      return state.release || made
        ? Response.json({ tag_name: "v1.2.3", html_url: "https://example/r", author: { login: "github-actions[bot]" } })
        : Response.json({ message: "Not Found" }, { status: 404 });
    }
    return Response.json({ message: `mock: no route ${req.method} ${path}` }, { status: 500 });
  },
});

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail: string) {
  if (ok) pass++;
  else { fail++; console.log(`  FAIL: ${name} — ${detail}`); }
}

const base: State = { tag: { kind: "lightweight", commit: SHA }, release: false, postStatus: 201, refStatus: 201, stall: false };

async function run(
  script: string,
  name: string,
  s: Partial<State>,
  want: { code: number; posts: number; out: string },
  env: Record<string, string> = {},
  args: string[] = [],
) {
  state = { ...base, ...s };
  posts = [];
  const outFile = join(fakeRoot, "github_output");
  writeFileSync(outFile, "");
  const proc = Bun.spawn(["bun", script, ...args], {
    env: {
      PATH: process.env.PATH ?? "",
      SystemRoot: process.env.SystemRoot ?? "",
      GITHUB_REPOSITORY: REPO, GITHUB_REF_NAME: "v1.2.3", GITHUB_SHA: SHA, GITHUB_TOKEN: "t0ken",
      GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "push", GITHUB_OUTPUT: outFile,
      GITHUB_API_URL: `http://127.0.0.1:${server.port}`, UWL_HTTP_TIMEOUT_MS: "1500", UWL_REPO_ROOT: fakeRoot,
      ...env,
    },
    stdout: "pipe", stderr: "pipe",
  });
  const out = (await new Response(proc.stdout).text()) + (await new Response(proc.stderr).text());
  const code = await proc.exited;
  check(name, code === want.code && posts.length === want.posts && out.includes(want.out),
    `exit ${code} (want ${want.code}), ${posts.length} POST (want ${want.posts}), output: ${out.trim().slice(0, 240)}`);
  return { posts: [...posts], ghOut: readFileSync(outFile, "utf8") };
}

// ── github-release.ts (U7, H32's order) ──────────────────────────────────────
// 1. The tag must exist and peel to this run's commit — never a POST otherwise.
await run(PAGE, "page: missing tag refused, no POST", { tag: null }, { code: 1, posts: 0, out: "does not exist on GitHub" });
await run(PAGE, "page: tag at another commit refused, no POST", { tag: { kind: "lightweight", commit: OTHER } }, { code: 1, posts: 0, out: "refusing" });
await run(PAGE, "page: annotated tag at another commit refused", { tag: { kind: "annotated", commit: OTHER } }, { code: 1, posts: 0, out: "refusing" });
// 2. An existing release: done, no write.
await run(PAGE, "page: already there → exit 0, no POST", { release: true }, { code: 0, posts: 0, out: "already exists" });
// 3. Create, read back, re-check.
const made = await run(PAGE, "page: lightweight tag → created", {}, { code: 0, posts: 1, out: "created by github-actions[bot]" });
const b = made.posts[0]?.body;
check("page: POST body has the tag, notes, the vcpkg note", !!b && b.tag_name === "v1.2.3" && b.generate_release_notes === true &&
  b.draft === false && String(b.body).includes("vcpkg registry") && String(b.body).includes(SHA), JSON.stringify(b));
await run(PAGE, "page: annotated tag (peeled) → created", { tag: { kind: "annotated", commit: SHA } }, { code: 0, posts: 1, out: "created" });
await run(PAGE, "page: RELEASE_TAG wins over GITHUB_REF_NAME (CI runs on main)", {}, { code: 0, posts: 1, out: "created" },
  { GITHUB_REF_NAME: "main", RELEASE_TAG: "v1.2.3" });
await run(PAGE, "page: POST answers 422 → exit 1", { postStatus: 422 }, { code: 1, posts: 1, out: "HTTP 422" });
await run(PAGE, "page: tag moved after the POST → exit 1", { tagAfterPost: { kind: "lightweight", commit: OTHER } }, { code: 1, posts: 1, out: "after the POST" });
await run(PAGE, "page: --dry-run, no POST", {}, { code: 0, posts: 0, out: "dry-run: would POST" }, {}, ["--dry-run"]);
await run(PAGE, "page: no token → refused before any POST", {}, { code: 1, posts: 0, out: "GITHUB_TOKEN is not set" }, { GITHUB_TOKEN: "" });
await run(PAGE, "page: not a vX.Y.Z tag → refused", {}, { code: 1, posts: 0, out: "is not a vX.Y.Z tag" }, { GITHUB_REF_NAME: "main" });
await run(PAGE, "page: a stalled API → the time limit fails it", { stall: true }, { code: 1, posts: 0, out: "no answer within 1500 ms" });

// ── ci-tag.ts state (U5's "is this a release?") ──────────────────────────────
let r = await run(TAGGER, "state: push on main, no tag → release", { tag: null }, { code: 0, posts: 0, out: "a new release" }, {}, ["state"]);
check("state: writes release=true, tag, version to GITHUB_OUTPUT", r.ghOut.includes("release=true") && r.ghOut.includes("tag=v1.2.3") &&
  r.ghOut.includes("version=1.2.3"), JSON.stringify(r.ghOut));
await run(TAGGER, "state: tag already on this commit → release (a re-run)", {}, { code: 0, posts: 0, out: "a re-run" }, {}, ["state"]);
r = await run(TAGGER, "state: tag on another commit → not a release", { tag: { kind: "annotated", commit: OTHER } }, { code: 0, posts: 0, out: "an ordinary push" }, {}, ["state"]);
check("state: writes release=false", r.ghOut.includes("release=false"), JSON.stringify(r.ghOut));
r = await run(TAGGER, "state: a pull request never releases", { tag: null }, { code: 0, posts: 0, out: "only a push or a manual run on main" },
  { GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/7/merge" }, ["state"]);
check("state: pull request writes release=false", r.ghOut.includes("release=false"), JSON.stringify(r.ghOut));
await run(TAGGER, "state: another branch never releases", { tag: null }, { code: 0, posts: 0, out: "only a push or a manual run on main" },
  { GITHUB_REF: "refs/heads/topic" }, ["state"]);

// ── ci-tag.ts create (U6) ────────────────────────────────────────────────────
r = await run(TAGGER, "create: no tag → annotated tag + ref, read back", { tag: null }, { code: 0, posts: 2, out: "created on" }, {}, ["create"]);
const [tObj, tRef] = r.posts;
check("create: tag object on GITHUB_SHA, ref refs/tags/v1.2.3 → that object",
  tObj?.path.endsWith("/git/tags") && tObj.body.object === SHA && tObj.body.type === "commit" && tObj.body.tag === "v1.2.3" &&
  tRef?.path.endsWith("/git/refs") && tRef.body.ref === "refs/tags/v1.2.3" && tRef.body.sha === NEWOBJ, JSON.stringify(r.posts));
await run(TAGGER, "create: already on this commit → exit 0, no POST", {}, { code: 0, posts: 0, out: "nothing to do" }, {}, ["create"]);
await run(TAGGER, "create: tag on another commit → refused, no POST", { tag: { kind: "lightweight", commit: OTHER } }, { code: 1, posts: 0, out: "never moves" }, {}, ["create"]);
await run(TAGGER, "create: no token → refused, no POST", { tag: null }, { code: 1, posts: 0, out: "GITHUB_TOKEN is not set" }, { GITHUB_TOKEN: "" }, ["create"]);
await run(TAGGER, "create: --dry-run → no POST", { tag: null }, { code: 0, posts: 0, out: "dry-run: would POST" }, {}, ["create", "--dry-run"]);
await run(TAGGER, "create: POST ref answers 422 → exit 1", { tag: null, refStatus: 422 }, { code: 1, posts: 2, out: "HTTP 422" }, {}, ["create"]);
await run(TAGGER, "create: read-back peels elsewhere → exit 1", { tag: null, tagAfterPost: { kind: "lightweight", commit: OTHER } }, { code: 1, posts: 2, out: "read-back" }, {}, ["create"]);
await run(TAGGER, "create: RELEASE_TAG not the manifest's → refused", { tag: null }, { code: 1, posts: 0, out: "is not the manifest's" }, { RELEASE_TAG: "v9.9.9" }, ["create"]);

server.stop(true);
rmSync(fakeRoot, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
