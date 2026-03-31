# Ravenclaw 세션 연동 가이드

새 작업 세션(Claude Code, Codex 등)에서 Ravenclaw 컨텍스트를 연동하는 방법입니다.
초기 설정은 [SETUP.md](./SETUP.md)를 참고하세요.

---

## 새 세션에서 지시하는 방법

### 방법 1: 스킬 호출 (추천)

```
/ravenclaw-context 를 실행해서 현재 작업 컨텍스트를 확인하고 이어서 작업해줘.
```

### 방법 2: CLI 기반 직접 지시

```
이 프로젝트는 Ravenclaw로 관리됩니다.
1. `rc context` 를 실행하여 전체 작업 컨텍스트를 확인해
2. 진행할 작업을 선택하고 `rc issue start <key>` 로 시작해
3. 작업 완료 시 `rc issue done <key>` 로 마무리해
4. 중요한 내용은 `rc wiki write <slug>` 로 위키에 기록해
```

### 방법 3: 특정 에픽 작업 지시

```
Ravenclaw에서 RC-E7 에픽을 확인하고 하위 이슈를 이어서 진행해줘.

확인 방법:
- MCP: get_epic(key: "RC-E7") 또는 list_issues(epic_id: "RC-E7")
- CLI: rc epic show RC-E7
```

### 방법 4: 컨텍스트 이관 (세션 전환)

이전 세션의 작업을 새 세션에서 이어받을 때:

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
  ├─ rc context (또는 MCP get_work_context)
  │   └─ 에픽/이슈 현황 파악
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

## MCP 도구 목록

| 도구 | 설명 |
|------|------|
| **에픽** | |
| `list_epics` | 에픽 목록 조회 (status, priority 필터) |
| `get_epic` | 에픽 상세 + 이슈 트리 (key 또는 UUID) |
| `create_epic` | 새 에픽 생성 |
| `update_epic` | 에픽 수정 |
| `delete_epic` | 에픽 삭제 |
| **이슈** | |
| `list_issues` | 이슈 목록 조회 (epic_id, status 필터) |
| `get_issue` | 이슈 상세 |
| `create_issue` | 새 이슈 생성 (epic key로 지정 가능) |
| `update_issue` | 이슈 수정 |
| `delete_issue` | 이슈 삭제 |
| `start_issue` | 이슈 작업 시작 (in_progress) |
| `complete_issue` | 이슈 완료 (done) |
| **컨텍스트** | |
| `get_work_context` | 전체 작업 컨텍스트 |
| `get_work_context_summary` | 요약 컨텍스트 (토큰 절약) |
| **위키** | |
| `list_wiki_pages` | 위키 목록 |
| `get_wiki_page` | 위키 페이지 조회 |
| `create_wiki_page` | 위키 생성 |
| `update_wiki_page` | 위키 수정 |
| **기타** | |
| `search` | 전체 텍스트 검색 |
| `list_comments` | 코멘트 조회 |
| `add_comment` | 코멘트 추가 |
| `acquire_lock` | 에픽 잠금 획득 |
| `release_lock` | 에픽 잠금 해제 |

---

## CLI 명령어 요약

```bash
# 컨텍스트
rc context                     # 전체 작업 컨텍스트
rc context --compact           # 요약 (토큰 절약)
rc context changes --since 2026-03-30T00:00:00Z

# 에픽
rc epic list                   # 에픽 목록
rc epic show RC-E7             # 에픽 상세 + 이슈 트리
rc epic create "제목"           # 에픽 생성
rc epic update RC-E7 --status active
rc epic delete RC-E7           # 에픽 삭제

# 이슈
rc issue list                  # 이슈 목록
rc issue list --status in_progress
rc issue create RC-E7 "제목"    # 이슈 생성 (에픽 key로)
rc issue start RC-I3           # 작업 시작
rc issue done RC-I3            # 작업 완료
rc issue delete RC-I3          # 이슈 삭제

# 위키
rc wiki list
rc wiki show architecture-overview

# 검색
rc search "키워드"

# 락 (동시 작업 보호)
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
