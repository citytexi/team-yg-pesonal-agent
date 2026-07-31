---
id: designsystem-canvas-components
title: 디자인시스템 캔버스 영역 컴포넌트 신설 (Design System Canvas Components)
status: draft
category: ui-spec
platforms: android
verified: 2026-07-31
related_code:
  - YGCanvas.kt#YGCanvas
  - YGCanvasBackground.kt#YGCanvasBackground
  - YGCanvasMenu.kt#YGCanvasMenu
  - YGCanvasMenuAction.kt#YGCanvasMenuAction
  - YGCanvasDateSelectButton.kt#YGCanvasDateSelectButton
  - YGStrokeButton.kt#YGStrokeButton
  - YGMenuItem.kt#YGMenuItem
  - CanvasCutCornerShape.kt#canvasCutCornerShape
  - ComponentCatalog.kt#componentCatalog
  - ComponentEntryBuilders.kt#componentEntryBuilders
related_adr:
  - ADR-0010
related_spec:
  - designsystem-button-missing-components
  - app-preview-component-gallery
related_architecture:
  - design-system
supersedes:
superseded_by:
tags: [spec, parfait, designsystem, figma-sync, canvas]
---

# Spec: 디자인시스템 캔버스 영역 컴포넌트 신설

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처(source of truth). 본문은 설계 내용에 집중.
>
> **구현 상태(2026-07-31)** — 5종 + 컷 Shape + 갤러리 등록 전량 완료. `:core:designsystem`·`:app-preview`
> `assembleDebug` + repo 전체 `ktlintCheck` 통과, 실기기 갤러리에서 5종 및 `YGCanvas` 5상태 전부
> Figma와 육안 대조 완료. **TJYG-Android 커밋은 하지 않았다**(작업자 지시).
>
> **구현 후 API 변경(2026-07-31, 작업자 요청)** — 상태 조건을 "값의 유무"에서 **불리언 플래그**로
> 통일했다. 값 파라미터는 내용만 들고, 노출 여부는 플래그가 결정한다.
> - 메뉴 펼침: `YGCanvasMenu.isExpanded` / `YGCanvas.isMenuExpanded` 신설. `expandedItems`는 접힌
>   상태에서도 목록을 유지하므로 호출자가 리스트를 비웠다 되채울 필요가 없다.
> - 빈 상태: `YGCanvas.isEmpty` 신설, `emptyMessage`를 `String?`(기본 `null`) → **`String`(기본 `""`)**.
> - 캘린더: `YGCanvas.isCalendarVisible` 신설, `calendarContent`를 `(@Composable () -> Unit)?`(기본 `null`)
>   → **`@Composable () -> Unit`(기본 `{}`)**.
>
> 대가로 모순 조합이 컴파일된다 — 플래그를 켰는데 값이 비어 있는 경우(빈 리스트·빈 문구·빈 슬롯)가
> 그것이다. 방지 책임은 호출자에게 있다. 본문 API 표기는 이 변경을 반영한 것이다.
>
> **설계에서 달라진 점 2건** — 둘 다 리뷰·실기기 검증에서 드러난 결함을 고친 것이다.
> - **Expanded 상태의 총높이 복원** — 설계 코드는 메뉴가 승격될 때 하단 행을 아예 안 그려서 컨테이너가
>   44dp 짧아지고, Dim과 승격 메뉴가 그만큼 위로 어긋났다. Figma는 모든 `Status`가 같은 높이이고
>   확장 메뉴는 캔버스 하단을 **덮으며** 바닥은 그대로다. 승격 시 `Spacer(SizeTokens.Size44)`로
>   메뉴 행 높이를 예약해 해결했다.
> - **Dim이 터치를 소비하도록 변경** — 설계에는 없던 조항이다. Dim에 포인터 입력이 없으면 흐려진
>   메뉴·날짜바·토핑이 그대로 눌린다(`Spotlighted`에서 보이지 않는 메뉴가 동작). Dim `Box`에
>   소비 전용 `pointerInput`을 얹었다. `onDimClick`은 **추가하지 않았다**(아래 열린 질문).
>   부작용으로 드래그도 막히는데, 스크림으로선 의도한 동작이다.
>
> **미검증**: pressed 상태(자동 입력이 Compose `interactionSource`에 반영되지 않는다 — 선행 라운드와
> 같은 한계), `YGCanvasBackground.Image`의 실제 이미지 렌더 — 아래 열린 질문의 Coil 네트워크 페처
> 부재 때문에 이번 라운드에서 확인할 수 없다.
>
> **⚠️ [2026-07-31 갱신] Coil 네트워크 페처 부재는 해소됐다.** 후속 Grouptag·Topping 라운드가
> `coil-network-okhttp`를 버전 카탈로그와 `ComposeConfig`에 추가했고, 실기기에서 원격 URL 로딩을
> 확인했다(`YGToppingGroup`의 `Remote` 상태). 따라서 위 "다음 라운드로 미룬다" 판정은 종결됐다.
> 다만 **`YGCanvasBackground.Image` 화면 자체의 렌더는 그 라운드의 검증 범위가 아니었으므로 여전히
> 미검증**이다 — 막고 있던 원인만 사라졌다. 상세는
> [designsystem-grouptag-topping-components](2026-07-31-designsystem-grouptag-topping-components.md).

