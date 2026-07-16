import { z } from "zod";

export const VITALS_AI_SDR_DOCUMENT_KEYS = {
  intake: "ai-sdr-intake",
  dossiers: "ai-sdr-dossiers",
  drafts: "ai-sdr-drafts",
  measurements: "ai-sdr-measurements",
} as const;

export const VITALS_AI_SDR_MEASUREMENT_EVENT_NAMES = [
  "intake_submitted",
  "lead_source_planned",
  "dossier_created",
  "draft_created",
  "approval_requested",
  "outbound_blocked",
  "sync_proposed",
] as const;

export const vitalsAiSdrMeasurementEventNameSchema = z.enum(VITALS_AI_SDR_MEASUREMENT_EVENT_NAMES);
export type VitalsAiSdrMeasurementEventName = z.infer<typeof vitalsAiSdrMeasurementEventNameSchema>;

export const vitalsAiSdrIntakeSchema = z.object({
  companyUrl: z.string().trim().url(),
  icp: z.string().trim().min(10).max(500),
  senderIdentity: z.string().trim().min(2).max(300),
  objective: z.string().trim().min(5).max(500),
  bannedClaims: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  geography: z.string().trim().min(2).max(120),
  maxDraftCount: z.number().int().min(1).max(5).default(1),
  notes: z.string().trim().max(2000).nullable().optional().default(null),
  leadSourceKind: z.literal("local_fixture").default("local_fixture"),
});

export const vitalsAiSdrDogfoodRequestSchema = z.object({
  issueId: z.string().uuid(),
  intake: vitalsAiSdrIntakeSchema,
});

export type VitalsAiSdrIntakeInput = z.input<typeof vitalsAiSdrIntakeSchema>;
export type VitalsAiSdrIntake = z.infer<typeof vitalsAiSdrIntakeSchema>;
export type VitalsAiSdrDogfoodRequest = z.infer<typeof vitalsAiSdrDogfoodRequestSchema>;

export type VitalsAiSdrCitation = {
  id: string;
  text: string;
  source: string;
};

export type VitalsAiSdrLocalLeadFixture = {
  id: string;
  companyName: string;
  website: string;
  prospectName: string;
  prospectRole: string;
  geography: string;
  segment: string;
  fitSignals: string[];
  buyingTrigger: string;
  citations: VitalsAiSdrCitation[];
};

export type VitalsAiSdrCampaign = {
  id: string;
  companyUrl: string;
  companyHost: string;
  icp: string;
  senderIdentity: string;
  objective: string;
  geography: string;
  maxDraftCount: number;
  leadSourceKind: "local_fixture";
  createdAt: string;
};

export type VitalsAiSdrDossier = {
  id: string;
  targetCompany: string;
  targetWebsite: string;
  prospectName: string;
  prospectRole: string;
  geography: string;
  segment: string;
  summary: string;
  fitReason: string;
  buyingTrigger: string;
  citations: VitalsAiSdrCitation[];
};

export type VitalsAiSdrDraft = {
  id: string;
  dossierId: string;
  prospectName: string;
  prospectRole: string;
  prospectCompany: string;
  subject: string;
  body: string;
  citationsUsed: string[];
  approvalStatus: "pending_board_approval";
  guardrails: string[];
  blockedBannedClaims: string[];
};

export type VitalsAiSdrDownstreamBlock = {
  stageKey: string;
  label: string;
  status: "blocked";
  reason: string;
  requiredApproval: string;
};

export type VitalsAiSdrMeasurementEvent = {
  id: string;
  eventName: VitalsAiSdrMeasurementEventName;
  stageKey: string;
  occurredAt: string;
  companyHost: string;
  campaignId: string;
  metadata: Record<string, string | number | boolean | string[] | null>;
};

export type VitalsAiSdrLeadSourcePlan = {
  kind: "local_fixture";
  status: "ready";
  summary: string;
  fixtureIds: string[];
  blockedExternalSources: string[];
};

