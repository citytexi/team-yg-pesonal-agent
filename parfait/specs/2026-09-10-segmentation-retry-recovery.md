---
id: segmentation-retry-recovery
title: 세그멘테이션 재시도 회복 — 입력 전처리 사다리와 좌표 역변환 (Segmentation retry recovery)
status: draft
category: behavior-spec
platforms: android
verified: 2026-09-10
related_code:
  - ImageSegmentationRepositoryImpl.kt#segmentImage
  - ImageSegmentationRepositoryImpl.kt#segmentForeground
  - ImageSegmentationRepositoryImpl.kt#runSegmenter
  - ImageSegmentationRepositoryImpl.kt#toCandidatePairs
  - ImageSegmentationRepositoryImpl.kt#buildCandidatePair
  - ImageSegmentationRepositoryImpl.kt#postProcess
  - ImageSegmentationRepositoryImpl.kt#toForegroundCandidate
  - ImageSegmentationRepository.kt#segmentImage
  - SegmentationMask.kt#maskSubjectAlpha
  - SegmentationMask.kt#confidenceToAlpha
  - AlphaPostProcessor.kt#postProcessAlpha
  - SegmentationCandidateFilter.kt#filterCandidates
  - SubjectCoverage.kt#floorPixels
  - SegmentationException.kt#ModuleNotReady
  - SegmentationModuleInstaller.kt#ensureInstalled
  - SegmentationViewModel.kt#loadCandidates
  - SegmentationViewModel.kt#SegmentationIntent
  - SegmentationErrorScreen.kt#SegmentationErrorScreen
  - UploadImagePlan.kt#of
related_adr:
  - 0012-mlkit-subject-segmentation.md
related_spec:
  - 2026-08-23-segmentation-preprocessing.md
  - 2026-09-05-c103-error-use-original.md
  - 2026-09-02-segmentation-module-install.md
  - 2026-08-23-c103-multi-subject-selection.md
related_architecture:
  - data-layer.md
  - state-management.md
supersedes:
superseded_by:
tags: [spec, parfait, segmentation, c103, retry]
---

# Spec: 세그멘테이션 재시도 회복

## 목표

`C-103-Error`의 「다시 시도」가 **실제로 다른 결과를 낼 수 있게** 만든다. 지금 그 버튼은
후보 0건으로 실패한 사진에서 같은 입력으로 같은 파이프라인을 다시 돌기 때문에 항상 같은
빈 목록을 돌려준다. 재시도에 한해 검출 입력을 손봐 가며 다시 찾는다.

대응 이슈는 `#486`이다.

## 왜 지금인가

`SegmentationViewModel#loadCandidates`가 `isError`를 참으로 만드는 자리는 둘이다. 세그멘테이션이
`Result.failure`로 끝난 경우와, 성공했는데 후보 목록이 빈 경우다. 이 둘의 재시도 성질이 다르다.

- **`ModuleNotReady`·`TimedOut`** — `SegmentationModuleInstaller#ensureInstalled`가 매번 가용
  여부를 새로 묻고 끝난 대기를 재사용하지 않으므로, 설치가 끝나면 재시도가 성공한다.
- **후보 0건** — `ImageSegmentationRepositoryImpl#segmentImage`가 다중 subject와 전경 마스크
  폴백을 모두 거친 뒤의 결과다. 이 경로에는 무작위 요소가 없다. **같은 사진으로 몇 번을 눌러도
  같은 빈 목록이다.**

즉 사용자가 가장 자주 마주치는 "눌러도 소용없는 재시도"는 모듈 문제가 아니라 후보 0건이다.

[segmentation-preprocessing](2026-08-23-segmentation-preprocessing.md)이 촬영과 디코드 쪽 입력
품질을 다뤘고, 대비·감마 정규화와 후처리 전반을 "문서 근거가 없다"는 이유로 다음 라운드로 밀었다.
이 스펙이 그 다음 라운드에 해당하되, **적용 지점을 전역이 아니라 재시도 경로로 좁힌다.**

## 범위

**포함**

- 재시도를 직전 실패의 성격으로 가른다. 후보 0건이면 회복 경로를, 예외면 현행 경로를 탄다.
- 저장소에 회복 경로 `recoverCandidates`를 더한다. 전처리 두 단계를 순서대로 시도하고 첫 성공에서 멈춘다.
- 검출 공간과 원본 공간을 가르는 좌표 변환을 도입한다. **후보의 픽셀은 언제나 원본에서 오려낸다.**
- 후보 수확 코드를 저장소 구현에서 별도 파일로 옮겨 1차 경로와 회복 경로가 함께 쓴다.
- 단계별 결과를 로그로 남겨 조건부 항목의 철회 근거를 모은다.

