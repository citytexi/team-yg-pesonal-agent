---
id: topping-border-distance-field
title: 토핑 테두리 거리장 렌더링 통일
status: draft
type: work-order
created: 2026-09-07
updated: 2026-09-07
platforms: android
owner: Parfait 팀
related_adr: ADR-0030, ADR-0025
related_spec: topping-border-distance-field
related_code:
  - ToppingBorderOutline.kt#ToppingOutlineDistanceField
  - YGToppingCutoutImage.kt#YGToppingCutoutImage
  - ToppingAlphaMaskCache.kt#loadToppingAlphaMask
  - ToppingHitTarget.kt#ToppingHitTarget
  - FloatArrayExtension.kt#fillWithSquaredDistance
archived_reason:
tags: [plan, parfait, topping, border, rendering, hit-test]
---

# 토핑 테두리 거리장 렌더링 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development(권장) 또는
> superpowers:executing-plans로 task 단위 구현. 단계는 체크박스(`- [ ]`)로 추적.

**Goal:** 토핑 테두리를 그리는 코드 둘(편집 화면의 거리장, 나머지 화면의 여덟 방향 스탬프)을 거리장
하나로 합치고, 같은 거리장이 터치 판정까지 먹이게 한다.

**Architecture:** 거리장 계산기를 `feature/segmentation/impl`의 `internal`에서
`core:util:jvm`(순수 로직)과 `core:util:android`(비트맵 변환)로 승격한다. `ToppingAlphaMaskCache`는
`core:ui`로 옮겨 한 번의 디코딩으로 거리판을 내게 확장한다. `YGToppingCutoutImage`는 스탬프 여덟
장 대신 띠 한 장 + 원본 한 장을 그리고, `ToppingHitTarget`은 여덟 방향 되밀기 대신 거리판을 읽는다.

**Tech Stack:** Kotlin, Jetpack Compose, Coil 3, `kotlin.test` 유닛 테스트, Gradle 컨벤션 플러그인.

**Spec:** [`parfait/specs/2026-09-07-topping-border-distance-field.md`](../specs/2026-09-07-topping-border-distance-field.md)

## Global Constraints

- **커밋하지 않는다.** 사용자가 요청하지 않았다. Task 끝의 검증이 통과하면 다음 Task로 간다.
- **작업 대상 저장소는 `TJYG-Android`다.** 브랜치는 `refactor/#337-topping-border-optimization`
  (현재 `develop`과 차이 없음). Task 8의 문서 갱신만 이 문서 저장소에서 한다.
- **굵기 규칙을 바꾸지 않는다.** `MIN_BORDER_WIDTH_DP = 2f`, `MAX_BORDER_WIDTH_DP = 50f`,
  화면 dp 고정. 이 값들은 읽기만 한다.
- **기존 파일을 전문으로 덮어쓰지 않는다.** 추가·치환으로 고친다.
- **주석 규약**(`parfait/CLAUDE.md`):
  - 코드가 이미 말하는 것은 쓰지 않는다.
  - `@return`·`@param`은 타입·이름이 말하지 못할 때만 쓴다.
  - 다른 컴포넌트의 현재 상태를 단정하지 않는다(낡는다). 필요하면 근거 문서를 가리킨다.
- **ktlint 한 줄 120자**를 넘기지 않는다.
- Gradle 태스크 이름이 모듈 종류마다 다르다. `core:util:jvm`은 kotlin-jvm이라 `:test`이고,
  Android 라이브러리 모듈은 `:testDebugUnitTest`다.

---

## 파일 구성

| 파일 | 책임 | Task |
|------|------|------|
| `core/util/jvm/src/main/kotlin/com/teamyg/parfait/core/util/jvm/outline/ToppingOutline.kt` | 거리판 보유·보간·띠 채우기·불투명 판정 (신설) | 1 |
| `core/util/jvm/src/test/kotlin/com/teamyg/parfait/core/util/jvm/outline/ToppingOutlineTest.kt` | 위의 유닛 (신설) | 1 |
| `core/util/android/src/main/kotlin/com/teamyg/parfait/core/util/android/outline/ToppingOutlineBitmap.kt` | `Bitmap` → 거리판, 거리판 → 띠 `Bitmap` 2종 (신설) | 2 |
| `feature/segmentation/impl/.../editor/ToppingBorderOutline.kt` | `toBorderBands`만 남는다 (축소) | 3 |
| `feature/segmentation/impl/.../screen/ToppingBorderEditScreen.kt` | 새 코어 사용 + 여백을 굵기 상한에서 파생 | 3 |
| `core/designsystem/.../component/ygtoppingcutout/YGToppingCutoutImage.kt` | 띠 1장 + 원본 1장 | 4 |
| `core/ui/src/main/java/com/teamyg/parfait/core/ui/outline/ToppingOutlineCache.kt` | LRU 캐시·in-flight 합류·Coil 디코딩 (이동+확장) | 5 |
| `feature/groups/canvas/impl/.../util/ToppingAlphaMask.kt` | 삭제 | 6 |
| `feature/groups/canvas/impl/.../util/ToppingAlphaMaskCache.kt` | 삭제(`core:ui`로 이동) | 5 |
| `feature/groups/canvas/impl/.../util/ToppingHitTarget.kt` | 거리판 조회 판정 | 6 |
| `feature/groups/canvas/impl/.../component/CanvasToppingLayer.kt` | 거리판 전달, `loadMasks` 제거 | 7 |
| `feature/groups/canvas/impl/.../screen/CanvasToppingPlaceScreen.kt` | 거리판 전달 | 7 |
| `feature/groups/canvas/impl/.../screen/CanvasBGEditScreen.kt` | 거리판 전달, 인셋 우회 정리 | 7 |
| `feature/segmentation/impl/.../screen/SegmentationConfirmScreen.kt` | 거리판 전달 | 7 |

---

### Task 1: 거리판 코어를 `core:util:jvm`에 세운다

**Files:**
- Create: `core/util/jvm/src/main/kotlin/com/teamyg/parfait/core/util/jvm/outline/ToppingOutline.kt`
- Test: `core/util/jvm/src/test/kotlin/com/teamyg/parfait/core/util/jvm/outline/ToppingOutlineTest.kt`

**Interfaces:**
- Consumes: `FloatArrayExtension.kt`의 `fillWithSquaredDistance`·`SQUARED_DISTANCE_UNSET`,
  `ArgbExtension.kt`의 `fadeArgb`·`mixArgb`. 모두 같은 모듈의 `extension` 패키지에 이미 있다.
- Produces:
  - `class ToppingOutline`, 프로퍼티 `width: Int`·`height: Int`·`hasAnySeed: Boolean`
  - `ToppingOutline.of(width: Int, height: Int, alphaAt: (x: Int, y: Int) -> Int): ToppingOutline`
  - `fun distanceAt(x: Float, y: Float): Float`
  - `fun isOpaqueAt(x: Float, y: Float): Boolean`
  - `fun buildBorderAlpha(targetWidth: Int, targetHeight: Int, outsetPx: Float): ByteArray?`
  - `fun buildBorderPixels(targetWidth: Int, targetHeight: Int, bands: List<ToppingBorderBand>): IntArray?`
  - `data class ToppingBorderBand(val outsetPx: Float, val colorArgb: Int)`
  - `const val OUTLINE_ALPHA_THRESHOLD = 128`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`core/util/jvm/src/test/kotlin/com/teamyg/parfait/core/util/jvm/outline/ToppingOutlineTest.kt`:

```kotlin
package com.teamyg.parfait.core.util.jvm.outline

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

private const val OPAQUE = 255
private const val TRANSPARENT = 0
private const val TOLERANCE = 0.2f

/** 실루엣을 그림으로 준다. `#` 이 불투명한 자리다 */
private fun outlineOf(vararg rows: String): ToppingOutline =
    ToppingOutline.of(width = rows.first().length, height = rows.size) { x, y ->
        if (rows[y][x] == '#') OPAQUE else TRANSPARENT
    }

/** ByteArray 는 부호가 있어 255 가 -1 로 담긴다. 눈으로 읽을 0~255 로 되돌린다 */
private fun ByteArray.alphaAt(index: Int): Int = this[index].toInt() and 0xFF

class ToppingOutlineTest {
    @Test
    fun buildBorderAlpha_thinBar_bandStaysContinuousAlongTheBar() {
        // Given 폭 2 인 세로 막대. 여덟 방향 스탬프가 갈래로 쪼개던 모양이다
        val outline = outlineOf(
            "....##....",
            "....##....",
            "....##....",
            "....##....",
            "....##....",
            "....##....",
            "....##....",
            "....##....",
        )

        // When 막대 폭보다 두꺼운 띠를 두른다
        val alpha = outline.buildBorderAlpha(targetWidth = 10, targetHeight = 8, outsetPx = 3f)

        // Then 막대 바로 옆 세로줄이 위에서 아래까지 한 칸도 안 끊긴다
        assertNotNull(alpha)
        val leftColumn = (0 until 8).map { y -> alpha.alphaAt(y * 10 + 1) }
        assertTrue(leftColumn.all { it > 0 }, "막대 왼쪽 띠가 끊겼다: $leftColumn")
    }

