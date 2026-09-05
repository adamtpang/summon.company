# Handoff: learn from NousResearch/hermes-agent

Written 2026-09-03 by the Aether root session, using the github-star-match skill. This
repo was on Adam's GitHub stars; it was reviewed against summon.company, this file was
written, and the star was removed. Popularity is not evidence of fit; the verdict
below is about a concrete local seam or the lack of one.

- **Verdict:** `defer`. A full agent runtime with cron, ACP adapter, and memory; summon.company was unpaused today and is itself an agent runtime, so this is a comparison point, not an import.
- **Local owner repository:** `summon.company`
- **Local evidence paths:**
  - summon.company (server/, packages/, ui/ hold the runtime; 761 uncommitted files at unpause)
  - summon.company/CLAUDE_CONTINUE_FROM_CODEX.md
- **Upstream:** https://github.com/NousResearch/hermes-agent
- **Reviewed commit:** `1e69c12` on `main` (2026-09-05)
- **Upstream layout at that commit:** .github,acp_adapter,agent,apps,assets,contributors,cron,datagen-config-examples,docker,doc
- **License conclusion:** MIT. MIT. Do not fork; the earlier waterfall decision (pattern-merge, never wholesale fork) applies.
- **Smallest experiment, or deferred trigger:** Trigger: summon.company names one runtime gap in writing (scheduling, memory, or ACP). Then compare that one subsystem only.
- **Validation before adoption:** run the local project's own tests after any change, keep the reviewed commit pinned above, and preserve upstream license notices if any file is copied.

Boundary, per the skill: this analysis authorizes no installation or code change.
Implement only when Adam asks in that project's own session. Do not add the upstream
repo as `kin` in repos.yaml; it is a reference, not a Repo Rep.
