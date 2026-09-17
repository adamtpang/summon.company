import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Issue } from "@paperclipai/shared";
import { ArrowLeft, ArrowUpRight, Check, CircleDot } from "lucide-react";
import { Link } from "@/lib/router";
import { useCompany } from "@/context/CompanyContext";
import { issuesApi } from "@/api/issues";
import { projectsApi } from "@/api/projects";
import { agentsApi } from "@/api/agents";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { closeFocusTask, closureBlockReason, focusQueue } from "@/lib/summon-focus";

function Closure({ task, companyId, onClosed }: { task: Issue; companyId: string; onClosed: (task: Issue) => void }) {
 const [evidence, setEvidence] = useState("");
 const [verified, setVerified] = useState(false);
 const reason = closureBlockReason(task, companyId);
 const close = useMutation({
 mutationFn: () => closeFocusTask(issuesApi, task, companyId, evidence),
 onSuccess: onClosed,
 });
 return <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); if (verified && evidence.trim() && !reason && !close.isPending) close.mutate(); }}>
 <div><h2 className="text-lg font-semibold">What changed?</h2><p className="mt-2 text-sm text-muted-foreground">Record the result and a receipt someone can check. Closing a task does not establish revenue.</p></div>
 <label className="flex flex-col gap-2 text-sm font-medium">Result and evidence
 <Textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="What now works? Include the test, receipt, or evidence location." required disabled={close.isPending} />
 </label>
 <label className="flex items-start gap-3 text-sm text-muted-foreground"><input type="checkbox" className="mt-1" checked={verified} disabled={close.isPending} onChange={(event) => setVerified(event.target.checked)} />I checked the result and the task is complete.</label>
 {reason && <p role="status" className="text-sm text-muted-foreground">{reason}</p>}
 {close.error && <p role="alert" className="text-sm text-destructive">{close.error.message} Your evidence is still here.</p>}
 <div><Button type="submit" className="min-h-11" disabled={!verified || !evidence.trim() || Boolean(reason) || close.isPending}><Check aria-hidden="true" />{close.isPending ? "Saving closure..." : "Save evidence and close task"}</Button></div>
 </form>;
}

export function SummonFocus() {
 const { selectedCompanyId, selectedCompany } = useCompany();
 return selectedCompanyId ? <FocusWorkspace key={selectedCompanyId} companyId={selectedCompanyId} companyName={selectedCompany?.name ?? "Company"} /> : <p className="p-8">Select a company to see its blockers. <Link to="/companies">Open companies</Link></p>;
}

