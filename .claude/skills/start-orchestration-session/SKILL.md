---
name: start-orchestration-session
description: 요구사항 하나를 Orca orchestration + git worktree로 분석·설계·계획·TDD 구현·리뷰까지 다수 에이전트에 나눠 수행하는 파이프라인 진입점. 사용자가 "/start-orchestration-session", "오케스트레이션 시작", "이 요구사항 파이프라인으로 돌려줘", "에이전트 나눠서 구현해줘"라고 할 때 사용. 코디네이터는 feature/xxxxx-master worktree에서 사람과 소통하고 나머지 단계는 워커에게 위임한다.
---

# start-orchestration-session — 요구사항 오케스트레이션 파이프라인

요구사항 하나를 받아 분석 → 설계 → 스펙 리뷰 → 계획 → 계획 리뷰 → TDD 구현(모듈 병렬)
→ 통합 → 코드 리뷰 → 최종 반환까지 자동으로 돈다.

설계 정본은 [`parfait/specs/2026-08-05-orchestration-session-pipeline.md`](../../../parfait/specs/2026-08-05-orchestration-session-pipeline.md).
이 문서와 스펙이 어긋나면 스펙이 정답이다.

## 이 스킬을 쓰지 않는 경우

- 단순 온보딩만 필요하다 → `start-default-session`
- 위키(`wiki/`·`raw/`) 작업 → `ingest`·`query`·`lint`
- 파일 한두 개 고치는 수준의 변경 → 파이프라인 비용이 이득보다 크다. 그냥 한다.

## 용어

| 표기 | 뜻 |
|---|---|
| 코디네이터 | `feature/xxxxx-master` worktree에서 도는 이 세션. 사람과 소통하는 유일한 지점 |
| W1 analyst | 요구분석 + 설계. `parfait/specs/`에 스펙 작성 |
| W2 spec-reviewer | 스펙 독립 검수 |
| W3 planner | 파일 선택 + 모듈 분할 + 테스트 명세. `parfait/plans/`에 계획 작성 |
| W4 plan-reviewer | 계획 독립 검수 |
| wt-domain / wt-data / wt-feature | Gradle 모듈별 구현 자식 worktree |
| wt-integrate | 병합·전체 테스트·코드 리뷰 자식 worktree |
| G1 / G2 / G3 | 사람 게이트 — 스펙 승인 / 계획 승인 / 최종 보고 |
| 프로필 | 모델 배치 3종 — `균형`(기본) / `품질` / `비용` |

## 0. 전제 확인

아래를 먼저 실행하고, 하나라도 실패하면 파이프라인을 시작하지 않고 사용자에게 보고한다.

```bash
orca status --json
orca repo list --json
orca worktree list --json
```

확인 항목:

| 항목 | 판정 |
|---|---|
| 런타임 | `result.runtime.state == "ready"` |
| orchestration | `result.runtime.capabilities`에 `orchestration.contract.v1` 포함 |
| TJYG-Android 등록 | `repo list`에 `TJYG-Android` 존재 |
| master worktree | `worktree list`에 `feature/…-master` 브랜치의 TJYG-Android worktree 존재 |
| 시작 정책 | TJYG-Android `hookSettings.setupAgentStartupPolicy` 값을 기록해 둔다 |

`feature/…-master` worktree가 없으면 만들고 시작한다.

```bash
orca worktree create --name <xxxxx>-master --repo name:TJYG-Android --base-branch develop --json
```

시작 정책이 `wait-for-setup`이면 모델 지정 2단계 경로(§4)를 쓸 수 없다.
그때는 모든 워커를 `--agent claude`(기본 모델)로 띄우고, 그 사실을 사용자에게 알린다.
`start-immediately`(2026-08-05 기준 현재 값)면 그대로 진행한다.

## 1. 요구사항 수집

사용자에게 요구사항을 받고, 아래 세 가지를 확정한다. 답이 없으면 기본값을 쓰고 그 사실을 알린다.

| 항목 | 기본값 | 의미 |
|---|---|---|
| 프로필 | `균형` | 모델 배치. 아래 표 |
| 진행 방식 | 게이트 유지 | `자동진행`이면 G1·G2를 건너뛰고 G3만 받는다 |
| master 브랜치 | 현재 worktree의 브랜치 | 결과를 돌려줄 대상 |

### 프로필

