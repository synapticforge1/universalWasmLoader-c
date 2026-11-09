/*
 * spec_tests.c — Reference test suite (SPEC §8) for universalWasmLoader-c.
 *
 * Build & run via the Makefile: `make test`.
 *
 * Calls go through the typed convenience layer (uwl_call_i32 / _f64 / _bool /
 * _str), which reads native C args per the export's WIT signature and reports
 * failures via uwl_last_error().
 */
#if !defined(_WIN32) && !defined(_POSIX_C_SOURCE)
#define _POSIX_C_SOURCE 200809L /* mkdir / rmdir under -std=c11 */
#endif

#define UWL_IMPLEMENTATION
#include "../universal_wasm_loader.h"

#include <math.h>
#include <stdio.h>
#include <string.h>

#ifdef _WIN32
#include <direct.h>
#define MKDIR(p) _mkdir(p)
#define RMDIR(p) _rmdir(p)
#else
#include <sys/stat.h>
#include <unistd.h>
#define MKDIR(p) mkdir(p, 0755)
#define RMDIR(p) rmdir(p)
#endif

static int g_pass = 0, g_fail = 0;

#define CHECK(cond, msg) do { \
    if (cond) { g_pass++; } \
    else { g_fail++; printf("  FAIL: %s  (%s:%d)\n", msg, __FILE__, __LINE__); } \
} while (0)

/* Path to a fixture relative to the test working directory (repo root). */
static const char *FX(const char *base) {
    static char buf[256];
    snprintf(buf, sizeof(buf), "tests/%s", base);
    return buf;
}

static uwl_module_t *load(const char *base, const uwl_host_callback_t *cbs, size_t ncbs) {
    char *err = NULL;
    uwl_module_t *m = uwl_import(FX(base), cbs, ncbs, &err);
    if (!m) { printf("  LOAD ERROR (%s): %s\n", base, err ? err : "?"); uwl_string_free(err); }
    return m;
}

/* Call a string export and compare the owned result to `expect`. */
static int str_eq(uwl_module_t *m, const char *fn, const char *arg, const char *expect) {
    char *got = uwl_call_str(m, fn, arg);
    if (!got) { printf("  CALL ERROR (%s): %s\n", fn, uwl_last_error() ? uwl_last_error() : "?"); return 0; }
    int ok = (strcmp(got, expect) == 0);
    if (!ok) printf("  got '%s' want '%s'\n", got, expect);
    uwl_string_free(got);
    return ok;
}

static void test_math(void) {
    printf("math_50 — numeric round-trip\n");
    uwl_module_t *m = load("math_50.wasm", NULL, 0);
    CHECK(m != NULL, "math_50 loads");
    if (!m) return;
    CHECK(uwl_call_i32(m, "add", 3, 4) == 7, "add(3,4)==7");
    CHECK(fabs(uwl_call_f64(m, "multiply", 2.5, 4.0) - 10.0) < 1e-9, "multiply(2.5,4.0)==10.0");
    CHECK(uwl_call_i32(m, "square", 5) == 25, "square(5)==25");
    uwl_free(m);
}

static void test_booleans(void) {
    printf("booleans_50 — bool normalization\n");
    uwl_module_t *m = load("booleans_50.wasm", NULL, 0);
    CHECK(m != NULL, "booleans_50 loads");
    if (!m) return;
    CHECK(uwl_call_bool(m, "isPositive", 1.0) == 1, "isPositive(1.0)");
    CHECK(uwl_call_bool(m, "isPositive", -1.0) == 0, "isPositive(-1.0)");
    CHECK(uwl_call_bool(m, "inRange", 5.0, 0.0, 10.0) == 1, "inRange(5,0,10)");
    CHECK(uwl_call_bool(m, "inRange", 11.0, 0.0, 10.0) == 0, "inRange(11,0,10)");
    CHECK(uwl_call_bool(m, "isEven", 4) == 1, "isEven(4)");
    CHECK(uwl_call_bool(m, "isEven", 3) == 0, "isEven(3)");
    uwl_free(m);
}

