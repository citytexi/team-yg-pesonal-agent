---
id: upload-image-downscale
title: 업로드 이미지 다운스케일·배경 JPEG 고정 (Upload image downscale)
status: draft
category: behavior-spec
platforms: android
verified: 2026-09-08
related_code:
  - ImageUploadRepositoryImpl#upload
  - UploadImageFormat
  - ImageFileLocalDataSourceImpl#copyToCache
  - ImageSegmentationRepositoryImpl#saveToCacheAsPng
  - UploadImageUseCase
  - AddToppingUseCase
  - CanvasBGEditViewModel#uploadBackgroundImage
  - CanvasToppingPlaceViewModel#maxScaleToOverflowCanvas
  - ToppingEditViewModel
  - ToppingOutlineCache
  - PresignedUploadDataSourceImpl#put
related_adr: ADR-0017
related_spec: segmentation-preprocessing
related_architecture:
  - data-layer.md
supersedes:
superseded_by:
tags: [spec, parfait, image, upload]
---

# Spec: 업로드 이미지 다운스케일·배경 JPEG 고정

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처(source of truth). 본문은 설계 내용에 집중.

## 목표

서버로 나가는 이미지의 픽셀 수와 바이트를 줄인다. 지금은 업로드 경로 어디에도 축소가 없어서
카메라 원본 해상도가 그대로 S3에 올라가고, 소비 측은 그 해상도를 전혀 쓰지 않는다.

## 배경 — 관찰된 사실

서버에 올라간 파일을 실측한 결과가 출발점이다(팀 공유, 2026-09-08). 파일 6건의 픽셀 치수와
알파 bbox를 비교했더니 4건이 **완전히 일치**했고 2건은 2~5px 차이였다.

| 원본 크기 | 알파 bbox |
|---|---|
| 2600x3832 | 2598x3832 |
| 1662x1469 | 1662x1464 |
| 2297x2533 | 2297x2533 |
| 1098x1013 | 1098x1013 |
| 3000x1202 | 3000x1202 |
| 1000x1938 | 1000x1938 |

여기서 두 가지가 따라 나온다.

**첫째, 더 잘라서 줄일 여지가 없다.** `ImageSegmentationRepositoryImpl#postProcess`가 후처리
알파의 bbox로 비트맵을 잘라 저장하고 직후 `require`로 치수 일치를 강제한다. 업로드 파일이
알파 bbox와 같다는 것은 코드가 보장하는 등식이지 우연이 아니다.

**둘째, 문제는 절대 해상도다.** 2600x3832 ARGB_8888은 힙에서 약 40MB이고, PNG는 무손실이라
사진 콘텐츠에서 거의 줄지 않는다(`saveToCacheAsPng`가 넘기는 quality 100은 PNG에서 무시되는
인자다). 반면 소비 측이 요구하는 해상도의 상계는 캔버스 긴 변이다 —
`CanvasToppingPlaceViewModel#maxScaleToOverflowCanvas`가 토핑 배율 상한을 캔버스 긴 변에서
유도하고, 배경은 캔버스를 채우며, 테두리용 거리장은 `ToppingOutlineCache`가 256px로 줄여
계산한다.

> ℹ️ 완전 일치 4건이 `originalCandidate` 경로(누끼 없이 원본 판을 그대로 후보로 내주는 자리)를
> 탄 것인지 여부는 이 스펙이 판정하지 않는다. 별도 미결로 남긴다(아래 주의 절).

## 범위

**포함**

- 업로드 직전 긴 변 상한 축소. 두 업로드 경로(`ImageType.NUKKI`·`ImageType.BACKGROUND`) 모두.
- 배경 업로드의 출력 포맷을 JPEG로 고정.
- 판정 로직을 순수 함수로 빼고 JVM 유닛으로 덮는다.
- 축소 전후 치수·바이트 로깅.

**제외**

- **WebP 전환** — 서버가 `image/png`·`image/jpeg` 2종만 받는다(`ImageKeyGenerator`가 그 외를
  `INVALID_CONTENT_TYPE`으로 던진다). 서버·iOS와 함께 움직여야 하므로 후속 라운드로 분리한다.
- **누끼 출력 포맷 변경** — 알파가 필요해 PNG를 유지한다.
- **`cacheDir/upload` 누적 정리** — 이 스펙이 만드는 임시 파일은 지우지만, `copyToCache`가 남기는
  기존 복사본은 건드리지 않는다.
