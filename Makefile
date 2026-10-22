# universalWasmLoader-c — build & test
#
# Requires the wasmtime C API SDK in vendor/ (fetch with `make fetch`, which needs Bun).
# Override WASMTIME_VERSION / WASMTIME_PLATFORM to match your toolchain.

WASMTIME_VERSION  ?= 45.0.2
WASMTIME_PLATFORM ?= x86_64-mingw
WASMTIME_SDK      ?= vendor/wasmtime-v$(WASMTIME_VERSION)-$(WASMTIME_PLATFORM)-c-api

# Default compiler is `zig cc`. GNU make predefines CC=cc, so `?=` would never
# apply; override only when CC still has make's built-in value. Pass CC=gcc
# (or anything else) on the command line or in the environment to change it.
ifeq ($(origin CC),default)
  CC = zig cc
endif
CFLAGS  ?= -std=c11 -O2 -Wall -Wextra
INCLUDE  = -I$(WASMTIME_SDK)/include
LIBDIR   = -L$(WASMTIME_SDK)/lib

# wasmtime's static lib pulls in these system libraries on Windows/MinGW.
# On Linux/macOS only -lpthread (+ -lm -ldl) are needed; override SYSLIBS.
ifeq ($(OS),Windows_NT)
  SYSLIBS ?= -lws2_32 -lbcrypt -luserenv -lntdll -lole32 -lShlwapi -ladvapi32 \
             -lkernel32 -luuid -lpthread
  EXE      = .exe
else
  UNAME_S := $(shell uname -s)
  SYSLIBS ?= -lpthread -lm -ldl
  EXE      =
endif

# wasmtime's static lib is Rust std built against libgcc's unwinder (_Unwind_*,
# _GCC_specific_handler). gcc links that implicitly; zig cc does not, so link
# zig's bundled LLVM libunwind, which provides the same symbols. macOS is
# exempt: libSystem already carries the unwinder.
ifneq ($(findstring zig,$(CC)),)
  ifneq ($(UNAME_S),Darwin)
    SYSLIBS += -lunwind
  endif
endif

# Static link by default (no DLL on PATH needed). Set WASMTIME_LINK=shared to
# link the import library and run with wasmtime.dll alongside the binary.
WASMTIME_LINK ?= static
ifeq ($(WASMTIME_LINK),shared)
  WASMTIME_LIB = -lwasmtime
else
  WASMTIME_LIB = $(WASMTIME_SDK)/lib/libwasmtime.a
endif

TEST_BIN = tests/spec_tests$(EXE)

.PHONY: all test fetch clean print-sdk surface surface-check compat compat-selftest bump

all: test

fetch:
	bun run scripts/fetch-wasmtime.ts $(WASMTIME_VERSION) $(WASMTIME_PLATFORM)

$(TEST_BIN): tests/spec_tests.c universal_wasm_loader.h | check-sdk
	$(CC) $(CFLAGS) $(INCLUDE) tests/spec_tests.c -o $(TEST_BIN) \
	  $(LIBDIR) $(WASMTIME_LIB) $(SYSLIBS)

test: $(TEST_BIN)
	./$(TEST_BIN)

check-sdk:
	@test -d "$(WASMTIME_SDK)/include" || { \
	  echo "wasmtime C API not found at $(WASMTIME_SDK)."; \
	  echo "Run: make fetch"; exit 1; }

clean:
	rm -f $(TEST_BIN)

# ── Compatibility gate (cmem/compat-gate.md) ─────────────────────────────────
# surface        write api-surface.json from the header (re-baseline: own commit)
# surface-check  fail if api-surface.json is stale
# compat         floor vs the last tag + the last tag's tests on this header
# bump KIND=..   patch|minor|major; refuses a bump below the floor

print-sdk:
	@echo $(abspath $(WASMTIME_SDK))

surface:
	bun run scripts/surface.ts

surface-check:
	bun run scripts/surface.ts --check

compat:
	bun run scripts/compat.ts

compat-selftest:
	bun run scripts/check-compat-gate.ts

bump:
	bun run scripts/bump.ts $(KIND)