export type VitalsAiSdrDogfoodBundle = {
  campaign: VitalsAiSdrCampaign;
  intake: VitalsAiSdrIntake;
  leadSourcePlan: VitalsAiSdrLeadSourcePlan;
  dossiers: VitalsAiSdrDossier[];
  drafts: VitalsAiSdrDraft[];
  downstreamBlocks: VitalsAiSdrDownstreamBlock[];
  measurementEvents: VitalsAiSdrMeasurementEvent[];
};

export const VITALS_AI_SDR_LOCAL_LEAD_FIXTURES: readonly VitalsAiSdrLocalLeadFixture[] = [
  {
    id: "northstar-revops",
    companyName: "Northstar RevOps Studio",
    website: "https://northstar-revops.example",
    prospectName: "Maya Chen",
    prospectRole: "Founder",
    geography: "United States",
    segment: "Founder-led B2B services team",
    fitSignals: [
      "Founder-led B2B team",
      "Spreadsheet-to-CRM migration",
      "First outbound hire planned",
    ],
    buyingTrigger: "The sample buying trigger is a hiring plan for a first outbound rep.",
    citations: [
      {
        id: "F1",
        text: "Northstar sells implementation sprints for founder-led B2B teams moving from spreadsheets to HubSpot.",
        source: "Local sample fixture: Northstar public positioning note, 2026-07-15.",
      },
      {
        id: "F2",
        text: "Northstar publishes teardown notes about CRM cleanup and sales handoff friction.",
        source: "Local sample fixture: Northstar content summary, 2026-07-15.",
      },
      {
        id: "F3",
        text: "Northstar's sample operating note says the team is preparing to hire a first outbound rep.",
        source: "Local sample fixture: Northstar operating note, 2026-07-15.",
      },
    ],
  },
  {
    id: "harbor-support",
    companyName: "Harbor Support Systems",
    website: "https://harbor-support.example",
    prospectName: "Jordan Vale",
    prospectRole: "Head of Operations",
    geography: "United States",
    segment: "B2B software support team",
    fitSignals: [
      "Support workflow redesign",
      "Customer handoff friction",
      "Revenue team expansion",
    ],
    buyingTrigger: "The sample buying trigger is a planned handoff from founder-led sales to a small revenue team.",
    citations: [
      {
        id: "F1",
        text: "Harbor is reorganizing support intake around account context and response-time promises.",
        source: "Local sample fixture: Harbor support workflow note, 2026-07-15.",
      },
      {
        id: "F2",
        text: "Harbor's sample roadmap highlights gaps between sales promises and onboarding handoffs.",
        source: "Local sample fixture: Harbor roadmap excerpt, 2026-07-15.",
      },
      {
        id: "F3",
        text: "Harbor is preparing operating docs before adding two revenue roles.",
        source: "Local sample fixture: Harbor hiring plan, 2026-07-15.",
      },
    ],
  },
  {
    id: "ledgerloop",
    companyName: "LedgerLoop Finance Ops",
    website: "https://ledgerloop.example",
    prospectName: "Priya Raman",
    prospectRole: "Managing Partner",
    geography: "Canada",
    segment: "Finance operations consultancy",
    fitSignals: [
      "Founder-led operations",
      "Manual prospect qualification",
      "Compliance-sensitive messaging",
    ],
    buyingTrigger: "The sample buying trigger is a plan to standardize lead review before any outbound motion.",
    citations: [
      {
        id: "F1",
        text: "LedgerLoop serves early-stage software companies that need finance operations cleanup.",
        source: "Local sample fixture: LedgerLoop positioning brief, 2026-07-15.",
      },
      {
        id: "F2",
        text: "LedgerLoop's sample notes flag compliance-sensitive language as a review risk.",
        source: "Local sample fixture: LedgerLoop compliance note, 2026-07-15.",
      },
      {
        id: "F3",
        text: "LedgerLoop is comparing manual prospect qualification with a board-approved draft workflow.",
        source: "Local sample fixture: LedgerLoop operations note, 2026-07-15.",
      },
    ],
  },
] as const;