static void test_strings(void) {
    printf("strings_50 — string param + return (Canonical ABI v3.0.0)\n");
    uwl_module_t *m = load("strings_50.wasm", NULL, 0);
    CHECK(m != NULL, "strings_50 loads");
    if (!m) return;
    CHECK(str_eq(m, "greet", "World", "Hello, World!"), "greet(\"World\")==\"Hello, World!\"");
    CHECK(str_eq(m, "shout", "hi", "hihi"), "shout(\"hi\")==\"hihi\"");
    CHECK(uwl_call_i32(m, "strLen", "hello") == 5, "strLen(\"hello\")==5");
    uwl_free(m);
}

static uwl_val_t env_mul(const uwl_val_t *args, size_t n, void *ud) {
    (void)n; (void)ud;
    return uwl_f64(uwl_as_f64(args[0]) * uwl_as_f64(args[1]));
}
static uwl_val_t env_add(const uwl_val_t *args, size_t n, void *ud) {
    (void)n; (void)ud;
    return uwl_i32(uwl_as_i32(args[0]) + uwl_as_i32(args[1]));
}

static void test_imports(void) {
    printf("imports_50 — host import callbacks\n");
    uwl_host_callback_t cbs[2] = {
        { "envMul", env_mul, NULL },
        { "envAdd", env_add, NULL },
    };
    uwl_module_t *m = load("imports_50.wasm", cbs, 2);
    CHECK(m != NULL, "imports_50 loads");
    if (!m) return;
    CHECK(fabs(uwl_call_f64(m, "scale", 3.0, 4.0) - 12.0) < 1e-9, "scale(3,4)==12 (envMul)");
    CHECK(uwl_call_i32(m, "combine", 10, 7) == 17, "combine(10,7)==17 (envAdd)");
    uwl_free(m);
}

/* init_check.wasm has no .wit (raw-exports path); its `_initialize` sets a
 * global to 99 that `getValue` reads — so 99 proves the loader invoked it. */
static void test_initialize(void) {
    printf("init_check — SPEC §10 _initialize called after instantiation\n");
    uwl_module_t *m = load("init_check.wasm", NULL, 0);
    CHECK(m != NULL, "init_check loads");
    if (!m) return;
    uwl_val_t out = uwl_void();
    char *err = NULL;
    int rc = uwl_call(m, "getValue", NULL, 0, &out, &err);
    if (rc != 0) { printf("  CALL ERROR (getValue): %s\n", err ? err : "?"); uwl_string_free(err); }
    CHECK(rc == 0 && out.kind == UWL_I32, "raw getValue() returns an i32");
    CHECK(rc == 0 && uwl_as_i32(out) == 99, "getValue()==99 (proves _initialize ran)");
    uwl_free(m);
}

/* wasi_io_50 calls console.log → imports wasi_snapshot_preview1.fd_write.
 * Without the loader's WASI context it still instantiates (unknown imports are
 * bound to traps), but the call traps — so the result is the evidence. */
static void test_wasi_io(void) {
    printf("wasi_io_50 — SPEC §10 WASI lets an I/O library instantiate\n");
    uwl_module_t *m = load("wasi_io_50.wasm", NULL, 0);
    CHECK(m != NULL, "wasi_io_50 loads");
    if (!m) return;
    CHECK(uwl_call_i32(m, "logAndDouble", 21) == 42, "logAndDouble(21)==42 (fd_write ran via WASI)");
    uwl_free(m);
}

/* Copy a fixture to `dst` so it loads without its companion .wit. */
static int copy_file(const char *src, const char *dst) {
    FILE *in = fopen(src, "rb"), *out = in ? fopen(dst, "wb") : NULL;
    char buf[4096]; size_t n; int ok = (in && out);
    while (ok && (n = fread(buf, 1, sizeof(buf), in)) > 0) ok = (fwrite(buf, 1, n, out) == n);
    if (in) fclose(in);
    if (out) fclose(out);
    return ok;
}

