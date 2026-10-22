// The compatibility gate (workspace layout-and-packaging.md § "The compatibility
// gate", Rules 2 and 3): the FLOOR a release must meet, and the previous tag's
// tests run against the current header.
//
// Usage: bun run scripts/compat.ts             report: last tag, floor, previous-tag tests
//        bun run scripts/compat.ts --release   on a tagged release commit: the version must
//                                              meet the floor vs the tag before it, and the
//                                              previous tests must pass for a patch/minor
//        add --no-tests to skip the previous-tag build (floor only)
//
// Previous-tag tests: `git archive <tag> tests` is extracted into .compat/ (gitignored,
// deleted after) beside a copy of the CURRENT header, then built and run with the
// Makefile (`make -f ../Makefile ... clean test`). The verdict is read from the
// suite's OUTPUT ("N passed, M failed"), not only the exit code.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { HEADER, ROOT, type Surface, diffSurface, readSnapshot, surfaceOf } from "./surface.ts";

export type Level = "patch" | "minor" | "major";
export const LEVELS: Level[] = ["patch", "minor", "major"];
const rank = (l: Level) => LEVELS.indexOf(l);
const maxLevel = (a: Level, b: Level): Level => (rank(a) >= rank(b) ? a : b);

export const PORT_MANIFEST = join(ROOT, "ports/universal-wasm-loader-c/vcpkg.json");

export function parseVersion(v: string): [number, number, number] {
  const m = v.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`not a MAJOR.MINOR.PATCH version: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareVersions(a: string, b: string): number {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// The level of the step from `from` to `to` (to must be greater).
export function levelOf(from: string, to: string): Level {
  const [a, b] = [parseVersion(from), parseVersion(to)];
  if (compareVersions(from, to) >= 0) throw new Error(`${to} is not above ${from}`);
  if (b[0] !== a[0]) return "major";
  if (b[1] !== a[1]) return "minor";
  return "patch";
}

export function bumpVersion(v: string, kind: Level): string {
  const [x, y, z] = parseVersion(v);
  if (kind === "major") return `${x + 1}.0.0`;
  if (kind === "minor") return `${x}.${y + 1}.0`;
  return `${x}.${y}.${z + 1}`;
}

// Rule 2: removed or changed -> major; added -> minor; nothing -> patch.
// The SPEC version moves the floor by its own level; lowering it is major.
// A changed signature is major even when it only widens: the gate cannot
// tell widening from narrowing, so it errs high.
export function floorOf(prev: Surface, next: Surface): { floor: Level; reasons: string[] } {
  let floor: Level = "patch";
  const reasons: string[] = [];
  for (const line of diffSurface(prev, next)) {
    if (line.startsWith("spec: ")) continue;
    const l: Level = line.startsWith("added: ") ? "minor" : "major";
    floor = maxLevel(floor, l);
    reasons.push(`${l}: ${line}`);
  }
  if (prev.spec !== next.spec) {
    const l: Level = compareVersions(next.spec, prev.spec) < 0 ? "major" : levelOf(prev.spec, next.spec);
    floor = maxLevel(floor, l);
    reasons.push(`${l}: SPEC ${prev.spec} -> ${next.spec}${l === "major" && compareVersions(next.spec, prev.spec) < 0 ? " (lowered)" : ""}`);
  }
  return { floor, reasons };
}

export function git(args: string[], cwd = ROOT): string {
  const p = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${p.stderr.toString().trim()}`);
  return p.stdout.toString();
}

// Release tags reachable from HEAD, highest first.
export function releaseTags(): string[] {
  return git(["tag", "--merged", "HEAD", "--list", "v*"])
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
    .sort((a, b) => compareVersions(b, a));
}

export function surfaceAt(ref: string): Surface {
  return surfaceOf(git(["show", `${ref}:${HEADER}`]));
}

export function manifestVersion(): string {
  return JSON.parse(readFileSync(PORT_MANIFEST, "utf8")).version;
}

export type TestResult = { ok: boolean; passed: number; failed: number; exitCode: number; output: string };

