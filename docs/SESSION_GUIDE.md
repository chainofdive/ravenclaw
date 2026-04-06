# Ravenclaw Session Guide

How to connect AI coding agents to Ravenclaw and manage work context across sessions.
For initial setup, see [SETUP.md](./SETUP.md).

---

## Data Structure

```
Project (product / game / campaign)
  └─ Epic (phase / milestone)
       └─ Issue (individual task)
```

- **Project** = A single product, game, campaign, or work stream
- **Epic** = A phase or milestone within a project
- **Issue** = An individual task within an epic
- **Dependency** = Ordering between epics/issues (`add_dependency`)

---

## Web UI — Instruct Agents from the Browser (Recommended)

Chat with agents directly from the Projects page in the web dashboard.

1. **Open Projects page** → Select a project from the left panel
2. **Click Command** → Chat panel slides in from the right
3. **Type a message** → Agent executes in the project directory
4. **Conversation continues** → `claude --resume` maintains context across messages
5. **Session management** → Switch between past conversations or start new ones

Features:
- Real-time streaming responses (SSE)
- Chat history stored in DB (persists across server restarts)
- File path auto-detection — click to preview md/images/PDF
- Tool activity indicator (Running: Bash, Running: Edit, etc.)
- Permission mode: Auto-approve / Bypass / Accept edits / Interactive
- Fullscreen mode
- Agent selection: Claude Code / Gemini CLI / Codex

### Detail View and Editing

View and edit details of projects, epics, and issues.

- **List view**: Click project name, epic title, or issue row → detail panel
- **Graph view**: Click any node → detail panel
- **Issues table**: Click any row → detail panel
- Click title or description to edit inline
- Comments section included for epics and issues

---

## CLI / MCP — Agent Session Integration

### Method 1: Skill Invocation (Recommended)

```
Run /ravenclaw-context to load the current work context and continue where I left off.
```

### Method 2: Project-Based Instructions

```
Check project RC-P1 in Ravenclaw and continue with the next issue.

How to check:
- MCP: get_project(key: "RC-P1")
- CLI: rc project show RC-P1
```

### Method 3: CLI-Based Direct Instructions

```
This project is managed with Ravenclaw.
1. Run `rc context` to check the full work context
2. Pick a task and start it with `rc issue start <key>`
3. When done, mark it with `rc issue done <key>`
4. Record important decisions with `rc wiki write <slug>`
```

### Method 4: Context Handoff (Session Switch)

```
Load the Ravenclaw work context.
- Run `rc context` to understand the full situation
- Find in_progress issues and continue where they left off
- Reference existing wiki docs from previous sessions
```

---

## Workflow

```
Session starts
  │
  ├─ get_latest_context(RC-P1)         ← Load previous handoff
  ├─ start_work_session(RC-P1, ...)    ← Record session start
  ├─ rc project show RC-P1             ← Review epics/issues
  │
  ├─ Work
  │   ├─ rc issue start <key>
  │   ├─ ... coding ...
  │   ├─ complete_issue(<key>, summary: "what was done and why")
  │   │     ← Completion note persisted as comment, loaded in future contexts
  │   └─ save_context(RC-P1, "progress...")  ← Save checkpoint
  │
  ├─ Session end
  │   ├─ save_context(RC-P1, "handoff notes...", "handoff")
  │   └─ end_work_session(session_id, summary, issues_worked)
  │
  └─ Next session loads via get_latest_context
```

### What Is a Context Snapshot?

A progress summary saved by the agent during work. The next session's agent reads the latest snapshot via `get_latest_context` to continue seamlessly.

**What to include in a snapshot:**
- Completed issues and in-progress issues
- Technical decisions and rationale
- Discovered problems or blockers
- Tasks for the next agent to pick up

### What Are Completion Notes?

When an agent calls `complete_issue`, it can provide a `summary` parameter explaining what was done and why. This note is stored as a comment on the issue and automatically included when future sessions load context via `get_work_context`.

```
complete_issue("RC-I26", summary: "Used ECS pattern for card entities.
  Chose linked list over array for deck — O(1) shuffle required.
  Phaser selected over PixiJS for built-in physics support.")
```

The next session sees this in the work context:
```
- RC-I26 [DONE] Card data structures
  > Used ECS pattern for card entities. Chose linked list over array...
```

This prevents the common problem where agents rewrite code without understanding why it was written a certain way. The completion note carries the "why" forward across sessions.