/* Workspace H29 / S8: raw mode encodes by the export's wasm signature (wasmtime
 * checks each arg's kind), and a typed accessor whose result kind does not
 * match the export fails loudly instead of reading the wrong union member. */
static void test_result_kinds(void) {
    printf("result kinds — raw f64 call; typed accessor mismatch is an error\n");
    const char *raw = "tests/raw_math_50.wasm"; /* no raw_math_50.wit beside it */
    CHECK(copy_file(FX("math_50.wasm"), raw), "copy math_50.wasm without its .wit");
    char *err = NULL;
    uwl_module_t *r = uwl_import(raw, NULL, 0, &err);
    CHECK(r != NULL, "raw math_50 loads");
    if (r) {
        uwl_val_t a[2] = { uwl_f64(2.5), uwl_f64(4.0) }, out = uwl_void();
        int rc = uwl_call(r, "multiply", a, 2, &out, &err);
        CHECK(rc == 0 && out.kind == UWL_F64 && fabs(uwl_as_f64(out) - 10.0) < 1e-9,
              "raw multiply(2.5,4.0)==10.0 as f64");
        uwl_val_t b[2] = { uwl_i32(2), uwl_i32(4) };
        rc = uwl_call(r, "multiply", b, 2, &out, &err);
        CHECK(rc != 0, "raw multiply with i32 args is refused, not coerced");
        uwl_string_free(err);
        uwl_free(r);
    } else uwl_string_free(err);
    remove(raw);

    uwl_module_t *m = load("math_50.wasm", NULL, 0);
    if (!m) { CHECK(0, "math_50 loads"); return; }
    CHECK(uwl_call_i32(m, "multiply", 2.5, 4.0) == 0 && uwl_last_error() != NULL,
          "call_i32 on an f64 export: 0 with the last error set");
    CHECK(uwl_call_f64(m, "add", 3, 4) == 0.0 && uwl_last_error() != NULL,
          "call_f64 on an s32 export: 0.0 with the last error set");
    CHECK(uwl_call_bool(m, "add", 3, 4) == 0 && uwl_last_error() != NULL,
          "call_bool on an s32 export: 0 with the last error set");
    CHECK(uwl_call_str(m, "add", 3, 4) == NULL && uwl_last_error() != NULL,
          "call_str on an s32 export: NULL with the last error set");
    CHECK(uwl_call_i32(m, "add", 3, 4) == 7 && uwl_last_error() == NULL,
          "a matching call afterwards succeeds and clears the error");
    uwl_free(m);
}

/* ── SPEC 4.0.0 §8 "Refusals" (workspace C29) ─────────────────────────────
 * Scratch files are written into tests/ next to the fixtures and removed. */

static int write_text(const char *path, const char *text) {
    FILE *f = fopen(path, "wb");
    if (!f) return 0;
    size_t n = strlen(text);
    int ok = fwrite(text, 1, n, f) == n;
    return fclose(f) == 0 && ok;
}

/* uwl_import that must FAIL; returns the error (caller frees) or NULL if it loaded. */
static char *load_fails(const char *path, const uwl_host_callback_t *cbs, size_t ncbs) {
    char *err = NULL;
    uwl_module_t *m = uwl_import(path, cbs, ncbs, &err);
    if (m) { uwl_free(m); return NULL; }
    return err ? err : uwl__strdup("(no message)");
}

static int has(const char *s, const char *needle) { return s && strstr(s, needle) != NULL; }

