# platforms.md — the support matrix and platform notes

Summary: **testing tier 3, the full matrix** (workspace letter H40, owner 2026-11-19: this loader
links wasmtime's C library and is built per platform). Every supported platform runs the full
suite; until a platform has a test machine it is `pending`. Facts common to every project are in
the workspace's [platforms.md](../../../workspace/cmem/platforms.md). Last verified 2026-11-24.

## Support matrix

| Platform | Status | Target name (vcpkg triplet; wasmtime C API) | Tested on |
| --- | --- | --- | --- |
| `win-x64` | tested | `x64-windows`, `x64-mingw-dynamic`; `x86_64-windows`, `x86_64-mingw` | dev machine |
| `win-arm64` | none | not in the port's `supports` (Windows is x64 only) | — |
| `mac-x64` | pending | `x64-osx`; `x86_64-macos` | — |
| `mac-arm64` | pending | `arm64-osx`; `aarch64-macos` | — |
| `linux-x64` | pending | `x64-linux`; `x86_64-linux` | — |
| `linux-arm64` | pending | `arm64-linux`; `aarch64-linux` | — |

- **What "tested" covers on `win-x64`:** the full suite (`make clean test`, `zig cc`, the
  `x86_64-mingw` SDK) and the gates, on the dev machine, before every release.
- **What CI adds, which is not a test-machine role:** after each release, `publish` installs the
  version through the registry on GitHub's `x64-linux`, `x64-windows` and `arm64-osx` runners. That
  proves the port installs there; it runs no suite, so those platforms stay `pending` here.

## Where the platform tags are

- **Tagged now:** the three `Makefile` settings (`# platform: <IDs>` comments).
- **Tagged with the next release:** the header's MinGW block and the portfile's per-triplet selection. An edit
  to either changes a sha512 pin or the port's git-tree, which CI checks against the released 2.1.1
  entry, so the comments land with the bump.

## Linux distros

| Distro and version | libc | Status | Tested on |
| --- | --- | --- | --- |
| (none run yet) | — | pending | — |

- **glibc baseline (workspace: 2.28):** this repo ships no binary, only the header and the port.
  The port installs wasmtime's own prebuilt Linux libraries, whose required glibc version is
  upstream's and has not been measured here. A musl (Alpine) row needs a wasmtime musl build,
  which the port does not select.

## win-x64

- **MinGW static link:** `wasi.h` decorates every `_WIN32` symbol `__declspec(dllimport)`, so the
  header defines `WASI_API_EXTERN` as plain `extern` for `__MINGW32__` / `LIBWASM_STATIC`
  (`universal_wasm_loader.h`; its `win-x64` tag comes with the next release, see below). Without it a static MinGW link fails on
  `__imp_wasi_config_*`.
- **System libraries:** wasmtime's static library pulls in `ws2_32`, `bcrypt`, `userenv`, `ntdll`,
  `ole32`, `Shlwapi`, `advapi32`, `kernel32`, `uuid`, `pthread` (`Makefile` `SYSLIBS`, tagged).
- **The default SDK** is `x86_64-mingw` (`Makefile` `WASMTIME_PLATFORM`, tagged).
- **The port** picks the `x86_64-windows` (MSVC) or `x86_64-mingw` artifact (`portfile.cmake`;
  tagged with the next release).

## mac-x64, mac-arm64

- **No `-lunwind`:** `zig cc` needs Zig's `libunwind` for wasmtime's Rust code everywhere except
  macOS, where libSystem carries the unwinder (`Makefile`, tagged). Measured only by cross-linking
  (2026-10-22); a native macOS build has never run (open-work.md OW5).

## linux-x64, linux-arm64

- **System libraries:** `-lpthread -lm -ldl`, plus Zig's `-lunwind` under `zig cc` (`Makefile`,
  tagged).
- **The port** picks `x86_64-linux` or `aarch64-linux` (`portfile.cmake`; tagged with the next release).
