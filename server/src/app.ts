import express, { Router, type Request as ExpressRequest } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { Db } from "@paperclipai/db";
import type { DeploymentExposure, DeploymentMode } from "@paperclipai/shared";
import type { InspectDatabaseBackupHealthOptions } from "./services/database-backup-health.js";
import type { StorageService } from "./storage/types.js";
import { httpLogger, errorHandler } from "./middleware/index.js";
import { actorMiddleware } from "./middleware/auth.js";
import { accountLifecycleGuard } from "./middleware/account-lifecycle.js";
import { boardMutationGuard } from "./middleware/board-mutation-guard.js";
import { privateHostnameGuard, resolvePrivateHostnameAllowSet } from "./middleware/private-hostname-guard.js";
import { applyTrustProxy, parseTrustProxyEnv } from "./middleware/trust-proxy.js";
import { healthRoutes } from "./routes/health.js";
import { companyRoutes } from "./routes/companies.js";
import { companySkillRoutes } from "./routes/company-skills.js";
import { builtInAgentRoutes } from "./routes/built-in-agents.js";
import { teamsCatalogRoutes } from "./routes/teams-catalog.js";
import { agentRoutes } from "./routes/agents.js";
import { projectRoutes } from "./routes/projects.js";
import { registerTruthRoutes } from "./routes/register-truth.js";
import { issueRoutes } from "./routes/issues.js";
import { issueTreeControlRoutes } from "./routes/issue-tree-control.js";
import { caseRoutes } from "./routes/cases.js";
import { fileResourceRoutes } from "./routes/file-resources.js";
import { routineRoutes } from "./routes/routines.js";
import { pipelineRoutes } from "./routes/pipelines.js";
import { vitalsAiSdrRoutes } from "./routes/vitals-ai-sdr.js";
import { environmentRoutes } from "./routes/environments.js";
import { executionWorkspaceRoutes } from "./routes/execution-workspaces.js";
import { goalRoutes } from "./routes/goals.js";
import { boardChatRoutes } from "./routes/board-chat.js";
import { approvalRoutes } from "./routes/approvals.js";
import { secretRoutes } from "./routes/secrets.js";
import { costRoutes } from "./routes/costs.js";
import { subscriptionRoutes } from "./routes/subscriptions.js";
import { policyLedgerRoutes } from "./routes/policy-ledger.js";
import { fleetRoutes } from "./routes/fleet.js";
import { activityRoutes } from "./routes/activity.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { companyLoopRoutes } from "./routes/company-loop.js";
import { aetherPortfolioRoutes } from "./routes/aether-portfolio.js";
import { attentionRoutes } from "./routes/attention.js";
import { userProfileRoutes } from "./routes/user-profiles.js";
import { sidebarBadgeRoutes } from "./routes/sidebar-badges.js";
import { sidebarPreferenceRoutes } from "./routes/sidebar-preferences.js";
import { resourceMembershipRoutes } from "./routes/resource-memberships.js";
import { inboxDismissalRoutes } from "./routes/inbox-dismissals.js";
import { companyInboxRoutes } from "./routes/company-inbox.js";
import { companyNotificationRoutes } from "./routes/company-notifications.js";
import { companyWebsiteRoutes } from "./routes/company-website.js";
import { companyPaymentRoutes } from "./routes/company-payments.js";
import { companyFinanceRoutes } from "./routes/company-finance.js";
import { companyPaymentWebhookRoutes } from "./routes/company-payment-webhooks.js";
import { companySocialRoutes } from "./routes/company-social.js";
import { companySocialWebhookRoutes } from "./routes/company-social-webhooks.js";
import { companyOutreachRoutes } from "./routes/company-outreach.js";
import { companyMediaRoutes } from "./routes/company-media.js";
import { companyOutreachUnsubscribeRoutes } from "./routes/company-outreach-unsubscribe.js";
import { companyOutreachWebhookRoutes } from "./routes/company-outreach-webhooks.js";
import { companyAdsRoutes } from "./routes/company-ads.js";
import { companyStackRoutes } from "./routes/company-stack.js";
import { companyStackDatabaseSnapshotRoutes } from "./routes/company-stack-database-snapshots.js";
import { companyMobileBuildRoutes } from "./routes/company-mobile-builds.js";
import { companyMobileWebhookRoutes } from "./routes/company-mobile-webhooks.js";
import { companyAiGatewayRoutes } from "./routes/company-ai-gateway.js";
import { companyAiGatewayInferenceRoutes } from "./routes/company-ai-gateway-inference.js";
import { companyPublicRoutes } from "./routes/company-public.js";
import { instanceSettingsRoutes } from "./routes/instance-settings.js";
import { openApiRoutes } from "./routes/openapi.js";
import {
  instanceDatabaseBackupRoutes,
  type InstanceDatabaseBackupService,
} from "./routes/instance-database-backups.js";
import { llmRoutes } from "./routes/llms.js";
import { authRoutes } from "./routes/auth.js";
import { assetRoutes } from "./routes/assets.js";
import { accessRoutes } from "./routes/access.js";
import { pluginRoutes } from "./routes/plugins.js";
import { adapterRoutes } from "./routes/adapters.js";
import { pluginUiStaticRoutes } from "./routes/plugin-ui-static.js";
import { readBrandedStaticIndexHtml, resolveStaticUiDist } from "./static-index-html.js";
import { applyUiBranding } from "./ui-branding.js";
import { logger } from "./middleware/logger.js";
import { DEFAULT_LOCAL_PLUGIN_DIR, pluginLoader } from "./services/plugin-loader.js";
import { createPluginWorkerManager, type PluginWorkerManager } from "./services/plugin-worker-manager.js";
import { createPluginJobScheduler } from "./services/plugin-job-scheduler.js";
import { pluginJobStore } from "./services/plugin-job-store.js";
import { createPluginToolDispatcher } from "./services/plugin-tool-dispatcher.js";
import { pluginLifecycleManager } from "./services/plugin-lifecycle.js";
import { createPluginJobCoordinator } from "./services/plugin-job-coordinator.js";
import { buildHostServices, flushPluginLogBuffer } from "./services/plugin-host-services.js";
import { createPluginEventBus } from "./services/plugin-event-bus.js";
import { setPluginEventBus } from "./services/activity-log.js";
import { createPluginDevWatcher } from "./services/plugin-dev-watcher.js";
import { createPluginHostServiceCleanup } from "./services/plugin-host-service-cleanup.js";
import { pluginRegistryService } from "./services/plugin-registry.js";
import { companyPublicService } from "./services/company-public.js";
import { createPublicCompanyRateLimiter } from "./services/public-company-rate-limit.js";
import {
  classifyPublicCompanyHost,
  injectPublicCompanyMetadata,
  parsePublicCompanyBaseUrl,
  publicCompanyCanonicalUrl,
} from "./public-company-html.js";
import { createHostClientHandlers } from "@paperclipai/plugin-sdk";
import type { BetterAuthSessionResult } from "./auth/better-auth.js";
import { createCachedViteHtmlRenderer } from "./vite-html-renderer.js";
import { DEFAULT_JSON_BODY_LIMIT, PORTABLE_JSON_BODY_LIMIT } from "./http/body-limits.js";
import { COMPANY_IMPORT_API_PATH } from "./routes/company-import-paths.js";
import { apiCompression } from "./middleware/api-compression.js";