/* §2 absent versus failed; the .wit is read before the .wasm. */
static void test_wit_absent_vs_failed(void) {
    printf("SPEC 4.0.0 §2 — only an absent .wit is raw; the .wit is read first\n");

    /* No .wasm suffix: no companion, even with a (wrong) `<path>.wit` beside it. */
    const char *bin = "tests/nosuffix_math.bin", *binwit = "tests/nosuffix_math.bin.wit";
    copy_file(FX("math_50.wasm"), bin);
    write_text(binwit, "world w { export multiply: func(a: s32, b: s32) -> s32; }\n");
    char *err = NULL;
    uwl_module_t *r = uwl_import(bin, NULL, 0, &err);
    uwl_val_t a[2] = { uwl_f64(2.5), uwl_f64(4.0) }, out = uwl_void();
    int rc = r ? uwl_call(r, "multiply", a, 2, &out, &err) : -1;
    CHECK(rc == 0 && out.kind == UWL_F64 && fabs(uwl_as_f64(out) - 10.0) < 1e-9,
          "a path not ending in .wasm loads raw (no '<path>.wit' companion)");
    if (r) uwl_free(r);
    uwl_string_free(err); err = NULL;
    remove(bin); remove(binwit);

    /* A .wit that exists but cannot be read (a directory) fails the load. */
    const char *dw = "tests/dir_math.wasm", *dd = "tests/dir_math.wit";
    copy_file(FX("math_50.wasm"), dw);
    MKDIR(dd);
    err = load_fails(dw, NULL, 0);
    CHECK(has(err, "dir_math.wit"), "an unreadable .wit (a directory) fails the load, naming it");
    uwl_string_free(err);
    RMDIR(dd); remove(dw);

    /* A bad .wit with NO .wasm: the .wit's fault is reported, so it was read first. */
    const char *ow = "tests/order_math.wit";
    write_text(ow, "world w { export add: func(a: u32, b: s32) -> s32; }\n");
    err = load_fails("tests/order_math.wasm", NULL, 0);
    CHECK(has(err, "order_math.wit") && has(err, "u32") && !has(err, "failed to read"),
          "the .wit is checked before the .wasm is read");
    uwl_string_free(err);
    remove(ow);
}

/* §2 strict parsing, beside a real math_50.wasm. */
static void test_wit_parsing(void) {
    printf("SPEC 4.0.0 §2 — a .wit that does not parse fails the load\n");
    const char *w = "tests/bad_math.wasm", *wit = "tests/bad_math.wit";
    copy_file(FX("math_50.wasm"), w);
    static const struct { const char *src, *fault, *label; } bad[] = {
        { "world m { export add: func(a: s32 b: s32) -> s32; }", "malformed parameter", "func(a: s32 b: s32)" },
        { "world m { export add: func(a: u32, b: s32) -> s32; }", "unsupported WIT type \"u32\"", "u32 is not read as s32" },
        { "world m { export add: func(a: s32, b: s32) -> list<u8>; }", "unsupported WIT type", "list<u8> result" },
        { "", "it is empty", "an empty .wit" },
        { "world m { export add: func(a: s32, b: s32) -> s32; } extra", "not a WIT world", "text outside the world" },
        { "world m { resource r; }", "unsupported or malformed WIT statement", "a non-function statement" },
        { "world m { export add: func(a: s32, a: s32) -> s32; }", "duplicate parameter", "a duplicate parameter" },
        { "world m { export add: func(a: s32, b: s32) -> s32; export add: func(a: s32, b: s32) -> s32; }",
          "duplicate export add", "a duplicate export" },
        { "world m { export add: func(a: s32, b: s32) -> s32 }", "missing \";\"", "a missing ';'" },
        { "world m { export add: func(a: s32, b: s32) -> s32; export nope: func() -> s32; }",
          "does not export: nope", "a WIT export the module lacks" },
    };
    for (size_t i = 0; i < sizeof(bad) / sizeof(bad[0]); i++) {
        write_text(wit, bad[i].src);
        char *err = load_fails(w, NULL, 0);
        char msg[160];
        snprintf(msg, sizeof(msg), "refused: %s", bad[i].label);
        CHECK(has(err, "bad_math.wit") || has(err, "nope"), msg);
        CHECK(has(err, bad[i].fault), "  ...and the error names the fault");
        if (err && !has(err, bad[i].fault)) printf("    -> %s\n", err);
        uwl_string_free(err);
    }

    /* The accepted forms: comments, `package`, CRLF, a trailing comma, a subset of exports. */
    write_text(wit, "// gen\r\npackage local:x-1;\r\nworld math-50 {\r\n"
                    "  export add: func(a: s32, b: s32,) -> s32; // tail\r\n}\r\n");
    uwl_module_t *m = load("bad_math.wasm", NULL, 0);
    CHECK(m && uwl_call_i32(m, "add", 3, 4) == 7, "comments, package, CRLF, trailing comma parse; add(3,4)==7");
    if (m) uwl_free(m);
    remove(wit); remove(w);
}

