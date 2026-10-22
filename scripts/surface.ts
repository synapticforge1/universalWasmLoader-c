// The public SURFACE of universal_wasm_loader.h (workspace compatibility gate,
// Rule 1): everything a consumer can depend on, keyed one entry per symbol.
//
// Usage: bun run scripts/surface.ts           write api-surface.json
//        bun run scripts/surface.ts --check   exit 1 if api-surface.json is stale
//
// The surface is the header's public region (between the include guard and
// `#ifdef UWL_IMPLEMENTATION`) plus the SPEC version the header claims:
//   fn <name>       a function's signature, parameter names dropped
//   type <name>     a typedef: struct/union layout, function-pointer shape, or opaque
//   enum <name>     an enum typedef; each constant is `const <NAME>` = its value
//   macro <NAME>    a public #define;  include <h>  a public #include
// Static-inline BODIES are not surface (behaviour; the previous-tag tests see it).
// A declaration form this script cannot key is an error, never skipped.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dir, "..");
export const HEADER = "universal_wasm_loader.h";
export const SNAPSHOT = join(ROOT, "api-surface.json");

export type Surface = { spec: string; symbols: Record<string, string> };

const GUARD = "#define UNIVERSAL_WASM_LOADER_H";
const IMPL = "#ifdef UWL_IMPLEMENTATION";
const QUALIFIERS = new Set(["const", "volatile", "unsigned", "signed", "struct", "enum", "union", "short", "long"]);

const norm = (s: string) =>
  s.replace(/\s+/g, " ").trim().replace(/\s*([(),;{}\[\]=*])\s*/g, "$1");

// "const char*wasm_path" -> "const char*"; "size_t n" -> "size_t"; "void" / "..." kept.
function dropParamName(p: string): string {
  if (p === "void" || p === "..." || p === "") return p;
  const m = p.match(/^(.*?)([A-Za-z_]\w*)$/);
  if (!m || m[1] === "") return p;
  const prefix = m[1].trim();
  if (prefix.split(/[\s*]+/).filter(Boolean).every((w) => QUALIFIERS.has(w))) return p;
  return prefix;
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const c of s) {
    if (c === "(" || c === "{" || c === "[") depth++;
    if (c === ")" || c === "}" || c === "]") depth--;
    if (c === sep && depth === 0) { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out;
}

// "ret name(params)" (normalized) -> [name, "ret(params-without-names)"]
function signature(decl: string): [string, string] {
  const open = decl.indexOf("(");
  const close = decl.lastIndexOf(")");
  const head = decl.slice(0, open);
  const name = head.match(/([A-Za-z_]\w*)$/)?.[1];
  if (!name || close < open) throw new Error(`cannot key function declaration: ${decl}`);
  const ret = head.slice(0, head.length - name.length);
  const params = splitTopLevel(decl.slice(open + 1, close), ",").map(dropParamName).join(",");
  return [name, `${ret}(${params})${decl.slice(close + 1)}`];
}

function publicRegion(text: string): string {
  const start = text.indexOf(GUARD);
  const end = text.indexOf(IMPL);
  if (start < 0 || end < 0 || end < start) throw new Error(`cannot find the public region (${GUARD} .. ${IMPL})`);
  return text.slice(start + GUARD.length, end);
}

// Split C source into top-level declarations: a `;` at depth 0, or the `}` that
// closes a function body (text before its `{` ends in `)`).
function declarations(src: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "", bodyIsFunction = false;
  for (const c of src) {
    if (c === "{") {
      if (depth === 0) bodyIsFunction = /\)\s*$/.test(cur);
      depth++;
    }
    cur += c;
    if (c === "}") {
      depth--;
      if (depth === 0 && bodyIsFunction) { out.push(cur.trim()); cur = ""; }
    }
    if (c === ";" && depth === 0) { out.push(cur.trim()); cur = ""; }
  }
  if (cur.trim() !== "") throw new Error(`trailing text that is not a declaration: ${cur.trim()}`);
  return out;
}

