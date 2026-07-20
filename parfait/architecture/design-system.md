---
id: design-system
title: Design System — 테마·토큰·컴포넌트 작성 가이드
category: architecture
status: living
platforms: android
verified: 2026-07-20
related_spec: designsystem-ygscreen-scaffold
related_adr: ADR-0007, ADR-0010
related_architecture:
related_code: core:designsystem, YGTheme
tags: [architecture, parfait]
---
# Design System — 테마·토큰·컴포넌트 작성 가이드

`core:designsystem` 모듈의 테마 홀더·토큰 계층·컴포넌트 작성 규약. "왜"는 [ADR-0010](../adr/0010-custom-compositionlocal-theme.md)(테마 메커니즘), [ADR-0007](../adr/0007-compose-material3-design-tokens.md)(100% Compose·중앙화 원칙, superseded).

> 근거는 파일명 + 심볼명으로 표기. 라인번호·색 hex값·개수는 적지 않는다(코드에서 직접 확인). 값이 필요하면 `theme/colors/YGAtomicColors.kt` 등 소스를 본다.

## 전체 구조

```
core/designsystem/.../theme/
  YGTheme.kt              ← 진입점 YGCustomTheme() + 접근자 object YGTheme + Local* CompositionLocal
  colors/                 ← 색 2계층 (원자 → 시맨틱)
    YGAtomicColors        원자 팔레트 (Cherry/Melon/Pudding/Soda/Gray/Transparency) — **public** (#158로 internal→public 머지, 2026-07-19)
    YGColorScheme         시맨틱 홀더 (primary/secondary/tertiary/danger/warning/success/info/grayScale/transparency)
    YGColorGrayScale, YGColorTransparency   서브 홀더
    YGSemanticColorDefaults    원자→시맨틱 매핑 (YGLightColorScheme / YGDarkColorScheme)
    KakaoDesignGuideColors     외부 가이드 색 참조
  typography/             ← YGTypography(title/body/caption) + YGFontFamily(SUIT) + *Defaults
  shapes/                 ← YGShapes(radius: YGShapeRadius) + YGShapesDefaults
  layout/                 ← YGLayout(gap: YGLayoutGap, padding: YGLayoutPadding) + YGLayoutDefaults
  size/SizeTokens.kt      ← SizeTokens(object) + SizeToken(value class .getDp()) — 홀더 밖 별도
component/
  ygbutton/               ← YGButton (첫 컴포넌트, 작성 패턴 레퍼런스)
border/
  DashedBorder.kt         ← dashedBorder() Modifier (점선 사각형 테두리, drawBehind+dashPathEffect) ⚠️브랜치 feature/sync-design-system-260719, develop 미머지
screen/                   ← 화면 루트 컨테이너 (아래 "화면 컨테이너")
  YGScreen.kt             Surface 래퍼 + YGScreenScope 리시버 (화면 최외곽)
  YGScaffold.kt           Material3 Scaffold 래퍼 (nav/EntryBuilder)
  YGScreenScope.kt        YGScreenScope + OnBack(@Composable, BackHandler 래핑)
res/font/                 ← suit_regular/medium/semi_bold/bold.ttf
res/drawable/             ← ic_* 아이콘 리소스
```

## 테마 접근 규약

- 테마 값은 **항상 `YGTheme.*`로 읽는다**: `YGTheme.colorScheme` / `.typography` / `.shapes` / `.layout`. 전부 `@Composable @ReadOnlyComposable`.
  - 예: `YGTheme.typography.body.b01SB`, `YGTheme.layout.padding.padding4`, `YGTheme.shapes.radius.round`.