**제외**

- **실패 문구의 원인별 분기** — [c103-error-use-original](2026-09-05-c103-error-use-original.md)이
  `SegmentationErrorKind`를 걷어내고 한 벌로 통합했다. 이 스펙의 분기는 ViewModel 내부에만 있고
  화면은 전과 똑같다.
- **`SubjectCoverage` 하한과 `filterCandidates` 임계 완화** — 후보 0건이 모델이 아니라 우리 필터
  때문인 경우가 있고 그때는 이쪽이 훨씬 싸다. 다만 그 비율을 아직 모른다. 이번에 넣는 단계별
  로그가 그 비율을 알려 주면 다음 라운드에서 다룬다.
- **`decodeImage` 전역 정규화** — 확대판이 그대로 후보가 되면 알맹이 PNG의 인트린식 치수가 커지고
  그 값이 배치 초기 크기를 거쳐 서버 `scale`로 굳는다(OQ-P-282). 회복 경로는 원본에서 오려내므로
  그 전파가 아예 없다. [segmentation-preprocessing](2026-08-23-segmentation-preprocessing.md)의
  「짧은 변 512 하한 확대」 항목은 **미착수로 남고, 이 스펙이 재시도 경로에 한해 그 자리를 대신한다.**
- **사다리 단계 추가** — 크롭 배율을 더 조이거나 퍼센타일을 더 벌리는 3단계 이상은 만들지 않는다.
  2단계가 실패한 사진은 대체로 대상 자체가 모호하고, 진짜 탈출구는 이미 있는 「편집 없이 사용」이다.
- **단계별 진행 표시** — 문구를 한 벌로 통합한 결정과 같은 이유다. 공통 로딩 애니메이션이 loop이라
  긴 대기를 감당한다.
- **1차 진입의 동작·비용 변경** — `segmentImage`는 서명도 동작도 그대로다.
- **고정 사진 세트** — 합성 사진으로 검증하면 "축소한 사진을 확대하니 잘 된다"처럼 변환 자체를
  증명하는 순환 논증이 되기 쉽다. 판정은 순수 함수 유닛과 실사용 로그가 맡는다.

## 설계

### 1. 재시도가 무엇을 다시 도는가

지금 `SegmentationIntent.Retry`는 `loadCandidates`를 통째로 다시 돈다. 캐시 비우기, 디코드,
1차 세그멘테이션이 전부 재실행된다. 여기에 사다리를 그냥 얹으면 추론이 1차 몫까지 겹쳐 낭비가 크다.

그래서 ViewModel이 **직전 실패의 성격을 내부에 들고** 재시도를 가른다.

| 직전 실패 | 재시도 동작 |
|---|---|
| 후보 0건(`Result.success` + 빈 목록) | 회복 경로만 탄다 |
| 예외(`ModuleNotReady`·`ClientInit`·`Process`·`ImageNotFound`) | 현행 `loadCandidates` 그대로 |

전처리는 모듈이 안 온 상황에 아무 도움이 안 되고, 반대로 후보 0건은 1차를 다시 돌아 봐야 같은
결과다. **이 분기는 화면에 드러나지 않는다** — 어떤 코루틴을 태울지만 정한다.

원본 비트맵은 이미 `SegmentationViewModel`이 `originBitmapWrapper`로 들고 있다(「편집 없이 사용」이
쓰는 그 값이다). 회복 경로는 그것을 그대로 넘겨받으므로 디코드를 다시 하지 않는다.

### 2. 사다리 두 단계

`recoverCandidates`가 원본을 받아 순서대로 시도하고, `filterCandidates`를 통과한 후보가 하나라도
나오면 그 자리에서 멈춘다.

**1단계 「정규화」** — 대비 퍼센타일 스트레치와 검출 해상도 맞춤을 적용한다. 크롭이 없으므로 좌표
역변환은 균일 스케일 하나다.

**2단계 「집중」** — 1단계가 남긴 전경 신뢰도 마스크에서 상위 신뢰도 픽셀의 bounding box를 구하고,
여유를 붙여 크롭한 뒤 같은 정규화를 건다. 역변환은 오프셋과 스케일 둘이다.

