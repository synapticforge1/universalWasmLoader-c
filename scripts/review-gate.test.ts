import { describe, expect, test } from "bun:test";
import { needsReview, recordedCommits, refusals } from "./review-gate.ts";

const sha = "0a19a93";

describe("the record", () => {
  test("one bullet line, with or without backticks", () => {
    expect(recordedCommits(`## Last review\n\n- Review complete: ${sha}\n`)).toEqual([sha]);
    expect(recordedCommits("- Review complete: `2e675af1`\n")).toEqual(["2e675af1"]);
  });
  test("prose that mentions the words is not a record", () => {
    expect(recordedCommits("records `Review complete: <commit>` under § Last review")).toEqual([]);
    expect(recordedCommits("- Review complete: soon\n")).toEqual([]);
    // A real commit id in a sentence, not in its own bullet, is not a record either.
    expect(recordedCommits(`the last one said Review complete: ${sha}\n`)).toEqual([]);
  });
});

describe("refusals", () => {
  const ok = { recorded: [sha], resolved: `${sha}aaaa`, isAncestor: true, changed: ["cmem/STATE.md"] };
  test("a reviewed ancestor with only memory changed since passes", () => {
    expect(refusals(ok)).toEqual([]);
  });
  test("no record, two records, an unknown or a non-ancestor commit refuse", () => {
    expect(refusals({ ...ok, recorded: [] })[0]).toContain("run \"review\" first");
    expect(refusals({ ...ok, recorded: [sha, "1111111"] })[0]).toContain("2 \"Review complete\" lines");
    expect(refusals({ ...ok, resolved: null })[0]).toContain("not in this repository");
    expect(refusals({ ...ok, isAncestor: false })[0]).toContain("not an ancestor");
  });
  test("code, tests, scripts, CI, the manifest or the README changed since refuse", () => {
    for (const f of ["universal_wasm_loader.h", "tests/spec_tests.c", "scripts/release.ts", ".github/workflows/vcpkg-release.yml", "ports/universal-wasm-loader-c/portfile.cmake", "README.md"]) {
      expect(refusals({ ...ok, changed: ["cmem/STATE.md", f] })[0]).toContain(f);
    }
  });
});

test("only cmem/ is exempt", () => {
  expect(needsReview(["cmem/release.md", "cmem/archive/x.md", "cmemo.md", "tests/cmem/x.c"])).toEqual(["cmemo.md", "tests/cmem/x.c"]);
});
