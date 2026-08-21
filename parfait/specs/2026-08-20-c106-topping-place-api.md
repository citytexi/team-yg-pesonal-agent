---
id: c106-topping-place-api
title: C-106 토핑 배치 API 결선 — 업로드 전송·초안 SSOT·테두리 계약 전환 (Topping Place API)
status: draft
category: behavior-spec
platforms: android
verified: 2026-08-20
related_code:
  - CanvasToppingPlaceViewModel.kt#CanvasToppingPlaceUiState
  - CanvasToppingPlaceRoute.kt#CanvasToppingPlaceRoute
  - CanvasToppingPlaceScreen.kt#CanvasToppingPlaceScreen
  - CanvasToppingLayer.kt#TOPPING_BASE_LONG_SIDE_RATIO
  - CanvasToppingLayer.kt#CanvasTopping
  - CanvasToppingLayer.kt#ToppingOutline
  - ToppingHandleComponents.kt#rememberToppingBaseSize
  - YGCanvas.kt#CANVAS_AREA_ASPECT_RATIO
  - YGCanvas.kt#CanvasArea
  - YGToppingCutoutImage.kt#YGToppingCutoutImage
  - ImageRemoteDataSource.kt#issueUploadUrl
  - ImageRemoteDataSource.kt#confirmUpload
  - ParfaitImageRemoteDataSource.kt#placeTopping
  - NetworkModule.kt#provideUnauthenticatedOkHttpClient
  - NetworkModule.kt#loggingInterceptor
  - AuthInterceptor.kt#intercept
  - SegmentationConfirmRoute.kt#SegmentationConfirmRoute
  - CanvasBGEditRoute.kt#CanvasBGEditRoute
  - ToppingEditViewModel.kt#completeEdit
  - ToppingEditMask.kt#trimTransparentBounds
  - SegmentationCacheDir.kt#clearFiles
  - CanvasMainViewModel.kt#loadTodayCanvas
  - CanvasMainScreen.kt#addAction
  - ServerErrorCode.kt#Parfait
  - String.kt#toColorOrNull
related_adr: ADR-0025, ADR-0026, ADR-0017, ADR-0020
related_spec: c106-topping-place, image-api-service-layer, parfait-canvas-topping-member-api-service-layer, ygscaffold-v2-common-loading-error, c103-segmentation-topping-edit, segmentation-pipeline-hardening, screen-resume-refetch
related_architecture: data-layer, state-management, navigation-flow, module-structure
supersedes:
superseded_by:
tags: [spec, parfait, canvas, topping, c-106, api]
---

# Spec: C-106 토핑 배치 API 결선

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처(source of truth). 본문은 설계 내용에 집중.

## 목표

C-106 확인 버튼을 누르면 토핑이 **실제로 서버에 올라가게 한다.** 지금은
`CanvasToppingPlaceViewModel#handleOnClickConfirm`이 이펙트만 쏘고 Route가 `// TODO` 뒤에서
캔버스로 되감는다([c106-topping-place](archive/2026-08-19-c106-topping-place.md) 드리프트 ①).

## 범위

- **포함**
  - S3 presigned PUT 전송 경로 신설 + 업로드 전용 OkHttp 클라이언트 분리
  - `ImageUploadRepository`(발급·전송·확인 3단계를 하나로) · `ToppingRepository`(배치) ·
    `AddToppingUseCase`(둘을 조율)
  - 토핑 만들기 흐름 상태를 `:data` DataStore 한 곳으로 모으는 **토핑 초안 SSOT**([ADR-0026](../adr/0026-topping-draft-datastore-ssot.md))
  - **테두리를 픽셀에 굽지 않고 서버 필드로 보내는 계약 전환**([ADR-0025](../adr/0025-topping-border-as-server-field.md))
  - 화면 좌표 → 서버 좌표 변환 + **종횡비 상수 통일**
  - 로딩 오버레이 · 실패 토스트 · 영구 실패 코드에서 캔버스로 되감기
  - **C-001 `YGScaffoldV2` 이관 + 오늘 캔버스 조회 실패 표현**
