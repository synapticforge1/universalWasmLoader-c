# overview — universalWasmLoader-c

## What this is

`universalWasmLoader-c` is the **C / header-only** port of the Universal WASM Loader family. It is
the cross-language sibling of the reference TypeScript/JavaScript loader (`universalWasmLoader`) and
the Rust/Python ports. Its job is to let C — and, via the C ABI, **Zig / V / Julia** consumers —
load and call `.wasm` reactor/library modules (produced by `wasmtk`, e.g. from TypeScript via
`wasic`/`modc`) with Canonical-ABI marshalling handled for them, the same way the JS loader does in
its ecosystem.

- **Language / runtime:** C (C11), built on the **wasmtime C API** (`wasm.h` / `wasmtime.h` /
  `wasi.h`) as the underlying WASM engine.
- **Intended consumers:** C, C++, **Zig, V, Julia** (any language that can call a C header / link a
  C library). The header-only form is specifically aimed at those header-friendly consumers.
- **Distribution:** **header-only** — a single STB-style header, `universal_wasm_loader.h`. Declarations
  are always visible; the implementation is compiled into exactly one TU that does
  `#define UWL_IMPLEMENTATION` before including. Consumers link against the wasmtime C API library.

## Repository location — moved to the `synapticforge1` org (recorded 2026-10-20)

- **Canonical home:** `https://github.com/synapticforge1/universalWasmLoader-c` (an organization
  under the owner's control). Formerly `https://github.com/jrmarcum/universalWasmLoader-c`; GitHub
  redirects the old path, but a redirect is not a contract — new references use the org path.
- **The JSR package scope is a separate namespace and did NOT move:** the reference loader is still
  `@jrmarcum/universal-wasm-loader` on jsr.io; sibling repos (e.g. `wasmtk`) were not part of this move.
- **References repointed 2026-10-20** as **1.1.0 port-version 2** (header unchanged, so no version
  bump): port `homepage`, the portfile's raw-github header + LICENSE URLs (verified to resolve at
  `v1.1.0` under the org and to match the existing sha512 pins), and `docs/vcpkg.md`. `versions/`
  hand-updated (git-tree `f2df1575…`, baseline port-version 2). Local `origin` remote set to the org
  URL. Consumers' `vcpkg-configuration.json` registry `repository` should use the org URL, with a
  baseline at or after the `registry: … port-version 2` commit once it is pushed.

## Current state — v2.0.0

The header-only loader is implemented and passes the full reference suite. Released tags: `v1.0.0`
(`4da2c0b`, 2026-06-17), `v1.1.0` (`3aea7bd`, 2026-06-24; adds the convenience call layer; vcpkg
port-version 2 since 2026-10-20), `v1.1.1` (2026-10-26, owner: "bump and push"): the header is
byte-identical to 1.1.0 (same sha512 pins); the release carries the workspace reference fixtures
and the 34-assertion suite (SPEC §10 tested); first release through `make bump` (floor patch,
v1.1.0's tests green). `v1.1.2` (2026-11-07, owner: "push and release"): the H29 / S8 fix — typed
accessors fail on a result-kind mismatch instead of reading the wrong union member; new header
sha512 (recomputed by `bump` from the committed blob and re-derived independently); 43 assertions;
floor patch vs v1.1.1, v1.1.1's 34 tests green. **`v2.0.0`** (2026-11-07, owner: "release
2.0.0"): SPEC 4.0.0 (C29; see § SPEC 4.0.0 below), a major. `make bump KIND=major` gave floor
major; the header sha512 was re-derived independently; `release: 2.0.0` `921b96b`; registry
`126d361` (git-tree `1b38345e…`, baseline 2.0.0). Served header and LICENSE = pins. The first
tag run was RED because of a self-test script bug, not the release. The fix is `56217b6`, and the
tag was MOVED there on the owner's word (release files identical). Run `42398823979` was all green,
installs on three triplets included (compat-gate.md § First tagged run). Working tree:

- `universal_wasm_loader.h` — the single-header library (public API + `UWL_IMPLEMENTATION` body).
- `tests/spec_tests.c` — the SPEC §8 reference suite (84 assertions since 2026-11-07, C29; 93
  since 2026-11-08, C39).
- `tests/*.wasm` + `tests/*.wit` + `tests/init_check.{wat,wasm}` + `tests/fixtures.json` — the
  workspace reference set, copied unmodified from loader-js on 2026-10-26 (stamp: wasmtk
  `4a5c3cf668d`; see Tests). `spec_tests.c` exercises `math_50`, `booleans_50`, `strings_50`,
  `imports_50`, and (since 2026-10-26) `wasi_io_50` and `init_check` (SPEC §10). Until
  2026-10-26 the four `*_50` came from the `-rs` port (2026-06) and their `.wasm` bytes differed.
- `Makefile` — `make fetch` (download the wasmtime C API SDK into `vendor/`), `make test` (build +
  run), `make clean`. Override `CC` / `WASMTIME_VERSION` / `WASMTIME_PLATFORM` / `WASMTIME_LINK`.
- `scripts/fetch-wasmtime.ts` — **Bun** script (ported from `fetch-wasmtime.sh` 2026-10-22; see
  [working-rules.md](working-rules.md)) that downloads + extracts the wasmtime C API release artifact
  into `vendor/`. Windows platforms (`*-windows`, `*-mingw`) are `.zip`; Linux/macOS are `.tar.xz`.
  The old bash script always requested `.zip`, so its documented `x86_64-linux` / `*-macos` platforms
  404'd; the port fixes that (verified 2026-10-22: `x86_64-windows` zip, `x86_64-linux` tar.xz, and a
  bogus platform failing fast with a 404 instead of retrying).