export function surfaceOf(text: string): Surface {
  // Only the leading comment (before the include guard) states conformance; the
  // implementation's comments also say "SPEC v3.0.0" and must not satisfy this.
  const lead = text.slice(0, Math.max(0, text.indexOf(GUARD)));
  const specs = [...lead.matchAll(/SPEC v(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
  if (specs.length !== 1) {
    throw new Error(`the header's leading comment must state its SPEC version once ("SPEC vX.Y.Z"); found ${specs.length}`);
  }
  const spec = specs[0];

  let src = publicRegion(text.replace(/\r\n/g, "\n"))
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/#ifdef __cplusplus[\s\S]*?#endif/g, " ");

  const symbols: Record<string, string> = {};
  const put = (key: string, value: string) => {
    if (key in symbols) throw new Error(`duplicate surface key: ${key}`);
    symbols[key] = value;
  };

  src = src.replace(/^[ \t]*#(.*)$/gm, (_, d: string) => {
    const line = d.trim();
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^include\s+([<"][^>"]+[>"])$/))) put(`include ${m[1]}`, "");
    else if ((m = line.match(/^define\s+([A-Za-z_]\w*)(.*)$/))) put(`macro ${m[1]}`, norm(m[2]));
    else throw new Error(`cannot key preprocessor line in the public region: #${line}`);
    return " ";
  });

  for (const raw of declarations(src)) {
    const d = norm(raw);
    let m: RegExpMatchArray | null;
    if ((m = d.match(/^typedef enum(?: [A-Za-z_]\w*)?\{(.*)\}([A-Za-z_]\w*);$/))) {
      put(`enum ${m[2]}`, "enum");
      let next = 0;
      for (const e of m[1].split(",").filter((s) => s !== "")) {
        const [name, expr] = e.split("=");
        if (expr !== undefined) {
          if (!/^-?\d+$/.test(expr)) throw new Error(`cannot key enum value: ${e}`);
          next = Number(expr);
        }
        put(`const ${name}`, `${m[2]}=${next}`);
        next++;
      }
    } else if ((m = d.match(/^typedef (struct|union)( [A-Za-z_]\w*)?(\{.*\})([A-Za-z_]\w*);$/))) {
      put(`type ${m[4]}`, `${m[1]}${m[2] ?? ""}${m[3]}`);
    } else if ((m = d.match(/^typedef (struct|union) ([A-Za-z_]\w*) ([A-Za-z_]\w*);$/))) {
      put(`type ${m[3]}`, `opaque ${m[1]} ${m[2]}`);
    } else if ((m = d.match(/^typedef (.*)\(\*([A-Za-z_]\w*)\)\((.*)\);$/))) {
      const params = splitTopLevel(m[3], ",").map(dropParamName).join(",");
      put(`type ${m[2]}`, `${m[1]}(*)(${params})`);
    } else if (/^typedef /.test(d)) {
      throw new Error(`cannot key typedef: ${d}`);
    } else if (/\)\{/.test(d) && d.endsWith("}")) {
      const [name, sig] = signature(d.slice(0, d.indexOf("){") + 1));
      put(`fn ${name}`, sig);
    } else if (d.endsWith(");") && d.includes("(")) {
      const [name, sig] = signature(d.slice(0, -1));
      put(`fn ${name}`, sig);
    } else {
      throw new Error(`cannot key declaration: ${d}`);
    }
  }

  const sorted = Object.fromEntries(Object.entries(symbols).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return { spec, symbols: sorted };
}

export function serialize(s: Surface): string {
  return `${JSON.stringify(
    {
      $comment: "Public surface of universal_wasm_loader.h. Generated by scripts/surface.ts; do not edit by hand. Re-baseline in its own commit.",
      spec: s.spec,
      symbols: s.symbols,
    },
    null,
    2,
  )}\n`;
}

export function readSnapshot(): Surface {
  const j = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  return { spec: j.spec, symbols: j.symbols };
}

// Key-level difference, for messages.
export function diffSurface(a: Surface, b: Surface): string[] {
  const out: string[] = [];
  if (a.spec !== b.spec) out.push(`spec: ${a.spec} -> ${b.spec}`);
  for (const k of Object.keys(a.symbols)) {
    if (!(k in b.symbols)) out.push(`removed: ${k}`);
    else if (a.symbols[k] !== b.symbols[k]) out.push(`changed: ${k}: ${a.symbols[k]} -> ${b.symbols[k]}`);
  }
  for (const k of Object.keys(b.symbols)) if (!(k in a.symbols)) out.push(`added: ${k}`);
  return out;
}

if (import.meta.main) {
  const current = surfaceOf(readFileSync(join(ROOT, HEADER), "utf8"));
  if (Bun.argv.includes("--check")) {
    let committed: Surface;
    try {
      committed = readSnapshot();
    } catch (e) {
      console.error(`api-surface.json missing or unreadable (${e}); run: make surface`);
      process.exit(1);
    }
    const diff = diffSurface(committed, current);
    if (diff.length > 0) {
      console.error("api-surface.json is stale against universal_wasm_loader.h:");
      for (const l of diff) console.error(`  ${l}`);
      console.error("If the change is intended, re-baseline in its OWN commit: make surface");
      process.exit(1);
    }
    console.log(`api-surface.json current: ${Object.keys(current.symbols).length} symbols, SPEC ${current.spec}`);
  } else {
    writeFileSync(`${SNAPSHOT}.tmp`, serialize(current));
    renameSync(`${SNAPSHOT}.tmp`, SNAPSHOT);
    console.log(`wrote api-surface.json: ${Object.keys(current.symbols).length} symbols, SPEC ${current.spec}`);
  }
}
