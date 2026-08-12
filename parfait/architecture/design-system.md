---
id: design-system
title: Design System — 테마·토큰·컴포넌트 작성 가이드
category: architecture
status: living
platforms: android
verified: 2026-08-12
related_spec: designsystem-ygscreen-scaffold, designsystem-button-component-sync, designsystem-button-missing-components, designsystem-canvas-components, designsystem-grouptag-topping-components, designsystem-bar-listdate-components, c101-camera-picture-confirm, a002-login-onboarding, c001-canvas-main
related_adr: ADR-0007, ADR-0010, ADR-0018
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
    KakaoDesignGuideColors     외부 가이드 색 참조(A-002 카카오 버튼)
    AppleDesignGuideColors     외부 가이드 색 참조 (#218 신설, **사용처 0** — 애플 로그인 철회 잔여물)
  typography/             ← YGTypography(title/body/caption) + YGFontFamily(SUIT) + *Defaults
  shapes/                 ← YGShapes(radius: YGShapeRadius) + YGShapesDefaults
  layout/                 ← YGLayout(gap: YGLayoutGap, padding: YGLayoutPadding) + YGLayoutDefaults
  size/SizeTokens.kt      ← SizeTokens(object) + SizeToken(value class .getDp()) — 홀더 밖 별도
component/
  ygbutton/               ← YGButton (첫 컴포넌트, 작성 패턴 레퍼런스)
  ygalert/                ← YGAlert 배너 + YGAlertPolicy/Host (노출 정책 패턴)
  ygtoast/                ← YGToast(+YGToastType) + YGToastPolicy/Host (노출 정책 패턴)
  ygcanvas/               ← YGCanvas + YGCanvasBackground (C-001 캔버스 합성 컨테이너, 반응형 배치 #199) (#185 develop 머지)
  ygbackgrounddotgrid/    ← ygBackgroundDotGrid() Modifier (C-001 배경 점 격자, drawBehind) (#199 develop 머지)
  yglistdate/             ← YGListDate (C-201 날짜 셀 = YGDateButton + YGChipColorIndicator) (#188 develop 머지)
  ygfloatingbar/          ← YGFloatingBar* 4변형 + private 컨테이너·버튼 2종 (#188 develop 머지)
  ygtopbar/               ← YGTopBar* 4변형 + YGTopBarDefaults(배경 블러 반경 #188, 상단 인셋 #194)
border/
  DashedBorder.kt         ← dashedBorder() Modifier (점선 사각형 테두리, drawBehind+dashPathEffect) (#159 develop 머지)
shape/
  CanvasCutCornerShape.kt ← canvasCutCornerShape() 좌상단 컷 Shape (Outline.Generic) (#185 develop 머지)
component/etc/
  YGHorizontalDashedDivider.kt  ← 점선 수평 구분선 (Canvas+drawLine+dashPathEffect) (#159 develop 머지)
screen/                   ← 화면 루트 컨테이너 (아래 "화면 컨테이너")
  YGScreen.kt             Surface 래퍼 + YGScreenScope 리시버 (화면 최외곽)
  YGScaffold.kt           Material3 Scaffold 래퍼 (nav/EntryBuilder)
  YGScreenScope.kt        YGScreenScope + OnBack(@Composable, BackHandler 래핑)
res/font/                 ← suit_regular/medium/semi_bold/bold.ttf
res/drawable*/            ← ic_* 아이콘 + 밀도별 PNG 세트(#218로 A-002 온보딩 일러스트 `image_onboarding_*` 추가)
```

> **에셋 소유가 갈린다** — 화면 전용 이미지가 여기 들어오는 경우(A-002 온보딩 일러스트)와 해당 feature
> 모듈 `res/`에 두는 경우(같은 화면의 카카오·애플 로고 벡터)가 공존한다. 기준이 문서에 없다
> → [open-questions](../synthesis/open-questions.md) [2026-08-11].

## 테마 접근 규약

- 테마 값은 **항상 `YGTheme.*`로 읽는다**: `YGTheme.colorScheme` / `.typography` / `.shapes` / `.layout`. 전부 `@Composable @ReadOnlyComposable`.
  - 예: `YGTheme.typography.body.b01SB`, `YGTheme.layout.padding.padding4`, `YGTheme.shapes.radius.round`.
- **크기만 예외**: `SizeTokens.Size24.getDp()`로 직접(`SizeToken`은 `@JvmInline value class`, 홀더 밖).
- `Local*` CompositionLocal은 `internal` + 미초기화 시 `error(...)`. → **모든 UI·프리뷰는 `YGCustomTheme { }`로 감싸야** 크래시 안 남.
- **원자 색 직접 참조 — develop 실질 허용(#158 이후)** — 컴포넌트 대부분(`YGButton`·`YGActionItem`·`YGIconButton`·`YGInputNumber`·`YGChipButton`·`YGModalPopup`·`YGInviteCard`·`YGNametagChip`·`YGTopBar`·`YGDateButton`·`YGDate`·`YGLabel`·`YGDangerZone`·`YGAlert`·`YGToast`, #183·#185·#186 신설 12종 포함)이 시맨틱(`YGTheme.colorScheme`) 대신 `YGAtomicColors`를 직접 참조. 원래 규칙은 "시맨틱만 읽고 `YGAtomicColors`는 `internal`+시맨틱 매핑에서만 소비"였으나 —
  > ✅ **방향 전환 머지됨(#158, develop `ce4e9b8`, 2026-07-19)** — `YGAtomicColors` **`internal`→public**. "원자 직접 참조 금지"의 강제 메커니즘(외부 모듈 접근 차단)이 사라지고 원자 색이 실질 SoT가 됨. [ADR-0010](../adr/0010-custom-compositionlocal-theme.md) "시맨틱 우선" 원칙 재검토/신규 ADR 필요(잔존) → [open-questions](../synthesis/open-questions.md).

## 토큰 계층

| 축 | 홀더 | 스케일(심볼) | 기본값 제공 |
|---|---|---|---|
| 색 | `YGColorScheme` | primary/secondary/tertiary + danger/warning/success/info + grayScale/transparency | `YGSemanticColorDefaults` |
| 타이포 | `YGTypography` | title/body/caption 그룹, 각 웨이트·크기 변형(`b01B/b01SB/b01R/b02...`) | `YGTypographyDefaults` |
| 모양 | `YGShapes.radius`(`YGShapeRadius`) | none/xSmall/small/medium1/medium2/large/xLarge1/xLarge2/round (`none`=RectangleShape 각짐, #159 develop 머지) | `YGShapesDefaults` |
| 레이아웃 | `YGLayout.gap`/`.padding` | gap1.. / padding1.. (명명 스케일) | `YGLayoutDefaults` |
| 크기 | `SizeTokens`(홀더 밖) | Size1/2/4/6/…/44/48/64/80 + Size18·Size28(#183)·Size96·Size160(#186) (`SizeToken`) | — |

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
  - `YGButtonType.kt` — `sealed interface`로 변형(variant) 정의. 각 변형이 자기 토큰(패딩·textStyle·iconSize·gap·colors)을 `@get:Composable`로 노출. 현재 변형: `SmallSquare`/`Medium.{Primary,Secondary,Transparency}`/`Large`. (fix/ygbutton **#140 develop 머지**로 `XSmall`/`Small` 제거. `SmallSquare` radius는 **#159로 `radius.none`(각짐)** 적용, **#183으로 `Medium.*`·`Large`도 `radius.none`** + `iconSize` `Size20` 교정 — 그전까지 `iconSize`는 렌더에 쓰이지 않는 死필드였다.)
    > ⚠️ **radius 속성 삭제(#182 develop 머지, 2026-08-01, 카메라 화면 PR)** — `YGButtonType.radius`가 통째로 제거되고 `YGButton`의 `background`·`border` `shape` 인자와 `clip`도 빠졌다. 전 변형이 `radius.none`이던 터라 렌더 결과는 같지만, **각짐이 토큰 경유에서 "shape 미지정 기본값"으로 되돌아갔다** — #159·#183이 세운 원칙과 어긋나고 변형별 곡률이 다시 필요해지면 속성을 되살려야 한다 → [open-questions](../synthesis/open-questions.md) [2026-08-01].
  - `YGButtonColors.kt` — 상태별 색 묶음 data class(enabled/disabled/pressed × foreground/background/**border**). (#140에서 `borderColor` 제거·`iconColor`→`foregroundColor` 통합 → **#183으로 테두리 3필드(기본 투명) + `borderColor()` 복원**, `Medium.Secondary`만 값을 채운다. `iconColor` 통합은 유지.)
  - `YGButtonPreviewData.kt` — 프리뷰용 데이터.
- **토큰 참조**: 변형 내부에서 `YGTheme.layout.padding.*`, `YGTheme.shapes.radius.*`, `YGTheme.typography.body.*`, `SizeTokens.*.getDp()`로 읽는다.
- **프리뷰**: `YGCustomTheme { }`로 감싼다(Local 미초기화 크래시 방지). Coil 프리뷰는 `YGCustomTheme`이 `LocalAsyncImagePreviewHandler`를 이미 심음.

> **Assumption / 과도기** — `YGButtonType`의 각 변형 `colors`가 시맨틱(`YGTheme.colorScheme`) 대신 `YGAtomicColors`를 직접 참조하고, 값이 잠정(mock)이다. 코드 주석("Design Token 규칙이 조금 이상… 컴포넌트 완성 시점에 문의 예정")대로 **확정 전 상태**. 이 원자 직접 참조는 `YGButton`에 국한되지 않고 이후 대부분 컴포넌트(`YGActionItem`·`YGIconButton`·`YGInputNumber`·`YGChipButton`·`YGModalPopup`·`YGInviteCard`·`YGNametagChip`·`YGTopBar`·`YGDateButton`·`YGDate`·`YGLabel`·`YGDangerZone`·`YGAlert`·`YGToast`, #183 신설 버튼 5종·#185 캔버스 5종·#186 칩/토핑 2종, 대체로 `YGAtomicColors.Gray.*`·`Cherry.*`·`Melon.*`·`Pudding.*`·`Transparency.*`)로 확산됨. 확정 시 시맨틱으로 정리 권장. → [open-questions](../synthesis/open-questions.md) 후보.

## 화면 컨테이너 (`screen/`)

화면 루트에 쓰는 컨테이너 2종 + 뒤로가기 스코프. 설계 상세 → [designsystem-ygscreen-scaffold 스펙](../specs/archive/2026-07-20-designsystem-ygscreen-scaffold.md).

- **역할 분리 (컨벤션)**:
  - **`YGScaffold` = nav 레벨(EntryBuilder)** — `entry<NavKeyXxx> { YGScaffold { innerPadding -> XxxRoute(...) } }`. Material3 `Scaffold` 얇은 래퍼(기본 배경 흰색, `contentWindowInsets` 노출). TopBar/BottomBar/inset이 필요한 엔트리 컨테이너. → [navigation-flow](navigation-flow.md) 체크리스트.
  - **`YGScreen` = 화면 최외곽(Screen 컴포저블)** — `internal fun XxxScreen(...) { YGScreen(modifier = modifier) { ... } }`. `Surface` 래퍼(`modifier` + `content`만) + `YGScreenScope` 리시버. `Surface`는 `color`를 항상 칠하므로(기본 Material surface 불투명) 내부 `color = YGAtomicColors.Gray.Transparent` 고정 → 배경 미페인트, 실제 배경은 nav의 `YGScaffold` containerColor가 담당(레이어 분리). 화면 `modifier`는 `YGScreen`에 전달(관례).
- **뒤로가기**: `YGScreen`의 content는 `YGScreenScope` 리시버라 `OnBack(enabled, handler) { }`(@Composable, 내부 `BackHandler` emit)로 처리. 호출한 화면만 back 가로챔 — 안 쓰면 안 부르면 됨(강제 리턴 없음). `OnBack`은 @Composable node-emit이라 PascalCase(`BackHandler` 동일 규칙).
- **배경 탭 포커스 해제는 컨테이너 책임이 아니다 (🔁 2026-08-03)**: `YGScreen`은 포커스 관심사를 갖지 않는다. 텍스트 입력이 있는 화면이 `YGScreen(modifier = modifier.clearFocusOnTap())`처럼 **직접 opt-in**한다(`core:util:android` `focus/`, 상세 → [clearfocusontap-modifier 스펙](../specs/archive/2026-08-03-clearfocusontap-modifier.md), PR #192 develop 머지). `YGScreen`에 `clickableYGNoRipple { clearFocus() }`를 상시 결선했다가 철회한 이유는 두 가지 — ① `Modifier.clickable`은 `role = null`이어도 semantics에 `onClick` action과 focus target을 추가해 **컨테이너를 쓰는 모든 화면의 배경 전체**가 접근성 서비스에 인터랙티브 요소로 노출된다, ② 컨테이너 선택과 "입력이 있는가"는 직교하는 축이라 컨테이너에 묶으면 입력 없는 화면이 비용만 지고 `YGScreen`을 안 쓰는 입력 화면은 혜택을 못 받는다. **동작만 있고 시각 표현이 없는 관심사는 DS 컨테이너가 아니라 `core:util:android` 유틸로 둔다**가 일반 규칙.
  결선 도입·철회는 둘 다 S-002 브랜치 안에서 일어나 develop의 `YGScreen`은 한 번도 결선을 가진 적이 없다. 다만 철회 잔여물인
  `clickableYGNoRipple`(사용처 0)은 develop에 남았다 → [open-questions](../synthesis/open-questions.md) [2026-08-03].
- **주의**: 현재 `YGScreen`↔`YGScaffold` 미통합(`YGScaffold`는 `YGScreenScope`/OnBack 없음). 통합·역할 정리는 [open-questions](../synthesis/open-questions.md) 미결(머지 후 ADR 예정).

## 컴포넌트 인벤토리

구현된 `component/*` 컴포넌트와 상세 설계(스펙). 심볼명 기준(개수·라인 미기재).

| 컴포넌트 | 패키지 | 스펙 |
|---|---|---|
| `YGButton` | `component/ygbutton/` | (레퍼런스, 스펙 이전) |
| `YGTextField` / `YGTextFormField` | `component/textfield/` | [ygtextfield](../specs/archive/2026-07-10-ygtextfield.md) · [ygtextformfield](../specs/archive/2026-07-10-ygtextformfield.md) |
| `YGHorizontalDivider` / `YGHorizontalDashedDivider` / `YGListItem` | `component/etc/` | [yghorizontaldivider](../specs/archive/2026-07-12-yghorizontaldivider.md) · [ygdangerzone-dashed](../specs/archive/2026-07-19-ygdangerzone-dashed.md)(점선 구분선) · [yglistitem](../specs/archive/2026-07-12-yglistitem.md) |
| `dashedBorder()` Modifier | `border/` | [ygdangerzone-dashed](../specs/archive/2026-07-19-ygdangerzone-dashed.md) |
| `YGIconButton`(+`YGIconButtonSize`) | `component/ygiconbutton/` | [ygiconbutton](../specs/archive/2026-07-12-ygiconbutton.md) |
| `YGActionItem`(#183로 `iconResource` 선두 아이콘 변형 신설) | `component/ygactionitem/` | [ygactionitem](../specs/archive/2026-07-12-ygactionitem.md) |
| `YGInputNumber`(+`YGInputNumberPreviewData`) | `component/yginputnumber/` | [yginputnumber](../specs/archive/2026-07-13-yginputnumber.md) |
| `YGChipButton`(+`YGChipButtonColors`·`YGChipButtonColorsDefaults`) | `component/ygchipbutton/` | [ygchipbutton](../specs/archive/2026-07-16-ygchipbutton.md) |
| `YGInviteCard`(+`YGInviteCardStatus`) | `component/card/` | [yginvitecard](../specs/archive/2026-07-14-yginvitecard.md) |
| `YGModalPopup` | `component/modal/` | [ygmodalpopup](../specs/archive/2026-07-15-ygmodalpopup.md) |
| `YGNametagChip`(+`YGNametagChipStyle`·`YGColorChipType`·`YGNametagChipPreviewData`) / `YGUserChip`(+`YGUserNameStyle`) / `YGChipColorIndicator` | `component/ygcolorchip/` | [ygcolorchip](../specs/archive/2026-07-18-ygcolorchip.md) |
| `YGDate` / `YGLabel` | `component/ygtext/` | [ygtext-date-label](../specs/archive/2026-07-18-ygtext-date-label.md) |
| `YGAlert`(+`YGAlertPolicy`·`YGAlertHost`·`YGAlertItem`·`rememberYGAlertPolicy`) | `component/ygalert/` | [ygalert](../specs/archive/2026-07-23-ygalert.md) |
| `YGToast`(+`YGToastType`·`YGToastPolicy`·`YGToastHost`·`YGToastItem`·`rememberYGToastPolicy`) | `component/ygtoast/` | [ygtoast](../specs/archive/2026-07-23-ygtoast.md) |
| `YGTopBar`(Back/Detail/Empty/Canvas 변형 + private `YGTopBarContent`·`ygTopBarBackdrop` + `YGTopBarDefaults`) | `component/ygtopbar/` | [ygtopbar](../specs/archive/2026-07-18-ygtopbar.md)(최초 계약) · [designsystem-bar-listdate-components](../specs/archive/2026-08-01-designsystem-bar-listdate-components.md)(Canvas·날짜·블러) |
| `YGListDate` | `component/yglistdate/` | [designsystem-bar-listdate-components](../specs/archive/2026-08-01-designsystem-bar-listdate-components.md) |
| `YGFloatingBar{BackClose,Close,Edit,EditTab}` | `component/ygfloatingbar/` | [designsystem-bar-listdate-components](../specs/archive/2026-08-01-designsystem-bar-listdate-components.md) |
| `YGDateButton` | `component/ygdatebutton/` | [ygdatebutton](../specs/archive/2026-07-18-ygdatebutton.md) |
| `YGDangerZone` | `component/ygdangerzone/` | [ygdangerzone-dashed](../specs/archive/2026-07-19-ygdangerzone-dashed.md)(현행 점선, #159) · [ygdangerzone](../specs/archive/2026-07-18-ygdangerzone.md)(구 solid, superseded) |
| `YGCircleButton`(+`YGCircleButtonType`) | `component/ygcirclebutton/` | [designsystem-button-missing-components](../specs/archive/2026-07-30-designsystem-button-missing-components.md) |
| `YGEditButton` | `component/ygeditbutton/` | [designsystem-button-missing-components](../specs/archive/2026-07-30-designsystem-button-missing-components.md) |
| `YGEditTabButton` | `component/ygedittabbutton/` | [designsystem-button-missing-components](../specs/archive/2026-07-30-designsystem-button-missing-components.md) |
| `YGEditActionButton` | `component/ygeditactionbutton/` | [designsystem-button-missing-components](../specs/archive/2026-07-30-designsystem-button-missing-components.md) |
| `YGCameraShutter` | `component/ygcamerashutter/` | [designsystem-button-missing-components](../specs/archive/2026-07-30-designsystem-button-missing-components.md) |
| `YGCanvas`(+`YGCanvasBackground`) | `component/ygcanvas/` | [designsystem-canvas-components](../specs/archive/2026-07-31-designsystem-canvas-components.md) |
| `YGCanvasMenu`(+`YGCanvasMenuAction`·`YGCanvasMenuItem`) | `component/ygcanvasmenu/` | [designsystem-canvas-components](../specs/archive/2026-07-31-designsystem-canvas-components.md) |
| `YGCanvasDateSelectButton` | `component/ygcanvasdateselect/` | [designsystem-canvas-components](../specs/archive/2026-07-31-designsystem-canvas-components.md) |
| `YGStrokeButton` / `YGMenuItem` | `component/ygstrokebutton/` · `component/ygmenuitem/` | [designsystem-canvas-components](../specs/archive/2026-07-31-designsystem-canvas-components.md) |
| `canvasCutCornerShape()` | `shape/` | [designsystem-canvas-components](../specs/archive/2026-07-31-designsystem-canvas-components.md) |
| `ygBackgroundDotGrid()`(Modifier) | `component/ygbackgrounddotgrid/` | [c001-canvas-main](../specs/archive/2026-08-12-c001-canvas-main.md) |
| `YGGrouptagChip`(+`YGGrouptagChipType`) | `component/yggrouptagchip/` | [designsystem-grouptag-topping-components](../specs/archive/2026-07-31-designsystem-grouptag-topping-components.md) |
| `YGToppingGroup`(+`YGToppingGroupType`·`YGToppingImage`·`YGToppingTemplate`) | `component/ygtoppinggroup/` | [designsystem-grouptag-topping-components](../specs/archive/2026-07-31-designsystem-grouptag-topping-components.md) |
| `YGScreen` / `YGScaffold`(+`YGScreenScope`·`OnBack`) | `screen/` | [designsystem-ygscreen-scaffold](../specs/archive/2026-07-20-designsystem-ygscreen-scaffold.md) (위 "화면 컨테이너") |

- **`YGIconButton` = 공통 아이콘 버튼**: 정사각 컨테이너 + 중앙 아이콘 + enabled/pressed tint, 크기 프리셋 enum(`YGIconButtonSize` — `SIZE_48` 아이콘 크기는 #183에서 교정). `YGTextField`의 clear 아이콘은 이미 인라인 `Box`+`Image`에서 `YGIconButton(size = YGIconButtonSize.SIZE_44)`로 치환됨(`YGTextFieldImpl.kt`). `YGListItem` trailing caret도 `YGIconButton`으로 치환(#136 develop 머지 #148).
- **`YGInputNumber`**: 숫자 셀. 컨테이너 크기·보더는 토큰 대신 고정 dp로 하드코딩(코드 주석: 디자인가이드 고정 크기)이라 토큰화 예외 사례. **각짐 sync(#183)** — 배경·`clip`·테두리 3곳 모두 `radius.none`. shape·typography는 `YGTheme.*` 사용, 색은 `YGAtomicColors.Gray.*` 직접 참조.
- **`YGChipButton`**: pill(`shapes.radius.round`) 칩 버튼. text + 선택 start/end 아이콘, 아이콘 유무로 좌/우 패딩 비대칭. **Colors 패턴 준수** — `YGChipButtonColors`(@Immutable, default/pressed×fg/bg/border) 주입 + `YGChipButtonColorsDefaults` 프리셋(**#183으로 `CherrySubtle`·`CherrySolid` 재명명**, **#188로 `CherrySubtle`→`GrayOutline` 교체·개명**(Figma `Button-Chip-Left`가 Cherry 계열 → 흰 배경 + 회색 테두리로 바뀌어 값과 이름을 함께 갈았다. 프리셋 하나를 고치자 소비처 6곳이 따라오며 G-001 칩 드리프트도 닫혔다) — Figma `Button-Chip-Left`/`Right`를 KDoc으로 병기. 세로 패딩도 #183에서 `padding2`로 내려 `YGAlert`·`YGTopBar` 높이에 전파). pressed 분기(아래 관용구). 프리셋 색은 `YGAtomicColors` 직접 참조(과도기).
- **`YGToggleButton` 삭제(#183 develop 머지, 2026-08-01)**: 대응 Figma 원본이 없고 실화면 사용처가 0건이라 제거했다(대체물은 신설 `YGEditButton`). `component/ygtogglebutton/` 2파일 + `:app-preview` 잔재까지 함께 지웠고, 이로써 [2026-07-16 규약 이탈 항목](../synthesis/open-questions.md)이 해소됐다.
- **화면 적용(#182 develop 머지, 2026-08-01)**: C-101 카메라·C-101-confirm·갤러리 화면이 `YGCameraShutter`·`YGCircleButton`(플래시·전환·닫기)·`YGButton`·`YGDate`·`YGToast` 호스트를 쓰면서 feature 로컬 임시 셔터·flip 구현이 삭제됐다 — **셔터 2구현 공존 해소**([2026-07-30 항목](../synthesis/open-questions.md)). `YGToastPolicy`/`YGToastHost`의 첫 실사용처이기도 하다(촬영 가이드 토스트) → [c101 스펙](../specs/archive/2026-08-01-c101-camera-picture-confirm.md).
- **화면 적용(#218 develop 머지, 2026-08-11)**: A-002 로그인이 실물화되면서 `KakaoSignInButton`이 `RoundedCornerShape` 리터럴 → `YGTheme.shapes.radius.none`, 리터럴 dp 패딩 → `YGTheme.layout.padding.*`, 라벨 타이포 → `YGTheme.typography.body.b01SB`로 토큰화됐다. 다만 **버튼 자체는 DS 컴포넌트가 아니라 feature 로컬 Material3 `Button`**이고(외부 로그인 가이드 색을 따라야 해서 `YGButton` 변형에 안 맞는다), 주입한 `ButtonColors.contentColor`는 내부 `Text`가 색을 명시해 死필드다. 같은 화면 `PagerIndicator`의 활성/비활성 색은 여전히 리터럴이다 → [a002-login-onboarding 스펙](../specs/archive/2026-08-11-a002-login-onboarding.md).
- **버튼 신설 5종**(#183, `ygcirclebutton`·`ygeditbutton`·`ygedittabbutton`·`ygeditactionbutton`·`ygcamerashutter`): `YGCircleButton`만 변형 타입(`YGCircleButtonType`)이 색·아이콘 크기·tint·`paintsOuterCircle`을 들고(단 `@Immutable` + 평범한 `val`이라 `YGButtonType`의 `@get:Composable` 패턴과 갈린다), 나머지 4종은 컴포저블 본문 상태 분기다. Colors data class는 5종 모두 미분리 — 규약과 갈리는 판단(→ [open-questions](../synthesis/open-questions.md)). 선택형(`YGEditButton`·`YGEditTabButton`)은 `selectable`(`Role.Button`/`Role.Tab`), 나머지는 `clickable(indication = null)` + `role = Role.Button`. 밑줄 폭은 `width(IntrinsicSize.Max)`로 텍스트에 묶는다.
- **캔버스 5종 + 컷 도형**(#185, `ygcanvas`·`ygcanvasmenu`·`ygcanvasdateselect`·`ygstrokebutton`·`ygmenuitem` + `shape/`): `YGCanvas`가 배경(`YGCanvasBackground` sealed — `Solid`/`Image`+Coil)·토핑 `BoxScope` 슬롯·날짜바·메뉴·Dim을 합성한다. Figma 5상태를 단일 enum이 아니라 **직교 불리언 플래그**(`isDimmed`·`isMenuExpanded`·`isEmpty`·`isCalendarVisible`)로 표현하고, 값 파라미터는 내용만 든다(모순 조합 방지는 호출자 책임). Dim은 항상 최상단에서 아래 레이어 터치를 **소비**하고 확장 메뉴·캘린더만 그 위로 승격하며, 승격 시 `Spacer(Size44)`로 총높이를 유지한다. 좌상단 컷 실루엣은 배경·날짜바·Dim이 공유하므로 `shape/canvasCutCornerShape()`로 분리했다(`border/`와 같은 "컴포넌트 아닌 그리기 프리미티브" 층위). 높이 44는 패딩 도출 대신 `SizeTokens.Size44` 고정. **첫 소비 화면(#199 develop 머지, 2026-08-11)** — C-001이 임시 `Button` 2개를 걷어내고 이 5종을 쓰면서 세 가지가 바뀌었다. ① `YGCanvas`가 **반응형 배치를 흡수**했다(`BoxWithConstraints` + private `calculateCanvasLayoutMetrics` — 좌우 패딩·상하 최소 gap·세로 중앙·세로 부족 시 축소가 컴포넌트 안으로 들어와 전제가 `fillMaxWidth`에서 `fillMaxSize`로 바뀌었다. 위키 [[캔버스-반응형-레이아웃]]의 크기·위치 우선순위를 컴포넌트가 구현한다). ② Dim 탭 닫기가 **컴포넌트 API로** 열렸다(`onDimClick`, 구현은 소비 전용 `pointerInput` → `clickable(indication = null)`이라 터치 소비는 유지) → [2026-08-01 항목](../synthesis/open-questions.md) ① 해소. ③ 인접 테두리를 `spacedBy(-1.dp)`로 겹쳐 접합선이 2dp에서 1dp가 됐다(스펙이 "그대로 둔다"고 적었던 것을 뒤집음). 화면 배경 점 격자는 `YGCanvas` 밖 `Modifier.ygBackgroundDotGrid()`로 신설됐다 → [c001-canvas-main 스펙](../specs/archive/2026-08-12-c001-canvas-main.md).
- **`YGGrouptagChip` / `YGToppingGroup`**(#186, G-001 그룹 목록용): 칩은 이름+구분점+상대시간 pill이고 `YGGrouptagChipType` 6종이 **타임스탬프 색만** 결정한다(Nametag용 `YGColorChipType`과 매핑이 별개라 타입도 분리). `YGToppingGroup`은 160dp 프레임에 96dp 토핑을 회전·오프셋으로 얹고 칩을 겹치며 **클리핑·`onClick`이 없다**(오버플로우 허용, 터치 범위는 호출자가 `clickableYG`로 감쌈). 대체 그래픽 정책은 갖지 않고 `YGToppingImage` 3상태(`Remote`/`Template`/`Error`)를 주입받아 렌더만 한다. 고정폭 프레임이 칩에 **측정** 제약을 내리므로 칩에 `wrapContentWidth(unbounded = true)`, 비정사각 원격 이미지 때문에 `rotate` **안쪽**에 `clip(RectangleShape)`가 필요하다(둘 다 실기기 검증에서 드러난 조건). **첫 소비처(#194 develop 머지, 2026-08-07)** — G-001이 `YGToppingGroup`을 그리기 시작했다. 다만 ① 호출부가 `clickableYG`로 감싸지 않아 토핑 클릭 경로가 없고, ② `YGToppingImage`는 `Remote`만 쓰여 템플릿·에러 분기가 화면 선택으로 들어오지 않았으며(에러는 `AsyncImage(error = …)` 폴백으로만 그려짐), ③ `chipType`이 전 항목 동일 값 고정이라 위키 [[S-101-프로필-닉네임-컬러-규칙-v0.3]] 매핑이 미구현이다 → [g001-group-list 스펙](../specs/archive/2026-08-01-g001-group-list.md) · [open-questions](../synthesis/open-questions.md) [2026-08-07]. 배치(지그재그·인셋·저개수 규칙)는 컴포넌트가 아니라 화면의 `ToppingLayout`이 쥔다.
- **이미지 로딩**: Coil 3. `coil-compose`에 더해 **`coil-network-okhttp`가 `build-logic` `ComposeConfig`에 추가됨(#186)** — 그전까지 네트워크 페처가 없어 원격 URL이 아예 로드되지 않았다(로컬 MediaStore URI만 쓰던 탓에 드러나지 않았다). `YGToppingGroup.Remote`·`YGCanvasBackground.Image`가 이 의존에 걸린다.
- **`YGModalPopup`**: Compose `Dialog` 위 중앙 팝업. 아이콘+제목+본문 + 2버튼(`YGButton.Medium.Secondary` 좌/`Primary` 우, `weight(1f)` 균등). 버튼 confirm/cancel 의미 미규정(타입만 노출), 단일 `isEnabledButton`. 프리뷰 `@YGPreview`/`PreviewBox`.
- **`YGInviteCard`**(+`YGInviteCardStatus` enum): 그룹 초대 코드 카드. Active/Invalid 상태로 border·subText·코드박스 배경·복사 버튼 활성 분기. 복사 버튼은 `YGButton.SmallSquare` 재사용. **각짐 sync(#159)** — 테두리 `shape`·`.clip`·`InviteCodeBox` clip 모두 `radius.none`. 프리뷰 `@YGPreview`/`PreviewBox`.
- **`YGTextField` / `YGTextFormField`**(`component/textfield/`): 단일 폼 + errorDescription 확장. **각짐/배경 sync(#159)** — 공통 `commonShape` = `radius.none`(각짐), 배경 = `grayScale.white`(불투명, 구 `transparency.white75`에서 변경). clear 아이콘은 `YGIconButton` 재사용. 🔁 **S-101 라운드 확장 2건(미머지)** — ① `YGTextFormField`·`YGTextFieldImpl`에 `keyboardOptions`·`keyboardActions`를 기본값(`KeyboardOptions.Default`·`KeyboardActions.Default`)과 함께 노출해 `BasicTextField`로 전달한다(키보드 엔터로 확정을 받으려면 통로가 필요했다. 기존 호출부는 전부 named argument라 무영향). ② `YGTextFieldImpl`에 `defaultMinSize(minHeight = SizeTokens.Size48.getDp())`를 체인 맨 앞에 걸어 **최소 높이 48 고정** — `showClear`일 때 상하 패딩이 `padding5`→`padding1`로 줄고 44dp 아이콘 버튼이 들어오는 구조라 클리어 버튼 등장·소멸마다 행 높이가 재계산돼 필드가 들썩였다.
- **`YGNametagChip`**(+`YGNametagChipStyle`·`YGColorChipType`): 원형 네임태그 컬러칩. `YGColorChipType`이 fill/stroke/text 색을, `YGNametagChipStyle`(`Style28`/`Style40`)가 지름·테두리·타이포를 고정. 위키 정책 [[nametag-chip]] 구현체. **개명·정리(#165 develop 머지, 2026-07-31)** — 구 `YGColorChip`/`YGColorChipStyle`/`text` 파라미터 → `YGNametagChip`/`YGNametagChipStyle`/`userFirstName`, **패키지↔폴더 불일치 해소**(전 파일 `…component.ygcolorchip`). 🔁 **타입 개수 정정(S-101 라운드, 미머지)** — 구 14종(`NametagChip1~13`+`Plus`)에서 **12종 + `Plus`** 로 정렬했다. `NametagChip11`이 `NametagChip3`과 완전 중복이라 뒤가 한 칸씩 밀려 있었고 `NametagChip9`의 글자색이 테두리색과 같았다(Figma는 `Pudding500`). Figma 컴포넌트셋 `144:5415`가 정본이고 위키 정책 12종이 맞았다 → [open-questions](../synthesis/open-questions.md) [2026-07-18] 해소.
- **`YGUserChip`**(+`YGUserNameStyle`) / **`YGChipColorIndicator`**(#165 신설, 같은 패키지): `YGUserChip` = `YGNametagChip` + 이름 텍스트 `Row`(`gap3`, 수직 중앙), 이름 프리셋 `StyleMedium`/`StyleBold`가 타이포+Gray 색을 고정. `YGChipColorIndicator` = `isChecked`로 Cherry ↔ 투명 분기하는 작은 원(꺼짐에도 자리 유지). 둘 다 `:app-preview` 갤러리 미등록·feature 참조 0건이고, 인디케이터는 대응 위키 정책 문서가 없다(C-201 Chip-Indicator와 별개) → [open-questions](../synthesis/open-questions.md). 상세 [ygcolorchip](../specs/archive/2026-07-18-ygcolorchip.md).
- **`YGDate` / `YGLabel`**(`component/ygtext/`): 타이포+색 프리셋 텍스트 래퍼. **`YGDate` 재설계(#149 develop 머지)** — `YGDate(text)`→`YGDate(date, day)` 2텍스트 `Row`(테두리 `border(0.75dp, Gray800)`)로 변경, 패딩은 하드코딩→`YGTheme.layout.padding.*` 토큰화(구 토큰 예외 해소). ⚠️ **#182(카메라 PR)에서 `background`가 `border` 뒤에 한 번 더 추가**돼 modifier 그리기 순서상 테두리를 덮는다(체인: 배경→테두리→배경). C-101 상단 날짜 라벨이 첫 실사용처다 → [open-questions](../synthesis/open-questions.md) [2026-08-01]. 상세 [ygtext-date-label](../specs/archive/2026-07-18-ygtext-date-label.md).
- **`YGAlert` / `YGToast`**(노출 정책 패턴, #149 develop 머지): 상단 배너/토스트. **표시 컴포저블 + `*Policy`(상태 홀더) + `*Host`(자동 소멸·위로 스와이프 닫기·슬라이드 애니메이션) 분리**가 공통 관용구. 화면은 `remember*Policy()` 후 `show()`만, Host가 렌더/소멸 담당. `YGAlert`=단일 슬롯(새 show가 대체), `YGToast`=다중 스택(`add(0,…)` 최신 위로). `YGToast`는 `YGToastType`(InviteCode/Edit/Record) sealed로 색/구성 분기, 노출 동작은 위키 [[Toast-공통-정책]] 일치. 상세 [ygalert](../specs/archive/2026-07-23-ygalert.md)·[ygtoast](../specs/archive/2026-07-23-ygtoast.md).
- **`YGTopBar`**: 상단 바 4변형(Back/Detail/Empty/Canvas) 공유 레이아웃 private `YGTopBarContent`. 좌측 `YGIconButton.SIZE_44` + 안쪽 `weight(1f)` 타이틀 슬롯 + (Canvas만) 바깥 `trailingContent`. **변형 통합(#173 develop 머지, 2026-08-01)** — `YGTopBarDefault`(로고 + "새 그룹" 칩 하드결선)가 삭제되고 `YGTopBarEmpty`가 `rightContent` 슬롯을 받아 흡수했다. 칩 색·문구는 호출 화면이 정한다 → [g001-group-list 스펙](../specs/archive/2026-08-01-g001-group-list.md). **Canvas 변형·날짜·배경 블러(#188 develop 머지, 2026-08-04)** — ① `YGTopBarCanvas` 신설(사방 `padding3` + 멤버 슬롯 + 우측 메뉴, List-Member는 컴포넌트가 아니라 호출자 조립), ② `YGTopBarContent`에 `contentPadding`·`trailingContent` 추가(기본값이 기존 동작과 같아 나머지 변형 무영향, `trailingContent`는 `weight(1f)` Row **바깥** 형제라 `Empty`의 `rightContent`(안쪽 형제)와 측정 의미가 다르다 → [open-questions](../synthesis/open-questions.md)), ③ `YGTopBarEmpty`의 로고 `ic_plus` placeholder가 **날짜 2텍스트**(`date`·`day`)로 교체돼 placeholder todo가 닫혔다, ④ 반투명 `White75` + **배경 블러**가 private `Modifier.ygTopBarBackdrop(hazeState)`로 들어갔다(`null`이면 틴트만, 반경은 `YGTopBarDefaults.BackdropBlurRadius`) → [ADR-0018](../adr/0018-backdrop-blur-haze.md). 프리뷰 칩 색 드리프트도 프리셋 교체(`GrayOutline`)로 함께 해소됐다. 상세 [designsystem-bar-listdate-components](../specs/archive/2026-08-01-designsystem-bar-listdate-components.md). **상단 인셋 흡수(#194 develop 머지, 2026-08-07)** — `YGTopBarEmpty`가 `windowInsets: WindowInsets = YGTopBarDefaults.windowInsets`(= `WindowInsets.statusBars`, `@Composable` getter)를 받아 `windowInsetsPadding`으로 직접 흡수한다. 배경(`ygTopBarBackdrop`)이 인셋 패딩보다 **바깥** 체인이라 틴트·블러가 상태바 영역까지 덮는다. 호출 화면은 `edgeToEdge` 대응을 안 하는 대신 `YGScaffold`에서 상단을 빼야 하고(G-001은 `systemBars.only(Horizontal + Bottom)`), 인셋이 필요 없으면 `WindowInsets(0)`을 주입한다(`:app-preview` 3곳). **4변형 중 `Empty`만** 이 파라미터를 갖고, 화면 쪽 인셋 관용구가 3형태로 갈렸다 → [open-questions](../synthesis/open-questions.md) [2026-08-07]. **`Canvas` 변형 첫 소비처(#199 develop 머지, 2026-08-11)** — C-001이 그룹명 + `memberContent` 슬롯(멤버 칩 최대 5 + `NametagChipPlus` `+N`, 겹침은 화면이 정한 리터럴) + 햄버거로 조립한다. `windowInsets`가 없는 변형이라 엔트리 `YGScaffold` 기본 인셋을 쓰고, 그 탓에 같은 화면의 배경 점 격자가 상태바·내비게이션 바 영역을 못 덮는다 → [c001-canvas-main 스펙](../specs/archive/2026-08-12-c001-canvas-main.md).
- **`YGListDate` / `YGFloatingBar`**(#188 신설): `YGListDate` = `YGDateButton`(`Size44`) + `YGChipColorIndicator`를 `gap1`로 쌓은 C-201 날짜 셀. 업로드 점은 미체크 시 투명이라 **자리를 유지한 채 비노출**(셀 높이 불변)이고, "Button-Date가 Disabled면 인디케이터 항상 False"라는 위키 [[캘린더-컴포넌트]] 예외를 **컴포넌트가 내부에서 강제**한다(`isEnabled && isUploaded`) — 정책 예외를 호출부에 맡기지 않는 선례. `YGFloatingBar*`는 변형별 공개 함수 4종이 private `YGFloatingBarContent`(가로 `padding7`·상 `padding6`)를 공유하고, 자식이 하나뿐인 `Close`만 `Arrangement.End`다(`SpaceBetween`이면 좌측에 붙는다). 반복되는 닫기·확인 버튼은 파일 안 private 컴포저블로 묶었다. 폭은 컴포넌트가 정하지 않고 호출자 `modifier` 몫이라 **화면 배치 책임이 밖에 있다**(실사용처 아직 0건 → [open-questions](../synthesis/open-questions.md)).
- **배경 블러 의존 `dev.chrisbanes.haze`**(#188): `gradle/libs.versions.toml` + `build-logic` `ComposeConfig`에 배선돼 Compose 모듈 전역에 깔린다(`coil-compose`와 같은 자리). 소스가 `Modifier.hazeSource(state)`, 소비 표면이 `Modifier.hazeEffect(state)`이고 **`HazeState`는 호출 화면이 소유**한다. `RenderEffect` 기반이라 **API 31 미만에서는 블러 없이 틴트만** 남는다(`minSdk` 26). 자체 `GraphicsLayer` 구현이 기각된 경위와 실측은 [ADR-0018](../adr/0018-backdrop-blur-haze.md) — 프로젝트에 블러 관용구가 둘(배경=Haze / 자기 자식=C-101 자체 구현) 존재한다 → [open-questions](../synthesis/open-questions.md).
- **`YGDangerZone`**: 상/하 2슬롯 + 사이 구분선 컨테이너, `IntrinsicSize.Max`. **점선 재설계(#159 develop 머지)** — 반투명 채움 → `dashedBorder()`(gray-100 점선 테두리) + 세로 패딩, 구분선은 solid `YGHorizontalDivider` → `YGHorizontalDashedDivider`(gray-100 점선). modifier 체이닝 `dashedBorder().padding()` 순서 규칙(테두리 최외곽 → 안쪽 패딩). 슬롯에 대개 `YGActionItem` 주입(로그아웃/탈퇴 묶음). 상세 [ygdangerzone-dashed](../specs/archive/2026-07-19-ygdangerzone-dashed.md).
- **pressed 상태 관용구**: 상호작용형 컴포넌트(YGButton·YGIconButton·YGActionItem·YGChipButton)는 `MutableInteractionSource` + `collectIsPressedAsState()`로 pressed를 파생해 색/tint를 분기한다. (예외: 선택형(`YGEditButton`·`YGEditTabButton`·`YGStrokeButton`)은 pressed와 함께 `selectable`의 selected를 쓰고, `YGGrouptagChip`·`YGToppingGroup`은 상호작용 자체가 없다. `YGDateButton`은 상태(selected/today/enabled) prop `when` 분기만 하고 `clickableYG` 대신 표준 `clickable(indication=null)` 사용 — **스로틀 규약 이탈**, → [open-questions](../synthesis/open-questions.md).)
- **clickable 유틸(`clickableYG`·`ygDimRipple`·`ygScaleRipple`)은 `core:designsystem`이 아니라 [`core:util:android`](module-structure.md)의 `clickable/` 패키지에 있다**(2026-07-14 이동, develop 머지 #143). `@Composable Modifier.clickableYG`(중복 클릭 leading-throttle) + 변형 3종(Dim/Scale/Merge) + 리플 없는 `clickableYGNoRipple`(PR #192 신설, 현재 사용처 0)이 표준 `Modifier.clickable` 위에 throttle을 얹어 focus/키/hover/시맨틱을 확보. 테마 비의존이라 ripple 색은 리터럴(`YGDimRippleColor`). 상세 → [clickableyg-throttle](../specs/archive/2026-07-12-clickableyg-throttle.md) · [ygripple](../specs/archive/2026-07-13-ygripple.md) · [clickableyg-ripple-variants](../specs/archive/2026-07-13-clickableyg-ripple-variants.md).

> **과도기 — 컨벤션 분기(정리 대상)**
> - **그리기 프리미티브 소유**: 점선 테두리(`border/dashedBorder()`)·컷 도형(`shape/canvasCutCornerShape()`)은 `core:designsystem`에 두는데, G-001 툴팁 꼬리(`Modifier.drawTooltipCornerTop`, #176 develop 머지)는 [`core:util:android`](module-structure.md)의 `extension/`에 들어갔다. 같은 층위(테마 비의존 그리기 확장)인데 소유 모듈이 갈린다 → [open-questions](../synthesis/open-questions.md) [2026-08-01]. **#199로 자리가 하나 더 늘었다** — 배경 점 격자 `ygBackgroundDotGrid()`는 `border/`·`shape/`가 아니라 `component/ygbackgrounddotgrid/`에 들어갔다(컴포저블이 아닌 `Modifier` 확장인데 컴포넌트 폴더 규약을 따랐고, 기본값으로 `YGAtomicColors`·`SizeTokens`를 읽어 테마 비의존도 아니다).
> - **패키지 네이밍**: 컴포넌트별 폴더(`ygbutton/`·`ygiconbutton/`·`ygactionitem/`·`ygcolorchip/`·`ygtopbar/`·`ygdatebutton/`·`ygdangerzone/`·`ygtext/`)와 그룹 폴더(`textfield/`·`etc/`·`card/`·`modal/`)가 혼재. 규약(위 "컴포넌트 작성 규약")은 컴포넌트별 폴더 기준. (`ygcolorchip/`의 패키지 선언 불일치는 #165로 해소됨 — 폴더 혼재만 잔존) → [open-questions](../synthesis/open-questions.md).
> - **프리뷰 방식**: `@YGPreview`+`PreviewBox` 표준(#158 develop 머지, 2026-07-19, [designsystem-preview-migration 스펙](../specs/archive/2026-07-18-designsystem-preview-migration.md)). ⚠️ **부분 회귀(#149·#165)** — 신규 `YGAlert`·`YGToast`(#149)와 `YGUserChip`(#165)이 표준을 안 따르고 `@Preview`+`YGCustomTheme` 사용, `YGDate`는 `@YGPreview`이나 `PreviewBox` 대신 `YGCustomTheme` 직접 래핑. 즉 "전 컴포넌트 통일"은 더 이상 참이 아님 → [open-questions](../synthesis/open-questions.md) [2026-07-23]. 반면 #183·#185·#186 신설 12종과 #188 신설 2종(`YGListDate`·`YGFloatingBar`)은 전부 `@YGPreview`+`PreviewBox`(프리뷰 함수 `private`) 표준을 지킨다 — 회귀는 `YGAlert`·`YGToast`·`YGUserChip`·`YGDate`에 국한된다.

## 관련 ADR
- [ADR-0010](../adr/0010-custom-compositionlocal-theme.md) — 자체 CompositionLocal 테마(why).
- [ADR-0007](../adr/0007-compose-material3-design-tokens.md) — 100% Compose·중앙화 원칙(superseded).