| 워커 | 균형(기본) | 품질 | 비용 |
|---|---|---|---|
| W1 analyst | Opus | Opus | Opus |
| W2 spec-reviewer | Opus | Opus | Opus |
| W3 planner | Opus | Opus | Sonnet |
| W4 plan-reviewer | Opus | Opus | Sonnet |
| 모듈 구현 워커 | 계획서의 `model:` | Opus | Sonnet |
| integrator | Sonnet | Opus | Sonnet |
| code-reviewer | Opus | Opus | Opus |

`품질`은 아키텍처를 건드리는 큰 변경, `비용`은 화면 하나 추가 수준의 정형 작업에 쓴다.
어느 프로필이든 **리뷰어는 작성자와 같은 티어 이상**이라는 규칙이 깨지지 않는다.

모델 배치의 근거 세 가지(스펙 §모델 분배):

1. 실패 비용은 상류일수록 크다 — 스펙이 틀리면 하류 전부가 폐기된다.
2. 판단 자유도가 낮으면 티어를 낮춘다 — RED/GREEN 게이트가 기계적으로 검증하는 자리는 안전하다.
3. 리뷰어는 작성자와 같은 티어 이상 — 아래 티어가 위 티어 산출물을 반려하기 어렵다.
   **기준 2와 충돌하면 기준 3이 이긴다.** 검증 장치가 다른 에이전트일 때 그 티어를 낮추면
   검증 자체가 약해진다. `비용` 프로필에서 W3·W4가 함께 Sonnet인 것은 규칙 위반이 아니다.

요구사항 원문은 **그대로 보존**한다. 요약해서 워커에 넘기지 않는다.
W1과 W2가 같은 원문을 보고 각자 판단해야 리뷰가 의미를 갖는다.

## 2. Run 생성

```bash
orca orchestration run-create --objective "<요구사항 한 줄 요약>" --json
```

Run은 이 요구사항 하나에 대응하는 네임스페이스이자 코디네이터 우편함이다.
Run이 워커를 스케줄하지는 않는다 — 배치와 동시성은 코디네이터가 정한다.

Run을 만든 뒤 Orca 워크스페이스 카드에 시작을 남긴다.

```bash
orca worktree set --worktree current \
  --comment "오케스트레이션 시작: <요약> (프로필=<균형|품질|비용>)" \
  --workspace-status in-progress --json
```

이후 각 단계 전환마다 `--comment`를 갱신하고, 코드 리뷰 단계에서 `--workspace-status in-review`,
최종 보고에서 `completed`로 옮긴다. 이것은 **장식층**이다 —
진행의 정본은 `orca orchestration task-list --json`과 각 워커의 `worker_done`이다.

## 3. 문서 단계 (W1 → W2 → G1 → W3 → W4 → G2)

문서 단계는 TJYG-Android 코드를 건드리지 않는다. 산출물은 team-yg repo의 `parfait/` 아래에
절대경로로 쓴다. 그래서 worktree를 새로 파지 않고 터미널만 띄운다.

| 워커 | 실행 위치 | 모델(균형 프로필) | 산출물 |
|---|---|---|---|
| W1 analyst | `--worktree current` | Opus 5 | `parfait/specs/YYYY-MM-DD-<topic>.md` |
| W2 spec-reviewer | `--worktree current` | Opus 5 | findings(파일 없음) |
| W3 planner | `--worktree current` | Opus 5 | `parfait/plans/YYYY-MM-DD-<topic>.md` |
| W4 plan-reviewer | `--worktree current` | Opus 5 | findings(파일 없음) |

네 워커는 순차 실행한다. 병렬 이득이 없고, 뒤 워커가 앞 산출물을 입력으로 받는다.

### W1 analyst

