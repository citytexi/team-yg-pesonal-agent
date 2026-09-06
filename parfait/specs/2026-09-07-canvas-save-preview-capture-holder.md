---
id: canvas-save-preview-capture-holder
title: 캔버스 저장 미리보기 캡처 전달 (Capture Holder)
status: draft
category: behavior-spec
platforms: android
verified: 2026-09-07
related_code:
  - CanvasMainRoute.kt#CanvasMainRoute
  - CanvasImageSaveRoute.kt#CanvasImageSaveRoute
  - CanvasImageSaveScreen.kt#CanvasImageSaveScreen
  - CanvasCaptureCache.kt#writeToCanvasCaptureCache
  - CanvasCaptureCache.kt#readCanvasCaptureCache
  - NavKeyCanvasImageSave.kt#NavKeyCanvasImageSave
  - NavKeyCanvasImageSave.kt#CanvasImageSaveResult
  - CanvasMainViewModel.kt#CanvasMainEffect.RequestCanvasCaptureForPreview
  - ParfaitImageLoader.kt#newParfaitImageLoader
  - ToppingAlphaMaskCache.kt#loadToppingAlphaMask
related_adr:
related_spec: c001-canvas-gallery-save
related_architecture:
  - navigation-flow.md
  - state-management.md
tags: [spec, parfait, canvas, gallery, c-001, save-preview]
---

# Spec: 캔버스 저장 미리보기 캡처 전달

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처(source of truth). 본문은 설계 내용에 집중.

## 목표

저장 미리보기 화면에 진입했을 때 캡처 이미지가 곧바로 보이게 한다.

지금은 캔버스 메인이 캡처한 비트맵을 메모리에 들고 있으면서도 그것을 미리보기에 넘기지 못한다.
`NavKeyCanvasImageSave`가 `@Serializable`이라 비트맵을 실을 수 없어 캐시에 PNG로 굽고
**절대경로만** 넘기고, 미리보기는 그 경로를 `AsyncImage`로 다시 읽는다. 그래서 진입할 때마다
`파일 열기 → 전체 해상도 PNG 디코드 → 크로스페이드`를 거치고, 그동안 화면에는 테두리만 있는 빈
프레임이 보인다.

이 지연은 캐시 설정을 고쳐서 줄일 수 있는 종류가 아니다. 미리보기의 Coil 요청은
`addLastModifiedToFileCacheKey(true)`를 걸고 있는데, 이것은 `FileUriKeyer`가 메모리 캐시 키를
`"$uri-$lastModified"`로 만들게 한다. 캡처할 때마다 파일의 수정 시각이 바뀌므로 **이 화면은 원리적으로
메모리 캐시에 맞을 수 없다.** 고정 파일명 때문에 이전 캡처가 다시 뜨는 것을 막으려고 넣은 장치이고
그 목적대로 동작하므로, 이 조항을 되돌리는 것이 아니라 **정상 경로가 파일을 거치지 않게** 만든다.

## 범위

- **포함**:
  - 캡처 비트맵을 화면 사이로 나르는 홀더 신설.
  - 미리보기가 비트맵을 직접 그리는 경로와, 비트맵이 없을 때의 폴백 경로.
  - 캔버스 메인이 캡처를 홀더에 담는 자리.
  - 홀더 계약의 JVM 유닛 테스트.
- **제외**:
  - **저장 버튼을 누른 뒤 화면이 전환되기까지의 지연.** 전체 해상도 PNG 압축이 여전히 `goTo` 앞을
    막는다. 이 압축을 비동기로 내리면 캡처·캐시 쓰기 실패를 진입 전에 알리는 지금 동작
    (`canvas_main_capture_failure`)이 성립하지 않아, 이번 라운드에서는 손대지 않기로 확정했다.
  - **저장을 확정한 뒤의 파일 재디코드.** `readCanvasCaptureCache`가 그대로 남는다. 홀더를 저장
    완료 시점까지 살려 두면 없앨 수 있으나, 홀더 수명을 미리보기 진입 시점으로 끊는 쪽을 택했다
    (아래 「홀더 수명」).
  - **`feature/groups/canvas/api`의 공개 계약.** `NavKeyCanvasImageSave`·`CanvasImageSaveResult`·
    `CANVAS_IMAGE_SAVE_RESULT_KEY` 셋 다 그대로다. 백스택 구성과 화면 전환 애니메이션도 바뀌지 않는다.
  - **`CanvasCaptureCache`의 두 함수**와 갤러리 저장 권한 왕복.
  - 캡처 파일을 지우는 자리(OQ-P-365 ①). 이번 라운드가 만들지 않는다.

## API / 인터페이스

### 신설: `CanvasCaptureHolder`

`feature/groups/canvas/impl/src/main/kotlin/.../impl/util/CanvasCaptureHolder.kt`

