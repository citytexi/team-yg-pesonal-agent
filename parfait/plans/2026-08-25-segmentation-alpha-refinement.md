---
id: segmentation-alpha-refinement
title: 세그멘테이션 알파 경계 정련 구현 계획 (1 PR)
status: draft
type: work-order
created: 2026-08-25
updated: 2026-08-25
platforms: android
owner: android
related_adr: ADR-0012
related_spec: segmentation-alpha-refinement, segmentation-mask-postprocessing
related_code: AlphaPostProcessor.kt#postProcessAlpha, AlphaPostProcessor.kt#erodeEdge, AlphaComponents.kt#ceilDiv, AlphaComposite.kt, ImageSegmentationRepositoryImpl#postProcess, ImageSegmentationRepositoryImpl#toForegroundCandidate
archived_reason:
tags: [plan, parfait]
---

# 세그멘테이션 알파 경계 정련 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원본 휘도를 안내자로 삼아 알파 경계를 실제 물체 경계로 끌어당기고, 그 과정에서 하드
매트의 계단을 소프트 매트로 바꾼다.

**Architecture:** 가이드 필터를 쓰되 **계수는 축소판에서 구하고 적용만 원본 해상도에서 한다**
(Fast Guided Filter). 전 과정을 원본에서 돌면 12MP 후보 판에서 중간 실수 배열 여섯이 수백 MB가
된다. 정련은 기존 후처리 커널의 `keep 적용`과 `침식` 사이에 들어가고, 앞뒤 단계의 동작은 바꾸지
않는다. 계산은 전부 `FloatArray`·`ByteArray` 위 순수 함수라 기기 없이 JVM으로 덮는다.

**Tech Stack:** Kotlin, kotlin.test + JUnit4(JVM 유닛)

**Spec:** [`parfait/specs/2026-08-25-segmentation-alpha-refinement.md`](../specs/2026-08-25-segmentation-alpha-refinement.md)

## Global Constraints

- **작업 저장소는 `TJYG-Android`다**(이 계획 문서가 있는 repo와 다르다). 로컬 절대경로는 private
  submodule의 `wiki/personal-private/project-paths.md`에 있다.
- **이 계획은 PR 하나다.** 베이스는 앞 라운드의 3단계 브랜치(`feature/segmentation-postprocess-wiring`)
  위다. 그 브랜치가 만든 커널과 배선을 전제로 한다.
- **커밋만 하고 push·PR은 하지 않는다.** 사용자가 명시적으로 요청할 때까지 리모트로 내보내지 않는다.
- **매 태스크는 커밋으로 끝나고, 커밋 직전에 `./gradlew test ktlintCheck :app:assembleDebug`가
  통과해야 한다. 예외는 없다.**
- ⚠️ **ktlint가 파라미터 2개 이상인 함수 시그니처를 멀티라인으로 강제한다.** 미사용·중복 import도
  잡는다. 막히면 `./gradlew ktlintFormat`으로 먼저 편다.
- **주석 규약**: 코드가 이미 말하는 것은 쓰지 않는다. `@return`·`@param`은 타입·이름이 말하지 못할
  때만 쓴다. **다른 컴포넌트의 현재 상태를 단정하지 않는다**(낡는다 — 근거는 문서 포인터로 적는다).
  아키텍처 결정은 코드가 아니라 문서에 쓰고 코드에는 포인터 한 줄만 둔다. 주석 분량은 그 코드의
  **어려움**에 비례해야지 **중요함**에 비례하면 안 된다.
- 테스트는 `kotlin.test`를 쓴다. `org.junit.*`을 import하지 않는다. 이름은 `함수명_조건_기대`이고
  본문에 `// Given` `// When` `// Then` 주석을 단다.
- **변환 자체를 위한 단독 테스트를 만들지 않는다.** 판단이 든 순수 함수만 덮는다.
- **이 저장소에 Robolectric이 없고 `testOptions.unitTests.isReturnDefaultValues`도 안 켜져 있다.**
  `Bitmap`이 걸린 코드는 JVM 유닛으로 못 덮는다. 그런 태스크는 **왜 테스트가 없는지를 본문에 적는다.**
- **알파를 `ByteArray`에서 읽을 때는 반드시 `and 0xFF`를 쓴다.** Kotlin `Byte`는 부호가 있어
  128~255가 음수로 읽힌다.
- ⚠️ **적분 영상을 쓰지 않는다.** 12MP에서 누적값이 `Float` 정밀도를 넘어 창 차분이 무너진다.
  박스 평균은 **행·열 슬라이딩 합 2패스**로 구한다. 누적 구간이 한 행·한 열이라 크기가 작다.
- ⚠️ **창은 실제 포함된 픽셀 수로 정규화한다.** 고정 개수 `(2r+1)²`로 나누면 가장자리 알파가
  체계적으로 낮아진다.
- **`refineDownscale`은 판정 버퍼 배율 `downscaleFactor`와 별개 값이다.** 한쪽을 튜닝하다 다른
  쪽이 따라 움직이면 안 된다.
- `minSdk`는 26이다.

---

## 파일 구성

| 파일 | 책임 | 태스크 |
|---|---|---|
| `data/.../repository/image/AlphaRefine.kt` (신설) | 박스 평균·휘도·축소·계수·되올림 적용·조립 | 1~5 |
| `data/src/test/.../repository/image/AlphaRefineTest.kt` (신설) | 위 함수들의 유닛 | 1~5 |
| `data/.../repository/image/AlphaPostProcessor.kt` | 옵션 넷 추가, 안내자 공급자, 측정 2회 분리 | 6 |
| `data/src/test/.../repository/image/AlphaPostProcessorTest.kt` | 정련 켜고 끄기 통합 | 6 |
| `data/.../repository/image/ImageSegmentationRepositoryImpl.kt` | 두 경로 공급자 전달, 소요 시간 로그 | 7 |

**패키지는 전부 `com.teamyg.parfait.data.repository.image`다.** `data` 모듈의 소스 레이아웃은
`src/main/java`·`src/test/java`다.

## 손대는 기존 코드의 실제 형태

⚠️ **아래는 계획이 지어낸 것이 아니라 베이스 브랜치에서 그대로 옮긴 것이다.**

`AlphaComponents.kt`에 이미 있고 이 계획이 재사용한다:

```kotlin
internal fun ceilDiv(
    value: Int,
    divisor: Int,
): Int = (value + divisor - 1) / divisor
```

