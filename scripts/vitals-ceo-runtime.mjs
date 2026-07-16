import { spawnSync } from "node:child_process";

const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const CEO_ID = process.env.VITALS_CEO_ID ?? "2dda4faa-8408-4c5b-a4f3-722a8303d276";
const command = process.argv[2] ?? "status";
const invoke = !process.argv.includes("--no-invoke");
const force = process.argv.includes("--force");

async function request(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} ${response.status}: ${text}`);
  return data;
}

function managedAdapterFields(config = {}) {
  return Object.fromEntries(
    [
      "paperclipSkillSync",
      "instructionsFilePath",
      "instructionsRootPath",
      "instructionsEntryFile",
      "instructionsBundleMode",
    ]
      .filter((key) => config[key] !== undefined)
      .map((key) => [key, config[key]]),
  );
}

function requireClaudeLogin() {
  const result = spawnSync("claude.exe", ["auth", "status"], {
    encoding: "utf8",
    windowsHide: true,
  });
  let auth;
  try {
    auth = JSON.parse(result.stdout);
  } catch {
    auth = null;
  }
  if (result.status !== 0 || auth?.loggedIn !== true) {
    throw new Error("Claude Code is not logged in. Run `claude /login`, then retry.");
  }
}

function runtimeConfig(agent, cheapAdapterConfig) {
  return {
    ...(agent.runtimeConfig ?? {}),
    heartbeat: {
      enabled: true,
      intervalSec: 1800,
      wakeOnDemand: true,
      cooldownSec: 60,
      maxConcurrentRuns: 1,
    },
    modelProfiles: {
      cheap: { enabled: true, label: "Fast lane", adapterConfig: cheapAdapterConfig },
    },
  };
}

async function main() {
  const agent = await request("GET", `/agents/${CEO_ID}`);
  if (command === "status") {
    process.stdout.write(`${JSON.stringify({
      status: agent.status,
      adapterType: agent.adapterType,
      model: agent.adapterConfig?.model ?? null,
      heartbeat: agent.runtimeConfig?.heartbeat ?? null,
      errorReason: agent.errorReason ?? null,
    }, null, 2)}\n`);
    return;
  }

  if (command === "stop") {
    await request("PATCH", `/agents/${CEO_ID}`, {
      runtimeConfig: {
        ...(agent.runtimeConfig ?? {}),
        heartbeat: { ...(agent.runtimeConfig?.heartbeat ?? {}), enabled: false },
      },
    });
    process.stdout.write("Vitals CEO heartbeat disabled.\n");
    return;
  }

  const managed = managedAdapterFields(agent.adapterConfig);
  let adapterType;
  let adapterConfig;
  let cheapAdapterConfig;

  if (command === "claude") {
    requireClaudeLogin();
    adapterType = "claude_local";
    adapterConfig = {
      ...managed,
      model: "claude-opus-4-8",
      effort: "high",
      dangerouslySkipPermissions: true,
    };
    cheapAdapterConfig = { model: "claude-sonnet-4-6", effort: "low" };
  } else if (command === "codex") {
    if (!force && String(agent.errorReason ?? "").includes("usage limit")) {
      throw new Error("Codex is still circuit-broken by its recorded usage limit. Retry after reset or pass --force after verifying access.");
    }
    adapterType = "codex_local";
    adapterConfig = {
      ...managed,
      env: { CODEX_HOME: "C:\\Users\\adamp\\.codex" },
      model: "gpt-5.5",
      modelReasoningEffort: "high",
      dangerouslyBypassApprovalsAndSandbox: true,
    };
    cheapAdapterConfig = { model: "gpt-5.5", modelReasoningEffort: "low" };
  } else {
    throw new Error("Usage: node scripts/vitals-ceo-runtime.mjs <status|claude|codex|stop> [--no-invoke] [--force]");
  }

  await request("PATCH", `/agents/${CEO_ID}`, {
    adapterType,
    adapterConfig,
    runtimeConfig: runtimeConfig(agent, cheapAdapterConfig),
  });
  await request("POST", `/agents/${CEO_ID}/clear-error`, {});
  const run = invoke
    ? await request("POST", `/agents/${CEO_ID}/heartbeat/invoke`, {})
    : null;
  process.stdout.write(`${JSON.stringify({ adapterType, model: adapterConfig.model, runId: run?.id ?? null }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

