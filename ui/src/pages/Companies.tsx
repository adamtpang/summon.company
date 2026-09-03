import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { aetherPortfolioApi } from "../api/aetherPortfolio";
import { queryKeys } from "../lib/queryKeys";
import { formatCents, relativeTime } from "../lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Pencil,
  Check,
  X,
  Plus,
  MoreHorizontal,
  Settings2,
  Users,
  CircleDot,
  DollarSign,
  Calendar,
} from "lucide-react";

export function Companies() {
  const {
    companies,
    selectedCompanyId,
    setSelectedCompanyId,
    loading,
    error,
  } = useCompany();
  const { openOnboarding } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: queryKeys.companies.stats,
    queryFn: () => companiesApi.stats(),
  });
  const { data: portfolio } = useQuery({
    queryKey: queryKeys.aetherPortfolio.snapshot,
    queryFn: aetherPortfolioApi.get,
    retry: false,
  });
  const healthByCompanyId = new Map((portfolio?.companies ?? []).flatMap((entry) => (
    entry.businessHealth?.companyId ? [[entry.businessHealth.companyId, entry] as const] : []
  )));

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const editMutation = useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) =>
      companiesApi.update(id, { name: newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      setEditingId(null);
    },
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Companies" }]);
  }, [setBreadcrumbs]);

  function startEdit(companyId: string, currentName: string) {
    setEditingId(companyId);
    setEditName(currentName);
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    editMutation.mutate({ id: editingId, newName: editName.trim() });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => openOnboarding()}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Company
        </Button>
      </div>

      <div className="h-6">
        {loading && <p className="text-sm text-muted-foreground">Loading companies...</p>}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
      </div>

      <div className="grid gap-4">
        {companies.map((company) => {
          const selected = company.id === selectedCompanyId;
          const isEditing = editingId === company.id;
          const companyStats = stats?.[company.id];
          const fleetEntry = healthByCompanyId.get(company.id);
          const agentCount = companyStats?.agentCount ?? 0;
          const issueCount = companyStats?.issueCount ?? 0;
          const budgetPct =
            company.budgetMonthlyCents > 0
              ? Math.round(
                  (company.spentMonthlyCents / company.budgetMonthlyCents) * 100,
                )
              : 0;

          return (
            <Card
              key={company.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedCompanyId(company.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedCompanyId(company.id);
                }
              }}
              interactive
              className={`block group text-left p-5 ${
                selected ? "border-primary ring-1 ring-primary hover:border-primary" : ""
              }`}
            >
              {/* Header row: name + menu */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={saveEdit}
                        disabled={editMutation.isPending}
                      >
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{company.name}</h3>
                      <Badge variant="ghost"
                        className={`text-(length:--text-micro) ${
                          company.status === "active"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : company.status === "paused"
                              ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {company.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(company.id, company.name);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {company.description && !isEditing && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {company.description}
                    </p>
                  )}
                </div>

                {/* Three-dot menu */}
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => startEdit(company.id, company.name)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedCompanyId(company.id);
                          navigate("/company/settings");
                        }}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Manage lifecycle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Stats row */}
              {fleetEntry ? (
                <div className="mt-4 border-y border-border py-3">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <p className="font-console text-xs uppercase tracking-(--tracking-eyebrow) text-muted-foreground">Core-8 health</p>
                      <p className="mt-1 font-bold tabular-nums">
                        {fleetEntry.businessHealth.score === null ? "Stewardship" : `${fleetEntry.businessHealth.score}/100`}
                      </p>
                    </div>
                    <div>
                      <p className="font-console text-xs uppercase tracking-(--tracking-eyebrow) text-muted-foreground">Weakest</p>
                      <p className="mt-1 font-bold">{fleetEntry.businessHealth.bindingConstraint?.label ?? "Beneficiary evidence"}</p>
                    </div>
                    <div>
                      <p className="font-console text-xs uppercase tracking-(--tracking-eyebrow) text-muted-foreground">Unit cost · ask · floor</p>
                      <p className="mt-1 font-bold tabular-nums">
                        {fleetEntry.unitEconomics.unitCostCents === null ? "—" : formatCents(fleetEntry.unitEconomics.unitCostCents)} · {fleetEntry.unitEconomics.askPriceCents === null ? "—" : formatCents(fleetEntry.unitEconomics.askPriceCents)} · {fleetEntry.unitEconomics.minimumSustainablePriceCents === null ? "—" : formatCents(fleetEntry.unitEconomics.minimumSustainablePriceCents)}
                      </p>
                    </div>
                    <div>
                      <p className="font-console text-xs uppercase tracking-(--tracking-eyebrow) text-muted-foreground">Next action</p>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{fleetEntry.businessHealth.nextAction}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-3 sm:gap-5 mt-4 text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {agentCount} {agentCount === 1 ? "agent" : "agents"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CircleDot className="h-3.5 w-3.5" />
                  <span>
                    {issueCount} {issueCount === 1 ? "task" : "tasks"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 tabular-nums">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>
                    {formatCents(company.spentMonthlyCents)}
                    {company.budgetMonthlyCents > 0
                      ? <> / {formatCents(company.budgetMonthlyCents)} <span className="text-xs">({budgetPct}%)</span></>
                      : <span className="text-xs ml-1">Unlimited budget</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Created {relativeTime(company.createdAt)}</span>
                </div>
              </div>

            </Card>
          );
        })}
      </div>
    </div>
  );
}