`AlphaPostProcessor.kt`의 현재 조립부. 측정이 한 번이고 `changed`가 둘의 논리합이다:

```kotlin
    val applied = applyKeepMask(alpha, width, height, keep, maskWidth, factor, checkCancelled)
    val eroded = options.erodeEdge && erodeEdge(alpha, width, height, checkCancelled)
    val measured = measureAlpha(alpha, width, height, checkCancelled) ?: return null

    return AlphaPostProcessResult(
        bounds = measured.bounds,
        alphaSum = measured.alphaSum,
        partialAlphaPixels = measured.partialAlphaPixels,
        changed = applied || eroded,
    )
```

`AlphaPostProcessOptions`의 현재 형태:

```kotlin
internal data class AlphaPostProcessOptions(
    val downscaleFactor: Int = 4,
    val binaryThreshold: Int = 127,
    val areaOpeningMinPixels: Int = AREA_OPENING_MIN_PIXELS,
    val erodeEdge: Boolean = true,
    val minPixelsForDownscale: Int = MIN_PIXELS_FOR_DOWNSCALE,
)
```

---

## Task 1: 박스 평균

**Files:**
- Create: `data/src/main/java/com/teamyg/parfait/data/repository/image/AlphaRefine.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/repository/image/AlphaRefineTest.kt`

**Interfaces:**
- Consumes: 없음
- Produces: `internal fun boxMean(src: FloatArray, width: Int, height: Int, radius: Int, checkCancelled: () -> Unit = {}): FloatArray`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`AlphaRefineTest.kt`:

```kotlin
package com.teamyg.parfait.data.repository.image

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** 부동소수 비교의 허용 오차. 값이 0~1 범위라 이 정도면 충분하다 */
private const val TOLERANCE = 1e-4f

private fun assertClose(
    expected: Float,
    actual: Float,
    message: String = "",
) {
    assertTrue(
        kotlin.math.abs(expected - actual) <= TOLERANCE,
        "$message expected=$expected actual=$actual",
    )
}

class AlphaRefineTest {
    @Test
    fun boxMean_everyValueIsOne_staysOneEvenAtTheCorners() {
        // Given — 고정 개수로 나누면 모서리가 4/9 로 내려앉는다
        val src = FloatArray(9) { 1f }

        // When
        val mean = boxMean(src, width = 3, height = 3, radius = 1)

        // Then
        for (index in mean.indices) assertClose(1f, mean[index], "index=$index")
    }

    @Test
    fun boxMean_radiusLargerThanTheArray_averagesEverything() {
        // Given
        val src = floatArrayOf(0f, 1f, 0f, 1f)

        // When
        val mean = boxMean(src, width = 2, height = 2, radius = 5)

        // Then
        for (index in mean.indices) assertClose(0.5f, mean[index], "index=$index")
    }

    @Test
    fun boxMean_singleSpike_spreadsOverTheWindowOnly() {
        // Given — 5×5 한가운데만 1 이다. 반경 1 이면 3×3 만 값을 갖는다
        val src = FloatArray(25)
        src[12] = 1f

        // When
        val mean = boxMean(src, width = 5, height = 5, radius = 1)

        // Then — 중앙은 1/9, 대각 이웃도 1/9(창이 온전히 안에 든다), 두 칸 밖은 0
        assertClose(1f / 9f, mean[12], "center")
        assertClose(1f / 9f, mean[6], "diagonal neighbour")
        assertClose(0f, mean[0], "two cells away")
    }

    @Test
    fun boxMean_windowClippedAtTheEdge_usesTheActualCount() {
        // Given — 한 행짜리. 왼쪽 끝의 창은 두 칸만 포함한다
        val src = floatArrayOf(1f, 0f, 0f, 0f)

        // When
        val mean = boxMean(src, width = 4, height = 1, radius = 1)

        // Then
        assertClose(0.5f, mean[0], "left edge counts two cells")
        assertClose(1f / 3f, mean[1], "interior counts three cells")
    }
}
```

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests "*AlphaRefineTest*"`
Expected: 컴파일 실패 — `Unresolved reference: boxMean`

- [ ] **Step 3: 구현한다**

`AlphaRefine.kt`:

```kotlin
package com.teamyg.parfait.data.repository.image

/**
 * 반경 [radius] 창의 평균을 낸다.
 *
 * ⚠️ 적분 영상을 쓰지 않는다. 12MP 후보 판에서 누적값이 `Float` 정밀도를 넘어 창 차분이 무너진다.
 * 행·열 슬라이딩 합 2패스는 누적 구간이 한 행·한 열이라 그 문제가 없고 계산량도 같다.
 *
 * 가장자리에서는 창이 잘리므로 **실제 포함된 픽셀 수로 나눈다.** 고정 개수로 나누면 가장자리
 * 값이 체계적으로 낮아진다.
 */
