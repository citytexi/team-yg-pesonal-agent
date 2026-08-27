# PR1 — 배경 편집 화면 배경 탭 토핑 렌더링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배경 편집 화면(C-301)의 배경 탭에서도 캔버스에 올라간 토핑을 반투명·비상호작용으로 그린다.

**Architecture:** `CanvasBGEditScreen`이 토핑 레이어 전체를 `selectedTab == CanvasEditTab.TOPPING` 조건 하나로 감싸고 있다. 그 게이트를 걷어내고 **그리기**와 **상호작용**을 분리한다. 두 탭이 공유하는 것은 저장된 배치대로 토핑 이미지를 겹쳐 그리는 부분뿐이고, 딤 오버레이·입력 레이어·모서리 버튼·접근성 클릭·알파 마스크는 전부 토핑 탭 전용으로 남긴다. ViewModel과 UiState는 건드리지 않는다.

**Tech Stack:** Kotlin, Jetpack Compose, Coil 3(`rememberAsyncImagePainter`), Hilt

**Spec:** [`parfait/specs/2026-08-27-canvas-today-ssot-polling.md`](../specs/2026-08-27-canvas-today-ssot-polling.md) 「PR1 — 배경 탭 토핑 렌더링」

**작업 저장소:** `TJYG-Android` (remote `mash-up-kr/TJYG-Android`). 로컬 절대경로는 `wiki/personal-private/project-paths.md`에 있다. 브랜치는 `feature/#392-canvas-topping` 위에 쌓는다.

## Global Constraints

- **커밋은 하되 push·PR은 사용자 확인 후에만.** 로컬 커밋과 브랜치 생성은 확인 없이 해도 된다.
- **코드 주석·KDoc 규약**(`parfait/CLAUDE.md`):
  - 코드가 이미 말하는 것은 쓰지 않는다.
  - `@return`·`@param`은 타입·이름이 말하지 못할 때만 쓴다.
  - 다른 컴포넌트의 현재 상태를 단정하지 않는다(낡는다). 써야 하면 근거 문서를 가리킨다.
  - 아키텍처 결정은 코드가 아니라 `parfait/adr/`·`parfait/architecture/`에 쓰고 코드에는 포인터 한 줄만 둔다.
- **주석·KDoc·문서는 한국어로 쓴다.** 기존 파일의 문체를 따른다.
- **이 모듈에는 `androidTest`도 Robolectric도 없다.** `feature/groups/canvas/impl/build.gradle.kts`는 `parfait.test.unit` 하나만 쓴다. **이 PR에서 테스트 하니스를 새로 세우지 않는다** — 검증은 `@YGPreview` + 수동 확인이다.
- **하드코딩 dp 리터럴을 새로 만들지 않는다.** 새 상수는 파일 최상단에 이름 있는 `private const val`로 둔다.
- 매직 넘버 대신 이름 있는 상수를 쓴다. 불투명도 값은 `BACKGROUND_TAB_TOPPING_ALPHA`로 둔다.

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/screen/CanvasBGEditScreen.kt` | 배경 편집 화면 전체 — 캔버스 미리보기 박스, 토핑 레이어, 팔레트, 모달 | 탭 게이트 분리, 그리기 정보 추출 함수 신설, `alpha` 파라미터, 배경 탭 Preview 추가 |

한 파일만 바뀐다. 이 화면은 이미 600줄대라 더 키우지 않도록, 새로 만드는 것은 **기존 `rememberBGEditHitEntries`에서 그리기용 정보만 떼어낸 함수 하나**뿐이다.

---

### Task 1: 그리기 정보와 판정 정보를 분리한다

지금 `rememberBGEditHitEntries`는 그리기에 필요한 `painter`와 판정에 필요한 `ToppingHitTarget`을 한 번에 만들고, 그 과정에서 `rememberToppingAlphaMasks`로 비트맵을 디코딩한다. 배경 탭은 판정을 하지 않으므로 마스크가 필요 없다.

**Files:**
- Modify: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/screen/CanvasBGEditScreen.kt`