## 목표

Figma "캔버스" 영역 컴포넌트 5종(`Canvas`·`Button-Stroke`·`Canvas-Menu`·`Canvas/Button-Date-Select`·
`Menu-Item`)을 `core:designsystem`에 신설한다. 5종 모두 대응 구현체가 없다.
C-001 캔버스 화면(`feature/groups/canvas`)이 임시 컴포저블로 버티고 있는 상태를 끝내기 위한 선행 작업이다.

## 범위

- **포함**
  - `YGStrokeButton`(Figma `Button-Stroke`) — 테두리 버튼, 텍스트 + 선택 아이콘, 4상태
  - `YGMenuItem`(Figma `Menu-Item`) — 반투명 전폭 메뉴 항목
  - `YGCanvasMenu`(Figma `Canvas-Menu`) — 하단 2버튼 행 + 확장 시 메뉴 항목 스택
  - `YGCanvasDateSelectButton`(Figma `Canvas/Button-Date-Select`) — 컷 도형 날짜 라벨
  - `YGCanvas`(Figma `Canvas`) — 배경 + 토핑 슬롯 + 날짜바 + 메뉴 + Dim 합성 컨테이너
  - 컷 도형 공용 `canvasCutCornerShape()`(`shape/` 패키지 신설)
  - 5종을 `:app-preview` 컴포넌트 갤러리에 등록