function sdkPath(): string {
  const p = Bun.spawnSync(["make", "-s", "--no-print-directory", "print-sdk"], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const sdk = p.stdout.toString().trim();
  if (p.exitCode !== 0 || sdk === "") throw new Error(`make print-sdk failed: ${p.stderr.toString().trim()}`);
  if (!existsSync(join(sdk, "include"))) throw new Error(`wasmtime C API not found at ${sdk}; run: make fetch`);
  return sdk;
}

// Rule 3: the tag's tests (test source AND fixtures, unmodified) against the current header.
export function previousTests(tag: string, keep = false): TestResult {
  const dir = join(ROOT, ".compat");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  try {
    const tar = Bun.spawnSync(["git", "archive", "--format=tar", "-o", ".compat/tests.tar", tag, "tests"], { cwd: ROOT, stderr: "pipe" });
    if (tar.exitCode !== 0) throw new Error(`git archive ${tag} tests failed: ${tar.stderr.toString().trim()}`);
    // Relative path + cwd: GNU tar reads an absolute `<drive>:\...` as a remote host:path.
    const x = Bun.spawnSync(["tar", "-xf", "tests.tar"], { cwd: dir, stderr: "pipe" });
    if (x.exitCode !== 0) throw new Error(`tar -xf failed: ${x.stderr.toString().trim()}`);
    copyFileSync(join(ROOT, HEADER), join(dir, HEADER));
    const run = Bun.spawnSync(["make", "-f", "../Makefile", "--no-print-directory", `WASMTIME_SDK=${sdkPath()}`, "clean", "test"], {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = run.stdout.toString() + run.stderr.toString();
    const counts = [...output.matchAll(/(\d+) passed, (\d+) failed/g)].at(-1);
    const passed = counts ? Number(counts[1]) : 0;
    const failed = counts ? Number(counts[2]) : 0;
    const exitCode = run.exitCode ?? 1;
    return { ok: exitCode === 0 && counts !== undefined && failed === 0 && passed > 0, passed, failed, exitCode, output };
  } finally {
    if (!keep) rmSync(dir, { recursive: true, force: true });
  }
}

export function describeTests(tag: string, r: TestResult): string {
  const verdict = r.ok ? "GREEN" : "RED";
  return `previous-tag tests (${tag} tests/ vs current header): ${verdict} — ${r.passed} passed, ${r.failed} failed, exit ${r.exitCode}`;
}

function printFloor(prevTag: string, f: { floor: Level; reasons: string[] }) {
  console.log(`floor vs ${prevTag}: ${f.floor}`);
  for (const r of f.reasons) console.log(`  ${r}`);
}

if (import.meta.main) {
  const noTests = Bun.argv.includes("--no-tests");
  const keep = Bun.argv.includes("--keep");
  const snapshot = readSnapshot();
  const stale = diffSurface(snapshot, surfaceOf(readFileSync(join(ROOT, HEADER), "utf8")));
  if (stale.length > 0) {
    console.error("api-surface.json is stale; run `make surface-check` for the difference.");
    process.exit(1);
  }

  if (Bun.argv.includes("--release")) {
    const version = manifestVersion();
    const prevTag = releaseTags().find((t) => compareVersions(t, version) < 0);
    if (!prevTag) {
      console.log(`no release before ${version}; nothing to compare`);
      process.exit(0);
    }
    const step = levelOf(prevTag, version);
    const f = floorOf(surfaceAt(prevTag), snapshot);
    console.log(`release ${version} is a ${step} step from ${prevTag}`);
    printFloor(prevTag, f);
    let ok = rank(step) >= rank(f.floor);
    if (!ok) console.error(`BLOCKED: ${step} is below the floor (${f.floor})`);
    if (step !== "major" && !noTests) {
      const r = previousTests(prevTag, keep);
      console.log(describeTests(prevTag, r));
      if (!r.ok) {
        console.error(r.output);
        console.error(`BLOCKED: a ${step} release requires the previous tag's tests to pass`);
        ok = false;
      }
    }
    process.exit(ok ? 0 : 1);
  }

  const prevTag = releaseTags()[0];
  if (!prevTag) {
    console.log("no release tag yet; nothing to compare");
    process.exit(0);
  }
  console.log(`version line: ${manifestVersion()}; last release tag: ${prevTag}`);
  printFloor(prevTag, floorOf(surfaceAt(prevTag), snapshot));
  if (!noTests) {
    const r = previousTests(prevTag, keep);
    console.log(describeTests(prevTag, r));
    if (!r.ok) {
      console.error(r.output);
      process.exit(1);
    }
  }
}