**Interfaces:**
- Consumes: 기존 `CanvasToppingItem`, `toppingImageSize`, `toppingLongSide`, `toppingCenter`, `ToppingHitTarget`, `rememberToppingAlphaMasks`
- Produces:
  - `private data class BGEditDrawEntry(val topping: CanvasToppingItem, val painter: AsyncImagePainter, val center: DpOffset, val size: DpSize, val drawnBorderWidthDp: Float)`
  - `@Composable private fun rememberBGEditDrawEntries(toppings: List<CanvasToppingItem>, canvasWidth: Dp, canvasHeight: Dp): List<BGEditDrawEntry>`
  - `BGEditHitEntry`가 `val draw: BGEditDrawEntry`를 들고, `topping`·`painter`는 `draw`를 통해 읽는다

- [ ] **Step 1: `BGEditDrawEntry`와 그리기 정보 추출 함수를 만든다**

`BGEditHitEntry`·`rememberBGEditHitEntries` 바로 위에 넣는다.

```kotlin
/** 두 탭이 공유하는 그리기 정보. 판정(마스크·`ToppingHitTarget`)은 여기 없다 */
private data class BGEditDrawEntry(
    val topping: CanvasToppingItem,
    // Painter 로 좁히면 state 를 잃어 테두리 조건을 볼 수 없다
    val painter: AsyncImagePainter,
    val center: DpOffset,
    val size: DpSize,
    val drawnBorderWidthDp: Float,
)

/**
 * 배경 탭에서도 부르므로 알파 마스크를 요청하지 않는다 — 마스크 준비는 비트맵 디코딩을
 * 동반하는데 배경 탭은 판정을 하지 않는다.
 */
@Composable
private fun rememberBGEditDrawEntries(
    toppings: List<CanvasToppingItem>,
    canvasWidth: Dp,
    canvasHeight: Dp,
): List<BGEditDrawEntry> = toppings.map { topping ->
    key(topping.parfaitImageId) {
        val painter = rememberAsyncImagePainter(model = topping.drawnModel)
        val painterState by painter.state.collectAsState()
        val intrinsicSize = painter.intrinsicSize

        val aspectRatio = if (intrinsicSize.isSpecified && intrinsicSize.height > 0f) {
            intrinsicSize.width / intrinsicSize.height
        } else {
            0f
        }

        BGEditDrawEntry(
            topping = topping,
            painter = painter,
            center = toppingCenter(
                canvasWidth = canvasWidth,
                canvasHeight = canvasHeight,
                positionX = topping.positionX,
                positionY = topping.positionY,
            ),
            size = toppingImageSize(
                longSide = toppingLongSide(canvasWidth, topping.scale),
                aspectRatio = aspectRatio,
            ),
            // 테두리를 그리지 않는 상태에서는 판정도 넓히지 않는다 — 그리지 않은 링만큼 부풀면
            // 판정이 외형과 어긋난다
            drawnBorderWidthDp = topping.borderLayers
                .firstOrNull()
                ?.takeIf { painterState is AsyncImagePainter.State.Success }
                ?.widthDp
                ?: 0f,
        )
    }
}
```

`DpOffset` import가 없으면 `androidx.compose.ui.unit.DpOffset`을 추가한다. `toppingCenter`의 반환 타입이 `DpOffset`이 아니면 그 타입에 맞춘다(현재 반환 타입을 그대로 쓸 것 — 새로 바꾸지 않는다).

- [ ] **Step 2: `BGEditHitEntry`가 그리기 정보를 품게 바꾼다**

```kotlin
private data class BGEditHitEntry(
    val draw: BGEditDrawEntry,
    val target: ToppingHitTarget,
) {
    val topping: CanvasToppingItem get() = draw.topping
}
```

- [ ] **Step 3: `rememberBGEditHitEntries`가 그리기 함수를 재사용하게 바꾼다**