- `vendor/` — the wasmtime C API SDK (headers + `libwasmtime.a` / import lib). **gitignored**;
  fetched on demand, not committed.

Build environment used for v1: MinGW-w64 gcc + wasmtime C API **v45.0.2** `x86_64-mingw`, static link.
Default compiler since 2026-10-22: **`zig cc`** (see Build / release flow).

## Public API surface (implemented)

Idiomatic C equivalents of the reference loader's API. All in `universal_wasm_loader.h`.

- **`uwl_val_t`** — tagged-union value (`UWL_VOID/I32/I64/F32/F64/BOOL/STR`) with constructors
  (`uwl_i32`, `uwl_f64`, `uwl_bool`, `uwl_str`, `uwl_strn`, …) and accessors (`uwl_as_i32`,
  `uwl_as_str`, …). Owned string values/results are freed with `uwl_val_free`.
- **`uwl_import(path, callbacks, ncallbacks, &err)`** → `uwl_module_t*` — the core entry point
  (the synchronous C analog of `wasmImport`; C has no promises). Reads the `.wasm`, auto-detects the
  companion `.wit`, applies the Canonical ABI, instantiates, calls `_initialize` if present, and
  enforces `@N` version pinning. On failure returns `NULL` with a heap `*err` (free with
  `uwl_string_free`).
- **`uwl_call(m, name, args, nargs, &out, &err)`** → 0/-1 — invoke an export by its camelCase WIT
  name (or raw WASM name when no `.wit`). The low-level call: explicit `uwl_val_t` args + out-param;
  the escape hatch for raw (no-`.wit`) modules and callers wanting per-call `err`.
- **Convenience call layer (added 2026-06-19)** — typed variadic wrappers
  `uwl_call_i32/_i64/_f32/_f64/_bool/_str/_void(m, name, ...)` that read **native C args** per the
  export's parsed WIT signature (varargs decoded by `uwl_wt_t`: STR→`const char*`, BOOL→`int`,
  F32→`double`→`float`, F64→`double`, S64→`int64_t`, S32→`int32_t`) and return a native C value — the
  C analog of the JS loader's `m.add(3,4)`. `uwl_call_str` returns an owned heap string (free with
  `uwl_string_free`). Errors are NOT out-params: on failure they return `0`/`NULL` and set a
  **thread-local** last-error read via **`uwl_last_error()`** (loader-owned, cleared on next success;
  TLS via `__thread`/`__declspec(thread)`). **Require a companion `.wit`** (source of the per-arg
  types) — no-`.wit` modules must use `uwl_call`. Implemented as thin wrappers over `uwl_call` (shared
  core `uwl__call_va`); the reference suite (`spec_tests.c`) was rewritten onto them, replacing the
  hand-rolled `call_i32/f64/bool/str_eq` helpers — still **29/29**.
