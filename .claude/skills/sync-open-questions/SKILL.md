---
name: sync-open-questions
description: open-questions 문서를 이 repo의 GitHub 이슈로 동기화한다(반복 워크플로). 사용자가 "/sync-open-questions", "미결 이슈화", "open question 이슈로 만들어줘", "미결 항목 현행화", "이슈 동기화"라고 할 때 사용. 문서가 정본이고 이슈는 단방향 투영 — dry-run 계획을 보고한 뒤 사용자 승인을 받아 실행한다.
---

# sync-open-questions — 미결 항목 → GitHub 이슈 동기화

`wiki/synthesis/open-questions.md`(정책)와 `parfait/synthesis/open-questions.md`(구현)의
미결 항목을 이 저장소의 GitHub 이슈로 투영한다.

## 핵심 규율
- **문서가 정본.** 이슈 본문을 손으로 고쳐도 다음 동기화에 덮어써진다. 역방향 반영은 없다.
- **전량 미러.** 상태가 `해소됨`으로 시작하지 않는 모든 항목이 이슈가 된다. `보류`·`부분 해소`도
  만든다 — 라벨로만 구분한다. 문서의 부정 매칭 규약과 같은 기준을 쓴다.
- **이슈 쓰기 전 사용자 승인 필수**(`CLAUDE.md` 리모트 규율). `plan`까지는 확인 없이 돌려도 된다.
- **`orphan`(문서에서 사라진 항목)은 자동으로 닫지 않는다.** 사람에게 보고만 한다.
- 판단은 스크립트가 한다. 이 스킬은 게이트와 보고만 담당한다.

## 단계

1. **ID 부여** — `python3 parfait/script/oq_sync.py assign-ids`
   - 문서가 바뀌었으면 브랜치를 파고(`main` 직접 금지) 로컬 커밋한다.
   - 커밋 메시지: `docs(oq): open-questions 항목에 안정 ID 부여`
2. **계획 산출** — `python3 parfait/script/oq_sync.py plan --out <스크래치패드>/oq-plan.json`
   - 계획 JSON은 저장소에 커밋하지 않는다.
3. **보고** — 요약 표를 사용자에게 보여준다.
   - `orphan`·`unmanaged`가 있으면 **개별로 나열한다**(자동 처리하지 않는 항목이므로).
   - `create`+`update`+`close`+`reopen`이 0이면 "동기 상태"로 보고하고 종료한다.
4. **승인 대기** — 리모트 쓰기다. 사용자가 명시적으로 승인하기 전에 5단계로 넘어가지 않는다.
5. **실행** — `python3 parfait/script/oq_sync.py apply <계획 경로>`
   - 첫 실행처럼 건수가 많으면 `--limit N`으로 나눠 받을 수 있다.
6. **결과 보고** — 실패 건이 있으면 그대로 알린다. 조용히 넘어가지 않는다.
   실패는 다음 `plan`에서 다시 잡히므로 재실행으로 복구된다.

## 언제
- 문서에 미결 항목을 추가·수정·해소한 뒤
- `ingest`·`lint`·`sync-tjyg-develop-baseline`·`sync-teamyg-server-api`가 open-questions를 건드린 뒤
- 이슈 목록이 문서와 어긋나 보일 때

## 주의
- 이슈 생성 대상은 **이 저장소 하나**다. TJYG-Android에 만들지 않는다.
- 라벨은 `apply`가 `--force`로 만든다(멱등). 손으로 만들 필요 없다.
- 이슈 템플릿으로 손수 만든 이슈는 `oq-id` 마커가 없어 `unmanaged`로 잡힌다.
  문서로 옮길지는 사람이 정한다 — 스킬이 자동으로 옮기지 않는다.