- **세그멘테이션 입력 해상도** — [segmentation-preprocessing](2026-08-23-segmentation-preprocessing.md)이
  다루는 영역이고 목표 방향이 반대다(그쪽은 모델 입력의 정확도, 이쪽은 서버로 나가는 결과물).
- 캔버스 캡처(`writeToCanvasCaptureCache`) — 갤러리 저장·미리보기 전용이라 업로드와 무관하다.

## 설계

### 배치 — 업로드 경계 한 자리

`data` 레이어에 전처리 단위를 두고 `ImageUploadRepositoryImpl#upload`가 발급 직전에 부른다.

```kotlin
interface UploadImagePreprocessor {
    suspend fun prepare(file: File, imageType: ImageType): Result<PreparedUploadImage>
}

data class PreparedUploadImage(val file: File, val format: UploadImageFormat)
```

**소스가 아니라 업로드 경계에 두는 이유**는 로컬 사본의 용도가 업로드 하나가 아니기 때문이다.
누끼 파일(`SegmentationResult`의 잘린 판)은 `ToppingEditViewModel`의 수동 편집 입력이기도 하다.
그 화면은 확대해서 브러시로 다듬는 UX라 원본 해상도가 실제로 쓰인다. 소스에서 줄이면 편집
품질이 함께 내려간다. 경계에서 줄이면 **로컬은 원본을 유지하고 서버로 나가는 것만 줄어든다.**

배치의 부수 효과로 배경의 두 입력원(갤러리 선택, `returnResultOnly` 커스텀 카메라)이 같은
자리를 지나므로 규칙이 한 번만 적힌다.

`upload`는 현재 `UploadImageFormat.ofExtension`으로 contentType을 정한 뒤 발급과 PUT에 같은 값을
넘긴다. 전처리기가 파일과 포맷을 **쌍으로** 돌려주므로 그 성질이 유지된다. 둘이 갈라지면 S3가
서명 불일치로 거절하고 그 실패는 서버 로그에 남지 않는다.

### 결정 표

긴 변 상한은 **imageType마다 다르고, 값의 근거는 iOS다.** `TEAMYG-iOS`가 같은 서버에 같은
기능으로 올리고 있고 이미 상한을 두고 있다 — `ToppingImageEncoder.maximumLongEdge`가 1500,
`BackgroundImageLoader.maximumLongEdge`가 2048이며 배경은 `jpegCompressionQuality` 0.9로 굽는다.
플랫폼마다 상한이 다르면 같은 캔버스를 두 기기에서 볼 때 화질이 갈리므로 그 값을 그대로 쓴다.

| imageType | 긴 변 상한 |
|---|---|
| NUKKI | 1500 |
| BACKGROUND | 2048 |

| imageType | 입력 포맷 | 긴 변 | 동작 |
|---|---|---|---|
| NUKKI | PNG | > 1500 | 축소 후 PNG 재인코딩(알파 유지) |
| NUKKI | PNG | ≤ 1500 | 그대로 통과 |
| NUKKI | JPEG | > 1500 | 축소 후 JPEG 재인코딩 |
| NUKKI | JPEG | ≤ 1500 | 그대로 통과 |
| BACKGROUND | JPEG | > 2048 | 축소 후 JPEG |
| BACKGROUND | JPEG | ≤ 2048 | **그대로 통과** |
| BACKGROUND | PNG | 무관 | JPEG 재인코딩, 투명 영역은 흰색 합성 |

누끼의 JPEG 두 행은 방어적이다. `saveToCacheAsPng`가 항상 PNG로 굽기 때문에 지금은 닿지 않는
갈래이고, 전처리기가 imageType이 아니라 **입력 포맷**을 보고 판단한다는 것을 못박기 위해 적는다.
누끼의 출력 포맷은 입력을 따라가고 바꾸지 않는다.

**확대는 어떤 경우에도 하지 않는다.** 이 성질이 누적을 막는다. 토핑 재편집은 업로드본을 다시
내려받아(`ImageSegmentationRepositoryImpl#decodeImage`의 원격 갈래) 재분할하므로 같은 이미지가
전처리를 여러 번 지날 수 있는데, 두 번째 통과는 무동작이다.

**이미 JPEG이고 상한 이하인 배경을 다시 굽지 않는 이유**는 재인코딩이 손실만 더하고 이득이
없기 때문이다. 반대로 PNG 배경은 크기와 무관하게 굽는다 — 스크린샷을 배경으로 고르는 경우가
용량 기여가 가장 크고, 배경은 캔버스를 덮는 불투명 이미지라 알파를 버려도 잃는 것이 없다.