    @Test
    fun buildBorderAlpha_edgeSitsAtTheOutsetDistance() {
        // Given 한가운데 한 칸만 불투명한 판
        val outline = outlineOf(
            ".......",
            ".......",
            ".......",
            "...#...",
            ".......",
            ".......",
            ".......",
        )

        // When 거리 2 까지 칠한다
        val alpha = outline.buildBorderAlpha(targetWidth = 7, targetHeight = 7, outsetPx = 2f)

        // Then 거리 2 인 자리는 남고 거리 3 인 자리는 비어 있다
        assertNotNull(alpha)
        assertTrue(alpha.alphaAt(3 * 7 + 1) > 0, "거리 2 인 자리가 비었다")
        assertEquals(0, alpha.alphaAt(3 * 7 + 0), "거리 3 인 자리가 칠해졌다")
    }

    @Test
    fun buildBorderAlpha_isNullWhenNothingIsOpaque() {
        // Given 전부 투명한 판 — 실루엣이 없으면 두를 대상도 없다
        val outline = outlineOf(
            "....",
            "....",
        )

        assertFalse(outline.hasAnySeed)
        assertNull(outline.buildBorderAlpha(targetWidth = 4, targetHeight = 2, outsetPx = 1f))
    }

    @Test
    fun distanceAt_interpolatesBetweenCells() {
        // Given 왼쪽 한 줄만 불투명하다 — 거리가 x 그대로다
        val outline = outlineOf(
            "#....",
            "#....",
        )

        // Then 칸 사이를 읽으면 두 칸 값의 중간이 나온다
        assertEquals(2.5f, outline.distanceAt(2.5f, 0f), TOLERANCE)
    }

    @Test
    fun isOpaqueAt_readsTheNearestCellWithoutInterpolating() {
        // Given 불투명한 칸과 투명한 칸이 붙어 있다
        val outline = outlineOf("#.")

        // Then 경계 근처는 보간값이 아니라 가장 가까운 칸의 답을 준다
        assertTrue(outline.isOpaqueAt(0.4f, 0f))
        assertFalse(outline.isOpaqueAt(0.6f, 0f))
    }

    @Test
    fun distanceAt_quantizationErrorStaysWithinAnEighthOfAPixel() {
        // Given 왼쪽 한 줄만 불투명해 x 좌표가 곧 참값인 판
        val outline = outlineOf(
            "#......",
            "#......",
        )

        // Then 눈금이 1/8 필드픽셀이므로 오차가 그 절반을 넘지 않는다
        for (x in 0..6) {
            assertEquals(x.toFloat(), outline.distanceAt(x.toFloat(), 0f), 1f / 16f)
        }
    }

    @Test
    fun buildBorderAlpha_scalesTheBandWhenTheTargetIsBiggerThanTheField() {
        // Given 4x4 판을 8x8 로 칠한다 — 판보다 넓은 그림이라 칸 사이를 섞어 읽는 경로다
        val outline = outlineOf(
            "....",
            ".##.",
            ".##.",
            "....",
        )

        // When 목표 좌표계에서 2 픽셀 두께로 두른다(판 좌표계로는 1)
        val alpha = outline.buildBorderAlpha(targetWidth = 8, targetHeight = 8, outsetPx = 2f)

        // Then 네 모서리는 실루엣에서 멀어 비어 있고, 실루엣 바로 바깥은 칠해진다
        assertNotNull(alpha)
        assertEquals(0, alpha.alphaAt(0), "왼쪽 위 모서리가 칠해졌다")
        assertTrue(alpha.alphaAt(3 * 8 + 1) > 0, "실루엣 바로 왼쪽이 안 칠해졌다")
    }