function FocusWorkspace({ companyId, companyName }: { companyId: string; companyName: string }) {
 const client = useQueryClient();
 const [projectId, setProjectId] = useState("");
 const [selectedId, setSelectedId] = useState<string | null>(null);
 const [receipt, setReceipt] = useState<Issue | null>(null);
 const tasks = useQuery({ queryKey: ["summon-focus", companyId], queryFn: () => issuesApi.list(companyId, { status: "blocked,in_review", includeBlockedBy: true }) });
 const projects = useQuery({ queryKey: ["projects", companyId], queryFn: () => projectsApi.list(companyId) });
 const agents = useQuery({ queryKey: ["agents", companyId], queryFn: () => agentsApi.list(companyId) });
 const queue = focusQueue(tasks.data ?? [], companyId, projectId);
 const selected = queue.find((task) => task.id === selectedId) ?? queue[0];
 const owner = selected?.assigneeAgentId ? agents.data?.find((agent) => agent.id === selected.assigneeAgentId)?.name ?? "Assigned employee" : selected?.assigneeUserId ? "Assigned board member" : "No owner assigned";
 return <div className="dark min-h-dvh bg-background text-foreground">
 <a href="#focus-canvas" className="sr-only focus:not-sr-only focus:p-4">Skip to selected task</a>
 <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 shadow-xs">
 <Link to="/focus" className="text-xl font-semibold tracking-tight">summon<span className="text-muted-foreground"> / focus</span></Link>
 <div className="flex items-center gap-4 text-sm"><span className="text-muted-foreground">{companyName}</span><Link to="/issues" className="inline-flex min-h-11 items-center gap-2"><ArrowLeft className="size-4" aria-hidden="true" />All tasks</Link></div>
 </header>
 <div className="flex flex-col lg:flex-row">
 <aside className="flex shrink-0 flex-col gap-6 bg-sidebar p-6 lg:min-h-dvh lg:w-80" aria-label="Blocker queue">
 <div><h1 className="text-xl font-semibold">Clear the next blocker</h1><p className="mt-2 text-sm text-muted-foreground">Choose an income project. Review one result at a time.</p></div>
 <label className="flex flex-col gap-2 text-sm">Project
 <select className="min-h-11 w-full rounded-md bg-background px-3 text-foreground" value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelectedId(null); setReceipt(null); }}>
 <option value="">All projects</option>{projects.data?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
 </select>
 </label>
 {projects.isError && <p role="alert" className="text-sm text-destructive">Project names could not load. <button type="button" className="underline" onClick={() => projects.refetch()}>Retry</button></p>}
 <p className="text-xs text-muted-foreground">Blocked and ready for review, ordered by priority then oldest first.</p>
 <nav className="flex max-h-64 flex-col gap-2 overflow-y-auto lg:max-h-none" aria-label="Tasks needing attention">{queue.map((task) => <button key={task.id} type="button" aria-current={task.id === selected?.id ? "true" : undefined} className={cn("flex min-h-11 flex-col gap-2 rounded-lg p-4 text-left focus-visible:outline-2 focus-visible:outline-ring", task.id === selected?.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50")} onClick={() => { setSelectedId(task.id); setReceipt(null); }}><span className="text-xs text-muted-foreground">{task.identifier} / {task.status === "blocked" ? "Blocked" : "Ready for review"}</span><span className="text-sm font-medium break-words">{task.title}</span></button>)}</nav>
 <Link to="/dashboard" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">Company overview<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
 </aside>
 <main id="focus-canvas" tabIndex={-1} className="min-w-0 flex-1 px-6 py-10 outline-none md:px-12">
 <div className="mx-auto flex max-w-3xl flex-col gap-8">
 {receipt && <div role="status" className="rounded-lg bg-accent p-5"><h2 className="font-semibold">{receipt.identifier} closed with evidence</h2><p className="mt-2 text-sm text-muted-foreground">The result is saved on the task. Choose the next blocker when ready.</p></div>}
 {tasks.isPending && <p role="status">Loading the blocker queue...</p>}
 {tasks.isError && <div role="alert"><h2 className="text-xl font-semibold">The blocker queue could not load</h2><p className="my-4 text-sm text-muted-foreground">{tasks.error.message}</p><Button variant="outline" onClick={() => tasks.refetch()}>Try again</Button></div>}
 {!tasks.isPending && !tasks.isError && !selected && <div><CircleDot className="mb-6 size-8 text-muted-foreground" aria-hidden="true" /><h2 className="text-3xl font-semibold tracking-tight">Nothing waiting in this queue</h2><p className="mt-4 text-muted-foreground">No blocked or review tasks match this project. Check all tasks for work still in progress.</p></div>}
 {selected && !tasks.isError && <>
 <div className="flex flex-col gap-4"><p className="text-sm text-muted-foreground">{selected.identifier} / {selected.priority} priority</p><h2 className="text-3xl font-semibold tracking-tight break-words md:text-4xl">{selected.title}</h2><p className="text-sm text-muted-foreground">Owner: {owner}</p>{agents.isError && <p className="text-sm text-muted-foreground">Employee names are unavailable.</p>}</div>
 <section className="flex flex-col gap-4" aria-label="Task context"><h3 className="font-medium">The work to resolve</h3><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{selected.description || "This task has no context yet. Open the task to define the blocker and acceptance criteria."}</p><Link to={`/issues/${selected.identifier ?? selected.id}`} className="inline-flex min-h-11 items-center gap-2 self-start text-sm underline">Open full task and receipts<ArrowUpRight className="size-4" aria-hidden="true" /></Link></section>
 <Closure key={selected.id} task={selected} companyId={companyId} onClosed={(closed) => {
 setReceipt(closed);
 client.setQueryData<Issue[]>(["summon-focus", companyId], (previous) => previous?.filter((task) => task.id !== closed.id));
 void client.invalidateQueries({ queryKey: ["issues"] });
 void client.invalidateQueries({ queryKey: ["summon-focus", companyId] });
 }} />
 </>}
 </div>
 </main>
 </div>
 </div>;
}
