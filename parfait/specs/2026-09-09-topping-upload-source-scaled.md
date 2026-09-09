---
id: topping-upload-source-scaled
title: 토핑 업로드 원본 기준 축소 (Topping upload scaled by source photo)
status: draft
category: behavior-spec
platforms: android
verified: 2026-09-09
related_code:
  - UploadImagePlan#of
  - UploadImagePreprocessor
  - UploadImagePreprocessorImpl
  - ImageUploadRepository#upload
  - ImageUploadRepositoryImpl#upload
  - UploadImageUseCase
  - AddToppingUseCase
  - SegmentationResult
  - SegmentationCandidate
  - ImageSegmentationRepositoryImpl#persistSubject
  - SegmentationViewModel
  - ToppingEditViewModel
  - ToppingEditResult
  - SegmentationConfirmViewModel
  - ToppingDraft
  - ToppingDraftEntity
  - ToppingDraftRepository#record
  - CanvasToppingPlaceViewModel
related_adr: ADR-0032
related_spec: upload-image-downscale
related_architecture:
  - data-layer.md
supersedes:
superseded_by:
tags: [spec, parfait, image, upload, topping]
---

# Spec: 토핑 업로드 원본 기준 축소

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처(source of truth). 본문은 설계 내용에 집중.

## 목표

서버로 나가는 누끼 토핑의 픽셀 수와 바이트를 줄인다. 상한을 잘린 판에 거는 대신 **누끼를 오려낸
사진 전체를 기준으로 배율을 정해** 그 배율을 잘린 판에 적용한다.

## 배경 — 관찰된 사실

iOS 팀이 토핑 로딩이 느리다고 요청해 왔다(2026-09-09). 서버에 올라간 파일 3건의 실측이다.

| 바이트 | 로딩 | 치수 |
|---|---|---|
| 41 KB | 0.10s | 167x167 |
| 94 KB | 0.11s | 860x534 |
| 633 KB | 0.37s | 925x450 |

로딩 시간이 바이트를 그대로 따라간다. 그런데 **세 건 모두 긴 변이 현행 상한
`NUKKI_LONG_SIDE_LIMIT`(1500) 아래**라 지금 규칙은 이 파일들에 아무 일도 하지 않는다.
[upload-image-downscale](archive/2026-09-08-upload-image-downscale.md)이 상한을 잘린 판에 걸었기
때문이다. 그 스펙을 통째로 대체하지는 않는다 — 배경 규칙은 거기가 그대로 정본이고, 이 스펙은
누끼 갈래만 갈아 끼운다. 잘린 판은 알파 bbox와 같아서(`postProcess`가 `require`로 강제한다) 피사체가 프레임의
일부만 차지하면 원본이 아무리 커도 상한에 닿지 않는다.

기준을 원본으로 옮기면 그 3건이 전부 걸린다. 원본 치수는 기록되지 않아 모르지만, 12MP 카메라
사진(긴 변 4032)에서 오려냈다고 가정하면 925x450 알맹이는 배율 `1280 / 4032`를 맞아 294x143이 되고
바이트는 대략 그 제곱만큼 준다. **가정이므로 구현 후 로그로 실측한다**(아래 「주의」).

## 결정한 규칙

```
배율 = 1280 / 원본 긴 변
업로드 토핑 = 잘린 판 × 배율
```

**원본**은 세그멘테이션에 들어간 판 전체다. 카메라 경로는 뷰파인더로 잘라낸 뒤가 원본이다
(`CameraCrop`이 자른 JPEG를 파일로 떨구고 그 파일이 `decodeImage`로 들어간다). 갤러리 경로는
EXIF 회전을 보정한 판이 원본이다.

**1280을 고른 근거는 둘이다.**

- `BitmapFactory`의 `inSampleSize`가 2의 거듭제곱 계단이라 `1280 = 2^8 × 5` 쪽이 정합이 낫다.
  `UploadImagePlan#sampleSizeOf`가 고른 배수로 정확히 떨어지면 `decodeDownscaled`의 밀도 보정
  단계를 타지 않는다.
- 커스텀 카메라가 9:16 고정이라 카메라 경로가 항상 720x1280으로 떨어진다. 720p 계열이라
  팀 안에서 설명하기 쉽다.

**모델 입력은 건드리지 않는다.** 세그멘테이션은 지금처럼 원본 해상도에서 돌고, 축소는 업로드
경계에서만 일어난다. 따라서
[segmentation-preprocessing](2026-08-23-segmentation-preprocessing.md)이 제외 항목으로 적은
「원본 다운샘플」과 충돌하지 않고, 같은 문서의 짧은 변 512 하한과도 무관하다.

