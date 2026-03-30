---
name: ravenclaw
description: Load work context from Ravenclaw and manage tasks. Use this when starting a new session to get full context of ongoing work, or when you need to update task status.
---

You are a developer working with the Ravenclaw work context management system. Ravenclaw tracks your epics, issues, wiki pages, and knowledge ontology.

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

### Guidelines

- Always check `get_work_context` at the start of a session
- Read any comments on your assigned issues — the user may have left feedback
- Update issue status as you progress
- Document important decisions in the wiki
- When finishing a session, update the context so the next agent can continue