```kotlin
/**
 * 그리기와 판정이 같은 painter 를 본다. 각각 만들면 비율이 서로 다른 시점의 값이 될 수 있다.
 *
 * 마스크는 판정에 실제로 쓰는 내 토핑만 요청한다. 남의 토핑은 탭 대상도 드래그 대상도 아니고
 * 그리는 데는 painter 만 있으면 되므로, 마스크가 없어도 화면이 달라지지 않는다.
 */
@Composable
private fun rememberBGEditHitEntries(
    drawEntries: List<BGEditDrawEntry>,
): List<BGEditHitEntry> {
    val masks = rememberToppingAlphaMasks(
        drawEntries.filter { it.topping.isMine }.map { it.topping.drawnModel },
    )
    val density = LocalDensity.current

    return drawEntries.map { entry ->
        BGEditHitEntry(
            draw = entry,
            target = with(density) {
                ToppingHitTarget(
                    centerXPx = entry.center.x.toPx(),
                    centerYPx = entry.center.y.toPx(),
                    imageWidthPx = entry.size.width.toPx(),
                    imageHeightPx = entry.size.height.toPx(),
                    rotationDegrees = entry.topping.rotationDegrees,
                    borderWidthPx = entry.drawnBorderWidthDp.dp.toPx(),
                    mask = masks[entry.topping.drawnModel],
                )
            },
        )
    }
}
```

- [ ] **Step 4: 컴파일이 되는지 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:compileDebugKotlin`
Expected: BUILD SUCCESSFUL. 이 단계에서 호출부(`CanvasBGEditScreen`의 `BoxWithConstraints` 블록)도 새 시그니처에 맞춰 고쳐야 한다 — `rememberBGEditDrawEntries(...)`를 먼저 부르고 그 결과를 `rememberBGEditHitEntries(...)`에 넘긴다. `CanvasToppingImage`·`ToppingCornerButtons`가 `entry.topping`·`entry.painter`를 읽던 자리는 `entry.draw.painter`로 바꾼다.

- [ ] **Step 5: 기존 테스트가 그대로 통과하는지 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test`
Expected: PASS (화면만 바꿨으므로 ViewModel 테스트는 영향 없음)

- [ ] **Step 6: 커밋**

```bash
git add feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/screen/CanvasBGEditScreen.kt
git commit -m "refactor: 배경 편집의 토핑 그리기 정보를 판정 정보에서 떼어낸다"
```

---

### Task 2: `CanvasToppingImage`가 불투명도와 클릭 없음을 받게 한다

**Files:**
- Modify: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/screen/CanvasBGEditScreen.kt`

**Interfaces:**
- Consumes: Task 1의 `BGEditDrawEntry`
- Produces: `@Composable private fun CanvasToppingImage(entry: BGEditDrawEntry, alpha: Float, onClick: (() -> Unit)?, modifier: Modifier = Modifier)`

- [ ] **Step 1: 파일 최상단에 불투명도 상수를 둔다**

기존 `private const val GROUP_ID`류 상수가 있는 자리(파일 상단 import 아래)에 넣는다.

```kotlin
/** 배경 탭에서 토핑은 배경 선택의 참고로만 존재한다 — 고를 수 없다는 것을 불투명도로 알린다 */
private const val BACKGROUND_TAB_TOPPING_ALPHA = 0.5f
```

- [ ] **Step 2: `CanvasToppingImage`를 고친다**

기존 시그니처는 `entry: BGEditHitEntry`, `canvasWidth`, `canvasHeight`, `onClick: () -> Unit`을 받고 내부에서 `toppingCenter`를 다시 계산한다. 중심점·크기는 이미 `BGEditDrawEntry`에 있으므로 다시 계산하지 않는다.

```kotlin
/**
 * 캔버스 미리보기 박스 안, 저장된 배치([CanvasToppingItem.positionX]/[positionY])대로 겹쳐 그리는
 * 이미지. 캔버스 메인([CanvasToppingLayer])과 같은 규칙을 써야 편집한 그대로 돌아간다.
 *
 * 선택 시 보이는 스트로크·버튼은 이 이미지와 함께 돌지 않아야 해서 [ToppingCornerButtons]에서
 * 별도로 그린다.
 *
 * @param onClick null 이면 접근성 클릭도 붙지 않는다 — 실제로 누를 수 없는 화면에서 버튼으로
 *   읽히면 안 된다.
 */
