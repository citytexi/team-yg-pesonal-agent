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
  - AlphaPostProcessor.kt#AlphaPostProcessOptions
  - AlphaComponents.kt#applyAreaOpening
  - UploadImagePreprocessorImpl.kt#prepare
  - ImageSegmentationRepositoryImpl.kt#persistSubject
  - ImageSegmentationRepositoryImpl.kt#originalCandidate
  - SegmentationViewModel.kt#useOriginal
  - BaseViewModel.kt#launch
  - SegmentationBounds.kt#SegmentationBounds
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

> ⚠️ **초안이 검수 2회(사실 대조·설계 공격)에서 치명 결함 여섯을 맞고 전면 개정됐다.**
> 무엇이 왜 뒤집혔는지는 맨 아래 「검수 이력」에 있다. 그 절을 먼저 읽으면 이 스펙이 왜 이렇게
> 복잡한지 알 수 있다.

## 목표

`C-103-Error`의 「다시 시도」가 **실제로 다른 결과를 낼 수 있게** 만든다. 지금 그 버튼은
후보 0건으로 실패한 사진에서 같은 입력으로 같은 파이프라인을 다시 돌기 때문에 항상 같은
빈 목록을 돌려준다.

대응 이슈는 `#486`이다.

## 왜 지금인가

`SegmentationViewModel#loadCandidates`가 `isError`를 참으로 만드는 자리는 둘이다. 세그멘테이션이
`Result.failure`로 끝난 경우와, 성공했는데 후보 목록이 빈 경우다. 이 둘의 재시도 성질이 다르다.

- **`ModuleNotReady`** — `SegmentationModuleInstaller#ensureInstalled`가 매번 가용 여부를 새로
  묻고 끝난 대기를 재사용하지 않으므로, 설치가 끝나면 재시도가 성공한다.
  ⚠️ 설치 대기 상한을 넘긴 경우도 여기로 접힌다. `ModuleInstallOutcome.TimedOut`은 installer
  층의 값이고, `runSegmenter`가 `Ready`가 아닌 결과를 전부 `ModuleNotReady`로 바꿔 올린다.
  **ViewModel이 볼 수 있는 모듈 관련 예외는 `ModuleNotReady` 하나다.**
- **후보 0건** — `ImageSegmentationRepositoryImpl#segmentImage`가 다중 subject와 전경 마스크
  폴백을 모두 거친 뒤의 결과다. 우리 코드 경로에는 무작위 요소가 없다. **같은 사진으로 몇 번을
  눌러도 같은 빈 목록이다.**
  ⚠️ ML Kit 추론 자체의 결정성은 코드로 확인할 수 없다. 이 서술의 근거는 우리 코드까지다.

[segmentation-preprocessing](2026-08-23-segmentation-preprocessing.md)이 촬영과 디코드 쪽 입력
품질을 다뤘고, 대비·감마 정규화와 후처리 전반을 "문서 근거가 없다"는 이유로 다음 라운드로 밀었다.
이 스펙이 그 다음 라운드에 해당하되, **적용 지점을 전역이 아니라 재시도 경로로 좁힌다.**

## 범위

**포함**

- 재시도를 직전 실패의 성격으로 **3치로** 가른다.
- 저장소에 회복 경로 `recoverCandidates`를 더한다. 전처리 두 단계를 순서대로 시도하고 첫 성공에서 멈춘다.
- 검출 공간과 원본 공간을 가르는 좌표 변환을 도입한다. **후보의 픽셀은 언제나 원본에서 오려낸다.**
- **후처리 유틸을 「신뢰도→알파」와 「알파 후처리」로 쪼갠다.** 전자는 검출 공간, 후자는 원본 공간에서 돈다.
- **후보 수확 함수에서 ML Kit `Subject` 의존을 걷어낸다.** 원본 좌표를 직접 받게 바꾼다.
- 후보 수확 코드를 저장소 구현에서 별도 파일로 옮겨 1차 경로와 회복 경로가 함께 쓴다.
- **회복 경로에 한해 `SubjectCoverage` 하한과 `filterCandidates` 임계를 푼다.**
- 사다리 전체에 대기 상한을 걸고, 「편집 없이 사용」 진입 시 사다리를 취소한다.
- 단계별 결과를 로그로 남겨 조건부 항목의 철회 근거를 모은다.

**제외**

- **실패 문구의 원인별 분기** — [c103-error-use-original](archive/2026-09-05-c103-error-use-original.md)이
  `SegmentationErrorKind`를 걷어내고 한 벌로 통합했다. 이 스펙의 분기는 ViewModel 내부에만 있고
  화면 문구는 전과 똑같다.
- **1차 경로의 필터 임계 변경** — 완화는 회복 경로에만 적용한다. 1차의 판정을 건드리면 이 스펙과
  무관한 회귀가 난다.
