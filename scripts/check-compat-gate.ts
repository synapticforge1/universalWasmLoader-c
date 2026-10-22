// Self-test of the compatibility gate: each case mutates the REAL header in
// memory and asserts the floor (or the failure) the gate must produce. A gate
// that has never been seen to fail is not a gate (workspace best-practices 2.x).
//
// Usage: bun run scripts/check-compat-gate.ts      (or: make compat-selftest)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Level, bumpVersion, compareVersions, floorOf, levelOf } from "./compat.ts";
import { HEADER, ROOT, surfaceOf } from "./surface.ts";

const base = readFileSync(join(ROOT, HEADER), "utf8").replace(/\r\n/g, "\n");
const baseSurface = surfaceOf(base);
let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else { fail++; console.log(`  FAIL: ${name}${detail ? ` — ${detail}` : ""}`); }
}

// Apply a mutation that must match exactly once, so a header edit cannot
// silently turn a case into a no-op.
function mutate(from: string, to: string): string {
  const n = base.split(from).length - 1;
  if (n !== 1) throw new Error(`self-test mutation must match exactly once, matched ${n}: ${from}`);
  return base.replace(from, () => to);
}

function expectFloor(name: string, text: string, want: Level, reason?: string) {
  const { floor, reasons } = floorOf(baseSurface, surfaceOf(text));
  check(name, floor === want, `floor ${floor}, want ${want}; ${reasons.join(" | ") || "no reasons"}`);
  if (reason) check(`${name} names its reason`, reasons.some((r) => r.includes(reason)), reasons.join(" | "));
}

function expectThrow(name: string, text: string, msg: string) {
  try {
    surfaceOf(text);
    check(name, false, "no error");
  } catch (e) {
    check(name, String(e).includes(msg), String(e));
  }
}

const POOL_FREE = "void uwl_pool_free(uwl_pool_t *p);";
const POOL_NEW = "                         size_t size, char **err);";
const ENUM_TAIL = "    UWL_STR       /**< UTF-8 string (WIT `string`). */";
const VAL_LEN = "    size_t len; /**< Byte length of `str` when `kind == UWL_STR`. */";
const SPEC = "Conforms to the cross-language SPEC v3.0.0";
const AS_BOOL = "static inline int         uwl_as_bool(uwl_val_t v) { return v.as.b; }";

expectFloor("unchanged header", base, "patch");
expectFloor("comment-only edit", mutate("/** Free the pool and every instance it owns. */", "/** Free the pool. */"), "patch");
expectFloor("parameter renamed", mutate(POOL_FREE, "void uwl_pool_free(uwl_pool_t *pool);"), "patch");
expectFloor("whitespace reflowed", mutate(POOL_FREE, "void  uwl_pool_free( uwl_pool_t*   p );"), "patch");
expectFloor("static-inline body changed", mutate(AS_BOOL, "static inline int         uwl_as_bool(uwl_val_t v) { return v.as.b != 0; }"), "patch");
expectFloor("function removed", mutate(POOL_FREE, ""), "major", "removed: fn uwl_pool_free");
expectFloor("function added", mutate(POOL_FREE, `${POOL_FREE}\nint uwl_pool_busy(const uwl_pool_t *p);`), "minor", "added: fn uwl_pool_busy");
expectFloor("parameter retyped", mutate(POOL_NEW, "                         int size, char **err);"), "major", "changed: fn uwl_pool_new");
expectFloor("return type changed", mutate(POOL_FREE, "int uwl_pool_free(uwl_pool_t *p);"), "major", "changed: fn uwl_pool_free");
expectFloor("enum constant appended", mutate(ENUM_TAIL, "    UWL_STR,\n    UWL_LIST"), "minor", "added: const UWL_LIST");
expectFloor("enum constant inserted mid-list", mutate("    UWL_BOOL,", "    UWL_CHAR,\n    UWL_BOOL,"), "major", "changed: const UWL_BOOL");
expectFloor("struct member added", mutate(VAL_LEN, `${VAL_LEN}\n    int flags;`), "major", "changed: type uwl_val_t");
expectFloor("struct member renamed", mutate(VAL_LEN, "    size_t length;"), "major", "changed: type uwl_val_t");
expectFloor("public macro added", mutate(POOL_FREE, `${POOL_FREE}\n#define UWL_POOL_DEFAULT 4`), "minor", "added: macro UWL_POOL_DEFAULT");
expectFloor("public include removed", mutate("#include <stddef.h>\n", ""), "major", "removed: include <stddef.h>");
expectFloor("SPEC minor raised", mutate(SPEC, SPEC.replace("v3.0.0", "v3.1.0")), "minor", "SPEC 3.0.0 -> 3.1.0");
expectFloor("SPEC patch raised", mutate(SPEC, SPEC.replace("v3.0.0", "v3.0.1")), "patch", "SPEC 3.0.0 -> 3.0.1");
expectFloor("SPEC major raised", mutate(SPEC, SPEC.replace("v3.0.0", "v4.0.0")), "major", "SPEC 3.0.0 -> 4.0.0");
expectFloor("SPEC lowered", mutate(SPEC, SPEC.replace("v3.0.0", "v2.9.0")), "major", "(lowered)");
expectFloor("added + removed together", mutate(POOL_FREE, "int uwl_pool_busy(const uwl_pool_t *p);"), "major");

expectThrow("unkeyable: bare struct definition", mutate(POOL_FREE, `${POOL_FREE}\nstruct uwl_x { int a; };`), "cannot key");
expectThrow("unkeyable: extern variable", mutate(POOL_FREE, `${POOL_FREE}\nextern int uwl_counter;`), "cannot key");
expectThrow("unkeyable: enum value expression", mutate("    UWL_VOID = 0,", "    UWL_VOID = 1 << 0,"), "cannot key enum value");
expectThrow("unkeyable: #if in public region", mutate(POOL_FREE, `${POOL_FREE}\n#if defined(X)\n#endif`), "cannot key preprocessor");
expectThrow("duplicate declaration", mutate(POOL_FREE, `${POOL_FREE}\n${POOL_FREE}`), "duplicate surface key");
expectThrow("no SPEC line", mutate(SPEC, "Conforms to the cross-language spec"), "SPEC version");
expectThrow("no implementation marker", base.replace("#ifdef UWL_IMPLEMENTATION", "#ifdef UWL_IMPL"), "public region");

check("levelOf patch", levelOf("1.1.0", "1.1.1") === "patch");
check("levelOf minor", levelOf("1.1.3", "1.2.0") === "minor");
check("levelOf major", levelOf("1.9.9", "2.0.0") === "major");
check("bump minor resets patch", bumpVersion("1.1.4", "minor") === "1.2.0");
check("bump major resets minor and patch", bumpVersion("1.9.4", "major") === "2.0.0");
check("components are unbounded (no carry)", bumpVersion("1.9.9", "patch") === "1.9.10");
check("compare is numeric, not lexical", compareVersions("1.10.0", "1.9.0") > 0);
try {
  levelOf("1.1.0", "1.1.0");
  check("levelOf rejects a non-increase", false);
} catch {
  check("levelOf rejects a non-increase", true);
}
try {
  bumpVersion("1.1", "patch");
  check("a malformed version throws", false);
} catch {
  check("a malformed version throws", true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