static uwl_val_t mul_ok(const uwl_val_t *args, size_t n, void *ud) {
    (void)n; (void)ud;
    return uwl_f64(uwl_as_f64(args[0]) * uwl_as_f64(args[1]));
}

/* envAdd returning the wrong kind; userdata picks which. */
static uwl_val_t add_bad(const uwl_val_t *args, size_t n, void *ud) {
    (void)args; (void)n;
    switch (*(const int *)ud) {
        case 0:  return uwl_void();
        case 1:  return uwl_f64(2.9);
        case 2:  return uwl_bool(1);
        case 3:  return uwl_str("17");
        default: return uwl_i64(17);
    }
}

/* §4 every WIT import needs a callback; its return value is checked. */
static void test_import_refusals(void) {
    printf("SPEC 4.0.0 §4 — host callbacks: all required, return kind checked\n");
    char *err = load_fails(FX("imports_50.wasm"), NULL, 0);
    CHECK(has(err, "envMul") && has(err, "envAdd"), "imports_50 with no callbacks: refused naming envMul and envAdd");
    uwl_string_free(err);

    uwl_host_callback_t only_mul[1] = { { "envMul", mul_ok, NULL } };
    err = load_fails(FX("imports_50.wasm"), only_mul, 1);
    CHECK(has(err, "envAdd") && !has(err, "envMul"), "imports_50 with only envMul: refused naming envAdd");
    uwl_string_free(err);

    uwl_host_callback_t null_add[2] = { { "envMul", mul_ok, NULL }, { "envAdd", NULL, NULL } };
    err = load_fails(FX("imports_50.wasm"), null_add, 2);
    CHECK(has(err, "envAdd"), "an entry with a NULL fn counts as missing");
    uwl_string_free(err);

    /* A string-result import, with no .wasm present: refused at load, before the .wasm. */
    const char *sw = "tests/strres_imports.wit";
    write_text(sw, "world imports-50 {\n  import env-mul: func(p0: f64, p1: f64) -> string;\n"
                   "  import env-add: func(p0: s32, p1: s32) -> s32;\n"
                   "  export scale: func(x: f64, factor: f64) -> f64;\n}\n");
    uwl_host_callback_t both[2] = { { "envMul", mul_ok, NULL }, { "envAdd", mul_ok, NULL } };
    err = load_fails("tests/strres_imports.wasm", both, 2);
    CHECK(has(err, "envMul") && has(err, "string") && !has(err, "failed to read"),
          "an import with a string result is refused before the .wasm is read");
    uwl_string_free(err);
    remove(sw);

    static const char *shown[] = { "no value", "2.9 (f64)", "true (bool)", "\"17\" (string)", "17 (s64)" };
    static const int sel[] = { 0, 1, 2, 3, 4 };
    for (int i = 0; i < 5; i++) {
        uwl_host_callback_t cbs[2] = { { "envMul", mul_ok, NULL }, { "envAdd", add_bad, (void *)&sel[i] } };
        uwl_module_t *m = load("imports_50.wasm", cbs, 2);
        uwl_val_t a[2] = { uwl_i32(10), uwl_i32(7) }, out = uwl_void();
        err = NULL;
        int rc = m ? uwl_call(m, "combine", a, 2, &out, &err) : 0;
        char msg[160];
        snprintf(msg, sizeof(msg), "envAdd returning %s: combine(10,7) fails naming it", shown[i]);
        CHECK(m && rc != 0 && has(err, "envAdd") && has(err, "env-add") && has(err, "s32") && has(err, shown[i]), msg);
        if (m && rc != 0 && !has(err, shown[i])) printf("    -> %s\n", err ? err : "?");
        uwl_val_free(&out);
        uwl_string_free(err);
        if (m) uwl_free(m);
    }
}