- **`decodeImage` 전역 정규화** — 확대판이 그대로 후보가 되면 알맹이 PNG의 인트린식 치수가 커지고
  그 값이 배치 초기 크기를 거쳐 서버 `scale`로 굳는다(OQ-P-282). 회복 경로는 원본에서 오려내므로
  그 전파가 아예 없다. [segmentation-preprocessing](2026-08-23-segmentation-preprocessing.md)의
  「짧은 변 512 하한 확대」 항목은 **미착수로 남고, 이 스펙이 재시도 경로에 한해 그 자리를 대신한다.**
- **사다리 3단계 이상** — 크롭 배율을 더 조이거나 퍼센타일을 더 벌리는 단계는 만들지 않는다.
  진짜 탈출구는 이미 있는 「편집 없이 사용」이다.
- **단계별 진행 표시** — 문구를 한 벌로 통합한 결정과 같은 이유다. 공통 로딩 애니메이션이 loop이라
  긴 대기를 감당한다.
- **1차 진입의 동작·비용 변경** — `segmentImage`의 외부 계약은 그대로다.
- **고정 사진 세트** — 합성 사진으로 검증하면 "축소한 사진을 확대하니 잘 된다"처럼 변환 자체를
  증명하는 순환 논증이 되기 쉽다. 판정은 순수 함수 유닛과 실사용 로그가 맡는다.

## 설계

### 1. 재시도를 3치로 가른다

지금 `SegmentationIntent.Retry`는 `loadCandidates`를 통째로 다시 돈다. 여기에 사다리를 그냥 얹으면
1차 몫까지 겹쳐 낭비가 크다. 반대로 2치로만 가르면 **회복까지 실패한 뒤의 재시도가 같은 사다리를
그대로 반복해서, 이 스펙이 고치려던 버그가 한 층 위에서 부활한다.**

ViewModel이 직전 실패를 세 값으로 들고 재시도를 가른다.

| 직전 실패 | 재시도 동작 | 추론 |
|---|---|---|
| 예외 | 현행 `loadCandidates` 그대로 | 최대 2회 |
| 회복 전 0건 | 회복 경로만 탄다 | 최대 4회 |
| 회복 후 0건 | 현행 `loadCandidates`로 되돌린다 | 최대 2회 |

세 번째 줄이 디코드부터 다시 도는 것은 낭비가 아니다. **버튼이 계속 살아 있으면서 매번 추론 4회를
태우는 것보다 낫고**, 디코드를 다시 하면 URI 만료나 손상 같은 다른 결과가 나올 여지도 있다.
값은 화면에 드러나지 않으므로 사용자가 보는 것은 전과 똑같다.

원본 비트맵은 `SegmentationViewModel`이 `originBitmapWrapper`로 이미 들고 있다(「편집 없이 사용」이
쓰는 그 값이다). 회복 경로는 그것을 넘겨받으므로 디코드를 다시 하지 않는다.

### 2. 사다리 두 단계

`recoverCandidates`가 원본을 받아 순서대로 시도하고, 후보가 하나라도 나오면 그 자리에서 멈춘다.

**1단계 「정규화」** — 대비 퍼센타일 스트레치와 검출 해상도 맞춤을 적용한다. 크롭이 없으므로 좌표
역변환은 스케일뿐이다.

⚠️ **1단계 무동작 가드.** 목표 치수가 원본과 같고 대비도 안 거는 경우 1단계는 1차 경로의 문자
그대로의 재실행이 된다(짧은 변 512 이상, 긴 변 2048 이하인 사진이 여기 해당한다). **그런 경우
1단계를 건너뛰고 곧장 2단계로 간다.** 대비 스트레치가 조건부 항목이라 철회될 수 있으므로, 이
가드가 없으면 철회 뒤 1단계가 통째로 낭비가 된다.

**2단계 「집중」** — 1단계가 남긴 전경 신뢰도에서 힌트 사각형을 구하고, 여유를 붙여 크롭한 뒤 같은
정규화를 건다. 역변환은 오프셋과 스케일이다.

⚠️ **수축 가드.** 크롭 면적이 원본의 일정 비율 미만으로 줄지 않으면 **2단계를 건너뛴다.** 힌트
픽셀이 흩어져 있으면 bbox가 화면 전체에 가까워지고, 여유를 붙이면 크롭이 원본과 같아진다. 그러면
2단계는 1단계 재탕이고 추론만 2회 더 쓴다.

각 단계는 기존과 같은 두 겹으로 돈다. 다중 subject 옵션으로 한 번, 후보가 0건이면 전경 마스크
옵션으로 한 번이다. 두 옵션을 한 요청에 못 싣는 제약(`segmentForeground`의 KDoc이 적어 둔
`SIGSEGV`)이 그대로 적용된다.

### 3. 힌트를 언제 어떻게 뽑는가

