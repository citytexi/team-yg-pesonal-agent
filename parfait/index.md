# Parfait wiki — 에이전트 진입 허브

> 세션 시작·작업 전 **이 파일부터** 읽어라. 여기서 "무엇을 찾으면 어디를 보라"로 라우팅한 뒤, 필요한 문서만 펼친다 (전체를 읽지 말 것).

## 지금 상태 (1줄)
Android 단일 플랫폼, Jetpack Compose + Navigation3. 다중 모듈(core/data/domain/feature)·컨벤션 플러그인·Hilt·자체 MVI 기반. 원격 네트워킹은 의존만 준비, 서비스 연동은 후속.

## 무엇을 찾는가 → 어디를 보라
| 알고 싶은 것 | 권위 문서 |
|---|---|
| 모듈 구조·의존 방향 | [ADR-0001](adr/0001-layered-multi-module.md) + [module-structure](architecture/module-structure.md) |
| feature :api/:impl 분리 이유 | [ADR-0002](adr/0002-feature-api-impl-split.md) |
| 빌드 세팅(컨벤션 플러그인·버전 카탈로그) | [ADR-0003](adr/0003-convention-plugins-version-catalog.md) |
| DI·Hilt·스코프 | [ADR-0004](adr/0004-hilt-ksp-di.md) + [data-layer](architecture/data-layer.md) |
| 화면 상태관리(MVI)·신규 화면 추가 | [ADR-0005](adr/0005-custom-mvi-baseviewmodel.md) + [state-management](architecture/state-management.md) |
| 내비게이션·신규 목적지 등록 | [ADR-0006](adr/0006-navigation3-custom-navigator.md) + [navigation-flow](architecture/navigation-flow.md) |
| UI·Compose·디자인 토큰·테마·컴포넌트 작성 | [ADR-0010](adr/0010-custom-compositionlocal-theme.md) + [design-system](architecture/design-system.md) (전신 [ADR-0007](adr/0007-compose-material3-design-tokens.md), superseded) |
| 로컬 영속화(DataStore) | [ADR-0008](adr/0008-datastore-local-persistence.md) + [data-layer](architecture/data-layer.md) |
| UseCase 패턴 | [ADR-0009](adr/0009-usecase-injectable-invoke.md) |
| 신규 데이터(Repo/DataSource) 추가 | [data-layer](architecture/data-layer.md) 체크리스트 |
| 도메인에서 비트맵 다루기(크로스모듈 추상) | [ADR-0011](adr/0011-cross-module-bitmap-abstraction.md) + [module-structure](architecture/module-structure.md) |
| 이미지 세그멘테이션(누끼)·ML Kit | [ADR-0012](adr/0012-mlkit-subject-segmentation.md) + [data-layer](architecture/data-layer.md) |
| 구현 직전 기능·컴포넌트 설계 스펙 | [specs/README.md](specs/README.md) |
| 작업 계획·진행 중/완료 작업 | [plans/README.md](plans/README.md) |
| 제품 문서(PRD·positioning·roadmap 등, PM-Skills 산출물) | [pm/README.md](pm/README.md) |
| 구현 미결·열린 결정·코드/문서 정합 이슈 | [open-questions.md](open-questions.md) |

## 문서 지도
- **[`adr/`](adr/README.md)** — "왜"(결정·대안·트레이드오프). 인덱스: [adr/README.md](adr/README.md)
- **[`architecture/`](architecture/README.md)** — "어떻게/어디"(상시 구현 가이드). 인덱스: [architecture/README.md](architecture/README.md)
- **[`specs/`](specs/README.md)** — "무엇을 만드나"(구현 직전 확정 설계, `YYYY-MM-DD-kebab-topic.md`). 완료분은 `specs/archive/`. 인덱스: [specs/README.md](specs/README.md)
- **[`plans/`](plans/README.md)** — 작업 계획(`YYYY-MM-DD-kebab-topic.md`). 완료분은 `plans/archive/`
- **[`pm/`](pm/README.md)** — 제품 문서(PRD·positioning·roadmap·user story·discovery 등, PM-Skills 산출물, `YYYY-MM-DD-kebab-topic.md`). 코드 작업은 superpowers 체인, 문서 작업은 PM-Skills — 라우팅은 루트 CLAUDE.md.
- **[`open-questions.md`](open-questions.md)** — 구현 미결·열린 결정·코드/문서 정합 이슈 추적. 정책·기획 미결은 위키 [[open-questions]].
- **[`doc-baseline.md`](doc-baseline.md)** — 문서를 마지막으로 검증한 `develop` 커밋 해시(SoT) + "develop 기준 문서 점검" 절차. 현재 기준선 `9085bc7`(2026-07-15).
- **[`lint-2026-07-06-parfait.md`](lint-2026-07-06-parfait.md)** — 문서 vs 실제 코드 정합성 점검 보고서(2026-07-06, 조치 완료 이력).

## 규율 (상세는 각 문서)
- **SoT 우선순위**(모순 시): 코드 > wiki > CLAUDE.md
- **라인번호·변동수치 금지** — 근거·규칙은 [adr/README.md](adr/README.md)
- 새 아키텍처 결정 = 새 ADR([adr/template.md](adr/template.md)), 코드와 같은 커밋. 구조 변경 시 같은 PR에서 wiki 갱신(drift 금지).
- 새 기능·컴포넌트 = 구현 전 [specs/](specs/README.md)에 설계 스펙 확정([specs/template.md](specs/template.md)) 후 코드 작성.