**로컬 파일은 원본 해상도로 남는다.** 수동 편집(C-104)이 읽는 것은 원본 크기 캔버스 판이고
업로드되는 것은 잘린 판이다. 두 파일이 다르므로 업로드 경계에서 줄여도 편집 품질이 내려가지
않는다.

## 범위

**포함**

- 누끼 업로드의 목표 치수 판정을 원본 긴 변 기준으로 바꾼다.
- 원본 긴 변을 세그멘테이션에서 업로드 경계까지 나르는 경로를 만든다.
- 잘린 판의 하한을 둔다.
- 배경 업로드는 그대로 둔다(긴 변 2048, JPEG 품질 70).

**제외**

- **기존 업로드분 재처리** — 앞으로 올라가는 토핑에만 적용한다. 캔버스가 매일 03시에 마감·재생성
  되므로 시간이 지나면 교체된다. 지난 캔버스 조회는 여전히 옛 파일을 받는다.
- **읽기 쪽 디코딩 크기 제한** — `rememberReloadableImageRequest`가 `.size()`를 주지 않아 Coil이
  `SizeResolver.ORIGINAL`로 떨어지는 문제는 별개 라운드다. 이 스펙은 서버로 나가는 바이트만 다룬다.
- **WebP 전환** — 서버가 `image/png`·`image/jpeg` 2종만 받는다. 누끼는 알파가 필요해 PNG를 유지한다.
- **iOS 정합** — 아래 「iOS와의 관계」 참고.

## iOS와의 관계

**Android 독자 규격이다.** iOS `ToppingImageEncoder.maximumLongEdge`는 **잘린 판**에 거는 상한이고
이 스펙의 1280은 **원본**에 거는 기준이라, 두 숫자는 같은 것을 재지 않는다. 값을 맞춘다는 말 자체가
성립하지 않으므로 정합을 시도하지 않는다. 근거는 ADR-0032.

배경 상한 2048과 JPEG 품질 70은 지금처럼 iOS와 같은 값을 유지한다.

⚠️ 코드 주석과 archive 스펙에 남아 있는 「iOS 와 맞춘 값」 문장은 누끼에 한해 사실이 아니게 된다.
`UploadImagePlan`의 해당 주석을 걷고 ADR 포인터로 바꾼다.

## API / 인터페이스

원본 긴 변은 값 클래스로 나른다. `ToppingDraftRepository#record`의 인자 목록에 이미
`borderColorArgb: Int?`가 있어 벌거벗은 `Int?`를 하나 더 붙이면 인접한 두 값이 서로 바뀔 수 있다.

```kotlin
// domain/model/image/
/** 누끼를 오려낸 사진 전체의 긴 변(픽셀). 카메라는 뷰파인더로 자른 뒤가 기준이다. */
@JvmInline
value class SourceLongSide(val px: Int)
```

값이 지나는 자리와 각 자리가 아는 출처다.

| 자리 | 변경 | 값의 출처 |
|---|---|---|
| `SegmentationResult` | `sourceLongSide` 추가 | `SegmentationCandidate`의 `canvasWidth`·`canvasHeight` 중 큰 값 |
| `ToppingEditResult` | `sourceLongSide` 추가 | 편집 결과 cutout(원본 크기 판)의 긴 변 |
| `ToppingDraft` | 널 가능 필드 추가 | 위 둘, 그리고 `SegmentationViewModel#useOriginal`은 원본 비트맵 치수 |
| `ToppingDraftEntity` | 널 가능 `Int?` 필드 추가 | 매퍼가 감싸고 푼다 |
| `ToppingDraftRepository#record` | 인자 추가 | 호출부 |
| `AddToppingUseCase` | 인자 추가 | 초안 |
| `ImageUploadRepository#upload` | 인자 추가 | 위 |
| `UploadImagePreprocessor#prepare` | 인자 추가 | 위 |

```kotlin
suspend fun upload(
    filePath: String,
    imageType: ImageType,
    /** 배경은 이 값을 보지 않는다. 모르면 null — 잘린 판 상한만 걸린다. */
    sourceLongSide: SourceLongSide?,
): Result<ImageId>
```

**기본값을 두지 않는다.** 새 호출부가 생겼을 때 빠뜨린 것이 컴파일 단계에서 드러나야 한다. 배경
경로(`UploadImageUseCase`)는 `null`을 명시적으로 적는다.

`ImageType`을 새 축으로 가르지 않는다. 누끼만 이 값을 쓰는 것은 사실이나, 그 차이를 sealed 타입으로
표현하면 `ImageKeyGenerator`의 S3 키 규칙까지 따라 움직인다. 기존 분기를 재사용한다.

## 동작 / 상태

