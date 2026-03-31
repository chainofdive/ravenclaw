# Ravenclaw 세션 연동 가이드

새 작업 세션(Claude Code, Codex 등)에서 Ravenclaw 컨텍스트를 연동하는 방법입니다.
초기 설정은 [SETUP.md](./SETUP.md)를 참고하세요.

---

## 데이터 구조

```
Project (프로젝트/제품)
  └─ Epic (단계/마일스톤)
       └─ Issue (개별 작업)
```

- **프로젝트** = 하나의 제품, 게임, 캠페인 등 작업 스트림
- **에픽** = 프로젝트 내 단계(phase) 또는 마일스톤
- **이슈** = 에픽 내 개별 작업
- **의존성** = 에픽 간/이슈 간 순서 표현 (`add_dependency`)

---

## 새 세션에서 지시하는 방법

### 방법 1: 스킬 호출 (추천)

```
/ravenclaw-context 를 실행해서 현재 작업 컨텍스트를 확인하고 이어서 작업해줘.
```

### 방법 2: 프로젝트 기반 작업 지시

```
Ravenclaw에서 RC-P1 프로젝트를 확인하고 다음 단계 이슈를 이어서 진행해줘.

확인 방법:
- MCP: get_project(key: "RC-P1")
- CLI: rc project show RC-P1
```

### 방법 3: CLI 기반 직접 지시

```
이 프로젝트는 Ravenclaw로 관리됩니다.
1. `rc context` 를 실행하여 전체 작업 컨텍스트를 확인해
2. 진행할 작업을 선택하고 `rc issue start <key>` 로 시작해
3. 작업 완료 시 `rc issue done <key>` 로 마무리해
4. 중요한 내용은 `rc wiki write <slug>` 로 위키에 기록해
```

### 방법 4: 컨텍스트 이관 (세션 전환)

```
Ravenclaw 작업 컨텍스트를 확인해줘.
- `rc context` 로 전체 상황 파악
- in_progress 상태인 이슈를 확인하고 이어서 진행
- 기존 세션의 wiki 문서도 참고해서 작업해줘
```

---

## 작업 플로우

```
세션 시작
  │
  ├─ rc project show RC-P1 (또는 rc context)
  │   └─ 프로젝트 내 에픽/이슈 현황 파악
  │
  ├─ 작업할 이슈 선택
  │   └─ rc issue start <key>
  │
  ├─ 코딩 작업 수행
  │
  ├─ 작업 완료
  │   ├─ rc issue done <key>
  │   ├─ rc wiki write <slug>  (필요 시)
  │   └─ rc issue create <epic-key> "후속 작업"  (필요 시)
  │
  └─ 세션 종료 (컨텍스트는 Ravenclaw에 저장됨)
```

---

## 새 프로젝트 등록 시

```bash
# 1. 프로젝트 생성
rc project create "SURVIVE" --description "포커 기반 로그라이크 게임" --priority high

# 2. 에픽(단계) 생성 — project key 지정
# MCP: create_epic(project_id: "RC-P1", title: "Phase 1 - 코어 루프")
# CLI:
rc epic create "Phase 1 - 코어 루프" --project RC-P1

# 3. 이슈 생성 — epic key 지정
rc issue create RC-E1 "카드 데이터 구조 구현" --priority critical

# 4. 에픽 간 순서 설정 (Phase 2는 Phase 1 이후)
# MCP: add_dependency(source_type: "epic", source_id: "RC-E2", target_type: "epic", target_id: "RC-E1", dependency_type: "depends_on")
```

---

## MCP 도구 목록

| 도구 | 설명 |
|------|------|
| **프로젝트** | |
| `list_projects` | 프로젝트 목록 |
| `get_project` | 프로젝트 상세 + 에픽/이슈 트리 |
| `create_project` | 프로젝트 생성 |
| `update_project` | 프로젝트 수정 |
| `delete_project` | 프로젝트 삭제 |
| **에픽** | |
| `list_epics` | 에픽 목록 |
| `get_epic` | 에픽 상세 + 이슈 트리 |
| `create_epic` | 에픽 생성 (project_id로 프로젝트 연결) |
| `update_epic` | 에픽 수정 |
| `delete_epic` | 에픽 삭제 |
| **이슈** | |
| `list_issues` | 이슈 목록 |
| `create_issue` | 이슈 생성 (epic key로 지정 가능) |
| `update_issue` | 이슈 수정 |
| `delete_issue` | 이슈 삭제 |
| `start_issue` | 이슈 작업 시작 |
| `complete_issue` | 이슈 완료 |
| **의존성** | |
| `add_dependency` | 에픽 간/이슈 간 의존성 추가 |
| `list_dependencies` | 의존성 조회 |
| `remove_dependency` | 의존성 제거 |
| **컨텍스트** | |
| `get_work_context` | 전체 작업 컨텍스트 |
| `get_work_context_summary` | 요약 컨텍스트 (토큰 절약) |
| **기타** | |
| `search` | 전체 텍스트 검색 |
| `list_wiki_pages` / `create_wiki_page` / `update_wiki_page` | 위키 |
| `list_comments` / `add_comment` | 코멘트 |
| `acquire_lock` / `release_lock` | 에픽 잠금 |

---

## CLI 명령어 요약

```bash
# 프로젝트
rc project list                # 프로젝트 목록
rc project show RC-P1          # 프로젝트 트리 (에픽 + 이슈)
rc project create "이름"        # 프로젝트 생성
rc project update RC-P1 --status active
rc project delete RC-P1

# 에픽
rc epic list
rc epic show RC-E7
rc epic create "Phase 1" --project RC-P1
rc epic update RC-E7 --status active
rc epic delete RC-E7

# 이슈
rc issue list
rc issue create RC-E7 "제목"
rc issue start RC-I3
rc issue done RC-I3
rc issue delete RC-I3

# 컨텍스트 / 위키 / 검색
rc context
rc wiki list
rc search "키워드"

# 락
rc lock list
rc lock acquire <epic-id> --session $SESSION_ID
rc lock release <epic-id> --session $SESSION_ID
```

---

## 트러블슈팅

| 증상 | 해결 |
|------|------|
| `CONNECTION_ERROR` | API 서버 실행 확인: `curl http://localhost:3000/api/v1/health` |
| `UNAUTHORIZED` | `cat ~/.ravenclaw/config.json`에서 api_key 확인 |
| MCP 도구 안 보임 | `~/.claude.json`에 ravenclaw MCP 서버 등록 확인 |
| `/ravenclaw-context` 안됨 | `ls ~/.claude/skills/ravenclaw-context` 확인 |
| `LOCKED` 에러 | `rc lock list` → `rc lock force-release <epic-id>` |
