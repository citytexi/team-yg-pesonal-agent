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
  - CanvasToppingLayer.kt#TOPPING_BASE_LONG_SIDE_RATIO
  - CanvasToppingLayer.kt#CanvasTopping
  - ImageRemoteDataSource.kt#issueUploadUrl
  - ImageRemoteDataSource.kt#confirmUpload
  - ParfaitImageRemoteDataSource.kt#placeTopping
  - NetworkModule.kt#provideUnauthenticatedOkHttpClient
  - AuthInterceptor.kt
  - SegmentationConfirmRoute.kt#SegmentationConfirmRoute
  - ToppingEditViewModel.kt#completeEdit
  - ToppingEditMask.kt#trimTransparentBounds
  - CanvasMainViewModel.kt#loadTodayCanvas
  - ServerErrorCode.kt#Parfait
related_adr: ADR-0025, ADR-0026, ADR-0017, ADR-0020
related_spec: c106-topping-place, image-api-service-layer, parfait-canvas-topping-member-api-service-layer, ygscaffold-v2-common-loading-error, c103-segmentation-topping-edit
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
  - 화면 좌표 → 서버 좌표 변환
  - 로딩 오버레이 · 실패 토스트 · 마감(409) 되감기
- **제외**
  - **토핑 수정·삭제·테두리 재편집 API** — DataSource에 넷 다 있으나 소비 화면이 C-301 라운드다.
    쓰지 않는 것을 Repository로 올리면 계약이 바뀌어도 아무도 고치지 않는다.
  - **배경 이미지 업로드**(C-301) — 같은 `ImageUploadRepository`를 쓰지만 결선은 그 라운드 몫이다.
  - **배치 화면의 실제 배경·기존 토핑 미리보기** — OQ-P-240을 연 채로 둔다.
  - 고아 `PENDING` 이미지 정리 · 회전·리사이즈 한계의 정책 근거(OQ-P-241) ·
    드래그 핸들 접근성(OQ-P-202 ③) · `60.dp`/`14.dp` 리터럴(OQ-P-203 ③)

## 결정된 것

| 쟁점 | 결정 | 근거 |
|---|---|---|
| 업로드 전송 포함 여부 | 전체 체인 한 라운드 | `imageId`를 얻을 경로가 없으면 배치만 붙여도 동작하지 않는다 |
| 조율 위치 | `AddToppingUseCase` 하나 | 4단계 순서는 서버 계약이 정한 도메인 규칙이지 화면 관심사가 아니다. C-301 배경이 앞 3단계를 재사용한다 |
| `positionZ` | 흐름 진입 시 캔버스의 최대 z + 1 | 새 토핑이 항상 맨 위. 서버가 유일성을 요구하지 않아 남과 겹쳐도 거부되지 않는다 |
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
    suspend fun upload(fileUri: String, imageType: ImageType): Result<ImageId>
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

`contentType`을 파라미터로 받지 않는 것이 설계다. **구현이 한 번 정해 발급 요청과 PUT 헤더 양쪽에
같은 값을 쓴다.** 두 값은 S3 서명 대상이라 어긋나면 실패하는데 그 실패는 서버 로그에 남지 않는다.
한 곳에서만 나오면 어긋날 수가 없다.

## 업로드 전송 — 전용 클라이언트가 기능 전제다

`AuthInterceptor`는 Retrofit `Invocation` 태그로 `@NoAuth`를 판정한다. 발급받은 `uploadUrl`로
raw OkHttp `Request`를 만들어 쏘면 그 태그가 없어 **`Authorization`이 무조건 붙고**, presigned URL에
그 헤더가 실리면 S3가 거절한다. 공유 클라이언트를 쓰면 업로드가 아예 동작하지 않는다.

기존 `@UnauthenticatedClient`를 재사용하지 않는다. 그 클라이언트는 KDoc이 존재 이유를 **재발급
교착 회피**로 못박아 뒀고 전용 `Dispatcher`를 그 목적으로 들고 있다. 이미지 업로드가 그 슬롯을
오래 점유하면 401이 몰리는 순간 재발급이 다시 굶는다. `@UploadClient`를 따로 만들고 전송 성격에
맞는 타임아웃을 준다(수치는 코드가 정한다 — 문서에 적지 않는다).

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
| 세그멘테이션 완료 | 알맹이·cutout 경로 기록 |
| 토핑 편집 완료 | 알맹이·cutout·테두리 기록(덮어쓰기) |
| 배치 확정 성공 | 비운다 |

낡은 초안이 다음 흐름에 따라붙는 문제는 **진입 시 덮어쓰기 규칙 하나로** 닫힌다. 별도 만료·정리
경로를 두지 않는다.

`SegmentationConfirmRoute`의 `rememberSaveable` 셋과 `TOPPING_EDIT_RESULT_KEY` 결과 전달이 이
초안으로 대체된다. 같은 값을 두 곳이 들고 있으면 SSOT가 아니다.

**`NavKeyCanvasToppingPlace`는 인자가 없어진다.** `camera`·`segmentation` 모듈이 캔버스 개념을
떠안지 않는 것이 이 배치의 실익이다.

**가드** — `CanvasMainUiState.todayCanvas`가 아직 없으면 `parfaitId`도 `nextPositionZ`도 없다.
그 상태에서는 **토핑 추가 진입 자체를 막는다.** 열어 두면 촬영·누끼·편집을 다 마친 뒤 마지막에야
올릴 데가 없다는 것을 알게 된다.

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

정규화가 성립하는 근거는 두 화면의 Canvas-Area가 같은 `CANVAS_ASPECT_RATIO` 고정이라는 점이다.
패딩이 달라 실측 크기는 다르지만 비율이 같으므로 정규화 좌표는 보존된다.