⚠️ **힌트 하한을 폴백 이진화와 같은 축에 맞춘다.** 초안은 `SegmentationMask.kt`의 완전 불투명
기준을 하한으로 삼았는데, 그 값 이상인 픽셀은 `postProcessAlpha`가 성분 판정에 쓰는
`binaryThreshold` 초과 픽셀의 **부분집합**이다. 1단계 실패는 곧 그 이진화 축에서 성분이 전멸했다는
뜻이므로, 더 높은 하한으로 힌트를 찾으면 거의 항상 빈다. **힌트 하한은 `binaryThreshold`와 같은
축을 쓴다.**

⚠️ **힌트는 2단계 진입 전에 뽑고 1단계 결과를 놓는다.** 1단계의 `SubjectSegmentationResult`는
subject 판들과 네이티브 `FloatBuffer`를 붙들고 있어 2단계가 도는 내내 살려 두면 피크가 커진다.
게다가 그 버퍼가 새 세그멘터를 열고 닫은 뒤에도 유효한지 확인되지 않았다(아래 열린 질문).
**힌트 사각형 하나만 남기고 1단계 결과를 놓으면 두 문제가 함께 사라진다.**

힌트를 못 뽑으면 중앙 크롭으로 물러선다.

### 4. 검출 해상도

⚠️ **검출 입력에 긴 변 상한을 건다.** 근거는 **자원**이다. 큰 판을 네 번 추론하는 대신 작은 판을
돌아 시간과 메모리 피크를 줄인다. 짧은 변 하한과 긴 변 상한이 한 계산에 들어가므로, 극단 종횡비에서
픽셀이 폭증하는 문제도 상한 쪽에서 막힌다.

⚠️ **"되올리니까 검출률이 안 떨어진다"는 논증은 틀렸다.** 되올림이 회복하는 것은 마스크 정밀도이고,
축소가 없애는 것은 검출기가 보는 정보량이다. 후자는 되올림으로 돌아오지 않는다. 상한이 실제로
걸렸는지와 그때 후보 수를 로그로 남겨 회귀를 감시한다.

하한과 상한이 충돌하면(극단 종횡비) **상한이 이긴다.** 확대는 정보를 늘리지 않지만 상한 초과는
메모리로 죽는다.

### 4-1. 잠정 초기값

**전부 잠정이다.** 로그가 판정하기 전까지의 출발점이고, 구현은 이 값으로 시작한다.

| 상수 | 잠정값 | 근거 |
|---|---|---|
| 검출 짧은 변 하한 | 512 | ML Kit Android 가이드가 "at least 512x512"를 적는다 |
| 검출 긴 변 상한 | 2048 | 하한의 네 배. 문서 근거는 없고 자원 쪽에서 정한다 |
| 대비 퍼센타일 | 하위 1% · 상위 99% | 이상치만 자르고 본체는 보존하는 통상값 |
| 힌트 신뢰도 하한 | `AlphaPostProcessOptions.binaryThreshold` | 폴백 성분 판정과 같은 축을 써야 힌트가 안 빈다 |
| 힌트 크롭 여유 | 힌트 사각형 각 변의 20% | 누끼 Safe Margin 정책과 같은 비율. ⚠️ 그 정책은 아직 코드에 없다(OQ-P-150) |
| 수축 가드 | 크롭 면적이 원본의 70% 미만일 때만 2단계를 돈다 | 크롭이 원본과 같아지는 경우를 막는다 |
| 중앙 폴백 크롭 | 짧은 변 기준 70% | 힌트가 없을 때만 쓴다 |
| 회복 필터 하한 | 1차 하한의 1/4 | 2단계가 찾은 작은 피사체가 원본 면적 기준 하한에 죽는 것을 막는다 |
| 사다리 대기 상한 | 30초 | `SegmentationModuleInstaller.INSTALL_TIMEOUT_MS`가 선례다 |
| 왕복 좌표 허용오차 | 각 축 1px | 테스트가 구현의 오차에 맞춰지지 않게 숫자로 고정한다 |

### 5. 좌표계 — 한 가지 규칙

**손본 판은 마스크를 얻는 데만 쓰고, 알파는 후처리 전에 원본 공간으로 되올린다.**

`postProcessAlpha`의 `guidance` 콜백은 언제나 원본에서 읽고, 후보의 `canvasWidth`·`canvasHeight`는
언제나 원본 치수다.

⚠️ **이 규칙을 어기면 결과 토핑의 색이 변한다.** 대비 스트레치를 건 판을 후보로 쓰면 사용자가 고른
알맹이가 원본과 다른 색으로 저장된다. 지금 `toCandidatePairs`는 ML Kit가 준 `subject.bitmap`을
그대로 후보의 판으로 쓰므로, 회복 경로가 같은 코드를 재사용하면 이 결함이 난다.

**되올림은 램프 뒤에 건다.** `confidenceToAlpha`는 램프에 버림이 붙은 비선형 변환이라, 신뢰도를
확대한 뒤 램프를 태우는 것과 램프를 태운 뒤 알파를 확대하는 것이 경계 띠에서 다른 값을 낸다.
**신뢰도는 검출 공간에서 알파로 바꾸고, 그 알파를 원본 공간으로 되올린다.** 원본 크기
`FloatBuffer`를 만드는 우회는 금지한다.