export const VITALS_AI_SDR_DOWNSTREAM_BLOCKS: readonly VitalsAiSdrDownstreamBlock[] = [
  {
    stageKey: "external_lead_source_access",
    label: "External lead source access",
    status: "blocked",
    reason: "Apollo, scraping, enrichment, paid APIs, and customer data are outside this local dogfood scope.",
    requiredApproval: "Board approval for provider, data source, spend, and compliance terms.",
  },
  {
    stageKey: "deliverability",
    label: "Deliverability",
    status: "blocked",
    reason: "No mailbox, DNS, warmup, or deliverability tooling is connected by this loop.",
    requiredApproval: "Board approval for sender domain, mailbox, and deliverability operating policy.",
  },
  {
    stageKey: "outbound",
    label: "Outbound send",
    status: "blocked",
    reason: "Drafts are held for approval and no email, LinkedIn, SMS, or other outbound channel is invoked.",
    requiredApproval: "Board approval of message, sender, recipient list, and send mechanism.",
  },
  {
    stageKey: "crm_sync",
    label: "CRM sync",
    status: "blocked",
    reason: "No HubSpot, Salesforce, Airtable, spreadsheet, or CRM write path is connected.",
    requiredApproval: "Board approval for destination system, fields, and data retention.",
  },
  {
    stageKey: "calendar_sync",
    label: "Calendar sync",
    status: "blocked",
    reason: "No calendar, booking, or meeting automation is connected.",
    requiredApproval: "Board approval for scheduling provider and availability policy.",
  },
] as const;

