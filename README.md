# universalWasmLoader-c

A single-header **C** loader for `.wasm` reactor/library modules produced by
[`wasmtk`](https://github.com/synapticforge1/wasmtk) (e.g. TypeScript compiled via `wasic`/`modc`). It
auto-detects the companion `.wit` file and applies the Canonical ABI, so you call WASM exports with
native C values — the C sibling of the reference JS loader
[`@jrmarcum/universal-wasm-loader`](https://jsr.io/@jrmarcum/universal-wasm-loader). Conforms to the
cross-language **SPEC v4.0.0** (callee-allocated string returns + `cabi_post_<name>`; loud failures,
see [The companion `.wit`](#the-companion-wit) and [Host imports](#host-imports)).

Built on the [wasmtime C API](https://docs.wasmtime.dev/c-api/). Usable from C, C++, and — via the C
ABI — Zig, V, and Julia.

## Quick start

```c
#define UWL_IMPLEMENTATION          // in exactly ONE .c file
#include "universal_wasm_loader.h"

int main(void) {
    char *err = NULL;
    uwl_module_t *m = uwl_import("math_50.wasm", NULL, 0, &err);
    if (!m) { fprintf(stderr, "%s\n", err); uwl_string_free(err); return 1; }

    int r = uwl_call_i32(m, "add", 3, 4);          // 7
    printf("add(3, 4) = %d\n", r);

    uwl_free(m);
    return 0;
}
```

Every other translation unit just `#include "universal_wasm_loader.h"` (no macro). Link against the
wasmtime C API library.

The typed convenience calls (`uwl_call_i32` / `_i64` / `_f32` / `_f64` / `_bool` / `_str` / `_void`)
read native C arguments and return a native C result — the C analog of the reference loader's
`m.add(3, 4)`. Each argument is read with the correct type from the export's WIT signature, so you
pass plain C values. On failure they return `0`/`NULL` and set a thread-local error you read with
`uwl_last_error()`; calling an accessor whose type does not match the export's WIT result (e.g.
`uwl_call_i32` on an `f64` export) is such a failure, so check `uwl_last_error()` to tell a real `0`
from an error. They require a companion `.wit`; for raw modules use the lower-level
`uwl_call(m, name, args, nargs, &out, &err)` with explicit `uwl_val_t` values (see
[API reference](#api-reference)). With a `.wit`, `uwl_call` checks the argument count and each
argument's kind against the WIT signature and coerces nothing: `uwl_i32(2)` for an `f64` parameter
is an error naming the export and the parameter, not `2.0`.

## The companion `.wit`

`uwl_import("dir/mod.wasm", …)` reads `dir/mod.wit` **before** the `.wasm`:

- **Absent** — the file does not exist, or the path does not end in `.wasm` — gives raw exports.
- **Anything else fails the load** with an error naming the `.wit` and the reason: a file that exists
  but cannot be read, and a `.wit` that does not parse. The accepted form is the subset `wasmtk`
  writes (SPEC §2 "Parsing"): an optional `package …;`, one `world name { … }` holding only
  `import` / `export` function statements, `//` comments, and the types `s32` `s64` `f32` `f64`
  `bool` `string`. `u32` is not read as `s32`; a parameter without `name: type`, a duplicate name or
  a missing `;` is an error.
- After instantiation, every WIT `export` must exist in the module, or the load fails naming it.

## Strings

```c
char *g = uwl_call_str(m, "greet", "World");   // "Hello, World!"
printf("%s\n", g);
uwl_string_free(g);                            // free the owned result
```

String parameters are UTF-8-encoded and copied into WASM memory via `cabi_realloc`. String results
follow the SPEC v3.0.0 callee-allocated convention: the loader reads the returned `[ptr, len]` pair,
copies the bytes out, and calls `cabi_post_<name>` to release the module's buffer. `uwl_call_str`
hands you an owned heap string — free it with `uwl_string_free`.

## Host imports

Provide host callbacks (keyed by the **camelCase** WIT import name) for modules that import functions.
**Every WIT import needs one.** A missing callback fails the load, naming all of the missing ones; an
entry with a `NULL` `fn` counts as missing. A WIT import with a `string` result is refused at load too,
because it is not supported.

```c
static uwl_val_t env_mul(const uwl_val_t *a, size_t n, void *ud) {
    return uwl_f64(uwl_as_f64(a[0]) * uwl_as_f64(a[1]));
}
static uwl_val_t env_add(const uwl_val_t *a, size_t n, void *ud) {
    return uwl_i32(uwl_as_i32(a[0]) + uwl_as_i32(a[1]));
}

uwl_host_callback_t cbs[] = { { "envMul", env_mul, NULL }, { "envAdd", env_add, NULL } };
uwl_module_t *m = uwl_import("imports_50.wasm", cbs, 2, &err);

double s = uwl_call_f64(m, "scale", 3.0, 4.0);   // module calls back into envMul
```

Host callbacks still receive and return `uwl_val_t` (the callee side inspects arguments
dynamically); only the export-call side gains the typed convenience wrappers. The returned value must
be the kind of the import's WIT result: `uwl_i32` for `s32`, `uwl_bool` for `bool`, and so on. Nothing
is coerced. Any other kind, including `uwl_void()`, makes the export call that reached the callback
fail, naming the callback, the import, the result type and the value. For an import with no result,
the returned value is ignored.

## Version pinning

Append `@N` to assert the module's exported `version` i32 global equals `N` (the C shared-library
SONAME convention):

```c
uwl_module_t *m = uwl_import("mod.wasm@2", NULL, 0, NULL);  // fails unless version == 2
```

## Lifecycle helpers

**Singleton** (load once, cache — for CLI/bounded use):

```c
uwl_singleton_t *s = uwl_singleton_new("mod.wasm", NULL, 0);
uwl_module_t *m = uwl_singleton_get(s, &err);   // same instance every call
int r = uwl_call_i32(m, "add", 3, 4);
uwl_singleton_free(s);
```

**InstancePool** (independent instances — for servers/loops; extends longevity under wasic's bump
allocator):

```c
uwl_pool_t *p = uwl_pool_new("mod.wasm", NULL, 0, 4, &err);
uwl_module_t *m = uwl_pool_acquire(p, &err);
/* ... use m ... */
uwl_pool_release(p, m);
uwl_pool_free(p);
```

> The C pool is not internally synchronized; in a multithreaded host, guard acquire/release with your
> own lock.

## Building & testing

The loader needs the wasmtime C API SDK (headers + library). The Makefile fetches it into `vendor/`
(gitignored) with `scripts/fetch-wasmtime.ts`, which requires [Bun](https://bun.sh) plus `unzip` or
`tar` (Windows SDKs are `.zip`; Linux/macOS SDKs are `.tar.xz`, extracted with `tar`). Building needs
`make` and, by default, [Zig](https://ziglang.org) (`zig cc`, linked with Zig's bundled `libunwind`,
which wasmtime's static library needs). To use another compiler, pass it explicitly, e.g.
`make CC=gcc test`.

```sh
make fetch        # download the wasmtime C API SDK (override WASMTIME_VERSION / WASMTIME_PLATFORM)
make test         # build and run the reference suite (tests/spec_tests.c)
```

Defaults fetch the Windows MinGW SDK (`x86_64-mingw`) and link statically. For other platforms:

```sh
make fetch WASMTIME_PLATFORM=x86_64-linux
make test  WASMTIME_PLATFORM=x86_64-linux
```

Set `WASMTIME_LINK=shared` to link the import library instead of the static archive (then keep
`wasmtime.dll`/`.so` alongside your binary).

## API reference

See the doc comments in [`universal_wasm_loader.h`](universal_wasm_loader.h). The typed convenience
calls (`uwl_call_i32` etc.) are the recommended path for `.wit`-accompanied modules; the lower-level
`uwl_call` with explicit `uwl_val_t` values is the escape hatch for raw modules and for callers who
want a per-call `err` out-parameter. Memory ownership: string values you build (`uwl_str`/`uwl_strn`)
and string results written to `out` are heap-owned — free them with `uwl_val_free`; the heap string
from `uwl_call_str` and error strings from the `err` out-parameter are freed with `uwl_string_free`.
The string returned by `uwl_last_error()` is owned by the loader — do not free it.

## Install via vcpkg

This repo is a vcpkg registry. With vcpkg configured (see
[`docs/vcpkg.md`](docs/vcpkg.md)):

```cmake
find_package(universal-wasm-loader-c CONFIG REQUIRED)
target_link_libraries(main PRIVATE unofficial::universal-wasm-loader-c)
```

The port downloads the matching wasmtime C API SDK for your triplet and wires
the include path, the wasmtime library, and the platform system libraries into
that one target. See [`docs/vcpkg.md`](docs/vcpkg.md) for registry setup and the
quick overlay-port path.

## Versioning & breaking changes

Releases follow [Semantic Versioning 2.0.0](https://semver.org). The public surface — every
declaration in the header's public section, plus the loader SPEC version it conforms to — is
snapshotted in [`api-surface.json`](api-surface.json), and a release is gated against it: anything
removed or changed requires a major version, anything added at least a minor, and a patch or minor
release must also pass the previous release's test suite unmodified. Removals are deprecated for at
least one minor release first and listed below.

### ⚠️ Breaking Changes

| Version | Change | Migration |
| --- | --- | --- |
| 2.0.0 | SPEC 4.0.0, "loud failures". Each of these loads or calls succeeded on 1.x: (1) a `.wit` that exists but cannot be read, or does not parse, now fails the load instead of giving raw exports; so does a WIT export the module lacks. (2) A path not ending in `.wasm` no longer looks for `<path>.wit`. (3) Every WIT import needs a callback, and a `string`-result import is refused, both at load; before, a missing callback returned `0`. (4) A callback's return kind must match the import's WIT result; before, it was read as the wrong union member. (5) Typed `uwl_call` refuses an argument of the wrong kind (before, it was read as the wrong member), and the convenience calls refuse a `NULL` string (before, it was sent as `""`). | Fix the `.wit`, or delete it to load raw. Pass a callback for every WIT import. Return the WIT result's kind. Build arguments with the constructor matching each WIT parameter. Raw mode is unchanged. |

## License

MIT. See [LICENSE](LICENSE).
