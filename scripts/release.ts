// The release script (workspace letter H33, U2 + U4; owner 2026-11-10: "the CI to check first,
// then push the tag, and then create the release page from the tag, then publish"). One command,
// run on the owner's "release" with an explicit level — there is no default (U1):
//
//   bun run scripts/release.ts patch|minor|major [--dry-run]     (or: make release KIND=minor)
//
// Guards, each refusing with exit 1:
//   - on `main`, the tree clean (untracked files count), `main` equal to GitHub's (`ls-remote`);
//   - the next tag absent here AND on GitHub, and the registry (`versions/`) without the version;
//   - the cold gate: surface check, both self-tests, `make clean test`;
//   - `make bump` itself: the floor from the surface diff, the previous release's tests (U3).
// --dry-run stops after the guards and prints the floor and the plan; nothing is edited.
//
// Then: the bump is its own commit, made here (`bump to vX.Y.Z`, U2); the registry entry
// (`versions/`: the new port git-tree first, the baseline) is a second commit; both are checked
// again (git-tree = HEAD's port tree, sha512 pins = HEAD's blobs) and `main` is pushed — as a
// user, ONE push, read back with `ls-remote`. **No tag is made or pushed, ever** (U4): CI checks
// that commit, then tags it, makes the Release page and installs it from the registry
// (.github/workflows/vcpkg-release.yml; cmem/compat-gate.md § The release page).
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LEVELS, type Level, bumpVersion, manifestVersion } from "./compat.ts";
import { ROOT } from "./surface.ts";

const VERSIONS = join(ROOT, "versions/u-/universal-wasm-loader-c.json");
const BASELINE = join(ROOT, "versions/baseline.json");
const PORT_DIR = "ports/universal-wasm-loader-c";

function refuse(msg: string): never {
  console.error(`REFUSED: ${msg}`);
  process.exit(1);
}

