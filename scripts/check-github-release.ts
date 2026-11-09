// Self-test of scripts/github-release.ts against a mock GitHub REST API (Bun.serve): each case
// sets the mock's state, runs the script as a subprocess with GITHUB_API_URL pointing at the
// mock, and asserts the exit code, whether a POST was sent, and a fragment of the output.
// A check that has never been seen to fail is not a check: `make release-selftest` is inverted
// by mutants (cmem/compat-gate.md § The release page).
//
// Usage: bun run scripts/check-github-release.ts [path/to/github-release.ts]
import { join } from "node:path";
import { ROOT } from "./surface.ts";

const SCRIPT = process.argv[2] ?? join(ROOT, "scripts", "github-release.ts");
const REPO = "acme/widget";
const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);
const TAGOBJ = "c".repeat(40);

type Tag = { kind: "lightweight" | "annotated"; commit: string } | null;
interface State {
  tag: Tag;
  tagAfterPost?: Tag;     // the tag as the read-back after the POST sees it
  release: boolean;       // a release already exists for the tag
  postStatus: number;     // what POST /releases answers
  stall: boolean;         // never answer the ref request
}
let state: State;
let posts: unknown[] = [];

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const tag = posts.length && state.tagAfterPost !== undefined ? state.tagAfterPost : state.tag;
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
      return state.release || (posts.length && state.postStatus === 201)
        ? Response.json({ tag_name: "v1.2.3", html_url: "https://example/r", author: { login: "github-actions[bot]" } })
        : Response.json({ message: "Not Found" }, { status: 404 });
    }
    if (path === `/repos/${REPO}/releases` && req.method === "POST") {
      posts.push(await req.json());
      return Response.json({ id: 1 }, { status: state.postStatus });
    }
    return Response.json({ message: `mock: no route ${req.method} ${path}` }, { status: 500 });
  },
});

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail: string) {
  if (ok) pass++;
  else { fail++; console.log(`  FAIL: ${name} — ${detail}`); }
}

const base: State = { tag: { kind: "lightweight", commit: SHA }, release: false, postStatus: 201, stall: false };

async function run(
  name: string,
  s: Partial<State>,
  want: { code: number; posts: number; out: string },
  env: Record<string, string> = {},
  args: string[] = [],
) {
  state = { ...base, ...s };
  posts = [];
  const proc = Bun.spawn(["bun", SCRIPT, ...args], {
    env: {
      PATH: process.env.PATH ?? "",
      SystemRoot: process.env.SystemRoot ?? "",
      GITHUB_REPOSITORY: REPO, GITHUB_REF_NAME: "v1.2.3", GITHUB_SHA: SHA, GITHUB_TOKEN: "t0ken",
      GITHUB_API_URL: `http://127.0.0.1:${server.port}`, UWL_HTTP_TIMEOUT_MS: "1500",
      ...env,
    },
    stdout: "pipe", stderr: "pipe",
  });
  const out = (await new Response(proc.stdout).text()) + (await new Response(proc.stderr).text());
  const code = await proc.exited;
  check(name, code === want.code && posts.length === want.posts && out.includes(want.out),
    `exit ${code} (want ${want.code}), ${posts.length} POST (want ${want.posts}), output: ${out.trim().slice(0, 240)}`);
  return posts;
}

// 1. The tag must exist and peel to this run's commit — never a POST otherwise.
await run("missing tag: refused, no POST", { tag: null }, { code: 1, posts: 0, out: "does not exist on GitHub" });
await run("tag at another commit: refused, no POST", { tag: { kind: "lightweight", commit: OTHER } }, { code: 1, posts: 0, out: "refusing" });
await run("annotated tag at another commit: refused", { tag: { kind: "annotated", commit: OTHER } }, { code: 1, posts: 0, out: "refusing" });
// 2. An existing release: done, no write.
await run("release already there: exit 0, no POST", { release: true }, { code: 0, posts: 0, out: "already exists" });
// 3. Create, read back, re-check.
const made = await run("lightweight tag: created", {}, { code: 0, posts: 1, out: "created by github-actions[bot]" });
const b = made[0] as Record<string, unknown> | undefined;
check("POST body: tag, notes, the vcpkg note", !!b && b.tag_name === "v1.2.3" && b.generate_release_notes === true &&
  b.draft === false && String(b.body).includes("vcpkg registry") && String(b.body).includes(SHA), JSON.stringify(b));
await run("annotated tag (peeled): created", { tag: { kind: "annotated", commit: SHA } }, { code: 0, posts: 1, out: "created" });
await run("POST answers 422: exit 1", { postStatus: 422 }, { code: 1, posts: 1, out: "HTTP 422" });
await run("tag moved after the POST: exit 1", { tagAfterPost: { kind: "lightweight", commit: OTHER } }, { code: 1, posts: 1, out: "after the POST" });
// Dry run, missing token, bad input, time limit.
await run("--dry-run: every check, no POST", {}, { code: 0, posts: 0, out: "dry-run: would POST" }, {}, ["--dry-run"]);
await run("no token: refused before any POST", {}, { code: 1, posts: 0, out: "GITHUB_TOKEN is not set" }, { GITHUB_TOKEN: "" });
await run("not a vX.Y.Z tag: refused", {}, { code: 1, posts: 0, out: "is not a vX.Y.Z tag" }, { GITHUB_REF_NAME: "main" });
await run("a stalled API: the time limit fails it", { stall: true }, { code: 1, posts: 0, out: "no answer within 1500 ms" });

server.stop(true);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