각 단계는 기존과 같은 두 겹으로 돈다. 다중 subject 옵션으로 한 번, 후보가 0건이면 전경 마스크
옵션으로 한 번이다. 두 옵션을 한 요청에 못 싣는 제약(`segmentForeground`의 KDoc이 적어 둔
`SIGSEGV`)이 그대로 적용된다.

**2단계의 크롭 좌표는 공짜다.** 1단계가 실패했다는 것은 곧 그 단계의 전경 폴백이 돌았다는 뜻이므로,
마스크는 같은 호출 안에 살아 있다. 추가 추론이 없고 호출 사이에 상태를 들고 있을 필요도 없다.
전경 폴백 자체가 예외로 끊겨 마스크가 없으면 중앙 크롭으로 물러선다.

### 3. 검출 해상도

⚠️ **검출 입력에 긴 변 상한을 건다.** [segmentation-preprocessing](2026-08-23-segmentation-preprocessing.md)은
원본 다운샘플을 제외하면서 "축소한 마스크를 되올리는 보간 손실이 새로 생긴다"를 이유로 들었는데,
**그 전제가 회복 경로에는 성립하지 않는다.** 이 경로는 어차피 알파를 원본 공간으로 되올린다.

상한을 걸어 얻는 것이 셋이다.

- 큰 판을 네 번 추론하는 대신 작은 판을 돈다. 한 번의 재시도가 끝나는 시간이 눈에 띄게 준다.
- 동시 생존 판이 작아진다. 앱은 `largeHeap`을 선언하지 않는다.
- 짧은 변 하한과 긴 변 상한이 한 계산에 들어가므로, 극단 종횡비에서 픽셀이 폭증하는 문제가 상한
  쪽에서 자동으로 막힌다. 기존 스펙이 확대 항목에 요구한 총 픽셀 가드가 여기에 흡수된다.

하한과 상한이 충돌하면(극단 종횡비) **상한이 이긴다.** 확대는 정보를 늘리지 않지만 상한 초과는
메모리로 죽는다.

### 3-1. 잠정 초기값

**전부 잠정이다.** 로그가 판정하기 전까지의 출발점이고, 구현은 이 값으로 시작한다.

| 상수 | 잠정값 | 근거 |
|---|---|---|
| 검출 짧은 변 하한 | 512 | ML Kit Android 가이드가 "at least 512x512"를 적는다 |
| 검출 긴 변 상한 | 2048 | 하한의 네 배. 상한 근거는 문서에 없고 자원 쪽에서 정한다 |
| 대비 퍼센타일 | 하위 1% · 상위 99% | 이상치만 자르고 본체는 보존하는 통상값 |
| 힌트 크롭 여유 | bbox 각 변의 20% | `C-103-Selected` 누끼 Safe Margin과 같은 비율 |
| 중앙 폴백 크롭 | 짧은 변 기준 70% | 힌트가 없을 때만 쓴다 |
| 힌트 신뢰도 하한 | `SegmentationMask.kt` 의 완전 불투명 기준과 같은 값 | 그 파일이 이미 쓰는 상수는 `private` 이므로 공유하려면 가시성을 넓혀야 한다 |


### 4. 좌표계 — 한 가지 규칙

**손본 판은 마스크를 얻는 데만 쓰고, 알파는 후처리 전에 원본 공간으로 되올린다.**

이 규칙 하나면 분기가 사라진다. `postProcessAlpha`·`maskSubjectAlpha`의 `guidance` 콜백은 언제나
원본에서 읽고, 후보의 `canvasWidth`·`canvasHeight`는 언제나 원본 치수다. 지금 코드가 세운 전제가
그대로 유지되므로 후처리 쪽은 손대지 않는다.

⚠️ **이 규칙을 어기면 결과 토핑의 색이 변한다.** 대비 스트레치를 건 판을 후보로 쓰면 사용자가 고른
알맹이가 원본과 다른 색으로 저장된다. 지금 `toCandidatePairs`는 ML Kit가 준 `subject.bitmap`을
그대로 후보의 판으로 쓰므로, 회복 경로가 같은 코드를 그대로 재사용하면 이 결함이 난다.

subject 하나를 원본으로 되돌리는 순서는 이렇다.

1. 검출 공간의 `subject` 시작점과 판 치수로 bbox를 만들고, 변환으로 원본 좌표 bbox를 구한다.
   정수 반올림 뒤 원본 경계로 자른다.
