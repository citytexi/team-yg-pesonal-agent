---
id: segmentation-preprocessing
title: 세그멘테이션 입력 전처리 — 무손실 전달·해상도 하한·회전 정합 (Subject Segmentation input preprocessing)
status: draft
category: behavior-spec
platforms: android
verified: 2026-08-23
related_code: ImageSegmentationRepositoryImpl#decodeImage, ContentResolver.kt#decodeUriToBitmap, CameraCrop.kt#saveViewfinderCapture, FileCameraCacheLocalDataSourceImpl#createFile, CreateCameraCacheFileUseCase, CreateCameraCacheUriUseCase, DecodeImageUseCase, SegmentationViewModel, ToppingEditViewModel, NavKeyToppingEdit
related_adr: ADR-0012
related_spec: c103-multi-subject-selection, segmentation-pipeline-hardening
related_architecture: data-layer
supersedes:
superseded_by:
tags: [spec, parfait]
---

# Spec: 세그멘테이션 입력 전처리

## 목표

누끼의 **정확도**를 올린다. 대상을 더 잘 얻는 것이 목표이고 지연·메모리는 목표가 아니다.
세그멘테이션이 보는 픽셀이 만들어지는 세 자리(촬영 저장·디코드·모델 투입)를 고쳐,
모델에게 원본에 가장 가까운 입력을 준다.

## 근거 등급 (이 스펙의 성격)

**관찰된 실패 사례가 없는 상태에서 쓰는 스펙이다.** 사용자가 느린 것도 실패하는 것도 본 적 없고,
"누끼가 더 잘 나왔으면 좋겠다"가 출발점이다. 그래서 항목마다 근거의 등급을 적고, 등급이 낮은
항목은 검증 절의 사진 세트가 판정한 뒤에 남길지 정한다. **이 표가 이 스펙의 계약이다.**

| 항목 | 근거 | 구현 판정 |
|---|---|---|
| 촬영 결과를 무손실로 남긴다 | 기전이 분명하다 — JPEG 아티팩트는 경계에 몰리고, 마스크가 정확해야 하는 곳이 그 경계다 | 무조건 넣는다 |
| 회전 정합 | API 28 미만에서 EXIF가 적용되지 않는 갈래가 코드에 있다 | 실기기 확인 후 넣는다 |
| 짧은 변 512 하한 | ML Kit 문서가 하한을 명시한다 | **조건부** — 아래 경고 참고 |

> ⚠️ **512 하한 항목의 근거는 절반이다.** ML Kit Android 가이드 "Tips to improve performance" 절이
> "For ML Kit to get an accurate segmentation result, the image should be at least 512x512 pixels."
> 라고 적는다. 이것은 **하한 미만이면 정확하지 않다**는 말이지, **작은 이미지를 확대하면 회복된다**는
> 말이 아니다. 확대는 정보를 늘리지 않는다. 사진 세트에서 차이가 안 보이면 구현하지 않는다(OQ-P-278).

문서가 말하지 **않는** 것도 적어 둔다. 내부 다운스케일 여부, 모델의 실제 입력 해상도, 상한 치수는
공개 문서에 없다. 이 스펙은 그 셋을 전제로 삼지 않는다.

## 범위

**포함**

- `CustomCameraRoute` 촬영 결과의 저장 포맷을 무손실로 바꾼다.
- 디코드 지점에 세그멘테이션 입력 정규화 자리를 만든다. **그 자리에 무엇이 들어가는지는 위 근거
  등급 표를 따른다** — 회전 보정은 적용 범위(전 버전 / API 28 미만)를 실기기 확인으로 정하고,
  해상도 하한은 사진 세트가 효과를 보인 경우에만 넣는다.
- 판정을 순수 함수로 빼고 JVM 유닛으로 덮는다.
- 고정 사진 세트와 전후 비교 절차를 정한다.

**제외**

- **원본 다운샘플**(OQ-P-228 잔존) — 목표가 자원이 아니다. 마스크가 입력 크기로 나오므로
  축소한 마스크를 원본으로 되올리는 보간 손실이 새로 생긴다. 정확도를 목표로 두는 한 방향이 반대다.
- **대비·감마 정규화** — 문서 근거가 없다. 저조도·역광에서 전경 신뢰도가 뭉개진다는 것은 추정이다.
  사진 세트에 저대비 사진을 한 장 넣어 **기준선만 기록**하고 판단은 다음 라운드로 넘긴다.
