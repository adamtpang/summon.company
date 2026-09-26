import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CompanyInboxAutomationIntervalMinutes,
  CompanyInboxChannelType,
  CompanyInboxConnector,
  CompanyInboxMessageWithConnector,
  CompanyInboxReceipt,
  CompanyInboxReplyAuthority,
  CompanySecret,
  CompanyNotificationDeliveryWithReceipts,
} from "@paperclipai/shared";
import {
  Activity,
  Archive,
  Check,
  Inbox,
  Link2,
  ListTodo,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Settings2,
  Unplug,
} from "lucide-react";
import { useNavigate, useSearchParams } from "@/lib/router";
import { companyInboxApi } from "../api/companyInbox";
import { agentsApi } from "../api/agents";
import { secretsApi } from "../api/secrets";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { EmptyState } from "../components/EmptyState";
import { CompanyNotificationPreferences } from "../components/CompanyNotificationPreferences";
import { PageSkeleton } from "../components/PageSkeleton";
import { PageTabBar } from "../components/PageTabBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "../lib/utils";
import { queryKeys } from "../lib/queryKeys";
import { timeAgo } from "../lib/timeAgo";
import { BudgetCounterfactual } from "@/components/BudgetCounterfactual";
import { computeFleetBudgetStats, automationRunsPerMonth, fallbackCostPerRun } from "@/lib/fleet-counterfactual";

const INBOX_TABS = [
  { value: "mine", label: "Mine" },
  { value: "recent", label: "Recent" },
  { value: "unread", label: "Unread" },
  { value: "blocked", label: "Blocked" },
  { value: "customers", label: "Customers" },
  { value: "all", label: "All" },
];

const CHANNEL_LABELS: Record<CompanyInboxChannelType, string> = {
  email: "Email",
  chat: "Chat",
  social: "Social",
  support: "Support",
  custom: "Custom API",
};

const AUTHORITY_LABELS: Record<CompanyInboxReplyAuthority, string> = {
  none: "Read only",
  draft_only: "Draft only",
  approval_required: "Approval required",
};

const AUTOMATION_INTERVAL_OPTIONS: Array<{ value: CompanyInboxAutomationIntervalMinutes; label: string }> = [
  { value: 5, label: "Every 5 minutes" },
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 60, label: "Every hour" },
  { value: 180, label: "Every 3 hours" },
  { value: 360, label: "Every 6 hours" },
  { value: 720, label: "Every 12 hours" },
  { value: 1440, label: "Every day" },
];

function automationIntervalLabel(intervalMinutes: number) {
  return AUTOMATION_INTERVAL_OPTIONS.find((option) => option.value === intervalMinutes)?.label ?? `Every ${intervalMinutes} minutes`;
}

function ConnectorIcon({ type }: { type: CompanyInboxChannelType }) {
  const Icon = type === "email" ? Mail : type === "custom" ? Link2 : MessageSquare;
  return <Icon className="h-4 w-4" aria-hidden="true" />;
}

function formatFreshness(connector: CompanyInboxConnector) {
  if (connector.status === "revoked") return "Access revoked";
  if (connector.lastSyncedAt) return `Synced ${timeAgo(connector.lastSyncedAt)}`;
  return "Waiting for first sync";
}

function messageIdentity(message: CompanyInboxMessageWithConnector) {
  if (message.direction === "outbound") return message.recipientName ?? message.recipientAddress ?? "Draft reply";
  return message.senderName ?? message.senderAddress ?? "Customer";
}

function receiptLabel(receipt: CompanyInboxReceipt) {
  return receipt.type.replaceAll("_", " ");
}

function notificationStatusLabel(delivery: CompanyNotificationDeliveryWithReceipts) {
  return delivery.status.replaceAll("_", " ");
}

function providerName(providerKey: string) {
  return providerKey === "gmail" ? "Gmail" : providerKey === "slack" ? "Slack" : providerKey === "zernio" ? "Zernio" : providerKey;
}

function slackChannelId(externalAccountId: string) {
  return externalAccountId.match(/^T[A-Z0-9]{6,}:(C[A-Z0-9]{6,})$/)?.[1] ?? null;
}

function zernioAccountId(message: CompanyInboxMessageWithConnector) {
  return typeof message.evidence.accountId === "string" ? message.evidence.accountId : null;
}