2. `subject.bitmap`의 알파 채널만 뽑아 그 원본 bbox 크기로 **쌍선형 확대**한다. 최근접 확대는
   경계에 계단이 생기는데, `confidenceToAlpha`가 이미 램프로 경계를 부드럽게 하는 설계라 그쪽에 맞춘다.
3. 되올린 알파와 원본 픽셀로 **기존 `postProcess`를 그대로** 호출한다.
4. 후보를 만든다. 판의 픽셀이 원본에서 온 것이므로 대비 스트레치의 영향을 받지 않는다.

전경 폴백도 같다. 마스크를 원본 공간 알파로 되올린 뒤 `maskSubjectAlpha`에 넘긴다. 2단계에서는
크롭 사각형 바깥이 투명이므로 되올린 알파가 덮는 넓이가 원본 전체보다 오히려 작다.

### 5. 다중 후보

subject마다 위 순서를 돌린다. 이후 `filterCandidates`는 원본 좌표계 후보를 받으므로 지금과 똑같이
동작하고, `SubjectCoverage#floorPixels`도 원본 면적 기준이라 판정이 바뀌지 않는다.
[c103-multi-subject-selection](2026-08-23-c103-multi-subject-selection.md)이 정의한 선택 UX가
재시도 전후로 같아진다.

**이것이 다중 후보 유지의 실제 비용이다.** subject 수만큼 알파 확대와 후처리가 붙는다. 상한은 기존
`maxPostProcessCandidates`가 그대로 막는다.

## API / 인터페이스

```kotlin
// domain — 회복은 별도 메서드다. 1차 진입의 비용과 동작이 변하지 않고,
// "회복은 재시도에서만 돈다"가 계약으로 드러난다
interface ImageSegmentationRepository {
    /**
     * [segmentImage] 가 후보를 하나도 못 낸 뒤에만 부른다. 입력을 손봐 가며 다시 찾는다.
     * 후보의 픽셀은 언제나 [bitmapWrapper] 에서 오려낸다 — 손본 판은 검출에만 쓴다.
     */
    suspend fun recoverCandidates(bitmapWrapper: BitmapWrapper): Result<List<SegmentationCandidate>>
}

// data — 판단만 떼어 기기 없이 검증한다(SegmentationMask.kt 와 같은 이유)

/**
 * 검출 공간의 좌표를 원본 공간으로 되돌린다. 1단계는 오프셋이 0 이라 균일 스케일 하나이고,
 * 2단계는 크롭 오프셋이 함께 붙는다.
 */
internal data class RecoveryTransform(
    val scale: Float,
    val offsetX: Int,
    val offsetY: Int,
)

internal data class ScaledSize(val width: Int, val height: Int)

/** 한 단계가 무엇을 할지와, 그 결과를 어떻게 되돌릴지를 함께 들고 있다 */
internal data class RecoveryStage(
    /** 널이면 원본 전체를 쓴다. 좌표는 원본 기준이다 */
    val cropRect: SegmentationBounds?,
    val targetSize: ScaledSize,
    val applyContrast: Boolean,
    val transform: RecoveryTransform,
)

/** 크롭 없는 1단계. 하한·상한이 충돌하면 상한이 이긴다 */
internal fun normalizeStage(width: Int, height: Int): RecoveryStage

/**
 * 마스크 힌트로 2단계를 만든다. 마스크가 없거나 전부 저신뢰면 중앙 크롭으로 물러선다.
 * 힌트 bbox 는 검출 공간 좌표이므로 [hintTransform] 으로 먼저 원본 좌표로 되돌린다.
 */
internal fun focusStage(
    width: Int,
    height: Int,
    hint: SegmentationBounds?,
    hintTransform: RecoveryTransform,
): RecoveryStage

/** 휘도 히스토그램의 퍼센타일을 잘라 선형 확장 LUT 를 만든다. 분모가 0 이면 항등 LUT */
internal fun contrastLut(luminanceHistogram: IntArray): IntArray

/** 알파를 쌍선형으로 확대한다. 축소 요청은 오지 않는다 — 호출부가 검사한다 */
internal fun upscaleAlpha(
    alpha: ByteArray,
    width: Int,
    height: Int,
    targetWidth: Int,
    targetHeight: Int,
): ByteArray
```

## 동작 / 상태

