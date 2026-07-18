---
id: open-questions
title: Open Questions — 구현 미결·열린 결정
category: meta
status: living
platforms: android
verified: 2026-07-18
related_spec:
related_adr: ADR-0010, ADR-0011, ADR-0012, ADR-0013, ADR-0014
related_architecture: design-system, data-layer
related_code:
tags: [meta, parfait]
---
# Open Questions — 구현 미결·열린 결정

TJYG-Android 구현에서 발견된 미결 결정·계약 공백·코드/문서 정합 이슈를 추적한다.
정책 기획 쪽 미결은 위키 [[open-questions]]에 있다. 여기는 **코드·ADR·architecture 소관**만 둔다.
해소된 항목은 상태를 "해소됨"으로 바꾸고 관련 ADR/architecture 문서에 반영한다.

> 링크 규약: parfait 내부 문서는 상대 md 링크(`adr/…`, `architecture/…`). 위키 개념 참조만 `[[…]]`.

---

### [2026-07-10] YGButton 디자인 토큰 규칙 미확정
- **출처**: `component/ygbutton/YGButtonType.kt` — 각 변형 `colors`가 시맨틱(`YGTheme.colorScheme`) 대신 `YGAtomicColors`를 직접 참조, 값 잠정(mock). 코드 주석 "Design Token 규칙이 조금 이상… 컴포넌트 완성 시점에 문의 예정".
- **항목**: ① 컴포넌트가 원자 색을 직접 읽는 것을 시맨틱 계층으로 정리할지, ② XSmall/Small/… 변형별 패딩·radius·textStyle 토큰 매핑 확정.
- **상태**: 미해결
- **해소 메모**: 컴포넌트 완성·디자인 토큰 규칙 확정 시 [design-system](architecture/design-system.md) 규약과 [ADR-0010](adr/0010-custom-compositionlocal-theme.md) 원칙(시맨틱 우선)에 맞춰 정리.

### [2026-07-12] BitmapWrapper stub — 계약 없는 추상
- **출처**: `core/util/jvm`의 `BitmapWrapper`(멤버 없음, `// TODO 차후 비트맵 사용에 필요한 함수 구현`), `core/util/android`의 `AndroidBitmap`(`// TODO delegate 사용하도록 수정`).
- **항목**: ① 도메인이 비트맵에 필요한 연산을 `BitmapWrapper` 계약으로 정의할지(현재는 `data`에서 `as? AndroidBitmap` 다운캐스트에 의존), ② `getRawData()` 직접 노출을 유지할지.
- **상태**: 미해결
- **해소 메모**: 필요한 연산 확정 시 [ADR-0011](adr/0011-cross-module-bitmap-abstraction.md) 본문·`BitmapWrapper`에 반영해 다운캐스트 의존을 줄인다.

### [2026-07-12] ML Kit Subject Segmentation beta 의존
- **출처**: `gradle/libs.versions.toml`의 `mlkitSubjectSegmentation`(beta), `feature/segmentation/impl`의 `AndroidManifest` install-time 모델. [ADR-0012](adr/0012-mlkit-subject-segmentation.md).
- **항목**: ① beta 승급·API 변동 추적, ② GMS 미탑재 기기 대응, ③ subject PNG 캐시 파일(`cacheDir`) 정리 정책, ④ [[누끼-따기]] "온디바이스 vs 서버" 미결의 온디바이스 잠정 확정 여부.
- **상태**: 보류 (온디바이스로 잠정 채택, beta 추적 중)
- **해소 메모**: 정식(GA) 승급 시 버전 고정·문서 갱신. 캐시 정리 정책 정하면 [data-layer](architecture/data-layer.md) 갱신.

### [2026-07-12] 세그멘테이션 예외 처리 불일치
- **출처**: `data`의 `ImageSegmentationRepositoryImpl.segmentImage` — `Result<SegmentationResult>`/`SegmentationException` 패턴을 쓰면서도 `foregroundConfidenceMask`가 null이면 `error("...")`(raw `IllegalStateException`)로 throw. Result로 감싸지 않아 호출부(effect→Toast)가 못 잡을 수 있음.
- **항목**: null 마스크·`Tasks.await` 예외를 `SegmentationException`(예: 신규 케이스)으로 통합해 `Result.failure`로 반환할지.
- **상태**: 미해결
- **해소 메모**: 코드 수정 대상(문서 아님). 처리 방식 확정 시 [ADR-0012](adr/0012-mlkit-subject-segmentation.md) "위험·방어"와 정합 확인.

