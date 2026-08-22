---
id: c103-multi-subject-selection
title: C-103 다중 피사체 후보 선택 (ML Kit enableMultipleSubjects)
status: draft
category: ui-spec
platforms: android
verified: 2026-08-23
related_code:
  - ImageSegmentationRepositoryImpl.kt#segmentImage
  - ImageSegmentationRepositoryImpl.kt#persistSubject
  - ImageSegmentationRepository
  - SegmentationCandidate
  - SegmentationResult
  - SegmentationBounds
  - SegmentationMask.kt#maskSubjectPixels
  - SegmentationCandidateFilter.kt#filterCandidates
  - SegmentImageUseCase
  - PersistSubjectUseCase
  - SegmentationViewModel.kt#SegmentationViewModel
  - SegmentationScreen.kt#SegmentationScreen
  - SegmentationSubjectHighlight.kt#SegmentationSubjectHighlight
  - SegmentationRoute.kt#SegmentationRoute
  - NavKeySegmentationConfirm
related_adr: ADR-0026
related_spec: c103-segmentation-topping-edit, segmentation-pipeline-hardening, c106-topping-place-api
related_architecture: module-structure, data-layer, navigation-flow
supersedes:
superseded_by:
tags: [spec, parfait, segmentation, topping, c103]
---

# Spec: C-103 다중 피사체 후보 선택

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처. 본문은 설계 내용에 집중.

- **화면 ID**: C-103-select
- **대상 모듈**: `feature/segmentation/impl` + `domain`(모델·Repository·UseCase) +
  `data`(`ImageSegmentationRepositoryImpl`)

## 목표

사진에 피사체가 여럿일 때 사용자가 그중 하나를 골라 토핑으로 쓰게 한다.

## 왜 지금 없는가

정책에는 처음부터 있었다. 위키 [[누끼-따기]] ([link](../../wiki/concepts/누끼-따기.md))가
기능정의서 v5를 근거로 "누끼가 다중으로 잡히면
C-103-select로, 단일이면 C-103으로" 갈리는 서브 화면을 정의한다. 구현이 그 갈래를 만들지 않았을
뿐이고, [c103-segmentation-topping-edit 스펙](archive/2026-08-15-c103-segmentation-topping-edit.md)이
제외 항목에 "다중 피사체 선택(C-103-select 본래 의미)"으로 적어 두었다.

구현이 후보를 하나로 접는 자리는 **ML Kit 옵션 한 곳**이다. `segmentImage`가
`enableForegroundConfidenceMask()`만 켜서 **전경 전체를 하나로 합친 마스크 1장**을 받고,
`maskSubjectPixels`가 그 마스크 전체를 훑어 bounding box를 **하나만** 누적한다. 그래서 떨어져
있는 두 물체가 잡혀도 박스가 둘이 되지 않고 **둘을 함께 감싸는 큰 박스 하나**가 된다.
`SegmentationResult`·`SegmentationState`·`SegmentationSubjectHighlight`가 모두 그 단수 전제 위에
서 있어, 이 라운드는 옵션 한 줄이 아니라 그 경계들을 함께 넓힌다.

## 화면 ID 대응

C-103-select를 **별도 목적지로 만들지 않는다.** `NavKeySegmentation` 하나가 후보 수에 따라 점선
박스를 1개 또는 N개 그린다. 후보가 1개면 지금 화면과 픽셀 단위로 같다.

정책이 화면 ID를 둘로 가른 것은 식별 체계상의 구분이고, 두 상태의 UI가 같은 형태라 목적지를
쪼개면 NavKey·Route·EntryBuilder·ViewModel이 한 벌 늘고 두 화면이 거의 같은 코드를 복제한다.
[c103-segmentation-topping-edit 스펙](archive/2026-08-15-c103-segmentation-topping-edit.md)의
화면 ID 대응 표가 이미 `NavKeySegmentation` 하나에 C-103-loading과 C-103-select를 함께 매핑해
둔 것과 같은 판단이다.

## 범위