`SegmentationState`에 새 필드를 넣지 않는다. `isError`가 지금처럼 화면 전체를 `C-103-Error`로
바꾸고, 직전 실패의 성격은 ViewModel의 `private var`로만 든다 — 화면이 그리는 데 쓰지 않는 값을
상태로 올리면 리컴포지션만 늘어난다.

`SegmentationIntent`도 그대로다. `Retry` 하나가 성격에 따라 다른 경로를 탄다.

`launch(key = LOAD_CANDIDATES_KEY)`를 회복 경로에도 그대로 쓴다. 진입과 재시도가 같은 키를 쓰는
현재 구조가 연타를 막고 있고, 사다리로 대기 창이 길어질수록 그 방어가 더 중요해진다.

## 파일 구성

| 파일 | 역할 | 성격 |
|---|---|---|
| `data/utils/image/SegmentationRecoveryPlan.kt` | 신설. 단계 정의, `RecoveryTransform`, 해상도 목표, 힌트 크롭 사각형 | 순수 |
| `data/utils/image/SegmentationContrast.kt` | 신설. 휘도 히스토그램에서 퍼센타일 절단 LUT 계산 | 순수 |
| `data/utils/image/SegmentationMask.kt` | `upscaleAlpha` 추가 | 순수(기존) |
| `data/utils/image/SegmentationInputNormalizer.kt` | 신설. 계획을 비트맵에 적용, 중간 판 회수 | `Bitmap` 실행 |
| `data/utils/image/SegmentationCandidateHarvest.kt` | 신설. 후보 수확 함수 이동, 변환 인자 추가 | `Bitmap` 실행 |
| `data/repository/image/ImageSegmentationRepositoryImpl.kt` | `recoverCandidates` 추가, 수확 코드 제거 | 조합 |
| `domain/repository/image/ImageSegmentationRepository.kt` | `recoverCandidates` 선언 | 계약 |
| `domain/usecase/image/RecoverCandidatesUseCase.kt` | 신설 | 계약 |
| `feature/segmentation/impl/.../SegmentationViewModel.kt` | 직전 실패 성격 보관, 재시도 분기 | 상태 |

수확 코드(`toCandidatePairs`·`buildCandidatePair`·`postProcess`·`toForegroundCandidate`)를 옮기는
것은 정리를 겸한 필수 작업이다. **옮기지 않으면 1차 경로와 회복 경로가 같은 로직을 둘로 갈라 갖게
된다.** `ImageSegmentationRepositoryImpl.kt`는 이미 ML Kit 호출, 후보 수확, 후처리, 파일 저장을
한 파일에서 하고 있어 회복 경로까지 얹을 자리가 아니다.

## 에러 처리

새 실패 표현을 만들지 않는다. `recoverCandidates`도 `Result<List<SegmentationCandidate>>`를
돌려주고, 전 단계가 실패하면 `Result.success(emptyList())`다. ViewModel은 지금과 똑같이
`isError = true`로 접는다.

- **`ModuleNotReady`가 나오면 즉시 중단**하고 그 실패를 그대로 올린다. 모듈이 없으면 남은 단계도
  전부 같은 이유로 실패한다.
- **그 밖의 예외와 `OutOfMemoryError`는 그 단계만 포기**하고 다음 단계로 넘어간다.
  `buildCandidatePair`가 이미 쓰는 관용구다. 전처리는 개선 수단이지 흐름을 접을 권한이 아니다.
- **`CancellationException`은 다시 던진다.** 값으로 접으면 취소된 흐름이 계속 돈다.
- **중간 판 회수** — 정규화 판과 크롭 판은 단계가 끝나면 즉시 회수한다. 입력과 다른 인스턴스일
  때만 회수하는 `toForegroundCandidate`의 관용구를 그대로 쓴다. 원본은 호출자가 쥐고 있으므로
  건드리지 않는다.

## 테스트

판단을 순수 함수로 빼서 JVM에서 덮는다. `SegmentationMask.kt`·`SegmentationCandidateFilter.kt`가
선 패턴이다.

- **`RecoveryTransform` 역변환** — 스케일만인 경우, 스케일과 오프셋이 함께인 경우, 원본 경계 클램프,
  그리고 **왕복 항등성**(원본 좌표를 검출 공간으로 보냈다가 되돌리면 반올림 오차 안에서 제자리).
- **해상도 목표 계산** — 짧은 변 하한과 긴 변 상한의 경계값, 비율 보존, **두 제약이 충돌할 때
  상한이 이기는 것**. 기대값을 명시한다. 기대값 없이 케이스만 두면 구현이 무엇을 하든 정답으로 굳는다.
