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
- `401` — shared secret configured but the `X-Feedback-Token` header is missing/wrong.
- `429` — best-effort rate limit tripped (6 / instance / 10 min on a warm lambda).
- `503` — board credentials not configured (fail-closed, never silently drops).
- `502` — vendor board unreachable.

CORS is open (`*`) because widgets on customer origins post cross-origin.

### Shared-secret guard (SUM-192, item 1)

Set `FEEDBACK_INTAKE_TOKEN` in the endpoint env and `VITE_FEEDBACK_TOKEN` in the
customer build. The widget then sends `X-Feedback-Token: <token>` and mismatches
are rejected `401` before the board is touched. **Honest framing:** the token
ships in the customer's client bundle, so it is a spam speed-bump, not real auth
— the durable bound on ticket volume is still the per-instance+week dedup. Leave
`FEEDBACK_INTAKE_TOKEN` unset to keep the intake open (SUM-190 behavior).

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
| `VITE_FEEDBACK_TOKEN` | Optional shared secret sent as `X-Feedback-Token`. Match to the endpoint's `FEEDBACK_INTAKE_TOKEN`. |

Vendor (dogfood) builds leave `VITE_FEEDBACK_ENDPOINT` unset, so nothing changes
for this instance — the survey still files locally on SUM.

## Weekly digest (SUM-192, item 4)

`POST /api/feedback-digest` rolls the week's per-instance tickets into **one**
board summary — instances reporting, average stars, detractors with reasons, and
every "why not a 5" verbatim — filed on the SUM board routed to Haven. It is
idempotent per week: the first run creates the digest ticket, later runs refresh
it with a comment (no duplicate). Detractors present → `high` priority.

```sh
# current ISO week; or POST {"week":"2026-W29"} to target a specific week
curl -X POST https://summon.company/api/feedback-digest \
     -H "X-Feedback-Token: $FEEDBACK_DIGEST_TOKEN"
```

Fail-closed on a token: set `FEEDBACK_DIGEST_TOKEN` (falls back to
`FEEDBACK_INTAKE_TOKEN`). Without either the endpoint refuses (`401`) so no one
can spawn board tickets from a public URL. Run it from a weekly Vercel Cron or a
scheduled GitHub Action every Monday; Haven then works the one digest ticket.

## Follow-up

Rate limiting is a warm-lambda speed bump only; the instance+week dedup is the
real guard. If abuse appears, back it with Vercel KV / Upstash for a durable
limiter (its own ticket).