subject 하나를 원본으로 되돌리는 순서는 이렇다.

1. 검출 공간의 subject 시작점과 판 치수로 사각형을 만들고, 변환으로 원본 좌표 사각형을 구한다.
   반올림 뒤 **크롭 사각형과 원본의 교집합**으로 자른다. 원본 경계만으로 자르면 2단계에서 크롭 밖으로
   새는 사각형이 생긴다.
2. `subject.bitmap`의 알파 채널만 뽑아 그 원본 사각형 크기로 재표본한다.
3. 되올린 알파와 원본 픽셀로 `postProcessAlpha`를 부른다. `guidance`는 원본의 그 영역을 읽는다.
4. 후보를 만든다. 판의 픽셀이 원본에서 온 것이므로 대비 스트레치의 영향을 받지 않는다.

전경 폴백도 같다. 신뢰도를 검출 공간에서 알파로 바꾸고, 그 알파를 원본 공간으로 되올린 뒤
`postProcessAlpha`에 넘긴다.

### 6. 계약 검사

⚠️ **기존 `require`들은 안전망이 아니다.** 그것들은 판 치수와 사각형 치수가 같은지만 보는데, 사각형을
판 치수로부터 만들기 때문에 사실상 항진명제다. **정작 회복 경로가 깨뜨릴 수 있는 것은 사각형이 캔버스
안에 있는지이고 그건 아무도 검사하지 않는다.** 깨지면 예외가 아니라 `persistSubject`의
`Canvas.drawBitmap`이 조용히 자른다. 화면에도 테스트에도 안 잡히고 서버에 올라간 뒤에야 드러난다.

수확 공통 지점에 사각형이 캔버스 안에 있는지 검사하는 `require`를 넣는다.

### 7. 다중 후보와 필터

subject마다 위 순서를 돌린다. 후보가 원본 좌표계이므로 `filterCandidates`의 중복 제거와 정렬은
그대로 동작하고, [c103-multi-subject-selection](archive/2026-08-23-c103-multi-subject-selection.md)이
정의한 선택 UX가 재시도 전후로 같아진다.

⚠️ **1차 경로는 전경 폴백 후보를 필터 없이 돌려준다.** 회복 경로도 같은 규칙을 쓴다 — 폴백 후보는
필터를 거치지 않고, 다중 subject 후보만 거친다. 두 경로가 다른 규칙을 쓰면 1차에서는 성공했을
사진이 회복에서 0건이 된다.

⚠️ **회복 경로의 면적 하한은 1차보다 낮다.** 후보의 캔버스 치수가 언제나 원본이므로 `SubjectCoverage`
하한도 원본 면적 기준이다. 그러면 2단계가 크롭 안에서 새로 찾은 작은 피사체가 그대로 걸러진다.
**2단계의 수익을 가르는 것이 이 하한이므로 회복 경로에 한해 완화한다.** 완화 전후 후보 수를 로그로
갈라 남긴다.

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

// data — 검출 공간 사각형은 원본 공간과 다른 타입을 쓴다.
// SegmentationBounds 의 KDoc 이 "원본 이미지의 픽셀 좌표 기준"을 단정하고 있어,
// 같은 타입으로 두 좌표계를 겸하면 이 스펙이 막으려는 부류의 버그를 타입이 초대한다
internal data class DetectionBounds(val left: Int, val top: Int, val right: Int, val bottom: Int)

internal data class ScaledSize(val width: Int, val height: Int)

/**
 * 검출 공간의 좌표를 원본 공간으로 되돌린다.
 *
 * ⚠️ 축마다 배율이 다르다 — 목표 치수를 정수로 반올림하는 순간 가로세로 비가 어긋난다.
 * 하나로 합치면 긴 축에서 오차가 픽셀 단위로 누적된다.
 */
internal data class RecoveryTransform(
    val scaleX: Float,
    val scaleY: Float,
    val offsetX: Int,
    val offsetY: Int,
)

/** 한 단계가 무엇을 할지와, 그 결과를 어떻게 되돌릴지를 함께 들고 있다 */
internal data class RecoveryStage(
    /** 널이면 원본 전체를 쓴다. 좌표는 원본 기준이다 */
    val cropRect: SegmentationBounds?,
    val targetSize: ScaledSize,
    val applyContrast: Boolean,
    val transform: RecoveryTransform,
)

/**
 * 크롭 없는 1단계. 하한·상한이 충돌하면 상한이 이긴다.
 * 목표 치수가 원본과 같고 대비도 안 걸면 널이다 — 1차 경로의 재실행일 뿐이라 건너뛴다.
 */
internal fun normalizeStage(width: Int, height: Int, applyContrast: Boolean): RecoveryStage?

