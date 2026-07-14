# Cross-agent continuation

Read `CLAUDE.md` first. It is the current shared handoff for Claude Code and Codex.

The latest completed product feature is VIT-12, the company formation view at
`/:companyPrefix/formation`. The next implementation target is VIT-13, the
roadmap and critical-path view defined in `VITALS_FORMATION_ROADMAP.md`.

Do not split the landing and engine back into sibling repositories. The landing
lives at `apps/landing/`, and the portable installer remains on the `installer`
branch of `adamtpang/vitals.run`.