- **포함**
  - ML Kit 다중 옵션 전환 — `enableMultipleSubjects` + `enableSubjectBitmap`.
  - `SegmentationCandidate` 신설 및 `segmentImage` 반환 타입 다중화.
  - `persistSubject` 신설 — 저장·초안 기록을 **선택 시점으로 이동**.
  - 후보 필터 순수 함수 신설 — 면적 임계·개수 상한·결정적 정렬.
  - 후보 0건 시 전경 마스크 폴백.
  - 다중 하이라이트 렌더링과 탭 판정.
  - 선택 결과의 화면 이동을 Route 직접 호출에서 side effect 수신으로 이동.
- **제외**(이번 라운드에서 안 함)
  - **후보 비트맵의 명시적 해제** — 지금 `originBitmap`도 해제하지 않는 관례를 따른다(OQ-P-266).
  - **원본 다운샘플** — OQ-P-228이 계속 열려 있고, 이 라운드가 그 압력을 키운다(OQ-P-266).
  - 선택 취소·다시 고르기 동선 — 확인 화면에서 뒤로 가면 이 화면으로 돌아오는 기존 동선 그대로다.
  - 후보에 순번·라벨 표시 — 점선 박스만으로 구분한다.
  - 세그멘테이션 실패 후 재시도(OQ-P-003 ① 잔존).

## 동작 / 구조

### ML Kit 옵션

```kotlin
SubjectSegmenterOptions.Builder()
    .enableMultipleSubjects(
        SubjectSegmenterOptions.SubjectResultOptions.Builder()
            .enableSubjectBitmap()
            .build(),
    )
    .enableForegroundConfidenceMask()
    .build()
```

`enableSubjectBitmap()`을 켜면 `Subject.getBitmap()`이 이미 bounds 크기로 잘린 판을 준다. 후보마다
전체 픽셀을 훑어 마스킹하고 다시 자르는 일이 사라진다. `Subject.getConfidenceMask()`는 쓰지 않는다 —
마스크를 받아 우리가 자르는 대안과 결과가 같은데 코드가 길다.

`enableForegroundConfidenceMask()`는 폴백 경로 때문에 함께 켠다.

### 도메인 모델

```kotlin
data class SegmentationCandidate(
    val bounds: SegmentationBounds,
    val bitmap: BitmapWrapper,
    val canvasWidth: Int,
    val canvasHeight: Int,
)
```

`canvasWidth`·`canvasHeight`는 `bounds`가 어느 좌표계의 값인지를 말한다. 한 번의 세그멘테이션에서
나온 후보들끼리 같은 값이 복제되지만, 후보 하나가 자기 좌표계를 온전히 설명하므로
`persistSubject(candidate)`에 다른 크기를 실어 보내 좌표가 어긋나는 조합이 성립하지 않는다.

`SegmentationResult`는 **그대로 둔다.** 확인 화면·토핑 편집·초안 기록 등 하류가 이 타입을 통해
연결돼 있고, 이 라운드는 그 앞단만 넓힌다.

### Repository 계약

한 메서드가 하던 일을 둘로 가른다.

```kotlin
suspend fun segmentImage(bitmapWrapper: BitmapWrapper): Result<List<SegmentationCandidate>>
suspend fun persistSubject(candidate: SegmentationCandidate): Result<SegmentationResult>
```

`segmentImage`는 디스크를 건드리지 않는다. `persistSubject`가 두 장을 만든다 — 후보 비트맵을
`canvasWidth × canvasHeight` 투명 캔버스의 `(bounds.left, bounds.top)`에 그려 `subjectImagePath`를,
후보 비트맵 자체를 `trimmedSubjectImagePath`를 만든다. 두 경로의 의미는 지금과 같다(원본 좌표계 판은
수동 편집이 원본과 픽셀로 겹쳐 그리는 데, 트리밍 판은 미리보기·배치에 쓴다).

UseCase도 대칭으로 `SegmentImageUseCase`와 `PersistSubjectUseCase` 둘이 된다.

### 후보 필터

판단이 드는 부분이라 기기 없이 검증되는 순수 함수로 뺀다. `SegmentationMask.kt`가 `Bitmap` 대신
`IntArray`·`FloatBuffer`를 받게 해 둔 것과 같은 이유다.