### [2026-07-12] 디자인시스템 컴포넌트 컨벤션 분기
- **출처 A**: `component/ygbutton`·`ygiconbutton`·`ygactionitem` — 컴포넌트별 폴더 + `@Preview`/`YGCustomTheme`(+`PreviewParameterProvider`) 프리뷰.
- **출처 B**: `component/textfield`·`etc` — 그룹 폴더 + `@YGPreview`/`PreviewBox` 프리뷰.
- **항목**: ① 패키지 네이밍(컴포넌트별 vs 그룹 폴더) 표준, ② 프리뷰 방식(`@YGPreview`/`PreviewBox` vs `@Preview`/`PreviewParameterProvider`) 표준.
- **상태**: 미해결 (② 프리뷰 방식은 브랜치 `refactor/design-system-preview`에서 `@YGPreview`+`PreviewBox` 통일 진행 중 — **develop 미머지**. ① 패키지 네이밍은 잔존.)
- **해소 메모**: ② 프리뷰 방식 — 리팩터([designsystem-preview-migration 스펙](specs/2026-07-18-designsystem-preview-migration.md)/[plan](plans/2026-07-18-designsystem-preview-migration.md))로 18파일 전부 `@YGPreview`+`PreviewBox` 전환·컴파일/ktlint 통과. **develop 머지 시** ② 해소 처리하고 [design-system](architecture/design-system.md) 프리뷰 노트를 "표준 통일 완료"로 갱신. 그 전엔 "미머지" 유지. ① 패키지 네이밍 표준 확정 시 "컴포넌트 작성 규약"에 반영하고 기존 컴포넌트 정리(YGColorChip 패키지 불일치 포함).

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
- **해소 메모**: 디자인 토큰 규칙 확정 시 [design-system](architecture/design-system.md) "컴포넌트 작성 규약" + [2026-07-10 YGButton 디자인 토큰](#2026-07-10-ygbutton-디자인-토큰-규칙-미확정)과 정합해 정리.

### [2026-07-18] YGColorChip 패키지↔폴더 불일치
- **출처**: `component/ygcolorchip/` — `YGColorChip.kt`·`YGColorChipPreviewData.kt`는 `package …component.ygchip` 선언, `YGColorChipType.kt`만 `package …component.ygcolorchip`. 폴더는 `ygcolorchip/`인데 패키지가 둘로 갈림.
- **항목**: 패키지를 폴더명(`ygcolorchip`)으로 통일할지(권장), 폴더를 패키지명(`ygchip`)에 맞출지.
- **상태**: 미해결 (코드 수정 대상)
- **해소 메모**: 컨벤션 정리 시 [design-system](architecture/design-system.md) "컴포넌트 작성 규약"과 정합. [2026-07-12 컨벤션 분기](#2026-07-12-디자인시스템-컴포넌트-컨벤션-분기)와 함께 처리.

### [2026-07-18] 네임태그 컬러칩 타입 개수 — 코드 14종 vs 정책 12종
- **출처**: `component/ygcolorchip/YGColorChipType.kt` — `NametagChip1`~`NametagChip13` + `NametagChipPlus`(추가용) = **14종**(숫자 13 + Plus). 위키 정책 [[nametag-chip]]([[S-101-프로필-닉네임-컬러-규칙-v0.2]])은 **Nametag-Chip 12종**으로 기술.
- **항목**: ① 실제 매핑이 12종인지 13(+Plus)종인지 확정, ② 코드↔정책 중 어느 쪽이 SoT인지(원칙: 코드>정책, 단 색 규칙은 디자인 정책 소관). 위키 정책 재확인 필요.
- **상태**: 미해결 (코드/정책 정합)
- **해소 메모**: 정책 확정 시 위키 [[nametag-chip]]·[[S-101-프로필-닉네임-컬러-규칙-v0.2]] 갱신, 코드 타입 개수 정합. parfait [ygcolorchip 스펙](specs/archive/2026-07-18-ygcolorchip.md)의 타입 표 반영.

### [2026-07-18] YGDateButton clickableYG 미사용 — 스로틀 규약 이탈
- **출처**: `component/ygdatebutton/YGDateButton.kt` — 클릭을 표준 `Modifier.clickable(indication = null)` + `semantics { role = Role.Button }`로 직접 구현. 다른 상호작용형 컴포넌트(YGButton·YGIconButton·YGActionItem·YGChipButton)가 쓰는 `core:util:android`의 중복 클릭 leading-throttle 유틸(`clickableYG`)을 안 씀 → 빠른 연타 방어 부재.
- **항목**: `YGDateButton`을 `clickableYG`(또는 변형)로 전환할지, 캘린더 셀은 스로틀 예외로 둘지.
- **상태**: 미해결 (코드 수정 대상)
- **해소 메모**: 방침 확정 시 [design-system](architecture/design-system.md) "pressed 상태 관용구"·clickable 규약과 정합. [clickableyg-throttle 스펙](specs/archive/2026-07-12-clickableyg-throttle.md) 참조.

### [2026-07-18] FCM 토큰 서버 전송 미구현
- **출처**: `app/fcm/YGFirebaseMessagingService.kt` — `onNewToken`이 `TODO("서버에 FCM 토큰 전송")`. [ADR-0013](adr/0013-firebase-fcm-crashlytics.md).
- **항목**: 토큰 갱신 시 서버 등록 흐름(원격 API·재시도·로그인 연계). 원격 네트워킹 자체가 후속 과제([data-layer](architecture/data-layer.md)).
- **상태**: 보류 (원격 연동 이후)
- **해소 메모**: 원격 연동 준비 시 구현하고 [ADR-0013](adr/0013-firebase-fcm-crashlytics.md) "위험·방어" 갱신.

### [2026-07-18] `analytics` 패키지가 순수 로깅만 — 이름/기능 범위 불일치
- **출처**: `core:util:jvm`의 `analytics` 패키지에 `Logger`/`Loggers`/`KermitLoggerImpl`/`LoggerInitializer`가 있으나 실제 애널리틱스(이벤트 전송·Firebase Analytics 연동)는 없음. [ADR-0014](adr/0014-logging-abstraction-kermit.md).
- **항목**: ① 릴리즈 로그 라이터 정책(로그 억제·Crashlytics 연동)을 `LoggerInitializer`에 둘지, ② `analytics` 패키지에 실제 이벤트 트래킹을 붙일지 패키지명을 `logging`으로 좁힐지.
- **상태**: 미해결
- **해소 메모**: 방침 확정 시 [ADR-0014](adr/0014-logging-abstraction-kermit.md) 본문·`LoggerInitializer` 갱신.

### [2026-07-18] YGAtomicColors public 전환 — 시맨틱 우선 원칙 실질 이탈
- **출처**: `theme/colors/YGAtomicColors.kt` — `internal object YGAtomicColors` → `object YGAtomicColors`(public) 변경. 브랜치 `refactor/design-system-preview`, **develop 미머지**(미커밋 working tree 단계).
- **배경**: 디자인이 GUI에서 시맨틱(`YGColorScheme`) 개념을 쓰지 않고 원자 색을 그대로 끌고 가 사용 → 컴포넌트·피처가 원자 색 직접 참조하는 게 현실. `internal` 유지가 외부 모듈 사용을 막아 불가피하게 public 전환.
- **항목**: ① [ADR-0010](adr/0010-custom-compositionlocal-theme.md) "컴포넌트는 시맨틱을 읽는다" 원칙을 폐기/완화할지(원자 색이 실질 SoT), ② [design-system](architecture/design-system.md) "원자 색 직접 참조 금지 원칙" 서술 개정, ③ 시맨틱 레이어(`YGColorScheme`/`YGSemanticColorDefaults`)를 유지할지 걷어낼지, ④ 방향 전환을 신규 ADR로 남길지 ADR-0010 갱신할지.
- **상태**: 미해결 (develop 미머지 — 문서는 미머지 마커만)
- **해소 메모**: develop 머지 시 design-system·ADR-0010 갱신(또는 신규 ADR로 "원자 색 직접 노출 채택" 기록), 마커 제거. 기존 [2026-07-10 YGButton 디자인 토큰](#2026-07-10-ygbutton-디자인-토큰-규칙-미확정) "시맨틱 정리" 방향과 상반 — 함께 재정리.

<!--
항목 추가 형식:

### [YYYY-MM-DD] [주제 요약]
- **출처**: `경로/파일` — 근거 (라인번호·변동수치 금지, 파일명+심볼명)
- **항목**: 결정해야 할 것
- **상태**: 미해결 | 해소됨 | 보류
- **해소 메모**: 해소 시 어느 ADR/architecture에 반영했는지
-->
