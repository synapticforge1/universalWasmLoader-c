// Tests for the privacy gate. Every planted path, address and token is built by concatenation, so
// this file itself never carries one (the gate reads it too).
import { describe, expect, test } from "bun:test";
import { findLeaks, mask, parseArgs, privateFilesTracked, textOf } from "./check-privacy.ts";

const kinds = (name: string, text: string) => findLeaks(name, text).map((l) => l.kind);
const at = "@";
const drive = "C" + ":";

describe("machine paths", () => {
  test("a drive path to a user profile or the project tree is refused, either slash", () => {
    expect(kinds("a.md", `see ${drive}\\Users\\someone\\x`)).toEqual(["drive path"]);
    expect(kinds("a.md", `see ${drive}/Programs/x/y`)).toEqual(["drive path"]);
    expect(kinds("a.json", `"${drive}\\\\Users\\\\someone"`)).toEqual(["drive path"]);
  });
  test("WSL, Git Bash, macOS and Linux homes are refused; the CI runner's home is not", () => {
    expect(kinds("a.md", "/mnt/c/Us" + "ers/someone/x")).toContain("drive path");
    expect(kinds("a.md", " /" + "d/Programs/x")).toEqual(["drive path"]);
    expect(kinds("a.md", "/Us" + "ers/someone/x")).toEqual(["home path"]);
    expect(kinds("a.md", "/ho" + "me/someone/x")).toEqual(["home path"]);
    expect(kinds("a.md", "/ho" + "me/runner/work/x")).toEqual([]);
  });
  test("placeholders and convention paths pass", () => {
    expect(kinds("a.md", "`<drive>:\\Users\\<name>\\…` and `C:\\zig-cache\\<repo>` and %TEMP%\\uwl-c-t")).toEqual([]);
  });
});

describe("credentials", () => {
  test("token shapes are refused", () => {
    expect(kinds("a", "ghp_" + "a".repeat(36))).toEqual(["GitHub token"]);
    expect(kinds("a", "cio" + "A1".repeat(16))).toEqual(["crates.io token"]);
    expect(kinds("a", "-----BEGIN " + "PRIVATE KEY-----")).toEqual(["private key"]);
    expect(kinds("a", 'api_key = "' + "s3cr3tvalue" + '"')).toEqual(["secret assignment"]);
  });
  test("a URL password is refused unless the host is local", () => {
    // (A host containing the word "host" is read as the placeholder HOST and passes: inherited.)
    expect(kinds("a", "https://u:" + "p" + at + "srv.org/x")).toEqual(["URL password"]);
    expect(kinds("a", "https://u:" + "p" + at + "localhost/x")).toEqual([]);
  });
  test("a secret is never printed whole", () => {
    const leak = findLeaks("a", "ghp_" + "b".repeat(36))[0];
    expect(leak.masked.startsWith("ghp")).toBe(true);
    expect(leak.masked).not.toContain("bbbb");
    expect(mask("abcdef")).toBe("abc***");
  });
});

describe("email addresses", () => {
  const person = "someone" + at + "mail.org";
  const other = "other" + at + "mail.org";
  test("a personal address is refused in every file (no maintainer address is allowed here)", () => {
    expect(kinds("README.md", `ask ${person}`)).toEqual(["email address"]);
    expect(kinds("cmem/x.md", `ask ${person}`)).toEqual(["email address"]);
    expect(kinds("ports/universal-wasm-loader-c/vcpkg.json", `"maintainers": "A <${person}>"`)).toEqual(["email address"]);
    expect(kinds("universal_wasm_loader.h", ` * ${person}, ${other}`)).toEqual(["email address", "email address"]);
  });
  test("service and example addresses pass", () => {
    expect(kinds("a", "1+x" + at + "users.noreply.github.com")).toEqual([]);
    expect(kinds("a", "noreply" + at + "anthropic.com")).toEqual([]);
    expect(kinds("a", "x" + at + "example.com")).toEqual([]);
  });
});

describe("private files and inputs", () => {
  test("a tracked private file is refused", () => {
    const tracked = ["universal_wasm_loader.h", "cmem/review-issues.md", "cmem/local/environment.md", "CLAUDE.md", ".claude/x.json"];
    expect(privateFilesTracked(tracked)).toEqual(tracked.slice(1));
    expect(privateFilesTracked(["cmem/INDEX.md", "cmem/STATE.md"])).toEqual([]);
  });
  test("UTF-16 text is read, not skipped as binary", () => {
    const planted = `${drive}\\Users\\someone\\x`;
    expect(kinds("a", textOf(new Uint8Array(Buffer.from(planted, "utf16le"))))).toContain("drive path");
  });
  test("arguments: --commits needs a value; anything else is refused", () => {
    expect(parseArgs(["--commits", "HEAD~3..HEAD"]).commits).toBe("HEAD~3..HEAD");
    expect(() => parseArgs(["--commits"])).toThrow();
    expect(() => parseArgs(["--all"])).toThrow();
  });
});
