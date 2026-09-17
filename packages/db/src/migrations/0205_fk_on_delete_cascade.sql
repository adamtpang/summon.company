-- SUM-130: Make company deletion structurally safe.
-- Every FK reachable from companies gets an explicit ON DELETE rule.
-- After this migration, deleting a company row cascades to all owned children;
-- remove() in the service shrinks to a single DELETE on companies.
--
-- Convention:
--   company_id → companies.id  : ON DELETE CASCADE   (owned child)
--   <anything>_id → agents/runs: ON DELETE SET NULL  (soft reference)
--   issue_id → issues.id       : ON DELETE CASCADE   (owned child)
--   run_id   → heartbeat_runs  : ON DELETE CASCADE   (owned child) or SET NULL
--   self-refs / optional links : ON DELETE SET NULL

-- ─── Part 1: company_id → companies.id CASCADE ─────────────────────────────

ALTER TABLE "activity_log" DROP CONSTRAINT IF EXISTS "activity_log_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "agent_api_keys" DROP CONSTRAINT IF EXISTS "agent_api_keys_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "agent_config_revisions" DROP CONSTRAINT IF EXISTS "agent_config_revisions_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "agent_config_revisions" ADD CONSTRAINT "agent_config_revisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "agent_runtime_state" DROP CONSTRAINT IF EXISTS "agent_runtime_state_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "agent_runtime_state" ADD CONSTRAINT "agent_runtime_state_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "agent_task_sessions" DROP CONSTRAINT IF EXISTS "agent_task_sessions_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "agent_task_sessions" ADD CONSTRAINT "agent_task_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "agent_wakeup_requests" DROP CONSTRAINT IF EXISTS "agent_wakeup_requests_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD CONSTRAINT "agent_wakeup_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "approval_comments" DROP CONSTRAINT IF EXISTS "approval_comments_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "approvals" DROP CONSTRAINT IF EXISTS "approvals_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "budget_incidents" DROP CONSTRAINT IF EXISTS "budget_incidents_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "budget_incidents" ADD CONSTRAINT "budget_incidents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "budget_policies" DROP CONSTRAINT IF EXISTS "budget_policies_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "budget_policies" ADD CONSTRAINT "budget_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "built_in_managed_resources" DROP CONSTRAINT IF EXISTS "built_in_managed_resources_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "built_in_managed_resources" ADD CONSTRAINT "built_in_managed_resources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "company_memberships" DROP CONSTRAINT IF EXISTS "company_memberships_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "company_secret_bindings" DROP CONSTRAINT IF EXISTS "company_secret_bindings_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "company_secret_bindings" ADD CONSTRAINT "company_secret_bindings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "company_secrets" DROP CONSTRAINT IF EXISTS "company_secrets_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "company_secrets" ADD CONSTRAINT "company_secrets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "company_skills" DROP CONSTRAINT IF EXISTS "company_skills_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "company_skills" ADD CONSTRAINT "company_skills_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "document_annotation_anchor_snapshots" DROP CONSTRAINT IF EXISTS "document_annotation_anchor_snapshots_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "document_annotation_anchor_snapshots" ADD CONSTRAINT "document_annotation_anchor_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "document_annotation_comments" DROP CONSTRAINT IF EXISTS "document_annotation_comments_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "document_annotation_comments" ADD CONSTRAINT "document_annotation_comments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "document_annotation_threads" DROP CONSTRAINT IF EXISTS "document_annotation_threads_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "document_annotation_threads" ADD CONSTRAINT "document_annotation_threads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "document_revisions" DROP CONSTRAINT IF EXISTS "document_revisions_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "environment_custom_image_setup_sessions" DROP CONSTRAINT IF EXISTS "environment_custom_image_setup_sessions_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "environment_custom_image_setup_sessions" ADD CONSTRAINT "environment_custom_image_setup_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "environment_custom_image_templates" DROP CONSTRAINT IF EXISTS "environment_custom_image_templates_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "environment_custom_image_templates" ADD CONSTRAINT "environment_custom_image_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "execution_workspaces" DROP CONSTRAINT IF EXISTS "execution_workspaces_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "execution_workspaces" ADD CONSTRAINT "execution_workspaces_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "feedback_exports" DROP CONSTRAINT IF EXISTS "feedback_exports_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "feedback_exports" ADD CONSTRAINT "feedback_exports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "feedback_votes" DROP CONSTRAINT IF EXISTS "feedback_votes_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "feedback_votes" ADD CONSTRAINT "feedback_votes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "finance_events" DROP CONSTRAINT IF EXISTS "finance_events_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "goals" DROP CONSTRAINT IF EXISTS "goals_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "heartbeat_run_events" DROP CONSTRAINT IF EXISTS "heartbeat_run_events_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "heartbeat_run_events" ADD CONSTRAINT "heartbeat_run_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "heartbeat_run_watchdog_decisions" DROP CONSTRAINT IF EXISTS "heartbeat_run_watchdog_decisions_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "heartbeat_run_watchdog_decisions" ADD CONSTRAINT "heartbeat_run_watchdog_decisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "heartbeat_runs" DROP CONSTRAINT IF EXISTS "heartbeat_runs_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "inbox_dismissals" DROP CONSTRAINT IF EXISTS "inbox_dismissals_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "inbox_dismissals" ADD CONSTRAINT "inbox_dismissals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "invites" DROP CONSTRAINT IF EXISTS "invites_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_approvals" DROP CONSTRAINT IF EXISTS "issue_approvals_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_attachments" DROP CONSTRAINT IF EXISTS "issue_attachments_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_comments" DROP CONSTRAINT IF EXISTS "issue_comments_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_documents" DROP CONSTRAINT IF EXISTS "issue_documents_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_documents" ADD CONSTRAINT "issue_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_execution_decisions" DROP CONSTRAINT IF EXISTS "issue_execution_decisions_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_execution_decisions" ADD CONSTRAINT "issue_execution_decisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_inbox_archives" DROP CONSTRAINT IF EXISTS "issue_inbox_archives_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_inbox_archives" ADD CONSTRAINT "issue_inbox_archives_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_plan_decompositions" DROP CONSTRAINT IF EXISTS "issue_plan_decompositions_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_plan_decompositions" ADD CONSTRAINT "issue_plan_decompositions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_read_states" DROP CONSTRAINT IF EXISTS "issue_read_states_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_read_states" ADD CONSTRAINT "issue_read_states_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_recovery_actions" DROP CONSTRAINT IF EXISTS "issue_recovery_actions_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_recovery_actions" ADD CONSTRAINT "issue_recovery_actions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_reference_mentions" DROP CONSTRAINT IF EXISTS "issue_reference_mentions_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_reference_mentions" ADD CONSTRAINT "issue_reference_mentions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_relations" DROP CONSTRAINT IF EXISTS "issue_relations_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_relations" ADD CONSTRAINT "issue_relations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_thread_interactions" DROP CONSTRAINT IF EXISTS "issue_thread_interactions_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_thread_interactions" ADD CONSTRAINT "issue_thread_interactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_tree_hold_members" DROP CONSTRAINT IF EXISTS "issue_tree_hold_members_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_tree_hold_members" ADD CONSTRAINT "issue_tree_hold_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_tree_holds" DROP CONSTRAINT IF EXISTS "issue_tree_holds_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_tree_holds" ADD CONSTRAINT "issue_tree_holds_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_work_products" DROP CONSTRAINT IF EXISTS "issue_work_products_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD CONSTRAINT "issue_work_products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "join_requests" DROP CONSTRAINT IF EXISTS "join_requests_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "principal_permission_grants" DROP CONSTRAINT IF EXISTS "principal_permission_grants_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "principal_permission_grants" ADD CONSTRAINT "principal_permission_grants_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "project_goals" DROP CONSTRAINT IF EXISTS "project_goals_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "project_goals" ADD CONSTRAINT "project_goals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "project_workspaces" DROP CONSTRAINT IF EXISTS "project_workspaces_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "project_workspaces" ADD CONSTRAINT "project_workspaces_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "routine_documents" DROP CONSTRAINT IF EXISTS "routine_documents_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "routine_documents" ADD CONSTRAINT "routine_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "secret_access_events" DROP CONSTRAINT IF EXISTS "secret_access_events_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "secret_access_events" ADD CONSTRAINT "secret_access_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "workspace_operations" DROP CONSTRAINT IF EXISTS "workspace_operations_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "workspace_operations" ADD CONSTRAINT "workspace_operations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "workspace_runtime_services" DROP CONSTRAINT IF EXISTS "workspace_runtime_services_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "workspace_runtime_services" ADD CONSTRAINT "workspace_runtime_services_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

