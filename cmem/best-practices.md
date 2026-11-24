# best-practices.md — METHOD, not findings

One bold rule, the incident that paid for it, and the origin tag. Post-mortems stay in their home
file. Rules this repo pays for itself are appended under § L with `[universalWasmLoader-c]`, with
the next free number; numbers are never reused.

## § L This repo's own rules

- **L1 A test run that compiles nothing proves nothing about the source.** `make test` printed
  29/29 from a stale `tests/spec_tests.exe` on a machine with no `cc` at all; `make clean test`
  failed at once (2026-10-22, [overview.md](overview.md) § "Build / release flow"). Run `clean test`
  when the result is evidence. [universalWasmLoader-c]
- **L2 A documented platform nobody fetches is a guess.** `fetch-wasmtime.sh` listed
  `x86_64-linux` and the macOS targets from v1 on, but always requested `.zip`; those targets ship
  `.tar.xz`, so every one of them 404'd until the Bun port tried it (2026-10-22, `5fad372`).
  [universalWasmLoader-c; cf. -js L2 "a runtime claim nobody runs is a guess"]
- **L3 A negative check must tell "absent" from "different".** `echo "$g" | grep -q noreply || echo
  "NOT noreply"` reported the global `user.email` as a personal address when it was UNSET (the
  address lived in the system config), and the H19 filter then failed twice on an empty value
  (2026-10-22, [archive/history-purge-2026-10-22.md](archive/history-purge-2026-10-22.md)). Test for empty first; print the scope.
  [universalWasmLoader-c]
- **L4 A watcher must be shown a success before it is trusted to wait for one.** A CI poll matched
  the run id within three lines of `head_sha` in GitHub's JSON, where it never is, so a passed run
  read as "not completed after ~40 min" and looked like a stall (2026-10-22). Run the matcher once
  against an already-completed run before backgrounding it. [universalWasmLoader-c]

## ★ The workspace's convergent rules

Copied, unchanged, in [best-practices-shared.md](best-practices-shared.md) (moved there 2026-11-24,
letter H38).