`UploadImagePlan#of`가 인자를 하나 더 받고, 현재의 `sourceSize`는 이름을 `fileSize`로 바꾼다.
그대로 두면 「원본 사진」과 「올릴 파일」이 둘 다 `source`가 되어 반드시 헷갈린다.

```kotlin
fun of(
    fileSize: UploadImageSize,          // 올릴 파일(누끼면 잘린 판)의 치수
    imageType: ImageType,
    sourceFormat: UploadImageFormat,
    sourceLongSide: SourceLongSide?,    // 누끼를 오려낸 사진 전체의 긴 변
): UploadImagePlan
```

상수는 `UploadImagePlan`이 소유한다. 두 값은 같은 숫자지만 역할이 다르다 — 하나는 배율의 분자이고
다른 하나는 결과물의 상한이다.

| 상수 | 값 | 역할 |
|---|---|---|
| `NUKKI_SOURCE_LONG_SIDE` | 1280 | 배율의 분자. 원본 긴 변을 이 값으로 본다 |
| `NUKKI_LONG_SIDE_LIMIT` | 1280 | 잘린 판 결과물의 상한. 원본을 모를 때의 방어선 |
| `NUKKI_MIN_LONG_SIDE` | 640 | 잘린 판이 이 값 이하면 줄이지 않는다 |
| `BACKGROUND_LONG_SIDE_LIMIT` | 2048 | 그대로 |

목표 치수의 갈래다.

| imageType | sourceLongSide | 잘린 판 긴 변 | 목표 치수 |
|---|---|---|---|
| BACKGROUND | 무관 | 무관 | `scaledSize(fileSize, 2048)` — 변경 없음 |
| NUKKI | null | 무관 | `scaledSize(fileSize, 1280)` — 방어선만 |
| NUKKI | 있음 | ≤ 640 | `fileSize` 그대로 |
| NUKKI | ≤ 1280 | > 640 | `fileSize` 그대로 — 확대하지 않는다 |
| NUKKI | > 1280 | > 640 | 배율 적용 후 `scaledSize(…, 1280)`을 겹친다 |

배율 갈래가 확대를 만들 수 없는 이유는 원본 긴 변이 1280 이하일 때 `fileSize`를 그대로 돌려주기
때문이다. 뒤에 방어선을 한 번 더 겹치는 이유는 `sourceLongSide`가 잘린 판보다 작다고 주장하는
망가진 입력을 막기 위해서다.

포맷 규칙과 `sampleSize` 계산은 바꾸지 않는다. 치수·포맷이 둘 다 그대로면 `Passthrough`라는 성질도
유지된다.

### 하한을 두는 이유

배율은 피사체 크기를 보지 않으므로 작게 찍힌 피사체가 극단적으로 줄어든다. 4032px 사진에서 오려낸
100x80 알맹이는 배율 `1280/4032`를 맞아 32x25가 되고, 캔버스 기본 배치에서 열 배 넘게 확대되어
그려진다.

막는 비용은 사실상 없다. **작은 알맹이는 이미 파일이 작아서** 더 줄여도 바이트 이득이 없다(위
측정표의 41KB/167x167이 그 예다). 640은 1280의 절반이라 같은 계열이고, 큰 기종의 캔버스 기본
배치(`TOPPING_BASE_LONG_SIDE_RATIO` 0.4를 폭 428dp·배율 3.5에 적용하면 약 599px)를 등배로 덮는다.

### 회전

`SegmentationCandidate`의 캔버스 치수는 EXIF 보정을 마친 판에서 나오고 잘린 판도 같은 좌표계라,
배율은 회전과 무관하게 일관된다. 업로드 경계의 기존 회전 굽기 로직은 그대로 둔다.

### "편집 없이 사용" 경로

`SegmentationViewModel#useOriginal`은 한 파일을 `subjectImagePath`와 `cutoutImagePath` 두 자리에
싣는다. 축소가 업로드 경계에서 일어나므로 로컬은 원본으로 남고, 배율을 적용하면 결과가 정확히 긴 변
1280이 된다. **특별 취급이 필요 없다.** 지금 이 경로는 트리밍이 없어 원본이 그대로 올라가는
유일한 구멍인데, 이 스펙이 그 구멍도 함께 막는다.

### 로깅

`UploadImagePreprocessorImpl`이 이미 남기는 축소 전후 줄에 원본 긴 변과 배율을 덧붙인다. 전후 비교의
근거가 이 로그다.

## 파일 구성