- 면적이 원본의 `MIN_SUBJECT_AREA_RATIO`(1%) **미만**이면 버린다.
- 남은 것을 면적 내림차순으로 정렬해 `MAX_SUBJECT_COUNT`(5)개까지 취한다.
- 면적 동률은 `top` → `left` 오름차순으로 가른다. ML Kit 반환 순서에 기대지 않아야 테스트가
  흔들리지 않는다.

면적은 마스크의 실제 객체 픽셀 수가 아니라 **bounds 면적**으로 잰다. 이 필터가 거르려는 것은 손톱만
한 파편이고, 그 판정에는 bounds로 충분하다.

⚠️ **두 상수는 실측이 아니다** — 실기기에서 ML Kit가 몇 개를, 어떤 크기로 돌려주는지 아직 보지
않았다(OQ-P-267). 값만 고치면 되도록 상수로 두고 순수 함수로 덮는다.

### 후보 0건 폴백

`getSubjects()`가 빈 리스트인데 전경 마스크는 있을 수 있다. 이때 기존 `maskSubjectPixels` 경로로
후보 1개를 만든다.

이 폴백이 없으면 **지금 잘 되던 사진이 다중 전환 이후 실패로 바뀌는 회귀**가 열린다. 대가는 코드
경로가 둘이 되는 것이고, 그 둘째 경로는 이미 있는 코드이며 이미 테스트가 덮고 있다.

폴백까지 비면 지금과 같다 — 에러 토스트 한 번, 원본 사진만 남는다.

### 상태·의도·효과

```kotlin
data class SegmentationState(
    val isLoading: Boolean = true,
    val originBitmap: Bitmap? = null,
    val candidates: List<SegmentationCandidate> = emptyList(),
) : UiState
```

`subjectImagePath`·`trimmedSubjectImagePath`·`subjectBounds` 세 필드는 상태에서 빠진다. 저장이 탭
시점으로 옮겨 가면 화면이 경로를 들고 있을 이유가 없다.

지금 비어 있는 `SegmentationIntent`가 실제로 쓰인다.

```kotlin
sealed interface SegmentationIntent : UiIntent {
    data class ClickCandidate(val index: Int) : SegmentationIntent
}

sealed interface SegmentationEffect : UiSideEffect {
    data object ShowError : SegmentationEffect
    data class GoToConfirm(
        val subjectImagePath: String,
        val trimmedSubjectImagePath: String,
    ) : SegmentationEffect
}
```

의도에는 인덱스만 싣는다 — 비트맵이 의도에 얹히지 않는다.

저장이 비동기라 화면 이동이 `SegmentationRoute`의 직접 `goTo` 호출에서 `GoToConfirm` 수신으로
옮겨 간다. 저장하는 동안 `isLoading`을 다시 켜 기존 `YGScaffoldV2` 오버레이를 그대로 쓴다.
**저장이 진행 중이면 뒤이은 탭은 ViewModel이 무시한다** — 오버레이가 터치를 막아 주는지에 기대지
않는다.

### 다중 하이라이트

`SegmentationSubjectHighlight`가 `bounds` 하나 대신 `List<SegmentationBounds>`를 받고,
`onClickSubject: () -> Unit`이 `onClickCandidate: (index: Int) -> Unit`이 된다.

딤은 후보 사각형을 모두 담은 `Path`를 만들어 `clipPath(path, ClipOp.Difference)` 한 번으로 뺀다.
`clipRect(ClipOp.Difference)`를 후보 수만큼 중첩해도 결과가 같지만(각각 빼는 것과 교집합이 같다),
재귀 없이 평평하게 쓰려면 `Path` 쪽이다. 테두리는 후보마다 지금과 같은 흰 dashed `Stroke`다.

원본 픽셀 좌표를 `ContentScale.Fit` 화면 좌표로 옮기는 `subjectRect` 계산은 그대로 두고, 그리기와
탭 판정이 같은 계산을 공유하는 구조도 그대로다.

