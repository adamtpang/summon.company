import { existsSync } from "node:fs";
import path from "node:path";

// Node on Windows no longer resolves bare executable names through PATH for
// child_process spawn/execFile (hardened resolution), so `execFile("git", …)`
// throws `spawn git ENOENT` even with Git for Windows installed and on PATH.
// Verified live 2026-07-17: the managed-workspace clone in heartbeat.ts failed
// instantly with exactly that error, which is why URL-only paired repos never
// materialized (SUM-129). Everything that spawns git must go through this
// resolver instead of the bare name.
//
// shell:true would also work but concatenates arguments unescaped (Node
// DEP0190) — repo URLs are user input, so that path is an injection risk.

let cachedGitBinary: string | null = null;

export function resolveGitBinary(env: NodeJS.ProcessEnv = process.env): string {
  if (cachedGitBinary) return cachedGitBinary;
  if (process.platform !== "win32") {
    cachedGitBinary = "git";
    return cachedGitBinary;
  }
  const candidates = [
    path.join(env.ProgramFiles ?? "C:\\Program Files", "Git", "cmd", "git.exe"),
    path.join(env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Git", "cmd", "git.exe"),
    env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, "Programs", "Git", "cmd", "git.exe") : "",
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      cachedGitBinary = candidate;
      return cachedGitBinary;
    }
  }
  cachedGitBinary = "git";
  return cachedGitBinary;
}

/** Test seam: clear the memoized path. */
export function resetGitBinaryCacheForTests(): void {
  cachedGitBinary = null;
}