- **제외**
  - **토핑 수정·삭제·테두리 재편집 API** — DataSource에 넷 다 있으나 소비 화면이 C-301 라운드다.
    쓰지 않는 것을 Repository로 올리면 계약이 바뀌어도 아무도 고치지 않는다.
  - **배경 이미지 업로드**(C-301) — 같은 `ImageUploadRepository`를 쓰지만 결선은 그 라운드 몫이다.
  - **배치 화면의 실제 배경·기존 토핑 미리보기** — OQ-P-240을 연 채로 둔다.
  - 고아 `PENDING` 이미지 정리 · 회전·리사이즈 한계의 정책 근거(OQ-P-241) ·
    드래그 핸들 접근성(OQ-P-202 ③) · `60.dp`/`14.dp` 리터럴(OQ-P-203 ③)
  - **누끼 알맹이의 최근 이미지 재사용** — PR6로 분리했다. 결정 셋(배치 성공 시 저장 · 대상은
    테두리 없는 알맹이 · 최근에서 고르면 누끼 확인 화면 직행)은 PR 분할 표 6번 행에 있고,
    선행 결함 넷은 OQ-P-255에 있다.

## 결정된 것

| 쟁점 | 결정 | 근거 |
|---|---|---|
| 업로드 전송 포함 여부 | 전체 체인 한 라운드 | `imageId`를 얻을 경로가 없으면 배치만 붙여도 동작하지 않는다 |
| 조율 위치 | `AddToppingUseCase` 하나 | 4단계 순서는 서버 계약이 정한 도메인 규칙이지 화면 관심사가 아니다. C-301 배경이 앞 3단계를 재사용한다 |
| `positionZ` | 흐름 진입 시 캔버스의 최대 z + 1, **토핑이 없으면 1** | 새 토핑이 항상 맨 위. 목록 크기로 세면 지워진 토핑이 있는 캔버스에서 겹친다. 서버 요청 DTO에 검증 애노테이션이 없고 유일성 제약도 없어 남과 겹쳐도 거부되지 않는다 |
| 재시도 | 실패하면 토스트 후 **발급부터 전부 다시** | 만료된 presigned URL 문제가 자동으로 풀리고 상태 기계가 단순하다. 대가는 고아 S3 객체 |
| 테두리 | 굽지 않고 서버 필드로 | [ADR-0025](../adr/0025-topping-border-as-server-field.md) |
| 흐름 상태 위치 | DataStore 초안 SSOT | [ADR-0026](../adr/0026-topping-draft-datastore-ssot.md) |
| 업로드 Repository 이름 | `ImageUploadRepository` | 요청의 `ImageType`이 `NUKKI`·`BACKGROUND` 둘이라 토핑 전용이 아니다 |
| 배치 Repository 이름 | `ToppingRepository` | `domain/model/topping/`과 이름이 맞는다 |

## API / 인터페이스

```kotlin
// domain/repository/image/
interface ImageUploadRepository {
    /** 발급·전송·확인 3단계를 하나로 닫는다. 돌려주는 imageId 는 이미 COMPLETED 다. */
    suspend fun upload(
        filePath: String,
        imageType: ImageType,
    ): Result<ImageId>
}

// domain/repository/topping/
interface ToppingRepository {
    suspend fun place(
        groupId: GroupId,
        parfaitId: ParfaitId,
        imageId: ImageId,
        transform: ToppingTransform,
        border: ToppingBorder,
    ): Result<PlacedToppingVO>
}

// domain/usecase/topping/
class AddToppingUseCase(
    private val imageUploadRepository: ImageUploadRepository,
    private val toppingRepository: ToppingRepository,
)
```

`upload`가 받는 것은 **파일 시스템 절대경로**이지 `file://` URI가 아니다. 초안이 담는 것도 같은
형태다 — `ImageSegmentationRepositoryImpl`이 돌려주는 것이 절대경로이고, URI 변환은 지금도 화면이
필요할 때만 한다. 두 형태가 섞이면 어느 쪽이 계약인지 호출부마다 달라진다.

`contentType`을 파라미터로 받지 않는 것이 설계다. **구현이 한 번 정해 발급 요청과 PUT 헤더 양쪽에
같은 값을 쓴다.** 두 값은 S3 서명 대상이라 어긋나면 실패하는데 그 실패는 서버 로그에 남지 않는다.
한 곳에서만 나오면 어긋날 수가 없다.