- **크기만 예외**: `SizeTokens.Size24.getDp()`로 직접(`SizeToken`은 `@JvmInline value class`, 홀더 밖).
- `Local*` CompositionLocal은 `internal` + 미초기화 시 `error(...)`. → **모든 UI·프리뷰는 `YGCustomTheme { }`로 감싸야** 크래시 안 남.
- **원자 색 직접 참조 — develop 실질 허용(#158 이후)** — 컴포넌트 대부분(`YGButton`·`YGActionItem`·`YGIconButton`·`YGInputNumber`·`YGChipButton`·`YGToggleButton`·`YGModalPopup`·`YGInviteCard`·`YGColorChip`·`YGTopBar`·`YGDateButton`·`YGDate`·`YGLabel`·`YGDangerZone`)이 시맨틱(`YGTheme.colorScheme`) 대신 `YGAtomicColors`를 직접 참조. 원래 규칙은 "시맨틱만 읽고 `YGAtomicColors`는 `internal`+시맨틱 매핑에서만 소비"였으나 —
  > ✅ **방향 전환 머지됨(#158, develop `ce4e9b8`, 2026-07-19)** — `YGAtomicColors` **`internal`→public**. "원자 직접 참조 금지"의 강제 메커니즘(외부 모듈 접근 차단)이 사라지고 원자 색이 실질 SoT가 됨. [ADR-0010](../adr/0010-custom-compositionlocal-theme.md) "시맨틱 우선" 원칙 재검토/신규 ADR 필요(잔존) → [open-questions](../open-questions.md).

## 토큰 계층

| 축 | 홀더 | 스케일(심볼) | 기본값 제공 |
|---|---|---|---|
| 색 | `YGColorScheme` | primary/secondary/tertiary + danger/warning/success/info + grayScale/transparency | `YGSemanticColorDefaults` |
| 타이포 | `YGTypography` | title/body/caption 그룹, 각 웨이트·크기 변형(`b01B/b01SB/b01R/b02...`) | `YGTypographyDefaults` |
| 모양 | `YGShapes.radius`(`YGShapeRadius`) | none/xSmall/small/medium1/medium2/large/xLarge1/xLarge2/round (`none`=RectangleShape 각짐 ⚠️브랜치 feature/sync-design-system-260719, develop 미머지) | `YGShapesDefaults` |
| 레이아웃 | `YGLayout.gap`/`.padding` | gap1.. / padding1.. (명명 스케일) | `YGLayoutDefaults` |
| 크기 | `SizeTokens`(홀더 밖) | Size1/2/4/6/…/44/48/64/80 (`SizeToken`) | — |

색 2계층: `YGAtomicColors`(브랜드 팔레트 — Cherry가 primary 계열, Melon=secondary, Pudding=tertiary, Soda=info 등) → `YGSemanticColorDefaults`가 라이트/다크 스킴으로 매핑. **다크는 현재 라이트와 동일**(`YGDarkColorScheme = YGLightColorScheme`, 코드 `TODO`).

## 신규 토큰 값 추가 체크리스트

1. **원자 색 추가** → `YGAtomicColors`에 팔레트 항목 추가. 시맨틱에 노출하려면 `YGColorScheme` 필드 + `YGSemanticColorDefaults` 매핑까지.
2. **타이포/모양/레이아웃 스케일 추가** → 해당 홀더 data class(`YGTypography*`/`YGShapeRadius`/`YGLayoutGap`·`YGLayoutPadding`)에 필드 추가 + 대응 `*Defaults`에 값 채움.
3. **크기 추가** → `SizeTokens`에 `SizeN` 상수.
4. 홀더 필드를 늘리면 `*Defaults`가 컴파일로 강제되므로 누락 시 빌드 실패(가드).

## 컴포넌트 작성 규약 (레퍼런스: `component/ygbutton/`)

`YGButton`이 첫 컴포넌트이자 패턴 기준.

- **패키지**: `component/<컴포넌트명 소문자>/`. 한 컴포넌트당 파일 분리:
  - `YGButton.kt` — 컴포저블 본체(`clickable`·semantic·`enabled`·`isPressed` 내재화).
  - `YGButtonType.kt` — `sealed interface`로 변형(variant) 정의. 각 변형이 자기 토큰(패딩·radius·textStyle·iconSize·gap·colors)을 `@get:Composable`로 노출. 현재 변형: `SmallSquare`/`Medium.{Primary,Secondary,Transparency}`/`Large`. (fix/ygbutton **#140 develop 머지**로 `XSmall`/`Small` 제거.)
  - `YGButtonColors.kt` — 상태별 색 묶음 data class(enabled/disabled/pressed × foreground/background). (#140에서 `borderColor` 제거·`iconColor`→`foregroundColor` 통합.)
  - `YGButtonPreviewData.kt` — 프리뷰용 데이터.
- **토큰 참조**: 변형 내부에서 `YGTheme.layout.padding.*`, `YGTheme.shapes.radius.*`, `YGTheme.typography.body.*`, `SizeTokens.*.getDp()`로 읽는다.
- **프리뷰**: `YGCustomTheme { }`로 감싼다(Local 미초기화 크래시 방지). Coil 프리뷰는 `YGCustomTheme`이 `LocalAsyncImagePreviewHandler`를 이미 심음.

> **Assumption / 과도기** — `YGButtonType`의 각 변형 `colors`가 시맨틱(`YGTheme.colorScheme`) 대신 `YGAtomicColors`를 직접 참조하고, 값이 잠정(mock)이다. 코드 주석("Design Token 규칙이 조금 이상… 컴포넌트 완성 시점에 문의 예정")대로 **확정 전 상태**. 이 원자 직접 참조는 `YGButton`에 국한되지 않고 이후 대부분 컴포넌트(`YGActionItem`·`YGIconButton`·`YGInputNumber`·`YGChipButton`·`YGToggleButton`·`YGModalPopup`·`YGInviteCard`·`YGColorChip`·`YGTopBar`·`YGDateButton`·`YGDate`·`YGLabel`·`YGDangerZone`, 대체로 `YGAtomicColors.Gray.*`·`Cherry.*`·`Transparency.*`)로 확산됨. 확정 시 시맨틱으로 정리 권장. → [open-questions](../open-questions.md) 후보.

## 화면 컨테이너 (`screen/`)

화면 루트에 쓰는 컨테이너 2종 + 뒤로가기 스코프. 설계 상세 → [designsystem-ygscreen-scaffold 스펙](../specs/2026-07-20-designsystem-ygscreen-scaffold.md).

- **역할 분리 (컨벤션)**:
  - **`YGScaffold` = nav 레벨(EntryBuilder)** — `entry<NavKeyXxx> { YGScaffold { innerPadding -> XxxRoute(...) } }`. Material3 `Scaffold` 얇은 래퍼(기본 배경 흰색, `contentWindowInsets` 노출). TopBar/BottomBar/inset이 필요한 엔트리 컨테이너. → [navigation-flow](navigation-flow.md) 체크리스트.
  - **`YGScreen` = 화면 최외곽(Screen 컴포저블)** — `internal fun XxxScreen(...) { YGScreen(modifier = modifier) { ... } }`. `Surface` 래퍼(기본 각짐·흰 배경) + `YGScreenScope` 리시버. 화면 `modifier`는 `YGScreen`에 전달(관례).
- **뒤로가기**: `YGScreen`의 content는 `YGScreenScope` 리시버라 `OnBack(enabled, handler) { }`(@Composable, 내부 `BackHandler` emit)로 처리. 호출한 화면만 back 가로챔 — 안 쓰면 안 부르면 됨(강제 리턴 없음). `OnBack`은 @Composable node-emit이라 PascalCase(`BackHandler` 동일 규칙).
- **주의**: 현재 `YGScreen`↔`YGScaffold` 미통합(`YGScaffold`는 `YGScreenScope`/OnBack 없음). 통합·역할 정리는 [open-questions](../open-questions.md) 미결(머지 후 ADR 예정).

## 컴포넌트 인벤토리

구현된 `component/*` 컴포넌트와 상세 설계(스펙). 심볼명 기준(개수·라인 미기재).

| 컴포넌트 | 패키지 | 스펙 |
|---|---|---|
| `YGButton` | `component/ygbutton/` | (레퍼런스, 스펙 이전) |
| `YGTextField` / `YGTextFormField` | `component/textfield/` | [ygtextfield](../specs/archive/2026-07-10-ygtextfield.md) · [ygtextformfield](../specs/archive/2026-07-10-ygtextformfield.md) |
| `YGHorizontalDivider` / `YGListItem` | `component/etc/` | [yghorizontaldivider](../specs/archive/2026-07-12-yghorizontaldivider.md) · [yglistitem](../specs/archive/2026-07-12-yglistitem.md) |
| `YGIconButton`(+`YGIconButtonSize`) | `component/ygiconbutton/` | [ygiconbutton](../specs/archive/2026-07-12-ygiconbutton.md) |
| `YGActionItem` | `component/ygactionitem/` | [ygactionitem](../specs/archive/2026-07-12-ygactionitem.md) |
| `YGInputNumber`(+`YGInputNumberPreviewData`) | `component/yginputnumber/` | [yginputnumber](../specs/archive/2026-07-13-yginputnumber.md) |
| `YGChipButton`(+`YGChipButtonColors`·`YGChipButtonColorsDefaults`) | `component/ygchipbutton/` | [ygchipbutton](../specs/archive/2026-07-16-ygchipbutton.md) |
| `YGToggleButton`(+`YGToggleButtonPreviewData`) | `component/ygtogglebutton/` | [ygtogglebutton](../specs/archive/2026-07-16-ygtogglebutton.md) |
| `YGInviteCard`(+`YGInviteCardStatus`) | `component/card/` | [yginvitecard](../specs/archive/2026-07-14-yginvitecard.md) |
| `YGModalPopup` | `component/modal/` | [ygmodalpopup](../specs/archive/2026-07-15-ygmodalpopup.md) |
| `YGColorChip`(+`YGColorChipStyle`·`YGColorChipType`·`YGColorChipPreviewData`) | `component/ygcolorchip/` ⚠️패키지 불일치 | [ygcolorchip](../specs/archive/2026-07-18-ygcolorchip.md) |
| `YGDate` / `YGLabel` | `component/ygtext/` | [ygtext-date-label](../specs/archive/2026-07-18-ygtext-date-label.md) |
| `YGTopBar`(Back/Detail/Empty/Default 변형 + private `YGTopBarContent`) | `component/ygtopbar/` | [ygtopbar](../specs/archive/2026-07-18-ygtopbar.md) |
| `YGDateButton` | `component/ygdatebutton/` | [ygdatebutton](../specs/archive/2026-07-18-ygdatebutton.md) |
| `YGDangerZone` | `component/ygdangerzone/` | [ygdangerzone](../specs/archive/2026-07-18-ygdangerzone.md) |
| `YGScreen` / `YGScaffold`(+`YGScreenScope`·`OnBack`) | `screen/` | [designsystem-ygscreen-scaffold](../specs/2026-07-20-designsystem-ygscreen-scaffold.md) (위 "화면 컨테이너") |

- **`YGIconButton` = 공통 아이콘 버튼**: 정사각 컨테이너 + 중앙 아이콘 + enabled/pressed tint, 크기 프리셋 enum(`YGIconButtonSize`). `YGTextField`의 clear 아이콘은 이미 인라인 `Box`+`Image`에서 `YGIconButton(size = YGIconButtonSize.SIZE_44)`로 치환됨(`YGTextFieldImpl.kt`). `YGListItem` trailing caret도 `YGIconButton`으로 치환(#136 develop 머지 #148).
- **`YGInputNumber`**: 숫자 셀. 컨테이너 크기·보더는 토큰 대신 고정 dp로 하드코딩(코드 주석: 디자인가이드 고정 크기)이라 토큰화 예외 사례. shape·typography는 `YGTheme.*` 사용, 색은 `YGAtomicColors.Gray.*` 직접 참조.
- **`YGChipButton`**: pill(`shapes.radius.round`) 칩 버튼. text + 선택 start/end 아이콘, 아이콘 유무로 좌/우 패딩 비대칭. **Colors 패턴 준수** — `YGChipButtonColors`(@Immutable, default/pressed×fg/bg/border) 주입 + `YGChipButtonColorsDefaults` 프리셋(`CherryBorderPressed`·`CherryBackgroundPressed`). pressed 분기(아래 관용구). 프리셋 색은 `YGAtomicColors` 직접 참조(과도기).
- **`YGToggleButton`**: pill 선택형 버튼. `isSelected`(prop) 하나로 배경/전경/타이포 반전, `selectable(Role.Button)` 사용. **규약 이탈** — Colors data class 미분리, 색을 컴포저블 본문에서 `YGAtomicColors.{Gray,Transparency}` 인라인 조건 분기(커스터마이즈 불가). 아이콘 `24.dp` 하드코딩. → [open-questions](../open-questions.md).
- **`YGModalPopup`**: Compose `Dialog` 위 중앙 팝업. 아이콘+제목+본문 + 2버튼(`YGButton.Medium.Secondary` 좌/`Primary` 우, `weight(1f)` 균등). 버튼 confirm/cancel 의미 미규정(타입만 노출), 단일 `isEnabledButton`. 프리뷰 `@YGPreview`/`PreviewBox`.
- **`YGInviteCard`**(+`YGInviteCardStatus` enum): 그룹 초대 코드 카드. Active/Invalid 상태로 border·subText·코드박스 배경·복사 버튼 활성 분기. 복사 버튼은 `YGButton.SmallSquare` 재사용. 프리뷰 `@YGPreview`/`PreviewBox`.
- **`YGColorChip`**(+`YGColorChipStyle`·`YGColorChipType`): 원형 네임태그 컬러칩. `YGColorChipType` 14종(`NametagChip1~13`+`Plus`)이 fill/stroke/text 색을, `YGColorChipStyle`(`Style28`/`Style40`)가 지름·테두리·타이포를 고정. 위키 정책 [[nametag-chip]] 구현체(단 코드 14종 vs 정책 12종 드리프트 → [open-questions](../open-questions.md)). **⚠️ 패키지↔폴더 불일치**(`YGColorChip.kt`/`PreviewData`는 `package …ygchip`, `Type`만 `…ygcolorchip`) → [open-questions](../open-questions.md).
- **`YGDate` / `YGLabel`**(`component/ygtext/`): 타이포+색 프리셋 텍스트 래퍼. `YGDate`는 패딩 하드코딩(토큰 예외, `YGInputNumber`류).
- **`YGTopBar`**: 상단 바 4변형(Back/Detail/Empty/Default) 공유 레이아웃 private `YGTopBarContent`. 좌측 `YGIconButton.SIZE_44` + 우측 타이틀/`YGChipButton` 슬롯. 로고 자리는 `ic_plus` placeholder(코드 `todo: parfait logo`).
- **`YGDangerZone`**: 상/하 2슬롯 + 사이 `YGHorizontalDivider` 반투명 컨테이너(`Transparency.Black5` 배경, `IntrinsicSize.Max`). 슬롯에 대개 `YGActionItem` 주입(로그아웃/탈퇴 묶음).
- **pressed 상태 관용구**: 상호작용형 컴포넌트(YGButton·YGIconButton·YGActionItem·YGChipButton)는 `MutableInteractionSource` + `collectIsPressedAsState()`로 pressed를 파생해 색/tint를 분기한다. (예외: `YGToggleButton`은 pressed 대신 `selectable`의 selected 상태로 분기. `YGDateButton`은 상태(selected/today/enabled) prop `when` 분기만 하고 `clickableYG` 대신 표준 `clickable(indication=null)` 사용 — **스로틀 규약 이탈**, → [open-questions](../open-questions.md).)
- **clickable 유틸(`clickableYG`·`ygDimRipple`·`ygScaleRipple`)은 `core:designsystem`이 아니라 [`core:util:android`](module-structure.md)의 `clickable/` 패키지에 있다**(2026-07-14 이동, develop 머지 #143). `@Composable Modifier.clickableYG`(중복 클릭 leading-throttle) + 변형 3종(Dim/Scale/Merge)이 표준 `Modifier.clickable` 위에 throttle을 얹어 focus/키/hover/시맨틱을 확보. 테마 비의존이라 ripple 색은 리터럴(`YGDimRippleColor`). 상세 → [clickableyg-throttle](../specs/archive/2026-07-12-clickableyg-throttle.md) · [ygripple](../specs/archive/2026-07-13-ygripple.md) · [clickableyg-ripple-variants](../specs/archive/2026-07-13-clickableyg-ripple-variants.md).

> **과도기 — 컨벤션 분기(정리 대상)**
> - **패키지 네이밍**: 컴포넌트별 폴더(`ygbutton/`·`ygiconbutton/`·`ygactionitem/`·`ygcolorchip/`·`ygtopbar/`·`ygdatebutton/`·`ygdangerzone/`·`ygtext/`)와 그룹 폴더(`textfield/`·`etc/`·`card/`·`modal/`)가 혼재. 규약(위 "컴포넌트 작성 규약")은 컴포넌트별 폴더 기준. 추가로 `ygcolorchip/`는 패키지 선언이 폴더명과 어긋남(`ygchip`) → [open-questions](../open-questions.md).
> - **프리뷰 방식**: ✅ **`@YGPreview`+`PreviewBox`로 표준 통일 완료(#158 develop 머지, 2026-07-19)** — 컴포넌트 프리뷰 전부 `@YGPreview` 전환(공용 유틸 `YGPreview.kt` 정의 제외 `@Preview` 없음). 상세 [designsystem-preview-migration 스펙](../specs/archive/2026-07-18-designsystem-preview-migration.md). open-questions 프리뷰 항목 해소.

## 관련 ADR
- [ADR-0010](../adr/0010-custom-compositionlocal-theme.md) — 자체 CompositionLocal 테마(why).
- [ADR-0007](../adr/0007-compose-material3-design-tokens.md) — 100% Compose·중앙화 원칙(superseded).
