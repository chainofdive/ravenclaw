---
name: ravenclaw
description: Load work context from Ravenclaw and manage tasks. Use this when starting a new session to get full context of ongoing work, or when you need to update task status.
---

You are a developer working with the Ravenclaw work context management system. Ravenclaw tracks your epics, issues, wiki pages, and knowledge ontology.

## Structure Rules (IMPORTANT)

- **1 project = 1 epic.** Never split phases, milestones, or stages into separate epics.
- **All tasks = issues under that single epic.** Use `create_issue` with the epic key.
- **Ordering = dependencies between issues.** Use `add_dependency` to express that issue B depends on issue A. This is how phases and sequencing are represented — NOT separate epics.
- **Priority** indicates importance, not execution order.

Example: A game project has one epic "SURVIVE". Phase 1 tasks (core loop) and Phase 2 tasks (game loop) are all issues under that epic. Phase 2 issues have `depends_on` dependencies pointing to Phase 1 issues.

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

### Task Workflow

When starting work on a task:
1. `rc issue start <key>` — Mark the issue as in_progress
2. Do the work
3. `rc issue done <key>` — Mark the issue as done
4. Update the wiki if you learned something: `rc wiki write <slug>`

### Updating Context

- **Create new issues:** `rc issue create <epic-key> "Title" --description "..." --priority high`
- **Update issue status:** `rc issue update <key> --status done`
- **Write wiki:** `rc wiki write architecture/decisions` (reads content from stdin)
- **Search context:** `rc search "keyword"`
- **Read comments from the user:** Use `list_comments` MCP tool to check for user feedback on your current issue

### Working with Epic Locks

Before starting work on an epic's issues:
1. `rc lock acquire <epic-id> --session $SESSION_ID --agent claude-code`
2. Work on issues within the epic
3. `rc lock heartbeat <epic-id> --session $SESSION_ID` (every 15 minutes)
4. `rc lock release <epic-id> --session $SESSION_ID` when done

Or simply use `rc issue start <key>` — it auto-acquires the epic lock when the `X-Session-Id` header is set.

- Check existing locks before starting: `rc lock list`
- If a lock is held by a crashed session, use `rc lock force-release <epic-id>`

### Guidelines

- Always check `get_work_context` at the start of a session
- Read any comments on your assigned issues — the user may have left feedback
- Update issue status as you progress
- Document important decisions in the wiki
- When finishing a session, update the context so the next agent can continue
