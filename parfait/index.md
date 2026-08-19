# Parfait wiki — 에이전트 진입 허브

> 세션 시작·작업 전 **이 파일부터** 읽어라. 여기서 "무엇을 찾으면 어디를 보라"로 라우팅한 뒤, 필요한 문서만 펼친다 (전체를 읽지 말 것).

## 지금 상태 (1줄)
Android 단일 플랫폼, Jetpack Compose + Navigation3. 다중 모듈(core/data/domain/feature)·컨벤션 플러그인·Hilt·자체 MVI 기반. 원격 네트워크 기초 구조(컨벤션 플러그인·NetworkModule·ApiResponse/safeApiCall·remote 예시)가 **develop 머지**됨(#174), 실제 API 연동은 후속(ADR-0017). 화면은 G-001 목록(#222로 실패 화면·pull-to-refresh·A-005 이동까지)·C-101 카메라 플로우·C-001 캔버스 메인(#199 — 반응형 배치·Dot Grid 배경·토핑 추가 메뉴, ~~진입 경로 0건~~ → **#268로 G-001에서 진입**)까지 들어왔고 전부 **데이터·후속 화면 미결선** 상태다. **토핑 생성 경로는 이어졌다**(#221) — C-101-confirm "다음"이 C-103 누끼 추출로 결선되고 확인(C-103)·수동 편집(C-104)·테두리 편집(C-105)이 한 라운드에 들어와 캔버스 배치(C-106) 직전까지 닿는다. 다만 네 화면의 닫기가 전부 빈 람다라 **플로우를 나갈 출구가 없다**. **캔버스 편집 갈래도 열렸다**(#231) — C-001 편집 버튼이 C-301 배경 편집으로 이어지고 카메라·갤러리·확인 세 화면을 토핑 생성 플로우와 공유하지만(NavKey `returnResultOnly` 인자로 분기), 고른 배경이 저장·반영되지 않는다(~~C-001 진입 경로 0건이라 이 갈래 전체가 도달 불가~~ → #268로 진입이 열려 함께 도달 가능해졌다). 앱 진입 체인은 Splash→Login→TermAgree→GroupList로 이어졌고(#220), 그 첫 화면 A-002 로그인이 온보딩 일러스트 3장으로 실물화됐고(#218) **인증까지 결선됐다**(#241). 그룹 생성(A-005)·참여(A-004→S-102) 두 갈래도 확인 모달을 거쳐 **목록으로 되돌아오며 닫혔다**(#224, `goToSingleClearTop`) — 위키 정본은 이 자리를 C-001 직접 진입으로 적는다. 디자인시스템은 Figma 바 3종(Top Bar Canvas·List-Date·Floating Bar)과 배경 블러(Haze, ADR-0018)까지 머지됐다(#188).
서버 계약은 `api/`에 스냅샷돼 있다(도메인 7건·**엔드포인트 28개 + 테스트 전용 1**, 서버 `57529ec`).
**2026-08-18 delta는 엔드포인트를 안 늘리고 응답을 넓혔다** — Nametag-Chip 부여 주체가 서버가 됐고
(그룹 상세·목록·캔버스 `placedBy`에 필드 셋), 그룹 상세가 `groupName`·`memberLimit`을 싣는다.
같은 라운드가 **하루 경계를 자정에서 03시로 옮겨** 앱과 어긋났다(불일치 2건째, `api/parfait.md` "하루 경계").
**2026-08-19 delta도 엔드포인트 증감 0**(두 라운드 연속) — 칩이 캔버스 `groupMembers`·토핑 배치
`placedBy`까지 실려 C-001 상단 멤버 칩이 계약 안으로 들어왔고, 목록의 시각·칩이 비널이 됐으며,
과거 목록 `to` 기본값도 03시로 통일돼 **서버 안의 두 기준이 하나가 됐다**. 전역 405도 생겼다.
⚠️ **같은 delta가 응답 JSON 키를 `nameTagChip` 계열로 바꿔** 그 필드를 옛 키로 읽는 미머지 브랜치가
조용히 어긋났고, 목록 시각의 비널화로 **기존 파싱 불일치가 "그룹이 하나라도 있으면"으로 커졌다**.
2026-08-15 2차 서버 delta는 엔드포인트 증감 없이 규칙만 바꿨고 — 초대코드 6자·닉네임 자모 허용·
그룹 내 닉네임 중복 허용(`GROUP_NICKNAME_ALREADY_USED` 삭제) — **2026-08-16 delta가 파르페 상세 조회·
배경 변경 2건을 더했다.** 그중 배경 변경이 C-301이 고른 배경을 버리던 이유의 서버 절반을 닫는다.
**Android 표면은 27/27, 공백 0이다** — 그 신규 2건을 **같은 날 #266이 닫았다**(2026-08-15 PR #250이
파르페 오늘·과거 조회, 토핑 테두리 수정·삭제, 회원 탈퇴 다섯을 닫은 데 이어. 애플 로그인 1건과
테스트 전용 회전 1건은 분모에서 뺀다). 배경 변경은 이 도메인 **첫 쓰기 경로**여서 첫 요청 DTO와
쓰기 전용 `CanvasBackgroundEdit`가 함께 들어왔고(읽기 모델은 이미지 배경을 URL로 들어 되돌려 보낼 수
없다), `TodayCanvasVO`는 상세 조회와 응답을 공유하며 **`CanvasVO`로 개명**됐다. **다만 `http/` 요청
모음은 25/27로 남아 표면과 처음으로 갈렸다.**
같은 PR이 2차 서버 delta도 반영했다 — `CheckNameValidUseCase`가 자모를 허용하고
`GROUP_NICKNAME_ALREADY_USED` 분기는 걷혔다. **다만 그 다섯 표면은 Repository조차 없다.**
**2026-08-15 — 하루 만에 8 엔드포인트가 화면까지 결선됐다**(#241·#242·#243·#244·#248).
A-002 카카오 로그인(#241)에 이어 온보딩 약관이 목록 조회·회원가입·세션 저장까지 가고(#242),
그룹 생성(#243)·참여 미리보기/참여/닉네임 변경(#244)·목록 조회(#248)가 붙어 **mock UseCase 3종,
mock 그룹 4건, `TERM_CONTENT_LIST`가 전부 삭제**됐다. 선반영이던 `ParfaitGroupRepository` 5메서드와
`ServerErrorCode` 12종도 이 라운드에서 모두 소비된다. 그 아래는 MVI 공통 에러 인프라
(`AppError`·`Channel` 이펙트·`launch(key, onError)`)다([ADR-0020](adr/0020-mvi-error-effect-infrastructure.md)).
남은 mock은 G-001의 `nickName` 하나인데, **그 값이 그룹 생성 요청으로 서버에 나간다.**
~~파르페·이미지·회원·토핑 4 도메인은 표면은 전량 있는데 여전히 Repository조차 없다~~ → **회원(#263)·
파르페(#268)가 Repository를 얻어 이미지·토핑 둘만 남았다.**
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
**2026-08-17 — 캔버스가 서버를 본다**(#268). `ParfaitRepository`(파르페 도메인 첫 Repository, 오늘·목록·상세
셋만) → UseCase 둘 → C-001이 **배경·토핑·멤버를 실데이터로** 그리고, 날짜 선택이 그날 캔버스를 불러온다.
진입도 열렸다 — `NavKeyCanvasMain(groupId)` + G-001 토핑 클릭. Repository가 0건인 도메인은 **둘**
(image·parfait-image)로 줄었다. ⚠️ **읽기만이다** — 배치·좌표 저장 경로가 없어 토핑을 새로 얹지 못하고,
조회 실패는 로그만이라 빈 캔버스와 구분되지 않는다. 달력 UseCase 둘·C-301 편집 탭은 여전히 mock이다
([c001-canvas-today-detail 스펙](specs/archive/2026-08-17-c001-canvas-today-detail.md)).
**2026-08-17 — 클릭이 한 유틸로 모였다**(#284, PR #292 develop 머지). 프로덕션 Foundation
`Modifier.clickable` **28곳을 전량 `clickableYGNoRipple`로 이관**했다(남은 `clickable`은 `androidTest`
픽스처 2건뿐). 컴포넌트 대부분이 `collectIsPressedAsState()`로 눌림을 직접 그려
리플이 필요 없는데 호출 지점마다 `indication = null` 유무가 갈려 의도가 코드로 구분되지 않았다 —
**무리플을 기본에 두고 리플이 필요한 곳을 나중에 `clickableYG`로 올리는** 방향이다. 그 과정에서
`clickableYGNoRipple`에 `interactionSource` 파라미터가 붙었고, 300ms 스로틀이 화면 클릭 전반에
적용됐다(게이트는 Modifier 노드마다 하나라 같은 요소 연타만 막는다). 미결 3건 해소(`YGDateButton`
규약 이탈·`clickableYGNoRipple` 사용처 0·갤러리 그리드 셀), 신규 1건(리플이 유일한 피드백이던 6곳)
→ [design-system](architecture/design-system.md) clickable 절.
**2026-08-17 — C-001 화면 이름이 역할을 따라갔다**(#278, PR #291 develop 머지). 화면 계열이
`CanvasImageAdd*` → **`CanvasMain*`**로 개명됐다(`NavKeyCanvasMain`·`CanvasMainRoute`/`Screen`/`ViewModel`/
`UiState`/`Intent`/`Effect`, `strings.xml` 키 `canvas_main_*`). 머지본 대조 결과 **이름 치환 외 변경 0건**
(시그니처·동작 불변). 현행 문서(index·architecture·api·open-questions 미결)는 새 이름을 쓰고,
아카이브 스펙 본문과 `doc-baseline`은 당시 이름을 유지한 채 각주로 표기했다.
**2026-08-17 — 달력도 서버를 본다**(#279). 두 UseCase가 mock을 버리고 `getYears`가 올라와
`ParfaitRepository`가 **다섯 갈래 중 넷**을 연다(남은 하나는 배경 변경). `ParfaitHistory`는 삭제되고
달력이 계약 VO `PastCanvasVO`를 그대로 쓰며, 날짜 선택은 캐시에서 `parfaitId`를 꺼내 **상세만** 부른다.
상태가 `todayCanvas`/`viewedCanvas`로 갈려 편집 대상이 언제나 오늘이고, 지난 캔버스에서는 메뉴가
**갤러리에 저장·오늘의 파르페 가기**로 바뀐다(저장은 아직 로그 한 줄). ⚠️ 상세 조회에 붙은
`launch(key)` 가드가 **직전 라운드의 "마지막 선택이 이긴다"를 뒤집어**, 연속 선택 시 머리말과 그림이
어긋난 채 남는다([c201-canvas-calendar-server 스펙](specs/archive/2026-08-17-c201-canvas-calendar-server.md)).
**2026-08-17 — 그룹 설정이 mock을 다 버렸고 나가는 문도 열렸다**(#285·#287). 상세 조회로 화면이
채워지고 닉네임 변경·나가기·신고가 실제 요청을 보낸다. `ParfaitGroupRepository`가 **8/8**이 되며
parfait-group이 **`android_status: done`**(8 엔드포인트 전부 호출부). **진입도 이때 열렸다** —
`NavKeyGroupSetting(groupId)` + C-001 상단 메뉴로 4일간의 도달 불가가 닫혔고, 컨테이너도
`YGScaffoldV2`(Route)로 이관돼 V1 잔여가 7파일로 줄었다. 상세 응답에 그룹명이 없어 **UseCase가
목록을 한 번 더 부르고**(그 실패는 삼킨다), 나가기·신고 성공은 `replaceAll(NavKeyGroupList)`다
(백스택이 전부 떠난 그룹 것이라 되돌아가면 403). ⚠️ 남은 것은 계약 공백과 임시 상수다 —
`remainingCount` mock 1(정원이 생성 응답에만 있다)·컬러칩 인덱스 순환·**신고 사유 하드코딩 하나**,
그리고 403/404가 일시 장애와 같은 문구다. ~~회원 탈퇴는 그대로 stub~~ → **#306으로 닫혔다**
([s101-group-setting-api 스펙](specs/archive/2026-08-17-s101-group-setting-api.md)).
**2026-08-17 — 화면이 앞에 설 때마다 다시 묻는다**(#288, PR #297 develop 머지). G-001 목록·C-001 캔버스에
`Enter` 인텐트가 생기고 Route의 `LifecycleResumeEffect`가 그것을 보낸다 — `init` 조회는 ViewModel 수명에
걸린 것이라 백스택 아래에서 살아남아 낡았고, **생성·참여 후 목록이 갱신되지 않던 문제가 닫혔다**
(OQ-P-169). 복귀 관용구는 손대지 않았다(재조회가 필요한 이유는 복귀가 아니라 **남이 바꾸기 때문**).
같이 뒤집힌 것이 실패 규칙이다 — 목록이 남아 있으면 화면을 유지하고 **당긴 새로고침 실패만 토스트**로
알린다(목록이 비면 종전대로 에러 화면). 토스트 호스트 때문에 G-001이 `YGScaffoldV2`로 이관돼
**V1 잔여 6파일**. C-001은 오늘을 볼 때만 오늘 캔버스·올해 달력 기록을 다시 받고, 화면을 열어 둔 채
자정을 넘긴 경우는 `syncToday()`가 맡는다. ⚠️ 관용구일 뿐 규약이 아니고(OQ-P-221) C-001 조회 실패는
여전히 로그뿐인데 **실패할 기회만 늘었다**
([screen-resume-refetch 스펙](specs/archive/2026-08-17-screen-resume-refetch.md)).
**2026-08-19 — 되돌릴 수 없는 문 셋이 다 열렸다**(#306). S-001 앱 설정의 회원 탈퇴가 마지막 stub이었고
`WithdrawUseCase`로 결선되며 **member 도메인이 `android_status: done`**(3 엔드포인트 전부 호출부)이 됐다.
UseCase가 얹는 규칙은 **순서**다 — 서버가 받아 준 뒤에만 기기를 정리하고, 거절당하면 아무것도 지우지
않는다(로그아웃과 반대인데, 서버가 거절했는데 로컬만 지우면 계정이 살아 있는 채로 사용자만 탈퇴했다고
믿는다). 형태는 S-101 나가기·신고가 확정한 것을 그대로 따랐다 — 팝업을 먼저 닫고 로딩 오버레이가 덮으며
실패는 토스트다. 성공은 `replaceAll(NavKeyLogin)`. ⚠️ **끝난 뒤가 깨끗하지 않다** — 정리를 위임받은
`LogoutUseCase`가 죽은 토큰으로 서버 로그아웃을 부르고, 그 401이 재발급을 깨워 `ForcedLogout`까지
발행돼 **이동을 두 곳이 일으킨다**(OQ-P-242). 실기기 확인은 없다.

## 무엇을 찾는가 → 어디를 보라
| 알고 싶은 것 | 권위 문서 |
|---|---|
| 모듈 구조·의존 방향 | [ADR-0001](adr/0001-layered-multi-module.md) + [module-structure](architecture/module-structure.md) |
| feature :api/:impl 분리 이유 | [ADR-0002](adr/0002-feature-api-impl-split.md) |
| 빌드 세팅(컨벤션 플러그인·버전 카탈로그) | [ADR-0003](adr/0003-convention-plugins-version-catalog.md) |
| DI·Hilt·스코프 | [ADR-0004](adr/0004-hilt-ksp-di.md) + [data-layer](architecture/data-layer.md) |
| 화면 상태관리(MVI)·신규 화면 추가 | [ADR-0005](adr/0005-custom-mvi-baseviewmodel.md) + [state-management](architecture/state-management.md) |
| 공통 에러 처리·이펙트 전달·중복 실행 방어 | [ADR-0020](adr/0020-mvi-error-effect-infrastructure.md) + [mvi-error-infrastructure 스펙](specs/archive/2026-08-13-mvi-error-infrastructure.md) |
| 화면 컨테이너·공통 로딩 오버레이·실패 토스트 배선 | [design-system](architecture/design-system.md) "화면 컨테이너" + [ygscaffold-v2 스펙](specs/archive/2026-08-16-ygscaffold-v2-common-loading-error.md) |
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
- **[`doc-baseline.md`](doc-baseline.md)** — 문서를 마지막으로 검증한 `develop` 커밋 해시(SoT) + "develop 기준 문서 점검" 절차. 현재 기준선 `c36cad49`(2026-08-20 검증, #306까지 — **회원 탈퇴 결선**으로 S-001 Danger Zone의 마지막 stub이 닫히고 member 도메인이 `android_status: done`이 됨. `WithdrawUseCase`가 얹는 규칙은 **서버 성공 뒤에만 로컬을 정리한다**는 순서이고, 정리는 `LogoutUseCase`에 위임한다. 단 그 위임 때문에 **죽은 토큰으로 로그아웃이 한 번 더 나가 재발급·`ForcedLogout`까지 깨운다**(OQ-P-242). 직전 기준선 `f12870a8`은 #290 C-106 토핑 배치 화면).

## 규율 (상세는 각 문서)
- **SoT 우선순위**(모순 시): 코드 > wiki > CLAUDE.md
- **라인번호·변동수치 금지** — 근거·규칙은 [adr/README.md](adr/README.md)
- **코드 주석·KDoc** — [CLAUDE.md](CLAUDE.md). 코드가 이미 말하는 것은 안 쓰고, 고정 틀을 쓰지 않으며, **다른 곳의 현재 상태는 낡으니 단정하지 않는다**. 아키텍처 결정은 코드가 아니라 `architecture/`·`adr/`에.
- 새 아키텍처 결정 = 새 ADR([adr/template.md](adr/template.md)), 코드와 같은 커밋. 구조 변경 시 같은 PR에서 wiki 갱신(drift 금지).
- 새 기능·컴포넌트 = 구현 전 [specs/](specs/README.md)에 설계 스펙 확정([specs/template.md](specs/template.md)) 후 코드 작성.