/* §4 typed calls check the count and each argument's kind; nothing is coerced. */
static void test_typed_args(void) {
    printf("SPEC 4.0.0 §4 — typed-call arguments are checked, never coerced\n");
    uwl_module_t *m = load("math_50.wasm", NULL, 0);
    uwl_module_t *s = load("strings_50.wasm", NULL, 0);
    uwl_module_t *b = load("booleans_50.wasm", NULL, 0);
    if (!m || !s || !b) { CHECK(0, "math_50 / strings_50 / booleans_50 load"); goto out; }
    static const struct { int mod; const char *fn; size_t n; int k0, k1; const char *names, *label; } cases[] = {
        { 0, "add",        2, UWL_STR,  UWL_I32, "'a'",    "add(\"x\", 1)" },
        { 0, "add",        2, UWL_F64,  UWL_I32, "'a'",    "add(2.7, 1)" },
        { 0, "add",        2, UWL_I32,  UWL_I64, "'b'",    "add(1, s64 1)" },
        { 0, "add",        1, UWL_I32,  0,       "expects 2", "add(1)" },
        { 1, "greet",      1, UWL_I32,  0,       "'name'", "greet(42)" },
        { 2, "isEven",     1, UWL_STR,  0,       "'n'",    "isEven(\"4\")" },
        { 2, "isPositive", 1, UWL_BOOL, 0,       "'x'",    "isPositive(true)" },
    };
    for (size_t i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
        uwl_val_t a[2];
        int kinds[2] = { cases[i].k0, cases[i].k1 };
        for (int j = 0; j < 2; j++) {
            switch (kinds[j]) {
                case UWL_STR:  a[j] = uwl_str("x"); break;
                case UWL_F64:  a[j] = uwl_f64(2.7); break;
                case UWL_I64:  a[j] = uwl_i64(1); break;
                case UWL_BOOL: a[j] = uwl_bool(1); break;
                default:       a[j] = uwl_i32(1); break;
            }
        }
        uwl_module_t *mod = cases[i].mod == 0 ? m : cases[i].mod == 1 ? s : b;
        uwl_val_t out = uwl_void();
        char *err = NULL;
        int rc = uwl_call(mod, cases[i].fn, a, cases[i].n, &out, &err);
        char msg[160];
        snprintf(msg, sizeof(msg), "%s refused, naming the export and %s", cases[i].label, cases[i].names);
        CHECK(rc != 0 && has(err, cases[i].fn) && has(err, cases[i].names), msg);
        uwl_val_free(&out);
        uwl_string_free(err);
        uwl_val_free(&a[0]); uwl_val_free(&a[1]);
    }
    CHECK(uwl_call_str(s, "greet", (const char *)NULL) == NULL && has(uwl_last_error(), "NULL"),
          "call_str greet(NULL): refused, not sent as \"\"");
out:
    if (m) uwl_free(m);
    if (s) uwl_free(s);
    if (b) uwl_free(b);
}

/* ── Workspace C39: a host callback can FAIL (uwl_err), void imports included ──
 * A hand-assembled module (no reference fixture has a void import):
 *   (import "env" "ping"  (func))   (import "env" "after" (func))
 *   (func (export "run") (result i32) call 0  call 1  i32.const 42)
 * `after` counts its calls, so it shows whether the WASM ran on past `ping`. */