function normalizeHost(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function includesGeography(fixture: VitalsAiSdrLocalLeadFixture, geography: string): boolean {
  const target = geography.toLowerCase();
  if (target === "any" || target === "global" || target.includes("north america")) return true;
  const fixtureGeo = fixture.geography.toLowerCase();
  return fixtureGeo.includes(target) || target.includes(fixtureGeo);
}

function selectFixtures(intake: VitalsAiSdrIntake): VitalsAiSdrLocalLeadFixture[] {
  const matching = VITALS_AI_SDR_LOCAL_LEAD_FIXTURES.filter((fixture) =>
    includesGeography(fixture, intake.geography)
  );
  const pool = matching.length > 0 ? matching : [...VITALS_AI_SDR_LOCAL_LEAD_FIXTURES];
  return pool.slice(0, intake.maxDraftCount);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeAgainstBannedClaims(value: string, bannedClaims: readonly string[]): string {
  let next = value;
  for (const claim of bannedClaims) {
    const trimmed = normalizeText(claim);
    if (!trimmed) continue;
    next = next.replace(new RegExp(escapeRegExp(trimmed), "gi"), "board-approved positioning");
  }
  return next;
}

function detectBannedClaims(value: string, bannedClaims: readonly string[]): string[] {
  const lower = value.toLowerCase();
  return bannedClaims
    .map(normalizeText)
    .filter((claim) => claim.length > 0 && lower.includes(claim.toLowerCase()));
}

function citationLine(citation: VitalsAiSdrCitation): string {
  return `[${citation.id}] ${citation.text} Source: ${citation.source}`;
}

function citationFragment(citation: VitalsAiSdrCitation | undefined, companyName: string): string {
  if (!citation) return "has a relevant operating signal";
  const shortName = companyName.split(/\s+/)[0] ?? companyName;
  return citation.text
    .replace(new RegExp(`^${escapeRegExp(companyName)}\\s+`, "i"), "")
    .replace(new RegExp(`^${escapeRegExp(shortName)}\\s+`, "i"), "")
    .replace(/\.$/, "");
}

function buildDossier(campaign: VitalsAiSdrCampaign, fixture: VitalsAiSdrLocalLeadFixture): VitalsAiSdrDossier {
  return {
    id: `${campaign.id}-dossier-${fixture.id}`,
    targetCompany: fixture.companyName,
    targetWebsite: fixture.website,
    prospectName: fixture.prospectName,
    prospectRole: fixture.prospectRole,
    geography: fixture.geography,
    segment: fixture.segment,
    summary: `${fixture.companyName} is a local sample lead for ${campaign.icp}. ${fixture.citations[0]?.text ?? ""}`,
    fitReason: `${fixture.fitSignals.join("; ")}. This matches the requested ICP: ${campaign.icp}.`,
    buyingTrigger: fixture.buyingTrigger,
    citations: fixture.citations,
  };
}

function buildDraft(
  campaign: VitalsAiSdrCampaign,
  intake: VitalsAiSdrIntake,
  dossier: VitalsAiSdrDossier,
): VitalsAiSdrDraft {
  const safeObjective = sanitizeAgainstBannedClaims(intake.objective, intake.bannedClaims);
  const safeIcp = sanitizeAgainstBannedClaims(intake.icp, intake.bannedClaims);
  const safeSender = sanitizeAgainstBannedClaims(intake.senderIdentity, intake.bannedClaims);
  const firstFact = dossier.citations[0];
  const secondFact = dossier.citations[1] ?? dossier.citations[0];
  const firstFactFragment = citationFragment(firstFact, dossier.targetCompany);
  const secondFactFragment = citationFragment(secondFact, dossier.targetCompany);
  const subject = sanitizeAgainstBannedClaims(
    `${dossier.targetCompany} and a cited AI SDR review loop`,
    intake.bannedClaims,
  );
  const body = sanitizeAgainstBannedClaims(
    [
      `Hi ${dossier.prospectName},`,
      "",
      `I saw ${dossier.targetCompany} ${firstFactFragment} [${firstFact?.id ?? "F1"}]. I also noticed your sample notes say the team ${secondFactFragment.toLowerCase()} [${secondFact?.id ?? "F2"}].`,
      "",
      `I am ${safeSender}. We are dogfooding a no-outbound AI SDR loop for ${safeObjective}. For ${safeIcp}, the useful first step is a cited dossier plus a personalized draft that stays in board approval before anyone sends it.`,
      "",
      "If helpful, I can share the dossier format we are using internally.",
      "",
      `- ${safeSender}`,
    ].join("\n"),
    intake.bannedClaims,
  );

  return {
    id: `${campaign.id}-draft-${dossier.id.split("-dossier-")[1]}`,
    dossierId: dossier.id,
    prospectName: dossier.prospectName,
    prospectRole: dossier.prospectRole,
    prospectCompany: dossier.targetCompany,
    subject,
    body,
    citationsUsed: dossier.citations.slice(0, 2).map((citation) => citation.id),
    approvalStatus: "pending_board_approval",
    guardrails: [
      "Local fixture lead source only",
      "No enrichment, scraping, mailbox, CRM, calendar, paid API, or outbound send",
      "Draft must receive board approval before any downstream action",
      intake.bannedClaims.length > 0
        ? `Banned claims excluded: ${intake.bannedClaims.map(normalizeText).join(", ")}`
        : "No banned claims supplied",
    ],
    blockedBannedClaims: detectBannedClaims(`${subject}\n${body}`, intake.bannedClaims),
  };
}

function event(args: {
  eventName: VitalsAiSdrMeasurementEventName;
  stageKey: string;
  occurredAt: string;
  campaign: VitalsAiSdrCampaign;
  index: number;
  metadata?: Record<string, string | number | boolean | string[] | null>;
}): VitalsAiSdrMeasurementEvent {
  return {
    id: `${args.campaign.id}:${args.eventName}:${args.index}`,
    eventName: args.eventName,
    stageKey: args.stageKey,
    occurredAt: args.occurredAt,
    companyHost: args.campaign.companyHost,
    campaignId: args.campaign.id,
    metadata: args.metadata ?? {},
  };
}

export function buildVitalsAiSdrDogfoodBundle(
  rawIntake: VitalsAiSdrIntakeInput,
  options: { now?: Date | string } = {},
): VitalsAiSdrDogfoodBundle {
  const intake = vitalsAiSdrIntakeSchema.parse(rawIntake);
  const createdAt = new Date(options.now ?? Date.now()).toISOString();
  const companyHost = normalizeHost(intake.companyUrl);
  const campaign: VitalsAiSdrCampaign = {
    id: `local-${stableHash([
      intake.companyUrl,
      intake.icp,
      intake.senderIdentity,
      intake.objective,
      intake.geography,
      String(intake.maxDraftCount),
    ].join("|"))}`,
    companyUrl: intake.companyUrl,
    companyHost,
    icp: normalizeText(intake.icp),
    senderIdentity: normalizeText(intake.senderIdentity),
    objective: normalizeText(intake.objective),
    geography: normalizeText(intake.geography),
    maxDraftCount: intake.maxDraftCount,
    leadSourceKind: "local_fixture",
    createdAt,
  };
  const selectedFixtures = selectFixtures(intake);
  const dossiers = selectedFixtures.map((fixture) => buildDossier(campaign, fixture));
  const drafts = dossiers.map((dossier) => buildDraft(campaign, intake, dossier));
  const leadSourcePlan: VitalsAiSdrLeadSourcePlan = {
    kind: "local_fixture",
    status: "ready",
    summary: "Use only the packaged local sample lead fixtures for dogfood output.",
    fixtureIds: selectedFixtures.map((fixture) => fixture.id),
    blockedExternalSources: [
      "Apollo",
      "web scraping",
      "enrichment APIs",
      "mailbox data",
      "CRM data",
      "calendar data",
      "paid APIs",
      "customer data",
    ],
  };

  const measurementEvents: VitalsAiSdrMeasurementEvent[] = [
    event({
      eventName: "intake_submitted",
      stageKey: "intake",
      occurredAt: createdAt,
      campaign,
      index: 1,
      metadata: {
        geography: campaign.geography,
        maxDraftCount: campaign.maxDraftCount,
        bannedClaimCount: intake.bannedClaims.length,
      },
    }),
    event({
      eventName: "lead_source_planned",
      stageKey: "local_fixture_source",
      occurredAt: createdAt,
      campaign,
      index: 1,
      metadata: {
        leadSourceKind: "local_fixture",
        fixtureIds: leadSourcePlan.fixtureIds,
      },
    }),
    ...dossiers.map((dossier, index) => event({
      eventName: "dossier_created",
      stageKey: "dossier",
      occurredAt: createdAt,
      campaign,
      index: index + 1,
      metadata: {
        dossierId: dossier.id,
        targetCompany: dossier.targetCompany,
        citationCount: dossier.citations.length,
      },
    })),
    ...drafts.map((draft, index) => event({
      eventName: "draft_created",
      stageKey: "draft",
      occurredAt: createdAt,
      campaign,
      index: index + 1,
      metadata: {
        draftId: draft.id,
        dossierId: draft.dossierId,
        approvalStatus: draft.approvalStatus,
      },
    })),
    event({
      eventName: "approval_requested",
      stageKey: "board_approval",
      occurredAt: createdAt,
      campaign,
      index: 1,
      metadata: {
        draftIds: drafts.map((draft) => draft.id),
        draftCount: drafts.length,
      },
    }),
    event({
      eventName: "outbound_blocked",
      stageKey: "outbound",
      occurredAt: createdAt,
      campaign,
      index: 1,
      metadata: {
        blockedStageKeys: VITALS_AI_SDR_DOWNSTREAM_BLOCKS.map((block) => block.stageKey),
      },
    }),
    event({
      eventName: "sync_proposed",
      stageKey: "crm_calendar_sync",
      occurredAt: createdAt,
      campaign,
      index: 1,
      metadata: {
        crmSyncBlocked: true,
        calendarSyncBlocked: true,
      },
    }),
  ];

  return {
    campaign,
    intake,
    leadSourcePlan,
    dossiers,
    drafts,
    downstreamBlocks: [...VITALS_AI_SDR_DOWNSTREAM_BLOCKS],
    measurementEvents,
  };
}

export function summarizeVitalsAiSdrBundle(bundle: VitalsAiSdrDogfoodBundle) {
  return {
    campaignId: bundle.campaign.id,
    companyHost: bundle.campaign.companyHost,
    dossierCount: bundle.dossiers.length,
    draftCount: bundle.drafts.length,
    pendingApprovalCount: bundle.drafts.filter((draft) => draft.approvalStatus === "pending_board_approval").length,
    blockedStageCount: bundle.downstreamBlocks.length,
    measurementEventNames: bundle.measurementEvents.map((eventItem) => eventItem.eventName),
  };
}

export function renderVitalsAiSdrIntakeMarkdown(bundle: VitalsAiSdrDogfoodBundle): string {
  return [
    "# AI SDR intake",
    "",
    `Campaign: ${bundle.campaign.id}`,
    `Company URL: ${bundle.intake.companyUrl}`,
    `Company host: ${bundle.campaign.companyHost}`,
    `ICP: ${bundle.intake.icp}`,
    `Sender identity: ${bundle.intake.senderIdentity}`,
    `Objective: ${bundle.intake.objective}`,
    `Geography: ${bundle.intake.geography}`,
    `Max draft count: ${bundle.intake.maxDraftCount}`,
    `Lead source: ${bundle.intake.leadSourceKind}`,
    `Banned claims: ${bundle.intake.bannedClaims.length > 0 ? bundle.intake.bannedClaims.join(", ") : "None"}`,
    "",
    "## Notes",
    "",
    bundle.intake.notes || "None.",
    "",
    "## Scope guardrail",
    "",
    "This run uses only local sample fixtures. It does not call Apollo, scraping, enrichment, mailbox, CRM, calendar, Stripe, paid APIs, customer data, production deploys, or outbound send paths.",
  ].join("\n");
}

export function renderVitalsAiSdrDossiersMarkdown(bundle: VitalsAiSdrDogfoodBundle): string {
  const sections = bundle.dossiers.flatMap((dossier, index) => [
    `## ${index + 1}. ${dossier.targetCompany}`,
    "",
    `Prospect: ${dossier.prospectName}, ${dossier.prospectRole}`,
    `Website: ${dossier.targetWebsite}`,
    `Geography: ${dossier.geography}`,
    `Segment: ${dossier.segment}`,
    "",
    `Summary: ${dossier.summary}`,
    "",
    `Fit reason: ${dossier.fitReason}`,
    "",
    `Buying trigger: ${dossier.buyingTrigger}`,
    "",
    "### Citations",
    "",
    ...dossier.citations.map((citation) => `- ${citationLine(citation)}`),
    "",
  ]);

  return [
    "# AI SDR cited dossiers",
    "",
    `Campaign: ${bundle.campaign.id}`,
    "",
    ...sections,
  ].join("\n");
}

export function renderVitalsAiSdrDraftsMarkdown(bundle: VitalsAiSdrDogfoodBundle): string {
  const sections = bundle.drafts.flatMap((draft, index) => [
    `## ${index + 1}. ${draft.prospectCompany}`,
    "",
    `Recipient: ${draft.prospectName}, ${draft.prospectRole}`,
    `Approval status: ${draft.approvalStatus}`,
    `Citations used: ${draft.citationsUsed.map((id) => `[${id}]`).join(", ")}`,
    `Blocked banned claims found in draft: ${draft.blockedBannedClaims.length > 0 ? draft.blockedBannedClaims.join(", ") : "None"}`,
    "",
    `Subject: ${draft.subject}`,
    "",
    "```text",
    draft.body,
    "```",
    "",
    "### Guardrails",
    "",
    ...draft.guardrails.map((guardrail) => `- ${guardrail}`),
    "",
  ]);

  return [
    "# AI SDR personalized drafts",
    "",
    `Campaign: ${bundle.campaign.id}`,
    "Every draft is pending board approval. No outbound channel is connected.",
    "",
    ...sections,
  ].join("\n");
}

export function renderVitalsAiSdrMeasurementsMarkdown(bundle: VitalsAiSdrDogfoodBundle): string {
  return [
    "# AI SDR measurement and blocked stages",
    "",
    `Campaign: ${bundle.campaign.id}`,
    "",
    "## Measurement events",
    "",
    ...bundle.measurementEvents.map((eventItem) =>
      `- ${eventItem.occurredAt} ${eventItem.eventName} (${eventItem.stageKey})`
    ),
    "",
    "## Blocked downstream stages",
    "",
    ...bundle.downstreamBlocks.map((block) =>
      `- ${block.label}: ${block.reason} Required approval: ${block.requiredApproval}`
    ),
    "",
    "## External-scope confirmation",
    "",
    "No outbound, external providers, customer data, paid API, production deployment, public claim, CRM sync, calendar sync, mailbox, scraping, or enrichment action was performed by this local dogfood loop.",
  ].join("\n");
}
