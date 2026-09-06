# 캔버스 저장 미리보기 캡처 전달 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 저장 미리보기에 진입했을 때 캡처 이미지가 곧바로 보이게 한다. 캡처 비트맵을 1회성 홀더로 건네 정상 경로에서 디스크 왕복과 이미지 디코딩을 없앤다.

**Architecture:** `CanvasCaptureHolder`(전역 `object`, `put`/`take` 2함수) 하나를 둔다. 캔버스 메인이 캡처 직후 `put`하고, 미리보기 Route가 컴포지션 진입 직후 `remember { take() }`로 꺼내 `Image(bitmap)`으로 직접 그린다. `take`는 그 자리에서 홀더를 비우므로 비트맵이 오래 살지 않는다. 홀더가 비어 있으면(프로세스 사망 후 복원) 지금의 `AsyncImage(경로)` 경로를 그대로 탄다. 내비게이션 계약과 백스택은 바뀌지 않는다.

**Tech Stack:** Kotlin, Jetpack Compose, Navigation3, Coil 3, mockk, kotlin.test

**Spec:** [`parfait/specs/2026-09-07-canvas-save-preview-capture-holder.md`](../specs/2026-09-07-canvas-save-preview-capture-holder.md)

## Global Constraints

- **작업 대상 저장소는 `TJYG-Android`**(remote `mash-up-kr/TEAMYG-Android`)이고 브랜치는 `bugfix/#462-canvas-image-preview`다. 이 계획 문서가 있는 저장소가 아니다.
- **커밋하지 않는다.** 사용자가 요청하지 않았다. 각 Task는 변경을 남긴 채로 끝내고 리뷰를 받는다.
- **`feature/groups/canvas/api` 모듈은 건드리지 않는다.** `NavKeyCanvasImageSave`·`CanvasImageSaveResult`·`CANVAS_IMAGE_SAVE_RESULT_KEY` 셋 다 그대로다.
- **`CanvasCaptureCache.kt`의 두 함수(`writeToCanvasCaptureCache`·`readCanvasCaptureCache`)를 건드리지 않는다.** 폴백 파일과 저장 확정 시의 재디코드는 이번 범위 밖이다.
- **저장 확정 경로(`ResultEffect<CanvasImageSaveResult>`)를 건드리지 않는다.** 홀더는 이미 비어 있고, 캔버스 메인은 지금처럼 파일에서 읽는다.
- **주석·KDoc 규약**(`parfait/CLAUDE.md`, 이 저장소 밖에서 일하면 자동으로 닿지 않으므로 여기 싣는다):
  - 코드가 이미 말하는 것은 쓰지 않는다.
  - `@return`·`@param`은 타입·이름이 말하지 못할 때만 단다.
  - 다른 컴포넌트의 현재 상태를 단정하지 않는다(낡는다). 의도와 함정은 쓴다.
- **모든 명령은 `TJYG-Android` 루트에서 실행한다.**

---

### Task 1: 캡처 홀더

**Files:**
- Create: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/util/CanvasCaptureHolder.kt`
- Test: `feature/groups/canvas/impl/src/test/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/util/CanvasCaptureHolderTest.kt`

**Interfaces:**
- Consumes: 없다. 이 Task는 독립적이다.
- Produces: `internal object CanvasCaptureHolder`의 `fun put(bitmap: Bitmap)`(반환 없음)과 `fun take(): Bitmap?`. Task 2가 `take`를, Task 3이 `put`을 부른다. `Bitmap`은 `android.graphics.Bitmap`이다.

이 모듈은 이미 `parfait.test.unit` 플러그인을 쓰고 있어 `build.gradle.kts`를 고칠 필요가 없다. `mockk`와 `kotlin.test`는 그 플러그인이 붙이는 `libs.bundles.test.unit`에 들어 있다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`feature/groups/canvas/impl/src/test/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/util/CanvasCaptureHolderTest.kt`

```kotlin
package com.teamyg.parfait.feature.groups.canvas.impl.util

import android.graphics.Bitmap
import io.mockk.mockk
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertNull
import kotlin.test.assertSame

class CanvasCaptureHolderTest {
    @AfterTest
    fun emptyHolder() {
        // 홀더가 전역이라 앞 테스트가 남긴 값이 다음 테스트로 샌다
        CanvasCaptureHolder.take()
    }

    @Test
    fun take_afterPut_givesSameBitmap() {
        val bitmap = mockk<Bitmap>()

        CanvasCaptureHolder.put(bitmap)

        assertSame(bitmap, CanvasCaptureHolder.take())
    }