internal fun boxMean(
    src: FloatArray,
    width: Int,
    height: Int,
    radius: Int,
    checkCancelled: () -> Unit = {},
): FloatArray {
    val horizontal = FloatArray(src.size)
    for (y in 0 until height) {
        checkCancelled()
        val rowOffset = y * width
        var sum = 0f
        for (x in 0..minOf(radius, width - 1)) sum += src[rowOffset + x]
        for (x in 0 until width) {
            horizontal[rowOffset + x] = sum
            val exiting = x - radius
            val entering = x + radius + 1
            if (exiting >= 0) sum -= src[rowOffset + exiting]
            if (entering < width) sum += src[rowOffset + entering]
        }
    }

    val mean = FloatArray(src.size)
    for (x in 0 until width) {
        checkCancelled()
        var sum = 0f
        for (y in 0..minOf(radius, height - 1)) sum += horizontal[y * width + x]
        val left = maxOf(0, x - radius)
        val right = minOf(width - 1, x + radius)
        val columns = right - left + 1
        for (y in 0 until height) {
            val top = maxOf(0, y - radius)
            val bottom = minOf(height - 1, y + radius)
            mean[y * width + x] = sum / (columns * (bottom - top + 1))
            val exiting = y - radius
            val entering = y + radius + 1
            if (exiting >= 0) sum -= horizontal[exiting * width + x]
            if (entering < height) sum += horizontal[entering * width + x]
        }
    }

    return mean
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `./gradlew test ktlintCheck :app:assembleDebug`
Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add -A
git commit -m "feat: 창 평균을 슬라이딩 합 2패스로 구한다"
```

---

## Task 2: 휘도·알파 정규화와 축소

**Files:**
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/image/AlphaRefine.kt`
- Modify: `data/src/test/java/com/teamyg/parfait/data/repository/image/AlphaRefineTest.kt`

**Interfaces:**
- Consumes: `ceilDiv` (`AlphaComponents.kt`, 기존)
- Produces: `internal fun toLuminance(pixels: IntArray, checkCancelled: () -> Unit = {}): FloatArray`,
  `internal fun toUnitAlpha(alpha: ByteArray): FloatArray`,
  `internal fun downscaleAverage(src: FloatArray, width: Int, height: Int, factor: Int): FloatArray`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

클래스 안에 넷을 더한다:

```kotlin
    @Test
    fun toLuminance_ignoresTheAlphaChannel() {
        // Given — 같은 빨강인데 알파만 다르다. 안내자는 색만 봐야 한다
        val pixels = intArrayOf(0xFFFF0000.toInt(), 0x00FF0000)

        // When
        val luminance = toLuminance(pixels)

        // Then
        assertClose(0.299f, luminance[0], "opaque red")
        assertClose(0.299f, luminance[1], "transparent red")
    }

    @Test
    fun toLuminance_blackAndWhite_spanTheUnitRange() {
        // Given
        val pixels = intArrayOf(0xFF000000.toInt(), 0xFFFFFFFF.toInt())

        // When
        val luminance = toLuminance(pixels)

        // Then
        assertClose(0f, luminance[0], "black")
        assertClose(1f, luminance[1], "white")
    }

    @Test
    fun toUnitAlpha_valueAbove127_isNotMisreadAsNegative() {
        // Given — 부호 처리를 빠뜨리면 음수가 된다
        val alpha = byteArrayOf(0, 128.toByte(), 255.toByte())

        // When
        val unit = toUnitAlpha(alpha)

        // Then
        assertClose(0f, unit[0], "transparent")
        assertClose(128f / 255f, unit[1], "half")
        assertClose(1f, unit[2], "opaque")
    }

    @Test
    fun downscaleAverage_sizeIsNotAMultipleOfFactor_averagesTheShortBlocks() {
        // Given — 3×1 을 배율 2 로 줄이면 두 번째 블록에 한 칸만 든다
        val src = floatArrayOf(1f, 0f, 1f)

        // When
        val sub = downscaleAverage(src, width = 3, height = 1, factor = 2)

        // Then
        assertEquals(2, sub.size)
        assertClose(0.5f, sub[0], "full block")
        assertClose(1f, sub[1], "short block averages one cell, not two")
    }
```

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests "*AlphaRefineTest*"`
Expected: 컴파일 실패 — `Unresolved reference: toLuminance`

- [ ] **Step 3: 구현한다**

`AlphaRefine.kt`에 더한다:

```kotlin
private const val OPAQUE = 255f

/**
 * 안내자를 휘도 한 채널로 뽑는다. 컬러 3채널을 쓰지 않는 이유는
 * `specs/2026-08-25-segmentation-alpha-refinement.md` 「범위 - 제외」 참고.
 */
internal fun toLuminance(
    pixels: IntArray,
    checkCancelled: () -> Unit = {},
): FloatArray {
    checkCancelled()
    return FloatArray(pixels.size) { index ->
        val pixel = pixels[index]
        val red = (pixel ushr 16) and 0xFF
        val green = (pixel ushr 8) and 0xFF
        val blue = pixel and 0xFF
        (0.299f * red + 0.587f * green + 0.114f * blue) / OPAQUE
    }
}

internal fun toUnitAlpha(alpha: ByteArray): FloatArray = FloatArray(alpha.size) { index ->
    (alpha[index].toInt() and 0xFF) / OPAQUE
}

/**
 * 계수를 구할 축소판을 만든다. 가장자리 블록은 **존재하는 칸만** 평균한다 — 없는 칸을 0으로 치면
 * 오른쪽·아래 가장자리의 안내자가 어두워져 경계가 그쪽으로 끌린다.
 */
internal fun downscaleAverage(
    src: FloatArray,
    width: Int,
    height: Int,
    factor: Int,
): FloatArray {
    if (factor == 1) return src.copyOf()

    val subWidth = ceilDiv(width, factor)
    val sums = FloatArray(subWidth * ceilDiv(height, factor))
    val counts = IntArray(sums.size)

    for (y in 0 until height) {
        val rowOffset = y * width
        val subRowOffset = (y / factor) * subWidth
        for (x in 0 until width) {
            val index = subRowOffset + x / factor
            sums[index] += src[rowOffset + x]
            counts[index]++
        }
    }

    for (index in sums.indices) sums[index] /= counts[index]

    return sums
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `./gradlew test ktlintCheck :app:assembleDebug`
Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add -A
git commit -m "feat: 안내자 휘도와 계수용 축소판을 만든다"
```

---

## Task 3: 가이드 필터 계수

**Files:**
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/image/AlphaRefine.kt`
- Modify: `data/src/test/java/com/teamyg/parfait/data/repository/image/AlphaRefineTest.kt`

**Interfaces:**
- Consumes: `boxMean` (Task 1)
- Produces: `internal class GuidedCoefficients(val a: FloatArray, val b: FloatArray)`,
  `internal fun guidedCoefficients(guidance: FloatArray, input: FloatArray, width: Int, height: Int, radius: Int, epsilon: Float, checkCancelled: () -> Unit = {}): GuidedCoefficients`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
    @Test
    fun guidedCoefficients_constantGuidance_degeneratesToAPlainMean() {
        // Given — 안내자에 경계가 없으면 알파를 옮길 근거가 없다. a 는 0, b 는 입력의 창 평균이다
        val guidance = FloatArray(16) { 0.5f }
        val input = FloatArray(16) { index -> if (index % 4 < 2) 1f else 0f }

        // When
        val coefficients = guidedCoefficients(
            guidance = guidance,
            input = input,
            width = 4,
            height = 4,
            radius = 1,
            epsilon = 1e-4f,
        )

        // Then
        val expected = boxMean(input, width = 4, height = 4, radius = 1)
        for (index in coefficients.a.indices) {
            assertClose(0f, coefficients.a[index], "a index=$index")
            assertClose(expected[index], coefficients.b[index], "b index=$index")
        }
    }

    @Test
    fun guidedCoefficients_inputEqualsGuidance_reproducesTheGuidance() {
        // Given — p 가 I 와 같으면 q = I 여야 한다. 즉 a = 1, b = 0 이다
        val guidance = FloatArray(16) { index -> if (index % 4 < 2) 0.9f else 0.1f }

        // When
        val coefficients = guidedCoefficients(
            guidance = guidance,
            input = guidance.copyOf(),
            width = 4,
            height = 4,
            radius = 1,
            epsilon = 1e-8f,
        )

        // Then
        for (index in coefficients.a.indices) {
            assertClose(1f, coefficients.a[index], "a index=$index")
            assertClose(0f, coefficients.b[index], "b index=$index")
        }
    }
```

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests "*AlphaRefineTest*"`
Expected: 컴파일 실패 — `Unresolved reference: guidedCoefficients`

- [ ] **Step 3: 구현한다**

```kotlin
internal class GuidedCoefficients(
    val a: FloatArray,
    val b: FloatArray,
)

/**
 * 창마다 `q = a·I + b` 의 계수를 구하고 그 계수를 다시 창 평균한다.
 *
 * `a` 는 안내자와 입력의 공분산을 안내자의 분산으로 나눈 값이라, **안내자에 경계가 있는 자리에서만
 * 커진다.** 그래서 색이 갈리는 자리에서만 알파가 옮겨간다. [epsilon] 이 크면 `a` 가 눌려 평균
 * 필터로 퇴화한다.
 *
 * 근거는 `specs/2026-08-25-segmentation-alpha-refinement.md` 「설계 - 정련 알고리즘」에 있다.
 */
internal fun guidedCoefficients(
    guidance: FloatArray,
    input: FloatArray,
    width: Int,
    height: Int,
    radius: Int,
    epsilon: Float,
    checkCancelled: () -> Unit = {},
): GuidedCoefficients {
    val meanGuidance = boxMean(guidance, width, height, radius, checkCancelled)
    val meanInput = boxMean(input, width, height, radius, checkCancelled)
    val meanSquare = boxMean(
        FloatArray(guidance.size) { index -> guidance[index] * guidance[index] },
        width,
        height,
        radius,
        checkCancelled,
    )
    val meanProduct = boxMean(
        FloatArray(guidance.size) { index -> guidance[index] * input[index] },
        width,
        height,
        radius,
        checkCancelled,
    )

    val a = FloatArray(guidance.size)
    val b = FloatArray(guidance.size)
    for (index in a.indices) {
        // 부동소수 오차로 음수가 나올 수 있다. 음수 분산은 a 의 부호를 뒤집는다
        val variance = maxOf(0f, meanSquare[index] - meanGuidance[index] * meanGuidance[index])
        val covariance = meanProduct[index] - meanGuidance[index] * meanInput[index]
        a[index] = covariance / (variance + epsilon)
        b[index] = meanInput[index] - a[index] * meanGuidance[index]
    }

    return GuidedCoefficients(
        a = boxMean(a, width, height, radius, checkCancelled),
        b = boxMean(b, width, height, radius, checkCancelled),
    )
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `./gradlew test ktlintCheck :app:assembleDebug`
Expected: PASS

⚠️ `inputEqualsGuidance` 가 깨지면 분산·공분산 식이 뒤바뀐 것이다. `constantGuidance` 가 깨지면
계수를 다시 창 평균하는 마지막 단계를 빠뜨린 것이다.

- [ ] **Step 5: 커밋한다**

```bash
git add -A
git commit -m "feat: 가이드 필터 계수를 구한다"
```

---

## Task 4: 계수 되올림과 적용

**Files:**
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/image/AlphaRefine.kt`
- Modify: `data/src/test/java/com/teamyg/parfait/data/repository/image/AlphaRefineTest.kt`

**Interfaces:**
- Consumes: `GuidedCoefficients` (Task 3)
- Produces: `internal fun applyCoefficients(alpha: ByteArray, guidance: FloatArray, coefficients: GuidedCoefficients, width: Int, height: Int, subWidth: Int, subHeight: Int, factor: Int, checkCancelled: () -> Unit = {}): Boolean`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
    @Test
    fun applyCoefficients_identityCoefficients_writeTheGuidanceAsAlpha() {
        // Given — a = 1, b = 0 이면 알파가 안내자 그대로여야 한다
        val alpha = ByteArray(4)
        val guidance = floatArrayOf(0f, 0.5f, 1f, 0.25f)
        val coefficients = GuidedCoefficients(a = FloatArray(4) { 1f }, b = FloatArray(4))

        // When
        val changed = applyCoefficients(
            alpha = alpha,
            guidance = guidance,
            coefficients = coefficients,
            width = 2,
            height = 2,
            subWidth = 2,
            subHeight = 2,
            factor = 1,
        )

        // Then
        assertEquals(true, changed)
        assertEquals(0, alpha[0].toInt() and 0xFF)
        assertEquals(128, alpha[1].toInt() and 0xFF)
        assertEquals(255, alpha[2].toInt() and 0xFF)
        assertEquals(64, alpha[3].toInt() and 0xFF)
    }

    @Test
    fun applyCoefficients_outOfRangeResult_isClampedInsteadOfWrapping() {
        // Given — 계수가 범위를 넘기면 바이트가 감겨 반대 값이 된다
        val alpha = ByteArray(2)
        val guidance = floatArrayOf(1f, 1f)
        val coefficients = GuidedCoefficients(a = floatArrayOf(4f, -4f), b = FloatArray(2))

        // When
        applyCoefficients(
            alpha = alpha,
            guidance = guidance,
            coefficients = coefficients,
            width = 2,
            height = 1,
            subWidth = 2,
            subHeight = 1,
            factor = 1,
        )

        // Then
        assertEquals(255, alpha[0].toInt() and 0xFF)
        assertEquals(0, alpha[1].toInt() and 0xFF)
    }

    @Test
    fun applyCoefficients_upscaledCoefficients_interpolateInsteadOfBlocking() {
        // Given — 축소판 두 칸이 원본 여덟 칸을 덮는다. nearest 로 되올리면 계단 둘만 나온다
        val alpha = ByteArray(8)
        val guidance = FloatArray(8) { 1f }
        val coefficients = GuidedCoefficients(a = FloatArray(2), b = floatArrayOf(0f, 1f))

        // When
        applyCoefficients(
            alpha = alpha,
            guidance = guidance,
            coefficients = coefficients,
            width = 8,
            height = 1,
            subWidth = 2,
            subHeight = 1,
            factor = 4,
        )

        // Then — 가운데 구간이 단조 증가한다
        val values = IntArray(8) { alpha[it].toInt() and 0xFF }
        for (index in 1 until 8) {
            assertTrue(values[index] >= values[index - 1], "index=$index values=${values.toList()}")
        }
        assertTrue(values[0] < values[7], "values=${values.toList()}")
        assertTrue(values.toSet().size > 2, "nearest 되올림이면 값이 둘뿐이다 values=${values.toList()}")
    }
```

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests "*AlphaRefineTest*"`
Expected: 컴파일 실패 — `Unresolved reference: applyCoefficients`

- [ ] **Step 3: 구현한다**

파일 상단 import에 `kotlin.math.roundToInt`를 더한다.

```kotlin
/**
 * 축소판 계수를 이중선형으로 되올려 원본 알파에 적용한다.
 *
 * **경계 선명도는 이 단계에서 나온다** — 계수는 저주파라 축소해도 되지만 곱해지는 안내자는 원본
 * 해상도다. nearest 로 되올리면 계수 자체의 블록 경계가 알파에 찍힌다.
 *
 * @return 알파가 한 픽셀이라도 바뀌었으면 true
 */
internal fun applyCoefficients(
    alpha: ByteArray,
    guidance: FloatArray,
    coefficients: GuidedCoefficients,
    width: Int,
    height: Int,
    subWidth: Int,
    subHeight: Int,
    factor: Int,
    checkCancelled: () -> Unit = {},
): Boolean {
    var changed = false

    for (y in 0 until height) {
        checkCancelled()
        val sourceY = ((y + 0.5f) / factor - 0.5f).coerceIn(0f, (subHeight - 1).toFloat())
        val topRow = sourceY.toInt()
        val bottomRow = minOf(topRow + 1, subHeight - 1)
        val weightY = sourceY - topRow
        val rowOffset = y * width

        for (x in 0 until width) {
            val sourceX = ((x + 0.5f) / factor - 0.5f).coerceIn(0f, (subWidth - 1).toFloat())
            val leftColumn = sourceX.toInt()
            val rightColumn = minOf(leftColumn + 1, subWidth - 1)
            val weightX = sourceX - leftColumn

            val slope = bilinear(
                coefficients.a, subWidth, leftColumn, rightColumn, topRow, bottomRow, weightX, weightY,
            )
            val offset = bilinear(
                coefficients.b, subWidth, leftColumn, rightColumn, topRow, bottomRow, weightX, weightY,
            )

            val index = rowOffset + x
            val value = ((slope * guidance[index] + offset) * OPAQUE).roundToInt().coerceIn(0, 255)
            if (value != (alpha[index].toInt() and 0xFF)) {
                alpha[index] = value.toByte()
                changed = true
            }
        }
    }

    return changed
}

private fun bilinear(
    values: FloatArray,
    stride: Int,
    leftColumn: Int,
    rightColumn: Int,
    topRow: Int,
    bottomRow: Int,
    weightX: Float,
    weightY: Float,
): Float {
    val topOffset = topRow * stride
    val bottomOffset = bottomRow * stride
    val top = values[topOffset + leftColumn] * (1f - weightX) + values[topOffset + rightColumn] * weightX
    val bottom = values[bottomOffset + leftColumn] * (1f - weightX) + values[bottomOffset + rightColumn] * weightX
    return top * (1f - weightY) + bottom * weightY
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `./gradlew test ktlintCheck :app:assembleDebug`
Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add -A
git commit -m "feat: 축소판 계수를 되올려 원본 알파에 적용한다"
```

---

## Task 5: 정련 조립

**Files:**
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/image/AlphaRefine.kt`
- Modify: `data/src/test/java/com/teamyg/parfait/data/repository/image/AlphaRefineTest.kt`

**Interfaces:**
- Consumes: Task 1~4의 함수 전부
- Produces: `internal fun refineAlpha(alpha: ByteArray, guidance: IntArray, width: Int, height: Int, downscale: Int, radius: Int, epsilon: Float, checkCancelled: () -> Unit = {}): Boolean`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

파일 최상위에 헬퍼 둘을 더한다:

```kotlin
private const val BLACK = 0xFF000000.toInt()
private const val WHITE = 0xFFFFFFFF.toInt()

/** 왼쪽 [darkColumns] 칸이 검고 나머지가 흰 안내자 */
private fun splitGuidance(
    width: Int,
    height: Int,
    darkColumns: Int,
) = IntArray(width * height) { index -> if (index % width < darkColumns) BLACK else WHITE }

/** [opaqueFrom] 칸부터 오른쪽 끝까지 불투명한 알파 */
private fun maskFrom(
    width: Int,
    height: Int,
    opaqueFrom: Int,
) = ByteArray(width * height) { index -> if (index % width >= opaqueFrom) 255.toByte() else 0 }
```

클래스 안에 넷을 더한다:

```kotlin
    @Test
    fun refineAlpha_maskOverhangsIntoTheDarkSide_pullsTheEdgeBackToTheColourEdge() {
        // Given — 색 경계는 16 인데 마스크가 13 까지 넘어와 있다(배경 3칸을 물고 있다)
        val guidance = splitGuidance(width = 32, height = 8, darkColumns = 16)
        val guided = maskFrom(width = 32, height = 8, opaqueFrom = 13)
        val flat = maskFrom(width = 32, height = 8, opaqueFrom = 13)

        // When — 같은 마스크를 색 경계가 있는 안내자와 균일한 안내자로 각각 정련한다
        refineAlpha(guided, guidance, width = 32, height = 8, downscale = 1, radius = 4, epsilon = 1e-4f)
        refineAlpha(flat, IntArray(32 * 8) { WHITE }, width = 32, height = 8, downscale = 1, radius = 4, epsilon = 1e-4f)

        // Then — 배경을 물고 있던 자리가 색 안내자 쪽에서 더 투명해진다.
        // 안내자를 무시하는 구현이면 두 값이 같아 이 단언이 깨진다
        val overhang = 4 * 32 + 14
        assertTrue(
            (guided[overhang].toInt() and 0xFF) < (flat[overhang].toInt() and 0xFF),
            "guided=${guided[overhang].toInt() and 0xFF} flat=${flat[overhang].toInt() and 0xFF}",
        )
    }

    @Test
    fun refineAlpha_deepInsideTheSubject_staysOpaque() {
        // Given — 정련이 내부까지 반투명하게 만들면 안 된다
        val guidance = splitGuidance(width = 32, height = 8, darkColumns = 16)
        val alpha = maskFrom(width = 32, height = 8, opaqueFrom = 13)

        // When
        refineAlpha(alpha, guidance, width = 32, height = 8, downscale = 1, radius = 4, epsilon = 1e-4f)

        // Then
        val deepInside = 4 * 32 + 28
        assertTrue((alpha[deepInside].toInt() and 0xFF) > 250, "value=${alpha[deepInside].toInt() and 0xFF}")
    }

    @Test
    fun refineAlpha_hardEdge_becomesASoftTransition() {
        // Given — 이 라운드의 목적이다. 정련 전에는 0 과 255 뿐이다
        val guidance = splitGuidance(width = 32, height = 8, darkColumns = 16)
        val alpha = maskFrom(width = 32, height = 8, opaqueFrom = 16)

        // When
        refineAlpha(alpha, guidance, width = 32, height = 8, downscale = 1, radius = 4, epsilon = 1e-4f)

        // Then
        val partial = alpha.count { (it.toInt() and 0xFF) in 1..254 }
        assertTrue(partial > 0, "partial=$partial")
    }

    @Test
    fun refineAlpha_downscaledCoefficients_keepTheEdgeAtTheSamePlace() {
        // Given — 계수를 축소판에서 구해도 경계 위치가 밀리면 안 된다
        val guidance = splitGuidance(width = 64, height = 16, darkColumns = 32)
        val fullScale = maskFrom(width = 64, height = 16, opaqueFrom = 28)
        val downscaled = maskFrom(width = 64, height = 16, opaqueFrom = 28)

        // When
        refineAlpha(fullScale, guidance, width = 64, height = 16, downscale = 1, radius = 4, epsilon = 1e-4f)
        refineAlpha(downscaled, guidance, width = 64, height = 16, downscale = 4, radius = 1, epsilon = 1e-4f)

        // Then — 가운데 행에서 알파가 128 을 넘는 첫 칸이 두 칸 이상 어긋나지 않는다
        val row = 8 * 64
        val fullCrossing = (0 until 64).first { (fullScale[row + it].toInt() and 0xFF) > 128 }
        val downCrossing = (0 until 64).first { (downscaled[row + it].toInt() and 0xFF) > 128 }
        assertTrue(
            kotlin.math.abs(fullCrossing - downCrossing) <= 2,
            "full=$fullCrossing down=$downCrossing",
        )
    }
```

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests "*AlphaRefineTest*"`
Expected: 컴파일 실패 — `Unresolved reference: refineAlpha`

- [ ] **Step 3: 구현한다**

```kotlin
/**
 * 원본 휘도를 안내자로 알파 경계를 정련한다. 알파를 **그 자리에서** 고친다.
 *
 * 계수는 [downscale] 배율 축소판에서 구하고 적용만 원본 해상도에서 한다. 그 근거와 전체 설계는
 * `specs/2026-08-25-segmentation-alpha-refinement.md` 참고.
 *
 * @param guidance [alpha] 와 같은 크기·같은 좌표계의 ARGB
 * @return 알파가 한 픽셀이라도 바뀌었으면 true
 */
internal fun refineAlpha(
    alpha: ByteArray,
    guidance: IntArray,
    width: Int,
    height: Int,
    downscale: Int,
    radius: Int,
    epsilon: Float,
    checkCancelled: () -> Unit = {},
): Boolean {
    require(alpha.size == width * height) {
        "alpha length ${alpha.size} does not match ${width}x$height"
    }
    require(guidance.size == alpha.size) {
        "guidance length ${guidance.size} does not match alpha length ${alpha.size}"
    }
    require(downscale >= 1) { "downscale must be at least 1 but was $downscale" }
    require(radius >= 1) { "radius must be at least 1 but was $radius" }
    require(epsilon > 0f) { "epsilon must be positive but was $epsilon" }
    if (width <= 0 || height <= 0) return false

    val luminance = toLuminance(guidance, checkCancelled)
    val subWidth = ceilDiv(width, downscale)
    val subHeight = ceilDiv(height, downscale)

    val coefficients = guidedCoefficients(
        guidance = downscaleAverage(luminance, width, height, downscale),
        input = downscaleAverage(toUnitAlpha(alpha), width, height, downscale),
        width = subWidth,
        height = subHeight,
        radius = radius,
        epsilon = epsilon,
        checkCancelled = checkCancelled,
    )

    return applyCoefficients(
        alpha = alpha,
        guidance = luminance,
        coefficients = coefficients,
        width = width,
        height = height,
        subWidth = subWidth,
        subHeight = subHeight,
        factor = downscale,
        checkCancelled = checkCancelled,
    )
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `./gradlew test ktlintCheck :app:assembleDebug`
Expected: PASS

⚠️ `pullsTheEdgeBackToTheColourEdge`가 깨지면 안내자가 계수에 반영되지 않은 것이다. 값 자체를
조정하지 말고 보고한다 — 그 테스트가 이 기능의 존재 이유다.

- [ ] **Step 5: 커밋한다**

```bash
git add -A
git commit -m "feat: 안내자로 알파 경계를 정련한다"
```

---

## Task 6: 커널 배선

**Files:**
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/image/AlphaPostProcessor.kt`
- Modify: `data/src/test/java/com/teamyg/parfait/data/repository/image/AlphaPostProcessorTest.kt`

**Interfaces:**
- Consumes: `refineAlpha` (Task 5)
- Produces: `internal fun interface GuidanceProvider`,
  `AlphaPostProcessOptions.refineEdges/refineDownscale/refineRadius/refineEpsilon`,
  `postProcessAlpha(alpha, width, height, options, guidance, checkCancelled)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`AlphaPostProcessorTest.kt` 클래스 안에 셋을 더한다:

```kotlin
    @Test
    fun postProcessAlpha_refineDisabled_leavesTheAlphaExactlyAsBefore() {
        // Given — 같은 입력 두 벌. 하나는 안내자를 주되 정련을 끄고, 하나는 안내자를 안 준다
        val withGuidance = ByteArray(64) { 255.toByte() }
        val withoutGuidance = ByteArray(64) { 255.toByte() }
        val options = AlphaPostProcessOptions(
            downscaleFactor = 1,
            areaOpeningMinPixels = 4,
            refineEdges = false,
        )

        // When
        postProcessAlpha(
            withGuidance,
            width = 8,
            height = 8,
            options = options,
            guidance = { bounds -> IntArray(bounds.width * bounds.height) { 0xFF808080.toInt() } },
        )
        postProcessAlpha(withoutGuidance, width = 8, height = 8, options = options)

        // Then
        assertContentEquals(withoutGuidance.asInts(), withGuidance.asInts())
    }

    @Test
    fun postProcessAlpha_refineEnabledWithoutGuidance_skipsRefinement() {
        // Given — 안내자를 못 대는 호출부가 커널을 그대로 쓸 수 있어야 한다
        val alpha = ByteArray(64) { 255.toByte() }
        val options = AlphaPostProcessOptions(
            downscaleFactor = 1,
            areaOpeningMinPixels = 4,
            refineEdges = true,
        )

        // When
        val result = postProcessAlpha(alpha, width = 8, height = 8, options = options)

        // Then
        assertEquals(false, result?.changed)
        assertEquals(0, result?.partialAlphaPixels)
    }

    @Test
    fun postProcessAlpha_refineEnabledWithGuidance_producesPartialAlpha() {
        // Given — 왼쪽 절반이 검고 오른쪽이 흰 안내자에, 경계가 어긋난 하드 매트
        val alpha = ByteArray(64) { index -> if (index % 8 >= 3) 255.toByte() else 0 }
        val options = AlphaPostProcessOptions(
            downscaleFactor = 1,
            areaOpeningMinPixels = 4,
            erodeEdge = false,
            refineEdges = true,
            refineDownscale = 1,
            refineRadius = 2,
        )

        // When
        val result = postProcessAlpha(
            alpha,
            width = 8,
            height = 8,
            options = options,
            guidance = { bounds ->
                IntArray(bounds.width * bounds.height) { index ->
                    if ((index % bounds.width) + bounds.left >= 4) 0xFFFFFFFF.toInt() else 0xFF000000.toInt()
                }
            },
        )

        // Then — 하드 매트에는 없던 부분 알파가 생긴다
        assertEquals(true, result?.changed)
        assertTrue((result?.partialAlphaPixels ?: 0) > 0, "partial=${result?.partialAlphaPixels}")
    }
```

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests "*AlphaPostProcessorTest*"`
Expected: 컴파일 실패 — `No value passed for parameter 'guidance'` 또는
`Unresolved reference: refineEdges`

- [ ] **Step 3: 옵션과 공급자를 더한다**

`AlphaPostProcessor.kt`의 옵션에 넷을 더한다. **기본값은 측정 전 추정이라 근거를 포인터로 남긴다:**

```kotlin
/** 정련 계수를 구할 배율. 판정 버퍼 배율(`downscaleFactor`)과 **별개 값**이다 */
internal const val REFINE_DOWNSCALE = 4

/** 축소판 기준 창 반경. 값의 근거는 `synthesis/open-questions.md` OQ-P-298 */
internal const val REFINE_RADIUS = 2

/** 정칙화. 작을수록 안내자를 바싹 따라간다. 근거는 OQ-P-298 */
internal const val REFINE_EPSILON = 1e-4f

internal data class AlphaPostProcessOptions(
    val downscaleFactor: Int = 4,
    val binaryThreshold: Int = 127,
    val areaOpeningMinPixels: Int = AREA_OPENING_MIN_PIXELS,
    val erodeEdge: Boolean = true,
    val minPixelsForDownscale: Int = MIN_PIXELS_FOR_DOWNSCALE,
    val refineEdges: Boolean = true,
    val refineDownscale: Int = REFINE_DOWNSCALE,
    val refineRadius: Int = REFINE_RADIUS,
    val refineEpsilon: Float = REFINE_EPSILON,
)

/**
 * 정련이 쓸 안내자를 공급한다. 커널이 `Bitmap` 을 모른다는 원칙을 지키면서 두 경로가 서로 다른
 * 방식으로 픽셀을 대게 하는 통로다.
 */
internal fun interface GuidanceProvider {
    /** [bounds] 크기의 ARGB. 행 우선이고 stride 는 `bounds.width` 다 */
    fun pixelsIn(bounds: SegmentationBounds): IntArray
}
```

- [ ] **Step 4: 조립부를 측정 두 번으로 가른다**

`postProcessAlpha`의 시그니처에 `guidance`를 더하고, 기존 조립부(위 「손대는 기존 코드의 실제
형태」에 옮겨 둔 네 줄)를 아래로 치환한다:

```kotlin
internal fun postProcessAlpha(
    alpha: ByteArray,
    width: Int,
    height: Int,
    options: AlphaPostProcessOptions = AlphaPostProcessOptions(),
    guidance: GuidanceProvider? = null,
    checkCancelled: () -> Unit = {},
): AlphaPostProcessResult? {
```

```kotlin
    val applied = applyKeepMask(alpha, width, height, keep, maskWidth, factor, checkCancelled)

    // 정련이 훑을 영역을 먼저 정한다. 창 통계를 내는 연산이라 빈 여백까지 훑으면 값 없이 비싸다
    val measuredBeforeRefine = measureAlpha(alpha, width, height, checkCancelled) ?: return null

    val refined = options.refineEdges && guidance != null &&
        refineWithin(alpha, width, measuredBeforeRefine.bounds, guidance, options, checkCancelled)
    val eroded = options.erodeEdge && erodeEdge(alpha, width, height, checkCancelled)

    val measured = if (refined || eroded) {
        measureAlpha(alpha, width, height, checkCancelled) ?: return null
    } else {
        measuredBeforeRefine
    }

    return AlphaPostProcessResult(
        bounds = measured.bounds,
        alphaSum = measured.alphaSum,
        partialAlphaPixels = measured.partialAlphaPixels,
        changed = applied || refined || eroded,
    )
```

같은 파일에 private 헬퍼를 더한다:

```kotlin
/**
 * [bounds] 사각형만 잘라 정련하고 되쓴다. 잘라 내는 이유는 [refineAlpha] 가 연속된 배열을
 * 전제하기 때문이고, 그 전제를 유지하는 편이 stride 를 함수 넷에 실어 나르는 것보다 싸다.
 */
private fun refineWithin(
    alpha: ByteArray,
    rowStride: Int,
    bounds: SegmentationBounds,
    guidance: GuidanceProvider,
    options: AlphaPostProcessOptions,
    checkCancelled: () -> Unit,
): Boolean {
    val patch = ByteArray(bounds.width * bounds.height)
    for (y in 0 until bounds.height) {
        val source = (bounds.top + y) * rowStride + bounds.left
        alpha.copyInto(patch, y * bounds.width, source, source + bounds.width)
    }

    val changed = refineAlpha(
        alpha = patch,
        guidance = guidance.pixelsIn(bounds),
        width = bounds.width,
        height = bounds.height,
        downscale = options.refineDownscale,
        radius = options.refineRadius,
        epsilon = options.refineEpsilon,
        checkCancelled = checkCancelled,
    )
    if (!changed) return false

    for (y in 0 until bounds.height) {
        val target = (bounds.top + y) * rowStride + bounds.left
        patch.copyInto(alpha, target, y * bounds.width, y * bounds.width + bounds.width)
    }

    return true
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `./gradlew test ktlintCheck :app:assembleDebug`
Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add -A
git commit -m "feat: 후처리 커널에 경계 정련 단계를 끼운다"
```

---

## Task 7: 호출부 배선과 관측

**Files:**
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/image/ImageSegmentationRepositoryImpl.kt`

**Interfaces:**
- Consumes: `GuidanceProvider`, `postProcessAlpha(..., guidance, ...)` (Task 6)
- Produces: 없음 (private)

**테스트가 없는 이유:** 이 코드는 `Bitmap.getPixels`를 부른다. 저장소에 Robolectric이 없고
`isReturnDefaultValues`도 꺼져 있어 JVM 유닛에서 터진다. 판단은 전부 Task 1~6의 순수 함수로 빠져
있고 여기 남는 것은 사각형 좌표 산술과 로그다.

- [ ] **Step 1: 주 경로에 안내자를 공급한다**

`postProcess` 안에서 `postProcessAlpha` 호출을 아래로 바꾼다. `pixels`는 이미 후보 판 전체를
담고 있으므로 요청받은 사각형만 잘라 낸다:

```kotlin
        val startedAt = System.nanoTime()
        val result = postProcessAlpha(
            alpha,
            width,
            height,
            guidance = { bounds -> pixels.cropTo(bounds, width) },
            checkCancelled = checkCancelled,
        ) ?: run {
            repositoryLogger.i {
                "세그멘테이션 후처리가 후보 ${width}x$height 판 전체를 잡티로 판정해 원본으로 되돌린다"
            }
            return null
        }

        repositoryLogger.i {
            val elapsedMillis = (System.nanoTime() - startedAt) / 1_000_000
            "세그멘테이션 후보 부분 알파 ${result.partialAlphaPixels}/${width * height}, 후처리 ${elapsedMillis}ms"
        }
```

⚠️ **기존 전멸 로그와 부분 알파 로그를 지우지 말고 위 형태로 합친다.** 둘 다 앞 라운드가 미결
판정용으로 심은 것이다.

- [ ] **Step 2: 폴백 경로에 안내자를 공급한다**

`toForegroundCandidate`에서 `maskSubjectAlpha` 호출에 안내자를 더한다. 알파가 원본 좌표계이므로
사각형도 원본 좌표계이고, 그 사각형만 읽는다:

```kotlin
        val masked = try {
            maskSubjectAlpha(
                foregroundMask,
                width,
                height,
                guidance = { bounds ->
                    IntArray(bounds.width * bounds.height).also { pixels ->
                        origin.getPixels(
                            pixels,
                            0,
                            bounds.width,
                            bounds.left,
                            bounds.top,
                            bounds.width,
                            bounds.height,
                        )
                    }
                },
                checkCancelled = checkCancelled,
            )
        } catch (e: OutOfMemoryError) {
```

`SegmentationMask.kt`의 `maskSubjectAlpha`도 안내자를 받아 그대로 넘기도록 파라미터를 하나
더한다(기본값 `null`):

```kotlin
internal fun maskSubjectAlpha(
    mask: FloatBuffer,
    width: Int,
    height: Int,
    options: AlphaPostProcessOptions = AlphaPostProcessOptions(),
    guidance: GuidanceProvider? = null,
    checkCancelled: () -> Unit = {},
): MaskedAlpha? {
```

본문의 `postProcessAlpha` 호출에 `guidance = guidance`를 더한다.

- [ ] **Step 3: 사각형 자르기 헬퍼를 더한다**

`ImageSegmentationRepositoryImpl.kt`의 private 헬퍼로 둔다. 주 경로에서만 쓴다:

```kotlin
    /** 후보 판 픽셀에서 [bounds] 사각형만 잘라 낸다. [rowStride] 는 판 전체의 폭이다 */
    private fun IntArray.cropTo(
        bounds: SegmentationBounds,
        rowStride: Int,
    ): IntArray {
        val cropped = IntArray(bounds.width * bounds.height)
        for (y in 0 until bounds.height) {
            val source = (bounds.top + y) * rowStride + bounds.left
            copyInto(cropped, y * bounds.width, source, source + bounds.width)
        }
        return cropped
    }
```

- [ ] **Step 4: 통과를 확인한다**

Run: `./gradlew test ktlintCheck :app:assembleDebug`
Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add -A
git commit -m "feat: 두 경로에 정련 안내자를 대고 소요 시간을 남긴다"
```

---

## 자체 점검

계획을 다 쓴 뒤 스펙과 대조해 확인한 것들이다.

**스펙 커버리지** — 「설계」의 다섯 절이 각각 태스크로 간다. 정련 알고리즘 → Task 3·4·5, 처리
해상도 → Task 2·4, 파이프라인 자리 → Task 6, 안내자 공급 → Task 6·7, 관측 → Task 7. 「테스트」
절의 여섯 항목이 Task 1(박스 합)·3(계수 퇴화 둘)·5(경계 이동·반대 방향·배율 일치)·6(끄면 동일)에
대응한다.

**타입 일관성** — `GuidedCoefficients`는 Task 3이 만들고 4·5가 쓴다. `GuidanceProvider`는 Task 6이
만들고 7이 쓴다. `ceilDiv`는 기존 것을 재사용한다(Task 2·5). `OPAQUE`는 Task 2가 `AlphaRefine.kt`
파일 private으로 선언하고 4가 쓴다 — `AlphaPostProcessor.kt`에 같은 이름의 파일 private 상수가
있으나 **파일이 다르므로 충돌하지 않는다.**

**남는 것** — 사진 세트 판정(OQ-P-296·297·298·299)은 이 계획에 넣지 않는다. 실기기에서 사람이
돌려야 하고, 앞 라운드의 Task 14와 같은 성격이다.