**테두리 색의 직렬화 형식은 `#RRGGBB` 6자리다.** 서버 계약은 타입만 정하고 형식을 말하지 않으며
(`ToppingBorder.Solid`의 KDoc이 "색을 실제로 만드는 화면 라운드가 정한다"고 미뤄 둔 자리),
읽기 쪽 `String#toColorOrNull`은 `#` 유무와 6·8자리 hex만 받는다. 형식이 어긋나면
`CanvasToppingLayer#ToppingOutline`이 **테두리를 그냥 안 그리고** 서버는 200을 준다 — 어디에도
로그가 남지 않는 무증상 실패다. 그래서 형식을 여기서 못 박고 왕복을 테스트한다.
(PR5 브랜치 리뷰에서 8자리 → 6자리로 정정됐다 — 8자리는 ARGB·RGBA 두 관례가 공존해 iOS·CSS
파서가 `#RRGGBBAA`로 읽고, 서버가 검증 없이 저장·반환해 어긋나도 드러나지 않는다.)

## 업로드 전송 — 전용 클라이언트가 기능 전제다

`AuthInterceptor#intercept`는 Retrofit `Invocation` 태그로 `@NoAuth`를 판정한다. 발급받은
`uploadUrl`로 raw OkHttp `Request`를 만들어 쏘면 그 태그가 없어 **`Authorization`이 무조건 붙고**,
presigned URL에 그 헤더가 실리면 S3가 거절한다. 공유 클라이언트를 쓰면 업로드가 아예 동작하지 않는다.

기존 `@UnauthenticatedClient`를 재사용하지 않는다. 그 클라이언트는 KDoc이 존재 이유를 **재발급
교착 회피**로 못박아 뒀고 전용 `Dispatcher`를 그 목적으로 들고 있다. 이미지 업로드가 그 슬롯을
오래 점유하면 401이 몰리는 순간 재발급이 다시 굶는다. `@UploadClient`를 따로 만들고 전송 성격에
맞는 타임아웃을 준다(수치는 코드가 정한다).

두 가지를 기존 클라이언트에서 **복사하지 않는다.**

- **로깅 인터셉터를 아예 달지 않는다.** presigned URL은 서명(`X-Amz-Signature`)과 자격 정보를
  **쿼리 스트링**에 싣는 방식이라 **URL 자체가 유효한 업로드 자격증명**이고, `HttpLoggingInterceptor`는
  `HEADERS` 이상 모든 레벨에서 요청 라인(`--> PUT <url>`)을 남긴다. `redactHeader`는 헤더만 가려
  이 URL을 가리지 못한다. 이 클라이언트가 보내는 요청은 그 PUT 하나뿐이므로 로깅으로 얻는 값이
  자격증명 노출을 감수할 만큼 크지 않다. 실패 원인은 `PresignedUploadException`이 상태 코드로 싣는다.
- **바이트를 메모리에 통째로 올리지 않는다.** 파일을 스트리밍 `RequestBody`로 태운다. 본문을
  로깅했다면 원본 해상도 이미지가 매 업로드마다 문자열로 힙에 올라갔을 것이다(OQ-P-228과 같은 축).

## 토핑 초안 SSOT

`:data`의 DataStore에 **흐름당 하나**만 산다.

```kotlin
data class ToppingDraft(
    val groupId: GroupId,
    val parfaitId: ParfaitId,
    val nextPositionZ: Int,
    val subjectImagePath: String?,   // 업로드·표시용 알맹이(테두리 없음, 여백 걷힌 것)
    val cutoutImagePath: String?,    // 재편집 시작 마스크. 좌표계를 지켜야 해 트리밍하지 않는다
    val borderColorArgb: Int?,       // null 이면 테두리 없음
    val borderWidthDp: Float?,
)
```

| 시점 | 하는 일 |
|---|---|
| `CanvasMain`이 카메라·갤러리로 떠날 때 | 캔버스 식별값 셋으로 **새로 덮어쓴다**. 이미지·테두리는 비운다 |
| 세그멘테이션 완료 | `SegmentationViewModel`이 알맹이·cutout 경로 기록. **화면 진입이 아니라 세그멘테이션 성공 사건에 건다** — 진입에 걸면 프로세스 사망 복원 때 진입 인자가 편집 결과를 덮어써, [ADR-0026](../adr/0026-topping-draft-datastore-ssot.md)이 영속을 고른 이유를 스스로 깬다 |
| 토핑 편집 완료 | 알맹이·cutout·테두리 기록(덮어쓰기) |
| 배치 확정 성공 | 비운다 |