**겹친 후보의 탭 판정은 목록을 뒤에서부터 훑어 처음 맞는 것을 고른다.** 목록이 면적 내림차순이라
뒤로 갈수록 작고, 큰 후보 안에 작은 후보가 들어 있을 때 작은 쪽이 잡힌다. 앞에서부터 훑으면 안쪽
대상을 **아예 고를 수 없다** — 바깥 후보가 항상 먼저 맞는다.

### 문구

`GuideBanner`의 "토핑으로 사용할 대상을 하나 선택해 주세요"는 손대지 않는다. 후보가 여럿인 상황에서
그대로 맞고, 후보가 1개일 때의 현행 문구이기도 하다.

## PR 분할

스택 둘로 나눈다. PR2의 베이스는 PR1 브랜치다.

| # | 범위 | 주요 파일 | 보이는 변화 |
|---|---|---|---|
| 1 | data·domain 다중화 | `ImageSegmentationRepositoryImpl` · `SegmentationCandidate` · `ImageSegmentationRepository` · `SegmentationCandidateFilter` · `SegmentImageUseCase` · `PersistSubjectUseCase` | 없음 |
| 2 | UI 다중 표시 | `SegmentationState`·`SegmentationViewModel` · `SegmentationScreen` · `SegmentationSubjectHighlight` · `SegmentationRoute` | 점선 박스가 후보 수만큼 |

PR1에서 ViewModel은 `candidates.firstOrNull()` 하나만 써서 화면 동작을 지금과 같게 유지한다.
계약과 파이프라인이 먼저 바뀌고 그 위에서 화면이 열리는 순서라, PR1 리뷰는 ML Kit를 다루는 판단에,
PR2 리뷰는 그리기와 탭 판정에 각각 집중된다.

두 PR 모두 develop 기준 10파일 안팎으로 예상한다. 계획을 쓰면서 분량이 커지면 그때 다시 가른다.

## 테스트

- `SegmentationCandidateFilterTest`(신규, JVM) — 면적 임계 경계값, 상한 초과 시 절단, 면적 동률
  타이브레이크, 빈 입력.
- `SegmentationMaskTest`(기존) — 폴백 경로가 살아 있으므로 그대로 유효하다.
- `SegmentationViewModelTest`(확장) — 후보 다중 시 상태 반영, `ClickCandidate` 시 저장 호출과
  `GoToConfirm` 효과, 저장 중 중복 탭 무시, 후보 0건 시 `ShowError`.
- `ImageSegmentationRepositoryImpl` 자체는 ML Kit·`Bitmap` 의존이라 JVM 유닛 대상이 아니다.
  판단이 드는 부분(필터·정렬·좌표 계산)을 순수 함수로 빼 그쪽을 덮는다.

## 미결 신규

- **OQ-P-266** — 후보 비트맵을 명시적으로 해제하지 않는다. 상한 5개와 면적 필터가 총량을 누르지만,
  `originBitmap`과 겹쳐 살아 있어 OQ-P-228(원본 다운샘플 부재)의 압력을 키운다. ML Kit가 돌려준
  비트맵의 소유권이 문서에 없어 `recycle()`을 부르면 내부 재사용 중일 때 그리기가 깨진다.
- **OQ-P-267** — `MIN_SUBJECT_AREA_RATIO` 1%와 `MAX_SUBJECT_COUNT` 5의 근거가 실측이 아니다.
  실기기에서 후보 개수·크기 분포를 본 뒤 재조정한다.

## 연관

- 정책: 위키 [[누끼-따기]] ([link](../../wiki/concepts/누끼-따기.md)) —
  C-103-loading / C-103-select 분기 정의(기능정의서 v5)
- 선행: [c103-segmentation-topping-edit](archive/2026-08-15-c103-segmentation-topping-edit.md) —
  제외 항목으로 적힌 다중 선택을 이 라운드가 닫는다
- 선행: [segmentation-pipeline-hardening](archive/2026-08-18-segmentation-pipeline-hardening.md) —
  `maskSubjectPixels` 순수 함수 분리·캐시 정리가 이 라운드의 전제다
