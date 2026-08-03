---
name: orca-plan-ledger
description: Use when executing a superpowers implementation plan with subagent-driven-development or executing-plans inside an Orca terminal — mirrors task progress into the Orca workspace card as comment and board status, so long subagent runs are visible without reading scrollback. No-op outside Orca.
---

# Orca Plan Ledger

plan 실행은 불투명하다. subagent가 수십 분 돌고, 진행 신호는 스크롤백 텍스트뿐이다.
이 스킬은 plan의 **태스크 경계**를 Orca 사이드바 카드(코멘트 + 보드 상태)에 비춘다.

**원장은 보고만 한다. 아무것도 결정하지 않는다.**

<HARD-GATE>
`ORCA_WORKTREE_ID`(없으면 `ORCA_WORKSPACE_ID`)가 비었거나 `orca` 명령이 없으면
이 스킬을 즉시 버린다. `ledger` 호출을 하나도 내지 말고, 사용자에게 원장을 언급도 하지 않는다.
plan은 원래대로 그대로 돈다.

원장은 절대 게이트가 아니다. `ledger` 호출이 실패하든 아무것도 출력하지 않든
어떤 결정도 바뀌지 않는다. 재시도 금지, 결과 보고 금지, 태스크를 막거나 늦추거나 바꾸는 것 금지.
원장 호출을 낼지 그냥 plan을 진행할지 헷갈리면 **plan을 진행한다.**
</HARD-GATE>

## 체크리스트

항목마다 todo를 만들고 순서대로 처리한다.

1. `ORCA_WORKTREE_ID` 확인. 비었으면 여기서 끝 — 이 스킬 적용 안 됨.
2. plan을 읽은 뒤 `ledger start <plan-path> [<sdd-workspace>/progress.md]`.
   - SDD면 `scripts/sdd-workspace PLAN_FILE`가 찍어준 경로를 2번째 인자로 넘긴다(`pane`용).
   - `executing-plans`면 2번째 인자 생략.
3. 태스크 *k* 디스패치 **직전**: `ledger task <k> "<태스크 제목>"`.
4. 태스크 *k*의 리뷰가 클린해지고 ledger 완료 줄을 쓴 뒤: `ledger ok <k>`.
5. 실행이 실제로 멈췄을 때만: `ledger fail "<사유>"`.
6. 마지막 태스크 뒤(최종 리뷰까지 끝나면): `ledger end`.

## 핵심 규칙

`ledger`는 이 스킬의 `scripts/ledger`에 있다. **절대경로로 호출**한다 — `PATH`에 없다.

```
<repo>/.claude/skills/orca-plan-ledger/scripts/ledger
```

**이미 존재하는 경계에만 붙인다.** `subagent-driven-development`는 태스크마다
"디스패치 → 리뷰 → ledger 완료 줄 → todo 완료"가 이미 있다. 거기에 한 줄 추가한다.
**원장 호출 자리를 만들려고 plan을 재구성하지 않는다.**

**SDD의 `progress.md`가 진행의 정본이다.** 카드 코멘트는 그 투영이다.
컴팩션 후 복구는 `progress.md` + `git log`로 하지, 카드로 하지 않는다.

**plan당 `start` 1회, 실행당 `end` 1회.** `start`가 plan의 `## Task <N>` 헤딩을 세어
총계 N을 워크트리별 상태 파일에 쓴다. `task`·`ok`가 그걸 읽는다. `start` 없이 호출하면
`k/?`로 degrade하고 실패하지는 않는다.

**`k`는 1-기반이고 plan의 태스크 번호와 일치한다.**

**`fail`은 실행이 실제로 멈출 때만.** 같은 태스크가 곧 고치는 fix round는 정상 실행이지 실패가 아니다.
SDD의 breaker가 BLOCKED를 보고할 때가 `fail`이다.