캔버스·토핑 실측이 아직 없으면 변환이 성립하지 않는다. 그동안 **확인 버튼을 비활성**한다.

## 실패 처리

로딩은 `launch(key = …)`로 연타를 막고 `isLoading`을 세워 `YGScaffoldV2`의 오버레이가 터치를
삼킨다. 4단계 전체가 한 덩어리라 단계별 진행률은 표시하지 않는다.

| 실패 | 화면 |
|---|---|
| `PARFAIT_ALREADY_CLOSED`(409) | 토스트 후 **캔버스로 되감는다** |
| 그 외 전부 | 토스트만. 배치 화면에 머문다 |

마감된 캔버스에는 다시 눌러도 영원히 실패한다. 머물게 하면 사용자가 할 수 있는 일이 실패를
반복하는 것뿐이다. 그 외에는 확인을 다시 눌러 **발급부터 전부 다시** 탄다.

`AppError` → 문구 공통 매핑은 아직 없다([ygscaffold-v2 스펙](archive/2026-08-16-ygscaffold-v2-common-loading-error.md)이
명시적으로 제외한 항목). 이 화면이 자기 문구를 가진다.

성공하면 초안을 비우고 `popUpTo<NavKeyCanvasMain>()`으로 되감는다. `CanvasMainViewModel`에 이미
`handleEnter()` → `loadTodayCanvas()`가 있어 되돌아온 순간 새 토핑이 함께 내려온다.

## PR 분할 (스택)

아래에서 위로 쌓는다. 각 PR은 **그 시점에 develop이 깨지지 않는다.**

| # | 브랜치 성격 | 내용 | 사용자에게 보이는 변화 |
|---|---|---|---|
| 1 | 업로드 전송 계층 | `@UploadClient` · `PresignedUploadDataSource` · `ImageUploadRepository`/Impl · DI | **없음**(소비자 0) |
| 2 | 배치 계층 | `ToppingRepository`/Impl(`place`만) · `AddToppingUseCase` | **없음**(소비자 0) |
| 3 | 초안 SSOT | `ToppingDraft` + local DataSource + Repository · `CanvasMain` 진입 시 초안 열기 + 진입 가드 · 세그멘테이션·편집이 초안 채우기 · `rememberSaveable`/result key 걷기 | 토핑 추가 진입 가드만 |
| 4 | 테두리 계약 전환 | 트리밍된 알맹이 생성 · 테두리를 굽지 않고 초안에 값으로 기록 · 배치 화면이 초안을 읽고 8방향 스탬프로 미리보기 · `NavKeyCanvasToppingPlace` 인자 제거 | **테두리 렌더 방식이 바뀐다** |
| 5 | 결선 | 좌표 변환 · `AddToppingUseCase` 호출 · 로딩·토스트·409 되감기 · 성공 시 초안 비우기 | **토핑이 서버에 올라간다** |

1과 2는 소비자가 없어 리뷰가 각각 **S3 서명**과 **계약 매핑** 한 가지에만 집중할 수 있다.
4가 시각 회귀 위험이 유일하게 몰리는 자리라 실기기 확인을 여기에 붙인다.

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
| `feature/groups/canvas/impl/.../CanvasToppingPlaceViewModel` | 좌표 변환·확정·실패 표현 |
| `feature/groups/canvas/impl/.../component/` | `CanvasToppingLayer`의 8방향 스탬프 추출(두 화면 공유) |

## 테스트

| 대상 | 확인할 것 |
|---|---|
| `PresignedUploadDataSource` | PUT에 **`Authorization`이 붙지 않는다** · `Content-Type`이 발급 때 쓴 값과 같다 |
| `ImageUploadRepositoryImpl` | 3단계 순서 · 중간 실패가 그대로 올라온다 · 실패 후 다음 단계를 부르지 않는다 |
| `AddToppingUseCase` | 업로드 실패 시 배치를 부르지 않는다 |
| 좌표 변환(순수 함수) | 정중앙·모서리·회전·스케일에서 읽기 쪽 식으로 되돌리면 원래 화면 좌표가 나온다(왕복) |
| `CanvasToppingPlaceViewModel` | 실측 전 확인 비활성 · 연타 차단 · 409면 되감기, 그 외는 잔류 |
| 초안 DataStore | 흐름 진입 시 덮어쓰기 · 성공 시 비우기 |

`Authorization` 부재 검증은 형식이 아니다. 그것이 붙으면 업로드가 **아예 동작하지 않는** 이
라운드의 핵심 실패 모드다.

## 주의 / 열린 질문

- ⚠️ **편집 화면에서 본 테두리 굵기와 캔버스에서 보이는 굵기가 다를 수 있다.** 편집 화면은
  `originPxPerDp`로 dp를 원본 픽셀 좌표계에 환산해 그리고, 캔버스는 `borderWidth`를 화면 dp로
  고정해 그린다(토핑을 키워도 굵기가 그대로다). 어느 쪽이 정책인지 위키에 근거가 없다.
- 고아 `PENDING` 이미지·S3 객체가 재시도마다 늘어난다. 서버에 정리 경로가 없는 것은 기존 미결이고
  이 라운드가 그 발생률을 처음으로 실제화한다.
- presigned URL 만료를 판정하지 않는다. 만료는 실패 후 전량 재시도로만 풀린다.
- `positionZ`가 흐름 진입 시점에 못 박히므로, 그 사이 남이 올린 토핑과 z가 겹칠 수 있다.
  서버가 유일성을 요구하지 않아 거부되지는 않는다.
- 배치 화면 미리보기와 캔버스 렌더가 실제로 같은 그림인지는 사람 눈으로만 확인한다
  (스크린샷 테스트 없음).