- **후처리 전반** — 최대 연결 요소만 남기기, 모폴로지 open·close, 알파 램프, 경계 색 오염 제거,
  후보 면적을 bounding box 대신 불투명 픽셀 수로 재기. 별도 라운드다.
- **EXIF 미러링**(`ORIENTATION_FLIP_*`) — 좌우 반전은 세그멘테이션 정확도와 무관하고, 잘못 적용하면
  뒤집힌 누끼가 나온다. 회전 3종만 처리한다.
- **갤러리 경로의 JPEG 손실** — 사용자가 고른 파일이라 우리가 고칠 수 있는 것이 아니다.
- **`SystemCameraRoute` 저장 포맷** — OEM 카메라 앱이 쓴다. 우리 코드가 아니다.

## 설계

### 1. 촬영 결과를 무손실로 남긴다

`saveViewfinderCapture`가 JPEG로 압축해 쓴다. 그 파일이 곧 세그멘테이션 입력이므로, 모델은
회전·크롭을 마친 원본이 아니라 **한 번 손실된 사본**을 본다.

포맷을 **PNG로 바꾼다.** WebP 무손실이 더 작고 빠를 수 있으나 `WEBP_LOSSLESS`의 API 하한을 문서로
확인하지 못했다. 확인하지 못한 것을 설계에 넣지 않는다. 필요하면 인코딩 시간을 재고 후속으로 바꾼다.

확장자가 갈리는 자리는 이미 준비돼 있다. 커스텀 카메라는 `CreateCameraCacheFileUseCase`를 직접
쓰고, 시스템 카메라는 그것을 감싼 `CreateCameraCacheUriUseCase`를 쓴다. **파일 use case에 포맷
인자를 주고 기본값을 JPEG로 두면** OEM 카메라 앱이 쓰는 경로는 그대로 두고 커스텀 카메라만 PNG를
받는다. `CreateCameraCacheUriUseCase`는 인자를 넘기지 않으므로 손대지 않아도 JPEG를 유지한다.

대가는 파일 크기와 인코딩 시간이다. 확인 화면은 Coil(`rememberAsyncImagePainter`)이 디코드하므로
메인 스레드를 막지는 않으나 촬영 직후 표시가 늦어질 수 있다. **이 대가는 사용자가 정확도를 위해
받아들이기로 한 것이다**(브레인스토밍 2026-08-23, 접근안 B 선택). 실제 폭은 사진 세트에서 잰다.

### 2. 디코드 지점에서 입력을 정규화한다

**정규화를 `segmentImage`가 아니라 `decodeImage`에 넣는다. 이 선택에는 좌표계 근거가 있다.**

`NavKeyToppingEdit`는 `sourceImageUri`(원본)와 `segmentationImageUri`(잘라낸 결과)를 둘 다 나르고,
편집 화면은 후자의 알파를 전자 위의 시작 마스크로 쓴다. **두 이미지의 픽셀 치수가 같아야 성립한다.**
그런데 세그멘테이션 결과는 `persistSubject`가 `SegmentationCandidate`의 캔버스 치수, 즉 디코드된
비트맵의 치수로 쓴다.

따라서 확대나 회전을 `segmentImage` 안에서만 하면 결과물만 커지거나 돌아가고 원본은 그대로라,
편집 화면에서 마스크가 어긋난다. `decodeImage`에 넣으면 `SegmentationViewModel`과
`ToppingEditViewModel`이 **같은 `DecodeImageUseCase`를 타므로** 양쪽이 자동으로 같은 좌표계를 본다.
정규화된 비트맵이 이 흐름의 "원본"이 된다.

그 결과 `decodeImage`의 계약이 "URI를 디코드한다"에서 **"세그멘테이션 입력 규격으로 정규화해
디코드한다"**로 바뀐다. 이것을 `ImageSegmentationRepository` 인터페이스에 명시한다. 계약이 넓어지는
것이지 부수효과를 숨기는 것이 아니다.

**해상도 하한.** 짧은 변이 512 미만이면 짧은 변이 512가 되도록 비율을 지켜 확대한다. 이미 충분하면
아무것도 하지 않는다(같은 인스턴스를 그대로 돌려준다). 상한은 두지 않는다 — 축소는 범위 밖이다.

### 3. 회전 정합

`InputImage.fromBitmap(bitmap, 0)`이 회전 0을 단정한다. 이 단정이 참인지는 디코드 경로에 달렸다.