낡은 초안이 다음 흐름에 따라붙는 문제는 **진입 시 덮어쓰기 규칙 하나로** 닫힌다. 별도 만료·정리
경로를 두지 않는다.

**진입에서 초안을 쓰지 못하면 화면을 옮기지 않고 알린다.** 초안 없이 흐름에 들어가면 촬영·누끼·
편집을 다 마친 뒤에야 올릴 데가 없다는 것을 알게 된다 — 토핑 추가 버튼 가드가 막으려는 것과 같은
실패다. 되돌릴 것이 아직 없는 지점이라 알리고 제자리에 두는 것으로 끝난다.

⚠️ **`TOPPING_EDIT_RESULT_KEY`는 걷지 않는다.** 그 결과 키의 소비자가 둘이다 —
`SegmentationConfirmRoute`(토핑 만들기)와 **`CanvasBGEditRoute`**(C-301에서 이미 놓인 토핑을
`borderOnly`로 재편집하는 경로). 편집 화면이 결과 키 대신 초안에 쓰도록 바꾸면 배경 편집 쪽은
편집을 마쳐도 아무것도 반영되지 않고 **컴파일은 통과한다.** 결과 키는 그대로 두고, 그것을 받은
`SegmentationConfirmRoute`가 **초안에 옮겨 적는다.** 걷는 것은 그 Route의 `rememberSaveable`
셋뿐이다.

`NavKeySegmentationConfirm`의 경로 셋도 그대로 둔다. 그것은 **화면을 여는 인자**이고 초안은
**흐름의 결과물**이다. 두 값이 겹치는 구간에서는 **초안이 정본**이다 — 편집을 거치면 NavKey의
값은 낡은다.

**`NavKeyCanvasToppingPlace`는 인자가 없어진다.** `camera`·`segmentation` 모듈이 캔버스 개념을
떠안지 않는 것이 이 배치의 실익이다.

**초안이 가리키는 파일이 이미 없을 수 있다.** 초안은 DataStore에 영속되지만 그것이 가리키는 것은
`cacheDir` 하위 파일이고, 세그멘테이션 진입이 그 디렉토리를 통째로 비운다
(`SegmentationCacheDir#clearFiles`). OS도 저장 공간 압박 시 회수한다. 그래서 **초안을 읽을 때
"경로는 있는데 파일이 없다"를 그 경로가 처음부터 없었던 것과 같이 취급한다** — 비우는 것은
**이미지 경로 둘뿐**이고 캔버스 식별값과 테두리는 남긴다. 초안 전체를 버리면 흐름 진입 때 못 박은
`parfaitId`까지 잃어, 이 배치가 지키려던 "진입 캔버스가 못 박힌다"가 함께 깨진다.

## 표시·제어 규칙

| 대상 | 조건 |
|---|---|
| C-001 토핑 추가 버튼 | `isViewingToday`가 참이고 **`todayCanvas`가 있을 때만** 활성 |
| C-106 확인 버튼 | 캔버스 실측이 있고, 토핑 이미지 painter가 `Success`이고, 초안이 유효할 때만 활성 |

**토핑 추가 버튼 가드** — `todayCanvas`가 없으면 `parfaitId`도 `nextPositionZ`도 없다. 서버는 오늘
조회 때 캔버스를 만들어 주므로 "서버에 없다"는 경우는 없고, 없는 것은 **앱이 아직 못 받은 경우**다
(조회 전 로딩 구간, 그리고 `loadTodayCanvas`의 실패). 열어 두면 촬영·누끼·편집을 다 마친 뒤
마지막에야 올릴 데가 없다는 것을 알게 된다.

**확인 버튼 가드의 판정 근거가 `toppingBaseSize != null`이면 안 된다.**
`ToppingHandleComponents#rememberToppingBaseSize`는 `intrinsicSize`가 아직 없거나 로드에 실패해도
`null`이 아니라 **고정 폴백 크기**를 돌려주고 화면이 그것을 곧바로 ViewModel에 밀어 넣는다. 그래서
그 조건은 첫 프레임부터 참이고, 큰 PNG를 디코드하는 동안 확인을 누르면 폴백 크기로 계산된 배율이
서버에 올라간다. 읽기 쪽 `CanvasToppingLayer#ToppingImage`가 이미 같은 이유로 painter 상태를 보므로
쓰기 쪽도 그것을 판정 근거로 삼는다.