type UiMode = "none" | "static" | "vite-dev";
const FEEDBACK_EXPORT_FLUSH_INTERVAL_MS = 5_000;
const VITE_DEV_ASSET_PREFIXES = [
  "/@fs/",
  "/@id/",
  "/@react-refresh",
  "/@vite/",
  "/assets/",
  "/node_modules/",
  "/src/",
];
const VITE_DEV_STATIC_PATHS = new Set([
  "/apple-touch-icon.png",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/favicon.ico",
  "/favicon.svg",
  "/site.webmanifest",
  "/sw.js",
]);

export function isDatabaseConnectionUnavailableError(err: unknown): boolean {
  const error = err as { code?: unknown; message?: unknown; cause?: unknown };
  if (error?.code === "ECONNREFUSED") return true;
  return Boolean(error?.cause && isDatabaseConnectionUnavailableError(error.cause));
}

export function resolveViteHmrPort(serverPort: number): number {
  if (serverPort <= 55_535) {
    return serverPort + 10_000;
  }
  return Math.max(1_024, serverPort - 10_000);
}

export function resolveViteHmrHost(bindHost: string): string | undefined {
  const normalized = bindHost.trim().toLowerCase();
  if (normalized === "0.0.0.0" || normalized === "::") return undefined;
  return bindHost;
}

