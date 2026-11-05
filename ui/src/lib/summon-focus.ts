import type { Issue } from "@paperclipai/shared";

const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

export function focusQueue(tasks: Issue[], companyId: string, projectId = "") {
  return tasks.filter((task) => task.companyId === companyId
    && (!projectId || task.projectId === projectId)
    && (task.status === "blocked" || task.status === "in_review"))
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
      || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id));
}

export function closureBlockReason(task: Issue, companyId: string): string | null {
  if (task.companyId !== companyId) return "This task belongs to another company.";
  if (task.status !== "blocked" && task.status !== "in_review") return "The task changed. Refresh the queue before continuing.";
  if (task.executionRunId) return "An execution still owns this task. Review it in the task workspace first.";
  if (task.blockedBy?.some((dependency) => dependency.status !== "done" && dependency.status !== "cancelled")) {
    return "An earlier task is still open. Resolve that dependency first.";
  }
  return null;
}

export async function closeFocusTask(
  api: { get: (id: string) => Promise<Issue>; update: (id: string, data: Record<string, unknown>) => Promise<Issue> },
  task: Issue,
  companyId: string,
  evidence: string,
) {
  if (!evidence.trim()) throw new Error("Add the result and evidence before closing this task.");
  const current = await api.get(task.id);
  const reason = closureBlockReason(current, companyId);
  if (reason) throw new Error(reason);
  const saved = await api.update(current.id, {
    status: "done",
    comment: `Verified closure\n\n${evidence.trim()}`,
  });
  if (saved.status !== "done") throw new Error("The server did not confirm closure. Review the full task before trying again.");
  return saved;
}