@Composable
private fun CanvasToppingImage(
    entry: BGEditDrawEntry,
    alpha: Float,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val painterState by entry.painter.state.collectAsState()
    val border = entry.topping.borderLayers.firstOrNull()
    val description = stringResource(R.string.canvas_topping_content_description)

    Box(
        modifier = modifier
            .centeredAt(entry.center)
            .requiredSize(entry.size)
            .graphicsLayer(
                rotationZ = entry.topping.rotationDegrees,
                alpha = alpha,
            ).let { base ->
                if (onClick == null) {
                    base
                } else {
                    // 판정은 입력 레이어가 하지만, 접근성 서비스에는 토핑이 개별 버튼으로 보여야 한다
                    base.semantics(mergeDescendants = true) {
                        role = Role.Button
                        contentDescription = description
                        onClick {
                            onClick()
                            true
                        }
                    }
                }
            },
    ) {
        YGToppingCutoutImage(
            painter = entry.painter,
            // 로딩·실패 상태에서 찍으면 플레이스홀더 실루엣이 테두리로 보인다
            borderColor = border
                ?.let { Color(it.colorArgb) }
                ?.takeIf { painterState is AsyncImagePainter.State.Success },
            borderWidth = (border?.widthDp ?: 0f).dp,
            modifier = Modifier.fillMaxSize(),
        )
    }
}
```

`semantics` 블록 안의 `onClick`은 `SemanticsPropertyReceiver.onClick`이고 바깥의 `onClick`은 파라미터라 이름이 겹친다. 겹침이 컴파일 오류나 오해를 부르면 파라미터 이름을 `onClick`으로 두고 안쪽 호출을 `onClick.invoke()`로 명시한다.

- [ ] **Step 3: 토핑 탭 호출부를 새 시그니처에 맞춘다**

`BoxWithConstraints` 안의 두 호출을 각각 이렇게 바꾼다.

```kotlin
// 남의 토핑
entries.filterNot { it.topping.isMine }.forEach { entry ->
    CanvasToppingImage(
        entry = entry.draw,
        alpha = 1f,
        onClick = onClickDeselectTopping,
    )
}
```

```kotlin
// 내 토핑
myEntries.forEach { entry ->
    CanvasToppingImage(
        entry = entry.draw,
        alpha = 1f,
        onClick = { onClickTopping(entry.topping) },
    )
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `./gradlew :feature:groups:canvas:impl:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: 커밋**

```bash
git add feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/screen/CanvasBGEditScreen.kt
git commit -m "feat: 토핑 이미지가 불투명도와 클릭 없음을 받게 한다"
```

---

### Task 3: 배경 탭에서 토핑을 그린다

**Files:**
- Modify: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/screen/CanvasBGEditScreen.kt`

**Interfaces:**
- Consumes: Task 1의 `rememberBGEditDrawEntries`·`rememberBGEditHitEntries`, Task 2의 `CanvasToppingImage`
- Produces: 없음(화면 내부)

- [ ] **Step 1: 캔버스 박스 안의 토핑 레이어를 다시 짠다**

지금은 `if (uiState.selectedTab == CanvasEditTab.TOPPING) { BoxWithConstraints { … } }` 한 덩어리다. 이것을 아래 형태로 바꾼다. `BoxWithConstraints`는 탭과 무관하게 항상 들어가고, 그 **안에서** 탭이 갈린다.

```kotlin
// 배치가 모두 이 영역 대비 비율이라, 캔버스 메인과 같은 자리에 그리려면 실제 크기를 알아야 한다
BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
    val canvasWidth = maxWidth
    val canvasHeight = maxHeight
    val density = LocalDensity.current
    val canvasWidthPx = with(density) { canvasWidth.toPx() }
    val canvasHeightPx = with(density) { canvasHeight.toPx() }

    val drawEntries = rememberBGEditDrawEntries(
        toppings = uiState.toppings,
        canvasWidth = canvasWidth,
        canvasHeight = canvasHeight,
    )

    if (uiState.selectedTab == CanvasEditTab.BACKGROUND) {
        // 배경을 고르는 화면이라 토핑은 참고로만 둔다 — 딤·입력 레이어·모서리 버튼·접근성
        // 클릭을 붙이지 않고, 저장된 z 순서 그대로 겹쳐 그린다
        drawEntries.forEach { entry ->
            CanvasToppingImage(
                entry = entry,
                alpha = BACKGROUND_TAB_TOPPING_ALPHA,
                onClick = null,
            )
        }
    } else {
        val entries = rememberBGEditHitEntries(drawEntries = drawEntries)
        val myEntries = entries.filter { it.topping.isMine }
        val selectedEntry = myEntries.firstOrNull {
            it.topping.parfaitImageId == uiState.selectedToppingId
        }

        // 남의 토핑
        entries.filterNot { it.topping.isMine }.forEach { entry ->
            CanvasToppingImage(
                entry = entry.draw,
                alpha = 1f,
                onClick = onClickDeselectTopping,
            )
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(YGAtomicColors.Transparency.Black25),
        )

        // 내 토핑
        myEntries.forEach { entry ->
            CanvasToppingImage(
                entry = entry.draw,
                alpha = 1f,
                onClick = { onClickTopping(entry.topping) },
            )
        }

        Box(
            modifier = Modifier
                .matchParentSize()
                .toppingTapInput(
                    entries = { myEntries.map { it.topping to it.target } },
                    keyOf = { it.parfaitImageId },
                    onHit = onClickTopping,
                    onMiss = onClickDeselectTopping,
                ).toppingDragInput(
                    targetAt = { selectedEntry?.target },
                    onDrag = { amount ->
                        onToppingMoveDrag(
                            amount.x / canvasWidthPx,
                            amount.y / canvasHeightPx,
                        )
                    },
                ),
        )

        selectedEntry?.let { entry ->
            ToppingCornerButtons(
                entry = entry,
                canvasWidth = canvasWidth,
                canvasHeight = canvasHeight,
                onClickDelete = onClickDeleteTopping,
                onClickEdit = onClickEditTopping,
                onResizeDrag = onToppingResizeDrag,
                onRotateDrag = onToppingRotateDrag,
            )
        }
    }
}
```

`ToppingCornerButtons`가 `entry.topping`·`entry.target`을 읽는다면 그대로 두고, `entry.painter`를 읽던 자리만 `entry.draw.painter`로 바꾼다.

- [ ] **Step 2: 컴파일 확인**

Run: `./gradlew :feature:groups:canvas:impl:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: 린트 확인**

Run: `./gradlew :feature:groups:canvas:impl:lintDebug`
Expected: BUILD SUCCESSFUL (경고가 새로 생기면 그 자리를 고친다)

- [ ] **Step 4: 커밋**

```bash
git add feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/screen/CanvasBGEditScreen.kt
git commit -m "feat: 배경 탭에서도 토핑을 반투명으로 그린다"
```

---

### Task 4: 두 탭의 Preview를 늘린다

이 모듈에는 계측 테스트가 없다. Preview가 유일한 시각 검증 수단이므로 두 탭을 각각 볼 수 있어야 한다.

**Files:**
- Modify: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/screen/CanvasBGEditScreen.kt`

**Interfaces:**
- Consumes: `CanvasBGEditUiState`, `CanvasToppingItem`, `YGPreview`, `PreviewBox`
- Produces: 없음

- [ ] **Step 1: Preview용 토핑 표본을 만든다**

파일 하단 기존 Preview 함수 근처에 둔다. 이미지 주소는 네트워크를 타지 않아도 배치·불투명도는 확인할 수 있다.

```kotlin
private val previewToppings = listOf(
    CanvasToppingItem(
        parfaitImageId = 1L,
        isMine = true,
        imageUrl = "",
        positionX = 0.3f,
        positionY = 0.4f,
        scale = 1f,
        rotationDegrees = 0f,
    ),
    CanvasToppingItem(
        parfaitImageId = 2L,
        isMine = false,
        imageUrl = "",
        positionX = 0.7f,
        positionY = 0.6f,
        scale = 1.2f,
        rotationDegrees = 15f,
    ),
)
```

- [ ] **Step 2: 배경 탭·토핑 탭 Preview를 각각 추가한다**

기존 Preview가 쓰는 래퍼(`YGPreview` + `PreviewBox`)와 콜백 전달 방식을 그대로 따른다. 콜백은 전부 빈 람다다.

```kotlin
@YGPreview
@Composable
private fun CanvasBGEditScreenBackgroundTabPreview() {
    PreviewBox {
        CanvasBGEditScreen(
            uiState = CanvasBGEditUiState(
                selectedTab = CanvasEditTab.BACKGROUND,
                toppings = previewToppings,
            ),
            onSelectTab = {},
            onSelectColor = {},
            onClickCamera = {},
            onClickGallery = {},
            onClickCloseButton = {},
            onQuitDialogConfirm = {},
            onQuitDialogCancel = {},
            onClickConfirm = {},
            onClickTopping = {},
            onClickDeselectTopping = {},
            onClickDeleteTopping = {},
            onDeleteToppingDialogConfirm = {},
            onDeleteToppingDialogCancel = {},
            onClickEditTopping = {},
            onToppingResizeDrag = {},
            onToppingRotateDrag = {},
            onToppingMoveDrag = { _, _ -> },
        )
    }
}

@YGPreview
@Composable
private fun CanvasBGEditScreenToppingTabPreview() {
    PreviewBox {
        CanvasBGEditScreen(
            uiState = CanvasBGEditUiState(
                selectedTab = CanvasEditTab.TOPPING,
                toppings = previewToppings,
                selectedToppingId = 1L,
            ),
            onSelectTab = {},
            onSelectColor = {},
            onClickCamera = {},
            onClickGallery = {},
            onClickCloseButton = {},
            onQuitDialogConfirm = {},
            onQuitDialogCancel = {},
            onClickConfirm = {},
            onClickTopping = {},
            onClickDeselectTopping = {},
            onClickDeleteTopping = {},
            onDeleteToppingDialogConfirm = {},
            onDeleteToppingDialogCancel = {},
            onClickEditTopping = {},
            onToppingResizeDrag = {},
            onToppingRotateDrag = {},
            onToppingMoveDrag = { _, _ -> },
        )
    }
}
```

같은 이름의 Preview가 이미 있으면 새로 만들지 말고 그것을 두 벌로 가른다.

- [ ] **Step 3: 컴파일·린트 확인**

Run: `./gradlew :feature:groups:canvas:impl:compileDebugKotlin :feature:groups:canvas:impl:lintDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 유닛 테스트 전체 확인**

Run: `./gradlew :feature:groups:canvas:impl:test`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/screen/CanvasBGEditScreen.kt
git commit -m "test: 배경 편집 두 탭의 Preview 를 나눈다"
```

---

## 수동 확인 (구현자가 직접)

Preview에서 다음을 눈으로 확인한다. 실기기 확인은 별도로 남긴다.

- [ ] 배경 탭에서 토핑 두 개가 모두 보이고 반투명이다
- [ ] 배경 탭에서 딤 오버레이가 없다(배경색·배경 이미지가 그대로 보인다)
- [ ] 배경 탭에서 선택 스트로크와 모서리 버튼이 없다
- [ ] 토핑 탭으로 옮기면 기존과 같다 — 남의 토핑 위에 딤, 그 위에 내 토핑, 선택된 것에 모서리 버튼
- [ ] 두 탭에서 토핑의 상대 위치가 같다(캔버스 박스 크기가 달라져도 비율로 따라온다)

실기기에서 확인할 것(이 PR의 「검증 못 한 것」):

- [ ] 배경 탭에서 토핑을 눌러도 아무 반응이 없다
- [ ] TalkBack이 배경 탭의 토핑을 버튼으로 읽지 않는다

---

## Self-Review 결과

**스펙 커버리지** — 「PR1 — 배경 탭 토핑 렌더링」의 요구 다섯을 각각 짚는다. 게이트 분리(Task 3), 붙이지 않는 것 넷(Task 2·3), 마스크 호출 배제(Task 1), 불투명도(Task 2), Preview 검증(Task 4). 「배치·크기」 절은 코드 변경을 요구하지 않고 근거만 적은 것이라 태스크가 없다.

**타입 일관성** — `BGEditDrawEntry`는 Task 1에서 정의하고 Task 2·3에서 그대로 쓴다. `CanvasToppingImage`의 파라미터 이름(`entry`·`alpha`·`onClick`)은 Task 2에서 정하고 Task 3의 세 호출부가 같은 이름을 쓴다. `BACKGROUND_TAB_TOPPING_ALPHA`는 Task 2에서 정의하고 Task 3에서 쓴다.

**남은 불확실** — `toppingCenter`의 반환 타입과 기존 Preview 래퍼의 정확한 이름은 파일을 열어 확인해야 한다. 계획은 "현재 반환 타입을 그대로 쓴다", "기존 Preview가 쓰는 래퍼를 그대로 따른다"로 지시했다.
