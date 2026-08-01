import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupExecutionWorkspaceArtifacts } from "./workspace-runtime.js";

/**
 * Integration-style tests against real temporary git repositories, because the
 * failure in #10555 lived precisely in the gap between what the git calls were
 * assumed to do and what they did. Mocking git here would test the assumption,
 * not the behavior.
 */

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

async function makeRepo(base: string, name: string): Promise<string> {
  const repo = path.join(base, name);
  await fs.mkdir(repo, { recursive: true });
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Cleanup Test");
  await fs.writeFile(path.join(repo, "base.txt"), "base content\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-m", "base commit");
  return repo;
}

function workspaceInput(overrides: {
  id: string;
  providerType: string;
  providerRef: string;
  branchName?: string | null;
  projectWorkspaceCwd?: string | null;
}) {
  return {
    workspace: {
      id: overrides.id,
      cwd: overrides.providerRef,
      providerType: overrides.providerType,
      providerRef: overrides.providerRef,
      branchName: overrides.branchName ?? null,
      repoUrl: null,
      baseRef: null,
      projectId: null,
      projectWorkspaceId: null,
      sourceIssueId: null,
      metadata: { createdByRuntime: true } as Record<string, unknown>,
    },
    projectWorkspace: overrides.projectWorkspaceCwd
      ? { cwd: overrides.projectWorkspaceCwd, cleanupCommand: null }
      : null,
    recorder: null,
  };
}

describe("cleanupExecutionWorkspaceArtifacts rescue behavior (#10555)", () => {
  let base: string;

  beforeEach(async () => {
    base = await fs.mkdtemp(path.join(os.tmpdir(), "pc-cleanup-test-"));
  });

  afterEach(async () => {
    await fs.rm(base, { recursive: true, force: true }).catch(() => {});
  });

  it("captures uncommitted worktree state to a surviving ref before removal", async () => {
    const repo = await makeRepo(base, "repo-dirty-worktree");
    const wt = path.join(base, "wt-dirty");
    git(repo, "worktree", "add", wt, "-b", "feat/dirty-run");
    await fs.writeFile(path.join(wt, "base.txt"), "modified in worktree\n");
    await fs.writeFile(path.join(wt, "untracked.txt"), "untracked work\n");

    const result = await cleanupExecutionWorkspaceArtifacts(
      workspaceInput({
        id: "ws-dirty-1",
        providerType: "git_worktree",
        providerRef: wt,
        branchName: "feat/dirty-run",
        projectWorkspaceCwd: repo,
      }),
    );

    expect(result.cleaned).toBe(true);
    await expect(fs.access(wt)).rejects.toThrow();

    const ref = "refs/paperclip/rescue-cleanup/ws-dirty-1";
    const sha = git(repo, "rev-parse", "--verify", ref);
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(git(repo, "show", `${ref}:base.txt`)).toBe("modified in worktree");
    expect(git(repo, "show", `${ref}:untracked.txt`)).toBe("untracked work");

    const rescueWarning = result.warnings.find((w) => w.includes(ref));
    expect(rescueWarning).toBeDefined();
    expect(rescueWarning).toContain("2 uncommitted files");
  });

  it("leaves the real index and HEAD of the shared repo untouched by the capture", async () => {
    const repo = await makeRepo(base, "repo-index-check");
    const wt = path.join(base, "wt-index-check");
    git(repo, "worktree", "add", wt, "-b", "feat/index-check");
    await fs.writeFile(path.join(wt, "untracked.txt"), "should not enter any real index\n");
    const headBefore = git(repo, "rev-parse", "HEAD");

    await cleanupExecutionWorkspaceArtifacts(
      workspaceInput({
        id: "ws-index-1",
        providerType: "git_worktree",
        providerRef: wt,
        branchName: "feat/index-check",
        projectWorkspaceCwd: repo,
      }),
    );

    expect(git(repo, "rev-parse", "HEAD")).toBe(headBefore);
    expect(git(repo, "status", "--porcelain")).toBe("");
    expect(git(repo, "diff", "--cached", "--name-only")).toBe("");
  });

  it("does not create a rescue ref for a clean worktree", async () => {
    const repo = await makeRepo(base, "repo-clean-worktree");
    const wt = path.join(base, "wt-clean");
    git(repo, "worktree", "add", wt, "-b", "feat/clean-run");

    const result = await cleanupExecutionWorkspaceArtifacts(
      workspaceInput({
        id: "ws-clean-1",
        providerType: "git_worktree",
        providerRef: wt,
        branchName: "feat/clean-run",
        projectWorkspaceCwd: repo,
      }),
    );

    expect(result.cleaned).toBe(true);
    expect(() => git(repo, "rev-parse", "--verify", "refs/paperclip/rescue-cleanup/ws-clean-1")).toThrow();
    expect(git(repo, "branch", "--list", "feat/clean-run")).toBe("");
  });

  it("preserves paperclip/rescue/* branches instead of deleting them", async () => {
    const repo = await makeRepo(base, "repo-rescue-branch");
    const rescueBranch = "paperclip/rescue/demo-issue/20260801T000000Z";
    const wt = path.join(base, "wt-rescue");
    git(repo, "worktree", "add", wt, "-b", rescueBranch);

    const result = await cleanupExecutionWorkspaceArtifacts(
      workspaceInput({
        id: "ws-rescue-1",
        providerType: "git_worktree",
        providerRef: wt,
        branchName: rescueBranch,
        projectWorkspaceCwd: repo,
      }),
    );

    expect(git(repo, "branch", "--list", rescueBranch)).toContain(rescueBranch);
    expect(result.warnings.some((w) => w.includes("Preserved rescue branch"))).toBe(true);
  });

  it("leaves a dirty local_fs workspace on disk instead of removing it", async () => {
    const repo = await makeRepo(base, "repo-local-dirty");
    await fs.writeFile(path.join(repo, "uncommitted.txt"), "work in flight\n");
    const elsewhere = path.join(base, "project-home");
    await fs.mkdir(elsewhere, { recursive: true });

    const result = await cleanupExecutionWorkspaceArtifacts(
      workspaceInput({
        id: "ws-localfs-dirty-1",
        providerType: "local_fs",
        providerRef: repo,
        projectWorkspaceCwd: elsewhere,
      }),
    );

    expect(result.cleaned).toBe(false);
    await expect(fs.access(path.join(repo, "uncommitted.txt"))).resolves.toBeUndefined();
    expect(result.warnings.some((w) => w.includes("Left") && w.includes("uncommitted files present"))).toBe(true);
  });

  it("still removes a clean local_fs workspace (regression guard)", async () => {
    const repo = await makeRepo(base, "repo-local-clean");
    const elsewhere = path.join(base, "project-home-2");
    await fs.mkdir(elsewhere, { recursive: true });

    const result = await cleanupExecutionWorkspaceArtifacts(
      workspaceInput({
        id: "ws-localfs-clean-1",
        providerType: "local_fs",
        providerRef: repo,
        projectWorkspaceCwd: elsewhere,
      }),
    );

    expect(result.cleaned).toBe(true);
    await expect(fs.access(repo)).rejects.toThrow();
  });
});