```bash
orca orchestration task-create --spec "$(cat <<'SPEC'
[역할] 요구사항 분석 + 설계. 산출물은 설계 스펙 문서 하나다.

[읽어라]
- 코드 대상: /Users/jeonheehoon/Documents/work_station/mashup/github/TJYG-Android
- 규약: <team-yg>/CLAUDE.md, <team-yg>/parfait/index.md, <team-yg>/parfait/specs/README.md
- 형식: <team-yg>/parfait/specs/template.md
- 기존 결정: <team-yg>/parfait/adr/, <team-yg>/parfait/architecture/
- 정책 SoT: <team-yg>/wiki/index.md에서 관련 페이지만

[해라]
1. superpowers:brainstorming 스킬을 로드한다.
2. 주제와 관련된 벤더 스킬을 먼저 찾는다:
   python3 <team-yg>/parfait/script/search.py "<주제>"
   상위 후보 중 관련 스킬을 네이티브 Skill로 로드한 뒤 설계를 확정한다.
3. 설계 스펙을 <team-yg>/parfait/specs/YYYY-MM-DD-<kebab-topic>.md에 쓴다.
   형식은 template.md, frontmatter 필수. 라인번호·hex·변동수치는 적지 않는다.
4. parfait/specs/README.md 인덱스에 한 줄 등록한다.

[금지]
- TJYG-Android 코드 수정. 이 단계는 읽기만 한다.
- placeholder("TBD", "추후 결정", 빈 섹션). 결정할 수 없으면 열린 질문 절에 근거와 함께 적는다.
- wiki/ 파일 수정.

[요구사항 원문]
<사용자 원문 그대로>

[보고]
worker_done --outcome succeeded --files-modified "<스펙 경로>,<README 경로>"
body에 스펙 절대경로와 핵심 설계 결정 3~5줄 요약.
SPEC
)" --json
```

기동:

```bash
orca orchestration worker-start --task <task_id> --worktree current --agent claude --json
```

### W2 spec-reviewer

리뷰어에게는 **요구사항 원문과 스펙 파일만** 준다. W1의 대화 컨텍스트는 주지 않는다.
그래야 "문서만 읽고 이해되는가"가 실제로 검증된다.

```bash
orca orchestration task-create --spec "$(cat <<'SPEC'
[역할] 설계 스펙 독립 검수. 너는 이 스펙을 쓰지 않았고, 작성 과정도 모른다.

[입력]
- 요구사항 원문: 아래
- 검수 대상: <스펙 절대경로>
- 대조 대상: <team-yg>/parfait/adr/, <team-yg>/parfait/architecture/, <team-yg>/wiki/

[반려 사유 — 하나라도 해당하면 반려]
1. 요구사항 원문의 항목 중 스펙에 담기지 않은 것
2. placeholder·TBD·"추후 결정"
3. 내부 모순 (아키텍처 서술 vs 기능 서술)
4. 두 가지로 읽히는 요구사항
5. parfait/adr/ 또는 parfait/architecture/의 기존 결정과 상충

[에스컬레이션 — 반려하지 말고 escalation]
- wiki/ 정책과 스펙이 상충. 기획 자체의 미결일 수 있어 에이전트가 판정하지 않는다.

[금지]
- 파일 수정. 너는 findings만 반환한다.
- 스타일 지적(문장 다듬기, 표 정렬). 위 5개 사유에만 집중한다.

[요구사항 원문]
<사용자 원문 그대로>

[보고]
통과: worker_done --outcome succeeded, body 첫 줄에 "PASS"
반려: worker_done --outcome succeeded, body 첫 줄에 "REJECT", 이어서 사유별로
      "사유번호 / 스펙의 어느 절 / 무엇이 빠졌거나 어긋나는지"를 한 건씩.
SPEC
)" --json
```

**반려 루프**: `REJECT`를 받으면 findings를 W1에게 회신한다.

```bash
orca orchestration send --to dispatch:<W1_dispatch_id> --subject "스펙 리뷰 반려" --body "<findings 원문>" --json
```

W1이 수정해 `worker_done`을 다시 보내면 W2를 같은 방식으로 다시 띄운다.
**상한 2회.** 3회째 반려면 escalation으로 사람을 부른다 —
리뷰어와 작성자가 합의하지 못하는 상태이고 자동으로 풀리지 않는다.

### G1 — 스펙 승인

`자동진행` 모드면 건너뛴다. 아니면:

```bash
orca orchestration gate-create --task <spec_task_id> \
  --question "스펙 검토 요청: <스펙 절대경로>. 구현 계획 단계로 넘어갈까?" \
  --options '["진행","수정 요청","중단"]' --json
orca orchestration check --wait --types decision_gate,question --timeout-ms 900000 --json
```

- `진행` → W3
- `수정 요청` → 사용자 지적을 W1에게 회신하고 다시 W2 검수부터
- `중단` → Run을 남긴 채 종료하고, 재개 방법을 사용자에게 알린다

타임아웃은 실패가 아니다. 사람이 아직 안 봤을 뿐이므로 계속 기다린다.

### W3 planner