- **제외**
  - **캘린더 실물** — Figma `Canvas` `Status=Calendar`가 품는 패널(Head-Calender 월/년 + Divider +
    Week 헤더 + `List-Date` 격자)은 만들지 않는다. `YGCanvas`는 `calendarContent` 슬롯만 열어 두고,
    패널·`List-Date`·`Chip-Indicator`는 C-201 캘린더 라운드로 넘긴다.
  - **Background Dot-Grid** — 위키 [[캔버스-반응형-레이아웃]]에 따르면 dot grid는 **화면 전체 뒤**에
    깔리고 캔버스 영역은 배경이 그것을 덮어 가린다. 즉 `YGCanvas` 안쪽 책임이 아니다.
  - **`feature/groups/canvas` 임시 구현 치환** — `CanvasImageAddScreen`의 "카메라로 촬영"·
    "갤러리에서 선택" 임시 버튼을 그대로 둔다(아래 [주의 / 열린 질문](#주의--열린-질문)).
  - 신규 ADR — 아키텍처 결정 변화 없음
  - `SizeTokens` 추가 — 쓰는 값(20·44)이 모두 있다

## 명명·패키지

기존 "컴포넌트당 폴더 + `YG` 접두사" 규약을 따른다. Figma 컴포넌트명은 컴포넌트 KDoc으로 병기한다.

| Figma | 심볼 | 패키지 |
|---|---|---|
| `Button-Stroke` | `YGStrokeButton` | `component/ygstrokebutton/` |
| `Menu-Item` | `YGMenuItem` | `component/ygmenuitem/` |
| `Canvas-Menu` | `YGCanvasMenu` + `YGCanvasMenuAction` + `YGCanvasMenuItem` | `component/ygcanvasmenu/` |
| `Canvas/Button-Date-Select` | `YGCanvasDateSelectButton` | `component/ygcanvasdateselect/` |
| `Canvas` | `YGCanvas` + `YGCanvasBackground` | `component/ygcanvas/` |
| (공용 도형) | `canvasCutCornerShape()` | `shape/` |

`shape/`는 신규 패키지다. `border/DashedBorder.kt`(Modifier 프리미티브)와 같은 층위의
"컴포넌트가 아닌 그리기 프리미티브" 자리다. 컷 도형을 세 곳(캔버스 배경·날짜바·Dim)이 공유하므로
컴포넌트 안에 묻지 않는다.

## 컷 도형

Figma가 캔버스 배경·날짜바·Dim에 같은 실루엣을 쓴다 — **좌상단만 45° 사선으로 잘린 사각형**,
자른 다리 길이 17dp(가로·세로 동일). 위키 [[캔버스-반응형-레이아웃]]의 "좌상단 컷 도형"이 이것이다.

```kotlin
fun canvasCutCornerShape(cutSize: Dp = 17.dp): Shape
```

`GenericShape`로 그린다. 다리 길이는 `SizeTokens` 스케일에 없는 값이라 리터럴을 기본값으로 둔다
(`YGDate`의 `0.75.dp`, `YGEditTabButton`의 `1.4.dp` 선례). 컷은 **크기에 비례해 스케일하지 않는다** —
위키 정책의 "점·간격 고정" 방침과 같은 결이고, Figma도 고정값이다.

## API / 인터페이스

### `YGStrokeButton`

```kotlin
@Composable
fun YGStrokeButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    @DrawableRes iconResource: Int? = null,
    isSelected: Boolean = false,
    isEnabled: Boolean = true,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
)
```

- 폭을 스스로 정하지 않는다. Figma의 167.5는 `Canvas-Menu` 폭의 절반이고, 디자이너 노트가
  "Canvas-Menu 사이즈에 따라 유동적으로 Fill"이라 명시한다 → 호출자가 `weight`/`fillMaxWidth`로 준다.
- 아이콘은 텍스트 **뒤**에 온다(`Button-Edit`와 같은 배치). 아이콘 없는 사용도 있으므로 nullable.
- `isSelected`는 prop이다. Figma `Status=Selected`는 pressed와 색이 같지만 **의미가 다르다**
  (편집 모드 유지 vs 손가락이 닿은 순간) → 둘 다 노출하고 색만 공유한다.

### `YGMenuItem`

```kotlin
@Composable
fun YGMenuItem(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
)
```

`YGStrokeButton`과 색 방향이 반대다(기본이 반투명, 눌리면 불투명) — 별도 컴포넌트로 둔다.
아이콘·비활성 상태가 없다(Figma에 변형 없음).

### `YGCanvasMenu`

```kotlin
@Immutable
data class YGCanvasMenuAction(
    val text: String,
    @DrawableRes val iconResource: Int?,
    val onClick: () -> Unit,
)

@Immutable
data class YGCanvasMenuItem(
    val text: String,
    val onClick: () -> Unit,
)

@Composable
fun YGCanvasMenu(
    addAction: YGCanvasMenuAction,
    editAction: YGCanvasMenuAction,
    modifier: Modifier = Modifier,
    isExpanded: Boolean = false,
    expandedItems: List<YGCanvasMenuItem> = emptyList(),
)
```

- 구조는 Figma대로 고정하고 **문구만 주입**한다. 하단 행은 항상 `YGStrokeButton` 2개(각 `weight(1f)`),
  확장부는 그 위로 쌓이는 `YGMenuItem` 스택이다.
- **펼침 여부는 `isExpanded`가 결정한다**(`false` = Figma `Status=Default`, `true` = `Status=Expanded`).
  `expandedItems`는 목록을 들고만 있고 접힌 상태에서도 유지되므로, 호출자가 리스트를 비웠다 되채울
  필요가 없다. 상태 enum은 두지 않는다.
- 도메인 문구("토핑 추가"·"카메라로 촬영" 등)를 디자인시스템이 들지 않는다.

### `YGCanvasBackground`

```kotlin
@Immutable
sealed interface YGCanvasBackground {
    data class Solid(val color: Color) : YGCanvasBackground

    data class Image(val url: String) : YGCanvasBackground
}
```

캔버스 배경은 **사용자가 올린 이미지(URL) 또는 제시된 단색 중 택1**이라는 제품 규칙을 그대로 옮긴 것이다.
`Image`는 Coil `AsyncImage` + `ContentScale.Crop`으로 그린다(`YGTheme`가 프리뷰 핸들러를 이미 심어 둔다).
단 현재 프로젝트에 Coil 네트워크 페처가 없어 원격 URL은 실제로 로드되지 않는다(아래 열린 질문).
Figma `Status=Default`의 크림색+분홍 도트 배경은 디자이너 샘플이므로 재현하지 않는다.

### `YGCanvas`

```kotlin
@Composable
fun YGCanvas(
    date: String,
    day: String,
    onDateSelectClick: () -> Unit,
    addAction: YGCanvasMenuAction,
    editAction: YGCanvasMenuAction,
    modifier: Modifier = Modifier,
    background: YGCanvasBackground = YGCanvasBackground.Solid(YGAtomicColors.Gray.Gray100),
    isDimmed: Boolean = false,
    isMenuExpanded: Boolean = false,
    isEmpty: Boolean = false,
    isCalendarVisible: Boolean = false,
    expandedItems: List<YGCanvasMenuItem> = emptyList(),
    emptyMessage: String = "",
    calendarContent: @Composable () -> Unit = {},
    content: @Composable BoxScope.() -> Unit = {},
)
```

- `date`·`day`는 이미 포맷된 문자열 2개다(`YGDate(date, day)` 선례). 로케일·포맷은 호출자 책임.
- `content`는 토핑 레이어다. 캔버스 영역 안쪽에 놓이고 컷 도형으로 클립된다.
- `isEmpty`면 캔버스 영역 중앙에 안내문을 그린다. 문구는 `emptyMessage`로 주입받는다(논널, 기본 `""`).
  플래그가 조건이고 문자열은 내용만 든다 — 메뉴 펼침(`isMenuExpanded` + `expandedItems`)과 같은 구조다.
- Figma 5상태를 **직교 파라미터의 조합**으로 표현한다. 실화면은 "비었는데 메뉴를 펼친" 같은 조합을
  만들어내므로 단일 enum으로는 부족하다.
- 메뉴 펼침은 `isMenuExpanded`가 결정하고 `expandedItems`는 목록만 들고 있다(`YGCanvasMenu`와 같은 계약).

| Figma `Status` | 대응 조합 |
|---|---|
| `Default` | 기본값 |
| `Empty` | `isEmpty = true` |
| `Expanded` | `isDimmed = true` + `isMenuExpanded = true` |
| `Spotlighted` | `isDimmed = true` |
| `Calendar` | `isDimmed = true` + `isCalendarVisible = true` |

## 동작 / 상태

### Dim 레이어 규칙

`isDimmed`면 Dim(`Transparency.Black25`, 컷 실루엣, 캔버스 전체 = 영역 + 메뉴)을 **최상단에 깔고
그 아래 레이어의 터치를 막는다.** 그 위로 올라가는 것은 두 경우뿐이다.

| 조건 | Dim 위로 올라가는 것 |
|---|---|
| `isMenuExpanded = true` | `YGCanvasMenu` 전체 |
| `isCalendarVisible = true` | 날짜바 + 캘린더 슬롯 |

둘 다 아니면 Dim이 전부를 덮는다(= `Spotlighted`). Figma 3개 변형의 z-order가 이 규칙으로 재현된다.

### `YGStrokeButton`

| 상태 | 배경 | 테두리 | 텍스트·아이콘 |
|---|---|---|---|
| default | `Gray.White` | `Gray.Gray500` | `Gray.Gray700` |
| pressed | `Gray.Gray100` | `Gray.Gray500` | `Gray.Gray700` |
| selected | `Gray.Gray100` | `Gray.Gray500` | `Gray.Gray700` |
| disabled | `Gray.White` | `Gray.Gray200` | `Gray.Gray300` |

pressed는 `collectIsPressedAsState()` 파생(관용구), selected·disabled는 prop이다.
pressed와 selected가 겹치면 같은 색이라 분기 순서가 결과를 바꾸지 않는다.

### `YGMenuItem`

| 상태 | 배경 | 테두리 | 텍스트 |
|---|---|---|---|
| default | `Transparency.White75` | `Gray.Gray500` | `Gray.Gray700` |
| pressed | `Gray.White` | `Gray.Gray500` | `Gray.Gray700` |

### `YGCanvasDateSelectButton`

배경 `Transparency.White75` + 테두리 `Gray.Gray500` 1dp, 둘 다 컷 도형을 따른다.
날짜 텍스트 `Gray.Gray800`, 요일 텍스트 `Gray.Gray300`.

### `YGCanvas` 배경·안내문

| 요소 | 값 |
|---|---|
| 캔버스 영역 테두리 | 1dp `Gray.Gray500`, 컷 도형 |
| 배경 기본값 | `YGCanvasBackground.Solid(Gray.Gray100)` |
| Empty 안내문 | `typography.caption.c01M` / `Gray.Gray500` / 중앙 정렬 |
| Dim | `Transparency.Black25` |

## 치수·레이아웃

공통: 테두리 1dp, `shapes.radius.none`(각짐 — 컷 도형을 쓰는 셋은 그 Shape가 대신한다),
텍스트 `typography.body.b02R`.

| 대상 | 규격 |
|---|---|
| `YGStrokeButton` | 높이 `SizeTokens.Size44` 고정, 폭은 호출자, 아이콘 `Size20`, 텍스트↔아이콘 `layout.gap.gap1` |
| `YGMenuItem` | 높이 `Size44` 고정, `fillMaxWidth`, 텍스트 중앙 |
| `YGCanvasDateSelectButton` | 높이 `Size44` 고정, 폭 `fillMaxWidth`, 좌측 `layout.padding.padding6`, 날짜↔요일 `gap1`, 우측 `YGIconButton`(`SIZE_44`) + `ic_calender` |
| `YGCanvasMenu` | `fillMaxWidth`. 하단 행 = `YGStrokeButton` 2개 `weight(1f)`. 확장 항목은 위로 스택, 행간 간격 없음 |
| `YGCanvas` | `fillMaxWidth`. 캔버스 영역 `aspectRatio` 9:16, 그 아래 메뉴가 간격 0으로 붙음 |

높이 44는 패딩에서 도출하지 않고 토큰으로 못박는다 — Figma가 높이를 명시(`h-44` + `overflow-clip`)하고,
세로 패딩 12 + 본문 21로는 45가 되어 도출값이 어긋난다([치수 도출 원칙](2026-07-30-designsystem-button-missing-components.md)의
"Figma가 직접 고정한 곳만 크기 토큰"에 해당).

캔버스 영역 비율 9:16은 위키 [[캔버스-반응형-레이아웃]]의 "Canvas-Area만 16:9 유지, Canvas-Menu는
계산 제외"를 그대로 따른다(Figma 실측 335×596도 같은 비율).

## 표시·제어 규칙

- 인접 테두리는 겹쳐 그린다 — `YGCanvasMenu`의 두 버튼과 스택된 `YGMenuItem`은 각자 1dp 테두리를 갖고
  맞닿으므로 접합선이 2dp로 보인다. Figma도 같은 구조(오프셋 없이 인접)라 그대로 둔다.
- `YGCanvas`는 저장(내보내기)용 렌더를 제공하지 않는다. 위키 정책의 "저장 시 컷 도형·날짜 라벨 미반영"은
  화면 컴포넌트가 아니라 내보내기 경로의 책임이다.
- 클릭은 `core:designsystem`의 as-built 관용구를 따른다 — 표준 `clickable(indication = null)` +
  `semantics { role = Role.Button }`(선택형은 `selectable`). 이 모듈은 `clickableYG`를 쓰지 않는다
  (`core:util:android` 의존 없음).

## Colors 분리 판단

`YGButtonColors` 같은 색 주입 data class를 만들지 않는다. 5종 모두 Figma가 색을 고정하고
색을 바꿔 쓸 사용처가 없다(선행 버튼 5종과 같은 판단). 색 주입이 필요해지면 그때 분리한다.

## 파일 구성

### `core:designsystem` (신규 8)

| 파일 | 역할 |
|---|---|
| `shape/CanvasCutCornerShape.kt` | `canvasCutCornerShape()` 좌상단 컷 `Shape` |
| `component/ygstrokebutton/YGStrokeButton.kt` | 컴포저블 + 프리뷰 |
| `component/ygmenuitem/YGMenuItem.kt` | 컴포저블 + 프리뷰 |
| `component/ygcanvasmenu/YGCanvasMenu.kt` | 컴포저블 + 프리뷰 |
| `component/ygcanvasmenu/YGCanvasMenuAction.kt` | `YGCanvasMenuAction` + `YGCanvasMenuItem` |
| `component/ygcanvasdateselect/YGCanvasDateSelectButton.kt` | 컴포저블 + 프리뷰 |
| `component/ygcanvas/YGCanvas.kt` | 컴포저블 + 프리뷰 |
| `component/ygcanvas/YGCanvasBackground.kt` | 배경 sealed 타입 |

프리뷰는 `@YGPreview` + `PreviewBox`, 함수는 `private`. 상태 나열은 `Column`으로 둔다.

### `:app-preview` (신규 10 / 수정 2)

| 파일 | 역할 |
|---|---|
| `navigation/key/NavKeyYG{StrokeButton,MenuItem,CanvasMenu,CanvasDateSelectButton,Canvas}.kt` (신규 5) | `@Serializable data object … : NavKey` |
| `screen/component/YG{…}PreviewScreen.kt` (신규 5) | 변형·상태 showcase |
| `model/ComponentCatalog.kt` (수정) | `BUTTON` 3줄(`YGStrokeButton`·`YGMenuItem`·`YGCanvasDateSelectButton`) + `CONTAINER` 2줄(`YGCanvasMenu`·`YGCanvas`) |
| `navigation/entry/ComponentEntryBuilders.kt` (수정) | `entry` 5블록 추가 |

`navigation/di/ComponentEntryModule.kt`는 수정하지 않는다(`@IntoSet` 바인딩이 함수 단위).
새 `ComponentCategory`는 만들지 않는다.

### 갤러리 showcase 구성 요구

| 화면 | 나열 |
|---|---|
| `YGStrokeButton` | default / selected / disabled × 아이콘 유·무 + `remember` 선택 토글 |
| `YGMenuItem` | 단일(pressed는 실기기 확인) |
| `YGCanvasMenu` | 기본 / 확장(항목 2개) + `remember` 확장 토글 |
| `YGCanvasDateSelectButton` | 단일 |
| `YGCanvas` | Figma 5상태 대응 조합 5개 + 배경 `Solid`/`Image` 2종 |

## 검증

테스트를 쓰지 않는다(선행 라운드와 동일 결정, `core:designsystem`에 테스트 소스셋 없음).

1. `./gradlew :core:designsystem:assembleDebug :app-preview:assembleDebug`
2. `./gradlew ktlintCheck`
3. `:app-preview` 실기기 — 5종 화면을 Figma와 나란히 육안 대조. 컷 다리 길이·9:16 비율·Dim z-order·
   반투명 배경·접합선 두께
4. pressed·selected·확장 상호작용을 눌러 확인
5. **TJYG-Android에 커밋하지 않는다**(작업자 지시). 브랜치 작업물로만 남긴다.

## 주의 / 열린 질문

- **`feature/groups/canvas` 임시 구현 잔존** — `CanvasImageAddScreen`이 "카메라로 촬영"·"갤러리에서 선택"을
  기본 `Button`+`Text`로 그리고 있다. `YGMenuItem`·`YGCanvasMenu`를 만들지만 이번에 치환하지 않아
  구현이 두 곳에 공존한다. C-001 화면 라운드에서 정리한다. → parfait open-questions 등록
- **캘린더 슬롯이 빈 채로 나간다** — `calendarContent`를 채울 컴포넌트가 없어 `Status=Calendar`를
  실물로 대조할 수 없다. C-201 라운드(`List-Date`·`Chip-Indicator`·패널)에서 채우고 그때 대조한다.
  → open-questions 등록
- **Empty 배경색의 의미 미확정** — Figma `Status=Empty`의 배경이 `Gray.Gray100`인데, 이것이
  "배경 미지정 기본값"인지 "비어 있을 때만 회색"인지 원본에서 갈리지 않는다. 이번 구현은 전자로 보고
  `background` 기본값으로 뒀다(Empty여도 지정 배경이 있으면 그대로 그린다). → open-questions 등록
- **컷 도형 다리 17dp의 출처가 Figma 벡터뿐** — 정책 문서는 "비스듬히 잘린 컷"만 서술하고 수치가 없다.
  디자이너가 값을 바꾸면 추적할 근거가 벡터 path밖에 없다. → open-questions 등록
- **`YGCanvasDateSelectButton`의 클릭 영역이 아이콘 44dp뿐** — 바 전체가 컷 배경·테두리를 공유해
  하나의 버튼처럼 보이고 이름도 `Button`인데, 날짜 텍스트를 눌러도 아무 일도 일어나지 않는다.
  구현 라운드에서 리뷰가 제기했고 **현행 유지로 판정**(2026-07-31). 화면 라운드에서 재검토한다.
  → open-questions 등록
- **같은 컴포넌트의 `contentDescription`이 `null`** — 유일한 상호작용 요소인 캘린더 아이콘에 접근성
  이름이 없다. **현행 유지로 판정**(2026-07-31), 전원 접근성 라운드로 미룬다. → open-questions 등록
- **Dim 탭으로 닫기(`onDimClick`)가 없다** — 구현에서 Dim이 터치를 **소비하도록** 고쳤지만(위
  "설계에서 달라진 점"), 탭했을 때 `Expanded`·`Calendar`를 닫을지는 규정하지 않았다. Figma가
  다루지 않는 영역이라 화면 라운드의 결정이다. → open-questions 등록
- **Coil 3 네트워크 페처가 프로젝트에 없다 — `YGCanvasBackground.Image`가 실제로 로드되지 않는다.**
  Coil 3는 네트워크 페처를 별도 아티팩트로 분리했는데(`coil-network-okhttp`), 이 프로젝트는
  `coil-compose`만 물려 있다(버전 카탈로그·`ComposeConfig`). 기존 `AsyncImage` 사용처가 전부 로컬
  MediaStore URI라 지금까지 드러나지 않았다. 즉 갤러리뿐 아니라 **실화면에서도 원격 배경 이미지는
  뜨지 않는다.** 의존 추가가 `build-logic` 전역 변경이라 **다음 라운드로 미룬다**(2026-07-31 판정).
  - **✅ 해소(2026-07-31)** — 후속 Grouptag·Topping 라운드가 `coil-network-okhttp`를 버전 카탈로그와
    `ComposeConfig`에 추가하고 실기기에서 원격 URL 로딩을 확인했다. 이 항목은 종결이며
    open-questions 등록 대상이 아니다. `YGCanvasBackground.Image` 화면의 렌더 검증은 별개로 남는다.
- **`:app-preview`에 INTERNET 권한 추가** — Image showcase 렌더 실패를 좇다 발견해 넣었다(권한 자체는
  필요하다). 다만 위 페처 부재가 진짜 원인이라 권한만으로는 로드되지 않는다. 갤러리 앱 한정 변경이며
  프로덕션 앱 매니페스트와는 무관하다.
- **Background Blur(C-001 v0.1) 존폐 미확정** — 위키 [[open-questions]]에 이미 등록된 항목.
  Dot Grid로 대체인지 병존인지 미정이라 `YGCanvas`는 블러를 넣지 않는다.
- **원자 색 직접 참조** — 5종 모두 `YGAtomicColors`를 직접 읽는다. 기존 등록 사항이며 이번에도 유지한다.