```kotlin
internal object CanvasCaptureHolder {
    fun put(bitmap: Bitmap)
    fun take(): Bitmap?
}
```

- `put` — 캔버스 메인이 캡처한 비트맵을 담는다. 이전 값이 있으면 덮어쓴다.
- `take` — 담긴 비트맵을 돌려주고 홀더를 비운다. **1회성**이라 두 번째 호출은 `null`이다.
  비어 있을 때도 `null`이다.

같은 디렉토리의 `ToppingAlphaMaskCache`가 이미 파일 최상위 전역 캐시를 두는 선례다. 홀더를
Hilt로 주입하지 않는 이유는 미리보기 화면에 ViewModel이 없어(그릴 것이 인자뿐이라 만들지 않았다)
주입 지점이 없기 때문이다.

`put`은 이펙트 수집부에서, `take`는 컴포지션에서 불린다. 둘 다 메인 스레드라 잠금을 두지 않되,
호출 자리가 늘어날 때 전제가 조용히 깨지지 않도록 담는 필드를 `@Volatile`로 두고 KDoc에 이 전제를
적는다. `ToppingAlphaMaskCache`가 자기 캐시를 `synchronized`로 감싼 것은 로딩 컨텍스트를 그 파일이
정하지 않기 때문이고, 이쪽은 두 호출 자리가 코드에 다 보인다는 점이 다르다.

### 변경: `CanvasImageSaveScreen`

```kotlin
@Composable
internal fun CanvasImageSaveScreen(
    bitmap: ImageBitmap?,
    fallbackImagePath: String,
    date: LocalDate,
    onClickClose: () -> Unit,
    onClickSave: () -> Unit,
    modifier: Modifier = Modifier,
)
```

- `bitmap` — 캡처를 그대로 그릴 비트맵. `null`이면 폴백 경로를 탄다.
- `fallbackImagePath` — 기존 `imagePath`의 개명. 이름이 이 인자가 비상용임을 말한다.

## 동작 / 상태

### 정상 경로

```
C-001 캔버스 메인
  RequestCanvasCaptureForPreview
    ─▶ graphicsLayer.toImageBitmap().asAndroidBitmap()
    ─▶ writeToCanvasCaptureCache(Dispatchers.IO)      // 폴백 파일. 지금과 같이 성공해야 진입
         성공 ─▶ CanvasCaptureHolder.put(bitmap)
                 goTo(NavKeyCanvasImageSave(imagePath, date))
         실패 ─▶ 토스트(canvas_main_capture_failure)
                        │
        C-001 저장 미리보기
          remember { CanvasCaptureHolder.take()?.asImageBitmap() }
            비트맵 있음 ─▶ Image(bitmap, ContentScale.Fit)      // 디스크·디코드·페이드 없음
            비트맵 없음 ─▶ AsyncImage(fallbackImagePath)        // 아래 「복원 폴백」
```

`asImageBitmap()`은 픽셀을 복사하지 않고 감싸기만 한다. 그래서 정상 경로에서 미리보기가 그리는
비트맵은 캔버스가 캡처한 바로 그 픽셀이고, 사용자가 보고 확정한 그림과 갤러리에 남는 그림이 같아야
한다는 기존 계약이 더 강해진다.

두 분기는 **이미지를 내는 방법만** 다르다. 바깥 `Box`의 폭 · 종횡비(`CANVAS_AREA_ASPECT_RATIO`) ·
`Gray500` 테두리 · `ContentScale.Fit` · `contentDescription`
(`canvas_image_save_preview_content_description`)은 두 분기가 같은 값을 쓴다. 접근성 낭독이 경로에
따라 달라지지 않게 하려는 것이고, 그래서 분기는 프레임 안쪽에만 둔다.

### 복원 폴백

홀더는 프로세스 사망을 넘기지 못한다. 반면 `NavKeyCanvasImageSave`는 직렬화돼 복원되므로, 복원된
미리보기는 `take()`에서 `null`을 받는다. 이때는 `fallbackImagePath`를 지금과 똑같이 `AsyncImage`로
읽는다. 폴백 요청의 `addLastModifiedToFileCacheKey(true)`는 **유지한다** — 파일명이 고정이라는 사실은
복원 뒤에도 그대로이고, 그 방어가 없으면 복원된 화면이 다른 날의 캡처를 그릴 수 있다.

폴백 경로에서 파일까지 사라졌다면 지금과 같이 조용히 빈 프레임이 되고, 확정하면
`readCanvasCaptureCache` 실패로 저장 실패 토스트가 뜬다(OQ-P-364 그대로).

### 홀더 수명

미리보기 Route가 컴포지션 진입 직후 `remember { take() }`로 꺼내고, 그 자리에서 홀더가 빈다.
이후 비트맵을 붙드는 것은 미리보기 컴포지션이며, 화면이 사라지면 함께 놓인다. 취소로 나가든
확정으로 나가든 홀더에 상주분이 남지 않는다.

