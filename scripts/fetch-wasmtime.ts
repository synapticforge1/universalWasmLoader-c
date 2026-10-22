// Fetch the wasmtime C API SDK into vendor/ (gitignored). The SDK provides the
// headers (wasm.h / wasmtime.h / wasi.h) and the static/import libraries the
// loader links against.
//
// Usage: bun run scripts/fetch-wasmtime.ts [VERSION] [PLATFORM]
//   VERSION  default: 45.0.2
//   PLATFORM default: x86_64-mingw  (gcc/MinGW on Windows)
//            others:  x86_64-windows (MSVC), x86_64-linux, aarch64-linux,
//                     x86_64-macos, aarch64-macos
//
// wasmtime ships the Windows targets (-windows, -mingw) as .zip and the Linux /
// macOS targets as .tar.xz. A .zip is extracted with `unzip`, or `tar` (bsdtar,
// which reads zip) when unzip is absent; a .tar.xz with `tar`.
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const VERSION = Bun.argv[2] ?? "45.0.2";
const PLATFORM = Bun.argv[3] ?? "x86_64-mingw";
const HERE = resolve(import.meta.dir, "..");
const VENDOR = join(HERE, "vendor");
const NAME = `wasmtime-v${VERSION}-${PLATFORM}-c-api`;
const IS_ZIP = /-(windows|mingw)$/.test(PLATFORM);
const ARCHIVE_NAME = `${NAME}.${IS_ZIP ? "zip" : "tar.xz"}`;
const URL = `https://github.com/bytecodealliance/wasmtime/releases/download/v${VERSION}/${ARCHIVE_NAME}`;
const ARCHIVE = join(VENDOR, ARCHIVE_NAME);

mkdirSync(VENDOR, { recursive: true });
if (existsSync(join(VENDOR, NAME, "include"))) {
  console.log(`wasmtime C API already present: ${join(VENDOR, NAME)}`);
  process.exit(0);
}

// Retries network errors and 5xx (like `curl --retry`); a 4xx fails at once.
async function download(url: string, dest: string, retries = 3): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      if (attempt >= retries) throw err;
      console.error(`Download failed (${err}); retrying (${attempt + 1}/${retries})`);
      continue;
    }
    if (res.ok) {
      await Bun.write(dest, res);
      return;
    }
    if (res.status < 500 || attempt >= retries) {
      console.error(`Download failed: HTTP ${res.status} ${res.statusText} for ${url}`);
      process.exit(1);
    }
    console.error(`Download failed (HTTP ${res.status}); retrying (${attempt + 1}/${retries})`);
  }
}

console.log(`Downloading ${URL}`);
await download(URL, ARCHIVE);

console.log("Extracting");
const cmd = IS_ZIP && Bun.which("unzip")
  ? ["unzip", "-q", "-o", ARCHIVE_NAME]
  : Bun.which("tar")
  ? ["tar", "-xf", ARCHIVE_NAME]
  : null;
if (!cmd) {
  console.error(`No extractor for ${ARCHIVE_NAME} on PATH (need ${IS_ZIP ? "unzip or " : ""}tar).`);
  process.exit(1);
}
const proc = Bun.spawnSync(cmd, { cwd: VENDOR, stdout: "inherit", stderr: "inherit" });
if (proc.exitCode !== 0) {
  console.error(`${cmd[0]} exited with ${proc.exitCode}`);
  process.exit(proc.exitCode ?? 1);
}
if (!existsSync(join(VENDOR, NAME, "include"))) {
  console.error(`Extraction finished but ${join(VENDOR, NAME, "include")} is missing.`);
  process.exit(1);
}

rmSync(ARCHIVE, { force: true });
console.log(`Done: ${join(VENDOR, NAME)}`);