    @Test
    fun buildBorderPixels_mixesAdjacentBandColorsAtTheirBoundary() {
        // Given 한가운데 한 칸만 불투명한 판에 색이 다른 두 겹을 두른다
        val outline = outlineOf(
            ".....",
            ".....",
            "..#..",
            ".....",
            ".....",
        )
        val red = 0xFFFF0000.toInt()
        val blue = 0xFF0000FF.toInt()

        // When 안쪽 겹이 거리 1 까지, 바깥 겹이 거리 2 까지다
        val pixels = outline.buildBorderPixels(
            targetWidth = 5,
            targetHeight = 5,
            bands = listOf(
                ToppingBorderBand(outsetPx = 1f, colorArgb = red),
                ToppingBorderBand(outsetPx = 2f, colorArgb = blue),
            ),
        )

        // Then 실루엣 자리는 안쪽 겹 색이고 거리 2 자리는 바깥 겹 색이다
        assertNotNull(pixels)
        assertEquals(red, pixels[2 * 5 + 2])
        assertEquals(blue, pixels[2 * 5 + 0])
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
./gradlew :core:util:jvm:test --tests "com.teamyg.parfait.core.util.jvm.outline.ToppingOutlineTest"
```

Expected: 컴파일 실패 — `Unresolved reference: outline`.

- [ ] **Step 3: 구현한다**

`core/util/jvm/src/main/kotlin/com/teamyg/parfait/core/util/jvm/outline/ToppingOutline.kt`:

```kotlin
package com.teamyg.parfait.core.util.jvm.outline

import com.teamyg.parfait.core.util.jvm.extension.SQUARED_DISTANCE_UNSET
import com.teamyg.parfait.core.util.jvm.extension.fadeArgb
import com.teamyg.parfait.core.util.jvm.extension.fillWithSquaredDistance
import com.teamyg.parfait.core.util.jvm.extension.mixArgb
import kotlin.math.floor
import kotlin.math.roundToInt
import kotlin.math.sqrt

/** 실루엣 안으로 볼 알파 문턱. 이보다 옅은 자리는 실루엣 바깥으로 친다 */
const val OUTLINE_ALPHA_THRESHOLD = 128

/** 1 필드픽셀을 이 수만큼 쪼개 담는다 */
private const val DISTANCE_STEPS_PER_PX = 8

/** 담을 수 있는 가장 먼 거리(필드픽셀). 그 너머는 어떤 굵기보다도 멀어 구분할 이유가 없다 */
private const val MAX_STORED_DISTANCE_PX = Short.MAX_VALUE / DISTANCE_STEPS_PER_PX

/** 가장자리 한 겹을 반 픽셀씩 물려 칠해 계단이 지지 않게 한다 */
private const val EDGE_FEATHER_PX = 0.5f

private const val ALPHA_MAX = 255

/**
 * 테두리 한 겹이 차지하는 구간.
 *
 * @param outsetPx 실루엣에서 이 겹의 바깥 끝까지 거리. 겹은 아래 겹을 감싸며 쌓이므로
 *   자기 굵기가 아니라 자기까지의 굵기를 모두 더한 값이다
 */
data class ToppingBorderBand(
    val outsetPx: Float,
    val colorArgb: Int,
)

/**
 * 실루엣에서 떨어진 거리를 픽셀마다 담아 둔 판.
 *
 * 실루엣 사본을 원 둘레에 빙 둘러 찍어 테두리를 만들면 굵어질수록 찍은 자국 사이가 벌어져
 * 가장자리가 갈라진다. 거리를 한 번 재 두면 굵기는 '거리가 얼마 이하인 자리를 칠하는' 문제가 되어
 * 어떤 굵기에서도 가장자리가 실루엣에서 같은 거리인 곡선으로 이어진다.
 *
 * 굵기를 바꿔도 거리는 그대로라, 슬라이더를 움직이는 동안에는 칠하는 일만 다시 하면 된다.
 */
class ToppingOutline internal constructor(
    val width: Int,
    val height: Int,
    /** 실루엣까지의 거리를 [DISTANCE_STEPS_PER_PX] 눈금으로 담는다 */
    private val distances: ShortArray,
) {
    val hasAnySeed: Boolean = distances.any { step -> step.toInt() == 0 }

    /** 판보다 넓은 그림을 칠할 수도 있어, 네 칸을 섞어 칸 사이 거리도 이어지게 읽는다 */
    fun distanceAt(
        x: Float,
        y: Float,
    ): Float {
        val leftIndex = floor(x).toInt().coerceIn(0, width - 1)
        val topIndex = floor(y).toInt().coerceIn(0, height - 1)
        val rightIndex = (leftIndex + 1).coerceAtMost(width - 1)
        val bottomIndex = (topIndex + 1).coerceAtMost(height - 1)

        val rightWeight = (x - leftIndex).coerceIn(0f, 1f)
        val bottomWeight = (y - topIndex).coerceIn(0f, 1f)

        val topRow = topIndex * width
        val bottomRow = bottomIndex * width
        val top = lerp(rawAt(topRow + leftIndex), rawAt(topRow + rightIndex), rightWeight)
        val bottom = lerp(rawAt(bottomRow + leftIndex), rawAt(bottomRow + rightIndex), rightWeight)

        return lerp(top, bottom, bottomWeight)
    }

    /**
     * [distanceAt] 과 달리 보간하지 않고 가장 가까운 칸을 읽는다 — 판정이 칸 단위로 답하던
     * 기존 동작을 그대로 유지하기 위해서다.
     */
    fun isOpaqueAt(
        x: Float,
        y: Float,
    ): Boolean {
        val cellX = floor(x + 0.5f).toInt()
        val cellY = floor(y + 0.5f).toInt()
        if (cellX < 0 || cellY < 0 || cellX >= width || cellY >= height) return false
        return distances[cellY * width + cellX].toInt() == 0
    }

    /**
     * 색을 태우지 않은 단색 띠. 칸마다 0~255 의 덮은 정도만 담는다.
     *
     * @return 실루엣이 없거나 크기가 0 이하면 `null`
     */
    fun buildBorderAlpha(
        targetWidth: Int,
        targetHeight: Int,
        outsetPx: Float,
    ): ByteArray? {
        if (!hasAnySeed || targetWidth <= 0 || targetHeight <= 0 || outsetPx <= 0f) return null

        val alpha = ByteArray(targetWidth * targetHeight)
        forEachBandPixel(targetWidth, targetHeight, floatArrayOf(outsetPx)) { index, _, coverage ->
            alpha[index] = (coverage * ALPHA_MAX).roundToInt().toByte()
        }
        return alpha
    }

    /**
     * 겹을 안쪽부터 겹겹이 칠한 그림. 알맹이는 이 위에 원래 자리 그대로 얹히므로 실루엣 안쪽도
     * 가장 안쪽 겹 색으로 채워 둔다.
     */
    fun buildBorderPixels(
        targetWidth: Int,
        targetHeight: Int,
        bands: List<ToppingBorderBand>,
    ): IntArray? {
        if (!hasAnySeed || bands.isEmpty() || targetWidth <= 0 || targetHeight <= 0) return null

        val colors = IntArray(bands.size) { index -> bands[index].colorArgb }
        val pixels = IntArray(targetWidth * targetHeight)
        val outsets = FloatArray(bands.size) { index -> bands[index].outsetPx }

        forEachBandPixel(targetWidth, targetHeight, outsets) { index, bandIndex, coverage ->
            // 겹의 끝에 걸친 자리는 반씩 물려, 가장 바깥이면 투명하게 안쪽이면 다음 겹 색으로 이어 준다
            pixels[index] = if (bandIndex == colors.lastIndex) {
                colors[bandIndex].fadeArgb(coverage)
            } else {
                colors[bandIndex].mixArgb(colors[bandIndex + 1], coverage)
            }
        }
        return pixels
    }

    /**
     * 띠 안에 드는 칸만 골라 [onPixel] 에 넘긴다. 단색과 여러 겹이 이 순회를 함께 쓴다.
     *
     * 거리는 이 판의 좌표계 길이라, 겹의 끝과 가장자리 물림도 같은 좌표계로 바꿔 재야 한다.
     */
    private inline fun forEachBandPixel(
        targetWidth: Int,
        targetHeight: Int,
        outsetsPx: FloatArray,
        onPixel: (index: Int, bandIndex: Int, coverage: Float) -> Unit,
    ) {
        val fieldPerTargetPx = width.toFloat() / targetWidth
        val targetPxPerField = 1f / fieldPerTargetPx
        val edges = FloatArray(outsetsPx.size) { index -> outsetsPx[index] * fieldPerTargetPx }
        val outermostEdge = edges.last() + EDGE_FEATHER_PX * fieldPerTargetPx

        // 판과 칸이 일대일로 맞으면 섞지 않고 그 칸을 읽는다
        val fitsField = width == targetWidth && height == targetHeight

        for (y in 0 until targetHeight) {
            val fieldY = (y + 0.5f) * fieldPerTargetPx - 0.5f
            val rowStart = y * targetWidth

            for (x in 0 until targetWidth) {
                val distance = if (fitsField) {
                    rawAt(rowStart + x)
                } else {
                    distanceAt((x + 0.5f) * fieldPerTargetPx - 0.5f, fieldY)
                }
                if (distance > outermostEdge) continue

                var bandIndex = 0
                while (bandIndex < edges.lastIndex && distance > edges[bandIndex]) bandIndex++

                val coverage = ((edges[bandIndex] - distance) * targetPxPerField + EDGE_FEATHER_PX)
                    .coerceIn(0f, 1f)
                onPixel(rowStart + x, bandIndex, coverage)
            }
        }
    }

    @PublishedApi
    internal fun rawAt(index: Int): Float = distances[index].toInt().toFloat() / DISTANCE_STEPS_PER_PX

    companion object {
        /**
         * @param alphaAt 그 자리 픽셀의 알파를 0~255 로 답한다
         */
        fun of(
            width: Int,
            height: Int,
            alphaAt: (x: Int, y: Int) -> Int,
        ): ToppingOutline {
            val squared = FloatArray(width * height) { index ->
                val opaque = alphaAt(index % width, index / width) >= OUTLINE_ALPHA_THRESHOLD
                if (opaque) 0f else SQUARED_DISTANCE_UNSET
            }
            squared.fillWithSquaredDistance(width, height)

            return ToppingOutline(
                width = width,
                height = height,
                distances = ShortArray(squared.size) { index ->
                    val distance = sqrt(squared[index]).coerceAtMost(MAX_STORED_DISTANCE_PX.toFloat())
                    (distance * DISTANCE_STEPS_PER_PX).roundToInt().toShort()
                },
            )
        }
    }
}

private fun lerp(
    start: Float,
    stop: Float,
    fraction: Float,
): Float = start + (stop - start) * fraction
```

⚠️ `forEachBandPixel`이 `private inline`이라 그 안에서 부르는 `rawAt`·`distanceAt`은
`private`일 수 없다. `distanceAt`은 공개 API라 문제없고, `rawAt`에는 `@PublishedApi internal`을
붙였다. 이것이 컴파일을 통과시키는 최소 조합이다.

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

```bash
./gradlew :core:util:jvm:test --tests "com.teamyg.parfait.core.util.jvm.outline.ToppingOutlineTest"
```

Expected: 8건 PASS.

- [ ] **Step 5: 모듈 전체 유닛이 여전히 초록인지 본다**

```bash
./gradlew :core:util:jvm:test
```

Expected: 기존 테스트 포함 전부 PASS.

---

### Task 2: 비트맵 변환을 `core:util:android`에 세운다

**Files:**
- Create: `core/util/android/src/main/kotlin/com/teamyg/parfait/core/util/android/outline/ToppingOutlineBitmap.kt`

**Interfaces:**
- Consumes: Task 1의 `ToppingOutline`·`ToppingOutline.of`·`buildBorderAlpha`·`buildBorderPixels`·
  `ToppingBorderBand`
- Produces:
  - `fun Bitmap.toToppingOutline(fieldLongSide: Int): ToppingOutline`
  - `fun ToppingOutline.toBorderAlphaBitmap(targetWidth: Int, targetHeight: Int, outsetPx: Float): Bitmap?`
  - `fun ToppingOutline.toBorderArgbBitmap(targetWidth: Int, targetHeight: Int, bands: List<ToppingBorderBand>): Bitmap?`

⚠️ **이 Task에는 자동 테스트가 없다.** `Bitmap`은 Android 런타임 타입이고 이 모듈에 Robolectric이
없다. 검증은 컴파일과 Task 4의 프리뷰다. 이 사실은 스펙에도 적혀 있다.

- [ ] **Step 1: 구현한다**

```kotlin
package com.teamyg.parfait.core.util.android.outline

import android.graphics.Bitmap
import androidx.core.graphics.createBitmap
import androidx.core.graphics.scale
import com.teamyg.parfait.core.util.jvm.outline.ToppingBorderBand
import com.teamyg.parfait.core.util.jvm.outline.ToppingOutline
import java.nio.ByteBuffer
import kotlin.math.max
import kotlin.math.roundToInt

private const val ALPHA_SHIFT = 24

/**
 * 알파가 남아 있는 자리를 실루엣으로 보고 거리를 잰다.
 *
 * @param fieldLongSide 거리를 잴 때 긴 변을 이 길이까지만 쓴다. 테두리 경계는 굵기만큼 완만한
 *   곡선이라 촘촘히 재도 모양이 달라지지 않는데, 원본 해상도로 재면 사진 크기에 비례해 시간과
 *   메모리만 늘어난다
 */
fun Bitmap.toToppingOutline(fieldLongSide: Int): ToppingOutline {
    val fieldScale = min(1f, fieldLongSide.toFloat() / max(width, height))
    val fieldWidth = max(1, (width * fieldScale).roundToInt())
    val fieldHeight = max(1, (height * fieldScale).roundToInt())

    val source = if (fieldWidth == width && fieldHeight == height) this else scale(fieldWidth, fieldHeight)
    val pixels = IntArray(fieldWidth * fieldHeight)
    source.getPixels(pixels, 0, fieldWidth, 0, 0, fieldWidth, fieldHeight)
    if (source !== this) source.recycle()

    return ToppingOutline.of(fieldWidth, fieldHeight) { x, y ->
        pixels[y * fieldWidth + x] ushr ALPHA_SHIFT
    }
}

/** 색을 태우지 않은 띠. 그리는 쪽이 `ColorFilter` 로 물들인다 */
fun ToppingOutline.toBorderAlphaBitmap(
    targetWidth: Int,
    targetHeight: Int,
    outsetPx: Float,
): Bitmap? {
    val alpha = buildBorderAlpha(targetWidth, targetHeight, outsetPx) ?: return null
    return createBitmap(targetWidth, targetHeight, Bitmap.Config.ALPHA_8).apply {
        copyPixelsFromBuffer(ByteBuffer.wrap(alpha))
    }
}

/** 색까지 태운 띠. 겹이 여럿이거나 알파 판이 안 통하는 자리가 쓴다 */
fun ToppingOutline.toBorderArgbBitmap(
    targetWidth: Int,
    targetHeight: Int,
    bands: List<ToppingBorderBand>,
): Bitmap? {
    val pixels = buildBorderPixels(targetWidth, targetHeight, bands) ?: return null
    return createBitmap(targetWidth, targetHeight)
        .apply { setPixels(pixels, 0, targetWidth, 0, 0, targetWidth, targetHeight) }
}
```

- [ ] **Step 2: 컴파일을 확인한다**

```bash
./gradlew :core:util:android:compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

---

### Task 3: 편집 화면을 새 코어로 옮기고 옛 거리장을 지운다

이 Task가 코드 중복을 만들지 않고 끝낸다. 편집 화면은 이 Task 동안 계속 정상 동작해야 한다.

**Files:**
- Modify: `feature/segmentation/impl/src/main/java/com/teamyg/parfait/feature/segmentation/impl/editor/ToppingBorderOutline.kt`
- Modify: `feature/segmentation/impl/src/main/java/com/teamyg/parfait/feature/segmentation/impl/screen/ToppingBorderEditScreen.kt`
- Modify: `feature/segmentation/impl/src/main/java/com/teamyg/parfait/feature/segmentation/impl/viewmodel/ToppingEditViewModel.kt`

**Interfaces:**
- Consumes: Task 1의 `ToppingBorderBand`, Task 2의 `Bitmap.toToppingOutline`·`toBorderArgbBitmap`
- Produces: `internal fun List<ToppingBorderLayer>.toBorderBands(pxPerDp: Float): List<ToppingBorderBand>`
  (반환 타입만 `core:util:jvm`의 것으로 바뀐다), `internal const val MAX_BORDER_WIDTH_DP`

- [ ] **Step 1: `ToppingBorderOutline.kt`를 `toBorderBands`만 남기고 비운다**

파일 전체를 아래로 치환한다. `ToppingOutlineDistanceField`·`toOutlineDistanceField`·
`ToppingBorderBand`·상수 넷이 사라진다 — 전부 `core:util:{jvm,android}`로 갔다.

```kotlin
package com.teamyg.parfait.feature.segmentation.impl.editor

import com.teamyg.parfait.core.util.jvm.outline.ToppingBorderBand
import com.teamyg.parfait.feature.segmentation.api.ToppingBorderLayer

/**
 * 겹을 구간으로 펴 놓는다.
 *
 * 겹은 아래 겹을 감싸며 쌓이므로 바깥 끝은 자기 굵기가 아니라 자기까지의 굵기를 모두 더한 값이다.
 *
 * 굵기는 dp 로 들고 있으므로 [pxPerDp] 를 곱해 그리는 쪽 좌표계로 환산한다.
 */
internal fun List<ToppingBorderLayer>.toBorderBands(pxPerDp: Float): List<ToppingBorderBand> {
    var outsetDp = 0f
    return map { layer ->
        outsetDp += layer.widthDp
        ToppingBorderBand(outsetPx = outsetDp * pxPerDp, colorArgb = layer.colorArgb)
    }
}
```

- [ ] **Step 2: `ToppingEditViewModel.kt`의 굵기 상한을 모듈 안에서 읽을 수 있게 연다**

`private const val MAX_BORDER_WIDTH_DP = 50f` 를 아래로 치환한다. 값은 바뀌지 않는다.

```kotlin
/** 편집 미리보기 여백이 이 값을 따라간다 — 상한이 올라가면 여백도 함께 올라가야 한다 */
internal const val MAX_BORDER_WIDTH_DP = 50f
```

- [ ] **Step 3: `ToppingBorderEditScreen.kt`가 새 코어를 쓰고 여백을 상한에서 파생시킨다**

세 자리를 고친다.

첫째, 파일 상단의 여백 상수를 굵기 상한에서 파생시킨다.

```kotlin
/** 사방에 남겨 두는 여백. 가장 굵은 테두리도 다 받아낸다 */
private val MAX_BORDER_PADDING_DP = MAX_BORDER_WIDTH_DP
```

둘째, import 를 갈아 끼운다.

```kotlin
import com.teamyg.parfait.core.util.android.outline.toBorderArgbBitmap
import com.teamyg.parfait.core.util.android.outline.toToppingOutline
import com.teamyg.parfait.core.util.jvm.outline.ToppingOutline
import com.teamyg.parfait.feature.segmentation.impl.editor.toBorderBands
import com.teamyg.parfait.feature.segmentation.impl.viewmodel.MAX_BORDER_WIDTH_DP
```

기존의 `ToppingOutlineDistanceField`·`buildCutoutBitmap` 이외 `editor` import 중
`toOutlineDistanceField` 를 지운다.

셋째, `ToppingBorderStamp` 의 필드 타입과 두 `produceState` 본문을 바꾼다.

```kotlin
private data class ToppingBorderStamp(
    val image: ImageBitmap,
    val outline: ToppingOutline,
    val offset: IntOffset,
)
```

`stamp` 를 만드는 `produceState` 안에서:

```kotlin
ToppingBorderStamp(
    image = padded.asImageBitmap(),
    // 미리보기는 화면에 나올 크기 그대로라 판을 줄이지 않는다 — 긴 변을 그대로 상한으로 준다
    outline = padded.toToppingOutline(fieldLongSide = maxOf(padded.width, padded.height)),
    offset = IntOffset(layout.offsetX, layout.offsetY),
)
```

`borderImage` 를 만드는 `produceState` 안에서:

```kotlin
current.outline
    .toBorderArgbBitmap(
        targetWidth = current.image.width,
        targetHeight = current.image.height,
        bands = borderLayers.toBorderBands(density),
    )?.asImageBitmap()
```

- [ ] **Step 4: 기존 유닛과 컴파일을 확인한다**

```bash
./gradlew :feature:segmentation:impl:testDebugUnitTest
```

Expected: 기존 테스트 전부 PASS. `ToppingBorderPreviewLayoutTest` 는 이 Task가 건드리지 않은
`toppingBorderPreviewLayoutOrNull` 을 보므로 그대로 통과해야 한다.

- [ ] **Step 5: 사람이 확인한다 — 편집 화면이 그대로다**

앱을 띄워 사진 → 누끼 → 테두리 탭에서 색을 고르고 슬라이더를 끝까지 민다.
**이 Task는 겉보기 동작을 바꾸지 않는다.** 이전과 같은 모양이 나와야 한다.
가장 굵은 테두리가 미리보기 가장자리에서 깎이지 않는 것도 함께 본다.

---

### Task 4: `YGToppingCutoutImage`를 거리판 렌더로 바꾼다 (ALPHA_8 게이트)

**Files:**
- Modify: `core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/component/ygtoppingcutout/YGToppingCutoutImage.kt`
- Modify: `feature/segmentation/impl/.../screen/SegmentationConfirmScreen.kt`
- Modify: `feature/groups/canvas/impl/.../component/CanvasToppingLayer.kt`
- Modify: `feature/groups/canvas/impl/.../screen/CanvasToppingPlaceScreen.kt`
- Modify: `feature/groups/canvas/impl/.../screen/CanvasBGEditScreen.kt`

**Interfaces:**
- Consumes: Task 1의 `ToppingOutline`, Task 2의 `toBorderAlphaBitmap`·`toBorderArgbBitmap`·
  `toToppingOutline`
- Produces:
  - `@Composable fun YGToppingCutoutImage(painter: Painter, outline: ToppingOutline?, borderColor: Color?, borderWidth: Dp, modifier: Modifier = Modifier)`
  - `TOPPING_OUTLINE_STAMP_COUNT` 는 **삭제된다.** Task 6이 그 마지막 소비자를 지운다.

⚠️ **이 Task부터 Task 7까지 네 화면에 테두리가 안 나온다.** 호출부가 `outline = null` 을 넘겨
컴파일만 맞춰 두기 때문이다. 의도된 중간 상태다.

⚠️ **`TOPPING_OUTLINE_STAMP_COUNT` 를 지우면 `ToppingHitTarget.kt` 가 깨진다.** 그래서 이 Task는
그 상수를 **남겨 둔 채 스탬프 렌더만 걷고**, 상수 삭제는 Task 6이 판정을 갈아 끼우며 한다.

- [ ] **Step 1: 컴포넌트를 다시 쓴다**

`YGToppingCutoutImage.kt` 를 아래로 치환한다.

```kotlin
package com.teamyg.parfait.core.designsystem.component.ygtoppingcutout

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.painter.Painter
import com.teamyg.parfait.core.designsystem.R
import com.teamyg.parfait.core.designsystem.theme.colors.YGAtomicColors
import com.teamyg.parfait.core.designsystem.utils.preview.PreviewBox
import com.teamyg.parfait.core.designsystem.utils.preview.YGPreview
import com.teamyg.parfait.core.util.android.outline.toBorderAlphaBitmap
import com.teamyg.parfait.core.util.jvm.outline.ToppingOutline
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.ceil
import kotlin.math.roundToInt

/**
 * 표시 크기를 이 격자로 반올림해 띠를 다시 만들 시점을 정한다.
 *
 * 굵기가 화면 dp 고정이라 알맹이가 커지면 알맹이 대비 띠 비율이 달라진다. 크기가 바뀔 때마다
 * 다시 칠하면 핀치 중 매 프레임이 되므로, 격자를 넘을 때만 다시 만든다.
 */
private const val BORDER_SIZE_QUANTUM_PX = 32

/**
 * 누끼 이미지와 그 실루엣을 따르는 테두리를 함께 그린다. 사각 테두리를 두르면 잘라 낸 배경이 다시
 * 드러나므로, 실루엣에서 잰 거리로 띠를 만들어 알맹이 아래에 깔고 그 위에 원본을 얹는다.
 *
 * 테두리를 그리는 화면이 여럿이라 여기서 한 벌만 둔다(`adr/0030-topping-outline-distance-field.md`).
 *
 * @param outline 준비되기 전에는 `null` 이다 — 그동안은 테두리 없이 알맹이만 그린다
 * @param borderWidth 화면 기준 dp 다 — 토핑을 키워도 굵기는 그대로다
 */
@Composable
fun YGToppingCutoutImage(
    painter: Painter,
    outline: ToppingOutline?,
    borderColor: Color?,
    borderWidth: Dp,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier) {
        if (outline != null && borderColor != null && borderWidth > 0.dp) {
            ToppingBorder(outline = outline, color = borderColor, width = borderWidth)
        }

        Image(
            painter = painter,
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize(),
        )
    }
}

@Composable
private fun BoxScope.ToppingBorder(
    outline: ToppingOutline,
    color: Color,
    width: Dp,
) {
    val outsetPx = with(LocalDensity.current) { width.toPx() }
    val padding = ceil(outsetPx).toInt() + 1

    // 격자로 반올림한 값만 상태에 쓴다 — 그래야 핀치 중에 매 프레임 다시 칠하지 않는다
    var quantizedBox by remember { mutableStateOf(IntSize.Zero) }

    val plate: ToppingBorderPlate? by produceState<ToppingBorderPlate?>(
        initialValue = null,
        outline,
        quantizedBox,
        outsetPx,
    ) {
        val box = quantizedBox
        if (box.width <= 0 || box.height <= 0) return@produceState

        value = withContext(Dispatchers.Default) {
            // 알맹이는 Fit 으로 앉으므로 상자가 아니라 실루엣 비율로 그려질 자리를 구한다
            val subject = fitSize(outline.width.toFloat() / outline.height, box)
            val plateWidth = subject.width + padding * 2
            val plateHeight = subject.height + padding * 2

            outline
                .toBorderAlphaBitmap(plateWidth, plateHeight, outsetPx)
                ?.asImageBitmap()
                ?.let { image ->
                    ToppingBorderPlate(
                        image = image,
                        offset = IntOffset(
                            x = (box.width - subject.width) / 2 - padding,
                            y = (box.height - subject.height) / 2 - padding,
                        ),
                    )
                }
        }
    }

    Canvas(
        modifier = Modifier
            .matchParentSize()
            .onSizeChanged { size ->
                val quantized = IntSize(size.width.quantize(), size.height.quantize())
                if (quantized != quantizedBox) quantizedBox = quantized
            },
    ) {
        val current = plate ?: return@Canvas
        drawImage(
            image = current.image,
            dstOffset = current.offset,
            dstSize = IntSize(current.image.width, current.image.height),
            colorFilter = ColorFilter.tint(color),
        )
    }
}

/** 알맹이와 여백을 함께 담은 띠 한 장과 그것을 놓을 자리 */
private data class ToppingBorderPlate(
    val image: ImageBitmap,
    val offset: IntOffset,
)

private fun Int.quantize(): Int =
    ((this + BORDER_SIZE_QUANTUM_PX - 1) / BORDER_SIZE_QUANTUM_PX) * BORDER_SIZE_QUANTUM_PX

private fun fitSize(
    aspectRatio: Float,
    box: IntSize,
): IntSize = if (box.width / aspectRatio <= box.height) {
    IntSize(box.width, (box.width / aspectRatio).roundToInt())
} else {
    IntSize((box.height * aspectRatio).roundToInt(), box.height)
}

@YGPreview
@Composable
private fun YGToppingCutoutImagePreview() = PreviewBox {
    val painter = painterResource(R.drawable.ic_plus)
    YGToppingCutoutImage(
        painter = painter,
        outline = null,
        borderColor = YGAtomicColors.Cherry.Cherry200,
        borderWidth = 6.dp,
        modifier = Modifier.size(120.dp),
    )
}
```

`TOPPING_OUTLINE_STAMP_COUNT` 와 `FULL_TURN_DEGREES` 는 이 파일에 **그대로 남긴다.**
`ToppingHitTarget` 이 아직 읽으므로 지우면 컴파일이 깨진다. Task 6이 지운다.

- [ ] **Step 2: 호출부 넷이 `outline = null` 을 넘기게 한다**

네 파일의 `YGToppingCutoutImage(` 호출에 인자 한 줄씩 더한다. 나머지 인자는 그대로다.

```kotlin
    // 거리판 결선은 Task 7 이다 — 그때까지 테두리가 안 나온다
    outline = null,
```

- [ ] **Step 3: 컴파일과 기존 유닛을 확인한다**

```bash
./gradlew :core:designsystem:compileDebugKotlin \
          :feature:segmentation:impl:testDebugUnitTest \
          :feature:groups:canvas:impl:testDebugUnitTest
```

Expected: BUILD SUCCESSFUL, 기존 테스트 전부 PASS.

- [ ] **Step 4: 게이트 — `ALPHA_8` + tint 가 실기기에서 먹는지 사람이 확인한다**

프리뷰의 `outline = null` 을 임시로 아래처럼 바꿔 띄운다. **이 편집은 확인 뒤 되돌린다.**

```kotlin
val outline = remember {
    ToppingOutline.of(width = 64, height = 64) { x, y ->
        if (x in 24..39 && y in 8..55) 255 else 0
    }
}
```

Android Studio 프리뷰가 아니라 **실기기 또는 에뮬레이터**에서 봐야 한다. 프리뷰 렌더러는
하드웨어 가속 캔버스가 아니다.

- 세로 막대 둘레에 `Cherry200` 색 띠가 보이면 **통과다.** 프리뷰를 원래대로 되돌리고 Task 5로 간다.
- 띠가 안 보이거나 검게 나오면 **폴백으로 간다.** `toBorderAlphaBitmap` 호출을 아래로 바꾸고,
  `produceState` 의 키 목록에 `color` 를 더한다.

```kotlin
outline.toBorderArgbBitmap(
    plateWidth,
    plateHeight,
    listOf(ToppingBorderBand(outsetPx = outsetPx, colorArgb = color.toArgb())),
)
```

폴백을 택하면 `drawImage` 의 `colorFilter` 인자를 지우고, 이 문서의 이 단계에 판정 결과를 적는다.

---

### Task 5: 캐시를 `core:ui`로 옮기고 거리판을 내게 확장한다

**Files:**
- Create: `core/ui/src/main/java/com/teamyg/parfait/core/ui/outline/ToppingOutlineCache.kt`
- Delete: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/util/ToppingAlphaMaskCache.kt`

**Interfaces:**
- Consumes: Task 1의 `ToppingOutline`, Task 2의 `Bitmap.toToppingOutline`
- Produces:
  - `suspend fun loadToppingOutline(context: Context, model: String, retryKey: Int): ToppingOutline?`
  - `@Composable fun rememberToppingOutlines(models: List<String>, retryKey: Int): Map<String, ToppingOutline>`
  - `fun clearToppingOutlines()`

⚠️ **이 Task에도 자동 테스트가 없다.** `Context`·Coil·`Bitmap` 이 필요하다. 검증은 컴파일과
Task 8의 실기기 확인이다.

- [ ] **Step 1: 새 파일을 만든다**

`ToppingAlphaMaskCache.kt` 의 구조를 그대로 옮기되 세 곳이 다르다 — 캐시 값 타입이
`ToppingOutline` 이고, 키가 `model` 이 아니라 `"$retryKey|$model"` 이고, 디코딩 뒤 비트셋 대신
거리판을 만든다.

```kotlin
package com.teamyg.parfait.core.ui.outline

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import coil3.imageLoader
import coil3.request.CachePolicy
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.toBitmap
import com.teamyg.parfait.core.util.android.outline.toToppingOutline
import com.teamyg.parfait.core.util.jvm.outline.ToppingOutline
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.withContext

/** 거리판 한 장의 긴 변. 올리면 테두리가 실루엣에 가까워지고 디코딩·메모리가 는다 */
private const val OUTLINE_LONG_SIDE = 256

/** 캔버스 하나에 올라가는 토핑 수를 넉넉히 덮는 상한 */
private const val OUTLINE_CACHE_ENTRIES = 64

private const val LOAD_FACTOR = 0.75f

/**
 * 접근 순서 갱신이 곧 쓰기라, 여럿이 잠금 없이 건드리면 상태가 깨진다. 로딩을 어느 컨텍스트에서
 * 부르는지 이 파일이 정하지 않으므로 모든 접근을 [outlineCache] 자신에 대해 동기화한다.
 */
private val outlineCache = object : LinkedHashMap<String, ToppingOutline>(
    OUTLINE_CACHE_ENTRIES,
    LOAD_FACTOR,
    true,
) {
    override fun removeEldestEntry(eldest: Map.Entry<String, ToppingOutline>): Boolean =
        size > OUTLINE_CACHE_ENTRIES
}

/**
 * 같은 모델을 아직 뜨는 중이면 그 로드에 합류시킨다. 캐시 조회부터 쓰기까지가 잠금 밖이라,
 * 두 화면이 같은 토핑을 거의 동시에 요청하면 둘 다 캐시 미스로 갈라져 같은 이미지를 각자 디코딩한다.
 */
private val inFlightOutlines = mutableMapOf<String, Deferred<ToppingOutline?>>()

/**
 * 로드를 시작한 컴포지션이 먼저 사라져도 합류한 쪽이 같이 죽으면 안 되므로, 실제 로드는 호출자
 * 스코프가 아니라 여기서 돈다.
 */
private val outlineLoadScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

/**
 * [model] 은 그 화면이 **실제로 그리는** 대상이어야 한다. 편집본을 그리는 화면에 원본 주소를
 * 넘기면 투명 여백이 잘려 비율이 달라 실루엣이 통째로 어긋난다.
 *
 * @param retryKey 올리면 이 모델의 캐시를 건너뛰고 다시 받는다 — 안 그러면 재시도로 그림이 돌아와도
 *   테두리와 판정이 옛 실패에 묶인다
 */
suspend fun loadToppingOutline(
    context: Context,
    model: String,
    retryKey: Int,
): ToppingOutline? {
    val key = "$retryKey|$model"
    synchronized(outlineCache) { outlineCache[key] }?.let { return it }

    // 로드가 호출자보다 오래 살 수 있어 화면 컨텍스트를 넘기면 그동안 붙잡힌다
    val appContext = context.applicationContext

    return synchronized(inFlightOutlines) {
        inFlightOutlines.getOrPut(key) {
            outlineLoadScope.async { decodeToppingOutline(appContext, model, key) }.also { started ->
                started.invokeOnCompletion {
                    synchronized(inFlightOutlines) {
                        if (inFlightOutlines[key] === started) inFlightOutlines.remove(key)
                    }
                }
            }
        }
    }.await()
}

private suspend fun decodeToppingOutline(
    context: Context,
    model: String,
    key: String,
): ToppingOutline? {
    val request = ImageRequest
        .Builder(context)
        .data(model)
        .size(OUTLINE_LONG_SIDE)
        .allowHardware(false)
        // 거리판으로 접고 나면 버릴 비트맵이다. 표시용과 크기가 달라 키도 다르니, 얹어 두면
        // 토핑 수만큼 쓸모없는 항목이 표시용 비트맵을 밀어낸다
        .memoryCachePolicy(CachePolicy.DISABLED)
        .build()

    val image = (context.imageLoader.execute(request) as? SuccessResult)?.image ?: return null

    // execute 는 자기 디스패처에서 돌지만 그 뒤는 부르는 쪽 컨텍스트다. 전 픽셀 순회를
    // 그대로 두면 호출부가 메인 스레드일 때 토핑 수만큼 메인이 잡힌다
    val outline = withContext(Dispatchers.Default) {
        image.toBitmap().toToppingOutline(fieldLongSide = OUTLINE_LONG_SIDE)
    }

    synchronized(outlineCache) { outlineCache.put(key, outline) }
    return outline
}

/**
 * 메모리 압박이나 테스트에서 캐시를 비우는 수단. 아직 부르는 곳을 두지 않았다 — 항목 수에
 * 상한이 있어 누수가 아니라서 호출부 신설을 미뤘다.
 */
fun clearToppingOutlines() {
    synchronized(outlineCache) { outlineCache.clear() }
}

/** [models] 가 비면 아무것도 로드하지 않는다 */
@Composable
fun rememberToppingOutlines(
    models: List<String>,
    retryKey: Int,
): Map<String, ToppingOutline> {
    val context = LocalContext.current
    val loaded = remember { mutableStateMapOf<String, ToppingOutline>() }

    LaunchedEffect(models, retryKey) {
        models
            .distinct()
            .forEach { model ->
                loadToppingOutline(context, model, retryKey)?.let { loaded[model] = it }
            }
    }

    return loaded
}
```

⚠️ 기존 `rememberToppingAlphaMasks` 는 `filterNot { loaded.containsKey(it) }` 로 이미 뜬 것을
건너뛰었다. `retryKey` 가 바뀌면 같은 모델을 **다시** 받아야 하므로 그 필터를 걷었다. 캐시가
그 자리를 대신한다 — `retryKey` 가 그대로면 첫 조회에서 곧바로 맞는다.

- [ ] **Step 2: 옛 캐시 파일을 지운다**

```bash
rm feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/util/ToppingAlphaMaskCache.kt
```

- [ ] **Step 3: 컴파일을 확인한다**

```bash
./gradlew :core:ui:compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

⚠️ 이 시점에 `:feature:groups:canvas:impl` 은 **깨져 있다.** `CanvasToppingLayer` 와
`CanvasBGEditScreen` 이 지워진 `rememberToppingAlphaMasks` 를 부른다. Task 6·7이 닫는다.

---

### Task 6: 판정을 거리판 조회로 바꾸고 `ToppingAlphaMask`를 지운다

**Files:**
- Modify: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/util/ToppingHitTarget.kt`
- Delete: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/util/ToppingAlphaMask.kt`
- Modify: `core/designsystem/.../component/ygtoppingcutout/YGToppingCutoutImage.kt` (상수 삭제)
- Test: `feature/groups/canvas/impl/src/test/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/util/ToppingHitTestTest.kt`

**Interfaces:**
- Consumes: Task 1의 `ToppingOutline`
- Produces: `data class ToppingHitTarget(..., val outline: ToppingOutline?)` — `mask` 파라미터가
  `outline` 으로 바뀐다. Task 7이 이 이름으로 값을 넣는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`ToppingHitTestTest.kt` 에 아래 3건을 더한다. 파일의 기존 테스트 중 `ToppingAlphaMask` 를 만드는
자리는 `ToppingOutline.of` 로 바꾼다.

```kotlin
    @Test
    fun containsPoint_borderWidth_extendsTheHitAreaByThatDistance() {
        // Given 가운데 한 칸만 불투명한 8x8 실루엣을 8x8 픽셀로 그린다
        val outline = ToppingOutline.of(width = 8, height = 8) { x, y ->
            if (x == 4 && y == 4) 255 else 0
        }
        val target = ToppingHitTarget(
            centerXPx = 4f,
            centerYPx = 4f,
            imageWidthPx = 8f,
            imageHeightPx = 8f,
            rotationDegrees = 0f,
            borderWidthPx = 2f,
            outline = outline,
        )

        // Then 실루엣에서 2 떨어진 자리는 눌리고 3 떨어진 자리는 안 눌린다
        assertTrue(target.containsPoint(2.5f, 4.5f))
        assertFalse(target.containsPoint(1.5f, 4.5f))
    }

    @Test
    fun containsPoint_withoutBorder_onlyTheSilhouetteIsHit() {
        val outline = ToppingOutline.of(width = 8, height = 8) { x, y ->
            if (x == 4 && y == 4) 255 else 0
        }
        val target = ToppingHitTarget(
            centerXPx = 4f,
            centerYPx = 4f,
            imageWidthPx = 8f,
            imageHeightPx = 8f,
            rotationDegrees = 0f,
            borderWidthPx = 0f,
            outline = outline,
        )

        // Then 안 그린 테두리만큼 판정이 넓어지면 안 된다
        assertTrue(target.containsPoint(4.5f, 4.5f))
        assertFalse(target.containsPoint(3.5f, 4.5f))
    }

    @Test
    fun containsPoint_fallsBackToTheRectangleWhenNothingIsOpaque() {
        val outline = ToppingOutline.of(width = 8, height = 8) { _, _ -> 0 }
        val target = ToppingHitTarget(
            centerXPx = 4f,
            centerYPx = 4f,
            imageWidthPx = 8f,
            imageHeightPx = 8f,
            rotationDegrees = 0f,
            borderWidthPx = 0f,
            outline = outline,
        )

        // Then 실루엣을 못 읽으면 사각형으로 받는다 — 아무 데도 안 눌리는 것보다 낫다
        assertTrue(target.containsPoint(1f, 1f))
    }
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
./gradlew :feature:groups:canvas:impl:testDebugUnitTest --tests "*ToppingHitTestTest"
```

Expected: 컴파일 실패 — `No parameter with name 'outline' found`.

- [ ] **Step 3: `ToppingHitTarget` 을 고친다**

`mask: ToppingAlphaMask?` 를 `outline: ToppingOutline?` 으로 바꾸고, `containsPoint` 의 뒷부분과
`isOpaqueAtLocal` 을 아래로 치환한다. 앞부분(회전 되돌리기·사각형 검사)은 그대로 둔다.

```kotlin
        // 실루엣을 못 읽으면 사각형 판정이다 — 여기까지 왔으면 사각형 안이다
        val usableOutline = outline?.takeIf { it.hasAnySeed } ?: return true

        // 테두리는 실루엣에서 굵기만큼 떨어진 자리까지라, 판정도 같은 거리로 답한다
        val fieldX = (localX + imageWidthPx / 2f) * usableOutline.width / imageWidthPx - 0.5f
        val fieldY = (localY + imageHeightPx / 2f) * usableOutline.height / imageHeightPx - 0.5f

        if (borderWidthPx <= 0f) return usableOutline.isOpaqueAt(fieldX, fieldY)

        val fieldPerImagePx = usableOutline.width / imageWidthPx
        return usableOutline.distanceAt(fieldX, fieldY) <= borderWidthPx * fieldPerImagePx
```

`FULL_TURN_DEGREES` 상수와 `cos`·`sin` import 중 스탬프 되밀기에만 쓰이던 것,
`floor` import, `TOPPING_OUTLINE_STAMP_COUNT` import 를 함께 지운다. 회전 되돌리기가 여전히
`cos`·`sin` 을 쓰므로 그 둘은 남는다.

- [ ] **Step 4: `ToppingAlphaMask.kt` 와 스탬프 상수를 지운다**

```bash
rm feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/util/ToppingAlphaMask.kt
```

`YGToppingCutoutImage.kt` 에서 `TOPPING_OUTLINE_STAMP_COUNT` 와 `FULL_TURN_DEGREES` 선언을 지운다.

- [ ] **Step 5: 테스트를 돌린다**

```bash
./gradlew :feature:groups:canvas:impl:testDebugUnitTest --tests "*ToppingHitTestTest"
```

Expected: 신규 3건 + 기존 전부 PASS.

⚠️ `:feature:groups:canvas:impl` 의 **다른 소스는 여전히 안 컴파일된다.** Task 7이 닫는다.
이 단계는 `--tests` 로 좁혀 돌리지 말고 모듈 전체가 초록인지 확인하려 하지 않는다.

---

### Task 7: 호출부 넷을 거리판에 결선한다

**Files:**
- Modify: `feature/groups/canvas/impl/.../component/CanvasToppingLayer.kt`
- Modify: `feature/groups/canvas/impl/.../screen/CanvasToppingPlaceScreen.kt`
- Modify: `feature/groups/canvas/impl/.../screen/CanvasBGEditScreen.kt`
- Modify: `feature/segmentation/impl/.../screen/SegmentationConfirmScreen.kt`

**Interfaces:**
- Consumes: Task 5의 `rememberToppingOutlines`·`loadToppingOutline`, Task 6의
  `ToppingHitTarget(outline = ...)`, Task 4의 `YGToppingCutoutImage(outline = ...)`
- Produces: 없음(결선만)

- [ ] **Step 1: `CanvasToppingLayer` 를 고친다**

세 곳이다.

첫째, `ToppingHitEntry` 에 거리판을 싣는다.

```kotlin
internal data class ToppingHitEntry(
    val topping: CanvasToppingVO,
    // Painter 로 좁히면 state 를 잃어 테두리 조건을 볼 수 없다
    val painter: AsyncImagePainter,
    val outline: ToppingOutline?,
    val target: ToppingHitTarget,
    val imageState: CanvasLoadState,
)
```

둘째, `rememberToppingHitEntries` 에서 마스크를 거리판으로 갈고 `loadMasks` 파라미터를 없앤다.
`hitTestEnabled` 는 판정 배선에만 남는다.

```kotlin
    val outlines = rememberToppingOutlines(
        models = toppings.map { it.imageUrl },
        retryKey = retryKey,
    )
```

`ToppingHitEntry` 를 만들 때 `outline = outlines[topping.imageUrl]` 를 넣고,
`ToppingHitTarget(... mask = masks[topping.imageUrl])` 를 `outline = outlines[topping.imageUrl]` 로 바꾼다.

호출부(`rememberToppingHitEntries(...)`)에서 `loadMasks = ...` 인자를 지운다.
`CanvasToppingLayer` 시그니처의 `hitTestEnabled` 는 그대로 둔다.

셋째, `ToppingImage` 가 거리판을 받아 넘긴다.

```kotlin
@Composable
private fun ToppingImage(
    painter: AsyncImagePainter,
    outline: ToppingOutline?,
    border: ToppingBorder,
) {
    val painterState by painter.state.collectAsState()
    val solidBorder = border as? ToppingBorder.Solid

    YGToppingCutoutImage(
        painter = painter,
        outline = outline,
        // 색을 못 읽으면 테두리를 걸러 낸다 — 임의의 색을 골라 칠하는 것보다 안 그리는 편이 덜 틀리다
        borderColor = solidBorder
            ?.color
            ?.toColorOrNull()
            ?.takeIf { painterState is AsyncImagePainter.State.Success },
        borderWidth = (solidBorder?.width?.toFloat() ?: 0f).dp,
        modifier = Modifier.fillMaxSize(),
    )
}
```

`CanvasTopping` 안의 호출을 `ToppingImage(painter = entry.painter, outline = entry.outline, border = entry.topping.border)` 로 바꾼다.

- [ ] **Step 2: `CanvasToppingPlaceScreen` 을 고친다**

배치 중인 토핑은 하나라 목록 API 대신 단건을 쓴다. `YGToppingCutoutImage` 위에 아래를 둔다.

이 화면은 `toppingImagePath` 를 `File(path).toUri().toString()` 으로 바꿔
`rememberAsyncImagePainter(model = ...)` 에 넘긴다. 그 표현식이 이미 `remember(toppingImagePath)` 로
묶여 있으므로 지역 변수로 빼서 그림과 거리판이 **같은 문자열**을 보게 한다.

```kotlin
    val toppingImageModel = remember(toppingImagePath) {
        toppingImagePath?.let { path -> File(path).toUri().toString() }
    }
    val painter = rememberAsyncImagePainter(
        model = toppingImageModel,
        // 나머지 인자는 그대로
    )

    val context = LocalContext.current
    val outline by produceState<ToppingOutline?>(initialValue = null, toppingImageModel) {
        val model = toppingImageModel ?: return@produceState
        value = loadToppingOutline(context, model, retryKey = 0)
    }
```

⚠️ **그림과 거리판이 다른 문자열을 보면 안 된다.** 편집본은 투명 여백이 잘려 원본과 비율이 달라,
실루엣이 통째로 어긋난다.

`YGToppingCutoutImage(...)` 호출의 `outline = null` 을 `outline = outline` 으로 바꾼다.

`CanvasToppingLayer(...)` 호출에서 `loadMasks` 관련 인자가 남아 있으면 지운다.

- [ ] **Step 3: `CanvasBGEditScreen` 을 고친다**

`BGEditDrawEntry` 를 만드는 자리에서 `rememberToppingOutlines` 를 쓰고, `CanvasToppingImage` 가
그것을 `YGToppingCutoutImage(outline = ...)` 로 넘긴다.

`CanvasToppingImage` 의 인셋 우회는 **걷는다.** 띠가 판 안에 들어 있어 오프스크린 버퍼에 잘리지
않는다.

```kotlin
    Box(
        modifier = modifier
            .centeredAt(entry.center)
            .requiredSize(entry.size)
            .graphicsLayer(
                rotationZ = entry.topping.rotationDegrees,
                alpha = alpha,
            )
            // 이하 semantics 는 그대로
```

`YGToppingCutoutImage` 의 `modifier` 에서 `.padding(outlineInset)` 을 지우고 `fillMaxSize()` 만
남긴다. `outlineInset` 지역 변수와 그것을 설명하던 KDoc 문단(`alpha` 가 1 미만일 때 잘린다는 설명)도
함께 지운다.

⚠️ **`entry.drawnBorderWidthDp` 는 지우지 않는다.** `rememberBGEditHitEntries` 가
`ToppingHitTarget(borderWidthPx = entry.drawnBorderWidthDp.dp.toPx())` 로도 읽는다. 사라지는 것은
`outlineInset` 지역 변수뿐이다.

이 화면은 마스크 키로 `CanvasToppingVO.drawnModel`(`editedImagePath ?: imageUrl`)을 쓴다.
거리판도 **같은 키**를 써야 한다.

```kotlin
    val outlines = rememberToppingOutlines(
        models = drawEntries.map { it.topping.drawnModel },
        retryKey = 0,
    )
```

`ToppingHitTarget(... mask = masks[entry.topping.drawnModel])` 를
`outline = outlines[entry.topping.drawnModel]` 로 바꾸고, `CanvasToppingImage` 에도 같은 값을 넘긴다.

- [ ] **Step 4: `SegmentationConfirmScreen` 을 고친다**

```kotlin
    val context = LocalContext.current
    val outline by produceState<ToppingOutline?>(initialValue = null, subjectImagePath) {
        value = loadToppingOutline(context, subjectImagePath, retryKey = 0)
    }
```

`YGToppingCutoutImage(...)` 의 `outline = null` 을 `outline = outline` 으로 바꾼다.

- [ ] **Step 5: 전체 컴파일과 유닛을 확인한다**

```bash
./gradlew :feature:groups:canvas:impl:testDebugUnitTest \
          :feature:segmentation:impl:testDebugUnitTest \
          :core:util:jvm:test
```

Expected: BUILD SUCCESSFUL, 전부 PASS.

- [ ] **Step 6: 앱 전체가 빌드되는지 본다**

```bash
./gradlew :app:assembleDebug
```

Expected: BUILD SUCCESSFUL.

---

### Task 8: 실기기 육안 확인과 문서 갱신

**Files:**
- Modify(문서 저장소): `parfait/architecture/design-system.md`
- Modify(문서 저장소): `parfait/architecture/module-structure.md`
- Modify(문서 저장소): `parfait/synthesis/open-questions.md`
- Modify(문서 저장소): `parfait/adr/0030-topping-outline-distance-field.md`
- Modify(문서 저장소): `parfait/specs/2026-09-07-topping-border-distance-field.md`

- [ ] **Step 1: 실기기에서 여섯 가지를 확인한다**

1. 같은 토핑·같은 굵기가 **테두리 편집 → 누끼 확인 → 토핑 배치 → 캔버스** 넷에서 같은 모양인가.
2. 빨대처럼 가는 부위가 갈라지지 않는가.
3. 누끼 확인 화면에서 테두리가 화면 가장자리에 잘리지 않는가.
4. 토핑을 여럿 올린 캔버스에서 진입·스크롤이 버벅이지 않는가.
5. 배치 화면에서 핀치로 크기를 바꿀 때 테두리가 따라오는가. `BORDER_SIZE_QUANTUM_PX = 32` 격자가
   계단으로 보이는가.
6. 이미지 로드에 실패시킨 뒤(비행기 모드 등) 재시도했을 때 테두리와 판정이 함께 돌아오는가.

- [ ] **Step 2: 5번이 계단으로 보이면 격자를 줄인다**

`BORDER_SIZE_QUANTUM_PX` 를 16으로 내리고 다시 본다. 그래도 보이면 8까지 내린다. 정한 값과
그 이유를 스펙의 "열린 질문" 절에 적는다.

- [ ] **Step 3: 2번이 여전히 갈라져 보이면 거리판 해상도를 올린다**

`OUTLINE_LONG_SIDE` 를 512로 올리고 다시 본다. 항목당 메모리가 네 배(약 512KB)가 되므로,
올렸다면 그 사실과 캐시 64칸 기준 총량을 스펙에 적는다.

- [ ] **Step 4: 문서를 갱신한다**

- `design-system.md` 의 `YGToppingCutoutImage` 항목 — 여덟 방향 스탬프 서술을 거리판 렌더로 바꾸고
  `outline` 파라미터를 적는다.
- `module-structure.md` — `core:util:jvm` 에 `outline/`, `core:util:android` 에 `outline/`,
  `core:ui` 에 `outline/` 을 더한다. `core:util:jvm` 항목의 픽셀 연산 문단이 "토핑 테두리를
  거리장으로 그리려고" 승격했다고 적어 두었으니 그 예고가 실현됐다는 사실을 잇는다.
- `open-questions.md` — OQ-P-208 ②, OQ-P-337 ①②, OQ-P-356 을 해소로 표시한다.
  **OQ-P-208 ①(실기기 측정)과 ③(굵기 정책)은 열어 둔다.** OQ-P-317(캐시 수명 주체)에 항목당
  크기가 커진 사실을 더한다.
- ADR-0030 `status` 를 `proposed` 에서 `accepted` 로 올리고, Task 4 게이트의 판정 결과
  (`ALPHA_8` 채택 여부)를 "위험·방어" 절에 적는다.
- 스펙 `status` 를 `implemented` 로 올리고 `parfait/specs/archive/` 로 옮긴 뒤
  `parfait/specs/README.md` 의 활성 표에서 아카이브 표로 행을 옮긴다.
- `parfait/plans/README.md` 활성 카탈로그에 이 계획 한 줄을 더한다(계획 착수 시점에 이미
  더했다면 as-built 를 덧붙인다).

---

## 검증 요약

| 무엇 | 어떻게 | Task |
|------|--------|------|
| 얇은 부위가 안 갈라진다 | `:core:util:jvm:test` 회귀 1건 | 1 |
| 띠 경계가 기대 거리에 온다 | `:core:util:jvm:test` | 1 |
| 거리 양자화 오차 상한 | `:core:util:jvm:test` | 1 |
| 판 크기 ≠ 표시 크기 보간 경로 | `:core:util:jvm:test` | 1 |
| 겹 색 섞임 | `:core:util:jvm:test` | 1 |
| 판정이 거리 기준으로 넓어진다 | `:feature:groups:canvas:impl:testDebugUnitTest` 3건 | 6 |
| `Bitmap` 변환 | **자동 검증 없음** — 컴파일 + Task 4 프리뷰 | 2 |
| 캐시가 디코딩 한 번을 쓴다 | **자동 검증 없음** — 실기기 확인 | 5 |
| `ALPHA_8` + tint | 실기기 프리뷰 게이트 | 4 |
| 네 화면 모양 일치 | 실기기 육안 | 8 |
