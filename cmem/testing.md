# testing.md — the reference suite and how its tests were proven

Summary: what `make test` runs, the counts, and how each group of tests was inverted. Last verified 2026-11-24. Split out of overview.md on 2026-11-24 (memory guide, letter H38).

## The suite

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