    @Test
    fun take_calledTwice_givesNullTheSecondTime() {
        // Given 꺼낸 비트맵은 미리보기가 들고, 홀더는 더 붙들지 않는다
        CanvasCaptureHolder.put(mockk<Bitmap>())
        CanvasCaptureHolder.take()

        assertNull(CanvasCaptureHolder.take())
    }

    @Test
    fun put_overExistingCapture_keepsOnlyTheNewOne() {
        // Given 미리보기를 취소하고 다시 저장하면 앞 캡처가 아직 담겨 있다
        CanvasCaptureHolder.put(mockk<Bitmap>())
        val newer = mockk<Bitmap>()

        CanvasCaptureHolder.put(newer)

        assertSame(newer, CanvasCaptureHolder.take())
    }

    @Test
    fun take_whenEmpty_givesNull() {
        assertNull(CanvasCaptureHolder.take())
    }
}
```

- [ ] **Step 2: 실패를 확인한다**

실행:

```bash
./gradlew :feature:groups:canvas:impl:testDebugUnitTest --tests "*CanvasCaptureHolderTest*"
```

기대: 컴파일 실패. `Unresolved reference: CanvasCaptureHolder`.

- [ ] **Step 3: 홀더를 만든다**

`feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/util/CanvasCaptureHolder.kt`

```kotlin
package com.teamyg.parfait.feature.groups.canvas.impl.util

import android.graphics.Bitmap

/**
 * 캡처한 캔버스를 미리보기 화면으로 한 번 건네는 자리.
 *
 * NavKey 는 직렬화돼 오가므로 비트맵을 실을 수 없다. 그렇다고 파일로 굽고 경로만 넘기면, 캡처한
 * 픽셀이 이미 메모리에 있는데도 미리보기가 그 파일을 다시 열고 디코딩하는 만큼 빈 화면이 보인다.
 * 그 왕복을 없애려고 둔다.
 *
 * [take] 가 한 번만 주고 비우는 것은 비트맵을 오래 붙들지 않으려는 것이다. 꺼낸 뒤로는 미리보기
 * 컴포지션이 들고, 화면이 사라지면 함께 놓인다.
 *
 * 넣는 곳도 꺼내는 곳도 메인 스레드다(이펙트 수집부와 컴포지션). 그 전제가 조용히 깨지지 않게
 * 필드만 [Volatile] 로 둔다 — 부르는 자리가 늘면 잠금이 필요한지 다시 봐야 한다.
 */
internal object CanvasCaptureHolder {
    @Volatile
    private var captured: Bitmap? = null

    fun put(bitmap: Bitmap) {
        captured = bitmap
    }

    fun take(): Bitmap? = captured.also { captured = null }
}
```

- [ ] **Step 4: 테스트 통과를 확인한다**

실행:

```bash
./gradlew :feature:groups:canvas:impl:testDebugUnitTest --tests "*CanvasCaptureHolderTest*"
```

기대: PASS, 4건.

`mockk`가 `android.graphics.Bitmap`을 목킹하지 못해 실패하면 `mockk<Bitmap>()`을 `mockk<Bitmap>(relaxed = true)`로 바꾼다. 테스트는 인스턴스의 동일성만 보므로 동작에 차이가 없다.

- [ ] **Step 5: ktlint를 통과시킨다**

실행:

```bash
./gradlew :feature:groups:canvas:impl:ktlintCheck
```

기대: PASS. 실패하면 `./gradlew :feature:groups:canvas:impl:ktlintFormat`으로 고치고 다시 확인한다.

- [ ] **Step 6: 커밋하지 않는다**

Global Constraints대로 변경을 남긴 채 끝낸다. `git status`로 두 파일이 미추적·수정 상태인지만 확인한다.

---

### Task 2: 미리보기가 비트맵을 받아 그린다

**Files:**
- Modify: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/screen/CanvasImageSaveScreen.kt`
- Modify: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/route/CanvasImageSaveRoute.kt`

**Interfaces:**
- Consumes: Task 1의 `CanvasCaptureHolder.take(): Bitmap?`.
- Produces: `CanvasImageSaveScreen`의 새 시그니처 — 첫 인자가 `bitmap: ImageBitmap?`, 둘째가 `fallbackImagePath: String`(기존 `imagePath`의 개명), 나머지 `date: LocalDate` · `onClickClose: () -> Unit` · `onClickSave: () -> Unit` · `modifier: Modifier`는 그대로다. Task 3은 이 시그니처를 부르지 않는다.

이 Task가 끝난 시점의 앱은 **동작이 지금과 같다.** 아직 아무도 `put`하지 않아 `take()`가 늘 `null`을 주고, 미리보기는 폴백 경로(`AsyncImage`)로 그린다. Task 3이 정상 경로를 켠다.

두 파일을 한 Task로 묶는 이유는 컴파일 단위이기 때문이다. Screen의 시그니처를 바꾸면 유일한 호출부인 Route도 같이 고쳐야 빌드가 된다.

UI 변경이라 이 Task에는 실패하는 테스트를 먼저 쓰는 단계가 없다. 이 모듈에는 계측 테스트 소스셋이 없고, 스펙이 그 신설을 범위 밖으로 확정했다. 대신 컴파일과 Task 3의 수동 확인이 검증을 맡는다.

- [ ] **Step 1: Screen의 KDoc과 시그니처를 바꾼다**

`CanvasImageSaveScreen.kt`에서 KDoc과 함수 머리를 찾는다. 현재 모습:

```kotlin
/**
 * 캔버스를 갤러리에 넣기 전, 무엇이 저장될지 그대로 보여 주는 화면.
 *
 * 저장 자체는 하지 않는다 — 확정을 호출부에 알리기만 하고, 갤러리에 넣는 일과 결과를 알리는
 * 일은 캔버스 메인이 맡는다.
 *
 * @param imagePath 캔버스 메인이 캡처해 캐시에 구운 PNG 의 경로
 */