**plan 실행 중 `orca`를 직접 부르지 않는다.** 필요한 건 아래 동사에 다 있다.
직접 호출은 포커스를 뺏는 동사(`worktree activate`·`terminal switch` 등)로 샐 위험이 있다.

## 동사

| 호출 | 카드 효과 |
|---|---|
| `ledger start <plan.md> [progress.md]` | 코멘트 `0/N <plan>`, 상태 `in-progress` |
| `ledger task <k> "<제목>"` | 코멘트 `k/N <제목>` |
| `ledger ok <k>` | 코멘트 `k/N done` |
| `ledger fail "<사유>"` | 코멘트 `BLOCKED: <사유>`, 상태 `in-review` |
| `ledger end` | 코멘트 `plan complete — <plan>`, 상태 `in-review` |
| `ledger clear` | 코멘트 비움 |
| `ledger pane [경로]` | **opt-in.** `tail -F`하는 split pane 생성 |
| `ledger status` | 디버그: 해석된 상태 출력 |

인자가 빠진 `task`/`ok`/`fail`은 카드를 건드리지 않고 no-op한다.

### `end`가 `completed`가 아니라 `in-review`인 이유

plan 실행이 끝나도 머지는 안 끝났다. 다음은 `superpowers:finishing-a-development-branch`이고,
이 repo는 commit/push/PR에 **사용자 확인이 필수**다. 카드를 `completed`로 만들면
사람 게이트를 통과한 것처럼 보인다. `completed`는 사용자가 정한다.

## watch pane (opt-in)

`ledger pane`은 SDD의 `progress.md`를 `tail -F`하는 split을 만든다.
`orca terminal split`에는 no-focus 플래그가 없어서 **포커스를 뺏는다.**
사용자가 명시적으로 요청할 때만 부른다. `start`가 자동으로 만들지 않는다.
`end`가 만든 pane을 닫는다.

## 구현 메모

- 카드 대상은 세션을 띄운 Orca 워크트리(`ORCA_WORKTREE_ID`)다. SDD가 별도 git worktree를
  만들어도 카드는 사용자가 보고 있는 그 카드에 찍힌다 — 의도된 동작이다.
- `orca worktree set --comment ""`는 **변경 없음**으로 처리된다(클리어 아님).
  비우려면 공백 1칸을 보내야 한다. `clear` 동사가 그걸 한다.
- 스크립트는 모든 경로에서 `exit 0`이다. plan 실행을 절대 실패시키지 않는다.
- 상태 파일: `${XDG_STATE_HOME:-~/.local/state}/orca-plan-ledger/<worktree-key>.env`.

## Red Flags — 멈춤

| 냄새 | 교정 |
|---|---|
| 실패한 듯한 `ledger` 호출을 재시도하려 함 | 하지 마라. 설계상 `0`으로 끝난다. 재시도할 게 없다 |
| "원장이 안 보인다"고 사용자에게 보고하려 함 | 하지 마라. Orca 밖에서는 침묵이 설계된 동작이다 |
| `orca worktree set`을 직접 부르려 함 | 동사를 써라. 직접 호출은 규칙에서 드리프트한다 |
| 호출 자리를 만들려고 plan에 태스크 추가 | 기존 경계에 붙여라 |
| fix round 중 테스트 실패에 `fail` 발행 | 실행 전체가 멈출 때만 `fail` |
| 스텝마다 `ledger ok` | 태스크당 1회지 스텝당 아니다 |
| 카드 진행률을 진행의 정본으로 취급 | 정본은 `progress.md`와 `git log`. 카드는 투영 |
| plan 끝났다고 `completed`로 올림 | `completed`는 사람이 정한다 |

## 연관

- `surfacing-work-in-cmux` — 같은 역할의 cmux판. 게이트가 서로 배타적이라 둘 중 하나만 발화한다
- `orca-cli` — Orca CLI 전체 가이드(`orca skills get orca-cli`로 버전 매칭본 로드)
- `superpowers:subagent-driven-development` — 순서·게이트의 정본. 원장은 여기에 붙기만 한다
