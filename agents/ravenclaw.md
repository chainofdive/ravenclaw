---
name: ravenclaw
description: Load work context from Ravenclaw and manage tasks. Use this when starting a new session to get full context of ongoing work, or when you need to update task status.
---

You are a developer working with the Ravenclaw work context management system. Ravenclaw tracks your epics, issues, wiki pages, and knowledge ontology.

## Structure: Project → Epic → Issue

- **Project** = one product, game, or work stream. Use `create_project` or `rc project create`.
- **Epic** = a phase/milestone within a project. Use `create_epic(project_id: "RC-P1", ...)`.
- **Issue** = an individual task within an epic. Use `create_issue(epic_id: "RC-E1", ...)`.
- **Phase ordering** = use `add_dependency` between epics. E.g., Epic "Phase 2" depends_on Epic "Phase 1".
- **Task ordering** = use `add_dependency` between issues within an epic.

Example: Project "SURVIVE" (RC-P1) has Epic "Phase 1 - Core Loop" (RC-E10) and Epic "Phase 2 - Game Loop" (RC-E11). RC-E11 depends_on RC-E10. Each epic has its own issues.

## Available Tools

You have access to Ravenclaw via MCP tools (if registered) or CLI (`rc` command).

### Quick Start — Loading Context

1. **Get full work context:**
   Use the `get_work_context` MCP tool, or run: `rc context`
   This returns all active epics, in-progress issues, recent activity, relevant wiki pages, and ontology.

2. **Get compact summary (token-efficient):**
   Use the `get_work_context_summary` MCP tool, or run: `rc context --compact`

3. **Check what's assigned to you:**
   Run: `rc issue list --status=in_progress`

### Session Lifecycle (IMPORTANT)

1. **Start:** `get_latest_context(project_id)` — read previous agent's handoff
2. **Start:** `start_work_session(project_id, session_id, agent_name)` — record your session
3. **Work:** `start_issue(id)` → do work → `complete_issue(id)`
4. **Save:** `save_context(project_id, content, "progress")` — save progress periodically
5. **End:** `save_context(project_id, content, "handoff")` — final summary for next agent
6. **End:** `end_work_session(session_id, summary, issues_worked)` — close your session

### Context Snapshots

**Always save context before ending a session.** Include:
- What was accomplished (issues completed/progressed)
- Key decisions made and why
- Blockers or open questions
- Clear next steps for the next agent

Use `save_context` MCP tool or `rc context save --project RC-P1 "..."`.

### Task Workflow

1. `rc issue start <key>` — Mark as in_progress
2. Do the work
3. `rc issue done <key>` — Mark as done
4. `save_context(...)` — Save progress snapshot

### Guidelines

- **ALWAYS call `get_latest_context` first** — this is how you inherit previous work
- **ALWAYS save context before ending** — this is how the next agent inherits your work
- Read comments on your assigned issues — the user may have left feedback
- Update issue status as you progress
- Use `list_work_sessions(project_id)` to see who worked before you
