# Parfait wiki — 에이전트 진입 허브

> 세션 시작·작업 전 **이 파일부터** 읽어라. 여기서 "무엇을 찾으면 어디를 보라"로 라우팅한 뒤, 필요한 문서만 펼친다 (전체를 읽지 말 것).

## 지금 상태 (1줄)
_(작성 예정 — 프로젝트의 현재 아키텍처 상태를 한 줄로 요약한다. 큰 전환이 진행 중이면 관련 ADR 번호를 건다.)_

## 무엇을 찾는가 → 어디를 보라
| 알고 싶은 것 | 권위 문서 |
|---|---|
| 왜 이렇게 결정했나 (결정·대안·트레이드오프) | [adr/README.md](adr/README.md) |
| 어떻게/어디에 구현돼 있나 (구현 가이드) | [architecture/README.md](architecture/README.md) |
| 작업 계획·진행 중/완료 작업 | [plans/README.md](plans/README.md) |

> 문서가 쌓이면 이 표에 구체 항목을 한 줄씩 추가한다 (예: `화면 상태관리 패턴 → ADR-0001 + architecture/store-data-flow.md`).

## 문서 지도
- **[`adr/`](adr/README.md)** — "왜"(결정·대안·트레이드오프). 인덱스: [adr/README.md](adr/README.md)
- **[`architecture/`](architecture/README.md)** — "어떻게/어디"(구현 가이드). 인덱스: [architecture/README.md](architecture/README.md)
- **[`plans/`](plans/README.md)** — 작업 계획(`YYYY-MM-DD-kebab-topic.md`). 완료분은 `plans/archive/`

## 규율 (상세는 각 문서)
- **SoT 우선순위**(모순 시): 코드 > wiki > CLAUDE.md
- **라인번호·변동수치 금지** — 근거·규칙은 [adr/README.md](adr/README.md)
- 새 아키텍처 결정 = 새 ADR([adr/template.md](adr/template.md)), 코드와 같은 커밋. 구조 변경 시 같은 PR에서 wiki 갱신(drift 금지).