If no summary is provided, the agent receives a warning encouraging it to record one.

---

## Registering a New Project

```bash
# 1. Create project (--directory sets where agents run)
rc project create "SURVIVE" --description "Poker roguelike game" --priority high --directory /path/to/survive

# 2. Create epics — specify project key
# MCP: create_epic(project_id: "RC-P1", title: "Phase 1 - Core Loop")
# CLI:
rc epic create "Phase 1 - Core Loop" --project RC-P1

# 3. Create issues — specify epic key
rc issue create RC-E1 "Implement card data structures" --priority critical

# 4. Set epic ordering (Phase 2 depends on Phase 1)
# MCP: add_dependency(source_type: "epic", source_id: "RC-E2", target_type: "epic", target_id: "RC-E1", dependency_type: "depends_on")
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| **Projects** | |
| `list_projects` | List all projects |
| `get_project` | Project details + epic/issue tree |
| `create_project` | Create a project |
| `update_project` | Update a project |
| `delete_project` | Delete a project |
| **Epics** | |
| `list_epics` | List all epics |
| `get_epic` | Epic details + issue tree |
| `create_epic` | Create an epic (link via project_id) |
| `update_epic` | Update an epic |
| `delete_epic` | Delete an epic |
| **Issues** | |
| `list_issues` | List all issues |
| `create_issue` | Create an issue (specify epic key) |
| `update_issue` | Update an issue |
| `delete_issue` | Delete an issue |
| `start_issue` | Mark issue as in progress |
| `complete_issue` | Mark issue as done (accepts optional `summary` for completion note) |
| **Dependencies** | |
| `add_dependency` | Add epic-to-epic or issue-to-issue dependency |
| `list_dependencies` | List dependencies |
| `remove_dependency` | Remove a dependency |
| **Sessions & Snapshots** | |
| `save_context` | Save a progress snapshot |
| `get_latest_context` | Load the latest snapshot (handoff) |
| `list_context_snapshots` | Snapshot history |
| `start_work_session` | Record session start |
| `end_work_session` | Record session end |
| `list_work_sessions` | Session history |
| **Human Input** | |
| `request_human_input` | Ask the user a question (answered via web UI) |
| `check_human_input` | Check for an answer (polling) |
| `list_pending_inputs` | List pending questions |
| **Context** | |
| `get_work_context` | Full work context |
| `get_work_context_summary` | Summarized context (saves tokens) |
| **Other** | |
| `search` | Full-text search |
| `list_wiki_pages` / `create_wiki_page` / `update_wiki_page` | Wiki |
| `list_comments` / `add_comment` | Comments |
| `acquire_lock` / `release_lock` | Epic locking |

---

## CLI Reference

```bash
# Projects
rc project list                # List projects
rc project show RC-P1          # Project tree (epics + issues)
rc project create "Name" --directory /path/to/project
rc project update RC-P1 --status active --directory /new/path
rc project delete RC-P1

# Epics
rc epic list
rc epic show RC-E7
rc epic create "Phase 1" --project RC-P1
rc epic update RC-E7 --status active
rc epic delete RC-E7

# Issues
rc issue list
rc issue create RC-E7 "Title"
rc issue start RC-I3
rc issue done RC-I3
rc issue delete RC-I3

# Context & Snapshots
rc context                                 # Full context
rc context save RC-P1 "progress..."        # Save snapshot
rc context latest RC-P1                    # Latest snapshot
rc context history RC-P1                   # Snapshot history

# Sessions
rc session start -p RC-P1 -s my-session    # Start session
rc session end -s my-session --summary "..." # End session
rc session list -p RC-P1                   # Session history

# Wiki / Search
rc wiki list
rc search "keyword"

# Locks
rc lock list
rc lock acquire <epic-id> --session $SESSION_ID
rc lock release <epic-id> --session $SESSION_ID
```

---

## Troubleshooting

| Symptom | Solution |
|---------|----------|
| `CONNECTION_ERROR` | Check API server: `curl http://localhost:3000/api/v1/health` |
| `UNAUTHORIZED` | Check API key in `cat ~/.ravenclaw/config.json` |
| MCP tools not visible | Verify ravenclaw MCP server in `~/.claude.json` |
| `/ravenclaw-context` not working | Check `ls ~/.claude/skills/ravenclaw-context` |
| `LOCKED` error | `rc lock list` → `rc lock force-release <epic-id>` |
