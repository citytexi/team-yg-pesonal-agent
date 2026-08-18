---
id: segmentation-pipeline-hardening
title: 카메라·갤러리 → 세그멘테이션 파이프라인 보강 + YGScaffoldV2 이관 (segmentation pipeline hardening)
status: implemented
category: behavior-spec
platforms: android
verified: 2026-08-18
related_code: ImageSegmentationRepositoryImpl.kt#segmentImage, ImageSegmentationRepositoryImpl.kt#saveToCacheAsPng, SegmentationViewModel.kt#SegmentationViewModel, SegmentationRoute.kt#SegmentationRoute, PictureConfirmRoute.kt#PictureConfirmRoute, CustomCameraViewModel.kt#CustomCameraEffect, CanvasMainRoute.kt#CanvasMainRoute, CanvasMainViewModel.kt#handleCacheImage, Navigator.kt#Navigator, YGScaffoldV2.kt#YGScaffoldV2, EntryBuilder.kt#featureCameraEntryBuilder, EntryBuilder.kt#featureCustomGalleryEntryBuilder, EntryBuilder.kt#featureSegmentationEntryBuilder, SegmentationMask.kt#maskSubjectPixels, SegmentationCacheDir.kt#clearFiles, ClearSegmentationCacheUseCase.kt#ClearSegmentationCacheUseCase, Navigator.kt#popUpTo
related_adr: ADR-0012, ADR-0011, ADR-0020
related_spec: ygscaffold-v2-common-loading-error, c103-segmentation-topping-edit, c101-camera-picture-confirm, c102-custom-gallery-picker
related_architecture: navigation-flow, data-layer, design-system, state-management
supersedes:
superseded_by:
tags: [spec, parfait]
---

# Spec: 카메라·갤러리 → 세그멘테이션 파이프라인 보강 + YGScaffoldV2 이관

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처(source of truth). 본문은 설계 내용에 집중.

## 목표

카메라·갤러리로 사진을 받아 세그멘테이션까지 가는 경로에서 **크래시 셋과 미결 셋을 닫고**,
같은 라운드에 `camera`·`gallery`·`segmentation` 세 모듈을 `YGScaffoldV2`로 이관한다.

이 경로는 지금 세 군데에서 깨진다. 카메라를 취소하면 `null`이 결과 버스를 타고 캔버스로 흘러
크래시하고, 세그멘테이션 마스크가 비면 `Result` 밖으로 raw throw가 나가며, 원본 디코드 실패는
아무도 잡지 않는다. 여기에 토핑 생성 경로 전체의 닫기 버튼이 빈 람다라 출구가 없고, 캐시 PNG는
쌓이기만 한다.

세 모듈 파일을 어차피 다 여는 라운드라 스캐폴드 이관을 같이 태운다. 두 번 여는 값을 아낀다.

## 범위

- **포함**
  - `segmentImage` 재작성 — 픽셀 접근 방식, 마스크 null 처리, 마스크 크기 검증
  - 캐시 PNG 전용 디렉토리 + 진입 시 정리 (OQ-P-003 ③)
  - `SegmentationViewModel`의 디코드 실패 흡수
  - 죽은 결과 경로 제거 — `CanvasMainIntent.CacheImage` 계열, `CustomCameraEffect.ReturnResult`
  - `Navigator`에 타입 기준 pop API 신설 + 닫기 버튼 결선 (OQ-P-055 ②)
  - `YGScaffoldV2` 이관 8개 엔트리 + Screen에서 `YGToastHost` 제거
  - `NavKeyCanvasMove` 계열 죽은 코드 삭제
  - JVM 유닛 테스트 신설 — 세 모듈은 현재 테스트 0건이다
