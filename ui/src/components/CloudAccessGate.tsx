import { Navigate, Outlet, useLocation } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accessApi } from "@/api/access";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth";
import { healthApi } from "@/api/health";
import { queryKeys } from "@/lib/queryKeys";
import { BootstrapPendingPage } from "@/components/BootstrapPendingPage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function AccountInactivePage() {
  const queryClient = useQueryClient();
  const reactivateMutation = useMutation({
    mutationFn: () => authApi.reactivateAccount(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.lifecycle });
      await queryClient.invalidateQueries({ queryKey: queryKeys.access.currentBoardAccess });
    },
  });
  const signOutMutation = useMutation({
    mutationFn: () => authApi.signOut(),
    onSuccess: () => queryClient.setQueryData(queryKeys.auth.session, null),
  });
  const error = reactivateMutation.error ?? signOutMutation.error;

  return (
    <div className="mx-auto max-w-xl py-10">
      <Card className="block space-y-4 p-6">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Account deactivated</h1>
          <p className="text-sm text-muted-foreground">
            Your companies and their evidence still exist, but this identity has no active authority. Reactivating
            does not restore company memberships, API keys, permission grants, or paused routines.
          </p>
        </div>
        {error ? <p className="text-sm text-destructive" role="alert">{error instanceof Error ? error.message : "Account action failed."}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => reactivateMutation.mutate()} disabled={reactivateMutation.isPending || signOutMutation.isPending}>
            {reactivateMutation.isPending ? "Reactivating…" : "Reactivate account"}
          </Button>
          <Button variant="outline" onClick={() => signOutMutation.mutate()} disabled={reactivateMutation.isPending || signOutMutation.isPending}>
            {signOutMutation.isPending ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function NoBoardAccessPage() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <Card className="block p-6">
        <h1 className="text-xl font-semibold">No company access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account is signed in, but it does not have an active company membership or instance-admin access on
          this Summon instance.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Use a company invite or sign in with an account that already belongs to this org.
        </p>
      </Card>
    </div>
  );
}

export function CloudAccessGate() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as
        | { deploymentMode?: "local_trusted" | "authenticated"; bootstrapStatus?: "ready" | "bootstrap_pending" }
        | undefined;
      return data?.deploymentMode === "authenticated" && data.bootstrapStatus === "bootstrap_pending"
        ? 2000
        : false;
    },
    refetchIntervalInBackground: true,
  });

  const isAuthenticatedMode = healthQuery.data?.deploymentMode === "authenticated";
  const isBootstrapPending = isAuthenticatedMode && healthQuery.data?.bootstrapStatus === "bootstrap_pending";
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    enabled: isAuthenticatedMode,
    retry: false,
  });

  const boardAccessQuery = useQuery({
    queryKey: queryKeys.access.currentBoardAccess,
    queryFn: () => accessApi.getCurrentBoardAccess(),
    enabled:
      isAuthenticatedMode &&
      !isBootstrapPending &&
      sessionQuery.data?.user.accountState === "active",
    retry: false,
  });
  const claimMutation = useMutation({
    mutationFn: () => accessApi.claimBootstrapAdmin(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.health });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.stats });
      await queryClient.invalidateQueries({ queryKey: queryKeys.access.currentBoardAccess });
    },
  });

  if (
    healthQuery.isLoading ||
    (isAuthenticatedMode && sessionQuery.isLoading) ||
    (isAuthenticatedMode && !isBootstrapPending && sessionQuery.data?.user.accountState === "active" && boardAccessQuery.isLoading)
  ) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  if (healthQuery.error || boardAccessQuery.error) {
    return (
      <div className="mx-auto max-w-xl py-10 text-sm text-destructive">
        {healthQuery.error instanceof Error
          ? healthQuery.error.message
          : boardAccessQuery.error instanceof Error
            ? boardAccessQuery.error.message
            : "Failed to load app state"}
      </div>
    );
  }

  if (isAuthenticatedMode && sessionQuery.data?.user.accountState === "deactivated") {
    return <AccountInactivePage />;
  }

  if (isBootstrapPending) {
    const health = healthQuery.data;
    if (!health) {
      return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading...</div>;
    }
    const claimError = claimMutation.error instanceof ApiError
      ? { status: claimMutation.error.status, message: claimMutation.error.message }
      : claimMutation.error instanceof Error
        ? { message: claimMutation.error.message }
        : null;
    return (
      <BootstrapPendingPage
        claimAvailable={health.deploymentExposure === "private"}
        hasActiveInvite={health.bootstrapInviteActive}
        session={sessionQuery.data}
        claimState={claimMutation.isSuccess ? "success" : claimMutation.isPending ? "claiming" : "idle"}
        claimError={claimError}
        onClaim={() => claimMutation.mutate()}
      />
    );
  }

  if (isAuthenticatedMode && !sessionQuery.data) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  if (
    isAuthenticatedMode &&
    sessionQuery.data &&
    !boardAccessQuery.data?.isInstanceAdmin &&
    (boardAccessQuery.data?.companyIds.length ?? 0) === 0
  ) {
    return <NoBoardAccessPage />;
  }

  return <Outlet />;
}