`decodeUriToBitmap`은 API 28 이상에서 `ImageDecoder`를, 미만에서 `MediaStore.Images.Media.getBitmap`을
쓴다. 후자는 EXIF orientation을 적용하지 않는다. `minSdk`가 26이므로 **API 26·27에서 누운 사진이
그대로 모델에 들어가는 갈래가 살아 있다.**

⚠️ **`ImageDecoder`가 EXIF를 자동 적용한다는 것은 공식 문서에서 확인하지 못했다**(OQ-P-280).
널리 그렇게 알려져 있으나 문장을 찾지 못했다. **이 스펙은 그것을 전제로 삼지 않는다** — 사진 세트에
EXIF 회전이 붙은 사진을 넣어 두 API 대역에서 각각 눈으로 판정하고, 그 결과에 따라 보정 범위를 정한다.
API 28 이상도 필요하다고 판명되면 버전 분기 없이 항상 보정한다.

보정 자체는 `decodeUriToBitmap` 안에 둔다. 이 확장 함수의 호출부가 `ImageSegmentationRepositoryImpl`
하나뿐이라 계약을 넓혀도 파급이 없고, API 버전 분기가 이미 그 안에 있어 갈라진 동작을 한자리에서 메운다.
`androidx.exifinterface` 의존성을 새로 넣어야 한다.

**EXIF를 못 읽으면 회전 0으로 진행한다.** 태그가 깨진 것과 이미지를 못 연 것은 다른 사건이다.
전자 때문에 디코드를 실패시키지 않는다.

## API / 인터페이스

```kotlin
// domain — 포맷은 도메인 어휘로 두고 확장자 매핑은 data 가 한다
enum class CameraCacheFormat { JPEG, PNG }

class CreateCameraCacheFileUseCase {
    // 기본값이 JPEG 라 CreateCameraCacheUriUseCase(시스템 카메라)는 손대지 않아도 된다
    operator fun invoke(format: CameraCacheFormat = CameraCacheFormat.JPEG): File
}

// domain — 계약이 넓어지는 자리
interface ImageSegmentationRepository {
    /** 세그멘테이션 입력 규격으로 정규화해 디코드한다 — 방향을 세우고 짧은 변 하한을 맞춘다 */
    suspend fun decodeImage(uri: String): BitmapWrapper
}

// data — 판단만 떼어 기기 없이 검증한다(SegmentationMask.kt 와 같은 이유)
internal data class ScaledSize(val width: Int, val height: Int)

/** 확대가 필요 없으면 null. 짧은 변이 [MIN_SEGMENTATION_SIDE] 가 되도록 비율을 지킨 치수를 낸다 */
internal fun computeUpscaleTarget(width: Int, height: Int): ScaledSize?

// core:util:android — ExifInterface 상수를 각도로. 미러링 4종은 0 이다(처리하지 않는다)
internal fun exifOrientationToDegrees(orientation: Int): Int
```

## 파일 구성

| 파일 | 역할 |
|---|---|
| `domain/.../camera/CameraCacheFormat.kt` | 신설. 포맷 어휘 |
| `CreateCameraCacheFileUseCase` | 포맷 인자 추가(기본 JPEG) |
| `FileCameraCacheLocalDataSource(+Impl)` | `createFile`이 포맷을 받아 확장자를 고른다 |
| `CameraCrop.kt#saveViewfinderCapture` | PNG로 압축. `JPEG_QUALITY` 상수 제거 |
| `CustomCameraViewModel` | 파일 생성 시 PNG를 넘긴다 |
| `data/.../image/SegmentationInputNormalizer.kt` | 신설. `computeUpscaleTarget`·하한 상수 |
| `ImageSegmentationRepositoryImpl#decodeImage` | 확대 적용. 중간 비트맵 회수 |
| `core/util/android/.../ContentResolver.kt` | EXIF 각도 보정을 `decodeUriToBitmap` 안에 |
| `gradle/libs.versions.toml` | `androidx.exifinterface` 추가 |

## 에러 처리

새 실패 표현을 만들지 않는다. 셋 다 기존 경로로 접힌다.

- **PNG 저장 실패** — `CustomCameraRoute`가 이미 `runCatching`으로 감싸 `OnCaptureFailed` 토스트로
  받는다. 다만 PNG는 파일이 커서 캐시 공간 부족이 실제로 일어날 확률이 오른다.
  ⚠️ **카메라 캐시에는 정리 경로가 없다**(`FileCameraCacheLocalDataSourceImpl` — 세그멘테이션
  캐시와 달리 아무도 안 지운다). 파일이 커지는 이번 변경이 그 미결의 부담을 키운다(OQ-P-279).
