---
id: topping-draft-usecase-extraction
title: 토핑 초안 접근을 UseCase 다섯으로 가른다
status: draft
category: behavior-spec
platforms: android
verified:
related_code:
  - ToppingDraftRepository.kt#ToppingDraftRepository
  - CanvasMainViewModel.kt#CanvasMainViewModel
  - CanvasToppingPlaceViewModel.kt#CanvasToppingPlaceViewModel
  - SegmentationViewModel.kt#SegmentationViewModel
  - SegmentationConfirmViewModel.kt#SegmentationConfirmViewModel
related_adr: ADR-0026
related_spec: c106-topping-place-api
related_architecture: state-management, module-structure
supersedes:
superseded_by:
tags: [spec, parfait, topping, usecase, refactoring]
---

# Spec: 토핑 초안 접근을 UseCase 다섯으로 가른다

## 목표

`feature/*/impl`의 ViewModel이 `ToppingDraftRepository`를 직접 주입받아 부르는 자리를 없앤다.
그 사이에 UseCase를 놓아, 화면이 도메인 계층을 볼 때 언제나 UseCase만 보게 만든다.

## 배경

`feature/*/impl` 아래 ViewModel 21개를 전수조사한 결과, Repository를 직접 주입받는 것은 넷이고
전부 같은 타입 `ToppingDraftRepository` 하나였다. DataSource를 직접 받는 ViewModel은 없다.

- `CanvasMainViewModel` — 흐름을 연다.
- `CanvasToppingPlaceViewModel` — 초안을 구독하고, 배치에 성공하면 비운다.
- `SegmentationViewModel` — 후보를 고르거나 원본을 그대로 쓸 때 적는다.
- `SegmentationConfirmViewModel` — 진입 판정으로 읽고 적으며, 화면 상태로 구독한다.

`ToppingDraftRepository`가 `:domain`에 선언되어 있어 모듈 의존 방향이 뒤집힌 것은 아니다.
어긋난 것은 계층이다. 나머지 ViewModel 17개는 예외 없이 UseCase만 받는다.

토핑 초안이 화면 다섯을 가로지르는 흐름 상태라서([ADR-0026](../adr/0026-topping-draft-datastore-ssot.md))
UseCase로 감쌀 단위를 잡기 애매했던 것이 원인으로 보인다. 다만 실제로 쓰이는 Repository 표면은
`draft`·`start`·`clear`·`record` 넷뿐이고 경계도 뚜렷하다.

## 범위

- 포함
  - `:domain`의 `usecase/topping/`에 UseCase 5종 신설.
  - ViewModel 4개의 생성자 의존성과 호출부를 그 UseCase로 교체.
  - `SegmentationConfirmViewModel`의 재사용 진입 판정을 UseCase로 이관.
  - 기존 ViewModel 테스트 4파일의 테스트 더블 교체, 판정 UseCase의 신규 유닛 테스트.
- 제외
  - `ToppingDraftRepository` 인터페이스의 시그니처·KDoc 변경. 계약은 그대로 둔다.
  - `:data`의 `ToppingDraftRepositoryImpl`과 그 테스트.
  - 다른 Repository·다른 ViewModel. 조사에서 위반이 나오지 않았다.
  - Repository를 feature 모듈에서 아예 못 보게 막는 정적 검사 도입. 이번 라운드는 호출부를
    옮기는 데까지다.

## 설계

### UseCase 5종

전부 `com.teamyg.parfait.domain.usecase.topping` 아래에 두고 `@Inject constructor`로
`ToppingDraftRepository`를 받는다. 호출은 저장소 관례대로 `operator fun invoke`다.

| UseCase | 시그니처 | 대체하는 호출부 |
|---|---|---|
| `GetToppingDraftFlowUseCase` | `operator fun invoke(): Flow<ToppingDraft?>` | `CanvasToppingPlaceViewModel#observeDraft`, `SegmentationConfirmViewModel#collectDraft` |
| `StartToppingDraftUseCase` | `suspend operator fun invoke(groupId: GroupId, parfaitId: ParfaitId, nextPositionZ: Int)` | `CanvasMainViewModel#startToppingFlow` |
| `ClearToppingDraftUseCase` | `suspend operator fun invoke()` | `CanvasToppingPlaceViewModel#handleOnClickConfirm` |
| `RecordToppingDraftUseCase` | `suspend operator fun invoke(subjectImagePath: String, cutoutImagePath: String?, borderColorArgb: Int?, borderWidthDp: Float?): Boolean` | `SegmentationViewModel#selectCandidate`·`#useOriginal`, `SegmentationConfirmViewModel#record` |
| `EnsureDraftSubjectRecordedUseCase` | `suspend operator fun invoke(subjectImagePath: String): Boolean` | `SegmentationConfirmViewModel`의 `init` 판정 |