- **힌트 크롭 사각형** — 상위 신뢰도 bbox에 여유를 붙인 결과, 원본 경계 클램프, 전부 저신뢰면
  중앙 크롭으로 물러서는 것.
- **`contrastLut`** — 퍼센타일 절단, 그리고 히스토그램이 한 값에 몰려 분모가 0이 되는 경우 항등 LUT.
- **`upscaleAlpha`** — 치수 일치, 경계값, 축소 요청이 오지 않는다는 전제 검사.
- **재시도 분기** — 직전 실패가 후보 0건이면 회복 경로를, 예외면 기존 경로를 탄다.
  `SegmentationViewModelTest`가 이미 있다.

ML Kit 호출과 `Bitmap` 생성은 유닛으로 덮지 않는다. 기존 방침 그대로다.

## 근거 등급 (이 스펙의 계약)

**관찰된 실패 사례가 없는 상태에서 쓰는 스펙이다.** 검출이 안 되는 실제 사진을 아직 모으지 못했다.
[segmentation-preprocessing](2026-08-23-segmentation-preprocessing.md)이 같은 처지에서 쓴 근거
등급표를 이어받는다. **이 표가 이 스펙의 계약이다.**

| 항목 | 근거 | 판정 |
|---|---|---|
| 좌표 역변환과 수확 분리 | 없으면 결과 색이 변한다. 코드로 확정된다 | 무조건 |
| 재시도를 실패 성격으로 가르기 | 모듈 미준비에 전처리는 무의미하다. 코드로 확정된다 | 무조건 |
| 검출 입력 긴 변 상한 | 마스크를 어차피 되올리므로 축소의 손실이 결과에 안 남는다 | 무조건 |
| 2단계 힌트 크롭 | 상대 크기가 지배 변수라는 것은 통념이나 이 앱에서 미측정 | 조건부 |
| 1단계 대비 스트레치 | 문서 근거가 없다. 기존 스펙이 보류한 항목이다 | 조건부 |
| 짧은 변 하한 확대 | 확대는 정보를 늘리지 않는다(OQ-P-278) | 조건부 |

**판정 수단은 순수 함수 유닛 테스트와 실사용 로그다.** 변환의 정확성은 유닛이 잠그고, 검출 수익은
단계별 로그가 판정한다. 고정 사진 세트는 이번에 만들지 않는다 — 합성 사진으로 검증하면 "축소한
사진을 확대하니 잘 된다"처럼 변환 자체를 증명하는 순환 논증이 되기 쉽다.

**철회 조건**은 단계별 로그다. 단계마다 결과와 후보 수와 소요를 `repositoryLogger`로 한 줄씩 남기고,
실사용에서 어떤 단계가 실질적으로 후보를 못 내면 그 단계를 걷는다. 기존
`toCandidatePairs`가 남기는 "subject 몇 개 중 판 있음 몇 개, bbox 하한 통과 몇 개" 줄이 그대로
0건의 원인을 갈라 주므로, 회복 경로에서도 같은 형식을 유지한다.

## 주의 / 열린 질문

- **잠정값** — 대비 퍼센타일, 크롭 여유 비율, 긴 변 상한, 짧은 변 하한은 전부 잠정이다. 로그가 판정한다.
- **사다리 대기 상한** — 전체에 `withTimeout`을 둘지 정하지 않았다. `SegmentationModuleInstaller`가
  설치 대기에 상한을 두는 선례가 있다.
- **필터가 원인인 비율** — 후보 0건이 모델이 아니라 `SubjectCoverage` 하한 때문인 경우, 전처리보다
  하한 완화가 훨씬 싸다. 이번 로그가 그 비율을 드러내면 다음 라운드의 첫 항목이 된다.
- **OQ-P-278 잔존** — 확대로 정확도가 회복된다는 근거는 여전히 없다. 이 스펙은 그것을 조건부로 두고
  로그로 판정한다.
- **OQ-P-282 회피** — 회복 경로가 원본에서 오려내므로 토핑 초기 크기와 서버 `scale` 전파가 없다.
  다만 그 미결 자체는 `decodeImage` 전역 정규화를 넣을 때 다시 살아난다.
- **`ImageDecoder`의 EXIF 적용 여부(OQ-P-280)** — 이 스펙의 범위 밖이다. 회복 경로는 이미 디코드된
  비트맵을 받는다.