- **제외**
  - **세그멘테이션 재시도 동선** — `SegmentationException.ModuleNotReady`는 "잠시 후 재시도하면
    해결"인데 수단이 없다. 재시도 버튼 디자인이 미확정이고, 실행을 `init`에서 꺼내는 구조 변경이
    따라온다. OQ-P-003 ①에 남긴다
  - **원본 디코드 다운샘플** — 고화질 보존을 택했다. OOM 위험은 남는다([주의](#주의--열린-질문))
  - **최근 이미지 저장** — 저장 시점이 업로드 확정(C-106)이고 저장 대상이 테두리 적용 전 알맹이라
    이 라운드가 정할 것이 아니다. C-106 후속 몫
  - **`kotlinx-coroutines-play-services` 도입** — `Tasks.await` 세 곳이 이미 `Dispatchers.IO`
    안이라 메인 스레드를 막지 않는다. 의존성 하나 값을 못 한다
  - **도달 불가 화면 삭제** — `NavKeyCameraSystem`·`NavKeySystemGalleryPicker`는 엔트리에
    등록됐지만 `goTo` 하는 곳이 없다. 이관만 하고 존폐는 건드리지 않는다

## 동작 / 상태

### segmentImage 재작성

현행은 마스크가 참인 픽셀마다 `Bitmap.getPixel`을 부른다. 픽셀당 JNI 왕복이고, 결과를 담을
`IntArray`를 따로 만들어 원본과 배열 둘을 동시에 들고 있다.

바꾼 뒤:

1. `Bitmap.getPixels`로 원본 픽셀을 **한 번에** 배열로 읽는다
2. 같은 배열을 훑으며 마스크가 거짓인 자리를 투명으로 지우고, 참인 자리에서 bounding box를 넓힌다
3. 그 배열로 subject 비트맵을 만든다

배열 하나로 끝나고 JNI 호출이 픽셀 수만큼 사라진다. bounding box 수집은 지금처럼 같은 루프 안이다.

| 조건 | 현행 | 신규 |
|---|---|---|
| `foregroundConfidenceMask == null` | `error()` raw throw. `try` 밖 `withContext` 안이라 예외 매핑도 안 탄다 | `Result.failure(SegmentationException.Process)` |
| 마스크 버퍼 용량 ≠ `width * height` | 검사 없음. 어긋나면 조용히 잘못 읽는다 | `Result.failure(SegmentationException.Process)` |
| 감지 픽셀 0 | `subjectBounds = null` 반환 | 그대로 |

첫 줄이 OQ-P-004 ②를 닫는다. 둘째 줄은 `InputImage.fromBitmap`이 회전 0으로 만들어져 지금은
치수가 일치하지만, 그 일치가 계약으로 적혀 있지 않아 방어한다.

`trimmedSubjectImagePath` 생성(PR #290)은 그대로 둔다. 같은 루프가 낸 bounding box 위에서 만든다.

### 캐시 PNG 정리

현행은 `cacheDir` 바로 밑에 타임스탬프 이름으로 떨구고 지우는 곳이 없다. 세그멘테이션 1회에
subject·trimmed 2장, 편집을 마칠 때마다 알맹이·최종본 2장이 더 는다.

- 저장 위치를 `cacheDir` 하위 **세그멘테이션 전용 디렉토리**로 옮긴다. `cacheDir`를 쓰는 다른
  소비자(카메라 캐시)는 이미 자기 서브디렉토리를 쓰고 최근 이미지는 `filesDir`에 있어, 이 디렉토리만
  비우면 남의 것을 건드리지 않는다
- 파일 이름을 밀리초 대신 `File.createTempFile`이 짓게 한다 — 한 번의 세그멘테이션이 subject와
  trimmed를 연달아 저장해서 같은 밀리초에 두 번 떨어질 수 있고, 그러면 뒤엣것이 앞엣것을 덮는다
- **세그멘테이션 진입 시 그 디렉토리를 통째로 비운다** — 리포지토리에 `clearSegmentationCache`,
  도메인에 `ClearSegmentationCacheUseCase`를 두고 `SegmentationViewModel`이 디코드보다 먼저 부른다

진행 중인 흐름을 지울 위험은 없다. 새 흐름은 캔버스에서만 시작하고, 캔버스로 돌아가려면
이전 흐름 화면들이 백스택에서 이미 걷혀야 한다. 누적 상한은 **직전 흐름 1회분**이 된다.

OQ-P-003 ③을 닫는다.

### 죽은 결과 경로 제거

`CanvasMainRoute`는 `ResultEffect<String>`으로 결과를 받아 `CanvasMainIntent.CacheImage`를 쏜다.
그 인텐트는 최근 이미지를 저장하고 세그멘테이션으로 넘긴다 — 설계 의도는 그랬다.

실제로는 이렇게 돈다.

- 사진을 확정하면 `PictureConfirmRoute`가 `NavKeySegmentation`으로 **직행**한다. 캔버스는 그 uri를
  영영 못 본다 → 최근 이미지 목록의 유일한 공급자가 호출되지 않는다
- 카메라를 취소하면 `CustomCameraEffect.ReturnResult`가 `null`을 결과 버스에 흘린다. 결과 키는
  타입 이름이라 nullable 여부로 갈리지 않고, 캔버스로 돌아오는 순간 버퍼에 있던 `null`이
  `CacheImage`로 들어간다

즉 이 경로는 기능은 죽었고 크래시만 살아 있다. 저장 자리가 C-106으로 확정된 이상 되살릴 코드가
아니므로 걷어낸다.

| 심볼 | 처리 |
|---|---|
| `CanvasMainRoute`의 `ResultEffect<String>` | 삭제 |
| `CanvasMainIntent.CacheImage` · `handleCacheImage` · `CanvasMainEffect.NavigateToSegmentation` | 삭제 |
| `CanvasMainViewModel`의 `AddRecentImageUseCase` 주입 | 삭제 |
| `CustomCameraEffect.ReturnResult(uri: String?)` | `Cancel`(인자 없음)로 좁힌다. `sendResult` 없이 `onBack`만 |

`AddRecentImageUseCase`·`RecentImageRepository`는 **남긴다.** C-106이 테두리 적용 전 알맹이를
저장할 때 쓸 물건이고, 지우면 그 라운드가 다시 만들어야 한다. 호출부 0건이 되지만 Hilt 바인딩이라
컴파일은 통과한다.

> `SystemCameraRoute`·`SystemGalleryPickerRoute`도 `sendResult`로 `String`을 보낸다. 두 화면 모두
> 도달 불가라 지금도 그 결과를 받는 곳이 없고, 이 라운드 뒤에도 없다. 존폐는 [주의](#주의--열린-질문) 참고.

### 디코드 실패 흡수

`SegmentationViewModel`은 `DecodeImageUseCase`를 맨몸으로 부른다. URI가 만료됐거나 파일이
손상되면 그 예외가 `init`의 코루틴에서 그대로 터진다. 같은 유스케이스를 쓰는 `ToppingEditViewModel`은
이미 `runCatching`으로 감싸 `null`을 실패로 접는다.

같은 관용구를 쓴다 — 디코드 실패는 `isError` 상태로 흡수한다. `ImageSegmentationRepository`의
시그니처는 바꾸지 않는다. 호출부 둘 중 하나만 구멍이었고, 계약을 `Result`로 넓히면 이미 방어하는
쪽까지 고쳐야 한다. 대신 `decodeImage`가 던진다는 사실을 KDoc에 적는다.

## API / 인터페이스

### Navigator 타입 pop

```kotlin
// core/navigation/.../Navigator.kt
inline fun <reified T : NavKey> popUpTo(): Boolean
fun popUpTo(type: KClass<out NavKey>): Boolean
```

백스택에서 `T` 타입 키를 뒤에서부터 찾아, 있으면 그 위를 전부 걷어내고 `true`를 준다. 없으면
아무것도 하지 않고 `false`다.

기존 `goToSingleClearTop`은 **키 동등성** 비교라 `NavKeyCanvasMain`의 `groupId`를 알아야 한다.
카메라·세그멘테이션 NavKey들은 groupId를 안 들고 다니므로 그대로는 못 쓴다. 대안이던
"NavKey 다섯 개에 groupId 실어 나르기"는 배경 편집처럼 groupId가 무의미한 경로에도 인자를
붙이게 되어 기각했다.

reified 버전은 호출부 편의고, `KClass` 버전이 실제 구현이자 테스트 대상이다.

### 닫기 버튼 결선

닫기 콜백을 가진 Route는 셋이다. `ToppingEditRoute`는 닫기 버튼 없이 뒤로만 있어 대상이 아니다.

| 화면 | 닫기 동작 |
|---|---|
| `PictureConfirmRoute` (`returnResultOnly = false`) | `popUpTo<NavKeyCanvasMain>()` |
| `PictureConfirmRoute` (`returnResultOnly = true`) | `onBack` 2회 — 확인 버튼과 같은 백 처리 |
| `SegmentationRoute` · `SegmentationConfirmRoute` | `popUpTo<NavKeyCanvasMain>()` |

`returnResultOnly = true`는 캔버스 배경 편집(C-301)에서 들어오는 경로다. 여기서 캔버스까지 튀면
편집 중이던 배경이 날아가므로 갈라야 한다. 세그멘테이션 화면들은 배경 편집 경로를 타지 않아
분기가 없다.

`SegmentationRoute`의 닫기는 로딩·에러·본 화면 셋이 같은 콜백을 공유하므로 한 곳만 채우면
세 화면 모두 출구를 얻는다.

OQ-P-055 ②를 닫는다.

## 표시·제어 규칙

### YGScaffoldV2 이관

[ygscaffold-v2 스펙](archive/2026-08-16-ygscaffold-v2-common-loading-error.md)이 정한 대로
**스캐폴드 소유를 EntryBuilder에서 Route 안으로 내린다.** 이름만 바꾸면 `isLoading`·`toastPolicy`를
채울 방법이 없다.

| 모듈 | 엔트리 | `isLoading` | `toastPolicy` |
|---|---|---|---|
| camera | `NavKeyCameraCustom` | 안 씀 | 가이드 토스트 + 촬영 실패 `showError` |
| camera | `NavKeyCameraSystem` | 안 씀 | 기본값 |
| camera | `NavKeyPictureConfirm` | 안 씀 | 기본값 |
| gallery | `NavKeyCustomGalleryPicker` | 안 씀 — 그리드 자리에 자체 인디케이터를 그린다 | 가이드 토스트 |
| gallery | `NavKeySystemGalleryPicker` | 안 씀 | 기본값 |
| segmentation | `NavKeySegmentation` | 안 씀 — `SegmentationLoadingScreen`이 문구·닫기를 가진 전용 화면이다 | 기본값 |
| segmentation | `NavKeySegmentationConfirm` | 안 씀 | 기본값 |
| segmentation | `NavKeyToppingEdit` | 안 씀 | 기본값 |

`isLoading`을 아무 데도 안 쓰는 것은 우연이 아니다. 세 모듈의 로딩은 전부 **화면 고유 표현**이고,
V2 스펙이 그것을 흡수하지 않겠다고 명시했다. 이관의 실익은 토스트 호스트 배선을 화면에서
걷어내는 쪽에 있다.

**Screen에서 걷어낼 것**: `CustomCameraScreen`·`CustomGalleryPickerScreen`이 `toastPolicy`를
파라미터로 받아 자기 레이아웃에 `YGToastHost`를 꽂고 있다. 파라미터와 호스트를 지우고 프리뷰도
따라 고친다. 정책 객체는 Route가 만들어 스캐폴드에 넘긴다.

**토스트 위치가 바뀐다(카메라만)** — `CustomCameraScreen`의 `YGToastHost`는 화면 상단이 아니라
**뷰파인더 Box 안**에 얹혀 있다. V2로 옮기면 상태바 인셋 아래 상단으로 올라간다. 눈에 보이는
변화지만 위키 Toast 공통 정책이 "위→아래 노출"이라 V2 쪽이 정책에 맞고 지금이 이탈이다.
갤러리는 이미 컨텐츠 영역 상단 정렬이라 사실상 그대로다.

**카메라 촬영 실패**는 지금 조용히 뒤로 간다. 이관하면서 `showError`를 붙인다 — 실패를 알리고
끝나는 종류라 V2가 다루는 갈래에 정확히 든다.

**인셋 주의**: `NavKeyCameraCustom`은 카메라 피드가 시스템 바 아래까지 덮어야 해서 지금도
`innerPadding`을 화면에 먹이지 않는다. V2에서도 그대로 무시한다.

### CanvasMove 죽은 코드 삭제

PR #290이 `SegmentationConfirmRoute`의 다음 화면을 `NavKeyCanvasToppingPlace`로 옮기면서
`NavKeyCanvasMove` 호출이 끊겼지만 파일은 남았다. `NavKeyCanvasMove`·`CanvasMoveRoute`·
`CanvasMoveScreen`과 `featureCanvasEntryBuilder`의 해당 엔트리를 지운다.

## 파일 구성

| 파일 | 상태 | 역할 |
|---|---|---|
| `data/.../ImageSegmentationRepositoryImpl.kt` | 수정 | `segmentImage` 재작성, 캐시 디렉토리 이동, `clearSegmentationCache` 추가 |
| `data/.../repository/image/SegmentationMask.kt` | 신설 | 마스크 → 픽셀 마스킹·bounding box 순수 함수. `Bitmap` 없이 도는 부분을 여기로 뽑아 JVM 테스트 대상으로 만든다 |
| `data/.../repository/image/SegmentationCacheDir.kt` | 신설 | 전용 디렉토리 이름 + 비우기. 같은 이유로 `Context` 없이 도는 부분만 담는다 |
| `feature/camera/impl/build.gradle.kts` | 수정 | `feature:groups:canvas:api` 의존 추가 — 닫기가 `NavKeyCanvasMain`을 가리킨다 |
| `feature/segmentation/impl/build.gradle.kts` | 수정 | `parfait.test.unit` 플러그인 추가 — 이 모듈에 테스트가 처음 생긴다 |
| `domain/.../repository/image/ImageSegmentationRepository.kt` | 수정 | `clearSegmentationCache` 선언, `decodeImage` 던짐 KDoc |
| `domain/.../usecase/image/ClearSegmentationCacheUseCase.kt` | 신설 | 캐시 정리 진입점 |
| `core/navigation/.../Navigator.kt` | 수정 | `popUpTo` |
| `feature/segmentation/impl/.../SegmentationViewModel.kt` | 수정 | 캐시 정리 선행, 디코드 실패 흡수 |
| `feature/segmentation/impl/.../navigation/EntryBuilder.kt` | 수정 | 스캐폴드 걷어내기 |
| `feature/segmentation/impl/.../route/*.kt` | 수정 | 스캐폴드 소유, 닫기 결선 |
| `feature/camera/impl/.../navigation/EntryBuilder.kt` | 수정 | 스캐폴드 걷어내기 |
| `feature/camera/impl/.../route/*.kt` | 수정 | 스캐폴드 소유, 닫기 결선, `Cancel` 전환 |
| `feature/camera/impl/.../screen/CustomCameraScreen.kt` | 수정 | `YGToastHost`·`toastPolicy` 제거 |
| `feature/camera/impl/.../viewmodel/CustomCameraViewModel.kt` | 수정 | `ReturnResult` → `Cancel` |
| `feature/gallery/impl/.../navigation/EntryBuilder.kt` | 수정 | 스캐폴드 걷어내기 |
| `feature/gallery/impl/.../route/*.kt` | 수정 | 스캐폴드 소유 |
| `feature/gallery/impl/.../screen/CustomGalleryPickerScreen.kt` | 수정 | `YGToastHost`·`toastPolicy` 제거 |
| `feature/groups/canvas/impl/.../route/CanvasMainRoute.kt` | 수정 | `ResultEffect<String>` 제거 |
| `feature/groups/canvas/impl/.../viewmodel/CanvasMainViewModel.kt` | 수정 | `CacheImage` 계열 제거 |
| `feature/groups/canvas/{api,impl}/.../CanvasMove*.kt` | 삭제 | 죽은 코드 |

### 테스트

세 모듈은 테스트가 0건이다. 계측 인프라는 만들지 않고 JVM 유닛만 붙인다 — 이 라운드가 바꾸는
것 중 판단이 든 부분은 전부 순수 로직이라 계측이 필요 없다.

| 파일 | 케이스 |
|---|---|
| `NavigatorTest` (기존) | `popUpTo` — 대상이 중간에 있음 / 없음 / 이미 최상단 |
| `SegmentationViewModelTest` (신설) | 성공 · 세그멘테이션 실패 · bounds `null` · 디코드 예외 · 캐시 정리가 디코드보다 먼저 |
| `SegmentationMaskTest` (신설) | 마스크 → bounding box 계산. `Bitmap` 없이 도는 부분만 순수 함수로 뽑아 잠근다 |
| `CanvasMainViewModelTest` (기존) | `CacheImage` 케이스 제거 |

ML Kit 호출부는 유닛으로 못 잡는다. **실기기 육안 확인**으로 남긴다 — 촬영·갤러리 각각에서
세그멘테이션 성공, 취소 시 크래시 없음, 닫기가 캔버스로 감, 캐시 디렉토리가 흐름마다 비워짐.

## 주의 / 열린 질문

- **원본 해상도 유지의 대가** — 다운샘플을 넣지 않기로 했으므로 고해상도 사진에서 원본 비트맵,
  픽셀 배열, subject 비트맵, trimmed 비트맵이 동시에 살아 있는 구간이 남는다. 이 라운드가 배열
  하나를 줄이지만 위험을 없애지는 않는다. 저사양 기기 OOM은 실기기 확인 항목이다
- **재시도 동선 부재** — OQ-P-003 ①. `ModuleNotReady`는 일시적 실패인데 사용자가 다시 시도할
  수단이 없다. 이번 라운드 밖
- **최근 이미지 공급자 0건** — `AddRecentImageUseCase` 호출부가 사라진다. 갤러리 피커의 "최근"
  영역은 계속 비어 있고, C-106이 업로드 확정 시점에 테두리 적용 전 알맹이로 채운다
- **도달 불가 화면 2종** — `NavKeyCameraSystem`·`NavKeySystemGalleryPicker`. 커스텀 카메라·갤러리가
  자리를 대신한 뒤 남은 것으로 보이나 삭제 판단은 이 라운드 밖이다. 스캐폴드 이관만 한다
- **PR #290 위에서 작업한다** — 이 브랜치는 develop에 `feature/topping-add-screen`을 머지해
  얹었다. #290이 develop에 먼저 들어가면 그 커밋들은 이 브랜치의 diff에서 저절로 사라진다.
  #290이 리뷰로 바뀌면 다시 머지해야 한다

## as-built (2026-08-18 구현)

브랜치 `refactor/segmentation-logic`, 커밋 14개. `./gradlew test ktlintCheck :app:assembleDebug`는
커밋마다(특히 최종 전체 브랜치 리뷰가 낸 마지막 세 커밋 각각의 뒤에서도) 통과.
테스트 총량: 유닛 477 → 494건, 테스트 파일 55 → 58개. 신설 파일은 `SegmentationMaskTest`·
`SegmentationCacheDirTest`·`SegmentationViewModelTest` — `feature:segmentation:impl`은 이 라운드
전까지 테스트가 0건이었고, 이번에 `parfait.test.unit` 컨벤션 플러그인과 함께 첫 `src/test`
소스셋을 얻었다(마지막 리뷰가 붙인 테스트 1건은 새 파일이 아니라 기존 `SegmentationMaskTest`에
케이스를 더한 것이다).

설계에서 **뒤집힌 결정 0건.**

구현·리뷰가 더한 것:
- **캐시 정리 호출도 감쌌다** — 스펙은 디코드가 던지는 것만 감싸라고 했는데, 리뷰가
  `clearSegmentationCacheUseCase()`가 같은 `init` 코루틴의 첫 문장으로 무방비 상태인 것을
  찾았다. 이 라운드가 닫으려는 것과 같은 크래시 부류라 `runCatching { }`으로 감쌌다 —
  best-effort다. 정리가 실패해도 흐름은 멈추지 않는다. 남는 캐시 파일은 무해하고, 정리 실패를
  이유로 세그멘테이션 자체를 거부하는 쪽이 그 지저분함보다 나쁘다고 판단했다. 테스트 1건이 잠근다.
- **`CustomCameraEffect.CaptureFailed`가 별도 이펙트로 갈라져 나왔다** — 스펙은 촬영 실패에
  에러 토스트만 요구했는데, 이전 태스크가 이미 촬영 실패를 `Cancel`(인자 없음)로 접어 놓아
  그 값을 실어 나를 별도 이펙트가 필요해졌다.
- **브랜치가 라운드 시작 시점에 컴파일이 안 됐다 — 이 라운드가 낸 문제는 아니다.** PR #290이
  `NavKeyCanvasImageAdd`를 참조하는 `CanvasToppingPlaceRoute`를 더했는데, develop은 그 사이
  같은 키를 `NavKeyCanvasMain`으로 이미 개명했다. 새 파일과 개명이 같은 줄을 공유하지 않아 git이
  조용히 병합했다. 커밋 `a3660e58`의 머지 해결로 고쳤다.
- **`CanvasMainViewModelTest`는 지울 케이스가 없었다** — 계획은 제거된 인텐트를 참조하는 케이스가
  있다고 가정했지만 실제로는 없었고, mock 필드·그 import·생성자 인자만 걷혔다.
- **캐시 정리의 안전 논거가, 참이 되려면 리뷰가 낸 수정 하나가 필요했다(`ea278cce`).**
  `CanvasToppingPlaceRoute`의 배치 완료 이펙트가 `NavKeyCanvasMain(groupId = 0L)`을 `goTo`로
  **새로 쌓고** 있었다 — 앞서 "관찰만 하고 고치지 않는다"고 적었던 그 하드코딩이다. 이게 왜 사소한
  정리가 아니었냐면: 위 "캐시 PNG 정리" 절이 "새 흐름은 캔버스에서만 시작하고, 그러려면 이전 흐름
  화면들이 이미 백스택에서 걷혀 있다"를 안전 근거로 들었는데, **이 줄이 살아 있는 동안 그 전제가
  거짓이었다.** 배치를 마쳐도 방금 끝난 흐름의 화면들이 새 캔버스 밑에 그대로 쌓여 있었고, 다음
  흐름이 시작되며 캐시를 비우면 그 살아 있는 화면들이 가리키던 PNG가 지워졌다 — 뒤로 가면 빈
  이미지와 아무 반응 없는 버튼만 남았다. `navigator.popUpTo<NavKeyCanvasMain>()`으로 바꿔 흐름
  전체를 걷어내면서 안전 논거가 비로소 참이 됐고, 하드코딩된 `groupId = 0L`도 이때 함께 없어졌다.
- **`segmentImage`의 캐시 저장 경로는 이번 라운드 안에서도 뒤늦게 닫혔다(`7877cc31`).** `withContext(Dispatchers.Default)`
  블록 전체가 ML Kit 실패를 매핑하는 `try` 밖에 있다는 문제는 스펙이 처음부터 알고 있었고, OQ-P-004 ②는
  그중 **마스크 null·마스크 크기 불일치 두 경로만** 닫았다고 적었다. **`saveToCacheAsPng`가 던지는
  `IOException`(같은 블록 안, 세 번째 경로)은 이 커밋 전까지 계속 `Result`를 새어나가 호출부
  (`SegmentationViewModel`의 `init` 코루틴)를 그대로 죽였고, 그 와중에 전체 해상도 `subjectBitmap`의
  `recycle()`도 건너뛰었다.** 이제 저장 구간이 `try`로 감싸여 `SegmentationException.Process`로
  접히고, `recycle()`은 `finally`로 옮겨 실패해도 반드시 돈다. **이 블록이 완전히 방어되는 것은 이
  커밋부터다.** 같은 커밋이 마스크 크기 가드도 `capacity()`(버퍼 전체 용량)에서 `remaining()`
  (`get(index)`가 실제로 경계로 삼는 값)으로 고쳤다 — 절대 인덱스 읽기는 `limit`을 넘으면
  `IndexOutOfBoundsException`이라 `capacity()` 비교로는 놓치는 경우가 있었다. 테스트 1건(기존
  `SegmentationMaskTest`에 추가)이 이 경계를 잠근다.
- **그 방어가 취소까지 삼켰다(`bc6642f8`).** 위 `try`가 일반 `Exception`을 잡는데
  `CancellationException`도 `Exception`이라, 세그멘테이션 코루틴이 취소되면 그 취소가 상위로
  전파되는 대신 "세그멘테이션 실패"로 보고됐다. 일반 `catch` 앞에 재던지는 분기를 하나 앞세웠다 —
  `BaseViewModel.launch`가 이미 하는 것과 같은 관용구다.

**남은 위험 — 관찰됐으나 이 라운드가 손대지 않은 것:**
- **다운샘플 없음이 실측으로 위험하다.** 리뷰가 12MP 사진 기준으로 살아 있는 비트맵 피크를 쟀다 —
  `segmentImage` 내부에서 약 244MB, 토핑 편집 화면까지 이어지면(스택 아래 `SegmentationState.originBitmap`이
  같이 살아 있는 채로 겹쳐) 약 390MB. 앱은 `largeHeap`을 선언하지 않는다. 스펙은 고화질 보존을 택해
  다운샘플을 범위 밖에 뒀는데, 리뷰는 그 판단이 틀렸다고 본다. `ToppingBorderOutline.kt`는 이미 자기
  작업 치수를 캡핑하고 있어 코드베이스가 이 판단에서 일관되지 않다. → [OQ-P-228](../synthesis/open-questions.md)로 새로 남긴다.
- **캐시 정리는 세그멘테이션 한 곳만 닫혔다.** `FileCameraCacheLocalDataSourceImpl`이 쓰는 카메라
  캐시 서브디렉토리는 파일명이 초 단위(`yyyyMMdd_HHmmss`)라 같은 초에 두 번 찍으면 파일이 충돌하고,
  지우는 경로 자체가 없다 — 이 라운드의 범위 밖이다. OQ-P-003 ③을 "캐시 정리가 다 끝났다"로 읽으면 안 된다.
- **주차만 해 둔 것 둘**: 두 번째 `saveToCacheAsPng`(trimmed) 호출이 던지면 `trimmedBitmap`이
  회수되지 않는다(이 라운드 이전부터 있던 상태, 안 건드림). `Tasks.await`를 감싸는 기존
  `try/catch`도 `bc6642f8` 이전의 새 `try`와 같은 방식으로 `CancellationException`을 삼킨다.

실기기 확인: **없음.**
