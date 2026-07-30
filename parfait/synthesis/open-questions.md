---
id: open-questions
title: Open Questions — 구현 미결·열린 결정
category: meta
status: living
platforms: android
verified: 2026-07-30
related_spec: designsystem-text-component-sync, a005-group-create, s002-account-info, data-network-setup
related_adr: ADR-0010, ADR-0011, ADR-0012, ADR-0013, ADR-0014, ADR-0016, ADR-0017
related_architecture: design-system, data-layer
related_code:
tags: [meta, parfait]
---
# Open Questions — 구현 미결·열린 결정

TJYG-Android 구현에서 발견된 미결 결정·계약 공백·코드/문서 정합 이슈를 추적한다.
정책 기획 쪽 미결은 위키 [[open-questions]]에 있다. 여기는 **코드·ADR·architecture 소관**만 둔다.
해소된 항목은 상태를 "해소됨"으로 바꾸고 관련 ADR/architecture 문서에 반영한다.

> **읽는 법 — 부정 매칭.** 상태는 열거형이 아니라 자유 서술이다(`미해결 (코드 수정 대상)`,
> `부분 해소 (② 해소, ① 잔존)`, `보류 (온디바이스로 잠정 채택, beta 추적 중)` 등).
> **`해소됨`으로 시작하지 않는 모든 항목은 미결**로 취급한다 — `미해결` 문자열 검색은
> `부분 해소 (…잔존)` 항목을 통째로 놓친다. `해소됨`이어도 메모에 잔존 조건이 있으면 살아 있다.
> 괄호 안까지 그대로 읽을 것.

> 링크 규약: parfait 내부 문서는 상대 md 링크(`../adr/…`, `../architecture/…`). 위키 개념 참조만 `[[…]]`.

---

### [2026-07-10] YGButton 디자인 토큰 규칙 미확정
- **출처**: `component/ygbutton/YGButtonType.kt` — 각 변형 `colors`가 시맨틱(`YGTheme.colorScheme`) 대신 `YGAtomicColors`를 직접 참조, 값 잠정(mock). 코드 주석 "Design Token 규칙이 조금 이상… 컴포넌트 완성 시점에 문의 예정".
- **항목**: ① 컴포넌트가 원자 색을 직접 읽는 것을 시맨틱 계층으로 정리할지, ② XSmall/Small/… 변형별 패딩·radius·textStyle 토큰 매핑 확정.
- **상태**: 미해결
- **해소 메모**: 컴포넌트 완성·디자인 토큰 규칙 확정 시 [design-system](../architecture/design-system.md) 규약과 [ADR-0010](../adr/0010-custom-compositionlocal-theme.md) 원칙(시맨틱 우선)에 맞춰 정리.

### [2026-07-12] BitmapWrapper stub — 계약 없는 추상
- **출처**: `core/util/jvm`의 `BitmapWrapper`(멤버 없음, `// TODO 차후 비트맵 사용에 필요한 함수 구현`), `core/util/android`의 `AndroidBitmap`(`// TODO delegate 사용하도록 수정`).
- **항목**: ① 도메인이 비트맵에 필요한 연산을 `BitmapWrapper` 계약으로 정의할지(현재는 `data`에서 `as? AndroidBitmap` 다운캐스트에 의존), ② `getRawData()` 직접 노출을 유지할지.
- **상태**: 미해결
- **해소 메모**: 필요한 연산 확정 시 [ADR-0011](../adr/0011-cross-module-bitmap-abstraction.md) 본문·`BitmapWrapper`에 반영해 다운캐스트 의존을 줄인다.

### [2026-07-12] ML Kit Subject Segmentation beta 의존
- **출처**: `gradle/libs.versions.toml`의 `mlkitSubjectSegmentation`(beta), `feature/segmentation/impl`의 `AndroidManifest` install-time 모델. [ADR-0012](../adr/0012-mlkit-subject-segmentation.md).
- **항목**: ① beta 승급·API 변동 추적, ② GMS 미탑재 기기 대응, ③ subject PNG 캐시 파일(`cacheDir`) 정리 정책, ④ [[누끼-따기]] "온디바이스 vs 서버" 미결의 온디바이스 잠정 확정 여부.
- **상태**: 보류 (온디바이스로 잠정 채택, beta 추적 중)
- **해소 메모**: 정식(GA) 승급 시 버전 고정·문서 갱신. 캐시 정리 정책 정하면 [data-layer](../architecture/data-layer.md) 갱신.

### [2026-07-12] 세그멘테이션 예외 처리 불일치
- **출처**: `data`의 `ImageSegmentationRepositoryImpl.segmentImage` — `Result<SegmentationResult>`/`SegmentationException` 패턴을 쓰면서도 `foregroundConfidenceMask`가 null이면 `error("...")`(raw `IllegalStateException`)로 throw. Result로 감싸지 않아 호출부(effect→Toast)가 못 잡을 수 있음.
- **항목**: null 마스크·`Tasks.await` 예외를 `SegmentationException`(예: 신규 케이스)으로 통합해 `Result.failure`로 반환할지.
- **상태**: 미해결
- **해소 메모**: 코드 수정 대상(문서 아님). 처리 방식 확정 시 [ADR-0012](../adr/0012-mlkit-subject-segmentation.md) "위험·방어"와 정합 확인.