```bash
orca orchestration task-create --spec "$(cat <<'SPEC'
[역할] 구현 계획 작성. 파일 선택 + 모듈 분할 + 테스트 명세 + 모델 지정.

[읽어라]
- 확정 스펙: <스펙 절대경로>
- 코드 대상: /Users/jeonheehoon/Documents/work_station/mashup/github/TJYG-Android
- 형식: <team-yg>/parfait/plans/template.md, 규약: parfait/plans/README.md

[해라]
1. superpowers:writing-plans 스킬을 로드한다.
2. 주제 관련 벤더 스킬을 먼저 찾는다:
   python3 <team-yg>/parfait/script/search.py "<주제>"
3. 변경이 필요한 파일을 전부 나열하고 **Gradle 모듈 경계로 묶는다.**
   모듈 간 파일 집합이 겹치면 안 된다. 겹치면 분할을 다시 한다.
4. 모듈별로 아래를 확정한다:
   - 담당 파일 화이트리스트(절대경로)
   - 테스트 명세: 무엇을 검증하고 기대값이 무엇인지. 실행 가능한 형태로.
   - Gradle 테스트 태스크(예: :domain:test)
   - model: opus | sonnet — 근거 한 줄과 함께
     · opus — Compose UI·recomposition, 코루틴 동시성, 기존 코드 대수술, 파일 6개 이상
     · sonnet — 시그니처까지 특정된 신규 파일, DTO·매퍼·Repository 같은 정형 작업
   - 의존 관계(기본형: domain → data, domain → feature)
5. 계획을 <team-yg>/parfait/plans/YYYY-MM-DD-<kebab-topic>.md에 쓰고
   parfait/plans/README.md 인덱스에 한 줄 등록한다.

[판단]
- 파일이 한 모듈 안에서 많이 겹쳐 병렬 이득이 없으면 **단일 워커로 결정**해도 된다.
  그 판단과 근거를 계획서에 적는다.

[금지]
- TJYG-Android 코드 수정.
- placeholder. "적절히 처리", "테스트 추가" 같은 서술.

[보고]
worker_done --outcome succeeded --files-modified "<계획 경로>,<README 경로>"
body에 모듈 분할 결과(모듈 / 파일 수 / model / 의존)를 표로.
SPEC
)" --json
```

### W4 plan-reviewer

W2와 같은 구조다. 리뷰어에게는 **스펙 파일과 계획 파일만** 준다.

[반려 사유]
1. 스펙 항목 중 계획에 잡히지 않은 것
2. **모듈 간 파일 집합 겹침** — merge 충돌 예고이므로 반려
3. 테스트 명세가 실행 가능한 형태가 아님(검증 대상·기대값 미특정)
4. 의존 순서가 실제 Gradle 모듈 의존과 어긋남
5. task 하나의 크기가 과도함
6. `model:` 필드 누락 또는 근거 없음

균형 프로필에서 모델은 Opus 5다. 검사 항목이 명시적 체크리스트라 낮출 만해 보이지만,
작성자 W3가 Opus라 "리뷰어는 작성자와 같은 티어 이상" 규칙이 이긴다.
반려 루프와 상한 2회는 W2와 동일하다.

### G2 — 계획 승인

G1과 같은 방식. `자동진행`이면 건너뛴다.

## 4. 구현 단계

계획서가 나눈 모듈마다 자식 worktree를 하나씩 만들고 워커를 붙인다.

의존 관계는 `task-create --deps`로 표현한다. 기본형은 domain → (data, feature)다.
인터페이스가 domain에 있으므로 domain이 끝나야 나머지 둘이 병렬로 시작한다.
계획서가 domain 변경 없음이라고 판단했으면 세 모듈이 모두 동시에 출발한다.

```bash
DOMAIN_TASK=$(orca orchestration task-create --spec "<domain task spec>" --json | jq -r '.result.task.id')
orca orchestration task-create --spec "<data task spec>"    --deps "[\"$DOMAIN_TASK\"]" --json
orca orchestration task-create --spec "<feature task spec>" --deps "[\"$DOMAIN_TASK\"]" --json
```

### 워커 기동

`worker-start --agent claude`는 **모델을 지정하지 못한다.** 계획서가 정한 모델을 쓰려면
worktree와 터미널을 먼저 만들고 그 터미널에 task를 붙인다.

```bash
# 1) 자식 worktree 생성
orca worktree create --name wt-<module> --repo name:TJYG-Android \
  --base-branch <feature/xxxxx-master> --json

# 2) 모델을 지정해 에이전트 터미널 생성
orca terminal create --worktree name:wt-<module> \
  --command "claude --model <opus|sonnet>" --json

# 3) 그 터미널에 task를 붙인다 (orchestration 계보 유지)
orca orchestration worker-start --task <task_id> --terminal <handle> --json
```