function run(cmd: string[], what: string): string {
  console.log(`$ ${cmd.join(" ")}`);
  const p = Bun.spawnSync(cmd, { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const out = p.stdout.toString() + p.stderr.toString();
  if (p.exitCode !== 0) {
    console.error(out);
    refuse(`${what} failed (exit ${p.exitCode})`);
  }
  return out;
}

const git = (args: string[], what = `git ${args[0]}`) => run(["git", ...args], what).trim();

const args = Bun.argv.slice(2);
const level = args[0] as Level;
const dryRun = args.includes("--dry-run");
for (const a of args.slice(1)) if (a !== "--dry-run") refuse(`unknown argument "${a}"`);
if (!LEVELS.includes(level)) refuse("usage: bun run scripts/release.ts patch|minor|major [--dry-run] — the level is the owner's; there is no default");

// ── guards ────────────────────────────────────────────────────────────────────
if (git(["rev-parse", "--abbrev-ref", "HEAD"]) !== "main") refuse("not on main; \"push\" (merge into main) comes first");
const dirty = git(["status", "--porcelain", "--untracked-files=all"]);
if (dirty !== "") refuse(`the working tree is not clean (untracked files count):\n${dirty}`);
const head = git(["rev-parse", "HEAD"]);
const remoteMain = git(["ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0] ?? "";
if (remoteMain !== head) refuse(`main (${head}) is not GitHub's main (${remoteMain || "absent"}); "push" first`);

const current = manifestVersion();
const next = bumpVersion(current, level);
const tag = `v${next}`;
if (Bun.spawnSync(["git", "rev-parse", "-q", "--verify", `refs/tags/${tag}`], { cwd: ROOT }).exitCode === 0) {
  refuse(`${tag} already exists locally`);
}
if (git(["ls-remote", "--tags", "origin", `refs/tags/${tag}`]) !== "") refuse(`${tag} already exists on GitHub`);
const versions = JSON.parse(readFileSync(VERSIONS, "utf8"));
if (versions.versions.some((v: { version: string }) => v.version === next)) refuse(`versions/ already lists ${next}`);

console.log(`\nrelease ${current} -> ${next} (${level}); the cold gate:`);
run(["make", "-s", "surface-check"], "make surface-check");
run(["make", "-s", "compat-selftest"], "make compat-selftest");
run(["make", "-s", "release-selftest"], "make release-selftest");
const tests = run(["make", "-s", "clean", "test"], "make clean test");
const counts = [...tests.matchAll(/(\d+) passed, (\d+) failed/g)].at(-1);
if (!counts || counts[2] !== "0" || counts[1] === "0") refuse(`make clean test: ${counts?.[0] ?? "no result line"}`);
console.log(`  tests: ${counts[0]}`);

if (dryRun) {
  console.log(run(["bun", "run", "scripts/compat.ts", "--no-tests"], "compat (floor report)").trim());
  console.log(`\ndry-run: every guard passed. A real run would: make bump KIND=${level} (floor + previous-tag tests),`);
  console.log(`commit "bump to ${tag}", write and commit the registry entry, push main, and read it back.`);
  console.log(`CI then checks that commit, tags ${tag}, makes the page and installs ${next} from the registry.`);
  process.exit(0);
}

// ── the bump: its own commit (U2, U3) ─────────────────────────────────────────
console.log(run(["bun", "run", "scripts/bump.ts", level], "make bump").trim()); // the floor and the previous-tag tests
const msgFile = join(tmpdir(), `uwl-release-${process.pid}.txt`);
function commit(paths: string[], message: string) {
  writeFileSync(msgFile, message);
  try {
    git(["add", "--", ...paths]);
    git(["commit", "-q", "-F", msgFile], "git commit");
  } finally {
    rmSync(msgFile, { force: true });
  }
}
commit([PORT_DIR], `bump to ${tag}\n\nmake bump KIND=${level}: ${current} -> ${next}; the floor and the previous release's\ntests checked by the bump tool (scripts/release.ts).\n`);
const bumpCommit = git(["rev-parse", "HEAD"]);
const tree = git(["rev-parse", `HEAD:${PORT_DIR}`]);

// ── the registry entry: a second commit ───────────────────────────────────────
versions.versions.unshift({ version: next, "port-version": 0, "git-tree": tree });
writeFileSync(VERSIONS, `${JSON.stringify(versions, null, 2)}\n`);
const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
baseline.default["universal-wasm-loader-c"] = { baseline: next, "port-version": 0 };
writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);
commit(["versions"], `registry: ${next} git-tree and baseline\n\nversions/u-/universal-wasm-loader-c.json: new first entry ${next}, port-version 0,\ngit-tree ${tree} (git rev-parse ${bumpCommit.slice(0, 7)}:${PORT_DIR}).\nversions/baseline.json: baseline ${next}, port-version 0.\n\nConsumers' vcpkg-configuration.json baseline: this commit or later.\n`);

// ── re-check what CI will check, then ONE push of main (no tag) ───────────────
if (git(["rev-parse", `HEAD:${PORT_DIR}`]) !== tree) refuse("the port tree changed after the bump commit");
const portfile = readFileSync(join(ROOT, PORT_DIR, "portfile.cmake"), "utf8");
for (const [name, path] of [["UWL_HEADER_SHA512", "universal_wasm_loader.h"], ["UWL_LICENSE_SHA512", "LICENSE"]]) {
  const pin = portfile.match(new RegExp(`set\\(${name} "([0-9a-f]{128})"\\)`))?.[1];
  const blob = Bun.spawnSync(["git", "cat-file", "blob", `HEAD:${path}`], { cwd: ROOT, stdout: "pipe" }).stdout;
  const sha = new Bun.CryptoHasher("sha512").update(blob).digest("hex");
  if (pin !== sha) refuse(`${name} is not the sha512 of HEAD:${path}`);
}
run(["bun", "run", "scripts/compat.ts", "--release", "--no-tests"], "compat --release (floor)");

const pushed = git(["rev-parse", "HEAD"]);
git(["push", "origin", "main"], "git push origin main");
const back = git(["ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0];
if (back !== pushed) refuse(`read-back: GitHub's main is ${back}, not ${pushed}`);
console.log(`\npushed main = ${pushed} (read back). No tag was made: CI checks this commit, then tags ${tag},`);
console.log(`makes the Release page from the tag, and installs ${next} from the registry as a user.`);
