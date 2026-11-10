/**
 * GitHub REST API helpers shared by the release scripts (`ci-tag.ts`, `github-release.ts`): a
 * request with a time limit, and "what commit does this tag peel to". No `gh` (workspace H30).
 *
 * Environment: GITHUB_REPOSITORY (owner/repo), GITHUB_TOKEN (optional; reads work without it),
 * GITHUB_API_URL (default https://api.github.com; the self-tests point it at a mock),
 * UWL_HTTP_TIMEOUT_MS (per request, default 30000 — best-practices 7.21).
 * `node:` builtins and `fetch` only.
 */
import process from "node:process";

export function fail(who: string, msg: string): never {
  console.error(`${who}: ${msg}`);
  process.exit(1);
}

export interface Api {
  who: string;
  repo: string;
  token: string;
  call(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }>;
  /** The commit `tag` peels to on GitHub (annotated tags followed), or null when it does not exist. */
  peel(tag: string): Promise<string | null>;
}

export function api(who: string): Api {
  const repo = process.env.GITHUB_REPOSITORY ?? "";
  const token = process.env.GITHUB_TOKEN ?? "";
  const base = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, "");
  const timeoutMs = Number(process.env.UWL_HTTP_TIMEOUT_MS ?? "30000");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) fail(who, `GITHUB_REPOSITORY "${repo}" is not owner/repo`);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) fail(who, `UWL_HTTP_TIMEOUT_MS "${timeoutMs}" is not a positive number`);

  function headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": `${repo} release workflow`,
    };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  async function call(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
    let res: Response;
    let text: string;
    try {
      // The limit covers the request AND the body (a server that stalls mid-body still fails).
      const signal = AbortSignal.timeout(timeoutMs);
      res = await fetch(`${base}${path}`, {
        method,
        headers: body === undefined ? headers() : { ...headers(), "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
      text = await res.text();
    } catch (e) {
      const name = (e as Error).name;
      if (name === "TimeoutError" || name === "AbortError") fail(who, `${method} ${path}: no answer within ${timeoutMs} ms`);
      fail(who, `${method} ${path}: ${(e as Error).message}`);
    }
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 200) };
    }
    return { status: res.status, json };
  }

  async function peel(tag: string): Promise<string | null> {
    const ref = await call("GET", `/repos/${repo}/git/ref/tags/${tag}`);
    if (ref.status === 404) return null;
    if (ref.status !== 200) fail(who, `GET tag ref ${tag}: HTTP ${ref.status} ${JSON.stringify(ref.json)}`);
    let object = ref.json?.object as { type: string; sha: string } | undefined;
    for (let depth = 0; object?.type === "tag"; depth++) {
      if (depth > 5) fail(who, `tag ${tag} nests more than 5 tag objects`);
      const t = await call("GET", `/repos/${repo}/git/tags/${object.sha}`);
      if (t.status !== 200) fail(who, `GET tag object ${object.sha}: HTTP ${t.status}`);
      object = t.json?.object;
    }
    if (object?.type !== "commit") fail(who, `tag ${tag} does not point to a commit (${JSON.stringify(object)})`);
    return object.sha;
  }

  return { who, repo, token, call, peel };
}
