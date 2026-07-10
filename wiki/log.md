---
tags: [log, meta]
---

# Wiki Log

append-only. 새 항목은 파일 끝에 추가.
`grep "^## \[" wiki/log.md | tail -10` 으로 최근 10개 이력 확인.

---

## [2026-06-10] init | 위키 구조 초기화
## [2026-06-10] refactor | 피드백 반영 — 링크 규약 통일, overview/open-questions 추가, 프라이버시 정책 명문화
## [2026-07-06] ingest | 기능정의서 MVP v2~v5 (배치) — 소스 4, 엔티티 1, 개념 5 생성, open-questions 4건 등록
## [2026-07-06] ingest | G-001 무한 파르페 정책 설계 — 소스 1, 개념 1(무한-파르페-그리드) 생성, 그룹·토핑·앱·overview 갱신, open-questions 2건 등록
## [2026-07-06] lint | 점검 완료, 3건 발견 (parfait 서브트리 메인 허브 미연결, index 페이지수 stale, parfait↔제품 브리지 부재). 민감데이터·모순·메인 고아 없음
## [2026-07-06] fix | lint 3건 자동 수정 — index Projects 섹션·페이지수 28·협업앱 parfait 브리지·보고서 카탈로그
## [2026-07-06] lint | parfait 내용 정합성(문서 vs TJYG-Android 코드) — 링크·상태표·규율 통과, 코드 대조 발견 7건(중간 3·낮음 4). 병렬 3에이전트 검증
## [2026-07-06] fix | parfait 중간 3건 문서 수정 — module-structure feature/app/setting 추가, ADR-0002 :api navigation 번들 명시, ADR-0007 토큰 심볼명 정정(YGSemanticColors/YGTypography)
## [2026-07-10] sync | parfait 코드 drift 반영 — 2026-07-06 이후 core:designsystem 재설계(#118 YGButton, #121 theme). ADR-0010 신설(자체 CompositionLocal 테마, 0007 supersede), architecture/design-system.md 신설, adr/architecture README·index 갱신
## [2026-07-10] spec | parfait specs/ 신설 — 구현 전 설계 스펙 위치 도입. YGTextField 스펙(component/textfield, idle/focused/error/disabled) 작성. parfait/index·CLAUDE.md에 specs 라우팅 배선
## [2026-07-10] plan | YGTextField 구현 계획(회고형, 완료 체크) 작성 — wiki/parfait/plans/2026-07-10-ygtextfield.md. plans/README 등록. 코드는 TJYG-Android feature/#134에 구현·검증 완료(커밋 대기)