| 파일 | 역할 | 조건 |
|---|---|---|
| `domain/model/image/SourceLongSide.kt` | 값 클래스 | 신규 |
| `domain/model/SegmentationResult.kt` | 필드 추가 | 수정 |
| `domain/model/topping/ToppingDraft.kt` | 필드 추가 | 수정 |
| `domain/repository/topping/ToppingDraftRepository.kt` | `record` 인자 추가 | 수정 |
| `domain/repository/image/ImageUploadRepository.kt` | `upload` 인자 추가 | 수정 |
| `domain/usecase/topping/AddToppingUseCase.kt` | 인자 추가·전달 | 수정 |
| `domain/usecase/image/UploadImageUseCase.kt` | `null` 명시 | 수정 |
| `data/model/local/ToppingDraftEntity.kt` | `Int?` 필드 + 매퍼 | 수정 |
| `data/model/image/UploadImagePlan.kt` | 판정 로직·상수 | 수정 |
| `data/utils/image/UploadImagePreprocessor.kt` | `prepare` 인자 추가 | 수정 |
| `data/utils/image/UploadImagePreprocessorImpl.kt` | 인자 전달·로깅 | 수정 |
| `data/repository/image/ImageUploadRepositoryImpl.kt` | 인자 전달 | 수정 |
| `data/repository/image/ImageSegmentationRepositoryImpl.kt` | `persistSubject`가 값 채움 | 수정 |
| `feature/segmentation/impl/.../SegmentationViewModel.kt` | 세 경로에서 `record` | 수정 |
| `feature/segmentation/impl/.../ToppingEditViewModel.kt` | 결과에 값 실음 | 수정 |
| `feature/segmentation/api/.../NavKeyToppingEdit.kt` | `ToppingEditResult`에 필드 추가 | 수정 |
| `feature/segmentation/impl/.../SegmentationConfirmViewModel.kt` | 편집 결과를 초안에 반영 | 수정 |
| `feature/groups/canvas/impl/.../CanvasToppingPlaceViewModel.kt` | 초안 값을 UseCase로 | 수정 |

## 테스트

- `UploadImagePlanTest`(JVM 순수)를 넓힌다. 배율 갈래, `sourceLongSide == null` 방어선 갈래, 640 하한,
  확대 금지, 배경 무영향, 그리고 원본 긴 변이 잘린 판보다 작다고 주장하는 망가진 입력.
- 초안 왕복은 `ToppingDraftLocalDataSourceImplTest`에 넣는다. **필드가 없는 기존 저장분을 읽으면
  `null`이 나오는지**가 핵심 케이스다.
- `SegmentationViewModelTest`는 세 경로가 `record`에 실은 값을 본다.
- 매퍼 단독 테스트는 만들지 않는다. 판단이 든 변환은 DataSource 테스트 케이스로 덮는다.

## 주의 / 열린 질문

- ⚠️ **[topping-draft-usecase-extraction](2026-09-09-topping-draft-usecase-extraction.md)과 같은 자리를
  건드린다.** 그 스펙은 `status: implemented`지만 **코드는 아직 `develop`에 없다** — `usecase/topping/`에
  초안 UseCase 5종이 없고 `SegmentationViewModel`·`SegmentationConfirmViewModel`·
  `CanvasToppingPlaceViewModel`·`CanvasMainViewModel` 넷이 여전히 `ToppingDraftRepository`를 직접 받는다.
  이 스펙의 「파일 구성」은 **현재 develop 기준**으로 적었다. 그 PR이 먼저 머지되면 `record` 호출부가
  `RecordToppingDraftUseCase` 뒤로 옮겨가므로 인자 추가 지점이 한 겹 늘어난다. 구현 착수 시점에
  `develop`을 다시 확인하고, 이미 머지됐으면 UseCase 쪽에 인자를 얹는다.

- ⚠️ **화질 손해를 받아들인 결정이다.** 작게 찍힌 피사체일수록 캔버스 확대율이 커지는데 이 규칙은
  바로 그 경우에 픽셀을 덜 준다. 640 하한이 최악값만 막는다. 로딩 개선이 목표라 감수한다.
- ⚠️ **로딩 개선의 절반은 이 스펙 밖에 있다.** Android 읽기 쪽은 `rememberAsyncImagePainter`가
  `SizeResolver.ORIGINAL`로 떨어져 표시 크기와 무관하게 원본 해상도로 디코드한다. iOS는 버킷
  계단으로 막고 있다. 별도 라운드로 민다.
- 배율 적용 전후 바이트를 실측해 기록하지 않았다. 위 배경의 3건을 새 규칙으로 다시 올려 로그로
  확인한다.
- archive의 [upload-image-downscale](archive/2026-09-08-upload-image-downscale.md) 「결정 표」가
  JPEG 품질을 90으로, 누끼 상한 근거를 iOS 1500으로 적고 있다. iOS가 2026-09-09에 각각 0.7과 1200으로
  내려 두 값 다 사실이 아니다. 품질은 코드에서 이미 70으로 고쳤으므로 문서도 함께 바로잡는다.