static const unsigned char VOID_IMPORTS_WASM[] = {
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    0x01, 0x08, 0x02, 0x60, 0x00, 0x00, 0x60, 0x00, 0x01, 0x7f,               /* types */
    0x02, 0x18, 0x02,                                                           /* imports */
    0x03, 'e', 'n', 'v', 0x04, 'p', 'i', 'n', 'g', 0x00, 0x00,
    0x03, 'e', 'n', 'v', 0x05, 'a', 'f', 't', 'e', 'r', 0x00, 0x00,
    0x03, 0x02, 0x01, 0x01,                                                     /* functions */
    0x07, 0x07, 0x01, 0x03, 'r', 'u', 'n', 0x00, 0x02,                          /* exports */
    0x0a, 0x0a, 0x01, 0x08, 0x00, 0x10, 0x00, 0x10, 0x01, 0x41, 0x2a, 0x0b,   /* code */
};

static int g_after_calls = 0;

static uwl_val_t cb_after(const uwl_val_t *a, size_t n, void *ud) {
    (void)a; (void)n; (void)ud;
    g_after_calls++;
    return uwl_void();
}

/* ud: NULL → succeed; otherwise fail with that message (or uwl_err(NULL) for "") */
static uwl_val_t cb_ping(const uwl_val_t *a, size_t n, void *ud) {
    (void)a; (void)n;
    if (!ud) return uwl_void();
    const char *msg = (const char *)ud;
    return uwl_err(*msg ? msg : NULL);
}

static uwl_val_t add_err(const uwl_val_t *a, size_t n, void *ud) {
    (void)a; (void)n; (void)ud;
    return uwl_err("adder offline");
}

static void test_callback_failure(void) {
    printf("C39 — a host callback fails with uwl_err, void imports included\n");
    const char *w = "tests/void_imports.wasm", *wit = "tests/void_imports.wit";
    FILE *f = fopen(w, "wb");
    int wrote = f && fwrite(VOID_IMPORTS_WASM, 1, sizeof(VOID_IMPORTS_WASM), f) == sizeof(VOID_IMPORTS_WASM);
    if (f) fclose(f);
    wrote = wrote && write_text(wit, "world w {\n  import ping: func();\n  import after: func();\n"
                                     "  export run: func() -> s32;\n}\n");
    CHECK(wrote, "write the void-import module and its .wit");

    static const char *cases[] = { NULL, "disk full", "" };
    for (int i = 0; i < 3; i++) {
        uwl_host_callback_t cbs[2] = { { "ping", cb_ping, (void *)cases[i] }, { "after", cb_after, NULL } };
        uwl_module_t *m = load("void_imports.wasm", cbs, 2);
        if (!m) { CHECK(0, "void_imports loads"); continue; }
        g_after_calls = 0;
        uwl_val_t out = uwl_void();
        char *err = NULL;
        int rc = uwl_call(m, "run", NULL, 0, &out, &err);
        if (!cases[i]) {
            CHECK(rc == 0 && uwl_as_i32(out) == 42 && g_after_calls == 1,
                  "void import succeeding: run()==42, the WASM ran on to 'after'");
        } else if (*cases[i]) {
            CHECK(rc != 0 && has(err, "host callback ping") && has(err, "failed: disk full"),
                  "void import returning uwl_err(\"disk full\"): run fails with that message");
            CHECK(g_after_calls == 0, "  ...and the WASM stopped at the import ('after' never ran)");
        } else {
            CHECK(rc != 0 && has(err, "failed: (no message)"), "uwl_err(NULL): fails with \"(no message)\"");
        }
        if (rc != 0 && cases[i] && *cases[i] && !has(err, "disk full")) printf("    -> %s\n", err ? err : "?");
        uwl_val_free(&out);
        uwl_string_free(err);
        uwl_free(m);
    }
    remove(w); remove(wit);

    /* A result import failing: its own message, not "returned …; expected s32". */
    uwl_host_callback_t cbs[2] = { { "envMul", mul_ok, NULL }, { "envAdd", add_err, NULL } };
    uwl_module_t *m = load("imports_50.wasm", cbs, 2);
    if (m) {
        uwl_val_t a[2] = { uwl_i32(10), uwl_i32(7) }, out = uwl_void();
        char *err = NULL;
        int rc = uwl_call(m, "combine", a, 2, &out, &err);
        CHECK(rc != 0 && has(err, "host callback envAdd") && has(err, "failed: adder offline") && !has(err, "expected"),
              "result import returning uwl_err: fails with the callback's message");
        uwl_string_free(err);
        uwl_val_t e = uwl_err("x");
        CHECK(e.kind == UWL_ERR && e.str && strcmp(e.str, "x") == 0, "uwl_err(\"x\") is kind UWL_ERR owning \"x\"");
        err = NULL;
        rc = uwl_call(m, "combine", (uwl_val_t[]){ e, uwl_i32(7) }, 2, &out, &err);
        CHECK(rc != 0 && has(err, "parameter 'a'") && has(err, "got error"), "uwl_err is refused as an argument");
        uwl_string_free(err);
        uwl_val_free(&e);
        CHECK(e.kind == UWL_VOID && e.str == NULL, "uwl_val_free frees an error value and resets it");
        uwl_free(m);
    } else CHECK(0, "imports_50 loads");
}