- **`uwl_free(m)`**.
- **Singleton (DLL pattern):** `uwl_singleton_new` / `uwl_singleton_get` (loads once, caches) /
  `uwl_singleton_free`.
- **`InstancePool` (server/loop pattern):** `uwl_pool_new(size)` / `uwl_pool_acquire` /
  `uwl_pool_release` / `uwl_pool_size` / `uwl_pool_available` / `uwl_pool_free`. The C pool is **not
  internally synchronized** (single-threaded model; caller guards concurrency) — documented in the
  header; sufficient for the SPEC scenario (size=2, two acquires distinct, release restores).

### Host import callbacks

`uwl_host_callback_t { const char *name; uwl_host_fn_t fn; void *userdata; }` keyed by camelCase WIT
import name (e.g. `"envMul"`). Imports are defined into a `wasmtime_linker_t` under the `env`
namespace using the underscore form of the WIT name (`env-mul` → `env_mul`). A single trampoline
(`uwl__import_trampoline`) decodes args (strings read from caller memory via
`wasmtime_caller_export_get("memory")`), calls the user fn, checks and encodes the result. Imports
the `.wit` does not declare (WASI aside), and every import of a raw module, are bound to traps
(`wasmtime_linker_define_unknown_imports_as_traps`), so those modules still instantiate.

### A host callback can fail: `uwl_err` (workspace C39 from loader-v, 2026-11-08, on `main`, unreleased)

Before this, `uwl_host_fn_t` could only return a value. A result import could fail only by
returning a wrong kind, which traps with a misleading "returned no value (void); expected …". A
VOID import ignored the value, so the WASM ran on after a failed callback. SPEC 4.0.0 § 4 has a
callback's failure reach the export's caller. Now a callback returns **`uwl_err(msg)`**, a new
kind **`UWL_ERR`** appended to `uwl_kind_t` (= 7) whose `str` owns the message. The trampoline
checks it BEFORE the kind check and traps with `host callback <camel> (WIT import "<kebab>")
failed: <msg>`, for every import. `uwl_err(NULL)` gives "(no message)"; `uwl_val_free` frees it;
`uwl_call` refuses it as an argument (`got error`). It is an addition to the surface (one
function, one appended constant) → a MINOR, 2.1.0. Ports that vendor the header (-v, -zig) take
it at their next re-vendor.
Tested by `test_callback_failure` (9 checks). It writes a hand-assembled 99-byte module (`run`
calls the void imports `ping` then `after`, returns 42) beside a `.wit`, then removes both; no
reference fixture has a void import, and the fixtures are -js's, so none is added. Inverted: the
trampoline check disabled on a scratch header → 89 / 4, exactly the four failure-path checks.

### SPEC 4.0.0 "loud failures" (workspace C29, released in 2.0.0)

The owner decided H29's open questions as SPEC 4.0.0 (`-js/SPEC.md`, released with loader-js
2.0.0). What this header now does, with the 1.1.2 behaviour it replaces (measured for H29):

- **§2, only an absent `.wit` is raw.** The `.wit` is read FIRST. `ENOENT` → raw; a path not ending
  in `.wasm` has no companion (1.1.2 looked for `<path>.wit`). Any other read failure fails the load
  (`cannot read .wit '…': <strerror>`). Reads go in chunks, not via `ftell`, so a directory fails
  on Linux too (`fopen` succeeds there, `fread` fails `EISDIR`); on Windows `fopen` gives `EACCES`.
  1.1.2: every read failure → raw, silently.
- **§2, strict parsing.** `uwl__parse_wit` is a port of -js `wit-parser.js` with the same messages
  (`invalid .wit '<path>': malformed parameter …`, `unsupported WIT type "u32" …`,
  `duplicate export add`, `unterminated WIT statement (missing ";")`, `not a WIT world: …`). After
  instantiation, a WIT export the module lacks fails the load, as it does in -js (`… does not export:
  nope (WIT "nope")`). 1.1.2: a lenient `strstr` scan; an unknown type read as `s32`, a malformed
  parameter dropped, garbage → an empty world → raw mode.