저장 확정 경로가 홀더를 다시 보지 않는 것은 이 수명의 결과다. 캔버스 메인은 지금과 같이
`readCanvasCaptureCache`로 파일에서 읽는다. 미리보기가 사라지며 비트맵을 놓은 뒤에 캔버스가 새
비트맵을 디코드하므로 두 벌이 동시에 메모리에 남지 않는다.

### 오늘 캔버스와 지난 캔버스

저장 아이콘은 날짜바에 있고 노출 조건은 날짜가 아니라 `CanvasMainUiState.isCanvasSaveVisible`
(그릴 것이 있는가)이다. 그래서 오늘 캔버스와 지난 캔버스가 모두 이 흐름에 들어온다. 둘은 같은
경로를 타며 분기가 없다.

날짜는 계속 `NavKeyCanvasImageSave.date`가 나르고 **홀더는 비트맵만 담는다.** 표시할 날짜의 출처를
하나로 두려는 것이고, 그래서 미리보기의 날짜 라벨은 캡처 시점 값으로 고정된다.

저장 성공 토스트의 날짜는 `handleSaveCapturedCanvas`가 `launch` 밖에서 붙드는 `selectedDate`인데,
미리보기가 앞에 서 있는 동안 캔버스 메인은 백스택 아래라 컴포지션에서 빠져 있고 날짜를 바꿀 수단이
없다. 이 라운드는 그 자리를 건드리지 않는다.

## 파일 구성

| 파일 | 처리 | 역할 |
|---|---|---|
| `impl/util/CanvasCaptureHolder.kt` | 신설 | 캡처 비트맵을 화면 사이로 1회 전달 |
| `impl/screen/CanvasImageSaveScreen.kt` | 변경 | 인자 2개로 갈리고 비트맵 분기 추가. `@Preview`도 함께 갱신 |
| `impl/route/CanvasImageSaveRoute.kt` | 변경 | `take()` 한 줄로 비트맵 확보 후 Screen에 전달 |
| `impl/route/CanvasMainRoute.kt` | 변경 | `onSuccess` 안, `goTo` 직전에 `put(bitmap)` 한 줄 |
| `impl/src/test/.../util/CanvasCaptureHolderTest.kt` | 신설 | 홀더 계약 4건 |

`feature/groups/canvas/api`는 변경이 없다.

## 검증

**JVM 유닛** — `CanvasCaptureHolderTest`. `Bitmap`은 `mockk`로 세운다. 모듈이 이미
`parfait.test.unit` 플러그인을 쓰므로 새 소스셋도 빌드 설정 변경도 없다.

- `take`가 `put`한 비트맵을 돌려준다.
- `take`는 한 번만 준다(두 번째 호출은 `null`).
- `put`이 이전 비트맵을 덮어쓴다.
- 비어 있을 때 `take`는 `null`이다.

**수동 확인**(계측 테스트 소스셋이 이 모듈에 없어 눈으로 판정한다)

- 오늘 캔버스에서 저장 → 미리보기 진입 즉시 이미지가 보인다.
- 지난 캔버스에서 저장 → 날짜 라벨과 이미지가 그 날의 것이다.
- 미리보기에서 확정 → 갤러리 저장이 성공하고 토스트의 날짜가 맞다.
- 미리보기에서 취소 → 캔버스로 돌아오고, 다시 저장하면 새 캡처가 보인다.

## 주의 / 열린 질문

- **전역 가변 상태가 하나 늘어난다.** 미리보기 화면에 ViewModel이 없다는 기존 결정의 대가이고,
  `take()`를 1회성으로 두어 값이 오래 살지 않게 막는 것이 이 설계의 방어다. 미리보기가 언젠가
  ViewModel을 갖게 되면 이 홀더는 그리로 흡수될 자리다.
- **OQ-P-364 잔존** — 복원된 키가 가리키는 파일이 있으리라는 보장은 여전히 없다. 다만 정상 경로가
  파일에 의존하지 않게 되어 이 미결이 실제로 드러나는 범위는 복원 직후 한 번으로 줄었다.
- **OQ-P-365 ① 잔존** — 저장을 그만둔 캡처가 캐시에 남는 것은 그대로다. ②(연달아 캡처하면 앞선
  미리보기가 다른 그림을 본다)는 미리보기가 백스택에 하나뿐이라 실질적으로 발생하지 않으며,
  홀더도 1회성이라 같은 성질을 갖는다.
- **전역 크로스페이드는 그대로 둔다.** `newParfaitImageLoader`의 `crossfade(true)`는 원격 이미지가
  투명한 자리에서 튀지 않게 하려는 앱 전체의 결정이고, 이 화면은 정상 경로에서 Coil을 쓰지 않게
  되므로 손댈 이유가 없다.
