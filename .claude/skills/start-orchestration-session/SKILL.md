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
| W4 plan-reviewer | Sonnet | Opus | Sonnet |
| 모듈 구현 워커 | 계획서의 `model:` | Opus | Sonnet |
| integrator | Sonnet | Opus | Sonnet |
| code-reviewer | Opus | Opus | Opus |

`품질`은 아키텍처를 건드리는 큰 변경, `비용`은 화면 하나 추가 수준의 정형 작업에 쓴다.
어느 프로필이든 **리뷰어는 작성자와 같은 티어 이상**이라는 규칙이 깨지지 않는다.

모델 배치의 근거 세 가지(스펙 §모델 분배):

1. 실패 비용은 상류일수록 크다 — 스펙이 틀리면 하류 전부가 폐기된다.
2. 판단 자유도가 낮으면 티어를 낮춘다 — RED/GREEN 게이트가 기계적으로 검증하는 자리는 안전하다.
3. 리뷰어는 작성자와 같은 티어 이상 — 아래 티어가 위 티어 산출물을 반려하기 어렵다.

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
