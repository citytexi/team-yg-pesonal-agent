---
id: segmentation-retry-recovery
title: 세그멘테이션 재시도 회복 구현 계획 (8 Task)
status: draft
type: work-order
created: 2026-09-10
updated: 2026-09-10
platforms: android
owner: android
related_adr: ADR-0012
related_spec: segmentation-retry-recovery, segmentation-preprocessing, c103-error-use-original
related_code: ImageSegmentationRepositoryImpl#segmentImage, ImageSegmentationRepositoryImpl#segmentForeground, ImageSegmentationRepositoryImpl#toCandidatePairs, ImageSegmentationRepositoryImpl#postProcess, ImageSegmentationRepositoryImpl#toForegroundCandidate, SegmentationMask.kt#maskSubjectAlpha, AlphaPostProcessor.kt#postProcessAlpha, SegmentationCandidateFilter.kt#filterCandidates, SubjectCoverage.kt#floorPixels, SegmentationViewModel.kt#loadCandidates
archived_reason:
tags: [plan, parfait]
---

# 세그멘테이션 재시도 회복 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 후보 0건으로 실패한 사진에서 「다시 시도」가 입력을 손봐 가며 다시 검출하게 만든다.

**Architecture:** 저장소에 `recoverCandidates`를 더해 전처리 두 단계를 순서대로 시도한다. 손본 판은
검출에만 쓰고 알파를 원본 공간으로 되올려 후보를 만들므로 결과 픽셀은 언제나 원본에서 온다.
판단은 전부 순수 함수로 빼서 기기 없이 검증하고, 비트맵을 만지는 얇은 실행기만 남긴다.

**Tech Stack:** Kotlin, ML Kit Subject Segmentation, Hilt, kotlinx.coroutines, JUnit4 + kotlin.test + MockK + Turbine

**Spec:** [`parfait/specs/2026-09-10-segmentation-retry-recovery.md`](../specs/2026-09-10-segmentation-retry-recovery.md)

## Global Constraints

- **작업 저장소는 `TJYG-Android`다.** 이 계획 문서만 `team-yg-pesonal-agent`에 있다. 브랜치는
  `feature/#486-segmentation-error-case`.
- **커밋은 각 Task 끝에서 한다.** 푸시와 PR은 사용자 승인 전까지 하지 않는다.
- **1차 경로의 동작을 바꾸지 않는다.** 새 인자는 전부 기본값을 둬서 기존 호출부가 안 바뀐다.
- **깨진 Task 경계를 만들지 않는다.** `testDebugUnitTest`가 main 소스셋 컴파일을 선행으로 잡으므로,
  한 Task가 끝난 시점에 그 모듈이 컴파일돼야 한다.
- **테스트 이름은 카멜케이스다.** 이 저장소에 백틱 테스트명은 0건이다.
- **ktlint 최대 줄 길이는 120자다.**
- **`:domain`은 순수 JVM이라 `test`를 쓴다.** `testDebugUnitTest`는 `:domain`을 조용히 건너뛴다.
- **주석 규약** (`parfait/CLAUDE.md`) — 코드가 이미 말하는 것은 쓰지 않는다. `@return`·`@param`은
  타입·이름이 말하지 못할 때만 쓴다. 다른 컴포넌트의 현재 상태를 단정하지 않는다(낡는다).
- **잠정값은 스펙 4-1 표를 그대로 쓴다.** 하한 512, 상한 2048, 퍼센타일 1·99, 여유 20%,
  수축 가드 70%, 중앙 폴백 70%, 회복 필터 하한 1/4, 대기 상한 30초, 왕복 허용오차 각 축 1px.

---

### Task 1: 회복 계획 순수 계산

검출 공간과 원본 공간을 가르는 타입, 해상도 목표, 두 단계의 계획과 가드를 만든다. 호출부가 없는
순수 추가라 이 Task만으로 컴파일이 닫힌다.

**Files:**
- Create: `data/src/main/java/com/teamyg/parfait/data/utils/image/SegmentationRecoveryPlan.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/utils/image/SegmentationRecoveryPlanTest.kt`

**Interfaces:**
- Consumes: `SegmentationBounds`(domain, 이미 있다)
- Produces: `DetectionBounds`, `ScaledSize`, `RecoveryTransform`, `resolveTargetSize`,
  `normalizeStage`, `focusStage`, `hintBounds`, `RecoveryStage`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`SegmentationRecoveryPlanTest.kt`:

```kotlin
package com.teamyg.parfait.data.utils.image

import com.teamyg.parfait.domain.model.SegmentationBounds
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SegmentationRecoveryPlanTest {
    @Test
    fun resolveTargetSize_shortSideBelowTheFloor_upscalesKeepingTheRatio() {
        // Given 짧은 변이 하한 미만인 판
        val target = resolveTargetSize(width = 400, height = 300)

        // Then 짧은 변이 하한이 되고 비율이 보존된다
        assertEquals(ScaledSize(width = 683, height = 512), target)
    }

    @Test
    fun resolveTargetSize_shortSideExactlyTheFloor_doesNotChange() {
        assertEquals(ScaledSize(width = 683, height = 512), resolveTargetSize(683, 512))
    }

    @Test
    fun resolveTargetSize_longSideAboveTheCeiling_downscales() {
        // Given 12MP 사진
        val target = resolveTargetSize(width = 4032, height = 3024)

        // Then 긴 변이 상한이 된다
        assertEquals(ScaledSize(width = 2048, height = 1536), target)
    }

    @Test
    fun resolveTargetSize_floorAndCeilingConflict_theCeilingWins() {
        // Given 극단 종횡비 — 하한을 맞추면 긴 변이 상한을 넘는다
        val target = resolveTargetSize(width = 5000, height = 400)

        // Then 상한이 이겨서 짧은 변은 하한에 못 미친다
        assertEquals(2048, target.width)
        assertTrue(target.height < DETECTION_MIN_SHORT_SIDE)
    }

    @Test
    fun normalizeStage_targetEqualsSourceAndNoContrast_isNull() {
        // Given 하한과 상한 사이에 이미 들어 있는 판
        assertNull(normalizeStage(width = 1920, height = 1080, applyContrast = false))
    }

    @Test
    fun normalizeStage_targetEqualsSourceButContrastApplies_isNotNull() {
        assertTrue(normalizeStage(width = 1920, height = 1080, applyContrast = true) != null)
    }

    @Test
    fun normalizeStage_hasNoCropAndNoOffset() {
        // Given 축소가 필요한 판
        val stage = requireNotNull(normalizeStage(4032, 3024, applyContrast = true))

        // Then 크롭이 없고 오프셋이 0 이다
        assertNull(stage.cropRect)
        assertEquals(0, stage.transform.offsetX)
        assertEquals(0, stage.transform.offsetY)
    }

    @Test
    fun hintBounds_pixelsAboveTheThreshold_wrapsThemExclusiveOnTheFarSide() {
        // Given 3x3 판의 가운데 한 칸만 임계를 넘는다
        val alpha = ByteArray(9)
        alpha[4] = 200.toByte()

        // Then 오른쪽·아래는 exclusive 다
        assertEquals(DetectionBounds(1, 1, 2, 2), hintBounds(alpha, 3, 3, threshold = 127))
    }

    @Test
    fun hintBounds_nothingAboveTheThreshold_isNull() {
        assertNull(hintBounds(ByteArray(9), 3, 3, threshold = 127))
    }

    @Test
    fun hintBounds_thresholdIsExclusive() {
        // Given 임계와 정확히 같은 값만 있다
        val alpha = ByteArray(4) { 127.toByte() }

        // Then 초과가 아니므로 없다
        assertNull(hintBounds(alpha, 2, 2, threshold = 127))
    }

    @Test
    fun focusStage_hintIsScattered_isNullBecauseTheCropDoesNotShrink() {
        // Given 힌트가 판 전체에 걸쳐 있다
        val hint = DetectionBounds(0, 0, 100, 100)
        val identity = RecoveryTransform(scaleX = 10f, scaleY = 10f, offsetX = 0, offsetY = 0)

        // Then 여유를 붙이면 원본과 같아지므로 2단계를 건너뛴다
        assertNull(focusStage(1000, 1000, hint, identity, applyContrast = true))
    }

    @Test
    fun focusStage_hintIsSmall_cropsAroundItWithMargin() {
        // Given 원본 좌표로 400..600 에 해당하는 힌트
        val hint = DetectionBounds(40, 40, 60, 60)
        val transform = RecoveryTransform(scaleX = 10f, scaleY = 10f, offsetX = 0, offsetY = 0)

        // When
        val stage = requireNotNull(focusStage(1000, 1000, hint, transform, applyContrast = true))

        // Then 각 변에 힌트 크기의 20% 가 붙는다
        assertEquals(SegmentationBounds(left = 360, top = 360, right = 640, bottom = 640), stage.cropRect)
        assertEquals(360, stage.transform.offsetX)
    }

    @Test
    fun focusStage_hintTouchesTheEdge_clampsToTheOrigin() {
        val hint = DetectionBounds(0, 0, 10, 10)
        val transform = RecoveryTransform(scaleX = 10f, scaleY = 10f, offsetX = 0, offsetY = 0)

        val stage = requireNotNull(focusStage(1000, 1000, hint, transform, applyContrast = true))

        assertEquals(0, requireNotNull(stage.cropRect).left)
        assertEquals(0, requireNotNull(stage.cropRect).top)
    }

    @Test
    fun focusStage_noHint_fallsBackToTheCenterCrop() {
        val stage = requireNotNull(focusStage(1000, 1000, hint = null, hintTransform = null, applyContrast = true))

        assertEquals(SegmentationBounds(left = 150, top = 150, right = 850, bottom = 850), stage.cropRect)
    }

    @Test
    fun recoveryTransform_roundTrip_returnsWithinOnePixel() {
        // Given 상한에 걸려 축소되고 비율도 딱 안 떨어지는 크롭 — 배율이 1 이면 반올림을 안 탄다
        val crop = SegmentationBounds(left = 137, top = 251, right = 4137, bottom = 2918)
        val target = resolveTargetSize(crop.width, crop.height)
        val transform = RecoveryTransform(
            scaleX = crop.width.toFloat() / target.width,
            scaleY = crop.height.toFloat() / target.height,
            offsetX = crop.left,
            offsetY = crop.top,
        )
        val detection = DetectionBounds(0, 0, target.width, target.height)

        // When 검출 공간 전체를 원본으로 되돌린다
        val origin = transform.toOrigin(detection)

        // Then 각 축 1px 안에서 크롭과 같다
        assertTrue(kotlin.math.abs(origin.left - crop.left) <= ROUND_TRIP_TOLERANCE_PX)
        assertTrue(kotlin.math.abs(origin.top - crop.top) <= ROUND_TRIP_TOLERANCE_PX)
        assertTrue(kotlin.math.abs(origin.right - crop.right) <= ROUND_TRIP_TOLERANCE_PX)
        assertTrue(kotlin.math.abs(origin.bottom - crop.bottom) <= ROUND_TRIP_TOLERANCE_PX)
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew :data:compileDebugUnitTestKotlin`
Expected: FAIL — `Unresolved reference: resolveTargetSize` 등

