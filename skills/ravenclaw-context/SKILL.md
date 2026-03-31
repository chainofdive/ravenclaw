---
name: ravenclaw-context
description: Load work context from Ravenclaw and prepare for task execution. Use at the start of a new session or when switching between tasks.
---

This skill helps you quickly load and apply work context from the Ravenclaw system.

When installed as a plugin, the MCP server and API credentials are configured automatically via `userConfig`. For standalone use, ensure the `rc` CLI is configured (`rc init`).

## Structure: Project → Epic → Issue

- **Project** = one product, game, campaign, or work stream. Use `create_project`.
- **Epic** = a phase or milestone within a project. Use `create_epic(project_id: "RC-P1", ...)`.
- **Issue** = an individual task within an epic. Use `create_issue(epic_id: "RC-E1", ...)`.
- **Ordering** = use `add_dependency` between epics (phase order) or between issues (task order).

## Steps

### 1. Load Previous Context

**IMPORTANT:** Before anything else, check if a previous agent left context:

```
get_latest_context(project_id: "RC-P1")
```

This shows what the previous agent accomplished, decisions made, blockers, and next steps.

### 2. Load Work Context

Get the full work context for the project:

```
get_project(key: "RC-P1")   — project tree with epics and issues
get_work_context             — full workspace context
```

Or via CLI:
```bash
rc project show RC-P1
rc context
```

### 3. Start Work Session

Record your session start:
```
start_work_session(project_id: "RC-P1", session_id: "<your-session-id>", agent_name: "claude-code")
```

### 4. Check User Comments

If working on a specific issue, check for user comments/feedback:
```
list_comments(entity_type: "issue", entity_id: "RC-I26")
```

### 5. Work on Issues

```
start_issue(id: "RC-I26")   — mark as in_progress
# ... do work ...
complete_issue(id: "RC-I26") — mark as done
```

### 6. Save Context (Periodically)

**Save your progress regularly** so the next agent can continue:

```
save_context(
  project_id: "RC-P1",
  content: "## Progress\n- Completed RC-I26 (card data structure)\n- RC-I27 in progress — deck shuffling works but draw logic needs edge case handling\n\n## Decisions\n- Using Fisher-Yates for shuffle\n\n## Next Steps\n- Finish RC-I27 draw edge cases\n- Start RC-I28 (hand UI)",
  snapshot_type: "progress"
)
```

### 7. End Session

Before ending, save a final handoff context and end the session:

```
save_context(project_id: "RC-P1", content: "...", snapshot_type: "handoff")
end_work_session(session_id: "<your-session-id>", summary: "Completed 3 issues", issues_worked: ["RC-I26", "RC-I27", "RC-I28"])
```

## Tips

- **Always call `get_latest_context` first** — it's how you inherit previous work
- **Save context frequently** — at minimum before ending your session
- Use `list_work_sessions(project_id: "RC-P1")` to see who worked on the project before
- Use `rc search "keyword"` to find relevant epics, issues, or wiki pages
- Always read comments before starting — the user may have specific instructions