export function shouldServeViteDevHtml(req: ExpressRequest): boolean {
  const pathname = req.path;
  if (VITE_DEV_STATIC_PATHS.has(pathname)) return false;
  if (VITE_DEV_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  return req.accepts(["html"]) === "html";
}

export function shouldEnablePrivateHostnameGuard(opts: {
  deploymentMode: DeploymentMode;
  deploymentExposure: DeploymentExposure;
}): boolean {
  return (
    opts.deploymentExposure === "private" &&
    (opts.deploymentMode === "local_trusted" || opts.deploymentMode === "authenticated")
  );
}

export async function createApp(
  db: Db,
  opts: {
    uiMode: UiMode;
    serverPort: number;
    storageService: StorageService;
    feedbackExportService?: {
      flushPendingFeedbackTraces(input?: {
        companyId?: string;
        traceId?: string;
        limit?: number;
        now?: Date;
      }): Promise<unknown>;
    };
    databaseBackupService?: InstanceDatabaseBackupService;
    databaseBackupHealth?: InspectDatabaseBackupHealthOptions;
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    allowedHostnames: string[];
    bindHost: string;
    publicCompanyBaseUrl?: string | null;
    billingPortalUrl?: string;
    supportUrl?: string;
    authReady: boolean;
    companyDeletionEnabled: boolean;
    instanceId?: string;
    hostVersion?: string;
    localPluginDir?: string;
    pluginMigrationDb?: Db;
    pluginWorkerManager?: PluginWorkerManager;
    betterAuthHandler?: express.RequestHandler;
    resolveSession?: (req: ExpressRequest) => Promise<BetterAuthSessionResult | null>;
  },
) {
  const app = express();
  const publicCompanyRateLimiter = createPublicCompanyRateLimiter();
  const workerManager = opts.pluginWorkerManager ?? createPluginWorkerManager();
  app.locals.paperclipDb = db;
  const captureRawBody = (req: express.Request, _res: express.Response, buf: Buffer) => {
    (req as unknown as { rawBody: Buffer }).rawBody = buf;
  };

  // Respect the operator's `TRUST_PROXY` env var (see middleware/trust-proxy.ts).
  // Default is unset → Express trusts nothing, which is the only safe choice
  // when the server may be reachable without a known reverse proxy in front.
  applyTrustProxy(app, parseTrustProxyEnv(process.env.TRUST_PROXY));

  app.use(COMPANY_IMPORT_API_PATH, express.json({
    limit: PORTABLE_JSON_BODY_LIMIT,
    verify: captureRawBody,
  }));
  app.use(express.json({
    limit: DEFAULT_JSON_BODY_LIMIT,
    verify: captureRawBody,
  }));
  app.use("/api", apiCompression());
  app.use(httpLogger);
  const privateHostnameGateEnabled = shouldEnablePrivateHostnameGuard({
    deploymentMode: opts.deploymentMode,
    deploymentExposure: opts.deploymentExposure,
  });
  const privateHostnameAllowSet = resolvePrivateHostnameAllowSet({
    allowedHostnames: opts.allowedHostnames,
    bindHost: opts.bindHost,
  });
  app.use(
    privateHostnameGuard({
      enabled: privateHostnameGateEnabled,
      allowedHostnames: opts.allowedHostnames,
      bindHost: opts.bindHost,
    }),
  );
  app.use(
    "/api/payment-webhooks",
    companyPaymentWebhookRoutes(db, { pluginWorkerManager: workerManager }),
  );
  app.use(
    "/api/mobile-webhooks",
    companyMobileWebhookRoutes(db),
  );
  app.use(
    "/v1",
    companyAiGatewayInferenceRoutes(db),
  );
  app.use(
    "/outreach/unsubscribe",
    companyOutreachUnsubscribeRoutes(db),
  );
  app.use(
    "/outreach",
    companyOutreachWebhookRoutes(db),
  );
  app.use(
    "/social",
    companySocialWebhookRoutes(db),
  );
  app.use(
    actorMiddleware(db, {
      deploymentMode: opts.deploymentMode,
      resolveSession: opts.resolveSession,
    }),
  );
  app.use("/api/auth", authRoutes(db));
  if (opts.betterAuthHandler) {
    app.all("/api/auth/{*authPath}", opts.betterAuthHandler);
  }
  app.use(accountLifecycleGuard());
  app.use(llmRoutes(db));

  const hostServicesDisposers = new Map<string, () => void>();

  // Mount API routes
  const api = Router();
  api.use(boardMutationGuard());
  api.use(
    "/health",
    healthRoutes(db, {
      deploymentMode: opts.deploymentMode,
      deploymentExposure: opts.deploymentExposure,
      authReady: opts.authReady,
      companyDeletionEnabled: opts.companyDeletionEnabled,
      billingPortalUrl: opts.billingPortalUrl,
      supportUrl: opts.supportUrl,
      databaseBackupHealth: opts.databaseBackupHealth,
    }),
  );
  api.use(openApiRoutes());
  api.use("/companies", companyRoutes(db, opts.storageService));
  api.use(llmRoutes(db));
  api.use(companySkillRoutes(db));
  api.use(builtInAgentRoutes(db));
  api.use(teamsCatalogRoutes(db));
  api.use(agentRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(assetRoutes(db, opts.storageService));
  api.use(projectRoutes(db));
  api.use(registerTruthRoutes(db));
  api.use(issueRoutes(db, opts.storageService, {
    feedbackExportService: opts.feedbackExportService,
    pluginWorkerManager: workerManager,
  }));
  api.use(caseRoutes(db, opts.storageService));
  api.use(issueTreeControlRoutes(db));
  api.use(fileResourceRoutes(db));
  api.use(routineRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(pipelineRoutes(db));
  api.use(vitalsAiSdrRoutes(db));
  api.use(environmentRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(executionWorkspaceRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(goalRoutes(db));
  api.use(boardChatRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(approvalRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(secretRoutes(db));
  api.use(costRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(subscriptionRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(policyLedgerRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(fleetRoutes(db));
  api.use(activityRoutes(db));
  api.use(dashboardRoutes(db));
  api.use(companyLoopRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(aetherPortfolioRoutes(db));
  api.use(attentionRoutes(db));
  api.use(userProfileRoutes(db));
  api.use(sidebarBadgeRoutes(db));
  api.use(sidebarPreferenceRoutes(db));
  api.use(resourceMembershipRoutes(db));
  api.use(inboxDismissalRoutes(db));
  api.use(companyInboxRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(companyNotificationRoutes(db));
  api.use(companyWebsiteRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(companyPaymentRoutes(db));
  api.use(companyFinanceRoutes(db));
  api.use(companySocialRoutes(db, { storage: opts.storageService }));
  api.use(companyOutreachRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(companyMediaRoutes(db, { pluginWorkerManager: workerManager }));
  api.use(companyAdsRoutes(db));
  api.use(companyStackRoutes(db));
  api.use(companyStackDatabaseSnapshotRoutes(db, opts.storageService));
  api.use(companyMobileBuildRoutes(db));
  api.use(companyAiGatewayRoutes(db));
  api.use(companyPublicRoutes(db, { rateLimiter: publicCompanyRateLimiter }));
  api.use(instanceSettingsRoutes(db));
  if (opts.databaseBackupService) {
    api.use(instanceDatabaseBackupRoutes(opts.databaseBackupService));
  }
  const pluginRegistry = pluginRegistryService(db);
  const eventBus = createPluginEventBus();
  setPluginEventBus(eventBus);
  const jobStore = pluginJobStore(db);
  const lifecycle = pluginLifecycleManager(db, { workerManager });
  const scheduler = createPluginJobScheduler({
    db,
    jobStore,
    workerManager,
  });
  const toolDispatcher = createPluginToolDispatcher({
    workerManager,
    lifecycleManager: lifecycle,
    db,
  });
  const jobCoordinator = createPluginJobCoordinator({
    db,
    lifecycle,
    scheduler,
    jobStore,
  });
  const hostServiceCleanup = createPluginHostServiceCleanup(lifecycle, hostServicesDisposers);
  let viteHtmlRenderer: ReturnType<typeof createCachedViteHtmlRenderer> | null = null;
  const loader = pluginLoader(
    db,
    {
      localPluginDir: opts.localPluginDir ?? DEFAULT_LOCAL_PLUGIN_DIR,
      migrationDb: opts.pluginMigrationDb,
    },
    {
      workerManager,
      eventBus,
      jobScheduler: scheduler,
      jobStore,
      toolDispatcher,
      lifecycleManager: lifecycle,
      instanceInfo: {
        instanceId: opts.instanceId ?? "default",
        hostVersion: opts.hostVersion ?? "0.0.0",
        deploymentMode: opts.deploymentMode,
        deploymentExposure: opts.deploymentExposure,
      },
      buildHostHandlers: (pluginId, manifest) => {
        const notifyWorker = (method: string, params: unknown) => {
          const handle = workerManager.getWorker(pluginId);
          if (handle) handle.notify(method, params);
        };
        const services = buildHostServices(db, pluginId, manifest.id, eventBus, notifyWorker, {
          pluginWorkerManager: workerManager,
          manifest,
        });
        hostServicesDisposers.set(pluginId, () => services.dispose());
        return createHostClientHandlers({
          pluginId,
          capabilities: manifest.capabilities,
          services,
        });
      },
    },
  );
  api.use(
    pluginRoutes(
      db,
      loader,
      { scheduler, jobStore },
      { workerManager },
      { toolDispatcher },
      { workerManager },
    ),
  );
  api.use(adapterRoutes());
  api.use(
    accessRoutes(db, {
      deploymentMode: opts.deploymentMode,
      deploymentExposure: opts.deploymentExposure,
      bindHost: opts.bindHost,
      allowedHostnames: opts.allowedHostnames,
    }),
  );
  app.use("/api", api);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // The public-company HTML shell is deliberately uncached so unpublishing is
  // reflected immediately. Emit a crawler directive at the HTTP layer as well
  // as in the React page: bots that do not execute JavaScript still respect the
  // board's separate search-indexing choice. Unknown/private slugs fail closed.
  const publicCompany = companyPublicService(db);
  const publicCompanyHost = parsePublicCompanyBaseUrl(opts.publicCompanyBaseUrl);
  if (opts.publicCompanyBaseUrl && !publicCompanyHost) {
    throw new Error("PAPERCLIP_PUBLIC_COMPANY_BASE_URL must be an HTTP(S) origin without a path, query, or credentials");
  }
  const setPublicCompanyHtmlContext = async (slug: string, res: express.Response) => {
    const projection = await publicCompany.getPublicProjection(slug);
    res.locals.publicCompanyProjection = projection;
    res.locals.publicCompanyCanonicalUrl = publicCompanyCanonicalUrl(projection.slug, publicCompanyHost);
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", projection.searchIndexing ? "index, follow" : "noindex, nofollow");
  };
  const allowPublicCompanyHtmlRequest = (req: express.Request, res: express.Response) => {
    const rateLimit = publicCompanyRateLimiter.consume(req.ip || req.socket.remoteAddress || "unknown");
    res.set("X-RateLimit-Limit", String(rateLimit.limit));
    res.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    if (rateLimit.allowed) return true;
    res
      .status(429)
      .set("Cache-Control", "no-store")
      .set("X-Robots-Tag", "noindex, nofollow")
      .set("Retry-After", String(rateLimit.retryAfterSeconds))
      .type("text/plain")
      .send("Public company request limit exceeded");
    return false;
  };
  app.get("/public/:slug", async (req, res, next) => {
    if (!allowPublicCompanyHtmlRequest(req, res)) return;
    try {
      await setPublicCompanyHtmlContext(req.params.slug as string, res);
    } catch {
      res.set("Cache-Control", "no-store");
      res.set("X-Robots-Tag", "noindex, nofollow");
    }
    next();
  });
  app.get("/discover", (req, res, next) => {
    if (!allowPublicCompanyHtmlRequest(req, res)) return;
    res.locals.publicCompanyNoStore = true;
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex, nofollow");
    next();
  });

  // A configured base URL turns exactly one safe subdomain label into an
  // anonymous company root. Resolution happens on the server so an arbitrary
  // hostname can never trick the client into selecting a tenant. Unpublished
  // companies fail before the private board shell is served.
  app.get("/", async (req, res, next) => {
    const host = classifyPublicCompanyHost(req.header("host"), publicCompanyHost);
    if (host.kind === "none" || host.kind === "reserved") {
      next();
      return;
    }
    if (!allowPublicCompanyHtmlRequest(req, res)) return;
    if (host.kind === "invalid") {
      res
        .status(404)
        .set("Cache-Control", "no-store")
        .set("X-Robots-Tag", "noindex, nofollow")
        .type("text/plain")
        .send("Public company not found");
      return;
    }
    try {
      await setPublicCompanyHtmlContext(host.slug, res);
      next();
    } catch {
      res
        .status(404)
        .set("Cache-Control", "no-store")
        .set("X-Robots-Tag", "noindex, nofollow")
        .type("text/plain")
        .send("Public company not found");
    }
  });

  app.use(pluginUiStaticRoutes(db, {
    localPluginDir: opts.localPluginDir ?? DEFAULT_LOCAL_PLUGIN_DIR,
  }));

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  if (opts.uiMode === "static") {
    // Prefer the current monorepo build when it exists. A checkout may retain a
    // stale server/ui-dist from packaging; selecting it first can silently pair
    // a current API with an old client. Published packages do not include the
    // monorepo ui/dist path and therefore fall back to their bundled ui-dist.
    const uiDist = resolveStaticUiDist(__dirname);
    if (uiDist) {
      // Hashed asset files (Vite emits them under /assets/<name>.<hash>.<ext>)
      // never change once built, so they can be cached aggressively.
      app.use(
        "/assets",
        express.static(path.join(uiDist, "assets"), {
          maxAge: "1y",
          immutable: true,
        }),
      );
      // Non-hashed static files (favicon.ico, manifest, robots.txt, etc.):
      // short cache so operators who swap them out see the new version
      // reasonably fast. Override for `index.html` specifically — it is
      // never outlive the asset hashes they point at. `index.html` is always
      // served by the fallback below so hosted-company metadata can be added.
      app.use(
        express.static(uiDist, {
          index: false,
          maxAge: "1h",
          setHeaders(res, filePath) {
            if (path.basename(filePath) === "index.html") {
              res.set("Cache-Control", "no-cache");
            }
          },
        }),
      );
      // SPA fallback. Only for non-asset routes — if the browser asks for
      // /assets/something.js that doesn't exist, we must NOT serve the HTML
      // shell: the browser would try to load it as a JavaScript module, fail
      // with a MIME-type error, and cache that broken response. Return 404
      // instead. The index.html response itself is no-cache so a subsequent
      // deploy's updated asset hashes are picked up on next load.
      app.get(/.*/, (req, res) => {
        if (req.path.startsWith("/assets/")) {
          res.status(404).end();
          return;
        }
        const projection = res.locals.publicCompanyProjection;
        const html = projection
          ? injectPublicCompanyMetadata(
            readBrandedStaticIndexHtml(uiDist),
            projection,
            res.locals.publicCompanyCanonicalUrl ?? null,
          )
          : readBrandedStaticIndexHtml(uiDist);
        const publicCompanyNoStore = Boolean(projection || res.locals.publicCompanyNoStore);
        res
          .status(200)
          .set("Content-Type", "text/html")
          .set("Cache-Control", publicCompanyNoStore ? "no-store" : "no-cache")
          .end(html);
      });
    } else {
      console.warn("[summon] UI dist not found; running in API-only mode");
    }
  }

  if (opts.uiMode === "vite-dev") {
    const uiRoot = path.resolve(__dirname, "../../ui");
    const publicUiRoot = path.resolve(uiRoot, "public");
    const hmrPort = resolveViteHmrPort(opts.serverPort);
    const hmrHost = resolveViteHmrHost(opts.bindHost);
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: uiRoot,
      appType: "custom",
      server: {
        middlewareMode: true,
        hmr: {
          ...(hmrHost ? { host: hmrHost } : {}),
          port: hmrPort,
          clientPort: hmrPort,
        },
        allowedHosts: privateHostnameGateEnabled ? Array.from(privateHostnameAllowSet) : undefined,
      },
    });
    viteHtmlRenderer = createCachedViteHtmlRenderer({
      vite,
      uiRoot,
      brandHtml: applyUiBranding,
    });
    const renderViteHtml = viteHtmlRenderer;

    if (fs.existsSync(publicUiRoot)) {
      app.use(express.static(publicUiRoot, { index: false }));
    }
    app.get(/.*/, async (req, res, next) => {
      if (!shouldServeViteDevHtml(req)) {
        next();
        return;
      }
      try {
        const template = await renderViteHtml.render(req.originalUrl);
        const projection = res.locals.publicCompanyProjection;
        const html = projection
          ? injectPublicCompanyMetadata(
            template,
            projection,
            res.locals.publicCompanyCanonicalUrl ?? null,
          )
          : template;
        const publicCompanyNoStore = Boolean(projection || res.locals.publicCompanyNoStore);
        res
          .status(200)
          .set("Content-Type", "text/html")
          .set("Cache-Control", publicCompanyNoStore ? "no-store" : "no-cache")
          .end(html);
      } catch (err) {
        next(err);
      }
    });
    app.use(vite.middlewares);
  }

  app.use(errorHandler);

  jobCoordinator.start();
  scheduler.start();
  let feedbackExportShuttingDown = false;
  let feedbackExportTimer: ReturnType<typeof setInterval> | null = null;
  const disableFeedbackExportFlushes = () => {
    feedbackExportShuttingDown = true;
    if (feedbackExportTimer) {
      clearInterval(feedbackExportTimer);
      feedbackExportTimer = null;
    }
  };
  const flushPendingFeedbackExports = async () => {
    if (feedbackExportShuttingDown) return;
    try {
      await opts.feedbackExportService?.flushPendingFeedbackTraces();
    } catch (err) {
      if (isDatabaseConnectionUnavailableError(err)) {
        disableFeedbackExportFlushes();
        logger.warn({ err }, "Disabling pending feedback export flushes because the database is unavailable");
        return;
      }
      logger.error({ err }, "Failed to flush pending feedback exports");
    }
  };

  feedbackExportTimer = opts.feedbackExportService
    ? setInterval(() => {
      void flushPendingFeedbackExports();
    }, FEEDBACK_EXPORT_FLUSH_INTERVAL_MS)
    : null;
  feedbackExportTimer?.unref?.();
  if (opts.feedbackExportService) {
    void flushPendingFeedbackExports();
  }
  void toolDispatcher.initialize().catch((err) => {
    logger.error({ err }, "Failed to initialize plugin tool dispatcher");
  });
  const devWatcher = createPluginDevWatcher(
    lifecycle,
    async (pluginId) => (await pluginRegistry.getById(pluginId))?.packagePath ?? null,
  );
  // Auto-install the bundled kubernetes sandbox-provider plugin so the
  // "kubernetes" sandbox provider is registered for agent runs. The plugin is
  // excluded from the pnpm workspace and built standalone into the image (see
  // Dockerfile), then installed here from its local path. This runs BEFORE
  // loadAll() so loadAll() can activate it in the same startup pass.
  //
  // SAFETY (invariant B): this is fully fail-safe. Any failure (missing path,
  // install error, load error) is caught, logged, and swallowed so the server
  // ALWAYS finishes booting. A degraded boot (no kubernetes provider, agents
  // cannot run) is strictly preferable to a crash loop.
  const ensureBundledKubernetesPlugin = async (): Promise<void> => {
    const KUBERNETES_PLUGIN_KEY = "paperclip.kubernetes-sandbox-provider";
    const pluginPath =
      process.env["PAPERCLIP_KUBERNETES_PLUGIN_PATH"] ??
      "/app/packages/plugins/sandbox-providers/kubernetes";
    try {
      // Idempotent: skip if already installed (any non-uninstalled status).
      const existing = await pluginRegistry.getByKey(KUBERNETES_PLUGIN_KEY);
      if (existing) {
        logger.info(
          { pluginKey: KUBERNETES_PLUGIN_KEY, status: existing.status },
          "kubernetes sandbox plugin already installed; skipping auto-install",
        );
        return;
      }
      // Skip silently when the bundle is absent (e.g. local dev or an image
      // built without the plugin). Not an error condition.
      if (!fs.existsSync(path.join(pluginPath, "dist", "manifest.js"))) {
        logger.info(
          { pluginPath },
          "kubernetes sandbox plugin bundle not present; skipping auto-install",
        );
        return;
      }
      logger.info({ pluginPath }, "auto-installing bundled kubernetes sandbox plugin");
      const discovered = await loader.installPlugin({ localPath: pluginPath });
      if (!discovered.manifest) {
        logger.error("kubernetes sandbox plugin installed but manifest is missing");
        return;
      }
      // Transition installed -> ready and activate the worker.
      const installed = await pluginRegistry.getByKey(discovered.manifest.id);
      if (installed) {
        await lifecycle.load(installed.id);
        logger.info(
          { pluginId: installed.id, pluginKey: installed.pluginKey },
          "kubernetes sandbox plugin auto-installed and loaded",
        );
      } else {
        logger.error("kubernetes sandbox plugin installed but not found in registry");
      }
    } catch (err) {
      logger.error(
        { err },
        "Failed to auto-install the kubernetes sandbox plugin; continuing boot (degraded: kubernetes provider unavailable)",
      );
    }
  };
  void ensureBundledKubernetesPlugin()
    .then(() => loader.loadAll())
    .then((result) => {
    if (!result) return;
    for (const loaded of result.results) {
      if (devWatcher && loaded.success && loaded.plugin.packagePath) {
        devWatcher.watch(loaded.plugin.id, loaded.plugin.packagePath);
      }
    }
  }).catch((err) => {
    logger.error({ err }, "Failed to load ready plugins on startup");
  });
  let appServicesShutdown = false;
  const shutdownAppServices = () => {
    if (appServicesShutdown) return;
    appServicesShutdown = true;
    disableFeedbackExportFlushes();
    devWatcher?.close();
    viteHtmlRenderer?.dispose();
    hostServiceCleanup.disposeAll();
    hostServiceCleanup.teardown();
  };
  app.locals.paperclipShutdown = shutdownAppServices;

  process.once("exit", shutdownAppServices);
  process.once("beforeExit", () => {
    void flushPluginLogBuffer();
  });

  return app;
}