- [ ] **Step 3: 최소 구현을 쓴다**

`SegmentationRecoveryPlan.kt`:

```kotlin
package com.teamyg.parfait.data.utils.image

import com.teamyg.parfait.domain.model.SegmentationBounds
import kotlin.math.roundToInt

/** ML Kit 가이드가 "at least 512x512" 를 적는다 */
internal const val DETECTION_MIN_SHORT_SIDE = 512

/** 문서 근거가 아니라 자원에서 나온 값이다. 판을 네 번 추론하므로 피크를 여기서 막는다 */
internal const val DETECTION_MAX_LONG_SIDE = 2048

private const val FOCUS_MARGIN_RATIO = 0.20f

/** 크롭 면적이 원본의 이 비율 미만으로 줄어야 2단계가 값을 한다 */
private const val FOCUS_SHRINK_CEILING = 0.70f

private const val CENTER_CROP_RATIO = 0.70f

/** 왕복 좌표 허용오차. 테스트가 구현의 오차에 맞춰지지 않게 여기서 고정한다 */
internal const val ROUND_TRIP_TOLERANCE_PX = 1

/**
 * 검출 공간의 사각형.
 *
 * `SegmentationBounds` 는 KDoc 이 원본 좌표를 단정하고 있어, 같은 타입으로 두 좌표계를 겸하면
 * 짝이 안 맞는 조합이 컴파일된다.
 */
internal data class DetectionBounds(
    val left: Int,
    val top: Int,
    val right: Int,
    val bottom: Int,
) {
    val width: Int get() = right - left

    val height: Int get() = bottom - top
}

internal data class ScaledSize(val width: Int, val height: Int)

/**
 * 검출 공간의 좌표를 원본 공간으로 되돌린다.
 *
 * 축마다 배율이 다른 것은 목표 치수를 정수로 반올림하기 때문이다. 하나로 합치면 긴 축에서 오차가
 * 픽셀 단위로 쌓인다.
 */
internal data class RecoveryTransform(
    val scaleX: Float,
    val scaleY: Float,
    val offsetX: Int,
    val offsetY: Int,
) {
    fun toOrigin(bounds: DetectionBounds): SegmentationBounds = SegmentationBounds(
        left = offsetX + (bounds.left * scaleX).roundToInt(),
        top = offsetY + (bounds.top * scaleY).roundToInt(),
        right = offsetX + (bounds.right * scaleX).roundToInt(),
        bottom = offsetY + (bounds.bottom * scaleY).roundToInt(),
    )
}

internal data class RecoveryStage(
    /** 널이면 원본 전체를 쓴다. 좌표는 원본 기준이다 */
    val cropRect: SegmentationBounds?,
    val targetSize: ScaledSize,
    val applyContrast: Boolean,
    val transform: RecoveryTransform,
)

/**
 * 검출에 쓸 치수를 정한다.
 *
 * 하한과 상한이 충돌하면 상한이 이긴다 — 확대는 정보를 늘리지 않지만 상한 초과는 메모리로 죽는다.
 */
internal fun resolveTargetSize(width: Int, height: Int): ScaledSize {
    require(width > 0 && height > 0) { "size must be positive but was ${width}x$height" }

    val shortSide = minOf(width, height)
    val longSide = maxOf(width, height)

    val floorScale = maxOf(1f, DETECTION_MIN_SHORT_SIDE.toFloat() / shortSide)
    val ceilingScale = DETECTION_MAX_LONG_SIDE.toFloat() / longSide
    val scale = minOf(floorScale, ceilingScale)

    return ScaledSize(
        width = maxOf(1, (width * scale).roundToInt()),
        height = maxOf(1, (height * scale).roundToInt()),
    )
}

/**
 * 크롭 없는 1단계.
 *
 * 목표 치수가 원본과 같고 대비도 안 걸면 1차 경로의 재실행일 뿐이라 널이다.
 */
internal fun normalizeStage(width: Int, height: Int, applyContrast: Boolean): RecoveryStage? {
    val target = resolveTargetSize(width, height)
    if (!applyContrast && target.width == width && target.height == height) return null

    return RecoveryStage(
        cropRect = null,
        targetSize = target,
        applyContrast = applyContrast,
        transform = RecoveryTransform(
            scaleX = width.toFloat() / target.width,
            scaleY = height.toFloat() / target.height,
            offsetX = 0,
            offsetY = 0,
        ),
    )
}

/**
 * 힌트로 2단계를 만든다. 힌트가 없으면 중앙 크롭이다.
 *
 * 크롭이 충분히 안 줄면 널이다 — 1단계 재탕에 추론만 더 쓰게 된다.
 */
internal fun focusStage(
    width: Int,
    height: Int,
    hint: DetectionBounds?,
    hintTransform: RecoveryTransform?,
    applyContrast: Boolean,
): RecoveryStage? {
    val crop = if (hint != null && hintTransform != null) {
        expandHint(hintTransform.toOrigin(hint), width, height)
    } else {
        centerCrop(width, height)
    }

    val originArea = width.toLong() * height
    if (crop.width.toLong() * crop.height >= originArea * FOCUS_SHRINK_CEILING) return null

    val target = resolveTargetSize(crop.width, crop.height)

    return RecoveryStage(
        cropRect = crop,
        targetSize = target,
        applyContrast = applyContrast,
        transform = RecoveryTransform(
            scaleX = crop.width.toFloat() / target.width,
            scaleY = crop.height.toFloat() / target.height,
            offsetX = crop.left,
            offsetY = crop.top,
        ),
    )
}

private fun expandHint(hint: SegmentationBounds, width: Int, height: Int): SegmentationBounds {
    val marginX = (hint.width * FOCUS_MARGIN_RATIO).roundToInt()
    val marginY = (hint.height * FOCUS_MARGIN_RATIO).roundToInt()

    return SegmentationBounds(
        left = (hint.left - marginX).coerceIn(0, width),
        top = (hint.top - marginY).coerceIn(0, height),
        right = (hint.right + marginX).coerceIn(0, width),
        bottom = (hint.bottom + marginY).coerceIn(0, height),
    )
}

private fun centerCrop(width: Int, height: Int): SegmentationBounds {
    val cropWidth = maxOf(1, (width * CENTER_CROP_RATIO).roundToInt())
    val cropHeight = maxOf(1, (height * CENTER_CROP_RATIO).roundToInt())
    val left = (width - cropWidth) / 2
    val top = (height - cropHeight) / 2

    return SegmentationBounds(left = left, top = top, right = left + cropWidth, bottom = top + cropHeight)
}

/**
 * 임계를 **초과**하는 픽셀을 감싸는 사각형. 하나도 없으면 널이다.
 *
 * 임계를 폴백의 이진화와 같은 축에서 받는 것이 중요하다. 더 높은 축을 쓰면 1단계가 실패한 상황에서
 * 힌트가 구조적으로 거의 항상 빈다.
 */
internal fun hintBounds(alpha: ByteArray, width: Int, height: Int, threshold: Int): DetectionBounds? {
    require(alpha.size == width * height) { "alpha ${alpha.size} does not match ${width}x$height" }

    var left = width
    var top = height
    var right = -1
    var bottom = -1

    for (y in 0 until height) {
        val row = y * width
        for (x in 0 until width) {
            if ((alpha[row + x].toInt() and 0xFF) <= threshold) continue

            if (x < left) left = x
            if (x > right) right = x
            if (y < top) top = y
            if (y > bottom) bottom = y
        }
    }

    if (right < 0) return null

    return DetectionBounds(left = left, top = top, right = right + 1, bottom = bottom + 1)
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests "*SegmentationRecoveryPlanTest*"`
Expected: PASS 14건

- [ ] **Step 5: ktlint를 돌린다**

Run: `./gradlew :data:ktlintCheck`
Expected: 통과. 실패하면 120자 기준으로 줄바꿈한다.

- [ ] **Step 6: 커밋한다**

```bash
git add data/src/main/java/com/teamyg/parfait/data/utils/image/SegmentationRecoveryPlan.kt \
        data/src/test/java/com/teamyg/parfait/data/utils/image/SegmentationRecoveryPlanTest.kt
git commit -m "feat: 세그멘테이션 회복 단계의 좌표와 해상도 계산을 만든다"
```

---

### Task 2: 대비 정규화 LUT

휘도 히스토그램에서 퍼센타일을 잘라 선형 확장 LUT를 만든다. 순수 추가다.

**Files:**
- Create: `data/src/main/java/com/teamyg/parfait/data/utils/image/SegmentationContrast.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/utils/image/SegmentationContrastTest.kt`

**Interfaces:**
- Produces: `LUMINANCE_LEVELS`, `contrastLut(histogram: IntArray): IntArray`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
package com.teamyg.parfait.data.utils.image

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SegmentationContrastTest {
    @Test
    fun contrastLut_emptyHistogram_isIdentity() {
        val lut = contrastLut(IntArray(LUMINANCE_LEVELS))

        assertTrue((0 until LUMINANCE_LEVELS).all { lut[it] == it })
    }

    @Test
    fun contrastLut_everythingOnOneLevel_isIdentity() {
        // Given 단색 이미지 — 절단점이 겹쳐 분모가 0 이 된다
        val histogram = IntArray(LUMINANCE_LEVELS)
        histogram[128] = 10_000

        val lut = contrastLut(histogram)

        assertTrue((0 until LUMINANCE_LEVELS).all { lut[it] == it })
    }

    @Test
    fun contrastLut_narrowBand_stretchesItToTheFullRange() {
        // Given 100..150 에만 고르게 분포한다
        val histogram = IntArray(LUMINANCE_LEVELS)
        for (level in 100..150) histogram[level] = 1_000

        val lut = contrastLut(histogram)

        // Then 대역의 양 끝이 0 과 255 에 가까워진다
        assertTrue(lut[100] <= 16)
        assertTrue(lut[150] >= 239)
    }

    @Test
    fun contrastLut_isMonotonic() {
        val histogram = IntArray(LUMINANCE_LEVELS)
        for (level in 30..220) histogram[level] = level

        val lut = contrastLut(histogram)

        assertTrue((1 until LUMINANCE_LEVELS).all { lut[it] >= lut[it - 1] })
    }

    @Test
    fun contrastLut_clampsOutsideTheBand() {
        val histogram = IntArray(LUMINANCE_LEVELS)
        for (level in 100..150) histogram[level] = 1_000

        val lut = contrastLut(histogram)

        assertEquals(0, lut[0])
        assertEquals(255, lut[LUMINANCE_LEVELS - 1])
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew :data:compileDebugUnitTestKotlin`
Expected: FAIL — `Unresolved reference: contrastLut`

- [ ] **Step 3: 최소 구현을 쓴다**

```kotlin
package com.teamyg.parfait.data.utils.image

import kotlin.math.roundToInt

internal const val LUMINANCE_LEVELS = 256

private const val LOW_PERCENTILE = 0.01f
private const val HIGH_PERCENTILE = 0.99f
private const val MAX_LEVEL = LUMINANCE_LEVELS - 1

/**
 * 퍼센타일 절단 후 선형 확장 LUT.
 *
 * 전역 히스토그램 평활화를 쓰지 않는 것은 그쪽이 계조를 뭉개서 사진이 부자연스러워지기 때문이다.
 * 여기서는 이상치만 자르고 본체는 비율을 유지한다.
 *
 * @return 절단점이 겹치면 항등 LUT
 */
internal fun contrastLut(histogram: IntArray): IntArray {
    require(histogram.size == LUMINANCE_LEVELS) { "histogram must have $LUMINANCE_LEVELS levels" }

    var total = 0L
    for (count in histogram) total += count
    if (total <= 0L) return identityLut()

    val low = levelAtOrAbove(histogram, (total * LOW_PERCENTILE).toLong())
    val high = levelAtOrAbove(histogram, (total * HIGH_PERCENTILE).toLong())
    if (high <= low) return identityLut()

    val span = (high - low).toFloat()

    return IntArray(LUMINANCE_LEVELS) { level ->
        (((level - low) / span) * MAX_LEVEL).roundToInt().coerceIn(0, MAX_LEVEL)
    }
}

private fun levelAtOrAbove(histogram: IntArray, target: Long): Int {
    var accumulated = 0L

    for (level in 0 until LUMINANCE_LEVELS) {
        accumulated += histogram[level]
        if (accumulated >= target) return level
    }

    return MAX_LEVEL
}

private fun identityLut(): IntArray = IntArray(LUMINANCE_LEVELS) { it }
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests "*SegmentationContrastTest*"`
Expected: PASS 5건

- [ ] **Step 5: 커밋한다**

```bash
git add data/src/main/java/com/teamyg/parfait/data/utils/image/SegmentationContrast.kt \
        data/src/test/java/com/teamyg/parfait/data/utils/image/SegmentationContrastTest.kt
git commit -m "feat: 퍼센타일 절단 대비 LUT 를 만든다"
```

---

### Task 3: 마스크 유틸 분해와 알파 재표본

`maskSubjectAlpha`는 `FloatBuffer`를 받아 램프와 후처리를 한 덩어리로 돌아서 되올린 알파를 넣을
입구가 없다. 앞뒤로 쪼개되 **기존 함수는 위임 껍데기로 남겨** 호출부를 안 건드린다.

**Files:**
- Modify: `data/src/main/java/com/teamyg/parfait/data/utils/image/SegmentationMask.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/utils/image/SegmentationMaskTest.kt`

**Interfaces:**
- Consumes: `postProcessAlpha`, `AlphaPostProcessOptions`, `GuidanceProvider`, `MaskedAlpha`
- Produces: `confidenceToAlphaArray(mask, width, height): ByteArray`,
  `postProcessMaskedAlpha(alpha, width, height, options, guidance): MaskedAlpha?`,
  `resampleAlpha(alpha, width, height, targetWidth, targetHeight): ByteArray`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`SegmentationMaskTest.kt`에 아래를 **추가**한다(기존 테스트는 지우지 않는다).

```kotlin
    @Test
    fun confidenceToAlphaArray_mapsEveryPixelThroughTheRamp() {
        // Given 램프 아래·가운데·위
        val mask = FloatBuffer.wrap(floatArrayOf(0.0f, 0.5f, 1.0f, 0.2f))

        val alpha = confidenceToAlphaArray(mask, width = 2, height = 2)

        assertEquals(confidenceToAlpha(0.0f), alpha[0].toInt() and 0xFF)
        assertEquals(confidenceToAlpha(0.5f), alpha[1].toInt() and 0xFF)
        assertEquals(confidenceToAlpha(1.0f), alpha[2].toInt() and 0xFF)
        assertEquals(confidenceToAlpha(0.2f), alpha[3].toInt() and 0xFF)
    }

    @Test
    fun resampleAlpha_sameSize_returnsTheSameValues() {
        val alpha = byteArrayOf(0, 64, 128.toByte(), 255.toByte())

        val resampled = resampleAlpha(alpha, 2, 2, 2, 2)

        assertContentEquals(alpha, resampled)
    }

    @Test
    fun resampleAlpha_upscale_keepsTheCornersAndSizesTheOutput() {
        val alpha = byteArrayOf(0, 255.toByte(), 0, 255.toByte())

        val resampled = resampleAlpha(alpha, 2, 2, 4, 4)

        assertEquals(16, resampled.size)
        assertEquals(0, resampled[0].toInt() and 0xFF)
        assertEquals(255, resampled[3].toInt() and 0xFF)
    }

    @Test
    fun resampleAlpha_downscale_averagesTheBox() {
        // Given 2x2 가 한 칸으로 접힌다
        val alpha = byteArrayOf(0, 100, 100, 200.toByte())

        val resampled = resampleAlpha(alpha, 2, 2, 1, 1)

        assertEquals(1, resampled.size)
        assertEquals(100, resampled[0].toInt() and 0xFF)
    }

    @Test
    fun resampleAlpha_lengthDoesNotMatch_throws() {
        assertFailsWith<IllegalArgumentException> {
            resampleAlpha(ByteArray(3), 2, 2, 2, 2)
        }
    }
```

import에 `kotlin.test.assertContentEquals`를 더한다. `assertFailsWith`·`FloatBuffer`는 이미 있다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew :data:compileDebugUnitTestKotlin`
Expected: FAIL — `Unresolved reference: confidenceToAlphaArray`

- [ ] **Step 3: 최소 구현을 쓴다**

`SegmentationMask.kt`의 `maskSubjectAlpha`를 아래로 바꾸고 나머지를 더한다.

```kotlin
/** 신뢰도를 알파로. 검출 공간에서 돈다 */
internal fun confidenceToAlphaArray(mask: FloatBuffer, width: Int, height: Int): ByteArray {
    val alpha = ByteArray(width * height)
    for (index in alpha.indices) alpha[index] = confidenceToAlpha(mask[index]).toByte()

    return alpha
}

/**
 * 알파 후처리. **원본 공간에서 돈다** — [guidance] 가 원본을 읽기 때문이다.
 *
 * @return 남은 알파가 없으면 `null`
 */
internal suspend fun postProcessMaskedAlpha(
    alpha: ByteArray,
    width: Int,
    height: Int,
    options: AlphaPostProcessOptions = AlphaPostProcessOptions(),
    guidance: GuidanceProvider? = null,
): MaskedAlpha? {
    val result = postProcessAlpha(alpha, width, height, options, guidance = guidance) ?: return null

    return MaskedAlpha(alpha = alpha, result = result)
}

/**
 * 전경 신뢰도 마스크에서 후처리까지 끝낸 알파를 만든다.
 *
 * 검출 공간과 원본 공간이 같을 때만 쓴다. 다르면 두 단계를 직접 불러 사이에 [resampleAlpha] 를 낀다.
 *
 * @param mask 픽셀별 전경 신뢰도. 길이가 `width * height` 여야 한다 — 호출부가 검사한다
 */
internal suspend fun maskSubjectAlpha(
    mask: FloatBuffer,
    width: Int,
    height: Int,
    options: AlphaPostProcessOptions = AlphaPostProcessOptions(),
    guidance: GuidanceProvider? = null,
): MaskedAlpha? = postProcessMaskedAlpha(
    confidenceToAlphaArray(mask, width, height),
    width,
    height,
    options,
    guidance,
)

/**
 * 알파를 다른 치수로 옮긴다. 확대와 축소를 모두 받는다.
 *
 * ⚠️ 확대만 받게 두면 안 된다 — 짧은 변 하한이 걸리거나 크롭이 작으면 되올림이 축소가 된다.
 * 목표 치수가 한 배율에서 나오므로 두 축의 방향은 언제나 같다.
 */
internal fun resampleAlpha(
    alpha: ByteArray,
    width: Int,
    height: Int,
    targetWidth: Int,
    targetHeight: Int,
): ByteArray {
    require(alpha.size == width * height) { "alpha ${alpha.size} does not match ${width}x$height" }
    require(targetWidth > 0 && targetHeight > 0) { "target must be positive" }

    if (targetWidth == width && targetHeight == height) return alpha.copyOf()

    return if (targetWidth < width) {
        boxAverage(alpha, width, height, targetWidth, targetHeight)
    } else {
        bilinear(alpha, width, height, targetWidth, targetHeight)
    }
}

private fun bilinear(
    alpha: ByteArray,
    width: Int,
    height: Int,
    targetWidth: Int,
    targetHeight: Int,
): ByteArray {
    val out = ByteArray(targetWidth * targetHeight)
    val scaleX = if (targetWidth > 1) (width - 1).toFloat() / (targetWidth - 1) else 0f
    val scaleY = if (targetHeight > 1) (height - 1).toFloat() / (targetHeight - 1) else 0f

    for (y in 0 until targetHeight) {
        val sourceY = y * scaleY
        val y0 = sourceY.toInt().coerceIn(0, height - 1)
        val y1 = (y0 + 1).coerceAtMost(height - 1)
        val weightY = sourceY - y0

        for (x in 0 until targetWidth) {
            val sourceX = x * scaleX
            val x0 = sourceX.toInt().coerceIn(0, width - 1)
            val x1 = (x0 + 1).coerceAtMost(width - 1)
            val weightX = sourceX - x0

            val topRow = lerp(at(alpha, width, x0, y0), at(alpha, width, x1, y0), weightX)
            val bottomRow = lerp(at(alpha, width, x0, y1), at(alpha, width, x1, y1), weightX)

            out[y * targetWidth + x] = lerp(topRow, bottomRow, weightY).toInt().toByte()
        }
    }

    return out
}

private fun boxAverage(
    alpha: ByteArray,
    width: Int,
    height: Int,
    targetWidth: Int,
    targetHeight: Int,
): ByteArray {
    val out = ByteArray(targetWidth * targetHeight)

    for (y in 0 until targetHeight) {
        val startY = y * height / targetHeight
        val endY = maxOf(startY + 1, (y + 1) * height / targetHeight)

        for (x in 0 until targetWidth) {
            val startX = x * width / targetWidth
            val endX = maxOf(startX + 1, (x + 1) * width / targetWidth)

            var sum = 0
            var count = 0
            for (sourceY in startY until endY) {
                for (sourceX in startX until endX) {
                    sum += at(alpha, width, sourceX, sourceY)
                    count++
                }
            }

            out[y * targetWidth + x] = (sum / count).toByte()
        }
    }

    return out
}

private fun at(alpha: ByteArray, width: Int, x: Int, y: Int): Int = alpha[y * width + x].toInt() and 0xFF

private fun lerp(from: Int, to: Int, weight: Float): Float = from + (to - from) * weight
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests "*SegmentationMaskTest*"`
Expected: PASS. 기존 테스트가 전부 그대로 통과해야 한다 — 위임 껍데기가 동작을 안 바꿨다는 증거다.

- [ ] **Step 5: 커밋한다**

```bash
git add data/src/main/java/com/teamyg/parfait/data/utils/image/SegmentationMask.kt \
        data/src/test/java/com/teamyg/parfait/data/utils/image/SegmentationMaskTest.kt
git commit -m "refactor: 마스크 유틸을 램프와 후처리로 쪼개고 알파 재표본을 더한다"
```

---

### Task 4: 회복 경로용 완화 필터

후보의 캔버스 치수가 언제나 원본이라 면적 하한도 원본 기준이다. 그러면 2단계가 크롭 안에서 찾은
작은 피사체가 그대로 걸러진다. **회복 경로에만** 낮은 하한을 쓸 수 있게 인자를 연다.

**Files:**
- Modify: `domain/src/main/java/com/teamyg/parfait/domain/model/SubjectCoverage.kt`
- Modify: `data/src/main/java/com/teamyg/parfait/data/utils/image/SegmentationCandidateFilter.kt`
- Test: `domain/src/test/java/com/teamyg/parfait/domain/model/SubjectCoverageTest.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/utils/image/SegmentationCandidateFilterTest.kt`

**Interfaces:**
- Produces: `SubjectCoverage.RECOVERY_FLOOR_DIVISOR`,
  `SubjectCoverage.floorPixels(canvasArea, divisor = 1)`,
  `SubjectCoverage.isLargeEnough(alphaSum, canvasArea, divisor = 1)`,
  `filterCandidates(candidates, floorDivisor = 1)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`SubjectCoverageTest.kt`에 추가:

```kotlin
    @Test
    fun floorPixels_recoveryDivisor_lowersTheFloor() {
        // Given 비율 하한이 이기는 큰 캔버스
        val strict = SubjectCoverage.floorPixels(BIG_CANVAS_AREA)
        val relaxed = SubjectCoverage.floorPixels(BIG_CANVAS_AREA, SubjectCoverage.RECOVERY_FLOOR_DIVISOR)

        // Then 회복 하한은 1차의 1/4 이다
        assertEquals(strict / SubjectCoverage.RECOVERY_FLOOR_DIVISOR, relaxed)
    }

    @Test
    fun isLargeEnough_belowTheStrictFloorButAboveTheRelaxedOne_splitsOnTheDivisor() {
        // Given 엄격한 하한에는 못 미치고 완화 하한은 넘는 커버리지
        val alphaSum = 255L * 2_000L

        assertFalse(SubjectCoverage.isLargeEnough(alphaSum, BIG_CANVAS_AREA))
        assertTrue(
            SubjectCoverage.isLargeEnough(alphaSum, BIG_CANVAS_AREA, SubjectCoverage.RECOVERY_FLOOR_DIVISOR),
        )
    }
```

`SegmentationCandidateFilterTest.kt`에 추가:

```kotlin
    @Test
    fun filterCandidates_recoveryDivisor_keepsWhatTheStrictFloorDrops() {
        // Given 1차 하한 미만, 회복 하한 초과인 후보 하나
        val small = candidate(
            width = 100,
            height = 100,
            canvasWidth = 4_000,
            canvasHeight = 3_000,
            coverageAlphaSum = 255L * 2_000,
        )

        // Then 기본 하한은 버리고 완화 하한은 남긴다
        assertEquals(emptyList(), filterCandidates(listOf(small)))
        assertEquals(listOf(small), filterCandidates(listOf(small), SubjectCoverage.RECOVERY_FLOOR_DIVISOR))
    }
```

`SegmentationCandidateFilterTest.kt`의 import에 `com.teamyg.parfait.domain.model.SubjectCoverage`를 더한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew :domain:compileTestKotlin :data:compileDebugUnitTestKotlin`
Expected: FAIL — `Unresolved reference: RECOVERY_FLOOR_DIVISOR`

- [ ] **Step 3: 최소 구현을 쓴다**

`SubjectCoverage.kt`의 두 함수에 인자를 더한다. **기본값이 1이라 기존 호출부는 안 바뀐다.**
하한 식 자체는 바꾸지 않고 나누는 것만 더한다.

```kotlin
    /** 회복 경로가 쓰는 완화 배수. 크롭 안에서 찾은 작은 피사체가 원본 면적 하한에 죽는 것을 막는다 */
    const val RECOVERY_FLOOR_DIVISOR = 4

    fun floorPixels(
        canvasArea: Long,
        divisor: Int = 1,
    ): Long {
        require(divisor >= 1) { "divisor must be >= 1 but was $divisor" }

        return maxOf(MIN_COVERAGE_PIXELS, canvasArea * MIN_COVERAGE_PERMYRIAD / PERMYRIAD_BASE) / divisor
    }

    /**
     * @param alphaSum 알파의 총합. [MAX_ALPHA] 로 나누면 실제로 칠해진 픽셀 수가 된다
     */
    fun isLargeEnough(
        alphaSum: Long,
        canvasArea: Long,
        divisor: Int = 1,
    ): Boolean {
        if (canvasArea <= 0L) return false

        // 양변에 255를 곱해 부동소수를 거치지 않는다
        return alphaSum >= MAX_ALPHA * floorPixels(canvasArea, divisor)
    }
```

`SegmentationCandidateFilter.kt`의 `filterCandidates`와 private 확장 함수를 바꾼다.

```kotlin
internal fun filterCandidates(
    candidates: List<SegmentationCandidate>,
    floorDivisor: Int = 1,
): List<SegmentationCandidate> = candidates
    .filter { it.isLargeEnough(floorDivisor) }
    .sortedWith(candidateOrder)
    .dropNearDuplicates()
    .take(MAX_SUBJECT_COUNT)

private fun SegmentationCandidate.isLargeEnough(floorDivisor: Int): Boolean = SubjectCoverage.isLargeEnough(
    alphaSum = coverageAlphaSum,
    canvasArea = canvasWidth.toLong() * canvasHeight,
    divisor = floorDivisor,
)
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew :domain:test :data:testDebugUnitTest --tests "*SubjectCoverageTest*" --tests "*SegmentationCandidateFilterTest*"`
Expected: PASS. **기존 테스트가 하나도 안 깨져야 한다** — 기본값이 1차 동작을 지킨다는 증거다.

- [ ] **Step 5: 커밋한다**

```bash
git add domain/src/main/java/com/teamyg/parfait/domain/model/SubjectCoverage.kt \
        domain/src/test/java/com/teamyg/parfait/domain/model/SubjectCoverageTest.kt \
        data/src/main/java/com/teamyg/parfait/data/utils/image/SegmentationCandidateFilter.kt \
        data/src/test/java/com/teamyg/parfait/data/utils/image/SegmentationCandidateFilterTest.kt
git commit -m "feat: 회복 경로가 쓸 완화 면적 하한을 연다"
```

---

### Task 5: 후보 수확 분리와 `Subject` 의존 제거

수확 함수를 별도 파일로 옮기면서 ML Kit `Subject` 의존을 걷어내고, 마스크 치수와 출력 치수를 가른다.
**이 Task는 쪼갤 수 없다** — 수확 함수를 옮기는 순간 저장소 구현이 깨지고, 이 Task 끝에서 다시
컴파일된다.

**Files:**
- Create: `data/src/main/java/com/teamyg/parfait/data/utils/image/SegmentationCandidateHarvest.kt`
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/image/ImageSegmentationRepositoryImpl.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/utils/image/SegmentationCandidateHarvestTest.kt`

**Interfaces:**
- Consumes: Task 1의 `DetectionBounds`·`RecoveryTransform`, Task 3의 `postProcessMaskedAlpha`
- Produces:
  - `internal class CandidatePair(val original, val postProcessed)`
  - `internal const val MAX_POST_PROCESS_CANDIDATES`
  - `internal fun requireInsideCanvas(bounds: SegmentationBounds, canvasWidth: Int, canvasHeight: Int)`
  - `internal suspend fun harvestCandidate(platePixels, plateAlpha, plateWidth, plateHeight, originOffset, origin): CandidatePair`
  - `internal class ForegroundHarvest(val candidates: List<SegmentationCandidate>, val hint: DetectionBounds?)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

비트맵이 필요 없는 판정만 덮는다.

```kotlin
package com.teamyg.parfait.data.utils.image

import com.teamyg.parfait.domain.model.SegmentationBounds
import kotlin.test.Test
import kotlin.test.assertFailsWith

class SegmentationCandidateHarvestTest {
    @Test
    fun requireInsideCanvas_boundsFitExactly_passes() {
        requireInsideCanvas(SegmentationBounds(0, 0, 100, 50), canvasWidth = 100, canvasHeight = 50)
    }

    @Test
    fun requireInsideCanvas_rightExceedsTheCanvas_throws() {
        // Given 되올림 반올림이 오른쪽으로 1px 넘긴 사각형.
        // 이게 통과하면 persistSubject 의 drawBitmap 이 말없이 자른다
        assertFailsWith<IllegalArgumentException> {
            requireInsideCanvas(SegmentationBounds(0, 0, 101, 50), canvasWidth = 100, canvasHeight = 50)
        }
    }

    @Test
    fun requireInsideCanvas_bottomExceedsTheCanvas_throws() {
        assertFailsWith<IllegalArgumentException> {
            requireInsideCanvas(SegmentationBounds(0, 0, 100, 51), canvasWidth = 100, canvasHeight = 50)
        }
    }

    @Test
    fun requireInsideCanvas_negativeOrigin_throws() {
        assertFailsWith<IllegalArgumentException> {
            requireInsideCanvas(SegmentationBounds(-1, 0, 100, 50), canvasWidth = 100, canvasHeight = 50)
        }
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew :data:compileDebugUnitTestKotlin`
Expected: FAIL — `Unresolved reference: requireInsideCanvas`

- [ ] **Step 3: 수확 파일을 만든다**

`ImageSegmentationRepositoryImpl.kt`에서 `CandidatePair`, `maxPostProcessCandidates`,
`toCandidatePairs`, `buildCandidatePair`, `postProcess`, `originalCandidate`, `toForegroundCandidate`를
**잘라내어** 새 파일로 옮긴다. 옮기면서 셋을 바꾼다.

```kotlin
package com.teamyg.parfait.data.utils.image

import android.graphics.Bitmap
import com.teamyg.parfait.core.util.android.extension.toAndroidBitmap
import com.teamyg.parfait.core.util.jvm.extension.sumArgbAlpha
import com.teamyg.parfait.data.utils.repositoryLogger
import com.teamyg.parfait.domain.model.SegmentationBounds
import com.teamyg.parfait.domain.model.SegmentationCandidate
import kotlinx.coroutines.CancellationException

/** 후처리를 태울 후보 수 상한. 후처리는 `filterCandidates` 의 상한 절단 앞에 있다 */
internal const val MAX_POST_PROCESS_CANDIDATES = MAX_SUBJECT_COUNT + 3

/**
 * 후처리 전후 후보를 짝지어 들고 다닌다. 후처리가 실패하거나 알파를 전멸시킨 후보를 **개별로**
 * 되돌리기 위해서다.
 */
internal class CandidatePair(
    val original: SegmentationCandidate,
    val postProcessed: SegmentationCandidate?,
)

/** 전경 폴백의 결과. [hint] 는 다음 단계가 어디를 크롭할지 정하는 데만 쓴다 */
internal class ForegroundHarvest(
    val candidates: List<SegmentationCandidate>,
    val hint: DetectionBounds?,
)

/**
 * 사각형이 캔버스 안에 있는지 본다.
 *
 * ⚠️ 판 치수와 사각형 치수가 같은지 보는 검사는 사각형을 판에서 만들기 때문에 사실상 항진명제다.
 * 회복 경로가 실제로 깨뜨릴 수 있는 것은 이쪽이고, 깨지면 예외가 아니라 저장 시점의 조용한
 * 클리핑으로 나온다.
 */
internal fun requireInsideCanvas(bounds: SegmentationBounds, canvasWidth: Int, canvasHeight: Int) {
    require(
        bounds.left >= 0 &&
            bounds.top >= 0 &&
            bounds.right <= canvasWidth &&
            bounds.bottom <= canvasHeight,
    ) {
        "bounds $bounds escapes canvas ${canvasWidth}x$canvasHeight"
    }
}

/**
 * 후보 하나를 만든다.
 *
 * ⚠️ ML Kit `Subject` 를 받지 않는다. 그 클래스는 final 이라 원본 좌표를 담은 인스턴스를 만들 수
 * 없어서, 회복 경로가 같은 코드를 쓰려면 좌표를 직접 받아야 한다.
 *
 * @param platePixels 판의 ARGB. 어느 판에서 읽을지는 호출부가 정한다 — 회복 경로는 원본에서 읽는다
 * @param originOffset 판이 원본에서 차지하는 자리. 치수가 판과 같아야 한다
 */
internal suspend fun harvestCandidate(
    platePixels: IntArray,
    plateAlpha: ByteArray,
    plateWidth: Int,
    plateHeight: Int,
    originOffset: SegmentationBounds,
    origin: Bitmap,
): CandidatePair {
    require(originOffset.width == plateWidth && originOffset.height == plateHeight) {
        "offset $originOffset does not match plate ${plateWidth}x$plateHeight"
    }
    requireInsideCanvas(originOffset, origin.width, origin.height)

    // 기존 buildCandidatePair 의 본문을 옮긴다. OutOfMemoryError·CancellationException·Exception
    // 세 갈래를 그대로 유지한다
}
```

> 구현 지시: 기존 `postProcess`와 `originalCandidate`의 본문을 이 파일로 옮기되,
> `subject.startX`·`subject.startY`를 전부 `originOffset.left`·`originOffset.top`으로 바꾼다.
> `bitmap.getPixels(...)`로 판을 읽던 자리는 인자로 받은 `platePixels`를 쓴다.
> `guidance` 콜백의 `origin.getPixels(..., subject.startX + bounds.left, ...)`도 같은 방식으로 바꾼다.
> 후보를 만들 때마다 `requireInsideCanvas`를 부른다.

`toForegroundCandidate`를 옮길 때는 **마스크 치수와 출력 치수를 별도 인자로 가른다.**

```kotlin
/**
 * 전경 신뢰도에서 후보 하나와 힌트를 만든다.
 *
 * ⚠️ 마스크 치수와 출력 치수가 다를 수 있다 — 회복 경로의 마스크는 검출 판 치수다. 하나로 묶으면
 * 그 경로에서 길이 검사가 언제나 실패해 예외도 로그도 없이 빈 목록이 된다.
 */
internal suspend fun harvestForeground(
    mask: java.nio.FloatBuffer,
    maskWidth: Int,
    maskHeight: Int,
    originOffset: SegmentationBounds,
    origin: Bitmap,
    hintThreshold: Int,
): ForegroundHarvest {
    if (mask.remaining() != maskWidth * maskHeight) return ForegroundHarvest(emptyList(), hint = null)

    val detectionAlpha = confidenceToAlphaArray(mask, maskWidth, maskHeight)
    val hint = hintBounds(detectionAlpha, maskWidth, maskHeight, hintThreshold)

    val originAlpha = resampleAlpha(
        detectionAlpha,
        maskWidth,
        maskHeight,
        originOffset.width,
        originOffset.height,
    )

    // 이후는 기존 toForegroundCandidate 본문 — postProcessMaskedAlpha 를 원본 공간 치수로 부르고,
    // 살아남은 영역만 origin 에서 읽어 판을 만든다. 만든 사각형에 requireInsideCanvas 를 건다.
    // 힌트는 후보가 안 나와도 돌려준다 — 다음 단계가 그것으로 크롭한다
}
```

- [ ] **Step 4: 저장소 구현을 새 함수에 결선한다**

`ImageSegmentationRepositoryImpl.kt`에서:

- 옮긴 함수 정의를 지운다.
- `segmentImage`의 다중 subject 갈래가 subject마다 `subject.bitmap.getPixels(...)`로 `platePixels`를,
  알파 채널로 `plateAlpha`를 만들어 `harvestCandidate`에 넘기게 바꾼다. `originOffset`은
  `SegmentationBounds(subject.startX, subject.startY, subject.startX + w, subject.startY + h)`다.
- `segmentForeground`가 `harvestForeground`를 부르고 **`Result`를 위로 올리게** 바꾼다.
  `runSegmenter(...).getOrNull() ?: return emptyList()`를 `getOrElse { return Result.failure(it) }`로
  바꾼다. 이게 없으면 `ModuleNotReady` 즉시 중단이 이 갈래에서 안 돈다.
- `MAX_POST_PROCESS_CANDIDATES`를 쓰도록 상수 참조를 고친다.

**폴백 후보는 지금처럼 `filterCandidates`를 거치지 않는다.** 1차 경로의 규칙을 바꾸지 않는다.

- [ ] **Step 5: 모듈 전체 유닛을 돌린다**

Run: `./gradlew :data:testDebugUnitTest`
Expected: PASS. **기존 테스트가 하나도 안 깨져야 한다** — 이 Task는 동작을 안 바꾸는 이동이다.

- [ ] **Step 6: 앱이 빌드되는지 확인한다**

Run: `./gradlew :app:assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 7: 커밋한다**

```bash
git add data/src/main/java/com/teamyg/parfait/data/utils/image/SegmentationCandidateHarvest.kt \
        data/src/main/java/com/teamyg/parfait/data/repository/image/ImageSegmentationRepositoryImpl.kt \
        data/src/test/java/com/teamyg/parfait/data/utils/image/SegmentationCandidateHarvestTest.kt
git commit -m "refactor: 후보 수확을 떼어 내고 ML Kit Subject 의존을 걷는다"
```

---

### Task 6: 회복 경로 조합

정규화 실행기와 `recoverCandidates`를 만든다. 실행기는 비트맵을 만지므로 유닛으로 덮지 않는다 —
판단은 Task 1·2가 이미 덮었고, 여기서는 회귀가 없는지만 본다.

**Files:**
- Create: `data/src/main/java/com/teamyg/parfait/data/utils/image/SegmentationRecoveryNormalizer.kt`
- Modify: `domain/src/main/java/com/teamyg/parfait/domain/repository/image/ImageSegmentationRepository.kt`
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/image/ImageSegmentationRepositoryImpl.kt`
- Create: `domain/src/main/java/com/teamyg/parfait/domain/usecase/image/RecoverCandidatesUseCase.kt`

**Interfaces:**
- Consumes: Task 1~5 전부
- Produces: `ImageSegmentationRepository.recoverCandidates`, `RecoverCandidatesUseCase`

- [ ] **Step 1: 정규화 실행기를 만든다**

```kotlin
package com.teamyg.parfait.data.utils.image

import android.graphics.Bitmap
import android.graphics.Color

/**
 * 계획을 비트맵에 적용한다.
 *
 * 순서가 중요하다 — **축소를 먼저** 하고, 축소판에서 히스토그램을 모으고, 축소판에 LUT 를 건다.
 * 원본에서 히스토그램을 모으면 그 픽셀 배열 하나가 판 하나만큼 크다.
 *
 * LUT 적용이 픽셀 루프인 것은 `minSdk` 가 26 이라 `RenderEffect` 를 못 쓰고, 임의 LUT 가
 * `ColorMatrixColorFilter` 로 표현되지 않기 때문이다.
 */
internal fun normalizeForDetection(origin: Bitmap, stage: RecoveryStage): Bitmap {
    val cropped = stage.cropRect?.let { rect ->
        Bitmap.createBitmap(origin, rect.left, rect.top, rect.width, rect.height)
    } ?: origin

    val scaled = if (cropped.width == stage.targetSize.width && cropped.height == stage.targetSize.height) {
        cropped
    } else {
        Bitmap.createScaledBitmap(cropped, stage.targetSize.width, stage.targetSize.height, true)
    }

    // 크롭 판은 축소가 끝나면 볼 일이 없다. 원본과 같은 인스턴스면 남의 것이라 건드리지 않는다
    if (cropped !== origin && cropped !== scaled) cropped.recycle()

    if (!stage.applyContrast) return scaled

    return applyContrast(scaled)
}

private fun applyContrast(bitmap: Bitmap): Bitmap {
    val width = bitmap.width
    val height = bitmap.height
    val row = IntArray(width)
    val histogram = IntArray(LUMINANCE_LEVELS)

    for (y in 0 until height) {
        bitmap.getPixels(row, 0, width, 0, y, width, 1)
        for (pixel in row) histogram[luminanceOf(pixel)]++
    }

    val lut = contrastLut(histogram)

    // 판을 새로 만들지 않고 되쓴다. createScaledBitmap 이 준 판이라 우리 것이다
    for (y in 0 until height) {
        bitmap.getPixels(row, 0, width, 0, y, width, 1)
        for (index in row.indices) row[index] = mapThroughLut(row[index], lut)
        bitmap.setPixels(row, 0, width, 0, y, width, 1)
    }

    return bitmap
}

private fun luminanceOf(pixel: Int): Int {
    val red = Color.red(pixel)
    val green = Color.green(pixel)
    val blue = Color.blue(pixel)

    return ((red * 299 + green * 587 + blue * 114) / 1000).coerceIn(0, LUMINANCE_LEVELS - 1)
}

private fun mapThroughLut(pixel: Int, lut: IntArray): Int = Color.argb(
    Color.alpha(pixel),
    lut[Color.red(pixel)],
    lut[Color.green(pixel)],
    lut[Color.blue(pixel)],
)
```

> ⚠️ `Bitmap.createScaledBitmap`이 입력과 같은 인스턴스를 돌려줄 수 있으므로, 회수 전에
> `!==` 로 확인한다. `applyContrast`가 되쓰는 판이 원본일 수 있는 경우는 없다 —
> `normalizeStage`가 무동작이면 널이라 이 함수까지 오지 않는다.

- [ ] **Step 2: 저장소 계약을 넓힌다**

`ImageSegmentationRepository.kt`:

```kotlin
    /**
     * [segmentImage] 가 후보를 하나도 못 낸 뒤에만 부른다. 입력을 손봐 가며 다시 찾는다.
     *
     * 후보의 픽셀은 언제나 [bitmapWrapper] 에서 오려낸다 — 손본 판은 검출에만 쓴다.
     */
    suspend fun recoverCandidates(bitmapWrapper: BitmapWrapper): Result<List<SegmentationCandidate>>
```

- [ ] **Step 3: 구현을 쓴다**

`ImageSegmentationRepositoryImpl.kt`에 더한다.

```kotlin
    override suspend fun recoverCandidates(bitmapWrapper: BitmapWrapper): Result<List<SegmentationCandidate>> {
        val origin = (bitmapWrapper as? AndroidBitmap)?.getRawData()
            ?: return Result.failure(SegmentationException.ImageNotFound(null))

        return withTimeoutOrNull(RECOVERY_TIMEOUT_MS) {
            runRecoveryLadder(origin)
        } ?: run {
            repositoryLogger.w { "회복: 대기 상한 ${RECOVERY_TIMEOUT_MS}ms 를 넘겨 접는다" }
            Result.success(emptyList())
        }
    }

    private suspend fun runRecoveryLadder(origin: Bitmap): Result<List<SegmentationCandidate>> {
        val options = AlphaPostProcessOptions()

        // 1단계 — 목표 치수가 원본과 같고 대비도 안 걸면 1차 재실행일 뿐이라 널이다
        val normalize = normalizeStage(origin.width, origin.height, applyContrast = true)
        var hint: DetectionBounds? = null
        var hintTransform: RecoveryTransform? = null

        if (normalize != null) {
            when (val outcome = runStage(origin, normalize, options)) {
                is StageOutcome.Found -> return Result.success(outcome.candidates)
                is StageOutcome.Aborted -> return Result.failure(outcome.cause)
                is StageOutcome.Empty -> {
                    hint = outcome.hint
                    hintTransform = normalize.transform
                }
            }
        }

        // 2단계 — 크롭이 충분히 안 줄면 널이다
        val focus = focusStage(origin.width, origin.height, hint, hintTransform, applyContrast = true)
            ?: return Result.success(emptyList())

        return when (val outcome = runStage(origin, focus, options)) {
            is StageOutcome.Found -> Result.success(outcome.candidates)
            is StageOutcome.Aborted -> Result.failure(outcome.cause)
            is StageOutcome.Empty -> Result.success(emptyList())
        }
    }
```

> 구현 지시 — `runStage(origin, stage, options)`는 이렇게 한다.
>
> 1. `normalizeForDetection(origin, stage)`로 검출 판을 만든다.
> 2. 다중 subject 옵션으로 `runSegmenter`를 부른다. `ModuleNotReady`면 `StageOutcome.Aborted`다.
> 3. subject마다 검출 좌표 사각형을 만들어 `stage.transform.toOrigin(...)`으로 원본 좌표로 옮기고,
>    **크롭 사각형과 원본의 교집합**으로 자른다. 원본 경계만으로 자르면 크롭 밖으로 새는 사각형이 생긴다.
> 4. `subject.bitmap`의 알파를 뽑아 `resampleAlpha`로 그 원본 사각형 크기로 옮기고,
>    `origin.getPixels(...)`로 판 픽셀을 읽어 `harvestCandidate`를 부른다.
> 5. `MAX_POST_PROCESS_CANDIDATES`로 자른 뒤
>    `filterCandidates(candidates, SubjectCoverage.RECOVERY_FLOOR_DIVISOR)`를 건다.
>    **완화 전 후보 수와 완화 후 후보 수를 로그로 갈라 남긴다.**
> 6. 비면 전경 옵션으로 `runSegmenter`를 한 번 더 부르고 `harvestForeground`에 넘긴다.
>    임계는 `options.binaryThreshold`다. 폴백 후보는 필터를 거치지 않는다.
> 7. **검출 판을 회수하고 힌트 사각형만 남긴 채** 결과를 돌려준다. 1단계 결과를 2단계까지 들고
>    있으면 피크가 커지고, 네이티브 버퍼 수명 가정에도 기댄다.
> 8. 단계마다 한 줄을 남긴다 — 단계 이름, 가드에 걸렸는지, 목표 치수와 상한이 걸렸는지,
>    크롭이 원본 대비 얼마인지, 힌트 유무, 완화 전후 후보 수, 소요.

`StageOutcome`은 이 파일의 private sealed interface다.

```kotlin
    private sealed interface StageOutcome {
        class Found(val candidates: List<SegmentationCandidate>) : StageOutcome

        /** 다음 단계가 쓸 힌트. 후보가 없어도 힌트는 있을 수 있다 */
        class Empty(val hint: DetectionBounds?) : StageOutcome

        /** 남은 단계도 같은 이유로 실패한다 */
        class Aborted(val cause: Throwable) : StageOutcome
    }
```

`RECOVERY_TIMEOUT_MS`는 파일 아래 `private const val RECOVERY_TIMEOUT_MS = 30_000L`이다.

- [ ] **Step 4: UseCase를 만든다**

```kotlin
package com.teamyg.parfait.domain.usecase.image

import com.teamyg.parfait.core.util.jvm.model.BitmapWrapper
import com.teamyg.parfait.domain.model.SegmentationCandidate
import com.teamyg.parfait.domain.model.useCaseLogger
import com.teamyg.parfait.domain.repository.image.ImageSegmentationRepository
import javax.inject.Inject

class RecoverCandidatesUseCase
@Inject
constructor(
    private val repository: ImageSegmentationRepository,
) {
    init {
        useCaseLogger.i { "RecoverCandidatesUseCase::init" }
    }

    suspend operator fun invoke(bitmapWrapper: BitmapWrapper): Result<List<SegmentationCandidate>> =
        repository.recoverCandidates(bitmapWrapper)
}
```

- [ ] **Step 5: 전체 유닛과 빌드를 확인한다**

Run: `./gradlew :domain:test :data:testDebugUnitTest :app:assembleDebug`
Expected: 전부 통과. 기존 테스트가 안 깨져야 한다.

- [ ] **Step 6: 커밋한다**

```bash
git add data/src/main/java/com/teamyg/parfait/data/utils/image/SegmentationRecoveryNormalizer.kt \
        data/src/main/java/com/teamyg/parfait/data/repository/image/ImageSegmentationRepositoryImpl.kt \
        domain/src/main/java/com/teamyg/parfait/domain/repository/image/ImageSegmentationRepository.kt \
        domain/src/main/java/com/teamyg/parfait/domain/usecase/image/RecoverCandidatesUseCase.kt
git commit -m "feat: 재시도 회복 사다리를 저장소에 넣는다"
```

---

### Task 7: ViewModel 3치 분기와 취소

**Files:**
- Modify: `core/ui/src/main/java/com/teamyg/parfait/core/ui/BaseViewModel.kt`
- Modify: `feature/segmentation/impl/src/main/java/com/teamyg/parfait/feature/segmentation/impl/viewmodel/SegmentationViewModel.kt`
- Test: `core/ui/src/test/java/com/teamyg/parfait/core/ui/BaseViewModelTest.kt`
- Test: `feature/segmentation/impl/src/test/java/com/teamyg/parfait/feature/segmentation/impl/viewmodel/SegmentationViewModelTest.kt`

**Interfaces:**
- Consumes: `RecoverCandidatesUseCase`
- Produces: `BaseViewModel.cancel(key: Any)` — 지금 `runningJobs`가 `private`이라 키로 잡을 끊을 표면이 없다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

먼저 `BaseViewModelTest.kt`에 취소 표면 테스트를 더한다. 파일의 `TestViewModel`에
`fun stop(key: Any) = cancel(key)`를 더하고 아래를 추가한다.

```kotlin
    @Test
    fun cancel_runningKey_stopsTheJobAndFreesTheKey() = runTest {
        val viewModel = TestViewModel()
        var finished = false
        viewModel.run(key = "k") {
            awaitCancellation()
        }
        runCurrent()

        // When
        viewModel.stop("k")
        runCurrent()

        // Then 같은 키로 새 잡이 다시 뜬다 — 키가 풀렸다는 증거다
        assertNotNull(viewModel.run(key = "k") { finished = true })
        advanceUntilIdle()
        assertEquals(true, finished)
    }

    @Test
    fun cancel_unknownKey_doesNothing() = runTest {
        TestViewModel().stop("missing")
    }
```

그다음 `SegmentationViewModelTest.kt`에 `private val recoverCandidates: RecoverCandidatesUseCase = mockk()`를
필드로 더하고, `viewModel()` 헬퍼에 `recoverCandidatesUseCase = recoverCandidates,`를 넘긴 뒤 아래를 추가한다.

```kotlin
    @Test
    fun retry_afterEmptyCandidates_runsTheRecoveryLadder() = runTest {
        // Given 1차가 빈 목록으로 끝났다
        coEvery { segmentImage(any()) } returns Result.success(emptyList())
        coEvery { recoverCandidates(any()) } returns Result.success(listOf(candidate))
        val viewModel = viewModel()
        advanceUntilIdle()

        // When
        viewModel.processIntent(SegmentationIntent.Retry)
        advanceUntilIdle()

        // Then 1차를 다시 돌지 않는다
        coVerify(exactly = 1) { segmentImage(any()) }
        coVerify(exactly = 1) { recoverCandidates(any()) }
        assertFalse(viewModel.state.value.isError)
    }

    @Test
    fun retry_afterAnException_takesTheOriginalPathAgain() = runTest {
        coEvery { segmentImage(any()) } returns Result.failure(SegmentationException.ModuleNotReady(null))
        val viewModel = viewModel()
        advanceUntilIdle()

        viewModel.processIntent(SegmentationIntent.Retry)
        advanceUntilIdle()

        coVerify(exactly = 2) { segmentImage(any()) }
        coVerify(exactly = 0) { recoverCandidates(any()) }
    }

    @Test
    fun retry_afterTheRecoveryAlsoFailed_fallsBackToTheOriginalPath() = runTest {
        // Given 1차도 회복도 빈 목록이다
        coEvery { segmentImage(any()) } returns Result.success(emptyList())
        coEvery { recoverCandidates(any()) } returns Result.success(emptyList())
        val viewModel = viewModel()
        advanceUntilIdle()

        // When 두 번 누른다
        viewModel.processIntent(SegmentationIntent.Retry)
        advanceUntilIdle()
        viewModel.processIntent(SegmentationIntent.Retry)
        advanceUntilIdle()

        // Then 두 번째는 사다리를 또 돌지 않는다
        coVerify(exactly = 1) { recoverCandidates(any()) }
        coVerify(exactly = 2) { segmentImage(any()) }
    }

    @Test
    fun retry_whileTheRecoveryRuns_clearsTheErrorAndShowsLoading() = runTest {
        coEvery { segmentImage(any()) } returns Result.success(emptyList())
        coEvery { recoverCandidates(any()) } coAnswers {
            delay(1_000)
            Result.success(listOf(candidate))
        }
        val viewModel = viewModel()
        advanceUntilIdle()
        assertTrue(viewModel.state.value.isError)

        viewModel.processIntent(SegmentationIntent.Retry)
        runCurrent()

        // 에러 화면 위에 로딩 덮개가 겹치는 조합을 막는다
        assertFalse(viewModel.state.value.isError)
        assertTrue(viewModel.state.value.isLoading)
    }

    @Test
    fun useOriginal_whileTheRecoveryRuns_cancelsTheLadder() = runTest {
        coEvery { segmentImage(any()) } returns Result.success(emptyList())
        var ladderFinished = false
        coEvery { recoverCandidates(any()) } coAnswers {
            delay(10_000)
            ladderFinished = true
            Result.success(emptyList())
        }
        val viewModel = viewModel()
        advanceUntilIdle()
        viewModel.processIntent(SegmentationIntent.Retry)
        runCurrent()

        // When 기다리다 「편집 없이 사용」을 누른다
        viewModel.processIntent(SegmentationIntent.UseOriginal)
        advanceUntilIdle()

        // Then 사다리가 끝까지 돌지 않는다
        assertFalse(ladderFinished)
    }
```

`candidate`·`bitmapWrapper`는 기존 파일의 필드다. `saveBitmap`은 `@Before`가 이미 스텁한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew :core:ui:compileDebugUnitTestKotlin :feature:segmentation:impl:compileDebugUnitTestKotlin`
Expected: FAIL — `cancel`이 없고 `recoverCandidatesUseCase` 인자가 없다

- [ ] **Step 3: ViewModel을 고친다**

```kotlin
    /**
     * 직전 실패의 성격. 재시도가 무엇을 돌지만 정하므로 상태로 올리지 않는다 — 화면은 이 값을 안 쓴다.
     */
    private enum class LastFailure { EXCEPTION, EMPTY_BEFORE_RECOVERY, EMPTY_AFTER_RECOVERY }

    private var lastFailure: LastFailure? = null
```

`loadCandidates`의 실패 자리에서 `lastFailure`를 채운다. 예외면 `EXCEPTION`, 빈 목록이면
`EMPTY_BEFORE_RECOVERY`다.

`processIntent`의 `Retry`를 바꾼다.

```kotlin
            SegmentationIntent.Retry ->
                if (lastFailure == LastFailure.EMPTY_BEFORE_RECOVERY) recover() else loadCandidates()
```

`recover()`를 더한다.

```kotlin
    /**
     * ⚠️ [LOAD_CANDIDATES_KEY] 를 진입·재시도와 공유한다. 다른 키를 쓰면 연타가 사다리를 겹쳐 돈다.
     */
    private fun recover() {
        val bitmapWrapper = originBitmapWrapper ?: return loadCandidates()

        launch(
            key = LOAD_CANDIDATES_KEY,
            onError = {
                lastFailure = LastFailure.EMPTY_AFTER_RECOVERY
                updateState { copy(isLoading = false, isError = true) }
            },
        ) {
            // 에러 표시를 안 걷으면 실패 화면 위에 로딩 덮개가 겹친다
            updateState { copy(isLoading = true, isError = false, candidates = emptyList()) }

            recoverCandidatesUseCase(bitmapWrapper)
                .onSuccess { candidates ->
                    if (candidates.isEmpty()) {
                        lastFailure = LastFailure.EMPTY_AFTER_RECOVERY
                        updateState { copy(isError = true) }
                    } else {
                        lastFailure = null
                        updateState { copy(candidates = candidates) }
                    }
                }.onFailure { throwable ->
                    viewModelLogger.e(throwable) { "회복 실패 ${throwable::class.simpleName}" }
                    lastFailure = LastFailure.EXCEPTION
                    updateState { copy(isError = true) }
                }

            updateState { copy(isLoading = false) }
        }
    }
```

`useOriginal()` 첫 줄에 사다리 취소를 넣는다.

```kotlin
        // 사다리와 원본 저장은 다른 키라 그냥 두면 함께 돈다. 큰 할당이 겹치면 메모리로 죽는다
        cancel(LOAD_CANDIDATES_KEY)
```

`BaseViewModel.kt`에 취소 표면을 더한다. 맵에서 지우지 않는 것은 `launch`가 등록한
`invokeOnCompletion`이 이미 지우기 때문이다 — 여기서도 지우면 같은 키로 막 등록된 다음 잡을 지울 수 있다.

```kotlin
    /** [key] 로 띄운 잡을 끊는다. 없거나 이미 끝났으면 아무 일도 없다 */
    @MainThread
    protected fun cancel(key: Any) {
        runningJobs[key]?.cancel()
    }
```

`SegmentationViewModel` 생성자에 `private val recoverCandidatesUseCase: RecoverCandidatesUseCase,`를
더한다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew :core:ui:testDebugUnitTest :feature:segmentation:impl:testDebugUnitTest`
Expected: PASS. 기존 테스트가 전부 통과해야 한다.

- [ ] **Step 5: 커밋한다**

```bash
git add feature/segmentation/impl/src/main/java/com/teamyg/parfait/feature/segmentation/impl/viewmodel/SegmentationViewModel.kt \
        feature/segmentation/impl/src/test/java/com/teamyg/parfait/feature/segmentation/impl/viewmodel/SegmentationViewModelTest.kt \
        core/ui/src/main/java/com/teamyg/parfait/core/ui/BaseViewModel.kt
git commit -m "feat: 재시도를 실패 성격으로 가르고 사다리를 취소한다"
```

---

### Task 8: 전체 검증과 문서

코드 변경은 없다. 실기기에서 확인하고 문서를 맞춘다.

**Files:**
- Modify: `parfait/specs/2026-09-10-segmentation-retry-recovery.md` (다른 저장소)
- Modify: `parfait/plans/README.md` (다른 저장소)

- [ ] **Step 1: 전체 검증을 돌린다**

```bash
./gradlew :domain:test :data:testDebugUnitTest :feature:segmentation:impl:testDebugUnitTest
./gradlew ktlintCheck
./gradlew :app:assembleDebug
```

- [ ] **Step 2: 실기기에서 다섯 항목을 확인한다**

1. 후보가 나오는 평범한 사진 — 1차에서 성공하고 회복이 안 돈다. 로그에 회복 줄이 없다.
2. 검출이 안 되는 사진 — 「다시 시도」 한 번에 단계 로그가 순서대로 찍힌다. 대기 중 로딩 덮개만
   보이고 에러 화면이 겹치지 않는다.
3. 회복이 성공한 경우 — **저장된 토핑의 색이 원본과 같다.** 대비 스트레치가 결과에 새지 않았다는 증거다.
4. 회복까지 실패한 뒤 다시 「다시 시도」 — 로그에 회복 줄이 없고 1차 줄만 찍힌다.
5. 회복 대기 중 「편집 없이 사용」 — 확인 화면으로 넘어가고 사다리 로그가 그 뒤로 안 찍힌다.

⚠️ **1단계 전경 신뢰도 버퍼의 수명을 여기서 확인한다.** 2단계가 도는 동안 크래시나 이상 좌표가
없어야 한다. 스펙이 힌트를 미리 뽑아 이 의존을 없앴지만 실기기에서 한 번 본다.

- [ ] **Step 3: 로그에서 조건부 항목을 판정한다**

단계별 로그를 모아 아래를 본다. 결과를 스펙 「근거 등급」 절에 적는다.

- 1단계가 무동작 가드에 얼마나 걸리는가
- 2단계가 수축 가드에 얼마나 걸리는가 (힌트가 흩어졌다는 뜻이다)
- 필터 완화 전후 후보 수 차이 — 이게 크면 다음 라운드는 1차 하한을 봐야 한다
- 긴 변 상한이 실제로 걸린 비율과 그때 후보 수

- [ ] **Step 4: 문서를 갱신한다**

스펙의 `status`를 `implemented`로 올리고 as-built 배너를 단다. 계획과 갈린 자리가 있으면 적는다.
`parfait/plans/README.md` 활성 카탈로그에 이 계획 한 줄을 더한다.

- [ ] **Step 5: 커밋한다**

문서 저장소에서 커밋한다. **푸시와 PR은 사용자 승인 후에 한다.**

---

## Self-Review

**스펙 커버리지** — 스펙의 절과 Task 대응은 이렇다.

| 스펙 절 | Task |
|---|---|
| §1 재시도 3치 | 7 |
| §2 사다리 두 단계, 무동작·수축 가드 | 1(계산), 6(실행) |
| §3 힌트 하한과 선추출 | 1(`hintBounds`), 5(`harvestForeground`), 6(선추출) |
| §4 검출 해상도 | 1 |
| §4-1 잠정 초기값 | 1, 2, 4, 6 |
| §5 좌표계 규칙, 램프 뒤 되올림 | 3, 5, 6 |
| §6 계약 검사 | 5(`requireInsideCanvas`) |
| §7 다중 후보와 필터, 완화 | 4, 6 |
| API 절 전체 | 1, 3, 5, 6 |
| 동작/상태, 취소 | 7 |
| 에러 처리, 판 소유권, 메모리 | 5(갈래), 6(회수·상한) |
| 테스트 | 각 Task |
| 철회 조건 로그 | 6(로그), 8(판정) |

**타입 일관성** — `DetectionBounds`(검출 공간)와 `SegmentationBounds`(원본 공간)를 끝까지 가른다.
`RecoveryTransform.toOrigin`만 둘을 잇는다. Task 5·6이 쓰는 이름은 Task 1이 정의한 것과 같다.

**빈자리** — Task 6의 `runStage`와 Task 5의 옮긴 본문은 코드 블록 대신 구현 지시로 적었다. 옮기는
원본이 저장소에 그대로 있어 베끼면 되고, 옮기면서 바꿀 것(좌표 이름, 인자, `Result` 승격,
`requireInsideCanvas` 호출)을 빠짐없이 열거했다.