/**
 * 힌트로 2단계를 만든다. 힌트가 없으면 중앙 크롭으로 물러선다.
 * 크롭 면적이 원본의 수축 가드 비율 미만으로 줄지 않으면 널이다 — 1단계 재탕을 막는다.
 */
internal fun focusStage(
    width: Int,
    height: Int,
    hint: DetectionBounds?,
    hintTransform: RecoveryTransform,
): RecoveryStage?

/** 알파에서 힌트 사각형을 찾는다. 임계 초과 픽셀이 없으면 널이다 */
internal fun hintBounds(alpha: ByteArray, width: Int, height: Int, threshold: Int): DetectionBounds?

/**
 * 휘도 히스토그램에서 퍼센타일 절단 LUT 를 만든다. 분모가 0 이면 항등 LUT.
 *
 * ⚠️ 히스토그램은 축소가 끝난 판에서 모은다. 원본을 통째로 읽으면 그 배열 하나가 판 하나만큼 크다.
 */
internal fun contrastLut(luminanceHistogram: IntArray): IntArray

/**
 * 알파를 다른 치수로 재표본한다. **확대와 축소를 모두 받는다** — 짧은 변 하한이 걸리거나
 * 크롭이 작으면 되올림이 축소가 된다. 확대는 쌍선형, 축소는 박스 평균이다.
 */
internal fun resampleAlpha(
    alpha: ByteArray,
    width: Int,
    height: Int,
    targetWidth: Int,
    targetHeight: Int,
): ByteArray

// data/utils/image/SegmentationMask.kt — 한 덩어리였던 것을 쪼갠다.
// 지금 maskSubjectAlpha 는 FloatBuffer 를 받아 램프와 후처리를 한 번에 돌아서
// 되올린 알파를 넣을 입구가 없다

/** 신뢰도를 알파로. 검출 공간에서 돈다 */
internal fun confidenceToAlphaArray(mask: FloatBuffer, width: Int, height: Int): ByteArray