### [2026-07-12] 디자인시스템 컴포넌트 컨벤션 분기
- **출처 A**: `component/ygbutton`·`ygiconbutton`·`ygactionitem` — 컴포넌트별 폴더 + `@Preview`/`YGCustomTheme`(+`PreviewParameterProvider`) 프리뷰.
- **출처 B**: `component/textfield`·`etc` — 그룹 폴더 + `@YGPreview`/`PreviewBox` 프리뷰.
- **항목**: ① 패키지 네이밍(컴포넌트별 vs 그룹 폴더) 표준, ② 프리뷰 방식(`@YGPreview`/`PreviewBox` vs `@Preview`/`PreviewParameterProvider`) 표준.
- **상태**: 부분 해소 (② 프리뷰 방식 — **#158 develop 머지(2026-07-19)로 해소**. ① 패키지 네이밍은 잔존 미해결.)
- **해소 메모**: ② 프리뷰 방식 — 리팩터([designsystem-preview-migration 스펙](../specs/archive/2026-07-18-designsystem-preview-migration.md)/[plan](../plans/archive/2026-07-18-designsystem-preview-migration.md))로 컴포넌트 프리뷰 전부 `@YGPreview`+`PreviewBox` 전환, **PR #158 develop 머지 완료**(`ce4e9b8`). [design-system](../architecture/design-system.md) 프리뷰 노트 "표준 통일 완료"로 갱신함. ① 패키지 네이밍 표준 확정 시 "컴포넌트 작성 규약"에 반영하고 기존 컴포넌트 정리(YGColorChip 패키지 불일치 포함).

### [2026-07-13] design-system.md가 develop 미머지 브랜치 작업을 구현됨으로 기술
- **출처**: 문서가 일부 심볼을 구현됨으로 기술하나 `origin/develop`에 부재. `YGListItem`·`YGHorizontalDivider`(`component/etc/`, design-system.md 인벤토리)는 브랜치 `feature/#136-etc-component`에만 존재. (`YGModalPopup`은 `feature/#135-modal-component`에만 — 아직 인벤토리 미기재.)
- **항목**: ① 문서 기준선을 develop로 볼지(파르페 규율 "코드>문서, drift 금지"), ② 미머지 항목을 "머지 예정/브랜치" 마커로 남길지 인벤토리에서 잠정 뺄지.
- **상태**: 해소됨
- **해소 메모**: clickable 유틸(`clickableYG`·`ygDimRipple`·`ygScaleRipple`)은 **#94 develop 머지(#143)로 해소**(2026-07-15). **#136(etc: YGListItem·YGHorizontalDivider·YGActionItem·YGDangerZone·YGInviteCard)은 PR #148, #135(modal: YGModalPopup)은 PR #151로 2026-07-18 기준선 점검 시 develop 머지 확인** → 잔여 해소. design-system.md 인벤토리에 전 컴포넌트 등록·"미머지" 마커 제거 완료.

### [2026-07-14] clickable 유틸이 `core:util:android`로 이동 — ripple 색 테마 비의존
- **출처**: `core:util:android clickable/`(#94에서 `core:designsystem`→이동). `YGDimRipple`의 기본색이 `YGAtomicColors.Gray.Gray900`(테마)에서 리터럴 `YGDimRippleColor = Color(0xFF29292C)`로 바뀜 — util:android가 `core:designsystem` 비의존이라 테마 색을 못 읽음.
- **항목**: ① ripple 색 시맨틱 토큰화를 어떻게 할지(호출측 designsystem 컴포넌트가 `color` 주입 vs util 잔류 리터럴), ② `core:util:android`가 Compose UI(`parfait.jetpack.compose` 플러그인 + material-ripple/animation)를 갖게 된 레이어 성격 변화 — util 모듈에 UI clickable/ripple을 두는 게 맞는지(대안: 별도 `core:ui`/designsystem 잔류). 결정되면 ADR 검토.
- **상태**: 미해결 (이동·#94 develop 머지(#143, 2026-07-15) 완료, 레이어·토큰 방침 미확정)
- **해소 메모**: 색 토큰 규칙 확정 시 [[design-system]] 규약과 정합. 레이어 방침 확정 시 module-structure/ADR 반영.

### [2026-07-16] YGToggleButton 규약 이탈 — Colors 미분리·색 하드결선·하드코딩 치수
- **출처**: `component/ygtogglebutton/YGToggleButton.kt`(PR #142 develop 머지) — 다른 상호작용 컴포넌트(YGButton·YGChipButton)와 달리 Colors data class를 분리하지 않고 `YGAtomicColors.{Gray.White,Gray.Gray900,Transparency.Black50}`를 컴포저블 본문에서 `isSelected` 인라인 조건 분기(색 커스터마이즈 불가). 아이콘 크기 `24.dp` 리터럴(`SizeTokens` 미사용). 상호작용은 `clickable`+pressed 대신 `selectable`(selected 시맨틱).
- **항목**: ① 색을 `YGToggleButtonColors`(+Defaults) 패턴으로 분리할지(YGChipButton 선례), ② `24.dp`를 `SizeTokens`로 토큰화할지, ③ `selectable` 관용구를 선택형 컴포넌트 표준으로 채택할지.
- **상태**: 미해결
- **해소 메모**: 디자인 토큰 규칙 확정 시 [design-system](../architecture/design-system.md) "컴포넌트 작성 규약" + [2026-07-10 YGButton 디자인 토큰](#2026-07-10-ygbutton-디자인-토큰-규칙-미확정)과 정합해 정리.

### [2026-07-18] YGColorChip 패키지↔폴더 불일치
- **출처**: `component/ygcolorchip/` — `YGColorChip.kt`·`YGColorChipPreviewData.kt`는 `package …component.ygchip` 선언, `YGColorChipType.kt`만 `package …component.ygcolorchip`. 폴더는 `ygcolorchip/`인데 패키지가 둘로 갈림.
- **항목**: 패키지를 폴더명(`ygcolorchip`)으로 통일할지(권장), 폴더를 패키지명(`ygchip`)에 맞출지.
- **상태**: 미해결 (코드 수정 대상)
- **해소 메모**: 컨벤션 정리 시 [design-system](../architecture/design-system.md) "컴포넌트 작성 규약"과 정합. [2026-07-12 컨벤션 분기](#2026-07-12-디자인시스템-컴포넌트-컨벤션-분기)와 함께 처리.

### [2026-07-18] 네임태그 컬러칩 타입 개수 — 코드 14종 vs 정책 12종
- **출처**: `component/ygcolorchip/YGColorChipType.kt` — `NametagChip1`~`NametagChip13` + `NametagChipPlus`(추가용) = **14종**(숫자 13 + Plus). 위키 정책 [[nametag-chip]]([[S-101-프로필-닉네임-컬러-규칙-v0.2]])은 **Nametag-Chip 12종**으로 기술.
- **항목**: ① 실제 매핑이 12종인지 13(+Plus)종인지 확정, ② 코드↔정책 중 어느 쪽이 SoT인지(원칙: 코드>정책, 단 색 규칙은 디자인 정책 소관). 위키 정책 재확인 필요.
- **상태**: 미해결 (코드/정책 정합)
- **해소 메모**: 정책 확정 시 위키 [[nametag-chip]]·[[S-101-프로필-닉네임-컬러-규칙-v0.2]] 갱신, 코드 타입 개수 정합. parfait [ygcolorchip 스펙](../specs/archive/2026-07-18-ygcolorchip.md)의 타입 표 반영.

### [2026-07-18] YGDateButton clickableYG 미사용 — 스로틀 규약 이탈
- **출처**: `component/ygdatebutton/YGDateButton.kt` — 클릭을 표준 `Modifier.clickable(indication = null)` + `semantics { role = Role.Button }`로 직접 구현. 다른 상호작용형 컴포넌트(YGButton·YGIconButton·YGActionItem·YGChipButton)가 쓰는 `core:util:android`의 중복 클릭 leading-throttle 유틸(`clickableYG`)을 안 씀 → 빠른 연타 방어 부재.
- **항목**: `YGDateButton`을 `clickableYG`(또는 변형)로 전환할지, 캘린더 셀은 스로틀 예외로 둘지.
- **상태**: 미해결 (코드 수정 대상)
- **해소 메모**: 방침 확정 시 [design-system](../architecture/design-system.md) "pressed 상태 관용구"·clickable 규약과 정합. [clickableyg-throttle 스펙](../specs/archive/2026-07-12-clickableyg-throttle.md) 참조.

### [2026-07-18] FCM 토큰 서버 전송 미구현
- **출처**: `app/fcm/YGFirebaseMessagingService.kt` — `onNewToken`이 `TODO("서버에 FCM 토큰 전송")`. [ADR-0013](../adr/0013-firebase-fcm-crashlytics.md).
- **항목**: 토큰 갱신 시 서버 등록 흐름(원격 API·재시도·로그인 연계). 원격 네트워킹 자체가 후속 과제([data-layer](../architecture/data-layer.md)).
- **상태**: 보류 (원격 연동 이후)
- **해소 메모**: 원격 연동 준비 시 구현하고 [ADR-0013](../adr/0013-firebase-fcm-crashlytics.md) "위험·방어" 갱신.

### [2026-07-18] `analytics` 패키지가 순수 로깅만 — 이름/기능 범위 불일치
- **출처**: `core:util:jvm`의 `analytics` 패키지에 `Logger`/`Loggers`/`KermitLoggerImpl`/`LoggerInitializer`가 있으나 실제 애널리틱스(이벤트 전송·Firebase Analytics 연동)는 없음. [ADR-0014](../adr/0014-logging-abstraction-kermit.md).
- **항목**: ① 릴리즈 로그 라이터 정책(로그 억제·Crashlytics 연동)을 `LoggerInitializer`에 둘지, ② `analytics` 패키지에 실제 이벤트 트래킹을 붙일지 패키지명을 `logging`으로 좁힐지.
- **상태**: 미해결
- **해소 메모**: 방침 확정 시 [ADR-0014](../adr/0014-logging-abstraction-kermit.md) 본문·`LoggerInitializer` 갱신.

### [2026-07-18] YGAtomicColors public 전환 — 시맨틱 우선 원칙 실질 이탈
- **출처**: `theme/colors/YGAtomicColors.kt` — `internal object YGAtomicColors` → `object YGAtomicColors`(public) 변경. **PR #158(`refactor/design-system-preview`) develop 머지 완료**(2026-07-19, `ce4e9b8`).
- **배경**: 디자인이 GUI에서 시맨틱(`YGColorScheme`) 개념을 쓰지 않고 원자 색을 그대로 끌고 가 사용 → 컴포넌트·피처가 원자 색 직접 참조하는 게 현실. `internal` 유지가 외부 모듈 사용을 막아 불가피하게 public 전환.
- **항목**: ① [ADR-0010](../adr/0010-custom-compositionlocal-theme.md) "컴포넌트는 시맨틱을 읽는다" 원칙을 폐기/완화할지(원자 색이 실질 SoT), ② [design-system](../architecture/design-system.md) "원자 색 직접 참조 금지 원칙" 서술 개정, ③ 시맨틱 레이어(`YGColorScheme`/`YGSemanticColorDefaults`)를 유지할지 걷어낼지, ④ 방향 전환을 신규 ADR로 남길지 ADR-0010 갱신할지.
- **상태**: 미해결 — **코드는 머지됨(public 확정)**, 그러나 원칙 문서화(①~④) 미결. design-system·ADR-0010에는 "머지됨+원칙 이탈" 마커 반영했으나 **방향 전환 ADR 미작성**.
- **해소 메모**: 원칙 결정 시 신규 ADR로 "원자 색 직접 노출 채택" 기록 또는 ADR-0010 개정. 기존 [2026-07-10 YGButton 디자인 토큰](#2026-07-10-ygbutton-디자인-토큰-규칙-미확정) "시맨틱 정리" 방향과 상반 — 함께 재정리.

### [2026-07-20] ProfileCard 각짐 — `radius.none` 토큰 부재로 `RectangleShape` 직접 참조
- **출처**: `feature/app/setting/impl/component/ProfileCard.kt`(PR #160 develop 머지) — 배경·보더 both `shape = RectangleShape`(직접 참조). 설계([app-setting-s001 스펙](../specs/archive/2026-07-19-app-setting-s001.md))는 `YGTheme.shapes.radius.none`을 전제했으나, 초기엔 해당 토큰이 develop 미머지라 우회.
- **항목**: ProfileCard의 `RectangleShape` 직접 참조를 `YGTheme.shapes.radius.none`으로 승격(그 스펙의 "각짐도 테마 경유" 원칙 정합).
- **상태**: 미해결 (코드 수정 대상 — **종속 해소**: `radius.none` 토큰이 [designsystem-radius-none-sync](../specs/archive/2026-07-19-designsystem-radius-none-sync.md) PR #159로 2026-07-22 develop 머지됨. ProfileCard 코드 교체만 잔존, 이제 unblocked)
- **해소 메모**: ProfileCard `shape`를 `YGTheme.shapes.radius.none`으로 교체하고 이 항목 해소. [design-system](../architecture/design-system.md) radius 마커와 함께 정리.

### [2026-07-20] 화면 컨테이너(YGScreen/YGScaffold) 컨벤션 — ADR 미작성
- **출처**: `core:designsystem` `screen/`(`YGScreen`·`YGScaffold`·`YGScreenScope.OnBack`). 설계 [designsystem-ygscreen-scaffold 스펙](../specs/archive/2026-07-20-designsystem-ygscreen-scaffold.md), architecture [design-system](../architecture/design-system.md) "화면 컨테이너"·[navigation-flow](../architecture/navigation-flow.md) 체크리스트에 컨벤션(YGScaffold=nav, YGScreen=화면 최외곽) 반영. **초안 `OnBackResult` 반환 강제 → `OnBack` @Composable(내부 BackHandler emit)로 전환**한 결정 근거는 스펙에만 있고 ADR 미작성.
- **항목**: ① 화면 컨테이너를 DS 레벨에서 제공하고 뒤로가기를 `YGScreenScope`로 노출하는 결정을 ADR로 남길지, ② `YGScreen`↔`YGScaffold` 미통합(`YGScaffold`는 `YGScreenScope`/OnBack 없음)을 통합할지 별도 유지할지 — 이 통합 방향이 정해져야 ADR 내용이 확정됨.
- **상태**: 보류 (**코드 develop 머지 확정 — PR #162, 2026-07-22 기준선 점검**. 스펙 `implemented`·archive 이동. 통합 방향 + ADR 작성만 잔존)
- **해소 메모**: 코드가 develop 머지되고 ①②가 정해지면 신규 ADR 작성(화면 컨테이너·뒤로가기 스코프 채택 근거) 후 [design-system](../architecture/design-system.md)·[navigation-flow](../architecture/navigation-flow.md)의 `related_adr`에 연결하고 이 항목 해소.

### [2026-07-22] YGDangerZone 피그마 델타 — 좌우 gap-5·고정폭 미반영
- **출처**: `component/ygdangerzone/YGDangerZone.kt`(PR #159 develop 머지) — 루트 modifier가 `dashedBorder().padding(vertical = padding2)` + `width(IntrinsicSize.Max)`. 피그마는 상하 padding-2 **+ 좌우 gap-5**, 폭 `Fixed 335`. 좌우 패딩·고정 폭 미반영 상태로 머지.
- **항목**: ① 좌우 패딩(gap-5)을 추가할지, ② 폭을 고정(335)으로 둘지 `IntrinsicSize.Max`(Hug) 유지할지 — 디자인 확인 필요.
- **상태**: 미해결 (코드 수정 대상 — 디자인 확정 대기)
- **해소 메모**: 디자인 확정 시 코드 반영 후 [ygdangerzone-dashed 스펙](../specs/archive/2026-07-19-ygdangerzone-dashed.md) "주의/열린 질문" 정리.

### [2026-07-23] 프리뷰 관용구 부분 회귀 — 신규 컴포넌트가 @YGPreview 표준 이탈
- **출처**: `component/ygalert/YGAlert.kt`·`component/ygtoast/YGToast.kt`(PR #149 develop 머지) — 프리뷰가 `@Preview` + `YGCustomTheme`. `component/ygtext/YGDate.kt`는 `@YGPreview`이나 `PreviewBox` 대신 `YGCustomTheme` 직접 래핑. #158로 "전 컴포넌트 `@YGPreview`+`PreviewBox` 통일"([2026-07-12 컨벤션 분기](#2026-07-12-디자인시스템-컴포넌트-컨벤션-분기) ② 해소)한 뒤 신규 컴포넌트에서 표준이 다시 갈라짐.
- **항목**: 신규 컴포넌트 프리뷰를 `@YGPreview`+`PreviewBox`로 정렬할지(권장), 프리뷰 표준을 강제할 방법(리뷰 체크리스트·lint)이 필요한지.
- **상태**: 미해결 (코드 수정 대상)
- **해소 메모**: 정렬 시 [design-system](../architecture/design-system.md) "프리뷰 방식" 마커를 "통일"로 되돌리고 이 항목 해소. [2026-07-12 컨벤션 분기](#2026-07-12-디자인시스템-컴포넌트-컨벤션-분기) ②와 함께 관리.

### [2026-07-26] 문자열 리소스화 부분 적용 — 잔존 하드코딩·domain 표시문자열
- **출처**: PR #166(`feature/intro/impl`·`feature/groups/enter/impl` `strings.xml` 신설)로 TermAgree·GroupNickName·GroupInviteCode 화면 정적 라벨은 리소스화됐으나, ① `feature/intro/impl`의 `TermContent.kt#TERM_CONTENT_LIST` 약관 항목 title이 코틀린 리터럴로 잔존, ② `domain`의 `InviteCodeResult`가 `errorMessage: String?`로 **표시 문자열을 도메인이 보유** — [ADR-0016](../adr/0016-domain-result-presentation-string-mapping.md)이 `NicknameResult`에서 걷어낸 패턴과 동일, ③ `feature/groups/canvas/impl`의 `CanvasImageAddScreen` 등 미착수 화면은 리터럴 그대로.
- **항목**: ① 정적 라벨 = `strings.xml` 관용구를 전 feature 모듈 규약으로 문서화할지(현재는 각 plan에만 기술, architecture 미기재), ② `InviteCodeResult`를 sealed + `core:ui` 매핑(ADR-0016 패턴)으로 정렬할지, ③ 약관 항목 title 리소스화 여부(랜딩 URL TODO와 함께 처리 후보).
- **상태**: 부분 해소 (① 규약 문서화 — **2026-07-29 [module-structure](../architecture/module-structure.md) "규칙"에 한 줄 추가로 해소**. ②`InviteCodeResult`·③ 약관 title 리터럴·미착수 화면 리터럴은 잔존.)
- **해소 메모**: ① 화면 전용 라벨=feature `strings.xml` / 공유 문구=`core:ui` `strings.xml` / domain 문자열 미보유 규약을 module-structure에 명시(#179가 `NickNameResult`의 domain 문자열을 걷어내 선례 확정). ②는 `CheckInviteCodeValidUseCase` 실검증 구현(현재 stub, G-002 후속) 시점에 함께 정리 — `InviteCodeResult`는 아직 `errorMessage: String?` 그대로다. ③은 [intro-term-agree 스펙](../specs/archive/2026-07-22-intro-term-agree.md)의 랜딩 URL TODO와 묶어 처리.

### [2026-07-27] Toast·Alert 호스트 노출 애니메이션이 동작하지 않음
- **출처**: `component/ygtoast/YGToastPolicy.kt#YGToastHost`·`component/ygalert/YGAlertPolicy.kt#YGAlertHost` — `AnimatedVisibility`가 `visible = true`인 상태로 최초 컴포즈돼 입장 transition이 돌지 않고(`updateTransition`의 `currentState == targetState`), 퇴장은 `setVisible(false)` 직후 같은 프레임에 목록에서 제거된다(Alert은 `clearAlert()`로 즉시 해체). 결과적으로 `YGToastItem.visible`·`YGAlertItem.visible`·`setVisible()`·양쪽 `exit =` 인자가 모두 死코드. [텍스트 영역 sync 스펙](../specs/archive/2026-07-27-designsystem-text-component-sync.md)의 갤러리 화면이 두 호스트를 처음 실행시키면서 최종 리뷰에서 드러남.
- **항목**: ① 입장은 `MutableTransitionState(false).apply { targetState = true }`로, 퇴장은 제거 전 `delay(ANIMATION_DURATION)`로 살릴지, ② 아니면 애니메이션 의도를 접고 `visible`·`setVisible`·`exit` 死코드를 걷어낼지.
- **상태**: 미해결
- **해소 메모**: 위키 [[Toast-공통-정책]]은 노출 방식만 규정하고 애니메이션은 규정하지 않는다 — 디자인 의도 확인 후 ①/② 택일. 처리 시 sync 스펙의 "일치 확인" 정정 노트도 갱신.

### [2026-07-27] YGToastHost 다중 스택이 겹쳐 그려짐
- **출처**: `component/ygtoast/YGToastPolicy.kt#YGToastHost` — 컨테이너가 `Box`라 동시 노출된 토스트가 같은 원점에 겹쳐 그려진다. `Black75` 배경이 중첩돼 어두워지고 텍스트가 포개진다. `YGToastPolicy.show`가 `add(0, …)`로 앞에 넣으므로 최신 토스트가 오히려 아래 깔린다. 위키 [[Toast-공통-정책]]의 "나중 것을 이전 것 위에 노출(쌓임)"과 어긋난다.
- **항목**: `Box` → `Column(verticalArrangement = Arrangement.spacedBy(...))`로 바꿀지(1줄), 바꾼다면 최신 것이 위로 오도록 삽입 순서(`add(0, …)`)와 배치 방향이 맞는지 함께 확인.
- **상태**: 미해결
- **해소 메모**: 위 애니메이션 항목과 같은 파일이라 한 라운드에서 함께 처리하는 편이 낫다. 처리 시 sync 스펙 정정 노트 갱신.

### [2026-07-27] YGChipButton 세로 패딩 Figma 불일치
- **출처**: `component/ygchipbutton/YGChipButton.kt#YGChipButton` — 상/하 패딩이 `padding.padding3`. Figma `Button-Chip-Right`/`Button-Chip-Left` 변형은 세로 `padding-2`로, 칩 높이가 코드 39 vs 디자인 29로 어긋난다. [텍스트 영역 sync 스펙](../specs/archive/2026-07-27-designsystem-text-component-sync.md) 대조 중 `YGAlert` 칩에서 발견.
- **항목**: ① 세로 패딩을 `padding2`로 내릴지, ② 내릴 경우 `YGAlert`·`YGTopBar` 등 공통 사용처의 높이 변화를 함께 검수할지.
- **상태**: 보류 (텍스트 영역 sync 범위 밖 — 칩 영역 sync 라운드로 이월). **처리 라운드 지정됨(2026-07-30)** → [버튼 영역 sync 스펙](../specs/2026-07-30-designsystem-button-component-sync.md) 드리프트 V2
- **해소 메모**: 위 스펙 구현 시 `padding2`로 내리고 `YGAlert`·`YGTopBar` 높이 변화를 갤러리에서 함께 검수한 뒤 해소 처리.

### [2026-07-27] YGToast.Record 표시 문자열 하드코딩
- **출처**: `component/ygtoast/YGToast.kt#YGToast` — `Record` 분기가 `"님이 … 전에 쌓았어요"` 한국어 문구를 `core:designsystem` 안에 리터럴로 보유. 같은 sealed의 `InviteCode`·`Edit`·`Fail`은 완성 문장을 호출자가 주입받는 것과 규약이 어긋난다.
- **항목**: ① 조사·문구를 `strings.xml`(표현 계층)로 옮겨 [ADR-0016](../adr/0016-domain-result-presentation-string-mapping.md) 방향에 맞출지, ② 아니면 `Record`도 완성 문장 주입형으로 통일해 designsystem에서 문자열을 걷어낼지.
- **상태**: 미해결
- **해소 메모**: Toast 실사용처(캔버스 토핑 추가 알림) 구현 시점에 정리. 확정 시 [design-system](../architecture/design-system.md)에 "designsystem 컴포넌트는 표시 문자열을 보유하지 않는다" 규약으로 반영 검토.

### [2026-07-29] 유효성 결과 매핑 as-built가 ADR-0016 원안과 다름
- **출처**: `domain/model/NameValidResult.kt`·`domain/usecase/CheckNameValidUseCase.kt`·`feature/groups/enter/impl` `GroupNickNameViewModel`·`GroupCreateViewModel`·`core/ui/res/values/strings.xml`(PR #179 develop 머지). [ADR-0016](../adr/0016-domain-result-presentation-string-mapping.md)은 `NicknameResult` sealed + `core:ui` `NicknameResult.Error.toStringResource()` 확장 + `core:ui`→`:domain` 의존을 결정했으나, 머지된 코드는 타입명이 `NameValidResult`(그룹명 공용)이고 **표시 매핑이 각 feature ViewModel의 `when`**(리소스 ID 산출)이며 `toStringResource` 확장·`core:ui`→`:domain` 의존은 없다. 에러 문자열 자체는 `core:ui` `strings.xml` 공용.
- **항목**: ① 매핑을 ADR 원안대로 `core:ui` 확장으로 끌어올려 VM 중복을 없앨지, ② as-built(VM이 `@StringRes` 산출)를 정본으로 ADR-0016을 개정할지. ②를 택하면 "UI State가 리소스 ID를 보유"가 규약이 되므로 [state-management](../architecture/state-management.md)에도 한 줄 필요.
- **상태**: 미해결 (문서/코드 정합 — 미구현 화면 S-002가 이 결정에 종속)
- **해소 메모**: 결정 후 ADR-0016 as-built 표를 정리하고 [s002-account-info 스펙](../specs/2026-07-22-s002-account-info.md)·[s102 스펙](../specs/archive/2026-07-22-s102-group-nickname.md)·[a005 스펙](../specs/archive/2026-07-29-a005-group-create.md)의 매핑 서술을 맞춘다.

### [2026-07-29] A-005 그룹 생성 화면 진입 경로 부재
- **출처**: `feature/groups/enter/api/NavKeyGroupCreate.kt`·`feature/groups/enter/impl/navigation/EntryBuilder.kt#featureGroupCreateEntryBuilder`(PR #179 develop 머지) — entry·DI는 등록됐으나 `NavKeyGroupCreate`로 `goTo` 하는 호출자가 코드 전체에 없다. 직전 단계 후보인 `GroupNickNameRoute`의 `NavigateToNext`는 여전히 stub이고, A-005는 `nickName` 인자를 요구한다.
- **항목**: ① 그룹 참여(S-102)와 그룹 생성(A-005)의 진입 관계를 확정할지(기획상 참여 플로우 다음이 맞는지), ② 확정 시 `GroupNickNameRoute`에서 `navigator.goTo(NavKeyGroupCreate(nickName))` 결선.
- **상태**: 미해결 (코드 수정 대상 — 현재 도달 불가 화면)
- **해소 메모**: 결선 후 [a005 스펙](../specs/archive/2026-07-29-a005-group-create.md)·[s102 스펙](../specs/archive/2026-07-22-s102-group-nickname.md)의 "다음 네비게이션 미구현" 항목을 함께 정리. 위키 [[기능정의서-v6]] 화면 흐름과 대조 필요.

### [2026-07-29] `GroupCreateConfig`가 표시 관심사를 domain에 보유
- **출처**: `domain/model/GroupCreateConfig.kt`(PR #179 develop 머지) — 이름 길이 상한(정책값)과 함께 `GROUP_COLUMN_COUNT`(인원 선택 그리드 열 수)를 같은 객체에 둔다. 열 수는 화면 레이아웃 값이라 `domain`이 UI 결정을 들고 있는 형태다. `GROUP_COUNT_LIST`(1~12)는 정책값이라 domain이 맞다.
- **항목**: ① `GROUP_COLUMN_COUNT`를 화면(`GroupCreateScreen`)이나 `core:ui`로 내릴지, ② 객체명 `GroupCreateConfig`가 닉네임 상한(S-102·S-002 공용)까지 담는 게 맞는지 — 이름이 그룹 생성 전용처럼 읽힌다.
- **상태**: 미해결 (코드 수정 대상)
- **해소 메모**: 정리 시 [module-structure](../architecture/module-structure.md) domain 순수성 규칙과 정합 확인. 상한 상수의 단일 소유 자체는 유지(중복 정의 회귀 방지).

### [2026-07-29] `core:ui` 공용 UI 컴포넌트의 프리뷰·규약 범위 미정
- **출처**: `core/ui/VerticalGridLayout.kt`(PR #179 develop 머지) — 프리뷰가 `@Preview` + **public** 함수 + `Random` 색이고, `core:designsystem`의 `@YGPreview`+`PreviewBox`(private) 규약을 따르지 않는다. `core:ui`는 그동안 MVI 베이스만 있어 규약 대상이 아니었으나 공용 Compose 레이아웃이 들어오면서 경계가 모호해졌다.
- **항목**: ① 공용 UI 컴포넌트를 `core:ui`에 둘지 `core:designsystem`으로 옮길지, ② `core:ui`에도 프리뷰 규약(`@YGPreview`+`PreviewBox`, 프리뷰 함수 private)을 적용할지 — `core:ui`가 `core:designsystem`에 의존하는지부터 확인 필요.
- **상태**: 미해결
- **해소 메모**: 방침 확정 시 [module-structure](../architecture/module-structure.md) `core:ui` 행과 [design-system](../architecture/design-system.md) 프리뷰 규약 범위를 함께 갱신. [2026-07-23 프리뷰 관용구 부분 회귀](#2026-07-23-프리뷰-관용구-부분-회귀--신규-컴포넌트가-ygpreview-표준-이탈)와 함께 관리.

### [2026-07-30] 도메인 모델 `VO` 접미사 규약이 기존 명명과 갈림
- **출처**: `domain/model/TempVO.kt`·`data/source/temp/mapper/VOMapper.kt`·`data/source/temp/remote/TempRemoteDataSource.kt`(`feature/network-set-up`, develop 미머지) — 원격 예시 세트가 도메인 모델을 `TempVO`로, 매퍼 파일을 `VOMapper.kt`로 명명한다. 기존 `domain.model`은 전부 무접미사(`SegmentationResult`·`GalleryImageGroup`·`InviteCodeResult`·`NameValidResult`·`DayWindow`)라 같은 패키지 안에서 규약이 둘이 된다.
- **항목**: ① 원격 유래 모델만 `…VO`를 쓸지(=출처를 이름에 남길지), ② 전부 무접미사로 통일할지, ③ 통일한다면 매퍼 파일명(`VOMapper.kt`)도 `<도메인>Mapper.kt` 등으로 맞출지.
- **상태**: 미해결 (예시 세트 `temp`가 placeholder라 실제 첫 도메인 API 확정 전에 정하면 개명 비용 없음)
- **해소 메모**: 결정 후 [ADR-0017](../adr/0017-remote-network-datasource.md) "응답 → 도메인 매핑 위치" 조항과 [data-layer](../architecture/data-layer.md) "레이어 배치"·"응답 매핑", [data-network-setup 스펙](../specs/2026-07-26-data-network-setup.md)의 심볼명을 함께 맞춘다.

### [2026-07-30] 원격 DataSource가 도메인 모델을 직접 반환 — Repository 매핑 여지 없음
- **출처**: `data/source/temp/remote/TempRemoteDataSource.kt`(`Result<TempVO>` 반환)·`data/source/temp/mapper/VOMapper.kt`(`feature/network-set-up`, develop 미머지) — [ADR-0017](../adr/0017-remote-network-datasource.md)이 data 전용 중간 모델을 기각하면서 변환이 DataSource 경계 1회로 고정됐다. `:data`→`:domain` 의존이라 레이어 역전은 아니나([ADR-0001](../adr/0001-layered-multi-module.md)), 로컬(DataStore·파일) DataSource들은 아직 이 규약의 적용 대상인지 명시되지 않았다.
- **항목**: ① 로컬 DataSource(`RecentImageLocalDataSource`·`FileRecentImageLocalDataSource` 등)도 "DataSource는 도메인 모델 반환" 규약에 편입할지, 아니면 원격에만 적용할지. ② 원격+로컬을 합성하는 Repository가 생길 때 변환 책임이 어디로 가는지(현재는 변환할 것이 남지 않음).
- **상태**: 미해결 (실제 도메인 API 연동 전까지 영향 없음 — 예시 세트만 존재)
- **해소 메모**: 확정 시 [data-layer](../architecture/data-layer.md) "신규 데이터 추가 체크리스트"에 DataSource 반환 타입 규칙으로 한 줄 고정.

### [2026-07-30] 사진 업로드 경로의 타임아웃 정책 미정
- **출처**: `data/di/NetworkModule.kt#provideOkHttpClient`(`feature/network-set-up`, develop 미머지) — 단일 `OkHttpClient`가 connect/read/write 타임아웃을 모든 호출에 공통 적용하고 `callTimeout`은 설정하지 않는다(=전체 소요 무제한). 코드리뷰에서 30초가 과하다는 지적을 받아 값을 낮췄으나, 토핑 사진 업로드(누끼 PNG) API는 아직 없어 실제 전송·서버 처리 시간을 모른 채 정한 값이다. OkHttp의 read/write는 전체 전송 시간이 아니라 바이트 간 유휴 상한이라, 업로드가 느린 것 자체는 이 값으로 잡히지 않는다.
- **항목**: ① 업로드 API 확정 후 전체 소요 상한(`callTimeout`)을 둘지 — 두면 스피너·취소 UX와 값이 묶인다. ② 업로드 전용 `OkHttpClient`(`@Qualifier`)를 분리해 read/write만 늘릴지, 아니면 단일 클라이언트 값을 상향할지. ③ 실패 시 재시도(멱등성 확인 필요)를 어디에 둘지 — 인터셉터 vs 호출부.
- **상태**: 미해결 (업로드 API 미구현 — 값 확정에 필요한 실측 데이터 없음)
- **해소 메모**: 업로드 엔드포인트 붙일 때 실측 후 결정하고 [ADR-0017](../adr/0017-remote-network-datasource.md) "로깅"·타임아웃 서술과 [data-layer](../architecture/data-layer.md) 네트워킹 섹션에 반영. 파르페 규율상 문서에 수치는 적지 않고 구조(클라이언트 분리 여부·callTimeout 유무)만 기록한다.

### [2026-07-30] Figma가 아이콘 tint 색을 노출하지 않아 대조 불가 — Button-Icon·Action-Item
- **출처**: `component/ygiconbutton/YGIconButton.kt#YGIconButton`·`component/ygactionitem/YGActionItem.kt#YGActionItem` — [버튼 영역 sync 스펙](../specs/2026-07-30-designsystem-button-component-sync.md) 대조 중 발견. Figma `Button-Icon`·`Action-Item`의 아이콘이 색을 포함한 래스터 에셋으로 내보내져 `get_design_context` 응답에 tint 값이 없다. 컨테이너·아이콘 프레임 크기는 대조됐으나 색 3상태(`YGIconButton`: 기본/pressed/disabled)는 코드 현행값을 근거 없이 유지한 상태다.
- **항목**: ① `YGIconButton` tint 3상태가 디자인 의도와 맞는지 디자이너 확인, ② `YGActionItem` 신설 아이콘의 tint를 텍스트 색과 함께 움직이게 한 이번 결정(pressed 시 함께 진해짐)이 맞는지 확인, ③ 디자인 쪽에서 아이콘을 벡터+변수 바인딩으로 바꿀 수 있는지(이후 sync 라운드의 대조 가능성 문제).
- **상태**: 미해결 (디자이너 확인 필요 — 코드는 현행 유지)
- **해소 메모**: 확인 후 값이 다르면 해당 컴포넌트 색 매핑을 고치고 위 스펙의 "일치 확인" 표를 갱신한다.

### [2026-07-30] Button-Medium Transparency pressed 배경이 디자인 변수에 미바인딩
- **출처**: `component/ygbutton/YGButtonType.kt#YGButtonType.Medium.Transparency` — [버튼 영역 sync 스펙](../specs/2026-07-30-designsystem-button-component-sync.md) 드리프트 V4 처리 중 발견. default·disabled는 Figma가 `transparency/white-50` 변수를 쓰지만 pressed만 변수 없는 리터럴 색이다. 코드 쪽도 `YGAtomicColors.Transparency`에 대응 단계가 없어 `Gray.White.copy(alpha = …)`로 유지한다 — 즉 이 한 상태만 원자 팔레트 밖 값이다.
- **항목**: ① 디자인에서 pressed 값을 `transparency/*` 변수로 승격 요청할지, ② 승격 시 `YGAtomicColors.Transparency`에 대응 단계를 추가하고 `copy(alpha = …)` 리터럴을 걷어낼지.
- **상태**: 미해결 (디자인 토큰 쪽 선행 필요)
- **해소 메모**: 토큰 확정 시 `YGAtomicColors.Transparency` 단계 추가 + `Medium.Transparency` 색 매핑 교체, [design-system](../architecture/design-system.md) 토큰 계층 표 갱신.

<!--
항목 추가 형식:

### [YYYY-MM-DD] [주제 요약]
- **출처**: `경로/파일` — 근거 (라인번호·변동수치 금지, 파일명+심볼명)
- **항목**: 결정해야 할 것
- **상태**: 미해결 | 해소됨 | 보류
- **해소 메모**: 해소 시 어느 ADR/architecture에 반영했는지
-->