이름은 기존 관례를 따른다. Repository의 `Flow`를 그대로 내보내는 것은 `Get…FlowUseCase`
(`GetTodayParfaitFlowUseCase`·`GetMyAccountFlowUseCase`와 같은 모양)이고, `Observe…UseCase`는
저장소에서 시간 축 같은 파생 흐름에 쓰이고 있어 여기서는 쓰지 않는다.

앞의 넷은 Repository로 그대로 넘기는 위임이다. **위임이라는 사실 자체가 이 스펙의 결정**이다 —
호출부의 의미가 각각 달라 보여도 도메인 규칙이 붙지 않은 자리에 규칙을 지어내지 않는다.

### 판정 UseCase

다섯 번째만 조합이 있다. `SegmentationConfirmViewModel`은 지금 초안을 `first()`로 한 번 읽어
그것이 현재 알맹이를 가리키는지 보고, 아니면 `record`로 적는다. 판정 기준이 "초안이 비었는가"가
아니라 "이 알맹이를 가리키는가"라는 것은
[c106-topping-place-api](archive/2026-08-20-c106-topping-place-api.md)가 정한 도메인 규칙이므로,
화면이 아니라 UseCase가 든다.

반환은 **"초안이 이 알맹이를 가리키게 되었는가"** 하나다. 이미 가리키고 있었을 때와 새로 적어
성공했을 때가 모두 `true`이고, 적으려다 실패했을 때만 `false`다. 호출부가 두 경우를 갈라 볼 일이
없어서 결과를 하나로 좁힌다.

`hasRecordedEntrySubject` 플래그는 ViewModel에 남긴다. `SavedStateHandle`에 얹혀 프로세스 사망
복원까지 살아남는 것이 그 플래그의 존재 이유인데, domain으로 옮기면 그 보장을 잃는다.
UseCase는 판정만 하고 "이미 했는지"는 화면이 기억한다.

### 반환 규약

`record`의 `Boolean` 반환(흐름이 열려 있지 않으면 `false`)을 `Result`로 바꾸지 않는다.
ViewModel 둘이 이미 그 분기로 `DraftWriteFailed`·`DraftMissing`을 내고 있어서, 반환 타입을 바꾸면
계층을 가르는 이 작업이 오류 처리 설계까지 함께 건드리게 된다. 두 변경을 한 번에 섞지 않는다.

## 오류 처리

지금 동작을 그대로 유지한다.

- `EnsureDraftSubjectRecordedUseCase`가 `false`를 내면 ViewModel이 `reportMissingDraft()`를
  부른다. 표시를 남기지 않아 복원된 화면이 다시 적어 보는 성질도 그대로다.
- `RecordToppingDraftUseCase`가 `false`를 내면 `SegmentationConfirmEffect.DraftWriteFailed`.
- UseCase는 예외를 삼키지 않는다. `launch(onError = …)` 가드는 호출부에 그대로 둔다.

## 테스트

- 신규는 `EnsureDraftSubjectRecordedUseCaseTest` 하나다. 초안이 같은 알맹이를 가리킬 때(적지
  않고 `true`), 다른 것을 가리켜 새로 적을 때(`record` 호출 후 `true`), `record`가 `false`를 낼
  때 세 갈래를 덮는다. `domain/src/test`가 이미 있어 새 하니스를 들이지 않는다.
- 위임만 하는 UseCase 4종은 단독 테스트를 만들지 않는다. 검증할 판단이 없고, 기존 ViewModel
  테스트가 그 경로를 그대로 덮는다.
- 기존 ViewModel 테스트 4파일(`CanvasMainViewModelTest`·`CanvasToppingPlaceViewModelTest`·
  `SegmentationViewModelTest`·`SegmentationConfirmViewModelTest`)은 `ToppingDraftRepository`
  더블을 각 UseCase 더블로 바꾼다. 저장소의 ViewModel 테스트가 UseCase를 MockK으로 세우고 있으므로
  (`GetTutorialVisibleFlowUseCase` 등) 같은 방식을 쓴다. 이 파일들만 Fake로 갈아타면 관례가
  갈린다. **단언 대상은 바뀌지 않는다** — 화면 상태와 side effect를 그대로 본다.

## 주의 / 열린 질문

- ⚠️ **UseCase를 지나가는지 컴파일러가 검사하지 않는다.** `feature/*/impl`은 `:domain` 전체를
  보므로 새 ViewModel이 Repository를 다시 직접 주입해도 빌드가 통과한다. 정적 검사로 막는 것은
  이 스펙의 범위 밖이고, 막을지 여부는 후속 판단이다.
- 위임만 하는 UseCase 4종은 계층을 지키는 값 말고는 하는 일이 없다. 도메인 규칙이 나중에 붙는
  자리가 여기라는 것이 이 배치의 전제다.
