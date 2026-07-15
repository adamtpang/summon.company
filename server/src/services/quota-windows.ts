import type { ProviderQuotaResult } from "@paperclipai/shared";
import { listServerAdapters } from "../adapters/registry.js";

const QUOTA_PROVIDER_TIMEOUT_MS = 20_000;

function providerSlugForAdapterType(type: string): string {
  switch (type) {
    case "claude_local":
      return "anthropic";
    case "codex_local":
      return "openai";
    default:
      return type;
  }
}

/**
 * Asks each registered adapter for its provider quota windows and aggregates the results.
 * Adapters that don't implement getQuotaWindows() are silently skipped.
 * Individual adapter failures are caught and returned as error results rather than
 * letting one provider's outage block the entire response.
 */
export async function fetchAllQuotaWindows(): Promise<ProviderQuotaResult[]> {
  const adapters = listServerAdapters().filter((a) => a.getQuotaWindows != null);

  const settled = await Promise.allSettled(
    adapters.map((adapter) => withQuotaTimeout(adapter.type, adapter.getQuotaWindows!())),
  );

  const results = settled.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    const adapterType = adapters[i]!.type;
    return {
      provider: providerSlugForAdapterType(adapterType),
      ok: false,
      error: String(result.reason),
      windows: [],
    };
  });
  quotaCache = { fetchedAt: Date.now(), results };
  return results;
}

const QUOTA_CACHE_TTL_MS = 5 * 60_000;

let quotaCache: { fetchedAt: number; results: ProviderQuotaResult[] } | null = null;
let quotaRefreshInFlight: Promise<ProviderQuotaResult[]> | null = null;

/**
 * Non-blocking read of the quota windows for read-hot paths (the attention
 * feed): returns the cached results immediately — possibly stale, null before
 * the first fetch completes — and kicks off a background refresh when the
 * cache is older than the TTL. Provider calls can take up to 20s each, so
 * callers on request paths must never await a live fetch.
 */
export function peekQuotaWindows(): { fetchedAt: number; results: ProviderQuotaResult[] } | null {
  const isStale = !quotaCache || Date.now() - quotaCache.fetchedAt > QUOTA_CACHE_TTL_MS;
  if (isStale && !quotaRefreshInFlight) {
    quotaRefreshInFlight = fetchAllQuotaWindows().finally(() => {
      quotaRefreshInFlight = null;
    });
    // background refresh — never bubble a provider outage into the caller
    quotaRefreshInFlight.catch(() => {});
  }
  return quotaCache;
}

/** test-only: clears the module-level quota cache */
export function __resetQuotaWindowCacheForTests() {
  quotaCache = null;
  quotaRefreshInFlight = null;
}

async function withQuotaTimeout(
  adapterType: string,
  task: Promise<ProviderQuotaResult>,
): Promise<ProviderQuotaResult> {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<ProviderQuotaResult>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve({
            provider: providerSlugForAdapterType(adapterType),
            ok: false,
            error: `quota polling timed out after ${Math.round(QUOTA_PROVIDER_TIMEOUT_MS / 1000)}s`,
            windows: [],
          });
        }, QUOTA_PROVIDER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