- **§4, every WIT import needs a callback.** `uwl__bind_imports` runs before the `.wasm` is read and
  names every missing one; an entry with a `NULL` fn counts as missing. A `string`-result import is
  refused there too. 1.1.2: S9, the trampoline returned `uwl_void()` → 0, silently.
- **§4, the callback's return kind.** It must be the WIT result's kind exactly. Otherwise the
  trampoline returns a `wasmtime_trap_new` naming the callback, the import, the result type and the
  value, which reaches the `uwl_call` of the export. A void import ignores the value. A string
  argument with no memory, or out of bounds, traps too (1.1.2 passed `""`). 1.1.2 read the union as
  the wrong member: a `uwl_f64(2.9)` for an `s32` result gave the double's low bits.
- **§4, typed-call arguments.** `uwl_call` with a `.wit` checks each `args[i].kind` against the
  parameter and refuses a NULL string, naming the export and the parameter (names are now kept:
  `uwl_witfunc_t.pnames`). The convenience calls read varargs by the WIT type, so a kind mismatch
  cannot be detected there (C varargs carry no type), but a NULL `const char *` is refused. 1.1.2
  read the wrong union member.
- **§4, the result-kind accessors:** already done in 1.1.2 (`83fbeda`, below). `uwl_call_void`
  still discards any result, because it returns no value that could be mistaken for one.
- **§11, the time limit and cancellation: not applicable.** The header reads local files only (no
  http path), and §11 applies only to http(s) fetches. So there is no `options` parameter, and the
  public surface keeps its 52 symbols. Revisit if URL loading is ever added.

Inverted: the new suite (84) on the 1.1.2 header → **45 passed, 39 failed**, exactly the new
negative checks. The two new checks still green there are `add(1)` (1.1.2 already checked the
count) and the accepted-forms check (comments / `package` / CRLF / trailing comma). It is a MAJOR
for this port: each item refuses input 1.x accepted. `compat` on the behaviour commit alone says
floor patch, because v1.1.2's tests are all conformant input; the SPEC line in the header moves the
floor to major.

### Typed accessors check the result kind (H29 / S8, fixed 2026-11-07)

`uwl_call_i32/_i64/_f32/_f64/_bool` go through `uwl__call_expect`: a result kind that differs from
the accessor's is an error (`export 'multiply' returns f64, not s32`; sentinel + last error).
Before, the union was read as the wrong member, silently: measured on math_50, `call_i32(multiply,
2.5, 4.0)` → 0, `call_f64(add, 3, 4)` → -1.16e-68, `call_bool(add, 3, 4)` → 7, all with NO error
(`call_str` already errored). `uwl_call_void` still discards any result. Raw mode was already right:
args carry their own kinds and wasmtime refuses a mismatch (`argument type mismatch … expected f64,
found i32`); results decode by the wasm valkind (raw `multiply(2.5, 4.0)` → 10.0).

## Canonical ABI / SPEC conformance status — CONFORMANT to SPEC 4.0.0 (`c7cc259` + `e97218f`; released as v2.0.0; v1.x: 3.0.0)

SPEC 4.0.0's additions are in § SPEC 4.0.0 "loud failures" above; the 3.0.0 ABI below is
unchanged by it.

- **String PARAMS:** `cabi_realloc(0,0,1,len)` → write UTF-8 bytes into linear memory → pass
  `(ptr,len)` as two i32 args. (Implemented fresh; no deprecated form.)
