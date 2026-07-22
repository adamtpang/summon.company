# Hosted feedback intake (SUM-190)

Customer Summon instances can't reach the vendor's board directly. The in-app
feedback widget (weekly 0–5 star + why-not-5 survey) POSTs to this hosted
endpoint instead, which files ONE support task per instance per week on Adam's
**SUM** board, routed to **Haven**, and appends a weekly digest comment when
more than one submission lands for the same instance in the same ISO week.

## Endpoint

`POST /api/feedback`

```json
{ "instanceId": "acme-inc", "rating": 3, "why": "slow onboarding", "week": "2026-W29", "context": "/board · 2026-07-22T…" }
```

Responses:
- `201 {status:"created", issueId}` — first submission this week → new ticket.
- `200 {status:"appended", issueId}` — a ticket for this instance+week exists → digest comment added.
- `400` — invalid `rating` (must be int 0–5), `week` (must match `YYYY-Www`), or `instanceId`.
- `429` — best-effort rate limit tripped (6 / instance / 10 min on a warm lambda).
- `503` — board credentials not configured (fail-closed, never silently drops).
- `502` — vendor board unreachable.

CORS is open (`*`) because widgets on customer origins post cross-origin.

## Guarantees

- **Dedup:** a deterministic marker `[fb:<instanceId>:<week>]` in the ticket title
  maps every instance+week to exactly one ticket. This is the durable volume bound.
- **No PII:** only `rating`, `why`, `week`, `context`, and the opaque `instanceId`
  are stored — exactly what the customer typed, whitespace-collapsed and length-capped
  (`why` ≤1000, `context` ≤300). No IP or headers are written to the ticket.
- **Routing:** tickets are created with `assigneeAgentId = SUMMON_HAVEN_AGENT_ID`,
  priority `high` when rating ≤2 else `medium`.

## Config (Vercel project env — never commit)

| Var | Purpose |
| --- | --- |
| `SUMMON_API_URL` | Base URL of the vendor Summon API (e.g. `https://summon.company`). `/api` suffix is normalized either way. |
| `SUMMON_API_KEY` | Bearer for a service/agent scoped to the SUM board (create/list issues + comment). |
| `SUMMON_SUM_COMPANY_ID` | Company id of the SUM flagship board. |
| `SUMMON_HAVEN_AGENT_ID` | Optional. Haven's agent id; when set, tickets route to Haven. |

Deploy from `apps/landing`:

```sh
vercel env add SUMMON_API_URL production        # repeat for the other three
vercel --prod
```

Point `feedback.summon.company` at this deployment, or just use
`https://summon.company/api/feedback` directly.

## Widget config (customer instances)

The widget (`ui/src/components/FeedbackWidget.tsx`) auto-switches to the hosted
endpoint when built with:

| Var | Purpose |
| --- | --- |
| `VITE_FEEDBACK_ENDPOINT` | Hosted intake URL. **Unset/empty = vendor instance** → files on the local SUM board instead. |
| `VITE_FEEDBACK_INSTANCE_ID` | Opaque instance id for dedup. Defaults to `window.location.host`. |

Vendor (dogfood) builds leave `VITE_FEEDBACK_ENDPOINT` unset, so nothing changes
for this instance — the survey still files locally on SUM.

## Follow-up

Rate limiting is a warm-lambda speed bump only; the instance+week dedup is the
real guard. If abuse appears, back it with Vercel KV / Upstash for a durable
limiter (its own ticket).
