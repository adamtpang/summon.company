# Handoff: learn from obra/superpowers

Written 2026-09-03 by the Aether root session, using the github-star-match skill. This
repo was on Adam's GitHub stars; it was reviewed against summon.company, this file was
written, and the star was removed. Popularity is not evidence of fit; the verdict
below is about a concrete local seam or the lack of one.

- **Verdict:** `borrow selectively`. A skills framework plus a subagent-driven SDLC methodology, the closest published match to how this workspace already works.
- **Local owner repository:** `summon.company`
- **Local evidence paths:**
  - summon.company/CLAUDE.md
  - Aether/CLAUDE.md (standing rules on manual-before-automate)
- **Upstream:** https://github.com/obra/superpowers
- **Reviewed commit:** `b36e082` on `main` (2026-08-12)
- **Upstream layout at that commit:** .agents,.claude-plugin,.codex-plugin,.cursor-plugin,.devin-plugin,.github,.hermes-plugin,.
- **License conclusion:** MIT. MIT. Vet its plugin dirs before enabling any; it ships plugins for six agents.
- **Smallest experiment, or deferred trigger:** Read the methodology docs, then adopt one practice (its brainstorm-to-spec gate) on one summon.company task, and judge by whether the task shipped faster.
- **Validation before adoption:** run the local project's own tests after any change, keep the reviewed commit pinned above, and preserve upstream license notices if any file is copied.

Boundary, per the skill: this analysis authorizes no installation or code change.
Implement only when Adam asks in that project's own session. Do not add the upstream
repo as `kin` in repos.yaml; it is a reference, not a Repo Rep.