## C-001 오늘 캔버스 조회 실패 표현

지금 `CanvasMainViewModel#loadTodayCanvas`의 `onFailure`는 로그만 남긴다. 화면에는 아무 표현이
없어 사용자는 빈 캔버스와 조회 실패를 구분하지 못한다(OQ-P가 이미 지적한 자리). 토핑 추가 버튼
가드가 그 위에 얹히면 "버튼이 왜 안 눌리는지"까지 안 보이게 되므로 함께 연다.

- `CanvasMain`을 `YGScaffold`(V1, `EntryBuilder` 소유)에서 **`YGScaffoldV2`(Route 소유)**로 옮긴다.
  [ygscaffold-v2 스펙](archive/2026-08-16-ygscaffold-v2-common-loading-error.md)이 이관을
  "화면별 API 결선 라운드에 묶어 점진 진행"으로 정해 둔 그 경우다.
- ⚠️ **토스트 자리는 `YGScaffoldV2`의 것이 아니다**(2026-08-20, PR #298 머지 후 확정). 같은 화면의
  Spotlight 작성자 토스트가 `YGCanvas`의 `overlayContent`에 호스트를 못 박아 두었고, 큐를 둘로
  나누면 [[toast]] 공통 정책의 스택이 큐마다 따로 논다. 조회 실패 토스트도 그 호스트로 보내고
  스캐폴드는 **로딩 오버레이 자리로만** 쓴다(OQ-P-167 ·
  [c202 스펙](archive/2026-08-20-c202-canvas-spotlight.md)).
- **실패를 매번 알리지 않는다.** `screen-resume-refetch`가 화면이 앞에 설 때마다 재조회하게
  만들어 조회 빈도가 높다. 이미 받아 둔 `todayCanvas`가 있으면 화면을 유지하고 조용히 로그만 남기고,
  **보여 줄 캔버스가 없을 때만** 토스트로 알린다. G-001이 같은 스펙에서 정한 규칙의 C-001 대응물이다.

## 좌표 변환

`CanvasToppingPlaceViewModel`이 캔버스 실측과 토핑 원본 크기를 둘 다 아는 유일한 자리라 여기서
바꾼다. 순수 함수로 뽑아 단위 테스트한다.

```
positionX = (offsetX + baseWidth  / 2) / canvasWidth
positionY = (offsetY + baseHeight / 2) / canvasHeight
scale     = max(baseWidth, baseHeight) * scale / (canvasWidth * TOPPING_BASE_LONG_SIDE_RATIO)
rotation  = rotationDegrees
positionZ = draft.nextPositionZ
```

⚠️ **쓰기 쪽 `scale`과 읽기 쪽 `scale`은 기준이 다른 다른 수다.** 그대로 보내면 안 된다.
읽기 쪽 `CanvasToppingLayer#CanvasTopping`은 한 변이
`canvasWidth × TOPPING_BASE_LONG_SIDE_RATIO × scale`인 **정사각 박스**에 `ContentScale.Fit`으로
담아 긴 변을 꽉 채운다. 배치 화면의 긴 변은 `max(baseWidth, baseHeight) × scale`이다. 둘을 같게
놓으면 위 식이 나온다.

정규화가 성립하려면 두 화면의 Canvas-Area 종횡비가 같아야 한다. **이 스펙을 쓸 때 그 값이 두 상수로
갈려 있었다** — 배치 화면은 `domain`의 `CANVAS_ASPECT_RATIO`를, 읽기 쪽 `YGCanvas#CanvasArea`는
자기 모듈의 private 상수를 썼다. 값만 같을 뿐 **동일성을 강제하는 것이 없어 하나를 바꿔도 컴파일이
깨지지 않았다.** 어긋나는 순간 이미 저장된 모든 토핑의 `positionY`가 틀어지고 증상은 "토핑이 조금씩
위아래로 밀린다"라 원인 추적이 어렵다. **`domain`의 `CANVAS_ASPECT_RATIO`를 지우고
`core:designsystem`의 `CANVAS_AREA_ASPECT_RATIO` 하나로 통일한다.** 반대 방향으로 모으면
`core:designsystem` → `:domain` 간선이 새로 생기는데, 캔버스 비율은 도메인 규칙이 아니라 **표시
규격**이라 소유가 디자인시스템 쪽이다(OQ-P-177 ①).

## 실패 처리

로딩은 `launch(key = …)`로 연타를 막고 `isLoading`을 세워 `YGScaffoldV2`의 오버레이가 터치를
삼킨다. 4단계 전체가 한 덩어리라 단계별 진행률은 표시하지 않는다.

분기는 `AppError.Server`의 `code` 하나로 한다. `statusCode`를 조건에 넣지 않는 것이 결정이다 —
되감기 대상 세 코드에는 status로 갈려야 하는 동명 코드가 없고, 서버가 HTTP 200에 실패 봉투를
실으면 `ApiCaller`가 그 값을 `null`로 채워 조건에 넣는 순간 판정이 사라진다(OQ-P-247 해소).

| 실패 | 화면 |
|---|---|
| `PARFAIT_ALREADY_CLOSED`(409) · `GROUP_NOT_JOINED`(403) · `PARFAIT_NOT_FOUND`(404) | 토스트 후 **캔버스로 되감는다** |
| 그 외 전부 | 토스트만. 배치 화면에 머문다 |

⚠️ **마감만 되감으면 안 된다.** 배치 POST의 검사 순서가 그룹 참여 → 파르페 존재 → 파르페 상태라,
그룹에서 빠졌거나 파르페가 사라지면 **마감된 캔버스여도 409가 오지 않는다**
(`ServerErrorCode.Parfait`의 KDoc이 명시적으로 경고하는 함정). 세 코드 모두 재시도가 영원히
실패하므로 잔류시키면 사용자가 할 수 있는 일이 실패 반복뿐이다.

되감되 **막 만든 토핑을 잃게 하지 않는다** — 같은 KDoc이 "되돌리지 않고 알린다"로 처분을 미리
적어 뒀다. 화면 이동은 그대로 진행하고 실패만 알린다.

그 외에는 확인을 다시 눌러 **발급부터 전부 다시** 탄다.

`AppError` → 문구 공통 매핑은 아직 없다([ygscaffold-v2 스펙](archive/2026-08-16-ygscaffold-v2-common-loading-error.md)이
명시적으로 제외한 항목). 이 화면이 자기 문구를 가진다.

성공하면 초안을 비우고 `popUpTo<NavKeyCanvasMain>()`으로 되감는다. `CanvasMainViewModel`에 이미
`handleEnter()` → `loadTodayCanvas()`가 있어 되돌아온 순간 새 토핑이 함께 내려온다.

## PR 분할 (스택)

아래에서 위로 쌓는다. 각 PR은 **그 시점에 develop이 깨지지 않는다.**

| # | 브랜치 성격 | 내용 | 사용자에게 보이는 변화 |
|---|---|---|---|
| 1 | 업로드 전송 계층 | `@UploadClient` · `PresignedUploadDataSource` · `ImageUploadRepository`/Impl · DI | **없음**(소비자 0) — ✅ **develop 머지**(PR #322, 2026-08-20 `da03c9b0`) |
| 2 | 배치 계층 | `ToppingRepository`/Impl(`place`만) · `AddToppingUseCase` | **없음**(소비자 0) — ✅ **develop 머지**(PR #322와 같은 머지 — PR2 브랜치가 PR1 커밋을 업고 올라갔다) |
| 3 | 초안 SSOT + C-001 정비 | `ToppingDraft` + DataStore + Repository · `CanvasMain`이 흐름 진입 시 초안 쓰기 · 토핑 추가 버튼 가드 · `YGScaffoldV2` 이관 + 조회 실패 토스트 | 버튼 가드 · 조회 실패가 보인다 · 초안 쓰기 실패도 알린다 — ✅ **완료·미머지**, 브랜치 `feature/#270-topping-draft-ssot`(이제 베이스가 develop에 들어왔다) |
| 4 | 테두리 계약 전환 | 트리밍된 알맹이 생성 · 굽기 중단 · 확인·배치 화면이 초안을 읽고 같은 스탬프로 그리기 · `rememberSaveable` 걷기 · `NavKeyCanvasToppingPlace` 인자 제거 · 종횡비 상수 통일 | **테두리 렌더 방식이 바뀐다** — ✅ **완료·미머지**, 브랜치 `feature/#270-topping-border-contract`([계획](../plans/archive/2026-08-21-c106-pr4-topping-border-contract.md)) |
| 5 | 결선 | 좌표 변환 · `AddToppingUseCase` 호출 · 로딩·토스트·되감기 · 성공 시 초안 비우기 · **아래 선행 미결 둘** | **토핑이 서버에 올라간다** — ✅ **완료·미머지**, 브랜치 `feature/#270-topping-place-wiring`(베이스는 PR4 브랜치 팁 `392014a7`, [계획](../plans/archive/2026-08-21-c106-pr5-topping-place-wiring.md)) |
| 6 | 누끼 알맹이 재사용 | 배치 성공 시 **테두리 없는 알맹이**를 최근 이미지에 저장 · 최근 목록에 종류 축 신설 · 알맹이를 고르면 누끼 확인 화면으로 직행 | 갤러리 "최근"에서 이미 만든 누끼를 다시 쓸 수 있다 |

1과 2는 소비자가 없어 리뷰가 각각 **S3 서명**과 **계약 매핑** 한 가지에만 집중할 수 있다.

✅ **PR5가 선행 미결 둘을 함께 닫았다.** PR1이 만든 계층에 **처음으로 소비자가 붙는 라운드**라
그때까지 잠들어 있던 두 결함이 동시에 살아날 뻔했다.

- [**OQ-P-109**](../synthesis/open-questions.md) — 메인 클라이언트가 발급 **응답 본문**을
  `Level.BODY`로 찍던 것. `@NoBodyLog` + `SelectiveLoggingInterceptor`로 발급 엔드포인트만
  `Level.HEADERS`로 낮춰 닫았다.
- [**OQ-P-246**](../synthesis/open-questions.md) — `PresignedUploadDataSourceImpl#put`이 블로킹
  `execute()`를 쓰고 `Call.cancel()`을 코루틴 취소에 잇지 않던 것. `enqueue` +
  `suspendCancellableCoroutine`·`invokeOnCancellation { call.cancel() }`로 바꿔 닫았다.

**3과 4의 경계에 주의한다.** 초안에 이미지를 채우는 것과 굽기를 그만두는 것은 **떼면 안 된다** —
3에서 확인 화면이 초안을 읽게 하면서 4에서야 굽기를 멈추면, 그사이 초안의 `subjectImagePath`가
"테두리 없음"이라는 자기 정의와 어긋나거나 사용자가 방금 두른 테두리가 확인 화면에서 사라진다.
그래서 3은 **캔버스 식별값까지만** 쓰고 이미지·테두리는 4에서 함께 들어간다.

4가 시각 회귀 위험이 유일하게 몰리는 자리다. 실기기 확인을 여기에 붙이고 **누끼 확인 화면까지**
본다.

## 파일 구성

| 자리 | 역할 |
|---|---|
| `data/di/NetworkModule.kt` | `@UploadClient` OkHttpClient 추가 |
| `data/source/image/remote/PresignedUploadDataSource` | S3 PUT 전송. raw OkHttp를 쓰는 유일한 자리 |
| `data/repository/image/ImageUploadRepositoryImpl` | 발급 → PUT → confirm |
| `data/repository/topping/ToppingRepositoryImpl` | 배치 |
| `data/source/toppingdraft/local/` | 초안 DataStore |
| `domain/repository/image/ImageUploadRepository` | 위 계약 |
| `domain/repository/topping/ToppingRepository` | 위 계약 |
| `domain/usecase/topping/AddToppingUseCase` | 업로드 → 배치 조율 |
| `core/designsystem/.../ygcanvas/YGCanvas.kt` | private 종횡비 상수를 public으로 올려 저장소의 유일한 정본으로 둔다 |
| `feature/groups/canvas/impl/.../CanvasToppingPlaceViewModel` | 좌표 변환·확정·실패 표현 |
| `core/designsystem/.../ygtoppingcutout/YGToppingCutoutImage` | 8방향 테두리 스탬프. 나눠 쓰는 화면 셋이 **모듈 둘**(`segmentation`·`groups/canvas`)에 걸쳐 있어 feature `component/`가 아니라 여기가 소유한다 |

## 테스트

| 대상 | 확인할 것 |
|---|---|
| `PresignedUploadDataSource` | PUT에 **`Authorization`이 붙지 않는다** · `Content-Type`이 발급 때 쓴 값과 같다 |
| `ImageUploadRepositoryImpl` | 3단계 순서 · 중간 실패가 그대로 올라온다 · 실패 후 다음 단계를 부르지 않는다 |
| `AddToppingUseCase` | 업로드 실패 시 배치를 부르지 않는다 |
| 좌표 변환(순수 함수) | 정중앙·모서리·회전·스케일에서 읽기 쪽 식으로 되돌리면 원래 화면 좌표가 나온다(왕복) |
| 종횡비 상수 | 상수가 하나뿐이라 컴파일이 보증한다(단언 없음) |
| 테두리 색 | 초안 ARGB → 서버 문자열 → `String#toColorOrNull` 왕복이 원래 색을 낸다 |
| `CanvasToppingPlaceViewModel` | painter 미완료 시 확인 비활성 · 연타 차단 · 영구 실패 세 코드는 되감기, 그 외는 잔류 |
| 초안 DataStore | 흐름 진입 시 덮어쓰기 · 성공 시 비우기 · **경로는 있는데 파일이 없으면 빈 초안 취급** |

`Authorization` 부재 검증은 형식이 아니다. 그것이 붙으면 업로드가 **아예 동작하지 않는** 이
라운드의 핵심 실패 모드다.

## 주의 / 열린 질문

- ⚠️ **편집 화면에서 본 테두리 굵기와 캔버스에서 보이는 굵기가 다를 수 있다**(OQ-P-245). 편집
  화면은 dp를 원본 픽셀 좌표계에 환산해 그리고, 캔버스는 `borderWidth`를 화면 dp로 고정해 그린다
  (토핑을 키워도 굵기가 그대로다). 어느 쪽이 정책인지 위키에 근거가 없다.
- **배치 화면과 캔버스의 클립 모양이 다르다.** 배치 화면은 사각으로 자르고 캔버스는 모서리가 잘린
  모양(`YGCanvas#CanvasArea`)으로 자른다. 모서리에 걸쳐 놓은 토핑은 캔버스에서 더 잘린다.
  "본 대로 올라간다"가 모서리에서만 성립하지 않는다.
- 고아 `PENDING` 이미지·S3 객체가 재시도마다 늘어난다. 서버에 정리 경로가 없는 것은 기존 미결이고
  이 라운드가 그 발생률을 처음으로 실제화한다.
- ✅ **되감기 판정 근거 문제는 PR5가 판정했다**(OQ-P-247 해소, ①안). 서버가 HTTP 200에 실패
  봉투를 싣는 경로가 `api/` 계약 스냅샷에 없고, 되감기 대상 세 코드에 status로 갈려야 하는 동명
  코드도 없어 위 실패 처리 절이 `code` 하나로 판정하도록 바뀌었다 — `statusCode`는 조건에 넣지 않는다.
- ✅ **업로드 확정과 배치 사이 취소는 감수로 닫혔다**(OQ-P-248 해소, 감수). 서버에 확정된 이미지만
  남고 `mapErrorToAppError`가 `CancellationException`을 재던져 그 취소가 실패 `Result`가 아니라
  예외로 화면까지 올라가는 것은 정상 계약으로 둔다 — 재시도 결정이 이미 고아 S3 객체를 감수하기로
  한 것과 같은 처분이다. 코드 변경 없이 `AddToppingUseCase` KDoc 한 줄로 남겼다.
- presigned URL 만료를 판정하지 않는다. 만료는 실패 후 전량 재시도로만 풀린다.
- `positionZ`가 흐름 진입 시점에 못 박히므로, 그 사이 남이 올린 토핑과 z가 겹칠 수 있다.
  서버가 유일성을 요구하지 않아 거부되지는 않는다.
- 배치 화면 미리보기와 캔버스 렌더가 실제로 같은 그림인지는 사람 눈으로만 확인한다
  (스크린샷 테스트 없음).
