---
id: open-questions
title: Open Questions — 구현 미결·열린 결정
category: meta
status: living
platforms: android
verified: 2026-08-02
related_spec: designsystem-text-component-sync, a005-group-create, s002-account-info, data-network-setup, designsystem-grouptag-topping-components, designsystem-button-component-sync, designsystem-button-missing-components, designsystem-canvas-components, g001-group-list, c101-camera-picture-confirm, parfait-api-contract-docs
related_adr: ADR-0010, ADR-0011, ADR-0012, ADR-0013, ADR-0014, ADR-0016, ADR-0017, ADR-0018
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
- **상태**: 해소됨 (**PR #183 develop 머지, 2026-08-01** — 컴포넌트 삭제로 ①~③ 대상 코드가 사라짐)
- **해소 메모**: [미구현 컴포넌트 스펙](../specs/archive/2026-07-30-designsystem-button-missing-components.md)이 대응 Figma 원본 없음·실화면 미사용을 근거로 삭제를 정했고(대체물 `YGEditButton` 신설), `component/ygtogglebutton/` 2파일 + `:app-preview` 잔재 4곳이 #183로 develop에서 제거됐다. [design-system](../architecture/design-system.md) 인벤토리·원자색 목록·pressed 관용구 예외에서도 걷어냈다. 단 "Colors 분리 조건" 자체는 [2026-07-30 신규 버튼군 항목](#2026-07-30-신규-버튼군이-colors-data-class를-분리하지-않음--규약-적용-조건-미정)으로 이어진다.

### [2026-07-18] YGColorChip 패키지↔폴더 불일치
- **출처**: `component/ygcolorchip/` — `YGColorChip.kt`·`YGColorChipPreviewData.kt`는 `package …component.ygchip` 선언, `YGColorChipType.kt`만 `package …component.ygcolorchip`. 폴더는 `ygcolorchip/`인데 패키지가 둘로 갈림.
- **항목**: 패키지를 폴더명(`ygcolorchip`)으로 통일할지(권장), 폴더를 패키지명(`ygchip`)에 맞출지.
- **상태**: 해소됨 (**PR #165 develop 머지, 2026-07-31** — 권장안대로 폴더명 `ygcolorchip`으로 통일)
- **해소 메모**: #165(개명 `YGColorChip`→`YGNametagChip` + `YGUserChip`·`YGChipColorIndicator` 신설)에서 패키지 선언이 전 파일 `…component.ygcolorchip`으로 정리됨. [design-system](../architecture/design-system.md) 인벤토리·과도기 마커에서 "패키지 불일치" 제거함. [2026-07-12 컨벤션 분기](#2026-07-12-디자인시스템-컴포넌트-컨벤션-분기) ①(컴포넌트별 vs 그룹 폴더 혼재)은 별개로 잔존.

### [2026-07-18] 네임태그 컬러칩 타입 개수 — 코드 14종 vs 정책 12종
- **출처**: `component/ygcolorchip/YGColorChipType.kt` — `NametagChip1`~`NametagChip13` + `NametagChipPlus` = **14종**(숫자 13 + Plus). 위키 정책 [[nametag-chip]]([[S-101-프로필-닉네임-컬러-규칙-v0.3]])은 **Nametag-Chip 12종**으로 기술. **#165(2026-07-31 머지)에서 `NametagChipPlus`의 용도가 코드 주석으로 확정**됐다(멤버 5명 이상일 때의 "+" 칩 = 색 타입이 아니라 접기 표시) — 즉 정책 대응 색 타입은 13종이고 정책은 12종이라 **숫자 타입 1종 초과가 실질 쟁점**으로 좁혀졌다.
- **항목**: ① 실제 색 매핑이 12종인지 13종인지 확정(`Plus`는 집계 표시용으로 제외), ② 코드↔정책 중 어느 쪽이 SoT인지(원칙: 코드>정책, 단 색 규칙은 디자인 정책 소관). 위키 정책 재확인 필요.
- **상태**: 미해결 (코드/정책 정합 — #165는 개명만 하고 타입 목록은 손대지 않음)
- **해소 메모**: 정책 확정 시 위키 [[nametag-chip]]·[[S-101-프로필-닉네임-컬러-규칙-v0.3]] 갱신, 코드 타입 개수 정합. parfait [ygcolorchip 스펙](../specs/archive/2026-07-18-ygcolorchip.md)의 타입 표 반영.

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
- **출처**: `component/ygalert/YGAlert.kt`·`component/ygtoast/YGToast.kt`(PR #149 develop 머지)·`component/ygcolorchip/YGUserChip.kt`(PR #165 develop 머지, 2026-07-31) — 프리뷰가 `@Preview` + `YGCustomTheme`. `component/ygtext/YGDate.kt`는 `@YGPreview`이나 `PreviewBox` 대신 `YGCustomTheme` 직접 래핑. #158로 "전 컴포넌트 `@YGPreview`+`PreviewBox` 통일"([2026-07-12 컨벤션 분기](#2026-07-12-디자인시스템-컴포넌트-컨벤션-분기) ② 해소)한 뒤 신규 컴포넌트에서 표준이 다시 갈라짐. 같은 #165의 `YGChipColorIndicator`·`YGNametagChip`은 표준을 따르므로 **같은 PR 안에서도 갈린다**.
- **항목**: 신규 컴포넌트 프리뷰를 `@YGPreview`+`PreviewBox`로 정렬할지(권장), 프리뷰 표준을 강제할 방법(리뷰 체크리스트·lint)이 필요한지.
- **상태**: 미해결 (코드 수정 대상)
- **해소 메모**: 정렬 시 [design-system](../architecture/design-system.md) "프리뷰 방식" 마커를 "통일"로 되돌리고 이 항목 해소. [2026-07-12 컨벤션 분기](#2026-07-12-디자인시스템-컴포넌트-컨벤션-분기) ②와 함께 관리.

### [2026-07-26] 문자열 리소스화 부분 적용 — 잔존 하드코딩·domain 표시문자열
- **출처**: PR #166(`feature/intro/impl`·`feature/groups/enter/impl` `strings.xml` 신설)로 TermAgree·GroupNickName·GroupInviteCode 화면 정적 라벨은 리소스화됐으나, ① `feature/intro/impl`의 `TermContent.kt#TERM_CONTENT_LIST` 약관 항목 title이 코틀린 리터럴로 잔존, ② `domain`의 `InviteCodeResult`가 `errorMessage: String?`로 **표시 문자열을 도메인이 보유** — [ADR-0016](../adr/0016-domain-result-presentation-string-mapping.md)이 `NicknameResult`에서 걷어낸 패턴과 동일, ③ `feature/groups/canvas/impl`의 `CanvasImageAddScreen` 등 미착수 화면은 리터럴 그대로.
- **항목**: ① 정적 라벨 = `strings.xml` 관용구를 전 feature 모듈 규약으로 문서화할지(현재는 각 plan에만 기술, architecture 미기재), ② `InviteCodeResult`를 sealed + `core:ui` 매핑(ADR-0016 패턴)으로 정렬할지, ③ 약관 항목 title 리소스화 여부(랜딩 URL TODO와 함께 처리 후보).
- **상태**: 부분 해소 (① 규약 문서화 — **2026-07-29 [module-structure](../architecture/module-structure.md) "규칙"에 한 줄 추가로 해소**. ②`InviteCodeResult`·③ 약관 title 리터럴·미착수 화면 리터럴은 잔존.)
  > ✅ **카메라·갤러리는 규약을 따름(2026-08-01, PR #182)** — `feature/camera/impl`·`feature/gallery/impl`에 `strings.xml`이 신설되고 권한·확인 화면 라벨이 전부 `stringResource`로 갔다. **예외 1건**: `CustomGalleryPickerScreen`의 빈 상태 문구가 코틀린 리터럴로 남았다(같은 화면의 다른 문구는 리소스) → 아래 [갤러리 빈 상태 항목](#2026-08-01-갤러리-빈-상태-그래픽이-상시-노출되고-문구가-리터럴)에서 함께 추적.
  > 📌 **신규 화면이 규약을 안 따름(2026-08-01, PR #173)** — G-001 `GroupListScreen`·`GroupListAddGroupScreen`의 라벨 3종("그룹 추가하기"·"그룹 만들기"·"그룹 들어가기")이 코틀린 리터럴이고, 코드 주석은 `Todo : core:ui 에 string resource 로 분리`라고 적는다. 화면 전용 정적 라벨은 **feature `strings.xml`**이 규약(공유 문구만 `core:ui`)이라 주석의 목적지부터 규약과 어긋난다. 규약이 문서에만 있고 코드 리뷰에서 안 걸린다는 신호다.
- **해소 메모**: ① 화면 전용 라벨=feature `strings.xml` / 공유 문구=`core:ui` `strings.xml` / domain 문자열 미보유 규약을 module-structure에 명시(#179가 `NickNameResult`의 domain 문자열을 걷어내 선례 확정). ②는 `CheckInviteCodeValidUseCase` 실검증 구현(현재 stub, G-002 후속) 시점에 함께 정리 — `InviteCodeResult`는 아직 `errorMessage: String?` 그대로다. ③은 [intro-term-agree 스펙](../specs/archive/2026-07-22-intro-term-agree.md)의 랜딩 URL TODO와 묶어 처리.

### [2026-07-27] Toast·Alert 호스트 노출 애니메이션이 동작하지 않음
- **출처**: `component/ygtoast/YGToastPolicy.kt#YGToastHost`·`component/ygalert/YGAlertPolicy.kt#YGAlertHost` — `AnimatedVisibility`가 `visible = true`인 상태로 최초 컴포즈돼 입장 transition이 돌지 않고(`updateTransition`의 `currentState == targetState`), 퇴장은 `setVisible(false)` 직후 같은 프레임에 목록에서 제거된다(Alert은 `clearAlert()`로 즉시 해체). 결과적으로 `YGToastItem.visible`·`YGAlertItem.visible`·`setVisible()`·양쪽 `exit =` 인자가 모두 死코드. [텍스트 영역 sync 스펙](../specs/archive/2026-07-27-designsystem-text-component-sync.md)의 갤러리 화면이 두 호스트를 처음 실행시키면서 최종 리뷰에서 드러남.
- **항목**: ① 입장은 `MutableTransitionState(false).apply { targetState = true }`로, 퇴장은 제거 전 `delay(ANIMATION_DURATION)`로 살릴지, ② 아니면 애니메이션 의도를 접고 `visible`·`setVisible`·`exit` 死코드를 걷어낼지.
- **상태**: 미해결
  > 📌 **실사용처 생김(2026-08-01, PR #182)** — C-101 카메라 진입 시 촬영 가이드 토스트가 `rememberYGToastPolicy()`+`YGToastHost`로 뜬다(갤러리 showcase 밖 첫 실사용). 즉 이 결함이 이제 사용자 화면에서 재현된다.
- **해소 메모**: 위키 [[Toast-공통-정책]]은 노출 방식만 규정하고 애니메이션은 규정하지 않는다 — 디자인 의도 확인 후 ①/② 택일. 처리 시 sync 스펙의 "일치 확인" 정정 노트도 갱신.

### [2026-07-27] YGToastHost 다중 스택이 겹쳐 그려짐
- **출처**: `component/ygtoast/YGToastPolicy.kt#YGToastHost` — 컨테이너가 `Box`라 동시 노출된 토스트가 같은 원점에 겹쳐 그려진다. `Black75` 배경이 중첩돼 어두워지고 텍스트가 포개진다. `YGToastPolicy.show`가 `add(0, …)`로 앞에 넣으므로 최신 토스트가 오히려 아래 깔린다. 위키 [[Toast-공통-정책]]의 "나중 것을 이전 것 위에 노출(쌓임)"과 어긋난다.
- **항목**: `Box` → `Column(verticalArrangement = Arrangement.spacedBy(...))`로 바꿀지(1줄), 바꾼다면 최신 것이 위로 오도록 삽입 순서(`add(0, …)`)와 배치 방향이 맞는지 함께 확인.
- **상태**: 미해결
- **해소 메모**: 위 애니메이션 항목과 같은 파일이라 한 라운드에서 함께 처리하는 편이 낫다. 처리 시 sync 스펙 정정 노트 갱신.

### [2026-07-27] YGChipButton 세로 패딩 Figma 불일치
- **출처**: `component/ygchipbutton/YGChipButton.kt#YGChipButton` — 상/하 패딩이 `padding.padding3`. Figma `Button-Chip-Right`/`Button-Chip-Left` 변형은 세로 `padding-2`로, 칩 높이가 코드 39 vs 디자인 29로 어긋난다. [텍스트 영역 sync 스펙](../specs/archive/2026-07-27-designsystem-text-component-sync.md) 대조 중 `YGAlert` 칩에서 발견.
- **항목**: ① 세로 패딩을 `padding2`로 내릴지, ② 내릴 경우 `YGAlert`·`YGTopBar` 등 공통 사용처의 높이 변화를 함께 검수할지.
- **상태**: 해소됨 (**PR #183 develop 머지, 2026-08-01** — 세로 패딩 `padding2` 반영)
- **해소 메모**: [버튼 영역 sync 스펙](../specs/archive/2026-07-30-designsystem-button-component-sync.md) 드리프트 V2로 처리. `padding2`로 내리고 `YGAlert`·`YGTopBar` 높이 변화를 실기기 갤러리에서 확인했다. [design-system](../architecture/design-system.md) `YGChipButton` 노트에 반영.

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
  > 📌 **진입점 UI는 생겼고 결선만 남음(2026-08-01, PR #173)** — G-001 그룹 추가 오버레이의 "그룹 만들기"가 `GroupListSideEffect.NavigateToCreateGroup`을 발신하지만 Route 소비부가 `// Todo : navigator.goTo(NavKeyGroupCreate)` 주석이다. 같은 오버레이의 "그룹 들어가기"는 `NavKeyGroupInviteCode`로 실제 결선됐다. 남은 것은 `goTo` 한 줄과 `nickName` 인자 출처(A-005가 인자 있는 NavKey)다.

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
- **출처**: `domain/model/TempVO.kt`·`data/source/temp/mapper/VOMapper.kt`·`data/source/temp/remote/TempRemoteDataSource.kt`(PR #174 develop 머지, 2026-08-01) — 원격 예시 세트가 도메인 모델을 `TempVO`로, 매퍼 파일을 `VOMapper.kt`로 명명한다. 기존 `domain.model`은 전부 무접미사(`SegmentationResult`·`GalleryImageGroup`·`InviteCodeResult`·`NameValidResult`·`DayWindow`)라 같은 패키지 안에서 규약이 둘이 된다.
- **항목**: ① 원격 유래 모델만 `…VO`를 쓸지(=출처를 이름에 남길지), ② 전부 무접미사로 통일할지, ③ 통일한다면 매퍼 파일명(`VOMapper.kt`)도 `<도메인>Mapper.kt` 등으로 맞출지.
- **상태**: 미해결 (예시 세트 `temp`가 placeholder라 실제 첫 도메인 API 확정 전에 정하면 개명 비용 없음)
- **해소 메모**: 결정 후 [ADR-0017](../adr/0017-remote-network-datasource.md) "응답 → 도메인 매핑 위치" 조항과 [data-layer](../architecture/data-layer.md) "레이어 배치"·"응답 매핑", [data-network-setup 스펙](../specs/archive/2026-07-26-data-network-setup.md)의 심볼명을 함께 맞춘다.

### [2026-07-30] 원격 DataSource가 도메인 모델을 직접 반환 — Repository 매핑 여지 없음
- **출처**: `data/source/temp/remote/TempRemoteDataSource.kt`(`Result<TempVO>` 반환)·`data/source/temp/mapper/VOMapper.kt`(PR #174 develop 머지, 2026-08-01) — [ADR-0017](../adr/0017-remote-network-datasource.md)이 data 전용 중간 모델을 기각하면서 변환이 DataSource 경계 1회로 고정됐다. `:data`→`:domain` 의존이라 레이어 역전은 아니나([ADR-0001](../adr/0001-layered-multi-module.md)), 로컬(DataStore·파일) DataSource들은 아직 이 규약의 적용 대상인지 명시되지 않았다.
- **항목**: ① 로컬 DataSource(`RecentImageLocalDataSource`·`FileRecentImageLocalDataSource` 등)도 "DataSource는 도메인 모델 반환" 규약에 편입할지, 아니면 원격에만 적용할지. ② 원격+로컬을 합성하는 Repository가 생길 때 변환 책임이 어디로 가는지(현재는 변환할 것이 남지 않음).
- **상태**: 미해결 (실제 도메인 API 연동 전까지 영향 없음 — 예시 세트만 존재)
- **해소 메모**: 확정 시 [data-layer](../architecture/data-layer.md) "신규 데이터 추가 체크리스트"에 DataSource 반환 타입 규칙으로 한 줄 고정.

### [2026-07-30] 사진 업로드 경로의 타임아웃 정책 미정
- **출처**: `data/di/NetworkModule.kt#provideOkHttpClient`(PR #174 develop 머지, 2026-08-01) — 단일 `OkHttpClient`가 connect/read/write 타임아웃을 모든 호출에 공통 적용하고 `callTimeout`은 설정하지 않는다(=전체 소요 무제한). 코드리뷰에서 30초가 과하다는 지적을 받아 값을 낮췄으나, 토핑 사진 업로드(누끼 PNG) API는 아직 없어 실제 전송·서버 처리 시간을 모른 채 정한 값이다. OkHttp의 read/write는 전체 전송 시간이 아니라 바이트 간 유휴 상한이라, 업로드가 느린 것 자체는 이 값으로 잡히지 않는다.
- **항목**: ① 업로드 API 확정 후 전체 소요 상한(`callTimeout`)을 둘지 — 두면 스피너·취소 UX와 값이 묶인다. ② 업로드 전용 `OkHttpClient`(`@Qualifier`)를 분리해 read/write만 늘릴지, 아니면 단일 클라이언트 값을 상향할지. ③ 실패 시 재시도(멱등성 확인 필요)를 어디에 둘지 — 인터셉터 vs 호출부.
- **상태**: 미해결 (업로드 API 미구현 — 값 확정에 필요한 실측 데이터 없음)
- **해소 메모**: 업로드 엔드포인트 붙일 때 실측 후 결정하고 [ADR-0017](../adr/0017-remote-network-datasource.md) "로깅"·타임아웃 서술과 [data-layer](../architecture/data-layer.md) 네트워킹 섹션에 반영. 파르페 규율상 문서에 수치는 적지 않고 구조(클라이언트 분리 여부·callTimeout 유무)만 기록한다.

### [2026-07-30] Figma가 아이콘 tint 색을 노출하지 않아 대조 불가 — Button-Icon·Action-Item
- **출처**: `component/ygiconbutton/YGIconButton.kt#YGIconButton`·`component/ygactionitem/YGActionItem.kt#YGActionItem` — [버튼 영역 sync 스펙](../specs/archive/2026-07-30-designsystem-button-component-sync.md) 대조 중 발견. Figma `Button-Icon`·`Action-Item`의 아이콘이 색을 포함한 래스터 에셋으로 내보내져 `get_design_context` 응답에 tint 값이 없다. 컨테이너·아이콘 프레임 크기는 대조됐으나 색 3상태(`YGIconButton`: 기본/pressed/disabled)는 코드 현행값을 근거 없이 유지한 상태다.
- **항목**: ① `YGIconButton` tint 3상태가 디자인 의도와 맞는지 디자이너 확인, ② `YGActionItem` 신설 아이콘의 tint를 텍스트 색과 함께 움직이게 한 이번 결정(pressed 시 함께 진해짐)이 맞는지 확인, ③ 디자인 쪽에서 아이콘을 벡터+변수 바인딩으로 바꿀 수 있는지(이후 sync 라운드의 대조 가능성 문제).
- **상태**: 미해결 (디자이너 확인 필요 — **관련 코드는 PR #183로 develop 머지, 2026-08-01**. 값은 현행 유지)
- **해소 메모**: 확인 후 값이 다르면 해당 컴포넌트 색 매핑을 고치고 위 스펙의 "일치 확인" 표를 갱신한다.
  > 📌 **미확인 잔존(2026-07-30)** — Figma `Button-Edit-Action`은 `Disabled`에서만 다른 아이콘 에셋을 쓴다(= 아이콘 색이 다를 가능성). 색을 읽을 수 없어 `YGEditActionButton`은 3상태 모두 `Gray.White` 고정으로 구현했다. 배경만 상태별로 바뀐다.
  > ⚠️ **실제 결함으로 드러남(2026-07-30)** — 신설 `YGCircleButton`을 "리소스 색 그대로" 방침으로 만들었더니 `Type=Secondary`(어두운 원)에서 아이콘이 배경에 묻혔다. 저장소 아이콘 드로어블이 **전부 `#000000`**이기 때문이다. Figma 스크린샷으로 Secondary 아이콘이 흰색임을 확인해 `YGCircleButtonType.iconTint`를 신설했다(머지 코드 기준 `Default`·`Small` = `Gray.Gray850`, `Secondary` = `Gray.White`). 즉 **어두운 배경 변형에는 tint 지정이 필수**다. `Default`·`Small`의 정확한 톤은 여전히 미확인(팔레트 값으로 근사).

### [2026-07-30] Button-Medium Transparency pressed 배경이 디자인 변수에 미바인딩
- **출처**: `component/ygbutton/YGButtonType.kt#YGButtonType.Medium.Transparency` — [버튼 영역 sync 스펙](../specs/archive/2026-07-30-designsystem-button-component-sync.md) 드리프트 V4 처리 중 발견. default·disabled는 Figma가 `transparency/white-50` 변수를 쓰지만 pressed만 변수 없는 리터럴 색이다. 코드 쪽도 `YGAtomicColors.Transparency`에 대응 단계가 없어 `Gray.White.copy(alpha = …)`로 유지한다 — 즉 이 한 상태만 원자 팔레트 밖 값이다.
- **항목**: ① 디자인에서 pressed 값을 `transparency/*` 변수로 승격 요청할지, ② 승격 시 `YGAtomicColors.Transparency`에 대응 단계를 추가하고 `copy(alpha = …)` 리터럴을 걷어낼지.
- **상태**: 미해결 (디자인 토큰 쪽 선행 필요 — 대상 코드는 PR #183로 develop 머지, 2026-08-01)
- **해소 메모**: 토큰 확정 시 `YGAtomicColors.Transparency` 단계 추가 + `Medium.Transparency` 색 매핑 교체, [design-system](../architecture/design-system.md) 토큰 계층 표 갱신.

### [2026-07-30] 카메라 컨트롤 임시 구현체 잔존 — 셔터 구현이 두 곳에 공존
- **출처**: `feature/camera/impl` `component/controls/ShutterButton.kt`·`FlipCameraButton.kt`·`component/CameraControlComponent.kt` vs 신설 예정 `core/designsystem` `component/ygcamerashutter/YGCameraShutter.kt`([미구현 컴포넌트 스펙](../specs/archive/2026-07-30-designsystem-button-missing-components.md)) — feature 쪽 셔터는 디자인 정본보다 큰 고정 크기 + `Color.Gray` 리터럴 테두리 + pressed 없음, flip 버튼은 이모지 문자 + `Color` 리터럴 배경, 취소는 맨 Material3 `TextButton`이다. 컴포넌트 스펙은 Figma 정본이 있는 `Camera-Shutter`만 designsystem에 만들고 화면 치환은 하지 않기로 정했다(작업자 결정) — 즉 셔터가 두 구현으로 공존한다.
- **항목**: ① 카메라 화면(C-101) 라운드에서 `ShutterButton`을 `YGCameraShutter`로 치환하고 feature 쪽을 지울지, ② flip 버튼이 Figma `Button-Circle` `Type=Small`(`ic_rotate`)에 대응하는지 화면 노드로 확인할지 — 컴포넌트 시트만으로는 단정할 수 없다, ③ 취소·줌 컨트롤의 Figma 대응을 찾을지.
- **상태**: 해소됨 (**PR #182 develop 머지, 2026-08-01** — ①②는 치환으로 닫힘, ③ 줌은 컨트롤 자체가 화면에서 빠져 [2026-08-01 줌 死코드 항목](#2026-08-01-카메라-줌-ui가-死코드로-남음)으로 넘어갔다)
- **해소 메모**: `component/controls/ShutterButton.kt`·`FlipCameraButton.kt`가 삭제되고 `CameraControlComponent`가 `YGCameraShutter` + `YGCircleButton`(플래시·전환) 조합으로 바뀌었다. 취소는 맨 `TextButton` 대신 상단 `YGCircleButton`(`ic_close`)이다. flip 아이콘은 `ic_reverse`·`YGCircleButtonType.Default`로 구현했다(Figma `Type=Small` 여부는 대조하지 않았고, 화면이 정본이 된 상태). [design-system](../architecture/design-system.md) 인벤토리에 화면 적용 줄 추가, 상세는 [c101 스펙](../specs/archive/2026-08-01-c101-camera-picture-confirm.md).

### [2026-07-30] Button-Edit-Action이 정수 토큰 재조립으로 2dp 커짐 + Small 테두리 소수 잔존
- **출처**: [미구현 컴포넌트 스펙](../specs/archive/2026-07-30-designsystem-button-missing-components.md) "치수 도출 원칙" — Figma `Button-Edit-Action`은 아이콘 프레임이 22이고 `SizeTokens`에 대응 스케일이 없다. 스펙은 `Size22`를 만들지 않고 `Size24`로 옮기기로 정했고, 그 결과 내부 원과 바깥 프레임이 각각 2dp 커진다. 또 `Button-Circle` `Type=Small`의 테두리는 재조회 후에도 소수(0.636)로 남아 1dp로 정규화한다.
  > ✅ **부분 해소(2026-07-30 재조회)** — `Button-Circle` `Type=Small`이 Figma에서 **정수 치수로 정리**됐다(내부 원 28 명시·아이콘 18·글리프 12·바깥 폭 44 명시, 구조도 "패딩 도출"에서 "지름 고정 + 중앙 아이콘"으로 바뀜). `SizeTokens.Size18` 추가를 합의해 Circle 3변형의 치수 오차는 없어졌다. 남은 것은 Edit-Action 2dp와 Small 테두리 두께다.
- **항목**: ① Edit-Action의 2dp 차이를 디자이너가 수용하는지, 아니면 Figma를 정수 치수(아이콘 24 또는 원 40)로 정리해줄 수 있는지, ② 수용도 정리도 안 되면 `Size22`를 스케일에 넣을지 해당 컴포넌트만 리터럴 dp를 허용할지, ③ Small 테두리 0.636을 1로 정리해줄 수 있는지.
- **상태**: 미해결 (의도된 절충 — 구현 완료, 정수 토큰으로 반영. PR #183 develop 머지, 2026-08-01)
- **해소 메모**: `YGEditActionButton`이 내부 `padding3` + 아이콘 `SizeTokens.Size24`, 바깥 `padding1` 래핑으로 구현됐다(2026-07-30). 확인 후 값이 바뀌면 해당 컴포넌트 치수와 스펙 "치수 도출 원칙" 표를 함께 고친다.

### [2026-07-30] Camera-Shutter에 바인딩된 Transparency.Black5의 용도 불명
- **출처**: Figma `Camera-Shutter` 노드의 디자인 변수 목록에 `Transparency/Black-5`가 잡히지만, 셔터는 흰 외곽 원 + 어두운 내부 원 두 도형으로만 보인다([미구현 컴포넌트 스펙](../specs/archive/2026-07-30-designsystem-button-missing-components.md)). 두 원은 래스터 에셋으로 내보내져 코드 응답에 색·효과가 드러나지 않는다. 외곽 테두리나 그림자일 가능성이 있다.
- **항목**: ① `Black-5`가 외곽 원 테두리인지 그림자인지 디자이너 확인, ② 그림자라면 Compose에서 `shadow`로 재현할지(현재 designsystem에 그림자 관용구가 없다).
- **상태**: 미해결 (구현 완료 — 두 원만 그렸다. PR #183 develop 머지, 2026-08-01)
- **해소 메모**: `YGCameraShutter`가 흰 외곽 원 + `padding2` + 내부 `Size48` 원 2도형으로 구현됐다(2026-07-30). 확인 후 필요하면 테두리/그림자를 더하고 스펙 상태 표를 갱신.

### [2026-07-30] 신규 버튼군이 Colors data class를 분리하지 않음 — 규약 적용 조건 미정
- **출처**: [미구현 컴포넌트 스펙](../specs/archive/2026-07-30-designsystem-button-missing-components.md) "Colors 분리 판단" — 신설 5종(`YGEditTabButton`·`YGEditButton`·`YGCircleButton`·`YGEditActionButton`·`YGCameraShutter`)은 색 주입 data class를 만들지 않고 변형 타입(`YGCircleButtonType`) 또는 컴포저블 본문에서 상태 분기한다. Figma가 색을 고정하고 주입 사용처가 없다는 판단이다. [design-system](../architecture/design-system.md) 컴포넌트 작성 규약은 `YGButton` 기준으로 "Colors data class 분리"를 적어 두었으므로 이 판단은 규약과 갈린다. 같은 이탈로 등록된 [2026-07-16 YGToggleButton 항목](#2026-07-16-ygtogglebutton-규약-이탈--colors-미분리색-하드결선하드코딩-치수)은 그 컴포넌트 삭제로 없어질 예정이다.
- **항목**: ① 규약을 "색 주입 요구가 있을 때만 Colors를 분리한다"로 다듬을지, ② 아니면 신규 5종도 일괄 분리해 규약을 그대로 지킬지(사용처가 없는 API가 5개 늘어난다).
- **상태**: 미해결 (구현 완료 — 5종 모두 미분리로 반영. PR #183 develop 머지, 2026-08-01)
- **해소 메모**: `YGCircleButton`만 변형 타입(`YGCircleButtonType`)이 색·아이콘 크기·tint·`paintsOuterCircle`을 들고 있고 나머지 4종은 컴포저블 본문 상태 분기다. 방침 확정 시 [design-system](../architecture/design-system.md) "컴포넌트 작성 규약"에 분리 조건을 한 줄로 고정한다.
  > 📌 **함께 정할 것(2026-08-01 머지 코드 확인)** — `YGCircleButtonType`은 `YGButtonType`과 달리 `@get:Composable`이 아니라 `@Immutable` + 평범한 `val`이다(테마 미경유·상수 직접 대입). 변형 타입이 토큰을 노출하는 방식이 두 가지로 갈렸으므로 Colors 분리 조건과 같은 줄에서 "변형 타입은 `@get:Composable`로 테마를 읽는다 / 상수 대입도 허용한다"를 함께 못박아야 한다.

### [2026-07-31] Grouptag-Chip 그레이 타입 타임스탬프 색 — 정책 문서 `White` vs Figma `Gray-200`
- **출처**: [grouptag-topping 스펙](../specs/archive/2026-07-31-designsystem-grouptag-topping-components.md) 타입 매핑 표 — `YGGrouptagChipType.TYPE_7_8`(그레이)의 타임스탬프 색을 Figma 컴포넌트가 `Gray-200`으로 주는데, 정책 문서(S-101에서 분리된 그룹칩 Timestamp 컬러 규칙)의 표는 같은 자리를 `White`로 적는다. 나머지 5종(Cherry-100/200/300·Melon·Pudding)은 양쪽이 일치한다.
- **항목**: 어느 쪽이 정본인지. Figma가 맞으면 정책 문서를 정정해야 하고, 정책이 맞으면 코드와 Figma를 함께 고쳐야 한다.
- **상태**: 미해결 (구현은 Figma를 따라 `Gray.Gray200`으로 반영. PR #186 develop 머지, 2026-08-01)
- **해소 메모**: 정책 SoT는 위키이므로 위키 open-questions에도 같은 항목을 등록해야 한다(디자인 파일 ↔ 정책 문서 불일치라 구현 밖에서 결론이 나야 한다). 위키 등록은 develop 머지 후로 미뤘던 것이고, **#186 머지에 따라 2026-08-01 기준선 점검에서 위키에 등록 완료**했다(`wiki/synthesis/open-questions.md` 항목 + `wiki/concepts/nametag-chip.md` ② 표 ⚠️ 마커).

### [2026-07-31] `YGToppingGroupType`의 `TYPE_3_LEFT`·`TYPE_3_RIGHT`가 완전히 동일
- **출처**: [grouptag-topping 스펙](../specs/archive/2026-07-31-designsystem-grouptag-topping-components.md) 배치 변형 표 — Figma `Topping-Group`의 `Type=3, Direction=Left`와 `Type=3, Direction=Right`가 회전(+8°)·이미지 오프셋·칩 오프셋이 모두 같다. 다른 Left 변형(`Type=1`·`2`)은 전부 음수 회전인데 3번만 Left도 양수다.
- **항목**: 디자인 의도인지 Figma 변형 작성 누락인지. 누락이면 Left 회전각의 부호가 바뀌어야 한다.
- **상태**: 미해결 (Figma 원본대로 구현, 실기기에서 두 변형이 시각적으로 구분되지 않음을 확인. PR #186 develop 머지, 2026-08-01)
- **해소 메모**: 확정 시 `YGToppingGroupType`의 해당 두 엔트리와 코드 주석을 함께 고친다.

### [2026-07-31] `YGChipColorIndicator`의 정책 근거·용도 불명
- **출처**: `component/ygcolorchip/YGChipColorIndicator.kt#YGChipColorIndicator`(PR #165 develop 머지) — `isChecked`로 Cherry ↔ 투명을 분기하는 작은 원. 대응 위키 정책 문서가 없다(위키 Chip-Indicator는 [[캘린더-컴포넌트]] C-201 소관으로 이 컴포넌트와 별개). 사용처도 0건이고 `:app-preview` 갤러리에도 미등록이라, 어느 화면의 어떤 선택 상태를 표시하는지 문서만으로는 확정할 수 없다.
- **항목**: ① 이 인디케이터가 붙는 화면·요소가 무엇인지(프로필 색 선택? 멤버 선택?), ② 그 정책이 위키에 있어야 하는지(있어야 하면 소스 수집 대상), ③ 이름이 `Chip`을 달고 있는데 실제로는 칩 외부에서 쓰이는지.
- **상태**: 미해결 (사용처 붙기 전까지 확인 불가)
- **해소 메모**: 사용 화면 확정 시 [ygcolorchip 스펙](../specs/archive/2026-07-18-ygcolorchip.md)에 유스케이스를 적고, 정책이 필요하면 위키 쪽 소스 수집을 요청한다.

### [2026-07-31] `YGUserChip`·`YGChipColorIndicator`가 갤러리 미등록
- **출처**: `component/ygcolorchip/YGUserChip.kt`·`YGChipColorIndicator.kt`(PR #165 develop 머지) — `:app-preview` 컴포넌트 갤러리(카탈로그 + showcase + `@IntoSet` 배선)에 두 신규 컴포넌트가 등록되지 않았다. `ygcolorchip` 계열은 원래부터 갤러리에 없어(`YGNametagChip`도 미등록) 이번 PR만의 누락은 아니다.
- **항목**: ① 갤러리 등록을 신규 컴포넌트 완료 조건(DoD)으로 규약화할지, ② `ygcolorchip` 계열 3종을 묶어 showcase를 추가할지.
- **상태**: 미해결 (**후속 3개 PR은 전부 등록함** — #183 버튼 5종·#185 캔버스 5종·#186 칩/토핑 2종이 카탈로그·showcase·`@IntoSet`까지 배선됐다. 2026-08-01 기준 갤러리 누락은 `ygcolorchip` 계열 3종뿐)
- **해소 메모**: 규약화하면 [design-system](../architecture/design-system.md) "컴포넌트 작성 규약"에 한 줄 고정하고, 등록 시 갤러리 카탈로그 카테고리를 함께 정한다. 이후 라운드가 이미 관행으로 지키고 있으므로 문서화만 남은 셈이다.

### [2026-07-31] 토핑 템플릿 6종 부여 주체 미정 — 서버 필드 부재
- **출처**: [grouptag-topping 스펙](../specs/archive/2026-07-31-designsystem-grouptag-topping-components.md) "계층 분할" — 제품 정책은 "6종 중 1종 랜덤 최초 부여 → 첫 토핑 등록 전까지 고정, 새로고침·재접속·타 그룹 갱신에도 불변"인데, 클라이언트가 랜덤을 뽑아 로컬에 영속하면 기기 변경에서 깨진다. 디자인시스템은 `YGToppingImage.Template(type)`으로 결정된 값을 주입받기만 한다.
- **항목**: 서버가 그룹 조회 응답에 템플릿 종류 필드를 내려줄지, 아니면 클라이언트가 뽑아 저장할지. 서버가 내려주면 기기 변경·플랫폼 간(iOS) 일관성이 확보된다.
- **상태**: 미해결 (G-001 목록 API 미확정 — 컴포넌트는 PR #186로 develop 머지, 2026-08-01)
- **해소 메모**: 결정 시 [data-layer](../architecture/data-layer.md) DTO와 G-001 화면 스펙에 반영한다.

### [2026-08-01] 캔버스 화면(C-001) 임시 구현체 잔존 — 메뉴 구현이 두 곳에 공존
- **출처**: `feature/groups/canvas/impl`의 `CanvasImageAddScreen`("카메라로 촬영"·"갤러리에서 선택"을 맨 Material3 `Button`+`Text`로 그림) vs 신설 `core/designsystem` `component/ygcanvas/`·`ygcanvasmenu/`·`ygmenuitem/`(PR #185 develop 머지). [캔버스 컴포넌트 스펙](../specs/archive/2026-07-31-designsystem-canvas-components.md)이 화면 치환을 범위 밖으로 두어 셔터([2026-07-30 카메라 항목](#2026-07-30-카메라-컨트롤-임시-구현체-잔존--셔터-구현이-두-곳에-공존))와 같은 공존 상태가 하나 더 생겼다.
- **항목**: ① C-001 화면 라운드에서 임시 버튼을 `YGCanvas`+`YGCanvasMenu`로 치환하고 feature 쪽 임시 컴포저블을 지울지, ② 캔버스 화면이 `YGCanvas`의 직교 플래그를 어떤 UI 상태에 매핑할지(플래그 조합 모순 방지 책임이 호출자에 있다).
- **상태**: 미해결 (의도된 이월 — 컴포넌트 sync 범위 밖)
- **해소 메모**: C-001 화면 스펙에서 처리하고 치환 완료 시 [design-system](../architecture/design-system.md) 인벤토리 서술을 정리한다.

### [2026-08-01] 컷 도형 다리 길이·Empty 배경색의 근거가 Figma 벡터뿐
- **출처**: `shape/CanvasCutCornerShape.kt#canvasCutCornerShape`·`component/ygcanvas/YGCanvas.kt`(PR #185 develop 머지) — ① 좌상단 컷의 다리 길이가 기본값 리터럴이고 근거가 Figma 벡터 path뿐이다. 위키 [[캔버스-반응형-레이아웃]]은 "좌상단이 비스듬히 잘린 컷"만 서술하고 수치가 없어, 디자이너가 값을 바꾸면 추적할 문서 근거가 없다. ② Figma `Status=Empty`의 배경이 회색인데 이것이 "배경 미지정 기본값"인지 "비어 있을 때만 회색"인지 원본에서 갈리지 않는다 — 구현은 전자로 보고 `background` 기본값에 뒀다(Empty여도 지정 배경이 있으면 그대로 그린다).
- **항목**: ① 컷 다리 길이를 정책 문서(위키)나 디자인 토큰에 올릴지, ② Empty 배경의 의미를 디자이너에게 확정받을지.
- **상태**: 미해결 (구현 완료 — Figma 실측대로 반영)
- **해소 메모**: ①이 정해지면 위키 [[캔버스-반응형-레이아웃]] 갱신 요청 후 컷 값을 그 문서 근거로 바꾼다. ②는 C-001 화면 라운드에서 실제 빈 캔버스를 그릴 때 확인.

### [2026-08-01] YGCanvasDateSelectButton의 클릭 영역·접근성 이름이 아이콘에만 걸림
- **출처**: `component/ygcanvasdateselect/YGCanvasDateSelectButton.kt#YGCanvasDateSelectButton`(PR #185 develop 머지) — 바 전체가 컷 배경·테두리를 공유해 하나의 버튼처럼 보이고 이름도 `Button`인데, 실제 클릭 대상은 우측 `YGIconButton`(`SIZE_44`) 하나다. 날짜 텍스트를 눌러도 아무 일도 일어나지 않는다. 같은 아이콘의 `contentDescription`도 `null`이라 유일한 상호작용 요소에 접근성 이름이 없다.
- **항목**: ① 바 전체를 클릭 영역으로 올릴지(이름대로) 아이콘만 유지할지, ② `contentDescription`을 필수 인자로 노출할지 — `YGIconButton`·`YGCircleButton` 선례는 필수다.
- **상태**: 미해결 (구현 라운드에서 **현행 유지로 판정**(2026-07-31), 화면 라운드·접근성 라운드로 이월)
- **해소 메모**: C-201 캘린더/C-001 화면 라운드에서 실제 터치 기대치를 확인한 뒤 정한다. ②는 전원 접근성 라운드와 묶어 처리.

### [2026-08-01] YGCanvas의 Dim 탭 닫기 미규정 + 캘린더 슬롯 미충전
- **출처**: `component/ygcanvas/YGCanvas.kt#YGCanvas`(PR #185 develop 머지) — ① Dim은 소비 전용 `pointerInput`으로 아래 레이어 터치를 막지만 **탭했을 때의 동작이 없다**(`onDimClick` 미노출). `Expanded`·`Calendar`를 Dim 탭으로 닫을지가 규정되지 않았고 Figma도 다루지 않는다. 부작용으로 드래그도 막히는데 스크림으로선 의도된 동작이다. ② `calendarContent` 슬롯을 채울 컴포넌트가 없어 `Status=Calendar`를 실물로 대조하지 못했다 — 패널·`List-Date`·`Chip-Indicator`는 C-201 라운드 몫이다. 같은 이유로 `YGCanvasBackground.Image` 화면의 실제 렌더도 여전히 미검증이다(막고 있던 Coil 네트워크 페처 부재는 #186로 해소).
- **항목**: ① Dim 탭 닫기를 컴포넌트 API로 열지(=`onDimClick`) 화면이 바깥에서 처리할지, ② 캘린더 패널이 붙은 뒤 `Status=Calendar`·`Image` 배경을 재대조할지.
- **상태**: 미해결 (화면 라운드 결정 대기)
- **해소 메모**: C-201 캘린더 라운드에서 슬롯을 채우며 함께 확정하고 [캔버스 컴포넌트 스펙](../specs/archive/2026-07-31-designsystem-canvas-components.md)의 "주의 / 열린 질문"을 정리한다.

### [2026-08-01] G-001 목록 화면이 화면 컨테이너 규약을 벗어남
- **출처**: `feature/groups/list/impl/navigation/EntryBuilder.kt#featureGroupListEntryBuilder`·`route/GroupListRoute.kt`(PR #173 develop 머지) — 엔트리 컨테이너가 `YGScaffold`가 아니라 `Box`(전면 배경 이미지 `group_list_background`)이고 `YGScaffold(containerColor = Gray.Transparent)`는 Route 안으로 내려갔다. 그룹 추가 오버레이는 **두 번째 `YGScaffold`**(`Transparency.Black25`)를 겹쳐 그린다. 화면 최외곽 `YGScreen`도 쓰지 않아 `YGScreenScope.OnBack` 경로가 없다. [navigation-flow](../architecture/navigation-flow.md) 체크리스트 2번·[design-system](../architecture/design-system.md) "화면 컨테이너" 역할 분리와 어긋난다.
- **항목**: ① 전면 배경 이미지가 있는 화면의 관용구를 정할지(`YGScaffold`에 배경 슬롯을 열지 / nav 레벨 `Box` 래핑을 허용할지), ② 오버레이·Dim을 `YGScaffold` 중첩으로 그리는 것이 맞는지(`Dialog`·`Popup`·단일 `Box` 대안), ③ 화면 최외곽 `YGScreen` 사용을 규약으로 강제할지 — 강제하면 이 화면이 위반이고, 안 하면 [2026-07-20 화면 컨테이너 ADR](#2026-07-20-화면-컨테이너ygscreenygscaffold-컨벤션--adr-미작성) 내용이 달라진다.
- **상태**: 미해결 (코드 머지됨 — 규약 쪽 결정 필요)
- **해소 메모**: 결정 시 [navigation-flow](../architecture/navigation-flow.md) 체크리스트와 [design-system](../architecture/design-system.md) "화면 컨테이너"를 함께 고치고, [g001-group-list 스펙](../specs/archive/2026-08-01-g001-group-list.md)의 이탈 표기를 정리한다. [2026-07-20 항목](#2026-07-20-화면-컨테이너ygscreenygscaffold-컨벤션--adr-미작성)의 ADR 내용에 직접 걸린다.

### [2026-08-01] G-001 파르페·툴팁이 위키 정책과 미결선 — 화면 골격만 머지됨
- **출처**: `feature/groups/list/impl/route/GroupListParfaitLayout.kt`·`GroupListScreen.kt`·`GroupListViewModel.kt`·`route/component/GroupListTooltip.kt`(PR #173·#176·#180 develop 머지) — ① `GroupListUiState.groupList`가 `List<String>` placeholder고 렌더에 쓰이지 않아 [[무한-파르페-그리드]]의 지그재그 배치·인셋·y좌표·6타입 변형·활동순 정렬·상대시간이 전부 미구현이다. ② 크림 반복이 정책의 "토핑 0~3 → 3개, 4개부터 1:1" 규칙이 아니라 `content` 높이를 덮을 때까지의 올림 나눗셈이다. ③ 툴팁이 `LaunchedEffect(Unit) { show() }`로 **진입 시 무조건** 뜬다 — [[g-001-empty-툴팁]]의 노출 조건은 "그룹 0건". ④ `GroupListUiState.isTooltipVisible`은 死필드이고 실제 노출은 화면 로컬 `rememberTooltipState`가 쥔다. ⑤ 툴팁 문구·앵커가 코드에 리터럴로 확정됐는데 위키 정책은 문구·앵커를 미정으로 둔다(정책 소스 미수집).
- **항목**: ① 목록 조회 API가 붙는 라운드에서 파르페 좌표 정책을 어디까지 컴포넌트(`YGToppingGroup`)로 흡수할지, ② 크림 개수 규칙을 정책대로 되돌릴지 레이아웃 파생값으로 유지할지, ③ 툴팁 노출 조건을 `groupList.isEmpty()`로 결선하고 상태 소유를 VM/화면 중 어디로 정할지(`isTooltipVisible` 존폐), ④ 툴팁 문구·앵커를 위키 정책으로 역수집할지.
- **상태**: 미해결 (의도된 골격 선행 — 그룹 조회 미구현)
- **해소 메모**: 데이터 결선 라운드에서 [g001-group-list 스펙](../specs/archive/2026-08-01-g001-group-list.md)의 "정책 대조" 표를 갱신한다. ④는 위키 소관이라 정책 소스 수집 요청이 먼저다([[open-questions]]의 툴팁 문구·앵커 미정 항목).

### [2026-08-01] 테마 비의존 그리기 확장의 소유 모듈이 갈림
- **출처**: `core/util/android/extension/Modifier.kt#drawTooltipCornerTop`(PR #176 develop 머지) vs `core:designsystem`의 `border/DashedBorder.kt#dashedBorder`·`shape/CanvasCutCornerShape.kt#canvasCutCornerShape` — 셋 다 테마를 읽지 않고 색·치수를 인자로 받는 순수 그리기 확장인데, 툴팁 꼬리만 `core:util:android`에 있다. 같은 갈림이 clickable 유틸에서 이미 [2026-07-14 항목](#2026-07-14-clickable-유틸이-coreutilandroid로-이동--ripple-색-테마-비의존)으로 등록돼 있다.
- **항목**: ① 그리기 프리미티브의 기본 소유를 `core:designsystem`(`border/`·`shape/`)으로 못박을지, ② `core:util:android`를 "Compose 확장 잡동사니" 자리로 인정하고 기준을 문서화할지 — 후자면 두 모듈의 경계 서술이 필요하다.
- **상태**: 미해결
- **해소 메모**: 결정 시 [module-structure](../architecture/module-structure.md) `core:util:android` 행과 [design-system](../architecture/design-system.md) 과도기 마커를 함께 정리한다. [2026-07-14 항목](#2026-07-14-clickable-유틸이-coreutilandroid로-이동--ripple-색-테마-비의존) ②와 같은 결정에 묶인다.

### [2026-08-01] 화면 PR이 `YGButtonType.radius`를 삭제 — 각짐 토큰 경유 회귀
- **출처**: `component/ygbutton/YGButtonType.kt`·`YGButton.kt`(PR #182 develop 머지, 카메라 화면 PR) — 변형 공통 속성 `radius`가 제거되고 `YGButton`의 `background`·`border` `shape` 인자와 `clip`도 빠졌다. 현재 전 변형이 `radius.none`이라 렌더는 동일하지만, [버튼 sync 스펙](../specs/archive/2026-07-30-designsystem-button-component-sync.md)·[radius-none-sync 스펙](../specs/archive/2026-07-19-designsystem-radius-none-sync.md)이 세운 "각짐도 테마 토큰 경유"가 코드에서 사라졌다. 카메라 화면 작업 PR이 디자인시스템 규약을 되돌린 형태다.
- **항목**: ① `radius` 속성을 되살릴지(변형별 곡률이 다시 생기면 필요), 아니면 "전 변형 각짐"을 확정으로 보고 스펙·[design-system](../architecture/design-system.md) 규약에서 radius 조항을 걷어낼지. ② 화면 PR이 `core:designsystem`을 고칠 때의 게이트(디자인시스템 소유자 리뷰·sync 스펙 대조)가 필요한지 — 같은 PR에서 `YGDate`도 함께 회귀했다.
- **상태**: 미해결 (코드/규약 정합)
- **해소 메모**: ①이 정해지면 두 sync 스펙의 각짐 조항과 design-system "컴포넌트 작성 규약"을 함께 맞춘다. ②는 [2026-08-01 YGDate 항목](#2026-08-01-ygdate의-background가-테두리를-덮음)과 한 결정으로 묶인다.

### [2026-08-01] `YGDate`의 background가 테두리를 덮음
- **출처**: `component/ygtext/YGDate.kt#YGDate`(PR #182 develop 머지) — modifier 체인이 `background(White)` → `border(Gray800)` → **`background(White)`** 순이라, 나중 배경이 앞서 그린 테두리 위에 칠해진다. #149 sync가 확정한 테두리가 화면에서 안 보일 수 있다. 첫 실사용처가 이 PR의 C-101 상단 날짜 라벨이다.
- **항목**: 중복 `background`를 지울지, 아니면 의도가 "테두리 안쪽만 채우기"였다면 `border`를 뒤로 보내거나 `padding`을 사이에 넣을지.
- **상태**: 미해결 (코드 수정 대상 — 실기기 육안 확인 필요)
- **해소 메모**: 고친 뒤 [ygtext-date-label 스펙](../specs/archive/2026-07-18-ygtext-date-label.md) as-built와 [design-system](../architecture/design-system.md) `YGDate` 줄의 ⚠️를 함께 정리한다.

### [2026-08-01] C-101 뷰파인더 상·하 간격이 정책과 어긋남
- **출처**: `feature/camera/impl/.../screen/CustomCameraScreen.kt#CameraContent`(PR #182 develop 머지) — 상단 날짜 행과 뷰파인더 사이가 `Spacer(10.dp)` **리터럴**(코드 주석 "10.dp가 없어서 넣었습니다")이고, 뷰파인더와 컨트롤 사이가 `Spacer(gap3)`다. 위키 [[카메라-뷰파인더]] 정책은 상단 8·하단 10을 고정으로 규정하므로 두 값이 뒤바뀐 셈이다. 좌우 여백(`padding7`)·블러 스펙은 정책과 일치한다.
- **항목**: ① 상·하 간격을 정책값에 맞춰 토큰(`gap3`/`padding4`)으로 교체할지, ② 주석이 말하는 "10.dp가 없다"는 인식(실제로는 `padding4`가 10)을 어디서 바로잡을지 — 토큰 탐색이 안 되는 게 반복 원인이면 규약 쪽 문제다.
- **상태**: 미해결 (코드 수정 대상)
- **해소 메모**: 교체 후 [c101 스펙](../specs/archive/2026-08-01-c101-camera-picture-confirm.md) "정책 대조" 표를 갱신한다.

### [2026-08-01] 카메라 줌 UI가 死코드로 남음
- **출처**: `feature/camera/impl`의 `component/CameraZoomIndicatorComponent.kt`·`component/controls/ZoomLevelRow.kt`(참조 0건) + `CameraControlComponent`(`zoomRatio`·`zoomRange`·`onClickZoomLevel`을 받기만 하고 렌더에 안 씀) + `CustomCameraViewModel`(`OnZoomRangeReady`·`OnClickZoomLevel` 인텐트의 발신처 없음, `zoomRatio`는 `LaunchedEffect`로 카메라에 계속 반영). PR #182가 컨트롤 행을 셔터·플래시·전환 3종으로 재구성하면서 줌 UI만 빠졌다.
- **항목**: ① 줌을 다시 노출할지(Figma 대응 확인 필요 — [2026-07-30 카메라 항목](#2026-07-30-카메라-컨트롤-임시-구현체-잔존--셔터-구현이-두-곳에-공존) ③에서 넘어온 질문), ② 안 쓸 거면 컴포넌트 2개와 상태·인텐트를 걷어낼지.
- **상태**: 미해결 (코드 수정 대상)
- **해소 메모**: 정하면 [c101 스펙](../specs/archive/2026-08-01-c101-camera-picture-confirm.md) 범위 표를 갱신한다.

### [2026-08-01] 카메라·갤러리 권한 요청 경로가 UI에 없음
- **출처**: `feature/camera/impl/.../component/CameraPermissionRequestComponent.kt`·`feature/gallery/impl/.../component/GalleryPermissionRequestComponent.kt`(PR #182 develop 머지) — 두 컴포넌트 모두 `onClickGrantPermission`·`permanentlyDenied`를 파라미터로 받지만 본문에서 쓰지 않고 "설정으로 이동" 버튼 하나만 그린다. Route의 `permissionLauncher`와 VM의 `OnRequestPermission`은 살아 있으나 **발신처가 없어** 시스템 권한 다이얼로그가 뜨는 경로가 없다(갤러리는 부분 접근 배너의 `onClickManageMedia`만 launcher를 탄다).
- **항목**: ① 최초 진입 시 자동 요청 또는 "권한 허용" 버튼을 둘지, ② 최초 거부와 영구 거부 화면을 나눌지(`permanentlyDenied` 분기 부활), ③ 안 쓸 파라미터면 시그니처에서 뺄지.
- **상태**: 미해결 (코드 수정 대상 — 최초 설치 후 카메라 진입 시 권한을 얻을 수 없다)
- **해소 메모**: 결정 후 [c101 스펙](../specs/archive/2026-08-01-c101-camera-picture-confirm.md) "주의/열린 질문"을 정리한다.

### [2026-08-01] 갤러리 빈 상태 그래픽이 상시 노출되고 문구가 리터럴
- **출처**: `feature/gallery/impl/.../screen/CustomGalleryPickerScreen.kt#GalleryContent`(PR #182 develop 머지) — 빈 상태 이미지(`image_gallery_empty`)가 `when(isLoading/isEmpty/else)` 분기 **밖**에 있어 사진 목록이 있어도 함께 그려진다. 로딩 인디케이터는 흰 배경 위 `Color.White`이고, 빈 상태 문구는 `strings.xml`이 아니라 코틀린 리터럴이다(같은 화면의 권한 문구는 리소스화됨 → [2026-07-26 항목](#2026-07-26-문자열-리소스화-부분-적용--잔존-하드코딩domain-표시문자열)).
- **항목**: ① 그래픽을 `isEmpty` 분기 안으로 넣을지(디자인상 상시 노출 의도인지 확인), ② 인디케이터 색을 대비 있는 값으로 바꿀지, ③ 문구를 갤러리 `strings.xml`로 옮길지.
- **상태**: 미해결 (코드 수정 대상)
- **해소 메모**: ①은 Figma 갤러리 화면 대조가 선행. 처리 시 [c101 스펙](../specs/archive/2026-08-01-c101-camera-picture-confirm.md)의 갤러리 항목을 정리한다.

### [2026-08-01] C-101-confirm 이후 경로 미결선 — 확인 화면에서 앞으로 못 감
- **출처**: `feature/camera/impl/.../route/PictureConfirmRoute.kt`(PR #182 develop 머지) — "다음"이 `onClickConfirm = { }`(TODO "c103-로딩페이지로 넘어가야함"), 닫기가 `onClickClose = {}`(TODO "c001-캔버스메인으로 넘어가야함")다. 뒤로(다시 찍기)만 동작한다. [navigation-flow](../architecture/navigation-flow.md) 체크리스트 6번(진입 경로를 같은 PR에)의 반대편 사례 — 나가는 경로가 없다.
- **항목**: ① C-103(누끼 로딩) 진입 NavKey·인자 계약 확정, ② 닫기가 캔버스(C-001)로 가는지 촬영 호출자에게 결과를 돌려주는지(`LocalResultEventBus` 경로가 이미 있다) 확정.
- **상태**: 미해결 (후속 화면 미구현 종속)
- **해소 메모**: 결선 시 [c101 스펙](../specs/archive/2026-08-01-c101-camera-picture-confirm.md)과 세그멘테이션 쪽 문서를 함께 갱신한다.

### [2026-08-01] 블러 구현 관용구가 둘로 갈림 — Haze vs 자체 GraphicsLayer
- **출처**: `feature/camera/impl/.../component/CameraFeedLayer.kt`(PR #182 develop 머지, `rememberGraphicsLayer` 2장 + `BlurEffect`) vs [ADR-0018](../adr/0018-backdrop-blur-haze.md)(Top Bar 배경 블러는 Haze, 자체 `GraphicsLayer` 기각). ADR-0018은 "C-101도 같은 구조이니 그 라운드 시작 시 Haze 재사용을 검토하라"고 남겼는데, 검토 기록 없이 자체 구현으로 머지됐다. 두 경우는 대상이 다르다 — C-101은 **자기 자식(카메라 피드)**을 흐리고, ADR-0018이 실패한 것은 **자기 밖 배경**을 레이어로 옮겨 담는 경로다.
- **항목**: ① 이 구분(자기 콘텐츠 블러=자체 구현 / 배경 블러=Haze)을 규약으로 못박을지, 아니면 C-101도 Haze로 통일할지. ② C-101 블러가 실제로 걸리는지 **극단값 대조**로 확인했는지 — ADR-0018이 "틴트만으로도 흐린 것처럼 보여 미동작이 육안 검증을 통과한다"고 경고한 바로 그 구조다(이 라운드에 검증 기록 없음). ③ API 31 미만 폴백(`isBlurSupported`)이 스크림만 남기는 것으로 충분한지.
- **상태**: 미해결 (①은 규약, ②는 검증 미수행)
- **해소 메모**: ② 확인이 먼저다(반경 극단값으로 대조). 결과에 따라 ①을 [design-system](../architecture/design-system.md)이나 ADR-0018 개정으로 남기고 [c101 스펙](../specs/archive/2026-08-01-c101-camera-picture-confirm.md)의 블러 절을 갱신한다.

### [2026-08-02] 서버 응답 envelope와 Android ApiResponse 불일치
- **출처**: 서버 `parfait.common.response.ApiResponse`([api/conventions.md](../api/conventions.md) "응답 envelope") — `success`·`errorDetail` 필드를 Android `ApiResponse`가 갖고 있지 않다. Android `data/service/model/response/ApiResponse.kt`.
- **항목**: Android `ApiResponse`에 `success`·`errorDetail` 필드를 추가할지, 추가 시 파싱·기본값 처리를 어떻게 할지.
- **상태**: 미해결 (코드 수정 미착수)
- **해소 메모**: 반영 시 [ADR-0017](../adr/0017-remote-network-datasource.md)·[data-layer](../architecture/data-layer.md) 응답 매핑 절을 갱신하고 [api/conventions.md](../api/conventions.md) "Android 불일치" 표에서 제거한다.

### [2026-08-02] Android 성공 코드 판정이 서버와 어긋남
- **출처**: Android `ApiResponse.SUCCESS_CODE`(TODO 상수, `isSuccess`가 `code == "SUCCESS"` 단일 비교) vs 서버 `ApiResponse.ok`/`ApiResponse.created`(`code`=`"OK"`/`"CREATED"` 2종, [api/conventions.md](../api/conventions.md) "응답 envelope").
- **항목**: `isSuccess` 판정을 `"OK"`·`"CREATED"` 2종 비교로 바꿀지 여부와 시점.
- **상태**: 미해결 — 현 상태로는 서버가 정상 응답해도 Android가 전 호출을 `ApiException.Business` 실패로 판정한다(실제 연동 전 반드시 수정 필요).
- **해소 메모**: 반영 시 [ADR-0017](../adr/0017-remote-network-datasource.md)와 [api/conventions.md](../api/conventions.md) "Android 불일치" 표를 갱신한다.

### [2026-08-02] TokenProvider 실구현 부재
- **출처**: Android `EmptyTokenProvider`(항상 null 반환) vs 서버 `SecurityConfig` 화이트리스트(`/actuator/health`·`/swagger-ui.html`·`/swagger-ui/**`·`/favicon.ico`·`/v3/api-docs/**`·`/api/v1/auth/kakao`·`/api/v1/auth/signup`·`/api/v1/auth/reissue`, [api/conventions.md](../api/conventions.md) "인증").
- **항목**: 실 `TokenProvider` 구현 시점·토큰 저장 방식(DataStore 등) 확정.
- **상태**: 미해결 — 화이트리스트 밖 전 API가 401(로그인 이후 거의 모든 호출).
- **해소 메모**: 구현 시 [ADR-0017](../adr/0017-remote-network-datasource.md)·[data-layer](../architecture/data-layer.md)를 갱신하고 [api/conventions.md](../api/conventions.md) "Android 불일치" 표에서 제거한다.

### [2026-08-02] 서버 URL 규약 3형태 혼재
- **출처**: 서버 `KakaoLoginController`·`SignupController`·`ReissueController`·`LogoutController`(`/api/v1/auth/**`) · `ParfaitController`(`/api/v1/groups/{groupId}/parfaits/**`) · `ParfaitGroupController`(`/api/parfait-groups`, 버전 프리픽스 없음) — [api/conventions.md](../api/conventions.md) "URL 규약".
- **항목**: 버전 프리픽스(`/api/v1/`) 유무와 그룹 경로(`groups` vs `parfait-groups`) 통일 여부 확정.
- **상태**: 미해결 (서버팀 확인 필요 — 서버에 URL 규약 문서 없음)
- **해소 메모**: 서버가 정리하면 [api/conventions.md](../api/conventions.md) "URL 규약" 표와 각 도메인 문서(`auth.md`·`parfait-group.md`·`parfait.md`)의 엔드포인트 표 경로를 함께 갱신한다.

### [2026-08-02] 파르페 연도 조회 경로 `year`(단수) vs 응답 필드 `years`(복수) 불일치
- **출처**: `GET /api/v1/groups/{groupId}/parfaits/year` — 경로 세그먼트는 단수 `year`인데 응답 `ParfaitYearsResponse.years`는 복수 목록이다. [api/parfait.md](../api/parfait.md) "미결" — 서버 코드만으로는 의도된 설계인지 실수인지 확인할 수 없다(근거 자료인 PR 설명·이슈 조사는 문서화 범위 밖).
- **항목**: 서버팀에 의도 확인(경로를 `years`로 바꿀지, 필드명을 유지할지).
- **상태**: 미해결 (서버팀 확인 필요)
- **해소 메모**: 확인 후 [api/parfait.md](../api/parfait.md) 엔드포인트 표·경로 서술을 갱신한다.

### [2026-08-02] 회원 전역 닉네임과 그룹 닉네임 유효성 규칙 동일성 미대조
- **출처**: `ParfaitGroupService.validateJoin`의 `requireMemberNickname`이 반환한 **회원 전역 닉네임**에 `GroupNickname.of`를 그대로 적용한다(join-preview·join의 `INVALID_GROUP_NICKNAME`). [api/parfait-group.md](../api/parfait-group.md) "미결" — 전역 닉네임을 검증하는 `core/member` 값 객체는 이번 서버 계약 조사 범위(컨트롤러·DTO·`ParfaitGroupError`·`GroupName`/`GroupNickname`/`GroupMemberLimit`) 밖이라 확인하지 못했다.
- **항목**: 전역 닉네임 규칙(길이·문자 패턴)이 `GroupNickname`(1~15자, `^[가-힣A-Za-z0-9]+(?: [가-힣A-Za-z0-9]+)*$`)과 같은지 서버 `core/member` 코드를 추가로 읽어 확정한다 — 다르면 회원이 그룹 참여를 시도할 때 본인이 입력한 값과 무관하게 `INVALID_GROUP_NICKNAME`을 받을 수 있다.
- **상태**: 미해결 (조사 범위 확장 필요)
- **해소 메모**: 확인 후 [api/parfait-group.md](../api/parfait-group.md) join-preview/join 절과 "정책 대조 메모"에 반영한다.

### [2026-08-02] `errorDetail`이 계약에만 있고 값이 채워지지 않는 상태가 의도인지 미확정
- **출처**: [api/conventions.md](../api/conventions.md) "응답 envelope" — `GlobalExceptionHandler`의 네 핸들러(`BusinessException`·`ParfaitGroupException`·bad-request 4종·`Exception`)가 모두 `errorDetail` 인자 없이 `ApiResponse.error(errorCode)`를 호출해 필드가 계약에는 있으나 값은 항상 `null`이다. 검증 실패(`MethodArgumentNotValidException`)도 필드별 상세 없이 `CommonErrorCode.INVALID_REQUEST` 하나로 뭉개진다.
- **항목**: 필드별 검증 메시지(`errorDetail`)를 채울 계획이 있는지 서버팀 확인. 채워지면 Android가 폼 필드 단위 에러 표시를 구현할 근거가 생긴다 — 현재는 채워지지 않는다는 전제로만 설계할 수 있다.
- **상태**: 미해결 (서버팀 확인 필요)
- **해소 메모**: 확인 후 [api/conventions.md](../api/conventions.md) "응답 envelope"의 "현재 항상 null" 서술을 갱신한다.

### [2026-08-02] `GET /health`가 인증 대상인 것이 의도인지 미확정
- **출처**: [api/conventions.md](../api/conventions.md) "인증" — `HealthController`가 매핑한 `GET /health`(`http/global/health`)는 `SecurityConfig` 화이트리스트의 `/actuator/health`와 경로가 달라 **인증 대상**이다. 화이트리스트는 `/actuator/health`만 허용하고 `/health`는 포함하지 않는다.
- **항목**: `GET /health`가 의도적으로 인증 대상인지(운영용이라 무관), 아니면 화이트리스트 누락인지 서버팀 확인.
- **상태**: 미해결 (서버팀 확인 필요)
- **해소 메모**: 확인 후 [api/conventions.md](../api/conventions.md) "인증"의 관측 사실 서술을 정리한다.

### [2026-08-02] 카카오 로그인 429 요청 한도 초과가 명세에만 있고 서버에 없음
- **출처**: 팀 명세([api/spec/auth-kakao-login.md](../api/spec/auth-kakao-login.md))가 `POST /api/v1/auth/kakao`의 상태 코드로 **429 요청 한도 초과**를 열거하나(code 미지정), 서버 `AuthErrorCode` 12종에 대응 코드가 없고 rate limit 구현 흔적(`429`·`TOO_MANY`·`RateLimit`·`Bucket`)도 코드에서 발견되지 않는다.
- **항목**: 429가 **미구현**인지, 인프라 계층(게이트웨이·WAF)에서 처리돼 애플리케이션 코드에 없는 것인지 서버팀 확인. 후자라면 envelope 없이 원시 429가 올 수 있어 Android가 `ApiException.Http`로 받게 되므로 소비 코드에 영향이 있다.
- **상태**: 미해결 (서버팀 확인 필요)
- **해소 메모**: 확인 후 [api/spec/auth-kakao-login.md](../api/spec/auth-kakao-login.md) "코드 대조"와 [api/auth.md](../api/auth.md) "명세 델타"를 갱신한다.

<!--
항목 추가 형식:

### [YYYY-MM-DD] [주제 요약]
- **출처**: `경로/파일` — 근거 (라인번호·변동수치 금지, 파일명+심볼명)
- **항목**: 결정해야 할 것
- **상태**: 미해결 | 해소됨 | 보류
- **해소 메모**: 해소 시 어느 ADR/architecture에 반영했는지
-->
