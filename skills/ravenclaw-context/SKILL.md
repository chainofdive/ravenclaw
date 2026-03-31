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
  - Example: `add_dependency(source_type: "epic", source_id: "RC-E2", target_type: "epic", target_id: "RC-E1", dependency_type: "depends_on")` means Phase 2 starts after Phase 1.

## Steps

### 1. Load Work Context

First, get the full work context. If the Ravenclaw MCP server is available (auto-configured when installed as a plugin), use the `get_work_context` tool. Otherwise, run the CLI:

```bash
rc context
```

### 2. Review Active Work

Check what's currently in progress:
```bash
rc issue list --status=in_progress --format=table
```

Check what's blocked or ready to start:
```bash
rc issue list --status=todo --format=table
```

### 3. Check User Comments

If working on a specific issue, check for user comments/feedback:
```bash
rc comment list issue <issue-id>
```

### 4. Start Working

Pick an issue to work on and mark it:
```bash
rc issue start <key>
```

### 5. When Done

Update the issue and add any relevant wiki documentation:
```bash
rc issue done <key>
rc wiki write <topic-slug>
```

## Tips

- Use `rc context --compact` for a token-efficient summary
- Use `rc search "keyword"` to find relevant epics, issues, or wiki pages
- Always read comments before starting — the user may have specific instructions
- Update the wiki with architectural decisions or important context for future agents
