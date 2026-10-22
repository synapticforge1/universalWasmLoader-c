// Bump the loader's release version, gated (workspace compatibility gate,
// Rule 2): refuses a bump below the floor the surface diff computes, and for a
// patch or minor also requires the previous tag's tests to pass (Rule 3).
//
// Usage: bun run scripts/bump.ts patch|minor|major      (or: make bump KIND=minor)
//
// Edits, on a clean tree whose version line equals the last release tag:
//   ports/universal-wasm-loader-c/vcpkg.json   "version" -> next, "port-version" dropped
//   ports/universal-wasm-loader-c/portfile.cmake  UWL_VERSION, UWL_HEADER_SHA512,
//                                              UWL_LICENSE_SHA512 (from the COMMITTED blobs,
//                                              which is what raw.githubusercontent serves)
// It does not commit, update versions/, tag or push; it prints those steps.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEVELS,
  type Level,
  PORT_MANIFEST,
  bumpVersion,
  describeTests,
  floorOf,
  git,
  manifestVersion,
  previousTests,
  releaseTags,
  surfaceAt,
} from "./compat.ts";
import { HEADER, ROOT, diffSurface, readSnapshot, surfaceOf } from "./surface.ts";

const PORTFILE = join(ROOT, "ports/universal-wasm-loader-c/portfile.cmake");

function refuse(msg: string): never {
  console.error(`REFUSED: ${msg}`);
  process.exit(1);
}

function writeAtomic(path: string, text: string) {
  writeFileSync(`${path}.tmp`, text);
  renameSync(`${path}.tmp`, path);
}

// Replace the one match of `re` (which must match exactly once) with `value`.
function setOnce(text: string, re: RegExp, value: string, what: string): string {
  const hits = [...text.matchAll(new RegExp(re.source, "g"))].length;
  if (hits !== 1) refuse(`expected exactly one ${what} in portfile.cmake, found ${hits}`);
  return text.replace(re, (_m, pre: string, _old: string, post: string) => `${pre}${value}${post}`);
}

function blobSha512(path: string): string {
  const p = Bun.spawnSync(["git", "cat-file", "blob", `HEAD:${path}`], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) refuse(`git cat-file HEAD:${path} failed: ${p.stderr.toString().trim()}`);
  return new Bun.CryptoHasher("sha512").update(p.stdout).digest("hex");
}

const kind = Bun.argv[2] as Level;
if (!LEVELS.includes(kind)) refuse("usage: bun run scripts/bump.ts patch|minor|major");

if (git(["status", "--porcelain"]).trim() !== "") refuse("the working tree is not clean; commit first (the sha512 pins come from HEAD)");

const snapshot = readSnapshot();
const stale = diffSurface(snapshot, surfaceOf(readFileSync(join(ROOT, HEADER), "utf8")));
if (stale.length > 0) refuse("api-surface.json is stale; re-baseline in its own commit (make surface) first");

const current = manifestVersion();
const lastTag = releaseTags()[0];
if (!lastTag) refuse("no release tag reachable from HEAD");
if (`v${current}` !== lastTag) {
  refuse(`the version line (${current}) is not the last release tag (${lastTag}); a bump starts from a released version`);
}

const { floor, reasons } = floorOf(surfaceAt(lastTag), snapshot);
console.log(`floor vs ${lastTag}: ${floor}`);
for (const r of reasons) console.log(`  ${r}`);
if (LEVELS.indexOf(kind) < LEVELS.indexOf(floor)) refuse(`${kind} is below the floor (${floor})`);

if (kind !== "major") {
  const r = previousTests(lastTag);
  console.log(describeTests(lastTag, r));
  if (!r.ok) {
    console.error(r.output);
    refuse(`a ${kind} bump requires the previous tag's tests to pass`);
  }
}

const next = bumpVersion(current, kind);

const manifestText = readFileSync(PORT_MANIFEST, "utf8").replace(/\r\n/g, "\n");
const manifest = JSON.parse(manifestText);
if (`${JSON.stringify(manifest, null, 2)}\n` !== manifestText) {
  refuse("vcpkg.json is not in JSON.stringify(…, 2) form; rewriting it would reformat it");
}
manifest.version = next;
delete manifest["port-version"];

let portfile = readFileSync(PORTFILE, "utf8");
portfile = setOnce(portfile, /(set\(UWL_VERSION ")([^"]*)("\))/, next, "set(UWL_VERSION …)");
portfile = setOnce(portfile, /(set\(UWL_HEADER_SHA512 ")([^"]*)("\))/, blobSha512(HEADER), "set(UWL_HEADER_SHA512 …)");
portfile = setOnce(portfile, /(set\(UWL_LICENSE_SHA512 ")([^"]*)("\))/, blobSha512("LICENSE"), "set(UWL_LICENSE_SHA512 …)");

writeAtomic(PORT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
writeAtomic(PORTFILE, portfile);

console.log(`\nbumped ${current} -> ${next} (${kind}); edited vcpkg.json and portfile.cmake. Next (docs/vcpkg.md § 4):`);
console.log("  1. review the diff; add a README Breaking Changes row if this is a major");
console.log(`  2. git commit the port (message via a file: git commit -F <file>)`);
console.log(`  3. set versions/u-/universal-wasm-loader-c.json: new first entry { "version": "${next}", "port-version": 0,`);
console.log(`     "git-tree": $(git rev-parse HEAD:ports/universal-wasm-loader-c) }, and versions/baseline.json; commit`);
console.log(`  4. only on the owner's word: git tag v${next}; push main and the tag (CI re-runs compat --release)`);