JPEG quality는 **90**으로 둔다. iOS의 `jpegCompressionQuality` 0.9와 같은 값이다.

### 메모리

원본을 통째로 디코드하면 축소하려다 OOM이 난다. `BitmapFactory.Options.inJustDecodeBounds`로
치수를 먼저 읽고 `inSampleSize`(2의 거듭제곱)로 줄여 디코드한 뒤, `createScaledBitmap`으로 목표
치수에 정확히 맞춘다. 중간 비트맵은 `recycle`한다.

### 임시 파일

전처리가 새 파일을 만들었으면 업로드의 성공·실패와 무관하게 지운다. 원본을 그대로 통과시킨
경우에는 아무것도 지우지 않는다 — 그 파일의 수명은 부른 쪽이 쥐고 있다.

### 실패 처리

전처리가 실패하면 **업로드 전체를 실패시킨다.** 원본으로 폴백하지 않는다. 축소 경로는 원본
디코드보다 메모리를 적게 쓰므로 실패한 자리에서 원본을 올리는 것은 더 큰 메모리를 요구하는
선택이고, 배경 JPEG 고정은 정책이라 조용히 어기면 안 된다.

### 로깅

축소 전후의 치수와 바이트 수를 남긴다. 이 스펙의 효과는 "서버에 올라간 파일이 작아졌는가"로만
판정되는데, 그 값을 앱 쪽에서 확인할 수단이 지금 없다.

## 검증

- **JVM 유닛** — 목표 치수 산출, `inSampleSize` 계산, 결정 표의 재인코딩 필요 판정을 순수 함수로
  빼서 덮는다. 경계값(상한 정확히, 상한+1, 정사각형, 극단 종횡비)과 **imageType마다 상한이
  다르다는 것**(같은 1600px 이미지가 NUKKI에서는 줄고 BACKGROUND에서는 안 준다)을 포함한다.
- **JVM 유닛** — `ImageUploadRepositoryImpl`은 전처리기를 대역으로 두고, 전처리 결과의 파일과
  포맷이 발급 요청과 PUT에 **같은 값으로** 실리는지 검증한다. 기존 `ImageUploadRepositoryImplTest`의
  구성(mockk + `kotlin.test`)을 그대로 쓴다.
- **수동** — 실제 디코드·인코딩은 실기기에서 눈으로 확인한다. `data` 모듈에 계측 테스트 소스셋이
  없고 프로젝트에 Robolectric도 없어, 새 하니스를 들이지 않기로 확정했다.
  확인 항목: 큰 사진 누끼 업로드 · 상한 이하 누끼(무동작) · JPEG 배경 · PNG 스크린샷 배경 ·
  투명 PNG 배경(흰색 합성) · 업로드본 재편집(2회차 무동작) · 캔버스에서 토핑 최대 확대 시 화질.

## 주의 / 열린 질문

- **완전 일치 4건의 정체가 미확인이다.** 알파가 전 픽셀 불투명하다는 뜻이고, 그렇다면
  `originalCandidate` 경로(누끼 없이 원본 판)를 탄 것이 된다. 사용자가 원본 후보를 고른 정상
  동선인지, 후처리가 알파를 전부 지워 되돌아간 것인지에 따라 대응이 달라진다. 판정 수단은
  `ImageSegmentationRepositoryImpl`이 이미 남기는 되돌림 로그다. **이 스펙과 독립이다** — 어느
  쪽이든 축소의 필요성은 바뀌지 않는다.
- **상한값의 근거는 iOS와의 정합이지 측정이 아니다.** iOS가 1500·2048을 어떻게 골랐는지는
  그쪽 코드에 적혀 있지 않다. 축소 후 실제 바이트가 얼마나 주는지는 수동 확인에서 처음
  나오고(검증 절), 기대에 못 미치면 값이 아니라 포맷(WebP)이 다음 레버다.
- **두 플랫폼이 같이 낮추는 것은 별건이다.** 소비 측 상계는 캔버스 긴 변이라 2048은 그보다
  크다. 값을 낮추려면 iOS와 함께 움직여야 하고, 이 스펙은 그 협의를 하지 않는다.
- **기존 업로드본은 그대로다.** 이미 올라간 큰 파일을 줄이는 마이그레이션은 없다.