-- ─── Part 2: agent soft-references → SET NULL ──────────────────────────────
-- These columns hold optional attribution; setting them null when an agent row
-- is cascade-deleted keeps the parent record intact and unblocks the cascade
-- chain (otherwise agents.company_id CASCADE would hit RESTRICT here).

ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_reports_to_agents_id_fk";--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_reports_to_agents_id_fk" FOREIGN KEY ("reports_to") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_assignee_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_agent_id_agents_id_fk" FOREIGN KEY ("assignee_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_created_by_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_parent_id_issues_id_fk";--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_parent_id_issues_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."issues"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_project_id_projects_id_fk";--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_goal_id_goals_id_fk";--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "heartbeat_runs" DROP CONSTRAINT IF EXISTS "heartbeat_runs_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "heartbeat_runs" DROP CONSTRAINT IF EXISTS "heartbeat_runs_wakeup_request_id_agent_wakeup_requests_id_fk";--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_wakeup_request_id_agent_wakeup_requests_id_fk" FOREIGN KEY ("wakeup_request_id") REFERENCES "public"."agent_wakeup_requests"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "heartbeat_run_events" DROP CONSTRAINT IF EXISTS "heartbeat_run_events_run_id_heartbeat_runs_id_fk";--> statement-breakpoint
ALTER TABLE "heartbeat_run_events" ADD CONSTRAINT "heartbeat_run_events_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "heartbeat_run_events" DROP CONSTRAINT IF EXISTS "heartbeat_run_events_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "heartbeat_run_events" ADD CONSTRAINT "heartbeat_run_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_issue_id_issues_id_fk";--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_project_id_projects_id_fk";--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_goal_id_goals_id_fk";--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_heartbeat_run_id_heartbeat_runs_id_fk";--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_comments" DROP CONSTRAINT IF EXISTS "issue_comments_issue_id_issues_id_fk";--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_comments" DROP CONSTRAINT IF EXISTS "issue_comments_author_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_thread_interactions" DROP CONSTRAINT IF EXISTS "issue_thread_interactions_issue_id_issues_id_fk";--> statement-breakpoint
ALTER TABLE "issue_thread_interactions" ADD CONSTRAINT "issue_thread_interactions_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_thread_interactions" DROP CONSTRAINT IF EXISTS "issue_thread_interactions_created_by_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "issue_thread_interactions" ADD CONSTRAINT "issue_thread_interactions_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_thread_interactions" DROP CONSTRAINT IF EXISTS "issue_thread_interactions_resolved_by_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "issue_thread_interactions" ADD CONSTRAINT "issue_thread_interactions_resolved_by_agent_id_agents_id_fk" FOREIGN KEY ("resolved_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_execution_decisions" DROP CONSTRAINT IF EXISTS "issue_execution_decisions_actor_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "issue_execution_decisions" ADD CONSTRAINT "issue_execution_decisions_actor_agent_id_agents_id_fk" FOREIGN KEY ("actor_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_inbox_archives" DROP CONSTRAINT IF EXISTS "issue_inbox_archives_issue_id_issues_id_fk";--> statement-breakpoint
ALTER TABLE "issue_inbox_archives" ADD CONSTRAINT "issue_inbox_archives_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "feedback_votes" DROP CONSTRAINT IF EXISTS "feedback_votes_issue_id_issues_id_fk";--> statement-breakpoint
ALTER TABLE "feedback_votes" ADD CONSTRAINT "feedback_votes_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_watchdogs" DROP CONSTRAINT IF EXISTS "issue_watchdogs_watchdog_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "issue_watchdogs" ADD CONSTRAINT "issue_watchdogs_watchdog_agent_id_agents_id_fk" FOREIGN KEY ("watchdog_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_outcomes" DROP CONSTRAINT IF EXISTS "issue_outcomes_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "issue_outcomes" ADD CONSTRAINT "issue_outcomes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "issue_outcomes" DROP CONSTRAINT IF EXISTS "issue_outcomes_issue_id_issues_id_fk";--> statement-breakpoint
ALTER TABLE "issue_outcomes" ADD CONSTRAINT "issue_outcomes_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "budget_incidents" DROP CONSTRAINT IF EXISTS "budget_incidents_policy_id_budget_policies_id_fk";--> statement-breakpoint
ALTER TABLE "budget_incidents" ADD CONSTRAINT "budget_incidents_policy_id_budget_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."budget_policies"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "budget_incidents" DROP CONSTRAINT IF EXISTS "budget_incidents_approval_id_approvals_id_fk";--> statement-breakpoint
ALTER TABLE "budget_incidents" ADD CONSTRAINT "budget_incidents_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "activity_log" DROP CONSTRAINT IF EXISTS "activity_log_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "activity_log" DROP CONSTRAINT IF EXISTS "activity_log_run_id_heartbeat_runs_id_fk";--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

-- ─── Part 3: additional agent/run soft-refs (block cascade without SET NULL) ─

ALTER TABLE "agent_task_sessions" DROP CONSTRAINT IF EXISTS "agent_task_sessions_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "agent_task_sessions" ADD CONSTRAINT "agent_task_sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "agent_task_sessions" DROP CONSTRAINT IF EXISTS "agent_task_sessions_last_run_id_heartbeat_runs_id_fk";--> statement-breakpoint
ALTER TABLE "agent_task_sessions" ADD CONSTRAINT "agent_task_sessions_last_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("last_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "agent_wakeup_requests" DROP CONSTRAINT IF EXISTS "agent_wakeup_requests_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD CONSTRAINT "agent_wakeup_requests_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "approvals" DROP CONSTRAINT IF EXISTS "approvals_requested_by_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_agent_id_agents_id_fk" FOREIGN KEY ("requested_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "approval_comments" DROP CONSTRAINT IF EXISTS "approval_comments_approval_id_approvals_id_fk";--> statement-breakpoint
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "approval_comments" DROP CONSTRAINT IF EXISTS "approval_comments_author_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_created_by_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "finance_events" DROP CONSTRAINT IF EXISTS "finance_events_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "finance_events" DROP CONSTRAINT IF EXISTS "finance_events_issue_id_issues_id_fk";--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "finance_events" DROP CONSTRAINT IF EXISTS "finance_events_heartbeat_run_id_heartbeat_runs_id_fk";--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "goals" DROP CONSTRAINT IF EXISTS "goals_parent_id_goals_id_fk";--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_id_goals_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "goals" DROP CONSTRAINT IF EXISTS "goals_owner_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "join_requests" DROP CONSTRAINT IF EXISTS "join_requests_created_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_created_agent_id_agents_id_fk" FOREIGN KEY ("created_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_goal_id_goals_id_fk";--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_lead_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_agent_id_agents_id_fk" FOREIGN KEY ("lead_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "routines" DROP CONSTRAINT IF EXISTS "routines_assignee_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_assignee_agent_id_agents_id_fk" FOREIGN KEY ("assignee_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint
