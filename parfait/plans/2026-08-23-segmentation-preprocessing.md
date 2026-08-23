# 세그멘테이션 입력 전처리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 세그멘테이션이 보는 픽셀의 품질을 올려 누끼가 대상을 더 잘 얻게 한다.

**Architecture:** 손실이 처음 생기는 촬영 지점(`ImageCapture`)을 먼저 고치고, 디코드 지점
(`decodeUriToBitmap`·`decodeImage`)에 입력 정규화를 놓는다. 정규화의 판단은 순수 함수로 빼서 기기 없이
검증하고, 실제 픽셀 효과는 고정 사진 세트가 눈으로 판정한다. **판정 결과에 따라 뒤 절반을 넣거나 뺀다.**

**Tech Stack:** Kotlin, Jetpack Compose, CameraX, ML Kit Subject Segmentation, Hilt,
`androidx.exifinterface`(신규), kotlin.test + MockK

**Spec:** [`parfait/specs/2026-08-23-segmentation-preprocessing.md`](../specs/2026-08-23-segmentation-preprocessing.md)

**작업 저장소:** `TJYG-Android`(별도 repo). 브랜치는 `develop`에서 새로 딴다.
이 계획 문서가 있는 repo와 다른 곳이다.

## Global Constraints

- **커밋만 하고 push·PR은 하지 않는다.** 사용자가 명시적으로 요청할 때까지 리모트로 내보내지 않는다.
- 매 태스크 끝에 `./gradlew test ktlintCheck :app:assembleDebug`가 통과해야 한다.
- **주석 규약**: 코드가 이미 말하는 것은 쓰지 않는다. `@return`·`@param`은 타입·이름이 말하지 못할
  때만 쓴다. **다른 컴포넌트의 현재 상태를 단정하지 않는다**(낡는다). 아키텍처 결정은 코드가 아니라
  문서에 쓰고 코드에는 포인터 한 줄만 둔다.
- 테스트는 `kotlin.test`(`@Test`·`assertEquals`·`assertNull`)를 쓴다. 이름은
  `함수명_조건_기대`이고 본문에 `// Given` `// When` `// Then` 주석을 단다. 저장소 기존
  `SegmentationMaskTest`·`RecentImageRepositoryImplTest` 형식 그대로다.
- **변환 자체를 위한 단독 테스트를 만들지 않는다.** 판단이 든 순수 함수만 덮는다.
- `minSdk`는 26이다. API 분기를 지울 수 없다.
- 세그멘테이션 입력 이미지 하한은 **짧은 변 512px**이다(ML Kit Android 가이드
  "Tips to improve performance").

---

## 파일 구성

| 파일 | 책임 | 단계 |
|---|---|---|
| `feature/camera/impl/.../component/CameraPreviewComponent.kt` | `ImageCapture` 촬영 품질 | 1단계 |
| `core/util/android/.../extension/ExifOrientation.kt` (신설) | EXIF 상수를 각도로 (순수 함수) | 1단계 |
| `core/util/android/.../Logger.kt` (신설) | 모듈 로거. EXIF 재개방 실패를 남긴다 | 1단계 |
| `core/util/android/.../extension/ContentResolver.kt` | API 26·27 갈래에 회전 보정 결선 | 1단계 |
| `gradle/libs.versions.toml` | `androidx.exifinterface` 추가 | 1단계 |
| `data/.../repository/image/RecentImageRepositoryImpl.kt` | `SOURCE` 확장자를 바이트로 판정 | 1단계 |
| `data/.../repository/image/SegmentationInputNormalizer.kt` (신설) | 확대 치수·하한·픽셀 상한 (순수 함수) | 3단계 |
| `data/.../repository/image/ImageSegmentationRepositoryImpl.kt` | 확대 결선 | 3단계 |
| `domain/.../model/camera/CameraCacheFormat.kt` (신설) | 캐시 파일 포맷 어휘 | 3단계 |
| `domain/.../usecase/camera/CreateCameraCacheFileUseCase.kt` | 포맷 인자(기본 JPEG) | 3단계 |
| `data/.../source/file/local/FileCameraCacheLocalDataSource(+Impl).kt` | 포맷별 확장자 | 3단계 |
| `feature/camera/impl/.../util/CameraCrop.kt` | 포맷별 압축 | 3단계 |
| `feature/camera/impl/.../viewmodel/CustomCameraViewModel.kt` | 포맷 분기·촬영 중 상태 | 3단계 |
| `feature/camera/impl/.../route/CustomCameraRoute.kt` | `returnResultOnly`로 포맷 결정 | 3단계 |

**단계 구분이 이 계획의 핵심이다.** 1단계는 근거가 확정된 것만 넣는다. 2단계는 측정이다.
3단계는 **2단계 결과가 조건을 만족할 때만** 실행한다. 조건을 안 만족하면 3단계를 통째로 버리고
그 사실을 스펙에 기록하는 것이 정답이다.

---

# 1단계 — 근거가 확정된 것

## Task 1: 촬영 품질을 올린다

**Files:**
- Modify: `feature/camera/impl/src/main/java/com/teamyg/parfait/feature/camera/impl/component/CameraPreviewComponent.kt`

**Interfaces:**
- Consumes: 없음
- Produces: 없음(설정 변경). 뒤 태스크가 의존하는 심볼이 없다.

`ImageCapture.Builder().build()`가 아무 설정도 하지 않아 기본값으로 촬영한다. HAL이 내려주는 프레임이
이미 압축된 JPEG이고, `ImageProxy.toBitmap()`이 디코드하는 것이 그 프레임이다. 세그멘테이션이 보는
픽셀의 손실은 저장 시점이 아니라 **여기서 처음 생긴다.**

이 태스크에는 유닛 테스트가 없다. CameraX 빌더 설정이고 검증은 2단계 사진 세트가 한다.

- [ ] **Step 1: 빌더에 품질 설정을 넣는다**

`CameraPreviewComponent.kt`에서 `imageCapture` 생성부를 찾아 바꾼다.

```kotlin
val imageCapture: ImageCapture = ImageCapture
    .Builder()
    // 세그멘테이션이 보는 픽셀의 손실은 저장이 아니라 여기서 처음 생긴다.
    // 기본값에 기대지 않고 둘 다 명시한다 — capture mode 별 기본 품질이 다르다
    .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
    .setJpegQuality(MAX_JPEG_QUALITY)
    .build()
```

같은 파일 하단(또는 기존 상수 자리)에 상수를 둔다.

```kotlin
private const val MAX_JPEG_QUALITY = 100
```

- [ ] **Step 2: 빌드가 통과하는지 본다**

Run: `./gradlew :feature:camera:impl:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: 전체 검사**

Run: `./gradlew test ktlintCheck :app:assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
git add feature/camera/impl/src/main/java/com/teamyg/parfait/feature/camera/impl/component/CameraPreviewComponent.kt
git commit -m "fix: 촬영을 최대 품질로 받는다"
```

---

## Task 2: EXIF orientation 을 각도로 바꾸는 순수 함수

**Files:**
- Modify: `gradle/libs.versions.toml`
- Modify: `core/util/android/build.gradle.kts`
- Create: `core/util/android/src/main/kotlin/com/teamyg/parfait/core/util/android/extension/ExifOrientation.kt`
- Test: `core/util/android/src/test/kotlin/com/teamyg/parfait/core/util/android/extension/ExifOrientationTest.kt`

**Interfaces:**
- Consumes: 없음
- Produces: `internal fun exifOrientationToDegrees(orientation: Int): Int` — `core.util.android.extension`
  패키지. Task 3이 이것을 부른다.

- [ ] **Step 1: 의존성을 추가한다**

`gradle/libs.versions.toml`의 `[versions]` 절 `#Android` 부근에 넣는다.

```toml
exifinterface = "1.4.1"
```

`[libraries]` 절 `#Android` 부근, `androidx-core-ktx` 아래에 넣는다.

```toml
androidx-exifinterface = { group = "androidx.exifinterface", name = "exifinterface", version.ref = "exifinterface" }
```

`core/util/android/build.gradle.kts`의 `dependencies` 블록에 한 줄 더한다.

```kotlin
implementation(libs.androidx.exifinterface)
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`ExifOrientationTest.kt`를 만든다.

```kotlin
package com.teamyg.parfait.core.util.android.extension

import androidx.exifinterface.media.ExifInterface
import kotlin.test.Test
import kotlin.test.assertEquals

class ExifOrientationTest {
    @Test
    fun exifOrientationToDegrees_rotateTags_mapToTheirAngles() {
        // Given 회전만 나타내는 태그 셋
        // Then 각각의 각도가 된다
        assertEquals(90, exifOrientationToDegrees(ExifInterface.ORIENTATION_ROTATE_90))
        assertEquals(180, exifOrientationToDegrees(ExifInterface.ORIENTATION_ROTATE_180))
        assertEquals(270, exifOrientationToDegrees(ExifInterface.ORIENTATION_ROTATE_270))
    }

    @Test
    fun exifOrientationToDegrees_normalOrUndefined_isZero() {
        // Given 돌릴 필요가 없거나 태그가 없는 경우
        assertEquals(0, exifOrientationToDegrees(ExifInterface.ORIENTATION_NORMAL))
        assertEquals(0, exifOrientationToDegrees(ExifInterface.ORIENTATION_UNDEFINED))
    }

    @Test
    fun exifOrientationToDegrees_mirrorTags_areZero() {
        // Given 좌우 반전이 섞인 태그 넷
        // Then 0 이다 — 반전을 적용하면 뒤집힌 누끼가 나오고, 세그멘테이션 정확도에는
        // 기여하지 않는다. 이 테스트가 그 결정을 지킨다
        assertEquals(0, exifOrientationToDegrees(ExifInterface.ORIENTATION_FLIP_HORIZONTAL))
        assertEquals(0, exifOrientationToDegrees(ExifInterface.ORIENTATION_FLIP_VERTICAL))
        assertEquals(0, exifOrientationToDegrees(ExifInterface.ORIENTATION_TRANSPOSE))
        assertEquals(0, exifOrientationToDegrees(ExifInterface.ORIENTATION_TRANSVERSE))
    }

    @Test
    fun exifOrientationToDegrees_unknownValue_isZero() {
        // 깨진 파일이 범위 밖 값을 주는 일이 있다
        assertEquals(0, exifOrientationToDegrees(-1))
        assertEquals(0, exifOrientationToDegrees(99))
    }
}
```

- [ ] **Step 3: 테스트가 실패하는 것을 확인한다**

Run: `./gradlew :core:util:android:testDebugUnitTest`
Expected: 컴파일 실패 — `Unresolved reference: exifOrientationToDegrees`

- [ ] **Step 4: 최소 구현을 쓴다**

`ExifOrientation.kt`를 만든다.

```kotlin
package com.teamyg.parfait.core.util.android.extension

import androidx.exifinterface.media.ExifInterface

/**
 * EXIF orientation 태그를 시계 방향 회전 각도로 바꾼다.
 *
 * 미러링(`FLIP_*`·`TRANSPOSE`·`TRANSVERSE`)은 0 이다. 좌우 반전은 세그멘테이션 정확도에
 * 기여하지 않고 잘못 적용하면 뒤집힌 결과물이 나온다
 * (`parfait/specs/2026-08-23-segmentation-preprocessing.md`).
 */
internal fun exifOrientationToDegrees(orientation: Int): Int = when (orientation) {
    ExifInterface.ORIENTATION_ROTATE_90 -> 90
    ExifInterface.ORIENTATION_ROTATE_180 -> 180
    ExifInterface.ORIENTATION_ROTATE_270 -> 270
    else -> 0
}
```

- [ ] **Step 5: 테스트가 통과하는 것을 확인한다**

Run: `./gradlew :core:util:android:testDebugUnitTest`
Expected: PASS

- [ ] **Step 6: 전체 검사와 커밋**

Run: `./gradlew test ktlintCheck :app:assembleDebug`

```bash
git add gradle/libs.versions.toml core/util/android/build.gradle.kts \
  core/util/android/src/main/kotlin/com/teamyg/parfait/core/util/android/extension/ExifOrientation.kt \
  core/util/android/src/test/kotlin/com/teamyg/parfait/core/util/android/extension/ExifOrientationTest.kt
git commit -m "feat: EXIF orientation 을 회전 각도로 바꾼다"
```

---

## Task 3: API 28 미만 디코드에 회전 보정을 결선한다

**Files:**
- Create: `core/util/android/src/main/kotlin/com/teamyg/parfait/core/util/android/Logger.kt`
- Modify: `core/util/android/src/main/kotlin/com/teamyg/parfait/core/util/android/extension/ContentResolver.kt`

**Interfaces:**
- Consumes: `exifOrientationToDegrees(orientation: Int): Int` (Task 2)
- Produces: `fun ContentResolver.decodeUriToBitmap(uri: Uri): Bitmap` — 시그니처는 그대로이고 계약만
  넓어진다. Task 6이 이 함수 위에 확대를 얹는다.

`MediaStore.Images.Media.getBitmap`은 EXIF orientation을 적용하지 않는다. API 26·27이 그 갈래를 타므로
누운 사진이 그대로 `InputImage.fromBitmap(bitmap, 0)`으로 들어간다.

⚠️ **API 28 이상은 건드리지 않는다.** `ImageDecoder`가 EXIF를 자동 적용하는지 공식 문서로 확인하지
못했다(OQ-P-280). 이미 적용된 이미지를 또 돌리면 두 번 돌아간다. 판정 못 한 상태의 기본값은
"보정하지 않음"이다. 2단계에서 API 28 이상도 누워 나오는 것이 확인되면 그때 넓힌다.

- [ ] **Step 1: 모듈 로거를 만든다**

`data/src/main/java/com/teamyg/parfait/data/utils/Logger.kt`와 같은 형태다.
`core/util/android/src/main/kotlin/com/teamyg/parfait/core/util/android/Logger.kt`를 만든다.

```kotlin
package com.teamyg.parfait.core.util.android

import com.teamyg.parfait.core.util.jvm.analytics.Logger
import com.teamyg.parfait.core.util.jvm.analytics.Loggers

internal val coreUtilAndroidLogger: Logger by lazy {
    Loggers.create(tag = "CoreUtilAndroid")
}
```

- [ ] **Step 2: 디코드에 회전 보정을 얹는다**

`ContentResolver.kt`를 이렇게 만든다. 기존 API 28 이상 갈래는 그대로 둔다.

```kotlin
package com.teamyg.parfait.core.util.android.extension

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.exifinterface.media.ExifInterface
import com.teamyg.parfait.core.util.android.coreUtilAndroidLogger

fun ContentResolver.decodeUriToBitmap(uri: Uri): Bitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
    val source = ImageDecoder.createSource(this, uri)
    ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        decoder.isMutableRequired = true
        decoder.setTargetSize(info.size.width, info.size.height)
    }
} else {
    @Suppress("DEPRECATION")
    MediaStore.Images.Media
        .getBitmap(this, uri)
        .rotatedToUpright(this, uri)
}

/**
 * EXIF 회전을 픽셀에 적용한다.
 *
 * API 28 이상에서는 부르지 않는다 — [ImageDecoder] 가 이미 적용하는지 확인하지 못했고,
 * 적용된 판을 또 돌리면 두 번 돌아간다(`parfait/synthesis/open-questions.md` OQ-P-280).
 */
private fun Bitmap.rotatedToUpright(
    resolver: ContentResolver,
    uri: Uri,
): Bitmap {
    val degrees = resolver.readExifDegrees(uri)
    if (degrees == 0) return this

    val matrix = Matrix().apply { postRotate(degrees.toFloat()) }
    val rotated = Bitmap.createBitmap(this, 0, 0, width, height, matrix, true)

    // 전체 해상도 판 둘이 함께 살지 않게 한다.
    // createBitmap 은 바꿀 것이 없으면 원본 인스턴스를 그대로 돌려주므로 그때는 회수하지 않는다
    if (rotated !== this) recycle()

    return rotated
}

/**
 * [ImageDecoder.createSource] 가 스트림을 소비하므로 EXIF 는 uri 를 한 번 더 열어서 읽는다.
 *
 * 못 읽으면 0 이다 — 태그가 깨진 것과 이미지를 못 연 것은 다른 사건이라 여기서 디코드를
 * 실패시키지 않는다. 다만 재개방 실패가 상시 참이 되면 보정이 조용히 무효가 되므로 남긴다.
 */
private fun ContentResolver.readExifDegrees(uri: Uri): Int = try {
    openInputStream(uri).use { input ->
        if (input == null) {
            0
        } else {
            exifOrientationToDegrees(
                ExifInterface(input).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                ),
            )
        }
    }
} catch (throwable: Exception) {
    coreUtilAndroidLogger.w(throwable) { "EXIF 를 읽지 못해 회전 보정을 건너뛴다 - uri: $uri" }
    0
}
```

> `coreUtilAndroidLogger.w(throwable) { ... }` 시그니처가 이 저장소 `Logger` 인터페이스와 다르면
> 같은 인터페이스가 제공하는 경고 수준 메서드로 맞춘다. `core/util/jvm/.../analytics/Logger.kt`를 열어
> 확인한다. 로그를 남기는 것 자체는 빼지 않는다.

- [ ] **Step 3: 전체 검사**

Run: `./gradlew test ktlintCheck :app:assembleDebug`
Expected: BUILD SUCCESSFUL

기존 테스트가 깨지지 않는지 본다. `decodeUriToBitmap`은 호출부가 `ImageSegmentationRepositoryImpl`
하나뿐이라 파급이 없어야 한다.

- [ ] **Step 4: 커밋**

```bash
git add core/util/android/src/main/kotlin/com/teamyg/parfait/core/util/android/Logger.kt \
  core/util/android/src/main/kotlin/com/teamyg/parfait/core/util/android/extension/ContentResolver.kt
git commit -m "fix: API 28 미만에서 누운 사진을 세워서 디코드한다"
```

---

## Task 4: 최근 이미지 확장자를 이름이 아니라 바이트로 정한다

**Files:**
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/image/RecentImageRepositoryImpl.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/repository/image/RecentImageRepositoryImplTest.kt`

**Interfaces:**
- Consumes: `UploadImageFormat.ofBytes(bytes: ByteArray): UploadImageFormat?`와
  `UploadImageFormat.extension: String` — `data.model.image` 패키지에 이미 있다.
- Produces: 없음(내부 판정 변경).

> 📌 **이 태스크는 스펙이 "PNG 채택 시"로 분류했으나 1단계로 올린다.** 지금도 참인 결함이기
> 때문이다. `SegmentationViewModel`이 세그멘테이션 진입마다 원본을 `RecentImageKind.SOURCE`로
> 기록하는데, **사용자가 갤러리에서 고른 PNG도 그 경로를 탄다.** 확장자가 `"jpg"`로 못박혀 있어
> PNG 바이트가 `.jpg` 이름으로 앉고, C-301 배경 편집이 최근 목록에서 그것을 고르면
> `ImageFileLocalDataSourceImpl#formatOf`가 확장자에서 유도된 MIME을 바이트 스니핑보다 먼저 믿어
> `image/jpeg`로 업로드된다. 3단계를 안 하더라도 고칠 값이 있다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`RecentImageRepositoryImplTest.kt`에 케이스를 더한다. 기존
`store_withAbsolutePath_readsThroughFilePathAndKeepsPngExtension` 아래에 둔다.

```kotlin
@Test
fun store_sourceIsActuallyPng_namesItPngNotJpg() = runTest {
    // Given 사용자가 갤러리에서 고른 PNG. SOURCE 경로로 들어온다
    val bytes = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
    val target = File(dir, "abc.png")
    every { fileDataSource.readBytes("content://media/2") } returns bytes
    every { fileDataSource.getTargetFile(bytes, "png") } returns target
    every { fileDataSource.getUriStringForFile(target) } returns "content://recent/abc.png"

    // When 최근 이미지로 저장한다
    val stored = repository().storeRecentImageInInternalStorage(
        source = "content://media/2",
        kind = RecentImageKind.SOURCE,
    )

    // Then 내용대로 png 다 — jpg 로 굳으면 배경으로 다시 골랐을 때
    // 확장자에서 유도된 image/jpeg 로 올라간다
    verify { fileDataSource.getTargetFile(bytes, "png") }
    assertEquals("content://recent/abc.png", stored)
}

@Test
fun store_sourceFormatIsUnknown_fallsBackToJpg() = runTest {
    // Given 앞머리가 PNG 도 JPEG 도 아닌 바이트
    val bytes = byteArrayOf(0x47, 0x49, 0x46, 0x38)
    val target = File(dir, "def.jpg")
    every { fileDataSource.readBytes("content://media/3") } returns bytes
    every { fileDataSource.getTargetFile(bytes, "jpg") } returns target
    every { fileDataSource.getUriStringForFile(target) } returns "content://recent/def.jpg"

    // When 최근 이미지로 저장한다
    repository().storeRecentImageInInternalStorage(
        source = "content://media/3",
        kind = RecentImageKind.SOURCE,
    )

    // Then 판정 실패가 저장 실패가 되지는 않는다. 종전 동작을 폴백으로 둔다
    verify { fileDataSource.getTargetFile(bytes, "jpg") }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests '*RecentImageRepositoryImplTest*'`
Expected: `store_sourceIsActuallyPng_namesItPngNotJpg` FAIL —
`getTargetFile(bytes, "png")` 대신 `getTargetFile(bytes, "jpg")`가 불렸다는 MockK 검증 실패

- [ ] **Step 3: 구현을 고친다**

`RecentImageRepositoryImpl.kt`에서 `kind.fileExtension()`을 쓰던 자리를 바꾼다.

```kotlin
val target: File = fileRecentImageLocalDataSource.getTargetFile(bytes, extensionOf(kind, bytes))
```

`fileExtension()`을 지우고 아래로 바꾼다.

```kotlin
/**
 * 알맹이는 언제나 투명 PNG 라 종류로 정해지지만, 원본은 사용자가 고른 파일이라 내용을 봐야 한다.
 * 이름이 거짓이면 업로드가 content type 을 잘못 정한다.
 */
private fun extensionOf(
    kind: RecentImageKind,
    bytes: ByteArray,
): String = when (kind) {
    RecentImageKind.SOURCE -> UploadImageFormat.ofBytes(bytes)?.extension ?: UploadImageFormat.JPEG.extension
    RecentImageKind.CUTOUT -> UploadImageFormat.PNG.extension
}
```

`import com.teamyg.parfait.data.model.image.UploadImageFormat`를 더한다.

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests '*RecentImageRepositoryImplTest*'`
Expected: PASS. 기존 케이스 둘(`.jpg` SOURCE·`.png` CUTOUT)도 함께 통과해야 한다.
기존 SOURCE 케이스의 바이트가 `byteArrayOf(1, 2)` 같은 판정 불가 값이면 폴백으로 `jpg`가 나와 그대로
통과한다. JPEG 시그니처로 바뀌어야 통과한다면 그 케이스의 바이트를 JPEG 시그니처로 고친다.

- [ ] **Step 5: 전체 검사와 커밋**

Run: `./gradlew test ktlintCheck :app:assembleDebug`

```bash
git add data/src/main/java/com/teamyg/parfait/data/repository/image/RecentImageRepositoryImpl.kt \
  data/src/test/java/com/teamyg/parfait/data/repository/image/RecentImageRepositoryImplTest.kt
git commit -m "fix: 최근 원본의 확장자를 이름이 아니라 내용으로 정한다"
```

---

# 2단계 — 측정 게이트

## Task 5: 고정 사진 세트로 판정한다

**Files:**
- 코드 변경 없음. 결과를 `parfait/specs/2026-08-23-segmentation-preprocessing.md`에 기록한다.

**Interfaces:**
- Consumes: Task 1~4의 결과물
- Produces: **3단계 실행 여부**와 **회전 보정 범위**를 정하는 판정 결과

⚠️ **이 태스크는 사람이 실기기에서 해야 한다. 서브에이전트가 대신할 수 없다.**
결과를 받기 전에는 3단계로 넘어가지 않는다.

- [ ] **Step 1: 사진 여섯 장을 준비한다**

| 사진 | 판정 대상 |
|---|---|
| EXIF 회전 태그가 붙은 세로 사진 | 회전 정합 |
| 짧은 변 512 미만 이미지 | 확대 가드의 효과 |
| 머리카락·털·잎사귀처럼 경계가 복잡한 피사체 | 촬영 품질과 저장 포맷 |
| 피사체가 뷰파인더 변에 걸친 촬영 | 크롭의 영향(기준선만) |
| 저대비·역광 | 조도의 영향(기준선만) |
| 다중 피사체 | 기존 다중 후보 회귀 |

**회전 사진은 태그가 실제로 붙어 있는지 먼저 확인한다.** 많은 카메라 앱이 픽셀에 회전을 굽고
태그는 정상으로 쓴다. 그런 사진으로 시험하면 두 API 대역 모두 문제없다고 나오고 아무것도 배우지
못한다.

Run: `adb shell` 또는 `exiftool <파일>`로 Orientation 값이 6 또는 8인지 확인한다.

- [ ] **Step 2: 회전을 판정한다**

API 27 에뮬레이터와 API 28 이상 기기에서 각각 회전 사진을 갤러리 경로로 넣고 C-103 후보 화면을 본다.

- API 27에서 세워져 나오면 Task 3이 동작한 것이다.
- **API 28 이상에서도 누워 나오면** 회전 보정을 전 버전으로 넓힌다(3단계 Task 6에 항목을 더한다).
  세워져 나오면 그대로 둔다.
- 결과를 OQ-P-280의 해소 메모에 적는다.

- [ ] **Step 3: 손실을 세 벌로 가른다**

같은 피사체를 같은 구도로 세 조건에서 촬영해 최종 누끼를 나란히 둔다.

1. Task 1 이전 빌드 (기준선)
2. Task 1 이후 빌드, JPEG 저장 그대로
3. Task 1 이후 빌드 + 3단계 Task 8까지 임시 적용(PNG 저장)

3번을 위한 임시 적용이 부담이면 **1번과 2번만 먼저 본다.** 2번에서 이미 충분히 좋아졌으면
3단계의 PNG 관련 태스크를 버린다.

함께 잰다 — PNG 저장 시간, 파일 크기, 셔터에서 확인 화면까지의 공백.

- [ ] **Step 4: 확대를 판정한다**

짧은 변 512 미만 사진을 갤러리 경로로 넣는다. 3단계 Task 6·7을 임시 적용한 빌드와 안 한 빌드에서
후보 화면을 비교한다. **차이가 없으면 3단계 Task 6·7을 버린다.**

같은 사진으로 **배치까지 끝내서** 캔버스에 박힌 토핑 크기가 전후로 달라지는지도 본다(OQ-P-282).

- [ ] **Step 5: 결과를 스펙에 적는다**

`parfait/specs/2026-08-23-segmentation-preprocessing.md`의 근거 등급 표에 판정 결과 열을 채우고,
버리기로 한 항목은 그 이유와 함께 남긴다. **버린 기록이 다음 사람에게는 결과다.**
OQ-P-278·OQ-P-280의 상태도 갱신한다.

---

# 3단계 — 측정이 통과한 것만

> **게이트**: Task 5 Step 4가 확대의 효과를 확인했을 때만 Task 6·7을 한다.
> Task 5 Step 3이 PNG의 추가 이득을 확인했을 때만 Task 8·9·10을 한다.
> 둘 다 아니면 3단계 전체를 건너뛰고 Task 11로 간다.

## Task 6: 확대 치수를 계산하는 순수 함수

**Files:**
- Create: `data/src/main/java/com/teamyg/parfait/data/repository/image/SegmentationInputNormalizer.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/repository/image/SegmentationInputNormalizerTest.kt`

**Interfaces:**
- Consumes: 없음
- Produces: `internal data class ScaledSize(val width: Int, val height: Int)`와
  `internal fun computeUpscaleTarget(width: Int, height: Int): ScaledSize?` —
  `data.repository.image` 패키지. Task 7이 부른다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
package com.teamyg.parfait.data.repository.image

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SegmentationInputNormalizerTest {
    @Test
    fun computeUpscaleTarget_shortSideBelowTheFloor_scalesUpKeepingRatio() {
        // Given 짧은 변이 400 인 가로 사진
        val target = computeUpscaleTarget(width = 600, height = 400)

        // Then 짧은 변이 512 가 되고 비율이 유지된다
        assertEquals(ScaledSize(width = 768, height = 512), target)
    }

    @Test
    fun computeUpscaleTarget_shortSideIsExactlyTheFloor_isNull() {
        // Then 하한을 만족하면 아무것도 하지 않는다 — null 이 "확대 없음"이다
        assertNull(computeUpscaleTarget(width = 1024, height = 512))
    }

    @Test
    fun computeUpscaleTarget_shortSideAboveTheFloor_isNull() {
        assertNull(computeUpscaleTarget(width = 513, height = 513))
    }

    @Test
    fun computeUpscaleTarget_shortSideJustBelowTheFloor_scalesUp() {
        // Given 511 은 경계 바로 아래다
        val target = computeUpscaleTarget(width = 511, height = 511)

        // Then 올림해서 하한을 밑돌지 않게 한다
        assertEquals(ScaledSize(width = 512, height = 512), target)
    }

    @Test
    fun computeUpscaleTarget_extremeAspectRatio_isNullBecauseOfThePixelCap() {
        // Given 짧은 변만 보면 5.12 배로 키워야 하는 파노라마 조각
        // 그대로 키우면 512 × 10240 = 약 524만 픽셀, ARGB 로 약 21MB 다
        val target = computeUpscaleTarget(width = 2000, height = 100)

        // Then 확대하지 않는다 — 확대해서 죽는 것보다 확대를 안 하는 편이 낫다
        assertNull(target)
    }

    @Test
    fun computeUpscaleTarget_nonPositiveDimension_isNull() {
        assertNull(computeUpscaleTarget(width = 0, height = 400))
        assertNull(computeUpscaleTarget(width = 400, height = -1))
    }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests '*SegmentationInputNormalizerTest*'`
Expected: 컴파일 실패 — `Unresolved reference: computeUpscaleTarget`

- [ ] **Step 3: 최소 구현을 쓴다**

```kotlin
package com.teamyg.parfait.data.repository.image

import kotlin.math.ceil

/** ML Kit 가이드가 정확도 하한으로 제시하는 짧은 변 치수 */
internal const val MIN_SEGMENTATION_SIDE = 512

/**
 * 확대 후 총 픽셀 상한. 약 16MB(ARGB) 어치다.
 *
 * 짧은 변만 보고 키우면 극단 종횡비에서 긴 변이 폭증한다. 그 뒤 세그멘테이션이 원본과
 * 후보 판들을 함께 들고 저장이 같은 크기 캔버스를 하나 더 만든다.
 */
internal const val MAX_UPSCALED_PIXELS = 4_000_000L

internal data class ScaledSize(val width: Int, val height: Int)

/**
 * @return 확대가 필요 없거나 확대하면 [MAX_UPSCALED_PIXELS] 를 넘으면 `null`
 */
internal fun computeUpscaleTarget(
    width: Int,
    height: Int,
): ScaledSize? {
    if (width <= 0 || height <= 0) return null

    val shortSide = minOf(width, height)
    if (shortSide >= MIN_SEGMENTATION_SIDE) return null

    val ratio = MIN_SEGMENTATION_SIDE.toDouble() / shortSide
    // 올림한다 — 내림하면 짧은 변이 511 로 떨어져 하한을 다시 밑돈다
    val scaledWidth = ceil(width * ratio).toInt()
    val scaledHeight = ceil(height * ratio).toInt()

    if (scaledWidth.toLong() * scaledHeight > MAX_UPSCALED_PIXELS) return null

    return ScaledSize(width = scaledWidth, height = scaledHeight)
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `./gradlew :data:testDebugUnitTest --tests '*SegmentationInputNormalizerTest*'`
Expected: PASS

- [ ] **Step 5: 전체 검사와 커밋**

Run: `./gradlew test ktlintCheck :app:assembleDebug`

```bash
git add data/src/main/java/com/teamyg/parfait/data/repository/image/SegmentationInputNormalizer.kt \
  data/src/test/java/com/teamyg/parfait/data/repository/image/SegmentationInputNormalizerTest.kt
git commit -m "feat: 세그멘테이션 입력 확대 치수를 계산한다"
```

---

## Task 7: 디코드에 확대를 결선한다

**Files:**
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/image/ImageSegmentationRepositoryImpl.kt`
- Modify: `domain/src/main/java/com/teamyg/parfait/domain/repository/image/ImageSegmentationRepository.kt`

**Interfaces:**
- Consumes: `computeUpscaleTarget`·`ScaledSize` (Task 6),
  `ContentResolver.decodeUriToBitmap` (Task 3)
- Produces: 없음(계약 문구만 넓어진다).

정규화를 `segmentImage`가 아니라 `decodeImage`에 두는 이유는 **일관성**이다. `SegmentationViewModel`과
`ToppingEditViewModel`이 같은 `DecodeImageUseCase`를 타므로, 디코드 지점에 두면 같은 URI가 두 곳에서
같은 픽셀로 열린다. `segmentImage`에만 두면 두 곳이 갈리고, 지금은 `buildCutoutBitmap`의 늘려 그리기가
그것을 덮어 주지만 그 방어에 기대는 설계가 된다.

- [ ] **Step 1: 인터페이스 계약을 넓힌다**

`ImageSegmentationRepository.kt`의 `decodeImage`에 KDoc을 단다.

```kotlin
/**
 * 세그멘테이션 입력 규격으로 정규화해 디코드한다 — 방향을 세우고 짧은 변 하한을 맞춘다.
 *
 * 색공간과 `Bitmap.Config` 는 건드리지 않는다
 * (`parfait/synthesis/open-questions.md` OQ-P-281).
 */
suspend fun decodeImage(uri: String): BitmapWrapper
```

- [ ] **Step 2: 확대를 적용한다**

`ImageSegmentationRepositoryImpl.kt`의 `decodeImage`를 바꾼다.

```kotlin
override suspend fun decodeImage(uri: String): BitmapWrapper {
    val bitmap: Bitmap = context.contentResolver.decodeUriToBitmap(uri.toUri())

    return bitmap.upscaledForSegmentation().toAndroidBitmap()
}

private fun Bitmap.upscaledForSegmentation(): Bitmap {
    val target = computeUpscaleTarget(width, height) ?: return this

    val scaled = Bitmap.createScaledBitmap(this, target.width, target.height, true)

    // createScaledBitmap 은 치수가 같으면 원본 인스턴스를 그대로 돌려준다.
    // 그때 회수하면 방금 받은 판이 사라진다
    if (scaled !== this) recycle()

    return scaled
}
```

- [ ] **Step 3: 전체 검사**

Run: `./gradlew test ktlintCheck :app:assembleDebug`
Expected: BUILD SUCCESSFUL. 기존 `SegmentationViewModelTest`가 깨지지 않아야 한다.

- [ ] **Step 4: 커밋**

```bash
git add data/src/main/java/com/teamyg/parfait/data/repository/image/ImageSegmentationRepositoryImpl.kt \
  domain/src/main/java/com/teamyg/parfait/domain/repository/image/ImageSegmentationRepository.kt
git commit -m "feat: 하한 미만 이미지를 세그멘테이션 규격으로 키워서 디코드한다"
```

---

## Task 8: 캐시 파일 포맷을 어휘로 만든다

**Files:**
- Create: `domain/src/main/java/com/teamyg/parfait/domain/model/camera/CameraCacheFormat.kt`
- Modify: `domain/src/main/java/com/teamyg/parfait/domain/usecase/camera/CreateCameraCacheFileUseCase.kt`
- Modify: `data/src/main/java/com/teamyg/parfait/data/source/file/local/FileCameraCacheLocalDataSource.kt`
- Modify: `data/src/main/java/com/teamyg/parfait/data/source/file/local/FileCameraCacheLocalDataSourceImpl.kt`
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/camera/CameraCacheFileRepositoryImpl.kt`
- Modify: `domain/src/main/java/com/teamyg/parfait/domain/repository/camera/CameraCacheFileRepository.kt`

**Interfaces:**
- Consumes: 없음
- Produces: `enum class CameraCacheFormat { JPEG, PNG }`(`domain.model.camera`)와
  `CreateCameraCacheFileUseCase.invoke(format: CameraCacheFormat = CameraCacheFormat.JPEG): File`.
  Task 9·10이 쓴다.

기본값을 JPEG로 두는 것이 핵심이다. `CreateCameraCacheUriUseCase`가 인자 없이 파일 use case를
부르므로, 기본값이 있으면 **시스템 카메라 경로는 한 글자도 안 바뀐다.**

- [ ] **Step 1: 포맷 어휘를 만든다**

```kotlin
package com.teamyg.parfait.domain.model.camera

/** 카메라가 캐시에 남기는 파일의 형식. 확장자 매핑은 data 가 한다 */
enum class CameraCacheFormat {
    JPEG,
    PNG,
}
```

- [ ] **Step 2: 계층을 따라 인자를 흘린다**

`CreateCameraCacheFileUseCase`:

```kotlin
operator fun invoke(format: CameraCacheFormat = CameraCacheFormat.JPEG): File {
    val makeCondition: Boolean = cameraCacheFileRepository.makeCameraCacheFileDirs()
    useCaseLogger.d { "CreateCameraCacheFileUseCase - makeCondition: $makeCondition" }

    return cameraCacheFileRepository.createCameraCacheFile(format)
}
```

`CameraCacheFileRepository`(domain 인터페이스)와 `CameraCacheFileRepositoryImpl`,
`FileCameraCacheLocalDataSource`(인터페이스)의 `createFile`에 같은 인자를 더한다.
`CreateCameraCacheUriUseCase`는 **건드리지 않는다** — 인자 없이 부르면 기본값 JPEG를 받는다.

`FileCameraCacheLocalDataSourceImpl`:

```kotlin
override fun createFile(format: CameraCacheFormat): File {
    val timestamp = Clock.System
        .now()
        .toLocalDateTime(TimeZone.currentSystemDefault())
        .format(LocalDateTime.Format { byUnicodePattern(FILE_NAME_PATTERN) })

    return File(
        dir,
        "IMG_$timestamp.${format.extension}",
    )
}

/** 파일명이 곧 업로드 content type 의 단서라 형식과 확장자가 어긋나면 안 된다 */
private val CameraCacheFormat.extension: String
    get() = when (this) {
        CameraCacheFormat.JPEG -> "jpg"
        CameraCacheFormat.PNG -> "png"
    }
```

- [ ] **Step 3: 전체 검사**

Run: `./gradlew test ktlintCheck :app:assembleDebug`
Expected: BUILD SUCCESSFUL. 동작은 아직 그대로다 — 아무도 PNG를 안 넘긴다.

- [ ] **Step 4: 커밋**

```bash
git add domain/src/main/java/com/teamyg/parfait/domain/model/camera/CameraCacheFormat.kt \
  domain/src/main/java/com/teamyg/parfait/domain/usecase/camera/CreateCameraCacheFileUseCase.kt \
  domain/src/main/java/com/teamyg/parfait/domain/repository/camera/CameraCacheFileRepository.kt \
  data/src/main/java/com/teamyg/parfait/data/repository/camera/CameraCacheFileRepositoryImpl.kt \
  data/src/main/java/com/teamyg/parfait/data/source/file/local/FileCameraCacheLocalDataSource.kt \
  data/src/main/java/com/teamyg/parfait/data/source/file/local/FileCameraCacheLocalDataSourceImpl.kt
git commit -m "feat: 카메라 캐시 파일 포맷을 고를 수 있게 한다"
```

---

## Task 9: 촬영 저장을 포맷에 맞춰 압축한다

**Files:**
- Modify: `feature/camera/impl/src/main/java/com/teamyg/parfait/feature/camera/impl/util/CameraCrop.kt`
- Modify: `feature/camera/impl/src/main/java/com/teamyg/parfait/feature/camera/impl/route/CustomCameraRoute.kt`

**Interfaces:**
- Consumes: `CameraCacheFormat` (Task 8)
- Produces: `saveViewfinderCapture(..., format: CameraCacheFormat, file: File)` — Task 10이 호출부를
  마저 결선한다.

- [ ] **Step 1: 압축을 포맷에 맞춘다**

`CameraCrop.kt`의 `JPEG_QUALITY` 상수를 지운다. 그 상수는 `computeCropRect`의 KDoc과 함수 선언 사이에
끼어 있으므로, 지우면 KDoc이 제자리를 찾는다.

`saveViewfinderCapture`를 바꾼다.

```kotlin
internal fun saveViewfinderCapture(
    captured: Bitmap,
    rotationDegrees: Int,
    viewfinderRect: Rect?,
    feedRect: Rect?,
    isFrontFacing: Boolean,
    format: CameraCacheFormat,
    file: File,
) {
    val rotated = captured.rotate(rotationDegrees)
    val cropRect = if (viewfinderRect != null && feedRect != null) {
        computeCropRect(
            viewfinderRect = viewfinderRect,
            feedRect = feedRect,
            imageSize = IntSize(rotated.width, rotated.height),
            isFrontFacing = isFrontFacing,
        )
    } else {
        null
    }

    file.outputStream().use { output ->
        rotated.crop(cropRect).compress(format.compressFormat, format.quality, output)
    }
}

private val CameraCacheFormat.compressFormat: Bitmap.CompressFormat
    get() = when (this) {
        CameraCacheFormat.JPEG -> Bitmap.CompressFormat.JPEG
        CameraCacheFormat.PNG -> Bitmap.CompressFormat.PNG
    }

/** PNG 는 무손실이라 이 값을 무시한다 */
private val CameraCacheFormat.quality: Int
    get() = when (this) {
        CameraCacheFormat.JPEG -> 100
        CameraCacheFormat.PNG -> 100
    }
```

- [ ] **Step 2: 호출부를 임시로 JPEG 고정으로 맞춘다**

`CustomCameraRoute.kt`의 `saveViewfinderCapture` 호출에 `format = CameraCacheFormat.JPEG`를 더한다.
Task 10이 이 자리를 진짜 분기로 바꾼다. **이 태스크에서는 동작이 안 바뀐다.**

- [ ] **Step 3: 전체 검사와 커밋**

Run: `./gradlew test ktlintCheck :app:assembleDebug`

```bash
git add feature/camera/impl/src/main/java/com/teamyg/parfait/feature/camera/impl/util/CameraCrop.kt \
  feature/camera/impl/src/main/java/com/teamyg/parfait/feature/camera/impl/route/CustomCameraRoute.kt
git commit -m "refactor: 촬영 저장이 포맷을 받아 압축한다"
```

---

## Task 10: 토핑 경로만 무손실로 가르고 셔터를 잠근다

**Files:**
- Modify: `feature/camera/impl/src/main/java/com/teamyg/parfait/feature/camera/impl/viewmodel/CustomCameraViewModel.kt`
- Modify: `feature/camera/impl/src/main/java/com/teamyg/parfait/feature/camera/impl/route/CustomCameraRoute.kt`
- Modify: `feature/camera/impl/src/main/java/com/teamyg/parfait/feature/camera/impl/screen/CustomCameraScreen.kt`

**Interfaces:**
- Consumes: `CameraCacheFormat` (Task 8), `saveViewfinderCapture(..., format, file)` (Task 9)
- Produces: `CustomCameraIntent.OnClickShutter(format: CameraCacheFormat)`(기존 `data object`를
  `data class`로 바꾼다), `CustomCameraState.isCapturing: Boolean`

커스텀 카메라의 소비자가 둘이다. 토핑 만들기와 **C-301 배경 촬영**(`returnResultOnly = true`)이다.
뒤엣것은 누끼를 안 타고 곧장 서버로 올라가므로 무손실의 이득이 0이고 업로드 용량만 커진다.
`CustomCameraRoute`가 `returnResultOnly`를 이미 파라미터로 받으므로 거기서 가른다.

셔터 잠금이 함께 들어가는 이유는 **PNG 인코딩이 셔터와 확인 화면 사이에 끼기 때문**이다. 이동은
저장이 끝난 뒤에 일어나는데 지금은 진행 표시도 연타 가드도 없고, 파일명이 초 단위라 같은 초의 두
촬영은 서로를 덮는다. PNG 없이는 필요 없고 PNG와 함께면 필수다.

- [ ] **Step 1: 의도와 상태를 바꾼다**

`CustomCameraViewModel.kt`:

```kotlin
data class OnClickShutter(val format: CameraCacheFormat) : CustomCameraIntent
```

`CustomCameraState`에 필드를 더한다.

```kotlin
val isCapturing: Boolean = false,
```

핸들러를 바꾼다.

```kotlin
private fun handleOnClickShutter(intent: CustomCameraIntent.OnClickShutter) {
    // 저장이 끝나야 화면이 넘어간다. 그 사이 다시 누르면 새 파일을 만들어 또 촬영하고,
    // 파일명이 초 단위라 같은 초의 두 촬영은 서로를 덮는다
    if (state.value.isCapturing) return

    updateState { copy(isCapturing = true) }
    postSideEffect(CustomCameraEffect.CaptureImage(file = createCameraCacheFileUseCase(intent.format)))
}

private fun handleOnCaptureSaved(intent: CustomCameraIntent.OnCaptureSaved) {
    updateState { copy(isCapturing = false) }

    val uri = createCameraCacheUriUseCase(file = intent.file)
    postSideEffect(CustomCameraEffect.NavigateToConfirm(uri = uri))
}

private fun handleOnCaptureFailed() {
    updateState { copy(isCapturing = false) }
    postSideEffect(CustomCameraEffect.CaptureFailed)
}
```

`processIntent`의 분기를 `is CustomCameraIntent.OnClickShutter -> handleOnClickShutter(intent)`로 바꾼다.

- [ ] **Step 2: Route 가 포맷을 정한다**

`CustomCameraRoute.kt`에서 포맷을 한 번 계산해 두 곳에 쓴다.

```kotlin
// 배경 촬영은 누끼를 안 타고 곧장 업로드된다. 무손실의 이득이 없고 용량만 커진다
val cacheFormat = if (returnResultOnly) CameraCacheFormat.JPEG else CameraCacheFormat.PNG
```

셔터 결선을 바꾼다.

```kotlin
onClickShutter = { viewModel.processIntent(CustomCameraIntent.OnClickShutter(cacheFormat)) },
```

Task 9에서 임시로 넣은 `format = CameraCacheFormat.JPEG`를 `format = cacheFormat`으로 바꾼다.

- [ ] **Step 3: 실패하면 만든 파일을 지운다**

`CustomCameraRoute.kt`의 촬영 저장 블록에서 실패 갈래에 삭제를 더한다. 쓰다 끊기면 잘린 파일이
캐시에 남고 그 디렉토리에는 지우는 코드가 없다(OQ-P-279).

```kotlin
val saved = runCatching {
    withContext(Dispatchers.IO) {
        saveViewfinderCapture(
            captured = captured,
            rotationDegrees = rotation,
            viewfinderRect = viewfinderRect,
            feedRect = feedRect,
            isFrontFacing = isFrontFacing,
            format = cacheFormat,
            file = file,
        )
    }
}.isSuccess

if (!saved) {
    withContext(Dispatchers.IO) { file.delete() }
}
```

- [ ] **Step 4: 셔터를 잠근다**

`CustomCameraScreen`이 셔터 버튼을 그리는 자리에 `enabled = !state.isCapturing`(또는 그 컴포넌트가
받는 동등한 파라미터)을 준다. 컴포넌트가 `enabled`를 안 받으면 `onClick`을 빈 람다로 바꾸지 말고
**컴포넌트에 `enabled` 파라미터를 더한다** — 눌리는 것처럼 보이는데 아무 일도 안 나는 것이 더 나쁘다.

- [ ] **Step 5: 전체 검사와 커밋**

Run: `./gradlew test ktlintCheck :app:assembleDebug`

```bash
git add feature/camera/impl/src/main/java/com/teamyg/parfait/feature/camera/impl/
git commit -m "feat: 토핑 촬영만 무손실로 남기고 저장 중 셔터를 잠근다"
```

---

# 마무리

## Task 11: 실기기 확인과 문서 갱신

**Files:**
- Modify: `parfait/specs/2026-08-23-segmentation-preprocessing.md`
- Modify: `parfait/specs/README.md`
- Modify: `parfait/synthesis/open-questions.md`

**Interfaces:**
- Consumes: 1~10의 결과
- Produces: as-built 기록

⚠️ 문서는 `TJYG-Android`가 아니라 **이 계획이 있는 repo**에 있다. 브랜치를 따로 딴다.

- [ ] **Step 1: 회귀를 확인한다**

토핑 만들기 전체 흐름과 C-301 배경 편집 흐름을 실기기에서 한 번씩 통과시킨다. 특히 본다.

- 배경 촬영이 여전히 JPEG로 저장되고 업로드가 성공하는가
- 최근 이미지 목록에서 고른 배경이 올라가는가(Task 4가 확장자를 바꿨다)
- 셔터 연타가 파일을 덮지 않는가(Task 10을 했다면)

- [ ] **Step 2: 스펙에 as-built 절을 더한다**

근거 등급 표의 각 항목이 **들어갔는지 버려졌는지**를 적는다. 버린 것은 이유와 측정 결과를 함께
적는다. 버린 기록이 다음 사람에게는 결과다.

- [ ] **Step 3: 미결을 갱신한다**

- OQ-P-278 — 확대 가드의 판정 결과
- OQ-P-279 — PNG를 넣었다면 실제 크기 증가분
- OQ-P-280 — API 대역별 회전 관찰 결과
- OQ-P-282 — 배치 토핑 크기 전후 비교 결과

- [ ] **Step 4: 인덱스와 커밋**

`parfait/specs/README.md`의 해당 행에 as-built 요약을 더하고 `status`를 `implemented`로 바꾼 뒤
`specs/archive/`로 옮긴다. 계획 문서도 `plans/archive/`로 옮기고 `plans/README.md`에 등록한다.

```bash
git add parfait/
git commit -m "docs: 세그멘테이션 전처리 as-built 를 기록한다"
```

---

## 자체 점검

**스펙 커버리지**

| 스펙 항목 | 태스크 |
|---|---|
| `ImageCapture` 촬영 품질 상향 | Task 1 |
| API 26·27 EXIF 회전 보정 | Task 2·3 |
| API 28 이상 추가 보정(조건부) | Task 5 Step 2가 판정, 필요하면 Task 3 확장 |
| 짧은 변 512 하한(조건부) | Task 6·7 |
| 확대 총 픽셀 상한 | Task 6 |
| 촬영 저장 PNG(조건부) | Task 8·9·10 |
| 배경 촬영 경로 분리 | Task 10 |
| 최근 이미지 확장자 바이트 판정 | Task 4 (스펙보다 앞당겼다 — 지금도 참인 결함이다) |
| 촬영 중 상태·셔터 비활성 | Task 10 |
| PNG 저장 실패 시 파일 삭제 | Task 10 Step 3 |
| 회전 전 판 회수 | Task 3 Step 2 |
| EXIF URI 재개방과 실패 로그 | Task 3 Step 2 |
| `decodeImage` KDoc 경계 명시 | Task 7 Step 1 |
| 순수 함수 2종 JVM 테스트 | Task 2·6 |
| 고정 사진 세트 6장 | Task 5 |
| 손실 3벌 비교 | Task 5 Step 3 |
| 배치까지 끝내는 확인 | Task 5 Step 4 |

**스펙이 범위 밖으로 둔 것은 태스크가 없다** — 다운샘플, 뷰파인더 크롭, 색공간·`Bitmap.Config`·HEIC,
대비 정규화, 후처리, EXIF 미러링, 갤러리 원본 손실, `SystemCameraRoute` 저장 포맷.

**타입 일관성**

- `CameraCacheFormat` — Task 8이 정의하고 9·10이 쓴다. 이름이 같다.
- `computeUpscaleTarget`·`ScaledSize` — Task 6이 정의하고 7이 쓴다.
- `exifOrientationToDegrees` — Task 2가 정의하고 3이 쓴다.
- `CustomCameraIntent.OnClickShutter` — Task 10에서 `data object`에서 `data class`로 바뀐다.
  Task 9까지는 기존 형태 그대로다.
- `saveViewfinderCapture` — Task 9가 `format` 파라미터를 더하고 같은 태스크에서 호출부를 맞춘다.
  Task 10이 그 인자의 값만 바꾼다.