- **확대 중 OOM** — `DecodeImageUseCase`가 `runSuspendCatching`으로 한 번만 감싸고 취소는 재던지므로
  `SegmentationViewModel`의 실패 상태로 간다. 확대 대상이 512 미만 이미지라 크기 자체는 작다.
- **EXIF 읽기 실패** — 회전 0으로 진행한다(위 설계 3절).

회전과 확대가 겹치면 중간 비트맵이 생긴다. `toForegroundCandidate`가 `trimmed !== masked`로 하는 것과
같은 관용구로, 입력과 다른 인스턴스일 때만 중간 판을 회수한다.

## 테스트

판단을 순수 함수로 빼서 JVM에서 검증한다. 이 저장소에 `SegmentationMask.kt`·
`SegmentationCandidateFilter.kt`·`CameraCrop.kt#computeCropRect`로 선 패턴 그대로다.

- **`computeUpscaleTarget`** — 경계값(511·512·513), 비율 보존, 극단 종횡비(짧은 변을 512로 올리면
  긴 변이 크게 튀는 경우), 이미 충분하면 확대 없음, 0 이하 방어.
- **`exifOrientationToDegrees`** — 회전 3종의 각도, `ORIENTATION_NORMAL`·`UNDEFINED`는 0,
  **미러링 4종도 0**(처리하지 않기로 한 결정을 테스트가 지킨다).

`Bitmap` 생성·`ImageDecoder`·`ExifInterface` 파일 읽기·저장 포맷 변경은 JVM 유닛으로 덮지 않는다.
아래 사진 세트가 담당한다. 변환 자체를 위한 단독 테스트를 만들지 않는 이 저장소 관례와도 맞는다.

## 검증 — 고정 사진 세트

사진마다 판정할 것을 하나씩 물린다.

| 사진 | 판정 대상 |
|---|---|
| EXIF 회전이 붙은 세로 사진 | 회전 정합. API 26·27과 28 이상에서 각각 본다 |
| 짧은 변 512 미만 이미지 | 확대 가드가 실제로 도움이 되는가(조건부 항목의 판정) |
| 머리카락·털·잎사귀처럼 경계가 복잡한 피사체 | 무손실 전달. JPEG 아티팩트가 가장 크게 드러나는 조건 |
| 저대비·역광 | 이번엔 안 고친다. 다음 라운드 판단용 기준선 기록 |
| 다중 피사체 | 기존 다중 후보 동작 회귀 확인 |

절차는 변경 전후 빌드에 같은 사진을 같은 경로로 통과시키고 C-103 후보 화면과 최종 누끼 PNG를
나란히 두는 것이다.

**무손실 항목은 카메라를 안 거치고 격리 검증된다.** 같은 원본을 PNG와 JPEG 두 벌로 만들어 갤러리
경로로 각각 넣으면 아티팩트 영향만 분리해서 볼 수 있다. 카메라 경로 확인은 그 위에 얹는다.

함께 잰다 — PNG 저장에 걸리는 시간, 파일 크기, 확인 화면 표시까지의 체감. 재 놓지 않으면 나중에
WebP로 바꿀지 판단할 근거가 없다.

사진 자체는 개인 사진일 수 있으므로 **이 public repo에 커밋하지 않는다.** 조건 목록만 문서에 남기고
파일은 기기에 둔다.

## 주의 / 열린 질문

- **OQ-P-278** — 확대 가드의 효과가 미검증이다. 문서는 하한만 말하고 확대로 회복된다고는 말하지 않는다.
- **OQ-P-279** — PNG 전환이 카메라 캐시 부담을 키우는데 그 캐시에는 정리 경로가 없다.
- **OQ-P-280** — `ImageDecoder`의 EXIF 자동 적용 여부를 문서로 확인하지 못했다.
- **OQ-P-228 잔존** — 원본 다운샘플은 여전히 없다. 이번 라운드는 오히려 작은 이미지를 키우는
  방향이라 12MP 사진의 메모리 피크에는 영향이 없다.
- 후처리 항목들(최대 연결 요소·모폴로지·알파 램프·경계 색 오염)은 기전이 분명하고 눈에 보이는
  개선이 예상되나 이번 범위 밖이다. 이 스펙의 사진 세트가 그대로 다음 라운드의 기준선이 된다.