`--terminal`로 붙여도 task·dispatch 계보, `worker_done` 권한, 주입 프리앰블은 그대로다.

이 경로는 repo의 `wait-for-setup` 정책을 강제하지 못한다. §0에서 기록해 둔 값이
`start-immediately`면 잃는 것이 없다. `wait-for-setup`이면 모델 지정을 포기하고
아래 한 줄로 간다.

```bash
orca orchestration worker-start --task <task_id> --worktree new-child --name wt-<module> --agent claude --setup run --json
```

세 모듈이 동시에 돌면 Gradle 데몬이 최대 3개, `build/`가 3벌이 된다. `~/.gradle`은 공유라
동시 쓰기 잠금 경합이 생길 수 있다. 락 대기나 비정상적인 지연이 보이면 그때 모듈 워커를
줄인다. 미리 튜닝하지 않는다.

### 구현 워커 task spec

```bash
orca orchestration task-create --spec "$(cat <<'SPEC'
[역할] <module> 모듈 TDD 구현.

[입력]
- 계획 문서: <계획 절대경로>
- 담당 모듈: <module>
- 담당 파일 화이트리스트:
    <파일 절대경로 목록>
- 테스트 명세:
    <검증 대상과 기대값>
- 테스트 태스크: ./gradlew :<module>:test

[순서 — 이 순서를 지켜야 한다]
1. 테스트를 먼저 쓴다.
2. ./gradlew :<module>:test 를 실행한다. RED여야 한다. 실패 출력을 그대로 보관한다.
   여기서 GREEN이면 테스트가 잘못된 것이다. 다시 쓴다.
3. 구현한다.
4. ./gradlew :<module>:test 를 다시 실행한다. GREEN이어야 한다. 출력을 그대로 보관한다.
5. 커밋한다. repo 관례를 따라 test: 와 feat: 를 나눈다.

[금지]
- 담당 파일 화이트리스트 밖 수정. 필요하면 escalation을 보낸다.
- 구현을 먼저 하고 테스트를 나중에 붙이는 것.
- RED 확인 없이 3단계로 건너뛰는 것.

[보고]
worker_done --outcome succeeded --files-modified "<수정 파일 목록>"
body에 다음 둘을 **모두** 넣는다:
  - RED 로그: 2단계 실행 출력 중 실패를 보여주는 부분
  - GREEN 로그: 4단계 실행 출력 중 통과를 보여주는 부분
실패했으면 --outcome failed 를 쓴다. 산문으로만 실패를 적지 않는다.
SPEC
)" --json
```

### 증거 검사

`worker_done`을 받으면 코디네이터가 body를 확인한다.

| 확인 | 통과 조건 |
|---|---|
| RED 로그 | 2단계 실행 결과에 실패가 보인다 |
| GREEN 로그 | 4단계 실행 결과에 통과가 보인다 |
| 파일 범위 | `--files-modified`가 화이트리스트를 벗어나지 않는다 |

하나라도 없으면 **반려**한다.

```bash
orca orchestration send --to dispatch:<dispatch_id> --subject "증거 누락" \
  --body "RED 로그와 GREEN 로그를 모두 첨부해 다시 보고하라. 없으면 이 task는 완료로 인정하지 않는다." --json
```

이 검사를 강제하는 이유는, 로그 두 개가 TDD를 지켰다는 **유일하게 검증 가능한 흔적**이기
때문이다. 없으면 구현을 먼저 하고 통과하는 테스트를 나중에 붙인 것과 구분할 수 없다.

GREEN에 도달하지 못했으면 같은 dispatch에 회신해 1회 재시도시킨다.
재시도는 **한 티어 올린 모델**로 한다 — 같은 모델에 같은 프롬프트를 다시 넣으면 같은
결과가 나온다. 그래도 실패하면 escalation.

### 대기

```bash
orca orchestration check --wait --types worker_done,escalation,question --timeout-ms 900000 --json
orca orchestration check --ack <delivery_id> --wait --types worker_done,escalation,question --timeout-ms 900000 --json
```

Delivery 안의 메시지를 **전부 처리한 뒤** ack한다.
타임아웃이나 `{count:0}`은 실패가 아니라 체크포인트다. 구현 task는 보통 오래 걸린다.
워커를 죽이거나 재시작하지 않는다. 하트비트와 터미널 활동은 살아 있다는 뜻이지 끝났다는
뜻이 아니다.