@Composable
internal fun CanvasImageSaveScreen(
    imagePath: String,
    date: LocalDate,
```

이렇게 바꾼다:

```kotlin
/**
 * 캔버스를 갤러리에 넣기 전, 무엇이 저장될지 그대로 보여 주는 화면.
 *
 * 저장 자체는 하지 않는다 — 확정을 호출부에 알리기만 하고, 갤러리에 넣는 일과 결과를 알리는
 * 일은 캔버스 메인이 맡는다.
 *
 * @param bitmap 캔버스 메인이 캡처해 건넨 그림. 없으면 [fallbackImagePath] 로 그린다
 * @param fallbackImagePath 캡처를 구워 둔 PNG 의 경로. 프로세스가 죽고 이 화면만 복원되면
 *  건네받을 비트맵이 없어 이쪽으로 떨어진다
 */
@Composable
internal fun CanvasImageSaveScreen(
    bitmap: ImageBitmap?,
    fallbackImagePath: String,
    date: LocalDate,
```

- [ ] **Step 2: 이미지 분기를 넣는다**

같은 파일에서 미리보기 프레임 `Box`의 내용을 찾는다. 현재 모습:

```kotlin
            ) {
                AsyncImage(
                    model = ImageRequest
                        .Builder(LocalContext.current)
                        .data(imagePath)
                        // 캡처 파일명이 고정이라(CanvasCaptureCache) 경로만으로는 캐시 키가
                        // 안 갈린다 — 다시 저장한 캔버스를 열어도 이전 캡처가 뜰 수 있다
                        .addLastModifiedToFileCacheKey(true)
                        .build(),
                    contentDescription = stringResource(R.string.canvas_image_save_preview_content_description),
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize(),
                )
            }
```

이렇게 바꾼다. 프레임 `Box` 자체(폭 198.dp · `aspectRatio` · `border`)는 그대로 두고 안쪽만 가른다.

```kotlin
            ) {
                // 낭독이 경로에 따라 달라지면 안 되므로 두 갈래가 같은 문구를 쓴다
                val previewDescription =
                    stringResource(R.string.canvas_image_save_preview_content_description)

                if (bitmap != null) {
                    Image(
                        bitmap = bitmap,
                        contentDescription = previewDescription,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    AsyncImage(
                        model = ImageRequest
                            .Builder(LocalContext.current)
                            .data(fallbackImagePath)
                            // 캡처 파일명이 고정이라(CanvasCaptureCache) 경로만으로는 캐시 키가
                            // 안 갈린다 — 다시 저장한 캔버스를 열어도 이전 캡처가 뜰 수 있다
                            .addLastModifiedToFileCacheKey(true)
                            .build(),
                        contentDescription = previewDescription,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
```

import 두 줄을 추가한다. 이 파일의 import는 알파벳 순으로 정렬돼 있으니 자리를 맞춘다.

```kotlin
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.ImageBitmap
```

- [ ] **Step 3: `@Preview` 호출을 고친다**

같은 파일 맨 아래 `PreviewCanvasImageSaveScreen`의 호출을 바꾼다. 현재 모습:

```kotlin
    CanvasImageSaveScreen(
        imagePath = "",
        date = date,
```

이렇게 바꾼다. 빈 경로를 주던 기존 프리뷰와 렌더 결과가 같다.

```kotlin
    CanvasImageSaveScreen(
        bitmap = null,
        fallbackImagePath = "",
        date = date,
```

- [ ] **Step 4: Route가 홀더에서 꺼내 넘기게 한다**

`CanvasImageSaveRoute.kt`에서 `resultEventBus`를 잡는 줄 아래에 비트맵을 꺼내는 줄을 넣는다. 현재 모습:

```kotlin
    val resultEventBus = LocalResultEventBus.current

    YGScaffoldV2(modifier = modifier) { innerPadding ->
        CanvasImageSaveScreen(
            imagePath = navKey.imagePath,
            date = LocalDate.parse(navKey.date),
```

이렇게 바꾼다.

```kotlin
    val resultEventBus = LocalResultEventBus.current

    // 한 번 꺼내면 홀더는 비고 이 컴포지션이 그림을 든다. 프로세스가 죽고 이 화면만 복원되면
    // 홀더가 비어 있어 navKey 의 경로로 떨어진다
    val capturedBitmap = remember { CanvasCaptureHolder.take()?.asImageBitmap() }

    YGScaffoldV2(modifier = modifier) { innerPadding ->
        CanvasImageSaveScreen(
            bitmap = capturedBitmap,
            fallbackImagePath = navKey.imagePath,
            date = LocalDate.parse(navKey.date),
```

import 세 줄을 추가한다. 자리는 이 파일의 정렬 순서에 맞춘다.

```kotlin
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asImageBitmap
import com.teamyg.parfait.feature.groups.canvas.impl.util.CanvasCaptureHolder
```

- [ ] **Step 5: 컴파일과 유닛 테스트를 확인한다**

실행:

```bash
./gradlew :feature:groups:canvas:impl:compileDebugKotlin :feature:groups:canvas:impl:testDebugUnitTest
```

기대: 둘 다 PASS. `CanvasImageSaveScreen`을 부르는 곳은 `CanvasImageSaveRoute`와 이 파일의 `@Preview` 둘뿐이므로 다른 호출부가 깨졌다는 오류가 나오면 안 된다.

- [ ] **Step 6: ktlint를 통과시킨다**

실행:

```bash
./gradlew :feature:groups:canvas:impl:ktlintCheck
```

기대: PASS. 실패하면 `ktlintFormat`으로 고치고 다시 확인한다.

- [ ] **Step 7: 커밋하지 않는다**

`git diff --stat`으로 두 파일만 바뀌었는지 확인하고 끝낸다.

---

### Task 3: 캔버스 메인이 캡처를 홀더에 담는다

**Files:**
- Modify: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/route/CanvasMainRoute.kt`

**Interfaces:**
- Consumes: Task 1의 `CanvasCaptureHolder.put(bitmap: Bitmap)`. Task 2가 만든 소비 측(`take`)이 이 값을 받는다.
- Produces: 없다. 이 Task가 정상 경로를 켜고 흐름이 닫힌다.

이 Task 하나가 사용자가 보는 변화를 만든다. 앞의 둘은 동작이 지금과 같았다.

- [ ] **Step 1: 캡처를 홀더에 담는다**

`CanvasMainRoute.kt`에서 `CanvasMainEffect.RequestCanvasCaptureForPreview` 분기를 찾는다. 현재 모습:

```kotlin
                is CanvasMainEffect.RequestCanvasCaptureForPreview -> {
                    val bitmap = graphicsLayer.toImageBitmap().asAndroidBitmap()
                    val selectedDate = viewModel.state.value.selectedDate

                    withContext(Dispatchers.IO) { bitmap.writeToCanvasCaptureCache(context) }
                        .onSuccess { file ->
                            navigator.goTo(
                                destination = NavKeyCanvasImageSave(
                                    imagePath = file.absolutePath,
                                    date = selectedDate.toString(),
                                ),
                            )
                        }.onFailure { toastPolicy.showError(captureFailureMessage) }
                }
```

`goTo` 앞에 한 줄을 넣는다. 나머지는 한 글자도 바꾸지 않는다 — 파일 쓰기가 성공해야 진입하는 순서도, 실패 토스트도 그대로다.

```kotlin
                is CanvasMainEffect.RequestCanvasCaptureForPreview -> {
                    val bitmap = graphicsLayer.toImageBitmap().asAndroidBitmap()
                    val selectedDate = viewModel.state.value.selectedDate

                    withContext(Dispatchers.IO) { bitmap.writeToCanvasCaptureCache(context) }
                        .onSuccess { file ->
                            // 미리보기가 파일을 다시 열지 않도록 방금 캡처한 그림을 그대로 건넨다.
                            // 구워 둔 파일은 프로세스가 죽고 미리보기만 복원됐을 때 쓰인다
                            CanvasCaptureHolder.put(bitmap)
                            navigator.goTo(
                                destination = NavKeyCanvasImageSave(
                                    imagePath = file.absolutePath,
                                    date = selectedDate.toString(),
                                ),
                            )
                        }.onFailure { toastPolicy.showError(captureFailureMessage) }
                }
```

import 한 줄을 추가한다. 이 파일에는 같은 패키지의 `writeToCanvasCaptureCache`·`readCanvasCaptureCache` import가 이미 있으니 그 곁에 둔다.

```kotlin
import com.teamyg.parfait.feature.groups.canvas.impl.util.CanvasCaptureHolder
```

- [ ] **Step 2: 컴파일과 유닛 테스트를 확인한다**

실행:

```bash
./gradlew :feature:groups:canvas:impl:compileDebugKotlin :feature:groups:canvas:impl:testDebugUnitTest
```

기대: 둘 다 PASS.

- [ ] **Step 3: ktlint를 통과시킨다**

실행:

```bash
./gradlew :feature:groups:canvas:impl:ktlintCheck
```

기대: PASS.

- [ ] **Step 4: 앱을 설치한다**

실행:

```bash
./gradlew :app:installDebug
```

기대: `BUILD SUCCESSFUL`. 기기나 에뮬레이터가 연결돼 있어야 한다. `adb devices`로 먼저 확인한다.

- [ ] **Step 5: 기기에서 네 갈래를 눈으로 확인한다**

이 모듈에 계측 테스트 소스셋이 없어(스펙이 신설을 범위 밖으로 확정했다) 여기까지가 검증이다. 그룹 하나에 들어가 캔버스를 연 뒤 확인한다. 저장 아이콘은 날짜 버튼 오른쪽에 있고, 캔버스에 배경도 토핑도 없으면 아이콘 자체가 나오지 않는다.

1. **오늘 캔버스** — 저장 아이콘을 누른다. 미리보기가 뜨는 순간 이미 이미지가 보여야 한다. 빈 프레임이 잠깐이라도 보이면 실패다.
2. **지난 캔버스** — 날짜를 바꿔 내용이 있는 지난 날짜를 고르고 저장 아이콘을 누른다. 이미지가 곧바로 보이고, 아래 날짜 라벨이 그 날짜여야 한다.
3. **확정** — 미리보기에서 저장을 누른다. 캔버스로 돌아오고 저장 성공 토스트의 날짜가 방금 저장한 캔버스의 날짜여야 한다. 갤러리 앱에서 실제 파일도 확인한다.
4. **취소 후 재진입** — 미리보기를 닫고 다른 날짜의 캔버스에서 다시 저장한다. 앞서 본 캡처가 아니라 새 캡처가 보여야 한다.

결과를 갈래별로 적어 보고한다. 실패한 갈래가 있으면 고치기 전에 무엇이 어떻게 보였는지 먼저 남긴다.

- [ ] **Step 6: 커밋하지 않는다**

`git status`로 이번 라운드가 남긴 파일이 신규 2개(`CanvasCaptureHolder.kt`·`CanvasCaptureHolderTest.kt`)와 수정 3개(`CanvasImageSaveScreen.kt`·`CanvasImageSaveRoute.kt`·`CanvasMainRoute.kt`)인지 확인하고 끝낸다.

---

## 검증 요약

| 항목 | 수단 | Task |
|---|---|---|
| 홀더 계약 4건 | JVM 유닛(`CanvasCaptureHolderTest`) | 1 |
| 시그니처 변경이 호출부를 깨지 않음 | `compileDebugKotlin` | 2 |
| 정상 경로에서 이미지가 곧바로 보임 | 수동(오늘·지난 캔버스) | 3 |
| 날짜 라벨이 캡처 시점 값 | 수동(지난 캔버스) | 3 |
| 저장 확정이 여전히 동작 | 수동(갤러리 확인) | 3 |
| 재진입 시 새 캡처 | 수동(취소 후 다른 날짜) | 3 |

복원 폴백(`AsyncImage`)은 수동으로도 재현이 번거로워(프로세스를 죽이고 미리보기만 복원시켜야 한다) 확인 대상에 넣지 않았다. 이 갈래는 이번 라운드가 코드를 바꾸지 않고 조건문 한쪽으로 옮기기만 한 경로다.