static void test_singleton(void) {
    printf("singleton — caches one instance\n");
    uwl_singleton_t *s = uwl_singleton_new(FX("math_50.wasm"), NULL, 0);
    CHECK(s != NULL, "singleton_new");
    char *err = NULL;
    uwl_module_t *a = uwl_singleton_get(s, &err);
    uwl_module_t *b = uwl_singleton_get(s, &err);
    CHECK(a != NULL && a == b, "two get() calls return the same instance");
    if (a) CHECK(uwl_call_i32(a, "add", 3, 4) == 7, "singleton add(3,4)==7");
    uwl_singleton_free(s);
}

static void test_pool(void) {
    printf("pool — independent instances\n");
    char *err = NULL;
    uwl_pool_t *p = uwl_pool_new(FX("math_50.wasm"), NULL, 0, 2, &err);
    CHECK(p != NULL, "pool_new(size=2)");
    if (!p) { printf("  %s\n", err ? err : "?"); uwl_string_free(err); return; }
    CHECK(uwl_pool_size(p) == 2, "pool size==2");
    CHECK(uwl_pool_available(p) == 2, "pool available==2");

    uwl_module_t *a = uwl_pool_acquire(p, &err);
    uwl_module_t *b = uwl_pool_acquire(p, &err);
    CHECK(a && b && a != b, "two concurrent acquires give distinct instances");
    CHECK(uwl_pool_available(p) == 0, "pool available==0 after 2 acquires");
    if (a) CHECK(uwl_call_i32(a, "add", 20, 1) == 21, "pooled add(20,1)==21");
    uwl_pool_release(p, a);
    uwl_pool_release(p, b);
    CHECK(uwl_pool_available(p) == 2, "pool available==2 after release");
    uwl_pool_free(p);
}

static void test_version(void) {
    printf("version pinning — missing version global rejected\n");
    char *err = NULL;
    uwl_module_t *m = uwl_import(FX("math_50.wasm@9"), NULL, 0, &err);
    CHECK(m == NULL, "@9 on a module with no version global fails");
    if (m) uwl_free(m); else uwl_string_free(err);
}

int main(void) {
    test_math();
    test_booleans();
    test_strings();
    test_imports();
    test_initialize();
    test_wasi_io();
    test_result_kinds();
    test_wit_absent_vs_failed();
    test_wit_parsing();
    test_import_refusals();
    test_typed_args();
    test_callback_failure();
    test_singleton();
    test_pool();
    test_version();
    printf("\n%d passed, %d failed\n", g_pass, g_fail);
    return g_fail == 0 ? 0 : 1;
}