/** 알파 후처리. 원본 공간에서 돈다. 기존 maskSubjectAlpha 의 뒷절반이다 */
internal suspend fun postProcessMaskedAlpha(
    alpha: ByteArray,
    width: Int,
    height: Int,
    options: AlphaPostProcessOptions = AlphaPostProcessOptions(),
    guidance: GuidanceProvider? = null,
): MaskedAlpha?
```

⚠️ **수확 함수에서 `Subject` 의존을 걷어낸다.** 지금 `postProcess`와 `originalCandidate`는
`Subject`를 받아 `startX`·`startY`로 오프셋을 잡는데, `Subject`는 ML Kit final 클래스라 원본 좌표를
담은 인스턴스를 만들 수 없다. **판 픽셀과 알파와 원본 오프셋을 직접 받도록 시그니처를 바꾼다.**
이것을 "변환 인자 추가"로 적으면 구현자가 `Subject`를 그대로 들고 갈 여지가 남는다.

⚠️ **마스크 치수와 출력 치수를 별도 인자로 가른다.** 지금 `toForegroundCandidate`는 마스크 길이를
원본 픽셀 수와 비교하는데, 회복 경로의 마스크는 검출 판 치수라 이 검사가 언제나 실패한다. 예외도
로그도 없이 빈 목록이 되어 1단계 폴백이 죽고, 연쇄로 2단계 힌트까지 사라진다.

⚠️ **전경 폴백도 `Result`를 위로 올린다.** 지금 `segmentForeground`는 실패를 `getOrNull`로 삼켜
원인을 버린다. 그러면 아래 에러 처리의 「`ModuleNotReady`면 즉시 중단」이 이 갈래에서 실행되지 않아,
남은 추론이 전부 같은 이유로 실패할 것을 알면서 다 돈다.

## 동작 / 상태

`SegmentationState`에 새 필드를 넣지 않는다. 직전 실패의 성격은 ViewModel의 `private var`로만 든다.
화면이 그리는 데 쓰지 않는 값을 상태로 올리면 리컴포지션만 늘어난다.

⚠️ **회복 분기도 상태 시퀀스를 지킨다.** 회복은 `loadCandidates`와 다른 코루틴 본문이므로 상태
갱신이 공짜가 아니다. 시작할 때 `isLoading`을 켜고 `isError`를 끈다. **`isError`를 안 끄면 Route가
`SegmentationErrorScreen`을 계속 그리고 `YGScaffoldV2`가 그 위에 로딩 덮개를 얹어, 에러 화면과
로딩이 겹친 처음 보는 조합이 나온다.** 끝날 때는 성공·실패와 무관하게 `isLoading`을 끈다.

`SegmentationIntent`는 그대로다. `Retry` 하나가 성격에 따라 다른 경로를 탄다.

**사다리는 `LOAD_CANDIDATES_KEY`를 그대로 쓴다.** 진입과 재시도가 같은 키를 쓰는 현재 구조가 연타를
막는다.

⚠️ **연타 차단은 취소가 아니다.** `launch`는 `viewModelScope`라 화면을 떠나도 계속 돌고, 사다리는
추론 넷과 원본 해상도 후처리라 길다. 그래서 둘을 더한다.

- **사다리 전체에 대기 상한을 건다.** 넘기면 그 시점까지의 결과로 접는다.
- **`UseOriginal` 진입 시 `LOAD_CANDIDATES_KEY` 잡을 취소한다.** 지금 그 둘은 다른 키라 동시에 돈다.
  12MP PNG 인코딩이 사다리의 큰 할당과 겹치면 OOM 확률이 올라간다.

## 파일 구성

| 파일 | 역할 | 성격 |
|---|---|---|
| `data/utils/image/SegmentationRecoveryPlan.kt` | 신설. 단계 정의, `DetectionBounds`, `RecoveryTransform`, 해상도 목표, 힌트 사각형, 무동작·수축 가드 | 순수 |
| `data/utils/image/SegmentationContrast.kt` | 신설. 휘도 히스토그램에서 퍼센타일 절단 LUT 계산 | 순수 |
| `data/utils/image/SegmentationMask.kt` | `maskSubjectAlpha`를 앞뒤로 쪼개고 `resampleAlpha` 추가 | 순수(기존) |
| `data/utils/image/SegmentationRecoveryNormalizer.kt` | 신설. 계획을 비트맵에 적용, 중간 판 회수. ⚠️ 선행 스펙이 예약한 `SegmentationInputNormalizer.kt`와 이름을 겹치지 않게 둔다 | `Bitmap` 실행 |
| `data/utils/image/SegmentationCandidateHarvest.kt` | 신설. 후보 수확 함수 이동, **`Subject` 의존 제거**, 마스크 치수와 출력 치수 분리, 전경 폴백이 힌트와 `Result`를 함께 돌려주도록 변경, `maxPostProcessCandidates`·`CandidatePair` 동반 이동 | `Bitmap` 실행 |
| `data/repository/image/ImageSegmentationRepositoryImpl.kt` | `recoverCandidates` 추가, 수확 코드 제거 | 조합 |
| `domain/repository/image/ImageSegmentationRepository.kt` | `recoverCandidates` 선언 | 계약 |
| `domain/usecase/image/RecoverCandidatesUseCase.kt` | 신설 | 계약 |
| `feature/segmentation/impl/.../SegmentationViewModel.kt` | 직전 실패 성격 3치 보관, 재시도 분기, `UseOriginal` 진입 시 취소 | 상태 |

수확 코드를 옮기는 것은 정리를 겸한 필수 작업이다. **옮기지 않으면 1차 경로와 회복 경로가 같은
로직을 둘로 갈라 갖게 된다.**

## 에러 처리

새 실패 표현을 만들지 않는다. `recoverCandidates`도 `Result<List<SegmentationCandidate>>`를
돌려주고, 전 단계가 실패하면 `Result.success(emptyList())`다. ViewModel은 `isError = true`로 접되
직전 실패를 「회복 후 0건」으로 기록한다.

- **`ModuleNotReady`가 나오면 즉시 중단**하고 그 실패를 그대로 올린다. 모듈이 없으면 남은 단계도
  전부 같은 이유로 실패한다. 다중 subject 갈래와 전경 폴백 갈래 **양쪽 모두** 이 규칙을 따른다.
- **그 밖의 예외와 `OutOfMemoryError`는 그 단계만 포기**하고 다음 단계로 넘어간다.
  `buildCandidatePair`가 이미 쓰는 관용구다.
- **`CancellationException`은 다시 던진다.** 값으로 접으면 취소된 흐름이 계속 돈다.

### 판 소유권

중간 판은 단계가 끝나면 회수한다. 선례는 `UploadImagePreprocessorImpl`과 `ToppingOutlineBitmap.kt`다.
⚠️ `toForegroundCandidate`에는 회수 호출이 없다 — 폴백을 후처리 커널에 태우며 중간 판 자체가
없어졌기 때문이다. 초안이 그 함수를 선례로 인용한 것은 잘못이었다.

⚠️ **후보가 참조하는 판은 회수 대상이 아니다.** `postProcess`는 알파가 안 바뀌고 판에 여백도 없으면
**입력 판 인스턴스를 그대로** 후보의 비트맵으로 돌려준다. 1차 경로에서는 그 판이 ML Kit 소유라
안전하지만, 회복 경로에서는 우리가 만든 중간 판이다. 회수 규칙이 그것을 지우면 후보의 비트맵이
죽고, 크래시는 세그멘테이션이 아니라 한참 뒤 `persistSubject`나 이미지 렌더링에서 난다.
**회복 경로의 수확은 판을 항상 새로 만든다.**

### 메모리 피크

동시에 사는 것을 표로 못 박는다. 앱은 `largeHeap`을 선언하지 않는다.

| 사는 것 | 언제 놓는가 |
|---|---|
| 원본 비트맵 | 놓지 않는다. ViewModel과 화면이 붙들고 있다 |
| 단계별 정규화·크롭 판 | 그 단계의 수확이 끝나면 즉시 |
| 1단계 `SubjectSegmentationResult` | **2단계 진입 전.** 힌트 사각형 하나만 남긴다 |
| 되올린 알파와 후보별 픽셀 배열 | 후보 하나를 만들 때마다 |
| `persistSubject`의 원본 크기 캔버스 | 그 함수가 `finally`로 이미 회수한다 |

히스토그램은 축소가 끝난 판에서 모은다. 원본을 통째로 읽으면 그 배열 하나가 판 하나만큼 크다.
`originalCandidate`가 이미 행 단위로 읽는 관용구를 만들어 두었다.

**대비 LUT의 적용은 픽셀 루프다.** `minSdk`가 26이라 `RenderEffect`를 못 쓰고, 임의 LUT는
`ColorMatrixColorFilter`로 표현되지 않는다(선형 행렬만 된다). 순서는 **축소 먼저, 그다음 축소판에서
히스토그램, 그다음 축소판에 LUT 인플레이스**다. 이 순서면 원본 전체 스캔이 없다.

## 테스트

판단을 순수 함수로 빼서 JVM에서 덮는다. `SegmentationMask.kt`·`SegmentationCandidateFilter.kt`가
선 패턴이다.

- **`RecoveryTransform` 역변환** — 축마다 배율이 다른 경우, 오프셋이 함께인 경우, 크롭과 원본의
  교집합 클램프, 그리고 **왕복 항등성**. 허용오차는 위 표의 값으로 고정한다. 숫자를 안 정하면
  구현자가 자기 오차에 맞춰 고르게 되어 테스트가 무엇이든 정답으로 굳는다.
- **해상도 목표 계산** — 하한과 상한의 경계값, 비율 보존, **둘이 충돌할 때 상한이 이기는 것**.
- **`normalizeStage`의 무동작 가드** — 목표 치수가 원본과 같고 대비도 안 걸면 널.
- **`focusStage`의 수축 가드** — 크롭이 충분히 안 줄면 널. 힌트가 없으면 중앙 크롭.
- **`hintBounds`** — 임계 초과 픽셀이 흩어진 경우의 사각형, 하나도 없으면 널.
- **`contrastLut`** — 퍼센타일 절단, 히스토그램이 한 값에 몰려 분모가 0인 경우 항등 LUT.
- **`resampleAlpha`** — **확대와 축소 양쪽**, 치수 일치, 경계값.
- **사각형이 캔버스 안에 있는지 보는 `require`** — 넘치는 입력이 예외로 잡히는 것.
- **재시도 분기 3치** — 예외면 기존 경로, 회복 전 0건이면 회복 경로, 회복 후 0건이면 다시 기존 경로.
  `SegmentationViewModelTest`가 이미 있다.

ML Kit 호출과 `Bitmap` 생성은 유닛으로 덮지 않는다. 기존 방침 그대로다.

## 근거 등급 (이 스펙의 계약)

**관찰된 실패 사례가 없는 상태에서 쓰는 스펙이다.** 검출이 안 되는 실제 사진을 아직 모으지 못했다.
[segmentation-preprocessing](2026-08-23-segmentation-preprocessing.md)이 같은 처지에서 쓴 근거
등급표를 이어받는다. **이 표가 이 스펙의 계약이다.**

| 항목 | 근거 | 판정 |
|---|---|---|
| 좌표 역변환과 수확 분리 | 없으면 결과 색이 변한다. 코드로 확정된다 | 무조건 |
| `Subject` 의존 제거와 마스크 치수 분리 | 없으면 회복 폴백이 조용히 빈 목록이 된다. 코드로 확정된다 | 무조건 |
| 사각형이 캔버스 안인지 보는 `require` | 없으면 저장 시점에 조용히 잘린다. 코드로 확정된다 | 무조건 |
| 재시도 3치 분기 | 2치면 회복 실패 뒤 같은 사다리를 반복한다. 코드로 확정된다 | 무조건 |
| 대기 상한과 `UseOriginal` 취소 | 두 잡이 다른 키라 지금은 동시에 돈다. 코드로 확정된다 | 무조건 |
| 검출 입력 긴 변 상한 | **자원 근거로만 무조건이다.** 검출률에 대한 근거는 없고 로그로 감시한다 | 무조건 |
| 회복 경로 필터 하한 완화 | 하한이 원본 면적 기준이라 2단계 수익을 상쇄한다. 코드로 확정된다 | 무조건 |
| 2단계 힌트 크롭 | 상대 크기가 지배 변수라는 것은 통념이나 이 앱에서 미측정 | 조건부 |
| 1단계 대비 스트레치 | 문서 근거가 없다. 기존 스펙이 보류한 항목이다 | 조건부 |
| 짧은 변 하한 확대 | 확대는 정보를 늘리지 않는다(OQ-P-278) | 조건부 |

**판정 수단은 순수 함수 유닛 테스트와 실사용 로그다.** 변환의 정확성은 유닛이 잠그고, 검출 수익은
단계별 로그가 판정한다.

**철회 조건**은 단계별 로그다. 단계마다 아래를 한 줄씩 남긴다.

- 어느 단계가 돌았고 가드에 걸려 건너뛰었는지
- 힌트가 나왔는지, 크롭이 원본 대비 얼마로 줄었는지
- 긴 변 상한이 실제로 걸렸는지
- **필터 완화 전 후보 수와 완화 후 후보 수**
- 후보 수와 소요

기존 `toCandidatePairs`가 남기는 "subject 몇 개 중 판 있음 몇 개, bbox 하한 통과 몇 개" 줄이 그대로
0건의 원인을 갈라 주므로 회복 경로에서도 같은 형식을 유지한다.

## 주의 / 열린 질문

- **잠정값** — 위 4-1 표의 값은 전부 잠정이다. 로그가 판정한다.
- **마스크 수명(신규)** — 1단계 `SubjectSegmentationResult`의 전경 신뢰도 버퍼가 **새 세그멘터를 열고
  닫은 뒤에도 유효한지 확인하지 못했다.** 지금 코드는 같은 호출 안에서 세그멘터 종료 직후 읽는
  데까지만 의존한다. 이 스펙은 힌트를 2단계 진입 전에 뽑아 두는 것으로 이 의존을 없앴지만, 구현할 때
  실기기에서 한 번 확인한다.
- **ML Kit 추론의 결정성** — "재시도는 항상 같은 결과"의 근거는 우리 코드까지다.
- **재표본의 방식** — 축소에 박스 평균을 쓰는 것이 쌍선형보다 낫다는 것은 에일리어싱 일반론이고
  이 파이프라인에서 측정하지 않았다.
- **OQ-P-278 잔존** — 확대로 정확도가 회복된다는 근거는 여전히 없다.
- **OQ-P-282 회피** — 회복 경로가 원본에서 오려내므로 토핑 초기 크기와 서버 `scale` 전파가 없다.
  `persistSubject`의 `SourceLongSide`가 후보의 캔버스 치수에서 나오기 때문이다. 다만 그 미결 자체는
  `decodeImage` 전역 정규화를 넣을 때 다시 살아난다.
- **OQ-P-150 잔존** — 힌트 크롭 여유의 근거로 삼은 누끼 Safe Margin 정책이 아직 코드에 없다.
- **선행 스펙과의 파일명** — `SegmentationInputNormalizer.kt`는 선행 스펙이
  `computeUpscaleTarget`과 픽셀 상한을 담을 파일로 예약해 둔 이름이다(미착수). 이 스펙은 다른 이름을
  써서 충돌을 피한다. 나중에 512 항목을 전역으로 채택할 때 두 파일의 관계를 정리한다.

## 검수 이력

**2026-09-10, 서브에이전트 검수 2회(사실 대조·설계 공격).** 초안을 여섯 축에서 뒤집었다.

1. **`maskSubjectAlpha`에 되올린 알파를 넣을 입구가 없었다.** 그 함수는 `FloatBuffer` 신뢰도를 받아
   램프와 후처리를 한 덩어리로 돈다. "후처리를 손대지 않아도 된다"는 초안의 주장이 절반만 참이었다.
2. **`postProcess`를 그대로 못 쓴다.** `Subject`를 받아 오프셋을 잡는데 그 클래스는 final이라 원본
   좌표를 담은 인스턴스를 만들 수 없다. 등급표의 "무조건" 판정이 이 재설계 비용을 안 세고 있었다.
3. **2단계 힌트가 구조적으로 거의 항상 비었다.** 힌트 하한을 폴백 이진화보다 높은 축에 잡았기
   때문이다. 하한을 같은 축으로 내리고 수축 가드를 더했다.
4. **`upscaleAlpha`의 "축소는 안 온다"가 같은 스펙의 512 하한과 모순이었다.** 확대와 축소를 모두 받는
   재표본으로 바꿨다.
5. **회복 실패 뒤의 재시도가 원래 버그를 재생산했다.** 실패 성격을 3치로 갈랐다.
6. **안전망으로 지목한 `require`들이 항진명제였다.** 정작 깨질 수 있는 것은 사각형이 캔버스 안인지인데
   아무도 안 봤고, 깨지면 저장 시점에 조용히 잘린다.

그 밖에 전경 폴백이 필터를 안 거친다는 것, 폴백이 `ModuleNotReady`를 삼킨다는 것, 회수 규칙이 후보의
판을 지울 수 있다는 것, 단일 스케일의 오차 누적, 메모리 피크 산정 누락, 회복 분기의 상태 시퀀스
미지정, 취소 부재, 1단계 무동작, 파일명 충돌, 그리고 회수 관용구의 선례가 이미 삭제된 코드라는 것을
반영했다.
