---
tags: [lint, maintenance]
updated: YYYY-MM-DD
---

# Lint 보고서 YYYY-MM-DD

> 대상: `wiki/` 전체(N개 md, `personal-private/` 제외 — private 서브모듈). 계기: [무엇 직후인지].

## 민감 데이터 ⚠️
- (없음 또는 파일명:줄번호) — **자동 수정 금지. 처리 전까지 커밋 금지.**

## 모순 → open-questions.md 등록됨
- [[페이지A]] vs [[페이지B]]: 무엇이 어긋나는지 → 상태

## 고아 페이지
- (없음 또는 [[파일명]])

## 깨진 링크
- 실질 N건. 템플릿 플레이스홀더·`wiki/templates/`·과거 보고서의 parfait 참조는 스코프 밖(제외).

## raw ↔ sources 정합
- N ↔ N 대응, 누락·잉여 N건.

## 판본 상태(status) 무결성
- `python3 wiki/script/check-status.py` → 소스 N건, 위반 N건. (분포: current N / superseded N / partial N)

## stale 정보
| 파일 | 수정 |
|---|---|
| [[페이지]] | 무엇을 무엇으로 |

## 데이터 공백 / 조사 권고
- 채울 수 있는 빈 영역·조사 필요 주제.

## 미결 현황 (부정 매칭)
- N항목 중 해소됨 N / 미결 N. **`해소됨`이 아닌 것은 전부 미결로 센다.**

## 결론
- 차단 이슈 N건. 수정 완료분과 사용자 판단 대기분을 구분해 적는다.

<!--
점검 항목 7종은 .claude/skills/lint/SKILL.md 기준. 같은 날 2회차면 파일을 나누지 말고
이 파일에 `# N차 점검` 섹션으로 덧붙인다.
-->