- **String RETURNS (callee-allocated, the v3.0.0 breaking change):** the export returns an **i32
  pointer** to a callee-allocated `[ptr,len]` pair; the loader reads both little-endian i32s from
  memory, decodes (copies) the bytes, then calls the paired **`cabi_post_<camelName>(retArea)`**
  export to release the buffer (no-op under wasic's bump allocator, but the contract is honored).
- **Numerics/bool:** direct; bool encoded `?1:0`, decoded `!=0`.
- **§10 reactor + WASI:** calls `_initialize` once after instantiation if present; configures a
  wasmtime WASI context (`wasmtime_context_set_wasi`, stdout/stderr inherited) and
  `wasmtime_linker_define_wasi` so I/O-using libraries instantiate. Pure-compute modules ignore it.

## Tests

`make test` → builds `tests/spec_tests.c` and runs it: **93 passed, 0 failed** (29 until
2026-10-26, 34 and then 43 on 2026-11-07, 84 since C29 the same day, 93 since C39 on 2026-11-08;
see § A host callback can fail). The C29 tests are SPEC §8
"Refusals" as they apply to C: `test_wit_absent_vs_failed` (a path with no `.wasm` suffix → raw;
a `.wit` that is a directory → refused; a bad `.wit` with no `.wasm` → the `.wit`'s fault, so it is
read first), `test_wit_parsing` (ten malformed `.wit` beside a copy of `math_50.wasm`, each refused
naming the `.wit` and the fault, plus one accepted form), `test_import_refusals` (no / partial /
NULL-fn callbacks; a `string`-result import; `envAdd` returning void, f64, bool, string, s64), and
`test_typed_args` (seven wrong-kind / wrong-count `uwl_call`s, and `call_str(greet, NULL)`). They
write scratch files into `tests/` and remove them. Not ported from -js: async callbacks (C has
none) and the http rows (no http path). `test_result_kinds` (H29 / S8, 9 checks): raw `multiply` on a
`.wit`-less copy (`tests/raw_math_50.wasm`, written and removed by the test) → 10.0, i32 args
refused; four typed accessors on the wrong kind → sentinel + last error; a matching call clears
it. Inverted: the same tests on the pre-fix header → 40 passed, 3 failed (exactly the
`call_i32` / `call_f64` / `call_bool` mismatch checks). Covers all four `*_50` fixtures, SPEC §10 (`init_check`: `getValue()==99` through the
raw `uwl_call` path proves `_initialize` ran; `wasi_io_50`: `logAndDouble(21)==42` proves the WASI
context satisfied `fd_write` — the module's own `doubling` line appears on stdout), plus singleton,
pool, and version-pin-rejected scenarios. Both §10 tests were inverted 2026-10-26 on a scratch
copy of the header: `_initialize` never looked up → only `getValue()==99` fails; WASI not defined in
the linker → only `logAndDouble(21)==42` fails (33/34 each). ⚠️ Without WASI the module still LOADS
(unknown imports are bound to traps) and the CALL traps, so the result is the evidence, not the
load. **The fixtures ARE the
reference set** (H7, 2026-10-26): copied unmodified from loader-js `tests/` at its `36aa661`
(stamp `tests/fixtures.json`: wasmtk `4a5c3cf668d`, `synapticforge1/wasmtk`); all 12 sha256 in
`files` verified; the four `*_50.wasm` changed from the 2026-06 copies, the `.wit` did not.
`make clean test` → 29/29 on them (zig cc, 2026-10-26); inverted by truncating `math_50.wasm` to
20 bytes → 16 passed, 3 failed, then restored. To refresh: copy the same files again from -js and
re-verify; never edit them here.

## Build / release flow

- **Local:** `make fetch` then `make test` (needs **Bun**, `unzip` or `tar`, **Zig**, `make`).
- **Default compiler is `zig cc` (owner, 2026-10-22).** GNU make predefines `CC=cc`, so `CC ?= …`
  never applies; the Makefile sets `CC = zig cc` only when `$(origin CC)` is `default`, so
  `make CC=gcc …` still overrides. (The old `cc` default could fail outright on a host with no
  `cc`; machine specifics are in the gitignored `local/environment.md`.)
- **`zig cc` needs `-lunwind`.** `libwasmtime.a` contains Rust std built against libgcc's unwinder
  (`_Unwind_*`, and `_GCC_specific_handler` on mingw). gcc links that implicitly; zig cc does not, so
  the link fails with ~9 undefined `_Unwind_*` symbols. The Makefile appends `-lunwind` (Zig's bundled
  LLVM libunwind, which provides them) to `SYSLIBS` whenever `CC` contains `zig`, **except on macOS**
  (`UNAME_S=Darwin`), where libSystem already carries the unwinder. Verified 2026-10-22 by
  cross-linking with zig cc (link only, not run): `x86_64-linux-gnu` fails without `-lunwind` and
  links with it; `aarch64-macos` and `x86_64-macos` link either way, so macOS keeps the system
  unwinder rather than a second copy. A native macOS run is still unverified.
- **A plain `make test` can report 29/29 from a stale `tests/spec_tests.exe`** without compiling
  anything; use `make clean test` when the result is meant as evidence. Verified 2026-10-22 (zig
  0.16.0, wasmtime 45.0.2 `x86_64-mingw`, static): `make clean test` (zig cc) → 29/29, and
  `make CC=gcc clean test` → 29/29.
- **Releasing (2026-10-22):** `make bump KIND=patch|minor|major` — gated by the surface floor and the
  previous tag's tests; see [compat-gate.md](compat-gate.md) and `docs/vcpkg.md` § 0 / § 4.
- **Toolchain note (MinGW static link):** `wasi.h` decorates every `_WIN32` symbol
  `__declspec(dllimport)` unless `WASI_API_EXTERN` is pre-defined (unlike `wasm.h`, which already
  exempts MinGW). The header pre-defines `WASI_API_EXTERN` to plain `extern` for `__MINGW32__` /
  `LIBWASM_STATIC` builds so the `wasi_config_*` symbols resolve against `libwasmtime.a`. Without it,
  static MinGW links fail with `undefined reference to __imp_wasi_config_*`.
- **Distribution — vcpkg (owner decision 2026-06-15), AUTHORED 2026-06-17:** the repo doubles as a
  vcpkg **git registry**. `ports/universal-wasm-loader-c/` holds `vcpkg.json` (1.1.0 port-version 2
  as of 2026-10-20; license `MIT AND Apache-2.0 WITH LLVM-exception`, the second covering the bundled
  wasmtime) +
  `portfile.cmake` + `universal-wasm-loader-c-config.cmake.in` + `usage`. The portfile downloads the
  loader header (raw github at tag `v<version>`, pinned by sha512) AND the matching **wasmtime C API
  artifact per triplet** (no `wasmtime` port exists in vcpkg — it's prebuilt GitHub releases), installs
  both headers + the wasmtime lib (release+debug copies), and emits a CMake config exposing INTERFACE
  target `unofficial::universal-wasm-loader-c` wired with the wasmtime lib + platform syslibs.
  Supported triplets: x64-windows(+static), x64-mingw-(dynamic|static), x64/arm64-linux, x64/arm64-osx
  (real sha512 captured for each wasmtime artifact, v45.0.2). Consumer example in
  `examples/cmake-consumer/`; setup guide in `docs/vcpkg.md`. **VALIDATED 2026-06-17** end-to-end on
  `x64-mingw-dynamic`: `vcpkg install` (overlay port; `downloads/` pre-seeded with the exact header /
  LICENSE / wasmtime files so it validates offline before the tag exists) passed post-build validation
  (MIT detected); the consumer example built via `find_package` + `unofficial::universal-wasm-loader-c`
  and ran `add(3,4)=7`. Two portfile bugs fixed during validation: (1) `;`-separated commands on one
  line are a CMake parse error → split to separate lines; (2) dropped the unused `vcpkg-cmake-config`
  host dep (config is hand-written via `configure_file`), which had forced an MSVC host build. Real
  (non-seeded) installs need the `v<version>` tag on GitHub so the raw-github header/LICENSE
  downloads resolve — `v1.0.0` and `v1.1.0` exist, and real installs were validated 2026-10-20 (see
  Known gaps). `versions/` is regenerated to the port tree via `vcpkg x-add-version`. See the
  ecosystem publishing matrix in wasmtk `cmem/vision.md`.

## Known gaps / not yet done

- **Host import callbacks returning `string`** are not supported (would require allocating into WASM
  memory from the trampoline; no fixture needs it). Since C29 such an import is REFUSED at load
  (SPEC 4.0.0 §4), not silently mis-encoded. Numeric/bool import returns work.
- **URL loading** (the JS/`-rs` `http(s)://` path) is not implemented — file paths only. Adding it
  would bring SPEC §11 (time limit, cancellation, one request per file) and an `options` parameter.
- **C++ compiling of the implementation is checked by hand only.** Until 2026-11-07 the
  `UWL_IMPLEMENTATION` unit did not compile as C++ (measured with `zig c++ -fsyntax-only` on the
  1.1.2 header: 3 errors, each a `goto fail` in `uwl_import` that crosses an initialised
  declaration), although the header names C++ consumers. Fixed with C29: declarations come before
  the first `goto`. The same check is now clean, with `-Wall -Wextra` and no diagnostics from the
  header. Zig's own `-fsyntax-only` cache-rename noise is unrelated. No test or CI step compiles it
  as C++; add one to `make test` if it regresses.
- **Thread-safe pool** (blocking acquire) — the C pool is single-threaded; a future revision could
  add mutex/condvar gating behind a compile flag.
- **vcpkg port** validated locally on `x64-mingw-dynamic` (2026-06-17). CI (`.github/workflows/vcpkg-release.yml`)
  runs `validate` on every push/PR and real overlay-port installs on tags or manual dispatch. **Install
  VALIDATED 2026-10-20** (dispatch run `39518063717`, 1.1.0 port-version 2, downloads from the
  `synapticforge1` org URLs) on `x64-linux`, `x64-windows` (MSVC) and `arm64-osx`; again for
  **1.1.1** on the tag push, 2026-10-26 (run `40382759953`, same three triplets, green), and for
  **1.1.2**, 2026-11-07 (run `42391904762`, green), and for **2.0.0**, 2026-11-07 (run
  `42398823979`, green). Not yet
  install-tested: `x64-windows-static`, `x64-mingw-static`, `arm64-linux`, `x64-osx`.
- **CI never runs the CURRENT C suite.** `vcpkg-release.yml` is the only workflow; on a push to
  `main` it runs `validate` (port files, surface check, gate self-test) only. On a tag, `compat`
  builds and runs the PREVIOUS tag's tests against the new header on Linux: first run 2026-10-26
  (run `40382759953`, `v1.1.1`: all jobs green, so `make fetch` + `zig cc` + a suite now pass
  natively on x86_64-linux — v1.1.0's 29 tests). The current 84 assertions (incl. SPEC §10 and the 4.0.0 refusals) are
  verified only locally (x86_64-mingw). A native macOS build/run has never happened (link-only
  cross-checks; the `arm64-osx` install job builds the consumer example, it runs no suite). Fix: a
  `make fetch` + `make clean test` job on Linux/macOS/Windows.
- **The gate scripts are never type-checked.** Workspace § The gate (2026-10-22): a test task that
  skips type-checking is not a gate, and Bun never type-checks. `scripts/*.ts` run under Bun only.
  Owner, 2026-10-22: RECORD, do not add yet — a `tsc --noEmit` check would need `typescript` +
  Bun's types (a `package.json` in a C repo). Revisit if a script bug slips past the self-test.

## Workspace letters — status for this repo (2026-11-07)

From the workspace ledger `../../../cmem/workspace-correspondence.md` (read first since 2026-10-26)
and the letters in `../../../cmem/handoffs.md`; the workspace sweep reads this section.

- **H15 (Bun scripting)** — done: `5fad372` (bash → Bun fetch script), `f1e14d1` (local rules
  trimmed to the workspace floor).
- **L2 (cut tracked `CLAUDE.md` to a pointer)** — done: `e189da8` (archive: `git show 1057d89:CLAUDE.md`).
- **H7 / C11 (reference fixtures)** — done 2026-10-26: the stamped set copied from loader-js
  `36aa661` (wasmtk `4a5c3cf668d`; history `f50c8e4` → `84b3e180eba` → `4a5c3cf668d`, wasmtk's
  maps), 12/12 sha256, 29/29, inverted (see Tests). Asked of loader-js by letter **C13**
  ([handoffs.md](handoffs.md)), verified and closed the same day. `wasi_io_50` and `init_check`
  exercised by `spec_tests.c` the same day (34/34, both inverted; see Tests) — H7 fully done here.
- **H17 part 3 (stale `jrmarcum/wasmtk` link)** — done 2026-10-26: `README.md:4` →
  `synapticforge1/wasmtk`.
- **H22 / H25 §3(d) (path test)** — recorded 2026-10-26 in [working-rules.md](working-rules.md).
  Scan at HEAD with binaries (`git grep -a`): no drive path.
- **H24 / H27 (★ re-copy, new stamp)** — done 2026-10-26: rule 5.2 re-copied, stamp now
  `Copied from synapticforge1/cmem/best-practices.md on 2026-10-26`; text check 0 differences
  ([best-practices.md](best-practices.md) § ★), including ★ 6.1's corrected id (C8).
- **H29 (three behaviour checks, S8 / S9 / S10)** — answered 2026-11-07: S8's typed-accessor
  defect FIXED (see § Typed accessors check the result kind), raw mode already correct; S9 and the
  `.wit` fallback measured and recorded, not changed (owner / -js); S10's HTTP half n/a (no HTTP
  path). Fix `83fbeda`, released in **1.1.2** (2026-11-07). S9 and the `.wit` fallback were then
  decided as SPEC 4.0.0 and carried here by C29.
- **C29 (re-align to SPEC 4.0.0; from loader-js)** — done 2026-11-07 (see § SPEC 4.0.0): items
  (1) to (4) done, (5) n/a (no http). **Released as 2.0.0** the same day (tag `v2.0.0` →
  `56217b6` after the owner-approved re-tag; CI run `42398823979` green). Answered in the ledger; loader-js verifies and closes.
- **C39 (a host callback needs a way to fail; from loader-v)** — done 2026-11-08 on `main`,
  unreleased: `uwl_err` / `UWL_ERR` (see § A host callback can fail). Minor → 2.1.0 at the owner's
  release. Answered in the ledger; loader-v verifies and closes.
- **C30 / C34 (release-workflow hazards; from S3D-ReportCompiler, record-only)** — read
  2026-11-08 (reasoned, not measured). Neither applies as written: `vcpkg-release.yml` has no
  `id-token`, uses no secret, and publishes to no registry (the tag is the release, which a person
  pushes). It has no `permissions:` block either, so its `GITHUB_TOKEN` gets the repo's default
  scope, and its `uses:` are tag-pinned (`@v4`, `@v2`). Not changed; a `permissions: contents:
  read` line would narrow the token, and that is the owner's call.
- **H28 (maintainer address in one `cmem/` note; wabt-ts / binaryen-ts retired)** — record-only,
  nothing to change: this repo's history and commits use noreply (H19), it carries no contact note,
  and no tracked file cites either retired repo (★ rule tags name them as origins, not locations).
- **H16 (`.git` growth)** — applied 2026-10-22 with the owner's OK (gc, fsck clean,
  `maintenance.strategy gc`, 1 pack); details in the gitignored `local/environment.md`.
- **H18 (personal drive paths)** — not addressed here, but the scan pattern found the old
  `.vscode/settings.json` path; fixed in `99a4bbb`, untracked in `bc3666f`.
- **H19 (purge personal information from history)** — done 2026-10-22 with the owner's go: the
  personal address (all 34 commits + the `v1.0.0` tagger) → GitHub noreply, the `.vscode` path
  removed from every commit (34 → 33), tagged trees byte-identical, force-pushed with leases.
  **Every hash changed** — old → new map for the workspace's citations and for vcpkg registry
  `baseline` pins: [history-purge.md](history-purge.md). The rewritten head was `bc3666f`; the
  record landed in `77cf808` (CI green, run `39823105880`). ⚠️ CI runs from before the rewrite show
  the OLD hashes on GitHub; translate them with the map.
- **For the workspace sweep — drift W7 / layout-and-packaging P5 (org Actions policy):** MEASURED
  2026-10-22: run `39804596951` on `0494969` (GitHub shows its pre-H19 hash `0f9b6e3`) executed
  `oven-sh/setup-bun@v2` in this repo's
  `validate` job and succeeded — the `synapticforge1` org permits third-party `uses:` for this repo.
  (`mlugg/setup-zig@v2` is in the tags-only `compat` job, not yet run.)
- **H6** — done 2026-10-22: ★ copy + § L in `best-practices.md` and the memory-layout audit
  (`e80d838`); the SemVer compatibility gate ([compat-gate.md](compat-gate.md)). Only the CI
  `compat` job first ran on the `v1.1.1` tag, 2026-10-26: green ([compat-gate.md](compat-gate.md)). The ★ copy was re-copied 2026-10-26 (H24 / H27 above).