export function CustomerInbox() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showAutomationConfig, setShowAutomationConfig] = useState(false);
  const [automationIntervalMinutes, setAutomationIntervalMinutes] = useState<CompanyInboxAutomationIntervalMinutes>(60);
  const [automationPrompt, setAutomationPrompt] = useState("");
  const [automationCreateWork, setAutomationCreateWork] = useState(true);
  const [draftBody, setDraftBody] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const requestedMessageId = searchParams.get("messageId");

  useEffect(() => {
    setBreadcrumbs([{ label: "Inbox", href: "/inbox/mine" }, { label: "Customers" }]);
  }, [setBreadcrumbs]);

  const connectorsQuery = useQuery({
    queryKey: queryKeys.companyInbox.connectors(selectedCompanyId!),
    queryFn: () => companyInboxApi.listConnectors(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
    refetchInterval: 30_000,
  });
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });
  const secretsQuery = useQuery({
    queryKey: queryKeys.secrets.list(selectedCompanyId!),
    queryFn: () => secretsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });
  const messagesQuery = useQuery({
    queryKey: queryKeys.companyInbox.messages(selectedCompanyId!, selectedConnectorId),
    queryFn: () => companyInboxApi.listMessages(selectedCompanyId!, {
      connectorId: selectedConnectorId ?? undefined,
      limit: 200,
    }),
    enabled: Boolean(selectedCompanyId),
    refetchInterval: 15_000,
  });
  const receiptsQuery = useQuery({
    queryKey: queryKeys.companyInbox.receipts(selectedCompanyId!, selectedConnectorId!),
    queryFn: () => companyInboxApi.listReceipts(selectedCompanyId!, selectedConnectorId!),
    enabled: Boolean(selectedCompanyId && selectedConnectorId),
    refetchInterval: 15_000,
  });
  const notificationStatusQuery = useQuery({
    queryKey: queryKeys.companyInbox.notificationStatus(selectedCompanyId!),
    queryFn: () => companyInboxApi.notificationStatus(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
    refetchInterval: 15_000,
  });
  const notificationsQuery = useQuery({
    queryKey: queryKeys.companyInbox.notifications(selectedCompanyId!, selectedConnectorId),
    queryFn: () => companyInboxApi.listNotifications(selectedCompanyId!, {
      connectorId: selectedConnectorId ?? undefined,
      limit: 20,
    }),
    enabled: Boolean(selectedCompanyId && selectedConnectorId),
    refetchInterval: 15_000,
  });

  const connectors = connectorsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const receipts = receiptsQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];

  useEffect(() => {
    if (selectedConnectorId && connectors.some((connector) => connector.id === selectedConnectorId)) return;
    setSelectedConnectorId(connectors.find((connector) => connector.status !== "revoked")?.id ?? connectors[0]?.id ?? null);
  }, [connectors, selectedConnectorId]);

  useEffect(() => {
    if (requestedMessageId) {
      const requested = messages.find((message) => message.id === requestedMessageId);
      if (requested) {
        if (selectedConnectorId !== requested.connectorId) setSelectedConnectorId(requested.connectorId);
        if (selectedMessageId !== requested.id) setSelectedMessageId(requested.id);
        return;
      }
    }
    if (selectedMessageId && messages.some((message) => message.id === selectedMessageId)) return;
    setSelectedMessageId(messages[0]?.id ?? null);
  }, [messages, requestedMessageId, selectedConnectorId, selectedMessageId]);

  const selectedConnector = connectors.find((connector) => connector.id === selectedConnectorId) ?? null;
  const selectedMessage = messages.find((message) => message.id === selectedMessageId) ?? null;
  const ownerNameById = useMemo(
    () => new Map((agentsQuery.data ?? []).map((agent) => [agent.id, agent.name])),
    [agentsQuery.data],
  );

  useEffect(() => {
    setAutomationIntervalMinutes(selectedConnector?.automationIntervalMinutes ?? 60);
    setAutomationPrompt(selectedConnector?.automationPrompt ?? "");
    setAutomationCreateWork(selectedConnector?.automationCreateWork ?? true);
  }, [selectedConnector]);

  const invalidate = async () => {
    if (!selectedCompanyId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["company-inbox", selectedCompanyId] }),
      queryClient.invalidateQueries({ queryKey: ["company-notifications", selectedCompanyId] }),
    ]);
  };

  const markRead = useMutation({
    mutationFn: (messageId: string) => companyInboxApi.markRead(selectedCompanyId!, messageId),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not mark the message read."),
  });
  const archive = useMutation({
    mutationFn: (messageId: string) => companyInboxApi.archive(selectedCompanyId!, messageId),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not archive the message."),
  });
  const revoke = useMutation({
    mutationFn: (connectorId: string) => companyInboxApi.revokeConnector(selectedCompanyId!, connectorId),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not revoke connector access."),
  });
  const sync = useMutation({
    mutationFn: (connectorId: string) => companyInboxApi.syncConnector(selectedCompanyId!, connectorId),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not sync the provider source."),
  });
  const configureAutomation = useMutation({
    mutationFn: () => companyInboxApi.configureAutomation(selectedCompanyId!, selectedConnector!.id, {
      intervalMinutes: automationIntervalMinutes,
      operatingPrompt: automationPrompt.trim() || null,
      createWork: automationCreateWork,
    }),
    onSuccess: async () => {
      setShowAutomationConfig(false);
      await invalidate();
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not configure the support loop."),
  });
  const startAutomation = useMutation({
    mutationFn: (connectorId: string) => companyInboxApi.startAutomation(selectedCompanyId!, connectorId),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not start the support loop."),
  });
  const pauseAutomation = useMutation({
    mutationFn: (connectorId: string) => companyInboxApi.pauseAutomation(selectedCompanyId!, connectorId),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not pause the support loop."),
  });
  const runAutomation = useMutation({
    mutationFn: (connectorId: string) => companyInboxApi.runAutomation(selectedCompanyId!, connectorId),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not run the support loop."),
  });
  const createDraft = useMutation({
    mutationFn: () => companyInboxApi.createDraft(selectedCompanyId!, {
      connectorId: selectedMessage!.connectorId,
      externalThreadId: selectedMessage!.externalThreadId,
      inReplyToExternalMessageId: selectedMessage!.externalMessageId,
      recipientName: selectedMessage!.connector.providerKey === "slack"
        ? selectedMessage!.connector.accountLabel
        : selectedMessage!.senderName,
      recipientAddress: selectedMessage!.connector.providerKey === "slack"
        ? slackChannelId(selectedMessage!.connector.externalAccountId)
        : selectedMessage!.connector.providerKey === "zernio"
          ? zernioAccountId(selectedMessage!)
        : selectedMessage!.senderAddress,
      subject: selectedMessage!.connector.providerKey === "slack"
        ? selectedMessage!.subject
        : selectedMessage!.subject ? `Re: ${selectedMessage!.subject.replace(/^Re:\s*/i, "")}` : null,
      body: draftBody.trim(),
    }),
    onSuccess: async (draft) => {
      setDraftBody("");
      await invalidate();
      setSelectedMessageId(draft.id);
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not save the reply draft."),
  });
  const createWork = useMutation({
    mutationFn: (messageId: string) => companyInboxApi.createWork(selectedCompanyId!, messageId),
    onSuccess: async (result) => {
      await invalidate();
      setSelectedMessageId(result.message.id);
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not create accountable work."),
  });
  const sendDraft = useMutation({
    mutationFn: (messageId: string) => companyInboxApi.sendDraft(selectedCompanyId!, messageId),
    onSuccess: async () => {
      setShowSendConfirm(false);
      await invalidate();
    },
    onError: (error) => {
      setShowSendConfirm(false);
      setActionError(error instanceof Error ? error.message : "Could not submit the provider reply.");
    },
  });
  const reconcileNotifications = useMutation({
    mutationFn: () => companyInboxApi.reconcileNotifications(selectedCompanyId!),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not reconcile board notifications."),
  });
  const retryNotification = useMutation({
    mutationFn: (deliveryId: string) => companyInboxApi.retryNotification(selectedCompanyId!, deliveryId),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not retry the notification."),
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Inbox} title="No company selected" message="Select a company to open its customer inbox." />;
  }

  const loading = connectorsQuery.isLoading || messagesQuery.isLoading;
  const automationSyncEligible = Boolean(
    selectedConnector
      && ["gmail", "slack", "zernio"].includes(selectedConnector.providerKey)
      && selectedConnector.status !== "revoked"
      && selectedConnector.credentialSecretId
      && selectedConnector.grantedScopes.includes("provider.sync"),
  );
  const automationWorkEligible = Boolean(
    selectedConnector?.ownerAgentId
      && selectedConnector.replyAuthority !== "none"
      && selectedConnector.grantedScopes.includes("work.create")
      && selectedConnector.grantedScopes.includes("messages.draft"),
  );
  const automationEligible = automationSyncEligible
    && (!selectedConnector?.automationCreateWork || automationWorkEligible);

  const automationFleetStats = computeFleetBudgetStats(
    selectedCompany?.budgetMonthlyCents ?? 0,
    agentsQuery.data ?? [],
  );
  const automationMarginalCostCents =
    fallbackCostPerRun("sonnet") *
    automationRunsPerMonth(selectedConnector?.automationIntervalMinutes ?? 60);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company inbox</p>
          <h1 className="text-xl font-semibold tracking-tight">Every customer conversation, one accountable owner</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Gmail, one exact Slack company channel, and Zernio social DMs/comments sync into a governed queue. Every reply binds an owner, exact target, authority decision, provider operation, and append-only receipt.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowRegister(true)}>
          <Plus className="h-4 w-4" />
          Register source
        </Button>
      </div>

      <Tabs value="customers" onValueChange={(value) => navigate(`/inbox/${value}`)}>
        <PageTabBar items={INBOX_TABS} value="customers" onValueChange={(value) => navigate(`/inbox/${value}`)} />
      </Tabs>

      {actionError ? <p role="alert" className="text-sm text-destructive">{actionError}</p> : null}
      {(connectorsQuery.isError || messagesQuery.isError || receiptsQuery.isError) ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <span>The customer inbox could not refresh.</span>
          <Button variant="outline" size="sm" onClick={() => void invalidate()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : null}

      {loading && connectors.length === 0 ? <PageSkeleton variant="inbox" /> : connectors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card">
          <EmptyState
            icon={Link2}
            title="No customer sources yet"
            message="Register an API, email, chat, social, or support source. Credentials stay in the provider connector; this contract stores only scope and evidence."
            action="Register first source"
            onAction={() => setShowRegister(true)}
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
          <section aria-labelledby="customer-inbox-sources" className="min-h-0 min-w-0 rounded-xl border border-border bg-card">
            <div className="border-b border-border p-3">
              <h2 id="customer-inbox-sources" className="text-sm font-semibold">Sources</h2>
              <p className="text-xs text-muted-foreground">{connectors.length} declared access contract{connectors.length === 1 ? "" : "s"}</p>
            </div>
            <div className="space-y-1 p-2">
              {connectors.map((connector) => {
                const active = connector.id === selectedConnectorId;
                return (
                  <button
                    key={connector.id}
                    type="button"
                    onClick={() => setSelectedConnectorId(connector.id)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      active ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-accent/50",
                    )}
                    aria-pressed={active}
                  >
                    <span className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-md bg-muted p-2 text-muted-foreground"><ConnectorIcon type={connector.channelType} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{connector.displayName}</span>
                          <Badge variant={connector.status === "revoked" ? "outline" : "secondary"}>{connector.status}</Badge>
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">{connector.accountLabel ?? CHANNEL_LABELS[connector.channelType]}</span>
                        <span className="mt-2 block text-xs text-muted-foreground">{formatFreshness(connector)}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="customer-inbox-conversations" className="min-h-0 min-w-0 rounded-xl border border-border bg-card">
            <div className="border-b border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 id="customer-inbox-conversations" className="text-sm font-semibold">Conversations</h2>
                <Badge variant="outline">{messages.filter((message) => message.status === "unread").length} unread</Badge>
              </div>
              {selectedConnector ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Owner: {selectedConnector.ownerAgentId ? ownerNameById.get(selectedConnector.ownerAgentId) ?? "Assigned employee" : "Board"}
                </p>
              ) : null}
            </div>
            <div className="space-y-1 p-2">
              {messages.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">No messages from this source yet.</p>
              ) : messages.map((message) => {
                const active = message.id === selectedMessageId;
                return (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => {
                        setSelectedMessageId(message.id);
                        setSearchParams({ messageId: message.id }, { replace: true });
                      }}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      active ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-accent/50",
                    )}
                    aria-pressed={active}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className={cn("truncate text-sm", message.status === "unread" && "font-semibold")}>{messageIdentity(message)}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(message.occurredAt)}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs font-medium">{message.subject ?? "No subject"}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{message.body}</span>
                    <span className="mt-2 flex items-center gap-2">
                      <Badge variant="outline">{message.status.replaceAll("_", " ")}</Badge>
                      <span className="truncate text-xs text-muted-foreground">{message.connector.displayName}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="customer-inbox-message" className="min-h-0 min-w-0 rounded-xl border border-border bg-card">
            {selectedMessage ? (
              <>
                <div className="border-b border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{messageIdentity(selectedMessage)} · {timeAgo(selectedMessage.occurredAt)}</p>
                      <h2 id="customer-inbox-message" className="mt-1 text-base font-semibold">{selectedMessage.subject ?? "No subject"}</h2>
                    </div>
                    <Badge variant={selectedMessage.status === "unread" ? "default" : "outline"}>{selectedMessage.status}</Badge>
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  <p className="break-words whitespace-pre-wrap text-sm leading-relaxed">{selectedMessage.body}</p>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4" /> Authority</div>
                    <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                      <dt className="text-muted-foreground">Reply</dt>
                      <dd className="break-words font-medium sm:text-right">{AUTHORITY_LABELS[selectedMessage.connector.replyAuthority]}</dd>
                      <dt className="text-muted-foreground">Scope</dt>
                      <dd className="break-words font-medium sm:text-right">{selectedMessage.connector.grantedScopes.length > 0 ? selectedMessage.connector.grantedScopes.join(", ") : "No scopes declared"}</dd>
                      <dt className="text-muted-foreground">Evidence</dt>
                      <dd className="break-words font-medium sm:text-right">{Object.keys(selectedMessage.evidence).length} fields</dd>
                      {selectedMessage.direction === "outbound" ? (
                        <>
                          <dt className="text-muted-foreground">Provider receipt</dt>
                          <dd className="break-words font-medium sm:text-right">{selectedMessage.providerOperationId ? "Recorded" : "Not submitted"}</dd>
                        </>
                      ) : null}
                    </dl>
                  </div>
                  {selectedMessage.workIssue ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium"><ListTodo className="h-4 w-4" /> Accountable work</p>
                          <p className="mt-1 break-words text-sm">{selectedMessage.workIssue.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{selectedMessage.workIssue.identifier ?? "Customer task"} · {selectedMessage.workIssue.priority} priority</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{selectedMessage.workIssue.status.replaceAll("_", " ")}</Badge>
                          <Button variant="outline" size="sm" onClick={() => navigate(`/issues/${selectedMessage.workIssue!.id}`)}>Open task</Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {selectedMessage.status === "unread" ? (
                      <Button variant="outline" size="sm" onClick={() => markRead.mutate(selectedMessage.id)} disabled={markRead.isPending}>
                        <Check className="h-4 w-4" /> Mark read
                      </Button>
                    ) : null}
                    {selectedMessage.status !== "archived" ? (
                      <Button variant="ghost" size="sm" onClick={() => archive.mutate(selectedMessage.id)} disabled={archive.isPending}>
                        <Archive className="h-4 w-4" /> Archive
                      </Button>
                    ) : null}
                    {selectedMessage.direction === "outbound" && selectedMessage.status === "draft"
                      && ["gmail", "slack", "zernio"].includes(selectedMessage.connector.providerKey)
                      && selectedMessage.connector.credentialSecretId
                      && selectedMessage.connector.grantedScopes.includes("messages.send") ? (
                      <Button size="sm" onClick={() => setShowSendConfirm(true)}>
                        <Send className="h-4 w-4" /> Send once
                      </Button>
                    ) : null}
                    {selectedMessage.status === "pending_approval" && selectedMessage.approvalId ? (
                      <Button variant="outline" size="sm" onClick={() => navigate(`/approvals/${selectedMessage.approvalId}`)}>
                        <ShieldCheck className="h-4 w-4" /> Review approval
                      </Button>
                    ) : null}
                    {selectedMessage.direction === "inbound"
                      && selectedMessage.connector.ownerAgentId
                      && selectedMessage.connector.grantedScopes.includes("work.create")
                      && !selectedMessage.workIssue ? (
                      <Button size="sm" onClick={() => createWork.mutate(selectedMessage.id)} disabled={createWork.isPending}>
                        <ListTodo className="h-4 w-4" /> Create accountable work
                      </Button>
                    ) : null}
                  </div>
                  {selectedMessage.status === "outcome_unknown" ? (
                    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                      {providerName(selectedMessage.connector.providerKey)} did not return a conclusive result. Automatic resend is blocked; reconcile the provider receipt before any new action.
                    </p>
                  ) : null}
                  {selectedMessage.direction === "inbound" && selectedMessage.connector.replyAuthority !== "none" ? (
                    <div className="space-y-2 border-t border-border pt-4">
                      <label htmlFor="company-inbox-draft" className="text-sm font-medium">Reply draft</label>
                      <Textarea
                        id="company-inbox-draft"
                        value={draftBody}
                        onChange={(event) => setDraftBody(event.target.value)}
                        placeholder="Draft a response for an explicit board send or agent approval."
                        rows={5}
                      />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">Saving creates an auditable draft. Submission is a separate governed action.</p>
                        <Button className="self-end" size="sm" onClick={() => createDraft.mutate()} disabled={!draftBody.trim() || createDraft.isPending}>Save draft</Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">Choose a conversation to inspect its authority and evidence.</div>
            )}
          </section>
        </div>
      )}

      {selectedConnector ? (
        <section aria-labelledby="company-inbox-support-loop" className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-3">
            <div>
              <h2 id="company-inbox-support-loop" className="flex items-center gap-2 text-sm font-semibold">
                <Play className="h-4 w-4" /> Support loop
                <Badge variant={selectedConnector.automationStatus === "active" ? "secondary" : "outline"}>
                  {selectedConnector.automationStatus ?? "paused"}
                </Badge>
              </h2>
              <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                Watches for new customer messages and creates accountable internal work. It never sends a customer reply; drafts, approvals, and the board send remain separate.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAutomationConfig(true)} disabled={!automationSyncEligible}>
                <Settings2 className="h-4 w-4" /> Configure
              </Button>
              {selectedConnector.automationStatus === "active" ? (
                <Button variant="outline" size="sm" onClick={() => pauseAutomation.mutate(selectedConnector.id)} disabled={pauseAutomation.isPending}>
                  <Pause className="h-4 w-4" /> Pause
                </Button>
              ) : (
                <Button size="sm" onClick={() => startAutomation.mutate(selectedConnector.id)} disabled={!automationEligible || startAutomation.isPending}>
                  <Play className="h-4 w-4" /> Start
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => runAutomation.mutate(selectedConnector.id)} disabled={selectedConnector.automationStatus !== "active" || runAutomation.isPending}>
                <RefreshCw className={cn("h-4 w-4", runAutomation.isPending && "animate-spin")} /> Run now
              </Button>
            </div>
          </div>
          {selectedConnector.automationStatus !== "active" && (
            <div className="px-3 pb-3">
              <BudgetCounterfactual
                marginalCostCents={automationMarginalCostCents}
                companyBudgetMonthlyCents={automationFleetStats.companyBudgetMonthlyCents}
                totalFleetSpentCents={automationFleetStats.totalFleetSpentCents}
                totalFleetRuns={automationFleetStats.totalFleetRuns}
                modelTier="sonnet"
              />
            </div>
          )}
          <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Cadence</p>
              <p className="mt-1 text-sm font-medium">{automationIntervalLabel(selectedConnector.automationIntervalMinutes ?? 60)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Action</p>
              <p className="mt-1 text-sm font-medium">{selectedConnector.automationCreateWork === false ? "Sync inbox only" : "Create owned work"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last success</p>
              <p className="mt-1 text-sm font-medium">{selectedConnector.automationLastSuccessAt ? timeAgo(selectedConnector.automationLastSuccessAt) : "Not run yet"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Next run</p>
              <p className="mt-1 text-sm font-medium">{selectedConnector.automationNextRunAt ? timeAgo(selectedConnector.automationNextRunAt) : "Paused"}</p>
            </div>
          </div>
          {selectedConnector.automationLastError ? (
            <p role="alert" className="border-t border-border px-3 py-2 text-xs text-destructive">
              Last run failed ({selectedConnector.automationFailureCount}): {selectedConnector.automationLastError}
            </p>
          ) : !automationSyncEligible ? (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Connect a managed Gmail, Slack, or Zernio source with provider sync authority to enable this loop.</p>
          ) : selectedConnector.automationCreateWork !== false && !automationWorkEligible ? (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Choose an accountable owner and grant draft plus work-create authority before starting.</p>
          ) : null}
        </section>
      ) : null}

      {selectedConnector ? (
        <section aria-labelledby="company-inbox-receipts" className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-3">
            <div>
              <h2 id="company-inbox-receipts" className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4" /> Provider custody & receipts</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedConnector.credentialSecretId ? "Credential bound in the company secret store" : "No provider credential bound"}
                {selectedConnector.providerKey === "gmail" && selectedConnector.evidence.sync ? " · mailbox verified by Gmail" : ""}
                {selectedConnector.providerKey === "slack" && selectedConnector.evidence.sync ? " · workspace and channel verified by Slack" : ""}
                {selectedConnector.providerKey === "zernio" && selectedConnector.evidence.sync ? " · social profile verified by Zernio" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["gmail", "slack", "zernio"].includes(selectedConnector.providerKey) && selectedConnector.credentialSecretId
                && selectedConnector.grantedScopes.includes("provider.sync") && selectedConnector.status !== "revoked" ? (
                <Button variant="outline" size="sm" onClick={() => sync.mutate(selectedConnector.id)} disabled={sync.isPending}>
                  <RefreshCw className={cn("h-4 w-4", sync.isPending && "animate-spin")} /> Sync {providerName(selectedConnector.providerKey)}
                </Button>
              ) : null}
              {selectedConnector.status !== "revoked" ? (
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(selectedConnector.id)} disabled={revoke.isPending}>
                  <Unplug className="h-4 w-4" /> Revoke access
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 p-3 md:grid-cols-3">
            <dl className="grid content-start gap-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Source</dt><dd className="text-right font-medium">{selectedConnector.displayName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Channel</dt><dd className="text-right font-medium">{CHANNEL_LABELS[selectedConnector.channelType]}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Authority</dt><dd className="text-right font-medium">{AUTHORITY_LABELS[selectedConnector.replyAuthority]}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Freshness</dt><dd className="text-right font-medium">{formatFreshness(selectedConnector)}</dd></div>
            </dl>
            <div className="space-y-2 md:col-span-2">
              {receiptsQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading provider receipts…</p>
              ) : receipts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No provider receipts yet.</p>
              ) : receipts.slice(0, 6).map((receipt) => (
                <div key={receipt.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 p-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium capitalize">{receiptLabel(receipt)}</p>
                    <p className="mt-0.5 break-words text-muted-foreground">{receipt.summary}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="outline">{receipt.status.replaceAll("_", " ")}</Badge>
                    <p className="mt-1 text-muted-foreground">{timeAgo(receipt.occurredAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {selectedConnector?.providerKey === "slack" ? (
        <section aria-labelledby="company-board-notifications" className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-3">
            <div>
              <h2 id="company-board-notifications" className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4" /> Board notifications
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Exact-channel alerts for decisions, customer messages, hard stops, high-severity conditions, Nightshift outcomes, and daily briefs. Message bodies and credentials never enter this rail.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reconcileNotifications.mutate()}
              disabled={reconcileNotifications.isPending || !selectedConnector.grantedScopes.includes("notifications.send")}
            >
              <RefreshCw className={cn("h-4 w-4", reconcileNotifications.isPending && "animate-spin")} /> Deliver due
            </Button>
          </div>
          <CompanyNotificationPreferences companyId={selectedCompanyId} />
          <div className="grid gap-3 p-3 md:grid-cols-3">
            <dl className="grid content-start gap-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Authority</dt><dd className="text-right font-medium">{selectedConnector.grantedScopes.includes("notifications.send") ? "Granted" : "Not granted"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Pending</dt><dd className="text-right font-medium tabular-nums">{notificationStatusQuery.data?.pending ?? 0}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Failed</dt><dd className="text-right font-medium tabular-nums">{notificationStatusQuery.data?.failed ?? 0}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Unknown</dt><dd className="text-right font-medium tabular-nums">{notificationStatusQuery.data?.outcomeUnknown ?? 0}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Delivered</dt><dd className="text-right font-medium tabular-nums">{notificationStatusQuery.data?.delivered ?? 0}</dd></div>
            </dl>
            <div className="space-y-2 md:col-span-2">
              {notificationsQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading notification receipts…</p>
              ) : notifications.length === 0 ? (
                <p className="text-xs text-muted-foreground">No eligible company event has been captured for this channel yet.</p>
              ) : notifications.slice(0, 6).map((delivery) => (
                <div key={delivery.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 p-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{delivery.title}</p>
                    <p className="mt-0.5 break-words text-muted-foreground">{delivery.summary}</p>
                    <p className="mt-1 text-muted-foreground">{delivery.receipts.length} receipt{delivery.receipts.length === 1 ? "" : "s"} · attempt {delivery.attemptCount}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={delivery.status === "failed" || delivery.status === "outcome_unknown" ? "destructive" : "outline"} className="capitalize">
                      {notificationStatusLabel(delivery)}
                    </Badge>
                    <p className="mt-1 text-muted-foreground">{timeAgo(delivery.updatedAt)}</p>
                    {delivery.status === "failed" && delivery.attemptCount < 5 ? (
                      <Button variant="ghost" size="sm" className="mt-1" onClick={() => retryNotification.mutate(delivery.id)} disabled={retryNotification.isPending}>
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <RegisterSourceDialog
        open={showRegister}
        onOpenChange={setShowRegister}
        companyId={selectedCompanyId}
        agents={(agentsQuery.data ?? []).map((agent) => ({ id: agent.id, name: agent.name }))}
        secrets={(secretsQuery.data ?? []).filter((secret) => secret.status === "active")}
        onRegistered={async (connector) => {
          setSelectedConnectorId(connector.id);
          await invalidate();
        }}
      />

      <Dialog open={showAutomationConfig} onOpenChange={setShowAutomationConfig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure the support loop</DialogTitle>
            <DialogDescription>
              The server polls this exact source on schedule. New inbound messages can become owned internal tasks, but the loop cannot send customer replies.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Check for messages</span>
              <select
                value={automationIntervalMinutes}
                onChange={(event) => setAutomationIntervalMinutes(Number(event.target.value) as CompanyInboxAutomationIntervalMinutes)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {AUTOMATION_INTERVAL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={automationCreateWork}
                onChange={(event) => setAutomationCreateWork(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>
                <span className="block font-medium">Create accountable work</span>
                <span className="mt-1 block text-xs text-muted-foreground">One idempotent high-priority task per inbound message, assigned to this source’s owner.</span>
              </span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Operating context</span>
              <Textarea
                value={automationPrompt}
                onChange={(event) => setAutomationPrompt(event.target.value)}
                placeholder="Optional instructions for the owner, such as response standards or escalation rules."
                rows={5}
                maxLength={4000}
              />
              <span className="block text-xs text-muted-foreground">This context is added to internal work only. It cannot expand send, spend, publish, or approval authority.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutomationConfig(false)}>Cancel</Button>
            <Button
              onClick={() => configureAutomation.mutate()}
              disabled={!automationSyncEligible || (automationCreateWork && !automationWorkEligible) || configureAutomation.isPending}
            >
              Save configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this {selectedMessage ? providerName(selectedMessage.connector.providerKey) : "provider"} reply once?</DialogTitle>
            <DialogDescription>
              This is an irreversible board action. Summon will submit the exact saved draft to one target and record the provider operation.
            </DialogDescription>
          </DialogHeader>
          {selectedMessage?.direction === "outbound" ? (
            <dl className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Recipient</dt><dd className="break-all text-right font-medium">{selectedMessage.recipientAddress}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subject</dt><dd className="break-words text-right font-medium">{selectedMessage.subject ?? "No subject"}</dd></div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendConfirm(false)}>Cancel</Button>
            <Button onClick={() => selectedMessage && sendDraft.mutate(selectedMessage.id)} disabled={!selectedMessage || sendDraft.isPending}>
              <Send className="h-4 w-4" /> Send once
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegisterSourceDialog({
  open,
  onOpenChange,
  companyId,
  agents,
  secrets,
  onRegistered,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  agents: Array<{ id: string; name: string }>;
  secrets: CompanySecret[];
  onRegistered: (connector: CompanyInboxConnector) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [providerKey, setProviderKey] = useState("gmail");
  const [externalAccountId, setExternalAccountId] = useState("");
  const [slackTeamId, setSlackTeamId] = useState("");
  const [slackChannelIdValue, setSlackChannelIdValue] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [channelType, setChannelType] = useState<CompanyInboxChannelType>("email");
  const [replyAuthority, setReplyAuthority] = useState<CompanyInboxReplyAuthority>("approval_required");
  const [ownerAgentId, setOwnerAgentId] = useState("");
  const [credentialSecretId, setCredentialSecretId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isGmail = providerKey.trim().toLowerCase() === "gmail";
  const isSlack = providerKey.trim().toLowerCase() === "slack";
  const isZernio = providerKey.trim().toLowerCase() === "zernio";
  const isManaged = isGmail || isSlack || isZernio;
  const managedExternalAccountId = isSlack
    ? `${slackTeamId.trim().toUpperCase()}:${slackChannelIdValue.trim().toUpperCase()}`
    : externalAccountId.trim();
  const register = useMutation({
    mutationFn: () => companyInboxApi.registerConnector(companyId, {
      providerKey: providerKey.trim(),
      externalAccountId: managedExternalAccountId,
      displayName: displayName.trim(),
      channelType,
      accountLabel: accountLabel.trim() || (isGmail ? externalAccountId.trim() : isSlack ? managedExternalAccountId : isZernio ? `Zernio · ${externalAccountId.trim()}` : null),
      ownerAgentId: ownerAgentId || null,
      credentialSecretId: isManaged ? credentialSecretId || null : null,
      replyAuthority,
      grantedScopes: isManaged
        ? ["messages.read", "messages.draft", "messages.propose", "messages.send", "provider.sync", "work.create", ...(isSlack ? ["notifications.send"] : [])]
        : replyAuthority === "none"
          ? ["messages.read", ...(ownerAgentId ? ["work.create"] : [])]
          : ["messages.read", "messages.draft", ...(ownerAgentId ? ["work.create"] : [])],
    }),
    onSuccess: async (connector) => {
      await onRegistered(connector);
      onOpenChange(false);
      setDisplayName("");
      setExternalAccountId("");
      setSlackTeamId("");
      setSlackChannelIdValue("");
      setAccountLabel("");
      setError(null);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Could not register the source."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register customer source</DialogTitle>
          <DialogDescription>
            Managed Gmail, Slack, and Zernio sources use one existing company secret and verify an exact mailbox, workspace-channel, or social profile identity. No credential value is displayed or copied into this form.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Name</span>
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Support inbox" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Provider key</span>
            <Input value={providerKey} onChange={(event) => {
              const value = event.target.value.toLowerCase();
              setProviderKey(value);
              if (value === "gmail") {
                setChannelType("email");
                setReplyAuthority("approval_required");
              }
              if (value === "slack") {
                setChannelType("chat");
                setReplyAuthority("approval_required");
              }
              if (value === "zernio") {
                setChannelType("social");
                setReplyAuthority("approval_required");
              }
            }} placeholder="gmail" />
          </label>
          {isSlack ? (
            <>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Slack workspace ID</span>
                <Input value={slackTeamId} onChange={(event) => setSlackTeamId(event.target.value)} placeholder="T12345678" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Public channel ID</span>
                <Input value={slackChannelIdValue} onChange={(event) => setSlackChannelIdValue(event.target.value)} placeholder="C12345678" />
              </label>
            </>
          ) : (
            <label className="space-y-1 text-sm">
              <span className="font-medium">{isGmail ? "Gmail mailbox" : isZernio ? "Zernio profile ID" : "Account ID"}</span>
              <Input type={isGmail ? "email" : "text"} value={externalAccountId} onChange={(event) => setExternalAccountId(event.target.value)} placeholder={isGmail ? "support@example.com" : isZernio ? "profile_123456" : "stable-provider-id"} />
            </label>
          )}
          <label className="space-y-1 text-sm">
            <span className="font-medium">Account label</span>
            <Input value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} placeholder="support@example.com" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Channel</span>
            <select value={channelType} onChange={(event) => setChannelType(event.target.value as CompanyInboxChannelType)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {Object.entries(CHANNEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Reply authority</span>
            <select value={replyAuthority} onChange={(event) => setReplyAuthority(event.target.value as CompanyInboxReplyAuthority)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {Object.entries(AUTHORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">Accountable owner</span>
            <select value={ownerAgentId} onChange={(event) => setOwnerAgentId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Board</option>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          </label>
          {isManaged ? (
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="font-medium">{providerName(providerKey)} access-token secret</span>
              <select value={credentialSecretId} onChange={(event) => setCredentialSecretId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select an active company secret</option>
                {secrets.map((secret) => <option key={secret.id} value={secret.id}>{secret.name}</option>)}
              </select>
              <span className="block text-xs text-muted-foreground">
                {isSlack ? "Slack boundary: one active, non-shared public channel that the app bot already joined; provider scopes channels:read, channels:history, and chat:write. " : ""}
                {isZernio ? "Zernio boundary: one exact profile; bounded DMs and organic comments only. It does not initiate conversations, auto-reply, react, like, hide, or delete. " : ""}
                Fixed Summon grant: read, draft, propose, send, and bounded provider sync. Replies require the accountable owner and board approval; the board may also send an exact saved draft directly.
              </span>
            </label>
          ) : null}
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => register.mutate()}
            disabled={!displayName.trim() || !providerKey.trim() || !managedExternalAccountId || register.isPending
              || (isManaged && (!credentialSecretId || !ownerAgentId || replyAuthority !== "approval_required"
                || (isGmail && channelType !== "email") || (isSlack && channelType !== "chat") || (isZernio && channelType !== "social")))
              || (isSlack && (!/^T[A-Z0-9]{6,}$/.test(slackTeamId.trim().toUpperCase())
                || !/^C[A-Z0-9]{6,}$/.test(slackChannelIdValue.trim().toUpperCase())))}
          >
            Register source
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
