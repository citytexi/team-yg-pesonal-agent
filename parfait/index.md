# Parfait wiki — 에이전트 진입 허브

> 세션 시작·작업 전 **이 파일부터** 읽어라. 여기서 "무엇을 찾으면 어디를 보라"로 라우팅한 뒤, 필요한 문서만 펼친다 (전체를 읽지 말 것).

## 지금 상태 (1줄)
Android 단일 플랫폼, Jetpack Compose + Navigation3. 다중 모듈(core/data/domain/feature)·컨벤션 플러그인·Hilt·자체 MVI 기반. 원격 네트워크 기초 구조(컨벤션 플러그인·NetworkModule·ApiResponse/safeApiCall·remote 예시)가 **develop 머지**됨(#174), 실제 API 연동은 후속(ADR-0017). 화면은 G-001 목록(#222로 실패 화면·pull-to-refresh·A-005 이동까지)·C-101 카메라 플로우·C-001 캔버스 메인(#199 — 반응형 배치·Dot Grid 배경·토핑 추가 메뉴, **진입 경로 0건**)까지 들어왔고 전부 **데이터·후속 화면 미결선** 상태다. **토핑 생성 경로는 이어졌다**(#221) — C-101-confirm "다음"이 C-103 누끼 추출로 결선되고 확인(C-103)·수동 편집(C-104)·테두리 편집(C-105)이 한 라운드에 들어와 캔버스 배치(C-106) 직전까지 닿는다. 다만 네 화면의 닫기가 전부 빈 람다라 **플로우를 나갈 출구가 없다**. **캔버스 편집 갈래도 열렸다**(#231) — C-001 편집 버튼이 C-301 배경 편집으로 이어지고 카메라·갤러리·확인 세 화면을 토핑 생성 플로우와 공유하지만(NavKey `returnResultOnly` 인자로 분기), 고른 배경이 저장·반영되지 않고 C-001 진입 경로가 여전히 0건이라 이 갈래 전체가 도달 불가다. 앱 진입 체인은 Splash→Login→TermAgree→GroupList로 이어졌고(#220), 그 첫 화면 A-002 로그인이 온보딩 일러스트 3장으로 실물화됐고(#218) **인증까지 결선됐다**(#241). 그룹 생성(A-005)·참여(A-004→S-102) 두 갈래도 확인 모달을 거쳐 **목록으로 되돌아오며 닫혔다**(#224, `goToSingleClearTop`) — 위키 정본은 이 자리를 C-001 직접 진입으로 적는다. 디자인시스템은 Figma 바 3종(Top Bar Canvas·List-Date·Floating Bar)과 배경 블러(Haze, ADR-0018)까지 머지됐다(#188).
서버 계약은 `api/`에 스냅샷돼 있다(도메인 7건·**엔드포인트 26개 + 테스트 전용 1**, 서버 `e4ff23f`).
같은 날 2차 서버 delta는 엔드포인트 증감 없이 규칙만 바꿨다 — 초대코드 6자·닉네임 자모 허용·
그룹 내 닉네임 중복 허용(`GROUP_NICKNAME_ALREADY_USED` 삭제).
**Android 표면은 25/25, 공백 0이다**(2026-08-15 PR #250이 파르페 오늘·과거 조회, 토핑 테두리 수정·삭제,
회원 탈퇴 다섯을 한 라운드에 닫았다. 애플 로그인 1건과 테스트 전용 회전 1건은 분모에서 뺀다).
같은 PR이 2차 서버 delta도 반영했다 — `CheckNameValidUseCase`가 자모를 허용하고
`GROUP_NICKNAME_ALREADY_USED` 분기는 걷혔다. **다만 그 다섯 표면은 Repository조차 없다.**
**2026-08-15 — 하루 만에 8 엔드포인트가 화면까지 결선됐다**(#241·#242·#243·#244·#248).
A-002 카카오 로그인(#241)에 이어 온보딩 약관이 목록 조회·회원가입·세션 저장까지 가고(#242),
그룹 생성(#243)·참여 미리보기/참여/닉네임 변경(#244)·목록 조회(#248)가 붙어 **mock UseCase 3종,
mock 그룹 4건, `TERM_CONTENT_LIST`가 전부 삭제**됐다. 선반영이던 `ParfaitGroupRepository` 5메서드와
`ServerErrorCode` 12종도 이 라운드에서 모두 소비된다. 그 아래는 MVI 공통 에러 인프라
(`AppError`·`Channel` 이펙트·`launch(key, onError)`)다([ADR-0020](adr/0020-mvi-error-effect-infrastructure.md)).
남은 mock은 G-001의 `nickName` 하나인데, **그 값이 그룹 생성 요청으로 서버에 나간다.**
파르페·이미지·회원·토핑 4 도메인은 표면은 전량 있는데 여전히 Repository조차 없다 —
`GET .../parfaits/today`가 배치 전량을 주므로 **C-001 캔버스 결선의 서버 측 선행 조건은 사라졌다**.
⚠️ **그룹 목록은 코드 대조만으로 실패가 예상된다** — 업로드 시각을 오프셋 필수 파서로 읽는데 서버는
오프셋을 안 싣는다([OQ-P-165](synthesis/open-questions.md)). 그리고 **어느 경로도 실서버 요청을 해 본 적이 없다**
([OQ-P-146](synthesis/open-questions.md)).
**2026-08-15 — 만료를 다루는 주체가 생겼다**(#260, [ADR-0021](adr/0021-token-refresh-forced-logout.md)).
`TokenAuthenticator`가 401을 가로채 재발급하고 원요청을 잇는다(화면은 못 본다). 재발급이 **서버에
거절당할 때만** 세션을 버리고 `SessionEvent.ForcedLogout`을 앱 루트 한 곳이 받아 로그인으로 보낸다 —
네트워크 실패·5xx는 토큰을 유지한다. 재발급은 자격증명을 안 붙이는 전용 클라이언트로 나간다(디스패처
고갈 방지). 로그아웃도 결선돼 **auth 도메인이 `android_status: done`**이 됐고, 같은 라운드가
`Navigator.clearBackStack()`을 제거하고 `replaceAll()`로 합쳤다.
**2026-08-16 — C-201 캘린더가 붙었다**(#259). C-001의 날짜 버튼이 `YGCanvas.calendarContent` 슬롯을
처음 채워 연·월 드롭다운 + 날짜 그리드가 열린다. 다만 **두 조회 UseCase가 mock**이고(표면은 있는데
우회한다) 고른 날짜가 캔버스·라벨을 바꾸지 않는다([c201 스펙](specs/archive/2026-08-16-c201-canvas-calendar.md)).
런처 아이콘도 교체됐다(#262 — 적응형 3종 + monochrome, 스플래시 테마 속성 제거).

## 무엇을 찾는가 → 어디를 보라
| 알고 싶은 것 | 권위 문서 |
|---|---|
| 모듈 구조·의존 방향 | [ADR-0001](adr/0001-layered-multi-module.md) + [module-structure](architecture/module-structure.md) |
| feature :api/:impl 분리 이유 | [ADR-0002](adr/0002-feature-api-impl-split.md) |
| 빌드 세팅(컨벤션 플러그인·버전 카탈로그) | [ADR-0003](adr/0003-convention-plugins-version-catalog.md) |
| DI·Hilt·스코프 | [ADR-0004](adr/0004-hilt-ksp-di.md) + [data-layer](architecture/data-layer.md) |
| 화면 상태관리(MVI)·신규 화면 추가 | [ADR-0005](adr/0005-custom-mvi-baseviewmodel.md) + [state-management](architecture/state-management.md) |
| 공통 에러 처리·이펙트 전달·중복 실행 방어 | [ADR-0020](adr/0020-mvi-error-effect-infrastructure.md) + [mvi-error-infrastructure 스펙](specs/archive/2026-08-13-mvi-error-infrastructure.md) |
| 내비게이션·신규 목적지 등록 | [ADR-0006](adr/0006-navigation3-custom-navigator.md) + [navigation-flow](architecture/navigation-flow.md) |
| UI·Compose·디자인 토큰·테마·컴포넌트 작성 | [ADR-0010](adr/0010-custom-compositionlocal-theme.md) + [design-system](architecture/design-system.md) (전신 [ADR-0007](adr/0007-compose-material3-design-tokens.md), superseded) |
| 로컬 영속화(DataStore) | [ADR-0008](adr/0008-datastore-local-persistence.md) + [data-layer](architecture/data-layer.md) |
| UseCase 패턴 | [ADR-0009](adr/0009-usecase-injectable-invoke.md) |
| 신규 데이터(Repo/DataSource) 추가 | [data-layer](architecture/data-layer.md) 체크리스트 |
| 원격 네트워크(Retrofit·OkHttp)·인증 헤더·응답 계약 | [ADR-0017](adr/0017-remote-network-datasource.md) + [data-layer](architecture/data-layer.md) |
| 서버 API 계약·엔드포인트·요청/응답 필드 | [api/README.md](api/README.md) + [api/conventions.md](api/conventions.md) |
| 도메인에서 비트맵 다루기(크로스모듈 추상) | [ADR-0011](adr/0011-cross-module-bitmap-abstraction.md) + [module-structure](architecture/module-structure.md) |
| 이미지 세그멘테이션(누끼)·ML Kit | [ADR-0012](adr/0012-mlkit-subject-segmentation.md) + [data-layer](architecture/data-layer.md) |
| 푸시(FCM)·Crashlytics·Firebase 설정 | [ADR-0013](adr/0013-firebase-fcm-crashlytics.md) |
| 로깅·Logger 추상화(Kermit) | [ADR-0014](adr/0014-logging-abstraction-kermit.md) |
| 유효성 결과·에러 문자열 다국어 매핑(domain 의미↔표시 분리) | [ADR-0016](adr/0016-domain-result-presentation-string-mapping.md) + [state-management](architecture/state-management.md) |
| 구현 직전 기능·컴포넌트 설계 스펙 | [specs/README.md](specs/README.md) |
| 작업 계획·진행 중/완료 작업 | [plans/README.md](plans/README.md) |
| 제품 문서(PRD·positioning·roadmap 등, PM-Skills 산출물) | [pm/README.md](pm/README.md) |
| 구현 미결·열린 결정·코드/문서 정합 이슈 | [open-questions.md](synthesis/open-questions.md) |

## 문서 지도
- **[`adr/`](adr/README.md)** — "왜"(결정·대안·트레이드오프). 인덱스: [adr/README.md](adr/README.md)
- **[`architecture/`](architecture/README.md)** — "어떻게/어디"(상시 구현 가이드). 인덱스: [architecture/README.md](architecture/README.md)
- **[`api/`](api/README.md)** — 서버(`mash-up-kr/TEAMYG-SERVER`) API 계약 스냅샷 + Android 적용 상태.
  정본은 서버 코드이고 이 디렉토리는 미러다. 추적 브랜치는 서버 **`main`**(TJYG-Android의 `develop`과 다름).
  기준선·갱신 절차는 [api/server-baseline.md](api/server-baseline.md), 반복 워크플로는 스킬 `sync-teamyg-server-api`.
- **[`specs/`](specs/README.md)** — "무엇을 만드나"(구현 직전 확정 설계, `YYYY-MM-DD-kebab-topic.md`). 완료분은 `specs/archive/`. 인덱스: [specs/README.md](specs/README.md)
- **[`plans/`](plans/README.md)** — 작업 계획(`YYYY-MM-DD-kebab-topic.md`). 완료분은 `plans/archive/`
- **[`pm/`](pm/README.md)** — 제품 문서(PRD·positioning·roadmap·user story·discovery 등, PM-Skills 산출물, `YYYY-MM-DD-kebab-topic.md`). 코드 작업은 superpowers 체인, 문서 작업은 PM-Skills — 라우팅은 루트 CLAUDE.md.
- **[`blog/`](blog/README.md)** — 외부 공개용 기술 블로그 원고(`YYYY-MM-DD-kebab-topic.md`). 발행 전 `korean-humanizer` 검증. 인덱스: [blog/README.md](blog/README.md)
- **[`script/`](script/README.md)** — 파이썬 툴링 홈(스킬 호출 로직·유틸, stdlib 전용). 템플릿: `_script-template.py`·`SKILL.template.md`.
- **[`synthesis/`](synthesis/)** — 분석·점검 산출물(open-questions·lint). wiki `synthesis/`와 동형.
  - **[`synthesis/open-questions.md`](synthesis/open-questions.md)** — 구현 미결·열린 결정·코드/문서 정합 이슈 추적. 정책·기획 미결은 위키 [[open-questions]].
  - **[`synthesis/lint-2026-07-22-parfait.md`](synthesis/lint-2026-07-22-parfait.md)** — 문서 내부 정합(링크·상태표·규율·민감데이터) 점검 보고서(2026-07-22, wikilink 3건 수정).
  - **[`synthesis/lint-2026-07-06-parfait.md`](synthesis/lint-2026-07-06-parfait.md)** — 문서 vs 실제 코드 정합성 점검 보고서(2026-07-06, 조치 완료 이력).
- **[`doc-baseline.md`](doc-baseline.md)** — 문서를 마지막으로 검증한 `develop` 커밋 해시(SoT) + "develop 기준 문서 점검" 절차. 현재 기준선 `2d0f6a5d`(2026-08-16, #260 세션 인프라·#262 앱 아이콘·#259 캘린더까지).

## 규율 (상세는 각 문서)
- **SoT 우선순위**(모순 시): 코드 > wiki > CLAUDE.md
- **라인번호·변동수치 금지** — 근거·규칙은 [adr/README.md](adr/README.md)
- 새 아키텍처 결정 = 새 ADR([adr/template.md](adr/template.md)), 코드와 같은 커밋. 구조 변경 시 같은 PR에서 wiki 갱신(drift 금지).
- 새 기능·컴포넌트 = 구현 전 [specs/](specs/README.md)에 설계 스펙 확정([specs/template.md](specs/template.md)) 후 코드 작성.
